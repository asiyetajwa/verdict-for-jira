// Records several takes of every line, transcribes each one, and keeps the take whose words match the script exactly
// with no stutter (no repeated word, no false start) and no long gap. Each line is read with its neighbours as context
// so the intonation carries across scene joins. Writes the chosen clips, the manifest the film reads, and a report of
// every take (transcript, match, longest pause).
//
//   ELEVENLABS_API_KEY=... node scripts/takes.mjs verdict [takes=3] [outDir=public/voiceover/verdict]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
const film = process.argv[2] ?? 'verdict';
const takes = Number(process.argv[3] ?? 3);
const outDir = process.argv[4] ?? `public/voiceover/${film}`;
// The narrator of the hackathon films: "Brian" (deep, resonant, American, male) from the ElevenLabs default library.
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'nPczCjzI2devNBz1zQrb';
const modelId = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
const settings = { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.0 };

const source = readFileSync(`src/${film}/script.ts`, 'utf8');
const scenes = [...source.matchAll(/id: '(\w+)',\s*voiceover:\s*\n?\s*(['"])(.*?)\2,/gs)].map((m) => ({ id: m[1], text: m[3].replace(/\\'/g, "'") }));
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
mkdirSync(`${outDir}/takes`, { recursive: true });

const words = (t) => t.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const repeats = (ws) => ws.filter((w, i) => i > 0 && w === ws[i - 1] && !['that', 'had', 'very'].includes(w));
const seconds = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
function pauseOf(f) {
  // Longest silence inside the trimmed take (the ends are already trimmed), from ffmpeg's silencedetect.
  const r = execFileSync('bash', ['-c', 'ffmpeg -v info -i "$0" -af silencedetect=noise=-42dB:d=0.25 -f null - 2>&1', f]).toString();
  return Math.max(0, ...[...r.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1])));
}

async function tts(text, previous, next) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: modelId, previous_text: previous, next_text: next, voice_settings: settings }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${String(res.status)}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function stt(file) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), 'take.mp3');
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
  if (!res.ok) throw new Error(`ElevenLabs STT ${String(res.status)}: ${await res.text()}`);
  return (await res.json()).text ?? '';
}

// Trim the ends at -60 dB keeping 70 ms of air, with short fades, so first words keep their soft starts.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.07,afade=t=in:d=0.02,areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.07,afade=t=in:d=0.03,areverse,apad=pad_dur=0.05';

let existing = { clips: [] };
try { existing = JSON.parse(readFileSync(`${outDir}/manifest.json`, 'utf8')); } catch {}
const report = [];
const clips = [];
for (const [i, sc] of scenes.entries()) {
  if (only && !only.has(sc.id)) {
    const kept = existing.clips.find((c) => c.id === sc.id);
    if (kept) clips.push(kept);
    continue;
  }
  const previous = scenes[i - 1]?.text ?? '';
  const next = scenes[i + 1]?.text ?? '';
  const target = words(sc.text);
  const rows = [];
  for (let t = 1; t <= takes; t++) {
    const raw = `${outDir}/takes/${sc.id}-${String(t)}.raw.mp3`;
    const cut = `${outDir}/takes/${sc.id}-${String(t)}.mp3`;
    writeFileSync(raw, await tts(sc.text, previous, next));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', TRIM, '-c:a', 'libmp3lame', '-b:a', '192k', cut]);
    const heard = await stt(cut);
    const hw = words(heard);
    const row = { take: t, file: cut, seconds: seconds(cut), heard, distance: distance(target, hw), repeated: repeats(hw), longestPause: pauseOf(cut) };
    rows.push(row);
    console.log(`${sc.id} take ${String(t)}: distance ${String(row.distance)}, repeats [${row.repeated.join(' ')}], longest pause ${row.longestPause.toFixed(2)}s, ${row.seconds.toFixed(2)}s`);
    if (row.distance === 0 && row.repeated.length === 0 && row.longestPause < 0.75 && t >= 2) break;
  }
  // Clean first (exact words, no repeats), then the shortest longest-pause, then the closest words.
  const best = [...rows].sort((a, b) => (a.distance === 0 && !a.repeated.length ? 0 : 1) - (b.distance === 0 && !b.repeated.length ? 0 : 1) || a.distance - b.distance || a.longestPause - b.longestPause)[0];
  copyFileSync(best.file, `${outDir}/${sc.id}.mp3`);
  clips.push({ id: sc.id, file: `voiceover/${film}/${sc.id}.mp3`, seconds: best.seconds });
  report.push({ id: sc.id, script: sc.text, chosen: best.take, clean: best.distance === 0 && best.repeated.length === 0, takes: rows.map(({ file, ...r }) => r) });
}
// A quiet music bed, generated once (MUSIC=1), kept across re-reads.
let music = existing.music;
if (process.env.MUSIC === '1') {
  const total = clips.reduce((a, c) => a + c.seconds, 0) + scenes.length * 1.2 + 10;
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Calm, modern, minimal instrumental bed for a software product film. Soft warm synth pads, a gentle muted pulse, light glassy plucks, no drums for the first bars, slow build, no vocals, steady and unobtrusive under narration.', music_length_ms: Math.min(300000, Math.round(total * 1000)) }),
  });
  if (!res.ok) throw new Error(`ElevenLabs music ${String(res.status)}: ${await res.text()}`);
  mkdirSync(`${outDir}/../../music`, { recursive: true });
  writeFileSync(`${outDir}/../../music/${film}-bed.mp3`, Buffer.from(await res.arrayBuffer()));
  music = `music/${film}-bed.mp3`;
}
writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ voiceId, modelId, music, musicStart: existing.musicStart ?? 0, clips }, null, 2));
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
const dirty = report.filter((r) => !r.clean).map((r) => r.id);
console.log(dirty.length ? `NOT CLEAN: ${dirty.join(', ')}` : 'All lines clean.');
