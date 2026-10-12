// Menus that sit above everything else: pause, settings, the comfort check, what's in this game, support, save
// codes, "Played before?" and key remapping. They share one overlay, own the keyboard while open (a capture-phase
// listener stops keys reaching the game), and the clock stops underneath them.
import { esc } from './util.js';
import * as SAVE from './save.js';
import { offerFile, readPicked } from './files.js';
import { SUPPORT, CONTENT_NOTES, INGREDIENTS } from './notes.js';

// actions the player can rebind, with their default physical keys (e.code, so they follow position, not letter)
export const ACTIONS = [
  ['interact', 'Talk, or use something', 'KeyE'], ['phone', 'Phone', 'KeyP'], ['look', 'Raise your lantern (look again)', 'KeyL'], ['way', 'Show the way', 'KeyG'],
  ['headphones', 'Headphones on or off', 'KeyH'], ['shades', 'Shades on or off', 'KeyJ'], ['smooth', 'Smooth Mode (if you have Blend)', 'KeyB'], ['comfort', 'Your comfort move, in tasks', 'KeyC'],
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(([k, , c]) => [k, c]));
const NAMED = { Space: 'Space', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=', Backslash: '\\', Tab: 'Tab', Enter: 'Enter' };
export function keyLabel(code) {
  if (!code) return '?'; let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^(?:Digit|Numpad)(\d)$/.exec(code); if (m) return m[1];
  return NAMED[code] || code.replace(/^Arrow/, '');
}
// which action, if any, this key press means (movement keys and Esc are handled by the game itself)
export function actionOf(keys, e) { const code = e.code || ''; for (const [a] of ACTIONS) if ((keys && keys[a] || DEFAULT_KEYS[a]) === code) return a; return null; }

const chips = (s, k, opts) => `<div class="chips" data-k="${k}" role="radiogroup">${opts.map(([v, n]) => `<button class="chip ${String(s[k]) === String(v) ? 'on' : ''}" data-v="${v}" role="radio" aria-checked="${String(s[k]) === String(v)}">${esc(n)}</button>`).join('')}</div>`;

export class Menus {
  constructor(G, ui) {
    this.G = G; this.ui = ui; this.stack = [];
    this.el = document.createElement('div'); this.el.id = 'overlay'; this.el.hidden = true; this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-modal', 'true');
    ui.root.appendChild(this.el);
    // the overlay owns the keyboard while it is open
    window.addEventListener('keydown', (e) => this.key(e), true);
  }
  get open() { return this.stack.length > 0; }
  key(e) {
    if (!this.open) return;
    const top = this.stack[this.stack.length - 1];
    if (top.capture) { e.preventDefault(); e.stopImmediatePropagation(); top.capture(e); return; }
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (top.onEscape) top.onEscape(); else this.back(); return; }
    // keep Tab inside the overlay
    if (e.key === 'Tab') {
      const f = [...this.el.querySelectorAll('button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  // show a screen; screens stack, so Back returns to the one underneath
  push(name, render, o = {}) {
    const entry = Object.assign({ name, render }, o); this.stack.push(entry); this.draw(); return entry;
  }
  draw() {
    const top = this.stack[this.stack.length - 1]; if (!top) { this.el.hidden = true; this.el.innerHTML = ''; return; }
    this.el.hidden = false; this.el.className = 'ov ' + top.name;
    this.el.innerHTML = `<div class="ovcard" tabindex="-1">${top.render()}</div>`;
    // the dialog is named by its heading, for screen readers
    const h = this.el.querySelector('.ovcard h2'); if (h) { h.id = 'ovtitle'; this.el.setAttribute('aria-labelledby', 'ovtitle'); this.el.removeAttribute('aria-label'); } else { this.el.removeAttribute('aria-labelledby'); this.el.setAttribute('aria-label', top.name); }
    if (top.bind) top.bind(this.el);
    const back = this.el.querySelector('[data-back]'); if (back) back.onclick = () => this.back();
    const first = this.el.querySelector(top.focus || '.ovcard button, .ovcard textarea, .ovcard input'); if (first && !this.ui.touch) first.focus(); else this.el.querySelector('.ovcard').focus();
    this.G.audio.sfx('page');
  }
  back() { const top = this.stack.pop(); if (top && top.onClose) top.onClose(); this.draw(); if (!this.open && this.onEmpty) { const f = this.onEmpty; this.onEmpty = null; f(); } }
  closeAll() { while (this.stack.length) { const t = this.stack.pop(); if (t.onClose) t.onClose(); } this.draw(); }

  // ---------- pause ----------
  pause() {
    if (this.open) return;
    const G = this.G; const inVisit = G.S.day >= 1;
    this.push('pause', () => `<h2>Paused</h2><p class="lede">The town waits while this is open.</p>
      <div class="ovlist"><button class="btn primary" data-back>Resume</button><button class="btn" id="pSet">Settings</button>${inVisit ? '<button class="btn" id="pCode">Play on another device</button>' : ''}<button class="btn" id="pIn">What's in this game</button><button class="btn" id="pSup">Support</button><button class="btn" id="pQuit">Quit to the title</button></div>
      <p class="small">${esc(G.saveNote ? G.saveNote() : '')}</p>`, {
      bind: (el) => {
        el.querySelector('#pSet').onclick = () => this.settings();
        const c = el.querySelector('#pCode'); if (c) c.onclick = () => this.saveCode();
        el.querySelector('#pIn').onclick = () => this.contentNotes();
        el.querySelector('#pSup').onclick = () => this.support();
        el.querySelector('#pQuit').onclick = () => this.confirmQuit();
      },
    });
  }
  confirmQuit() {
    this.push('confirm', () => `<h2>Quit to the title?</h2><p>${esc(this.G.saveNote ? this.G.saveNote() : 'Your visit is saved each morning.')}</p><div class="ovlist"><button class="btn primary" id="qYes">Quit to the title</button><button class="btn" data-back>Stay</button></div>`, {
      bind: (el) => { el.querySelector('#qYes').onclick = () => location.reload(); },
    });
  }
  // ---------- settings ----------
  settings() {
    const G = this.G, s = G.settings; const a = G.audio;
    const remap = ACTIONS.map(([k, label]) => `<div class="keyrow"><span>${esc(label)}</span><button class="chip keybtn" data-act="${k}" aria-label="${esc(label)}: ${esc(keyLabel((s.keys || {})[k] || DEFAULT_KEYS[k]))}. Press to change.">${esc(keyLabel((s.keys || {})[k] || DEFAULT_KEYS[k]))}</button></div>`).join('');
    const lookBtn = G.look && G.look.unlocked ? '<button class="btn" id="sLook">Look again at this page</button>' : '';
    this.push('settings', () => `<h2>Settings</h2><p class="lede">The game is paused while this is open. Everything here is saved on this device.</p>
      <h3 class="sec">Tasks</h3><div class="rowset2"><span>Pace</span>${chips(s, 'pace', [['steady', 'Steady'], ['calm', 'Calm: no timer']])}<span>Interruptions</span>${chips(s, 'interrupts', [['usual', 'Usual'], ['fewer', 'Fewer']])}<span>Pushing through</span>${chips(s, 'holdToBend', [[true, 'Hold or tap'], [false, 'Instant']])}</div>
      <h3 class="sec">Seeing and hearing</h3><div class="rowset2"><span>Mood tint</span>${chips(s, 'moodTint', [['gentle', 'Gentle'], ['off', 'Off']])}<span>Pinch strip</span>${chips(s, 'pinchStrip', [[true, 'On'], [false, 'Off']])}<span>Motion</span>${chips(s, 'reduceMotion', [[false, 'Full'], [true, 'Reduced']])}<span>Feedback</span>${chips(s, 'calmFx', [[false, 'Lively'], [true, 'Calm']])}<span>The Works' faulty light</span>${chips(s, 'flicker', [[false, 'Steady'], [true, 'Flickers now and then']])}<span>Captions for sounds</span>${chips(s, 'captions', [[true, 'On'], [false, 'Off']])}<span>Comfort move sound</span>${chips(s, 'comfortSound', [[true, 'On'], [false, 'Off']])}</div>
      <p class="small">The mood tint is a slight, slow color shift when a place pinches your creature. Off also keeps the world's colors steady when your creature fades.</p>
      <h3 class="sec">Reading</h3><div class="rowset2"><span>Text speed</span>${chips(s, 'textSpeed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']])}<span>Text size</span>${chips(s, 'textSize', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']])}</div>
      <h3 class="sec">Guides</h3><div class="rowset2"><span>Guidance</span>${chips(s, 'guide', [['full', 'Full'], ['light', 'Just the marker'], ['off', 'Off']])}<span>Lantern's voice</span>${chips(s, 'lanternVoice', [[true, 'On'], [false, 'Off']])}<span>Blend's nudges</span>${chips(s, 'blendPings', [[true, 'On your creature'], [false, 'Off']])}</div>
      <h3 class="sec">Content</h3><div class="rowset2"><span>Card packs</span>${chips(s, 'packs', [['show', 'Show'], ['summary', 'Summarize']])}<span>Blend's feed</span>${chips(s, 'feedContent', [['show', 'Show'], ['summary', 'Summarize']])}<span>Rue's hardest scenes</span>${chips(s, 'rueScenes', [['show', 'Show'], ['summary', 'Summarize']])}</div>
      <h3 class="sec">Sound</h3><div class="rowset"><span>Everything</span><input type="range" min="0" max="100" id="vmaster" value="${Math.round(a.vol.master * 100)}" aria-label="Volume, everything"><span>Music</span><input type="range" min="0" max="100" id="vmusic" value="${Math.round(a.vol.music * 100)}" aria-label="Volume, music"><span>Places</span><input type="range" min="0" max="100" id="vamb" value="${Math.round(a.vol.amb * 100)}" aria-label="Volume, places"><span>Effects and voices</span><input type="range" min="0" max="100" id="vsfx" value="${Math.round(a.vol.sfx * 100)}" aria-label="Volume, effects and voices"></div>
      <h3 class="sec">Keys</h3><div class="keys">${remap}</div><p class="small">Move with WASD or the arrow keys. Esc pauses. Keys follow their position on the keyboard, so they work on any layout.</p><button class="btn" id="kReset">Reset keys</button>
      <h3 class="sec">Graphics</h3>${chips(s, 'quality', [['', 'Automatic'], ['high', 'Detailed'], ['low', 'Light']])}<p class="small">Graphics changes apply after reloading.</p>
      <div class="ovlist row"><button class="btn" id="sIn">What's in this game</button><button class="btn" id="sSup">Support</button>${lookBtn}</div>
      <div class="pfoot sticky"><button class="btn primary" data-back>Done</button></div>`, {
      bind: (el) => {
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]'); if (!b || !b.parentElement.dataset.k) return; const k = b.parentElement.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; if (v === 'false') v = false;
          s[k] = v; b.parentElement.querySelectorAll('[data-v]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); G.audio.sfx('select'); G.applySettings(); G.saveSettings();
        });
        for (const k of ['master', 'music', 'amb', 'sfx']) el.querySelector('#v' + k).oninput = (e) => { a.vol[k] = e.target.value / 100; a.applyVolumes(); s.vol = Object.assign({}, a.vol); G.saveSettings(); };
        el.querySelectorAll('.keybtn').forEach((b) => { b.onclick = () => this.rebind(b.dataset.act); });
        el.querySelector('#kReset').onclick = () => { s.keys = Object.assign({}, DEFAULT_KEYS); G.saveSettings(); this.stack.pop(); this.settings(); };
        el.querySelector('#sIn').onclick = () => this.contentNotes();
        el.querySelector('#sSup').onclick = () => this.support();
        const lk = el.querySelector('#sLook'); if (lk) lk.onclick = () => this.lookAtSettings();
      },
      onClose: () => { G.saveSettings(); },
    });
  }
  rebind(act) {
    const G = this.G, s = G.settings; const label = (ACTIONS.find((x) => x[0] === act) || [])[1] || act;
    this.push('rebind', () => `<h2>New key</h2><p>Press the key you want for <b>${esc(label)}</b>. Esc cancels.</p>`, {
      capture: (e) => {
        if (e.key === 'Escape') { this.back(); return; }
        const code = e.code; if (!code || /^(Arrow|Shift|Control|Alt|Meta)/.test(code) || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) return;
        s.keys = Object.assign({}, DEFAULT_KEYS, s.keys);
        // a key already in use swaps with this one, so no two actions ever share a key
        const other = Object.keys(s.keys).find((k) => k !== act && s.keys[k] === code); if (other) s.keys[other] = s.keys[act];
        s.keys[act] = code; G.saveSettings(); this.stack.pop(); this.stack.pop(); this.settings();
      },
    });
  }
  lookAtSettings() {
    this.push('lookset', () => `<h2>Look again: this page</h2><p class="ghostline">This game was made to fit someone with a mouse or a touchscreen, a screen they can see, hearing, English and time to read. Everything on the page underneath is a fix: for people who need it slower, quieter, steadier, bigger or different.</p><div class="pfoot"><button class="btn primary" data-back>Lower the lantern</button></div>`, { onClose: () => { try { this.G.story.sight && this.G.story.sight('settings', true); } catch (e) { /* fine */ } } });
  }
  // ---------- what's in this game, and support ----------
  contentNotes() {
    this.push('content', () => `<h2>${esc(CONTENT_NOTES.title)}</h2><ul class="cnotes">${CONTENT_NOTES.items.map((it) => `<li><b>${esc(it.label)}</b><span>${esc(it.detail || '')}</span></li>`).join('')}</ul><p>${esc(CONTENT_NOTES.notIn)}</p><p class="small">Settings can summarize the card packs, Blend's feed and Rue's hardest scenes, so they're told in a sentence instead of played.</p><div class="pfoot"><button class="btn" id="cSup">Support</button><button class="btn primary" data-back>Back</button></div>`, {
      bind: (el) => { el.querySelector('#cSup').onclick = () => this.support(); },
    });
  }
  support() {
    this.push('support', () => `<h2>${esc(SUPPORT.title)}</h2><ul class="cnotes">${SUPPORT.lines.map((l) => `<li><b>${esc(l.where)}</b><span>${esc(l.text)}</span></li>`).join('')}</ul><p>${esc(SUPPORT.footer)}</p><div class="pfoot"><button class="btn primary" data-back>Back</button></div>`);
  }
  ingredients() {
    this.push('content', () => `<h2>What keeps you playing</h2><p>${esc(INGREDIENTS)}</p><div class="pfoot"><button class="btn primary" data-back>Back</button></div>`);
  }
  // ---------- the comfort check: once, before the first visit ----------
  comfort() {
    const G = this.G, s = G.settings;
    return new Promise((resolve) => {
      this.push('comfort', () => `<h2>Before you start</h2><p class="lede">A few choices about how the game looks and sounds. You can change any of them later in Settings (Esc).</p>
        <div class="rowset2"><span>Text size</span>${chips(s, 'textSize', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']])}<span>Motion</span>${chips(s, 'reduceMotion', [[false, 'Full'], [true, 'Reduced']])}<span>Mood tint</span>${chips(s, 'moodTint', [['gentle', 'Gentle'], ['off', 'Off']])}<span>Feedback</span>${chips(s, 'calmFx', [[false, 'Lively: sparks and pops'], [true, 'Calm']])}<span>A faulty light at work</span>${chips(s, 'flicker', [[false, 'Steady'], [true, 'Flickers now and then']])}<span>Captions for sounds</span>${chips(s, 'captions', [[true, 'On'], [false, 'Off']])}<span>Pace of tasks</span>${chips(s, 'pace', [['steady', 'Steady'], ['calm', 'Calm: no timer']])}</div>
        <h3 class="sec">Sound</h3><div class="rowset"><span>Volume</span><input type="range" min="0" max="100" id="cvol" value="${Math.round(G.audio.vol.master * 100)}" aria-label="Volume"></div>
        <p class="small">Nothing in the game flashes more than three times a second, and no place is drawn louder or brighter because of how you set your room. Your creature shows how a place fits it.</p>
        <div class="ovlist row"><button class="btn" id="cIn">What's in this game</button><button class="btn" id="cKeys">Keys</button></div>
        <div class="pfoot"><button class="btn primary" id="cGo">Start</button></div>`, {
        focus: '#cGo',
        bind: (el) => {
          el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b || !b.parentElement.dataset.k) return; const k = b.parentElement.dataset.k; let v = b.dataset.v; if (v === 'true') v = true; if (v === 'false') v = false; s[k] = v; b.parentElement.querySelectorAll('[data-v]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); G.applySettings(); });
          el.querySelector('#cvol').oninput = (e) => { G.audio.vol.master = e.target.value / 100; G.audio.applyVolumes(); s.vol = Object.assign({}, G.audio.vol); };
          el.querySelector('#cIn').onclick = () => this.contentNotes();
          el.querySelector('#cKeys').onclick = () => this.settings();
          el.querySelector('#cGo').onclick = () => { s.comfortDone = true; G.saveSettings(); this.closeAll(); resolve(); };
        },
        onEscape: () => {},
      });
    });
  }
  // ---------- codes ----------
  async saveCode() {
    const G = this.G; const save = G.lastSave ? G.lastSave() : null;
    let code = ''; try { code = save ? await SAVE.makeSaveCode(save) : ''; } catch (e) { code = ''; }
    this.push('code', () => `<h2>Play on another device</h2><p>${code ? 'Your game saves on this device by itself. To carry it to another phone or computer, copy this code or save it as a file. There, choose <b>Played before?</b> on the title screen.' : 'There is nothing to carry yet. The game starts saving on your first morning in Larkspur.'}</p>${code ? `<p class="small">It holds your game as it was at ${esc(save.label || 'your last save')}. Your name is not in it.</p><textarea class="codebox" readonly rows="4" aria-label="Save code">${esc(code)}</textarea><div class="ovlist row"><button class="btn" id="cCopy">Copy the code</button><button class="btn" id="cFile">Save as a file</button></div><p class="small" id="cMsg" role="status"></p>` : ''}<div class="pfoot"><button class="btn primary" data-back>Back</button></div>`, {
      bind: (el) => {
        const ta = el.querySelector('.codebox'); if (ta) { ta.onfocus = () => ta.select(); }
        const msg = (t) => { const m = el.querySelector('#cMsg'); if (m) m.textContent = t; };
        const cp = el.querySelector('#cCopy'); if (cp) cp.onclick = async () => { let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { /* the frame may block the clipboard */ } if (!ok) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { /* fine */ } } cp.textContent = ok ? 'Copied' : 'Selected: copy it with your keyboard or menu'; };
        const fb = el.querySelector('#cFile'); if (fb) fb.onclick = async () => {
          fb.setAttribute('aria-disabled', 'true'); msg('');
          const r = await offerFile('made-to-fit-save.txt', code + '\n');
          fb.removeAttribute('aria-disabled');
          msg(r === 'saved' ? 'Saved as made-to-fit-save.txt.' : r === 'declined' ? 'Not saved.' : 'Saving a file isn\'t possible here. Copy the code instead.');
        };
      },
    });
  }
  // the code box for "Played before?": resolves with { save } or { carry } or null
  playedBefore() {
    return new Promise((resolve) => {
      let done = false; const fin = (v) => { if (done) return; done = true; resolve(v); };
      this.push('code', () => `<h2>Played before?</h2><p>Paste a save code (it starts with MTFS) or a visit code (it starts with MTF1), or open a save file.</p><textarea class="codebox" rows="5" aria-label="Your code" placeholder="MTF1-… or MTFS1…"></textarea><p class="codeerr" role="alert"></p><div class="pfoot"><button class="btn" data-back>Back</button><button class="btn" id="cOpen">Open a save file</button><input type="file" id="cFileIn" accept=".txt,text/plain" hidden><button class="btn primary" id="cUse">Use this code</button></div><div class="recapbox"><p><b>No code?</b> Start ten years later from a recap: make your creature, set your room, and choose six things about your first week. About two minutes.</p><button class="btn" id="cRecap">Start from a recap</button></div>`, {
        focus: '.codebox',
        bind: (el) => {
          el.querySelector('#cRecap').onclick = () => { fin({ recap: true }); this.closeAll(); };
          const fileIn = el.querySelector('#cFileIn');
          el.querySelector('#cOpen').onclick = () => { try { fileIn.value = ''; fileIn.click(); } catch (e) { el.querySelector('.codeerr').textContent = 'Opening files isn\'t possible here. Paste the code instead.'; } };
          fileIn.onchange = async () => { const t = await readPicked(fileIn.files && fileIn.files[0]); if (t == null) { el.querySelector('.codeerr').textContent = 'That file isn\'t a save file from this game.'; return; } el.querySelector('.codebox').value = t.trim(); el.querySelector('#cUse').click(); };
          el.querySelector('#cUse').onclick = async () => {
            const raw = el.querySelector('.codebox').value || ''; const err = el.querySelector('.codeerr');
            if (/MTFS/i.test(raw)) { const r = await SAVE.readSaveCode(raw); if (r.save) { fin({ save: r.save }); this.closeAll(); return; } err.textContent = { browser: 'This browser can\'t open that kind of code. Recent Chrome, Edge, Firefox or Safari can.', newer: 'That code is from a newer version of the game.' }[r.error] || 'That code doesn\'t look right. Check for a missing letter.'; return; }
            // a visit code, alone or inside whatever was pasted around it ("my code: MTF1-… thanks")
            let v = SAVE.decodeVisit(raw.trim());
            if (!v.carry) { const m = /MTF[0-9A-Z][^\n]*/i.exec(raw); if (m) { const toks = m[0].trim().split(/\s+/); for (let n = toks.length; n >= 1; n--) { const d = SAVE.decodeVisit(toks.slice(0, n).join(' ')); if (d.carry || (d.error === 'version' && n === toks.length)) { v = d; if (d.carry) break; } } } }
            if (v.carry) { fin({ carry: v.carry }); this.closeAll(); return; }
            err.textContent = v.error === 'version' ? 'That code is from a different version of the game.' : 'That code doesn\'t look right. Check for a missing letter.';
          };
        },
        onClose: () => fin(null),
      });
    });
  }
  // asks for a name after a code restored a visit without one
  askName(current) {
    return new Promise((resolve) => {
      this.push('code', () => `<h2>What's your creature called?</h2><p class="small">Codes never carry names. It stays on this device.</p><input type="text" id="nm" maxlength="14" value="${esc(current || '')}" autocomplete="off" aria-label="Your creature's name"><div class="pfoot"><button class="btn primary" id="nOk">That's me</button></div>`, {
        focus: '#nm', onEscape: () => {},
        bind: (el) => { const go = () => { const v = (el.querySelector('#nm').value || '').trim().replace(/[<>]/g, '').slice(0, 14) || 'Sam'; this.closeAll(); resolve(v); }; el.querySelector('#nOk').onclick = go; el.querySelector('#nm').onkeydown = (e) => { if (e.key === 'Enter') go(); }; },
      });
    });
  }
  confirm(title, text, yes, no) {
    return new Promise((resolve) => {
      this.push('confirm', () => `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="ovlist"><button class="btn primary" id="yYes">${esc(yes)}</button><button class="btn" id="yNo">${esc(no)}</button></div>`, {
        bind: (el) => { el.querySelector('#yYes').onclick = () => { this.closeAll(); resolve(true); }; el.querySelector('#yNo').onclick = () => { this.closeAll(); resolve(false); }; },
        onEscape: () => { this.closeAll(); resolve(false); },
      });
    });
  }
}
