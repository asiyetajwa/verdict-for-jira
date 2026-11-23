// Builds Verdict's Context for a seeded issue straight from the dataset, so the evaluation can run offline with the
// same core the Forge app uses. `mode` strips context to measure what each source adds:
//   full: Jira links, decision pages (the graph's job in Forge), and similar issues
//   text: the issue text alone, as a triage made on the ticket without its surroundings
import { Index } from '../src/core/similarity';
import type { Context, ContextObject, Edge, IssueObject } from '../src/core/types';
import { ALL_ISSUES, PAGES, type SeedIssue } from './dataset';

// Similarity is a candidate finder: the top matches go in front of the model even when they share few words, because
// duplicates are often worded differently. Only the floor's thresholds turn a score into a fact.
export const SIMILAR_FLOOR = 0.05;
export const SIMILAR_LIMIT = 6;

const toIssue = (s: SeedIssue): IssueObject => ({
  kind: 'issue',
  id: s.key,
  title: s.summary,
  description: s.description,
  status: s.status,
  statusCategory: s.status === 'Done' ? 'done' : s.status === 'To Do' ? 'new' : 'indeterminate',
  resolution: s.resolution ?? null,
  labels: [],
});

const index = new Index(ALL_ISSUES.map((i) => ({ id: i.key, text: `${i.summary}\n${i.description}` })));
const byKey = new Map(ALL_ISSUES.map((i) => [i.key, i]));

export function seedContext(key: string, mode: 'full' | 'text' = 'full'): Context {
  const s = byKey.get(key);
  if (!s) throw new Error(`unknown seed issue ${key}`);
  const subject = toIssue(s);
  const objects: Record<string, ContextObject> = { [`issue:${key}`]: subject };
  if (mode === 'text') return { subject, objects, edges: [], similar: [], sources: { jira: 0, graph: 0, similarity: 0 } };

  const edges: Edge[] = [];
  let jira = 0;
  let graph = 0;
  const addIssue = (k: string) => {
    const o = byKey.get(k);
    if (o) objects[`issue:${k}`] = toIssue(o);
  };
  for (const b of s.blockedBy ?? []) {
    edges.push({ from: key, to: b, relation: 'is blocked by', source: 'jira-link' });
    addIssue(b);
    jira++;
    for (const c of byKey.get(b)?.blockedBy ?? []) {
      edges.push({ from: b, to: c, relation: 'is blocked by', source: 'graph' });
      addIssue(c);
      graph++;
    }
  }
  for (const p of s.pages ?? []) {
    const page = PAGES.find((x) => x.id === p);
    if (!page) continue;
    objects[`page:${p}`] = { kind: 'page', id: p, title: page.title, body: page.body };
    edges.push({ from: key, to: p, relation: 'mentions', source: 'graph' });
    graph++;
  }
  const similar = index.similar(key, SIMILAR_LIMIT).filter((h) => h.score >= SIMILAR_FLOOR);
  for (const h of similar) addIssue(h.id);
  return { subject, objects, edges, similar, sources: { jira, graph, similarity: similar.length } };
}
