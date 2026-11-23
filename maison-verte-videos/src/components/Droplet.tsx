import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { clamp, easeInCubic, easeOutCubic, lerp } from '../lib/easing';
import { mulberry32, seededRange } from '../lib/rng';
import { frameToSec } from '../lib/time';

interface DropletProps {
  mode?: 'hook' | 'loop-end';
  sparkCount?: number;
  opacity?: number;
}

const DROP_START_Y = 430;
const DROP_IMPACT_Y = 1040;
const DROP_X = VIDEO_WIDTH / 2;
const IMPACT_TIME = 0.9;

const cubicBezier = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number => {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
};

const TARGET_ZONES = [
  { x: 180, y: 980, c1x: 360, c1y: 780, c2x: 200, c2y: 820, color: BRAND.colors.clayTint },
  { x: 540, y: 820, c1x: 540, c1y: 920, c2x: 540, c2y: 860, color: BRAND.colors.goldBright },
  { x: 900, y: 980, c1x: 720, c1y: 780, c2x: 880, c2y: 820, color: BRAND.colors.amberTint },
];

export const Droplet: React.FC<DropletProps> = ({
  mode = 'hook',
  sparkCount = 40,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);

  if (mode === 'loop-end') {
    return (
      <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
        <svg width={VIDEO_WIDTH} height={VIDEO_HEIGHT} viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}>
          <defs>
            <radialGradient id="dropGlowLoop" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={BRAND.colors.goldBright} stopOpacity="0.45" />
              <stop offset="100%" stopColor={BRAND.colors.gold} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="dropFillLoop" x1="30%" y1="10%" x2="75%" y2="95%">
              <stop offset="0%" stopColor="#F8E4A8" />
              <stop offset="45%" stopColor={BRAND.colors.gold} />
              <stop offset="100%" stopColor={BRAND.colors.goldDeep} />
            </linearGradient>
          </defs>
          <circle cx={DROP_X} cy={DROP_START_Y + 24} r={96} fill="url(#dropGlowLoop)" />
          <g transform={`translate(${DROP_X}, ${DROP_START_Y})`}>
            <path
              d="M 0 -54 C 14 -24, 38 6, 38 30 C 38 52, 21 68, 0 68 C -21 68, -38 52, -38 30 C -38 6, -14 -24, 0 -54 Z"
              fill="url(#dropFillLoop)"
              stroke={BRAND.colors.goldBright}
              strokeWidth="2"
            />
            <path
              d="M -13 10 C -18 22, -16 36, -8 45"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.82"
            />
            <circle cx="-11" cy="-2" r="4" fill="#FFFFFF" opacity="0.75" />
          </g>
        </svg>
      </AbsoluteFill>
    );
  }

  // Falling phase: [0, 0.9s]
  const fallProgress = clamp(t / IMPACT_TIME, 0, 1);
  const easedFall = easeInCubic(fallProgress);
  const dropY = lerp(DROP_START_Y, DROP_IMPACT_Y, easedFall);
  const stretchY = 1 + easedFall * 0.22;
  const squashX = 1 - easedFall * 0.1;
  const dropVisible = t < IMPACT_TIME + 0.04;
  const dropAlpha = t < IMPACT_TIME ? 1 : clamp(1 - (t - IMPACT_TIME) / 0.04, 0, 1);

  // Impact rings: 3 concentric rings staggered by 80 ms
  const rings = [0, 1, 2].map((idx) => {
    const startT = IMPACT_TIME + idx * 0.08;
    const p = clamp((t - startT) / 0.78, 0, 1);
    const ep = easeOutCubic(p);
    return {
      idx,
      visible: p > 0 && p < 1,
      rx: lerp(18, 290 + idx * 70, ep),
      ry: lerp(10, 110 + idx * 28, ep),
      alpha: (1 - p) * (0.85 - idx * 0.16),
      strokeWidth: lerp(5.5, 1.2, ep),
    };
  });

  // 3 main Bezier sparks bursting toward the 3 zones after impact
  const burstElapsed = t - IMPACT_TIME;
  const burstProgress = clamp(burstElapsed / 0.95, 0, 1);
  const easedBurst = easeOutCubic(burstProgress);

  const mainSparks = TARGET_ZONES.map((zone, idx) => {
    const x = cubicBezier(easedBurst, DROP_X, zone.c1x, zone.c2x, zone.x);
    const y = cubicBezier(easedBurst, DROP_IMPACT_Y, zone.c1y, zone.c2y, zone.y);
    const trailT = clamp(easedBurst - 0.1, 0, 1);
    const tx = cubicBezier(trailT, DROP_X, zone.c1x, zone.c2x, zone.x);
    const ty = cubicBezier(trailT, DROP_IMPACT_Y, zone.c1y, zone.c2y, zone.y);
    const alpha = burstElapsed > 0 ? clamp(1 - Math.max(0, burstProgress - 0.72) / 0.28, 0, 1) : 0;
    return { idx, x, y, tx, ty, color: zone.color, alpha };
  });

  // 40 deterministic analytical micro-sparks around the 3 trajectories
  const microSparks: Array<{ x: number; y: number; r: number; alpha: number; color: string }> = [];
  if (burstElapsed > 0 && burstElapsed < 1.1) {
    for (let i = 0; i < sparkCount; i++) {
      const rng = mulberry32(9001 + i * 73);
      const zoneIdx = i % 3;
      const zone = TARGET_ZONES[zoneIdx];
      const delay = seededRange(rng, 0, 0.14);
      const life = seededRange(rng, 0.45, 0.92);
      const localP = clamp((burstElapsed - delay) / life, 0, 1);
      if (localP <= 0 || localP >= 1) continue;
      const ep = easeOutCubic(localP);
      const spreadX = seededRange(rng, -90, 90);
      const spreadY = seededRange(rng, -90, 90);
      const bx = cubicBezier(ep, DROP_X, zone.c1x + spreadX * 0.5, zone.c2x + spreadX, zone.x + spreadX);
      const by = cubicBezier(ep, DROP_IMPACT_Y, zone.c1y + spreadY * 0.5, zone.c2y + spreadY, zone.y + spreadY);
      const r = seededRange(rng, 2.2, 6.2) * (1 - localP * 0.55);
      const alpha = Math.sin(localP * Math.PI) * seededRange(rng, 0.45, 0.95);
      microSparks.push({ x: bx, y: by, r, alpha, color: zone.color });
    }
  }

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      <svg width={VIDEO_WIDTH} height={VIDEO_HEIGHT} viewBox={`0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}`}>
        <defs>
          <radialGradient id="dropGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={BRAND.colors.goldBright} stopOpacity="0.48" />
            <stop offset="100%" stopColor={BRAND.colors.gold} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="dropFill" x1="30%" y1="10%" x2="75%" y2="95%">
            <stop offset="0%" stopColor="#F8E4A8" />
            <stop offset="45%" stopColor={BRAND.colors.gold} />
            <stop offset="100%" stopColor={BRAND.colors.goldDeep} />
          </linearGradient>
        </defs>

        {/* Subtle vertical guide thread above falling droplet */}
        {dropVisible && (
          <line
            x1={DROP_X}
            y1={BRAND.safeZone.topPx + 40}
            x2={DROP_X}
            y2={dropY - 58}
            stroke={BRAND.colors.gold}
            strokeOpacity={0.22 * dropAlpha}
            strokeWidth="1.5"
            strokeDasharray="6 10"
          />
        )}

        {/* Concentric impact ripples */}
        {rings.map(
          (ring) =>
            ring.visible && (
              <ellipse
                key={ring.idx}
                cx={DROP_X}
                cy={DROP_IMPACT_Y + 26}
                rx={ring.rx}
                ry={ring.ry}
                fill="none"
                stroke={BRAND.colors.goldBright}
                strokeWidth={ring.strokeWidth}
                opacity={ring.alpha}
              />
            ),
        )}

        {/* Micro-sparks */}
        {microSparks.map((sp, idx) => (
          <circle
            key={idx}
            cx={sp.x}
            cy={sp.y}
            r={sp.r}
            fill={sp.color}
            opacity={sp.alpha}
          />
        ))}

        {/* 3 primary Bezier sparks */}
        {mainSparks.map(
          (sp) =>
            sp.alpha > 0 && (
              <g key={sp.idx} opacity={sp.alpha}>
                <line
                  x1={sp.tx}
                  y1={sp.ty}
                  x2={sp.x}
                  y2={sp.y}
                  stroke={sp.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.55"
                />
                <circle cx={sp.x} cy={sp.y} r="15" fill={sp.color} opacity="0.35" />
                <circle cx={sp.x} cy={sp.y} r="7.5" fill="#FFFDF5" />
              </g>
            ),
        )}

        {/* Golden SVG Droplet */}
        {dropVisible && (
          <g opacity={dropAlpha}>
            <circle cx={DROP_X} cy={dropY + 24} r={96} fill="url(#dropGlow)" />
            <g transform={`translate(${DROP_X}, ${dropY}) scale(${squashX}, ${stretchY})`}>
              <path
                d="M 0 -54 C 14 -24, 38 6, 38 30 C 38 52, 21 68, 0 68 C -21 68, -38 52, -38 30 C -38 6, -14 -24, 0 -54 Z"
                fill="url(#dropFill)"
                stroke={BRAND.colors.goldBright}
                strokeWidth="2"
              />
              <path
                d="M -13 10 C -18 22, -16 36, -8 45"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.82"
              />
              <circle cx="-11" cy="-2" r="4" fill="#FFFFFF" opacity="0.75" />
            </g>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};
