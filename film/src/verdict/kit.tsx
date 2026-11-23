import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, easeOut, usePop } from '../components/motion';
import { theme } from '../theme';

// Building blocks in the app's own style: a softly lit room, glass windows with a blue rim, charcoal tiles, and the
// glowing route lines the panel uses for evidence.

/** A softly lit, out-of-focus room behind the glass (after the reference): wall, frames, a pale sofa, the floor. */
export const Room: React.FC<{ dim?: number }> = ({ dim = 0 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 120) * 8;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #8c96a1 0%, #a3acb5 55%, #b9b2a6 72%, #cfc8bb 100%)', overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: 'blur(38px)', transform: `translateX(${String(drift)}px)` }}>
        {[[160, 120, 210, 260], [430, 90, 170, 210], [1460, 110, 240, 300], [1240, 160, 150, 190]].map(([x, y, w, h], i) => (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: i % 2 ? '#c4b79c' : '#dcd3c3', borderRadius: 6, opacity: 0.85, boxShadow: 'inset 0 0 0 14px #b8c0c9' }} />
        ))}
        <div style={{ position: 'absolute', left: 260, top: 640, width: 1400, height: 260, background: '#eeebe5', borderRadius: 90 }} />
        <div style={{ position: 'absolute', left: 1640, top: 360, width: 90, height: 420, background: '#f3d9a4', borderRadius: 50, opacity: 0.7 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(10, 14, 20, ${String(0.18 + dim)})` }} />
    </AbsoluteFill>
  );
};

export const Glass: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      padding: 14,
      borderRadius: 40,
      background: `linear-gradient(160deg, ${theme.glassA}, ${theme.glassB})`,
      boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 0 0 1.5px rgba(47,143,255,0.35), 0 0 34px -4px rgba(47,143,255,0.65), 0 40px 80px -30px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(24px)',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Tile: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: theme.tile, borderRadius: 26, padding: 26, color: theme.ink, fontFamily: theme.font, ...style }}>{children}</div>
);

export const Dots: React.FC = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    {[theme.go, '#4a4f59', '#4a4f59'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />)}
  </div>
);

/** A Jira-style ticket tile: key, summary, status. */
export const Ticket: React.FC<{ k: string; summary: string; status: string; tone?: 'stop' | 'warn' | 'go' | 'dup' | 'none'; style?: React.CSSProperties; detail?: string }> = ({ k, summary, status, tone = 'none', style, detail }) => {
  const colour = tone === 'none' ? theme.ink2 : theme[tone];
  return (
    <Tile style={{ width: 560, padding: 24, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, color: theme.ink3 }}>
        <span>{k}</span>
        <span style={{ fontSize: 17, padding: '6px 14px', borderRadius: 999, background: theme.tile3, color: colour }}>{status}</span>
      </div>
      <div style={{ fontSize: 29, fontWeight: 500, marginTop: 10, lineHeight: 1.3 }}>{summary}</div>
      {detail ? <div style={{ fontSize: 21, color: theme.ink2, marginTop: 10, lineHeight: 1.45 }}>{detail}</div> : null}
    </Tile>
  );
};

/** Big caption under or beside the action. */
export const Caption: React.FC<{ text: string; at: number; style?: React.CSSProperties; size?: number }> = ({ text, at, style, size = 54 }) => {
  const p = usePop(at, 20);
  return (
    <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: size, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 6px 30px rgba(0,0,0,0.35)', opacity: p, transform: `translateY(${String((1 - p) * 18)}px)`, ...style }}>
      {text}
    </div>
  );
};

/** A glowing route between two points with one bend, drawn on from frame `at`. */
export const Route: React.FC<{ from: [number, number]; to: [number, number]; at: number; colour?: string; len?: number; bendAt?: number }> = ({ from, to, at, colour = theme.accent, len = 24, bendAt = 0.5 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing: easeOut });
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = x1 + (x2 - x1) * bendAt;
  const d = `M${String(x1)} ${String(y1)} L${String(mx - 20)} ${String(y1)} L${String(mx + 20)} ${String(y2)} L${String(x2)} ${String(y2)}`;
  const total = Math.abs(mx - 20 - x1) + Math.hypot(40, y2 - y1) + Math.abs(x2 - mx - 20);
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }} width={1} height={1}>
      <path d={d} fill="none" stroke={colour} strokeWidth={4} strokeLinecap="round" strokeDasharray={total} strokeDashoffset={total * (1 - t)} style={{ filter: `drop-shadow(0 0 8px ${colour})` }} />
      {t > 0.02 ? <circle cx={x1} cy={y1} r={9} fill="#fff" stroke={colour} strokeWidth={4} /> : null}
      {t > 0.98 ? <circle cx={x2} cy={y2} r={8} fill={colour} /> : null}
    </svg>
  );
};

/** The app icon: a blue orb with a tick. */
export const Orb: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <defs>
      <radialGradient id="orb" cx="36%" cy="30%" r="75%">
        <stop offset="0" stopColor="#9fd0ff" />
        <stop offset="0.45" stopColor="#2f8fff" />
        <stop offset="1" stopColor="#0f2f63" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#orb)" />
    <path d="M20 33l8 8 16-17" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VerdictChip: React.FC<{ v: 'DUPLICATE' | 'READY' | 'BLOCKED' | 'RISKY'; size?: number }> = ({ v, size = 30 }) => {
  const c = { DUPLICATE: theme.dup, READY: theme.go, BLOCKED: theme.stop, RISKY: theme.warn }[v];
  const label = { DUPLICATE: 'Duplicate', READY: 'Ready to Build', BLOCKED: 'Blocked', RISKY: 'Risky' }[v];
  return <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: size, color: c, padding: `${String(size * 0.3)}px ${String(size * 0.7)}px`, borderRadius: 999, background: 'rgba(20,22,27,0.85)', boxShadow: `0 0 0 1.5px ${c}55` }}>{label}</span>;
};
