// The evidence floor: facts computed from the context in code, before any model is involved. The floor says which
// verdicts the facts allow and gives the citations that support each fact. A proposal that contradicts the floor is
// refused, so the model can add judgement (a contradicting decision page, a duplicate worded differently) but can
// never call an issue Ready while it has an open blocker, or invent a blocker that is not there.

import type { Context, IssueObject, Ref, VerdictKind } from './types';
import { refKey } from './types';

export const DUPLICATE_AT = 0.42; // cosine similarity at or above which a match counts as a likely duplicate
export const NEAR_DUPLICATE_AT = 0.25; // partial overlap: cited as a risk, never forced to Duplicate
// Both thresholds were set on the seeded demo project, so the rules-only numbers there are a best case for rules.

export type Fact = { code: string; text: string; cites: Ref[] };

export type Floor = {
  facts: Fact[];
  /** Verdicts the facts allow. */
  allowed: VerdictKind[];
  /** The verdict from the facts alone (the rules-only baseline in the evaluation). */
  rulesVerdict: VerdictKind;
  openBlockers: Ref[];
  duplicateOf: Ref | null;
};

const issueRef = (id: string): Ref => ({ kind: 'issue', id });

/** Acceptance criteria: a heading or label followed by at least one item, or Given/When/Then lines. */
export function hasAcceptanceCriteria(description: string): boolean {
  const d = description.replace(/\r/g, '');
  const m = /(acceptance criteria|definition of done|\bac\b)\s*:?\s*\n((?:\s*(?:[-*•]|\d+[.)])\s+\S.*\n?)+)/i.exec(d);
  if (m) return true;
  return /\bgiven\b[^\n]+\n\s*\bwhen\b[^\n]+\n\s*\bthen\b/i.test(d);
}

function openBlockersOf(ctx: Context): { direct: Ref[]; chains: Ref[][] } {
  const isOpen = (id: string) => {
    const o = ctx.objects[refKey(issueRef(id))];
    return o?.kind === 'issue' && o.statusCategory !== 'done';
  };
  const blockersOf = (id: string) => ctx.edges.filter((e) => e.from === id && e.relation === 'is blocked by').map((e) => e.to);
  const direct: Ref[] = [];
  const chains: Ref[][] = [];
  for (const b of blockersOf(ctx.subject.id)) {
    if (isOpen(b)) direct.push(issueRef(b));
    for (const c of blockersOf(b)) if (isOpen(c)) chains.push([issueRef(b), issueRef(c)]);
  }
  return { direct, chains };
}

export function computeFloor(ctx: Context): Floor {
  const facts: Fact[] = [];
  const subject: IssueObject = ctx.subject;

  // 1. Blockers, including chains two deep.
  const { direct, chains } = openBlockersOf(ctx);
  for (const b of direct) {
    const o = ctx.objects[refKey(b)];
    facts.push({ code: 'open-blocker', text: `${b.id} blocks this issue and is ${o && o.kind === 'issue' ? o.status : 'open'}.`, cites: [b] });
  }
  for (const [mid, end] of chains) {
    if (!mid || !end) continue;
    facts.push({ code: 'blocker-chain', text: `${mid.id} is itself blocked by ${end.id}, which is still open.`, cites: [mid, end] });
  }
  const openBlockers = [...direct, ...chains.map((c) => c[0]).filter((r): r is Ref => Boolean(r))]
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);

  // 2. Duplicates by similarity, and explicit duplicate links.
  let duplicateOf: Ref | null = null;
  const linkedDup = ctx.edges.find((e) => e.from === subject.id && e.relation === 'duplicates');
  if (linkedDup) {
    duplicateOf = issueRef(linkedDup.to);
    facts.push({ code: 'duplicate-link', text: `This issue is linked as a duplicate of ${linkedDup.to}.`, cites: [duplicateOf] });
  }
  // Objects already linked to the issue (its blockers, the issues it blocks) are dependencies, not duplicates.
  const linked = new Set(ctx.edges.filter((e) => e.from === subject.id || e.to === subject.id).flatMap((e) => [e.from, e.to]));
  for (const hit of ctx.similar) {
    const o = ctx.objects[refKey(issueRef(hit.id))];
    if (!o || o.kind !== 'issue' || o.resolution === "Won't Do" || linked.has(hit.id)) continue;
    if (!duplicateOf && hit.score >= DUPLICATE_AT) {
      duplicateOf = issueRef(hit.id);
      facts.push({ code: 'duplicate', text: `${hit.id} covers the same work (similarity ${hit.score.toFixed(2)}; shared: ${hit.shared.slice(0, 4).join(', ')}).`, cites: [duplicateOf] });
    } else if (hit.score >= NEAR_DUPLICATE_AT && o.resolution !== 'Reverted' && (!duplicateOf || duplicateOf.id !== hit.id)) {
      // A reverted match is reported once, as a reverted precedent below, not also as an overlap.
      facts.push({ code: 'near-duplicate', text: `${hit.id} overlaps in part (similarity ${hit.score.toFixed(2)}).`, cites: [issueRef(hit.id)] });
    }
  }

  // 3. Risk signals.
  if (subject.description.trim().length < 40) {
    facts.push({ code: 'thin-description', text: 'The description is too short to build from.', cites: [issueRef(subject.id)] });
  }
  if (!hasAcceptanceCriteria(subject.description)) {
    facts.push({ code: 'no-acceptance-criteria', text: 'The issue has no acceptance criteria.', cites: [issueRef(subject.id)] });
  }
  for (const hit of ctx.similar) {
    const o = ctx.objects[refKey(issueRef(hit.id))];
    if (o?.kind === 'issue' && o.resolution === 'Reverted' && hit.score >= NEAR_DUPLICATE_AT) {
      facts.push({ code: 'reverted-precedent', text: `A similar change, ${hit.id}, was shipped and reverted.`, cites: [issueRef(hit.id)] });
    }
  }
  for (const e of ctx.edges.filter((x) => x.from === subject.id)) {
    const o = ctx.objects[`pr:${e.to}`];
    if (o?.kind === 'pr' && o.reverted) facts.push({ code: 'reverted-pr', text: `Linked pull request ${o.id} was reverted.`, cites: [{ kind: 'pr', id: o.id }] });
  }

  // 4. Which verdicts the facts allow.
  const risky = facts.some((f) => ['thin-description', 'no-acceptance-criteria', 'reverted-precedent', 'reverted-pr', 'near-duplicate'].includes(f.code));
  let allowed: VerdictKind[];
  let rulesVerdict: VerdictKind;
  if (duplicateOf) {
    allowed = ['DUPLICATE', 'RISKY'];
    rulesVerdict = 'DUPLICATE';
  } else if (openBlockers.length > 0) {
    allowed = ['BLOCKED'];
    rulesVerdict = 'BLOCKED';
  } else if (risky) {
    allowed = ['RISKY', 'DUPLICATE'];
    rulesVerdict = 'RISKY';
  } else {
    // Facts alone find nothing wrong. Judgement (a contradicting decision page, a duplicate worded differently) may
    // still move it, so every verdict except Blocked stays open; Blocked needs a real open blocker.
    allowed = ['READY', 'RISKY', 'DUPLICATE'];
    rulesVerdict = 'READY';
  }
  return { facts, allowed, rulesVerdict, openBlockers, duplicateOf };
}
