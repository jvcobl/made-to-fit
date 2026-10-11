// The pond (Far End): catch and release. Every fish lives where it fits; none is a worse fish.
// Unlike Blend, the pond goes quiet after a few catches. That is the point: it ends on its own.
import { MiniGame, C, rr, shadow, noShadow, ease, FONT, BODY } from './kit.js';
import { clamp, lerp, esc, FAST as FAST0, params } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

export const FISH = [
  { id: 'minnow', name: 'Reed minnow', zone: 'reeds', when: 'any', col: '#9cae55', len: 0.55, hint: 'in the reeds', line: 'Lives in the reeds, where the water is warm and the hiding is good. Out in the open it panics. Not a worse fish. A reed fish.' },
  { id: 'perch', name: 'Sun perch', zone: 'shallows', when: 'day', col: '#e2b34c', len: 0.7, hint: 'sunny shallows, by day', line: 'Basks in the bright shallows all afternoon. Put it in the shade and it sulks.' },
  { id: 'carp', name: 'Shade carp', zone: 'shade', when: 'any', col: '#7a8f9e', len: 0.9, hint: 'under the willow', line: 'Likes it dim. Comes out when the sun slips behind the willow, and not a minute before.' },
  { id: 'gudgeon', name: 'Deep gudgeon', zone: 'deep', when: 'any', col: '#5b6b8a', len: 0.65, hint: 'the deep middle', line: 'Stays down where the water is cold and still. The shallows would cook it. Nobody calls it shy.' },
  { id: 'dace', name: 'Chatter dace', zone: 'shallows', when: 'day', col: '#c8b6a8', len: 0.5, school: true, hint: 'shallows, in a crowd', line: 'Never alone. Lives in a crowd and loves it. Alone in a quiet corner it would be miserable.' },
  { id: 'tench', name: 'Hermit tench', zone: 'deep', when: 'any', col: '#4e6b3a', len: 0.85, patient: true, hint: 'deep water, for the patient', line: 'Bites only if you wait quietly and do not tug the line. It has no opinion of you. It would just rather you were calm.' },
  { id: 'loach', name: 'Lantern loach', zone: 'mid', when: 'dusk', col: '#ffcf7a', len: 0.6, glow: true, hint: 'open water, at dusk', line: 'Only rises at dusk, faintly glowing. Larkspur\'s lanterns were named after it, probably.' },
  { id: 'gold', name: 'A standard goldfish', zone: 'any', when: 'any', col: '#f2a24a', len: 0.6, rare: true, hint: 'anywhere, once you know four others', line: 'Its great-great-grandparents were let go here in 1891. Too warm here, too cold there, so it never stops swimming. A pond could make a corner for it.' },
];
const ZN = { reeds: 'the reeds', shallows: 'the sunny shallows', shade: 'the shade of the willow', deep: 'the deep middle', mid: 'open water', any: 'nowhere in particular' };

