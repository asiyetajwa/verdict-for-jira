// Forge entry points: the Rovo agent's actions, the Custom UI resolver for the issue panel and the Verdict Log, and the
// label trigger.

import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import Resolver from '@forge/resolver';
import { signOutcome, verifyChain, verifyReceipt } from './core/receipt';
import type { GraphScope } from './forge/graph';
import { latestFor, logFor, saveReceipt, signingKeys } from './forge/store';
import { evaluateOne } from './forge/admin';
import { consumer, enqueue, jobState } from './forge/jobs';
import { contextForAgent, runWithModel, submitFromAgent, type CiteView } from './forge/verdict';

// ---------- Rovo actions ----------

type ActionPayload = {
  issueKey?: string;
  proposal?: string;
  context?: { cloudId?: string; jira?: { issueKey?: string; issueId?: string | number } };
};

function scopeFrom(cloudId: string | undefined, issueId: string | number | undefined): GraphScope {
  return cloudId && issueId !== undefined ? { cloudId, issueId: String(issueId) } : null;
}

async function issueIdOf(key: string): Promise<string | undefined> {
  const r = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=summary`);
  return r.ok ? ((await r.json()) as { id?: string }).id : undefined;
}

async function actionScope(p: ActionPayload): Promise<{ key: string; graph: GraphScope }> {
  const key = (p.issueKey ?? p.context?.jira?.issueKey ?? '').trim().toUpperCase();
  if (!key) throw new Error('Tell me which issue to judge, for example PROJ-42.');
  const id = p.context?.jira?.issueKey === key ? p.context.jira.issueId : await issueIdOf(key);
  return { key, graph: scopeFrom(p.context?.cloudId, id) };
}

export async function getVerdictContext(payload: ActionPayload): Promise<string> {
  try {
    const { key, graph } = await actionScope(payload);
    return await contextForAgent(key, graph);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function submitVerdict(payload: ActionPayload): Promise<string> {
  try {
    const { key, graph } = await actionScope(payload);
    return await submitFromAgent(key, payload.proposal ?? '', graph);
  } catch (e) {
    return `Verdict could not post: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ---------- Custom UI resolver ----------

type Ext = { issue?: { key?: string; id?: string | number }; project?: { key?: string } };
type ReqCtx = { cloudId?: string; accountId?: string; extension?: Ext };

const resolver = new Resolver();

async function stateFor(issueKey: string) {
  const latest = await latestFor(issueKey);
  const job = await jobState(issueKey);
  if (!latest) return { issueKey, receipt: null, job };
  const view = await kvs.get<{ cites: CiteView[]; subjectTitle: string }>(`view:${latest.receipt.hash}`);
  return { issueKey, job, receipt: latest.receipt, check: await verifyReceipt(latest.receipt), cites: view?.cites ?? [], subjectTitle: view?.subjectTitle ?? issueKey };
}

resolver.define('getState', async ({ context }) => {
  const c = context as ReqCtx;
  return stateFor(String(c.extension?.issue?.key ?? ''));
});

resolver.define('run', async ({ context }) => {
  const c = context as ReqCtx;
  const key = String(c.extension?.issue?.key ?? '');
  try {
    await enqueue({ type: 'run', issueKey: key, graph: scopeFrom(c.cloudId, c.extension?.issue?.id) });
    return { ok: true, state: await stateFor(key) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

resolver.define('recordOutcome', async ({ payload, context }) => {
  const c = context as ReqCtx;
  const key = String(c.extension?.issue?.key ?? '');
  const p = payload as { outcome?: 'accepted' | 'rejected'; note?: string };
  if (p.outcome !== 'accepted' && p.outcome !== 'rejected') return { ok: false, error: 'Choose Accept or Reject.' };
  const latest = await latestFor(key);
  if (!latest) return { ok: false, error: 'There is no verdict on this issue yet.' };
  if (latest.receipt.outcome) return { ok: false, error: 'The outcome is already recorded on this receipt.' };
  const me = await api.asUser().requestJira(route`/rest/api/3/myself`);
  const by = me.ok ? (((await me.json()) as { displayName?: string }).displayName ?? c.accountId ?? 'unknown') : (c.accountId ?? 'unknown');
  const signed = await signOutcome(latest.receipt, p.outcome, by, await signingKeys(), p.note?.slice(0, 280));
  await saveReceipt(latest.key, signed);
  return { ok: true, state: await stateFor(key) };
});

resolver.define('getLog', async ({ context }) => {
  const c = context as ReqCtx;
  const project = String(c.extension?.project?.key ?? '');
  const chain = await logFor(project);
  const check = await verifyChain(chain);
  return { project, check, publicKey: (await signingKeys()).publicRaw, receipts: chain.slice().reverse() };
});

export const ui = resolver.getDefinitions();

// ---------- Label trigger: adding the label "verdict" to an issue runs Verdict on it ----------

type UpdatedEvent = { issue?: { key?: string; id?: string }; changelog?: { items?: { field?: string; toString?: string | null; fromString?: string | null }[] } };

export async function onIssueUpdated(event: UpdatedEvent): Promise<void> {
  const added = (event.changelog?.items ?? []).some((i) => i.field === 'labels' && /(^|\s)verdict(\s|$)/i.test(i.toString ?? '') && !/(^|\s)verdict(\s|$)/i.test(i.fromString ?? ''));
  const key = event.issue?.key;
  if (!added || !key) return;
  // A trigger runs without a user, so the Teamwork Graph (user-only) is recorded as unavailable on the receipt.
  await enqueue({ type: 'run', issueKey: key, graph: null });
}

// ---------- Queue consumer: the long work ----------
export const worker = consumer({
  run: async (key, graph) => (await runWithModel(key, graph)).result.receipt.hash,
  evaluate: evaluateOne,
});

// ---------- Development-only admin web trigger (seed, single run, evaluation); refuses unless VERDICT_ADMIN=on ----------
export { adminTrigger } from './forge/admin';
