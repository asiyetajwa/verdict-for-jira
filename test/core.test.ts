import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCitations } from '../src/core/citations';
import { commentText } from '../src/core/comment';
import { decide, rulesDecider, type Decider } from '../src/core/engine';
import { computeFloor, hasAcceptanceCriteria } from '../src/core/floor';
import { parseProposal } from '../src/core/prompt';
import { generateKeys, importKeys, signOutcome, signVerdict, verifyChain, verifyReceipt, type VerdictBody } from '../src/core/receipt';
import { Index } from '../src/core/similarity';
import { seedContext } from '../seed/context';
import { runEval } from '../seed/eval';

test('acceptance criteria are recognised as a list or Given/When/Then', () => {
  assert.equal(hasAcceptanceCriteria('Do it.\n\nAcceptance criteria:\n- one\n- two'), true);
  assert.equal(hasAcceptanceCriteria('Given a user\nWhen they log in\nThen they see invoices'), true);
  assert.equal(hasAcceptanceCriteria('Acceptance criteria: to be decided'), false);
  assert.equal(hasAcceptanceCriteria('Just make it faster.'), false);
});

test('similarity ranks a reworded duplicate above unrelated work', () => {
  const ix = new Index([
    { id: 'A', text: 'Send automatic payment reminder emails for overdue invoices' },
    { id: 'B', text: 'Email customers a reminder when an invoice is overdue' },
    { id: 'C', text: 'Dark mode for the dashboard' },
  ]);
  const hits = ix.similar('B');
  assert.equal(hits[0]?.id, 'A');
  assert.ok(!hits.some((h) => h.id === 'C' && h.score > (hits[0]?.score ?? 0)));
});

test('an open blocker allows only Blocked, and a two-deep chain is found', () => {
  const f = computeFloor(seedContext('TAL-56'));
  assert.deepEqual(f.allowed, ['BLOCKED']);
  assert.ok(f.facts.some((x) => x.code === 'blocker-chain'));
});

test('a done blocker does not block', () => {
  const f = computeFloor(seedContext('TAL-77'));
  assert.equal(f.openBlockers.length, 0);
  assert.ok(!f.allowed.includes('BLOCKED'));
});

test('the citation check refuses Ready while a blocker is open, and an invented key', async () => {
  const ctx = seedContext('TAL-51');
  const floor = computeFloor(ctx);
  const ready = await checkCitations(ctx, floor, { verdict: 'READY', why: 'Fine.', evidence: [{ claim: 'ok', cite: { kind: 'issue', id: 'TAL-51' }, asserts: 'mentioned' }], wouldChange: [] });
  assert.equal(ready.ok, false);
  const invented = await checkCitations(ctx, floor, { verdict: 'BLOCKED', why: 'Blocked by TAL-999.', evidence: [{ claim: 'blocked', cite: { kind: 'issue', id: 'TAL-999' }, asserts: 'blocker' }], wouldChange: [] });
  assert.equal(invented.ok, false);
  assert.ok(invented.failures.some((m) => m.includes('TAL-999')));
});

test('the citation check refuses a false assertion about a real object', async () => {
  const ctx = seedContext('TAL-73'); // blocked by TAL-22, which is done
  const floor = computeFloor(ctx);
  const r = await checkCitations(ctx, floor, { verdict: 'RISKY', why: 'TAL-22 is still open.', evidence: [{ claim: 'still open', cite: { kind: 'issue', id: 'TAL-22' }, asserts: 'open' }], wouldChange: [] });
  assert.equal(r.ok, false);
});

test('a decider that keeps inventing evidence falls back to Risky after one retry', async () => {
  let calls = 0;
  const liar: Decider = async () => {
    calls++;
    return { verdict: 'DUPLICATE', why: 'Same as TAL-404.', evidence: [{ claim: 'dup', cite: { kind: 'issue', id: 'TAL-404' }, asserts: 'duplicate' }], wouldChange: [] };
  };
  const d = await decide(seedContext('TAL-75'), liar);
  assert.equal(calls, 2);
  assert.equal(d.fellBack, true);
  assert.equal(d.proposal.verdict, 'RISKY');
  assert.equal(d.check.ok, true);
});

