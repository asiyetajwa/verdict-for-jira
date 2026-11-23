# Verdict for Jira: Build Spec

Codegeist 2026 (Atlassian, Devpost). Category: Apps for Software Teams.
Submissions close Dec 22, 2026, 12:00 PM PST. Build window: Dec 5 to Dec 9, 2026 (after Kiroween closes Dec 4). Submission package target: Dec 15, 2026.
Owner of the build: SZA. Concept approved by Brian on Nov 23, 2026.

## 1. The product in one line

Verdict is an assignable Rovo agent for Jira: assign it an issue, and it reads the issue plus its Teamwork Graph context and posts a plain-English verdict (Duplicate, Ready to Build, Blocked, or Risky) with every claim cited to a real linked object, closed out by a signed receipt the team can check later.

Page line: "Assign the issue to Verdict. Get the call, the evidence, and the receipt."

## 2. Why this shape wins (the host-technology test)

Codegeist judges on five criteria at 20 percent each: Technological Implementation, Design, Potential Impact, Innovation, Presentation. The whole build is shaped so Atlassian's newest stack does the core work:

- Remove Rovo and there is no agent: Verdict is a `rovo:agent` module, assignable like a teammate, not a chatbot bolted onto Jira.
- Remove the Teamwork Graph and there is no context: the verdict is computed from graph-linked objects (linked issues, Confluence decision pages, Bitbucket pull requests, prior similar issues), not from the issue text alone.
- Verification loop built in: every evidence citation must resolve to a real object, a checker pass validates the citations before the verdict posts, and the human's accept or reject is recorded on the receipt.
- A number a judge can repeat: a seeded demo project with a known answer set (Section 7), so the submission quotes measured verdict accuracy per class, not adjectives.

Bonus coverage (one Grand plus one Bonus is the max per submission; breadth gives the judges lanes to reward):
1. Best Agents, Rovo/Assignable agents: core build, `rovo:agent` plus reusable `rovo:action` modules.
2. Best apps with Teamwork Graph integration: core build, consumes the TWG API and writes the verdict back as a graph-visible comment and issue property.
3. Best app with Atlassian MCP: stretch, the Forge app exposes an MCP server so outside agents can request a verdict as a tool.
4. Best Marketplace published app: paperwork stretch, submit the app for Marketplace listing and include the review ticket link in the submission.

## 3. What the user sees

1. A developer or lead assigns a Jira issue to the Verdict agent (or invokes it from the issue panel).
2. The issue panel shows the run live: context being gathered (counts by source: linked issues, pages, pull requests, similar issues), then the verdict.
3. The verdict posts as an issue comment in a fixed shape:
   - Verdict: one of Duplicate / Ready to Build / Blocked / Risky, in plain English, one or two sentences saying why.
   - Evidence: each reason cited to a specific object (issue key, page title, PR number) with a link. No uncited claims.
   - What would change this call: the one or two facts that would flip the verdict (for example, "link the blocking issue as resolved" or "add acceptance criteria").
   - Receipt block (Section 6).
4. The assignee accepts or rejects the verdict in the panel. Either way the outcome is written to the receipt, so the track record is visible on the issue itself.
5. A project-level Verdict Log panel (Jira project page) lists past verdicts, outcomes, and the running accuracy against human decisions.

## 4. The four verdicts

- Duplicate: a prior issue covers the same work. Must cite the original issue and the overlap. If the match is only partial, the verdict is Risky with the near-duplicate cited, never a forced Duplicate.
- Ready to Build: description and acceptance criteria are present, no open blockers, no unresolved conflicting decision in linked pages.
- Blocked: at least one linked blocker is unresolved, or a dependency named in the issue is not in a done state. Must cite the blocking object.
- Risky: anything that makes building now a gamble: missing acceptance criteria, a linked decision page that contradicts the issue, a similar past issue that failed or was reverted, or scope that spans teams with no owner. Must cite the risk source.

The agent must always pick exactly one verdict and must never invent an object. If context is too thin to judge, the verdict is Risky with the missing context named as the risk.

## 5. Architecture (Forge)

One Forge app, TypeScript, deployed on a free Atlassian developer site.

Manifest modules:
- `rovo:agent`: the Verdict agent, assignable, with the verdict instructions as its prompt. Actions below are its tools.
- `rovo:action` modules (also reusable by other agents, which the Rovo bonus rewards):
  - `getIssueContext`: issue fields, comments, status, links, via the Jira REST API.
  - `getGraphContext`: Teamwork Graph API queries for linked work, pages, pull requests, people, and goals around the issue.
  - `findSimilarIssues`: JQL plus text similarity over project history for duplicate and precedent detection.
  - `checkCitations`: the verification pass (Section 6).
  - `issueVerdict`: posts the verdict comment, writes the receipt to an issue property, and logs the run.
- `jira:issuePanel`: the Verdict panel on the issue (run state, verdict, evidence, accept/reject, receipt verify).
- `jira:projectPage` (or an issue panel equivalent if time is tight): the Verdict Log.
- Stretch: a Forge web trigger exposing an MCP server with one tool, `requestVerdict(issueKey)`, returning the verdict and receipt.

Data rules:
- All reads go through Forge app permissions (`api.asApp()` / `asUser()` as the action requires). No external servers, no data leaves Atlassian except the model call Rovo itself makes.
- The verdict prompt names the model only as "the model" in anything user-facing. Rovo and Forge are named freely; they are the host technology and the rules require them identifiable.
- Verdict runs are stored as issue properties (receipt JSON) plus Forge storage for the project log index.

