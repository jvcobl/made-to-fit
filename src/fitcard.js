// The fit card: one shareable picture of a season in Larkspur. Where things fit, who adjusted, what to try next.
// Adjustments are counted as dots, the way the game counts kept moments: never bars, percentages or scores.
// Canvas 2D only, no imports and no network. The portrait must already be a data: or blob: URL (anything else is
// ignored), and the card leaves the device only if the viewer chooses to save it.

const W = 1080, H = 1350, M = 72, CW = W - 2 * M; // card size, side margin, content width
const C = {
  ink: '#2b2530', soft: '#6b6170', paper: '#fbf6ee', paper2: '#f3eadb', amber: '#ffcf7a', accent: '#d9603b', teal: '#4fb3a9', good: '#3f8f5a',
  brown: '#8a5a1a', // section headings: 5.5:1 on paper (WCAG AA)
  note: '#5a4630', // text on the amber kept note: 7:1
  line: 'rgba(43,37,48,0.16)',
};
const DISPLAY = '"Fredoka", "Nunito", ui-rounded, "Segoe UI", system-ui, sans-serif';
const BODY = '"Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, sans-serif';
const fD = (w, px) => `${w} ${Math.round(px)}px ${DISPLAY}`;
const fB = (w, px) => `${w} ${Math.round(px)}px ${BODY}`;
const WORDMARK = 'Made to Fit';
const FOOTER = 'A game about who adjusts.';
const VISITS = ['After one visit', 'After two visits', 'After all three visits'];
const HEAD = { places: 'Places that fit me', tally: 'Who adjusted', turned: 'When I was the one asked', next: 'Next time' };
const NONE_YET = 'Nobody had to adjust yet.';
const KEY = 'one dot for each time';
const STILL = 'Still looking.';
const FILE = 'made-to-fit-card.png';
// the evening page's colour pairs (bend, gear, ask, fix), so the card reads like the rest of the game.
// Every dot colour is at least 3:1 against the paper, and each row is labelled, so colour is never the only cue.
const ROWS = [
  { k: 'you', label: 'You', fg: '#c0492a', bg: '#fde3d9', icon: 'bend' },
  { k: 'gear', label: 'Your gear', fg: '#2b7a78', bg: '#dbf0ee', icon: 'gear' },
  { k: 'them', label: 'Them', fg: '#5a4aa8', bg: '#e5e1f6', icon: 'ask' },
  { k: 'place', label: 'The place', fg: '#a8711a', bg: '#fbefd2', icon: 'fix' },
  { k: 'nobody', label: 'Nobody', fg: '#6b6170', bg: '#ebe5ee', icon: 'none' },
];
const PINS = [C.accent, '#2b7a78', '#a8711a'];

// ---------- input ----------
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s) => (SEG ? Array.from(SEG.segment(s), (x) => x.segment) : Array.from(s));
// control characters, line and paragraph separators, and bidi embeddings and overrides
const CTRL = new RegExp('[' + [[0x0, 0x1f], [0x7f, 0x9f], [0x2028, 0x2029], [0x202a, 0x202e], [0x2066, 0x2069]]
  .map(([a, b]) => '\\u' + a.toString(16).padStart(4, '0') + '-\\u' + b.toString(16).padStart(4, '0')).join('') + ']', 'g');
// plain single-line text: no control characters, runs of space collapsed, length bounded
function clean(v, max = 280) {
  if (v == null || typeof v === 'object' || typeof v === 'function') return '';
  let s = String(v).replace(CTRL, ' ').replace(/\s+/g, ' ').trim();
  const g = graphemes(s);
  if (g.length > max) s = g.slice(0, max).join('').trimEnd() + '…';
  return s;
}
// names longer than 22 characters keep 21 and an ellipsis
function shortName(s) { const g = graphemes(s); return g.length > 22 ? g.slice(0, 21).join('').trimEnd() + '…' : s; }
function count(v) { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; }
function norm(d) {
  d = d && typeof d === 'object' ? d : {};
  const t = d.tally && typeof d.tally === 'object' ? d.tally : {};
  const v = Math.round(Number(d.visits)); const visits = v >= 3 ? 3 : v === 2 ? 2 : 1;
  const places = (Array.isArray(d.places) ? d.places : d.places ? [d.places] : []).map((p) => clean(p, 120)).filter(Boolean).slice(0, 3);
  const portrait = typeof d.portrait === 'string' && /^(data:image\/|blob:)/i.test(d.portrait.trim()) ? d.portrait.trim() : null;
  const show = d.showName === true; // only an explicit true shows the name, anywhere
  return {
    portrait, name: show ? shortName(clean(d.name, 200)) : '', fullName: show ? clean(d.name, 60) : '', places,
    tally: { you: count(t.you), gear: count(t.gear), them: count(t.them), place: count(t.place), nobody: count(t.nobody) },
    turned: clean(d.turned) || null, nextTime: clean(d.nextTime) || null, kept: clean(d.kept) || null,
    visits, subtitle: VISITS[visits - 1],
  };
}
const totalOf = (D) => ROWS.reduce((a, r) => a + D.tally[r.k], 0);

