import { clamp } from './easing';

export type SceneId = 'hook' | 'triptych' | 'clay' | 'brass' | 'cedar' | 'merge' | 'cta';

export interface SceneDef {
  id: SceneId;
  start: number;
  end: number;
}

export interface TextDef {
  id: string;
  start: number;
  end: number;
  ar?: string;
  lat?: string;
  emphasis?: string;
  slot?: 'strip1' | 'strip2' | 'strip3';
  small?: boolean;
  icon?: 'arrow-down' | 'leaf';
  underlineDrawEnd?: number;
}

export interface GaugeDef {
  scene: 'clay' | 'brass' | 'cedar';
  from: number;
  to: number;
  start: number;
  end: number;
  ease?: string;
}

export interface ParticleSingleConfig {
  count: number;
  life: number;
  mode: 'fall-fade' | 'stick-shimmer' | 'rise-turbulent';
  tint: string;
}

export interface ParticleMergeConfig {
  count: number;
  mode: 'converge-ring';
  tints: string[];
}

export interface ParticleHookConfig {
  count: number;
  mode: 'sparks-3';
}

export interface SfxEventDef {
  t: number;
  dur: number;
  type: string;
  gainDb?: number;
  from?: number;
  to?: number;
  modHz?: number;
  cutFrom?: number;
  cutTo?: number;
}

export interface TimelineData {
  id: string;
  fps: number;
  duration: number;
  scenes: SceneDef[];
  texts: TextDef[];
  gauge: GaugeDef[];
  particles: {
    clay: ParticleSingleConfig;
    brass: ParticleSingleConfig;
    cedar: ParticleSingleConfig;
    merge: ParticleMergeConfig;
    hook: ParticleHookConfig;
  };
  sfx: SfxEventDef[];
}

export const secToFrame = (t: number, fps: number): number => Math.round(t * fps);

export const frameToSec = (frame: number, fps: number): number => frame / fps;

export const getScene = (timeline: TimelineData, id: SceneId): SceneDef => {
  const found = timeline.scenes.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Scene "${id}" not found in timeline`);
  }
  return found;
};

export const getSceneFrameRange = (
  scene: SceneDef,
  fps: number,
): { from: number; durationInFrames: number } => {
  const from = secToFrame(scene.start, fps);
  const to = secToFrame(scene.end, fps);
  return {
    from,
    durationInFrames: Math.max(1, to - from),
  };
};

export const getTextById = (timeline: TimelineData, id: string): TextDef => {
  const found = timeline.texts.find((t) => t.id === id);
  if (!found) {
    throw new Error(`Text "${id}" not found in timeline`);
  }
  return found;
};

export const getGaugeForScene = (
  timeline: TimelineData,
  scene: 'clay' | 'brass' | 'cedar',
): GaugeDef => {
  const found = timeline.gauge.find((g) => g.scene === scene);
  if (!found) {
    throw new Error(`Gauge for scene "${scene}" not found in timeline`);
  }
  return found;
};

export const timeProgress = (t: number, start: number, end: number): number => {
  if (end <= start) return t >= end ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
};
