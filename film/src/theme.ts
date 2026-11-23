import { continueRender, delayRender, staticFile } from 'remotion';

// Verdict's look, the app's own tokens: charcoal tiles on frosted glass, a soft blue rim light, one electric-blue
// accent, floating in a softly lit room (after Brian's reference). Poppins (SIL Open Font License).
export const theme = {
  room: '#9aa3ad',
  glassA: 'rgba(74, 80, 92, 0.80)',
  glassB: 'rgba(38, 41, 48, 0.88)',
  tile: '#1b1d22',
  tile2: '#23262d',
  tile3: '#2b2f37',
  ink: '#f2f4f8',
  ink2: '#a9afbb',
  ink3: '#6c7380',
  accent: '#2f8fff',
  go: '#34c759',
  stop: '#ff5f57',
  warn: '#ffb020',
  dup: '#b18cff',
  font: "'Poppins', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

let fontsRequested = false;

export function ensureFonts(): void {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  const handle = delayRender('Loading fonts');
  Promise.all(
    [400, 500, 600].map((w) => new FontFace('Poppins', `url(${staticFile(`fonts/poppins-${String(w)}.woff2`)}) format('woff2')`, { weight: String(w) }).load().then((f) => { document.fonts.add(f); })),
  )
    .catch((err: unknown) => { console.error(err); })
    .finally(() => { continueRender(handle); });
}
