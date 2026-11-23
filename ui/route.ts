// The evidence route: the issue (A) on the left, each cited object (B) on the right, joined by glowing paths over a
// dark street grid, after the map in the reference. A failed citation would draw red; posted verdicts only carry
// citations that passed.
import { s } from './common';

export type RouteStop = { id: string; label: string; status?: string; asserts: string };

function streets(w: number, hgt: number, seed: number): SVGElement {
  const g = s('g');
  let x = seed % 17;
  const rnd = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  for (let i = 0; i < 26; i++) {
    const y = rnd() * hgt;
    const tilt = (rnd() - 0.5) * 40;
    g.append(s('path', { class: i % 6 === 0 ? 'street major' : 'street', d: `M0 ${y.toFixed(1)} L${w} ${(y + tilt).toFixed(1)}` }));
  }
  for (let i = 0; i < 30; i++) {
    const xx = rnd() * w;
    const tilt = (rnd() - 0.5) * 30;
    g.append(s('path', { class: i % 7 === 0 ? 'street major' : 'street', d: `M${xx.toFixed(1)} 0 L${(xx + tilt).toFixed(1)} ${hgt}` }));
  }
  return g;
}

const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}...` : t);

export function route(subjectId: string, subjectTitle: string, stops: RouteStop[]): HTMLElement {
  const w = 560;
  const rowH = 54;
  const hgt = Math.max(150, 40 + stops.length * rowH);
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, role: 'img', 'aria-label': `${subjectId} and the ${String(stops.length)} objects its verdict cites` });
  svg.append(streets(w, hgt, subjectId.length * 31 + stops.length));
  const ax = 56;
  const ay = hgt / 2;
  stops.forEach((st, i) => {
    const bx = w - 200;
    const by = 32 + i * rowH + (hgt - 32 - stops.length * rowH) / 2 + rowH / 2 - 8;
    // An orthogonal-ish route with one bend, like a street path.
    const mid = ax + (bx - ax) * (0.45 + (i % 3) * 0.08);
    const d = `M${ax} ${ay} L${mid.toFixed(1)} ${ay} L${(mid + 22).toFixed(1)} ${by.toFixed(1)} L${bx} ${by.toFixed(1)}`;
    const len = Math.abs(mid - ax) + Math.hypot(22, by - ay) + Math.abs(bx - mid - 22);
    const p = s('path', { class: 'path', d, style: `--len:${len.toFixed(0)};animation-delay:${String(i * 0.12)}s` });
    svg.append(p);
    svg.append(s('circle', { class: 'node-b', cx: bx, cy: by, r: 6 }));
    svg.append(s('text', { x: bx + 14, y: by - 2 }, short(`${st.id}  ${st.label}`, 30)));
    svg.append(s('text', { class: 'sub', x: bx + 14, y: by + 12 }, `${st.asserts}${st.status ? ` · ${st.status}` : ''}`));
  });
  svg.append(s('circle', { class: 'node-a', cx: ax, cy: ay, r: 8 }));
  svg.append(s('text', { x: ax - 34, y: ay - 18 }, subjectId));
  svg.append(s('text', { class: 'sub', x: ax - 34, y: ay + 26 }, short(subjectTitle, 22)));
  const wrap = document.createElement('div');
  wrap.className = 'route';
  wrap.append(svg);
  return wrap;
}
