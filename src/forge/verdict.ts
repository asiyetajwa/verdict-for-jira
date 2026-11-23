// The Forge side of one verdict: gather, decide or check, sign, post, store. Shared by the Rovo actions, the panel's
// Run button and the label trigger.

import { kvs } from '@forge/kvs';
import type { Resolver } from '../core/citations';
import { commentAdf, citeLabel, type CiteInfo } from '../core/comment';
import { computeFloor } from '../core/floor';
import { promptFor } from '../core/prompt';
import { runVerdict, submitProposal, type RunResult } from '../core/run';
import type { Context, Proposal } from '../core/types';
import { VERDICT_LABEL } from '../core/types';
import { setGraphScope, type GraphScope } from './graph';
import { buildContext, postComment, resolveLive, setIssueProperty } from './jira';
import { modelDecider } from './model';
import { forgeStore, nextAttempt, resetAttempts, signingKeys } from './store';

export const DECIDED_BY_MODEL = 'the model, through the Forge LLM API';
export const DECIDED_BY_AGENT = 'the Verdict Rovo agent';

const liveResolver: Resolver = (e) => resolveLive(e.cite.kind, e.cite.id);

/** What the panel draws for each cited object: its label, link and state. Stored beside the receipt, not in it. */
export type CiteView = { key: string; kind: string; id: string; label: string; url?: string; status?: string; asserts: string; claim: string };

function citesFor(ctx: Context) {
  return (kind: string, id: string): CiteInfo => {
    const o = ctx.objects[`${kind}:${id}`];
    return { label: citeLabel(kind, id, o?.title), url: o?.url };
  };
}

function viewOf(ctx: Context, p: Proposal): CiteView[] {
  return p.evidence.map((e) => {
    const o = ctx.objects[`${e.cite.kind}:${e.cite.id}`];
    const status = o?.kind === 'issue' ? o.status : o?.kind === 'pr' ? o.state : undefined;
    return { key: `${e.cite.kind}:${e.cite.id}`, kind: e.cite.kind, id: e.cite.id, label: o?.title ?? e.cite.id, url: o?.url, status, asserts: e.asserts, claim: e.claim };
  });
}

async function publish(ctx: Context, result: RunResult): Promise<string> {
  const { proposal } = result.decision;
  const commentId = await postComment(ctx.subject.id, commentAdf(proposal, result.receipt, citesFor(ctx)));
  await kvs.set(`view:${result.receipt.hash}`, { cites: viewOf(ctx, proposal), subjectTitle: ctx.subject.title, commentId });
  await setIssueProperty(ctx.subject.id, 'verdict', { verdict: proposal.verdict, receiptId: result.receipt.body.receiptId, hash: result.receipt.hash, issuedAt: result.receipt.body.issuedAt });
  await resetAttempts(ctx.subject.id);
  return `Verdict: ${VERDICT_LABEL[proposal.verdict]}. ${proposal.why} Receipt ${result.receipt.body.receiptId} posted on ${ctx.subject.id}.`;
}

/** A full run with the direct model path (panel button, label trigger). */
export async function runWithModel(issueKey: string, graph: GraphScope): Promise<{ summary: string; result: RunResult }> {
  setGraphScope(graph);
  const { ctx, project } = await buildContext(issueKey);
  const keys = await signingKeys();
  const result = await runVerdict(ctx, project, modelDecider, DECIDED_BY_MODEL, keys, forgeStore, liveResolver);
  return { summary: await publish(ctx, result), result };
}

/** First Rovo action: the context, the checked facts and the allowed calls, for the agent to judge. */
export async function contextForAgent(issueKey: string, graph: GraphScope): Promise<string> {
  setGraphScope(graph);
  const { ctx } = await buildContext(issueKey);
  return promptFor(ctx, computeFloor(ctx), []);
}

/** Second Rovo action: the agent's proposal goes through the citation check; refused once, then the fallback posts. */
export async function submitFromAgent(issueKey: string, proposalJson: string, graph: GraphScope): Promise<string> {
  setGraphScope(graph);
  let p: Proposal;
  try {
    p = JSON.parse(proposalJson) as Proposal;
  } catch {
    return 'The proposal was not valid JSON. Send it again in the answer shape you were given.';
  }
  const { ctx, project } = await buildContext(issueKey);
  const attempt = await nextAttempt(issueKey);
  const keys = await signingKeys();
  const s = await submitProposal(ctx, project, p, attempt, DECIDED_BY_AGENT, keys, forgeStore, liveResolver);
  if (s.status === 'refused') {
    return `Refused by the citation check. Fix these and submit once more (allowed calls: ${s.allowed.join(', ')}):\n- ${s.failures.join('\n- ')}`;
  }
  return publish(ctx, s);
}