// ---------- small drawing helpers ----------
function rr(ctx, x, y, w, h, r) { const k = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath(); }
function shadow(ctx, blur, y, a, rgb = '60,38,20') { ctx.shadowColor = `rgba(${rgb},${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = y; }
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function track(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; }
// four-point twinkle, the game's "a little light" mark
function twinkle(ctx, x, y, r, color) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fillStyle = color; ctx.fill(); }
// glyph-tight vertical metrics for the current font, so gaps look the same whichever font loaded
function vm(ctx, px) {
  const a = ctx.measureText('Hdlfk'), b = ctx.measureText('gjpqy');
  return { asc: a.actualBoundingBoxAscent > 0 ? a.actualBoundingBoxAscent : px * 0.72, desc: b.actualBoundingBoxDescent > 0 ? b.actualBoundingBoxDescent : px * 0.22 };
}

// ---------- text fitting ----------
function wrap(ctx, text, maxW, indent = 0) {
  const lines = []; let cur = ''; let room = maxW - indent;
  const push = () => { lines.push(cur); cur = ''; room = maxW; };
  for (const word of text.split(' ')) {
    if (!word) continue;
    const t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width <= room) { cur = t; continue; }
    if (cur) push();
    if (ctx.measureText(word).width <= room) { cur = word; continue; }
    for (const g of graphemes(word)) { if (cur && ctx.measureText(cur + g).width > room) push(); cur += g; } // a word longer than the line
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}
// the same number of lines, as even as possible, so a short last word is not left on its own;
// and no line but the last ends on a one-letter word ("I", "a")
function balanced(ctx, text, maxW, n) {
  let lo = Math.max(maxW * 0.45, ...text.split(' ').map((w) => ctx.measureText(w).width)), hi = maxW;
  if (lo >= hi) return wrap(ctx, text, maxW);
  for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (wrap(ctx, text, mid).length <= n) hi = mid; else lo = mid; }
  for (let k = 0; k <= 8; k++) {
    const lines = wrap(ctx, text, hi + (maxW - hi) * k / 8);
    if (lines.length <= n && !lines.slice(0, -1).some((l) => /(^|\s)\S$/.test(l))) return lines;
  }
  return wrap(ctx, text, hi);
}
function ellipsize(ctx, s, maxW) {
  const g = graphemes(s.trimEnd());
  while (g.length && ctx.measureText(g.join('').trimEnd() + '…').width > maxW) g.pop();
  return g.join('').trimEnd() + '…';
}
// One size for a group of texts: the largest from max down to min at which each of them fits in maxLines. A text
// that cannot fit even at min (one endless word) does not drag the others down; it gets an ellipsis instead.
function fitAll(ctx, texts, font, max, min, maxW, maxLines, indent = 0, even = false) {
  const lo = Math.round(min), fits = (t, q) => { ctx.font = font(q); return wrap(ctx, t, maxW, indent).length <= maxLines; };
  const able = texts.filter((t) => fits(t, lo));
  let px = lo;
  if (able.length) for (let q = Math.round(max); q > lo; q -= 2) { if (able.every((t) => fits(t, q))) { px = q; break; } }
  ctx.font = font(px);
  const out = texts.map((t) => {
    let lines = wrap(ctx, t, maxW, indent);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1], maxW - (maxLines === 1 ? indent : 0)); }
    else if (even && !indent && lines.length > 1) lines = balanced(ctx, t, maxW, lines.length);
    return lines;
  });
  return { px, font: font(px), lines: out, ...vm(ctx, px) };
}
// a measured paragraph: its height runs from the first line's ascender to the last line's descender
function para(fit, i, lh) { const n = fit.lines[i].length; return { lines: fit.lines[i], font: fit.font, asc: fit.asc, lh, h: fit.asc + (n - 1) * lh + fit.desc }; }
function paintPara(ctx, p, x, y, color) { ctx.font = p.font; ctx.fillStyle = color; p.lines.forEach((l, i) => ctx.fillText(l, x, y + p.asc + i * p.lh)); }
function sectionHead(ctx, text, w, s) { const f = fitAll(ctx, [text], (px) => fD(600, px), 36 * s, 24, w, 2, 0, true); return para(f, 0, f.px * 1.14); }

// ---------- icons (the evening page's icons, in 24-unit boxes) ----------
function icon(ctx, kind, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  try {
    if (kind === 'bend') { ctx.beginPath(); ctx.ellipse(12, 14.5, 9, 5.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.stroke(new Path2D('M5 4l2.5 3M19 4l-2.5 3M12 3v3')); }
    else if (kind === 'gear') { ctx.stroke(new Path2D('M4 15v-3a8 8 0 0116 0v3')); rr(ctx, 2.5, 13.5, 5, 7, 2); ctx.fill(); rr(ctx, 16.5, 13.5, 5, 7, 2); ctx.fill(); }
    else if (kind === 'ask') { ctx.stroke(new Path2D('M4 5h16v10H10l-4 4v-4H4z')); ctx.lineWidth = 2.8; ctx.stroke(new Path2D('M9 10h.01M12 10h.01M15 10h.01')); }
    else if (kind === 'fix') { ctx.stroke(new Path2D('M4 20l4-1 11-11-3-3L5 16z')); ctx.stroke(new Path2D('M14 6l3 3')); }
    else { ctx.setLineDash([3.2, 3.4]); ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.stroke(); }
  } catch (e) { /* a canvas without Path2D strings: the chip stays plain */ }
  ctx.restore();
}
// a map pin standing on the text baseline
function pin(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 2.15);
  ctx.bezierCurveTo(x - r * 0.35, y + r * 1.45, x - r, y + r * 0.85, x - r, y);
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.bezierCurveTo(x + r, y + r * 0.85, x + r * 0.35, y + r * 1.45, x, y + r * 2.15);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill();
}

// ---------- fonts and the portrait ----------
async function fontsReady(sample) {
  const fs = typeof document !== 'undefined' ? document.fonts : null;
  if (!fs || typeof fs.load !== 'function') return;
  const want = [fD(600, 100), fD(500, 40), fB(400, 40), fB(700, 40)];
  const all = Promise.all(want.map((f) => { try { return fs.load(f, sample).catch(() => null); } catch (e) { return null; } }));
  await Promise.race([all, new Promise((r) => setTimeout(r, 1500))]);
}
function loadImage(src) {
  return new Promise((done) => {
    if (!src || typeof Image === 'undefined') { done(null); return; }
    let over = false; const end = (v) => { if (!over) { over = true; done(v); } };
    const img = new Image();
    img.onload = () => end(img.naturalWidth > 0 ? img : null); img.onerror = () => end(null);
    setTimeout(() => end(null), 5000);
    img.src = src;
  });
}

// ---------- blocks: each one is measured first, then painted at (x, y) ----------
function headBlock(ctx, D, maxW, maxPx, s) {
  // the wordmark plus room for its two twinkles (about half an em) fits the column
  ctx.font = fD(600, maxPx); track(ctx, -0.02 * maxPx); const w1 = ctx.measureText(WORDMARK).width / maxPx;
  const px = Math.floor(Math.min(maxPx, maxW / (w1 + 0.5)));
  ctx.font = fD(600, px); track(ctx, -0.02 * px); const m = ctx.measureText(WORDMARK); track(ctx, 0);
  const asc = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : px * 0.72;
  const sub = para(fitAll(ctx, [D.subtitle], (q) => fD(500, q), Math.min(46 * s, Math.max(40 * s, px * 0.42)), 26, maxW, 1), 0, 0);
  const gap = Math.round(px * 0.24);
  return { h: asc + gap + sub.h, paint(ctx, x, y) { paintWordmark(ctx, px, asc, x, y); paintPara(ctx, sub, x, y + asc + gap, C.soft); } };
}
function paintWordmark(ctx, px, asc, x, y) {
  const base = y + asc;
  ctx.font = fD(600, px); track(ctx, -0.02 * px);
  const wA = ctx.measureText('Made to ').width, wF = ctx.measureText('Fit').width;
  ctx.save(); ctx.translate(x + wA + wF / 2, base - px * 0.2); ctx.rotate(-0.045); // a marker swipe under "Fit"
  rr(ctx, -wF / 2 - px * 0.1, -px * 0.2, wF + px * 0.2, px * 0.34, px * 0.12); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
  ctx.fillStyle = C.ink; ctx.fillText(WORDMARK, x, base); track(ctx, 0);
  twinkle(ctx, x + wA + wF + px * 0.2, base - asc * 0.95, px * 0.13, C.accent);
  twinkle(ctx, x + wA + wF + px * 0.4, base - asc * 0.55, px * 0.07, '#e8a53a');
}
function placesBlock(ctx, D, w, s) {
  const hd = sectionHead(ctx, HEAD.places, w, s); const g1 = Math.round(20 * s);
  if (!D.places.length) {
    const p = para(fitAll(ctx, [STILL], (px) => fB(400, px), 42 * s, 26, w, 1), 0, 0);
    return { h: hd.h + g1 + p.h, paint(ctx, x, y) { paintPara(ctx, hd, x, y, C.brown); paintPara(ctx, p, x, y + hd.h + g1, C.soft); } };
  }
  const indent = Math.round(46 * s);
  const f = fitAll(ctx, D.places, (px) => fB(700, px), 42 * s, 28, w - indent, 2, 0, true);
  const items = D.places.map((_, i) => para(f, i, f.px * 1.2)); const gap = Math.round(f.px * 0.44);
  return {
    h: hd.h + g1 + items.reduce((a, it) => a + it.h, 0) + gap * (items.length - 1),
    paint(ctx, x, y) {
      paintPara(ctx, hd, x, y, C.brown); let yy = y + hd.h + g1;
      items.forEach((it, i) => { const r = it.asc * 0.37; pin(ctx, x + indent * 0.32, yy + it.asc * 1.04 - 2.15 * r, r, PINS[i % 3]); paintPara(ctx, it, x + indent, yy, C.ink); yy += it.h + gap; });
    },
  };
}
// Who adjusted. With counts, the rows sit in a soft tray, so short rows of dots read as room, not as gaps.
function tallyBlock(ctx, D, w, s) {
  if (!totalOf(D)) {
    const hd = sectionHead(ctx, HEAD.tally, w, s); const g1 = Math.round(20 * s);
    let f = fitAll(ctx, [NONE_YET], (px) => fB(400, px), 42 * s, 32 * s, w, 1); // one line if it can, two if it must
    if (f.lines[0][0].endsWith('…')) f = fitAll(ctx, [NONE_YET], (px) => fB(400, px), 42 * s, 26, w, 2, 0, true);
    const p = para(f, 0, f.px * 1.25);
    return { h: hd.h + g1 + p.h, paint(ctx, x, y) { paintPara(ctx, hd, x, y, C.brown); paintPara(ctx, p, x, y + hd.h + g1, C.soft); } };
  }
  const pad = Math.round(26 * s), iw = w - 2 * pad;
  const hd = sectionHead(ctx, HEAD.tally, iw, s); const g1 = Math.round(20 * s);
  // a small key in the tray's top-right corner, so a stranger reading the card knows what the dots are
  const key = fitAll(ctx, [KEY], (px) => fB(400, px), 29 * s, 22, iw, 1); ctx.font = key.font;
  const keyW = ctx.measureText(KEY).width; ctx.font = hd.font; const showKey = hd.lines.length === 1 && ctx.measureText(hd.lines[0]).width + keyW + 40 * s <= iw;
  const chip = Math.round(42 * s), gapC = Math.round(16 * s), rowGap = Math.round(11 * s);
  const lab = fitAll(ctx, ROWS.map((r) => r.label), (px) => fD(500, px), 36 * s, 24, 280 * s, 1);
  ctx.font = lab.font; const labW = Math.max(...ROWS.map((r) => ctx.measureText(r.label).width));
  const dotsX = chip + gapC + labW + Math.round(26 * s);
  const plus = ROWS.map((r) => (D.tally[r.k] > 40 ? '+' + (D.tally[r.k] - 40).toLocaleString('en-US') : ''));
  const anyPlus = plus.some(Boolean);
  const pf = fitAll(ctx, anyPlus ? plus.filter(Boolean) : ['+0'], (px) => fD(600, px), 30 * s, 22, 160, 1);
  ctx.font = pf.font; const plusW = anyPlus ? Math.max(...plus.map((t) => (t ? ctx.measureText(t).width : 0))) + 14 * s : 0;
  // A line holds up to twenty dots in groups of five: (n - 1) steps, a half-step gap between groups, and one dot
  // (0.7 of a step). The line is sized for the longest row, so small counts get slightly bigger dots.
  const perLine = Math.min(20, Math.max(...ROWS.map((r) => D.tally[r.k])));
  const steps = perLine - 1 + 0.5 * Math.floor((perLine - 1) / 5) + 0.7;
  const pitch = Math.min(40 * s, (iw - dotsX - plusW) / steps);
  const rows = ROWS.map((r, i) => { const n = D.tally[r.k]; return { ...r, n, plus: plus[i], h: chip + (n > 20 ? pitch : 0) }; });
  const rowsH = rows.reduce((a, r) => a + r.h, 0) + rowGap * (rows.length - 1);
  const h = pad + hd.h + g1 + rowsH + pad;
  return {
    h,
    paint(ctx, x, y) {
      ctx.save(); shadow(ctx, 20, 6, 0.07); rr(ctx, x, y, w, h, 30 * s); ctx.fillStyle = 'rgba(255,253,248,0.86)'; ctx.fill(); noShadow(ctx);
      ctx.strokeStyle = 'rgba(138,90,26,0.16)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      paintPara(ctx, hd, x + pad, y + pad, C.brown);
      if (showKey) {
        ctx.font = key.font; ctx.fillStyle = C.soft; ctx.textAlign = 'right'; const kb = y + pad + hd.asc; ctx.fillText(KEY, x + w - pad, kb); ctx.textAlign = 'left';
        ctx.beginPath(); ctx.arc(x + w - pad - keyW - 16 * s, kb - key.asc * 0.36, 7 * s, 0, Math.PI * 2); ctx.fillStyle = C.soft; ctx.fill();
      }
      const r = rng(11); const dot = pitch * 0.7; let yy = y + pad + hd.h + g1; const x0 = x + pad;
      for (const row of rows) {
        const zero = row.n === 0; const cy = yy + chip / 2;
        ctx.globalAlpha = zero ? 0.55 : 1;
        rr(ctx, x0, yy, chip, chip, chip * 0.3); ctx.fillStyle = row.bg; ctx.fill();
        icon(ctx, row.icon, x0 + chip * 0.2, yy + chip * 0.2, chip * 0.6, row.fg);
        ctx.globalAlpha = 1;
        ctx.font = lab.font; ctx.fillStyle = zero ? C.soft : C.ink; ctx.fillText(row.label, x0 + chip + gapC, cy + (lab.asc - lab.desc * 0.2) / 2);
        for (let i = 0, n = Math.min(row.n, 40); i < n; i++) { // hand-placed: a little jitter in place and size
          const k = i % 20;
          const dx = x0 + dotsX + k * pitch + Math.floor(k / 5) * pitch * 0.5 + dot / 2 + (r() - 0.5) * 1.6;
          const dy = cy + (i < 20 ? 0 : pitch) + (r() - 0.5) * 1.6;
          ctx.beginPath(); ctx.arc(dx, dy, (dot / 2) * (0.94 + r() * 0.1), 0, Math.PI * 2); ctx.fillStyle = row.fg; ctx.fill();
          ctx.beginPath(); ctx.arc(dx - dot * 0.16, dy - dot * 0.16, dot * 0.14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
        }
        if (row.plus) { ctx.font = pf.font; ctx.fillStyle = C.soft; ctx.fillText(row.plus, x0 + dotsX + steps * pitch + 14 * s, cy + pitch + (pf.asc - pf.desc * 0.2) / 2); }
        yy += row.h + rowGap;
      }
    },
  };
}
function notesBlock(ctx, D, w, s) {
  const cols = [];
  if (D.turned) cols.push({ head: HEAD.turned, text: D.turned });
  if (D.nextTime) cols.push({ head: HEAD.next, text: D.nextTime });
  const two = cols.length === 2; const gap = Math.round(56 * s), g1 = Math.round(16 * s), font = (px) => fB(400, px);
  const measure = (ws, f) => {
    const hds = cols.map((c, i) => sectionHead(ctx, c.head, ws[i], s)); const hdH = Math.max(...hds.map((p) => p.h));
    const ps = cols.map((c, i) => para(f(i), 0, f(i).px * 1.27));
    return { ws, hds, ps, hdH, h: hdH + g1 + Math.max(...ps.map((p) => p.h)) };
  };
  let best;
  if (!two) { const f = fitAll(ctx, [cols[0].text], font, 40 * s, 26, w, 3, 0, true); best = measure([w], () => f); }
  else {
    // one text size for both, then the split between the columns that makes the block shortest (a long answer
    // beside a short one gets the wider column)
    const half = (w - gap) / 2; const px = fitAll(ctx, cols.map((c) => c.text), font, 40 * s, 26, half, 4).px;
    const cut = (f, i) => { const ls = f.lines[0]; return ls[ls.length - 1].endsWith('…') && !cols[i].text.endsWith('…'); };
    const evenCut = cols.map((c, i) => cut(fitAll(ctx, [c.text], font, px, px, half, 4), i));
    for (const r of [0.5, 0.45, 0.55, 0.4, 0.6, 0.36, 0.64]) {
      const ws = [(w - gap) * r, (w - gap) * (1 - r)];
      const fs = ws.map((cw, i) => fitAll(ctx, [cols[i].text], font, px, px, cw, 4, 0, true));
      if (fs.some((f, i) => cut(f, i) && !evenCut[i])) continue; // never cut a text that the even split kept whole
      const m = measure(ws, (i) => fs[i]);
      if (!best || m.h < best.h - 1) best = m;
    }
  }
  const { ws, hds, ps, hdH, h } = best;
  return {
    h,
    paint(ctx, x, y) {
      let cx = x;
      cols.forEach((c, i) => { paintPara(ctx, hds[i], cx, y + hdH - hds[i].h, C.brown); paintPara(ctx, ps[i], cx, y + hdH + g1, C.ink); cx += ws[i] + gap; });
      if (two) { ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.beginPath(); const lx = x + ws[0] + gap / 2; ctx.moveTo(lx, y + 4); ctx.lineTo(lx, y + h - 4); ctx.stroke(); ctx.restore(); }
    },
  };
}
function keptBlock(ctx, D, w, s) {
  const padX = Math.round(28 * s), padY = Math.round(20 * s), bead = Math.round(28 * s), gapB = Math.round(16 * s);
  const tw = w - 2 * padX - bead - gapB;
  // "Kept:" in bold, then the moment, wrapped with the first line indented by the label; two lines at most
  let px = Math.round(38 * s), pre = 0;
  for (;; px -= 2) {
    ctx.font = fB(700, px); pre = ctx.measureText('Kept: ').width;
    ctx.font = fB(400, px); if (wrap(ctx, D.kept, tw, pre).length <= 2 || px <= 28) break;
  }
  const p = para(fitAll(ctx, [D.kept], (q) => fB(400, q), px, px, tw, 2, pre), 0, px * 1.28);
  const h = p.h + 2 * padY;
  return {
    h,
    paint(ctx, x, y) {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.006);
      rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.fillStyle = '#fdeac4'; ctx.fill();
      ctx.strokeStyle = 'rgba(168,113,26,0.45)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.restore();
      // a kept moment is a little glowing bead, like the ones in the jar
      const bx = x + padX + bead / 2, by = y + padY + p.asc * 0.5;
      ctx.save(); ctx.shadowColor = 'rgba(255,176,74,0.9)'; ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(bx - bead * 0.15, by - bead * 0.15, 1, bx, by, bead / 2); g.addColorStop(0, '#fff4d0'); g.addColorStop(1, '#ffb04a');
      ctx.beginPath(); ctx.arc(bx, by, bead / 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      const tx = x + padX + bead + gapB, ty = y + padY;
      ctx.font = fB(700, px); ctx.fillStyle = C.note; ctx.fillText('Kept:', tx, ty + p.asc);
      ctx.font = p.font; p.lines.forEach((l, i) => ctx.fillText(l, tx + (i ? 0 : pre), ty + p.asc + i * p.lh));
    },
  };
}
function nameTag(ctx, name, s, maxW) {
  const padX = Math.round(26 * s);
  const f = fitAll(ctx, [name], (px) => fD(600, px), 40 * s, 24, maxW - 2 * padX, 1);
  ctx.font = f.font; const tw = ctx.measureText(f.lines[0][0]).width;
  return { text: f.lines[0][0], font: f.font, asc: f.asc, desc: f.desc, w: tw + 2 * padX, h: f.asc + f.desc + Math.round(28 * s) };
}

// ---------- the portrait ----------
function paintPortrait(ctx, L, cx, cy) {
  const { P, F, fw, rot, img } = L; const R = fw * 0.15;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  shadow(ctx, 34, 14, 0.26); rr(ctx, -fw / 2, -fw / 2, fw, fw, R); ctx.fillStyle = C.amber; ctx.fill(); noShadow(ctx);
  // a little depth on the frame: lighter top left, warmer bottom right
  const g = ctx.createLinearGradient(-fw / 2, -fw / 2, fw / 2, fw / 2); g.addColorStop(0, 'rgba(255,248,226,0.55)'); g.addColorStop(0.5, 'rgba(255,248,226,0)'); g.addColorStop(1, 'rgba(214,140,50,0.28)');
  rr(ctx, -fw / 2, -fw / 2, fw, fw, R); ctx.fillStyle = g; ctx.fill();
  const r = Math.max(10, R - F * 0.8);
  ctx.save(); rr(ctx, -P / 2, -P / 2, P, P, r); ctx.clip();
  ctx.fillStyle = C.paper2; ctx.fillRect(-P / 2, -P / 2, P, P);
  if (img) {
    const iw = img.naturalWidth, ih = img.naturalHeight, k = Math.max(P / iw, P / ih) * 1.04; // cover, a touch closer
    ctx.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
  } else {
    // no portrait yet: a soft placeholder circle in a dashed ring
    ctx.strokeStyle = 'rgba(138,90,26,0.3)'; ctx.lineWidth = Math.max(3, P * 0.009); ctx.setLineDash([P * 0.03, P * 0.035]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, P * 0.35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const g2 = ctx.createRadialGradient(-P * 0.09, -P * 0.1, P * 0.02, 0, 0, P * 0.27); g2.addColorStop(0, '#fffbf2'); g2.addColorStop(1, '#f2dcb4');
    shadow(ctx, P * 0.06, P * 0.025, 0.16); ctx.beginPath(); ctx.arc(0, 0, P * 0.26, 0, Math.PI * 2); ctx.fillStyle = g2; ctx.fill(); noShadow(ctx);
  }
  ctx.restore();
  rr(ctx, -P / 2, -P / 2, P, P, r); ctx.strokeStyle = 'rgba(122,82,54,0.35)'; ctx.lineWidth = 2.5; ctx.stroke();
  // paper bits around the frame, like the little bursts the game makes when something goes well
  const h = fw / 2; const bits = [[h + 24, -h * 0.6, 'rect', C.accent, 0.6, 15], [h + 12, -h * 0.2, 'dot', C.teal, 0, 10], [-h * 0.42, -h - 24, 'rect', '#9b8ad6', -0.4, 13], [h * 0.6, -h - 20, 'star', '#e8a53a', 0, 15], [h + 20, h * 0.45, 'rect', '#f0b54a', 0.25, 13]];
  for (const [bx, by, kind, col, a, sz] of bits) {
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a - rot); ctx.fillStyle = col;
    if (kind === 'rect') ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66); else if (kind === 'dot') { ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, Math.PI * 2); ctx.fill(); } else twinkle(ctx, 0, 0, sz * 0.7, col);
    ctx.restore();
  }
  ctx.restore();
  // the name tag hangs from the bottom edge, not tilted with the frame, so the name stays crisp
  if (L.tag) {
    const t = L.tag; const ty = cy + L.bb / 2 - t.h * 0.4; const tx = Math.min(cx, W - M + 8 - t.w / 2); // a long name grows leftwards
    ctx.save(); ctx.translate(tx, ty + t.h / 2); ctx.rotate(-rot * 0.6);
    shadow(ctx, 14, 5, 0.25, '20,14,30'); rr(ctx, -t.w / 2, -t.h / 2, t.w, t.h, t.h / 2); ctx.fillStyle = C.ink; ctx.fill(); noShadow(ctx);
    ctx.font = t.font; ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.fillText(t.text, 0, (t.asc - t.desc) / 2); ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ---------- layout ----------
// Measures one candidate layout and returns how much room is left above the footer.
//  'A': a light card. The wordmark runs across the top and the portrait sits big in the middle.
//  'B': the wordmark runs across the top; the places sit beside the portrait.
//  'C': a full card. The portrait moves up beside the wordmark, so the sections below get the room.
function plan(ctx, D, img, o) {
  const s = o.s, P = Math.round(o.P), mode = o.mode;
  const F = Math.round(16 + P * 0.04), fw = P + 2 * F;
  const rot = (mode === 'C' ? -2.2 : mode === 'B' ? 2.2 : -1.6) * Math.PI / 180;
  const bb = fw * (Math.cos(rot) + Math.abs(Math.sin(rot))); // the tilted frame's bounding box
  const L = { s, P, F, fw, rot, bb, mode, img, blocks: [], gaps: [] };
  L.tag = D.name ? nameTag(ctx, D.name, s, mode === 'C' ? bb + 30 : mode === 'B' ? bb + 70 : CW * 0.8) : null;
  const portraitH = bb + (L.tag ? L.tag.h * 0.6 : 0);
  const add = (gap, b) => { if (L.blocks.length) L.gaps.push(Math.round(gap)); L.blocks.push(b); };
  let tallyDone = false;
  if (mode === 'A') {
    add(0, headBlock(ctx, D, CW, 132 * s, s));
    add(44 * s, { h: portraitH, paint: (c, x, y) => paintPortrait(c, L, W / 2, y + bb / 2) });
    if (!totalOf(D)) { // nothing counted yet: places and the tally side by side
      const gap = Math.round(56 * s), half = (CW - gap) / 2;
      const pl = placesBlock(ctx, D, half, s), ta = tallyBlock(ctx, D, half, s);
      add(52 * s, { h: Math.max(pl.h, ta.h), paint: (c, x, y) => { pl.paint(c, x, y); ta.paint(c, x + half + gap, y); } });
      tallyDone = true;
    } else add(52 * s, placesBlock(ctx, D, CW, s));
  } else if (mode === 'B') {
    add(0, headBlock(ctx, D, CW, 132 * s, s));
    const lw = CW - bb - 44 * s; const pl = placesBlock(ctx, D, lw, s); const h = Math.max(pl.h + 12 * s, portraitH);
    add(44 * s, { h, paint: (c, x, y) => { paintPortrait(c, L, W - M - bb / 2, y + bb / 2); pl.paint(c, x, y + Math.max(10 * s, (Math.min(h, bb) - pl.h) * 0.42)); } });
  } else {
    const lw = CW - bb - 40 * s; const hd = headBlock(ctx, D, lw, 118 * s, s); const pl = placesBlock(ctx, D, lw, s); const g = Math.round(42 * s);
    add(0, { h: Math.max(hd.h + g + pl.h, portraitH - 6), paint: (c, x, y) => { hd.paint(c, x, y); paintPortrait(c, L, W - M - bb / 2, y - 6 + bb / 2); pl.paint(c, x, y + hd.h + g); } });
  }
  if (!tallyDone) add(42 * s, tallyBlock(ctx, D, CW, s));
  if (D.turned || D.nextTime) add(40 * s, notesBlock(ctx, D, CW, s));
  if (D.kept) add(34 * s, keptBlock(ctx, D, CW, s));
  const ff = fitAll(ctx, [FOOTER], (px) => fD(500, px), 34 * s, 24, CW - 200, 1); L.footer = para(ff, 0, 0);
  L.footerY = H - 54 - L.footer.h; L.top = 60;
  const used = L.blocks.reduce((a, b) => a + b.h, 0) + L.gaps.reduce((a, g) => a + g, 0);
  L.slack = Math.floor(L.footerY - 28 * s - L.top - used);
  return L;
}
// The first candidate that fits wins: big portrait layouts first, then smaller portraits, and only then smaller text.
function choose(ctx, D, img) {
  const tries = [];
  for (let P = 500; P >= 400; P -= 20) tries.push({ mode: 'A', P, s: 1 });
  for (let P = 420; P >= 340; P -= 20) tries.push({ mode: 'B', P, s: 1 });
  for (let P = 400; P >= 280; P -= 20) tries.push({ mode: 'C', P, s: 1 });
  // the creature stays at 280 or more until the text is down to 90%; past that, both shrink together
  for (let k = 49; k >= 32; k--) { const s = k / 50; tries.push({ mode: 'C', P: Math.round(280 * Math.min(1, s / 0.9)), s }); }
  let L = null;
  for (const t of tries) { L = plan(ctx, D, img, t); if (L.slack >= 0) break; }
  return L;
}

// ---------- painting ----------
function paintPaper(ctx) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.9, H * 0.06, 10, W * 0.9, H * 0.06, W * 0.95); // warm light from just out of frame
  g.addColorStop(0, 'rgba(255,207,122,0.40)'); g.addColorStop(0.5, 'rgba(255,207,122,0.13)'); g.addColorStop(1, 'rgba(255,207,122,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.02, H, 10, W * 0.02, H, W * 0.75);
  g.addColorStop(0, 'rgba(79,179,169,0.13)'); g.addColorStop(1, 'rgba(79,179,169,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(7); // paper grain
  for (let i = 0; i < 4200; i++) { const a = 0.018 + r() * 0.04; ctx.fillStyle = r() < 0.65 ? `rgba(90,70,48,${a})` : `rgba(255,255,255,${a * 2.2})`; ctx.fillRect(r() * W, r() * H, 1 + r() * 1.6, 1 + r() * 1.6); }
  ctx.save(); ctx.strokeStyle = 'rgba(138,90,26,0.22)'; ctx.lineWidth = 3; rr(ctx, 24, 24, W - 48, H - 48, 34); ctx.setLineDash([2, 10]); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); // a hand-cut edge
}
function paintFooter(ctx, L) {
  const p = L.footer; ctx.font = p.font; const w = ctx.measureText(FOOTER).width; const x = (W - w) / 2, y = L.footerY;
  paintPara(ctx, p, x, y, C.soft);
  const cy = y + p.asc * 0.55;
  ROWS.forEach((row, i) => { ctx.fillStyle = row.fg; for (const dx of [x - 36 - (4 - i) * 20, x + w + 36 + i * 20]) { ctx.beginPath(); ctx.arc(dx, cy, 5.5, 0, Math.PI * 2); ctx.fill(); } });
}

/**
 * Draw the shareable fit card.
 * @param {object} d { portrait, name, showName, places, tally: { you, gear, them, place, nobody }, turned, nextTime, visits, kept }
 * @returns {Promise<HTMLCanvasElement>} a 1080×1350 canvas with role="img" and aria-label = cardAltText(d)
 */
export async function drawFitCard(d) {
  const D = norm(d);
  const sample = [WORDMARK, FOOTER, D.subtitle, ...Object.values(HEAD), NONE_YET, STILL, KEY, 'Kept: +0123456789', ...ROWS.map((r) => r.label), D.name, ...D.places, D.turned, D.nextTime, D.kept].filter(Boolean).join(' ');
  const [img] = await Promise.all([loadImage(D.portrait), fontsReady(sample)]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if ('textRendering' in ctx) ctx.textRendering = 'optimizeLegibility';
  const L = choose(ctx, D, img);
  paintPaper(ctx);
  // spare room goes between the sections first (up to 60 px each), a little at the top, the rest above the footer;
  // if even the smallest layout ran over, the gaps give the room back instead
  const extra = Math.max(0, L.slack); const per = L.gaps.length ? Math.min(extra / (L.gaps.length + 1), 60 * L.s) : 0;
  const gapSum = L.gaps.reduce((a, g) => a + g, 0); const squeeze = L.slack < 0 && gapSum ? Math.max(0.2, 1 + L.slack / gapSum) : 1;
  let y = L.top + Math.min(extra - per * L.gaps.length, 20);
  L.blocks.forEach((b, i) => { if (i) y += L.gaps[i - 1] * squeeze + per; b.paint(ctx, M, y); y += b.h; });
  paintFooter(ctx, L);
  // describe what was drawn: a portrait that would not decode was drawn as the placeholder
  const alt = cardAltText(D.portrait && !img ? { ...d, portrait: null } : d);
  try { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', alt); } catch (e) { /* not in a DOM */ }
  // for tests and debugging: which layout won, and the name exactly as drawn
  Object.defineProperty(cv, 'fitLayout', { value: { mode: L.mode, portrait: L.P, scale: L.s, slack: L.slack, name: L.tag ? L.tag.text : '' }, enumerable: false });
  return cv;
}

/** The card as a PNG Blob. */
export async function cardBlob(canvas) {
  if (canvas && typeof canvas.toBlob === 'function') {
    const b = await new Promise((res) => { try { canvas.toBlob((x) => res(x), 'image/png'); } catch (e) { res(null); } });
    if (b) return b;
  }
  return blobNow(canvas);
}
function blobNow(canvas) { // synchronous, so a plain download can still happen inside the tap that asked for it
  const url = canvas.toDataURL('image/png'); const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

let saving = null; // one save prompt at a time: a second tap while one is open gets the same answer
/**
 * Offer the card to the viewer. Resolves to one of:
 * 'saved': the viewer accepted the platform's save prompt. 'declined': they said no (never retry on your own).
 * 'download': the browser was handed a file download. 'fallback': show `url` as an <img> with "Press and hold to save".
 */
export async function saveFitCard(canvas) {
  if (!saving) saving = doSave(canvas).catch(() => fallback(canvas)).finally(() => { saving = null; });
  return saving;
}
function fallback(canvas) { try { return { status: 'fallback', url: canvas.toDataURL('image/png') }; } catch (e) { return { status: 'fallback', url: '' }; } }
function framed() { try { return window.self !== window.top; } catch (e) { return true; } }
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
async function doSave(canvas) {
  const cl = typeof window !== 'undefined' ? window.claude : null;
  if (cl && typeof cl.use === 'function') {
    // use() resolves null when this view cannot save; a host that never answers takes 10 s, so stop waiting at 4
    let dl = null;
    try { dl = await Promise.race([Promise.resolve(cl.use('downloads')).catch(() => null), wait(4000, null)]); } catch (e) { dl = null; }
    if (dl && typeof dl.save === 'function') {
      // the viewer sees a confirmation with the file name and size; nothing is saved unless they accept
      const offer = async (filename, data) => { try { await dl.save({ filename, data }); return 'saved'; } catch (err) { return (err && err.code) || 'unavailable'; } };
      let r = await offer(FILE, await cardBlob(canvas));
      if (r === 'rate_limited') { await wait(1500); r = await offer(FILE, await cardBlob(canvas)); } // wait, then retry once
      if (r === 'too_large') { const jpg = await new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/jpeg', 0.86)); if (jpg) r = await offer('made-to-fit-card.jpg', jpg); }
      if (r === 'saved') return { status: 'saved' };
      if (r === 'declined') return { status: 'declined' };
      return fallback(canvas); // unavailable, not granted, or a code we do not know: saving is not possible here
    }
    if (framed()) return fallback(canvas); // inside a host that offers no saving, a direct download is blocked silently
  }
  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL && document.body && 'download' in document.createElement('a')) {
    try {
      const url = URL.createObjectURL(blobNow(canvas));
      const a = document.createElement('a'); a.href = url; a.download = FILE; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { status: 'download' };
    } catch (e) { /* fall through to the picture */ }
  }
  return fallback(canvas);
}

/** A plain-language description of the card, for screen readers and alt text. */
export function cardAltText(d) {
  const D = norm(d);
  const end = (t) => (/[.!?…"”')]$/.test(t) ? t : t + '.');
  const list = (a) => (a.length < 3 ? a.join(' and ') : a.slice(0, -1).join('; ') + '; and ' + a[a.length - 1]); // places may hold commas
  const times = (n) => (n === 0 ? 'not yet' : n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const who = D.fullName ? `${D.fullName}'s` : "the player's";
  const out = [`Made to Fit card, ${D.subtitle.toLowerCase()}.`];
  out.push(D.portrait ? `A portrait of ${who} creature in a warm rounded frame.` : `A soft circle where ${who} portrait will go.`);
  out.push(D.places.length ? `Places that fit me: ${list(D.places)}.` : 'Places that fit me: still looking.');
  out.push(totalOf(D) ? `Who adjusted, counted in dots: ${ROWS.map((r) => `${r.label.toLowerCase()} ${times(D.tally[r.k])}`).join(', ')}.` : `Who adjusted: ${NONE_YET.toLowerCase()}`);
  if (D.turned) out.push(`When I was the one asked: ${end(D.turned)}`);
  if (D.nextTime) out.push(`Next time: ${end(D.nextTime)}`);
  if (D.kept) out.push(`Kept: ${end(D.kept)}`);
  out.push(FOOTER);
  return out.join(' ');
}
