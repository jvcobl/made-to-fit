// Teach Unit (the Works, ten years on). Unit was built from the founders' building manual: bare desks, panels at full,
// nothing else. The room has changed since. You lead it across the floor and it follows a step behind, sensing the
// eight squares around it. When it senses something its manual doesn't have, it stops and asks. It can take in four
// changes today, so you choose what it learns, and what it learns becomes how it behaves. No timer, nothing to fail.
// A list of the changes stands in for the floor, for screen readers and switch users.
import { MiniGame, C, rr, shadow, noShadow, ease, FONT } from './kit.js';
import { clamp, lerp, esc, FAST as FAST0, params, keyName } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

// the floor as it is (8 wide, 6 deep): D desk, L lamp, P plant, B the plain-notes board, S door, E the mail chute
const ROOM = ['D.D.D..B', '........', 'DLD.DP..', '...P....', 'D.DLD.P.', 'S......E'];
const KIND = { L: 'lamp', P: 'plant', B: 'board' };
const WHERE = { '1,2': 'the lamp by your old desk', '3,4': 'the lamp by the window desk', '5,2': 'the plant by Gil\'s office', '3,3': 'the plant in the middle aisle', '6,4': 'the plant by the coffee corner', '7,0': 'the plain-notes board' };
export const QUIRK = { lamp: 'turns its screen down beside the lamps', plant: 'waters the plants on its way past', board: 'reads the plain notes aloud to anyone who asks' };
const BUDGET = 4;

