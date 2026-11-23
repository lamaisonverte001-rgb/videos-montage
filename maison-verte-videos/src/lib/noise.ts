/**
 * Deterministic 2D gradient noise and divergence-free 2D curl noise.
 * Pure functions of (x, y, seed) with zero shared mutable state.
 */

const hash2D = (ix: number, iy: number, seed: number): number => {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const grad2D = (ix: number, iy: number, seed: number, dx: number, dy: number): number => {
  const h = hash2D(ix, iy, seed) & 7;
  switch (h) {
    case 0:
      return dx + dy;
    case 1:
      return -dx + dy;
    case 2:
      return dx - dy;
    case 3:
      return -dx - dy;
    case 4:
      return dx;
    case 5:
      return -dx;
    case 6:
      return dy;
    default:
      return -dy;
  }
};

export const noise2D = (x: number, y: number, seed = 1337): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const u = fade(fx);
  const v = fade(fy);

  const n00 = grad2D(ix, iy, seed, fx, fy);
  const n10 = grad2D(ix + 1, iy, seed, fx - 1, fy);
  const n01 = grad2D(ix, iy + 1, seed, fx, fy - 1);
  const n11 = grad2D(ix + 1, iy + 1, seed, fx - 1, fy - 1);

  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);
  return nx0 + v * (nx1 - nx0);
};

export const fbm2D = (x: number, y: number, seed = 1337, octaves = 3): number => {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency, seed + i * 97);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.02;
  }
  return norm > 0 ? value / norm : 0;
};

/**
 * Divergence-free 2D curl vector field from scalar potential noise2D.
 * Returns { vx, vy } in roughly [-1, 1].
 */
export const curlNoise2D = (
  x: number,
  y: number,
  seed = 1337,
  eps = 0.01,
): { vx: number; vy: number } => {
  const dPsiDy = (noise2D(x, y + eps, seed) - noise2D(x, y - eps, seed)) / (2 * eps);
  const dPsiDx = (noise2D(x + eps, y, seed) - noise2D(x - eps, y, seed)) / (2 * eps);
  return {
    vx: dPsiDy,
    vy: -dPsiDx,
  };
};
