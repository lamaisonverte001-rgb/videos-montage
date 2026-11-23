import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND } from '../lib/brand';
import { clamp, easeOutBack, easeOutCubic, getEasing, lerp } from '../lib/easing';
import { frameToSec, GaugeDef, timeProgress } from '../lib/time';

interface GaugeProps {
  gauge: GaugeDef;
  sceneStart: number;
  sceneEnd: number;
  accentColor?: string;
}

const SIZE = 210;
const STROKE = 14;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const Gauge: React.FC<GaugeProps> = ({
  gauge,
  sceneStart,
  sceneEnd,
  accentColor = BRAND.colors.gold,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);

  const enterP = clamp((t - (sceneStart + 0.25)) / 0.35, 0, 1);
  const exitP = clamp((sceneEnd - t) / 0.25, 0, 1);
  const scale = easeOutBack(enterP);
  const opacity = clamp(enterP * 2, 0, 1) * easeOutCubic(exitP);

  const easeFn = getEasing(gauge.ease);
  const rawProgress = timeProgress(t, gauge.start, gauge.end);
  const value = lerp(gauge.from, gauge.to, easeFn(rawProgress));
  const dashOffset = CIRCUMFERENCE * (1 - clamp(value, 0, 1));
  const pct = Math.round(clamp(value, 0, 1) * 100);

  return (
    <div
      style={{
        position: 'absolute',
        top: 280,
        right: 68,
        width: SIZE,
        height: SIZE,
        opacity,
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'rgba(10, 42, 32, 0.78)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(245, 239, 224, 0.16)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={accentColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: BRAND.fonts.latin,
            fontWeight: BRAND.typography.fontWeight,
            fontSize: 44,
            color: BRAND.colors.cream,
            lineHeight: 1,
            textShadow: BRAND.typography.textShadow,
          }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
};
