// The citation check: the gate between a proposal and the issue. Every citation must resolve to a real object in
// the gathered context, what it asserts about that object must be true, and the verdict must be one the evidence
// floor allows. A proposal that fails is not posted.

import type { Floor } from './floor';
import type { Context, Evidence, Proposal } from './types';
import { VERDICT_LABEL, refKey } from './types';

export type CitationResult = {
  ok: boolean;
  checked: number;
  resolved: number;
  failures: string[];
};

/** Live existence check, supplied by the caller (Jira and Confluence REST in Forge; the seed set in evaluation). */
export type Resolver = (e: Evidence) => Promise<boolean>;

const KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

function assertionHolds(ctx: Context, e: Evidence): string | null {
  const o = ctx.objects[refKey(e.cite)];
  if (!o) return `${e.cite.id} is not among the objects Verdict read for this issue.`;
  const subject = ctx.subject.id;
  switch (e.asserts) {
    case 'open':
      return o.kind === 'issue' && o.statusCategory === 'done' ? `${o.id} is done, not open.` : null;
    case 'done':
      return o.kind === 'issue' && o.statusCategory !== 'done' ? `${o.id} is ${o.status}, not done.` : null;
    case 'blocker': {
      const linked = ctx.edges.some((x) => x.relation === 'is blocked by' && x.to === o.id && (x.from === subject || ctx.edges.some((y) => y.from === subject && y.relation === 'is blocked by' && y.to === x.from)));
      if (!linked) return `${o.id} is not linked as blocking this issue.`;
      return o.kind === 'issue' && o.statusCategory === 'done' ? `${o.id} is a blocker but it is already done.` : null;
    }
    case 'duplicate':
      if (o.kind !== 'issue') return `${o.id} is not an issue, so it cannot be the original.`;
      return o.id === subject ? 'An issue cannot duplicate itself.' : null;
    case 'reverted':
      if (o.kind === 'issue') return o.resolution === 'Reverted' ? null : `${o.id} was not reverted.`;
      if (o.kind === 'pr') return o.reverted ? null : `Pull request ${o.id} was not reverted.`;
      return `${o.id} is a page, which cannot be reverted.`;
    case 'decision':
      return o.kind === 'page' ? null : `${o.id} is not a page.`;
    case 'mentioned':
      return null;
  }
}

export async function checkCitations(ctx: Context, floor: Floor, p: Proposal, resolve?: Resolver): Promise<CitationResult> {
  const failures: string[] = [];
  if (!floor.allowed.includes(p.verdict)) {
    failures.push(`${VERDICT_LABEL[p.verdict]} is not supported by the evidence: ${floor.facts.map((f) => f.text).join(' ') || 'no facts allow it.'}`);
  }
  if (p.evidence.length === 0) failures.push('The verdict cites no evidence.');
  if (p.verdict === 'BLOCKED' && !p.evidence.some((e) => e.asserts === 'blocker')) failures.push('A Blocked verdict must cite the blocking object.');
  if (p.verdict === 'DUPLICATE' && !p.evidence.some((e) => e.asserts === 'duplicate')) failures.push('A Duplicate verdict must cite the original issue.');
  if (p.verdict === 'READY' && floor.openBlockers.length > 0) failures.push('The issue has an open blocker, so it is not ready.');

  let resolved = 0;
  for (const e of p.evidence) {
    const problem = assertionHolds(ctx, e);
    const live = problem === null && resolve ? await resolve(e) : problem === null;
    if (problem) failures.push(problem);
    else if (!live) failures.push(`${e.cite.id} could not be opened just now.`);
    else resolved++;
  }

  // No uncited objects: every issue key the wording mentions must be an object Verdict actually read.
  const known = new Set(Object.values(ctx.objects).filter((o) => o.kind === 'issue').map((o) => o.id));
  const text = [p.why, ...p.wouldChange, ...p.evidence.map((e) => e.claim)].join(' ');
  for (const k of new Set(text.match(KEY) ?? [])) {
    if (!known.has(k)) failures.push(`The wording mentions ${k}, which Verdict did not read.`);
  }
  return { ok: failures.length === 0, checked: p.evidence.length, resolved, failures };
}
