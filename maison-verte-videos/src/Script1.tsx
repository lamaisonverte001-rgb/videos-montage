import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import timelineJson from '../timeline/script1.json';
import { Background } from './components/Background';
import { CtaCard } from './components/CtaCard';
import { Droplet } from './components/Droplet';
import { FullPanel } from './components/FullPanel';
import { Gauge } from './components/Gauge';
import { GrainVignette } from './components/GrainVignette';
import { KineticText } from './components/KineticText';
import { MergeRing } from './components/MergeRing';
import { MistCanvas } from './components/MistCanvas';
import { SillageArcs } from './components/SillageArcs';
import { Triptych } from './components/Triptych';
import { BRAND } from './lib/brand';
import {
  frameToSec,
  getGaugeForScene,
  getScene,
  getTextById,
  secToFrame,
  TimelineData,
} from './lib/time';

export const TIMELINE = timelineJson as TimelineData;

const FONT_STYLE_ID = 'lmv-local-fonts';

const ensureLocalFonts = (): Promise<void> => {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (!document.getElementById(FONT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    style.textContent = `
      @font-face {
        font-family: '${BRAND.fonts.arabic}';
        src: url('${staticFile('fonts/Cairo-ExtraBold.ttf')}') format('truetype');
        font-weight: 100 900;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: '${BRAND.fonts.latin}';
        src: url('${staticFile('fonts/Montserrat-ExtraBold.ttf')}') format('truetype');
        font-weight: 100 900;
        font-style: normal;
        font-display: block;
      }
    `;
    document.head.appendChild(style);
  }
  return document.fonts.ready.then(() => undefined);
};

export const Script1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [fontHandle] = useState(() => delayRender('Loading local Cairo & Montserrat fonts'));

  useEffect(() => {
    let active = true;
    ensureLocalFonts()
      .then(() => {
        if (active) continueRender(fontHandle);
      })
      .catch(() => {
        if (active) continueRender(fontHandle);
      });
    return () => {
      active = false;
    };
  }, [fontHandle]);

  const t = frameToSec(frame, fps);

  const hookScene = getScene(TIMELINE, 'hook');
  const triptychScene = getScene(TIMELINE, 'triptych');
  const clayScene = getScene(TIMELINE, 'clay');
  const brassScene = getScene(TIMELINE, 'brass');
  const cedarScene = getScene(TIMELINE, 'cedar');
  const mergeScene = getScene(TIMELINE, 'merge');
  const ctaScene = getScene(TIMELINE, 'cta');

  const inRange = (start: number, end: number, padEnd = 0) =>
    frame >= secToFrame(start, fps) && frame < secToFrame(end + padEnd, fps);

  const inCta = frame >= secToFrame(ctaScene.start, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.emeraldDark, overflow: 'hidden' }}>
      {/* Synthesized non-musical noise/transient audio track */}
      <Audio src={staticFile(BRAND.assets.audio)} />

      {/* Pulsing deep emerald radial background */}
      <Background />

      {/* Scene 1: Hook (0 - 2s) */}
      {inRange(hookScene.start, hookScene.end) && (
        <AbsoluteFill>
          <Droplet mode="hook" sparkCount={TIMELINE.particles.hook.count} />
          <KineticText text={getTextById(TIMELINE, 'hook')} top={1210} />
        </AbsoluteFill>
      )}

      {/* Scene 2: Triptych (2 - 4.5s, kept 0.5s underneath clay expand transition) */}
      {inRange(triptychScene.start, triptychScene.end, 0.5) && (
        <Triptych
          sceneStart={triptychScene.start}
          sceneEnd={triptychScene.end}
          stickers={[
            getTextById(TIMELINE, 'sticker1'),
            getTextById(TIMELINE, 'sticker2'),
            getTextById(TIMELINE, 'sticker3'),
          ]}
        />
      )}

      {/* Scene 3: Clay / Dry skin (4.5 - 8s, kept 0.5s underneath brass expand transition) */}
      {inRange(clayScene.start, clayScene.end, 0.5) && (
        <AbsoluteFill>
          <FullPanel
            stripIndex={0}
            imageAsset={BRAND.assets.clay}
            sceneStart={clayScene.start}
            sceneEnd={clayScene.end}
            tintOverlay="rgba(32, 24, 16, 0.22)"
          />
          {t < clayScene.end && (
            <>
              <MistCanvas
                config={TIMELINE.particles.clay}
                sceneStart={clayScene.start}
                sceneEnd={clayScene.end}
              />
              <Gauge
                gauge={getGaugeForScene(TIMELINE, 'clay')}
                sceneStart={clayScene.start}
                sceneEnd={clayScene.end}
                accentColor={BRAND.colors.clayTint}
              />
              <KineticText text={getTextById(TIMELINE, 'clay')} top={1240} />
            </>
          )}
        </AbsoluteFill>
      )}

      {/* Scene 4: Brass / Oily skin (8 - 11.5s, kept 0.5s underneath cedar expand transition) */}
      {inRange(brassScene.start, brassScene.end, 0.5) && (
        <AbsoluteFill>
          <FullPanel
            stripIndex={1}
            imageAsset={BRAND.assets.brass}
            sceneStart={brassScene.start}
            sceneEnd={brassScene.end}
            tintOverlay="rgba(26, 22, 10, 0.22)"
          />
          {t < brassScene.end && (
            <>
              <MistCanvas
                config={TIMELINE.particles.brass}
                sceneStart={brassScene.start}
                sceneEnd={brassScene.end}
              />
              <Gauge
                gauge={getGaugeForScene(TIMELINE, 'brass')}
                sceneStart={brassScene.start}
                sceneEnd={brassScene.end}
                accentColor={BRAND.colors.gold}
              />
              <KineticText text={getTextById(TIMELINE, 'brass')} top={1240} />
            </>
          )}
        </AbsoluteFill>
      )}

      {/* Scene 5: Cedar / Warm skin (11.5 - 15s) */}
      {inRange(cedarScene.start, cedarScene.end) && (
        <AbsoluteFill>
          <FullPanel
            stripIndex={2}
            imageAsset={BRAND.assets.cedar}
            sceneStart={cedarScene.start}
            sceneEnd={cedarScene.end}
            tintOverlay="rgba(34, 16, 8, 0.24)"
          />
          <SillageArcs sceneStart={cedarScene.start} sceneEnd={cedarScene.end} />
          <MistCanvas
            config={TIMELINE.particles.cedar}
            sceneStart={cedarScene.start}
            sceneEnd={cedarScene.end}
          />
          <Gauge
            gauge={getGaugeForScene(TIMELINE, 'cedar')}
            sceneStart={cedarScene.start}
            sceneEnd={cedarScene.end}
            accentColor={BRAND.colors.amberTint}
          />
          <KineticText text={getTextById(TIMELINE, 'cedar')} top={1240} />
        </AbsoluteFill>
      )}

      {/* Scene 6: Merge (15 - 17s) */}
      {inRange(mergeScene.start, mergeScene.end) && (
        <AbsoluteFill>
          <MergeRing
            config={TIMELINE.particles.merge}
            sceneStart={mergeScene.start}
            sceneEnd={mergeScene.end}
          />
          <KineticText text={getTextById(TIMELINE, 'merge')} top={1075} />
          <KineticText text={getTextById(TIMELINE, 'merge-sub')} top={1315} />
        </AbsoluteFill>
      )}

      {/* Scene 7: CTA + seamless loop to frame 0 (17 - 20s) */}
      {inCta && (
        <CtaCard
          sceneStart={ctaScene.start}
          sceneEnd={ctaScene.end}
          cta1={getTextById(TIMELINE, 'cta1')}
          cta2={getTextById(TIMELINE, 'cta2')}
          urlText={getTextById(TIMELINE, 'url')}
        />
      )}

      {/* Global animated grain (2.5%) + vignette to prevent H.264 banding */}
      <GrainVignette />
    </AbsoluteFill>
  );
};
