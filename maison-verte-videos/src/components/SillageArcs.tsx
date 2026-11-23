import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { clamp, easeOutCubic, lerp } from '../lib/easing';
import { frameToSec } from '../lib/time';

interface SillageArcsProps {
  sceneStart: number;
  sceneEnd: number;
}

const PERIOD = 0.7; // New concentric wave every 0.7s
const WAVE_LIFE = 1.65;
const ORIGIN_X = VIDEO_WIDTH / 2;
const ORIGIN_Y = VIDEO_HEIGHT - 180;

export const SillageArcs: React.FC<SillageArcsProps> = ({ sceneStart, sceneEnd }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);
  const localT = t - sceneStart;
  if (localT < 0 || t > sceneEnd) return null;

  const sceneFadeOut = easeOutCubic(clamp((sceneEnd - t) / 0.3, 0, 1));
  const waveCount = Math.ceil((sceneEnd - sceneStart) / PERIOD) + 1;

  const arcs: Array<{ key: number; radius: number; opacity: number; strokeWidth: number }> = [];
  for (let i = 0; i < waveCount; i++) {
    const startT = i * PERIOD;
    const age = localT - startT;
    if (age < 0 || age > WAVE_LIFE) continue;
    const p = age / WAVE_LIFE;
    const ep = easeOutCubic(p);
    const radius = lerp(120, 1180, ep);
    const opacity = Math.sin(p * Math.PI) * 0.52 * sceneFadeOut;
    const strokeWidth = lerp(5.5, 1.5, ep);
    arcs.push({ key: i, radius, opacity, strokeWidth });
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={VIDEO_WIDTH} height={VIDEO_HEIGHT} viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}>
        <defs>
          <linearGradient id="sillageGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={BRAND.colors.amberTint} stopOpacity="0.9" />
            <stop offset="60%" stopColor={BRAND.colors.goldBright} stopOpacity="0.7" />
            <stop offset="100%" stopColor={BRAND.colors.cream} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {arcs.map((arc) => (
          <path
            key={arc.key}
            d={`M ${ORIGIN_X - arc.radius} ${ORIGIN_Y} A ${arc.radius} ${arc.radius} 0 0 1 ${ORIGIN_X + arc.radius} ${ORIGIN_Y}`}
            fill="none"
            stroke="url(#sillageGrad)"
            strokeWidth={arc.strokeWidth}
            strokeLinecap="round"
            opacity={arc.opacity}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
