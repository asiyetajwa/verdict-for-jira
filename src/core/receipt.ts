// Receipts. The verdict body is serialised canonically (sorted keys), hashed with SHA-256 and signed with Ed25519
// (WebCrypto, so the same code verifies in the browser). The human's accept or reject is a second signed record bound
// to the verdict's hash, so recording the outcome never invalidates the verdict signature. Each receipt also carries
// the hash of the project's previous receipt, which makes the Verdict Log a hash chain: removing or editing an entry
// breaks every later link.

const enc = new TextEncoder();
const b64 = (u: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type VerdictBody = {
  product: 'Verdict for Jira';
  receiptId: string;
  issue: string;
  issuedAt: string; // ISO 8601, UTC
  verdict: string;
  why: string;
  evidence: { claim: string; cite: string; asserts: string }[];
  wouldChange: string[];
  context: { consulted: string[]; counts: { jira: number; graph: number; similarity: number }; graphUnavailable: boolean };
  citationCheck: { checked: number; resolved: number; attempts: number };
  decidedBy: string; // e.g. "Rovo agent", "the model via Forge", "rules"
  prevHash: string | null; // hash of the project's previous receipt
};

export type SignedReceipt = {
  body: VerdictBody;
  hash: string; // SHA-256 of canonical(body)
  signature: string; // Ed25519 over the hash
  publicKey: string; // raw public key, base64
  outcome?: SignedOutcome;
};

export type OutcomeBody = { receiptHash: string; outcome: 'accepted' | 'rejected'; by: string; at: string; note?: string };
export type SignedOutcome = { body: OutcomeBody; signature: string };

export type Keys = { privateKey: CryptoKey; publicKey: CryptoKey };

/** Imports the app's signing key from a PKCS#8 base64 string (held in a Forge encrypted variable). */
export async function importKeys(pkcs8B64: string, rawPublicB64: string): Promise<Keys> {
  const privateKey = await crypto.subtle.importKey('pkcs8', unb64(pkcs8B64), { name: 'Ed25519' }, false, ['sign']);
  const publicKey = await crypto.subtle.importKey('raw', unb64(rawPublicB64), { name: 'Ed25519' }, true, ['verify']);
  return { privateKey, publicKey };
}

export async function generateKeys(): Promise<{ pkcs8: string; publicRaw: string }> {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  return { pkcs8: b64(await crypto.subtle.exportKey('pkcs8', kp.privateKey)), publicRaw: b64(await crypto.subtle.exportKey('raw', kp.publicKey)) };
}

export async function signVerdict(body: VerdictBody, keys: Keys): Promise<SignedReceipt> {
  const hash = await sha256(canonical(body));
  const signature = b64(await crypto.subtle.sign({ name: 'Ed25519' }, keys.privateKey, enc.encode(hash)));
  return { body, hash, signature, publicKey: b64(await crypto.subtle.exportKey('raw', keys.publicKey)) };
}

export async function signOutcome(r: SignedReceipt, outcome: OutcomeBody['outcome'], by: string, keys: Keys, note?: string): Promise<SignedReceipt> {
  const body: OutcomeBody = { receiptHash: r.hash, outcome, by, at: new Date().toISOString(), note };
  const signature = b64(await crypto.subtle.sign({ name: 'Ed25519' }, keys.privateKey, enc.encode(canonical(body))));
  return { ...r, outcome: { body, signature } };
}

export type Check = { valid: boolean; reason: string };

/** Verifies a receipt against the public key it carries: the hash, the verdict signature, and the outcome if any. */
export async function verifyReceipt(r: SignedReceipt): Promise<Check> {
  try {
    const key = await crypto.subtle.importKey('raw', unb64(r.publicKey), { name: 'Ed25519' }, false, ['verify']);
    const hash = await sha256(canonical(r.body));
    if (hash !== r.hash) return { valid: false, reason: 'The verdict was changed after it was signed: its hash no longer matches.' };
    if (!(await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64(r.signature), enc.encode(hash)))) {
      return { valid: false, reason: 'The verdict signature does not match this key.' };
    }
    if (r.outcome) {
      if (r.outcome.body.receiptHash !== r.hash) return { valid: false, reason: 'The recorded outcome belongs to a different verdict.' };
      if (!(await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64(r.outcome.signature), enc.encode(canonical(r.outcome.body))))) {
        return { valid: false, reason: 'The recorded outcome was changed after it was signed.' };
      }
    }
    return { valid: true, reason: r.outcome ? `Verdict and ${r.outcome.body.outcome} outcome both verify.` : 'The verdict verifies; no outcome recorded yet.' };
  } catch (e) {
    return { valid: false, reason: `The receipt could not be checked: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Verifies a project's chain of receipts, oldest first. */
export async function verifyChain(chain: SignedReceipt[]): Promise<Check> {
  for (let i = 0; i < chain.length; i++) {
    const r = chain[i];
    if (!r) continue;
    const c = await verifyReceipt(r);
    if (!c.valid) return { valid: false, reason: `Receipt ${r.body.receiptId}: ${c.reason}` };
    const prev = i === 0 ? null : chain[i - 1]?.hash ?? null;
    if (r.body.prevHash !== prev) return { valid: false, reason: `The log is broken before ${r.body.receiptId}: an entry was removed or reordered.` };
  }
  return { valid: true, reason: `All ${String(chain.length)} receipts verify and the chain is unbroken.` };
}

export function receiptId(): string {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return `VRD-R-${(n[0] ?? 0).toString(36).toUpperCase()}${(n[1] ?? 0).toString(36).toUpperCase()}`.slice(0, 14);
}