## 6. The receipt and the verification loop

Two independent checks stand between the model and the team:

1. Citation check: before posting, `checkCitations` resolves every cited object (issue key exists, page exists, PR exists, link state as claimed, for example a cited blocker really is unresolved). A verdict with a citation that fails to resolve does not post; the agent re-gathers and retries once, then posts Risky naming the unverifiable evidence.
2. Human check: accept or reject in the panel, written back to the receipt. The Verdict Log's accuracy figure is computed from these outcomes.

Receipt (posted on the issue, stored as an issue property):
- Receipt id, issue key, timestamp (UTC).
- Verdict given, and the list of context objects consulted (keys and ids, counts by source).
- Citation check result: citations checked, citations resolved.
- Human outcome: pending, accepted, or rejected (updated in place when the human decides).
- SHA-256 hash of the verdict body plus context list.
- Ed25519 signature of that hash, with the public key shown and a Verify control in the panel that re-checks the signature in the browser.

Signing key: generated once for the app, private key held in a Forge environment variable, never in the repo. Losing it is acceptable for the demo; note the rotation procedure in the README.

## 7. The seeded demo project and the number

Seed one Jira project (script in the repo, idempotent) with 40 issues carrying a known answer set:
- 10 planted duplicates (pairs with real overlap, varied wording so text match alone is not enough).
- 10 blocked (linked blockers in open states, chains two deep in at least two cases).
- 10 risky (missing acceptance criteria, contradicting Confluence decision pages, one reverted precedent).
- 10 ready (complete, unblocked, with linked decision pages that agree).

Also seed the linked Confluence pages and, where the developer site allows, Bitbucket pull requests; where PRs cannot be seeded, cite linked issues and pages only and say so in the README.

Eval run: run Verdict over all 40, score against the answer set, and publish in the README and the film: overall accuracy, per-class accuracy, duplicate precision and recall, citation resolution rate (target 100 percent, it is enforced), and human accept rate on the demo set. Judges can re-run the seed script and the eval themselves; that repeatability is the point.

## 8. Design and the aesthetic

Brian will send the app's aesthetic himself, directly to SZA. Until it lands: build the mechanics and the panel skeleton with plain Forge UI Kit components, no final colours, no final styling pass. The verdict comment shape in Section 3 is content design, not visual design, and is fixed by this spec. When the aesthetic arrives, apply it to the panel and the project page only; the comment renders in Jira markdown and stays as specced.

## 9. Demo film (under 5 minutes, public YouTube)

Codegeist requires a public video under 5 minutes showing the project working end to end. Target 3 minutes:
1. The problem in one line: triage calls made on issue text alone, with no memory of what the graph already knows.
2. Assign a planted duplicate to Verdict: verdict, evidence, receipt, live.
3. A blocked issue and a risky issue, one of them showing "what would change this call".
4. The citation check catching a bad citation (stage it honestly with the seeded set if a natural case does not occur).
5. The eval number on screen: accuracy per class on the 40-issue seeded project.
6. Close: Rovo agent, Teamwork Graph, signed receipt. Built on Forge.

Narration rules (Brian's standing order, no exceptions): generate narration per scene, never one long take; audition every clip in full; any stutter, stammer, repeated or swallowed word fails the clip and it is regenerated; check every join; one full listen of the final render before delivery; the delivery report states the clean listen explicitly or the film is not delivered.

## 10. Submission package checklist

- Forge app deployed; installation link for judges created (Share your app flow) and tested from a clean browser.
- Category declared: Apps for Software Teams. Bonuses declared: Rovo/Assignable agents, Teamwork Graph integration; Atlassian MCP and Marketplace added only if those stretches actually ship.
- Devpost text: what it does, how Rovo and the Teamwork Graph are load-bearing, the eval numbers, how to install and test. No em dashes anywhere in the copy.
- Public repo with an open-source licence, README with seed and eval instructions, architecture diagram.
- Screenshots of the panel, a verdict comment, and the Verdict Log.
- Film uploaded, public, under 5 minutes, link on the form.
- Submit by Dec 15, 2026, a full week ahead of the deadline.

## 11. Build order

1. Setup (can start immediately): Atlassian developer site, Jira site with Rovo available, Forge CLI, app scaffold, hello-world agent assigned to an issue.
2. Day 1: agent prompt, `getIssueContext`, `findSimilarIssues`, verdict comment posting.
3. Day 2: `getGraphContext` (Teamwork Graph), `issueVerdict` with receipt and signing, issue panel.
4. Day 3: citation check, accept/reject write-back, seed script, first eval run.
5. Day 4: Verdict Log, eval polish, MCP stretch if the core is solid, README.
6. Day 5: film, screenshots, Marketplace listing submission if time allows, Devpost package, submit.

## 12. Standing instructions for this build

- SZA owns the build. Brian sends the aesthetic directly; wait for it before any styling pass.
- Improve this spec where you see a change that raises the chance of winning: stronger use of Rovo or the Teamwork Graph, a tighter verification loop, a better quantified result, wider genuine bonus coverage. You have licence to improve it. Report every material change you make to the spec, with the reason, in your reply to this hand-off, so the record stays straight.
- Public copy rules: the inference model stays generic ("the model"); no em dashes in any copy, README, film script, or submission text; the entry is presented as a new project built for Codegeist.
- Report back at three points: scaffold live (agent assignable), first full verdict posted with a verified receipt, and eval numbers in. Do not wait for the end to surface a blocker.
