// Renders one preview still per scene (late in each scene, once its choreography has played) for layout review.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
const src = readFileSync('src/verdict/script.ts', 'utf8');
const scenes = [...src.matchAll(/id: '(\w+)',[\s\S]*?minSeconds: ([\d.]+)/g)].map((m) => ({ id: m[1], s: Number(m[2]) }));
let manifest = null;
try { manifest = JSON.parse(readFileSync('public/voiceover/verdict/manifest.json', 'utf8')); } catch {}
const browser = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p));
const out = process.argv[2] ?? 'out/stills';
mkdirSync(out, { recursive: true });
let t = 0;
const frames = [];
for (const sc of scenes) {
  const clip = manifest?.clips.find((c) => c.id === sc.id);
  const len = Math.max(Math.round(sc.s * 30), clip ? Math.ceil((clip.seconds + 0.5) * 30) : 0);
  frames.push([sc.id, t + Math.round(len * 0.8)]);
  t += len - 6;
}
for (const [id, f] of frames) {
  const args = ['remotion', 'still', 'src/index.ts', 'Verdict', `${out}/${id}.png`, `--frame=${String(f)}`, '--scale=0.5', '--log=error'];
  if (browser) args.push(`--browser-executable=${browser}`);
  execFileSync('npx', args, { stdio: 'inherit' });
  console.log(id, f);
}
