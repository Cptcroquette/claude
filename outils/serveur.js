// Serveur de développement sans dépendance : node outils/serveur.js -> http://localhost:8123
// - sert les fichiers du jeu (index.html, style.css, engine.js, studio.js, data/...)
// - POST /api/monde : le studio réécrit data/monde-exemple.js directement sur le disque
//   (avec une copie de sécurité horodatée à chaque sauvegarde)
// (Le jeu marche aussi en ouvrant index.html directement ; le studio a besoin du
// serveur uniquement pour le bouton Sauvegarder, qui écrit sur le disque.)
const http = require('http'), fs = require('fs'), path = require('path');

const racine = path.join(__dirname, '..'), port = process.env.PORT || 8123;
const FICHIER_MONDE = path.join(racine, 'data', 'monde-exemple.js');
const DOSSIER_SAUVEGARDES = path.join(racine, 'data', 'sauvegardes');
const MAX_SAUVEGARDES = 30;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function copieDeSecurite() {
  if (!fs.existsSync(FICHIER_MONDE)) return null;
  fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const nom = `monde-exemple-${horodatage}.js`;
  fs.copyFileSync(FICHIER_MONDE, path.join(DOSSIER_SAUVEGARDES, nom));
  const anciennes = fs.readdirSync(DOSSIER_SAUVEGARDES).filter(f => f.startsWith('monde-exemple-')).sort();
  for (const f of anciennes.slice(0, Math.max(0, anciennes.length - MAX_SAUVEGARDES))) fs.unlinkSync(path.join(DOSSIER_SAUVEGARDES, f));
  return nom;
}

function valider(monde) {
  if (!monde || typeof monde !== 'object') return 'Données manquantes';
  if (!monde.pieces || typeof monde.pieces !== 'object') return 'Il manque "pieces"';
  if (!monde.objets || typeof monde.objets !== 'object') return 'Il manque "objets"';
  if (!Array.isArray(monde.passages)) return 'Il manque "passages"';
  if (!monde.journee || typeof monde.journee !== 'object') return 'Il manque "journee"';
  return null;
}

function enregistrerMonde(req, res) {
  // On garde les octets tels quels et on ne décode qu'à la fin : une lettre accentuée
  // coupée entre deux morceaux de la requête serait sinon abîmée.
  const morceaux = []; let taille = 0;
  req.on('data', morceau => {
    morceaux.push(morceau); taille += morceau.length;
    if (taille > 20 * 1024 * 1024) { json(res, 413, { ok: false, erreur: 'Données trop volumineuses' }); req.destroy(); }
  });
  req.on('end', () => {
    let monde;
    try { monde = JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch (e) { return json(res, 400, { ok: false, erreur: 'JSON illisible' }); }
    const erreur = valider(monde);
    if (erreur) return json(res, 400, { ok: false, erreur });
    try {
      const sauvegarde = copieDeSecurite();
      const contenu = '// Fichier généré automatiquement par le studio (bouton Sauvegarder).\n'
        + "// Ne modifie pas ce fichier à la main : la prochaine sauvegarde l'écraserait.\n"
        + 'var MONDE_EXEMPLE = ' + JSON.stringify(monde, null, 2) + ';\n';
      fs.writeFileSync(FICHIER_MONDE, contenu);
      console.log(`Monde enregistré (${Object.keys(monde.pieces).length} pièces, ${Object.keys(monde.objets).length} objets)${sauvegarde ? ` — copie : ${sauvegarde}` : ''}`);
      json(res, 200, { ok: true, sauvegarde });
    } catch (e) {
      json(res, 500, { ok: false, erreur: e.message });
    }
  });
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/ping') return json(res, 200, { ok: true });
  if (url === '/api/monde' && req.method === 'POST') return enregistrerMonde(req, res);

  const fichier = path.join(racine, url === '/' ? 'index.html' : url);
  if (!fichier.startsWith(racine)) { res.writeHead(403); return res.end(); }
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(fichier)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`Flot — Studio : http://localhost:${port}`));
