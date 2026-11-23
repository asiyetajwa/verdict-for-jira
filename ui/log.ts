// Verdict Log (project page): every receipt in the project, newest first, the chain check across all of them, and the
// counts that matter to a team: calls by kind and how often people agreed.
import { router } from '@forge/bridge';
import { call, copyText, h, ICON, LABEL, when } from './common';

type Receipt = { body: { receiptId: string; issue: string; issuedAt: string; verdict: string; decidedBy: string; citationCheck: { checked: number; resolved: number } }; hash: string; outcome?: { body: { outcome: string; by: string } } };
type Log = { project: string; check: { valid: boolean; reason: string }; publicKey: string; receipts: Receipt[] };

const root = document.getElementById('root') as HTMLElement;

function stat(n: number | string, label: string, cls = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('b', { class: cls }, String(n)), h('span', {}, label));
}

function render(log: Log) {
  const rs = log.receipts;
  const by = (v: string) => rs.filter((r) => r.body.verdict === v).length;
  const decided = rs.filter((r) => r.outcome);
  const agreed = decided.filter((r) => r.outcome?.body.outcome === 'accepted').length;
  const cites = rs.reduce((a, r) => a + r.body.citationCheck.checked, 0);
  const resolved = rs.reduce((a, r) => a + r.body.citationCheck.resolved, 0);

  const rail = h('nav', { class: 'rail', 'aria-label': 'Verdict' }, h('span', { class: 'logo' }), h('span', { class: 'cap' }, 'Main'), h('span', { class: 'item on' }, ICON.grid()), h('span', { class: 'item' }, ICON.shield()), h('span', { class: 'item' }, ICON.key()));

  const head = h('div', { class: 'row between', style: 'padding:4px 6px 12px' },
    h('div', { class: 'row' }, h('div', { class: 'dots' }, h('i'), h('i'), h('i')), h('h1', {}, 'Verdict Log'), h('span', { class: 'badge' }, String(rs.length))),
    h('span', { class: `pill ${log.check.valid ? 'ok' : 'bad'}`, title: log.check.reason }, log.check.valid ? 'Chain unbroken' : 'Chain broken'));

  const stats = h('div', { class: 'tile' }, h('h2', {}, 'Calls'),
    h('div', { class: 'stats' },
      stat(by('READY'), 'Ready to Build', 'v-READY'), stat(by('BLOCKED'), 'Blocked', 'v-BLOCKED'), stat(by('RISKY'), 'Risky', 'v-RISKY'), stat(by('DUPLICATE'), 'Duplicate', 'v-DUPLICATE'),
      stat(decided.length ? `${String(Math.round((agreed / decided.length) * 100))}%` : 'None yet', `People agreed (${String(agreed)} of ${String(decided.length)})`),
      stat(cites ? `${String(Math.round((resolved / cites) * 100))}%` : 'None yet', 'Citations resolved')));

  const rows = rs.map((r) => h('tr', {},
    h('td', {}, h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); void router.navigate(`/browse/${r.body.issue}`); } }, r.body.issue)),
    h('td', {}, h('span', { class: `vtag v-${r.body.verdict}` }, LABEL[r.body.verdict] ?? r.body.verdict)),
    h('td', { class: 'hide-s faint' }, r.body.decidedBy),
    h('td', {}, r.outcome ? (r.outcome.body.outcome === 'accepted' ? 'Accepted' : 'Rejected') : h('span', { class: 'faint' }, 'Pending')),
    h('td', { class: 'hide-s mono faint' }, r.hash.slice(0, 12)),
    h('td', { class: 'faint' }, h('span', {}, when(r.body.issuedAt).slice(0, 10)), h('span', { class: 'hide-s' }, when(r.body.issuedAt).slice(10)))));

  const table = h('div', { class: 'tile' }, h('h2', {}, 'Receipts'),
    rs.length
      ? h('table', { class: 'log' }, h('thead', {}, h('tr', {}, h('th', {}, 'Issue'), h('th', {}, 'Verdict'), h('th', { class: 'hide-s' }, 'Decided by'), h('th', {}, 'Outcome'), h('th', { class: 'hide-s' }, 'SHA-256'), h('th', {}, 'Issued'))), h('tbody', {}, ...rows))
      : h('p', { class: 'muted' }, 'No verdicts in this project yet. Open an issue and run Verdict from its panel, or ask the Verdict agent in Rovo.'));

  const keyBtn = h('button', { class: 'btn', onclick: async () => { keyBtn.textContent = (await copyText(log.publicKey)) ? 'Copied' : 'Copy failed'; } }, 'Copy Public Key');
  const trust = h('div', { class: 'tile row between' }, h('div', {}, h('h2', { style: 'margin:0' }, 'Signing key'), h('div', { class: 'faint' }, log.check.reason), h('div', { class: 'mono faint' }, `Ed25519 ${log.publicKey.slice(0, 24)}...`)), keyBtn);

  root.replaceChildren(h('div', { class: 'glass' }, head, h('div', { class: 'shell' }, rail, h('div', {}, stats, table, trust))));
}

async function main() {
  root.replaceChildren(h('div', { class: 'glass' }, h('div', { class: 'tile empty' }, h('span', { class: 'spin' }))));
  render(await call<Log>('getLog'));
}
void main();