test('a decider that corrects itself on feedback passes on the second attempt', async () => {
  const fixer: Decider = async (ctx, floor, feedback) => (feedback.length ? rulesDecider(ctx, floor, feedback) : { verdict: 'READY', why: 'x', evidence: [], wouldChange: [] });
  const d = await decide(seedContext('TAL-52'), fixer);
  assert.equal(d.attempts, 2);
  assert.equal(d.fellBack, false);
  assert.equal(d.proposal.verdict, 'BLOCKED');
});

test('model output is parsed from JSON wrapped in prose or code fences', () => {
  const p = parseProposal('Here it is:\n```json\n{"verdict":"READY","why":"ok","evidence":[{"claim":"c","cite":{"kind":"issue","id":"TAL-75"},"asserts":"mentioned"}],"wouldChange":["x"]}\n```');
  assert.equal(p.verdict, 'READY');
  assert.equal(p.evidence[0]?.cite.id, 'TAL-75');
});

const body = (prevHash: string | null, issue = 'TAL-51'): VerdictBody => ({
  product: 'Verdict for Jira', receiptId: `VRD-R-${issue}`, issue, issuedAt: '2026-11-23T10:00:00.000Z', verdict: 'BLOCKED', why: 'Waiting on TAL-11.',
  evidence: [{ claim: 'Blocked by', cite: 'issue:TAL-11', asserts: 'blocker' }], wouldChange: ['Resolve TAL-11.'],
  context: { consulted: ['issue:TAL-11'], counts: { jira: 1, graph: 0, similarity: 3 }, graphUnavailable: false },
  citationCheck: { checked: 1, resolved: 1, attempts: 1 }, decidedBy: 'rules', prevHash,
});

test('a receipt verifies, and any edit to it is caught', async () => {
  const k = await generateKeys();
  const keys = await importKeys(k.pkcs8, k.publicRaw);
  const r = await signVerdict(body(null), keys);
  assert.equal((await verifyReceipt(r)).valid, true);
  const edited = { ...r, body: { ...r.body, verdict: 'READY' } };
  assert.equal((await verifyReceipt(edited)).valid, false);
});

test('the human outcome is signed separately and bound to the verdict', async () => {
  const k = await generateKeys();
  const keys = await importKeys(k.pkcs8, k.publicRaw);
  const r = await signOutcome(await signVerdict(body(null), keys), 'accepted', 'Brian', keys);
  assert.equal((await verifyReceipt(r)).valid, true);
  const flipped = { ...r, outcome: r.outcome && { ...r.outcome, body: { ...r.outcome.body, outcome: 'rejected' as const } } };
  assert.equal((await verifyReceipt(flipped)).valid, false);
});

test('the Verdict Log chain breaks when an entry is removed', async () => {
  const k = await generateKeys();
  const keys = await importKeys(k.pkcs8, k.publicRaw);
  const a = await signVerdict(body(null, 'TAL-51'), keys);
  const b = await signVerdict(body(a.hash, 'TAL-52'), keys);
  const c = await signVerdict(body(b.hash, 'TAL-53'), keys);
  assert.equal((await verifyChain([a, b, c])).valid, true);
  assert.equal((await verifyChain([a, c])).valid, false);
});

test('the comment carries the verdict, evidence and receipt, with no em dashes', async () => {
  const k = await generateKeys();
  const keys = await importKeys(k.pkcs8, k.publicRaw);
  const d = await decide(seedContext('TAL-51'), rulesDecider);
  const r = await signVerdict(body(null), keys);
  const t = commentText(d.proposal, r, (kind, id) => ({ label: `${kind} ${id}` }));
  assert.match(t, /Blocked/);
  assert.match(t, /SHA-256/);
  assert.ok(!t.includes(String.fromCharCode(0x2014)));
});

test('rules baseline: graph context beats issue text alone, and every citation resolves', async () => {
  const full = await runEval('full', rulesDecider, 'full');
  const text = await runEval('text', rulesDecider, 'text');
  assert.equal(full.perClass.BLOCKED.correct, 10);
  assert.ok(full.accuracy > text.accuracy);
  assert.equal(full.citationResolution, 1);
  assert.ok(full.rows.every((r) => !r.fellBack));
});
