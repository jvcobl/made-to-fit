// Mini-game kit: a paper card over the dimmed town, a verb card, Steady or Calm pace, and the room as the difficulty.
// The room modifiers come from the live fit engine, so the same task is harder or easier for different players,
// and a fix changes it for everyone. Nothing here can be failed; results describe, they do not grade.
import { clamp, lerp, FAST as FAST0, FIXED, FlashGuard, keyName, esc, params } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';
import * as SIM from '../sim.js';

export const C = { ink: '#2b2530', soft: '#6b6170', paper: '#fbf6ee', paper2: '#f3eadb', line: 'rgba(43,37,48,0.14)', amber: '#ffcf7a', accent: '#d9603b', teal: '#4fb3a9', good: '#3f8f5a' };
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
export const FONT = (w, px) => `${w} ${px}px "Fredoka", "Nunito", ui-rounded, system-ui, sans-serif`;
export const BODY = (px, w = 400) => `${w} ${px}px "Atkinson Hyperlegible", system-ui, sans-serif`;
export function rr(ctx, x, y, w, h, r) { const k = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath(); }
export function shadow(ctx, blur = 14, y = 6, a = 0.22) { ctx.shadowColor = `rgba(20,14,30,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0; }
export function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
export function mix(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t)); return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1); }
// symbols carry the meaning, colors only help (so the games work without color vision)
export function symbol(ctx, kind, x, y, s, fill, stroke = C.ink) {
  ctx.beginPath();
  if (kind === 'circle') ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
  else if (kind === 'square') { const k = s * 0.44; ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y - k); ctx.lineTo(x + k, y + k); ctx.lineTo(x - k, y + k); ctx.closePath(); }
  else if (kind === 'triangle') { const k = s * 0.56; ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.95, y + k * 0.62); ctx.lineTo(x - k * 0.95, y + k * 0.62); ctx.closePath(); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? s * 0.24 : s * 0.56; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); }
  else if (kind === 'diamond') { const k = s * 0.56; ctx.moveTo(x, y - k); ctx.lineTo(x + k * 0.8, y); ctx.lineTo(x, y + k); ctx.lineTo(x - k * 0.8, y); ctx.closePath(); }
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = Math.max(2, s * 0.07); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function loadImg(url) { return new Promise((r) => { if (!url) { r(null); return; } const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; }); }

// little bursts of paper and light
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, n, colors, o = {}) { for (let i = 0; i < n; i++) { const a = (o.dir != null ? o.dir : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread || Math.PI * 1.4); const v = (o.speed || 260) * (0.4 + Math.random() * 0.8); this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: (o.life || 0.8) * (0.6 + Math.random() * 0.6), c: colors[i % colors.length], s: (o.size || 6) * (0.6 + Math.random() * 0.8), r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, kind: o.kind || 'paper' }); } }
  float(x, y, text, color, o = {}) { this.list.push({ x, y, vx: 0, vy: -46, life: 0, max: o.life || 1.1, text, c: color, s: o.size || 22, kind: 'text' }); }
  update(dt) { for (const p of this.list) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'text') { p.vy += 620 * dt; p.vx *= 0.985; p.r += p.vr * dt; } } this.list = this.list.filter((p) => p.life < p.max); }
  draw(ctx) {
    for (const p of this.list) {
      const a = clamp(1 - p.life / p.max); ctx.globalAlpha = a;
      if (p.kind === 'text') { ctx.font = FONT(700, p.s); ctx.textAlign = 'center'; ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.kind === 'spark') { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.5, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// how a place presses on a task, from the same numbers that press on the town
export function roomMods(G, zone) {
  const S = G.S; const p = SIM.pinch(S, zone, S.min); const d = p.dims;
  const m = { glare: clamp(d.light.over * 1.8), chatter: clamp(d.sound.over * 2.0), interrupt: clamp(d.people.over * 1.6 + d.talk.over * 0.6), drift: clamp((d.sound.under + d.light.under + d.people.under) * 1.4) };
  const masked = S.masking && S.maskZone === zone;
  if (masked) for (const k in m) m[k] *= 0.6;
  m.masked = masked;
  return m;
}
// the same room, through someone else's needs (Dot at the next desk)
export function roomFor(G, profile, zone) { const L = SIM.levels(G.S, zone, G.S.min); return SIM.pinchOf(profile, L, null, zone).total; }

const CHAT = ['did you see the thing', 'quick q', 'ok so', 'LOL no', 'who took my mug', 'per my last email', 'circling back!', 'is it hot in here', 'mm-hm', 'anyway', 'synergy'];

// The room itself: harsh light, chatter, interruptions, drift. Each one is counted so the results can say what it cost.
export class Room {
  constructor(game, mods, o = {}) {
    this.g = game; this.m = mods; this.t = 0; this.bubbles = []; this.int = null; this.intT = 3 + Math.random() * 3; this.ink = 1; this.idle = 0;
    this.cost = { glare: 0, chatter: 0, interrupt: 0, drift: 0 }; this.flash = 0; this.washT = 0; this.chatT = 1.2; this.faces = o.faces || []; this.asker = o.asker || 'Quick question?'; this.hums = 0; this.deferred = []; this.answered = 0; this.visits = 0;
    this.guard = new FlashGuard(0, 1.2); // backstop: the wash can never pulse, whatever feeds it
    this.reduce = !!(game.G.settings.reduceMotion) || !!game.o.outdoor;
  }
  update(dt, focus) {
    const m = this.m; this.t += dt; const c = this.cost; const before = c.glare + c.chatter + c.interrupt + c.drift;
    this.updateRoom(dt, focus, m);
    // seconds when anything at all was in your way, counting overlaps once, so the total never exceeds the task
    if (c.glare + c.chatter + c.interrupt + c.drift > before) this.costAny = (this.costAny || 0) + dt;
  }
  updateRoom(dt, focus, m) {
    // harsh light: a steady warm wash over whatever you are looking at. It eases in and out over more than half
    // a second and never pulses or flickers (WCAG 2.3.1). Screen effects scale it; Reduced motion stops the breathing.
    const set = this.g.G.settings; const fx = clamp(set.fx == null ? 1 : +set.fx);
    let target = m.glare > 0.05 ? 0.3 * m.glare * fx : 0;
    if (target > 0 && !this.reduce && !set.reduceMotion) target += 0.015 * m.glare * fx * Math.sin(this.t * Math.PI * 0.4); // breathing: 0.2 Hz, 0.03 at most
    this.washT += (target - this.washT) * (1 - Math.exp(-dt / 0.35));
    this.flash = this.guard.update(this.washT, dt);
    if (m.glare > 0.25 && focus) this.cost.glare += dt;
    // chatter: words drift over the work; headphones make them smaller and fainter
    if (m.chatter > 0.05) {
      this.chatT -= dt;
      if (this.chatT <= 0) { this.chatT = lerp(2.4, 0.55, m.chatter) * (0.6 + Math.random() * 0.8); const W = this.g.W, H = this.g.H; const near = focus && Math.random() < 0.45 + m.chatter * 0.3; const x = near ? focus.x + focus.w / 2 + (Math.random() - 0.5) * focus.w : 40 + Math.random() * (W - 80), y = near ? focus.y + focus.h / 2 + (Math.random() - 0.5) * focus.h * 0.6 : 50 + Math.random() * (H * 0.7); this.bubbles.push({ x, y, t: 0, life: 1.4 + m.chatter * 0.8, text: CHAT[Math.floor(Math.random() * CHAT.length)], s: 0.75 + m.chatter * 0.45 }); this.g.G.audio.sfx('pop'); }
      for (const b of this.bubbles) b.t += dt; this.bubbles = this.bubbles.filter((b) => b.t < b.life);
      if (focus && this.covered(focus)) this.cost.chatter += dt;
    }
    // interruptions: someone stops at your desk. "Sure, go ahead" means they ask now and the task waits;
    // "In a sec?" means they come back after you finish, all at once. Both are fine. Only one keeps your thread.
    if (m.interrupt > 0.08 && !this.g.calmNoInt) {
      if (!this.int) { this.intT -= dt; if (this.intT <= 0 && this.g.running) this.visit(); }
      else {
        const I = this.int; I.t += dt;
        if (I.phase === 'ask' || I.phase === 'talk') this.cost.interrupt += dt;
        if (I.phase === 'talk' && I.t >= I.end) { I.phase = 'leave'; I.text = I.face.thanks || 'Thanks!'; I.end = I.t + (FAST ? 0.1 : 0.75); this.g.showVisit(I); }
        else if (I.phase === 'leave' && I.t >= I.end) { this.int = null; this.g.hideVisit(); this.intT = lerp(9, 3.2, m.interrupt) * (0.7 + Math.random() * 0.6); }
      }
    }
    // drift: in a room that is too dull for you, the ink fades between actions; humming brings it back
    if (m.drift > 0.05) { this.idle += dt; this.ink = clamp(this.ink - dt * m.drift * 0.32 * (this.idle > 1.2 ? 1 : 0.2), 0.12, 1); if (this.ink < 0.55) this.cost.drift += dt; }
  }
  acted() { this.idle = 0; this.ink = Math.min(1, this.ink + 0.12); }
  hum() { this.ink = 1; this.idle = 0; this.hums++; this.g.G.audio.sfx('hum', { n: 60 + Math.floor(Math.random() * 12) }); this.g.fx.burst(this.g.W - 56, this.g.H - 60, 6, ['#ffcf7a', '#9edcd6', '#f3a0c2'], { kind: 'spark', speed: 120, size: 7 }); }
  // someone arrives; people who were asked to wait do not come back until the task is over
  visit() {
    const pool = this.faces.filter((f) => !this.deferred.includes(f));
    if (this.faces.length && !pool.length) { this.intT = 1e9; return; }
    const f = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { asks: [this.asker], qs: ['Oh, never mind, found it!'] };
    const k = f.k || 0; const ask = f.asks ? f.asks[k % f.asks.length] : f.line || this.asker;
    this.int = { t: 0, face: f, side: Math.random() < 0.5 ? -1 : 1, phase: 'ask', text: ask }; this.visits++;
    this.g.G.audio.sfx('notify'); this.g.showVisit(this.int);
  }
  sure() {
    const I = this.int; if (!I || I.phase !== 'ask') return false; const f = I.face; const k = f.k || 0;
    const q = f.qs ? f.qs[k % f.qs.length] : 'Thanks!'; f.k = k + 1;
    I.phase = 'talk'; I.text = q; I.end = I.t + (FAST ? 0.15 : clamp(0.9 + q.length * 0.022, 1.4, 2.8)); this.answered++;
    this.g.G.audio.sfx('select'); this.g.showVisit(I); return true;
  }
  later() {
    const I = this.int; if (!I || I.phase !== 'ask') return false; const f = I.face;
    I.phase = 'leave'; I.text = f.later || 'Oh! Sure. After.'; I.end = I.t + (FAST ? 0.1 : 1.1);
    if (f.name && !this.deferred.includes(f)) this.deferred.push(f);
    this.g.G.audio.sfx('select'); this.g.showVisit(I); return true;
  }
  blocking() { return !!(this.int && (this.int.phase === 'ask' || this.int.phase === 'talk')); }
  answer() { return this.sure(); }
  covered(r) { for (const b of this.bubbles) { const a = this.bubbleAlpha(b); if (a < 0.5) continue; const w = 150 * b.s, h = 46 * b.s; if (b.x + w / 2 > r.x && b.x - w / 2 < r.x + r.w && b.y + h / 2 > r.y && b.y - h / 2 < r.y + r.h) return true; } return false; }
  bubbleAlpha(b) { const k = b.t / b.life; const muff = this.g.G.S.wearing.headphones ? 0.45 : 1; return clamp(Math.min(k * 6, (1 - k) * 4)) * muff; }
  wash() { return this.flash; }
  drawOver(ctx) {
    const W = this.g.W, H = this.g.H;
    // harsh light: a warm off-white wash, strongest near the top, and a slight squint at the edges
    if (this.flash > 0.004) {
      const g = ctx.createRadialGradient(W * 0.5, -H * 0.1, 10, W * 0.5, H * 0.2, H * 1.1); g.addColorStop(0, `rgba(255,244,226,${this.flash})`); g.addColorStop(1, `rgba(255,244,226,${this.flash * 0.6})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sq = 0.2 * clamp(this.flash / 0.3); // follows the eased wash, so at rest it is 0.2 x glare x screen effects
      const v = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.32, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.56); v.addColorStop(0, 'rgba(43,30,22,0)'); v.addColorStop(1, `rgba(43,30,22,${sq})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    for (const b of this.bubbles) {
      const a = this.bubbleAlpha(b); if (a <= 0.01) continue; const s = b.s * (this.g.G.S.wearing.headphones ? 0.7 : 1);
      ctx.globalAlpha = a; ctx.save(); ctx.translate(b.x, b.y - b.t * 10); ctx.scale(s, s);
      shadow(ctx, 8, 3, 0.18); ctx.fillStyle = '#ffffff'; rr(ctx, -75, -23, 150, 46, 18); ctx.fill(); noShadow(ctx);
      ctx.beginPath(); ctx.moveTo(-10, 22); ctx.lineTo(-22, 34); ctx.lineTo(4, 22); ctx.fill();
      ctx.fillStyle = C.soft; ctx.font = BODY(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, 0, 1);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (this.int) {
      const I = this.int; const k = I.phase === 'leave' ? 1 - clamp((I.t - (I.end - 0.5)) / 0.5) : ease.outCubic(clamp(I.t / 0.3));
      ctx.fillStyle = `rgba(30,24,40,${0.3 * k})`; ctx.fillRect(0, 0, W, H);
    }
  }
}

// The frame every mini-game runs inside.
export class MiniGame {
  constructor(G, o) {
    this.G = G; this.o = o; this.id = o.id; this.fx = new Particles(); this.running = false; this.done = false; this.t = 0;
    this.touch = G.ui.touch; this.calm = G.settings.pace === 'calm';
  }
  mount() {
    const G = this.G, o = this.o; const el = G.ui.el('#mg'); this.el = el;
    el.innerHTML = `<div class="mg-scrim"></div><div class="mg-card ${o.theme || ''}" role="dialog" aria-label="${esc(o.title)}">
      <div class="mg-top"><div class="mg-verb">${esc(o.verb)}</div><div class="mg-title"><b>${esc(o.title)}</b><span>${esc(o.where || '')}</span></div><div class="mg-env"></div><div class="mg-clock" hidden><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(43,37,48,0.12)" stroke-width="5"/><circle class="arc" cx="18" cy="18" r="15" fill="none" stroke="#ffcf7a" stroke-width="5" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="0" transform="rotate(-90 18 18)"/></svg><span></span></div><button class="mg-pause" aria-label="Pause">II</button></div>
      <div class="mg-stage"><canvas></canvas><div class="mg-over"></div><button class="mg-hum" hidden aria-label="Hum a little tune">♪ Hum</button></div>
      <div class="mg-bot"><div class="mg-hint" aria-live="polite"></div><div class="mg-side"></div></div></div>`;
    el.hidden = false; G.mgActive = true; G.mg = this; G.mgScene = o.music || 'works';
    this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d'); this.over = el.querySelector('.mg-over');
    this.resize(); this._rs = () => this.resize(); window.addEventListener('resize', this._rs);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.cv.parentElement); }
    const cv = this.cv;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left), (e.clientY - r.top)]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); this.G.audio.unlock(); const [x, y] = pt(e); if (this.room && this.room.blocking()) { this.nudgeVisit(); return; } if (this.running) this.pointer('down', x, y, e); });
    cv.addEventListener('pointermove', (e) => { const [x, y] = pt(e); if (this.running) this.pointer('move', x, y, e); });
    cv.addEventListener('pointerup', (e) => { const [x, y] = pt(e); if (this.running) this.pointer('up', x, y, e); });
    this._kd = (e) => this.keydown(e); window.addEventListener('keydown', this._kd);
    el.querySelector('.mg-pause').onclick = () => this.pause();
    el.querySelector('.mg-hum').onclick = () => { if (this.room) this.room.hum(); };
    this.ui = { hint: el.querySelector('.mg-hint'), side: el.querySelector('.mg-side'), clock: el.querySelector('.mg-clock'), env: el.querySelector('.mg-env'), hum: el.querySelector('.mg-hum') };
  }
  resize() { const r = this.cv.parentElement.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1) * (this.G.test ? 0.7 : 1); this.W = Math.max(280, r.width); this.H = Math.max(240, r.height); this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px'; this.dpr = dpr; if (this.layout) this.layout(); }
  unmount() { if (this._ro) this._ro.disconnect(); window.removeEventListener('resize', this._rs); window.removeEventListener('keydown', this._kd); cancelAnimationFrame(this.raf); this.el.hidden = true; this.el.innerHTML = ''; this.G.mgActive = false; this.G.mg = null; this.G.forceRender = true; }
  keydown(e) {
    const k = keyName(e);
    if (k === 'Escape') { e.preventDefault(); if (this.paused) this.resume(); else if (this.running) this.pause(); return; }
    if (this.waitKey && (k === 'Enter' || k === ' ')) { e.preventDefault(); this.waitKey(); return; }
    if (!this.running) return;
    if (this.room && this.room.blocking()) {
      const I = this.room.int; if (/^[0-9 ]$|^Enter$|^Arrow/.test(k)) e.preventDefault();
      if (I.phase === 'ask' && I.t > 0.3) { if (k === '1' || k === ' ' || k === 'Enter') this.room.sure(); else if (k === '2') this.room.later(); else this.nudgeVisit(); }
      return;
    }
    // H hums: the key in the H position, or whatever key types an h on this layout
    if ((k === 'h' || (e.key || '').toLowerCase() === 'h') && this.room && this.room.m.drift > 0.05) { this.room.hum(); return; }
    this.key(e);
  }
  escape() { if (this.paused) this.resume(); else if (this.running) this.pause(); }
  // the visitor card: a face, what they said, and two answers
  showVisit(I) {
    let v = this.el.querySelector('.mg-visit');
    if (!v) { v = document.createElement('div'); v.setAttribute('role', 'alertdialog'); v.setAttribute('aria-label', 'Someone at your desk'); this.el.querySelector('.mg-stage').insertBefore(v, this.over); }
    const f = I.face || {}; v.className = 'mg-visit ' + (I.side < 0 ? 'l' : 'r') + ' ' + I.phase;
    const k = (n) => (this.touch ? '' : `<kbd>${n}</kbd>`);
    const btns = I.phase === 'ask' ? `<div class="vbtns"><button class="btn primary" data-v="sure">${k(1)}Sure, go ahead</button><button class="btn" data-v="later">${k(2)}In a sec?</button></div>` : '';
    v.innerHTML = `<div class="vrow">${f.img ? `<img src="${f.img.src}" alt="">` : '<i class="vsil"></i>'}<div class="vb">${f.name ? `<b>${esc(f.name)}</b>` : ''}<span aria-live="assertive">${esc(I.text)}</span></div></div>${btns}`;
    if (btns) { v.querySelector('[data-v=sure]').onclick = () => this.room && this.room.sure(); v.querySelector('[data-v=later]').onclick = () => this.room && this.room.later(); }
  }
  hideVisit() { const v = this.el && this.el.querySelector('.mg-visit'); if (v) v.remove(); }
  nudgeVisit() { const v = this.el && this.el.querySelector('.mg-visit'); if (!v || !this.room || !this.room.int || this.room.int.phase !== 'ask') return; v.classList.remove('nudge'); void v.offsetWidth; v.classList.add('nudge'); }
  envChips(m) {
    const chips = [];
    if (m.glare > 0.08) chips.push(['☀', this.o.outdoor ? 'Glare' : 'Harsh light']); if (m.chatter > 0.08) chips.push(['♪', 'Chatter']); if (m.interrupt > 0.1) chips.push(['☺', 'Interruptions']); if (m.drift > 0.08) chips.push(['☁', 'Too quiet']);
    this.ui.env.innerHTML = chips.length ? chips.map(([i, n]) => `<span class="chip-env"><i>${i}</i>${n}</span>`).join('') : `<span class="chip-env ok"><i>✓</i>This ${this.o.outdoor ? 'place' : 'room'} fits you</span>`;
  }
  // the verb card with a short silent demo
  intro() {
    const o = this.o;
    this.over.innerHTML = `<div class="mg-intro"><div class="v">${esc(o.verb)}</div><h3>${esc(o.title)}</h3><p>${o.how}</p>${o.roomNote ? `<p class="rn">${o.roomNote}</p>` : ''}<div class="pace"><button data-p="steady" class="${this.calm ? '' : 'on'}">Steady</button><button data-p="calm" class="${this.calm ? 'on' : ''}">Calm: no timer</button></div><button class="btn primary go">Start</button></div>`;
    this.over.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { this.calm = b.dataset.p === 'calm'; this.G.settings.pace = b.dataset.p; this.G.saveSettings(); this.over.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); this.G.audio.sfx('select'); }; });
    this.demoT = 0; this.mode = 'demo'; this.loop();
    return new Promise((r) => { const go = () => { this.waitKey = null; this.G.audio.sfx('confirm'); this.over.innerHTML = ''; r(); }; this.over.querySelector('.go').onclick = go; this.waitKey = go; if (FAST) setTimeout(go, 30); });
  }
  loop() {
    cancelAnimationFrame(this.raf);
    // one frame of the task: update, then draw. In fixed-step test mode the game's step() calls this directly.
    this.frame = (dt0) => {
      const dt = dt0 * (FAST ? 4 : 1);
      if (!this.paused) {
        this.t += dt;
        if (this.mode === 'demo') this.demoT += dt;
        if (this.mode === 'play') { this.update(dt); if (this.room) this.room.update(dt, this.focusRect ? this.focusRect() : null); this.tickClock(dt); }
        this.fx.update(dt);
      }
      const ctx = this.ctx; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
      this.draw(ctx, this.mode);
      if (this.room && this.mode === 'play') this.room.drawOver(ctx);
      this.fx.draw(ctx);
    };
    if (FIXED) return;
    let last = performance.now();
    const step = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; this.frame(dt); if (this.mode !== 'gone') this.raf = requestAnimationFrame(step); };
    this.raf = requestAnimationFrame(step);
  }
  tickClock(dt) {
    if (this.calm || !this.dur) { this.ui.clock.hidden = true; return; }
    this.ui.clock.hidden = false; const left = Math.max(0, this.dur - this.playT);
    this.ui.clock.querySelector('.arc').style.strokeDashoffset = String(94.2 * (1 - left / this.dur));
    const s = Math.ceil(left); const sp = this.ui.clock.querySelector('span'); if (sp.textContent !== String(s)) sp.textContent = s;
  }
  play() {
    this.mode = 'play'; this.running = true; this.playT = 0;
    if (this.room) this.ui.hum.hidden = !(this.room.m.drift > 0.05);
    return new Promise((r) => { this.finish = r; });
  }
  // called by the game when it is over
  end() { if (!this.running) return; this.running = false; this.mode = 'end'; this.ui.clock.hidden = true; this.ui.hum.hidden = true; this.hideVisit(); if (this.room) this.room.int = null; setTimeout(() => this.finish && this.finish(), FAST ? 10 : 500); }
  pause() {
    if (this.paused || !this.running) return; this.paused = true;
    const p = document.createElement('div'); p.className = 'mg-pausecard';
    p.innerHTML = `<h3>Paused</h3><p>Take as long as you like.</p><div class="pace"><button data-p="steady" class="${this.calm ? '' : 'on'}">Steady</button><button data-p="calm" class="${this.calm ? 'on' : ''}">Calm: no timer</button></div><div class="row"><button class="btn" data-a="skip">Skip this task</button><button class="btn primary" data-a="go">Resume</button></div><p class="small">Skipping is fine. The day carries on as if you did the work.</p>`;
    this.over.appendChild(p);
    p.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { this.calm = b.dataset.p === 'calm'; this.G.settings.pace = b.dataset.p; this.G.saveSettings(); p.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    p.querySelector('[data-a=go]').onclick = () => this.resume();
    p.querySelector('[data-a=skip]').onclick = () => { this.skipped = true; this.resume(); this.end(); };
  }
  resume() { this.paused = false; const p = this.over.querySelector('.mg-pausecard'); if (p) p.remove(); }
  // results: what you did, what the room cost you, and how the person next to you did
  outro(r) {
    const cost = this.room ? this.room.cost : null; const parts = [];
    if (cost) { if (cost.glare > 0.5) parts.push(Math.round(cost.glare) + (this.o.outdoor ? ' s of glare' : ' s of harsh light')); if (cost.chatter > 0.5) parts.push(Math.round(cost.chatter) + ' s of chatter'); if (cost.interrupt > 0.5) parts.push(Math.round(cost.interrupt) + ' s of questions'); if (cost.drift > 0.5) parts.push(Math.round(cost.drift) + ' s of drifting'); }
    const total = cost ? Math.round(this.room.costAny || 0) : 0;
    const place = this.o.outdoor ? 'place' : 'room';
    const roomLine = this.skipped ? 'You skipped it. That is allowed.' : !this.room ? '' : total >= 2 ? `The ${place} cost you about <b>${total} seconds</b>: ${parts.join(', ')}.` : this.o.outdoor ? '' : 'The room barely got in your way today.';
    let askLine = ''; const R = this.room;
    if (R && !this.skipped) {
      const names = R.deferred.map((f) => f.name);
      if (names.length) askLine = `You asked ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} to wait. ${names.length > 1 ? 'They' : names[0]} came back after, with everything at once. It took a minute, and nobody minded.`;
      else if (R.answered >= 3) askLine = `You answered ${R.answered} questions on the spot. "In a sec?" is allowed too.`;
      if (names.length) { const S = this.G.S; S.stats.ask = (S.stats.ask || 0) + 1; S.stats.waits = (S.stats.waits || 0) + names.length; }
    }
    this.over.innerHTML = `<div class="mg-result"><div class="v">${esc(this.o.verb)}</div><h3>${r.headline}</h3>${r.line ? `<p>${r.line}</p>` : ''}${roomLine ? `<p class="room">${roomLine}</p>` : ''}${askLine ? `<p class="room ask">${askLine}</p>` : ''}${r.mate ? `<div class="mate">${r.mateImg ? `<img src="${r.mateImg}" alt="">` : ''}<div>${r.mate}</div></div>` : ''}<button class="btn primary go">${esc(r.button || 'Done')}</button></div>`;
    return new Promise((res) => { const go = () => { this.waitKey = null; this.G.audio.sfx('confirm'); res(); }; this.over.querySelector('.go').onclick = go; setTimeout(() => { this.waitKey = go; }, 350); if (FAST) setTimeout(go, 30); });
  }
  async run() {
    this.mount(); if (this.prepare) await this.prepare();
    this.G.stage.render();
    this.mods = this.o.zone ? roomMods(this.G, this.o.zone) : { glare: 0, chatter: 0, interrupt: 0, drift: 0 };
    if (this.o.zone) { this.room = new Room(this, this.mods, { faces: this.faces || [], asker: this.o.asker }); this.envChips(this.mods); }
    this.layout && this.layout();
    await this.intro();
    this.start && this.start();
    await this.play();
    const r = this.results();
    await this.outro(r);
    this.mode = 'gone'; this.unmount();
    return r;
  }
}
