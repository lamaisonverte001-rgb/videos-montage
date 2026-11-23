import React from 'react';
import { Composition } from 'remotion';
import timelineJson from '../timeline/script1.json';
import { VIDEO_HEIGHT, VIDEO_WIDTH } from './lib/brand';
import { TimelineData } from './lib/time';
import { Script1 } from './Script1';

const timeline = timelineJson as TimelineData;
const FPS = timeline.fps;
const DURATION_IN_FRAMES = Math.round(timeline.duration * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Script1"
      component={Script1}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};
