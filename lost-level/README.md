# LOST LEVEL — refonte de la landing page

Prototype de landing page pour [lostlevel.fr](https://www.lostlevel.fr/), escape game à Angers.
HTML, CSS et JS natifs, sans framework et sans dépendance. Ouvrir `index.html` via un serveur local :

```sh
cd lost-level && python3 -m http.server 8765   # puis http://localhost:8765
```

```
lost-level/
├── index.html               page unique, contenus vérifiés + dessins SVG intégrés
├── assets/css/main.css      système graphique complet (jetons, typo, composants, mouvement)
├── assets/js/main.js        ~180 lignes : découpe typographique, révélations, jauge LCD, scroll lié, menu
├── assets/fonts/            DSEG7 Classic Bold (5 Ko, SIL OFL 1.1) + licence
└── tools/
    ├── iso.mjs              générateur des dessins isométriques (projection 30°)
    └── inject.mjs           réinjecte les dessins dans index.html : node tools/inject.mjs
```

---

## 1. Audit

### Projet existant
- **Ce dépôt ne contient pas le code de lostlevel.fr** (il contient « Flot », un autre projet). La refonte est donc livrée comme un module autonome dans `lost-level/`, sans toucher au reste.
- Le site actuel n'a pas pu être chargé directement depuis l'environnement de travail (accès réseau bloqué). Les contenus ont été **recoupés via les résultats de recherche indexant lostlevel.fr** et des fiches tierces (Destination Angers, Anjou Tourisme, escapegame.fr, The Escapers, annuaire-entreprises). À revérifier sur le site source avant mise en ligne (voir §5).
- Framework, hébergement et outil de réservation du site actuel : **non identifiés**. La page de réservation existante (`/reservation-escape-game-angers.html`) sert de point d'entrée unique ; aucun calendrier ni paiement n'a été inventé.

### URLs conservées (référencement)
Tous les liens sont relatifs à la racine afin de fonctionner tels quels une fois déployés sur `www.lostlevel.fr` (en local, ils renvoient 404 — c'est normal).

| Page | URL |
|---|---|
| Salles | `/rooms.html` |
| La Valise Vaudou | `/escape-game-angers-valise-vaudou.html` |
| Les Cigares du Castor | `/escape-game-angers-cigares-du-castor.html` |
| Le Casse-Noisette | `/escape-game-angers-casse-noisette.html` |
| Réservation | `/reservation-escape-game-angers.html` |
| Comment ça marche | `/comment-ca-marche-escape-game.html` |
| Cartes cadeaux | `/boutique.html` |
| Contact | `/contact-escape-game-angers.html` |

### Informations retenues (sources concordantes)
- 15 boulevard de Strasbourg, 49100 Angers (code postal du site officiel ; 49000 sur les fiches tourisme) — à 2 min de la gare.
- 02 44 85 11 59 · contact@lostlevel.fr · pas de réponse téléphonique pendant les sessions.
- De 2 à 11 joueurs, 7 j/7, sessions de 60 min, partie privée (aucun inconnu dans l'équipe).
- Dès 13 ans, mineurs accompagnés d'au moins un adulte.
- Tarif dégressif selon la taille du groupe, paiement partageable, modification jusqu'à 24 h avant, pas de remboursement en cas d'annulation de dernière minute.
- Cartes cadeaux : code par e-mail ou bon imprimable, valables un an.
- Instagram : @lostlevel_angers · SIREN 845 310 994.

---

## 2. Direction artistique

**Concept : la page est une descente.** « Lost Level » = un niveau perdu. Chaque section est un niveau inférieur (`NIV. 00 → −04`), signalé par une jauge à afficheur LCD sur la droite, des jointures entre sections (une ligne qui devient une porte) et des numéros de section monumentaux. L'escalier du dessin d'accueil continue sous le sol, en pointillés : il n'y a pas de dernier niveau.

### Palette — hiérarchie, pas répartition
| Jeton | Valeur | Rôle |
|---|---|---|
| `--ivory` | #E9E4D8 | surfaces (≈ 75 % de la page) |
| `--ink` | #24241F | texte, traits, panneaux sombres ponctuels (salle 02, cartes cadeaux, footer) |
| `--acid` | #D6FF38 | **uniquement** l'action : boutons Réserver, section réservation, état actif |
| `--rust` | #B85A3D | matière : portes, numéros de section, aplats d'illustration |
| `--rust-2` | #8F4530 | orange pour petits textes (contraste 5,4:1 sur ivoire) |
| `--lcd` | #82928A | afficheurs et libellés sur fond charbon |

Le vert acide signifie toujours « on peut agir ici » : c'est ce qui rend la réservation identifiable sans même lire.

### Typographie — trois registres, deux familles + un afficheur
- **Affichage — Archivo 900, axe de largeur variable 62 → 125** (Google Fonts, SIL OFL). Choisie plutôt que Space Grotesk parce que l'axe `wdth` permet de comprimer/étirer les titres sans changer de police : c'est la matière du système (salle 01 comprimée, salle 02 étendue, « RÉSERVEZ » qui s'étire à l'apparition, titres qui s'élargissent au survol).
- **Texte — Archivo 400, largeur 100.** Même famille : un seul fichier variable pour tout le texte non technique.
- **Fonctionnel — IBM Plex Mono 500**, capitales, interlettrage +0,08 em : numéros, durées, légendes, plaques signalétiques, états.
- **Afficheur — DSEG7 Classic** (5 Ko, auto-hébergée, SIL OFL), réservée aux nombres d'afficheur, avec segments éteints visibles.

Échelle (variables `--d-0` à `--m-sm`) : logo `clamp(5.75rem, 16vw, 19rem)` · titres de section `15vw` coupés par le bord · noms de salles `8.4vw` · titres de panneaux `3.8vw` · texte 17–22 px · mono 11–13 px. Interlignage d'affichage 0,82.

### Grille & composants
Grille 12 colonnes, gouttière 16 → 24 px, marges 16 → 40 px. Les compositions s'en écartent volontairement : salle 01 à 94 % alignée à gauche, salle 02 à fond perdu, salle 03 à 92 % alignée à droite.
Composants : bouton à trappe (l'aplat coulisse), plaque signalétique (`dl` en 4 cellules), rail vertical avec code-barres CSS, panneaux vissés (vis aux coins), afficheur LCD, jointure-porte, légendes de figure numérotées.

### Illustration
Dessins isométriques au trait générés par `tools/iso.mjs` (projection 30°, faces ivoire, ombre en aplat clair, portes orange) : plateforme et escalier sans fin (accueil), valise portant une maison (salle 01, clin d'œil à l'affiche de référence), porte en vue éclatée (esprit). Salles 02 et 03 : pictogrammes géométriques plats. Aucun rendu 3D, aucune photo requise.

### Règles de mouvement
- Mécanique, jamais élastique : `cubic-bezier(.7,0,.2,1)` pour ce qui coulisse, `(.16,1,.3,1)` pour les butées.
- **Signature d'accueil (~1,5 s, contenu lisible dès le départ)** : lignes de construction tracées → lettres de LOST qui remontent d'une fente → lettres de LEVEL qui descendent marche par marche → le O s'ouvre (c'est une porte) → l'afficheur compte de 00 à 60.
- **Scroll lié** (un seul gestionnaire passif + `requestAnimationFrame`, variables CSS) : les marches de LEVEL se creusent en quittant l'accueil, la porte de la section « esprit » s'éclate puis se referme.
- **Entrées** : panneaux de salles découverts par un volet, lettres des titres qui sortent d'une fente, jointures tracées puis portes levées, panneaux d'infos « vissés » un à un.
- Rien ne boucle à l'infini, pas de curseur personnalisé, scroll natif intact.
- `prefers-reduced-motion: reduce` : aucun état caché, la page est directement dans sa composition finale. Sans JS, idem.

---

## 3. Parcours

| Niv. | Section | Rôle |
|---|---|---|
| 00 | Accueil | Logo monumental (O-porte, LEVEL en escalier), « Changez de niveau. », Réserver + Découvrir les salles, durée / joueurs / accès |
| −01 | Les salles | 3 modules aux compositions différentes, chacun : univers, nom, dessin, texte, plaque (joueurs, durée, âge, difficulté), Réserver + Voir la salle |
| −02 | L'esprit | Observer. Manipuler. Comprendre. Sortir. + porte éclatée + partie privée |
| −03 | Réservation | Aplat acide, « RÉSERVEZ » monumental, 3 étapes, console avec « Voir les disponibilités », téléphone et e-mail |
| −04 | Infos pratiques | Panneaux : localisation, horaires, tarifs, contact, cartes cadeaux, FAQ (`<details>` natifs) |
| — | Footer | Coordonnées, plan, Instagram, Réserver, logo final passant sous le bord de la page |

Sur mobile, une barre « Réserver une session » apparaît après l'accueil (et se masque sur la section réservation).

---

## 4. Vérifications effectuées
- Rendu à 390, 820, 1280 et 1440 px (Chromium/Playwright) : aucun défilement horizontal.
- axe-core 4.10 (WCAG 2 A/AA + bonnes pratiques) : 0 violation sur mobile ; sur desktop, seul signalement restant : les segments LCD « éteints » de la jauge, décoratifs et `aria-hidden` (contraste faible voulu).
- Clavier : lien d'évitement, ordre de tabulation logique, focus visible (contour charbon + halo acide, acide sur fonds sombres), menu mobile avec `aria-expanded`, focus déplacé à l'ouverture, fermeture par Échap.
- Lecteurs d'écran : titres découpés lettre à lettre doublés d'un texte `.sr-only` ; dessins `aria-hidden` ; `h1` étiqueté « Lost Level, escape game à Angers ».
- Mode mouvement réduit testé ; aucune erreur console.
- Poids : HTML ≈ 40 Ko, CSS ≈ 40 Ko, JS ≈ 7 Ko, police locale 5 Ko, + Archivo/Plex Mono via Google Fonts.

---

## 5. À vérifier avant mise en ligne

La classe `draft` sur `<html>` souligne en pointillés orange chaque donnée incertaine (survol = explication). **Retirer `draft` en production** après avoir remplacé ces contenus (`grep -n data-a-verifier index.html`).

| Donnée | Problème |
|---|---|
| Difficulté de La Valise Vaudou | « facile » sur une source, « vraiment élevée » sur un avis |
| Synopsis de La Valise Vaudou | reprendre le texte officiel |
| Joueurs des Cigares du Castor | 3–6 (liste officielle) vs 3–5 (annuaires) |
| Difficulté des Cigares du Castor | non trouvée |
| Casse-Noisette : statut, joueurs (2–3 ?), âge (11 ou 13 ans) | contradictions entre la page de la salle et l'accueil |
| Horaires | fiches tourisme 2026, non confirmés sur le site officiel |
| Tarifs | seulement 38 €/joueur à 2 et 25 €/joueur à 6 (Cigares du Castor) |
| Mentions légales, confidentialité | URLs à récupérer (liens `#` provisoires) |
| Visuels des salles | des photos réelles pourraient compléter les dessins sur les pages de salles |

Les propositions d'accroche alternatives : « Chaque porte mène un niveau plus bas. » · « Le monde n'est pas ce qu'il semble être. » · « Entrez. Le reste est à comprendre. »
