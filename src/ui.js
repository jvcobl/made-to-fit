// DOM interface: dialogue, the "who adjusts?" card, phone, creator, room setup, settings, title, evening page and ending.
import { esc, fmtTime, clamp, FAST, now, keyName } from './util.js';
import { OPTIONS } from './creature.js';
import { CAST, HINTS, BLEND, SETUP, FIELD_NOTES, PEOPLE, SLOT_LABEL } from './content.js';
import { FIXES, pinch, townFit, fixState, supporters } from './sim.js';
import { ZONES } from './town.js';
import { FISH } from './games/pond.js';

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
  jar: '<svg viewBox="0 0 24 24"><path d="M8 3.5h8M8.5 3.5v3L6 9.5V19a2 2 0 002 2h8a2 2 0 002-2V9.5l-2.5-3v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
export const isTouch = () => (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const DAYNAME = ['Moving day', 'Monday', 'Tuesday', 'Wednesday'];

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
        <div class="clock"><div class="dial"></div><div class="cl"><div class="when"></div><div class="obj"></div><button class="way" id="wayBtn" hidden>${ICON.way}<span>Show the way</span></button></div></div>
        <div class="hudbtns"><button class="btn hb" id="phoneBtn" aria-label="Phone">${ICON.phone}<span class="lbl">Phone</span>${this.touch ? '' : '<kbd>P</kbd>'}</button><button class="btn hb" id="setBtn" aria-label="Settings">${ICON.cog}<span class="lbl">Settings</span></button></div>
        <div class="dock"><div class="energy" title="Energy for today"><svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="14" fill="none" stroke-width="5"/><circle class="bar" cx="18" cy="18" r="14" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="88" stroke-dashoffset="0"/></svg><span class="elabel">Energy</span></div><div class="gearbtns"></div></div>
      </div>
      <div id="edge" hidden><div class="arr">${ICON.way}</div><span></span></div>
      <div id="prompt" hidden></div>
      <button id="actbtn" hidden></button>
      <div id="dialog" hidden aria-live="polite"><div class="plate"></div><div class="tagline"></div><div class="text"></div><div class="extra"></div><div class="more">▼</div><div class="choices"></div></div>
      <div id="barrier" hidden></div>
      <div id="toasts"></div>
      <div id="phone" hidden></div>
      <div id="mg" hidden></div>
      <div id="panel" hidden></div>`;
    this.el = (id) => this.root.querySelector(id);
    this.dialog = this.el('#dialog'); this.barrierEl = this.el('#barrier'); this.panel = this.el('#panel'); this.phoneEl = this.el('#phone');
    this.waiter = null; this.phoneTab = 'today'; this.bubblesMap = {}; this.gearKey = '';
    this.el('#phoneBtn').onclick = () => this.G.togglePhone(true);
    this.el('#setBtn').onclick = () => this.G.openSettings();
    this.el('#prompt').onclick = () => this.G.interact();
    this.el('#actbtn').onclick = () => this.G.interact();
    this.el('#wayBtn').onclick = () => this.G.showWay();
    this.el('#edge').onclick = () => this.G.showWay();
    this.el('#caption').onclick = () => this.skipCaption();
    this.dialog.addEventListener('click', (e) => { if (e.target.closest('.choice')) return; this.advance(); });
    this.el('.gearbtns').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const g = b.dataset.g; if (g === 'smooth') this.G.setSmooth(!this.G.S.blend.smooth); else this.G.toggleGear(g); this.gearKey = ''; });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => { const k = keyName(e); if (this.holding && this.holding.key && (k === '1' || k === ' ' || k === 'Enter')) this.bendRelease(); });
    if (this.touch) document.body.classList.add('touch');
  }
  get set() { return this.G.settings; }
  key(e) {
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
      p.hidden = false; p.innerHTML = esc(name) + (c && !this.G.met(o.who) ? '<small>' + esc(c.role) + '</small>' : '');
      p.style.setProperty('--plate', o.who === 'you' ? '#3a3340' : (c ? c.tint : '#3a3340'));
    } else p.hidden = true;
  }
  line(o) {
    this.hideBarrier();
    const d = this.dialog; d.hidden = false; d.className = o.kind || 'say';
    this.plate(o);
    const tag = d.querySelector('.tagline');
    tag.textContent = o.kind === 'gut' ? 'Your gut' : o.kind === 'notice' ? o.label + ' · you notice' : '';
    tag.hidden = !(o.kind === 'gut' || o.kind === 'notice');
    d.querySelector('.choices').innerHTML = ''; d.querySelector('.more').hidden = true;
    const extra = d.querySelector('.extra'); extra.innerHTML = o.extra || '';
    const txt = d.querySelector('.text'); const full = o.text;
    if (o.voice) o.voice(full);
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
        const b = document.createElement('button'); b.className = 'choice' + (op.blend ? ' blend' : '') + (op.disabled ? ' off' : '');
        if (op.disabled) b.setAttribute('aria-disabled', 'true');
        b.innerHTML = `<span class="k">${i + 1}</span><span class="t">${esc(op.t)}</span>` + (op.blend ? `<span class="tag">${esc(BLEND.suggest)}</span>` : op.sub ? `<span class="sub">${esc(op.disabled && op.reason ? op.reason : op.sub)}</span>` : op.tag && op.tag !== 'blend' ? `<span class="tag">${esc(op.tag)}</span>` : '');
        b.onclick = () => { if (op.disabled) { this.nudge(b, op.reason); return; } this.waiter = null; box.innerHTML = ''; this.G.audio.sfx('confirm'); resolve(i); };
        box.appendChild(b); return b;
      });
      this.waiter = { type: 'choice', buttons };
    });
  }
  // a control that cannot be used right now says why, instead of doing nothing
  nudge(el, reason) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); this.G.audio.sfx('back'); if (reason) this.toast(esc(reason), '', 2600); }
  hideDialog() { this.dialog.hidden = true; if (this.waiter && this.waiter.type !== 'barrier') this.waiter = null; }
  // ---------- who adjusts? ----------
  barrier(b) {
    this.dialog.hidden = true;
    const el = this.barrierEl; el.hidden = false;
    el.innerHTML = `<h3>${esc(b.title)}</h3><div class="desc">${esc(b.text)}</div>` + (b.notice ? `<div class="noticeline"><b>${esc(b.noticeLabel)}</b>${esc(b.notice)}</div>` : '') + (b.gut ? `<div class="gutline">${esc(b.gut)}</div>` : '') + `<div class="q">Who adjusts?</div>` + (b.coach ? `<div class="coach">${esc(b.coach)}</div>` : '') + `<div class="opts"></div>`;
    const box = el.querySelector('.opts');
    return new Promise((resolve) => {
      const buttons = b.options.map((o, i) => {
        const btn = document.createElement('button'); btn.className = 'opt ' + o.key + (o.disabled ? ' off' : '');
        if (o.disabled) btn.setAttribute('aria-disabled', 'true');
        const instant = FAST || this.set.holdToBend === false;
        btn.innerHTML = `<div class="ic">${ICON[o.key]}</div><div class="who">${esc(o.who)}</div><b>${esc(o.label)}</b><span class="sub">${esc(o.disabled ? o.reason : o.sub)}</span>` + (o.hold && !instant ? `<span class="hold">${this.touch ? 'Hold, or tap to start' : 'Hold, or tap to start'}</span>` : '') + `<div class="fill"></div><div class="k">${i + 1}</div>`;
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
    const t = $(`<div class="toast ${kind}">${html}</div>`); this.el('#toasts').appendChild(t);
    const all = this.el('#toasts').children; if (all.length > 4) all[0].remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, FAST ? 300 : ms);
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
    const day = DAYNAME[S.day] || 'Day ' + S.day;
    h.querySelector('.when').textContent = day + ' · ' + fmtTime(S.min);
    const text = obj ? obj.t || '' : '';
    if (this._obj !== text) { this._obj = text; h.querySelector('.obj').textContent = text; }
    this.el('#wayBtn').hidden = !(obj && obj.at) || this.G.mode !== 'play' || !!this.G.busy || !!this.waiter || this.G.mgActive || (obj.inside && obj.inside === this.G.loc);
    h.querySelector('.dial').style.setProperty('--sun', Math.round(clamp((S.min - 420) / 900) * 100) + '%');
    const e = S.energy / 100; const bar = h.querySelector('.bar'); bar.style.strokeDashoffset = String(88 * (1 - e));
    h.querySelector('.energy').classList.toggle('low', e < 0.3);
    // gear you own becomes a button you can press (on phones there are no H and J keys)
    const smoothOk = S.blend.has && !S.blend.deleted;
    const gk = [S.gear.headphones, S.wearing.headphones, S.gear.shades, S.wearing.shades, smoothOk, S.blend.smooth].join();
    if (gk !== this.gearKey) {
      this.gearKey = gk;
      const b = (g, on, label, ic, key) => `<button class="gb ${on ? 'on' : ''} ${g === 'smooth' ? 'sm' : ''}" data-g="${g}" aria-pressed="${on}" title="${label}${this.touch ? '' : ' (' + key + ')'}">${ic}<span>${label}</span></button>`;
      h.querySelector('.gearbtns').innerHTML = (S.gear.headphones ? b('headphones', S.wearing.headphones, 'Headphones', ICON.gear, 'H') : '') + (S.gear.shades ? b('shades', S.wearing.shades, 'Shades', ICON.shades, 'J') : '') + (smoothOk ? b('smooth', S.blend.smooth, 'Smooth Mode', ICON.smooth, 'B') : '');
    }
  }
  ping(on) { this.el('#phoneBtn').classList.toggle('ping', on); }
  prompt(label, x, y) {
    const p = this.el('#prompt'); if (!label) { p.hidden = true; this._pl = null; return; }
    p.hidden = false; if (this._pl !== label) { this._pl = label; p.innerHTML = (this.touch ? '' : '<kbd>E</kbd>') + esc(label); }
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
    e.hidden = false; e.style.left = info.x + 'px'; e.style.top = info.y + 'px';
    e.querySelector('.arr').style.transform = `rotate(${info.ang}rad)`;
    const t = info.label + ' · ' + info.dist + ' m'; const s = e.querySelector('span'); if (s.textContent !== t) s.textContent = t;
  }
  // ---------- panels ----------
  openPanel(cls, html) { const p = this.panel; p.style.cssText = ''; p.className = 'panel ' + cls; p.innerHTML = html; p.hidden = false; return p; }
  closePanel() { this.panel.hidden = true; this.panel.innerHTML = ''; }
  title(resume) {
    const p = this.openPanel('title', `<h1>Who Bends</h1><div class="sub">${resume ? 'The game was updated. Your season picks up at the start of the day.' : 'a town built for someone else'}</div><div class="row"><button class="btn accent" id="begin">${resume ? 'Continue' : 'Begin'}</button><button class="btn" id="tset">Settings</button></div><div class="fine">About 30 minutes. Best with sound. You can't see everything in one visit, and that's fine. Nothing flashes fast, and screen effects can be turned down or off in Settings. No account, no tracking, nothing to buy.</div>`);
    p.querySelector('#tset').onclick = () => this.G.openSettings(true);
    return new Promise((r) => { p.querySelector('#begin').onclick = () => { this.closePanel(); r(); }; setTimeout(() => { const b = p.querySelector('#begin'); if (b && !this.touch) b.focus(); }, 50); });
  }
  creator(look, onChange) {
    const S = this.G.S; const L = Object.assign({}, look);
    const sec = (title, key, opts, cur) => `<h4>${title}</h4><div class="chips" data-k="${key}">` + opts.map(([v, n]) => `<button class="chip ${v === cur ? 'on' : ''}" data-v="${v}">${esc(n)}</button>`).join('') + '</div>';
    const html = `<h2>This is you.</h2><p class="lede">Nobody else in Larkspur looks quite like this. That is the point.</p>
      <div class="two"><div><h4>Name</h4><input type="text" id="cname" maxlength="14" value="${esc(S.name)}" autocomplete="off"></div><div><h4>Pronouns</h4><div class="chips" data-k="pronoun">${['they', 'she', 'he'].map((v) => `<button class="chip ${v === S.pronoun ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div></div>
      ${sec('Shape', 'shape', OPTIONS.shape, L.shape)}
      <h4>Color</h4><div class="chips" data-k="color">${OPTIONS.color.map((c) => `<button class="swatch ${c === L.color ? 'on' : ''}" data-v="${c}" style="background:${c}" aria-label="color ${c}"></button>`).join('')}</div>
      ${sec('Pattern', 'pattern', OPTIONS.pattern, L.pattern)}${sec('On top', 'top', OPTIONS.top, L.top)}${sec('Something you always wear', 'wear', OPTIONS.wear, L.wear)}${sec('Your voice', 'voice', OPTIONS.voice, L.voice)}
      ${sec('Getting around', 'wheels', [['feet', 'On foot'], ['wheels', 'On wheels']], L.wheels ? 'wheels' : 'feet')}
      <div class="row"><button class="btn" id="rand">Surprise me</button><button class="btn primary" id="done" style="flex:1">That's me</button></div>`;
    const p = this.openPanel('creator', html);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return; const k = b.parentElement.dataset.k; const v = b.dataset.v;
      b.parentElement.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
      if (k === 'pronoun') S.pronoun = v; else if (k === 'wheels') L.wheels = v === 'wheels'; else L[k] = v;
      this.G.audio.sfx('select'); onChange(L, k);
    });
    p.querySelector('#rand').onclick = () => {
      const pk = (a) => a[Math.floor(Math.random() * a.length)];
      L.shape = pk(OPTIONS.shape)[0]; L.color = pk(OPTIONS.color); L.pattern = pk(OPTIONS.pattern)[0]; L.top = pk(OPTIONS.top)[0]; L.wear = pk(OPTIONS.wear)[0]; L.voice = pk(OPTIONS.voice)[0];
      p.querySelectorAll('.chips').forEach((c) => { const k = c.dataset.k; const cur = k === 'wheels' ? (L.wheels ? 'wheels' : 'feet') : k === 'pronoun' ? S.pronoun : L[k]; c.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x.dataset.v === cur)); });
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
  shop(S) {
    const items = [['headphones', 'Headphones', 18, 'Muffles a loud room, or fills a quiet one with your music.'], ['shades', 'Shades', 12, 'Takes the edge off glare.']];
    const render = () => `<h2>Under Moss's counter</h2><p class="lede">You have ${S.coins} coins.</p><div class="list">${items.map(([k, n, c, d]) => `<div class="card"><b>${n}</b> ${S.gear[k] ? '<span class="pill built">yours</span>' : `<span class="pill">${c} coins</span>`}<div class="meta">${d}</div>${S.gear[k] ? '' : `<div style="margin-top:8px"><button class="btn" data-buy="${k}" ${S.coins < c ? 'aria-disabled="true"' : ''}>${S.coins < c ? 'Not enough coins yet' : 'Buy'}</button></div>`}</div>`).join('')}</div><div class="pfoot"><button class="btn primary" id="done">Done</button></div>`;
    const p = this.openPanel('center', render());
    return new Promise((r) => {
      p.addEventListener('click', (e) => {
        const b = e.target.closest('[data-buy]');
        if (b) { const it = items.find((x) => x[0] === b.dataset.buy); if (S.coins >= it[2]) { S.coins -= it[2]; S.gear[it[0]] = true; this.G.audio.sfx('coin'); this.G.onGear(it[0]); p.innerHTML = render(); } else this.nudge(b, 'A shift at the Works pays 30 coins.'); }
        if (e.target.id === 'done') { this.closePanel(); r(); }
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
    const rows = Object.keys(FIXES).filter((k) => fixState(S, k) !== 'none').map((k) => {
      const F = FIXES[k]; const st = fixState(S, k); const n = supporters(S, k); const who = F.backers.map((b) => CAST[b].name + ((S.support[k] || []).includes(b) ? ' ✓' : '')).join(', ');
      const label = { idea: 'idea: take it to Clover', proposal: n + ' of 2 backers', ready: F.approve === 'gil' ? 'ready for Gil' : 'ready for the town meeting', approved: 'approved', built: 'built', tabled: 'not this time' }[st];
      return `<div class="card"><b>${esc(F.name)}</b><span class="pill ${st}">${label}</span><div class="meta">${esc(F.what)}</div>${st === 'proposal' ? `<div class="meta">Ask: ${esc(who)}</div>` : ''}${F.also ? `<div class="meta also">Also helps: ${esc(F.also)}</div>` : ''}<div class="meta" style="font-style:italic">${esc(F.principle)}</div></div>`;
    }).join('');
    return rows || '<p class="lede">Nothing yet. When a place pinches, note it, or listen to people who mention what pinches them.</p>';
  }
  // ---------- phone ----------
  openPhone() { this.phoneEl.hidden = false; this.renderPhone(); this.G.audio.sfx('phone'); }
  closePhone() { this.phoneEl.hidden = true; this.G.audio.sfx('back'); }
  phoneTabs() {
    const S = this.G.S; const tabs = [['today', 'Today', '☰'], ['map', 'Map', '◉'], ['lantern', 'Lantern', '✦'], ['fix', 'Fix-It', '✎'], ['texts', 'Texts', '✉']];
    if (S.blend.has && !S.blend.deleted) tabs.splice(1, 0, ['blend', 'Blend', 'b']);
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
    const del = this.phoneEl.querySelector('#del'); if (del) del.onclick = () => { if (del.dataset.sure) { G.deleteBlend(); this.renderPhone(); } else { del.dataset.sure = '1'; del.textContent = 'Yes, delete it'; this.phoneEl.querySelector('#delwarn').hidden = false; } };
    on('#maptoggle', () => { this.mapAll = !this.mapAll; this.renderPhone(); });
    this.phoneEl.querySelectorAll('[data-sub]').forEach((b) => { b.onclick = () => { this.lanSub = b.dataset.sub; this.personOpen = null; this.G.audio.sfx('select'); this.renderPhone(); }; });
    this.phoneEl.querySelectorAll('[data-person]').forEach((b) => { b.onclick = () => { this.personOpen = b.dataset.person; this.G.audio.sfx('page'); this.renderPhone(); }; });
    on('#pback', () => { this.personOpen = null; this.renderPhone(); });
    on('#pway', () => { this.G.togglePhone(true); this.G.showWay(); });
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
    return `<h3>${DAYNAME[S.day] || 'Today'}</h3>${obj && obj.t ? `<div class="nowcard"><div class="nl">Now</div><div>${esc(obj.t)}</div>${obj.at ? `<button class="btn primary" id="pway">${ICON.way} Show me the way</button>` : ''}</div>` : ''}<div class="goals">${this.goalsHtml()}</div>${gear}<p class="small">Energy ${Math.round(S.energy)} of ${S.maxE} today. ${S.coins} coins.${S.burnout ? ' You woke up running on less.' : ''}</p>`;
  }
  mapSvg(S) {
    const all = !!this.mapAll; const tf = all ? townFit(S.fixes) : null;
    const col = (v) => (v < 0.12 ? '#9fd3b0' : v < 0.3 ? '#f6cf5b' : '#f2a99a');
    const colAll = (v) => `hsl(${Math.round(v * 120)}, 55%, 72%)`;
    const zs = ZONES.map((z) => { const r = z.rect; const v = all ? (tf.by[z.id] != null ? tf.by[z.id] : 0.5) : pinch(S, z.id, S.min).total; const fill = all ? colAll(v) : col(v); return `<rect x="${r[0] * 5}" y="${r[1] * 5}" width="${(r[2] - r[0]) * 5 - 3}" height="${(r[3] - r[1]) * 5 - 3}" rx="10" fill="${fill}" opacity="0.92"/><text x="${(r[0] + r[2]) * 2.5}" y="${(r[1] + r[3]) * 2.5}" text-anchor="middle" font-size="11" fill="#2b2530">${esc(z.name)}</text>` + (all ? `<text x="${(r[0] + r[2]) * 2.5}" y="${(r[1] + r[3]) * 2.5 + 13}" text-anchor="middle" font-size="10" fill="#2b2530">${Math.round((tf.by[z.id] || 0) * 100)}% get by</text>` : ''); }).join('');
    const roads = this.G.town.mapRoads ? this.G.town.mapRoads().map(([x0, z0, x1, z1]) => `<line x1="${x0 * 5}" y1="${z0 * 5}" x2="${x1 * 5}" y2="${z1 * 5}" stroke="#fbf6ee" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`).join('') : '';
    const route = this.G.routeSvg ? this.G.routeSvg() : '';
    const ppl = this.G.npcDots().map((d) => `<circle cx="${d.x * 5}" cy="${d.z * 5}" r="5.5" fill="${d.color}" stroke="#2b2530" stroke-width="1.5"/><text x="${d.x * 5 + 8}" y="${d.z * 5 + 4}" font-size="10" fill="#2b2530">${esc(d.name)}</text>`).join('');
    const me = this.G.playerDot();
    const youDot = me ? `<circle cx="${me.x * 5}" cy="${me.z * 5}" r="7" fill="${S.look.color}" stroke="#fff" stroke-width="2.5"/>` : '';
    return zs + roads + route + ppl + youDot;
  }
  tab_map(S) {
    const all = !!this.mapAll;
    return `<h3>Larkspur</h3><svg class="map" viewBox="0 0 320 240">${this.mapSvg(S)}</svg><div class="legend">${all ? 'Share of 1,000 simulated residents, each with a random profile, who get through each place without a struggle.' : `<span><i style="background:#9fd3b0"></i>fits you</span><span><i style="background:#f6cf5b"></i>pinches a little</span><span><i style="background:#f2a99a"></i>pinches a lot</span><span><i style="background:#ffcf7a"></i>your way</span>`}</div><button class="btn" id="maptoggle" style="width:100%">${all ? 'Show how it fits you, right now' : 'Show how it fits a thousand residents'}</button>`;
  }
  // Lantern: a guide to the people of Larkspur that you fill by asking and listening, plus notes and reads
  tab_lantern(S) {
    const sub = this.lanSub || 'people';
    const n = Object.keys(S.notes || {}).length;
    const seg = `<div class="seg"><button data-sub="people" class="${sub === 'people' ? 'on' : ''}">People</button><button data-sub="notes" class="${sub === 'notes' ? 'on' : ''}">Notes${n ? ' · ' + n : ''}</button><button data-sub="reads" class="${sub === 'reads' ? 'on' : ''}">Reads</button></div>`;
    return `<h3>Lantern</h3>${seg}` + (sub === 'people' ? this.peopleHtml(S) : sub === 'notes' ? this.notesHtml(S) : this.readsHtml(S));
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
    const rows = ['over', 'under', 'no', 'helps'].map((sl) => `<div class="slot ${k[sl] ? 'on' : ''}"><span>${SLOT_LABEL[sl]}</span><div>${k[sl] ? esc(P[sl]) : '<i>Ask, listen, or notice.</i>'}</div></div>`).join('');
    const rv = (S.revealed || {})[id] === 'seen';
    return `${back}<div class="phead"><img src="${this.face(id, S)}" alt=""><div><h4>${esc(CAST[id].name)}</h4><span class="small">${esc(CAST[id].role)}</span></div></div>${rows}${k.love ? `<div class="slot love on"><span>Something they love</span><div>${esc(P.love)}</div></div>` : ''}${rv ? `<div class="revealbox"><span>How ${esc(CAST[id].name)} bends</span><p>${esc(P.reveal)}</p></div>` : `<p class="small">${this.G.story.known(id) >= 3 ? '' : 'Fill three lines to see how ' + esc(CAST[id].name) + ' bends.'}</p>`}`;
  }
  notesHtml(S) {
    const seen = S.notes || {}; const found = FIELD_NOTES.filter((n) => seen[n.id]);
    const pond = S.pond || {}; const pondHtml = Object.keys(pond).length ? `<div class="pondguide"><b>Pond guide · ${Object.keys(pond).length} of ${FISH.length}</b><div>${FISH.map((f) => `<span class="${pond[f.id] ? 'on' : ''}" style="--c:${f.col}">${pond[f.id] ? esc(f.name) : '??? <i>' + esc(f.hint || '') + '</i>'}</span>`).join('')}</div></div>` : '';
    return `<p class="small" style="margin-top:6px">Larkspur is made up. The ideas under it are not. Notes appear here after something in the game has happened to you.</p>${pondHtml}` + (found.length ? found.map((n) => `<div class="note sm"><div class="tag">${esc(n.tag)}</div><h5>${esc(n.title)}</h5><p>${esc(n.text)}</p><div class="src">${esc(n.src)}</div></div>`).join('') : '<p>No notes yet.</p>') + `<p class="small">${FIELD_NOTES.length - found.length} more to find.</p>`;
  }
  readsHtml(S) {
    const rows = Object.entries(S.lantern.entries).map(([k, e]) => { const H = HINTS[k]; const res = e.result ? (e.result === 'right' || e.result === 'asked' ? '<span class="ok">✓</span>' : '<span class="no">✗</span>') : '…'; return `<tr><td><b>${esc(CAST[H.by].name)}</b><br>"${esc(H.t)}"</td><td>${esc(e.reading)}<br>${res} ${e.result ? esc(e.result === 'wrong' ? 'Not quite: ' + (H.truth === 'literal' ? H.literal : H.between) : 'Confirmed') : '<span class="soft">waiting to see</span>'}</td></tr>`; }).join('');
    const learned = Object.keys(S.lantern.learned).filter((k) => S.lantern.learned[k]).map((k) => CAST[k].name);
    return `<p class="small" style="margin-top:6px">What people meant, checked against what you guessed. Lantern only learns from what you have actually seen, and it never guesses for you.${learned.length ? ' It has learned how ' + esc(learned.join(' and ')) + ' talk.' : ''}</p>` + (rows ? `<table class="lantable">${rows}</table>` : '<p>No reads yet.</p>');
  }
  // a reveal: how someone you got to know bends too
  postcard(d) {
    const p = this.openPanel('center postcard', `<div class="pc"><img src="${d.img}" alt=""><div class="pct"><div class="tday">A moment with ${esc(d.name)}</div><p>${esc(d.text)}</p>${d.first ? '<p class="pcfirst">Everyone bends somewhere. Even the people who look like they fit.</p>' : ''}</div></div><div class="pfoot"><button class="btn primary" id="pck">Keep this</button></div>`);
    this.G.audio.sfx('page');
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; p.querySelector('#pck').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 300); if (FAST) setTimeout(go, 30); });
  }
  tab_fix(S) { return `<h3>Fix-It</h3><div class="list">${this.proposals(S)}</div>`; }
  tab_texts(S) { return '<h3>Texts</h3>' + (this.G.texts.slice().reverse().map(([w, t]) => `<div class="msg"><b>${esc(w)}</b>${esc(t)}</div>`).join('') || '<p>No messages.</p>'); }
  tab_blend(S) {
    const B = S.blend; const board = BLEND.board.map(([n, v]) => [n, v]).concat([[S.name + ' (you)', B.score]]).sort((a, b) => b[1] - a[1]);
    return `<div class="blendapp"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-family:var(--display);color:#d0457f">blend</b><span class="streak">🔥 ${B.streak} day streak</span></div><div class="score">${B.score}</div><div style="color:#b06090;font-size:13.5px">Calm score · top ${Math.max(3, 60 - Math.round(B.score / 6))}% of Larkspur</div>
      <div class="feedmount"></div>
      <div class="toggle"><div><b style="font-family:var(--display)">Smooth Mode</b><div style="font-size:12.5px;color:#9a6a86">We handle the awkward parts for you. 15 Calm each time.</div></div><button class="switch ${B.smooth ? 'on' : ''}" id="smooth" aria-label="Smooth Mode"></button></div>
      ${this.G.dropReady() ? '<button class="btn" id="drop" style="width:100%;background:linear-gradient(120deg,#ff4f9a,#ff9a5c);color:#fff">Open your daily prize drop!</button>' : ''}
      <div class="bl-h">BADGES</div>${B.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('') || '<span style="font-size:13px;color:#9a6a86">None yet! Smooth something to earn one.</span>'}
      <div class="bl-h">LEADERBOARD</div>${board.map(([n, v]) => `<div class="lb-row ${n.includes('(you)') ? 'me' : ''}"><span>${esc(n)}</span><span>${v}</span></div>`).join('')}
      <div style="margin-top:18px;text-align:center"><button class="btn" id="del" style="font-size:13px">Delete Blend</button><p id="delwarn" hidden style="font-size:13px;color:#9a6a86">${esc(BLEND.delete)}</p></div></div>`;
  }
  // ---------- settings ----------
  settings(fromTitle) {
    const s = this.set; const sel = (k, opts) => `<div class="chips" data-k="${k}">${opts.map(([v, n]) => `<button class="chip ${String(s[k]) === String(v) ? 'on' : ''}" data-v="${v}">${n}</button>`).join('')}</div>`;
    const p = this.openPanel('center settings', `<h2>Settings</h2><p class="lede">The game is paused while this is open.</p>
      <h4>Pace of tasks</h4>${sel('pace', [['steady', 'Steady'], ['calm', 'Calm: no timer']])}
      <h4>Guidance</h4>${sel('guide', [['full', 'Full'], ['light', 'Just the marker'], ['off', 'Off']])}
      <h4>Screen effects</h4><div class="rowset"><span>How strongly places press on the screen</span><input type="range" min="0" max="100" value="${Math.round(s.fx * 100)}" id="fx"></div>
      <h4>Motion</h4>${sel('reduceMotion', [[false, 'Full'], [true, 'Reduced']])}
      <h4>Flicker</h4>${sel('flicker', [[true, 'On'], [false, 'Off']])}<p class="small">One faulty light at the Works dips now and then. Off keeps it steady.</p>
      <h4>Text speed</h4>${sel('textSpeed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']])}
      <h4>Text size</h4>${sel('textSize', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']])}
      <h4>Pushing through</h4>${sel('holdToBend', [[true, 'Hold or tap'], [false, 'Instant']])}
      <h4>Blend's nudges</h4>${sel('blendPings', [[true, 'On'], [false, 'Off']])}<p class="small">Blend is an app inside the story. Its nudges never leave the game.</p>
      <h4>Sound</h4><div class="rowset"><span>Everything</span><input type="range" min="0" max="100" id="vmaster" value="${Math.round(this.G.audio.vol.master * 100)}"><span>Music</span><input type="range" min="0" max="100" id="vmusic" value="${Math.round(this.G.audio.vol.music * 100)}"><span>Places</span><input type="range" min="0" max="100" id="vamb" value="${Math.round(this.G.audio.vol.amb * 100)}"><span>Effects and voices</span><input type="range" min="0" max="100" id="vsfx" value="${Math.round(this.G.audio.vol.sfx * 100)}"></div>
      <h4>Graphics</h4>${sel('quality', [['', 'Automatic'], ['high', 'Detailed'], ['low', 'Light']])}<p class="small">Graphics changes apply after reloading.</p>
      <div class="pfoot sticky"><button class="btn primary" id="sdone">Done</button></div>`);
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; const k = b.parentElement.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; if (v === 'false') v = false; s[k] = v; b.parentElement.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); this.G.audio.sfx('select'); this.G.applySettings(); });
    p.querySelector('#fx').oninput = (e) => { s.fx = e.target.value / 100; this.G.applySettings(); };
    for (const k of ['master', 'music', 'amb', 'sfx']) p.querySelector('#v' + k).oninput = (e) => { this.G.audio.vol[k] = e.target.value / 100; this.G.audio.applyVolumes(); };
    return new Promise((r) => {
      const close = () => { this.settingsClose = null; this.closePanel(); this.G.saveSettings(); r(); if (fromTitle) this.title().then(this.G.titleResolve); };
      this.settingsClose = close; p.querySelector('#sdone').onclick = close;
    });
  }
  // ---------- the morning card ----------
  today(d) {
    const items = d.items.map((it, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(it.t)}</b>${it.sub ? `<div class="meta">${esc(it.sub)}</div>` : ''}</div></li>`).join('');
    const p = this.openPanel('center today', `<div class="pin"></div><div class="tday">${esc(d.day)}</div><h2>${esc(d.title)}</h2><ol class="tlist">${items}</ol>${d.note ? `<p class="tnote">${esc(d.note)}</p>` : ''}<div class="pfoot"><button class="btn primary" id="tgo">Head out</button></div>`);
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; p.querySelector('#tgo').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 250); });
  }
  // ---------- the evening page: what happened, without a score ----------
  evening(d) {
    const resp = [['bend', 'Bent'], ['gear', 'Gear'], ['ask', 'Asked'], ['fix', 'Noted a fix'], ['leave', 'Left']].map(([k, n]) => `<div class="ev-r ${k} ${d.counts[k] ? '' : 'zero'}"><div class="ic">${ICON[k]}</div><b>${d.counts[k] || 0}</b><span>${n}</span></div>`).join('');
    const marbles = d.jar.map((m) => `<i style="--c:${m.c}" title="${esc(m.t)}"></i>`).join('') + '<i class="empty"></i>'.repeat(Math.max(0, d.jarMax - d.jar.length));
    const p = this.openPanel('center evening', `<div class="tday">${esc(d.day)} evening</div><h2>${esc(d.title)}</h2>
      <h4>Today, when a place did not fit</h4><div class="ev-row">${resp}</div>
      <h4>Kept moments</h4><div class="jarrow"><div class="jar">${marbles}</div><div class="jt">${d.jarText}</div></div>
      ${d.news.length ? `<h4>Around town</h4><ul class="ev-news">${d.news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${d.open ? `<h4>Still open</h4><p class="ev-open">${esc(d.open)}</p>` : ''}
      ${d.tomorrow.length ? `<h4>Tomorrow</h4><ul class="ev-news">${d.tomorrow.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="pfoot"><button class="btn primary" id="sleep">Sleep</button></div>`);
    return new Promise((r) => { const go = () => { window.removeEventListener('keydown', kh); this.closePanel(); r(); }; const kh = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }; p.querySelector('#sleep').onclick = go; setTimeout(() => window.addEventListener('keydown', kh), 300); });
  }
  ending(d) {
    const p = this.openPanel('ending', `<div class="wrap"><div class="portraits"><figure><img src="${d.before}" alt="You on day one">You on day one</figure><figure><img src="${d.after}" alt="You tonight">You tonight</figure></div>
      <h1>${esc(d.title)}</h1><p class="lead">${esc(d.text)}</p><ul class="fates">${d.fates.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <div class="qs">${d.questions.map(esc).join('<br>')}</div>
      <div class="row"><button class="btn primary" id="notes">What was this about?</button><button class="btn" id="again">Play again</button></div><div id="noteslist"></div></div>`);
    p.querySelector('#again').onclick = () => location.reload();
    p.querySelector('#notes').onclick = () => {
      const notes = d.notes || FIELD_NOTES;
      p.querySelector('#noteslist').innerHTML = `<p class="nl-intro">Larkspur is made up. The ideas under it are not. Here is what the game was built on, with how strong the evidence is.</p>` + notes.map((n) => `<div class="note ${n.seen ? 'seen' : ''}"><div class="tag">${esc(n.tag)}${n.seen ? ' · you found this one' : ''}</div><h5>${esc(n.title)}</h5><p>${esc(n.text)}</p><div class="src">${esc(n.src)}</div></div>`).join('');
      p.querySelector('#notes').hidden = true; p.querySelector('#noteslist').scrollIntoView({ behavior: 'smooth' });
    };
    return new Promise(() => {});
  }
}
