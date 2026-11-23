// Builds Verdict's Context from a live Jira site: the issue, its links (with blockers' own blockers, two deep), the
// Confluence pages it links or mentions, pull requests when the Teamwork Graph can supply them, and similar issues
// from the same project. Every source that fails is recorded, never hidden.

import api, { route } from '@forge/api';
import { Index } from '../core/similarity';
import type { Context, ContextObject, Edge, IssueObject, LinkRelation, PageObject, StatusCategory } from '../core/types';
import { graphPullRequests } from './graph';

export const SIMILAR_FLOOR = 0.05;
export const SIMILAR_LIMIT = 6;
const CORPUS = 200;

type AdfNode = { type?: string; text?: string; content?: AdfNode[]; attrs?: Record<string, unknown> };

/** Plain text from Atlassian Document Format, keeping list items on their own lines. */
export function adfText(n: AdfNode | string | null | undefined): string {
  if (!n) return '';
  if (typeof n === 'string') return n;
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  if (n.type === 'inlineCard' || n.type === 'blockCard') return String(n.attrs?.url ?? '');
  const inner = (n.content ?? []).map(adfText).join('');
  switch (n.type) {
    case 'listItem':
      return `- ${inner.trim()}\n`;
    case 'paragraph':
    case 'heading':
      return `${inner}\n`;
    case 'bulletList':
    case 'orderedList':
      return `${inner}\n`;
    default:
      return inner;
  }
}

type JiraIssue = {
  key: string;
  fields: {
    summary?: string;
    description?: AdfNode | string | null;
    status?: { name?: string; statusCategory?: { key?: string } };
    resolution?: { name?: string } | null;
    labels?: string[];
    project?: { key?: string };
    issuelinks?: {
      type?: { inward?: string; outward?: string; name?: string };
      inwardIssue?: { key: string; fields?: JiraIssue['fields'] };
      outwardIssue?: { key: string; fields?: JiraIssue['fields'] };
    }[];
  };
};

const FIELDS = 'summary,description,status,resolution,labels,project,issuelinks';

const category = (k: string | undefined): StatusCategory => (k === 'done' ? 'done' : k === 'new' ? 'new' : 'indeterminate');

function toIssue(i: JiraIssue, site: string): IssueObject {
  return {
    kind: 'issue',
    id: i.key,
    title: i.fields.summary ?? i.key,
    description: adfText(i.fields.description).trim(),
    status: i.fields.status?.name ?? 'Unknown',
    statusCategory: category(i.fields.status?.statusCategory?.key),
    resolution: i.fields.resolution?.name ?? null,
    labels: i.fields.labels ?? [],
    url: site ? `${site}/browse/${i.key}` : undefined,
  };
}

const RELATIONS: LinkRelation[] = ['is blocked by', 'blocks', 'relates to', 'duplicates', 'is duplicated by', 'implements', 'mentions'];
const relation = (name: string | undefined): LinkRelation => {
  const n = (name ?? '').toLowerCase();
  return (RELATIONS as string[]).includes(n) ? (n as LinkRelation) : 'relates to';
};

async function getIssue(key: string): Promise<JiraIssue | null> {
  const r = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=${FIELDS}`);
  return r.ok ? ((await r.json()) as JiraIssue) : null;
}

export async function siteUrl(): Promise<string> {
  const r = await api.asApp().requestJira(route`/rest/api/3/serverInfo`);
  return r.ok ? (((await r.json()) as { baseUrl?: string }).baseUrl ?? '') : '';
}

function linksOf(i: JiraIssue): { to: string; relation: LinkRelation; fields?: JiraIssue['fields'] }[] {
  return (i.fields.issuelinks ?? []).flatMap((l) => {
    if (l.outwardIssue) return [{ to: l.outwardIssue.key, relation: relation(l.type?.outward), fields: l.outwardIssue.fields }];
    if (l.inwardIssue) return [{ to: l.inwardIssue.key, relation: relation(l.type?.inward), fields: l.inwardIssue.fields }];
    return [];
  });
}

const PAGE_ID = /\/pages\/(\d+)|[?&]pageId=(\d+)/g;

function pageIdsIn(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(PAGE_ID)) {
    const id = m[1] ?? m[2];
    if (id) ids.push(id);
  }
  return ids;
}

async function remotePageIds(key: string): Promise<string[]> {
  const r = await api.asApp().requestJira(route`/rest/api/3/issue/${key}/remotelink`);
  if (!r.ok) return [];
  const links = (await r.json()) as { object?: { url?: string }; application?: { type?: string } }[];
  return links.flatMap((l) => pageIdsIn(l.object?.url ?? ''));
}

const stripHtml = (s: string) => s.replace(/<br\s*\/?>|<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').trim();

export async function getPage(id: string): Promise<PageObject | null> {
  const r = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${id}?body-format=storage`);
  if (!r.ok) return null;
  const p = (await r.json()) as { id: string; title?: string; body?: { storage?: { value?: string } }; _links?: { base?: string; webui?: string } };
  return { kind: 'page', id: p.id, title: p.title ?? `Page ${p.id}`, body: stripHtml(p.body?.storage?.value ?? ''), url: p._links?.webui ? `${p._links.base ?? ''}${p._links.webui}` : undefined };
}

