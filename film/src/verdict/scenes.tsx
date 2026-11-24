import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, easeOut, track, usePop } from '../components/motion';
import { theme } from '../theme';
import tal42 from '../../fixtures/TAL-42.json';
import tal56 from '../../fixtures/TAL-56.json';
import { Caption, Dots, Glass, Orb, Room, Route, Ticket, Tile, VerdictChip } from './kit';

type S = React.FC<{ duration: number }>;
const F = theme.font;

const fadeIn = (frame: number, at: number, len = 14) => interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing: easeOut });
const rise = (p: number, px = 30): React.CSSProperties => ({ opacity: p, transform: `translateY(${String((1 - p) * px)}px)` });

// ------------------------------------------------------------------ the problem

const BACKLOG: [string, string, string][] = [
  ['TAL-42', 'Payment events go missing when our endpoint is down', 'To Do'],
  ['TAL-56', 'Push notification when an invoice is paid', 'To Do'],
  ['TAL-65', 'Store card numbers for one-click pay', 'To Do'],
  ['TAL-51', 'Recurring invoices on a monthly schedule', 'To Do'],
  ['TAL-74', 'Issue a credit note from a sent invoice', 'To Do'],
];

export const HookScene: S = () => {
  const frame = useCurrentFrame();
  const pick = fadeIn(frame, 120, 20);
  return (
    <AbsoluteFill>
      <Room />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ width: 760, transform: `translateY(${String(-30 + (1 - fadeIn(frame, 0, 30)) * 40)}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px 18px' }}>
            <Dots />
            <span style={{ fontFamily: F, fontSize: 30, color: theme.ink, fontWeight: 500 }}>Backlog</span>
            <span style={{ fontFamily: F, fontSize: 16, color: '#fff', background: theme.accent, borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>40</span>
          </div>
          {BACKLOG.map(([k, s, st], i) => {
            const p = fadeIn(frame, 10 + i * 8, 18);
            const picked = i === 1;
            return (
              <div key={k} style={{ ...rise(p, 24), marginTop: i ? 10 : 0 }}>
                <Tile style={{ padding: '18px 24px', display: 'flex', gap: 20, alignItems: 'center', boxShadow: picked ? `0 0 0 ${String(2 * pick)}px ${theme.accent}, 0 0 ${String(30 * pick)}px rgba(47,143,255,0.5)` : undefined, transform: picked ? `scale(${String(1 + pick * 0.03)})` : undefined }}>
                  <span style={{ fontSize: 20, color: theme.ink3, width: 86 }}>{k}</span>
                  <span style={{ fontSize: 25, flex: 1 }}>{s}</span>
                  <span style={{ fontSize: 16, color: theme.ink2, background: theme.tile3, padding: '5px 12px', borderRadius: 999 }}>{st}</span>
                </Tile>
              </div>
            );
          })}
        </Glass>
      </AbsoluteFill>
      <Caption text="Picked up. Not checked." at={150} style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center' }} />
    </AbsoluteFill>
  );
};

export const TwiceScene: S = () => {
  const frame = useCurrentFrame();
  const a = fadeIn(frame, 6, 22);
  const b = fadeIn(frame, 40, 22);
  return (
    <AbsoluteFill>
      <Room dim={0.06} />
      <div style={{ position: 'absolute', left: 170, top: 250, ...rise(a) }}>
        <Ticket k="TAL-2" status="To Do" summary="Retry failed Stripe webhook deliveries with backoff" detail="When our webhook endpoint fails, Stripe events are dropped. Queue them and retry with exponential backoff." />
      </div>
      <div style={{ position: 'absolute', left: 1190, top: 410, ...rise(b) }}>
        <Ticket k="TAL-42" status="To Do" summary="Payment events go missing when our endpoint is down" detail="If our server is unavailable for a few minutes we lose Stripe events for good. Keep them and replay them later." />
      </div>
      <Route from={[730, 420]} to={[1190, 560]} at={80} colour={theme.dup} len={30} />
      <Caption text="Same work. Different words." at={100} style={{ position: 'absolute', bottom: 90, width: '100%', textAlign: 'center' }} />
    </AbsoluteFill>
  );
};

export const ChainScene: S = () => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  const end = fadeIn(frame, 110, 20);
  return (
    <AbsoluteFill>
      <Room dim={0.06} />
      <div style={{ position: 'absolute', left: 110, top: 200, ...rise(fadeIn(frame, 4)) }}>
        <Ticket k="TAL-56" status="To Do" summary="Push notification when an invoice is paid" style={{ width: 500 }} detail="Description and acceptance criteria present." />
      </div>
      <Route from={[610, 300]} to={[740, 470]} at={40} colour={theme.stop} />
      <div style={{ position: 'absolute', left: 740, top: 400, ...rise(fadeIn(frame, 56)) }}>
        <Ticket k="TAL-15" status="Backlog" tone="stop" summary="Push notification service" style={{ width: 470 }} />
      </div>
      <Route from={[1210, 470]} to={[1330, 650]} at={100} colour={theme.stop} />
      <div style={{ position: 'absolute', left: 1330, top: 580, ...rise(end), boxShadow: `0 0 ${String(40 * pulse * end)}px rgba(255,95,87,0.6)`, borderRadius: 26 }}>
        <Ticket k="TAL-16" status="Backlog" tone="stop" summary="Apple developer account for push certificates" style={{ width: 480 }} />
      </div>
      <Caption text="Blocked, two links away." at={150} style={{ position: 'absolute', bottom: 80, width: '100%', textAlign: 'center' }} />
    </AbsoluteFill>
  );
};

export const DecisionScene: S = () => {
  const frame = useCurrentFrame();
  const clash = fadeIn(frame, 270, 16);
  return (
    <AbsoluteFill>
      <Room dim={0.06} />
      <div style={{ position: 'absolute', left: 170, top: 300, ...rise(fadeIn(frame, 4)) }}>
        <Ticket k="TAL-65" status="To Do" summary="Store card numbers for one-click pay" detail="Keep the customer's card number on file so repeat payments are one click." />
      </div>
      <div style={{ position: 'absolute', left: 1080, top: 230, width: 680, ...rise(fadeIn(frame, 70)) }}>
        <div style={{ background: '#f4f5f7', borderRadius: 22, padding: 34, fontFamily: F, color: '#172b4d', boxShadow: '0 30px 60px -30px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 18, color: '#5e6c84' }}>Confluence · Tally Decisions</div>
          <div style={{ fontSize: 33, fontWeight: 600, marginTop: 10 }}>Decision: we never store card numbers</div>
          <div style={{ fontSize: 22, lineHeight: 1.5, marginTop: 14, color: '#44546f' }}>Tally never stores card numbers or CVCs, in any form. Card details go straight to Stripe Elements and we keep only the Stripe payment method token.</div>
          <div style={{ display: 'inline-block', marginTop: 16, fontSize: 17, fontWeight: 600, color: '#216e4e', background: '#dcfff1', padding: '5px 12px', borderRadius: 6 }}>Status: Final</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 735, top: 400, width: 345, height: 6, borderRadius: 3, background: theme.warn, opacity: clash, boxShadow: `0 0 20px ${theme.warn}`, transform: `scaleX(${String(clash)})`, transformOrigin: 'left' }} />
      <Caption text="Against a decision we already made." at={280} style={{ position: 'absolute', bottom: 90, width: '100%', textAlign: 'center' }} />
    </AbsoluteFill>
  );
};

export const TrustScene: S = () => {
  const frame = useCurrentFrame();
  const q = fadeIn(frame, 120, 16);
  return (
    <AbsoluteFill>
      <Room dim={0.12} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...rise(fadeIn(frame, 8)), maxWidth: 980, fontFamily: F, fontSize: 40, lineHeight: 1.45, color: theme.ink, background: theme.tile, padding: '36px 44px', borderRadius: '34px 34px 34px 8px', boxShadow: '0 40px 80px -30px rgba(0,0,0,0.6)' }}>
          This ticket looks good to go. It is clearly scoped and should be quick to build.
        </div>
        <div style={{ marginTop: 34, display: 'flex', gap: 18, opacity: q }}>
          {['Sources: none', 'Checked: nothing'].map((t) => (
            <span key={t} style={{ fontFamily: F, fontSize: 28, color: theme.stop, background: 'rgba(20,22,27,0.85)', padding: '12px 26px', borderRadius: 999, boxShadow: `0 0 0 1.5px ${theme.stop}55` }}>{t}</span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ the product

export const TitleScene: S = () => {
  const frame = useCurrentFrame();
  const p = usePop(4, 14);
  return (
    <AbsoluteFill>
      <Room dim={0.1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ padding: '64px 96px', textAlign: 'center', transform: `scale(${String(0.92 + p * 0.08)})`, opacity: p }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Orb size={130} /></div>
          <div style={{ fontFamily: F, fontSize: 104, fontWeight: 600, color: '#fff', letterSpacing: '-0.035em', marginTop: 18 }}>Verdict for Jira</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 30 }}>
            {(['DUPLICATE', 'READY', 'BLOCKED', 'RISKY'] as const).map((v, i) => (
              <span key={v} style={rise(fadeIn(frame, 60 + i * 12), 16)}><VerdictChip v={v} size={28} /></span>
            ))}
          </div>
          <div style={{ fontFamily: F, fontSize: 32, color: theme.ink2, marginTop: 34, opacity: fadeIn(frame, 150) }}>Every reason cited, checked and signed.</div>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SOURCES: { label: string; sub: string; y: number; at: number }[] = [
  { label: 'Linked issues', sub: 'blocks, duplicates, relates to', y: 190, at: 30 },
  { label: 'Blockers of blockers', sub: 'two links deep', y: 330, at: 60 },
  { label: 'Confluence pages', sub: 'decisions the issue points to', y: 470, at: 90 },
  { label: 'Pull requests', sub: 'from the Teamwork Graph', y: 610, at: 120 },
  { label: 'Similar issues', sub: 'across the project', y: 750, at: 150 },
];

export const ReadsScene: S = () => {
  const frame = useCurrentFrame();
  const floor = fadeIn(frame, 250, 20);
  return (
    <AbsoluteFill>
      <Room dim={0.1} />
      <div style={{ position: 'absolute', left: 120, top: 400, ...rise(fadeIn(frame, 4)) }}>
        <Ticket k="TAL-56" status="To Do" summary="Push notification when an invoice is paid" style={{ width: 470 }} />
      </div>
      {SOURCES.map((s) => (
        <React.Fragment key={s.label}>
          <Route from={[590, 480]} to={[880, s.y + 50]} at={s.at} len={22} />
          <div style={{ position: 'absolute', left: 880, top: s.y, ...rise(fadeIn(frame, s.at + 14)) }}>
            <Tile style={{ width: 470, padding: '18px 26px' }}>
              <div style={{ fontSize: 28, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 19, color: theme.ink3, marginTop: 4 }}>{s.sub}</div>
            </Tile>
          </div>
        </React.Fragment>
      ))}
      <div style={{ position: 'absolute', left: 1420, top: 300, width: 400, ...rise(floor) }}>
        <Glass>
          <Tile>
            <div style={{ fontSize: 22, color: theme.ink3 }}>Checked in code first</div>
            <div style={{ fontSize: 26, marginTop: 14, lineHeight: 1.45 }}>TAL-15 blocks this issue and is still open.</div>
            <div style={{ fontSize: 22, color: theme.ink3, marginTop: 22 }}>Calls allowed</div>
            <div style={{ marginTop: 12 }}><VerdictChip v="BLOCKED" size={26} /></div>
          </Tile>
        </Glass>
      </div>
    </AbsoluteFill>
  );
};

/** A real panel screenshot (rendered from a receipt captured on the live site) in its glass, with a slow pan. */
const PanelShot: React.FC<{ file: string; height: number; pan: [number, number, number, number] }> = ({ file, height, pan }) => {
  const frame = useCurrentFrame();
  const w = 720;
  const h = (height / 1168) * w;
  const y = track(frame, [pan[0], pan[1]], [pan[2], pan[3]]);
  return (
    <div style={{ position: 'absolute', left: 140, top: 40, width: w + 20, height: 1000, overflow: 'hidden', borderRadius: 44, ...rise(fadeIn(frame, 0, 18), 40) }}>
      <Img src={staticFile(`shots/${file}`)} style={{ width: w, height: h, transform: `translateY(${String(-y)}px)`, margin: 10 }} />
    </div>
  );
};

const Side: React.FC<{ v: 'DUPLICATE' | 'READY' | 'BLOCKED' | 'RISKY'; lines: string[]; at?: number }> = ({ v, lines, at = 20 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 1000, top: 300, width: 820 }}>
      <div style={rise(fadeIn(frame, at))}><VerdictChip v={v} size={44} /></div>
      {lines.map((l, i) => (
        <div key={l} style={{ ...rise(fadeIn(frame, at + 40 + i * 50)), fontFamily: F, fontSize: 40, color: '#fff', marginTop: i ? 20 : 48, lineHeight: 1.35, textShadow: '0 4px 24px rgba(0,0,0,0.35)' }}>{l}</div>
      ))}
    </div>
  );
};

export const BlockedScene: S = () => (
  <AbsoluteFill>
    <Room dim={0.08} />
    <PanelShot file="panel-TAL-56.png" height={2572} pan={[60, 240, 0, 520]} />
    <Side v="BLOCKED" lines={['TAL-56 waits on TAL-15.', 'TAL-15 waits on TAL-16.', 'Both links cited. Both real.']} />
  </AbsoluteFill>
);

export const RiskyScene: S = () => (
  <AbsoluteFill>
    <Room dim={0.08} />
    <PanelShot file="panel-TAL-65.png" height={2348} pan={[60, 220, 0, 420]} />
    <Side v="RISKY" lines={['Breaks a final decision.', 'The page is named and linked.']} />
  </AbsoluteFill>
);

export const DuplicateScene: S = () => (
  <AbsoluteFill>
    <Room dim={0.08} />
    <PanelShot file="panel-TAL-42.png" height={2572} pan={[60, 220, 0, 520]} />
    <Side v="DUPLICATE" lines={['Same work as TAL-2.', 'Acceptance criteria matched.']} />
  </AbsoluteFill>
);

const CITES: { text: string; state: 'ok' | 'bad'; at: number }[] = [
  { text: 'TAL-15 blocks this issue, and is open', state: 'ok', at: 30 },
  { text: 'TAL-16 blocks TAL-15, and is open', state: 'ok', at: 90 },
  { text: 'TAL-404 blocks this issue', state: 'bad', at: 210 },
];

export const CheckScene: S = () => {
  const frame = useCurrentFrame();
  const retry = fadeIn(frame, 320, 18);
  return (
    <AbsoluteFill>
      <Room dim={0.1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ width: 1100 }}>
          <Tile style={{ padding: 40 }}>
            <div style={{ fontSize: 26, color: theme.ink3 }}>Citation check</div>
            {CITES.map((c, i) => {
              const p = fadeIn(frame, c.at);
              const mark = fadeIn(frame, c.at + 30, 10);
              const colour = c.state === 'ok' ? theme.go : theme.stop;
              return (
                <div key={c.text} style={{ ...rise(p, 14), display: 'flex', alignItems: 'center', gap: 22, marginTop: 24, fontSize: 34 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: theme.accent, boxShadow: '0 0 14px rgba(47,143,255,0.8)' }} />
                  <span style={{ flex: 1, textDecoration: c.state === 'bad' && mark > 0.5 ? 'line-through' : undefined, color: c.state === 'bad' && mark > 0.5 ? theme.ink3 : theme.ink }}>{c.text}</span>
                  <span style={{ opacity: mark, color: colour, fontSize: 26, fontWeight: 600 }}>{c.state === 'ok' ? 'Resolved' : 'Refused: no such issue'}</span>
                </div>
              );
            })}
            <div style={{ ...rise(retry, 14), marginTop: 40, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 26, alignItems: 'center', fontSize: 28, color: theme.ink2 }}>
              <span>One retry.</span>
              <span>Still unproven?</span>
              <VerdictChip v="RISKY" size={26} />
            </div>
          </Tile>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ReceiptScene: S = () => {
  const frame = useCurrentFrame();
  const r = tal56.receipt;
  const edit = fadeIn(frame, 150, 8);
  const human = fadeIn(frame, 260, 18);
  const ok = edit < 0.5;
  return (
    <AbsoluteFill>
      <Room dim={0.1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ width: 1180, ...rise(fadeIn(frame, 0)) }}>
          <Tile style={{ padding: 44 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 26, color: theme.ink3 }}>Receipt {r.body.receiptId}</span>
              <span style={{ fontSize: 24, fontWeight: 500, color: ok ? theme.go : theme.stop, background: theme.tile2, padding: '8px 18px', borderRadius: 999 }}>{ok ? 'Verified' : 'Does not verify'}</span>
            </div>
            <div style={{ fontSize: 66, fontWeight: 600, marginTop: 16, letterSpacing: '-0.03em', color: ok ? theme.stop : theme.go }}>{ok ? 'Blocked' : 'Ready to Build'}</div>
            <div style={{ fontFamily: theme.mono, fontSize: 24, color: theme.ink2, marginTop: 22, lineHeight: 1.8 }}>
              <div>SHA-256 {r.hash.slice(0, 40)}</div>
              <div>Ed25519 {r.signature.slice(0, 40)}...</div>
            </div>
            <div style={{ ...rise(human, 12), marginTop: 30, display: 'flex', alignItems: 'center', gap: 18, background: theme.tile2, borderRadius: 999, padding: '12px 14px 12px 16px' }}>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: 'linear-gradient(140deg,#3d6fb6,#1d2c48)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>BS</span>
              <span style={{ flex: 1, fontSize: 26 }}>Brian Simiyu · Accepted · signed, bound to this verdict</span>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: theme.go, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#08240f', fontSize: 28 }}>✓</span>
            </div>
          </Tile>
        </Glass>
      </AbsoluteFill>
      {edit > 0 && frame < 250 ? <Caption text="Edited after signing." at={152} size={44} style={{ position: 'absolute', bottom: 70, width: '100%', textAlign: 'center' }} /> : null}
    </AbsoluteFill>
  );
};

export const LogScene: S = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Room dim={0.08} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...rise(fadeIn(frame, 0, 20), 40), transform: `scale(${String(0.96 + fadeIn(frame, 0, 200) * 0.04)})` }}>
          <Img src={staticFile('shots/log.png')} style={{ width: 1500 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const RESULTS: { label: string; n: number; colour: string; at: number }[] = [
  { label: 'The model, with the full context', n: 34, colour: theme.accent, at: 150 },
  { label: 'The model, with the issue text alone', n: 15, colour: '#4a4f59', at: 250 },
  { label: 'Rules on their own', n: 26, colour: theme.ink3, at: 320 },
];

export const NumbersScene: S = () => {
  const frame = useCurrentFrame();
  const extra = fadeIn(frame, 390, 18);
  return (
    <AbsoluteFill>
      <Room dim={0.12} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Glass style={{ width: 1400 }}>
          <Tile style={{ padding: 48 }}>
            <div style={{ fontSize: 28, color: theme.ink3 }}>40 issues with known answers, run through the deployed app</div>
            {RESULTS.map((r, i) => {
              const at = r.at;
              const g = fadeIn(frame, at, 40);
              return (
                <div key={r.label} style={{ marginTop: 34, ...rise(fadeIn(frame, at - 10), 12) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30 }}>
                    <span>{r.label}</span>
                    <span style={{ fontWeight: 600 }}>{Math.round(r.n * g)} of 40</span>
                  </div>
                  <div style={{ height: 18, background: theme.tile3, borderRadius: 9, marginTop: 12 }}>
                    <div style={{ width: `${String((r.n / 40) * 100 * g)}%`, height: '100%', borderRadius: 9, background: r.colour, boxShadow: i === 0 ? '0 0 18px rgba(47,143,255,0.7)' : undefined }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 20, marginTop: 44, ...rise(extra, 12) }}>
              {[['96 of 96', 'citations checked out'], ['0', 'false duplicates']].map(([b, s]) => (
                <div key={s} style={{ flex: 1, background: theme.tile2, borderRadius: 20, padding: '22px 28px' }}>
                  <div style={{ fontSize: 52, fontWeight: 500 }}>{b}</div>
                  <div style={{ fontSize: 22, color: theme.ink3 }}>{s}</div>
                </div>
              ))}
            </div>
          </Tile>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const WhereScene: S = () => {
  const frame = useCurrentFrame();
  const tiles: [string, string][] = [
    ['Rovo chat', '"Give this issue a verdict"'],
    ['Issue panel', 'Run Verdict'],
    ['A label', 'verdict'],
  ];
  return (
    <AbsoluteFill>
      <Room dim={0.1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <div style={{ display: 'flex', gap: 28 }}>
          {tiles.map(([h, s], i) => (
            <div key={h} style={rise(fadeIn(frame, 10 + i * 40))}>
              <Glass>
                <Tile style={{ width: 440, padding: 34 }}>
                  <div style={{ fontSize: 24, color: theme.ink3 }}>{h}</div>
                  <div style={{ fontSize: 36, fontWeight: 500, marginTop: 12, color: i === 1 ? theme.accent : theme.ink }}>{s}</div>
                </Tile>
              </Glass>
            </div>
          ))}
        </div>
        <Caption text="Built on Forge. Runs on Atlassian." at={190} size={46} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CloseScene: S = () => {
  const frame = useCurrentFrame();
  const p = usePop(4, 16);
  return (
    <AbsoluteFill>
      <Room dim={0.16} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ opacity: p, transform: `scale(${String(0.94 + p * 0.06)})` }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Orb size={120} /></div>
          <div style={{ fontFamily: F, fontSize: 96, fontWeight: 600, color: '#fff', letterSpacing: '-0.035em', marginTop: 18 }}>Verdict for Jira</div>
          <div style={{ fontFamily: F, fontSize: 40, color: '#eef2f7', marginTop: 14, opacity: fadeIn(frame, 40) }}>Know what you are building, before you build it.</div>
          <div style={{ fontFamily: F, fontSize: 26, color: '#dfe5ec', marginTop: 40, opacity: fadeIn(frame, 80) }}>github.com/asiyetajwa/verdict-for-jira</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// TAL-42's receipt is imported so the duplicate scene's numbers stay tied to the captured run.
export const DUPLICATE_RECEIPT = tal42.receipt.body.receiptId;
