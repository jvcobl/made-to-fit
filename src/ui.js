// DOM interface: dialogue, the "who adjusts?" card, phone, creator, room setup, settings, title, evening page and ending.
import { esc, fmtTime, clamp, FAST, now, keyName } from './util.js';
import { OPTIONS } from './creature.js';
import { CAST, HINTS, BLEND, SETUP, PEOPLE, SLOT_LABEL, STAKES, roleOf } from './content.js';
import { FIELD_NOTES, NOTE_SECTIONS, SUPPORT } from './notes.js';
import { drawFitCard, saveFitCard, cardAltText } from './fitcard.js';
import { PLAQUE as PLAQUE_TEXT } from './look.js';
const SETUP_NAMES = { lamp: 'Lamp', radio: 'Radio', sign: 'Door sign', note: 'House rules', clock: 'Clock', calendar: 'Calendar' };
import { FIXES, pinch, fixState, supporters, capText } from './sim.js';
import { ZONES } from './town.js';
import { CARDS } from './hearing.js';
import { MARKS, STREETS, KINDS } from './marks.js';
import { FISH } from './games/pond.js';
import { PACK_PRICE, SINGLE_PRICE, MORE_MAX, cardName, cardTile, drawPack, addCards, packLine, packSentence, moreSentence } from './packs.js';

