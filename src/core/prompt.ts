// The instructions and context the model receives, and the parser for its answer. Shared by the Rovo agent (whose
// manifest prompt carries VERDICT_RULES) and by direct model calls from Forge functions. The model is never named.

import type { Floor } from './floor';
import type { Context, Proposal } from './types';

export const VERDICT_RULES = `You are Verdict, a triage agent for Jira. You read one issue and the context around it and make exactly one call:
- DUPLICATE: an earlier issue covers the same work. Cite the original with asserts "duplicate". If the overlap is only partial, the call is RISKY with the near-duplicate cited, never a forced DUPLICATE.
- READY: description and acceptance criteria are present, nothing linked blocks it, and no linked decision page contradicts it.
- BLOCKED: at least one linked blocker is unresolved. Cite each blocking issue with asserts "blocker".
- RISKY: building now is a gamble: missing acceptance criteria, a linked decision page that contradicts the issue (cite the page with asserts "decision"), a similar change that was reverted (asserts "reverted"), or scope with no owner. If the context is too thin to judge, the call is RISKY and the missing context is the risk.
Rules you must follow:
- Pick exactly one call from the allowed list you are given. The allowed list comes from facts checked in code; a call outside it will be refused.
- Every reason cites a real object from the context, by kind and id. Never invent an object, an issue key, a page or a pull request.
- Say in one or two plain sentences why. Then give the one or two facts that would change the call.
- Write for a busy engineer: plain English, no hedging, no em dashes.`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}...` : s);

export function contextForModel(ctx: Context, floor: Floor, feedback: string[]): string {
  const objects = Object.values(ctx.objects).map((o) => {
    if (o.kind === 'issue') return { kind: 'issue', id: o.id, title: o.title, status: o.status, done: o.statusCategory === 'done', resolution: o.resolution, description: clip(o.description, o.id === ctx.subject.id ? 2000 : 500) };
    if (o.kind === 'page') return { kind: 'page', id: o.id, title: o.title, text: clip(o.body, 1200) };
    return { kind: 'pr', id: o.id, title: o.title, state: o.state, reverted: o.reverted };
  });
  return JSON.stringify({
    subject: ctx.subject.id,
    links: ctx.edges.map((e) => `${e.from} ${e.relation} ${e.to}`),
    similar: ctx.similar.map((s) => ({ id: s.id, score: Number(s.score.toFixed(2)), shared: s.shared })),
    objects,
    checkedFacts: floor.facts.map((f) => f.text),
    allowed: floor.allowed,
    previousAttemptRefused: feedback.length ? feedback : undefined,
  });
}

export const ANSWER_SHAPE = `Answer with JSON only:
{"verdict":"DUPLICATE|READY|BLOCKED|RISKY","why":"...","evidence":[{"claim":"...","cite":{"kind":"issue|page|pr","id":"..."},"asserts":"open|done|blocker|duplicate|reverted|decision|mentioned"}],"wouldChange":["..."]}`;

export function promptFor(ctx: Context, floor: Floor, feedback: string[]): string {
  return `${VERDICT_RULES}\n\nContext:\n${contextForModel(ctx, floor, feedback)}\n\n${ANSWER_SHAPE}`;
}

export function parseProposal(text: string): Proposal {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the answer');
  return JSON.parse(text.slice(start, end + 1)) as Proposal;
}
