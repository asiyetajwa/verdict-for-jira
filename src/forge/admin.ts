// Development-only admin web trigger: seeds the Tally demo project on the live site, runs one verdict, and runs the
// evaluation through the deployed app (the model via the Forge LLM API, on live Jira context). It refuses to run unless
// the environment variable VERDICT_ADMIN is "on", which is set in the development environment only.
//   ?job=seed&from=1&to=10    create issues TAL-from..to (sequential, so logical and real keys match)
//   ?job=setup                project, resolutions, Confluence space and decision pages
//   ?job=links                blocker links and page links
//   ?job=run&issue=TAL-56     post one real verdict
//   ?job=eval&from=41&to=45&mode=model|rules|model-text   score a slice; results kept in storage
//   ?job=report               the scored table

import api, { route } from '@forge/api';
import { kvs, WhereConditions } from '@forge/kvs';
import { decide, rulesDecider } from '../core/engine';
import type { Context, VerdictKind } from '../core/types';
import { ALL_ISSUES, EVAL, PAGES, type SeedIssue } from '../../seed/dataset';
import { buildContext } from './jira';
import { modelDecider, modelInUse } from './model';
import { enqueue } from './jobs';

const PROJECT = 'TAL';
const SPACE = 'TALLY';

type Req = { queryParameters?: Record<string, string[]> };
const q = (r: Req, k: string) => r.queryParameters?.[k]?.[0];
const reply = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(body, null, 1) });

