// The direct model path for runs that do not go through Rovo chat (the panel's Run button, the label trigger and the
// evaluation): the Forge LLM API, which runs on Atlassian. The model is chosen from the live list, never hard-coded
// into copy; receipts say "the model".

import { chat, list } from '@forge/llm';
import type { Decider } from '../core/engine';
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

export const modelDecider: Decider = async (ctx, floor, feedback) => {
  const model = await pickModel();
  const res = await chat({
    model,
    max_completion_tokens: 1200,
    messages: [
      { role: 'system', content: VERDICT_RULES },
      { role: 'user', content: promptFor(ctx, floor, feedback) },
    ],
  });
  return parseProposal(textOf(res.choices[0]?.message.content));
};