async function projectCorpus(project: string, exclude: string): Promise<JiraIssue[]> {
  const r = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jql: `project = "${project}" AND key != "${exclude}" ORDER BY updated DESC`, fields: ['summary', 'description', 'status', 'resolution', 'labels'], maxResults: CORPUS }),
  });
  if (!r.ok) return [];
  return ((await r.json()) as { issues?: JiraIssue[] }).issues ?? [];
}

export type Built = { ctx: Context; project: string; site: string };

export async function buildContext(key: string): Promise<Built> {
  const [subjectRaw, site] = await Promise.all([getIssue(key), siteUrl()]);
  if (!subjectRaw) throw new Error(`Verdict could not open ${key}.`);
  const project = subjectRaw.fields.project?.key ?? key.split('-')[0] ?? '';
  const subject = toIssue(subjectRaw, site);
  const objects: Record<string, ContextObject> = { [`issue:${key}`]: subject };
  const edges: Edge[] = [];
  let jira = 0;
  let graph = 0;

  // Links, and each blocker's own blockers (two deep), so a chain is visible.
  const blockers: string[] = [];
  for (const l of linksOf(subjectRaw)) {
    edges.push({ from: key, to: l.to, relation: l.relation, source: 'jira-link' });
    jira++;
    if (l.relation === 'is blocked by') blockers.push(l.to);
  }
  const linked = await Promise.all(linksOf(subjectRaw).map((l) => getIssue(l.to)));
  for (const i of linked) if (i) objects[`issue:${i.key}`] = toIssue(i, site);
  for (const b of blockers.slice(0, 8)) {
    const bi = linked.find((i) => i?.key === b);
    if (!bi) continue;
    for (const l of linksOf(bi).filter((x) => x.relation === 'is blocked by')) {
      edges.push({ from: b, to: l.to, relation: 'is blocked by', source: 'jira-link' });
      jira++;
      const c = await getIssue(l.to);
      if (c) objects[`issue:${c.key}`] = toIssue(c, site);
    }
  }

  // Confluence pages: remote links plus page URLs written in the description.
  const pageIds = [...new Set([...(await remotePageIds(key)), ...pageIdsIn(subject.description)])].slice(0, 6);
  for (const id of pageIds) {
    const p = await getPage(id);
    if (!p) continue;
    objects[`page:${p.id}`] = p;
    edges.push({ from: key, to: p.id, relation: 'mentions', source: 'jira-link' });
    jira++;
  }

  // Pull requests from the Teamwork Graph, when it answers.
  let graphUnavailable = false;
  try {
    for (const pr of await graphPullRequests(key)) {
      objects[`pr:${pr.id}`] = pr;
      edges.push({ from: key, to: pr.id, relation: 'implements', source: 'graph' });
      graph++;
    }
  } catch {
    graphUnavailable = true;
  }

  // Similar issues from the same project.
  const corpus = await projectCorpus(project, key);
  const index = new Index([subject, ...corpus.map((i) => toIssue(i, site))].map((i) => ({ id: i.id, text: `${i.title}\n${i.description}` })));
  const similar = index.similar(key, SIMILAR_LIMIT).filter((h) => h.score >= SIMILAR_FLOOR);
  for (const h of similar) {
    const i = corpus.find((c) => c.key === h.id);
    if (i && !objects[`issue:${i.key}`]) objects[`issue:${i.key}`] = toIssue(i, site);
  }

  return { ctx: { subject, objects, edges, similar, sources: { jira, graph, similarity: similar.length }, graphUnavailable }, project, site };
}

/** Live existence check for the citation gate: the cited object can be opened right now. */
export async function resolveLive(kind: string, id: string): Promise<boolean> {
  if (kind === 'issue') return (await api.asApp().requestJira(route`/rest/api/3/issue/${id}?fields=summary`)).ok;
  if (kind === 'page') return (await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${id}`)).ok;
  return true; // pull requests come from the graph read in this same run
}

export async function postComment(key: string, body: unknown): Promise<string | null> {
  const r = await api.asApp().requestJira(route`/rest/api/3/issue/${key}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!r.ok) throw new Error(`Jira refused the comment on ${key}: HTTP ${String(r.status)}`);
  return ((await r.json()) as { id?: string }).id ?? null;
}

export async function setIssueProperty(key: string, prop: string, value: unknown): Promise<void> {
  await api.asApp().requestJira(route`/rest/api/3/issue/${key}/properties/${prop}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}
