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

// How a place presses on a task, from the same numbers that press on the town. Hiding it (pushing through) doesn't
// change the room: its events come just as often and take just as long.
export function roomMods(G, zone) {
  const S = G.S; const p = SIM.pinch(S, zone, S.min); const d = p.dims;
  return {
    glare: clamp(d.light.over * 1.8), chatter: clamp(d.sound.over * 2.0), interrupt: clamp(d.people.over * 1.6 + d.talk.over * 0.6), drift: clamp((d.sound.under + d.light.under + d.people.under) * 1.4),
    masked: !!(S.masking && S.maskZone === zone), fewer: G.settings.interrupts === 'fewer',
  };
}
// the same room, through someone else's needs (Dot at the next desk)
export function roomFor(G, profile, zone) { const L = SIM.levels(G.S, zone, G.S.min); return SIM.pinchOf(profile, L, null, zone).total; }

// Things that happen in the room. Each is a short moment shown on your creature (the corner portrait) and beside what
// you are looking at; the room is the subject of every caption. One press made during the moment is held and used
// when it ends, so nothing you press is lost. Gaps: from `slow` seconds in a room that barely pinches to `fast` in one
// that pinches hard, ±30%, twice as long with "Interruptions in tasks: Fewer".
export const EVENTS = {
  glare: { dur: 0.8, slow: 9, fast: 3.5, icon: '☀', word: 'Glare', pose: 'squint', cap: ['The panel glares. You look away.', 'The sun glares off the water. You look away.'], still: ['The panel glares.', 'The sun glares off the water.'] },
  chatter: { dur: 0.8, slow: 8, fast: 3, icon: '☎', word: 'Phones', pose: 'ears', cap: ['Three phone calls at once.', 'Everyone talks at once.'], still: ['Three phone calls at once.', 'Everyone talks at once.'] },
  drift: { dur: 1.5, slow: 10, fast: 5, icon: '☁', word: 'Too still', pose: 'drift', cap: ['The room goes very still. Your mind wanders.', 'The pond goes very still. Your mind wanders.'], still: ['The room goes very still.', 'The pond goes very still.'] },
};
export const MOVE_NAME = { hum: 'Hum', tap: 'Tap', rock: 'Rock', spin: 'Spin', flap: 'Flap', pace: 'Pace', charm: 'Charm' };

export class Room {
  constructor(game, mods, o = {}) {
    this.g = game; this.m = mods; this.t = 0; this.int = null; this.intT = (3 + Math.random() * 3) * (mods.fewer ? 2 : 1);
    this.cost = { glare: 0, chatter: 0, interrupt: 0, drift: 0 }; this.count = { glare: 0, chatter: 0, drift: 0 };
    this.faces = o.faces || []; this.asker = o.asker || 'Quick question?'; this.deferred = []; this.answered = 0; this.visits = 0;
    this.ev = null; this.queued = null;
    // the first of each comes a little sooner than the rest
    this.next = {}; for (const k in EVENTS) this.next[k] = this.gap(k) * (0.35 + Math.random() * 0.4);
  }
  gap(k) { const E = EVENTS[k]; return lerp(E.slow, E.fast, this.m[k] || 0) * (0.7 + Math.random() * 0.6) * (this.m.fewer ? 2 : 1); }
  update(dt) {
    const m = this.m; this.t += dt; const c = this.cost; const before = c.glare + c.chatter + c.interrupt + c.drift;
    if (this.ev) { const e = this.ev; const step = Math.min(dt, e.dur - e.t); e.t += dt; c[e.k] += Math.max(0, step); if (e.t >= e.dur) this.endEvent(); }
    else if (!this.blocking() && this.g.running) {
      for (const k in EVENTS) { if ((m[k] || 0) <= 0.05) continue; this.next[k] -= dt; if (this.next[k] <= 0) { this.startEvent(k); break; } }
    }
    // interruptions: someone stops at your desk. "Sure, go ahead" means they ask now and the task waits;
    // "In a sec?" means they come back after you finish, all at once. Both are fine. Only one keeps your thread.
    if (m.interrupt > 0.08 && !this.g.calmNoInt) {
      if (!this.int) { this.intT -= dt; if (this.intT <= 0 && this.g.running && !this.ev) this.visit(); }
      else {
        const I = this.int; I.t += dt;
        if (I.phase === 'ask' || I.phase === 'talk') this.cost.interrupt += dt;
        if (I.phase === 'talk' && I.t >= I.end) { I.phase = 'leave'; I.text = I.face.thanks || 'Thanks!'; I.end = I.t + (FAST ? 0.1 : 0.75); this.g.showVisit(I); }
        else if (I.phase === 'leave' && I.t >= I.end) { this.int = null; this.g.hideVisit(); this.intT = lerp(9, 3.2, m.interrupt) * (0.7 + Math.random() * 0.6) * (m.fewer ? 2 : 1); }
      }
    }
    // seconds when anything at all was in your way, counting overlaps once, so the total never exceeds the task
    if (c.glare + c.chatter + c.interrupt + c.drift > before) this.costAny = (this.costAny || 0) + dt;
  }
  startEvent(k) { const E = EVENTS[k]; this.ev = { k, t: 0, dur: E.dur }; this.count[k]++; this.g.showEvent(this.ev, E); }
  endEvent() {
    const k = this.ev.k; this.ev = null; this.next[k] = this.gap(k); this.g.hideEvent();
    const q = this.queued; this.queued = null; if (q) this.g.replay(q);
  }
  paused() { return !!this.ev; }
  // hold one press made during a moment; later presses in the same moment wait for the next press
  hold(q) { if (!this.queued) this.queued = q; }
  // your comfort move brings you back from drifting at once (while you are hiding it, it is held in)
  comfort() { if (this.m.masked) return false; if (this.ev && this.ev.k === 'drift') this.ev.dur = Math.min(this.ev.dur, this.ev.t); return true; }
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
  acted() {}
  drawOver(ctx) {
    if (!this.int) return;
    const W = this.g.W, H = this.g.H; const I = this.int; const k = I.phase === 'leave' ? 1 - clamp((I.t - (I.end - 0.5)) / 0.5) : ease.outCubic(clamp(I.t / 0.3));
    ctx.fillStyle = `rgba(30,24,40,${0.3 * k})`; ctx.fillRect(0, 0, W, H);
  }
}

