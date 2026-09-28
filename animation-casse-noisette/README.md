# Le Casse-Noisette — teaser d'ouverture

Teaser de 15 s en format vertical 9:16 (1080x1920, 30 i/s, avec son) pour
l'escape game *Le Casse-Noisette*, la boutique de Noël de Madame Mirabelle.
Ambiance : Noël étrange et mystérieux, à la *L'Étrange Noël de Monsieur Jack*.

- **Vidéo finie** : `export/casse-noisette-teaser.mp4`
- **Aperçu en direct** : ouvrir `index.html` dans un navigateur (clic = lancer avec le son)

Les décors sont les illustrations fournies (`assets/`), animées en code (canvas 2D) :
caméra, lumières qui vacillent, neige, brouillard, porte qui s'ouvre, mâchoire
du casse-noisette, textes façon stop-motion.

## Déroulé

| Temps | Image | Ce qui se passe | Son |
|---|---|---|---|
| 0 – 4,6 s | `maison.webp` | Une silhouette passe à la fenêtre, le loquet cède, la porte s'ouvre, on plonge à travers | Vent, grelots lointains, valse de boîte à musique, grincement, souffle |
| 4,6 – 8,6 s | `boutique.webp` | « Madame Mirabelle vous attend… », les lampes grésillent et meurent une à une | Pizzicati, choeur, papiers, bourdonnement, claquements ; la boîte à musique se dérègle |
| 8,6 – 11,3 s | `casse-noisette.jpg` | Une ampoule clignote, « …et lui aussi. », la mâchoire s'ouvre… CRAC ! | Relais, cordes dissonantes, coeur qui bat, bois qui grince, CRAC |
| 11,3 – 15 s | `sapin.webp` | Le sapin s'illumine, l'étoile s'embrase, titre + « Escape Game — Grande Ouverture » | Impact, choeur, carillon, cloche |

## Ré-exporter

Nécessite Node.js, Playwright (Chromium), Python 3 (numpy, scipy) et ffmpeg :

```
python3 bande-son.py                  # -> export/bande-son.wav
node render.js                        # -> export/casse-noisette-teaser.mp4 (image + son)
node render.js --stills 3.5,10,14     # images fixes pour vérifier
```

- Textes, couleurs et minutage : `animation.js` (les repères de temps sont les
  mêmes dans `bande-son.py`).
- La musique est une composition originale (valse en mi mineur).
- Polices : Henny Penny, IM Fell English (OFL, dans `fonts/`).
- `assets/points.js` : positions des lumières du sapin, détectées dans l'image.