async function jira(path: ReturnType<typeof route>, method = 'GET', body?: unknown) {
  const r = await api.asApp().requestJira(path, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { ok: r.ok, status: r.status, json: (text ? JSON.parse(text) : {}) as Record<string, unknown> & unknown[] };
}
async function wiki(path: ReturnType<typeof route>, method = 'GET', body?: unknown) {
  const r = await api.asApp().requestConfluence(path, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { ok: r.ok, status: r.status, json: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
}

/** Description as ADF: paragraphs, with "Acceptance criteria:" followed by a bullet list. */
function adf(description: string) {
  const content: unknown[] = [];
  const lines = description.split('\n');
  let list: string[] = [];
  const flush = () => {
    if (list.length) content.push({ type: 'bulletList', content: list.map((t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) });
    list = [];
  };
  for (const l of lines) {
    if (l.startsWith('- ')) list.push(l.slice(2));
    else {
      flush();
      if (l.trim()) content.push({ type: 'paragraph', content: [{ type: 'text', text: l }] });
    }
  }
  flush();
  return { type: 'doc', version: 1, content };
}

async function setup() {
  const out: Record<string, unknown> = {};
  const p = await jira(route`/rest/api/3/project/${PROJECT}`);
  if (!p.ok) {
    const users = await jira(route`/rest/api/3/users/search?maxResults=50`);
    const lead = (users.json as unknown as { accountId: string; accountType: string; active: boolean }[]).find((u) => u.accountType === 'atlassian' && u.active);
    const c = await jira(route`/rest/api/3/project`, 'POST', { key: PROJECT, name: 'Tally', projectTypeKey: 'software', projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic', leadAccountId: lead?.accountId, assigneeType: 'UNASSIGNED' });
    out.project = { created: c.ok, status: c.status, body: c.ok ? undefined : c.json };
  } else out.project = 'exists';

  const res = await jira(route`/rest/api/3/resolution`);
  const have = new Set((res.json as unknown as { name: string }[]).map((r) => r.name));
  for (const name of ['Reverted', "Won't Do"]) {
    if (have.has(name)) continue;
    const c = await jira(route`/rest/api/3/resolution`, 'POST', { name, description: 'Created for the Verdict demo project.' });
    out[`resolution ${name}`] = c.ok ? 'created' : { status: c.status, body: c.json };
  }

  let space = await wiki(route`/wiki/api/v2/spaces?keys=${SPACE}`);
  let spaceId = (space.json.results as { id: string }[] | undefined)?.[0]?.id;
  if (!spaceId) {
    const c = await wiki(route`/wiki/rest/api/space`, 'POST', { key: SPACE, name: 'Tally Decisions', description: { plain: { value: 'Product decisions for Tally.', representation: 'plain' } } });
    out.space = c.ok ? 'created' : { status: c.status, body: c.json };
    space = await wiki(route`/wiki/api/v2/spaces?keys=${SPACE}`);
    spaceId = (space.json.results as { id: string }[] | undefined)?.[0]?.id;
  } else out.space = 'exists';
  if (!spaceId) return out;

  const pages = (await kvs.get<Record<string, { id: string; url: string }>>('seed:pages')) ?? {};
  for (const pg of PAGES) {
    if (pages[pg.id]) continue;
    const c = await wiki(route`/wiki/api/v2/pages`, 'POST', { spaceId, status: 'current', title: pg.title, body: { representation: 'storage', value: `<p>${pg.body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` } });
    if (c.ok) {
      const links = c.json._links as { base?: string; webui?: string } | undefined;
      pages[pg.id] = { id: String(c.json.id), url: `${links?.base ?? ''}${links?.webui ?? ''}` };
    } else out[`page ${pg.id}`] = { status: c.status, body: c.json };
  }
  await kvs.set('seed:pages', pages);
  out.pages = pages;
  return out;
}

async function transition(key: string, s: SeedIssue): Promise<string | null> {
  const target = s.status === 'In Review' ? 'In Progress' : s.status;
  if (target === 'To Do') return null;
  const t = await jira(route`/rest/api/3/issue/${key}/transitions`);
  const list = (t.json.transitions as { id: string; to: { name: string } }[] | undefined) ?? [];
  const tr = list.find((x) => x.to.name.toLowerCase() === target.toLowerCase());
  if (!tr) return `no transition to ${target} (have ${list.map((x) => x.to.name).join(', ')})`;
  const fields = s.resolution && s.resolution !== 'Done' ? { resolution: { name: s.resolution } } : undefined;
  let r = await jira(route`/rest/api/3/issue/${key}/transitions`, 'POST', { transition: { id: tr.id }, ...(fields ? { fields } : {}) });
  if (!r.ok && fields) {
    // The resolution is not on the transition screen: move it, then set the resolution directly.
    r = await jira(route`/rest/api/3/issue/${key}/transitions`, 'POST', { transition: { id: tr.id } });
    const e = await jira(route`/rest/api/3/issue/${key}`, 'PUT', { fields });
    if (!e.ok) return `resolution ${s.resolution} not set: ${JSON.stringify(e.json).slice(0, 200)}`;
  }
  return r.ok ? null : `transition failed: ${JSON.stringify(r.json).slice(0, 200)}`;
}

async function seed(from: number, to: number) {
  const out: Record<string, unknown> = {};
  for (let n = from; n <= to; n++) {
    const s = ALL_ISSUES.find((i) => i.key === `${PROJECT}-${String(n)}`);
    if (!s) {
      out[`${PROJECT}-${String(n)}`] = 'not in the dataset';
      continue;
    }
    const exists = await jira(route`/rest/api/3/issue/${s.key}?fields=summary`);
    if (exists.ok) {
      out[s.key] = 'exists';
      continue;
    }
    const c = await jira(route`/rest/api/3/issue`, 'POST', { fields: { project: { key: PROJECT }, issuetype: { name: 'Task' }, summary: s.summary, description: adf(s.description) } });
    if (!c.ok) {
      out[s.key] = { status: c.status, body: c.json };
      break;
    }
    const real = String(c.json.key);
    if (real !== s.key) {
      out[s.key] = `created as ${real}; keys no longer match, stopping`;
      break;
    }
    out[s.key] = (await transition(real, s)) ?? 'ok';
  }
  return out;
}

async function links() {
  const out: Record<string, unknown> = {};
  const pages = (await kvs.get<Record<string, { id: string; url: string }>>('seed:pages')) ?? {};
  for (const s of ALL_ISSUES) {
    for (const b of s.blockedBy ?? []) {
      // Checked on the live site: with type Blocks, the inwardIssue is the blocker and the outwardIssue is blocked.
      const r = await jira(route`/rest/api/3/issueLink`, 'POST', { type: { name: 'Blocks' }, inwardIssue: { key: b }, outwardIssue: { key: s.key } });
      out[`${s.key} blocked by ${b}`] = r.ok ? 'ok' : { status: r.status, body: r.json };
    }
    for (const p of s.pages ?? []) {
      const pg = pages[p];
      if (!pg) continue;
      const title = PAGES.find((x) => x.id === p)?.title ?? p;
      const r = await jira(route`/rest/api/3/issue/${s.key}/remotelink`, 'POST', { globalId: `verdict-seed-${s.key}-${p}`, object: { url: pg.url, title } });
      out[`${s.key} -> ${p}`] = r.ok ? 'ok' : { status: r.status, body: r.json };
    }
  }
  // Check one direction so a reversed link convention is caught now, not in the demo.
  const check = await buildContext('TAL-51');
  out.check = check.ctx.edges.filter((e) => e.relation === 'is blocked by').map((e) => `${e.from} is blocked by ${e.to}`);
  return out;
}

type Scored = { key: string; expected: VerdictKind; got: VerdictKind; correct: boolean; fellBack: boolean; attempts: number; checked: number; resolved: number; ms: number; error?: string };

const textOnly = (ctx: Context): Context => ({ subject: ctx.subject, objects: { [`issue:${ctx.subject.id}`]: ctx.subject }, edges: [], similar: [], sources: { jira: 0, graph: 0, similarity: 0 } });

/** Scores one seeded issue and keeps the row in storage (run on the queue). */
export async function evaluateOne(key: string, mode: string): Promise<void> {
  const e = EVAL.find((x) => x.key === key);
  if (!e) return;
  const t0 = Date.now();
  try {
    const { ctx } = await buildContext(e.key);
    const c = mode.endsWith('-text') ? textOnly(ctx) : ctx;
    const d = await decide(c, mode.startsWith('rules') ? rulesDecider : modelDecider);
    const row: Scored = { key: e.key, expected: e.expected, got: d.proposal.verdict, correct: d.proposal.verdict === e.expected, fellBack: d.fellBack, attempts: d.attempts, checked: d.check.checked, resolved: d.check.resolved, ms: Date.now() - t0 };
    await kvs.set(`eval:${mode}:${e.key}`, { ...row, why: d.proposal.why, evidence: d.proposal.evidence, model: mode.startsWith('model') ? await modelInUse() : 'rules', at: new Date().toISOString() });
  } catch (err) {
    await kvs.set(`eval:${mode}:${e.key}`, { key: e.key, expected: e.expected, got: 'RISKY', correct: false, fellBack: true, attempts: 0, checked: 0, resolved: 0, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err), model: 'error', at: new Date().toISOString() });
  }
}

async function evalSlice(from: number, to: number, mode: string) {
  const keys = EVAL.map((x) => x.key).filter((k) => {
    const n = Number(k.split('-')[1]);
    return n >= from && n <= to;
  });
  for (const k of keys) await enqueue({ type: 'eval', issueKey: k, mode });
  return { queued: keys, mode };
}

async function report() {
  const rows: (Scored & { mode: string; model: string; at: string })[] = [];
  let cursor: string | undefined;
  do {
    let qb = kvs.query().where('key', WhereConditions.beginsWith('eval:')).limit(100);
    if (cursor) qb = qb.cursor(cursor);
    const page = await qb.getMany<Scored & { model: string; at: string }>();
    for (const r of page.results) rows.push({ ...r.value, mode: r.key.split(':')[1] ?? '' });
    cursor = page.nextCursor;
  } while (cursor);
  const modes = [...new Set(rows.map((r) => r.mode))];
  return Object.fromEntries(modes.map((m) => {
    const rs = rows.filter((r) => r.mode === m);
    const per = Object.fromEntries((['DUPLICATE', 'READY', 'BLOCKED', 'RISKY'] as VerdictKind[]).map((v) => [v, `${String(rs.filter((r) => r.expected === v && r.correct).length)}/${String(rs.filter((r) => r.expected === v).length)}`]));
    const predDup = rs.filter((r) => r.got === 'DUPLICATE');
    const checked = rs.reduce((a, r) => a + r.checked, 0);
    return [m, {
      n: rs.length,
      accuracy: `${String(rs.filter((r) => r.correct).length)}/${String(rs.length)}`,
      perClass: per,
      duplicatePrecision: predDup.length ? `${String(predDup.filter((r) => r.expected === 'DUPLICATE').length)}/${String(predDup.length)}` : 'none predicted',
      citationsResolved: `${String(rs.reduce((a, r) => a + r.resolved, 0))}/${String(checked)}`,
      fellBack: rs.filter((r) => r.fellBack).length,
      retried: rs.filter((r) => r.attempts > 1).length,
      medianSeconds: rs.length ? Math.round(rs.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rs.length / 2)]! / 100) / 10 : 0,
      models: [...new Set(rs.map((r) => r.model))],
      misses: rs.filter((r) => !r.correct).map((r) => `${r.key} expected ${r.expected}, got ${r.got}${r.error ? ` (error: ${r.error})` : ''}`),
    }];
  }));
}

export async function adminTrigger(request: Req) {
  if (process.env.VERDICT_ADMIN !== 'on') return reply(404, { error: 'not found' });
  try {
    const job = q(request, 'job');
    const from = Number(q(request, 'from') ?? '1');
    const to = Number(q(request, 'to') ?? String(from));
    switch (job) {
      case 'setup':
        return reply(200, await setup());
      case 'seed':
        return reply(200, await seed(from, to));
      case 'links':
        return reply(200, await links());
      case 'run': {
        await enqueue({ type: 'run', issueKey: q(request, 'issue') ?? '', graph: null });
        return reply(200, { queued: q(request, 'issue') });
      }
      case 'eval':
        return reply(200, await evalSlice(from, to, q(request, 'mode') ?? 'model'));
      case 'ctx': {
        const b = await buildContext(q(request, 'issue') ?? '');
        return reply(200, { edges: b.ctx.edges, similar: b.ctx.similar, objects: Object.keys(b.ctx.objects), sources: b.ctx.sources, graphUnavailable: b.ctx.graphUnavailable, subject: b.ctx.subject });
      }
      case 'flip': {
        // Delete the seeded Blocks links and create them the other way round.
        const out: Record<string, unknown> = {};
        for (const s of ALL_ISSUES.filter((i) => i.blockedBy?.length)) {
          const r = await jira(route`/rest/api/3/issue/${s.key}?fields=issuelinks`);
          const ls = ((r.json.fields as { issuelinks?: { id: string; type: { name: string } }[] } | undefined)?.issuelinks ?? []).filter((l) => l.type.name === 'Blocks');
          for (const l of ls) await jira(route`/rest/api/3/issueLink/${l.id}`, 'DELETE');
          for (const b of s.blockedBy ?? []) {
            const c = await jira(route`/rest/api/3/issueLink`, 'POST', { type: { name: 'Blocks' }, inwardIssue: { key: b }, outwardIssue: { key: s.key } });
            out[`${s.key} blocked by ${b}`] = c.ok ? 'ok' : c.status;
          }
        }
        out.check = (await buildContext('TAL-51')).ctx.edges.map((e) => `${e.from} ${e.relation} ${e.to}`);
        return reply(200, out);
      }
      case 'ping': {
        const { Queue } = await import('@forge/events');
        const out: Record<string, unknown> = {};
        for (const [name, body] of [['hello', { hello: 'world' }], ['typed', { type: 'eval', issueKey: 'TAL-41', mode: 'rules' }], ['kind', { kind: 'eval', issueKey: 'TAL-41', mode: 'rules' }]] as const) {
          try {
            out[name] = await new Queue({ key: 'verdictqueue' }).push({ body: { ...body } });
          } catch (e) {
            out[name] = e instanceof Error ? `${e.message} ${JSON.stringify(e)}` : String(e);
          }
        }
        return reply(200, out);
      }
      case 'latest': {
        const key = q(request, 'issue') ?? '';
        const { latestFor } = await import('./store');
        const l = await latestFor(key);
        const comments = await jira(route`/rest/api/3/issue/${key}/comment?orderBy=-created&maxResults=1&expand=renderedBody`);
        const c = (comments.json.comments as { id: string; renderedBody?: string; author?: { displayName?: string } }[] | undefined)?.[0];
        return reply(200, { receipt: l?.receipt, comment: c ? { id: c.id, author: c.author?.displayName, text: (c.renderedBody ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } : null });
      }
      case 'job':
        return reply(200, await kvs.get(`job:${q(request, 'issue') ?? ''}`));
      case 'report':
        return reply(200, await report());
      default:
        return reply(400, { error: 'unknown job' });
    }
  } catch (e) {
    return reply(500, { error: e instanceof Error ? `${e.message}\n${e.stack ?? ''}`.slice(0, 1500) : String(e) });
  }
}
