// Fix-It Blueprint (Clover's shed): arrange a place so everyone has somewhere that fits.
// Turning everything down fails the lively people; zones work. And the Plain Note: who, what, by when.
import { MiniGame, C, rr, shadow, noShadow, ease, FONT, BODY, loadImg, mix } from './kit.js';
import { CAST } from '../content.js';
import { clamp, lerp, esc, FAST as FAST0, params, keyName } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

const LEVEL_COL = { sound: ['#cfe8e3', '#dcefd0', '#f6e7b5', '#f7c9a0', '#f2a99a'], light: ['#7f86b3', '#aeaed4', '#e6dcc0', '#fbe9a3', '#fff7d6'] };
export const BLUEPRINTS = {
  quiet: {
    title: 'Market Square at noon', dim: 'sound', icon: '♪', lo: 'quiet', hi: 'loud',
    grid: [[4, 4, 4, 3, 3, 3], [4, 4, 4, 3, 3, 3], [3, 4, 3, 3, 3, 3], [3, 3, 3, 3, 3, 3]],
    people: [['moss', 0, 1, [5, 3]], ['bea', 0, 2, [4, 2]], ['pip', 3, 4, [1, 1]], ['rue', 2, 4, [2, 0]], ['pomeroy', 3, 4, [0, 0]], ['baby', 0, 1, [0, 3], 'Parent and baby', '#bfa9f0'], ['you', 0, 0, [3, 1]]],
    mods: [{ k: 'corner', name: 'Quiet corner', sub: 'much quieter here and next to it', n: 2, icon: '🌿' }, { k: 'down', name: 'Turn everything down', sub: 'a little quieter everywhere', n: 2, icon: '▼', global: true }, { k: 'stage', name: 'Music corner', sub: 'louder here and next to it', n: 1, icon: '♪' }],
    win: 'That\'s not a quieter market. That\'s a market with a quiet part.', lose: 'Somebody is still left without a spot. Try making places, not making everything the same.',
  },
  dim: {
    title: 'The Works, the open office', dim: 'light', icon: '☀', lo: 'dim', hi: 'bright',
    grid: [[4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 4, 4], [4, 4, 4, 4, 3, 3]],
    people: [['gil', 1, 2, [5, 0]], ['dot', 0, 2, [2, 2], 'Dot', '#9edcd6'], ['fen', 3, 4, [0, 0], 'Fen', '#f6cf5b'], ['ola', 2, 4, [4, 3], 'Ola', '#ffc98e'], ['you', 0, 0, [1, 3]]],
    mods: [{ k: 'soften', name: 'Soften the panels', sub: 'a lot dimmer everywhere', n: 1, icon: '▼', global: true }, { k: 'lamp', name: 'A desk lamp you control', sub: 'this desk can be any brightness', n: 2, icon: '💡' }, { k: 'blind', name: 'Blinds', sub: 'dimmer in this column', n: 1, icon: '▥' }],
    win: 'Softer panels, and a lamp for anyone who wants more. Everybody gets a dial.', lose: 'Somebody is still squinting, or straining in the dark. Try giving people control.',
  },
};
const NAMES = { baby: 'Parent and baby', dot: 'Dot', fen: 'Fen', ola: 'Ola' };
// people who are not in the cast still get a face
const EXTRA_LOOKS = { baby: { shape: 'round', color: '#bfa9f0', pattern: 'belly', top: 'longears', wear: 'scarf' }, dot: { shape: 'tall', color: '#9edcd6', pattern: 'spots', top: 'tuft', wear: 'glasses' }, fen: { shape: 'spiky', color: '#f6cf5b', pattern: 'plain', top: 'horns', wear: 'none' }, ola: { shape: 'blobby', color: '#ffc98e', pattern: 'stripes', top: 'tuft', wear: 'glasses' } };

