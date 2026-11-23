import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { mulberry32 } from '../lib/rng';

const GRAIN_W = 270;
const GRAIN_H = 480;

export const GrainVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(GRAIN_W, GRAIN_H);
    const data = img.data;
    // Seed strictly from frame number so grain animates every frame deterministically
    const rng = mulberry32((frame + 1) * 2654435761);
    for (let i = 0; i < data.length; i += 4) {
      const v = (rng() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Animated seeded film grain (2.5% opacity) to prevent H.264 gradient banding */}
      <canvas
        ref={canvasRef}
        width={GRAIN_W}
        height={GRAIN_H}
        style={{
          position: 'absolute',
          inset: 0,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          opacity: BRAND.grain.opacity,
          mixBlendMode: 'overlay',
          imageRendering: 'pixelated',
        }}
      />
      {/* Subtle dark emerald vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 72% 66% at 50% 48%, rgba(6, 27, 20, 0) 48%, rgba(4, 16, 12, 0.42) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
