# Verdict for Jira

An assignable Rovo agent for Jira, built on Atlassian Forge for Codegeist 2026 (Apps for Software Teams).

Assign Verdict an issue and it reads the issue plus its Teamwork Graph context (linked issues, Confluence decision pages, Bitbucket pull requests, prior similar issues) and posts a plain-English verdict: Duplicate, Ready to Build, Blocked, or Risky. Every claim is cited to a real linked object, every citation is machine-checked before the verdict posts, and every verdict closes with an Ed25519-signed receipt the team can verify, with the human accept or reject recorded on it.

## Status

Build spec complete. Build window: Dec 5 to 9, 2026. Submission package target: Dec 15, 2026. Codegeist submissions close Dec 22, 2026.

## Documents

- [SPEC.md](SPEC.md): the full build spec (product, architecture, verification loop, seeded evaluation, film and submission checklist).

## Licence

MIT
