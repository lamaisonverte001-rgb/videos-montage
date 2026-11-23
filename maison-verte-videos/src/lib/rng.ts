export type RngFn = () => number;

/**
 * Deterministic PRNG (Mulberry32). Purely driven by its 32-bit integer seed.
 */
export const mulberry32 = (seed: number): RngFn => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (input: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const seededRange = (rng: RngFn, min: number, max: number): number => {
  return min + rng() * (max - min);
};

export const seededInt = (rng: RngFn, min: number, maxInclusive: number): number => {
  return Math.floor(min + rng() * (maxInclusive - min + 1));
};
