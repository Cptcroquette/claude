# Le Casse-Noisette — animation d'ouverture

Animation de 27 s (1920x1080, 30 i/s) pour l'escape game *Le Casse-Noisette*,
la boutique de Noël de Madame Mirabelle. Tout est dessiné en code (canvas 2D),
dans la palette violet / rose de l'image de référence.

- **Vidéo finie** : `export/casse-noisette-ouverture.mp4`
- **Aperçu en direct** : ouvrir `index.html` dans un navigateur (clic = rejouer)

## Déroulé

| Temps | Séquence |
|---|---|
| 0 – 4,8 s | Façade de la boutique : la porte s'ouvre, la lumière jaillit, on plonge dedans |
| 4,8 – 9,6 s | Motion design : anneaux, flocons, boules suspendues, « Il était une fois… » |
| 9,6 – 15,6 s | Le casse-noisette apparaît, croque une noisette (CRAC !), titre + « Escape Game » |
| 15,6 – 21,8 s | Volet sucre d'orge → « Boutique de Noël, tenue par Madame Mirabelle », sapin, cadeaux |
| 20,8 – 27 s | Final : médaillon, bannière « Le Casse-Noisette », « Grande Ouverture » |

## Ré-exporter

Nécessite Node.js, Playwright (Chromium) et ffmpeg :

```
node render.js                        # -> export/casse-noisette-ouverture.mp4
node render.js --stills 3.5,13.3,25   # images fixes pour vérifier
```

Les textes, couleurs (objet `C`) et le minutage se modifient dans `animation.js`.
Polices : Cinzel Decorative, Great Vibes, Cormorant Garamond (OFL, dans `fonts/`).
