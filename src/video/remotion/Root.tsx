import React from 'react';
import { Composition } from 'remotion';
import { YdtQuestionComposition } from './YdtQuestionComposition';
import { YdtVideoProps } from './types';

export const REMOTION_COMPOSITION_ID = 'YdtQuestionComposition';
export const REMOTION_WIDTH = 1920;
export const REMOTION_HEIGHT = 1080;
export const REMOTION_FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={YdtQuestionComposition}
      durationInFrames={450} // Default 15s at 30fps
      fps={REMOTION_FPS}
      width={REMOTION_WIDTH}
      height={REMOTION_HEIGHT}
      defaultProps={{
        questionImageUrl: '',
        audioUrl: '',
        durationInSeconds: 15,
        regions: [],
        events: [],
        teacherTag: 'Arapça YDT • Soru Çözümü',
        showWatermark: true,
      }}
    />
  );
};
