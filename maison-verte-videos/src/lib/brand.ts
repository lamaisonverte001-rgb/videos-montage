export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export const BRAND = {
  colors: {
    emeraldDark: '#0A2A20',
    emeraldDeep: '#061B14',
    emeraldPill: '#0F3D2E',
    emeraldLight: '#16523F',
    cream: '#F5EFE0',
    gold: '#C9A24B',
    goldBright: '#E5C675',
    goldDeep: '#8E6D28',
    clayTint: '#E8DCC0',
    amberTint: '#E0883A',
    scrimDark: 'rgba(6, 22, 16, 0.72)',
    scrimMid: 'rgba(10, 42, 32, 0.56)',
    scrimTransparent: 'rgba(10, 42, 32, 0)',
  },
  fonts: {
    arabic: 'Cairo',
    latin: 'Montserrat',
  },
  typography: {
    arabicSizeDefault: 68,
    arabicSizeSmall: 44,
    arabicSizeSticker: 46,
    latinRatio: 0.7,
    fontWeight: 800,
    textShadow: '0 4px 18px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.45)',
  },
  safeZone: {
    topPx: Math.ceil(VIDEO_HEIGHT * 0.12), // 231px (12% top Instagram UI)
    bottomPx: Math.ceil(VIDEO_HEIGHT * 0.2), // 384px (20% bottom Instagram UI)
    horizontalPx: 64,
  },
  grain: {
    opacity: 0.025,
  },
  assets: {
    clay: 'assets/terre-seche.jpg',
    brass: 'assets/laiton-gras.jpg',
    cedar: 'assets/cedre-chaud.jpg',
    bottle: 'assets/flacon.png',
    logo: 'assets/logo.png',
    audio: 'audio/ambient.wav',
  },
} as const;
