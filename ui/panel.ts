// Issue panel: the latest verdict on this issue, its evidence route, the receipt and its live verification, and the
// human Accept or Reject that is signed onto it.
import { call, copyText, h, ICON, initials, LABEL, link, when } from './common';
import { route } from './route';

type Cite = { key: string; kind: string; id: string; label: string; url?: string; status?: string; asserts: string; claim: string };
type Receipt = {
  body: { receiptId: string; issue: string; issuedAt: string; verdict: string; why: string; wouldChange: string[]; decidedBy: string; context: { consulted: string[]; counts: { jira: number; graph: number; similarity: number }; graphUnavailable: boolean }; citationCheck: { checked: number; resolved: number; attempts: number } };
  hash: string;
  signature: string;
  publicKey: string;
  outcome?: { body: { outcome: 'accepted' | 'rejected'; by: string; at: string; note?: string } };
};
type Job = { state: 'queued' | 'running' | 'done' | 'failed'; at: string; error?: string; receiptHash?: string };
type State = { issueKey: string; job?: Job | null; receipt: Receipt | null; check?: { valid: boolean; reason: string }; cites?: Cite[]; subjectTitle?: string };

const root = document.getElementById('root') as HTMLElement;
let busy = false;

function header(state: State): HTMLElement {
  const ok = state.check?.valid;
  return h('div', { class: 'row between', style: 'padding:6px 8px 12px' },
    h('div', { class: 'row' }, h('div', { class: 'dots' }, h('i'), h('i'), h('i')), h('h1', {}, 'Verdict')),
    state.receipt ? h('span', { class: `pill ${ok ? 'ok' : 'bad'}`, title: state.check?.reason ?? '' }, ok ? 'Receipt verified' : 'Receipt does not verify') : null);
}

function runButton(label: string): HTMLButtonElement {
  return h('button', { class: 'btn primary', onclick: () => void run() }, label);
}

function empty(state: State): HTMLElement {
  return h('div', { class: 'glass' }, header(state),
    h('div', { class: 'tile empty' },
      h('div', { class: 'faint' }, state.issueKey),
      h('div', { class: 'verdict-word muted', style: 'font-size:26px' }, 'No verdict yet'),
      h('p', { class: 'muted' }, 'Verdict reads this issue, its links, linked pages and pull requests, and similar issues, then makes one call with every reason cited and checked.'),
      runButton('Run Verdict'),
      h('p', { class: 'faint', style: 'margin-top:12px' }, 'Or ask the Verdict agent in Rovo chat, or add the label "verdict".')));
}

