// Scores Verdict on the 40 seeded issues against the known answers. Offline it runs the rules baseline (no model),
// on full context and on the issue text alone. The Forge app runs the same scorer with the model as the decider and
// writes the published numbers; this file never invents a model result.
//   node seed/eval.ts            prints the table
//   node seed/eval.ts --json     prints JSON
import { decide, rulesDecider, type Decider } from '../src/core/engine';
import type { VerdictKind } from '../src/core/types';
import { VERDICTS } from '../src/core/types';
import { seedContext } from './context';
import { EVAL } from './dataset';

export type EvalRow = { key: string; expected: VerdictKind; got: VerdictKind; correct: boolean; note: string; citationsChecked: number; citationsResolved: number; fellBack: boolean };
export type EvalSummary = {
  label: string;
  n: number;
  accuracy: number;
  perClass: Record<VerdictKind, { n: number; correct: number }>;
  duplicate: { precision: number; recall: number };
  citationResolution: number;
  rows: EvalRow[];
};

export async function runEval(label: string, decider: Decider, mode: 'full' | 'text'): Promise<EvalSummary> {
  const rows: EvalRow[] = [];
  for (const issue of EVAL) {
    const d = await decide(seedContext(issue.key, mode), decider);
    rows.push({ key: issue.key, expected: issue.expected, got: d.proposal.verdict, correct: d.proposal.verdict === issue.expected, note: issue.note, citationsChecked: d.check.checked, citationsResolved: d.check.resolved, fellBack: d.fellBack });
  }
  const perClass = Object.fromEntries(VERDICTS.map((v) => [v, { n: 0, correct: 0 }])) as EvalSummary['perClass'];
  for (const r of rows) {
    perClass[r.expected].n++;
    if (r.correct) perClass[r.expected].correct++;
  }
  const predDup = rows.filter((r) => r.got === 'DUPLICATE');
  const trueDup = rows.filter((r) => r.expected === 'DUPLICATE');
  const checked = rows.reduce((a, r) => a + r.citationsChecked, 0);
  return {
    label,
    n: rows.length,
    accuracy: rows.filter((r) => r.correct).length / rows.length,
    perClass,
    duplicate: { precision: predDup.length ? predDup.filter((r) => r.expected === 'DUPLICATE').length / predDup.length : 0, recall: trueDup.filter((r) => r.got === 'DUPLICATE').length / trueDup.length },
    citationResolution: checked ? rows.reduce((a, r) => a + r.citationsResolved, 0) / checked : 1,
    rows,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export function table(s: EvalSummary): string {
  const pc = VERDICTS.map((v) => `${v} ${String(s.perClass[v].correct)}/${String(s.perClass[v].n)}`).join(', ');
  const misses = s.rows.filter((r) => !r.correct).map((r) => `  ${r.key} expected ${r.expected}, got ${r.got} (${r.note})`);
  return [`${s.label}: accuracy ${pct(s.accuracy)} (${String(s.rows.filter((r) => r.correct).length)}/${String(s.n)}); ${pc}; duplicate precision ${pct(s.duplicate.precision)}, recall ${pct(s.duplicate.recall)}; citations resolved ${pct(s.citationResolution)}`, ...misses].join('\n');
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const full = await runEval('Rules only, full context', rulesDecider, 'full');
  const text = await runEval('Rules only, issue text alone', rulesDecider, 'text');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ full, text }, null, 2));
  else console.log(`${table(full)}\n\n${table(text)}`);
}
