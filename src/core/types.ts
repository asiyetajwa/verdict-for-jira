// Shared shapes. Everything in src/core is platform-independent: the Forge functions feed it data read from Jira,
// Confluence and the Teamwork Graph, and the seeded evaluation feeds it the same shapes from the seed set.

export type VerdictKind = 'DUPLICATE' | 'READY' | 'BLOCKED' | 'RISKY';
export const VERDICTS: VerdictKind[] = ['DUPLICATE', 'READY', 'BLOCKED', 'RISKY'];
export const VERDICT_LABEL: Record<VerdictKind, string> = {
  DUPLICATE: 'Duplicate',
  READY: 'Ready to Build',
  BLOCKED: 'Blocked',
  RISKY: 'Risky',
};

export type StatusCategory = 'new' | 'indeterminate' | 'done';
export type ObjectKind = 'issue' | 'page' | 'pr';

/** A reference to an object the verdict can cite. `id` is the issue key, page id or pull request id. */
export type Ref = { kind: ObjectKind; id: string };

export type IssueObject = {
  kind: 'issue';
  id: string; // issue key, e.g. VRD-12
  title: string;
  description: string;
  status: string;
  statusCategory: StatusCategory;
  resolution: string | null; // e.g. "Done", "Won't Do", "Reverted"
  labels: string[];
  url?: string;
};

export type PageObject = {
  kind: 'page';
  id: string;
  title: string;
  body: string; // plain text of the page
  url?: string;
};

export type PullRequestObject = {
  kind: 'pr';
  id: string;
  title: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
  reverted: boolean;
  url?: string;
};

export type ContextObject = IssueObject | PageObject | PullRequestObject;

export type LinkRelation = 'is blocked by' | 'blocks' | 'relates to' | 'duplicates' | 'is duplicated by' | 'implements' | 'mentions';

/** An edge from the subject issue (or from another linked object, for chains) to a context object. */
export type Edge = { from: string; to: string; relation: LinkRelation; source: 'jira-link' | 'graph' | 'similarity' };

export type SimilarHit = { id: string; score: number; shared: string[] };

/** Everything Verdict knows when it decides. */
export type Context = {
  subject: IssueObject;
  objects: Record<string, ContextObject>; // keyed by `${kind}:${id}`
  edges: Edge[];
  similar: SimilarHit[];
  /** Which sources were read, with counts, for the receipt and the panel. */
  sources: { jira: number; graph: number; similarity: number };
  /** True when the graph source could not be read (the verdict still runs on Jira links and similarity). */
  graphUnavailable?: boolean;
};

/**
 * What a citation asserts about the object it cites, so the citation check can test it mechanically:
 * open / done (status), blocker (an unresolved "is blocked by" link), duplicate (the original of this work),
 * reverted (a reverted change), decision (a linked decision page), mentioned (cited for context only).
 */
export type Assertion = 'open' | 'done' | 'blocker' | 'duplicate' | 'reverted' | 'decision' | 'mentioned';

export type Evidence = { claim: string; cite: Ref; asserts: Assertion };

/** What a decider (the model, or a person) proposes. */
export type Proposal = {
  verdict: VerdictKind;
  why: string;
  evidence: Evidence[];
  wouldChange: string[];
};

export const refKey = (r: Ref): string => `${r.kind}:${r.id}`;
