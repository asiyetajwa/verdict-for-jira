# Verdict for Jira: working notes

- Hackathon entry for Codegeist 2026 (Apps for Software Teams). Copy and the film tell the problem as one **we experienced ourselves** using Jira, in our own voice ("we kept hitting this, so we built Verdict"), then show the solution answering each part (owner rule, 2026-11-24).
- Public copy: the product is Verdict for Jira; the model stays generic ("the model"); no em dashes; Title Case for calls to action.
- Every number in the film, README and submission comes from `eval/results.json` (a run through the deployed app); every screen in the film is the real panel rendered from receipts in `film/fixtures`.
- Narration: ElevenLabs voice "Brian" (male, American, `nPczCjzI2devNBz1zQrb`, `eleven_multilingual_v2`, stability 0.5, style 0.3). The key lives as `ELEVENLABS_API_KEY` in the Dribble360/Dribble repository's Actions secrets; takes are recorded by that repository's `verdict-voiceover.yml` workflow on the session branch, and the finished film is checked word for word by `verdict-film-check.yml`.
- Production deploys use `scripts/production-manifest.mjs` (no admin web trigger, no seeding scopes).