export class Blueprint extends MiniGame {
  constructor(G, fix, o = {}) {
    const B = BLUEPRINTS[fix];
    super(G, Object.assign({ id: 'blueprint', verb: 'Arrange', title: 'Sketch: ' + B.title, where: 'Clover\'s Fix-It Shed', zone: null, music: 'home', theme: 'shed',
      how: `Everyone needs somewhere that fits. Each face is a person, with the ${B.dim} they can manage. People only walk a little way, so put changes <b>near the people who need them</b>. Pick a change below, then tap a square; tap it again to take it back. Get <b>every face glowing</b>.`,
      roomNote: 'Clover: "One rule. Don\'t make it the same everywhere. Make places."' }, o));
    this.fix = fix; this.B = B; this.placed = []; this.sel = 0; this.done = false; this.solvedOnce = false; this.cursor = [2, 1];
    this.left = B.mods.map((m) => m.n);
  }
  async prepare() {
    const G = this.G, S = G.S; const B = this.B;
    const pv = S.profile[B.dim]; const yc = Math.round(pv * 4);
    this.people = B.people.map(([id, lo, hi, at, label, color]) => {
      if (id === 'you') { lo = clamp(yc - 1, 0, 4); hi = clamp(yc + 1, 0, 4); }
      return { id, lo, hi, reach: id === 'you' ? 3 : 2, home: at, x: at[0], y: at[1], tx: at[0], ty: at[1], label: id === 'you' ? 'You' : CAST[id] ? CAST[id].name : (label || NAMES[id] || id), color: id === 'you' ? S.look.color : CAST[id] ? CAST[id].look.color : color, fit: false, why: '' };
    });
    const looks = this.people.map((p) => (p.id === 'you' ? S.look : CAST[p.id] ? CAST[p.id].look : EXTRA_LOOKS[p.id] || null));
    const imgs = await Promise.all(looks.map((l) => (l ? loadImg(G.portraitOf(l, { bg: '#f3eadb' })) : Promise.resolve(null))));
    this.people.forEach((p, i) => { p.img = imgs[i]; });
    this.solve(true);
  }
  layout() {
    const W = this.W, H = this.H; this.tr = H > W * 1.05; const cols = this.tr ? 4 : 6, rows = this.tr ? 6 : 4; const top = 18;
    const bottom = this.tr ? Math.min(186, H * 0.3) : Math.min(118, H * 0.3);
    const cs = Math.max(30, Math.min((W - 24) / cols, (H - top - bottom - 30) / rows)); this.cs = cs;
    this.gx = W / 2 - cs * cols / 2; this.gy = top; this.gw = cols; this.gh = rows;
    if (this.tr) { const bh = (bottom - 14) / 3; this.btns = this.B.mods.map((m, i) => ({ i, x: 12, y: H - bottom + 4 + i * (bh + 3), w: W - 24, h: bh })); }
    else { const bw = Math.min(220, (W - 40) / 3); this.btns = this.B.mods.map((m, i) => ({ i, x: W / 2 - (bw * 3 + 16) / 2 + i * (bw + 8), y: H - bottom + 10, w: bw, h: bottom - 22 })); }
  }
  cellXY(c, r) { return this.tr ? [this.gx + r * this.cs, this.gy + c * this.cs] : [this.gx + c * this.cs, this.gy + r * this.cs]; }
  cellAt(x, y) { const a = Math.floor((x - this.gx) / this.cs), b = Math.floor((y - this.gy) / this.cs); if (this.tr) return a >= 0 && a < 4 && b >= 0 && b < 6 ? [b, a] : null; return a >= 0 && a < 6 && b >= 0 && b < 4 ? [a, b] : null; }
  level(c, r) {
    let v = this.B.grid[r][c]; let lamp = false;
    for (const p of this.placed) {
      const m = this.B.mods[p.i]; const d = Math.abs(p.c - c) + Math.abs(p.r - r);
      if (m.k === 'corner') v -= d === 0 ? 3 : d === 1 ? 2 : 0;
      if (m.k === 'stage') v += d <= 1 ? 1 : 0;
      if (m.k === 'down') v -= 1;
      if (m.k === 'soften') v -= 2;
      if (m.k === 'blind' && p.c === c) v -= 2;
      if (m.k === 'lamp' && d === 0) lamp = true;
    }
    return { v: clamp(v, 0, 4), lamp };
  }
  // every person walks to the nearest square inside their range; a lamp square fits whoever takes it, one person each
  solve(snap) {
    const used = {}; let all = true; let minV = 9, maxV = -1;
    const order = this.people.slice().sort((a, b) => (a.hi - a.lo) - (b.hi - b.lo));
    const find = (p, lamps) => { let best = null, bd = 1e9; p.minV = 9; p.maxV = -1; for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const d = Math.abs(c - p.home[0]) + Math.abs(r - p.home[1]); if (d > p.reach) continue; const L = this.level(c, r); p.minV = Math.min(p.minV, L.v); p.maxV = Math.max(p.maxV, L.v); const ok = lamps ? L.lamp && !used[c + ',' + r] : !L.lamp && L.v >= p.lo && L.v <= p.hi; if (!ok) continue; if (d < bd) { bd = d; best = [c, r, L.lamp]; } } return best; };
    for (const p of order) p.spot = find(p, false);
    for (const p of order) if (!p.spot) { p.spot = find(p, true); if (p.spot) used[p.spot[0] + ',' + p.spot[1]] = 1; }
    for (const p of order) {
      const best = p.spot;
      if (best) { p.fit = true; p.tx = best[0]; p.ty = best[1]; p.why = ''; }
      else { p.fit = false; p.tx = p.home[0]; p.ty = p.home[1]; all = false; p.why = p.minV > p.hi ? 'too ' + this.B.hi + ' nearby' : p.maxV < p.lo ? 'too ' + this.B.lo + ' nearby' : 'no spot nearby'; }
      if (snap) { p.x = p.tx; p.y = p.ty; }
    }
    this.allFit = all;
    if (all && !this.solvedOnce && this.running) { this.solvedOnce = true; this.G.audio.sfx('good'); this.fx.burst(this.W / 2, this.gy + this.cs * this.gh / 2, 30, ['#9fd3b0', '#ffcf7a', '#f3a0c2', '#9edcd6'], { speed: 380, size: 8 }); this.hintText(); setTimeout(() => this.end(), FAST ? 30 : 1600); }
    return all;
  }
  hintText() { const n = this.people.filter((p) => p.fit).length; this.ui.hint.textContent = this.allFit ? 'Everyone has somewhere that fits.' : `${n} of ${this.people.length} people have somewhere that fits.`; this.ui.side.innerHTML = '<button class="mini-btn asis">Sketch it as it is</button>'; this.ui.side.querySelector('.asis').onclick = () => this.end(); }
  start() { this.dur = 0; this.hintText(); }
  place(c, r) {
    if (!this.running) return;
    const at = this.placed.findIndex((p) => p.c === c && p.r === r && !this.B.mods[p.i].global);
    if (at >= 0) { const p = this.placed.splice(at, 1)[0]; this.left[p.i]++; this.G.audio.sfx('back'); }
    else {
      const m = this.B.mods[this.sel]; if (this.left[this.sel] <= 0) { this.G.audio.sfx('bonk'); this.fx.float(this.W / 2, this.gy + 12, 'None left of that one', C.soft, { size: 16 }); return; }
      this.placed.push({ i: this.sel, c, r }); this.left[this.sel]--; this.G.audio.sfx('ink');
      { const [bx, by] = this.cellXY(c, r); this.fx.burst(bx + this.cs / 2, by + this.cs / 2, 10, ['#ffcf7a', '#fbf6ee'], { speed: 160, size: 6 }); }
    }
    this.solve(false); this.hintText();
  }
  pickMod(i) {
    const m = this.B.mods[i]; if (!m) return; this.sel = i; this.G.audio.sfx('select');
    if (m.global) { // global changes cycle: off, once, twice, and back to off
      if (this.left[i] > 0) { this.placed.push({ i, c: -1, r: -1 }); this.left[i]--; this.G.audio.sfx('ink'); }
      else { this.placed = this.placed.filter((p) => p.i !== i); this.left[i] = m.n; this.G.audio.sfx('back'); }
      this.solve(false); this.hintText();
    }
  }
  pointer(type, x, y) {
    if (type !== 'down') return;
    for (const b of this.btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.pickMod(b.i); return; }
    const at = this.cellAt(x, y);
    if (at) { const [c, r] = at; this.cursor = [c, r]; if (!this.B.mods[this.sel].global) this.place(c, r); }
  }
  key(e) {
    let d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d && this.tr) d = [d[1], d[0]]; // on a tall screen the grid is drawn turned, so the arrows turn with it
    if (d) { e.preventDefault(); this.cursor = [clamp(this.cursor[0] + d[0], 0, 5), clamp(this.cursor[1] + d[1], 0, 3)]; return; }
    const k = keyName(e); if (/^[1-3]$/.test(k)) { this.pickMod(+k - 1); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!this.B.mods[this.sel].global) this.place(this.cursor[0], this.cursor[1]); }
  }
  update(dt) { for (const p of this.people) { p.x = lerp(p.x, p.tx, 1 - Math.exp(-dt * 6)); p.y = lerp(p.y, p.ty, 1 - Math.exp(-dt * 6)); } }
  draw(ctx, mode) {
    const W = this.W, H = this.H; if (!this.btns) this.layout(); const cs = this.cs, gx = this.gx, gy = this.gy; const B = this.B;
    ctx.fillStyle = '#e9dcc5'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(79,111,143,0.12)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    shadow(ctx, 14, 6, 0.18); ctx.fillStyle = '#fbf6ee'; rr(ctx, gx - 8, gy - 8, cs * this.gw + 16, cs * this.gh + 16, 16); ctx.fill(); noShadow(ctx);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const L = this.level(c, r); const [x, y] = this.cellXY(c, r);
      const dark = B.dim === 'light' && L.v <= 1 && !L.lamp;
      ctx.fillStyle = L.lamp ? '#fff4d0' : LEVEL_COL[B.dim][L.v]; rr(ctx, x + 3, y + 3, cs - 6, cs - 6, 10); ctx.fill();
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k < L.v ? (dark ? 'rgba(255,255,255,0.8)' : 'rgba(43,37,48,0.45)') : (dark ? 'rgba(255,255,255,0.25)' : 'rgba(43,37,48,0.1)'); ctx.beginPath(); ctx.arc(x + 12 + k * 8, y + cs - 12, 2.6, 0, Math.PI * 2); ctx.fill(); }
      const pm = this.placed.find((p) => p.c === c && p.r === r); if (pm) { ctx.font = FONT(600, Math.min(26, cs * 0.4)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(B.mods[pm.i].icon, x + cs - 18, y + 18); }
      if (L.lamp) { ctx.font = FONT(600, 11); ctx.fillStyle = '#8a5a1a'; ctx.textAlign = 'center'; ctx.fillText('any', x + cs / 2, y + cs - 26); }
      if (this.cursor[0] === c && this.cursor[1] === r && !this.touch && mode === 'play') { ctx.strokeStyle = '#4fb3a9'; ctx.lineWidth = 3; rr(ctx, x + 2, y + 2, cs - 4, cs - 4, 11); ctx.stroke(); }
      // people who have nowhere yet: show how far they can walk
      if (mode === 'play' && this.people.some((p) => !p.fit && Math.abs(c - p.home[0]) + Math.abs(r - p.home[1]) <= p.reach)) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(168,72,63,0.35)'; ctx.lineWidth = 2; rr(ctx, x + 6, y + 6, cs - 12, cs - 12, 8); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.textBaseline = 'alphabetic';
    // the people
    for (const p of this.people) {
      const [px0, py0] = this.cellXY(p.x, p.y); const x = px0 + cs / 2, y = py0 + cs / 2 - 4; const rad = Math.min(26, cs * 0.3);
      ctx.save(); if (p.fit) { ctx.shadowColor = 'rgba(255,200,90,0.95)'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = p.fit ? '#fffaf0' : '#c9c3cc'; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad - 3, 0, Math.PI * 2); ctx.clip();
      if (p.img) { if (!p.fit) ctx.globalAlpha = 0.5; ctx.drawImage(p.img, x - rad * 1.25, y - rad * 1.15, rad * 2.5, rad * 2.5); } else { ctx.fillStyle = p.fit ? p.color : '#b9b3bd'; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); ctx.fillStyle = C.ink; ctx.font = FONT(700, rad * 0.8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label[0], x, y + 1); ctx.textBaseline = 'alphabetic'; }
      ctx.restore();
      const fs = Math.max(11, Math.min(13, cs * 0.16));
      ctx.font = FONT(600, fs); ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.fillText(p.label, x, y + rad + fs + 1, cs * 1.4);
      ctx.font = BODY(fs - 0.5); ctx.fillStyle = p.fit ? '#3f8f5a' : '#a8483f'; ctx.fillText(p.fit ? '✓ fits' : p.why, x, y + rad + fs * 2 + 2, cs * 1.4);
      ctx.fillStyle = 'rgba(43,37,48,0.6)'; ctx.font = FONT(600, fs - 1); ctx.fillText(this.B.icon + ' ' + p.lo + '–' + p.hi, x, y - rad - 5);
    }
    // the change buttons
    for (const b of this.btns) {
      const m = B.mods[b.i]; const on = this.sel === b.i; const used = m.n - this.left[b.i];
      shadow(ctx, 8, 3, 0.15); ctx.fillStyle = on ? C.ink : '#fffaf0'; rr(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill(); noShadow(ctx);
      const state = m.global ? (used ? (this.left[b.i] ? 'on ×' + used + ' · tap for more' : 'on ×' + used + ' · tap to turn off') : 'off · tap to apply') : this.left[b.i] + ' left · tap a square';
      ctx.fillStyle = on ? C.paper : C.ink; ctx.textAlign = 'left'; ctx.font = FONT(600, 14); ctx.fillText((this.touch ? '' : (b.i + 1) + '  ') + m.icon + '  ' + m.name, b.x + 10, b.y + (this.tr ? b.h / 2 - 2 : 22), b.w - 16);
      ctx.font = BODY(12); ctx.fillStyle = on ? 'rgba(251,246,238,0.8)' : C.soft;
      if (this.tr) { ctx.fillText(m.sub, b.x + 10, b.y + b.h / 2 + 14, b.w * 0.6); ctx.textAlign = 'right'; ctx.font = FONT(600, 12); ctx.fillText(state, b.x + b.w - 10, b.y + b.h / 2 + 5); ctx.textAlign = 'left'; }
      else { ctx.fillText(m.sub, b.x + 10, b.y + 40, b.w - 16); ctx.font = FONT(600, 12); ctx.fillText(state, b.x + 10, b.y + b.h - 10); }
    }
    // legend
    ctx.font = FONT(600, 11); ctx.fillStyle = C.soft; ctx.textAlign = 'right'; ctx.fillText(this.B.icon + ' ' + this.B.lo + ' 0 · · · 4 ' + this.B.hi, gx + cs * this.gw, gy + cs * this.gh + 20);
  }
  results() {
    const S = this.G.S; S.sketch = S.sketch || {}; S.sketch[this.fix] = this.allFit ? 'zoned' : 'plain';
    if (this.allFit) this.G.story.fieldNote('zoning');
    return { headline: this.allFit ? 'Everyone has somewhere that fits' : 'A sketch, for now', line: 'Clover: "' + (this.allFit ? this.B.win : this.B.lose) + '"', zoned: this.allFit, button: 'Take the sketch' };
  }
  auto(q = 0.9) { if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; } if (this.mode === 'play') { if (q > 0.5) { this.allFit = true; } this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}

