import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND } from '../lib/brand';
import { clamp, easeOutBack, easeOutCubic } from '../lib/easing';
import { frameToSec, TextDef } from '../lib/time';

interface KineticTextProps {
  text: TextDef;
  /** Vertical position in px from top (must stay inside safe zone [231, 1536]) */
  top?: number;
  /** Horizontal alignment / container width override (e.g. for triptych stickers) */
  left?: number;
  width?: number;
  /** Use bounceOut entrance for whole block (used by triptych stickers) */
  blockBounceProgress?: number;
  /** Optional pill background style for stickers */
  variant?: 'default' | 'sticker' | 'url';
}

const HandDrawnIcon: React.FC<{ icon: 'arrow-down' | 'leaf'; size?: number }> = ({
  icon,
  size = 44,
}) => {
  if (icon === 'arrow-down') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block' }}>
        <circle
          cx="24"
          cy="24"
          r="21"
          fill={BRAND.colors.emeraldPill}
          stroke={BRAND.colors.gold}
          strokeWidth="2.5"
        />
        <path
          d="M24 13 L24 33 M15 25 L24 34 L33 25"
          fill="none"
          stroke={BRAND.colors.gold}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block' }}>
      <circle
        cx="24"
        cy="24"
        r="21"
        fill={BRAND.colors.emeraldPill}
        stroke={BRAND.colors.gold}
        strokeWidth="2.5"
      />
      <path
        d="M15 33 C15 19, 25 13, 35 13 C35 23, 29 33, 15 33 Z"
        fill={BRAND.colors.emeraldLight}
        stroke={BRAND.colors.gold}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 33 C20 27, 25 22, 31 17"
        fill="none"
        stroke={BRAND.colors.goldBright}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface WordToken {
  word: string;
  isEmphasis: boolean;
}

const tokenizeWithEmphasis = (sentence: string, emphasis?: string): WordToken[] => {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (!emphasis) {
    return words.map((word) => ({ word, isEmphasis: false }));
  }
  const emphWords = emphasis.trim().split(/\s+/).filter(Boolean);
  const stripPunct = (w: string) => w.replace(/[.,!?؟!؛:()"«»]+/g, '');

  const flags = new Array<boolean>(words.length).fill(false);
  if (emphWords.length === 1) {
    const target = stripPunct(emphWords[0]);
    for (let i = 0; i < words.length; i++) {
      if (stripPunct(words[i]) === target || words[i].includes(target)) {
        flags[i] = true;
      }
    }
  } else {
    for (let i = 0; i <= words.length - emphWords.length; i++) {
      let match = true;
      for (let j = 0; j < emphWords.length; j++) {
        if (stripPunct(words[i + j]) !== stripPunct(emphWords[j])) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < emphWords.length; j++) {
          flags[i + j] = true;
        }
      }
    }
  }
  return words.map((word, idx) => ({ word, isEmphasis: flags[idx] }));
};

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  top = 1230,
  left = BRAND.safeZone.horizontalPx,
  width = 1080 - BRAND.safeZone.horizontalPx * 2,
  blockBounceProgress,
  variant = 'default',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frameToSec(frame, fps);

  if (t < text.start || t > text.end) {
    return null;
  }

  const elapsed = t - text.start;
  const remaining = text.end - t;
  const exitDuration = 0.2;
  const exitProgress = remaining < exitDuration ? clamp(remaining / exitDuration, 0, 1) : 1;
  const exitAlpha = easeOutCubic(exitProgress);
  const exitShiftY = (1 - exitAlpha) * -14;

  const arSize =
    variant === 'sticker'
      ? BRAND.typography.arabicSizeSticker
      : text.small
        ? BRAND.typography.arabicSizeSmall
        : BRAND.typography.arabicSizeDefault;
  const latSize = Math.round(arSize * BRAND.typography.latinRatio);

  const arTokens = text.ar ? tokenizeWithEmphasis(text.ar, text.emphasis) : [];
  const latTokens = text.lat ? text.lat.trim().split(/\s+/).filter(Boolean) : [];

  const wordStagger = 0.08;
  const wordAnimDur = 0.25;

  const underlineProgress =
    text.underlineDrawEnd !== undefined
      ? easeOutCubic(clamp((t - text.start) / Math.max(0.05, text.underlineDrawEnd - text.start), 0, 1))
      : 0;

  const bounceOffsetY =
    blockBounceProgress !== undefined ? (1 - blockBounceProgress) * -160 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: exitAlpha,
        transform: `translateY(${exitShiftY + bounceOffsetY}px)`,
        pointerEvents: 'none',
      }}
    >
      {/* Semi-transparent dark gradient scrim for guaranteed legibility */}
      <div
        style={{
          padding: variant === 'sticker' ? '18px 20px' : '22px 34px',
          borderRadius: variant === 'sticker' ? 22 : 28,
          background:
            variant === 'sticker'
              ? `linear-gradient(180deg, rgba(15, 61, 46, 0.92) 0%, rgba(10, 42, 32, 0.95) 100%)`
              : `linear-gradient(180deg, rgba(6, 22, 16, 0.78) 0%, rgba(10, 42, 32, 0.68) 100%)`,
          border:
            variant === 'sticker'
              ? `2px solid ${BRAND.colors.gold}`
              : '1px solid rgba(201, 162, 75, 0.28)',
          boxShadow: '0 14px 38px rgba(0, 0, 0, 0.42)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: variant === 'sticker' ? 8 : 12,
          maxWidth: '100%',
        }}
      >
        {text.icon && (
          <div style={{ marginBottom: 4 }}>
            <HandDrawnIcon icon={text.icon} size={46} />
          </div>
        )}

        {/* Arabic line: strict RTL, word-by-word only, zero letter-spacing, zero text-transform */}
        {arTokens.length > 0 && (
          <div
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: BRAND.fonts.arabic,
              fontWeight: BRAND.typography.fontWeight,
              fontSize: arSize,
              lineHeight: 1.28,
              color: BRAND.colors.cream,
              textAlign: 'center',
              textShadow: BRAND.typography.textShadow,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: '0.26em',
              rowGap: '0.08em',
            }}
          >
            {arTokens.map((tok, i) => {
              const p = clamp((elapsed - i * wordStagger) / wordAnimDur, 0, 1);
              const e = easeOutBack(p);
              const wordOpacity = clamp(p * 2.2, 0, 1);
              return (
                <span
                  key={`${text.id}-ar-${i}`}
                  style={{
                    display: 'inline-block',
                    color: tok.isEmphasis ? BRAND.colors.gold : BRAND.colors.cream,
                    opacity: wordOpacity,
                    transform: `translateY(${(1 - e) * 26}px) scale(${0.86 + 0.14 * e})`,
                  }}
                >
                  {tok.word}
                </span>
              );
            })}
          </div>
        )}

        {/* Latin line: Montserrat ExtraBold, 70% of Arabic size, gold */}
        {latTokens.length > 0 && (
          <div
            dir="ltr"
            style={{
              fontFamily: BRAND.fonts.latin,
              fontWeight: BRAND.typography.fontWeight,
              fontSize: variant === 'url' ? 40 : latSize,
              lineHeight: 1.25,
              color: variant === 'url' ? BRAND.colors.cream : BRAND.colors.gold,
              textAlign: 'center',
              textShadow: BRAND.typography.textShadow,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: '0.28em',
              rowGap: '0.06em',
            }}
          >
            {latTokens.map((word, i) => {
              const delay = (arTokens.length > 0 ? 0.08 : 0) + i * wordStagger;
              const p = clamp((elapsed - delay) / wordAnimDur, 0, 1);
              const e = easeOutBack(p);
              const wordOpacity = clamp(p * 2.2, 0, 1);
              return (
                <span
                  key={`${text.id}-lat-${i}`}
                  style={{
                    display: 'inline-block',
                    opacity: wordOpacity,
                    transform: `translateY(${(1 - e) * 18}px) scale(${0.9 + 0.1 * e})`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        )}

        {/* Animated gold underline for URL */}
        {text.underlineDrawEnd !== undefined && (
          <svg width="360" height="10" viewBox="0 0 360 10" style={{ marginTop: 2 }}>
            <line
              x1="10"
              y1="5"
              x2="350"
              y2="5"
              stroke={BRAND.colors.gold}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="340"
              strokeDashoffset={340 * (1 - underlineProgress)}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