export const ICON = {
  bend: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="9" ry="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 4l2.5 3M19 4l-2.5 3M12 3v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0116 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2.5" y="13.5" width="5" height="7" rx="2" fill="currentColor"/><rect x="16.5" y="13.5" width="5" height="7" rx="2" fill="currentColor"/></svg>',
  ask: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H10l-4 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  fix: '<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 6l3 3" stroke="currentColor" stroke-width="2"/></svg>',
  leave: '<svg viewBox="0 0 24 24"><path d="M14 4H6v16h8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 12h10M17 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  shades: '<svg viewBox="0 0 24 24"><path d="M2.5 9h19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 9.5h6.5v3.5a2.6 2.6 0 01-2.6 2.6H6.6A2.6 2.6 0 014 13zM13.5 9.5H20v3.5a2.6 2.6 0 01-2.6 2.6h-1.3a2.6 2.6 0 01-2.6-2.6z" fill="currentColor"/></svg>',
  way: '<svg viewBox="0 0 24 24"><path d="M12 2.5l6.5 17-6.5-4-6.5 4z" fill="currentColor"/></svg>',
  smooth: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 13.5c2 2.2 7 2.2 9 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  lantern: '<svg viewBox="0 0 24 24"><path d="M9 4h6M10 4v2M14 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="7" y="6" width="10" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9 21h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  jar: '<svg viewBox="0 0 24 24"><path d="M8 3.5h8M8.5 3.5v3L6 9.5V19a2 2 0 002 2h8a2 2 0 002-2V9.5l-2.5-3v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
export const isTouch = () => (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const DAYNAME = ['Moving day', 'Monday', 'Tuesday', 'Wednesday'];
// what a screen reader says for each creature colour
const COLOR_NAMES = { '#f2a99a': 'Salmon pink', '#f6cf5b': 'Sunflower yellow', '#9fd3b0': 'Mint green', '#93c2ee': 'Sky blue', '#bfa9f0': 'Lavender', '#f3a0c2': 'Rose pink', '#ffc98e': 'Apricot', '#9edcd6': 'Aqua', '#cde38f': 'Lime green', '#e4796a': 'Coral red', '#7d9fe0': 'Cornflower blue', '#c9b8a6': 'Sand' };
export const COMFORT_OPTS = [['hum', 'Hum'], ['tap', 'Tap'], ['rock', 'Rock'], ['spin', 'Spin'], ['flap', 'Flap'], ['pace', 'Pace'], ['charm', 'Fiddle with a charm']];

export class UI {
  constructor(G) {
    this.G = G;
    this.touch = isTouch();
    this.root = document.getElementById('ui');
    this.root.innerHTML = `
      <div id="letterbox"><div class="lb top"></div><div class="lb bot"></div></div>
      <div id="caption"></div>
      <div id="bubbles"></div>
      <div id="hud" hidden>
        <div class="clock"><div class="dial"></div><div class="cl"><div class="when"></div><div class="obj"></div><button class="way" id="wayBtn" hidden>${ICON.way}<span>Show the way</span></button><div class="pstrip" role="group" aria-label="How this place fits you" hidden></div><div class="gstrip" role="status" aria-label="Lantern night guests" hidden></div></div></div>
        <div class="hudbtns"><button class="btn hb" id="phoneBtn" aria-label="Phone">${ICON.phone}<span class="lbl">Phone</span>${this.touch ? '' : '<kbd class="kphone"></kbd>'}</button><button class="btn hb" id="setBtn" aria-label="Menu: pause and settings">${ICON.cog}<span class="lbl">Menu</span></button></div>
        <div class="dock"><div class="energy" title="Energy for today"><svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="14" fill="none" stroke-width="5"/><circle class="bar" cx="18" cy="18" r="14" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="88" stroke-dashoffset="0"/></svg><span class="elabel">Energy</span></div><div class="gearbtns"></div></div>
      </div>
      <div id="edge" hidden><div class="arr">${ICON.way}</div><span></span></div>
      <div id="prompt" hidden></div>
      <button id="actbtn" hidden></button>
      <div id="dialog" hidden><div class="plate"></div><div class="tagline"></div><div class="text"></div><div class="extra"></div><div class="more">▼</div><div class="choices"></div></div>
      <div id="barrier" hidden></div>
      <div id="toasts"></div>
      <div id="phone" hidden></div>
      <div id="mg" hidden></div>
      <div id="panel" hidden></div>
      <div id="cc" aria-hidden="true"></div>
      <div id="sr" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
    this.el = (id) => this.root.querySelector(id);
    this.dialog = this.el('#dialog'); this.barrierEl = this.el('#barrier'); this.panel = this.el('#panel'); this.phoneEl = this.el('#phone');
    this.waiter = null; this.phoneTab = 'today'; this.bubblesMap = {}; this.gearKey = '';
    this.el('#phoneBtn').onclick = () => this.G.togglePhone(true);
    this.el('#setBtn').onclick = () => this.G.openPause();
    this.el('#prompt').onclick = () => this.G.interact();
    this.el('#actbtn').onclick = () => this.G.interact();
    this.el('#wayBtn').onclick = () => this.G.showWay();
    this.el('#edge').onclick = () => this.G.showWay();
    this.el('#caption').onclick = () => this.skipCaption();
    this.dialog.addEventListener('click', (e) => { if (e.target.closest('.choice')) return; this.advance(); });
    this.el('.gearbtns').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const g = b.dataset.g; if (g === 'smooth') this.G.setSmooth(!this.G.S.blend.smooth); else if (g === 'look') this.G.look.toggle(); else this.G.toggleGear(g); this.gearKey = ''; });
    window.addEventListener('keydown', (e) => this.key(e));
    // a panel that is taller than the screen scrolls, and then keeps its buttons pinned at the bottom
    { const fit = () => { const p = this.panel; if (p && !p.hidden) p.classList.toggle('scrolls', p.scrollHeight > p.clientHeight + 2); };
      if (typeof MutationObserver !== 'undefined') new MutationObserver(() => requestAnimationFrame(fit)).observe(this.panel, { childList: true, subtree: true });
      window.addEventListener('resize', fit); }
    window.addEventListener('keyup', (e) => { const k = keyName(e); if (this.holding && this.holding.key && (k === '1' || k === ' ' || k === 'Enter')) this.bendRelease(); });
    if (this.touch) document.body.classList.add('touch');
  }
  get set() { return this.G.settings; }
  // the screen-reader announcer: each line, choice list and notice is read once, in full (never the typewriter)
  announce(text) {
    const el = this.el('#sr'); if (!el || !text) return;
    let t = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); if (!t) return;
    // (text that came from markup reads as characters, not as "&quot;")
    if (t.includes('&')) { const d = this._srDec || (this._srDec = document.createElement('textarea')); d.innerHTML = t; t = d.value; }
    // several things said in the same moment are read together, in order, rather than the last one winning
    this._srQ = this._srPending ? this._srQ + ' ' + t : t; this._srPending = true;
    clearTimeout(this._srT); el.textContent = ''; this._srT = setTimeout(() => { this._srPending = false; el.textContent = this._srQ; }, 40);
  }
  // captions for sounds that carry information (the bus speaker, the noon bell, knocks)
  cc(text, ms = 3200) {
    if (this.set.captions === false || !text) return; const el = this.el('#cc'); el.textContent = text; el.classList.add('on');
    clearTimeout(this._ccT); this._ccT = setTimeout(() => el.classList.remove('on'), FAST ? 300 : ms); this.announce(text);
  }
  key(e) {
    if (this.G.menus && this.G.menus.open) return;
    const k = keyName(e); // digits and letters by position, so the number row works on AZERTY
    if (this.capSkip && (k === ' ' || k === 'Enter')) { e.preventDefault(); this.skipCaption(); return; }
    const w = this.waiter;
    if (!w) return;
    if (w.type === 'line' && (k === ' ' || k === 'Enter' || k === 'e')) { e.preventDefault(); this.advance(); return; }
    if (w.type !== 'choice' && w.type !== 'barrier') return;
    const btns = w.buttons;
    if (/^[1-9]$/.test(k)) {
      const btn = btns[+k - 1]; if (!btn) return; e.preventDefault();
      if (btn.dataset.hold === '1') { if (!e.repeat) this.bendPress(btn, true); return; }
      btn.click(); return;
    }
    const arrows = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (arrows[k]) { e.preventDefault(); const i = btns.indexOf(document.activeElement); const n = i < 0 ? (arrows[k] > 0 ? 0 : btns.length - 1) : (i + arrows[k] + btns.length) % btns.length; btns[n].focus(); return; }
    if (k === ' ' || k === 'Enter') {
      const f = document.activeElement;
      // a stray key never picks an option: the first press only shows where you are
      if (!btns.includes(f)) { e.preventDefault(); btns[0].focus(); return; }
      if (f.dataset.hold === '1') { e.preventDefault(); if (!e.repeat) this.bendPress(f, true); }
    }
  }
  // ---------- dialogue ----------
  plate(o) {
    const p = this.dialog.querySelector('.plate'); const S = this.G.S;
    if (o.kind === 'say' && o.who) {
      const c = CAST[o.who]; const name = o.who === 'you' ? (S.name || 'You') : (c ? c.name : o.who);
      p.hidden = false; p.innerHTML = esc(name) + (c && !this.G.met(o.who) ? '<small>' + esc(roleOf(o.who, this.G.S.act || 1)) + '</small>' : '');
      p.style.setProperty('--plate', o.who === 'you' ? '#3a3340' : (c ? c.tint : '#3a3340'));
    } else p.hidden = true;
  }
  line(o) {
    this.hideBarrier(); if (this.G.marks) this.G.marks.hideCard();
    const d = this.dialog; d.hidden = false; d.className = o.kind || 'say';
    this.plate(o);
    const tag = d.querySelector('.tagline');
    tag.textContent = o.kind === 'gut' ? 'Your gut' : o.kind === 'notice' ? o.label + ' · you notice' : '';
    tag.hidden = !(o.kind === 'gut' || o.kind === 'notice');
    d.querySelector('.choices').innerHTML = ''; d.querySelector('.more').hidden = true;
    const extra = d.querySelector('.extra'); extra.innerHTML = o.extra || '';
    const txt = d.querySelector('.text'); const full = o.text;
    if (o.voice) o.voice(full);
    { const S = this.G.S; const c = o.who ? CAST[o.who] : null; const who = o.kind === 'gut' ? 'Your gut' : o.kind === 'notice' ? (o.label || '') + ', you notice' : o.who === 'you' ? (S.name || 'You') : c ? c.name : o.who || ''; this.announce((who ? who + ': ' : '') + full + (o.extra ? ' ' + o.extra : '')); }
    const cps = FAST ? 1e9 : { slow: 28, normal: 52, fast: 95, instant: 1e9 }[this.set.textSpeed] || 52;
    return new Promise((resolve) => {
      let shown = 0; const wrap = (s) => (o.kind === 'hint' ? '<span class="hintword">' + esc(s) + '</span>' : esc(s));
      const done = () => { clearInterval(this.typer); this.typer = null; txt.innerHTML = wrap(full); d.querySelector('.more').hidden = !!o.noMore; };
      if (cps > 1e8) done(); else { txt.innerHTML = ''; this.typer = setInterval(() => { shown += Math.max(1, Math.round(cps / 30)); txt.innerHTML = wrap(full.slice(0, shown)); if (shown >= full.length) done(); }, 33); }
      this.waiter = { type: 'line', resolve: () => { if (this.typer) { done(); return false; } this.waiter = null; resolve(); return true; } };
      if (o.noWait) { done(); this.waiter = null; resolve(); }
    });
  }
  advance() { const w = this.waiter; if (w && w.type === 'line') { w.resolve(); this.G.audio.sfx('select'); } }
  choose(opts, o = {}) {
    const d = this.dialog; d.hidden = false; this.hideBarrier();
    if (o.text != null) { d.className = o.kind || 'say'; this.plate(o); d.querySelector('.text').innerHTML = o.html || esc(o.text); d.querySelector('.tagline').hidden = true; }
    d.querySelector('.more').hidden = true;
    const box = d.querySelector('.choices'); box.innerHTML = '';
    return new Promise((resolve) => {
      const buttons = opts.map((op, i) => {
        const b = document.createElement('button'); b.className = 'choice' + (op.blend ? ' blend' : '') + (op.disabled ? ' off' : ''); if (op.id) b.dataset.id = op.id;
        if (op.disabled) b.setAttribute('aria-disabled', 'true');
        b.innerHTML = `<span class="k">${i + 1}</span><span class="t">${esc(op.t)}</span>` + (op.blend ? `<span class="tag">${esc(BLEND.suggest)}</span>` : op.sub ? `<span class="sub">${esc(op.disabled && op.reason ? op.reason : op.sub)}</span>` : op.tag && op.tag !== 'blend' ? `<span class="tag">${esc(op.tag)}</span>` : '');
        b.onclick = () => { if (op.disabled) { this.nudge(b, op.reason); return; } this.waiter = null; box.innerHTML = ''; this.G.audio.sfx('confirm'); resolve(i); };
        box.appendChild(b); return b;
      });
      this.waiter = { type: 'choice', buttons };
      this.announce((o.text ? o.text + ' ' : '') + 'Choices: ' + opts.map((op, i) => (i + 1) + '. ' + op.t + (op.disabled ? ' (not available)' : '')).join('. '));
    });
  }
  // a control that cannot be used right now says why, instead of doing nothing
  nudge(el, reason) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); this.G.audio.sfx('back'); if (reason) this.toast(esc(reason), '', 2600); }
  hideDialog() { this.dialog.hidden = true; if (this.waiter && this.waiter.type !== 'barrier') this.waiter = null; }
  // ---------- who adjusts? ----------
  barrier(b) {
    this.dialog.hidden = true;
    const el = this.barrierEl; el.hidden = false;
    el.innerHTML = (b.face ? `<div class="bface"><img src="${b.face.img}" alt=""><div><b>${esc(b.face.name)}</b><span>${esc(b.face.sub || '')}</span></div></div>` : '') + `<h3>${esc(b.title)}</h3><div class="desc">${esc(b.text)}</div>` + (b.notice ? `<div class="noticeline"><b>${esc(b.noticeLabel)}</b> ${esc(b.notice)}</div>` : '') + (b.gut ? `<div class="gutline">${esc(b.gut)}</div>` : '') + `<div class="q">Who adjusts?</div>` + (b.coach ? `<div class="coach">${esc(b.coach)}</div>` : '') + `<div class="opts"></div>`;
    const box = el.querySelector('.opts');
    return new Promise((resolve) => {
      const buttons = b.options.map((o, i) => {
        const btn = document.createElement('button'); btn.className = 'opt ' + o.key + (o.disabled ? ' off' : '');
        if (o.disabled) btn.setAttribute('aria-disabled', 'true');
        const instant = FAST || this.set.holdToBend === false;
        btn.innerHTML = (o.img ? `<img class="oimg" src="${o.img}" alt="">` : `<div class="ic">${ICON[o.key]}</div>`) + `<div class="who">${esc(o.who)}</div>${o.tag ? `<span class="otag">${esc(o.tag)}</span>` : ''}<b>${esc(o.label)}</b><span class="sub">${esc(o.disabled ? o.reason : o.sub)}</span>` + (o.hold && !instant ? `<span class="hold">${this.touch ? 'Hold, or tap to start' : 'Hold, or tap to start'}</span>` : '') + `<div class="fill"></div><div class="k">${i + 1}</div>`;
        if (o.hold) {
          btn.dataset.hold = '1';
          btn.onpointerdown = (e) => { if (e.button > 0) return; e.preventDefault(); this.bendPress(btn, false); };
          btn.onpointerup = () => this.bendRelease(); btn.onpointercancel = () => this.bendRelease();
          btn.onpointerleave = () => { if (this.holding && !this.holding.auto && this.holding.down) this.holdCancel(); };
        }
        btn.onclick = () => { if (o.disabled) { this.nudge(btn, o.reason); return; } if (o.hold) return; this.waiter = null; this.G.audio.sfx('confirm'); resolve(o.key); };
        btn._resolve = () => { this.waiter = null; resolve(o.key); };
        box.appendChild(btn); return btn;
      });
      this.waiter = { type: 'barrier', buttons };
      this.announce((b.face ? b.face.name + ' is asking. ' : '') + b.title + '. ' + b.text + (b.notice ? ' ' + b.noticeLabel + ', you notice: ' + b.notice : '') + (b.gut ? ' Your gut: ' + b.gut : '') + ' Who adjusts? ' + b.options.map((o, i) => (i + 1) + '. ' + o.who + ': ' + o.label + (o.disabled ? ', not available: ' + o.reason : ', ' + o.sub)).join('. '));
    });
  }
  // Push through: hold it, or tap once and it fills by itself (tap again to stop). Holding is never required.
  bendPress(btn, fromKey) {
    if (this.holding) { if (this.holding.auto) this.holdCancel(); return; }
    const instant = FAST || this.set.holdToBend === false;
    const ms = instant ? 1 : 1100; const fill = btn.querySelector('.fill'); const t0 = now();
    this.holding = { btn, t0, auto: false, down: true, key: fromKey, raf: 0 };
    this.G.onHold(true); btn.classList.add('holding');
    const step = () => {
      const h = this.holding; if (!h) return;
      const k = Math.min(1, (now() - t0) / ms); fill.style.width = (k * 100) + '%';
      this.G.onHoldProgress(k);
      if (k >= 1) { this.holding = null; btn.classList.remove('holding'); this.G.onHold(false, true); this.G.audio.sfx('confirm'); btn._resolve(); return; }
      h.raf = requestAnimationFrame(step);
    };
    step();
  }
  bendRelease() {
    const h = this.holding; if (!h || !h.down) return; h.down = false;
    if (now() - h.t0 < 260) { h.auto = true; const s = h.btn.querySelector('.hold'); if (s) s.textContent = 'Tap again to stop'; }
    else this.holdCancel();
  }
  holdCancel() { const h = this.holding; if (!h) return; cancelAnimationFrame(h.raf); h.btn.querySelector('.fill').style.width = '0'; h.btn.classList.remove('holding'); const s = h.btn.querySelector('.hold'); if (s) s.textContent = 'Hold, or tap to start'; this.holding = null; this.G.onHold(false, false); }
  hideBarrier() { this.barrierEl.hidden = true; }
  // ---------- small things ----------
  toast(html, kind = '', ms = 3600) {
    const box = this.el('#toasts');
    if (!FAST && box.children.length >= 2) { (this.tq = this.tq || []).push([html, kind, ms]); if (this.tq.length > 6) this.tq.shift(); return; }
    const t = $(`<div class="toast ${kind}">${html}</div>`); box.appendChild(t); this.announce(html);
    const all = box.children; if (all.length > 4) all[0].remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); if (this.tq && this.tq.length) { const [h, k, m] = this.tq.shift(); this.toast(h, k, m); } }, 450); }, FAST ? 300 : ms);
  }
  caption(text, ms = 2600) {
    const c = this.el('#caption'); c.textContent = text; c.classList.add('on');
    return new Promise((r) => {
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(t1); this.capSkip = null; c.classList.remove('on'); setTimeout(r, FAST ? 20 : 450); };
      const t1 = setTimeout(finish, FAST || this.G.story.skipIntro ? 40 : ms);
      this.capSkip = finish;
    });
  }
  skipCaption() { if (this.capSkip) this.capSkip(); }
  letterbox(on) { this.el('#letterbox').classList.toggle('on', on); }
  hud(on) { this.el('#hud').hidden = !on; if (!on) { this.edge(null); this.act(null); } }
  updateHud(S, obj) {
    const h = this.el('#hud'); if (h.hidden) return;
    const day = this.G.story && this.G.story.ret ? this.G.story.ret.dayName() : DAYNAME[S.day] || 'Day ' + S.day;
    h.querySelector('.when').textContent = day + ' · ' + fmtTime(S.min);
    const text = obj ? obj.t || '' : '';
    if (this._obj !== text) { this._obj = text; h.querySelector('.obj').textContent = text; }
    const here = obj && obj.inside && obj.inside === this.G.loc; // inside the place the objective names: show the way to its spot, if it has one
    this.el('#wayBtn').hidden = !(obj && (here ? obj.spot : obj.at)) || this.G.mode !== 'play' || !!this.G.busy || !!this.waiter || this.G.mgActive;
    h.querySelector('.dial').style.setProperty('--sun', Math.round(clamp((S.min - 420) / 900) * 100) + '%');
    const e = S.energy / 100; const bar = h.querySelector('.bar'); bar.style.strokeDashoffset = String(88 * (1 - e));
    h.querySelector('.energy').classList.toggle('low', e < 0.3);
    // gear you own becomes a button you can press (on phones there are no H and J keys)
    const smoothOk = S.blend.has && !S.blend.deleted;
    const lan = !!S.flags.lantern, up = !!(this.G.look && this.G.look.raised);
    const gk = [S.gear.headphones, S.wearing.headphones, S.gear.shades, S.wearing.shades, smoothOk, S.blend.smooth, lan, up, JSON.stringify(this.set.keys)].join();
    if (gk !== this.gearKey) {
      this.gearKey = gk;
      const b = (g, on, label, ic) => `<button class="gb ${on ? 'on' : ''} ${g === 'smooth' ? 'sm' : ''}" data-g="${g}" aria-pressed="${on}" title="${label}${this.touch ? '' : ' (' + this.G.keyOf(g) + ')'}">${ic}<span>${label}</span></button>`;
      h.querySelector('.gearbtns').innerHTML = (lan ? b('look', up, 'Lantern', ICON.lantern) : '') + (S.gear.headphones ? b('headphones', S.wearing.headphones, 'Headphones', ICON.gear) : '') + (S.gear.shades ? b('shades', S.wearing.shades, 'Shades', ICON.shades) : '') + (smoothOk ? b('smooth', S.blend.smooth, 'Smooth Mode', ICON.smooth) : '');
      const kp = h.querySelector('.kphone'); if (kp) kp.textContent = this.G.keyOf('phone');
    }
  }
  ping(on) { this.el('#phoneBtn').classList.toggle('ping', on); }
  // the pinch strip: how this place fits you, in words (feel.js decides what it says and when it is read out)
  pinchStrip(c) {
    const el = this.el('#hud .pstrip'); if (!el) return;
    if (!c) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = c.items.map(([ic, w, cls]) => `<span class="pchip ${cls}"><i aria-hidden="true">${ic}</i>${esc(w)}</span>`).join('') + c.tags.map((t) => `<span class="ptag">${esc(t)}</span>`).join('');
  }
  prompt(label, x, y) {
    const p = this.el('#prompt'); if (!label) { p.hidden = true; this._pl = null; return; }
    p.hidden = false; if (this._pl !== label) { this._pl = label; p.innerHTML = (this.touch ? '' : '<kbd>' + esc(this.G.keyOf('interact')) + '</kbd>') + esc(label); this._pw = p.offsetWidth; this._ph = p.offsetHeight; }
    // keep the whole label on screen when what it points at is near an edge
    const hw = (this._pw || 0) / 2 + 8; x = clamp(x, hw, Math.max(hw, innerWidth - hw)); y = clamp(y, (this._ph || 0) + 8, innerHeight - 8);
    p.style.left = x + 'px'; p.style.top = y + 'px';
  }
  // the big contextual button for touch screens
  act(label) { const a = this.el('#actbtn'); if (!label || !this.touch) { a.hidden = true; return; } a.hidden = false; if (a.textContent !== label) a.textContent = label; }
  // speech bubbles over heads, for things said in passing
  bubble(key, text, o = {}) {
    let b = this.bubblesMap[key];
    if (!b) { b = $('<div class="bubble"><div class="bt"></div></div>'); this.el('#bubbles').appendChild(b); this.bubblesMap[key] = b; }
    b.querySelector('.bt').textContent = text; b.style.setProperty('--tint', o.tint || '#3a3340'); b.classList.add('on');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), FAST ? 300 : o.ms || clamp(text.length * 75, 2600, 6000));
  }
  clearBubbles() { for (const k in this.bubblesMap) this.bubblesMap[k].classList.remove('on'); }
  placeBubbles(anchor) {
    for (const k in this.bubblesMap) {
      const b = this.bubblesMap[k]; if (!b.classList.contains('on')) continue;
      const p = anchor(k); if (!p) { b.style.visibility = 'hidden'; continue; }
      b.style.visibility = ''; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    }
  }
  // the arrow at the screen edge that points at where you are going
  edge(info) {
    const e = this.el('#edge'); if (!info) { e.hidden = true; return; }
    e.hidden = false;
    e.querySelector('.arr').style.transform = `rotate(${info.ang}rad)`;
    const t = info.label + ' · ' + info.dist + ' m'; const s = e.querySelector('span'); if (s.textContent !== t) { s.textContent = t; this._ew = e.offsetWidth; }
    // the label is wider than the arrow: slide the pair in so the words stay on screen
    const hw = (this._ew || 0) / 2 + 8; e.style.left = clamp(info.x, hw, Math.max(hw, innerWidth - hw)) + 'px'; e.style.top = info.y + 'px';
  }
  // ---------- panels ----------
  openPanel(cls, html) { const p = this.panel; p.style.cssText = ''; p.className = 'panel ' + cls; p.innerHTML = html; p.hidden = false; return p; }
  closePanel() { this.panel.hidden = true; this.panel.innerHTML = ''; }
  // the title screen: resolves with { kind: 'new' } or { kind: 'continue', save } or { kind: 'code', save | carry }
  title(o = {}) {
    const save = o.save; const ret = o.ret;
    const back = ret ? `<button class="btn ${save ? '' : 'accent'}" id="tRet">Return to Larkspur<small>${esc(ret.label)}</small></button>` : '';
    const main = save
      ? `<button class="btn accent" id="tCont">Continue<small>${esc(save.label || '')}</small></button>${back}<button class="btn" id="tNew">New game</button>`
      : ret ? `${back}<button class="btn" id="tNew">New game</button>` : '<button class="btn accent" id="tNew">Begin</button>';
    const banner = o.storage && o.storage !== 'ok' ? '<div class="tbanner" role="status">This browser isn\'t keeping saves here (a private window, or storage is blocked). You can still copy a save code from the Menu at any point, and paste it here next time.</div>' : '';
    const p = this.openPanel('title', `<h1>Made to Fit</h1><div class="sub">a town built for someone else</div>${banner}<div class="row">${main}<button class="btn" id="tSet">Settings</button></div>
      <div class="fine">The first day takes about fifteen minutes; two more days and two short return visits follow if you like. Best with sound. Your game saves on this device as you play: no account, no tracking, nothing to buy. Nothing flashes more than three times a second.<div class="links"><button class="linkbtn" id="tIng">What keeps you playing</button><button class="linkbtn" id="tIn">What's in this game</button><button class="linkbtn" id="tPb">Played before?</button></div></div>`);
    const M = this.G.menus;
    p.querySelector('#tSet').onclick = () => M.settings();
    p.querySelector('#tIng').onclick = () => M.ingredients();
    p.querySelector('#tIn').onclick = () => M.contentNotes();
    return new Promise((resolve) => {
      const done = (v) => { this.closePanel(); resolve(v); };
      p.querySelector('#tNew').onclick = async () => { if (save && !(await M.confirm('Start a new game?', 'This replaces your saved visit. Finished visits stay.', 'Start over', 'Keep my save'))) return; done({ kind: 'new' }); };
      const c = p.querySelector('#tCont'); if (c) c.onclick = () => done({ kind: 'continue', save });
      const rb = p.querySelector('#tRet'); if (rb) rb.onclick = () => done({ kind: 'return', act: ret.act });
      p.querySelector('#tPb').onclick = async () => { const r = await M.playedBefore(); if (r && r.recap) done({ kind: 'recap' }); else if (r) done(Object.assign({ kind: 'code' }, r)); };
      setTimeout(() => { const b = p.querySelector('#tCont') || p.querySelector('#tRet') || p.querySelector('#tNew'); if (b && !this.touch) b.focus(); }, 50);
    });
  }
  creator(look, onChange) {
    const S = this.G.S; const L = Object.assign({}, look);
    const sec = (title, key, opts, cur) => `<h3 class="sec">${title}</h3><div class="chips" data-k="${key}" role="group" aria-label="${esc(title)}">` + opts.map(([v, n]) => `<button class="chip ${v === cur ? 'on' : ''}" data-v="${v}" aria-pressed="${v === cur}">${esc(n)}</button>`).join('') + '</div>';
    const html = `<h2>This is you.</h2><p class="lede">Nobody else in Larkspur looks quite like this. That is the point.</p>
      <div class="two"><div><h3 class="sec"><label for="cname">Name</label></h3><input type="text" id="cname" maxlength="14" value="${esc(S.name)}" autocomplete="off"></div><div><h3 class="sec">Pronouns</h3><div class="chips" data-k="pronoun" role="group" aria-label="Pronouns">${['they', 'she', 'he'].map((v) => `<button class="chip ${v === S.pronoun ? 'on' : ''}" data-v="${v}" aria-pressed="${v === S.pronoun}">${v}</button>`).join('')}</div></div></div>
      ${sec('Shape', 'shape', OPTIONS.shape, L.shape)}
      <h3 class="sec">Color</h3><div class="chips" data-k="color" role="group" aria-label="Color">${OPTIONS.color.map((c) => `<button class="swatch ${c === L.color ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="${esc(COLOR_NAMES[c] || 'Color')}" aria-pressed="${c === L.color}"></button>`).join('')}</div>
      ${sec('Pattern', 'pattern', OPTIONS.pattern, L.pattern)}${sec('On top', 'top', OPTIONS.top, L.top)}${sec('Something you always wear', 'wear', OPTIONS.wear, L.wear)}${sec('Your voice', 'voice', OPTIONS.voice, L.voice)}
      ${sec('Getting around', 'wheels', [['feet', 'On foot'], ['wheels', 'On wheels']], L.wheels ? 'wheels' : 'feet')}
      ${sec('Your comfort move', 'comfort', COMFORT_OPTS, L.comfort || 'hum')}<p class="small">What your creature does when a place fits it.</p>
      <div class="row"><button class="btn" id="rand">Surprise me</button><button class="btn primary" id="done" style="flex:1">That's me</button></div>`;
    const p = this.openPanel('creator', html);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return; const k = b.parentElement.dataset.k; const v = b.dataset.v;
      b.parentElement.querySelectorAll('[data-v]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      if (k === 'pronoun') S.pronoun = v; else if (k === 'wheels') L.wheels = v === 'wheels'; else L[k] = v;
      this.G.audio.sfx('select'); onChange(L, k);
    });
    p.querySelector('#rand').onclick = () => {
      const pk = (a) => a[Math.floor(Math.random() * a.length)];
      L.shape = pk(OPTIONS.shape)[0]; L.color = pk(OPTIONS.color); L.pattern = pk(OPTIONS.pattern)[0]; L.top = pk(OPTIONS.top)[0]; L.wear = pk(OPTIONS.wear)[0]; L.voice = pk(OPTIONS.voice)[0]; L.comfort = pk(COMFORT_OPTS)[0];
      p.querySelectorAll('.chips').forEach((c) => { const k = c.dataset.k; const cur = k === 'wheels' ? (L.wheels ? 'wheels' : 'feet') : k === 'pronoun' ? S.pronoun : L[k]; c.querySelectorAll('[data-v]').forEach((x) => { x.classList.toggle('on', x.dataset.v === cur); x.setAttribute('aria-pressed', String(x.dataset.v === cur)); }); });
      this.G.audio.sfx('whoosh'); onChange(L, 'all');
    };
    return new Promise((r) => { p.querySelector('#done').onclick = () => { S.name = (p.querySelector('#cname').value || 'Sam').trim().slice(0, 14) || 'Sam'; this.closePanel(); this.G.audio.sfx('good'); r(L); }; });
  }
  // one object in your room: resolves with the chosen value, or { back: true }
  setupStep(key, value, idx, total, onChange) {
    const spec = SETUP[key];
    const steps = [0.1, 0.3, 0.5, 0.7, 0.9]; if (spec.invert) value = 1 - value; let cur = steps.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
    const p = this.openPanel('setup', `<div class="q">${esc(spec.q)}</div><div class="scale">${steps.map((v, i) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}" aria-label="${i + 1} of 5"><span class="dot" style="width:${7 + i * 4}px;height:${7 + i * 4}px"></span></button>`).join('')}</div><div class="ends"><span>${esc(spec.lo)}</span><span>${esc(spec.hi)}</span></div><div class="foot"><div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div><div class="fbtns">${idx > 0 ? '<button class="btn" id="back">Back</button>' : ''}<button class="btn primary" id="next">${idx === total - 1 ? 'Done' : 'Next'}</button></div></div>`);
    p.querySelectorAll('.scale button').forEach((b) => { b.onclick = () => { cur = +b.dataset.v; p.querySelectorAll('.scale button').forEach((x) => x.classList.toggle('on', x === b)); this.G.audio.sfx('select'); onChange(cur); }; });
    onChange(cur);
    return new Promise((r) => {
      const kh = (e) => { const k = keyName(e); if (/^[1-5]$/.test(k)) p.querySelectorAll('.scale button')[+k - 1].click(); if (k === 'Enter') { e.preventDefault(); finish(cur); } };
      const finish = (v) => { window.removeEventListener('keydown', kh); this.closePanel(); r(v); };
      window.addEventListener('keydown', kh);
      p.querySelector('#next').onclick = () => finish(cur);
      const bk = p.querySelector('#back'); if (bk) bk.onclick = () => { this.G.audio.sfx('back'); finish({ back: true }); };
    });
  }
  // the recap's room: all six dials in one panel. values and the result are dial positions (before any invert)
  roomDials(values, onChange) {
    const keys = Object.keys(SETUP); const steps = [0.1, 0.3, 0.5, 0.7, 0.9];
    const near = (v) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const cur = {}; for (const k of keys) cur[k] = near(values[k] != null ? values[k] : 0.5);
    const row = (k) => { const sp = SETUP[k]; return `<div class="dial"><div class="dq" id="dq_${k}">${esc(sp.q)}</div><div class="scale" role="radiogroup" aria-labelledby="dq_${k}" data-k="${k}">${steps.map((v, i) => `<button role="radio" aria-checked="${v === cur[k]}" data-v="${v}" class="${v === cur[k] ? 'on' : ''}" aria-label="${i + 1} of 5${i === 0 ? ', ' + esc(sp.lo) : i === 4 ? ', ' + esc(sp.hi) : ''}"><span class="dot" style="width:${7 + i * 4}px;height:${7 + i * 4}px"></span></button>`).join('')}</div><div class="ends"><span>${esc(sp.lo)}</span><span>${esc(sp.hi)}</span></div></div>`; };
    const p = this.openPanel('center recap', `<h2>Your room</h2><p class="lede">Set it the way you like it. The town will remember.</p>${keys.map(row).join('')}<div class="pfoot sticky"><button class="btn primary" id="rdone">That's my room</button></div>`);
    for (const k of keys) onChange(k, cur[k]);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('.scale button'); if (!b) return; const k = b.parentElement.dataset.k; cur[k] = +b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      this.G.audio.sfx('select'); onChange(k, cur[k]);
    });
    setTimeout(() => { const f = p.querySelector('.scale button.on'); if (f && !this.touch) f.focus({ preventScroll: true }); }, 50);
    return new Promise((r) => { p.querySelector('#rdone').onclick = () => { this.closePanel(); this.G.audio.sfx('good'); r(Object.assign({}, cur)); }; });
  }
  // the recap's six things about the first visit, or "Choose for me" (which fills them in, to look over and change)
  recapChoices(o) {
    let v = { built: [], listened: {}, people: [], rue: 'streak', blend: 'never', left: 'yourself', dflt: 'as_is' }; let note = { k: '', t: '' };
    const chip = (attr, on, t, extra = '') => `<button class="chip ${on ? 'on' : ''}" ${attr} aria-pressed="${on}" ${extra}>${esc(t)}</button>`;
    const one = (key, list) => `<div class="chips" role="group">${list.map(([id, t]) => chip(`data-one="${key}" data-v="${id}"`, v[key] === id, t)).join('')}</div>`;
    const msg = (k) => (note.k === k ? `<p class="small rnote" role="status">${esc(note.t)}</p>` : '');
    const html = () => `<h2>That first week</h2><p class="lede">Six things Larkspur remembers about you. Pick what feels right, or let the game choose.</p>
      <h3 class="sec" id="rq1">What got built (two at most)</h3><div class="chips" role="group" aria-labelledby="rq1">${o.fixes.map((f) => chip(`data-fix="${f.id}"`, v.built.includes(f.id), f.t)).join('')}</div>${msg('fix')}
      ${v.built.map((id) => { const f = o.fixes.find((x) => x.id === id); return `<div class="rsub"><span>${esc(f.t)}:</span>${chip(`data-listen="${id}"`, !!v.listened[id], 'You listened to ' + f.stake)}</div>`; }).join('')}
      <h3 class="sec" id="rq2">Who knew you (up to four)</h3><div class="chips" role="group" aria-labelledby="rq2">${o.people.map((x) => chip(`data-person="${x.id}"`, v.people.includes(x.id), x.t)).join('')}</div>${msg('person')}
      <h3 class="sec">Rue, at the festival</h3>${one('rue', [['streak', 'Still on her streak'], ['easing', 'Easing off it']])}
      <h3 class="sec">Blend, the app</h3>${one('blend', [['never', 'Never installed it'], ['kept', 'Kept it'], ['deleted', 'Deleted it']])}
      <h3 class="sec">How you left</h3>${one('left', [['yourself', 'Looking like yourself'], ['faded', 'A little faded']])}
      <h3 class="sec">One thing you'd set differently next time</h3>${one('dflt', o.defaults.filter((d) => d.id !== 'blend_off' || v.blend === 'kept').map((d) => [d.id, d.t]))}
      <div class="pfoot sticky"><button class="btn" id="rrand">Choose for me</button><button class="btn primary" id="rgo">Ten years later</button></div>`;
    const p = this.openPanel('center recap', html());
    const redraw = (sel) => { const top = p.scrollTop; p.innerHTML = html(); p.scrollTop = top; const f = sel && p.querySelector(sel); if (f) f.focus({ preventScroll: true }); };
    return new Promise((r) => {
      p.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return; const d = b.dataset; note = { k: '', t: '' };
        if (b.id === 'rgo') { this.closePanel(); this.G.audio.sfx('good'); r(v); return; }
        if (b.id === 'rrand') { v = o.random(); this.G.audio.sfx('page'); this.announce('Chosen for you. Look it over, or change anything.'); redraw('#rgo'); return; }
        if (d.fix) { const i = v.built.indexOf(d.fix); if (i >= 0) { v.built.splice(i, 1); delete v.listened[d.fix]; } else if (v.built.length >= 2) { note = { k: 'fix', t: 'Two at most: tap one of yours to let it go.' }; this.announce(note.t); } else v.built.push(d.fix); this.G.audio.sfx('select'); redraw('[data-fix="' + d.fix + '"]'); return; }
        if (d.listen) { v.listened[d.listen] = !v.listened[d.listen]; this.G.audio.sfx('select'); redraw('[data-listen="' + d.listen + '"]'); return; }
        if (d.person) { const i = v.people.indexOf(d.person); if (i >= 0) v.people.splice(i, 1); else if (v.people.length >= 4) { note = { k: 'person', t: 'Four at most: tap one to let them go.' }; this.announce(note.t); } else v.people.push(d.person); this.G.audio.sfx('select'); redraw('[data-person="' + d.person + '"]'); return; }
        if (d.one) { v[d.one] = d.v; if (v.blend !== 'kept' && v.dflt === 'blend_off') v.dflt = 'as_is'; this.G.audio.sfx('select'); redraw('[data-one="' + d.one + '"][data-v="' + d.v + '"]'); }
      });
      setTimeout(() => { const f = p.querySelector('[data-fix]'); if (f && !this.touch) f.focus({ preventScroll: true }); }, 50);
    });
  }
  // Moss's cart: gear under the counter, and pond cards on the shelf (sealed packs, and a binder of singles)
  shop(S) {
    const G = this.G; const items = [['headphones', 'Headphones', 18, 'Muffles a loud room, or fills a quiet one with your music.'], ['shades', 'Shades', 12, 'Takes the edge off glare.']];
    const summary = this.set.packs === 'summary';
    let view = 'shop', result = '', resAt = '', more = 2;
    const res = (at) => (result && resAt === at ? `<div class="packres" role="status">${result}</div>` : '');
    const coinsBtn = (attr, price, label) => `<button class="btn" ${attr} ${S.coins < price ? 'aria-disabled="true"' : ''}>${S.coins < price ? 'Not enough coins yet' : label}</button>`;
    const tile = (f) => cardTile(f);
    const shopHtml = () => `<h2>Moss's cart</h2><p class="lede">You have ${S.coins} coins.</p>
      <h3 class="sec sh4">Under the counter</h3><div class="list">${items.map(([k, n, c, d]) => `<div class="card"><b>${n}</b> ${S.gear[k] ? '<span class="pill built">yours</span>' : `<span class="pill">${c} coins</span>`}<div class="meta">${d}</div>${S.gear[k] ? '' : `<div style="margin-top:8px">${coinsBtn(`data-buy="${k}"`, c, 'Buy')}</div>`}</div>`).join('')}</div>
      <h3 class="sec sh4">On the shelf: pond cards</h3><div class="list">
        <div class="card"><b>Sealed pack</b> <span class="pill">${PACK_PRICE} coins</span><div class="meta">Three cards at random. Every fish is equally likely.</div><div style="margin-top:8px">${coinsBtn('data-pack="1"', PACK_PRICE, 'Buy a pack')}</div>${res('pack')}</div>
        ${S.flags.packOpened ? `<div class="card"><b>Buy more packs</b><div class="meta">Open several at once. You'll get a summary.</div><div class="stepper" role="group" aria-label="How many packs"><button class="mini-btn" data-more="-1" aria-label="One fewer">−</button><span aria-live="polite">${more}</span><button class="mini-btn" data-more="1" aria-label="One more">+</button><span class="small">${more * PACK_PRICE} coins</span></div><div style="margin-top:8px">${coinsBtn('data-packs="1"', more * PACK_PRICE, 'Buy ' + more)}</div>${res('more')}</div>` : ''}
        <div class="card"><b>Singles binder</b> <span class="pill">${SINGLE_PRICE} coins a card</span><div class="meta">Pick any card. Every fish is in here, the golden one too.</div><div style="margin-top:8px"><button class="btn" data-binder="1">Open the binder</button></div></div>
      </div><p class="small">Cards count toward nothing. They are just cards.</p>
      <div class="pfoot"><button class="btn primary" id="done">Done</button></div>`;
    const binderHtml = () => `<h2>The singles binder</h2><p class="lede">${SINGLE_PRICE} coins a card. You have ${S.coins} coins.</p>${res('binder')}<div class="binder">${FISH.map((f) => `<div class="bslot">${cardTile(f)}${(S.cards || {})[f.id] ? '<span class="pill built">yours</span>' : coinsBtn(`data-single="${f.id}"`, SINGLE_PRICE, 'Buy')}</div>`).join('')}</div><div class="pfoot"><button class="btn" id="bback">Back to the cart</button></div>`;
    const render = () => (view === 'binder' ? binderHtml() : shopHtml());
    const p = this.openPanel('center', render());
    const redraw = (focus) => { p.innerHTML = render(); const f = focus && p.querySelector(focus); if (f) f.focus({ preventScroll: true }); const r = p.querySelector('.packres'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); };
    const firstCards = () => { if (!S.flags.packOpened) { S.flags.packOpened = 1; } G.story.fieldNote('packs'); };
    return new Promise((r) => {
      p.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'done') { this.closePanel(); r(); return; }
        if (b.id === 'bback') { view = 'shop'; result = ''; redraw('[data-binder]'); return; }
        if (b.dataset.binder) { view = 'binder'; result = ''; G.audio.sfx('page'); redraw('.bslot button'); return; }
        if (b.dataset.more) { more = clamp(more + +b.dataset.more, 1, MORE_MAX); G.audio.sfx('select'); redraw('[data-more="' + b.dataset.more + '"]'); return; }
        if (b.dataset.buy) { const it = items.find((x) => x[0] === b.dataset.buy); if (S.coins >= it[2]) { S.coins -= it[2]; S.gear[it[0]] = true; G.audio.sfx('coin'); G.onGear(it[0]); redraw(); } else this.nudge(b, 'A shift at the Works pays 30 coins.'); return; }
        if (b.dataset.pack) {
          if (S.coins < PACK_PRICE) { this.nudge(b, 'A shift at the Works pays 30 coins.'); return; }
          S.coins -= PACK_PRICE; const cards = drawPack(); const had = addCards(S, cards); firstCards(); G.audio.sfx('select');
          resAt = 'pack'; result = summary ? esc(packSentence(cards, had)) : `<div class="pack3">${cards.map(tile).join('')}</div><p>${esc(packLine(had))}</p>`;
          this.announce(packSentence(cards, had)); redraw('[data-pack]'); return;
        }
        if (b.dataset.packs) {
          const cost = more * PACK_PRICE; if (S.coins < cost) { this.nudge(b, 'Not enough coins for ' + more + '.'); return; }
          S.coins -= cost; const cards = []; for (let i = 0; i < more; i++) cards.push(...drawPack()); const had = addCards(S, cards); firstCards(); G.audio.sfx('select');
          resAt = 'more'; result = esc(moreSentence(more, cards, had)); this.announce(result); redraw('[data-packs]'); return;
        }
        if (b.dataset.single) {
          const f = FISH.find((x) => x.id === b.dataset.single); if (!f) return;
          if (S.coins < SINGLE_PRICE) { this.nudge(b, 'A shift at the Works pays 30 coins.'); return; }
          S.coins -= SINGLE_PRICE; addCards(S, [f]); firstCards(); G.audio.sfx('select');
          resAt = 'binder'; result = esc('The ' + cardName(f).toLowerCase() + ' card is yours. ' + SINGLE_PRICE + ' coins, and you knew what you were getting.'); this.announce(result); redraw('#bback'); return;
        }
      });
    });
  }
  fold() {
    const p = this.openPanel('center', `<h2>Fold along the line</h2><p class="lede" id="fl">The line is the line, not near the line. Tap the paper, or press Space, when the crease reaches the dashes.</p><div class="fold" role="button" tabindex="0" aria-label="Fold now"><div class="line"></div><div class="crease"></div></div><div class="pfoot"><button class="btn primary" id="go">Fold</button></div>`);
    const cr = p.querySelector('.crease'); let x = 10, dir = 1; const sp = this.set.pace === 'calm' ? 0.7 : 1.6;
    const iv = setInterval(() => { x += dir * sp; if (x > 94 || x < 6) dir *= -1; cr.style.left = x + '%'; }, 16);
    return new Promise((r) => {
      let folded = false;
      const kh = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!folded) go(); else end(); } };
      const end = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(this._fgood); };
      const go = () => {
        if (folded) return; folded = true; clearInterval(iv); const good = Math.abs(x - 62) < (this.set.pace === 'calm' ? 11 : 7) || FAST; this._fgood = good;
        p.querySelector('.fold').classList.add(good ? 'good' : 'near');
        p.querySelector('#fl').textContent = good ? 'A clean fold. Wren nods once, which from Wren is applause.' : 'Close. Wren refolds it without comment, which is also a kind of comment.';
        this.G.audio.sfx(good ? 'good' : 'page'); const b = p.querySelector('#go'); b.textContent = 'Done'; b.onclick = end;
      };
      p.querySelector('#go').onclick = go; p.querySelector('.fold').onclick = () => (folded ? null : go());
      window.addEventListener('keydown', kh);
    });
  }
  proposals(S) {
    const stakes = S.stakes || {};
    const rows = Object.keys(FIXES).filter((k) => !['none', 'tabled'].includes(fixState(S, k)) || fixState(S, k) === 'tabled').filter((k) => fixState(S, k) !== 'none').map((k) => {
      const F = FIXES[k]; const st = fixState(S, k); const n = supporters(S, k); const who = F.backers.map((b) => CAST[b].name + ((S.support[k] || []).includes(b) ? ' ✓' : '')).join(', ');
      const label = { idea: 'idea: take it to Clover', proposal: n + ' of 2 backers', ready: F.approve === 'gil' ? 'ready for Gil or the meeting' : 'ready for the town meeting', approved: 'approved', built: 'built', tabled: 'not this time', onfile: 'on file for next season' }[st] || st;
      const T = STAKES[k]; const sk = stakes[k];
      const loss = !T || st === 'idea' ? '' : sk === 'listened' ? `${esc(T.lessLoss)} The change: ${esc(T.variantName)}. ${esc(T.cost)}` : sk === 'overruled' ? `Who loses: ${esc(T.loses)} You kept the design as it was.` : `Who loses: ${esc(T.loses)} ${esc(CAST[T.who].name)} hasn't had a say yet.`;
      return `<div class="card"><b>${esc(F.name)}</b> <span class="pill ${st}">${label}</span><div class="meta">${esc(F.what)}</div>${st === 'proposal' ? `<div class="meta">Ask: ${esc(who)}</div>` : ''}${F.also ? `<div class="meta also">Also helps: ${esc(F.also)}</div>` : ''}${loss ? `<div class="meta loses">${loss}</div>` : ''}<div class="meta" style="font-style:italic">Design principle: ${esc(F.principle)}</div></div>`;
    }).join('');
    const cap = `<p class="small">${esc(capText(S))} A town can only build so much in a season.</p>`;
    return rows ? cap + rows : '<p class="lede">Nothing yet. When a place pinches, note it, or listen to people who mention what pinches them.</p>';
  }
  // ---------- phone ----------
  openPhone() { this.phoneEl.hidden = false; this.renderPhone(); this.G.audio.sfx('phone'); }
  closePhone() { this.phoneEl.hidden = true; this.G.audio.sfx('back'); }
  phoneTabs() {
    const S = this.G.S; const tabs = [['today', 'Today', '☰'], ['map', 'Map', '◉'], ['notebook', 'Notebook', '✎'], ['fix', 'Fix-It', '⚒'], ['texts', 'Texts', '✉']];
    if (S.blend.has && !S.blend.deleted) tabs.splice(1, 0, ['blend', 'Blend', 'b']);
    // the first visit's new way of playing keeps what you gather in a Fit Book (and the hooks, named)
    if (S.v2 && (S.act || 1) === 1) tabs.splice(1, 0, ['fitbook', 'Fit Book', '✦']);
    return tabs;
  }
  renderPhone() {
    const G = this.G, S = G.S; const tabs = this.phoneTabs();
    if (!tabs.find((t) => t[0] === this.phoneTab)) this.phoneTab = 'today';
    const body = this['tab_' + this.phoneTab](S);
    this.phoneEl.innerHTML = `<div class="screen"><div class="status"><span class="st-time">${fmtTime(S.min)}</span><span>${esc(S.name)}</span><span class="st-e">${Math.round(S.energy)}%</span></div><div class="body">${body}</div><div class="tabs">${tabs.map(([k, n, i]) => `<button data-tab="${k}" class="${k === this.phoneTab ? 'on' : ''} ${k === 'blend' ? 'blendtab' : ''}"><span class="ico">${i}</span>${n}</button>`).join('')}</div></div><button class="close" id="pclose" aria-label="Close phone">✕</button>`;
    this.phoneEl.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.phoneTab = b.dataset.tab; this.G.audio.sfx('select'); this.renderPhone(); }; });
    this.phoneEl.querySelector('#pclose').onclick = () => this.G.togglePhone(true);
    const on = (id, fn) => { const el = this.phoneEl.querySelector(id); if (el) el.onclick = fn; };
    on('#smooth', () => { G.setSmooth(!S.blend.smooth); this.renderPhone(); });
    on('#drop', () => { G.blendDrop(); this.renderPhone(); });
    on('#blook', () => { const t = this.phoneEl.querySelector('#blookt'); const b = this.phoneEl.querySelector('#blook'); if (t) { t.hidden = false; this.announce('Look again. ' + t.textContent); } if (b) b.hidden = true; G.audio.sfx('lantern'); });
    const del = this.phoneEl.querySelector('#del'); if (del) del.onclick = () => { if (del.dataset.sure) { G.deleteBlend(); this.renderPhone(); } else { del.dataset.sure = '1'; del.textContent = 'Yes, delete it'; this.phoneEl.querySelector('#delwarn').hidden = false; } };
    this.phoneEl.querySelectorAll('[data-sub]').forEach((b) => { b.onclick = () => { this.lanSub = b.dataset.sub; this.personOpen = null; this.G.audio.sfx('select'); this.renderPhone(); }; });
    this.phoneEl.querySelectorAll('[data-person]').forEach((b) => { b.onclick = () => { this.personOpen = b.dataset.person; this.G.audio.sfx('page'); this.renderPhone(); }; });
    on('#pback', () => { this.personOpen = null; this.renderPhone(); });
    { const kt = this.phoneEl.querySelector('#keeptr'); if (kt) kt.onchange = () => { S.lantern.off = S.lantern.off || {}; if (kt.checked) delete S.lantern.off[kt.dataset.who]; else S.lantern.off[kt.dataset.who] = 1; }; }
    on('#pway', () => { this.G.togglePhone(true); this.G.showWay(); });
    this.phoneEl.querySelectorAll('[data-fb]').forEach((b) => { b.onclick = () => { this.fbSub = b.dataset.fb; this.G.audio.sfx('select'); this.renderPhone(); }; });
    this.phoneEl.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => { const g = b.dataset.g; if (g === 'smooth') G.setSmooth(!S.blend.smooth); else G.toggleGear(g); this.gearKey = ''; this.renderPhone(); }; });
    if (this.phoneTab === 'blend' && G.feed) G.feed.mount(this.phoneEl.querySelector('.feedmount'));
  }
  // live parts of the phone update in place, so buttons are never replaced under a finger
  refreshPhone() {
    if (this.phoneEl.hidden) return; const S = this.G.S;
    const t = this.phoneEl.querySelector('.st-time'); if (t) t.textContent = fmtTime(S.min);
    const e = this.phoneEl.querySelector('.st-e'); if (e) e.textContent = Math.round(S.energy) + '%';
    if (this.phoneTab === 'map') { const svg = this.phoneEl.querySelector('svg.map'); if (svg) svg.innerHTML = this.mapSvg(S); }
    if (this.phoneTab === 'today') { const g = this.phoneEl.querySelector('.goals'); if (g) g.innerHTML = this.goalsHtml(); }
  }
  goalsHtml() { return this.G.goals().map((g) => `<div class="goal ${g.done ? 'done' : ''}"><i></i><div>${esc(g.t)}</div></div>`).join(''); }
  tab_today(S) {
    const obj = this.G.story.objective();
    const gear = (S.gear.headphones || S.gear.shades) ? `<h4 class="ph4">Your gear</h4><div class="gearrow">${S.gear.headphones ? `<button class="btn gbig ${S.wearing.headphones ? 'on' : ''}" data-g="headphones">${ICON.gear} ${S.wearing.headphones ? 'Take off' : 'Put on'} headphones</button>` : ''}${S.gear.shades ? `<button class="btn gbig ${S.wearing.shades ? 'on' : ''}" data-g="shades">${ICON.shades} ${S.wearing.shades ? 'Take off' : 'Put on'} shades</button>` : ''}</div>` : '';
    return `<h3>${this.G.story && this.G.story.ret ? this.G.story.ret.dayName() : DAYNAME[S.day] || 'Today'}</h3>${obj && obj.t ? `<div class="nowcard"><div class="nl">Now</div><div>${esc(obj.t)}</div>${obj.at ? `<button class="btn primary" id="pway">${ICON.way} Show me the way</button>` : ''}</div>` : ''}<div class="goals">${this.goalsHtml()}</div>${gear}<p class="small">Energy ${Math.round(S.energy)} of ${S.maxE} today. ${S.coins} coins.${S.burnout ? ' You woke up running on less.' : ''}</p>`;
  }
  // the town as you feel it right now: each place coloured by how it fits you, the roads, your way, and who is out.
  // Place names sit at the top of each block, and residents' names step aside when they would overlap.
  mapSvg(S) {
    const col = (v) => (v < 0.12 ? '#9fd3b0' : v < 0.3 ? '#f6cf5b' : '#f2a99a');
    // (labels get a halo in the paper colour, so a road or a neighbour's dot under them never cuts a letter)
    const label = (x, y, t, size, mid) => `<text x="${x}" y="${y}"${mid ? ' text-anchor="middle"' : ''} font-size="${size}" fill="#2b2530" stroke="#fbf6ee" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${esc(t)}</text>`;
    const zs = ZONES.map((z) => { const r = z.rect; const v = pinch(S, z.id, S.min).total; return `<rect x="${r[0] * 5}" y="${r[1] * 5}" width="${(r[2] - r[0]) * 5 - 3}" height="${(r[3] - r[1]) * 5 - 3}" rx="10" fill="${col(v)}" opacity="0.92"/>`; }).join('');
    const zl = ZONES.map((z) => { const r = z.rect; return label((r[0] + r[2]) * 2.5, r[1] * 5 + 15, z.name, 11, true); }).join('');
    const roads = this.G.town.mapRoads ? this.G.town.mapRoads().map(([x0, z0, x1, z1]) => `<line x1="${x0 * 5}" y1="${z0 * 5}" x2="${x1 * 5}" y2="${z1 * 5}" stroke="#fbf6ee" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`).join('') : '';
    const route = this.G.routeSvg ? this.G.routeSvg() : '';
    // names go where they cover no other name and no one's dot: beside, above or below their own dot
    const placed = ZONES.map((z) => { const r = z.rect; const w = z.name.length * 5.6; const cx = (r[0] + r[2]) * 2.5; return [cx - w / 2, r[1] * 5 + 5, cx + w / 2, r[1] * 5 + 17]; });
    const dots = this.G.npcDots().slice().sort((a, b) => a.z - b.z);
    const me = this.G.playerDot();
    for (const d of dots.concat(me ? [me] : [])) placed.push([d.x * 5 - 6.5, d.z * 5 - 6.5, d.x * 5 + 6.5, d.z * 5 + 6.5]);
    const hits = (b) => placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
    const ppl = dots.map((d) => {
      const x = d.x * 5, y = d.z * 5; const w = d.name.length * 5.4; let lx = x + 8, ly = y + 4;
      for (const [ox, oy] of [[8, 4], [8, 15], [8, -7], [-8 - w, 4], [-8 - w, 15], [-8 - w, -7], [-w / 2, -9], [-w / 2, 18]]) { const b = [x + ox, y + oy - 9, x + ox + w, y + oy + 2]; if (!hits(b)) { lx = x + ox; ly = y + oy; break; } }
      placed.push([lx, ly - 9, lx + w, ly + 2]);
      return { dot: `<circle cx="${x}" cy="${y}" r="5.5" fill="${d.color}" stroke="#2b2530" stroke-width="1.5"/>`, name: label(lx, ly, d.name, 10) };
    });
    const youDot = me ? `<circle cx="${me.x * 5}" cy="${me.z * 5}" r="7" fill="${S.look.color}" stroke="#fff" stroke-width="2.5"/>` : '';
    return zs + roads + route + zl + ppl.map((o) => o.dot).join('') + youDot + ppl.map((o) => o.name).join('');
  }
  tab_map(S) {
    return `<h3>Larkspur</h3><svg class="map" viewBox="0 0 320 240" role="img" aria-label="Map of Larkspur">${this.mapSvg(S)}</svg><div class="legend"><span><i style="background:#9fd3b0"></i>fits you</span><span><i style="background:#f6cf5b"></i>pinches a little</span><span><i style="background:#f2a99a"></i>pinches a lot</span><span><i style="background:#ffcf7a"></i>your way</span><span><i style="background:${esc(S.look.color)};border-radius:50%;box-shadow:0 0 0 2px #fff inset"></i>you</span></div>`;
  }
  // The Notebook: people you are getting to know, sights you looked again at, field notes, and the pond
  tab_notebook(S) {
    const sub = this.lanSub || 'people';
    const n = Object.keys(S.notes || {}).length;
    const seg = `<div class="seg"><button data-sub="people" class="${sub === 'people' ? 'on' : ''}">People</button><button data-sub="sights" class="${sub === 'sights' ? 'on' : ''}">Sights</button><button data-sub="notes" class="${sub === 'notes' ? 'on' : ''}">Notes${n ? ' · ' + n : ''}</button><button data-sub="pond" class="${sub === 'pond' ? 'on' : ''}">Pond</button></div>`;
    if (sub === 'notes') S.notesNew = 0;
    return `<h3>Notebook</h3>${seg}` + (sub === 'people' ? this.peopleHtml(S) : sub === 'sights' ? this.sightsHtml(S) : sub === 'notes' ? this.notesHtml(S) : this.pondHtml(S));
  }
  face(id, S) { const look = id === 'you' ? S.look : CAST[id].look; try { return this.G.portraitOf(id === 'you' ? Object.assign({}, look) : look, { bg: '#efe6d6', w: 200, h: 200, drift: id === 'you' ? Math.round(this.G.drift() * 9.2) / 10 : 0 }); } catch (e) { return ''; } }
  peopleHtml(S) {
    if (this.personOpen) return this.personHtml(S, this.personOpen);
    const st = this.G.story; const ids = Object.keys(PEOPLE);
    const filled = ids.reduce((a, id) => a + st.known(id), 0);
    const card = (id) => {
      const met = !!S.met[id]; const n = st.known(id); const rv = (S.revealed || {})[id] === 'seen';
      return `<button class="pcard ${met ? '' : 'unmet'}" data-person="${id}">${met ? `<img src="${this.face(id, S)}" alt="">` : '<div class="sil">?</div>'}<b>${met ? esc(CAST[id].name) : '???'}</b><span class="pips">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>${rv ? '<span class="rv">✦</span>' : ''}</button>`;
    };
    return `<p class="small" style="margin-top:6px">Everyone here needs something different. Fill a page by asking, listening and noticing. Three lines on a page show you something about them.</p><div class="pgrid"><button class="pcard you" data-person="you"><img src="${this.face('you', S)}" alt=""><b>You</b><span class="pips small2">your page</span></button>${ids.map(card).join('')}</div><p class="small">${filled} of ${ids.length * 4} lines filled.</p>`;
  }
  personHtml(S, id) {
    const back = '<button class="mini-btn" id="pback">‹ Everyone</button>';
    if (id === 'you') {
      const words = Object.entries(SETUP).map(([k, sp]) => { const v = sp.invert ? 1 - S.profile[sp.dim] : S.profile[sp.dim]; return `<div class="srow"><span>${esc(sp.q.replace(/\?$/, ''))}</span><b>${esc(v < 0.4 ? sp.lo : v > 0.6 ? sp.hi : 'somewhere in between')}</b></div>`; }).join('');
      const st = S.stats; const self = Math.round(S.self);
      return `${back}<div class="phead"><img src="${this.face('you', S)}" alt=""><div><h4>${esc(S.name)}</h4><span class="small">${self > 85 ? 'Still entirely yourself.' : self > 60 ? 'A little faded at the edges.' : 'Paler than when you arrived.'}</span></div></div><h5 class="ph5">What your room says you need</h5>${words}<h5 class="ph5">So far</h5><p class="small">Bent ${st.bend + (st.smooth || 0)} · gear ${st.gear} · asked ${st.ask} · noted fixes ${st.fix} · left ${st.leave}</p><p class="small">Nobody else has this page. That is the point.</p>`;
    }
    const k = (S.know || {})[id] || {}; const P = PEOPLE[id]; const met = !!S.met[id];
    if (!met) return `${back}<div class="phead"><div class="sil big">?</div><div><h4>Someone you have not met</h4><span class="small">Say hi first.</span></div></div>`;
    const reads = Object.entries(S.lantern.entries).filter(([h]) => HINTS[h].by === id).map(([h, e]) => { const H = HINTS[h]; return `<div class="read">"${esc(H.t)}" <span class="${e.result === 'wrong' ? 'no' : 'ok'}">${e.result ? (e.result === 'wrong' ? 'They meant: ' + esc(H.truth === 'literal' ? H.literal : H.between) : e.result === 'asked' ? 'You asked. ' + esc(H.truth === 'literal' ? H.literal : H.between) : 'You read it right.') : 'Waiting to see.'}</span></div>`; }).join('');
    const rows = ['over', 'under', 'no', 'helps'].map((sl) => `<div class="slot ${k[sl] ? 'on' : ''}"><span>${SLOT_LABEL[sl]}</span><div>${k[sl] ? esc(P[sl]) : '<i>Ask, listen, or notice.</i>'}${sl === 'no' && reads ? reads : ''}</div></div>`).join('');
    const gw = (S.gw || {})[id] || 0; const dots = '●'.repeat(gw) + '○'.repeat(3 - gw);
    const tr = S.lantern.learned[id] ? `<label class="trrow"><input type="checkbox" id="keeptr" data-who="${id}" ${(S.lantern.off || {})[id] ? '' : 'checked'}> Keep translating for ${esc(CAST[id].name)}</label>` : '';
    const rv = (S.revealed || {})[id] === 'seen';
    return `${back}<div class="phead"><img src="${this.face(id, S)}" alt=""><div><h4>${esc(CAST[id].name)}</h4><span class="small">${esc(roleOf(id, S.act || 1))}</span><div class="gwrow" aria-label="Goodwill ${gw} of 3">Goodwill <b>${dots}</b></div></div></div>${rows}${tr}${k.love ? `<div class="slot love on"><span>Something they love</span><div>${esc(P.love)}</div></div>` : ''}${rv ? `<div class="revealbox"><span>How ${esc(CAST[id].name)} bends</span><p>${esc(P.reveal)}</p></div>` : `<p class="small">${this.G.story.known(id) >= 3 ? '' : 'Fill three lines to see how ' + esc(CAST[id].name) + ' bends.'}</p>`}`;
  }
  // field notes by section; a note shows once something in the game has happened to you (the autism section opens
  // whole on your first night); numbers live only here, each with its source and how strong the evidence is
  notesHtml(S) {
    const seen = S.notes || {}; const act = S.act || 1;
    const html = NOTE_SECTIONS.map((sec) => {
      const all = FIELD_NOTES.filter((n) => n.section === sec.id && n.act <= act); if (!all.length) return '';
      const found = all.filter((n) => seen[n.id]);
      if (sec.id === 'autism' && !S.flags.autismOpen) return `<div class="nsec"><h4>${esc(sec.title)}</h4><p class="small">Opens on your first night.</p></div>`;
      return `<div class="nsec"><h4>${esc(sec.title)}</h4>${sec.intro && found.length ? `<p class="small">${esc(sec.intro)}</p>` : ''}${found.map((n) => this.noteCard(n, seen[n.id] === S.day)).join('')}${all.length > found.length ? `<p class="small">${all.length - found.length} more to find.</p>` : ''}</div>`;
    }).join('');
    return `<p class="small" style="margin-top:6px">Larkspur is made up. The ideas under it are not. A note appears here after something in the game has happened to you.</p>${html}`;
  }
  noteCard(n, isNew) { return `<div class="note sm"><div class="tag">${esc(n.tag)}${isNew ? ' · new today' : ''}</div><h5>${esc(n.title)}</h5><p>${esc(n.text)}</p><div class="src">${esc(n.src)}</div></div>`; }
  sightsHtml(S) {
    const L = this.G.look; const rows = L && L.sightsList ? L.sightsList() : [];
    const lantern = S.flags.lantern ? '' : '<p class="small">Wren left something on your windowsill. You might pick it up.</p>';
    return lantern + (rows.length ? rows.map((r) => `<div class="card"><b>${esc(r.name)}</b><div class="meta">${esc(r.line)}</div>${r.second ? `<div class="meta also">${esc(r.second)}</div>` : ''}</div>`).join('') : '<p class="small">Raise Wren\'s lantern somewhere in town (L, or the lantern button) to look again at what was made for someone.</p>');
  }
  pondHtml(S) {
    const pond = S.pond || {}; const cards = S.cards || {};
    return `<div class="pondguide"><b>Pond guide · ${Object.keys(pond).length} of ${FISH.length}</b><div>${FISH.map((f) => `<span class="${pond[f.id] ? 'on' : ''}" style="--c:${f.col}">${pond[f.id] ? esc(f.name) : '??? <i>' + esc(f.hint || '') + '</i>'}</span>`).join('')}</div></div>${Object.keys(cards).length ? `<div class="pondguide"><b>Pond cards</b><div>${FISH.filter((f) => cards[f.id]).map((f) => `<span class="on card" style="--c:${f.col}">${esc(cardName(f))}</span>`).join('')}</div><p class="small">Cards count toward nothing. They are just cards.</p></div>` : ''}`;
  }
  // a reveal: how someone you got to know bends too
  postcard(d) {
    const p = this.openPanel('center postcard', `<div class="pc"><img src="${d.img}" alt=""><div class="pct"><div class="tday">A moment with ${esc(d.name)}</div><p>${esc(d.text)}</p></div></div><div class="pfoot"><button class="btn primary" id="pck">Keep this</button></div>`);
    this.G.audio.sfx('page');
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; p.querySelector('#pck').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 300); if (FAST) setTimeout(go, 30); });
  }
  // what you've gathered: people's words, insights and deals (your hand at a hearing), the marks by street, the hooks
  tab_fitbook(S) {
    const G = this.G; const sub = this.fbSub || 'cards';
    const tabs = `<div class="subtabs">${[['cards', 'Cards'], ['marks', 'Marks'], ['hooks', 'Hook Log']].map(([k, n]) => `<button class="chip ${k === sub ? 'on' : ''}" data-fb="${k}">${n}</button>`).join('')}</div>`;
    let body = '';
    if (sub === 'cards') {
      const ids = Object.keys(S.cards || {}).filter((id) => CARDS[id]);
      const label = { story: 'Their words', insight: 'Insight', deal: 'Agreed' };
      body = ids.length ? '<div class="fbcards">' + ids.map((id) => { const c = CARDS[id]; return `<div class="fbcard ${c.kind}"><span class="fbk">${label[c.kind]}</span><b>${esc(c.title)}</b><p>${esc(c.text)}</p>${c.src ? `<span class="fbsrc">${esc(c.src)}</span>` : ''}</div>`; }).join('') + '</div><p class="small">These are your hand at a hearing. Someone\'s own words are theirs: ask before you use them.</p>' : '<p>No cards yet. Listen to people, and you\'ll gather some.</p>';
    } else if (sub === 'marks') {
      body = Object.keys(STREETS).map((z) => {
        const list = MARKS.filter((m) => m.street === z && !m.fit); if (!list.length) return '';
        const c = G.marks.count(z);
        return `<h4 class="ph4">${esc(STREETS[z].name)} · ${c.done}/${c.total}</h4>` + list.map((m) => { const on = G.marks.tagged(m.id); const K = KINDS[m.kind]; return `<div class="fbmark ${on ? '' : 'off'}"><span class="mi" style="--mk:${K[1]}">${on ? K[0] : '?'}</span><div><b>${on ? esc(m.name) : m.rare ? 'A rare one' : 'Not found yet'}</b>${on ? `<span>${esc(m.line)}</span>` : m.rare ? '<span>Only shows at a certain time of day.</span>' : ''}</div></div>`; }).join('');
      }).join('');
    } else body = G.hooks.logHtml(FIELD_NOTES);
    return `<h3>Fit Book</h3>${tabs}${body}`;
  }
  tab_fix(S) { return `<h3>Fix-It</h3><div class="list">${this.proposals(S)}</div>`; }
  tab_texts(S) { return '<h3>Texts</h3>' + (this.G.texts.slice().reverse().map(([w, t]) => `<div class="msg"><b>${esc(w)}</b>${esc(t)}</div>`).join('') || '<p>No messages.</p>'); }
  tab_blend(S) {
    const B = S.blend; const board = BLEND.board.map(([n, v]) => [n, v]).concat([[S.name + ' (you)', B.score]]).sort((a, b) => b[1] - a[1]);
    return `<div class="blendapp"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-family:var(--display);color:#d0457f">blend</b><span class="streak">🔥 ${B.streak} day streak</span></div><div class="score">${B.score}</div><div style="color:#b06090;font-size:13.5px">Smooth Score · calmer than ${Math.min(97, 40 + Math.round(B.score / 6))} in 100 people in Larkspur</div>
      ${S.flags.lantern ? `<button class="mini-btn blook" id="blook"><span class="ico" aria-hidden="true">${ICON.lantern}</span>Look again at the feed</button><p class="blookt" id="blookt" hidden>A hungrier copy of you, made to fit the feed.</p>` : ''}
      <div class="feedmount"></div>
      <div class="toggle"><div><b style="font-family:var(--display)">Smooth Mode</b><div style="font-size:12.5px;color:#9a6a86">We handle the awkward parts for you. 15 points each time.</div></div><button class="switch ${B.smooth ? 'on' : ''}" id="smooth" aria-label="Smooth Mode" aria-pressed="${!!B.smooth}"></button></div><p class="blplain">In plain words: while it's on, Smooth Mode pushes through for you whenever a place pinches, for 15 points a time. The pinch is still there. The town looks greyer.</p>
      ${this.G.dropReady() ? '<button class="btn" id="drop" style="width:100%">Daily drop: 25 points. The same every day.</button>' : ''}
      <div class="bl-h">BADGES</div>${B.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('') || '<span style="font-size:13px;color:#9a6a86">None yet! Smooth something to earn one.</span>'}
      <div class="bl-h">LEADERBOARD</div>${board.map(([n, v]) => `<div class="lb-row ${n.includes('(you)') ? 'me' : ''}"><span>${esc(n)}</span><span>${v}</span></div>`).join('')}
      <div style="margin-top:18px;text-align:center"><button class="btn" id="del" style="font-size:13px">Delete Blend</button><p id="delwarn" hidden style="font-size:13px;color:#9a6a86">${esc(BLEND.delete)}</p></div></div>`;
  }
  // ---------- the Standard's room (the puzzle at the statue) ----------
  // Six rows, the same six objects as your own room. Check as often as you like: once three or more are right, the
  // right ones lock in. All six, and the plaque tells you what the Standard was. Resolves when closed.
  standardRoom(L) {
    const G = this.G, S = G.S; S.stdPick = S.stdPick || {}; S.stdLock = S.stdLock || {};
    const rows = L.rows(); let msg = '';
    const solvedView = () => {
      const { mine, its } = L.roomValues(); const W = 210, rowH = 34;
      const dial = (vals, other) => `<svg class="rooms" viewBox="0 0 ${W} ${rowH * 6 + 8}" role="img" aria-label="${other ? 'Its room' : 'Your room'}">${rows.map((r, i) => { const y = 8 + i * rowH; const diff = Math.abs(mine[i] - its[i]) > 0.25; return `<g><text x="4" y="${y + 9}" font-size="10" fill="#5b5260">${esc(SETUP_NAMES[r.key])}</text><rect x="4" y="${y + 14}" width="${W - 8}" height="8" rx="4" fill="#e9dfd0" ${diff ? 'stroke="#c8553d" stroke-width="2"' : ''}/><circle cx="${8 + vals[i] * (W - 16)}" cy="${y + 18}" r="6" fill="${other ? '#c9b8a6' : S.look.color}" stroke="#2b2530" stroke-width="1.5"/></g>`; }).join('')}</svg>`;
      return `<h2>The Standard's room</h2><p class="plaque">${esc(PLAQUE_TEXT)}</p><div class="tworooms"><figure>${dial(mine, false)}<figcaption>Your room</figcaption></figure><figure>${dial(its, true)}<figcaption>Its room</figcaption></figure></div><div class="pfoot"><button class="btn primary" id="sdone">Close</button></div>`;
    };
    const view = () => {
      if (S.w && S.w.standard_solved) return solvedView();
      return `<h2>The Standard's room</h2><p class="lede">THE STANDARD RESIDENT. Larkspur's measure. How did it like its room?</p>${rows.map((r, i) => `<div class="srow2 ${S.stdLock[r.key] ? 'locked' : ''}"><div class="sq">${esc(r.q)}</div><div class="chips" data-k="${r.key}" role="radiogroup">${r.opts.map((o, j) => `<button class="chip ${S.stdPick[r.key] === j ? 'on' : ''}" data-v="${j}" role="radio" aria-checked="${S.stdPick[r.key] === j}" ${S.stdLock[r.key] ? 'aria-disabled="true"' : ''}>${esc(o)}</button>`).join('')}${S.stdLock[r.key] ? '<span class="tick" aria-label="right">✓</span>' : ''}</div><div class="clue">${esc(r.clue)}</div><div class="clue felt">Where you felt it: ${esc(r.felt)}</div></div>`).join('')}<p class="smsg" role="status">${esc(msg)}</p><div class="pfoot"><button class="btn" id="sdone">Not now</button><button class="btn primary" id="scheck">Check</button></div>`;
    };
    const p = this.openPanel('center standard', view());
    return new Promise((resolve) => {
      const bind = () => {
        p.querySelectorAll('.chips [data-v]').forEach((b) => { b.onclick = () => { const k = b.parentElement.dataset.k; if (S.stdLock[k]) return; S.stdPick[k] = +b.dataset.v; this.G.audio.sfx('select'); p.innerHTML = view(); bind(); }; });
        const done = p.querySelector('#sdone'); if (done) done.onclick = () => { this.closePanel(); resolve(); };
        const chk = p.querySelector('#scheck'); if (chk) chk.onclick = () => {
          const right = rows.filter((r) => S.stdPick[r.key] === r.answer);
          if (right.length >= 3) { for (const r of right) S.stdLock[r.key] = 1; }
          if (right.length === 6) { G.story.solveStandard(); this.G.audio.sfx('good'); }
          else { msg = right.length >= 3 ? ['', '', '', 'Three are right.', 'Four are right.', 'Five are right.'][right.length] : 'Not yet. Fewer than three are right.'; this.G.audio.sfx(right.length >= 3 ? 'page' : 'back'); }
          p.innerHTML = view(); bind(); this.announce(S.w && S.w.standard_solved ? PLAQUE_TEXT : msg);
        };
      };
      bind();
    });
  }
  // ---------- Who decided? ----------
  decidedCard(d) {
    const pay = d.pay.length ? d.pay.map((p) => `<figure>${p.img ? `<img src="${p.img}" alt="">` : '<i class="vsil"></i>'}<figcaption>${esc(p.name)}</figcaption></figure>`).join('') : '<p class="small">Nobody else, this time.</p>';
    const p = this.openPanel('center decided', `<div class="tday">Who decided? · ${d.n} of ${d.of}</div><h2 class="dverb">${esc(d.verb)}</h2><div class="dcols"><div><h3 class="sec">What you faced</h3><ul>${d.faced.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h3 class="sec">Also true</h3><ul>${d.also.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div><h3 class="sec">Who paid</h3><div class="dpay">${pay}</div><div class="pfoot">${d.first ? '<button class="btn" id="dskip">Skip to the festival</button>' : ''}<button class="btn primary" id="dnext">Next</button></div>`);
    this.announce('Who decided? ' + d.verb + ' What you faced: ' + d.faced.join(' ') + ' Also true: ' + d.also.join(' ') + ' Who paid: ' + (d.pay.map((x) => x.name).join(', ') || 'nobody else'));
    return new Promise((r) => {
      const go = (v) => { window.removeEventListener('keydown', kh); this.closePanel(); r(v); };
      const kh = (e) => { if (e.key === 'Enter') { e.preventDefault(); go('next'); } };
      p.querySelector('#dnext').onclick = () => go('next'); const sk = p.querySelector('#dskip'); if (sk) sk.onclick = () => go('skip');
      setTimeout(() => window.addEventListener('keydown', kh), 300); if (FAST) setTimeout(() => go('next'), 40);
      setTimeout(() => { const b = p.querySelector('#dnext'); if (b && !this.touch) b.focus(); }, 60);
    });
  }
  defaultCard(opts) {
    const p = this.openPanel('center decided', `<div class="tday">Who decided?</div><h2>One thing to set differently next time</h2><div class="list">${opts.map((o) => `<button class="choice" data-id="${o.id}"><span class="t">${esc(o.t)}</span><span class="sub">${esc(o.sub)}</span></button>`).join('')}</div><p class="small">${(this.G.S.act || 1) >= 3 ? 'It carries over if you play this visit again.' : 'It carries to your next visit, if you make one. You can change it then.'}</p>`);
    this.announce('One thing to set differently next time. ' + opts.map((o, i) => (i + 1) + '. ' + o.t + ': ' + o.sub).join(' '));
    return new Promise((r) => {
      p.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => { this.closePanel(); this.G.audio.sfx('confirm'); r(b.dataset.id); }; });
      if (FAST) setTimeout(() => { this.closePanel(); r(opts[opts.length - 1].id); }, 40);
    });
  }
  // ---------- the morning card ----------
  today(d) {
    const items = d.items.map((it, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(it.t)}</b>${it.sub ? `<div class="meta">${esc(it.sub)}</div>` : ''}</div></li>`).join('');
    const p = this.openPanel('center today', `<div class="pin"></div><div class="tday">${esc(d.day)}</div><h2>${esc(d.title)}</h2><ol class="tlist">${items}</ol>${d.note ? `<p class="tnote">${esc(d.note)}</p>` : ''}${d.carried ? `<p class="tnote carried">${esc(d.carried)}</p>` : ''}<div class="pfoot"><button class="btn primary" id="tgo">${esc(d.button || 'Head out')}</button></div>`);
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; p.querySelector('#tgo').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 250); });
  }
  // ---------- the evening page: what happened, without a score ----------
  evening(d) {
    const resp = [['bend', 'Pushed through'], ['gear', 'Gear'], ['ask', 'Asked'], ['fix', 'Noted a fix'], ['leave', 'Left']].map(([k, n]) => `<div class="ev-r ${k} ${d.counts[k] ? '' : 'zero'}"><div class="ic">${ICON[k]}</div><b>${d.counts[k] || 0}</b><span>${n}</span></div>`).join('');
    const marbles = d.jar.map((m) => `<i style="--c:${m.c}" title="${esc(m.t)}"></i>`).join('') + '<i class="empty"></i>'.repeat(Math.max(0, d.jarMax - d.jar.length));
    const p = this.openPanel('center evening', `<div class="tday">${esc(d.day)} evening</div><h2>${esc(d.title)}</h2>
      <h3 class="sec">Today, when a place did not fit</h3><div class="ev-row">${resp}</div>
      <h3 class="sec">Your jar of kept moments</h3><div class="jarrow"><div class="jar">${marbles}</div><div class="jt">${d.jarText}</div></div>
      ${d.news.length ? `<h3 class="sec">Around town</h3><ul class="ev-news">${d.news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${d.open ? `<h3 class="sec">Still open</h3><p class="ev-open">${esc(d.open)}</p>` : ''}
      ${d.notebook ? `<p class="ev-open">${esc(d.notebook)} It's in your phone, under Notebook.</p>` : ''}
      ${d.tomorrow.length ? `<h3 class="sec">Tomorrow</h3><ul class="ev-news">${d.tomorrow.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="pfoot sticky"><button class="btn primary" id="sleep">Sleep</button></div>`);
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }; p.querySelector('#sleep').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 300); });
  }
  ending(d) {
    const p = this.openPanel('ending', `<div class="wrap"><div class="portraits"><figure><img src="${d.before}" alt="You on your first day">You on your first day</figure><figure><img src="${d.after}" alt="You tonight">You tonight</figure></div>
      <h1>${esc(d.title)}</h1><p class="lead">${esc(d.text)}</p>${d.line ? `<p class="eline">${esc(d.line)}</p>` : ''}
      <h2 class="eh">What Larkspur will remember</h2><ul class="fates">${d.remember.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="row erow"><button class="btn primary" id="notes">What was this about?</button><button class="btn" id="card">Make your fit card</button>${d.act < 3 && this.G.story.nextAct ? `<button class="btn accent" id="next">${d.act === 1 ? 'Ten years later' : 'Twenty years later'}</button>` : ''}<button class="btn" id="again">Play this visit again</button></div>
      <div class="ecode"><label for="vcode">Your visit code</label><textarea id="vcode" class="codebox" readonly rows="2">${esc(d.code || '')}</textarea><div class="row"><button class="btn" id="copy">Copy</button></div><p class="small">${d.act >= 3 ? 'It holds only what Larkspur remembers of your visits: no name, nothing else.' : 'It holds only what carries to the next visit: no name, nothing else. Paste it into "Played before?" on any device.'}</p></div>
      <div id="cardbox"></div><div id="noteslist"></div></div>`);
    p.querySelector('#again').onclick = () => { try { sessionStorage.setItem('mtf.again', JSON.stringify({ act: d.act, default: this.G.S.default || 'as_is', name: this.G.S.name, carry: this.G.S.startCarry || null })); } catch (e) { /* replay without the default */ } location.reload(); };
    const nx = p.querySelector('#next'); if (nx) nx.onclick = () => this.G.story.nextAct();
    p.querySelector('#copy').onclick = async () => { const t = p.querySelector('#vcode'); t.select(); let ok = false; try { await navigator.clipboard.writeText(t.value); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } } this.toast(ok ? 'Copied.' : 'Select the code and copy it.', '', 2000); };
    p.querySelector('#notes').onclick = () => {
      const S = this.G.S; const seen = S.notes || {}; const act = S.act || 1;
      p.querySelector('#noteslist').innerHTML = `<p class="nl-intro">Larkspur is made up. The ideas under it are not. Here is what the game was built on, with how strong the evidence is.</p>` + NOTE_SECTIONS.map((sec) => { const ns = FIELD_NOTES.filter((n) => n.section === sec.id && n.act <= act); if (!ns.length) return ''; return `<h3 class="nlsec">${esc(sec.title)}</h3>${sec.intro ? `<p class="small">${esc(sec.intro)}</p>` : ''}` + ns.map((n) => `<div class="note ${seen[n.id] ? 'seen' : ''}"><div class="tag">${esc(n.tag)}${seen[n.id] ? ' · you found this one' : ''}</div><h4>${esc(n.title)}</h4><p>${esc(n.text)}</p><div class="src">${esc(n.src)}</div></div>`).join(''); }).join('') + `<div class="support"><h3 class="nlsec">Support</h3>${SUPPORT.lines.map((l) => `<p><b>${esc(l.where)}</b> ${esc(l.text)}</p>`).join('')}<p class="small">${esc(SUPPORT.footer)}</p></div>`;
      p.querySelector('#notes').hidden = true; p.querySelector('#noteslist').scrollIntoView({ behavior: 'smooth' });
    };
    p.querySelector('#card').onclick = async () => {
      const box = p.querySelector('#cardbox'); box.innerHTML = '<p class="small">Drawing your card…</p>';
      try {
        const data = d.card(); const cv = await drawFitCard(data); const alt = cardAltText(data);
        box.innerHTML = `<figure class="fitfig"><img alt="${esc(alt)}" src="${cv.toDataURL('image/png')}"><figcaption><button class="btn primary" id="savecard">Save the card</button></figcaption></figure><p class="small">Your name is not on it. Saving asks first, and nothing leaves this device unless you send it.</p>`;
        box.querySelector('#savecard').onclick = async () => { const r = await saveFitCard(cv) || {}; if (r.status === 'saved') this.toast('Saved.', '', 2200); else if (r.status === 'declined') this.toast('Not saved.', '', 2200); else { const n = document.createElement('p'); n.className = 'small'; n.textContent = 'Saving a file isn\'t possible here. Right-click or long-press the card to save the picture.'; box.appendChild(n); } };
      } catch (e) { box.innerHTML = '<p class="small">The card could not be drawn here.</p>'; }
    };
    return new Promise(() => {});
  }

}
