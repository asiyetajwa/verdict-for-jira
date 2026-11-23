// Small DOM helpers shared by the panel and the log. Text always goes in through textContent, never innerHTML.
import { invoke, router } from '@forge/bridge';

/** Typed resolver call. */
export const call = <T>(name: string, payload: Record<string, unknown> = {}): Promise<T> => invoke(name, payload) as unknown as Promise<T>;

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
export function s(tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

/** Links leave the iframe through the Forge router. */
export function link(label: string, url?: string): HTMLElement {
  if (!url) return h('strong', {}, label);
  return h('a', { href: url, onclick: (e: Event) => { e.preventDefault(); void router.open(url); } }, label);
}

export const LABEL: Record<string, string> = { DUPLICATE: 'Duplicate', READY: 'Ready to Build', BLOCKED: 'Blocked', RISKY: 'Risky' };

export function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'V';
}

export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = h('textarea', {}, t);
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const ICON = {
  grid: () => s('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, s('rect', { x: 4, y: 4, width: 6, height: 6, rx: 1.5 }), s('rect', { x: 14, y: 4, width: 6, height: 6, rx: 1.5 }), s('rect', { x: 4, y: 14, width: 6, height: 6, rx: 1.5 }), s('rect', { x: 14, y: 14, width: 6, height: 6, rx: 1.5 })),
  shield: () => s('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, s('path', { d: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z' }), s('path', { d: 'M9 12l2 2 4-4' })),
  key: () => s('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, s('circle', { cx: 8, cy: 15, r: 4 }), s('path', { d: 'M11 12l9-9M17 6l3 3' })),
  check: () => s('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }, s('path', { d: 'M5 12l5 5 9-10' })),
  cross: () => s('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 }, s('path', { d: 'M6 6l12 12M18 6L6 18' })),
};
