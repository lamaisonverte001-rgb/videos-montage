import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { BRAND, VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/brand';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../lib/easing';
import { frameToSec, TextDef } from '../lib/time';
import { Droplet } from './Droplet';
import { KineticText } from './KineticText';

interface CtaCardProps {
  sceneStart: number;
  sceneEnd: number;
  cta1: TextDef;
  cta2: TextDef;
  urlText: TextDef;
}

const RAY_COUNT = 16;
const BOTTLE_CENTER_Y = 780;

export const CtaCard: React.FC<CtaCardProps> = ({
  sceneStart,
  sceneEnd,
  cta1,
  cta2,
  urlText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const raysRef = useRef<HTMLCanvasElement>(null);

  const t = frameToSec(frame, fps);
  const localT = Math.max(0, t - sceneStart);

  // Seamless loop fade in the last 0.3s (19.7 -> 20.0) toward the initial resting droplet
  const loopFadeP = easeOutCubic(clamp((t - (sceneEnd - 0.3)) / 0.3, 0, 1));
  const cardOpacity = 1 - loopFadeP;

  // Bottle enters with easeOutBack from scale 0.8 -> 1.0 (never > 1 so label stays razor-sharp)
  const bottleEnterP = clamp(localT / 0.55, 0, 1);
  const bottleScale = Math.min(1.0, lerp(0.8, 1.0, easeOutBack(bottleEnterP)));
  const bottleAlpha = easeOutCubic(clamp(localT / 0.25, 0, 1));

  // Logo gentle reveal at top of safe zone
  const logoAlpha = easeOutCubic(clamp(localT / 0.35, 0, 1));

  // Slowly rotating golden Canvas rays behind the bottle
  useLayoutEffect(() => {
    const canvas = raysRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    ctx.save();
    ctx.translate(VIDEO_WIDTH / 2, BOTTLE_CENTER_Y);
    ctx.rotate(localT * 0.22);

    const maxR = 640;
    for (let i = 0; i < RAY_COUNT; i++) {
      const a0 = (i / RAY_COUNT) * Math.PI * 2;
      const spread = (Math.PI * 2) / (RAY_COUNT * 2.8);
      const grad = ctx.createRadialGradient(0, 0, 30, 0, 0, maxR);
      grad.addColorStop(0, 'rgba(201, 162, 75, 0.24)');
      grad.addColorStop(0.55, 'rgba(201, 162, 75, 0.08)');
      grad.addColorStop(1, 'rgba(201, 162, 75, 0)');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, a0 - spread, a0 + spread);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Soft central halo behind bottle
    const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, 380);
    halo.addColorStop(0, 'rgba(245, 239, 224, 0.20)');
    halo.addColorStop(0.5, 'rgba(201, 162, 75, 0.11)');
    halo.addColorStop(1, 'rgba(10, 42, 32, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 380, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [localT]);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: cardOpacity }}>
        {/* Golden Canvas rotating rays */}
        <canvas
          ref={raysRef}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />

        {/* Brand Logo (LOGO HQ.png) inside top safe zone */}
        <div
          style={{
            position: 'absolute',
            top: BRAND.safeZone.topPx + 10,
            left: 0,
            width: VIDEO_WIDTH,
            display: 'flex',
            justifyContent: 'center',
            opacity: logoAlpha,
          }}
        >
          <Img
            src={staticFile(BRAND.assets.logo)}
            style={{
              width: 240,
              height: 240,
              objectFit: 'contain',
              // Convert dark logo to warm cream/gold on emerald background
              filter: 'brightness(0) invert(0.95) sepia(0.22) saturate(0.85) drop-shadow(0 6px 18px rgba(0,0,0,0.45))',
            }}
          />
        </div>

        {/* Real bottle photo (flacon.png) centered for 4:5 Instagram cover crop, scale <= 1 */}
        <CameraMotionBlur shutterAngle={150} samples={4}>
          <div
            style={{
              position: 'absolute',
              top: 455,
              left: 0,
              width: VIDEO_WIDTH,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: bottleAlpha,
              transform: `scale(${bottleScale})`,
              transformOrigin: '50% 50%',
            }}
          >
            <Img
              src={staticFile(BRAND.assets.bottle)}
              style={{
                width: 520,
                height: 650,
                objectFit: 'contain',
                filter: 'drop-shadow(0 28px 42px rgba(0, 0, 0, 0.55))',
              }}
            />
          </div>
        </CameraMotionBlur>

        {/* CTA Kinetic texts strictly within safe zone (above bottom 20% = 1536px) */}
        <KineticText text={cta1} top={1075} />
        <KineticText text={cta2} top={1075} />
        <KineticText text={urlText} top={1405} variant="url" />
      </AbsoluteFill>

      {/* Seamless loop fade-in to the exact resting droplet at frame 0 */}
      {loopFadeP > 0 && <Droplet mode="loop-end" opacity={loopFadeP} />}
    </AbsoluteFill>
  );
};
