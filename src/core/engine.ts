// The verdict engine: context in, checked proposal out. A decider (the model through Forge, or the rules baseline)
// proposes; the citation check gates it; one retry with the failures fed back; if it still fails, the verdict that
// posts is Risky with the unverifiable evidence named, as the spec requires. Nothing here talks to Atlassian.

import { checkCitations, type CitationResult, type Resolver } from './citations';
import { computeFloor, type Floor } from './floor';
import type { Context, Evidence, Proposal } from './types';
import { VERDICTS, refKey } from './types';

export type Decider = (ctx: Context, floor: Floor, feedback: string[]) => Promise<Proposal>;

export type Decision = { proposal: Proposal; floor: Floor; check: CitationResult; attempts: number; fellBack: boolean };

/** The rules baseline: a verdict built from the evidence floor alone, with no model. */
export const rulesDecider: Decider = async (ctx, floor) => {
  const ev: Evidence[] = [];
  const title = (id: string) => {
    const o = ctx.objects[`issue:${id}`];
    return o && o.kind === 'issue' ? o.title : id;
  };
  switch (floor.rulesVerdict) {
    case 'DUPLICATE': {
      const d = floor.duplicateOf;
      if (d) ev.push({ claim: `The same work is already tracked in`, cite: d, asserts: 'duplicate' });
      return { verdict: 'DUPLICATE', why: `This repeats ${d ? `${d.id}, "${title(d.id)}"` : 'an earlier issue'}.`, evidence: ev, wouldChange: ['Show what this issue covers that the original does not, or close one of the two.'] };
    }
    case 'BLOCKED': {
      for (const b of floor.openBlockers) ev.push({ claim: 'Blocked by an open issue:', cite: b, asserts: 'blocker' });
      return { verdict: 'BLOCKED', why: `It cannot start until ${floor.openBlockers.map((b) => b.id).join(' and ')} ${floor.openBlockers.length > 1 ? 'are' : 'is'} done.`, evidence: ev, wouldChange: floor.openBlockers.map((b) => `Resolve ${b.id}, or remove the link if it no longer blocks this work.`) };
    }
    case 'RISKY': {
      for (const f of floor.facts) for (const c of f.cites) ev.push({ claim: f.text, cite: c, asserts: f.code.startsWith('reverted') ? 'reverted' : 'mentioned' });
      const changes: string[] = [];
      if (floor.facts.some((f) => f.code === 'no-acceptance-criteria')) changes.push('Add acceptance criteria.');
      if (floor.facts.some((f) => f.code === 'thin-description')) changes.push('Describe the change and who it is for.');
      if (floor.facts.some((f) => f.code.startsWith('reverted'))) changes.push('Say what is different from the change that was reverted.');
      if (floor.facts.some((f) => f.code === 'near-duplicate')) changes.push('Confirm the overlap with the related issue is intended.');
      return { verdict: 'RISKY', why: floor.facts.map((f) => f.text).join(' '), evidence: ev, wouldChange: changes.length ? changes : ['Name the missing context.'] };
    }
    case 'READY':
      return { verdict: 'READY', why: 'It has a description and acceptance criteria, and nothing linked to it blocks or contradicts it.', evidence: [{ claim: 'Description and acceptance criteria are present in', cite: { kind: 'issue', id: ctx.subject.id }, asserts: 'mentioned' }], wouldChange: ['A new blocker, or a decision that contradicts it.'] };
  }
};

/** Builds the fallback when two proposals fail the check: Risky, naming what could not be verified. */
function fallback(ctx: Context, failures: string[]): Proposal {
  // The failures may quote keys the decider invented; the fallback must not repeat them as if they were real.
  const known = new Set(Object.values(ctx.objects).map((o) => o.id));
  const safe = failures.slice(0, 3).map((f) => f.replace(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g, (k) => (known.has(k) ? k : 'an issue Verdict could not find')));
  return {
    verdict: 'RISKY',
    why: `Verdict could not verify its own evidence, so it will not make a stronger call. ${safe.join(' ')}`,
    evidence: [{ claim: 'Verdict could not confirm the evidence it gathered for', cite: { kind: 'issue', id: ctx.subject.id }, asserts: 'mentioned' }],
    wouldChange: ['Fix or remove the links Verdict could not verify, then assign it again.'],
  };
}

export async function decide(ctx: Context, decider: Decider, resolve?: Resolver): Promise<Decision> {
  const floor = computeFloor(ctx);
  let feedback: string[] = [];
  let last: CitationResult = { ok: false, checked: 0, resolved: 0, failures: [] };
  for (let attempt = 1; attempt <= 2; attempt++) {
    let p: Proposal;
    try {
      p = sanitize(await decider(ctx, floor, feedback));
    } catch (e) {
      feedback = [`The proposal could not be read: ${e instanceof Error ? e.message : String(e)}`];
      continue;
    }
    last = await checkCitations(ctx, floor, p, resolve);
    if (last.ok) return { proposal: p, floor, check: last, attempts: attempt, fellBack: false };
    feedback = last.failures;
  }
  const p = fallback(ctx, feedback);
  const check = await checkCitations(ctx, { ...floor, allowed: ['RISKY'] }, p, resolve);
  return { proposal: p, floor, check, attempts: 2, fellBack: true };
}

/** Drops malformed parts of a proposal (unknown verdicts, citations of unknown kinds) before it is checked. */
function sanitize(p: Proposal): Proposal {
  if (!VERDICTS.includes(p.verdict)) throw new Error(`unknown verdict ${String(p.verdict)}`);
  return {
    verdict: p.verdict,
    why: String(p.why ?? '').trim(),
    evidence: (p.evidence ?? []).filter((e) => e?.cite && ['issue', 'page', 'pr'].includes(e.cite.kind) && e.cite.id).map((e) => ({ claim: String(e.claim ?? '').trim(), cite: { kind: e.cite.kind, id: String(e.cite.id) }, asserts: e.asserts ?? 'mentioned' })),
    wouldChange: (p.wouldChange ?? []).map(String).filter(Boolean).slice(0, 3),
  };
}

/** The object list a receipt records as consulted. */
export const consulted = (ctx: Context): string[] => Object.keys(ctx.objects).sort().concat([]).filter((k) => k !== refKey({ kind: 'issue', id: ctx.subject.id }));
