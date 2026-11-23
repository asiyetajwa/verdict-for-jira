// Text similarity over a project's issues, for duplicate and precedent detection. TF-IDF over unigrams and bigrams
// with light stemming, cosine similarity. Deterministic and explainable: each hit carries the terms it shares.

const STOP = new Set(('a an and are as at be been but by can could did do does for from had has have how i if in into is it its '
  + 'let me my no not of on or our should so than that the their them then there these they this to up us was we were what '
  + 'when which while who will with would you your also just only all any each per via vs etc please need needs want wants '
  + 'make makes made using use used able get gets new add adds added issue ticket task story bug feature '
  + 'acceptance criteria definition done given then').split(' '));

/** Crude English stemmer: enough to fold plurals and common verb endings. */
function stem(w: string): string {
  if (w.length <= 4) return w;
  for (const suf of ['ations', 'ation', 'ingly', 'ings', 'ing', 'edly', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 's', 'ly']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === 'ies' || suf === 'ied' ? `${base}y` : base;
    }
  }
  return w;
}

export function terms(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  const grams = words.slice(0, -1).map((w, i) => `${w}_${words[i + 1] ?? ''}`);
  return [...words, ...grams];
}

export type Doc = { id: string; text: string };

export class Index {
  private readonly vecs = new Map<string, Map<string, number>>();
  private readonly idf = new Map<string, number>();

  constructor(docs: Doc[]) {
    const df = new Map<string, number>();
    const tfs = docs.map((d) => {
      const tf = new Map<string, number>();
      for (const t of terms(d.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      return { id: d.id, tf };
    });
    const n = docs.length;
    for (const [t, c] of df) this.idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
    for (const { id, tf } of tfs) this.vecs.set(id, this.weigh(tf));
  }

  private weigh(tf: Map<string, number>): Map<string, number> {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * (this.idf.get(t) ?? Math.log(2));
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  }

  /** Most similar documents to `id` (excluding itself), best first, with the strongest shared terms. */
  similar(id: string, limit = 5): { id: string; score: number; shared: string[] }[] {
    const q = this.vecs.get(id);
    if (!q) return [];
    const out: { id: string; score: number; shared: string[] }[] = [];
    for (const [other, v] of this.vecs) {
      if (other === id) continue;
      let s = 0;
      const shared: [string, number][] = [];
      for (const [t, w] of q) {
        const o = v.get(t);
        if (o !== undefined) {
          s += w * o;
          shared.push([t, w * o]);
        }
      }
      if (s > 0) out.push({ id: other, score: s, shared: shared.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t.replace('_', ' ')) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
