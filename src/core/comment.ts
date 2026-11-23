// The verdict comment, in the fixed shape from the spec: Verdict, Evidence, What would change this call, Receipt.
// Rendered as Atlassian Document Format for the Jira REST API (v3 comments), and as plain text for the agent's reply.

import type { SignedReceipt } from './receipt';
import type { Proposal } from './types';
import { VERDICT_LABEL } from './types';

type Node = Record<string, unknown>;
const text = (t: string, marks?: Node[]): Node => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (...content: Node[]): Node => ({ type: 'paragraph', content });
const heading = (t: string): Node => ({ type: 'heading', attrs: { level: 3 }, content: [text(t)] });
const bullets = (items: Node[][]): Node => ({ type: 'bulletList', content: items.map((c) => ({ type: 'listItem', content: [para(...c)] })) });
const strong = (t: string): Node => text(t, [{ type: 'strong' }]);
const code = (t: string): Node => text(t, [{ type: 'code' }]);
const link = (t: string, href: string): Node => text(t, [{ type: 'link', attrs: { href } }]);

export function citeLabel(kind: string, id: string, title?: string): string {
  if (kind === 'issue') return title ? `${id} (${title})` : id;
  if (kind === 'pr') return `PR ${id}${title ? ` (${title})` : ''}`;
  return title ? `"${title}"` : `page ${id}`;
}

export type CiteInfo = { label: string; url?: string };

export function commentAdf(p: Proposal, r: SignedReceipt, cites: (kind: string, id: string) => CiteInfo, verifyUrl?: string): Node {
  const evidence = p.evidence.map((e) => {
    const c = cites(e.cite.kind, e.cite.id);
    return [text(`${e.claim} `), c.url ? link(c.label, c.url) : strong(c.label)];
  });
  const b = r.body;
  const receiptLines: Node[][] = [
    [text('Receipt '), code(b.receiptId), text(`, issued ${b.issuedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`)],
    [text(`Context read: ${String(b.context.consulted.length)} objects (${String(b.context.counts.jira)} from Jira, ${String(b.context.counts.graph)} from the Teamwork Graph, ${String(b.context.counts.similarity)} similar issues)${b.context.graphUnavailable ? '; the Teamwork Graph could not be read for this run' : ''}`)],
    [text(`Citation check: ${String(b.citationCheck.resolved)} of ${String(b.citationCheck.checked)} citations resolved`)],
    [text('SHA-256 '), code(r.hash.slice(0, 16)), text(', Ed25519 signature '), code(`${r.signature.slice(0, 16)}...`)],
    [text(`Human outcome: ${r.outcome ? r.outcome.body.outcome : 'pending'}`), ...(verifyUrl ? [text(' · '), link('Verify', verifyUrl)] : [])],
  ];
  return {
    type: 'doc',
    version: 1,
    content: [
      heading(`Verdict: ${VERDICT_LABEL[p.verdict]}`),
      para(text(p.why)),
      heading('Evidence'),
      bullets(evidence),
      heading('What would change this call'),
      bullets(p.wouldChange.map((w) => [text(w)])),
      heading('Receipt'),
      bullets(receiptLines),
    ],
  };
}

/** Plain text of the same comment, for the agent's chat reply and for tests. */
export function commentText(p: Proposal, r: SignedReceipt, cites: (kind: string, id: string) => CiteInfo): string {
  return [
    `Verdict: ${VERDICT_LABEL[p.verdict]}`,
    p.why,
    '',
    'Evidence',
    ...p.evidence.map((e) => `- ${e.claim} ${cites(e.cite.kind, e.cite.id).label}`),
    '',
    'What would change this call',
    ...p.wouldChange.map((w) => `- ${w}`),
    '',
    `Receipt ${r.body.receiptId}: ${String(r.body.citationCheck.resolved)} of ${String(r.body.citationCheck.checked)} citations resolved, SHA-256 ${r.hash.slice(0, 16)}, signed.`,
  ].join('\n');
}
