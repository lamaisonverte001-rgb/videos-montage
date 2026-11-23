import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { bounceOut, clamp, easeOutCubic, lerp } from '../lib/easing';
import { frameToSec, TextDef } from '../lib/time';
import { KineticText } from './KineticText';

interface TriptychProps {
  sceneStart: number;
  sceneEnd: number;
  stickers: [TextDef, TextDef, TextDef];
}

const STRIPS = [
  { key: 'strip1', asset: BRAND.assets.clay, x: 0 },
  { key: 'strip2', asset: BRAND.assets.brass, x: VIDEO_WIDTH / 3 },
  { key: 'strip3', asset: BRAND.assets.cedar, x: (VIDEO_WIDTH * 2) / 3 },
] as const;

export const Triptych: React.FC<TriptychProps> = ({ sceneStart, sceneEnd, stickers }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);
  const localT = t - sceneStart;
  const sceneDur = Math.max(0.01, sceneEnd - sceneStart);
  const kenBurnsP = clamp(localT / sceneDur, 0, 1);
  const zoomScale = lerp(1.0, 1.06, kenBurnsP);

  return (
    <AbsoluteFill>
      <CameraMotionBlur shutterAngle={160} samples={4}>
        <AbsoluteFill>
          {STRIPS.map((strip, idx) => {
            const stagger = idx * 0.12;
            const revealP = easeOutCubic(clamp((localT - stagger) / 0.48, 0, 1));
            const insetY = (1 - revealP) * 50;
            const stripW = VIDEO_WIDTH / 3;

            return (
              <div
                key={strip.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: strip.x,
                  width: stripW,
                  height: VIDEO_HEIGHT,
                  overflow: 'hidden',
                  clipPath: `inset(${insetY}% 0% ${insetY}% 0%)`,
                }}
              >
                <Img
                  src={staticFile(strip.asset)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${zoomScale})`,
                    transformOrigin: '50% 50%',
                  }}
                />
                {/* Subtle emerald tint harmonization */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(10, 42, 32, 0.38) 0%, rgba(10, 42, 32, 0.10) 48%, rgba(10, 42, 32, 0.45) 100%)',
                  }}
                />
              </div>
            );
          })}

          {/* Gold hairline dividers between the 3 strips */}
          {[1, 2].map((dividerIdx) => {
            const divP = easeOutCubic(clamp((localT - dividerIdx * 0.12) / 0.45, 0, 1));
            return (
              <div
                key={dividerIdx}
                style={{
                  position: 'absolute',
                  top: `${(1 - divP) * 50}%`,
                  left: (VIDEO_WIDTH / 3) * dividerIdx - 1,
                  width: 2,
                  height: `${divP * 100}%`,
                  backgroundColor: BRAND.colors.gold,
                  opacity: 0.65,
                }}
              />
            );
          })}
        </AbsoluteFill>
      </CameraMotionBlur>

      {/* 3 stickers dropping into their respective strip with bounceOut */}
      {stickers.map((sticker, idx) => {
        const dropP = bounceOut(clamp((t - sticker.start) / 0.55, 0, 1));
        const stripW = VIDEO_WIDTH / 3;
        return (
          <KineticText
            key={sticker.id}
            text={sticker}
            top={820 + idx * 120}
            left={idx * stripW + 14}
            width={stripW - 28}
            blockBounceProgress={dropP}
            variant="sticker"
          />
        );
      })}
    </AbsoluteFill>
  );
};
