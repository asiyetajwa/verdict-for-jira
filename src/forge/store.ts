// Forge storage for receipts. Each project's Verdict Log is an append-only, hash-chained list:
//   log:<PROJECT>:<seq, 8 digits>   the signed receipt
//   head:<PROJECT>                  { seq, hash } of the newest receipt
//   latest:<ISSUE>                  the log key of the issue's newest receipt
// The signing key pair is created on first use and kept as a Forge secret, so nobody has to paste a key anywhere.

import { kvs, WhereConditions } from '@forge/kvs';
import type { Store } from '../core/run';
import { generateKeys, importKeys, type Keys, type SignedReceipt } from '../core/receipt';

type Head = { seq: number; hash: string };
const pad = (n: number) => String(n).padStart(8, '0');

export const forgeStore: Store = {
  async head(project) {
    return (await kvs.get<Head>(`head:${project}`))?.hash ?? null;
  },
  async append(project, r) {
    const seq = ((await kvs.get<Head>(`head:${project}`))?.seq ?? 0) + 1;
    const key = `log:${project}:${pad(seq)}`;
    await kvs.set(key, r);
    await kvs.set(`head:${project}`, { seq, hash: r.hash });
    await kvs.set(`latest:${r.body.issue}`, key);
  },
};

export async function latestFor(issue: string): Promise<{ key: string; receipt: SignedReceipt } | null> {
  const key = await kvs.get<string>(`latest:${issue}`);
  if (!key) return null;
  const receipt = await kvs.get<SignedReceipt>(key);
  return receipt ? { key, receipt } : null;
}

export async function saveReceipt(key: string, r: SignedReceipt): Promise<void> {
  await kvs.set(key, r);
}

/** The project's log, oldest first (up to 500 entries). */
export async function logFor(project: string): Promise<SignedReceipt[]> {
  const out: SignedReceipt[] = [];
  let cursor: string | undefined;
  do {
    let q = kvs.query().where('key', WhereConditions.beginsWith(`log:${project}:`)).limit(100);
    if (cursor) q = q.cursor(cursor);
    const page = await q.getMany<SignedReceipt>();
    out.push(...page.results.map((x) => x.value));
    cursor = page.nextCursor;
  } while (cursor && out.length < 500);
  return out;
}

type StoredKeys = { pkcs8: string; publicRaw: string };

export async function signingKeys(): Promise<Keys & { publicRaw: string }> {
  let k = await kvs.getSecret<StoredKeys>('signing-key');
  if (!k) {
    k = await generateKeys();
    await kvs.setSecret('signing-key', k);
  }
  return { ...(await importKeys(k.pkcs8, k.publicRaw)), publicRaw: k.publicRaw };
}

/** Per-issue attempt counter for the Rovo agent's submit-and-retry loop (reset when a verdict posts). */
export async function nextAttempt(issue: string): Promise<number> {
  const n = ((await kvs.get<number>(`attempt:${issue}`)) ?? 0) + 1;
  await kvs.set(`attempt:${issue}`, n);
  return n;
}
export const resetAttempts = (issue: string) => kvs.delete(`attempt:${issue}`);
