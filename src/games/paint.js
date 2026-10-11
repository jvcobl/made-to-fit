// Lantern painting (Wren's workshop, festival day): three blank lanterns for people you know.
// Glow comes from what they need, color from who they are, pattern from what they love. The People guide is the hint.
import { MiniGame, C, rr, FONT } from './kit.js';
import { CAST, PEOPLE, LANTERN_PREFS, SLOT_LABEL } from '../content.js';
import { clamp, esc, FAST as FAST0, params } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

const COLORS = [['#ffcf7a', 'amber'], ['#ffc98e', 'apricot'], ['#f3a0c2', 'pink'], ['#c9b6ef', 'lavender'], ['#a99be8', 'violet'], ['#93c2ee', 'sky'], ['#9fd3b0', 'mint'], ['#cde38f', 'lime'], ['#cbb9a2', 'oatmeal']];
const GLOWS = [['soft', 'Soft'], ['medium', 'Medium'], ['bright', 'Bright']];
const PATTERNS = [['plain', 'Plain'], ['dots', 'Dots'], ['stripes', 'Stripes'], ['words', 'Words'], ['doodle', 'A drawing']];

export class PaintGame extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'paint', verb: 'Paint', title: 'Three blank lanterns', where: 'Wren\'s workshop · the Far End', zone: null, music: 'farend', theme: 'shed',
      how: 'Wren left three lanterns blank, for you to make for people you know. Pick someone, then choose a <b>glow</b>, a <b>color</b> and a <b>pattern</b>. What you have learned about them is the best guide. These are the lanterns that will rise tonight.' }, o));
    this.made = []; this.sel = null; this.ch = { glow: 'medium', color: '#ffcf7a', pattern: 'plain' }; this.left = 3;
  }
  update(dt) { if (this.rising) this.rising.t += dt; }
  draw(ctx) {
    const W = this.W, H = this.H; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b2340'); g.addColorStop(1, '#4f4258'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,250,230,${0.15 + (i % 5) * 0.08})`; ctx.fillRect((i * 137) % W, (i * 71) % (H * 0.6), 1.6, 1.6); }
    for (let i = 0; i < this.made.length; i++) { const done = !this.rising || this.rising.L !== this.made[i]; if (done) this.lantern(ctx, 40 + i * 46, 46 + Math.sin(this.t * 1.5 + i) * 3, 16, this.made[i]); }
    // the one you just made floats up past the window
    if (this.rising) { const k = Math.min(1, this.rising.t / 2.2); const i = this.made.indexOf(this.rising.L); const x = (1 - k) * W * 0.5 + k * (40 + i * 46), y = (1 - k) * H * 0.85 + k * 46 + Math.sin(this.t * 3) * 4; this.lantern(ctx, x, y, 16 + (1 - k) * 26, this.rising.L); }
  }
  // a paper lantern, glowing
  lantern(ctx, x, y, r, L) {
    const glow = { soft: 0.35, medium: 0.65, bright: 1 }[L.glow];
    ctx.save(); ctx.shadowColor = L.color; ctx.shadowBlur = 10 + glow * 40; ctx.fillStyle = L.color; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = `rgba(255,255,240,${0.15 + glow * 0.45})`; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(43,37,48,0.35)'; ctx.strokeStyle = 'rgba(43,37,48,0.35)'; ctx.lineWidth = Math.max(1, r * 0.06);
    if (L.pattern === 'dots') for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.4) * r * 0.6, y + Math.sin(i * 2.4) * r * 0.75, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
    if (L.pattern === 'stripes') for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - r, y + i * r * 0.42); ctx.lineTo(x + r, y + i * r * 0.42); ctx.stroke(); }
    if (L.pattern === 'words') { ctx.font = FONT(600, r * 0.32); ctx.textAlign = 'center'; ctx.fillText('for ' + (L.name || 'you'), x, y + r * 0.1); }
    if (L.pattern === 'doodle') { ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.3); ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.6, x + r * 0.2, y + r * 0.1); ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.5, x + r * 0.55, y - r * 0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.12, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#7a5236'; rr(ctx, x - r * 0.45, y - r * 1.38, r * 0.9, r * 0.16, 2); ctx.fill(); rr(ctx, x - r * 0.45, y + r * 1.22, r * 0.9, r * 0.16, 2); ctx.fill();
  }
  start() { this.dur = 0; const S = this.G.S; this.left = Math.min(3, Object.keys(LANTERN_PREFS).filter((id) => S.met[id]).length); if (!this.left) { this.end(); return; } this.mountUI(); }
  mountUI() {
    const S = this.G.S; const met = Object.keys(LANTERN_PREFS).filter((id) => S.met[id] && !this.made.find((m) => m.id === id));
    const box = document.createElement('div'); box.className = 'paintbox';
    box.innerHTML = `<div class="ptop"><div class="pwho"><h4>For whom? <span>${this.left} blank lantern${this.left === 1 ? '' : 's'} left</span></h4><div class="pfaces">${met.map((id) => `<button class="pf ${this.sel === id ? 'on' : ''}" data-id="${id}"><img src="${this.G.portraitOf(CAST[id].look, { bg: '#efe6d6', w: 200, h: 200 })}" alt=""><span>${esc(CAST[id].name)}</span></button>`).join('')}</div><div class="pknow"></div></div><canvas class="pprev" width="220" height="240"></canvas></div>
      <div class="popts"><div class="prow"><span>Glow</span><div class="chips" data-k="glow">${GLOWS.map(([v, n]) => `<button class="chip ${this.ch.glow === v ? 'on' : ''}" data-v="${v}">${n}</button>`).join('')}</div></div>
      <div class="prow"><span>Color</span><div class="chips" data-k="color">${COLORS.map(([v, n]) => `<button class="swatch ${this.ch.color === v ? 'on' : ''}" data-v="${v}" style="background:${v}" aria-label="${n}"></button>`).join('')}</div></div>
      <div class="prow"><span>Pattern</span><div class="chips" data-k="pattern">${PATTERNS.map(([v, n]) => `<button class="chip ${this.ch.pattern === v ? 'on' : ''}" data-v="${v}">${n}</button>`).join('')}</div></div></div>
      <div class="preact"></div><button class="btn primary hang" ${this.sel ? '' : 'disabled'}>${this.sel ? 'Make it for ' + esc(CAST[this.sel].name) : 'Pick someone first'}</button>${this.made.length ? '<button class="mini-btn pdone">I\'m done</button>' : ''}`;
    if (this.box) this.box.remove(); this.over.appendChild(box); this.box = box;
    box.querySelectorAll('.pf').forEach((b) => { b.onclick = () => { this.sel = b.dataset.id; this.G.audio.sfx('select'); this.mountUI(); }; });
    box.querySelectorAll('[data-k]').forEach((row) => row.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; this.ch[row.dataset.k] = b.dataset.v; row.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); this.G.audio.sfx('select'); this.preview(); }));
    box.querySelector('.hang').onclick = () => this.hang();
    const dn = box.querySelector('.pdone'); if (dn) dn.onclick = () => this.end();
    if (this.sel) { const k = (S.know || {})[this.sel] || {}; const lines = ['over', 'under', 'no', 'helps', 'love'].filter((x) => k[x]).map((x) => `<li><b>${x === 'love' ? 'Loves' : SLOT_LABEL[x]}:</b> ${esc(PEOPLE[this.sel][x])}</li>`).join(''); box.querySelector('.pknow').innerHTML = lines ? `<div class="kn">What you know about ${esc(CAST[this.sel].name)}</div><ul>${lines}</ul>` : `<div class="kn">You do not know much about ${esc(CAST[this.sel].name)} yet. Go with your gut.</div>`; }
    this.ui.hint.textContent = this.sel ? 'Choose a glow, a color and a pattern.' : 'Pick someone you know.';
    this.preview();
  }
  preview() { const cv = this.box && this.box.querySelector('.pprev'); if (!cv) return; const x = cv.getContext('2d'); x.clearRect(0, 0, 220, 240); this.lantern(x, 110, 125, 62, Object.assign({ name: this.sel ? CAST[this.sel].name : '' }, this.ch)); }
  hang() {
    if (!this.sel) return; const id = this.sel; const P = LANTERN_PREFS[id];
    const score = (this.ch.glow === P.glow ? 1 : 0) + (this.ch.color === P.color ? 1 : 0) + (this.ch.pattern === P.pattern ? 1 : 0);
    const name = CAST[id].name;
    const line = score === 3 ? P.yes : score === 2 ? P.near : P.kind;
    const L = Object.assign({ id, score, name }, this.ch); this.made.push(L); this.left--; this.rising = { L, t: 0 }; this.G.audio.sfx(score >= 2 ? 'good' : 'page');
    this.fx.burst(this.W / 2, this.H * 0.3, 18, [this.ch.color, '#fffaf0', '#ffcf7a'], { speed: 260, size: 7 });
    const S = this.G.S; if (score >= 2) this.G.story.addBond(id, 1);
    this.box.querySelector('.preact').innerHTML = `<div class="rq"><img src="${this.G.portraitOf(CAST[id].look, { bg: '#efe6d6', w: 200, h: 200 })}" alt=""><div><b>${esc(name)}</b>, later: "${esc(line)}"</div></div>`;
    this.box.querySelector('.hang').disabled = true;
    const remaining = Object.keys(LANTERN_PREFS).filter((k) => S.met[k] && !this.made.find((m) => m.id === k)).length;
    setTimeout(() => { this.sel = null; this.rising = null; if (this.left <= 0 || !remaining) this.end(); else this.mountUI(); }, FAST ? 30 : 3000);
  }
  results() {
    const S = this.G.S; S.lanternsMade = this.made; if (this.box) this.box.remove();
    const best = this.made.filter((m) => m.score === 3).map((m) => m.name);
    if (this.made.length) this.G.story.keep('lanterns_made', 'Lanterns for people you know', '#ffcf7a');
    return { headline: this.made.length ? `${this.made.length} lantern${this.made.length > 1 ? 's' : ''}, for people you know` : 'Not today', line: best.length ? `${best.length > 1 ? best.slice(0, -1).join(', ') + ' and ' + best[best.length - 1] : best[0]} will know which one is theirs.` : 'They will rise tonight with the rest.', button: 'Done' };
  }
  auto() { if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; } if (this.mode === 'play') { const S = this.G.S; const id = Object.keys(LANTERN_PREFS).find((k) => S.met[k]); if (id) { this.made.push(Object.assign({ id, score: 3, name: CAST[id].name }, LANTERN_PREFS[id])); } this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}