export class PondGame extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'pond', verb: 'Fish', title: 'The pond', where: 'The Far End · catch and release', zone: 'farend', music: 'farend', theme: 'pond', outdoor: true,
      how: 'Watch for shadows under the water. <b>Tap the water</b> to cast near one. When the float <b>dives</b>, tap. Too early and the fish swims off. Every fish goes back.', roomNote: 'Each kind of fish lives somewhere different. Where you cast matters more than how fast you are.' }, o));
    this.fish = []; this.cast = null; this.catches = []; this.limit = 3; this.prior = 0; this.msg = ''; this.msgT = 0; this.ripples = [];
  }
  get S() { return this.G.S; }
  tod() { const m = this.S.min; return m >= 1050 ? 'dusk' : m < 600 ? 'morning' : 'day'; }
  layout() { const W = this.W, H = this.H; this.cx = W / 2; this.cy = H * 0.47; this.R = Math.min(W * 0.44, H * 0.4); }
  zoneAt(x, y) {
    const dx = x - this.cx, dy = y - this.cy; const r = Math.hypot(dx, dy) / this.R; if (r > 1) return null;
    const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    if (r < 0.42) return 'deep'; if (r > 0.64) { if (a > 150 && a < 225) return 'reeds'; if (a > 280 && a < 345) return 'shade'; return 'shallows'; } return 'mid';
  }
  randIn(zone) { for (let t = 0; t < 60; t++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.R * 0.95; const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r; if (zone === 'any' || this.zoneAt(x, y) === zone) return [x, y]; } return [this.cx, this.cy]; }
  spawn() {
    const t = this.tod(); const S = this.S; const seen = (S.pond || {});
    const kinds = Object.keys(seen).filter((k) => k !== 'gold').length;
    const pool = FISH.filter((f) => (f.when === 'any' || f.when === t || (f.when === 'day' && t === 'morning')) && (!f.rare || kinds >= 4));
    this.fish = [];
    for (const f of pool) { const n = f.school ? 3 : 1; for (let i = 0; i < n; i++) { const [x, y] = this.randIn(f.zone); this.fish.push({ f, x, y, tx: x, ty: y, a: Math.random() * 6, sp: 18 + Math.random() * 12, state: 'swim', t: 0, seen: !!seen[f.id] }); } }
  }
  start() { this.dur = 0; this.spawn(); this.hint(); this.calmLine = this.calm; }
  hint() {
    const S = this.S; const n = Object.keys(S.pond || {}).length; const c = this.cast;
    this.ui.hint.textContent = c ? (c.state === 'bite' ? 'Now!' : c.state === 'nibble' ? 'Something is nibbling. Wait for the dive…' : 'Waiting in ' + ZN[c.z] + '…') : `Tap the water near a shadow. Pond guide: ${n} of ${FISH.length}.`;
    if (!this.sideOn) { this.sideOn = true; this.ui.side.innerHTML = `<span class="mate-mini pcount"></span> <button class="mini-btn pdone">I'm done</button>`; this.ui.side.querySelector('.pdone').onclick = () => { if (this.card) return; this.G.audio.sfx('select'); this.end(); }; }
    this.ui.side.querySelector('.pcount').textContent = `${this.prior + this.catches.length} of ${this.prior + this.limit} today`;
  }
  say(t, s = 2.4) { this.msg = t; this.msgT = s; }
  pointer(type, x, y) {
    if (type !== 'down') return; this.room && this.room.acted();
    if (this.card) return;
    if (this.cast) {
      if (this.cast.state === 'bite') { this.hook(); return; }
      if (this.cast.state === 'nibble' && !this.calm) { this.spook(); return; }
      if (this.cast.state === 'land' || this.cast.state === 'wait') { this.reel(); return; }
      return;
    }
    const z = this.zoneAt(x, y); if (!z) { this.say('That is the bank. Try the water.'); return; }
    this.cast = { x, y, z, state: 'fly', t: 0, fish: null, nib: 0 }; this.G.audio.sfx('whoosh'); this.hint();
  }
  key(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (this.cast) this.pointer('down', this.cast.x, this.cast.y); else { const f = this.fish[Math.floor(Math.random() * this.fish.length)]; if (f) this.pointer('down', f.x + 10, f.y); } } }
  reel() { this.cast = null; this.G.audio.sfx('select'); this.hint(); }
  spook() { const c = this.cast; if (c.fish) { c.fish.state = 'flee'; c.fish.t = 0; } this.cast = null; this.G.audio.sfx('splash'); this.say('Too early. It swam off. Fish like it when you wait.'); this.hint(); }
  hook() {
    const c = this.cast; const f = c.fish; this.cast = null; if (!f) return;
    this.G.audio.sfx('splash'); this.fx.burst(c.x, c.y, 14, ['#cfe6f2', '#ffffff', f.f.col], { speed: 220, size: 6 });
    const S = this.S; S.pond = S.pond || {}; const first = !S.pond[f.f.id]; S.pond[f.f.id] = (S.pond[f.f.id] || 0) + 1;
    this.catches.push(f.f.id); this.fish = this.fish.filter((q) => q !== f); this.hint();
    this.card = { f: f.f, first, t: 0 }; this.G.audio.sfx(first ? 'good' : 'drop'); this.G.story.fieldNote('niche');
    if (first) this.G.story.keep('fish_' + f.f.id, 'A ' + f.f.name.replace(/^A /, '').toLowerCase() + ', let go', f.f.col);
    this.showCard();
  }
  showCard() {
    const c = this.card; const f = c.f;
    const div = document.createElement('div'); div.className = 'fishcard';
    div.innerHTML = `<canvas width="300" height="150"></canvas><div class="fn">${c.first ? '<span class="newf">New</span>' : ''}${esc(f.name)}</div><div class="fz">Lives in ${esc(ZN[f.zone])}${f.when === 'dusk' ? ', at dusk' : f.when === 'day' ? ', by day' : ''}</div><p>${esc(f.line)}</p><button class="btn primary rel">Let it go</button>`;
    this.over.appendChild(div);
    const cv = div.querySelector('canvas'); const x = cv.getContext('2d'); this.drawFish(x, 150, 78, 120 * f.len + 40, f, 0, true);
    const go = () => { div.remove(); this.waitKey = null; this.card = null; this.G.audio.sfx('splash'); this.fx.burst(this.cx, this.cy + this.R * 0.4, 10, ['#cfe6f2', '#ffffff'], { speed: 160, size: 5 });
      if (this.catches.length >= this.limit) { this.say('The pond goes still. That is enough for today, and the fish agree.', 3); setTimeout(() => this.end(), FAST ? 30 : 1600); } this.hint(); };
    div.querySelector('.rel').onclick = go; setTimeout(() => { this.waitKey = go; }, 300); if (FAST) setTimeout(go, 30);
  }
  update(dt) {
    this.playT = (this.playT || 0) + dt; if (this.msgT > 0) this.msgT -= dt;
    for (const r of this.ripples) r.t += dt; this.ripples = this.ripples.filter((r) => r.t < 1.6);
    if (Math.random() < dt * 0.6) { const [x, y] = this.randIn('any'); this.ripples.push({ x, y, t: 0, s: 0.5 }); }
    for (const q of this.fish) {
      q.t += dt;
      if (q.state === 'flee') { const a = Math.atan2(q.y - this.cy, q.x - this.cx); q.x += Math.cos(a) * 80 * dt; q.y += Math.sin(a) * 80 * dt; if (q.t > 1.2) { const [x, y] = this.randIn(q.f.zone); q.x = x; q.y = y; q.tx = x; q.ty = y; q.state = 'swim'; } continue; }
      if (q.state === 'swim') { if (Math.hypot(q.tx - q.x, q.ty - q.y) < 4) { const [x, y] = this.randIn(q.f.zone); q.tx = x; q.ty = y; } }
      const dx = q.tx - q.x, dy = q.ty - q.y; const d = Math.hypot(dx, dy) || 1; const sp = q.state === 'approach' ? 34 : q.sp;
      if (d > 2) { q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; q.a = Math.atan2(dy, dx); }
    }
    const c = this.cast; if (!c) return; c.t += dt;
    if (c.state === 'fly' && c.t > 0.45) { c.state = 'land'; c.t = 0; this.ripples.push({ x: c.x, y: c.y, t: 0, s: 1 }); this.G.audio.sfx('plip'); this.hint(); }
    if (c.state === 'nibble' && !c.hinted) { c.hinted = true; this.hint(); }
    if (c.state === 'land' && c.t > 0.4) { c.state = 'wait'; c.t = 0; }
    if (c.state === 'wait') {
      if (!c.fish) {
        // the nearest fish whose home includes this spot may come and look
        let best = null, bd = this.R * 0.6;
        for (const q of this.fish) { if (q.state !== 'swim') continue; const home = q.f.zone === 'any' || q.f.zone === c.z || (q.f.zone === 'mid' && c.z !== 'reeds'); if (!home) continue; const d = Math.hypot(q.x - c.x, q.y - c.y); if (d < bd) { bd = d; best = q; } }
        if (best && c.t > 0.8 + Math.random() * 0.6) { if (best.f.school && this.fish.filter((q) => q.f.id === best.f.id).length < 2) best = null; }
        if (best && c.t > 0.8) { c.fish = best; best.state = 'approach'; best.tx = c.x; best.ty = c.y; c.t = 0; }
        if (!best && c.t > 4) { this.say(c.z === 'mid' ? 'Nothing here right now. Some fish only come up at certain times.' : 'Nothing is biting here. Watch where the shadows swim.'); this.reel(); }
      } else if (Math.hypot(c.fish.x - c.x, c.fish.y - c.y) < 10) { c.state = 'nibble'; c.t = 0; c.nibs = c.fish.f.patient ? 4 : 1 + Math.floor(Math.random() * 3); c.nibT = 0.5; }
    }
    if (c.state === 'nibble') { c.nibT -= dt; if (c.nibT <= 0) { if (c.nibs-- > 0) { this.G.audio.sfx('tick'); this.ripples.push({ x: c.x, y: c.y, t: 0, s: 0.4 }); c.nibT = 0.45 + Math.random() * 0.6; c.dip = 0.25; } else { c.state = 'bite'; c.t = 0; c.win = this.calm ? 2.6 : 0.95; this.G.audio.sfx('plip'); this.ripples.push({ x: c.x, y: c.y, t: 0, s: 1.4 }); if (navigator.vibrate) try { navigator.vibrate(35); } catch (e) {} this.hint(); } } }
    if (c.dip > 0) c.dip -= dt;
    if (c.state === 'bite' && c.t > c.win) { if (c.fish) { c.fish.state = 'flee'; c.fish.t = 0; } this.cast = null; this.say('It got away. Fine. It lives here; you are visiting.'); this.hint(); }
  }
  drawFish(ctx, x, y, len, f, ang, lit) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    const h = len * 0.38; ctx.fillStyle = lit ? f.col : 'rgba(30,45,60,0.42)';
    if (lit && f.glow) { ctx.shadowColor = '#ffcf7a'; ctx.shadowBlur = 18; }
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len * 0.45, 0); ctx.lineTo(-len * 0.72, -h * 0.55); ctx.lineTo(-len * 0.72, h * 0.55); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(len * 0.05, -h * 0.12, len * 0.28, h * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2b2530'; ctx.beginPath(); ctx.arc(len * 0.3, -h * 0.08, Math.max(2, len * 0.035), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  draw(ctx, mode) {
    const W = this.W, H = this.H; if (!this.R) this.layout(); const t = this.t; const dusk = this.tod() === 'dusk';
    ctx.fillStyle = dusk ? '#6f7a52' : '#9fb878'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = (i * 53) % H; ctx.fillStyle = 'rgba(60,90,40,0.18)'; ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    // water with depth
    const g = ctx.createRadialGradient(this.cx, this.cy, this.R * 0.1, this.cx, this.cy, this.R);
    g.addColorStop(0, dusk ? '#20374f' : '#3f6f8f'); g.addColorStop(0.45, dusk ? '#2d4f68' : '#5d93aa'); g.addColorStop(0.8, dusk ? '#476e7a' : '#86b9bf'); g.addColorStop(1, dusk ? '#6a8a7a' : '#a9cdb6');
    ctx.save(); ctx.beginPath(); ctx.arc(this.cx, this.cy, this.R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.clip();
    // the willow's shade and the reeds
    ctx.fillStyle = 'rgba(20,40,40,0.28)'; ctx.beginPath(); ctx.ellipse(this.cx + this.R * 0.62, this.cy - this.R * 0.62, this.R * 0.5, this.R * 0.36, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = this.room && mode === 'play' ? this.room.ink : 1;
    for (const q of this.fish) this.drawFish(ctx, q.x, q.y, (q.f.len * 36 + 18), q.f, q.a, false);
    ctx.globalAlpha = 1;
    for (const r of this.ripples) { const k = r.t / 1.6; ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.5 * r.s})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, 4 + k * 26 * r.s, 2 + k * 13 * r.s, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.05; const x = this.cx + Math.cos(a) * this.R * 0.55, y = this.cy + Math.sin(a * 1.3) * this.R * 0.5; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, 10, 1.5); }
    ctx.restore();
    // reeds and pads around the edge
    for (let i = 0; i < 26; i++) { const a = (150 + i * 3) * Math.PI / 180; const x = this.cx + Math.cos(a) * this.R * (0.9 + (i % 3) * 0.05), y = this.cy + Math.sin(a) * this.R * (0.9 + (i % 3) * 0.05); ctx.strokeStyle = '#5f7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.quadraticCurveTo(x + Math.sin(t + i) * 4, y - 10, x + Math.sin(t * 1.3 + i) * 5, y - 26 - (i % 4) * 5); ctx.stroke(); }
    for (const [a, r, s] of [[0.4, 0.75, 18], [0.9, 0.82, 14], [2.4, 0.7, 16], [4.2, 0.8, 15]]) { const x = this.cx + Math.cos(a) * this.R * r, y = this.cy + Math.sin(a) * this.R * r; ctx.fillStyle = '#6f9a4e'; ctx.beginPath(); ctx.arc(x, y, s, 0.3, Math.PI * 2 - 0.1); ctx.lineTo(x, y); ctx.fill(); }
    ctx.fillStyle = '#5e4a36'; ctx.beginPath(); ctx.arc(this.cx + this.R * 0.95, this.cy - this.R * 0.95, this.R * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dusk ? '#56703f' : '#7f9e52'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(this.cx + this.R * (0.8 + Math.cos(i) * 0.25), this.cy - this.R * (0.8 + Math.sin(i) * 0.22), this.R * 0.17, 0, Math.PI * 2); ctx.fill(); }
    // the line and the float
    const c = this.cast; const px = W / 2, py = H - 6;
    if (c) {
      const k = c.state === 'fly' ? ease.outCubic(clamp(c.t / 0.45)) : 1; const bx = lerp(px, c.x, k), by = lerp(py, c.y, k) - Math.sin(k * Math.PI) * 60;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo((px + bx) / 2, Math.min(py, by) - 40, bx, by); ctx.stroke();
      const dip = c.state === 'bite' ? 6 + Math.sin(t * 30) * 2 : c.dip > 0 ? 3 : Math.sin(t * 2) * 1;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by + dip, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d9603b'; ctx.beginPath(); ctx.arc(bx, by + dip - 2, 6, Math.PI, 0); ctx.fill();
      if (c.state === 'land' || c.state === 'wait' || c.state === 'nibble') { ctx.font = FONT(600, 13); ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,40,50,0.6)'; ctx.strokeText(ZN[c.z], bx, by + 26); ctx.fillStyle = '#fffaf0'; ctx.fillText(ZN[c.z], bx, by + 26); }
      if (c.state === 'bite') { ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by + dip, 16 + Math.sin(t * 20) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.font = FONT(700, 18); ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.fillText(this.touch ? 'Tap!' : 'Now! (click or Space)', bx, by - 26); }
    }
    ctx.fillStyle = '#7a5236'; rr(ctx, px - 5, py - 40, 10, 44, 4); ctx.fill();
    if (this.msgT > 0) { ctx.globalAlpha = clamp(this.msgT); ctx.font = FONT(600, 15); ctx.textAlign = 'center'; const w = Math.min(W - 30, ctx.measureText(this.msg).width + 28); ctx.fillStyle = 'rgba(30,24,40,0.8)'; rr(ctx, W / 2 - w / 2, 12, w, 32, 14); ctx.fill(); ctx.fillStyle = '#fffaf0'; ctx.fillText(this.msg, W / 2, 33, W - 40); ctx.globalAlpha = 1; }
    if (mode === 'demo') { const k = (this.demoT % 3) / 3; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(this.cx - this.R * 0.3, this.cy + this.R * 0.2, 10 + k * 20, 0, Math.PI * 2); ctx.fill(); }
  }
  results() {
    const S = this.S; const n = this.catches.length; const total = Object.keys(S.pond || {}).length;
    return { headline: n ? `${n} fish, all let go` : 'A quiet hour by the water', line: `Pond guide: ${total} of ${FISH.length} kinds. ${total >= FISH.length ? 'Every one of them, in its own part of the pond.' : 'The rest live somewhere else in the pond, or come up at another time of day.'}`, n };
  }
  auto(q = 0.9) { if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; } if (this.mode === 'play') { if (!this.card && q > 0.3) { const f = this.fish[0]; if (f) { this.cast = { x: f.x, y: f.y, z: f.f.zone, state: 'bite', t: 0, fish: f, win: 9 }; this.hook(); } } this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}
