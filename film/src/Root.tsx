import React from 'react';
import { Composition } from 'remotion';
import { FPS } from './components/Film';
import { verdictFilm } from './verdict/VerdictFilm';

export const Root: React.FC = () => (
  <Composition id="Verdict" component={verdictFilm.Component} durationInFrames={verdictFilm.durationInFrames} fps={FPS} width={1920} height={1080}
    defaultProps={verdictFilm.defaultProps} calculateMetadata={verdictFilm.calculateMetadata} />
);
