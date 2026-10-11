// Sort the Mail (the Works, Monday): letters to matching cubbies. The room decides how hard it is.
import { MiniGame, C, rr, shadow, noShadow, symbol, ease, FONT, roomFor, loadImg } from './kit.js';
import { clamp, lerp, FAST as FAST0, params, keyName } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

const SYMS = [['circle', '#e4796a'], ['triangle', '#f6cf5b'], ['square', '#4fb3a9'], ['star', '#a99be8']];
export const DOT = { sound: 0.55, light: 0.22, people: 0.45, talk: 0.3, time: 0.5, change: 0.4 };
export const DOT_LOOK = { shape: 'tall', color: '#9edcd6', pattern: 'spots', top: 'tuft', wear: 'glasses' };

export class SortGame extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'sort', verb: 'Sort', title: 'Sort the mail', where: 'The Works · your desk', zone: 'works', music: 'works', asker: 'Quick question?',
      how: 'Letters come down the chute. Send each one to the cubby with the <b>same symbol</b>: tap the cubby, or press <b>1 to 4</b>.' }, o));
    this.queue = []; this.cubbies = []; this.count = 0; this.wrong = 0; this.combo = 0; this.lastOk = -9; this.spawnT = 0; this.fly = []; this.dotN = 0; this.id = 'sort';
  }
  async prepare() {
    const G = this.G;
    const [dot, gil] = await Promise.all([loadImg(G.portraitOf(DOT_LOOK, { bg: '#e3e8ec' })), loadImg(G.portraitOf({ shape: 'boxy', color: '#cbb9a2', pattern: 'plain', top: 'ears', wear: 'glasses' }, { bg: '#e3e8ec' }))]);
    this.dotImg = dot; this.faces = [
      { name: 'Gil', img: gil, asks: ['Quick one! Got a sec?', 'Sorry! One more tiny thing?', 'Hey! Super quick?'], qs: ['Do we have more blue envelopes? No? Totally fine!', 'Have you seen my mug? It says WORLD\'S OKAYEST BOSS. No? Okay!', 'Is the chute making that noise again? It\'s fine. It\'s fine!'], later: 'Oh! Yep! Later is great!', thanks: 'Great. Great, great.' },
      { name: 'Dot', img: dot, asks: ['Sorry, is this a triangle?', 'Sorry. Is this one a star, or is it the light?', 'Sorry, quick one?'], qs: ['It is? Thank you. That light turns everything into a triangle.', 'A star. Okay. Thank you. I\'ll stop asking.', 'Does the light bother you too? Just me? Okay.'], later: 'Of course! Sorry. After.', thanks: 'Thank you!' },
    ];
    this.dotPinch = roomFor(G, DOT, 'works');
    this.dotRate = 0.42 * clamp(1 - this.dotPinch * 0.9, 0.38, 1);
  }
  layout() {
    const W = this.W, H = this.H; const pad = 16, gap = 10; const cw = (W - pad * 2 - gap * 3) / 4; const ch = Math.min(118, H * 0.26);
    this.cubbies = SYMS.map(([s, c], i) => ({ s, c, x: pad + i * (cw + gap), y: H - ch - 14, w: cw, h: ch, n: (this.cubbies[i] && this.cubbies[i].n) || 0, bump: 0, flash: 0 }));
    this.lw = Math.min(230, W * 0.52); this.lh = this.lw * 0.62; this.lx = W / 2 - this.lw / 2; this.ly = Math.max(70, H * 0.36 - this.lh / 2);
  }
  makeLetter() { const [s, c] = SYMS[Math.floor(Math.random() * 4)]; return { s, c, lines: [0.7, 0.5, 0.62].map((w) => w * (0.7 + Math.random() * 0.5)), t: 0, shake: 0, tilt: (Math.random() - 0.5) * 0.08 }; }
  start() {
    this.queue = [this.makeLetter(), this.makeLetter()]; this.spawnT = 1.6; this.target = this.calm ? 16 : 0; this.dur = this.calm ? 0 : 50;
    // the chute jams once, for everyone, whatever the room is like
    this.jamAt = this.calm ? 5 + Math.floor(Math.random() * 5) : this.dur * (0.25 + Math.random() * 0.35); this.jammed = false; this.jams = 0;
    this.hint();
  }
  hint() { const cur = this.queue[0]; this.ui.hint.textContent = this.jammed ? 'The chute is jammed. Tap it, or press 0.' : cur ? `Letter: ${cur.s}. Sorted ${this.count}.` : `Sorted ${this.count}.`; }
  chuteRect() { return { x: this.W / 2 - this.lw * 0.42, y: 0, w: this.lw * 0.84, h: 46 }; }
  unjam() { if (!this.jammed) return; this.jammed = false; this.spawnT = 0.3; this.G.audio.sfx('thwip', { n: 60 }); this.hint(); }
  focusRect() { return this.queue[0] ? { x: this.lx, y: this.ly, w: this.lw, h: this.lh } : null; }
  pick(i) {
    const cur = this.queue[0]; const cb = this.cubbies[i]; if (!cur || !cb || this.room.blocking()) return;
    this.room.acted();
    if (cb.s === cur.s) {
      this.queue.shift(); this.count++; this.combo = this.t - this.lastOk < 2.6 ? this.combo + 1 : 1; this.lastOk = this.t;
      this.fly.push({ L: cur, from: [this.lx + this.lw / 2, this.ly + this.lh / 2], to: [cb.x + cb.w / 2, cb.y + cb.h * 0.45], t: 0, cb });
      this.G.audio.sfx('thwip', { n: 72 + Math.min(12, this.combo * 2) });
      if ([3, 5, 8, 12, 16, 20].includes(this.combo)) this.fx.float(this.W / 2, this.ly - 10, '×' + this.combo + '!', '#d9603b', { size: 26 });
      if (this.calm && this.count >= this.target) setTimeout(() => this.end(), 400);
    } else { cur.shake = 0.4; cb.flash = 0.5; this.wrong++; this.combo = 0; this.G.audio.sfx('bonk'); }
    this.hint();
  }
  pointer(type, x, y) {
    if (type !== 'down') return;
    if (this.jammed) { const c = this.chuteRect(); if (x >= c.x - 10 && x <= c.x + c.w + 10 && y <= c.y + c.h + 16) { this.unjam(); return; } }
    this.cubbies.forEach((cb, i) => { if (x >= cb.x && x <= cb.x + cb.w && y >= cb.y && y <= cb.y + cb.h) this.pick(i); });
  }
  key(e) { const k = keyName(e); if (/^[1-4]$/.test(k)) { e.preventDefault(); this.pick(+k - 1); } else if (this.jammed && (k === '0' || k === 'Enter' || k === ' ')) { e.preventDefault(); this.unjam(); } }
  update(dt) {
    this.playT += dt;
    if (!this.calm && this.playT >= this.dur) { this.end(); return; }
    const prog = this.calm ? Math.min(1, this.count / 16) : this.playT / this.dur;
    if (!this.jammed && this.jams === 0 && (this.calm ? this.count >= this.jamAt : this.playT >= this.jamAt)) { this.jammed = true; this.jams = 1; this.G.audio.sfx('bonk'); this.hint(); }
    if (!this.jammed) this.spawnT -= dt;
    const want = this.calm ? 2 : 6;
    if (!this.queue.length && !this.jammed) this.spawnT = Math.min(this.spawnT, 0.22);
    if (this.spawnT <= 0 && this.queue.length < want) { this.queue.push(this.makeLetter()); this.spawnT = this.calm ? 0.4 : lerp(1.9, 1.05, prog); }
    for (const L of this.queue) { L.t += dt; if (L.shake > 0) L.shake -= dt; }
    for (const f of this.fly) f.t += dt; for (const f of this.fly) if (f.t >= 0.32 && !f.done) { f.done = true; f.cb.n++; f.cb.bump = 1; this.fx.burst(f.to[0], f.to[1], 12, [f.L.c, '#fffaf0', '#ffcf7a'], { speed: 240, size: 7 }); }
    this.fly = this.fly.filter((f) => f.t < 0.34);
    for (const cb of this.cubbies) { cb.bump = Math.max(0, cb.bump - dt * 4); cb.flash = Math.max(0, cb.flash - dt * 2); }
    this.dotN += this.dotRate * dt * (this.calm ? 0.8 : 1);
  }
  // a letter: three lines of address and a symbol stamped in the corner
  drawLetter(ctx, L, x, y, w, h, o = {}) {
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(L.tilt + (L.shake > 0 ? Math.sin(L.shake * 60) * 0.06 : 0)); if (o.scale) ctx.scale(o.scale, o.scale);
    shadow(ctx, 14, 6, 0.2); ctx.fillStyle = '#fffdf6'; rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill(); noShadow(ctx);
    ctx.strokeStyle = 'rgba(43,37,48,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 8, -h / 2 + 8); ctx.lineTo(0, h * 0.05); ctx.lineTo(w / 2 - 8, -h / 2 + 8); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.fillStyle = C.ink; L.lines.forEach((lw, i) => { rr(ctx, -w * 0.38, h * 0.08 + i * h * 0.12, w * 0.5 * lw, h * 0.055, 3); ctx.fill(); }); ctx.globalAlpha = 1;
    const ss = h * 0.46; const sx = w / 2 - ss * 0.72, sy = -h / 2 + ss * 0.72;
    ctx.fillStyle = '#fbf3e4'; rr(ctx, sx - ss * 0.6, sy - ss * 0.6, ss * 1.2, ss * 1.2, 6); ctx.fill(); ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(43,37,48,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    symbol(ctx, L.s, sx, sy, ss * 0.9, L.c);
    ctx.restore();
  }
  draw(ctx, mode) {
    const W = this.W, H = this.H; if (!this.cubbies.length) this.layout();
    // wall, chute and desk
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dfe7ec'); g.addColorStop(0.55, '#e9eef1'); g.addColorStop(0.56, '#c9a27a'); g.addColorStop(1, '#b88d63'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, H * 0.56 + i * 22, W, 1.5);
    ctx.fillStyle = '#5b6470'; rr(ctx, W / 2 - this.lw * 0.42, -12, this.lw * 0.84, 46, 12); ctx.fill(); ctx.fillStyle = '#3d444e'; rr(ctx, W / 2 - this.lw * 0.36, 14, this.lw * 0.72, 10, 5); ctx.fill();
    ctx.font = FONT(600, 12); ctx.fillStyle = this.jammed && mode === 'play' ? '#ffcf7a' : '#e9f6ff'; ctx.textAlign = 'center'; ctx.fillText(this.jammed && mode === 'play' ? 'JAMMED · TAP HERE' : 'INCOMING', W / 2, 9);
    // the demo: one letter glides to its cubby
    if (mode === 'demo') {
      const L = this.demoL || (this.demoL = { s: 'triangle', c: '#f6cf5b', lines: [0.7, 0.5, 0.6], tilt: 0.02, shake: 0 });
      const k = (this.demoT % 2.2) / 2.2; const cb = this.cubbies[1];
      const a = ease.inOut(clamp((k - 0.35) / 0.4)); const x = lerp(this.lx, cb.x + cb.w / 2 - this.lw * 0.3, a), y = lerp(this.ly, cb.y - this.lh * 0.2, a);
      this.drawCubbies(ctx, k > 0.75 ? 1 : -1);
      this.drawLetter(ctx, L, x, y, this.lw, this.lh, { scale: lerp(1, 0.6, a) });
      if (k > 0.15 && k < 0.4) { const hx = cb.x + cb.w / 2, hy = cb.y + cb.h * 0.55; ctx.fillStyle = 'rgba(43,37,48,0.25)'; ctx.beginPath(); ctx.arc(hx, hy, 22 * (1 - (k - 0.15) * 2), 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    // the queue peeking out of the chute
    for (let i = Math.min(this.queue.length - 1, 3); i >= 1; i--) { const L = this.queue[i]; ctx.globalAlpha = 0.9; this.drawLetter(ctx, L, W / 2 - this.lw * 0.3 + i * 10, 26 + i * 6 - this.lh * 0.55, this.lw * 0.6, this.lh * 0.6); ctx.globalAlpha = 1; }
    const cur = this.queue[0];
    if (cur) { const k = ease.outBack(clamp(cur.t / 0.35)); this.drawLetter(ctx, cur, this.lx, lerp(-this.lh, this.ly, k), this.lw, this.lh); }
    else if (mode === 'play') { ctx.font = FONT(600, 18); ctx.fillStyle = C.soft; ctx.textAlign = 'center'; ctx.fillText(this.jammed ? 'The chute is jammed. Tap it.' : 'Waiting for the chute…', W / 2, this.ly + this.lh / 2); }
    this.drawCubbies(ctx, -1);
    for (const f of this.fly) { const k = ease.inOut(clamp(f.t / 0.32)); const x = lerp(f.from[0], f.to[0], k), y = lerp(f.from[1], f.to[1], k) - Math.sin(k * Math.PI) * 60; this.drawLetter(ctx, f.L, x - this.lw * 0.5 * (1 - k * 0.6), y - this.lh * 0.5 * (1 - k * 0.6), this.lw * (1 - k * 0.6), this.lh * (1 - k * 0.6)); }
    // score, top left
    ctx.font = FONT(700, 22); ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(String(this.count), 18, 34); ctx.font = FONT(600, 12); ctx.fillStyle = C.soft; ctx.fillText(this.calm ? `sorted of ${this.target}` : 'sorted', 18, 50);
    // Dot, at the next desk, as she goes
    if (mode === 'play') {
      if (this.dotImg) { ctx.save(); ctx.beginPath(); ctx.arc(30, 72, 12, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(this.dotImg, 18, 60, 24, 24); ctx.restore(); }
      ctx.font = FONT(600, 13); ctx.fillStyle = C.soft; ctx.textAlign = 'left'; ctx.fillText((this.mateName || 'Dot') + ': ' + (this.mateIdle ? 'idle' : Math.floor(this.dotN)), 48, 77);
    }
  }
  drawCubbies(ctx, lit) {
    this.cubbies.forEach((cb, i) => {
      const b = ease.outCubic(cb.bump); ctx.save(); ctx.translate(cb.x + cb.w / 2, cb.y + cb.h / 2); ctx.scale(1 + b * 0.06, 1 - b * 0.05);
      shadow(ctx, 10, 4, 0.18); ctx.fillStyle = '#fbf3e4'; rr(ctx, -cb.w / 2, -cb.h / 2, cb.w, cb.h, 14); ctx.fill(); noShadow(ctx);
      ctx.fillStyle = '#e7d9c2'; rr(ctx, -cb.w / 2 + 8, -cb.h / 2 + 8, cb.w - 16, cb.h * 0.5, 9); ctx.fill();
      if (cb.flash > 0) { ctx.strokeStyle = `rgba(217,96,59,${cb.flash * 2})`; ctx.lineWidth = 4; rr(ctx, -cb.w / 2, -cb.h / 2, cb.w, cb.h, 14); ctx.stroke(); }
      if (lit === i) { ctx.strokeStyle = 'rgba(63,143,90,0.9)'; ctx.lineWidth = 4; rr(ctx, -cb.w / 2, -cb.h / 2, cb.w, cb.h, 14); ctx.stroke(); }
      const ss = Math.min(cb.w, cb.h) * 0.36; symbol(ctx, cb.s, 0, -cb.h * 0.2, ss, cb.c);
      ctx.font = FONT(600, 13); ctx.fillStyle = C.soft; ctx.textAlign = 'center'; ctx.fillText((this.touch ? '' : (i + 1) + ' · ') + cb.n, 0, cb.h / 2 - 12);
      ctx.restore();
    });
  }
  results() {
    const G = this.G, S = G.S; const n = this.count; const dot = Math.floor(this.dotN);
    S.work = S.work || {}; const prev = S.work.sort; S.work.sort = { n, dot, day: S.day };
    const gil = n >= 26 ? 'Gil: "Whoa. Is that a record? That might be a record."' : n >= 14 ? 'Gil: "Nice! Great first day! Great, great."' : 'Gil: "Great! Honestly? Nobody hits a number on their first day."';
    const dim = S.fixes.dim === 'built';
    const mate = dim ? `Dot sorted <b>${dot}</b>. "Did they change the lights? My eyes have stopped arguing with me."` : this.dotPinch > 0.25 ? `Dot sorted <b>${dot}</b>. "Is it just me, or does that light do a little dance? Every day. Every single day."` : `Dot sorted <b>${dot}</b>. "Not bad for a Monday."`;
    const jam = this.jams && !this.skipped ? ' The chute jammed once. It does that to everyone.' : '';
    const roomExtra = this.room && this.room.cost.glare >= 1 ? 'Dot has turned her desk away from the panel.' : '';
    return { headline: this.skipped ? 'Shift done' : `${n} letter${n === 1 ? '' : 's'} sorted`, line: this.skipped ? '' : gil + jam, mate, mateImg: this.dotImg ? this.dotImg.src : '', n, dot, cost: this.room ? this.room.cost : null, prev, roomExtra };
  }
  auto(q = 0.9) { if (this.mode === 'demo') { this.over.querySelector('.go') && this.over.querySelector('.go').click(); return true; } if (this.mode === 'play') { this.count = Math.round(20 * q); this.dotN = 18; this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}
