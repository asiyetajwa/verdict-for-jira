// Long work runs on a Forge queue: a model verdict can take longer than the 25 seconds a UI resolver, trigger or web
// trigger may run, and only queue consumers may run longer. Callers enqueue and return; the panel polls the job state.

import { Queue } from '@forge/events';
import { kvs } from '@forge/kvs';
import type { GraphScope } from './graph';

export type Job = { type: 'run'; issueKey: string; graph: GraphScope } | { type: 'eval'; issueKey: string; mode: string };
export type JobState = { state: 'queued' | 'running' | 'done' | 'failed'; at: string; error?: string; receiptHash?: string };

const queue = new Queue({ key: 'verdictqueue' });

export async function enqueue(job: Job): Promise<void> {
  // The queue refuses null values in a body, so a missing graph scope is left out rather than sent as null.
  const body = Object.fromEntries(Object.entries(job).filter(([, v]) => v !== null && v !== undefined));
  await queue.push({ body });
  if (job.type === 'run') await kvs.set(`job:${job.issueKey}`, { state: 'queued', at: new Date().toISOString() } satisfies JobState);
}

export const jobState = (issueKey: string) => kvs.get<JobState>(`job:${issueKey}`);

/** The queue consumer (a plain handler, as @forge/events 2+ expects), given the functions that do the work. */
export function consumer(handlers: { run: (key: string, graph: GraphScope) => Promise<string>; evaluate: (key: string, mode: string) => Promise<void> }) {
  return async (event: { body?: Record<string, unknown> }): Promise<void> => {
    const job = { graph: null, ...(event.body ?? {}) } as Job;
    if (job.type === 'eval') {
      await handlers.evaluate(job.issueKey, job.mode);
      return;
    }
    await kvs.set(`job:${job.issueKey}`, { state: 'running', at: new Date().toISOString() } satisfies JobState);
    try {
      const hash = await handlers.run(job.issueKey, job.graph);
      await kvs.set(`job:${job.issueKey}`, { state: 'done', at: new Date().toISOString(), receiptHash: hash } satisfies JobState);
    } catch (e) {
      await kvs.set(`job:${job.issueKey}`, { state: 'failed', at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) } satisfies JobState);
    }
  };
}
