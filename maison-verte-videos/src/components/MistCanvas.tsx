import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { clamp, easeOutCubic } from '../lib/easing';
import { curlNoise2D } from '../lib/noise';
import { hashString, mulberry32, seededRange } from '../lib/rng';
import { frameToSec, ParticleSingleConfig } from '../lib/time';

interface MistCanvasProps {
  config: ParticleSingleConfig;
  sceneStart: number;
  sceneEnd: number;
}

const SPRITE_SIZE = 96;

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const createMistSprite = (tintHex: string): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  const off = document.createElement('canvas');
  off.width = SPRITE_SIZE;
  off.height = SPRITE_SIZE;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  const [r, g, b] = hexToRgb(tintHex);
  const half = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.92)`);
  grad.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, 0.45)`);
  grad.addColorStop(0.68, `rgba(${r}, ${g}, ${b}, 0.12)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return off;
};

export const MistCanvas: React.FC<MistCanvasProps> = ({ config, sceneStart, sceneEnd }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sprite = useMemo(() => createMistSprite(config.tint), [config.tint]);
  const baseSeed = useMemo(() => hashString(`${config.mode}-${config.tint}`), [config.mode, config.tint]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    const t = frameToSec(frame, fps);
    const localT = t - sceneStart;
    if (localT < 0 || t > sceneEnd) return;

    const sceneFadeIn = easeOutCubic(clamp(localT / 0.35, 0, 1));
    const sceneFadeOut = easeOutCubic(clamp((sceneEnd - t) / 0.28, 0, 1));
    const globalAlpha = sceneFadeIn * sceneFadeOut;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const { count, life, mode } = config;

    for (let i = 0; i < count; i++) {
      const rng = mulberry32(baseSeed + i * 1973);
      const x0 = seededRange(rng, 70, VIDEO_WIDTH - 70);
      const y0 = seededRange(rng, 260, VIDEO_HEIGHT - 360);
      const size = seededRange(rng, 26, 84);
      const phase = seededRange(rng, 0, life);
      const speedScale = seededRange(rng, 0.75, 1.35);
      const baseOpacity = seededRange(rng, 0.25, 0.62);

      let x = x0;
      let y = y0;
      let radius = size;
      let alpha = 0;

      if (mode === 'fall-fade') {
        // Pure analytical cyclic age in [0, life)
        const age = ((localT + phase) % life + life) % life;
        const p = age / life;
        const curl = curlNoise2D(x0 * 0.003, y0 * 0.003 + age * 0.65, baseSeed);
        x = x0 + curl.vx * 110 * age;
        y = y0 + (260 * speedScale) * age + 180 * age * age + curl.vy * 45 * age;
        radius = size * (1 - p * 0.42);
        // Rapid collapse of alpha over life
        const fadeIn = clamp(p / 0.12, 0, 1);
        const fadeOut = Math.pow(1 - p, 2.3);
        alpha = baseOpacity * fadeIn * fadeOut;
      } else if (mode === 'stick-shimmer') {
        // Golden pearls clinging to the surface with slow sinusoidal shimmer
        const shimmerFreq = seededRange(rng, 0.45, 1.05);
        const shimmerPhase = seededRange(rng, 0, Math.PI * 2);
        const curl = curlNoise2D(x0 * 0.004, y0 * 0.004 + localT * 0.15, baseSeed);
        x = x0 + curl.vx * 16;
        y = y0 + curl.vy * 16;
        const shimmer = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(localT * shimmerFreq * Math.PI * 2 + shimmerPhase));
        radius = size * (0.58 + 0.24 * shimmer);
        alpha = baseOpacity * 1.15 * shimmer;
      } else {
        // rise-turbulent: buoyant upward mist with sin/cos + curl turbulence
        const age = ((localT + phase) % life + life) % life;
        const p = age / life;
        const startY = seededRange(rng, 980, 1680);
        const curl = curlNoise2D(x0 * 0.0028 + age * 0.35, startY * 0.0028 - age * 0.4, baseSeed);
        const turbX = Math.sin(age * 3.4 + i * 0.7) * 58 + curl.vx * 135 * p;
        const turbY = Math.cos(age * 2.7 + i * 0.5) * 28 + curl.vy * 60 * p;
        x = x0 + turbX;
        y = startY - (340 * speedScale) * age + turbY;
        radius = size * (0.75 + p * 0.75);
        const env = Math.sin(p * Math.PI);
        alpha = baseOpacity * env;
      }

      const finalAlpha = clamp(alpha * globalAlpha, 0, 1);
      if (finalAlpha <= 0.005) continue;

      ctx.globalAlpha = finalAlpha;
      const drawSize = radius * 2;
      ctx.drawImage(sprite, x - radius, y - radius, drawSize, drawSize);
    }

    ctx.restore();
  }, [frame, fps, config, sceneStart, sceneEnd, sprite, baseSeed]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} />
    </AbsoluteFill>
  );
};