// what a room holds, in plain words, for the intro card and the chips along the top
function ahead(m, outdoor) {
  const a = [];
  if (m.glare > 0.08) a.push(outdoor ? 'glare off the water' : 'bright panels');
  if (m.chatter > 0.08) a.push(outdoor ? 'a lot of noise' : 'phones');
  if (m.interrupt > 0.1) a.push('people with questions');
  if (m.drift > 0.08) a.push('long, very still stretches');
  return a;
}
const listOf = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');

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
      <div class="mg-stage"><canvas></canvas><div class="mg-ev" hidden aria-hidden="true"></div><div class="mg-over"></div></div>
      <div class="mg-bot"><img class="mg-face" alt="" hidden><div class="mg-hint" aria-live="polite"></div><div class="mg-side"></div><button class="btn mg-move" hidden></button></div></div>`;
    el.hidden = false; G.mgActive = true; G.mg = this; G.mgScene = o.music || 'works';
    this.cv = el.querySelector('canvas'); this.ctx = this.cv.getContext('2d'); this.over = el.querySelector('.mg-over');
    this.resize(); this._rs = () => this.resize(); window.addEventListener('resize', this._rs);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.cv.parentElement); }
    const cv = this.cv;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left), (e.clientY - r.top)]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); this.G.audio.unlock(); const [x, y] = pt(e);
      if (this.room && this.room.blocking()) { this.nudgeVisit(); return; }
      if (this.room && this.room.paused()) { if (this.running) this.room.hold({ type: 'pointer', x, y }); return; }
      if (this.running) this.pointer('down', x, y, e);
    });
    cv.addEventListener('pointermove', (e) => { const [x, y] = pt(e); if (this.running && !(this.room && this.room.paused())) this.pointer('move', x, y, e); });
    cv.addEventListener('pointerup', (e) => { const [x, y] = pt(e); if (this.running && !(this.room && this.room.paused())) this.pointer('up', x, y, e); });
    this._kd = (e) => this.keydown(e); window.addEventListener('keydown', this._kd);
    el.querySelector('.mg-pause').onclick = () => this.pause();
    el.querySelector('.mg-move').onclick = () => this.comfortMove();
    this.ui = { hint: el.querySelector('.mg-hint'), side: el.querySelector('.mg-side'), clock: el.querySelector('.mg-clock'), env: el.querySelector('.mg-env'), move: el.querySelector('.mg-move'), face: el.querySelector('.mg-face'), ev: el.querySelector('.mg-ev') };
  }
  resize() { const r = this.cv.parentElement.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1) * (this.G.test ? 0.7 : 1); this.W = Math.max(280, r.width); this.H = Math.max(240, r.height); this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px'; this.dpr = dpr; if (this.layout) this.layout(); }
  unmount() { if (this._ro) this._ro.disconnect(); window.removeEventListener('resize', this._rs); window.removeEventListener('keydown', this._kd); cancelAnimationFrame(this.raf); clearTimeout(this._mvT); this.el.hidden = true; this.el.innerHTML = ''; this.G.mgActive = false; this.G.mg = null; this.G.forceRender = true; }
  keydown(e) {
    const k = keyName(e);
    if (k === 'Escape') { e.preventDefault(); if (this.paused) this.resume(); else if (this.running) this.pause(); return; }
    if (this.waitKey && (k === 'Enter' || k === ' ')) { e.preventDefault(); this.waitKey(); return; }
    if (!this.running || this.paused) return;
    if (this.room && this.room.blocking()) {
      const I = this.room.int; if (/^[0-9 ]$|^Enter$|^Arrow/.test(k)) e.preventDefault();
      if (I.phase === 'ask' && I.t > 0.3) { if (k === '1' || k === ' ' || k === 'Enter') this.room.sure(); else if (k === '2') this.room.later(); else this.nudgeVisit(); }
      return;
    }
    if (this.room && this.G.actionOf(e) === 'comfort') { e.preventDefault(); this.comfortMove(); return; }
    if (k === 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    // during a moment in the room, one press waits for it to pass
    if (this.room && this.room.paused()) { if (/^[0-9 ]$|^Enter$|^Arrow/.test(k)) e.preventDefault(); this.room.hold({ type: 'key', key: e.key, code: e.code }); return; }
    this.key(e);
  }
  escape() { if (this.paused) this.resume(); else if (this.running) this.pause(); }
  // a held press, used now that the moment has passed
  replay(q) {
    if (!this.running || this.paused) return;
    if (q.type === 'pointer') this.pointer('down', q.x, q.y, null);
    else this.key({ key: q.key, code: q.code, preventDefault() {}, stopPropagation() {} });
  }
  // ---------- your creature in the corner, and the moment beside what you are looking at ----------
  async preparePortraits() {
    const G = this.G, S = G.S; const look = Object.assign({}, S.look); const drift = Math.round(G.drift() * 9.2) / 10;
    const move = (S.look && S.look.comfort) || 'hum';
    const poses = { rest: null, squint: 'squint', ears: 'ears', drift: 'drift', straight: 'straight', move };
    this.faces2 = {};
    for (const [k, pose] of Object.entries(poses)) { try { this.faces2[k] = G.portraitOf(look, { bg: '#efe6d6', w: 120, h: 120, drift, pose }); } catch (e) { this.faces2[k] = ''; } }
    this.moveKind = move;
    this.setFace('rest');
  }
  setFace(k) { const f = this.ui.face; const url = this.faces2 && this.faces2[k]; if (!f || !url) return; f.hidden = false; if (f.dataset.k !== k) { f.dataset.k = k; f.src = url; } }
  showEvent(ev, E) {
    const out = this.o.outdoor ? 1 : 0; const masked = this.room.m.masked;
    const cap = masked ? E.still[out] + ' You keep a straight face.' : E.cap[out];
    this.setFace(masked ? 'straight' : E.pose);
    this._hintWas = this.ui.hint.textContent; this.ui.hint.textContent = cap; this.ui.hint.classList.add('ev');
    // the chip goes beside what you are looking at, never over it
    const chip = this.ui.ev; const fr = this.focusRect ? this.focusRect() : null; const cw = 128, ch = 40;
    let x = this.W / 2 - cw / 2, y = 12;
    if (fr) { if (fr.x + fr.w + 10 + cw <= this.W - 6) { x = fr.x + fr.w + 10; y = fr.y + fr.h / 2 - ch / 2; } else if (fr.x - 10 - cw >= 6) { x = fr.x - 10 - cw; y = fr.y + fr.h / 2 - ch / 2; } else { x = clamp(fr.x + fr.w / 2 - cw / 2, 6, this.W - cw - 6); y = fr.y - ch - 8 >= 4 ? fr.y - ch - 8 : fr.y + fr.h + 8; } }
    chip.style.left = Math.round(x) + 'px'; chip.style.top = Math.round(clamp(y, 4, this.H - ch - 4)) + 'px';
    chip.innerHTML = `<svg viewBox="0 0 20 20" class="ring"><circle cx="10" cy="10" r="8" style="animation-duration:${ev.dur}s"/></svg><i>${E.icon}</i>${esc(E.word)}`;
    chip.hidden = false;
  }
  hideEvent() {
    this.ui.ev.hidden = true; this.ui.hint.classList.remove('ev');
    if (this.hint) this.hint(); else if (this._hintWas != null) this.ui.hint.textContent = this._hintWas;
    if (!this._moving) this.setFace('rest');
  }
  // your comfort move: the portrait does it, and it brings you back from drifting
  comfortMove() {
    if (!this.room || !this.running || this.paused) return;
    if (!this.room.comfort()) return;
    this._moving = true; this.setFace('move'); clearTimeout(this._mvT);
    if (this.G.settings.comfortSound !== false) this.G.audio.sfx('comfort', { kind: this.moveKind, voice: this.G.S.look && this.G.S.look.voice });
    this._mvT = setTimeout(() => { this._moving = false; if (!(this.room && this.room.paused())) this.setFace('rest'); }, FAST ? 60 : 1200);
  }
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
    if (m.glare > 0.08) chips.push(['☀', 'Glare']); if (m.chatter > 0.08) chips.push(['☎', this.o.outdoor ? 'Noise' : 'Phones']); if (m.interrupt > 0.1) chips.push(['☺', 'Questions']); if (m.drift > 0.08) chips.push(['☁', 'Too still']);
    this.ui.env.innerHTML = chips.length ? chips.map(([i, n]) => `<span class="chip-env"><i aria-hidden="true">${i}</i>${n}</span>`).join('') : `<span class="chip-env ok"><i aria-hidden="true">✓</i>This ${this.o.outdoor ? 'place' : 'room'} fits you</span>`;
  }
  // the verb card with a short silent demo, and what this room holds today
  intro() {
    const o = this.o; const m = this.mods || {};
    const a = this.room ? ahead(m, o.outdoor) : [];
    const what = !this.room ? '' : a.length ? 'In ' + (o.outdoor ? 'this place' : 'here') + ' today: ' + listOf(a) + '.' : 'This ' + (o.outdoor ? 'place' : 'room') + ' fits you today.';
    const ahd = this.room ? `<p class="ahead">${esc(what)}${o.length ? ' ' + esc(o.length) : ''} You can pause or skip it any time.</p>` : '';
    this.over.innerHTML = `<div class="mg-intro"><div class="v">${esc(o.verb)}</div><h3>${esc(o.title)}</h3><p>${o.how}</p>${o.roomNote ? `<p class="rn">${o.roomNote}</p>` : ''}${ahd}<div class="pace"><button data-p="steady" class="${this.calm ? '' : 'on'}">Steady</button><button data-p="calm" class="${this.calm ? 'on' : ''}">Calm: no timer</button></div><button class="btn primary go">Start</button></div>`;
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
        // the task keeps moving during a moment in the room; only your presses wait for it to pass
        if (this.mode === 'play') { this.update(dt); if (this.room) this.room.update(dt); this.tickClock(dt); }
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
    if (this.room && !this.room.m.masked) { const b = this.ui.move; b.hidden = false; b.innerHTML = esc(MOVE_NAME[this.moveKind] || 'Hum') + (this.touch ? '' : `<kbd>${esc(this.G.keyOf('comfort'))}</kbd>`); b.setAttribute('aria-label', 'Your comfort move: ' + (MOVE_NAME[this.moveKind] || 'Hum')); }
    return new Promise((r) => { this.finish = r; });
  }
  // called by the game when it is over
  end() { if (!this.running) return; this.running = false; this.mode = 'end'; this.ui.clock.hidden = true; this.ui.move.hidden = true; this.ui.ev.hidden = true; this.hideVisit(); if (this.room) { this.room.int = null; this.room.ev = null; this.room.queued = null; } setTimeout(() => this.finish && this.finish(), FAST ? 10 : 500); }
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
  // what the room took, with the room as the subject: "The glare took 14 seconds. The phones took 9."
  roomLines() {
    const R = this.room; if (!R) return [];
    const c = R.cost; const n = (v) => Math.round(v); const sec = (v) => n(v) + (n(v) === 1 ? ' second' : ' seconds');
    const parts = []; let first = true;
    const add = (v, subject) => { if (n(v) < 1) return; parts.push(subject + ' took ' + (first ? sec(v) : n(v)) + '.'); first = false; };
    add(c.glare, 'The glare'); add(c.chatter, this.o.outdoor ? 'The noise' : 'The phones'); add(c.interrupt, 'Questions'); add(c.drift, 'The stillness');
    return parts;
  }
  // results: what you did, what the room took, and how the person next to you did
  outro(r) {
    const R = this.room;
    const lines = this.roomLines(); const total = R ? Math.round(R.costAny || 0) : 0;
    const roomLine = this.skipped ? 'You skipped it. That is allowed.' : !R ? '' : total >= 2 ? lines.join(' ') + (r.roomExtra ? ' ' + r.roomExtra : '') : this.o.outdoor ? '' : 'The room barely got in your way today.';
    let askLine = '';
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
    if (this.o.zone) { this.room = new Room(this, this.mods, { faces: this.faces || [], asker: this.o.asker }); this.envChips(this.mods); await this.preparePortraits(); }
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
