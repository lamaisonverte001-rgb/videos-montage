import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND } from '../lib/brand';

interface BackgroundProps {
  /** Optional pulse amplitude multiplier (default 0.03 = ±3%) */
  pulseAmplitude?: number;
}

export const Background: React.FC<BackgroundProps> = ({ pulseAmplitude = 0.03 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Integer number of cycles across the 20s video ensures frame 0 === frame 600 for seamless looping
  const cycles = 4;
  const phase = (frame / durationInFrames) * Math.PI * 2 * cycles;
  const pulse = 1 + Math.sin(phase) * pulseAmplitude;
  const radiusX = 58 * pulse;
  const radiusY = 48 * pulse;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.colors.emeraldDark,
        backgroundImage: `radial-gradient(${radiusX}% ${radiusY}% at 50% 44%, ${BRAND.colors.emeraldLight} 0%, ${BRAND.colors.emeraldPill} 36%, ${BRAND.colors.emeraldDark} 74%, ${BRAND.colors.emeraldDeep} 100%)`,
      }}
    />
  );
};