// The Plain Note: turn a vague brief into who, what and by when. Each wrong pick says why it would not work.
const NOTE_SLOTS = [
  { k: 'who', label: 'Who', opts: [['someone', 0, 'Someone is nobody in particular. Wren would wait for someone else to do it.'], ['the team', 0, 'The team is everybody, which is nobody.'], ['Gil', 0, 'Gil sent the brief. He is not the one making lanterns.'], ['Wren', 1]] },
  { k: 'what', label: 'What', opts: [['make it pop', 0, 'Pop is not a size. Pop is not a color.'], ['the lantern thing', 0, 'Which thing?'], ['one hundred lanterns by tonight', 0, 'Specific, but nobody could do it. Plain also means possible.'], ['two lantern designs, 12 inches, amber or teal', 1]] },
  { k: 'when', label: 'By when', opts: [['whenever, no rush!!', 0, 'Whenever could mean tonight or never. Wren would have to guess which.'], ['ASAP-ish', 0, 'ASAP-ish is a feeling, not a time.'], ['yesterday', 0, 'Yesterday has already happened.'], ['Wednesday at noon', 1]] },
];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export class PlainNote extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'plain', verb: 'Rewrite', title: 'The plain note', where: 'Clover\'s Fix-It Shed', zone: null, music: 'home', theme: 'shed',
      how: 'Here is the brief Wren got from the Works. Rewrite it as one plain line: <b>who</b> does <b>what</b>, <b>by when</b>. Pick one of each.' }, o));
    this.pick = {}; this.rows = NOTE_SLOTS.map((s) => Object.assign({}, s, { opts: shuffle(s.opts) }));
  }
  update() {}
  draw(ctx) { ctx.fillStyle = '#e9dcc5'; ctx.fillRect(0, 0, this.W, this.H); }
  start() {
    this.dur = 0;
    const box = document.createElement('div'); box.className = 'plainbox';
    box.innerHTML = `<div class="memo old"><div class="ml">The brief, as sent</div>Hi team!! Let's make the festival <b>pop</b> ✨ Can someone take a look at the lantern thing whenever? No rush!! Thanks!!!</div>
      ${this.rows.map((s) => `<div class="prow"><span>${s.label}</span><div class="chips" data-slot="${s.k}">${s.opts.map(([t, ok], j) => `<button class="chip" data-j="${j}" data-plain="${ok}">${esc(t)}</button>`).join('')}</div></div>`).join('')}
      <div class="memo new"><div class="ml">Your note</div><span class="preview">…</span><div class="why" aria-live="polite"></div></div><button class="btn primary send" disabled>Send it</button>`;
    this.over.appendChild(box); this.box = box;
    box.querySelectorAll('[data-slot]').forEach((row) => row.addEventListener('click', (e) => { const b = e.target.closest('[data-j]'); if (!b) return; const k = row.dataset.slot; this.pick[k] = +b.dataset.j; row.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); this.G.audio.sfx('select'); this.preview(); }));
    box.querySelector('.send').onclick = () => this.send();
    this.ui.hint.textContent = 'Pick one of each.';
  }
  opt(k) { const s = this.rows.find((x) => x.k === k); return this.pick[k] != null ? s.opts[this.pick[k]] : null; }
  preview() {
    const v = (k) => { const o = this.opt(k); return o ? o[0] : '…'; };
    this.box.querySelector('.preview').textContent = `${v('who')}: ${v('what')}, by ${v('when')}.`;
    this.box.querySelector('.why').textContent = '';
    this.box.querySelector('.send').disabled = Object.keys(this.pick).length < 3;
  }
  send() {
    const wrong = this.rows.map((s) => this.opt(s.k)).filter((o) => o && !o[1]);
    const plain = wrong.length === 0;
    this.plain = plain; this.G.audio.sfx(plain ? 'good' : 'page');
    if (!plain) {
      const fb = this.box.querySelector('.memo.new'); fb.classList.remove('shake'); void fb.offsetWidth; fb.classList.add('shake');
      this.box.querySelector('.why').textContent = 'Not quite. ' + wrong[0][2];
      this.tries = (this.tries || 0) + 1;
      if (this.tries >= 2) { const b = this.box.querySelector('.send'); b.textContent = 'Send it anyway'; b.onclick = () => this.end(); }
      return;
    }
    this.fx.burst(this.W / 2, this.H / 2, 24, ['#9fd3b0', '#ffcf7a'], { speed: 300 }); setTimeout(() => this.end(), FAST ? 30 : 700);
  }
  results() {
    if (this.box) this.box.remove(); this.ui.hint.textContent = '';
    const S = this.G.S; S.sketch = S.sketch || {}; S.sketch.plain = this.plain ? 'zoned' : 'plain';
    return { headline: this.plain ? 'Plain as day' : 'A note, of sorts', line: this.plain ? 'Wren reads it: "Yes. Obviously yes. I can do Wednesday at noon."' : 'Clover: "Close. Plain is harder than it looks. That\'s why we need the rule."', button: 'Done', zoned: this.plain };
  }
  auto() { if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; } if (this.mode === 'play') { this.plain = true; this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}
