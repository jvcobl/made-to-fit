// Stamp the Standard (the Works, Tuesday): lantern permits require applicants to match the Standard Resident.
// Compare each applicant with the template, mark what differs, stamp. Nobody matches. Not Gil. Not you.
import { MiniGame, C, rr, shadow, noShadow, ease, FONT, BODY, loadImg, roomFor } from './kit.js';
import { DOT, DOT_LOOK } from './sort.js';
import { STANDARD, OPTIONS } from '../creature.js';
import { CAST } from '../content.js';
import { clamp, lerp, FAST as FAST0, params, keyName } from '../util.js';
const FAST = FAST0 && params.get('mgslow') !== '1';

const ROWS = [['shape', 'Shape'], ['color', 'Color'], ['top', 'On top'], ['pattern', 'Pattern']];
const COLOR_NAMES = { '#d6c6ad': 'beige', '#cbb9a2': 'oatmeal', '#ffc98e': 'apricot', '#9fd3b0': 'mint', '#f3a0c2': 'pink', '#e3d2ef': 'lavender', '#a99be8': 'violet', '#cde38f': 'lime', '#93c2ee': 'sky blue', '#f2a99a': 'coral', '#f6cf5b': 'sunflower', '#bfa9f0': 'lilac', '#9edcd6': 'seafoam', '#e4796a': 'brick', '#7d9fe0': 'cornflower', '#c9b8a6': 'stone' };
const nameOf = (k, v) => { if (k === 'color') return COLOR_NAMES[v] || 'a color of their own'; const L = OPTIONS[k] && OPTIONS[k].find((x) => x[0] === v); return L ? L[1].toLowerCase() : v; };

