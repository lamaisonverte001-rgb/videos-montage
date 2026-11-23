import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { clamp, easeInOutCubic, lerp } from '../lib/easing';
import { frameToSec } from '../lib/time';

interface FullPanelProps {
  stripIndex: 0 | 1 | 2;
  imageAsset: string;
  sceneStart: number;
  sceneEnd: number;
  tintOverlay?: string;
}

export const FullPanel: React.FC<FullPanelProps> = ({
  stripIndex,
  imageAsset,
  sceneStart,
  sceneEnd,
  tintOverlay = 'rgba(10, 42, 32, 0.24)',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);

  const localT = Math.max(0, t - sceneStart);
  const sceneDur = Math.max(0.01, sceneEnd - sceneStart);

  // Expand from corresponding 1/3 vertical strip to fullscreen over 0.5s (easeInOutCubic)
  const expandP = easeInOutCubic(clamp(localT / 0.5, 0, 1));
  const initialLeftPct = stripIndex * (100 / 3);
  const initialRightPct = (2 - stripIndex) * (100 / 3);
  const leftInset = lerp(initialLeftPct, 0, expandP);
  const rightInset = lerp(initialRightPct, 0, expandP);

  // Gentle parallax drift 0 -> 20px and subtle depth zoom
  const progress = clamp(localT / sceneDur, 0, 1);
  const parallaxY = lerp(0, 20, progress);
  const parallaxX = lerp((stripIndex - 1) * -10, (stripIndex - 1) * 10, progress);
  const scale = lerp(1.06, 1.11, progress);

  return (
    <AbsoluteFill>
      <CameraMotionBlur shutterAngle={160} samples={4}>
        <AbsoluteFill
          style={{
            clipPath: `inset(0% ${rightInset}% 0% ${leftInset}%)`,
            overflow: 'hidden',
          }}
        >
          <Img
            src={staticFile(imageAsset)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0) scale(${scale})`,
              transformOrigin: '50% 50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg, rgba(6, 24, 18, 0.45) 0%, ${tintOverlay} 48%, rgba(6, 24, 18, 0.62) 100%)`,
            }}
          />
        </AbsoluteFill>
      </CameraMotionBlur>
    </AbsoluteFill>
  );
};
