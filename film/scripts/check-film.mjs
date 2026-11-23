// Checks the finished film's narration as it plays: transcribes the whole soundtrack with word timings, compares the
// words with the full script, and lists repeated words (stutters), words missing or added, and every pause between
// words longer than PAUSE seconds (default 1.2), so a join that stalls or rushes shows up.
//   ELEVENLABS_API_KEY=... node scripts/check-film.mjs release/Verdict.mp4 verdict
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
const [video = 'release/Verdict.mp4', film = 'verdict'] = process.argv.slice(2);
const maxPause = Number(process.env.PAUSE ?? 1.2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', 'film-audio.mp3']);

const form = new FormData();
form.append('model_id', 'scribe_v1');
form.append('timestamps_granularity', 'word');
form.append('file', new Blob([readFileSync('film-audio.mp3')], { type: 'audio/mpeg' }), 'film.mp3');
const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
if (!res.ok) throw new Error(`STT ${String(res.status)}: ${await res.text()}`);
const stt = await res.json();
const heardWords = (stt.words ?? []).filter((w) => w.type === 'word');

const norm = (t) => t.toLowerCase().replace(/-/g, ' ').replace(/summarize/g, 'summarise').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
const source = readFileSync(`src/${film}/script.ts`, 'utf8');
const script = norm([...source.matchAll(/voiceover:\s*\n?\s*(['"])(.*?)\1,/gs)].map((m) => m[2].replace(/\\'/g, "'")).join(' '));
const heard = heardWords.flatMap((w) => norm(w.text).map((t) => ({ t, start: w.start, end: w.end })));

// Word alignment (edit distance with backtrace) to list exactly what differs.
const a = script, b = heard.map((h) => h.t);
const d = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0).map((_, j) => (i === 0 ? j : j === 0 ? i : 0)));
for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
const diffs = [];
for (let i = a.length, j = b.length; i > 0 || j > 0;) {
  if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
    if (a[i - 1] !== b[j - 1]) diffs.push(`at ${heard[j - 1].start.toFixed(1)}s: script "${a[i - 1]}", heard "${b[j - 1]}"`);
    i--; j--;
  } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) { diffs.push(`at ${heard[j - 1].start.toFixed(1)}s: extra "${b[j - 1]}"`); j--; }
  else { diffs.push(`missing "${a[i - 1]}" near script word ${String(i)}`); i--; }
}
const repeats = heard.filter((h, i) => i > 0 && h.t === heard[i - 1].t && !['that', 'had'].includes(h.t)).map((h) => `"${h.t}" twice at ${h.start.toFixed(1)}s`);
const pauses = heard.slice(1).map((h, i) => ({ at: heard[i].end, gap: h.start - heard[i].end, after: heard[i].t, before: h.t })).filter((p) => p.gap > maxPause).map((p) => `${p.gap.toFixed(2)}s after "${p.after}" at ${p.at.toFixed(1)}s, before "${p.before}"`);
const gaps = heard.slice(1).map((h, i) => h.start - heard[i].end).filter((g) => g > 0.2).sort((x, y) => x - y);
const report = { words: { script: a.length, heard: b.length, distance: d[a.length][b.length] }, diffs: diffs.reverse(), repeats, pausesOver: { limit: maxPause, list: pauses }, pauseSpread: { count: gaps.length, median: gaps[Math.floor(gaps.length / 2)] ?? 0, max: gaps.at(-1) ?? 0 }, transcript: stt.text };
writeFileSync('film-check.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, transcript: undefined }, null, 2));
