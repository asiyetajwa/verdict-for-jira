// The direct model path for runs that do not go through Rovo chat (the panel's Run button, the label trigger and the
// evaluation): the Forge LLM API, which runs on Atlassian. The model is chosen from the live list, never hard-coded
// into copy; receipts say "the model".

import { chat, list } from '@forge/llm';
import type { Decider } from '../core/engine';
import type { Proposal } from '../core/types';
import { parseProposal, promptFor, VERDICT_RULES } from '../core/prompt';

let chosen: string | null = null;

async function pickModel(): Promise<string> {
  if (chosen) return chosen;
  const { models } = await list();
  const active = models.filter((m) => m.status === 'active').map((m) => m.model);
  // A mid-size model is plenty for triage; take the newest Sonnet, else whatever is active.
  chosen = active.filter((m) => m.includes('sonnet')).sort().pop() ?? active[0] ?? null;
  if (!chosen) throw new Error('No model is available to this app right now.');
  return chosen;
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p: { text?: string }) => p.text ?? '').join('');
  return '';
}

// The answer comes back as a forced tool call, so it arrives as structured arguments rather than JSON written into
// prose (a free-text answer with an unescaped quote failed to parse on the live site).
const SUBMIT = {
  type: 'function' as const,
  function: {
    name: 'submit_verdict',
    description: 'Submit the one verdict for the issue, with cited evidence.',
    parameters: {
      type: 'object',
      required: ['verdict', 'why', 'evidence', 'wouldChange'],
      properties: {
        verdict: { type: 'string', enum: ['DUPLICATE', 'READY', 'BLOCKED', 'RISKY'] },
        why: { type: 'string', description: 'One or two plain sentences.' },
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            required: ['claim', 'cite', 'asserts'],
            properties: {
              claim: { type: 'string' },
              cite: { type: 'object', required: ['kind', 'id'], properties: { kind: { type: 'string', enum: ['issue', 'page', 'pr'] }, id: { type: 'string' } } },
              asserts: { type: 'string', enum: ['open', 'done', 'blocker', 'duplicate', 'reverted', 'decision', 'mentioned'] },
            },
          },
        },
        wouldChange: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      },
    },
  },
};

export const modelDecider: Decider = async (ctx, floor, feedback) => {
  const model = await pickModel();
  const res = await chat({
    model,
    max_completion_tokens: 1500,
    tools: [SUBMIT],
    tool_choice: { type: 'function', function: { name: 'submit_verdict' } },
    messages: [
      { role: 'system', content: VERDICT_RULES },
      { role: 'user', content: `${promptFor(ctx, floor, feedback)}\n\nSubmit your answer with the submit_verdict tool.` },
    ],
  });
  const msg = res.choices[0]?.message;
  const call = msg?.tool_calls?.find((c) => c.function.name === 'submit_verdict');
  if (call) {
    const args = call.function.arguments as unknown;
    return (typeof args === 'string' ? JSON.parse(args) : args) as Proposal;
  }
  return parseProposal(textOf(msg?.content));
};

/** The model id in use, for evaluation records only (public copy says "the model"). */
export const modelInUse = (): Promise<string> => pickModel();
