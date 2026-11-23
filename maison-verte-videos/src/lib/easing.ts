export type EasingFn = (t: number) => number;

export const clamp = (v: number, min = 0, max = 1): number => {
  if (v < min) return min;
  if (v > max) return max;
  return v;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeOutCubic: EasingFn = (t) => {
  const x = clamp(t);
  return 1 - Math.pow(1 - x, 3);
};

export const easeInCubic: EasingFn = (t) => {
  const x = clamp(t);
  return x * x * x;
};

export const easeInOutCubic: EasingFn = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const easeOutBack: EasingFn = (t) => {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const bounceOut: EasingFn = (t) => {
  let x = clamp(t);
  const n1 = 7.5625;
  const d1 = 2.75;

  if (x < 1 / d1) {
    return n1 * x * x;
  }
  if (x < 2 / d1) {
    x -= 1.5 / d1;
    return n1 * x * x + 0.75;
  }
  if (x < 2.5 / d1) {
    x -= 2.25 / d1;
    return n1 * x * x + 0.9375;
  }
  x -= 2.625 / d1;
  return n1 * x * x + 0.984375;
};

export const easeInExpo: EasingFn = (t) => {
  const x = clamp(t);
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
};

export const linear: EasingFn = (t) => clamp(t);

const EASING_MAP: Record<string, EasingFn> = {
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  bounceOut,
  easeInExpo,
  linear,
};

export const getEasing = (name?: string): EasingFn => {
  if (!name) return linear;
  return EASING_MAP[name] ?? linear;
};
