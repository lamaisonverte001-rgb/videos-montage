import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.resolve(__dirname, '../public/assets');

const WIDTH = 1080;
const HEIGHT = 1920;
const FORCE = process.argv.includes('--force');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq, seed + i * 71);
    sum += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return val / sum;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function writeJpeg(filename, pixelFn) {
  const outPath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(outPath) && !FORCE) {
    console.log(`[skip] ${filename} already exists (use --force to regenerate)`);
    return;
  }
  const data = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const [r, g, b] = pixelFn(x, y);
      const idx = (y * WIDTH + x) * 4;
      data[idx] = clampByte(r);
      data[idx + 1] = clampByte(g);
      data[idx + 2] = clampByte(b);
      data[idx + 3] = 255;
    }
  }
  const encoded = jpeg.encode({ data, width: WIDTH, height: HEIGHT }, 90);
  fs.writeFileSync(outPath, encoded.data);
  console.log(`[ok]   generated ${filename} (${WIDTH}x${HEIGHT})`);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writeFallbackBottlePng(filename) {
  const outPath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(outPath) && !FORCE) {
    console.log(`[skip] ${filename} already exists (preserving real bottle photo)`);
    return;
  }
  const w = 640;
  const h = 800;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w / 2);
      const ny = y / h;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      // Cap (gold/black)
      if (ny >= 0.12 && ny <= 0.24 && Math.abs(nx) <= 0.24) {
        const highlight = Math.exp(-Math.pow((nx + 0.08) * 5, 2));
        r = 165 + highlight * 70;
        g = 130 + highlight * 65;
        b = 55 + highlight * 45;
        a = 255;
      } else if (ny > 0.24 && ny <= 0.31 && Math.abs(nx) <= 0.16) {
        // Neck
        r = 195;
        g = 158;
        b = 75;
        a = 255;
      } else if (ny > 0.31 && ny <= 0.88 && Math.abs(nx) <= 0.42) {
        // Glass bottle body
        const edge = Math.abs(nx) / 0.42;
        const sheen = Math.exp(-Math.pow((nx + 0.18) * 6, 2));
        r = 210 - edge * 55 + sheen * 40;
        g = 185 - edge * 50 + sheen * 35;
        b = 115 - edge * 35 + sheen * 30;
        a = 245;
        // Emerald label in center
        if (ny >= 0.46 && ny <= 0.74 && Math.abs(nx) <= 0.27) {
          const border = ny < 0.475 || ny > 0.725 || Math.abs(nx) > 0.255;
          if (border) {
            r = 201;
            g = 162;
            b = 75;
          } else {
            r = 10;
            g = 42;
            b = 32;
          }
          a = 255;
        }
      }

      const idx = rowStart + 1 + x * 4;
      raw[idx] = clampByte(r);
      raw[idx + 1] = clampByte(g);
      raw[idx + 2] = clampByte(b);
      raw[idx + 3] = clampByte(a);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log(`[ok]   generated fallback ${filename} (${w}x${h})`);
}

function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // 1. terre-seche.jpg : Moroccan matte terracotta / ochre dry clay with fine fissures
  writeJpeg('terre-seche.jpg', (x, y) => {
    const u = x / WIDTH;
    const v = y / HEIGHT;
    const n1 = fbm(u * 6, v * 10, 101, 4);
    const n2 = fbm(u * 26, v * 42, 202, 3);
    const ridge = Math.abs(fbm(u * 9 + 1.3, v * 15 - 0.7, 303, 3) - 0.5);
    const crack = ridge < 0.022 ? 0.55 + (ridge / 0.022) * 0.45 : 1.0;
    const grad = 0.85 + 0.25 * (1 - v);
    const base = (0.72 * n1 + 0.28 * n2) * crack * grad;
    const r = 132 + base * 78;
    const g = 96 + base * 60;
    const b = 68 + base * 42;
    return [r, g, b];
  });

  // 2. laiton-gras.jpg : Hammered Moroccan brass / warm metallic sheen
  const rng = mulberry32(404);
  const dimples = Array.from({ length: 48 }, () => ({
    cx: rng(),
    cy: rng(),
    rad: 0.05 + rng() * 0.08,
  }));
  writeJpeg('laiton-gras.jpg', (x, y) => {
    const u = x / WIDTH;
    const v = y / HEIGHT;
    const brushed = fbm(u * 8, v * 35, 505, 3);
    let hammer = 0;
    for (let i = 0; i < dimples.length; i++) {
      const d = dimples[i];
      const dx = u - d.cx;
      const dy = (v - d.cy) * (HEIGHT / WIDTH);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < d.rad) {
        const k = 1 - dist / d.rad;
        hammer += k * k * 0.32 * (dx > 0 ? 1 : -0.6);
      }
    }
    const sheen = Math.exp(-Math.pow((u - 0.45 + (v - 0.5) * 0.35) * 2.4, 2)) * 0.35;
    const vVal = Math.max(0.15, Math.min(1.25, 0.52 + brushed * 0.32 + hammer + sheen));
    const r = 138 * vVal + 32;
    const g = 104 * vVal + 22;
    const b = 40 * vVal + 10;
    return [r, g, b];
  });

  // 3. cedre-chaud.jpg : Warm Atlas cedar wood with amber resin streaks
  writeJpeg('cedre-chaud.jpg', (x, y) => {
    const u = x / WIDTH;
    const v = y / HEIGHT;
    const warp = fbm(u * 4, v * 7, 707, 3) * 0.35;
    const grain = Math.sin((u * 26 + warp * 14) * Math.PI) * 0.5 + 0.5;
    const fine = fbm(u * 30, v * 6, 808, 3);
    const resin = Math.max(0, fbm(u * 7 + 2.1, v * 11, 909, 4) - 0.62) * 2.6;
    const warmGlow = Math.exp(-Math.pow((v - 0.65) * 1.8, 2)) * 0.25;
    const base = 0.55 * grain + 0.45 * fine;
    const r = 82 + base * 78 + resin * 95 + warmGlow * 55;
    const g = 42 + base * 44 + resin * 52 + warmGlow * 28;
    const b = 22 + base * 20 + resin * 14;
    return [r, g, b];
  });

  // 4. flacon.png : Only generated if missing
  writeFallbackBottlePng('flacon.png');
}

main();