function view(state: State): HTMLElement {
  const r = state.receipt;
  if (!r) return empty(state);
  const b = r.body;
  const cites = state.cites ?? [];
  const counts = b.context.counts;

  const top = h('div', { class: 'tile' },
    h('div', { class: 'row between' }, h('span', { class: 'faint' }, `${b.issue} · ${when(b.issuedAt)}`), h('span', { class: 'faint' }, `#${b.receiptId}`)),
    h('div', { class: `verdict-word v-${b.verdict}` }, LABEL[b.verdict] ?? b.verdict),
    h('p', { style: 'margin:0 0 14px;line-height:1.55' }, b.why),
    h('div', { class: 'grid2', style: 'grid-template-columns:repeat(3,1fr)' },
      h('div', { class: 'stat' }, h('b', {}, String(b.context.consulted.length)), h('span', {}, 'Objects read')),
      h('div', { class: 'stat' }, h('b', {}, `${String(b.citationCheck.resolved)}/${String(b.citationCheck.checked)}`), h('span', {}, 'Citations resolved')),
      h('div', { class: 'stat' }, h('b', {}, String(counts.similarity)), h('span', {}, 'Similar issues'))));

  const map = h('div', { class: 'tile', style: 'padding:8px' }, route(b.issue, state.subjectTitle ?? b.issue, cites.map((c) => ({ id: c.kind === 'issue' ? c.id : c.kind === 'pr' ? `PR ${c.id}` : 'Page', label: c.label, status: c.status, asserts: c.asserts }))));

  const evidence = h('div', { class: 'tile' }, h('h2', {}, 'Evidence'),
    ...cites.map((c) => h('div', { class: 'cite' }, h('span', { class: 'pin' }), h('div', {}, h('span', { class: 'claim' }, `${c.claim} `), link(c.kind === 'issue' ? `${c.id} ${c.label}` : c.label, c.url)))));

  const change = h('div', { class: 'tile' }, h('h2', {}, 'What would change this call'), h('ul', { class: 'plain' }, ...b.wouldChange.map((w) => h('li', {}, w))));

  const copyBtn = h('button', { class: 'btn', onclick: async () => { copyBtn.textContent = (await copyText(JSON.stringify(r, null, 2))) ? 'Copied' : 'Copy failed'; } }, 'Copy Receipt');
  const receipt = h('div', { class: 'tile' }, h('h2', {}, 'Receipt'),
    h('div', { class: 'faint', style: 'line-height:1.9' },
      h('div', {}, 'SHA-256 ', h('span', { class: 'mono' }, r.hash.slice(0, 32))),
      h('div', {}, 'Ed25519 ', h('span', { class: 'mono' }, `${r.signature.slice(0, 32)}...`)),
      h('div', {}, `Decided by ${b.decidedBy}; ${String(b.citationCheck.attempts)} attempt${b.citationCheck.attempts === 1 ? '' : 's'}`),
      h('div', {}, `Read ${String(counts.jira)} from Jira, ${String(counts.graph)} from the Teamwork Graph${b.context.graphUnavailable ? ' (graph not reachable on this run)' : ''}`),
      h('div', {}, state.check?.reason ?? '')),
    h('div', { class: 'row', style: 'margin-top:12px' }, copyBtn, runButton('Run Again')));

  const outcome = r.outcome
    ? h('div', { class: 'person' }, h('span', { class: 'avatar' }, initials(r.outcome.body.by)), h('div', { style: 'flex:1' }, h('div', {}, r.outcome.body.by), h('div', { class: 'faint' }, `${r.outcome.body.outcome === 'accepted' ? 'Accepted' : 'Rejected'} · ${when(r.outcome.body.at)} · signed`)), h('span', { class: `btn round ${r.outcome.body.outcome === 'accepted' ? 'go' : ''}` }, r.outcome.body.outcome === 'accepted' ? ICON.check() : ICON.cross()))
    : h('div', { class: 'person' }, h('span', { class: 'avatar' }, 'You'), h('div', { style: 'flex:1' }, h('div', {}, 'Your call'), h('div', { class: 'faint' }, 'Recorded and signed onto this receipt')),
      h('button', { class: 'btn round', title: 'Reject', 'aria-label': 'Reject', onclick: () => void record('rejected') }, ICON.cross()),
      h('button', { class: 'btn round go', title: 'Accept', 'aria-label': 'Accept', onclick: () => void record('accepted') }, ICON.check()));

  return h('div', { class: 'glass' }, header(state), top, map, evidence, change, receipt, h('div', { class: 'tile', style: 'padding:8px' }, outcome));
}

function render(state: State, error?: string) {
  root.replaceChildren(view(state));
  if (error) root.append(h('p', { class: 'err' }, error));
}

let current: State = { issueKey: '', receipt: null };

const pending = (st: State) => st.job?.state === 'queued' || st.job?.state === 'running';

function showWorking() {
  root.querySelectorAll('button.primary').forEach((b) => {
    (b as HTMLButtonElement).disabled = true;
    b.replaceChildren(h('span', { class: 'spin' }), current.job?.state === 'running' ? ' Reading the issue and its links' : ' Queued');
  });
}

async function poll() {
  const started = Date.now();
  while (Date.now() - started < 240000) {
    await new Promise((r) => setTimeout(r, 3000));
    current = await call<State>('getState');
    if (!pending(current)) break;
    render(current);
    showWorking();
  }
  busy = false;
  render(current, current.job?.state === 'failed' ? `Verdict could not finish: ${current.job.error ?? 'unknown error'}` : undefined);
}

async function run() {
  if (busy) return;
  busy = true;
  showWorking();
  const res = await call<{ ok: boolean; state?: State; error?: string }>('run');
  if (!res.ok) {
    busy = false;
    render(current, res.error);
    return;
  }
  if (res.state) current = res.state;
  showWorking();
  await poll();
}

async function record(outcome: 'accepted' | 'rejected') {
  const res = await call<{ ok: boolean; state?: State; error?: string }>('recordOutcome', { outcome });
  if (res.ok && res.state) current = res.state;
  render(current, res.ok ? undefined : res.error);
}

async function main() {
  root.replaceChildren(h('div', { class: 'glass' }, h('div', { class: 'tile empty' }, h('span', { class: 'spin' }))));
  current = await call<State>('getState');
  render(current);
  if (pending(current)) {
    busy = true;
    showWorking();
    await poll();
  }
}
void main();
