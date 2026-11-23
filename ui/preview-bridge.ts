// Stand-in for @forge/bridge in the local preview build only. It runs the real core on the seeded project (rules
// decider, real Ed25519 signatures), so the preview shows genuine output, never invented numbers.
import { decide, rulesDecider } from '../src/core/engine';
import { generateKeys, importKeys, signOutcome, verifyChain, verifyReceipt, type SignedReceipt } from '../src/core/receipt';
import { bodyFor } from '../src/core/run';
import { seedContext } from '../seed/context';

const issue = new URLSearchParams(location.search).get('issue') ?? 'TAL-56';
let keysP: ReturnType<typeof make> | null = null;
async function make() {
  const k = await generateKeys();
  return { ...(await importKeys(k.pkcs8, k.publicRaw)), publicRaw: k.publicRaw };
}
const keys = () => (keysP ??= make());

let latest: SignedReceipt | null = null;
let view: unknown[] = [];

async function runOn(key: string, prev: string | null) {
  const ctx = seedContext(key);
  const d = await decide(ctx, rulesDecider);
  const { signVerdict } = await import('../src/core/receipt');
  const r = await signVerdict(bodyFor(ctx, d, 'rules (local preview)', prev), await keys());
  const cites = d.proposal.evidence.map((e) => {
    const o = ctx.objects[`${e.cite.kind}:${e.cite.id}`];
    return { key: `${e.cite.kind}:${e.cite.id}`, kind: e.cite.kind, id: e.cite.id, label: o?.title ?? e.cite.id, status: o?.kind === 'issue' ? o.status : undefined, asserts: e.asserts, claim: e.claim };
  });
  return { r, cites, title: ctx.subject.title };
}

async function state() {
  if (!latest) return { issueKey: issue, receipt: null };
  return { issueKey: issue, receipt: latest, check: await verifyReceipt(latest), cites: view, subjectTitle: seedContext(issue).subject.title };
}

// A fixture captured from the live site (the film uses real receipts): window.__VERDICT_FIXTURE__ = { state?, log? }.
const fixture = (globalThis as { __VERDICT_FIXTURE__?: { state?: unknown; log?: unknown } }).__VERDICT_FIXTURE__;

export async function invoke<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  if (fixture && name === 'getState' && fixture.state) return fixture.state as T;
  if (fixture && name === 'getLog' && fixture.log) return fixture.log as T;
  if (name === 'getState') {
    if (new URLSearchParams(location.search).has('ran')) {
      const x = await runOn(issue, null);
      latest = x.r;
      view = x.cites;
      if (new URLSearchParams(location.search).has('accepted')) latest = await signOutcome(latest, 'accepted', 'Brian W', await keys());
    }
    return (await state()) as T;
  }
  if (name === 'run') {
    const x = await runOn(issue, null);
    latest = x.r;
    view = x.cites;
    return { ok: true, state: await state() } as T;
  }
  if (name === 'recordOutcome') {
    if (latest) latest = await signOutcome(latest, payload?.outcome as 'accepted' | 'rejected', 'Brian W', await keys());
    return { ok: true, state: await state() } as T;
  }
  if (name === 'getLog') {
    const keysList = ['TAL-51', 'TAL-75', 'TAL-62', 'TAL-56', 'TAL-77', 'TAL-68', 'TAL-73', 'TAL-79'];
    const chain: SignedReceipt[] = [];
    for (const k of keysList) {
      let r = (await runOn(k, chain.at(-1)?.hash ?? null)).r;
      if (k !== 'TAL-79' && k !== 'TAL-68') r = await signOutcome(r, k === 'TAL-73' ? 'rejected' : 'accepted', 'Brian W', await keys());
      chain.push(r);
    }
    return { project: 'TAL', check: await verifyChain(chain), publicKey: (await keys()).publicRaw, receipts: chain.slice().reverse() } as T;
  }
  throw new Error(`unknown resolver ${name}`);
}

export const router = { open: async (_u: string) => undefined, navigate: async (_u: string) => undefined };
