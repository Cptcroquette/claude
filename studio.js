// ============================================================================
// STUDIO.JS — l'éditeur visuel.
//
// Ce fichier connaît le moteur (engine.js) pour pouvoir lancer le mode Play,
// mais le moteur ne connaît jamais ce fichier. Toutes les données du monde
// vivent dans la variable "monde" ci-dessous : le studio la modifie, l'exporte,
// l'importe, et la sauvegarde automatiquement dans localStorage.
// ============================================================================

(function () {
  "use strict";

  var CLE_STOCKAGE_MONDE = "flot-monde";

  var monde = null;                 // le monde actuellement édité
  var selection = { type: null, id: null };   // { type: "piece"|"objet"|"passage"|null, id }
  var modeLiaison = { active: false, premierePiece: null };
  var compteurId = 0;

  // --------------------------------------------------------------------
  // OUTILS GÉNÉRAUX
  // --------------------------------------------------------------------

  function copieProfonde(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function idUnique(prefixe) {
    compteurId++;
    return prefixe + "_" + Date.now().toString(36) + compteurId;
  }

  function nomPieceSure(id) {
    return (monde.pieces[id] && monde.pieces[id].nom) || ("⚠ " + id);
  }

  function trouverPassage(id) {
    for (var i = 0; i < monde.passages.length; i++) {
      if (monde.passages[i].id === id) return monde.passages[i];
    }
    return null;
  }

  function verbesParDefaut(type) {
    var v = {
      regarder: { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] },
      prendre: { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] },
      deplacer: { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] },
      utiliser: { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [], combinaisons: [] }
    };
    if (type === "personnage") {
      v.parler = { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] };
    }
    return v;
  }

  function normaliserMonde(m) {
    m.pieces = m.pieces || {};
    m.objets = m.objets || {};
    m.passages = m.passages || [];
    m.journee = m.journee || { numero: 1, pieceDepart: null, heureAffichee: "", texteIntro: "", inventaireDepart: [] };
    m.journee.inventaireDepart = m.journee.inventaireDepart || [];
    m.passages.forEach(function (p) { if (!p.id) p.id = idUnique("pass"); });
    Object.keys(m.objets).forEach(function (id) {
      var o = m.objets[id];
      o.verbes = o.verbes || {};
    });
    return m;
  }

  // --------------------------------------------------------------------
  // PERSISTANCE (localStorage + export / import)
  // --------------------------------------------------------------------

  function sauvegarderLocalStorage() {
    try {
      localStorage.setItem(CLE_STOCKAGE_MONDE, JSON.stringify(monde));
    } catch (erreur) {
      console.warn("Impossible de sauvegarder le monde dans le navigateur.", erreur);
    }
  }

  function chargerMondeDepuisStockage() {
    try {
      var brut = localStorage.getItem(CLE_STOCKAGE_MONDE);
      if (brut) return JSON.parse(brut);
    } catch (erreur) {
      console.warn("Le monde sauvegardé est illisible, on repart de l'exemple.", erreur);
    }
    return null;
  }

  function exporterMonde() {
    var blob = new Blob([JSON.stringify(monde, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "monde.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------------------
  // SAUVEGARDE DIRECTE SUR LE DISQUE (dans le fichier du jeu)
  //
  // Le studio enregistre déjà tout automatiquement dans le navigateur à
  // chaque modification, mais ça ne survit pas à un nettoyage du navigateur
  // ou à un changement d'ordinateur. Si le petit serveur local tourne
  // (lancer-studio.bat), ce bouton lui envoie le monde et LUI écrit
  // directement dans data/monde-exemple.js — le fichier que le jeu charge
  // réellement au démarrage. Sans serveur, on retombe sur un téléchargement
  // classique de monde.json.
  // --------------------------------------------------------------------

  async function sauvegarderSurDisque() {
    sauvegarderLocalStorage();
    try {
      var reponse = await fetch("/api/monde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monde)
      });
      var resultat = await reponse.json();
      if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur || "erreur serveur");
      afficherMessage("Enregistré directement dans data/monde-exemple.js — c'est le fichier que le jeu charge au démarrage.", "info");
    } catch (erreur) {
      exporterMonde();
      afficherMessage("Le serveur local ne répond pas (lance lancer-studio.bat et laisse sa fenêtre ouverte). En attendant, monde.json a été téléchargé.", "avertissement");
    }
  }

  function importerMonde(evenement) {
    var fichier = evenement.target.files[0];
    if (!fichier) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var donnees = JSON.parse(lecteur.result);
        if (!donnees || !donnees.pieces || !donnees.objets || !donnees.passages || !donnees.journee) {
          afficherMessage("Ce fichier ne ressemble pas à un monde valide (il manque des parties essentielles).", "avertissement");
          return;
        }
        monde = normaliserMonde(donnees);
        deselectionner();
        sauvegarderLocalStorage();
        rafraichirPlan();
        afficherMessage("Import réussi.", "info");
      } catch (erreur) {
        afficherMessage("Impossible de lire ce fichier : ce n'est pas du JSON valide.", "avertissement");
      }
    };
    lecteur.readAsText(fichier);
    evenement.target.value = "";
  }

  function reinitialiserExemple() {
    if (!confirm("Cela remplace le monde actuellement édité par l'exemple prérempli. Continuer ?")) return;
    monde = normaliserMonde(copieProfonde(MONDE_EXEMPLE));
    deselectionner();
    sauvegarderLocalStorage();
    rafraichirPlan();
    afficherMessage("Le monde d'exemple a été rechargé.", "info");
  }

  // --------------------------------------------------------------------
  // BANDEAU DE MESSAGES
  // --------------------------------------------------------------------

  function afficherMessage(contenu, type) {
    var bandeau = document.getElementById("bandeau-messages");
    bandeau.innerHTML = "";
    var btnFermer = document.createElement("button");
    btnFermer.className = "msg-fermer";
    btnFermer.type = "button";
    btnFermer.textContent = "×";
    btnFermer.addEventListener("click", effacerMessage);
    bandeau.appendChild(btnFermer);

    var lignes = Array.isArray(contenu) ? contenu : [contenu];
    lignes.forEach(function (texte) {
      var ligne = document.createElement("div");
      ligne.className = "msg-ligne";
      ligne.textContent = (type === "avertissement" ? "⚠ " : "") + texte;
      bandeau.appendChild(ligne);
    });
    bandeau.classList.remove("cache");
  }

  function effacerMessage() {
    var bandeau = document.getElementById("bandeau-messages");
    bandeau.classList.add("cache");
    bandeau.innerHTML = "";
  }

  // --------------------------------------------------------------------
  // VALIDATION DES RÉFÉRENCES (appelée avant PLAY)
  // --------------------------------------------------------------------

  function validerEffet(effet, contexte) {
    var res = [];
    var ciblesAvecObjet = ["donnerObjet", "retirerObjet", "revelerObjet", "deplacerObjet"];
    if (ciblesAvecObjet.indexOf(effet.type) !== -1 && effet.cible && !monde.objets[effet.cible]) {
      res.push("Un effet de " + contexte + " référence un objet qui n'existe plus.");
    }
    if (effet.type === "deplacerObjet" && effet.pieceCible && !monde.pieces[effet.pieceCible]) {
      res.push("Un effet « déplacer un objet » de " + contexte + " référence une pièce qui n'existe plus.");
    }
    if ((effet.type === "ouvrirPassage" || effet.type === "fermerPassage") && effet.passageId) {
      if (!trouverPassage(effet.passageId)) {
        res.push("Un effet de " + contexte + " référence un passage qui n'existe plus.");
      }
    }
    return res;
  }

  function validerMonde() {
    var avertissements = [];

    Object.keys(monde.objets).forEach(function (id) {
      var objet = monde.objets[id];
      if (objet.piece && !monde.pieces[objet.piece]) {
        avertissements.push("L'objet « " + objet.nom + " » est placé dans une pièce qui n'existe plus.");
      }
      Object.keys(objet.verbes || {}).forEach(function (nomVerbe) {
        var verbe = objet.verbes[nomVerbe];
        (verbe.effets || []).forEach(function (effet) {
          avertissements = avertissements.concat(validerEffet(effet, "« " + objet.nom + " » (" + nomVerbe + ")"));
        });
        (verbe.effetsSansCourant || []).forEach(function (effet) {
          avertissements = avertissements.concat(validerEffet(effet, "« " + objet.nom + " » (" + nomVerbe + ", sans courant)"));
        });
        (verbe.combinaisons || []).forEach(function (combo) {
          if (combo.objetId && !monde.objets[combo.objetId]) {
            avertissements.push("Une combinaison de « " + objet.nom + " » utilise un objet qui n'existe plus.");
          }
          (combo.effets || []).forEach(function (effet) {
            avertissements = avertissements.concat(validerEffet(effet, "« " + objet.nom + " » (combinaison)"));
          });
          (combo.effetsSansCourant || []).forEach(function (effet) {
            avertissements = avertissements.concat(validerEffet(effet, "« " + objet.nom + " » (combinaison, sans courant)"));
          });
        });
      });
    });

    monde.passages.forEach(function (p) {
      if (!monde.pieces[p.de] || !monde.pieces[p.vers]) {
        avertissements.push("Un passage relie une pièce qui n'existe plus.");
      }
      if (p.cleObjetId && !monde.objets[p.cleObjetId]) {
        avertissements.push("Le passage " + nomPieceSure(p.de) + " ↔ " + nomPieceSure(p.vers) + " référence une clé qui n'existe plus.");
      }
    });

    if (!monde.journee.pieceDepart || !monde.pieces[monde.journee.pieceDepart]) {
      avertissements.push("La pièce de départ de la journée n'existe pas ou plus.");
    }
    (monde.journee.inventaireDepart || []).forEach(function (id) {
      if (!monde.objets[id]) avertissements.push("L'inventaire de départ référence un objet qui n'existe plus.");
    });

    return avertissements;
  }

  // --------------------------------------------------------------------
  // SÉLECTION
  // --------------------------------------------------------------------

  function selectionner(type, id) {
    selection = { type: type, id: id };
    rafraichirPlan();
    rafraichirPanneau();
  }

  function deselectionner() {
    selection = { type: null, id: null };
    rafraichirPanneau();
  }

  // --------------------------------------------------------------------
  // MODE LIAISON (« Relier deux pièces »)
  // --------------------------------------------------------------------

  function basculerModeLiaison() {
    if (modeLiaison.active) {
      desactiverModeLiaison();
      effacerMessage();
    } else {
      modeLiaison.active = true;
      modeLiaison.premierePiece = null;
      document.getElementById("btn-relier").classList.add("actif");
      afficherMessage("Cliquez sur la première pièce à relier.", "info");
      rafraichirPlan();
    }
  }

  function desactiverModeLiaison() {
    modeLiaison.active = false;
    modeLiaison.premierePiece = null;
    document.getElementById("btn-relier").classList.remove("actif");
    rafraichirPlan();
  }

  function gererClicLiaisonPiece(pieceId) {
    if (!modeLiaison.premierePiece) {
      modeLiaison.premierePiece = pieceId;
      afficherMessage("Cliquez sur la seconde pièce à relier.", "info");
      rafraichirPlan();
      return;
    }
    var p1 = modeLiaison.premierePiece, p2 = pieceId;
    if (p1 === p2) {
      afficherMessage("Choisissez deux pièces différentes.", "avertissement");
      return;
    }
    var existeDeja = monde.passages.some(function (p) {
      return (p.de === p1 && p.vers === p2) || (p.de === p2 && p.vers === p1);
    });
    if (existeDeja) {
      afficherMessage("Ces deux pièces sont déjà reliées.", "avertissement");
      desactiverModeLiaison();
      return;
    }
    var id = idUnique("pass");
    monde.passages.push({ id: id, de: p1, vers: p2, verrouille: false, texteVerrouille: "", cleObjetId: null });
    sauvegarderLocalStorage();
    desactiverModeLiaison();
    effacerMessage();
    selectionner("passage", id);
  }

  // --------------------------------------------------------------------
  // AJOUT / SUPPRESSION D'ÉLÉMENTS
  // --------------------------------------------------------------------

  function ajouterPiece() {
    var id = idUnique("piece");
    var n = Object.keys(monde.pieces).length;
    monde.pieces[id] = {
      nom: "Nouvelle pièce",
      description: "",
      x: 60 + (n % 6) * 45,
      y: 60 + Math.floor(n / 6) * 45,
      largeur: 150,
      hauteur: 110
    };
    sauvegarderLocalStorage();
    selectionner("piece", id);
  }

  function ajouterObjetOuPersonnage(type) {
    var pieceCible = null;
    if (selection.type === "piece") pieceCible = selection.id;
    else if (selection.type === "objet" && monde.objets[selection.id]) pieceCible = monde.objets[selection.id].piece;

    if (!pieceCible || !monde.pieces[pieceCible]) {
      afficherMessage("Sélectionnez d'abord une pièce (ou un objet placé dans une pièce) avant d'ajouter " + (type === "personnage" ? "un personnage" : "un objet") + ".", "avertissement");
      return;
    }

    var id = idUnique(type === "personnage" ? "perso" : "objet");
    monde.objets[id] = {
      nom: type === "personnage" ? "Nouveau personnage" : "Nouvel objet",
      type: type,
      piece: pieceCible,
      cache: false,
      description: "",
      verbes: verbesParDefaut(type)
    };
    sauvegarderLocalStorage();
    selectionner("objet", id);
  }

  function supprimerSelection() {
    if (selection.type === "piece") {
      if (!confirm("Supprimer cette pièce ? Les passages qui la touchent seront supprimés, et les objets qu'elle contient n'auront plus d'emplacement.")) return;
      var idPiece = selection.id;
      delete monde.pieces[idPiece];
      monde.passages = monde.passages.filter(function (p) { return p.de !== idPiece && p.vers !== idPiece; });
      Object.keys(monde.objets).forEach(function (oid) {
        if (monde.objets[oid].piece === idPiece) monde.objets[oid].piece = null;
      });
      if (monde.journee.pieceDepart === idPiece) monde.journee.pieceDepart = null;
    } else if (selection.type === "objet") {
      if (!confirm("Supprimer cet objet ?")) return;
      var idObjet = selection.id;
      delete monde.objets[idObjet];
      monde.journee.inventaireDepart = (monde.journee.inventaireDepart || []).filter(function (x) { return x !== idObjet; });
      monde.passages.forEach(function (p) { if (p.cleObjetId === idObjet) p.cleObjetId = null; });
    } else if (selection.type === "passage") {
      if (!confirm("Supprimer ce passage ?")) return;
      var idPassage = selection.id;
      monde.passages = monde.passages.filter(function (p) { return p.id !== idPassage; });
    } else {
      afficherMessage("Rien n'est sélectionné.", "avertissement");
      return;
    }
    sauvegarderLocalStorage();
    deselectionner();
    rafraichirPlan();
  }

  // --------------------------------------------------------------------
  // MODE JEU (PLAY)
  // --------------------------------------------------------------------

  function lancerJeu() {
    if (modeLiaison.active) desactiverModeLiaison();
    var avertissements = validerMonde();
    if (avertissements.length > 0) {
      afficherMessage(avertissements, "avertissement");
    } else {
      effacerMessage();
    }
    document.getElementById("mode-jeu-overlay").classList.remove("cache");
    var conteneurJeu = document.getElementById("mode-jeu-conteneur");
    Moteur.demarrer(monde, conteneurJeu, {
      cleSauvegarde: "flot-partie"
    });
  }

  function retourAuStudio() {
    document.getElementById("mode-jeu-overlay").classList.add("cache");
    document.getElementById("mode-jeu-conteneur").innerHTML = "";
  }

  // --------------------------------------------------------------------
  // RENDU DU PLAN
  // --------------------------------------------------------------------

  function rafraichirPlan() {
    var conteneur = document.getElementById("plan-conteneur");
    var anciennesPieces = conteneur.querySelectorAll(".piece-bloc");
    for (var i = 0; i < anciennesPieces.length; i++) anciennesPieces[i].remove();

    Object.keys(monde.pieces).forEach(function (pieceId) {
      conteneur.appendChild(construirePieceEl(pieceId));
    });

    redessinerPassages();
    ajusterTaillePlan();
  }

  function ajusterTaillePlan() {
    var maxX = 1100, maxY = 900;
    Object.keys(monde.pieces).forEach(function (id) {
      var p = monde.pieces[id];
      maxX = Math.max(maxX, p.x + p.largeur + 80);
      maxY = Math.max(maxY, p.y + p.hauteur + 80);
    });
    var conteneur = document.getElementById("plan-conteneur");
    conteneur.style.width = maxX + "px";
    conteneur.style.height = maxY + "px";
  }

  function construirePieceEl(pieceId) {
    var piece = monde.pieces[pieceId];
    var el = document.createElement("div");
    var classes = ["piece-bloc"];
    if (selection.type === "piece" && selection.id === pieceId) classes.push("selectionnee");
    if (modeLiaison.active && modeLiaison.premierePiece === pieceId) classes.push("selectionnee");
    if (modeLiaison.active) classes.push("mode-liaison");
    el.className = classes.join(" ");
    el.style.left = piece.x + "px";
    el.style.top = piece.y + "px";
    el.style.width = piece.largeur + "px";
    el.style.height = piece.hauteur + "px";

    var nomEl = document.createElement("div");
    nomEl.className = "piece-nom";
    nomEl.textContent = piece.nom;
    el.appendChild(nomEl);

    var objetsWrap = document.createElement("div");
    objetsWrap.className = "piece-objets";
    Object.keys(monde.objets).forEach(function (objId) {
      if (monde.objets[objId].piece !== pieceId) return;
      objetsWrap.appendChild(construireObjetBlocEl(objId));
    });
    el.appendChild(objetsWrap);

    el.addEventListener("dragover", function (e) { e.preventDefault(); });
    el.addEventListener("drop", function (e) {
      e.preventDefault();
      var objId = e.dataTransfer.getData("text/plain");
      if (objId && monde.objets[objId]) {
        monde.objets[objId].piece = pieceId;
        sauvegarderLocalStorage();
        rafraichirPlan();
      }
    });

    var poignee = document.createElement("div");
    poignee.className = "poignee-redim";
    el.appendChild(poignee);
    attacherRedimensionnement(poignee, pieceId, el);

    attacherEvenementsPiece(el, pieceId);

    return el;
  }

  function construireObjetBlocEl(objId) {
    var obj = monde.objets[objId];
    var el = document.createElement("div");
    var classes = ["objet-bloc"];
    if (obj.type === "personnage") classes.push("type-personnage");
    if (obj.cache) classes.push("cache-vrai");
    if (selection.type === "objet" && selection.id === objId) classes.push("selectionne");
    el.className = classes.join(" ");
    el.textContent = obj.nom;
    el.draggable = true;
    el.addEventListener("dragstart", function (e) {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", objId);
    });
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!modeLiaison.active) selectionner("objet", objId);
    });
    return el;
  }

  function attacherEvenementsPiece(pieceEl, pieceId) {
    pieceEl.addEventListener("mousedown", function (e) {
      if (e.target.closest(".poignee-redim")) return;
      if (e.target.closest(".objet-bloc")) return;
      if (modeLiaison.active) return;
      e.preventDefault();

      var depart = { x: e.clientX, y: e.clientY };
      var piece = monde.pieces[pieceId];
      var origX = piece.x, origY = piece.y;
      var deplace = false;

      function onMove(ev) {
        var dx = ev.clientX - depart.x, dy = ev.clientY - depart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) deplace = true;
        piece.x = Math.max(0, origX + dx);
        piece.y = Math.max(0, origY + dy);
        pieceEl.style.left = piece.x + "px";
        pieceEl.style.top = piece.y + "px";
        redessinerPassages();
        ajusterTaillePlan();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!deplace) {
          selectionner("piece", pieceId);
        } else {
          sauvegarderLocalStorage();
        }
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    pieceEl.addEventListener("click", function (e) {
      if (e.target.closest(".objet-bloc") || e.target.closest(".poignee-redim")) return;
      if (modeLiaison.active) gererClicLiaisonPiece(pieceId);
    });
  }

  function attacherRedimensionnement(poignee, pieceId, pieceEl) {
    poignee.addEventListener("mousedown", function (e) {
      e.stopPropagation();
      e.preventDefault();
      var depart = { x: e.clientX, y: e.clientY };
      var piece = monde.pieces[pieceId];
      var origL = piece.largeur, origH = piece.hauteur;

      function onMove(ev) {
        var dx = ev.clientX - depart.x, dy = ev.clientY - depart.y;
        piece.largeur = Math.max(100, origL + dx);
        piece.hauteur = Math.max(70, origH + dy);
        pieceEl.style.width = piece.largeur + "px";
        pieceEl.style.height = piece.hauteur + "px";
        redessinerPassages();
        ajusterTaillePlan();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        sauvegarderLocalStorage();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  var NS_SVG = "http://www.w3.org/2000/svg";

  function redessinerPassages() {
    var svg = document.getElementById("svg-passages");
    svg.innerHTML = "";

    var conteneurPlan = document.getElementById("plan-conteneur");
    var anciensMarqueurs = conteneurPlan.querySelectorAll(".passage-marqueur");
    for (var i = 0; i < anciensMarqueurs.length; i++) anciensMarqueurs[i].remove();

    monde.passages.forEach(function (p) {
      var pieceDe = monde.pieces[p.de], pieceVers = monde.pieces[p.vers];
      if (!pieceDe || !pieceVers) return;

      var x1 = pieceDe.x + pieceDe.largeur / 2, y1 = pieceDe.y + pieceDe.hauteur / 2;
      var x2 = pieceVers.x + pieceVers.largeur / 2, y2 = pieceVers.y + pieceVers.hauteur / 2;
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

      var hit = document.createElementNS(NS_SVG, "line");
      hit.setAttribute("x1", x1); hit.setAttribute("y1", y1);
      hit.setAttribute("x2", x2); hit.setAttribute("y2", y2);
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "16");
      hit.style.pointerEvents = "stroke";
      hit.style.cursor = "pointer";
      hit.addEventListener("click", function () {
        if (!modeLiaison.active) selectionner("passage", p.id);
      });
      svg.appendChild(hit);

      var ligne = document.createElementNS(NS_SVG, "line");
      ligne.setAttribute("x1", x1); ligne.setAttribute("y1", y1);
      ligne.setAttribute("x2", x2); ligne.setAttribute("y2", y2);
      var classes = ["trait-passage"];
      if (p.verrouille) classes.push("verrouille");
      if (selection.type === "passage" && selection.id === p.id) classes.push("selectionne");
      ligne.setAttribute("class", classes.join(" "));
      svg.appendChild(ligne);

      if (p.verrouille) {
        var texte = document.createElementNS(NS_SVG, "text");
        texte.setAttribute("x", mx - 7);
        texte.setAttribute("y", my + 5);
        texte.setAttribute("class", "cadenas-passage");
        texte.textContent = "🔒";
        svg.appendChild(texte);
      }

      // Poignée toujours cliquable au milieu du passage : les pièces peuvent
      // recouvrir une bonne partie du trait, cette pastille reste accessible.
      var marqueur = document.createElement("div");
      var classesMarqueur = ["passage-marqueur"];
      if (p.verrouille) classesMarqueur.push("verrouille");
      if (selection.type === "passage" && selection.id === p.id) classesMarqueur.push("selectionnee");
      marqueur.className = classesMarqueur.join(" ");
      marqueur.style.left = (mx - 12) + "px";
      marqueur.style.top = (my - 12) + "px";
      marqueur.title = "Passage : " + nomPieceSure(p.de) + " ↔ " + nomPieceSure(p.vers);
      marqueur.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!modeLiaison.active) selectionner("passage", p.id);
      });
      conteneurPlan.appendChild(marqueur);
    });
  }

  // --------------------------------------------------------------------
  // PETITS CONSTRUCTEURS DE CHAMPS DE FORMULAIRE
  // --------------------------------------------------------------------

  function elTitre(texte) { var h = document.createElement("h2"); h.textContent = texte; return h; }
  function elSousTitre(texte) { var h = document.createElement("h3"); h.textContent = texte; return h; }
  function elSousSousTitre(texte) {
    var d = document.createElement("div");
    d.style.cssText = "font-size:11px;color:#888;margin:8px 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;";
    d.textContent = texte;
    return d;
  }

  function creerChampTexte(label, valeur, onChange) {
    var div = document.createElement("div"); div.className = "champ";
    var lab = document.createElement("label"); lab.textContent = label; div.appendChild(lab);
    var input = document.createElement("input"); input.type = "text"; input.value = valeur || "";
    input.addEventListener("input", function () { onChange(input.value); });
    div.appendChild(input);
    return div;
  }

  function creerChampNombre(label, valeur, onChange) {
    var div = document.createElement("div"); div.className = "champ";
    var lab = document.createElement("label"); lab.textContent = label; div.appendChild(lab);
    var input = document.createElement("input"); input.type = "number"; input.value = valeur;
    input.addEventListener("input", function () { onChange(parseInt(input.value, 10) || 0); });
    div.appendChild(input);
    return div;
  }

  function creerChampTextarea(label, valeur, onChange, hauteurMin) {
    var div = document.createElement("div"); div.className = "champ";
    var lab = document.createElement("label"); lab.textContent = label; div.appendChild(lab);
    var ta = document.createElement("textarea"); ta.value = valeur || "";
    if (hauteurMin) ta.style.minHeight = hauteurMin + "px";
    ta.addEventListener("input", function () { onChange(ta.value); });
    div.appendChild(ta);
    return div;
  }

  function creerChampCheckbox(label, valeur, onChange) {
    var div = document.createElement("div"); div.className = "champ-ligne";
    var idChamp = "cb_" + Math.random().toString(36).slice(2);
    var input = document.createElement("input"); input.type = "checkbox"; input.checked = !!valeur; input.id = idChamp;
    input.addEventListener("change", function () { onChange(input.checked); });
    var lab = document.createElement("label"); lab.textContent = label; lab.setAttribute("for", idChamp);
    div.appendChild(input); div.appendChild(lab);
    return div;
  }

  function creerChampSelect(label, options, valeur, onChange) {
    var div = document.createElement("div"); div.className = "champ";
    var lab = document.createElement("label"); lab.textContent = label; div.appendChild(lab);
    div.appendChild(creerSelectSimple(options, valeur, onChange));
    return div;
  }

  function creerSelectSimple(options, valeur, onChange) {
    var sel = document.createElement("select");
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.texte;
      if ((opt.value || "") === (valeur || "")) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { onChange(sel.value || null); });
    return sel;
  }

  // --------------------------------------------------------------------
  // PANNEAU D'ÉDITION — DISPATCH
  // --------------------------------------------------------------------

  function rafraichirPanneau() {
    var panneau = document.getElementById("panneau-edition");
    panneau.innerHTML = "";

    if (selection.type === "piece" && monde.pieces[selection.id]) {
      panneau.appendChild(construirePanneauPiece(selection.id));
    } else if (selection.type === "objet" && monde.objets[selection.id]) {
      panneau.appendChild(construirePanneauObjet(selection.id));
    } else if (selection.type === "passage" && trouverPassage(selection.id)) {
      panneau.appendChild(construirePanneauPassage(selection.id));
    } else {
      selection = { type: null, id: null };
      panneau.appendChild(construirePanneauJournee());
    }
  }

  function construirePanneauPiece(pieceId) {
    var piece = monde.pieces[pieceId];
    var wrap = document.createElement("div");
    wrap.appendChild(elTitre("Pièce"));
    wrap.appendChild(creerChampTexte("Nom", piece.nom, function (v) {
      piece.nom = v; sauvegarderLocalStorage(); rafraichirPlan();
    }));
    wrap.appendChild(creerChampTextarea("Description", piece.description, function (v) {
      piece.description = v; sauvegarderLocalStorage();
    }, 100));
    return wrap;
  }

  function construirePanneauPassage(passageId) {
    var passage = trouverPassage(passageId);
    var wrap = document.createElement("div");
    wrap.appendChild(elTitre("Passage : " + nomPieceSure(passage.de) + " ↔ " + nomPieceSure(passage.vers)));
    wrap.appendChild(creerChampCheckbox("Verrouillé", passage.verrouille, function (v) {
      passage.verrouille = v; sauvegarderLocalStorage(); rafraichirPlan(); rafraichirPanneau();
    }));
    if (passage.verrouille) {
      wrap.appendChild(creerChampTextarea("Texte si verrouillé", passage.texteVerrouille, function (v) {
        passage.texteVerrouille = v; sauvegarderLocalStorage();
      }, 60));
      var optionsObjets = [{ value: "", texte: "(aucune)" }].concat(
        Object.keys(monde.objets).map(function (id) { return { value: id, texte: monde.objets[id].nom }; })
      );
      wrap.appendChild(creerChampSelect("Objet-clé", optionsObjets, passage.cleObjetId, function (v) {
        passage.cleObjetId = v; sauvegarderLocalStorage();
      }));
    }
    return wrap;
  }

  function construirePanneauObjet(objetId) {
    var objet = monde.objets[objetId];
    var wrap = document.createElement("div");
    wrap.appendChild(elTitre(objet.type === "personnage" ? "Personnage" : "Objet"));
    wrap.appendChild(creerChampTexte("Nom", objet.nom, function (v) {
      objet.nom = v; sauvegarderLocalStorage(); rafraichirPlan();
    }));
    wrap.appendChild(creerChampSelect("Type", [
      { value: "objet", texte: "Objet" },
      { value: "personnage", texte: "Personnage" }
    ], objet.type, function (v) {
      objet.type = v;
      if (v === "personnage" && !objet.verbes.parler) {
        objet.verbes.parler = { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] };
      }
      if (v === "objet") delete objet.verbes.parler;
      sauvegarderLocalStorage(); rafraichirPlan(); rafraichirPanneau();
    }));
    wrap.appendChild(creerChampCheckbox("Caché au départ", objet.cache, function (v) {
      objet.cache = v; sauvegarderLocalStorage(); rafraichirPlan();
    }));
    wrap.appendChild(creerChampCheckbox("⚡ Objet électrique", objet.electrique, function (v) {
      objet.electrique = v; sauvegarderLocalStorage(); rafraichirPanneau();
    }));
    wrap.appendChild(creerChampTextarea("Description", objet.description, function (v) {
      objet.description = v; sauvegarderLocalStorage();
    }, 70));

    if (objet.electrique) {
      var noteElec = document.createElement("p");
      noteElec.className = "rappel-vide";
      noteElec.style.margin = "0 0 14px";
      noteElec.textContent = "Chaque verbe a maintenant une variante « Sans courant », utilisée quand le fait \"courant_coupe\" est posé quelque part (typiquement par un tableau électrique).";
      wrap.appendChild(noteElec);
    }

    wrap.appendChild(elSousTitre("Verbes"));
    ["regarder", "prendre", "deplacer", "utiliser", "parler"].forEach(function (nomVerbe) {
      if (nomVerbe === "parler" && objet.type !== "personnage") return;
      if (!objet.verbes[nomVerbe]) {
        objet.verbes[nomVerbe] = { actif: false, libelle: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] };
      }
      wrap.appendChild(construireBlocVerbe(objet, objetId, nomVerbe));
    });

    return wrap;
  }

  function construireBlocVerbe(objet, objetId, nomVerbe) {
    var verbe = objet.verbes[nomVerbe];
    var bloc = document.createElement("div"); bloc.className = "bloc-verbe";

    var entete = document.createElement("div"); entete.className = "bloc-verbe-entete";
    var labelGauche = document.createElement("label");
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!verbe.actif;
    cb.addEventListener("change", function () {
      verbe.actif = cb.checked; sauvegarderLocalStorage(); rafraichirPlan(); rafraichirPanneau();
    });
    labelGauche.appendChild(cb);
    labelGauche.appendChild(document.createTextNode(" " + nomVerbe));
    entete.appendChild(labelGauche);
    bloc.appendChild(entete);

    var corps = document.createElement("div");
    corps.className = "bloc-verbe-corps" + (verbe.actif ? "" : " replie");

    corps.appendChild(creerChampTexte("Libellé du bouton (facultatif)", verbe.libelle, function (v) {
      verbe.libelle = v; sauvegarderLocalStorage();
    }));
    corps.appendChild(creerChampTextarea("Texte", verbe.texte, function (v) {
      verbe.texte = v; sauvegarderLocalStorage();
    }, 60));
    corps.appendChild(creerChampCheckbox("Une seule fois", verbe.uneSeuleFois, function (v) {
      verbe.uneSeuleFois = v; sauvegarderLocalStorage(); rafraichirPanneau();
    }));
    if (verbe.uneSeuleFois) {
      corps.appendChild(creerChampTextarea("Texte si déjà fait", verbe.texteDejaFait, function (v) {
        verbe.texteDejaFait = v; sauvegarderLocalStorage();
      }, 50));
    }

    corps.appendChild(elSousSousTitre("Effets"));
    if (!verbe.effets) verbe.effets = [];
    verbe.effets.forEach(function (effet, index) {
      corps.appendChild(construireLigneEffet(effet, objetId, function () {
        verbe.effets.splice(index, 1); sauvegarderLocalStorage(); rafraichirPanneau();
      }));
    });
    var btnAjoutEffet = document.createElement("button");
    btnAjoutEffet.className = "btn-petit"; btnAjoutEffet.type = "button"; btnAjoutEffet.textContent = "+ Effet";
    btnAjoutEffet.addEventListener("click", function () {
      verbe.effets.push({ type: "donnerObjet" }); sauvegarderLocalStorage(); rafraichirPanneau();
    });
    corps.appendChild(btnAjoutEffet);

    if (objet.electrique) {
      corps.appendChild(construireSectionSansCourant(verbe, objetId));
    }

    if (nomVerbe === "utiliser") {
      corps.appendChild(elSousSousTitre("Combinaisons — utiliser un objet de l'inventaire sur cet objet"));
      if (!verbe.combinaisons) verbe.combinaisons = [];
      verbe.combinaisons.forEach(function (combo, index) {
        corps.appendChild(construireBlocCombinaison(objetId, verbe, combo, index));
      });
      var btnAjoutCombo = document.createElement("button");
      btnAjoutCombo.className = "btn-petit"; btnAjoutCombo.type = "button"; btnAjoutCombo.textContent = "+ Combinaison";
      btnAjoutCombo.addEventListener("click", function () {
        verbe.combinaisons.push({ objetId: "", texte: "", texteDejaFait: "", uneSeuleFois: false, effets: [] });
        sauvegarderLocalStorage(); rafraichirPanneau();
      });
      corps.appendChild(btnAjoutCombo);
    }

    bloc.appendChild(corps);
    return bloc;
  }

  function construireBlocCombinaison(objetProprietaireId, verbeUtiliser, combo, index) {
    var bloc = document.createElement("div"); bloc.className = "bloc-combinaison";

    var entete = document.createElement("div"); entete.className = "bloc-combinaison-entete";
    var optionsObjets = [{ value: "", texte: "(choisir un objet de l'inventaire)" }].concat(
      Object.keys(monde.objets).filter(function (id) { return id !== objetProprietaireId; })
        .map(function (id) { return { value: id, texte: monde.objets[id].nom }; })
    );
    entete.appendChild(creerSelectSimple(optionsObjets, combo.objetId, function (v) {
      combo.objetId = v || ""; sauvegarderLocalStorage();
    }));
    var btnSuppr = document.createElement("button");
    btnSuppr.className = "btn-suppr-effet"; btnSuppr.type = "button"; btnSuppr.textContent = "× Supprimer";
    btnSuppr.addEventListener("click", function () {
      verbeUtiliser.combinaisons.splice(index, 1); sauvegarderLocalStorage(); rafraichirPanneau();
    });
    entete.appendChild(btnSuppr);
    bloc.appendChild(entete);

    bloc.appendChild(creerChampTextarea("Texte", combo.texte, function (v) {
      combo.texte = v; sauvegarderLocalStorage();
    }, 50));
    bloc.appendChild(creerChampCheckbox("Une seule fois", combo.uneSeuleFois, function (v) {
      combo.uneSeuleFois = v; sauvegarderLocalStorage(); rafraichirPanneau();
    }));
    if (combo.uneSeuleFois) {
      bloc.appendChild(creerChampTextarea("Texte si déjà fait", combo.texteDejaFait, function (v) {
        combo.texteDejaFait = v; sauvegarderLocalStorage();
      }, 40));
    }

    bloc.appendChild(elSousSousTitre("Effets"));
    if (!combo.effets) combo.effets = [];
    combo.effets.forEach(function (effet, i) {
      bloc.appendChild(construireLigneEffet(effet, objetProprietaireId, function () {
        combo.effets.splice(i, 1); sauvegarderLocalStorage(); rafraichirPanneau();
      }));
    });
    var btnAjoutEffet = document.createElement("button");
    btnAjoutEffet.className = "btn-petit"; btnAjoutEffet.type = "button"; btnAjoutEffet.textContent = "+ Effet";
    btnAjoutEffet.addEventListener("click", function () {
      combo.effets.push({ type: "donnerObjet" }); sauvegarderLocalStorage(); rafraichirPanneau();
    });
    bloc.appendChild(btnAjoutEffet);

    if (monde.objets[objetProprietaireId] && monde.objets[objetProprietaireId].electrique) {
      bloc.appendChild(construireSectionSansCourant(combo, objetProprietaireId));
    }

    return bloc;
  }

  // Sous-section « ⚡ Sans courant » d'un verbe ou d'une combinaison : un texte
  // et des effets de repli, utilisés à la place des normaux quand l'objet est
  // électrique et que le fait "courant_coupe" est posé quelque part.
  function construireSectionSansCourant(porteur, objetIdContexte) {
    var bloc = document.createElement("div");
    bloc.className = "bloc-sans-courant";
    bloc.appendChild(elSousSousTitre("⚡ Sans courant"));
    bloc.appendChild(creerChampTextarea("Texte si le courant est coupé", porteur.texteSansCourant, function (v) {
      porteur.texteSansCourant = v; sauvegarderLocalStorage();
    }, 50));

    if (!porteur.effetsSansCourant) porteur.effetsSansCourant = [];
    porteur.effetsSansCourant.forEach(function (effet, index) {
      bloc.appendChild(construireLigneEffet(effet, objetIdContexte, function () {
        porteur.effetsSansCourant.splice(index, 1); sauvegarderLocalStorage(); rafraichirPanneau();
      }));
    });
    var btnAjout = document.createElement("button");
    btnAjout.className = "btn-petit"; btnAjout.type = "button"; btnAjout.textContent = "+ Effet (sans courant)";
    btnAjout.addEventListener("click", function () {
      porteur.effetsSansCourant.push({ type: "donnerObjet" }); sauvegarderLocalStorage(); rafraichirPanneau();
    });
    bloc.appendChild(btnAjout);

    return bloc;
  }

  function construireLigneEffet(effet, objetProprietaireId, onSupprimer) {
    var ligne = document.createElement("div"); ligne.className = "ligne-effet";

    var typesEffets = [
      { value: "donnerObjet", texte: "Donner un objet (inventaire)" },
      { value: "retirerObjet", texte: "Retirer un objet" },
      { value: "deplacerObjet", texte: "Déplacer un objet" },
      { value: "revelerObjet", texte: "Révéler un objet caché" },
      { value: "ouvrirPassage", texte: "Ouvrir un passage" },
      { value: "fermerPassage", texte: "Fermer un passage" },
      { value: "poserFait", texte: "Poser un fait" },
      { value: "retirerFait", texte: "Retirer un fait" },
      { value: "finDuTest", texte: "Fin du test" },
      { value: "afficherTexte", texte: "Afficher un texte" },
      { value: "changerHeure", texte: "Changer l'heure affichée" }
    ];
    ligne.appendChild(creerSelectSimple(typesEffets, effet.type, function (v) {
      effet.type = v; sauvegarderLocalStorage(); rafraichirPanneau();
    }));

    var ciblesAvecObjet = ["donnerObjet", "retirerObjet", "revelerObjet", "deplacerObjet"];
    if (ciblesAvecObjet.indexOf(effet.type) !== -1) {
      var optionsObjets = [{ value: "", texte: "(cet objet)" }].concat(
        Object.keys(monde.objets).map(function (id) { return { value: id, texte: monde.objets[id].nom }; })
      );
      ligne.appendChild(creerSelectSimple(optionsObjets, effet.cible || "", function (v) {
        effet.cible = v || undefined; sauvegarderLocalStorage();
      }));
    }
    if (effet.type === "deplacerObjet") {
      var optionsPieces = [{ value: "", texte: "(choisir une pièce)" }].concat(
        Object.keys(monde.pieces).map(function (id) { return { value: id, texte: monde.pieces[id].nom }; })
      );
      ligne.appendChild(creerSelectSimple(optionsPieces, effet.pieceCible || "", function (v) {
        effet.pieceCible = v || null; sauvegarderLocalStorage();
      }));
    }
    if (effet.type === "ouvrirPassage" || effet.type === "fermerPassage") {
      var optionsPassages = [{ value: "", texte: "(choisir un passage)" }].concat(
        monde.passages.map(function (p) { return { value: p.id, texte: nomPieceSure(p.de) + " ↔ " + nomPieceSure(p.vers) }; })
      );
      ligne.appendChild(creerSelectSimple(optionsPassages, effet.passageId || "", function (v) {
        effet.passageId = v || null; sauvegarderLocalStorage();
      }));
    }
    if (effet.type === "poserFait" || effet.type === "retirerFait") {
      var inputFait = document.createElement("input");
      inputFait.type = "text"; inputFait.placeholder = "nom_du_fait"; inputFait.value = effet.fait || "";
      inputFait.addEventListener("input", function () { effet.fait = inputFait.value; sauvegarderLocalStorage(); });
      ligne.appendChild(inputFait);
    }
    if (effet.type === "finDuTest") {
      var inputTexteFin = document.createElement("input");
      inputTexteFin.type = "text"; inputTexteFin.placeholder = "Texte de fin (\\n pour une nouvelle ligne)"; inputTexteFin.value = effet.texteFin || "";
      inputTexteFin.addEventListener("input", function () { effet.texteFin = inputTexteFin.value; sauvegarderLocalStorage(); });
      ligne.appendChild(inputTexteFin);
    }
    if (effet.type === "afficherTexte") {
      var inputAfficherTexte = document.createElement("input");
      inputAfficherTexte.type = "text"; inputAfficherTexte.placeholder = "Texte à ajouter au récit"; inputAfficherTexte.value = effet.texte || "";
      inputAfficherTexte.addEventListener("input", function () { effet.texte = inputAfficherTexte.value; sauvegarderLocalStorage(); });
      ligne.appendChild(inputAfficherTexte);
    }
    if (effet.type === "changerHeure") {
      var inputHeure = document.createElement("input");
      inputHeure.type = "text"; inputHeure.placeholder = "08:45"; inputHeure.value = effet.heure || "";
      inputHeure.addEventListener("input", function () { effet.heure = inputHeure.value; sauvegarderLocalStorage(); });
      ligne.appendChild(inputHeure);
    }

    var btnSuppr = document.createElement("button");
    btnSuppr.className = "btn-suppr-effet"; btnSuppr.type = "button"; btnSuppr.textContent = "×";
    btnSuppr.addEventListener("click", onSupprimer);
    ligne.appendChild(btnSuppr);

    return ligne;
  }

  // Liste texte de tous les passages, en plus des ronds cliquables sur le
  // plan : un moyen simple et fiable de les éditer ou de les supprimer,
  // même quand cliquer précisément sur le plan est malcommode.
  function construireListePassages() {
    var bloc = document.createElement("div");
    bloc.appendChild(elSousTitre("Passages entre les pièces"));

    if (monde.passages.length === 0) {
      var vide = document.createElement("p");
      vide.className = "rappel-vide";
      vide.style.margin = "0 0 14px";
      vide.textContent = "Aucun passage créé pour l'instant.";
      bloc.appendChild(vide);
      return bloc;
    }

    monde.passages.forEach(function (p) {
      var ligne = document.createElement("div");
      ligne.className = "ligne-passage-liste";

      var texte = document.createElement("span");
      texte.className = "ligne-passage-texte";
      texte.textContent = nomPieceSure(p.de) + " ↔ " + nomPieceSure(p.vers) + (p.verrouille ? " 🔒" : "");
      ligne.appendChild(texte);

      var btnEditer = document.createElement("button");
      btnEditer.className = "btn-petit";
      btnEditer.type = "button";
      btnEditer.textContent = "Éditer";
      btnEditer.addEventListener("click", function () { selectionner("passage", p.id); });
      ligne.appendChild(btnEditer);

      var btnSuppr = document.createElement("button");
      btnSuppr.className = "btn-petit btn-petit-danger";
      btnSuppr.type = "button";
      btnSuppr.textContent = "Supprimer";
      btnSuppr.addEventListener("click", function () {
        if (!confirm("Supprimer le passage " + nomPieceSure(p.de) + " ↔ " + nomPieceSure(p.vers) + " ?")) return;
        monde.passages = monde.passages.filter(function (x) { return x.id !== p.id; });
        sauvegarderLocalStorage();
        deselectionner();
        rafraichirPlan();
      });
      ligne.appendChild(btnSuppr);

      bloc.appendChild(ligne);
    });

    return bloc;
  }

  function construirePanneauJournee() {
    var j = monde.journee;
    var wrap = document.createElement("div");
    wrap.appendChild(elTitre("Journée"));

    var hint = document.createElement("p");
    hint.className = "rappel-vide";
    hint.style.margin = "0 0 14px";
    hint.textContent = "Cliquez sur une pièce, un objet ou un passage du plan pour l'éditer.";
    wrap.appendChild(hint);

    wrap.appendChild(construireListePassages());

    wrap.appendChild(creerChampNombre("Numéro", j.numero, function (v) { j.numero = v; sauvegarderLocalStorage(); }));

    var optionsPieces = [{ value: "", texte: "(aucune)" }].concat(
      Object.keys(monde.pieces).map(function (id) { return { value: id, texte: monde.pieces[id].nom }; })
    );
    wrap.appendChild(creerChampSelect("Pièce de départ", optionsPieces, j.pieceDepart, function (v) {
      j.pieceDepart = v; sauvegarderLocalStorage();
    }));
    wrap.appendChild(creerChampTexte("Heure affichée", j.heureAffichee, function (v) {
      j.heureAffichee = v; sauvegarderLocalStorage();
    }));
    wrap.appendChild(creerChampTextarea("Texte d'intro (une ligne = une phrase affichée)", j.texteIntro, function (v) {
      j.texteIntro = v; sauvegarderLocalStorage();
    }, 160));

    wrap.appendChild(elSousTitre("Inventaire de départ"));
    var listeInv = document.createElement("div");
    var idsObjets = Object.keys(monde.objets);
    if (idsObjets.length === 0) {
      listeInv.appendChild(document.createTextNode("Aucun objet créé pour l'instant."));
    }
    idsObjets.forEach(function (id) {
      var ligne = document.createElement("div"); ligne.className = "champ-ligne";
      var idChamp = "inv_" + id;
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = idChamp;
      cb.checked = (j.inventaireDepart || []).indexOf(id) !== -1;
      cb.addEventListener("change", function () {
        if (!j.inventaireDepart) j.inventaireDepart = [];
        if (cb.checked) {
          if (j.inventaireDepart.indexOf(id) === -1) j.inventaireDepart.push(id);
        } else {
          j.inventaireDepart = j.inventaireDepart.filter(function (x) { return x !== id; });
        }
        sauvegarderLocalStorage();
      });
      var lab = document.createElement("label"); lab.textContent = monde.objets[id].nom; lab.setAttribute("for", idChamp);
      ligne.appendChild(cb); ligne.appendChild(lab);
      listeInv.appendChild(ligne);
    });
    wrap.appendChild(listeInv);

    return wrap;
  }

  // --------------------------------------------------------------------
  // INITIALISATION
  // --------------------------------------------------------------------

  function attacherEvenementsToolbar() {
    document.getElementById("btn-ajouter-piece").addEventListener("click", ajouterPiece);
    document.getElementById("btn-ajouter-objet").addEventListener("click", function () { ajouterObjetOuPersonnage("objet"); });
    document.getElementById("btn-ajouter-personnage").addEventListener("click", function () { ajouterObjetOuPersonnage("personnage"); });
    document.getElementById("btn-relier").addEventListener("click", basculerModeLiaison);
    document.getElementById("btn-supprimer").addEventListener("click", supprimerSelection);
    document.getElementById("btn-sauvegarder").addEventListener("click", sauvegarderSurDisque);
    document.getElementById("btn-exporter").addEventListener("click", exporterMonde);
    document.getElementById("btn-importer").addEventListener("click", function () {
      document.getElementById("input-importer").click();
    });
    document.getElementById("input-importer").addEventListener("change", importerMonde);
    document.getElementById("btn-reinitialiser").addEventListener("click", reinitialiserExemple);
    document.getElementById("btn-play").addEventListener("click", lancerJeu);
    document.getElementById("btn-retour-studio").addEventListener("click", retourAuStudio);

    document.getElementById("plan-conteneur").addEventListener("click", function (e) {
      if ((e.target.id === "plan-conteneur" || e.target.id === "svg-passages") && !modeLiaison.active) {
        deselectionner();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modeLiaison.active) {
        desactiverModeLiaison();
        effacerMessage();
        return;
      }
      if (e.key === "Delete") {
        var enJeu = !document.getElementById("mode-jeu-overlay").classList.contains("cache");
        var actif = document.activeElement;
        var dansUnChamp = actif && (actif.tagName === "INPUT" || actif.tagName === "TEXTAREA" || actif.tagName === "SELECT" || actif.isContentEditable);
        if (!enJeu && !dansUnChamp && selection.type) {
          e.preventDefault();
          supprimerSelection();
        }
      }
    });
  }

  function initialiser() {
    var sauvegarde = chargerMondeDepuisStockage();
    monde = sauvegarde ? normaliserMonde(sauvegarde) : normaliserMonde(copieProfonde(MONDE_EXEMPLE));
    if (!sauvegarde) sauvegarderLocalStorage();

    attacherEvenementsToolbar();
    rafraichirPlan();
    rafraichirPanneau();
  }

  document.addEventListener("DOMContentLoaded", initialiser);

})();
