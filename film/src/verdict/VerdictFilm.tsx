import React from 'react';
import { AbsoluteFill } from 'remotion';
import { createFilm } from '../components/Film';
import { theme } from '../theme';
import { SCENES } from './script';
import {
  BlockedScene, ChainScene, CheckScene, CloseScene, DecisionScene, DuplicateScene, HookScene, LogScene, NumbersScene,
  ReadsScene, ReceiptScene, RiskyScene, TitleScene, TrustScene, TwiceScene, WhereScene,
} from './scenes';

// A charcoal canvas behind the dissolves, so cuts never flash.
const Canvas: React.FC = () => <AbsoluteFill style={{ background: theme.tile }} />;

export const verdictFilm = createFilm('verdict', SCENES, {
  hook: HookScene,
  twice: TwiceScene,
  chain: ChainScene,
  decision: DecisionScene,
  trust: TrustScene,
  title: TitleScene,
  reads: ReadsScene,
  blocked: BlockedScene,
  risky: RiskyScene,
  duplicate: DuplicateScene,
  check: CheckScene,
  receipt: ReceiptScene,
  log: LogScene,
  numbers: NumbersScene,
  where: WhereScene,
  close: CloseScene,
}, Canvas);
