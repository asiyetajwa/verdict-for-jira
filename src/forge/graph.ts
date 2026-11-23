// Teamwork Graph reads (Forge Preview). The graph only answers as the current user, so a run started without one
// (a trigger) records the graph as unavailable on its receipt instead of pretending it looked.
// Curated query used: jiraWorkItemLinkedExternalPullRequests(id: ARI of the Jira issue).

import api from '@forge/api';
import type { PullRequestObject } from '../core/types';

export type GraphScope = { cloudId: string; issueId: string } | null;

let scope: GraphScope = null;
/** Set per invocation by the entry point, from the Forge context of a user-initiated call. */
export const setGraphScope = (s: GraphScope) => {
  scope = s;
};

const QUERY = `query verdict_linkedPullRequests($id: ID!) {
  jiraWorkItemLinkedExternalPullRequests(id: $id, first: 25) {
    edges { node { __typename ... on ExternalPullRequest { id displayName url status } } }
  }
}`;

type Node = { __typename?: string; id?: string; displayName?: string; url?: string; status?: string };

export async function graphPullRequests(issueKey: string): Promise<PullRequestObject[]> {
  if (!scope) throw new Error('no user context for the Teamwork Graph');
  const ari = `ari:cloud:jira:${scope.cloudId}:issue/${scope.issueId}`;
  const r = await api.asUser().requestTeamworkGraph(QUERY, { id: ari });
  if (!r.ok) throw new Error(`Teamwork Graph HTTP ${String(r.status)} for ${issueKey}`);
  const j = (await r.json()) as { data?: { jiraWorkItemLinkedExternalPullRequests?: { edges?: { node?: Node }[] } }; errors?: unknown[] };
  if (j.errors?.length) throw new Error(`Teamwork Graph errors for ${issueKey}`);
  return (j.data?.jiraWorkItemLinkedExternalPullRequests?.edges ?? []).flatMap(({ node }) => {
    if (!node?.id) return [];
    const st = (node.status ?? '').toUpperCase();
    return [{ kind: 'pr' as const, id: node.displayName?.match(/#\d+/)?.[0] ?? node.id.split('/').pop() ?? node.id, title: node.displayName ?? 'Pull request', state: st.includes('MERGED') ? 'MERGED' : st.includes('DECLINED') || st.includes('CLOSED') ? 'DECLINED' : 'OPEN', reverted: /revert/i.test(node.displayName ?? ''), url: node.url }];
  });
}