export class TeachUnit extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'teach', verb: 'Teach', title: 'Teach Unit the room', where: 'The Works · ten years on', zone: null, music: 'works', theme: 'shed',
      how: 'Walk Unit around the floor: <b>arrow keys</b>, or <b>tap a square</b> next to you. It follows a step behind. When it notices something its manual doesn\'t have, it stops and asks. It can learn <b>four</b> things today. Bring it to the mail chute when you\'re done.',
      roomNote: 'Gil: "Whatever it learns, it keeps. Choose like it matters."' }, o));
    this.plain = !!o.plain; this.calm = true;
  }
  async prepare() {
    this.cells = ROOM.map((row, y) => row.split('').map((ch, x) => (ch === 'B' && !this.plain ? '.' : ch)));
    this.rows = this.cells.length; this.cols = this.cells[0].length;
    this.seen = {}; this.learned = []; this.left = []; this.q = null; this.queue = [];
    this.me = [0, 5]; this.unit = [0, 5]; this.trail = []; this.moveT = 0; this.ask = null; this.stop = 0; this.done = false;
    this.diffs = []; this.cells.forEach((row, y) => row.forEach((ch, x) => { if (KIND[ch]) this.diffs.push({ x, y, kind: KIND[ch], where: WHERE[x + ',' + y] || 'something' }); }));
  }
  start() { this.hint(); this.list(); }
  // portrait screens get the floor on its side: 6 wide, 8 tall, so each square stays big enough to tap
  layout() {
    const W = this.W, H = this.H; this.tall = H > W * 1.1;
    const cols = this.tall ? this.rows : this.cols, rows = this.tall ? this.cols : this.rows;
    this.cs = Math.floor(Math.min((W - 24) / cols, (H - 30) / rows)); this.ox = Math.round((W - this.cs * cols) / 2); this.oy = Math.round((H - this.cs * rows) / 2) + 6;
  }
  // grid (x, y) to screen and back
  toScreen(x, y) { return this.tall ? [this.ox + (this.rows - 1 - y) * this.cs, this.oy + x * this.cs] : [this.ox + x * this.cs, this.oy + y * this.cs]; }
  fromScreen(px, py) { const a = Math.floor((px - this.ox) / this.cs), b = Math.floor((py - this.oy) / this.cs); return this.tall ? [b, this.rows - 1 - a] : [a, b]; }
  open(x, y) { const ch = this.cells[y] && this.cells[y][x]; return ch === '.' || ch === 'S' || ch === 'E'; }
  hint() {
    const left = BUDGET - this.learned.length;
    this.ui.hint.textContent = this.ask ? 'Unit is asking: learn it, or leave it as floor?' : `Unit can take in ${left} more today. ${this.me[0] === 7 && this.me[1] === 5 ? 'You are at the chute.' : 'The chute is in the far corner.'}`;
  }
  // the changes, as buttons: lead Unit to each one (the same as walking there)
  list() {
    const side = this.ui.side; if (!side) return;
    side.innerHTML = `<details class="tlist"><summary>The floor as a list</summary>${this.diffs.map((d, i) => `<button class="mini-btn" data-d="${i}" ${this.seen[d.x + ',' + d.y] ? 'disabled' : ''}>Lead Unit to ${esc(d.where)}</button>`).join('')}<button class="mini-btn" data-d="chute">Lead Unit to the chute</button></details>`;
    side.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { if (b.dataset.d === 'chute') this.jump(7, 5); else { const d = this.diffs[+b.dataset.d]; const n = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [d.x + dx, d.y + dy]).find(([x, y]) => this.open(x, y)); if (n) this.jump(n[0], n[1]); } }; });
  }
  // the list moves you there directly; Unit catches up and senses what's around it
  jump(x, y) { if (this.ask || !this.running) return; this.unit = this.me.slice(); this.me = [x, y]; this.unit = [x, y]; this.sense(); this.after(); }
  step(dx, dy) {
    if (this.ask || !this.running || this.stop > 0) return;
    const nx = this.me[0] + dx, ny = this.me[1] + dy; if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows || !this.open(nx, ny)) { this.G.audio.sfx('bonk'); return; }
    this.unit = this.me.slice(); this.me = [nx, ny]; this.moveT = 0.14; this.G.audio.sfx('step');
    this.sense(); this.after();
  }
  after() { this.hint(); if (!this.ask && this.me[0] === 7 && this.me[1] === 5) setTimeout(() => this.finishWalk(), FAST ? 10 : 600); }
  // the eight squares around Unit: anything not in its manual, not yet decided, becomes a question
  sense() {
    const [ux, uy] = this.unit;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ux + dx, y = uy + dy; const k = x + ',' + y; const ch = this.cells[y] && this.cells[y][x];
      if (!KIND[ch] || this.seen[k] || this.queue.some((q) => q.k === k)) continue;
      this.queue.push({ k, x, y, kind: KIND[ch], where: WHERE[k] || 'something' });
    }
    if (!this.ask && this.queue.length) this.askNext();
  }
  askNext() {
    const q = this.queue.shift(); if (!q) { this.ask = null; this.renderAsk(); this.hint(); return; }
    this.ask = q; this.stop = 0.8; this.G.audio.sfx('tick'); this.renderAsk(); this.hint();
  }
  renderAsk() {
    let box = this.over.querySelector('.tq'); if (!this.ask) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'tq'; box.setAttribute('role', 'alertdialog'); this.over.appendChild(box); }
    const left = BUDGET - this.learned.length; const q = this.ask; const k = (n) => (this.touch ? '' : `<kbd>${n}</kbd>`);
    box.innerHTML = `<div class="tqs">UPDATING MAP?</div><p>${esc(q.where[0].toUpperCase() + q.where.slice(1))}. Its manual says this square is empty floor.</p><div class="row">${left > 0 ? `<button class="btn primary" data-a="learn">${k(1)}Learn it</button>` : ''}<button class="btn" data-a="leave">${k(left > 0 ? 2 : 1)}Leave it as floor</button></div><p class="small">${left > 0 ? `It can take in ${left} more today.` : 'It can\'t take in any more today.'}</p>`;
    box.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => this.answer(b.dataset.a === 'learn'); });
    this.G.ui.announce('Unit: updating map? ' + q.where + '. Learn it, or leave it as floor.');
  }
  answer(learn) {
    const q = this.ask; if (!q) return; const can = BUDGET - this.learned.length > 0;
    this.seen[q.k] = learn && can ? 'learned' : 'left';
    if (learn && can) { this.learned.push(q.kind); this.G.audio.sfx('ink'); this.fx.float(...this.center(q.x, q.y), 'MAP UPDATED', C.teal, { size: 16 }); } else { this.left.push(q.kind); this.G.audio.sfx('page'); }
    this.ask = null; this.list(); this.askNext();
    if (!this.ask && this.me[0] === 7 && this.me[1] === 5) setTimeout(() => this.finishWalk(), FAST ? 10 : 600);
  }
  finishWalk() { if (this.done || this.ask) return; this.done = true; this.end(); }
  center(x, y) { const [sx, sy] = this.toScreen(x, y); return [sx + this.cs / 2, sy + this.cs / 2]; }
  pointer(type, px, py) {
    if (type !== 'down' || this.ask) return;
    const [x, y] = this.fromScreen(px, py); const dx = Math.sign(x - this.me[0]), dy = Math.sign(y - this.me[1]);
    if (!dx && !dy) return;
    // one square at a time, toward where you tapped
    if (dx && dy && !this.open(this.me[0] + dx, this.me[1] + dy)) { if (this.open(this.me[0] + dx, this.me[1])) this.step(dx, 0); else this.step(0, dy); } else this.step(dx, dy);
  }
  key(e) {
    const k = keyName(e);
    if (this.ask) { if (k === '1' && BUDGET - this.learned.length > 0) { e.preventDefault(); this.answer(true); } else if ((k === '2') || (k === '1' && BUDGET - this.learned.length <= 0)) { e.preventDefault(); this.answer(false); } return; }
    const map = this.tall ? { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1], w: [-1, 0], s: [1, 0], a: [0, 1], d: [0, -1] } : { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const m = map[k] || map[String(k).toLowerCase()]; if (m) { e.preventDefault(); this.step(m[0], m[1]); }
  }
  focusRect() { const [x, y] = this.toScreen(this.me[0], this.me[1]); return { x, y, w: this.cs, h: this.cs }; }
  update(dt) { this.moveT = Math.max(0, this.moveT - dt); this.stop = Math.max(0, this.stop - dt); }
  draw(ctx, mode) {
    const W = this.W, H = this.H; if (!this.cells) return; if (!this.cs) this.layout();
    ctx.fillStyle = '#e9eef1'; ctx.fillRect(0, 0, W, H);
    const cs = this.cs;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const [sx, sy] = this.toScreen(x, y); const ch = this.cells[y][x]; const k = x + ',' + y;
      ctx.fillStyle = (x + y) % 2 ? '#dde3e8' : '#e3e8ec'; ctx.fillRect(sx, sy, cs, cs);
      if (ch === 'E') { ctx.fillStyle = '#5b6470'; rr(ctx, sx + cs * 0.15, sy + cs * 0.15, cs * 0.7, cs * 0.7, 8); ctx.fill(); ctx.fillStyle = '#e9f6ff'; ctx.font = FONT(600, Math.max(10, cs * 0.16)); ctx.textAlign = 'center'; ctx.fillText('CHUTE', sx + cs / 2, sy + cs / 2 + 4); }
      if (ch === 'S') { ctx.fillStyle = 'rgba(79,111,143,0.25)'; ctx.fillRect(sx, sy, cs, cs); }
      if (ch === 'D') { shadow(ctx, 6, 3, 0.15); ctx.fillStyle = '#e9e3d6'; rr(ctx, sx + cs * 0.1, sy + cs * 0.18, cs * 0.8, cs * 0.6, 6); ctx.fill(); noShadow(ctx); }
      if (KIND[ch]) this.drawThing(ctx, KIND[ch], sx, sy, cs);
      // Unit's map: faint blue, and what it has learned drawn in solid teal
      ctx.strokeStyle = 'rgba(79,143,200,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      if (ch === 'D') { rr(ctx, sx + cs * 0.08, sy + cs * 0.16, cs * 0.84, cs * 0.64, 6); ctx.stroke(); }
      ctx.setLineDash([]);
      if (this.seen[k] === 'learned') { ctx.strokeStyle = C.teal; ctx.lineWidth = 3; rr(ctx, sx + 4, sy + 4, cs - 8, cs - 8, 8); ctx.stroke(); }
      else if (this.seen[k] === 'left') { ctx.fillStyle = 'rgba(79,143,200,0.18)'; ctx.fillRect(sx + 4, sy + 4, cs - 8, cs - 8); }
    }
    // you and Unit
    const [ux, uy] = this.center(this.unit[0], this.unit[1]); this.drawUnit(ctx, ux, uy, cs * 0.32, mode === 'play' && this.ask);
    const [mx, my] = this.center(this.me[0], this.me[1]); ctx.fillStyle = (this.G.S.look && this.G.S.look.color) || '#93c2ee'; shadow(ctx, 8, 3, 0.2); ctx.beginPath(); ctx.arc(mx, my - (this.moveT > 0 ? 3 : 0), cs * 0.26, 0, Math.PI * 2); ctx.fill(); noShadow(ctx); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = FONT(600, 12); ctx.fillStyle = C.soft; ctx.textAlign = 'left'; ctx.fillText('Learned: ' + this.learned.length + ' of ' + BUDGET, 12, 18);
  }
  drawThing(ctx, kind, sx, sy, cs) {
    const cx = sx + cs / 2, cy = sy + cs / 2;
    if (kind === 'lamp') { ctx.fillStyle = '#2f3a4a'; ctx.fillRect(cx - 2, cy - cs * 0.05, 4, cs * 0.28); ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.moveTo(cx - cs * 0.18, cy); ctx.lineTo(cx + cs * 0.18, cy); ctx.lineTo(cx + cs * 0.08, cy - cs * 0.2); ctx.lineTo(cx - cs * 0.08, cy - cs * 0.2); ctx.closePath(); ctx.fill(); }
    if (kind === 'plant') { ctx.fillStyle = '#c97f5a'; rr(ctx, cx - cs * 0.14, cy + cs * 0.06, cs * 0.28, cs * 0.2, 4); ctx.fill(); ctx.fillStyle = '#5f8f4e'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i * 1.26) * cs * 0.12, cy - cs * 0.06 + Math.sin(i * 1.26) * cs * 0.08, cs * 0.1, 0, Math.PI * 2); ctx.fill(); } }
    if (kind === 'board') { ctx.fillStyle = '#fbf6ee'; rr(ctx, cx - cs * 0.3, cy - cs * 0.22, cs * 0.6, cs * 0.4, 4); ctx.fill(); ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = C.ink; for (let i = 0; i < 3; i++) ctx.fillRect(cx - cs * 0.22, cy - cs * 0.12 + i * cs * 0.09, cs * (0.4 - i * 0.08), 2); }
  }
  drawUnit(ctx, x, y, r, asking) {
    shadow(ctx, 8, 3, 0.2); ctx.fillStyle = '#d6c6ad'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); noShadow(ctx);
    ctx.fillStyle = '#c9b8a6'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.35, y - r * 0.8); ctx.lineTo(x + s * r * 0.75, y - r * 1.35); ctx.lineTo(x + s * r * 0.85, y - r * 0.55); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#16222b'; rr(ctx, x - r * 0.62, y - r * 0.42, r * 1.24, r * 0.8, 4); ctx.fill();
    ctx.fillStyle = '#9ef2e4'; ctx.font = FONT(700, Math.max(8, r * 0.42)); ctx.textAlign = 'center'; ctx.fillText(asking ? '?' : '• •', x, y + r * 0.12);
  }
  results() {
    const S = this.G.S; const n = this.learned.length; const kinds = [...new Set(this.learned)];
    const quirks = kinds.slice(0, 2).map((k) => QUIRK[k]); S.unitQuirks = kinds.slice(0, 2);
    const count = (k) => this.learned.filter((x) => x === k).length; const word = { lamp: ['a lamp', 'lamps'], plant: ['a plant', 'plants'], board: ['the board', 'the board'] };
    const what = kinds.map((k) => (count(k) > 1 ? count(k) + ' ' + word[k][1] : word[k][0]));
    const learnedLine = n ? 'Unit learned ' + (what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what[what.length - 1] : what[0]) + '. ' + (this.left.length ? 'It left ' + this.left.length + ' as floor, and will go round them every time like a surprise.' : 'It left nothing as floor.') : 'Unit learned nothing today. It goes round the room like a surprise, every time.';
    const quirkLine = quirks.length ? 'From now on, Unit ' + quirks.join(', and ') + '.' : '';
    return { headline: n >= 3 ? 'Unit knows the room' : n ? 'Unit knows some of the room' : 'Unit kept its manual', line: learnedLine + (quirkLine ? ' ' + quirkLine : ''), mate: 'At the window, Unit stops. Its screen says STREET AHEAD. Gil: "That was a plan. They never built the bridge." Unit: MAP UPDATED.', learned: this.learned.slice(), left: this.left.slice(), quirks: kinds.slice(0, 2), button: 'Back to the mail' };
  }
  auto() {
    if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; }
    if (this.mode === 'play') { for (const d of this.diffs.slice(0, 5)) { this.seen[d.x + ',' + d.y] = this.learned.length < 3 ? 'learned' : 'left'; if (this.learned.length < 3) this.learned.push(d.kind); else this.left.push(d.kind); } this.ask = null; this.renderAsk(); this.me = [7, 5]; this.finishWalk(); return true; }
    const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false;
  }
}
