// Writes the production manifest: manifest.yml without the development-only admin web trigger and the scopes that
// only seeding needs. The production app keeps the smallest permissions and stays eligible for Runs on Atlassian.
//   node scripts/production-manifest.mjs <out-dir>
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEV_SCOPES = ['manage:jira-project', 'manage:jira-configuration', 'write:page:confluence', 'read:space:confluence', 'write:confluence-space'];
const out = resolve(process.argv[2] ?? '.forge-production');
const lines = readFileSync('manifest.yml', 'utf8').split('\n');
const kept = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l === '  webtrigger:') {
    while (i + 1 < lines.length && /^ {4,}/.test(lines[i + 1])) i++;
    continue;
  }
  if (l === '    - key: admin-fn') {
    while (i + 1 < lines.length && /^ {6,}/.test(lines[i + 1])) i++;
    continue;
  }
  if (DEV_SCOPES.some((s) => l.trim() === `- ${s}`)) continue;
  kept.push(l);
}
const manifest = kept.join('\n');
for (const needle of ['webtrigger', 'admin-fn', ...DEV_SCOPES]) if (manifest.includes(needle)) throw new Error(`production manifest still contains ${needle}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.yml`, manifest);
for (const p of ['src', 'seed', 'static', 'prompts', 'node_modules']) symlinkSync(resolve(p), `${out}/${p}`);
for (const f of ['package.json', 'package-lock.json', 'tsconfig.json']) if (existsSync(f)) cpSync(f, `${out}/${f}`);
console.log(`production app in ${out}`);
