// Verdict for Jira, the Codegeist 2026 film. The problem first, told as our own (we kept hitting it in Jira, so we
// built Verdict), then the product answering each part of it.
// Copy rules: the product is Verdict for Jira, the model is never named, no em dashes, and every number and verdict on
// screen comes from the live site: the screens are the real panel rendered from receipts in film/fixtures, and the
// numbers are eval/results.json. Voiceover: node scripts/voiceover.mjs verdict (one clip per scene).

import type { SceneSpec } from '../components/Film';

export type SceneId =
  | 'hook' | 'twice' | 'chain' | 'decision' | 'trust'
  | 'title' | 'reads' | 'blocked' | 'risky' | 'duplicate'
  | 'check' | 'receipt' | 'log' | 'numbers' | 'where' | 'close';

export const SCENES: SceneSpec<SceneId>[] = [
  { id: 'hook', voiceover: 'We kept running into the same problem in Jira. Every sprint, someone picked up a ticket, and almost nobody checked what was sitting around it.', minSeconds: 3 },
  { id: 'twice', voiceover: 'We had the same work in our backlog twice, written in completely different words. It got built twice, and we only found out in code review.', minSeconds: 3 },
  { id: 'chain', voiceover: 'We picked up tickets that looked ready, but they were waiting on a service that was waiting on something else. The block was two links away, so we only saw it when the work stalled.', minSeconds: 3 },
  { id: 'decision', voiceover: 'And we started tickets that went against decisions we had already made, written on pages nobody opened again. Like this one, which asks to store card numbers, when our decision says we never store them.', minSeconds: 3 },
  { id: 'trust', voiceover: 'We tried asking an assistant. It sounded just as sure when it was wrong, and it gave us nothing we could check.', minSeconds: 3 },
  { id: 'title', voiceover: 'So we built the tool we wanted: Verdict for Jira. It makes one call on an issue: Duplicate, Ready to Build, Blocked, or Risky. Every reason is cited, checked, and signed.', minSeconds: 3 },
  { id: 'reads', voiceover: 'Verdict reads the issue, its links, the blockers behind its blockers, the Confluence pages it points to, and similar issues in the project. Before the model says a word, the facts are checked in code, and only the calls those facts allow are on the table.', minSeconds: 3 },
  { id: 'blocked', voiceover: 'Here it follows the chain. The push notification ticket is Blocked by the push service, which is still waiting on the Apple developer account. Both links are cited, and both are real.', minSeconds: 3 },
  { id: 'risky', voiceover: 'Here it reads the decision page. Storing card numbers would break a final decision from Security and Payments, so the call is Risky, and the page is named.', minSeconds: 3 },
  { id: 'duplicate', voiceover: 'And here it sees past the wording. Lost payment events are the same work as the webhook retry ticket, so the call is Duplicate, with the acceptance criteria matched.', minSeconds: 3 },
  { id: 'check', voiceover: 'Nothing posts until every citation passes a check. The object has to exist, and what the verdict says about it has to be true. A made up ticket is refused. The model gets one retry, and if it still cannot prove its case, the call drops to Risky.', minSeconds: 3 },
  { id: 'receipt', voiceover: 'Each verdict ends with a cryptographically signed receipt. Change a single word, and it no longer verifies. When someone on the team accepts or rejects the call, that is signed too, and tied to the verdict.', minSeconds: 3 },
  { id: 'log', voiceover: 'The Verdict Log chains every receipt in the project together. Take one out, and the chain breaks.', minSeconds: 3 },
  { id: 'numbers', voiceover: 'We tested it on forty issues with known answers, through the app itself. With the full context, the model got thirty four right. With the issue text alone, it got fifteen. Rules on their own got twenty six. Every one of its ninety six citations checked out, and it never called a false duplicate.', minSeconds: 3 },
  { id: 'where', voiceover: 'Ask the Verdict agent in Rovo, press Run Verdict in the issue panel, or add the label verdict to any issue. It is built on Forge, and it runs on Atlassian.', minSeconds: 3 },
  { id: 'close', voiceover: 'Verdict for Jira. Know what you are building, before you build it.', minSeconds: 6 },
];
