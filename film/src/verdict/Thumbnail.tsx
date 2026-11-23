import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { ensureFonts, theme } from '../theme';
import { Orb, Room, VerdictChip } from './kit';

// The cover: the product name, the four calls, and the real panel (a Blocked verdict from the live site) in its glass.
export const Thumbnail: React.FC = () => {
  ensureFonts();
  return (
    <AbsoluteFill>
      <Room dim={0.14} />
      <div style={{ position: 'absolute', left: 110, top: 250, width: 980 }}>
        <Orb size={120} />
        <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 150, lineHeight: 1, color: '#fff', letterSpacing: '-0.04em', marginTop: 30, textShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>Verdict<br />for Jira</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 46 }}>
          {(['DUPLICATE', 'READY', 'BLOCKED', 'RISKY'] as const).map((v) => <VerdictChip key={v} v={v} size={34} />)}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1180, top: 70, width: 660, height: 940, overflow: 'hidden', borderRadius: 46, transform: 'rotate(-3deg)', boxShadow: '0 0 60px -10px rgba(47,143,255,0.7)' }}>
        <Img src={staticFile('shots/panel-TAL-56.png')} style={{ width: 660 }} />
      </div>
    </AbsoluteFill>
  );
};