export class StampGame extends MiniGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'stamp', verb: 'Check', title: 'Lantern permits', where: 'The Works · festival paperwork', zone: 'works', music: 'works', asker: 'Can you make it pop?',
      how: 'To hang a festival lantern, a resident must <b>match the Standard Resident</b>. Compare each applicant with the template. Tap every line that <b>differs</b>, then stamp <b>Return</b>. Or <b>Approve</b> it anyway: it is your stamp.' }, o));
    this.i = 0; this.marks = {}; this.stats = { checked: 0, approved: 0, returned: 0, spotted: 0, missed: 0, extra: 0, approvedWho: [] }; this.anim = null; this.inspect = false; this.id = 'stamp';
  }
  async prepare() {
    const G = this.G, S = G.S; const bg = '#efe6d6';
    const people = ['pip', 'moss', 'rue', 'bea', 'hollis', 'clover', 'gil'].map((id) => ({ id, name: CAST[id].name, role: id === 'gil' ? 'Your manager · re-certification' : id === 'hollis' ? 'The mayor' : CAST[id].role, look: Object.assign({}, STANDARD, CAST[id].look) }));
    people.push({ id: 'you', name: S.name || 'You', role: 'That is you', look: Object.assign({}, STANDARD, S.look) });
    this.forms = people;
    const urls = [G.portraitOf(STANDARD, { bg })].concat(people.map((p) => G.portraitOf(p.look, { bg })));
    const imgs = await Promise.all(urls.map(loadImg));
    this.stdImg = imgs[0]; people.forEach((p, i) => { p.img = imgs[i + 1]; p.diff = ROWS.filter(([k]) => p.look[k] !== STANDARD[k]).map(([k]) => k); });
    const dotI = await loadImg(G.portraitOf(DOT_LOOK, { bg: '#e3e8ec' }));
    this.dotImg = dotI; this.faces = [
      { name: 'Gil', img: people[6].img, asks: ['Can you make it pop?', 'Quick one! Got a sec?'], qs: ['The festival! The lanterns! Just... make it pop. You know?', 'Permits going okay? Any matches yet? No? Huh. Weird.'], later: 'Sure, sure! Circle back!', thanks: 'Love it. Great.' },
      { name: 'Dot', img: dotI, asks: ['Sorry. Is lavender a kind of beige?', 'Sorry, does a tuft count as ears?'], qs: ['The form says beige, and Bea is lavender. I just wanted to check. It isn\'t, is it.', 'It doesn\'t? Then nobody matches. Again.'], later: 'Okay! After. Sorry!', thanks: 'Thanks.' },
    ];
    this.dotPinch = roomFor(G, DOT, 'works');
    this.inspect = this.calm;
  }
  layout() {
    const W = this.W, H = this.H; const narrow = W < 600;
    const ph = Math.max(90, Math.min(narrow ? 150 : 236, (W - 56) / 2 * 0.86, H - 14 - 26 - 4 * 40 - 108));
    const stampsY = H - 66; const top = 8 + Math.max(0, (stampsY - 38 - (ph + 216)) / 2);
    this.ph = ph; this.py = Math.max(34, Math.round(top + 26)); this.pxL = W / 2 - ph - 14; this.pxR = W / 2 + 14;
    this.rw = Math.min(W - 24, 560); this.rx = W / 2 - this.rw / 2; this.ry = this.py + ph + 30; this.rh = 40;
    const bw = Math.min(210, (W - 48) / 2); this.stamps = [{ k: 'return', label: 'Return', x: W / 2 - bw - 8, y: H - 66, w: bw, h: 52, c: '#c8553d' }, { k: 'approve', label: 'Approve anyway', x: W / 2 + 8, y: H - 66, w: bw, h: 52, c: '#3f8f5a' }];
    this.insp = { x: 12, y: H - 60, w: 0, h: 0 };
  }
  start() { this.playT = 0; this.dur = 0; this.slide = 0; this.hint(); }
  cur() { return this.forms[this.i]; }
  hint() { const f = this.cur(); this.ui.hint.textContent = f ? `Permit ${this.i + 1} of ${this.forms.length}: ${f.name}.` : ''; this.ui.side.innerHTML = `<button class="mini-btn insp ${this.inspect ? 'on' : ''}">${this.inspect ? 'Hide' : 'Show'} written values</button>`; this.ui.side.querySelector('.insp').onclick = () => { this.inspect = !this.inspect; this.G.audio.sfx('select'); this.hint(); }; }
  focusRect() { return { x: this.pxR, y: this.py, w: this.ph, h: this.ph }; }
  rowAt(x, y) { for (let r = 0; r < ROWS.length; r++) { const yy = this.ry + r * this.rh; if (x >= this.rx && x <= this.rx + this.rw && y >= yy && y <= yy + this.rh - 4) return r; } return -1; }
  toggle(r) { const f = this.cur(); if (!f || this.anim || this.room.blocking()) return; const k = ROWS[r][0]; this.marks[k] = !this.marks[k]; this.room.acted(); this.G.audio.sfx(this.marks[k] ? 'pop' : 'select'); }
  stamp(kind) {
    const f = this.cur(); if (!f || this.anim || this.room.blocking()) return; this.room.acted();
    const marked = ROWS.map(([k]) => k).filter((k) => this.marks[k]);
    const spotted = marked.filter((k) => f.diff.includes(k)).length, missed = f.diff.filter((k) => !this.marks[k]).length, extra = marked.filter((k) => !f.diff.includes(k)).length;
    Object.assign(this.stats, { checked: this.stats.checked + 1, spotted: this.stats.spotted + spotted, missed: this.stats.missed + missed, extra: this.stats.extra + extra });
    if (kind === 'approve') { this.stats.approved++; this.stats.approvedWho.push(f.id); } else this.stats.returned++;
    this.anim = { kind, t: 0, spotted, missed, extra };
    this.G.audio.sfx('stamp');
    if (spotted) this.fx.float(this.pxR + this.ph / 2, this.py + 20, spotted + ' spotted', '#3f8f5a', { size: 20 });
    this.fx.burst(this.pxR + this.ph / 2, this.py + this.ph / 2, 10, kind === 'approve' ? ['#3f8f5a', '#9fd3b0'] : ['#c8553d', '#f2a99a'], { speed: 200, size: 6 });
  }
  pointer(type, x, y) {
    if (type !== 'down') return;
    const r = this.rowAt(x, y); if (r >= 0) { this.toggle(r); return; }
    for (const s of this.stamps) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) { this.stamp(s.k); return; }
  }
  // digits by position; the letters are mnemonics (Return, Approve, Inspect), so the typed letter works too (A on AZERTY)
  key(e) { const k = keyName(e), t = (e.key || '').toLowerCase(); if (/^[1-4]$/.test(k)) { e.preventDefault(); this.toggle(+k - 1); } else if (k === 'r' || t === 'r' || k === 'Enter') { e.preventDefault(); this.stamp('return'); } else if (k === 'a' || t === 'a') { e.preventDefault(); this.stamp('approve'); } else if (k === 'i' || t === 'i') { this.inspect = !this.inspect; this.hint(); } }
  update(dt) {
    this.playT += dt; this.slide = Math.min(1, this.slide + dt * 3);
    if (this.anim) { this.anim.t += dt; if (this.anim.t > (FAST ? 0.2 : 1.25)) { this.anim = null; this.i++; this.marks = {}; this.slide = 0; if (this.i >= this.forms.length) this.end(); else { this.hint(); if (this.cur().id === 'gil') this.fx.float(this.W / 2, this.py + 10, 'Hm. Gil\'s own permit.', '#6b6170', { size: 18, life: 1.8 }); if (this.cur().id === 'you') this.fx.float(this.W / 2, this.py + 10, 'That is you.', '#6b6170', { size: 20, life: 1.8 }); } } }
  }
  card(ctx, x, y, s, img, label, sub, o = {}) {
    ctx.save(); shadow(ctx, 14, 6, 0.2); ctx.fillStyle = '#fffaf0'; rr(ctx, x - 8, y - 26, s + 16, s + 34 + (sub ? 14 : 0), 14); ctx.fill(); noShadow(ctx);
    ctx.font = FONT(600, 12); ctx.fillStyle = o.tag || C.soft; ctx.textAlign = 'left'; ctx.fillText(label.toUpperCase(), x, y - 9);
    ctx.save(); rr(ctx, x, y, s, s, 10); ctx.clip(); if (img) ctx.drawImage(img, x, y, s, s); else { ctx.fillStyle = '#ddd'; ctx.fillRect(x, y, s, s); }
    if (o.wash) { ctx.fillStyle = `rgba(255,244,226,${o.wash * 0.85})`; ctx.fillRect(x, y, s, s); }
    ctx.restore();
    if (sub) { ctx.font = BODY(12); ctx.fillStyle = C.soft; ctx.fillText(sub, x, y + s + 15); }
    ctx.restore();
  }
  draw(ctx, mode) {
    const W = this.W, H = this.H; if (!this.stamps) this.layout();
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d9c3a2'); g.addColorStop(1, '#c4a47e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 9; i++) ctx.fillRect(0, i * H / 9, W, 2);
    const wash = this.room && mode === 'play' ? this.room.wash() : 0; const ink = this.room && mode === 'play' ? this.room.ink : 1;
    const f = mode === 'demo' ? (this.forms && this.forms[0]) : this.cur();
    ctx.globalAlpha = ink;
    this.card(ctx, this.pxL, this.py, this.ph, this.stdImg, 'The Standard', 'Larkspur, 1891', { wash, tag: '#8a6f4e' });
    if (f) {
      const sx = mode === 'play' ? lerp(W + 40, this.pxR, ease.outBack(this.slide)) : this.pxR;
      const a = this.anim; const out = a ? ease.inOut(clamp((a.t - 0.75) / 0.45)) : 0;
      const ox = out * (a && a.kind === 'approve' ? W : -W * 0.8);
      this.card(ctx, sx + ox, this.py, this.ph, f.img, f.name, f.role.length > 30 ? f.role.slice(0, 30) + '…' : f.role, { wash, tag: f.id === 'you' ? '#d9603b' : C.soft });
      if (a) { const k = ease.outBack(clamp(a.t / 0.22)); ctx.save(); ctx.translate(sx + ox + this.ph / 2, this.py + this.ph / 2); ctx.rotate(a.kind === 'approve' ? -0.18 : 0.16); ctx.scale(lerp(1.5, 1, k), lerp(1.5, 1, k)); ctx.globalAlpha = clamp(a.t / 0.12) * 0.9; ctx.strokeStyle = a.kind === 'approve' ? '#3f8f5a' : '#c8553d'; ctx.lineWidth = 5; rr(ctx, -this.ph * 0.42, -24, this.ph * 0.84, 48, 8); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.font = FONT(700, Math.min(26, this.ph * 0.15)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.kind === 'approve' ? 'APPROVED' : 'RETURNED', 0, 1); ctx.restore(); ctx.globalAlpha = ink; }
    }
    // the comparison rows
    ROWS.forEach(([k, label], r) => {
      const y = this.ry + r * this.rh; const on = !!this.marks[k]; const demoOn = mode === 'demo' && (Math.floor(this.demoT * 1.2) % 4) >= r && f && f.diff.includes(k);
      const a = this.anim; const reveal = a && f; const diff = f && f.diff.includes(k);
      ctx.fillStyle = on || demoOn ? '#fde3d9' : '#fffaf0'; rr(ctx, this.rx, y, this.rw, this.rh - 6, 10); ctx.fill();
      if (reveal) { ctx.lineWidth = 3; ctx.strokeStyle = diff ? (on ? '#3f8f5a' : '#e2a93c') : on ? 'rgba(43,37,48,0.3)' : 'transparent'; rr(ctx, this.rx, y, this.rw, this.rh - 6, 10); ctx.stroke(); }
      ctx.font = FONT(600, 14); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText((this.touch ? '' : (r + 1) + '  ') + label, this.rx + 12, y + (this.rh - 6) / 2);
      if (this.inspect && f) { ctx.font = BODY(13); ctx.fillStyle = C.soft; ctx.fillText(nameOf(k, STANDARD[k]) + '  →  ' + nameOf(k, f.look[k]), this.rx + this.rw * 0.3, y + (this.rh - 6) / 2); }
      ctx.textAlign = 'right'; ctx.font = FONT(600, 13); ctx.fillStyle = on || demoOn ? '#c0492a' : C.soft;
      ctx.fillText(reveal ? (diff ? (on ? 'spotted ✓' : 'missed') : on ? 'it matched' : 'same') : on || demoOn ? 'differs ✗' : 'same?', this.rx + this.rw - 12, y + (this.rh - 6) / 2);
    });
    ctx.globalAlpha = 1;
    // the two stamps
    for (const s of this.stamps) { shadow(ctx, 10, 5, 0.25); ctx.fillStyle = s.c; rr(ctx, s.x, s.y, s.w, s.h, 26); ctx.fill(); noShadow(ctx); ctx.font = FONT(700, 17); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((s.k === 'return' ? '✗ ' : '✓ ') + s.label + (this.touch ? '' : s.k === 'return' ? '  (R)' : '  (A)'), s.x + s.w / 2, s.y + s.h / 2 + 1); }
    ctx.textBaseline = 'alphabetic';
    if (mode === 'play' && this.stats.checked) { ctx.font = FONT(600, 13); ctx.fillStyle = 'rgba(43,37,48,0.7)'; ctx.textAlign = 'center'; ctx.fillText(`Matched the Standard so far: 0 of ${this.stats.checked}`, W / 2, this.stamps[0].y - 12); }
  }
  results() {
    const G = this.G, S = G.S; const st = this.stats; const n = st.checked;
    S.work = S.work || {}; S.work.stamp = Object.assign({ day: S.day }, st);
    const approvedNames = st.approvedWho.map((id) => (id === 'you' ? 'yourself' : CAST[id] ? CAST[id].name : id));
    const line = this.skipped || !n ? '' : st.approved === 0 ? 'You returned every one of them, including Gil and yourself.' : st.approved >= n ? 'You approved every one of them anyway. Somebody had to.' : 'You approved ' + (approvedNames.length > 2 ? approvedNames.slice(0, -1).join(', ') + ' and ' + approvedNames[approvedNames.length - 1] : approvedNames.join(' and ')) + ' anyway.';
    const spot = st.spotted + st.missed ? ` You spotted ${st.spotted} of ${st.spotted + st.missed} differences.` : '';
    return { headline: this.skipped ? 'Permits done' : `${n} permit${n === 1 ? '' : 's'} checked. 0 matched.`, line: line + spot, mate: `Dot checked six. Also zero. "I\'ve done these for four years. I\'ve never once seen one match."`, mateImg: this.dotImg ? this.dotImg.src : '', stats: st };
  }
  auto(q = 0.9) { if (this.mode === 'demo') { const b = this.over.querySelector('.go'); if (b) b.click(); return true; } if (this.mode === 'play') { this.stats.checked = this.forms.length; this.stats.approved = q > 0.5 ? 2 : 0; this.stats.approvedWho = q > 0.5 ? ['bea', 'you'] : []; this.stats.spotted = 12; this.stats.missed = 3; this.end(); return true; } const b = this.over.querySelector('.go'); if (b) { b.click(); return true; } return false; }
}
