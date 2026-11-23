# La Maison Verte — Script 1 : *Nefs l3ter, ri7a khra*

Projet Remotion 100 % déterministe qui rend le Reel Instagram éducatif de **La Maison Verte** (`www.lamaisonverte.ma`) au format **1080×1920 (9:16), 30 ips, 20,000 s exactes (600 images)** avec piste audio synthétisée exclusivement à partir de bruit filtré et de transitoires.

## Prérequis
- Node.js >= 20
- Python 3.10+ avec `numpy` et `scipy` (`pip install numpy scipy`)
- `ffmpeg` installé dans le `PATH`

## Commandes de rendu

```bash
# 1. Installer les dépendances Node
npm install

# 2. Générer les textures de substitution (terre-seche.jpg, laiton-gras.jpg, cedre-chaud.jpg)
#    (préserve flacon.png si la vraie photo est déjà en place)
npm run placeholders

# 3. Synthétiser la piste audio (48 kHz, 16 bits stéréo, 20,000 s) et vérifier sa non-musicalité
python3 scripts/gen-audio.py && python3 scripts/check-audio.py

# 4. Prévisualisation interactive avec timeline (Remotion Studio)
npm run studio

# 5. Rendu vidéo haute qualité (1080x1920, 30 ips, 600 images)
npx remotion render src/index.ts Script1 out/script1.mp4 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --color-space=bt709 --concurrency=4

# 6. Normalisation audio finale (-16 LUFS, -1.5 dBTP, AAC 192 kbps)
ffmpeg -y -i out/script1.mp4 \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 \
  -c:v copy -c:a aac -b:a 192k \
  out/script1-final.mp4

# 7. Image de couverture (t = 18,6 s, image 558, sujet centré pour recadrage 4:5 Instagram)
npx remotion still src/index.ts Script1 out/cover.jpg --frame=558
```

### Aperçu rapide (demi-résolution)
```bash
npx remotion render src/index.ts Script1 out/preview.mp4 --scale=0.5 --concurrency=4
```
