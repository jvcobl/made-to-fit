// Small shared helpers: math, randomness, color, time formatting.
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDamp = (a, b, k, dt) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function rand() { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export let R = makeRng(1);
export function seedRng(seed) { R = makeRng(seed); }
export const pick = (arr, r = R) => arr[Math.floor(r() * arr.length) % arr.length];
export const chance = (p, r = R) => r() < p;

export function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let n = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    n += (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w) * hash3(xi + dx, yi + dy, zi + dz);
  }
  return n * 2 - 1;
}
export const noise2 = (x, y) => noise3(x, y, 0.37);

export function hexToRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
export function shadeHex(a, t) { return t < 0 ? mixHex(a, '#000000', -t) : mixHex(a, '#ffffff', t); }
// toward a soft, slightly cool grey of the same lightness (a street that doesn't fit drains the colour from people on it)
export function muteHex(a, t) { if (t <= 0) return a; const A = hexToRgb(a); const l = A[0] * 0.299 + A[1] * 0.587 + A[2] * 0.114; return rgbToHex(lerp(A[0], l * 0.97, t), lerp(A[1], l * 0.985, t), lerp(A[2], l * 1.04, t)); }

export function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  const hh = ((h + 11) % 12) + 1;
  return hh + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM');
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const FAST = params.get('fast') === '1';
// tests that only need the game's logic (?test=1&nodraw=1) skip drawing the 3D scene, except when asked for a screenshot
export const NODRAW = params.get('test') === '1' && params.get('nodraw') === '1';
export const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 30) : ms));

// Fixed-step test mode (?fixedstep=1): nothing advances by itself, and window.__wb.step(n) moves the whole game
// by exactly n frames of 1/60 s. Anything that animates from the clock reads now(), which follows those steps.
export const FIXED = params.get('fixedstep') === '1';
export const STEP = 1 / 60;
export const clock = { frame: 0 };
export const now = () => (FIXED ? clock.frame * 1000 / 60 : performance.now());

// A backstop against flashing (WCAG 2.3.1). The value moves toward its target at a bounded rate, and once it has
// turned it will not head back the other way by more than eps until hold seconds have passed. Turns at least
// 0.36 s apart cannot add up to more than three flashes in a second, whatever the target does.
export class FlashGuard {
  constructor(value = 0, rate = 1, hold = 0.36, eps = 0.05) { this.v = value; this.rate = rate; this.hold = hold; this.eps = eps; this.dir = 1; this.peak = value; this.since = hold; }
  update(target, dt) {
    this.since += dt;
    const max = this.rate * dt;
    let next = this.v + clamp(target - this.v, -max, max);
    if ((next - this.peak) * this.dir >= 0) this.peak = next; // still going the same way
    else if (Math.abs(next - this.peak) > this.eps) {
      if (this.since < this.hold) next = this.peak - this.dir * this.eps; // too soon to turn: wait near the peak
      else { this.dir = -this.dir; this.peak = next; this.since = 0; }
    }
    this.v = next;
    return next;
  }
}

// Keys by position: letters and digits come from e.code, so WASD works on AZERTY and with a Korean keyboard in
// Hangul mode, and the number row works on AZERTY. Escape, Enter, Tab, Space and the arrows keep e.key.
const NAMED_KEYS = new Set(['Escape', 'Enter', 'Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
export function keyName(e) {
  const k = e.key || '';
  if (NAMED_KEYS.has(k)) return k;
  const c = e.code || ''; const m = /^Key([A-Z])$/.exec(c) || /^(?:Digit|Numpad)([0-9])$/.exec(c);
  if (m) return m[1].toLowerCase();
  return k.length === 1 ? k.toLowerCase() : k;
}
