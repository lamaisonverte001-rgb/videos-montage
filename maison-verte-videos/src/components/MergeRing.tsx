import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { clamp, easeInOutCubic, easeOutCubic, lerp } from '../lib/easing';
import { mulberry32, seededRange } from '../lib/rng';
import { frameToSec, ParticleMergeConfig } from '../lib/time';

interface MergeRingProps {
  config: ParticleMergeConfig;
  sceneStart: number;
  sceneEnd: number;
}

const CENTER_X = VIDEO_WIDTH / 2;
const CENTER_Y = 760;
const RING_RADIUS = 235;
const FREEZE_START = 16.6;
const FREEZE_END = 16.75;
const FLASH_TIME = 16.75;

const CLOUD_ORIGINS = [
  { x: 180, y: 520 },
  { x: 540, y: 1220 },
  { x: 900, y: 520 },
];

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const createDotSprite = (hex: string): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  const s = 64;
  const off = document.createElement('canvas');
  off.width = s;
  off.height = s;
  const ctx = off.getContext('2d');
  if (!ctx) return null;
  const [r, g, b] = hexToRgb(hex);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(255, 250, 235, 0.95)`);
  grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.72)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return off;
};

export const MergeRing: React.FC<MergeRingProps> = ({ config, sceneStart, sceneEnd }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sprites = useMemo(
    () => config.tints.map((hex) => createDotSprite(hex)),
    [config.tints],
  );

  const t = frameToSec(frame, fps);
  // Visual freeze of 0.15s at t = 16.6s (everything freezes dead still until 16.75s)
  const effectiveT =
    t >= FREEZE_START && t < FREEZE_END
      ? FREEZE_START
      : t >= FREEZE_END
        ? t - (FREEZE_END - FREEZE_START)
        : t;

  const localT = Math.max(0, effectiveT - sceneStart);
  const convergeP = easeInOutCubic(clamp(localT / 1.35, 0, 1));
  const ringAlpha = easeOutCubic(clamp((localT - 0.55) / 0.65, 0, 1));

  // Soft golden flash at t = 16.75s
  const flashElapsed = t - FLASH_TIME;
  const flashAlpha =
    flashElapsed >= 0 && flashElapsed <= 0.25
      ? Math.sin((flashElapsed / 0.25) * Math.PI) * 0.55
      : 0;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    if (t < sceneStart || t > sceneEnd) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const perCloud = Math.floor(config.count / 3);
    for (let i = 0; i < config.count; i++) {
      const cloudIdx = Math.min(2, Math.floor(i / perCloud));
      const sprite = sprites[cloudIdx];
      if (!sprite) continue;

      const rng = mulberry32(42000 + i * 1013);
      const origin = CLOUD_ORIGINS[cloudIdx];
      const startX = origin.x + seededRange(rng, -170, 170);
      const startY = origin.y + seededRange(rng, -220, 220);

      const baseAngle = (i / config.count) * Math.PI * 2 + cloudIdx * 0.4;
      const swirlSpin = localT * 1.65;
      const radialJitter = seededRange(rng, -18, 18);
      const angle = baseAngle + swirlSpin;
      const targetX = CENTER_X + Math.cos(angle) * (RING_RADIUS + radialJitter);
      const targetY = CENTER_Y + Math.sin(angle) * (RING_RADIUS + radialJitter);

      // Curved spiral pull toward the ring
      const midPull = Math.sin(convergeP * Math.PI) * seededRange(rng, 40, 110);
      const x = lerp(startX, targetX, convergeP) + Math.cos(angle + Math.PI / 2) * midPull;
      const y = lerp(startY, targetY, convergeP) + Math.sin(angle + Math.PI / 2) * midPull;

      const radius = seededRange(rng, 14, 34) * lerp(1.15, 0.85, convergeP);
      ctx.globalAlpha = seededRange(rng, 0.48, 0.88);
      ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }, [frame, fps, t, localT, convergeP, config, sceneStart, sceneEnd, sprites]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Luminous SVG ring behind particles */}
      <svg width={VIDEO_WIDTH} height={VIDEO_HEIGHT} viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}>
        <defs>
          <radialGradient id="mergeCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={BRAND.colors.goldBright} stopOpacity="0.28" />
            <stop offset="65%" stopColor={BRAND.colors.gold} stopOpacity="0.08" />
            <stop offset="100%" stopColor={BRAND.colors.emeraldDark} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RING_RADIUS * 1.45}
          fill="url(#mergeCoreGlow)"
          opacity={ringAlpha}
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RING_RADIUS}
          fill="none"
          stroke={BRAND.colors.gold}
          strokeWidth="3"
          opacity={ringAlpha * 0.72}
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RING_RADIUS - 14}
          fill="none"
          stroke={BRAND.colors.cream}
          strokeWidth="1.2"
          strokeDasharray="10 14"
          opacity={ringAlpha * 0.42}
          transform={`rotate(${localT * 28} ${CENTER_X} ${CENTER_Y})`}
        />
      </svg>

      {/* 150 converging particles canvas */}
      <canvas
        ref={canvasRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Soft warm flash at t = 16.75s */}
      {flashAlpha > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 42%, rgba(245, 239, 224, ${flashAlpha}) 0%, rgba(201, 162, 75, ${flashAlpha * 0.45}) 55%, rgba(10, 42, 32, 0) 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
