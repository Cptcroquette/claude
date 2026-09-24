// ============================================================================
// ENGINE.JS — le moteur du jeu.
//
// Ce fichier ne connaît RIEN du studio. Il reçoit un objet "monde" (voir
// data/monde-exemple.js pour la forme exacte) et un élément DOM dans lequel
// s'afficher, et fait tourner la partie. Plus tard, ce fichier pourra être
// réutilisé seul, sans le studio, pour le jeu fini.
//
// Utilisation :
//   var partie = Moteur.demarrer(monde, conteneurElement, {
//     cleSauvegarde: "flot-partie"  // clé localStorage (facultatif)
//   });
// ============================================================================

var Moteur = (function () {
  "use strict";

  // --------------------------------------------------------------------
  // ÉTAT INTERNE
  // --------------------------------------------------------------------
  var monde = null;          // copie du monde (jamais l'original)
  var conteneur = null;      // élément DOM racine du mode jeu
  var options = {};
  var cleSauvegarde = "flot-partie";

  var etat = null;           // état de la partie en cours (voir creerEtatInitial)

  // --------------------------------------------------------------------
  // OUTILS
  // --------------------------------------------------------------------

  function copieProfonde(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function creerElement(tag, classe, texte) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte !== undefined) el.textContent = texte;
    return el;
  }

  function viderElement(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // "08:17" -> 497 minutes depuis minuit. Renvoie null si le texte n'est pas
  // au format HH:MM (heure libre écrite par erreur, etc.).
  function minutesDepuisMinuit(heureTexte) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(heureTexte || "").trim());
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mi)) return null;
    return h * 60 + mi;
  }

  // --------------------------------------------------------------------
  // ÉTAT DE PARTIE
  // --------------------------------------------------------------------

  function creerEtatInitial() {
    var e = {
      pieceActuelle: monde.journee.pieceDepart,
      inventaire: [],           // liste d'ids d'objets
      emplacements: {},         // objetId -> pieceId ou null (null = pas dans une pièce)
      cache: {},                // objetId -> bool (true = caché)
      passagesOuverts: {},      // passageId -> bool (true = ouvert)
      faits: {},                // nomFait -> true
      dejaFait: {},             // "objetId:verbe" ou "objetId:utiliser:comboObjetId" -> true
      journal: [],               // liste de textes affichés dans le récit
      heureAffichee: monde.journee.heureAffichee,  // modifiable en jeu par l'effet "changerHeure"
      evenementsDeclenches: {},  // id d'événement -> true (pour ne les afficher qu'une fois)
      finDuTest: false,
      texteFin: "",
      introTerminee: false
    };

    var idsObjets = Object.keys(monde.objets);
    idsObjets.forEach(function (id) {
      var objet = monde.objets[id];
      e.emplacements[id] = objet.piece || null;
      e.cache[id] = !!objet.cache;
    });

    monde.passages.forEach(function (p) {
      e.passagesOuverts[p.id] = !p.verrouille;
    });

    // inventaire de départ : on retire ces objets de leur pièce
    (monde.journee.inventaireDepart || []).forEach(function (id) {
      if (monde.objets[id]) {
        e.emplacements[id] = null;
        e.inventaire.push(id);
      }
    });

    return e;
  }

  function chargerSauvegarde() {
    try {
      var brut = localStorage.getItem(cleSauvegarde);
      if (!brut) return null;
      var sauvegarde = JSON.parse(brut);
      // on ne réutilise une sauvegarde que si elle correspond à la même journée
      if (sauvegarde && sauvegarde.numeroJournee === monde.journee.numero) {
        return sauvegarde.etat;
      }
    } catch (erreur) {
      console.warn("Sauvegarde de partie illisible, on repart de zéro.", erreur);
    }
    return null;
  }

  function sauvegarderPartie() {
    try {
      localStorage.setItem(cleSauvegarde, JSON.stringify({
        numeroJournee: monde.journee.numero,
        etat: etat
      }));
    } catch (erreur) {
      console.warn("Impossible de sauvegarder la partie.", erreur);
    }
  }

  // --------------------------------------------------------------------
  // ACCÈS AUX DONNÉES DU MONDE
  // --------------------------------------------------------------------

  function objetsVisiblesDans(pieceId) {
    return Object.keys(monde.objets).filter(function (id) {
      return etat.emplacements[id] === pieceId && !etat.cache[id];
    });
  }

  function passagesDepuis(pieceId) {
    return monde.passages.filter(function (p) {
      return p.de === pieceId || p.vers === pieceId;
    }).map(function (p) {
      var autrePiece = p.de === pieceId ? p.vers : p.de;
      return { passage: p, autrePiece: autrePiece };
    });
  }

  function nomObjet(id) {
    var o = monde.objets[id];
    return o ? o.nom : id;
  }

  // --------------------------------------------------------------------
  // APPLICATION DES EFFETS
  // --------------------------------------------------------------------

  // Les événements de la journée (monde.journee.evenements) : chacun a une
  // heure et un texte. Dès que l'heure affichée atteint ou dépasse la sienne,
  // son texte s'ajoute au récit — une seule fois. L'heure ne bouge que par
  // l'effet "changerHeure", donc c'est ici, juste après avoir appliqué les
  // effets d'une action, qu'on vérifie si on vient d'en dépasser un ou plusieurs.
  function verifierEvenements() {
    var maintenant = minutesDepuisMinuit(etat.heureAffichee);
    if (maintenant === null) return;
    var evenements = (monde.journee.evenements || []).slice().sort(function (a, b) {
      var sa = minutesDepuisMinuit(a.heure), sb = minutesDepuisMinuit(b.heure);
      return (sa === null ? 0 : sa) - (sb === null ? 0 : sb);
    });
    evenements.forEach(function (evt) {
      if (etat.evenementsDeclenches[evt.id]) return;
      var seuil = minutesDepuisMinuit(evt.heure);
      if (seuil === null || maintenant < seuil) return;
      ajouterAuJournal(evt.texte);
      etat.evenementsDeclenches[evt.id] = true;
    });
  }

  function appliquerEffets(effets, objetSourceId) {
    (effets || []).forEach(function (effet) {
      var cible = effet.cible || objetSourceId;
      switch (effet.type) {
        case "donnerObjet":
          etat.emplacements[cible] = null;
          etat.cache[cible] = false;
          if (etat.inventaire.indexOf(cible) === -1) etat.inventaire.push(cible);
          break;
        case "retirerObjet":
          etat.emplacements[cible] = null;
          etat.inventaire = etat.inventaire.filter(function (id) { return id !== cible; });
          break;
        case "deplacerObjet":
          etat.emplacements[cible] = effet.pieceCible || null;
          etat.inventaire = etat.inventaire.filter(function (id) { return id !== cible; });
          etat.cache[cible] = false;
          break;
        case "revelerObjet":
          etat.cache[cible] = false;
          break;
        case "ouvrirPassage":
          etat.passagesOuverts[effet.passageId] = true;
          break;
        case "fermerPassage":
          etat.passagesOuverts[effet.passageId] = false;
          break;
        case "poserFait":
          etat.faits[effet.fait] = true;
          break;
        case "retirerFait":
          delete etat.faits[effet.fait];
          break;
        case "finDuTest":
          etat.finDuTest = true;
          etat.texteFin = effet.texteFin || "Fin.";
          break;
        case "afficherTexte":
          ajouterAuJournal(effet.texte);
          break;
        case "changerHeure":
          etat.heureAffichee = effet.heure || etat.heureAffichee;
          break;
      }
    });
    verifierEvenements();
  }

  function ajouterAuJournal(texte) {
    if (!texte) return;
    etat.journal.push(texte);
    // on garde un journal raisonnable en mémoire
    if (etat.journal.length > 60) etat.journal.shift();
  }

  // --------------------------------------------------------------------
  // ACTIONS DU JOUEUR
  // --------------------------------------------------------------------

  // Un objet électrique dont le courant est coupé se comporte différemment :
  // le fait "courant_coupe" est mis (ou retiré) par un effet, quelque part
  // dans le monde (typiquement un tableau électrique).
  function fonctionneSansCourant(objet) {
    return !!objet.electrique && !!etat.faits["courant_coupe"];
  }

  function executerVerbe(objetId, nomVerbe) {
    var objet = monde.objets[objetId];
    if (!objet || !objet.verbes || !objet.verbes[nomVerbe]) return;
    var verbe = objet.verbes[nomVerbe];
    if (!verbe.actif) return;

    if (fonctionneSansCourant(objet)) {
      ajouterAuJournal(verbe.texteSansCourant || "Rien ne se passe. Plus de courant.");
      appliquerEffets(verbe.effetsSansCourant, objetId);
      sauvegarderPartie();
      afficherEcranPiece();
      return;
    }

    var cleFait = objetId + ":" + nomVerbe;
    var dejaFaitAvant = !!etat.dejaFait[cleFait];

    if (dejaFaitAvant && verbe.uneSeuleFois && verbe.texteDejaFait) {
      ajouterAuJournal(verbe.texteDejaFait);
    } else {
      ajouterAuJournal(verbe.texte);
      appliquerEffets(verbe.effets, objetId);
      etat.dejaFait[cleFait] = true;
    }

    sauvegarderPartie();
    afficherEcranPiece();
  }

  function executerCombinaison(objetCibleId, objetInventaireId) {
    var objet = monde.objets[objetCibleId];
    var verbe = objet && objet.verbes && objet.verbes.utiliser;
    var combos = (verbe && verbe.combinaisons) || [];
    var combo = combos.filter(function (c) { return c.objetId === objetInventaireId; })[0];

    if (!combo) {
      ajouterAuJournal("Ça ne donne rien.");
    } else if (fonctionneSansCourant(objet)) {
      ajouterAuJournal(combo.texteSansCourant || "Rien ne se passe. Plus de courant.");
      appliquerEffets(combo.effetsSansCourant, objetCibleId);
    } else {
      var cleFait = objetCibleId + ":utiliser:" + objetInventaireId;
      var dejaFaitAvant = !!etat.dejaFait[cleFait];
      if (dejaFaitAvant && combo.uneSeuleFois && combo.texteDejaFait) {
        ajouterAuJournal(combo.texteDejaFait);
      } else {
        ajouterAuJournal(combo.texte);
        appliquerEffets(combo.effets, objetCibleId);
        etat.dejaFait[cleFait] = true;
      }
    }

    sauvegarderPartie();
    afficherEcranPiece();
  }

  function deplacerVers(pieceId) {
    etat.pieceActuelle = pieceId;
    sauvegarderPartie();
    afficherEcranPiece();
  }

  function deposerObjet(objetId) {
    etat.emplacements[objetId] = etat.pieceActuelle;
    etat.inventaire = etat.inventaire.filter(function (id) { return id !== objetId; });
    ajouterAuJournal("Je pose " + nomObjet(objetId) + " ici.");
    sauvegarderPartie();
    afficherEcranPiece();
  }

  function recommencerLaJournee() {
    etat = creerEtatInitial();
    sauvegarderPartie();
    afficherIntro();
  }

  // --------------------------------------------------------------------
  // AFFICHAGE — INTRO
  // --------------------------------------------------------------------

  function afficherIntro() {
    viderElement(conteneur);

    var ecran = creerElement("div", "mj-intro");
    var zoneTexte = creerElement("div", "mj-intro-texte");
    var boutonPasser = creerElement("button", "mj-intro-passer", "Passer");

    ecran.appendChild(zoneTexte);
    ecran.appendChild(boutonPasser);
    conteneur.appendChild(ecran);

    var lignes = (monde.journee.texteIntro || "").split("\n").filter(function (l) { return l.length > 0; });
    var index = 0;
    var termine = false;

    function afficherLigneSuivante() {
      if (termine) return;
      if (index >= lignes.length) {
        finirIntro();
        return;
      }
      var ligne = creerElement("p", "mj-intro-ligne", lignes[index]);
      zoneTexte.appendChild(ligne);
      // force le reflow puis ajoute la classe pour déclencher la transition
      void ligne.offsetWidth;
      ligne.classList.add("visible");
      zoneTexte.scrollTop = zoneTexte.scrollHeight;
      index++;
    }

    function finirIntro() {
      if (termine) return;
      termine = true;
      document.removeEventListener("keydown", surTouche);
      etat.introTerminee = true;
      sauvegarderPartie();
      afficherEcranPiece();
    }

    function surTouche(evenement) {
      if (evenement.code === "Space") {
        evenement.preventDefault();
        afficherLigneSuivante();
      }
    }

    ecran.addEventListener("click", function (evenement) {
      if (evenement.target === boutonPasser) return;
      afficherLigneSuivante();
    });
    boutonPasser.addEventListener("click", finirIntro);
    document.addEventListener("keydown", surTouche);

    afficherLigneSuivante();
  }

  // --------------------------------------------------------------------
  // AFFICHAGE — ÉCRAN DE PIÈCE
  // --------------------------------------------------------------------

  function afficherEcranPiece() {
    viderElement(conteneur);

    if (etat.finDuTest) {
      afficherEcranFin();
      return;
    }

    var piece = monde.pieces[etat.pieceActuelle];
    if (!piece) {
      conteneur.appendChild(creerElement("div", "mj-erreur", "Pièce introuvable : " + etat.pieceActuelle));
      return;
    }

    var racine = creerElement("div", "mj-jeu");

    // ---- en-tête ----
    var entete = creerElement("div", "mj-entete");
    entete.appendChild(creerElement("div", "mj-titre", "LA MAISON — " + piece.nom.toUpperCase()));
    entete.appendChild(creerElement("div", "mj-heure", etat.heureAffichee));
    racine.appendChild(entete);

    // ---- corps (colonne principale + inventaire) ----
    var corps = creerElement("div", "mj-corps");

    var colonnePrincipale = creerElement("div", "mj-colonne-principale");

    colonnePrincipale.appendChild(creerElement("p", "mj-description", piece.description));

    // ---- objets et personnages visibles ----
    var idsVisibles = objetsVisiblesDans(etat.pieceActuelle);
    if (idsVisibles.length > 0) {
      var listeObjets = creerElement("p", "mj-liste-objets");
      var nomsVisibles = idsVisibles.map(function (id) { return monde.objets[id].nom; });
      listeObjets.textContent = "Je vois ici : " + nomsVisibles.join(", ") + ".";
      colonnePrincipale.appendChild(listeObjets);
    }

    // ---- actions ----
    // Un objet avec un seul verbe actif garde un bouton direct. Avec plusieurs
    // verbes (regarder ET prendre, par exemple), on regroupe sous un seul
    // bouton "nom de l'objet" qui déplie les choix — pour ne pas noyer la
    // pièce sous une rangée de boutons.
    var blocActions = creerElement("div", "mj-bloc mj-bloc-actions");
    blocActions.appendChild(creerElement("h3", "mj-bloc-titre", "ACTIONS"));
    var zoneActions = creerElement("div", "mj-actions");
    idsVisibles.forEach(function (objetId) {
      var objet = monde.objets[objetId];
      var verbesActifs = Object.keys(objet.verbes).filter(function (nomVerbe) {
        if (nomVerbe === "parler" && objet.type !== "personnage") return false;
        return !!objet.verbes[nomVerbe].actif;
      });
      if (verbesActifs.length === 0) return;

      if (verbesActifs.length === 1) {
        var seulVerbe = verbesActifs[0];
        var verbeUnique = objet.verbes[seulVerbe];
        var libelleUnique = verbeUnique.libelle || libelleParDefaut(seulVerbe, objet.nom);
        var boutonUnique = creerElement("button", "mj-action-bouton", libelleUnique);
        boutonUnique.addEventListener("click", function () { executerVerbe(objetId, seulVerbe); });
        zoneActions.appendChild(boutonUnique);
        return;
      }

      var groupe = creerElement("div", "mj-objet-groupe");
      var boutonObjet = creerElement("button", "mj-objet-bouton", objet.nom);
      var sousMenu = creerElement("div", "mj-objet-sousmenu replie");
      boutonObjet.addEventListener("click", function () {
        var ouvert = !sousMenu.classList.contains("replie");
        sousMenu.classList.toggle("replie", ouvert);
        boutonObjet.classList.toggle("ouvert", !ouvert);
      });
      verbesActifs.forEach(function (nomVerbe) {
        var verbe = objet.verbes[nomVerbe];
        var libelle = verbe.libelle || libelleParDefaut(nomVerbe, objet.nom);
        var boutonVerbe = creerElement("button", "mj-action-bouton", libelle);
        boutonVerbe.addEventListener("click", function () { executerVerbe(objetId, nomVerbe); });
        sousMenu.appendChild(boutonVerbe);
      });
      groupe.appendChild(boutonObjet);
      groupe.appendChild(sousMenu);
      zoneActions.appendChild(groupe);
    });
    if (zoneActions.children.length === 0) {
      zoneActions.appendChild(creerElement("p", "mj-vide", "Rien à faire ici pour l'instant."));
    }
    blocActions.appendChild(zoneActions);
    colonnePrincipale.appendChild(blocActions);

    // ---- se déplacer ----
    var blocDeplacement = creerElement("div", "mj-bloc mj-bloc-deplacement");
    blocDeplacement.appendChild(creerElement("h3", "mj-bloc-titre", "SE DÉPLACER"));
    var zoneDeplacement = creerElement("div", "mj-actions");
    passagesDepuis(etat.pieceActuelle).forEach(function (item) {
      var passage = item.passage;
      var autrePiece = monde.pieces[item.autrePiece];
      if (!autrePiece) return;
      var ouvert = etat.passagesOuverts[passage.id];

      if (ouvert) {
        var bouton = creerElement("button", "mj-action-bouton", "→ " + autrePiece.nom);
        bouton.addEventListener("click", function () { deplacerVers(item.autrePiece); });
        zoneDeplacement.appendChild(bouton);
      } else {
        var ligneVerrou = creerElement("div", "mj-passage-verrouille");
        ligneVerrou.appendChild(creerElement("span", "mj-verrou-texte", "🔒 " + (passage.texteVerrouille || "C'est fermé.")));
        if (passage.cleObjetId && etat.inventaire.indexOf(passage.cleObjetId) !== -1) {
          var boutonDeverrouiller = creerElement("button", "mj-action-bouton", "Déverrouiller avec " + nomObjet(passage.cleObjetId));
          boutonDeverrouiller.addEventListener("click", function () {
            etat.passagesOuverts[passage.id] = true;
            ajouterAuJournal("J'ouvre le passage vers " + autrePiece.nom + " avec " + nomObjet(passage.cleObjetId) + ".");
            sauvegarderPartie();
            afficherEcranPiece();
          });
          ligneVerrou.appendChild(boutonDeverrouiller);
        }
        zoneDeplacement.appendChild(ligneVerrou);
      }
    });
    blocDeplacement.appendChild(zoneDeplacement);
    colonnePrincipale.appendChild(blocDeplacement);

    // ---- récit ----
    var blocRecit = creerElement("div", "mj-bloc mj-bloc-recit");
    blocRecit.appendChild(creerElement("h3", "mj-bloc-titre", "RÉCIT"));
    var zoneRecit = creerElement("div", "mj-recit");
    var journalAffiche = etat.journal.slice(-8);
    journalAffiche.forEach(function (texte, index) {
      var distanceFin = journalAffiche.length - 1 - index;
      var ligne = creerElement("p", "mj-recit-ligne", texte);
      ligne.style.opacity = Math.max(0.35, 1 - distanceFin * 0.18);
      zoneRecit.appendChild(ligne);
    });
    if (journalAffiche.length === 0) {
      zoneRecit.appendChild(creerElement("p", "mj-vide", "…"));
    }
    blocRecit.appendChild(zoneRecit);
    colonnePrincipale.appendChild(blocRecit);

    corps.appendChild(colonnePrincipale);

    // ---- inventaire ----
    corps.appendChild(construireInventaire());

    racine.appendChild(corps);

    // ---- pied de page ----
    var pied = creerElement("div", "mj-pied");
    var boutonRecommencer = creerElement("button", "mj-bouton-discret", "Recommencer la journée");
    boutonRecommencer.addEventListener("click", recommencerLaJournee);
    pied.appendChild(boutonRecommencer);
    racine.appendChild(pied);

    // ---- debug ----
    racine.appendChild(construireDebug());

    conteneur.appendChild(racine);
  }

  function libelleParDefaut(nomVerbe, nomObjet) {
    var verbes = {
      regarder: "Regarder " + nomObjet,
      prendre: "Prendre " + nomObjet,
      deplacer: "Déplacer " + nomObjet,
      utiliser: "Utiliser " + nomObjet,
      parler: "Parler à " + nomObjet
    };
    return verbes[nomVerbe] || (nomVerbe + " " + nomObjet);
  }

  function construireInventaire() {
    var bloc = creerElement("div", "mj-inventaire");
    bloc.appendChild(creerElement("h3", "mj-bloc-titre", "INVENTAIRE"));

    if (etat.inventaire.length === 0) {
      bloc.appendChild(creerElement("p", "mj-vide", "Rien sur moi."));
      return bloc;
    }

    var liste = creerElement("div", "mj-inventaire-liste");
    etat.inventaire.forEach(function (objetId) {
      var objet = monde.objets[objetId];
      var ligne = creerElement("div", "mj-inventaire-item");
      ligne.appendChild(creerElement("div", "mj-inventaire-nom", objet.nom));

      var boutons = creerElement("div", "mj-inventaire-boutons");

      var boutonRegarder = creerElement("button", "mj-mini-bouton", "Regarder");
      boutonRegarder.addEventListener("click", function () {
        ajouterAuJournal(objet.description || (objet.nom + "."));
        sauvegarderPartie();
        afficherEcranPiece();
      });
      boutons.appendChild(boutonRegarder);

      var boutonDeposer = creerElement("button", "mj-mini-bouton", "Déposer ici");
      boutonDeposer.addEventListener("click", function () { deposerObjet(objetId); });
      boutons.appendChild(boutonDeposer);

      // "Utiliser sur…" : objets visibles dans la pièce actuelle
      var cibles = objetsVisiblesDans(etat.pieceActuelle);
      if (cibles.length > 0) {
        var selecteur = creerElement("select", "mj-mini-select");
        var optionVide = document.createElement("option");
        optionVide.value = "";
        optionVide.textContent = "Utiliser sur…";
        selecteur.appendChild(optionVide);
        cibles.forEach(function (cibleId) {
          if (cibleId === objetId) return;
          var option = document.createElement("option");
          option.value = cibleId;
          option.textContent = monde.objets[cibleId].nom;
          selecteur.appendChild(option);
        });
        selecteur.addEventListener("change", function () {
          if (selecteur.value) {
            executerCombinaison(selecteur.value, objetId);
            selecteur.value = "";
          }
        });
        boutons.appendChild(selecteur);
      }

      ligne.appendChild(boutons);
      liste.appendChild(ligne);
    });
    bloc.appendChild(liste);
    return bloc;
  }

  function construireDebug() {
    var details = creerElement("details", "mj-debug");
    details.appendChild(creerElement("summary", "mj-debug-titre", "Debug"));

    var contenu = creerElement("div", "mj-debug-contenu");

    var blocInventaire = creerElement("div", "mj-debug-bloc");
    blocInventaire.appendChild(creerElement("strong", null, "Inventaire : "));
    blocInventaire.appendChild(document.createTextNode(
      etat.inventaire.length ? etat.inventaire.map(nomObjet).join(", ") : "(vide)"
    ));
    contenu.appendChild(blocInventaire);

    var faits = Object.keys(etat.faits).filter(function (f) { return etat.faits[f]; });
    var blocFaits = creerElement("div", "mj-debug-bloc");
    blocFaits.appendChild(creerElement("strong", null, "Faits posés : "));
    blocFaits.appendChild(document.createTextNode(faits.length ? faits.join(", ") : "(aucun)"));
    contenu.appendChild(blocFaits);

    var deplaces = Object.keys(monde.objets).filter(function (id) {
      return etat.emplacements[id] !== (monde.objets[id].piece || null);
    });
    var blocDeplaces = creerElement("div", "mj-debug-bloc");
    blocDeplaces.appendChild(creerElement("strong", null, "Objets déplacés : "));
    blocDeplaces.appendChild(document.createTextNode(
      deplaces.length ? deplaces.map(function (id) {
        var loc = etat.emplacements[id];
        return nomObjet(id) + " → " + (loc ? (monde.pieces[loc] ? monde.pieces[loc].nom : loc) : "inventaire");
      }).join(", ") : "(aucun)"
    ));
    contenu.appendChild(blocDeplaces);

    var ouverts = monde.passages.filter(function (p) { return etat.passagesOuverts[p.id] && p.verrouille; });
    var blocPassages = creerElement("div", "mj-debug-bloc");
    blocPassages.appendChild(creerElement("strong", null, "Passages déverrouillés : "));
    blocPassages.appendChild(document.createTextNode(
      ouverts.length ? ouverts.map(function (p) {
        return (monde.pieces[p.de] ? monde.pieces[p.de].nom : p.de) + " ↔ " + (monde.pieces[p.vers] ? monde.pieces[p.vers].nom : p.vers);
      }).join(", ") : "(aucun)"
    ));
    contenu.appendChild(blocPassages);

    var evtDeclenches = (monde.journee.evenements || []).filter(function (e) { return etat.evenementsDeclenches[e.id]; });
    var blocEvenements = creerElement("div", "mj-debug-bloc");
    blocEvenements.appendChild(creerElement("strong", null, "Heure : "));
    blocEvenements.appendChild(document.createTextNode(
      etat.heureAffichee + " — événements déclenchés : " + (evtDeclenches.length ? evtDeclenches.map(function (e) { return e.heure; }).join(", ") : "(aucun)")
    ));
    contenu.appendChild(blocEvenements);

    details.appendChild(contenu);
    return details;
  }

  // --------------------------------------------------------------------
  // AFFICHAGE — FIN
  // --------------------------------------------------------------------

  function afficherEcranFin() {
    viderElement(conteneur);
    var ecran = creerElement("div", "mj-fin");
    var lignes = (etat.texteFin || "Fin.").split("\n");
    var zoneTexte = creerElement("div", "mj-fin-texte");
    lignes.forEach(function (ligne) {
      zoneTexte.appendChild(creerElement("p", null, ligne));
    });
    ecran.appendChild(zoneTexte);

    var boutonRecommencer = creerElement("button", "mj-bouton-discret", "Recommencer la journée");
    boutonRecommencer.addEventListener("click", recommencerLaJournee);
    ecran.appendChild(boutonRecommencer);

    conteneur.appendChild(ecran);
  }

  // --------------------------------------------------------------------
  // API PUBLIQUE
  // --------------------------------------------------------------------

  function demarrer(mondeDonnees, conteneurElement, optionsAppel) {
    monde = copieProfonde(mondeDonnees);
    conteneur = conteneurElement;
    options = optionsAppel || {};
    cleSauvegarde = options.cleSauvegarde || "flot-partie";

    var sauvegarde = chargerSauvegarde();
    if (sauvegarde) {
      etat = sauvegarde;
      if (etat.heureAffichee === undefined) etat.heureAffichee = monde.journee.heureAffichee;
      if (!etat.evenementsDeclenches) etat.evenementsDeclenches = {};
    } else {
      etat = creerEtatInitial();
    }

    if (etat.introTerminee) {
      afficherEcranPiece();
    } else {
      afficherIntro();
    }

    return {
      arreter: function () {
        viderElement(conteneur);
      }
    };
  }

  function effacerSauvegarde(cle) {
    try {
      localStorage.removeItem(cle || cleSauvegarde);
    } catch (erreur) {
      console.warn("Impossible d'effacer la sauvegarde.", erreur);
    }
  }

  return {
    demarrer: demarrer,
    effacerSauvegarde: effacerSauvegarde
  };

})();
