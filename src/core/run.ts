// One verdict run, platform-neutral: a checked decision becomes a signed receipt chained to the project's log. Forge
// supplies the context, the decider, the store and the poster; tests supply fakes. Nothing posts unless the citation
// check passed or the engine fell back to Risky.

import { consulted, decide, fallback, type Decider, type Decision } from './engine';
import { checkCitations, type Resolver } from './citations';
import { computeFloor } from './floor';
import { receiptId, signVerdict, type Keys, type SignedReceipt, type VerdictBody } from './receipt';
import type { Context, Proposal } from './types';
import { refKey } from './types';

export type Store = {
  /** Hash of the newest receipt in this project's log, or null for the first. */
  head(project: string): Promise<string | null>;
  append(project: string, r: SignedReceipt): Promise<void>;
};

export function bodyFor(ctx: Context, d: Pick<Decision, 'proposal' | 'check' | 'attempts'>, decidedBy: string, prevHash: string | null, now = new Date()): VerdictBody {
  return {
    product: 'Verdict for Jira',
    receiptId: receiptId(),
    issue: ctx.subject.id,
    issuedAt: now.toISOString(),
    verdict: d.proposal.verdict,
    why: d.proposal.why,
    evidence: d.proposal.evidence.map((e) => ({ claim: e.claim, cite: refKey(e.cite), asserts: e.asserts })),
    wouldChange: d.proposal.wouldChange,
    context: { consulted: consulted(ctx), counts: ctx.sources, graphUnavailable: Boolean(ctx.graphUnavailable) },
    citationCheck: { checked: d.check.checked, resolved: d.check.resolved, attempts: d.attempts },
    decidedBy,
    prevHash,
  };
}

export type RunResult = { decision: Pick<Decision, 'proposal' | 'check' | 'attempts' | 'fellBack'>; receipt: SignedReceipt };

async function seal(ctx: Context, project: string, d: RunResult['decision'], decidedBy: string, keys: Keys, store: Store): Promise<RunResult> {
  const prev = await store.head(project);
  const receipt = await signVerdict(bodyFor(ctx, d, decidedBy, prev), keys);
  await store.append(project, receipt);
  return { decision: d, receipt };
}

/** Full run with a decider that can be called twice (a direct model call, or the rules baseline). */
export async function runVerdict(ctx: Context, project: string, decider: Decider, decidedBy: string, keys: Keys, store: Store, resolve?: Resolver): Promise<RunResult> {
  const d = await decide(ctx, decider, resolve);
  return seal(ctx, project, d, d.fellBack ? `${decidedBy}, fell back to Risky` : decidedBy, keys, store);
}

export type Submission = { status: 'refused'; failures: string[]; allowed: string[] } | ({ status: 'posted' } & RunResult);

/**
 * One proposal from a caller that answers across separate calls (the Rovo agent). The first refusal is returned so
 * the agent can correct itself; on the second, the fallback is posted instead.
 */
export async function submitProposal(ctx: Context, project: string, p: Proposal, attempt: number, decidedBy: string, keys: Keys, store: Store, resolve?: Resolver): Promise<Submission> {
  const floor = computeFloor(ctx);
  const check = await checkCitations(ctx, floor, p, resolve);
  if (check.ok) return { status: 'posted', ...(await seal(ctx, project, { proposal: p, check, attempts: attempt, fellBack: false }, decidedBy, keys, store)) };
  if (attempt < 2) return { status: 'refused', failures: check.failures, allowed: floor.allowed };
  const fb = fallback(ctx, check.failures);
  const fbCheck = await checkCitations(ctx, { ...floor, allowed: ['RISKY'] }, fb, resolve);
  return { status: 'posted', ...(await seal(ctx, project, { proposal: fb, check: fbCheck, attempts: attempt, fellBack: true }, `${decidedBy}, fell back to Risky`, keys, store)) };
}
