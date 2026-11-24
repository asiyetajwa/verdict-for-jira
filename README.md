# Verdict for Jira

Verdict makes one call on a Jira issue: **Duplicate**, **Ready to Build**, **Blocked** or **Risky**. Every reason is cited to a real object, every citation is checked in code before anything is posted, and every verdict ends with a signed receipt the team can verify.

Built on Atlassian Forge for Codegeist 2026 (Apps for Software Teams). It runs on Atlassian: the model is called through the Forge LLM API, and receipts live in Forge storage.

## Why we built it

We kept hitting the same problem in Jira. Triage was a glance at the ticket on its own, and it kept costing us:

- **The same work was already in our backlog, in different words.** It got built twice, and we found out in code review.
- **The blocker was two links away.** The ticket looked ready, but it was waiting on a service that was waiting on something else.
- **Tickets went against decisions we had already made**, written on Confluence pages nobody opened again.
- **Asking an assistant did not fix it.** It sounded just as sure when it was wrong, and gave us nothing we could check.

So we built the tool we wanted: one call per issue, every reason cited to something real, every citation checked, every verdict signed.

## What Verdict does

1. **Reads the context**:
   - the issue itself;
   - its links, and the blockers behind its blockers (two deep);
   - the Confluence pages it links to or mentions;
   - linked pull requests, from the Teamwork Graph;
   - the most similar issues in the project.
2. **Checks the facts in code first (the evidence floor).** An open blocker, an explicit duplicate link, a reverted precedent and missing acceptance criteria are computed in code, before the model is involved. The floor decides which calls are allowed. The model can add judgement, such as a decision page that contradicts the issue or a duplicate worded differently, but it can never call an issue Ready while a blocker is open.
3. **Asks the model for one call**, through the Forge LLM API, as a structured tool call with cited evidence.
4. **Runs the citation check.** Each citation must resolve to an object Verdict actually read and can open now, and what it asserts about that object must be true (open, done, blocker, duplicate, reverted, decision). Any issue key the wording mentions must be one Verdict read. A proposal that fails gets one retry with the failures fed back. If it still fails, the posted call is Risky, with the reason stated.
5. **Signs a receipt and posts the comment.**
   - The verdict body is hashed (SHA-256 over canonical JSON) and signed with Ed25519.
   - The comment shows the verdict, the evidence, what would change the call, and the receipt.
   - When a person accepts or rejects the call, that is signed as a separate record bound to the verdict's hash, so recording the outcome never breaks the verdict's signature.
   - Every receipt carries the hash of the project's previous one, so the **Verdict Log** is a hash chain: removing or reordering an entry is detectable.

## Where it runs

- **Rovo chat:** ask the Verdict agent "Give this issue a verdict". The agent calls two actions: one gathers the checked context, the other submits its proposal through the citation check.
- **Issue panel:** press Run Verdict. The panel shows the evidence as routes from the issue to what it cites, plus the receipt, its live verification, and Accept and Reject.
- **Label trigger:** add the label `verdict` to an issue.
- **Verdict Log:** a project page with every receipt, the chain check, calls by kind, and how often people agreed.

Assigning an issue to a Forge Rovo agent is not documented, so Verdict does not depend on assignment.

## Evaluation

40 seeded issues with known answers. They include hard cases on purpose:

- duplicates worded with almost no words in common;
- blocker chains two deep;
- decision pages that contradict the issue;
- a reverted precedent;
- a partial overlap that must be Risky, not Duplicate;
- Ready issues whose blockers are already done.

All runs went through the deployed app on a Jira Cloud site (`eval/results.json`):

| Run | Correct | Duplicate | Ready | Blocked | Risky |
|---|---|---|---|---|---|
| The model, full context | **34/40** | 5/10 | 9/10 | 10/10 | 10/10 |
| Rules only, full context | 26/40 | 0/10 | 9/10 | 10/10 | 7/10 |
| The model, issue text alone | 15/40 | 0/10 | 10/10 | 0/10 | 5/10 |

- With full context, all 96 of the model's citations resolved, and it never called a false duplicate (5 of 5 duplicate calls were right).
- An earlier run on the same day scored 35, 16 and 26. Expect about one issue of difference between runs.
- The gap between full context and the issue text alone is what the context is worth.
- Duplicates worded very differently remain the hardest case. There the model chose Risky rather than force a Duplicate call.
- The evaluation set and the similarity thresholds were made by the same team, so the rules-only row is a best case for rules.

Offline, the rules baseline runs without Atlassian: `npm run eval`.

## Install

Production install link: see the Devpost submission. Verdict needs Jira and Confluence on the same site, and Rovo for the chat agent.

## Develop

```bash
npm install
npm run check                       # typecheck, 16 tests, UI build
npm run preview                     # the panel and log with a local stand-in for Forge
node scripts/production-manifest.mjs  # production app without the development-only admin trigger
```

- `src/core/` is the platform-independent engine: the evidence floor, similarity, the citation check, receipts, the comment, and the prompt.
- `src/forge/` is the Forge layer: Jira and Confluence context, the Teamwork Graph, the model, storage and the queue.
- `ui/` holds the Custom UI panel and log.
- `seed/` holds the evaluation project.
- `film/` holds the submission film, built from screens rendered with receipts captured on the live site.

## Licence

MIT. Poppins font files: SIL Open Font License 1.1.
