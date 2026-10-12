// The first day, as one story that holds the whole game in about twelve minutes:
//   Home Row: raise Wren's lantern, tag what pinches, hang your porch lantern, and a wave of colour rolls out.
//   Market Square: every fix costs someone. Listen to Moss and to Pomeroy, sketch it so both fit, build it.
//   The Works: Bea's cart meets three steps. Argue for a ramp at a hearing, with the cards you've gathered.
//   Lantern night: the guests you made room for, the lantern tuned to the Standard (nobody fits it), and the day's
//   rewards sorted into the ones that pointed at something real and the ones that pointed at the hook.
// The slice is a state machine kept in S.slice, so a save mid-day picks up where it was. Days two and three follow.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST, SETUP } from './content.js';
import { START } from './color.js';
import { STREETS, MARKS } from './marks.js';
import { Hearing, RAMP, CARDS } from './hearing.js';
import { HOOKS, HOOK_ORDER } from './hooks.js';
import { HOOK_SVG } from './fx.js';
import { Blueprint } from './games/blueprint.js';
import { clamp, sleep, FAST, esc, fmtTime } from './util.js';

const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});
const T = { home: [9.5, 37.7], porch: [9.5, 37.4], cart: [25.9, 28.9], works: [12.6, 14.6], hall: [32, 14.1], kiosk: [37.3, 29.6], bea: [22.4, 38.0] };
// the latest the clock may run to in each part of the day: the day waits for you
const CAP = { wake: 540, homerow: 620, porch: 620, tomarket: 780, market: 790, moss: 790, rue: 900, works: 900, gil: 900, hearing: 920, tonight: 1150, night: 1200 };
export const GUESTS = {
  wren: { gift: 'a new lantern, still warm', from: [40, 45] },
  bea: { gift: 'lemon cake', from: [24, 40] },
  moss: { gift: 'a pot of tea', from: [20, 45] },
  pomeroy: { gift: 'a bag of apples', from: [20, 45] },
  pip: { gift: 'warm bread rolls', from: [2, 40] },
  gil: { gift: 'a folding chair, for anyone who wants it', from: [2, 40] },
  rue: { gift: 'a playlist (no ads)', from: [20, 45] },
  hollis: { gift: 'a speech, mercifully short', from: [2, 40] },
};
const SPOTS = [[7.6, 39.4], [11.4, 39.4], [6.4, 40.9], [12.6, 40.9], [8.4, 41.9], [10.6, 41.9], [5.4, 39.0], [13.6, 39.0]];
const PICS = {
  lamp: ['<svg viewBox="0 0 48 48"><path d="M16 30h16l-4-14h-8z" fill="#e9dcc5" stroke="#5a4630" stroke-width="2"/><path d="M24 30v8M18 38h12" stroke="#5a4630" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="31" r="3" fill="#ffcf7a" opacity="0.5"/></svg>', '<svg viewBox="0 0 48 48"><path d="M16 30h16l-4-14h-8z" fill="#fff4d0" stroke="#5a4630" stroke-width="2"/><path d="M24 30v8M18 38h12" stroke="#5a4630" stroke-width="2.4" stroke-linecap="round"/><path d="M24 4v6M8 12l4 4M40 12l-4 4M5 26h6M37 26h6" stroke="#e9a923" stroke-width="2.6" stroke-linecap="round"/></svg>'],
  radio: ['<svg viewBox="0 0 48 48"><path d="M10 19h7l9-7v24l-9-7h-7z" fill="#e9dcc5" stroke="#5a4630" stroke-width="2" stroke-linejoin="round"/><path d="M31 21q2 3 0 6" fill="none" stroke="#5a4630" stroke-width="2.4" stroke-linecap="round"/></svg>', '<svg viewBox="0 0 48 48"><path d="M8 19h7l9-7v24l-9-7H8z" fill="#ffd9c9" stroke="#5a4630" stroke-width="2" stroke-linejoin="round"/><path d="M29 20q3 4 0 8M33 16q6 8 0 16M37 12q9 12 0 24" fill="none" stroke="#d9603b" stroke-width="2.4" stroke-linecap="round"/></svg>'],
  sign: ['<svg viewBox="0 0 48 48"><rect x="12" y="8" width="24" height="34" rx="2" fill="#e9dcc5" stroke="#5a4630" stroke-width="2"/><path d="M36 8l-10 4v34l10-4z" fill="#9fd3b0" stroke="#5a4630" stroke-width="2" stroke-linejoin="round"/><circle cx="29" cy="27" r="1.6" fill="#5a4630"/></svg>', '<svg viewBox="0 0 48 48"><rect x="12" y="8" width="24" height="34" rx="2" fill="#c9b8a6" stroke="#5a4630" stroke-width="2"/><rect x="16" y="16" width="16" height="9" rx="2" fill="#fbf6ee" stroke="#5a4630" stroke-width="1.6"/><path d="M19 20.5h10" stroke="#5a4630" stroke-width="1.6" stroke-linecap="round"/><circle cx="31" cy="30" r="1.6" fill="#5a4630"/></svg>'],
  note: ['<svg viewBox="0 0 48 48"><path d="M8 12h32v18H22l-8 7v-7H8z" fill="#e9f2fb" stroke="#3f5a87" stroke-width="2" stroke-linejoin="round"/><path d="M24 15v8" stroke="#3f5a87" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="26.5" r="1.7" fill="#3f5a87"/></svg>', '<svg viewBox="0 0 48 48"><path d="M8 12h32v18H22l-8 7v-7H8z" fill="#f3eadb" stroke="#6c5c9e" stroke-width="2" stroke-linejoin="round"/><circle cx="17" cy="21" r="2" fill="#6c5c9e"/><circle cx="24" cy="21" r="2" fill="#6c5c9e"/><circle cx="31" cy="21" r="2" fill="#6c5c9e"/></svg>'],
  clock: ['<svg viewBox="0 0 48 48"><path d="M6 34h36" stroke="#5a4630" stroke-width="2.4" stroke-linecap="round"/><path d="M14 34a10 10 0 0 1 20 0" fill="#ffcf7a" stroke="#d9822b" stroke-width="2"/><path d="M24 14v5M11 20l3 3M37 20l-3 3" stroke="#d9822b" stroke-width="2.4" stroke-linecap="round"/></svg>', '<svg viewBox="0 0 48 48"><circle cx="24" cy="20" r="9" fill="#ffe08a" stroke="#d9822b" stroke-width="2"/><path d="M24 4v4M24 32v4M8 20h4M36 20h4M12.7 8.7l2.8 2.8M32.5 28.5l2.8 2.8M35.3 8.7l-2.8 2.8M15.5 28.5l-2.8 2.8" stroke="#d9822b" stroke-width="2.2" stroke-linecap="round"/><path d="M6 42h36" stroke="#5a4630" stroke-width="2.4" stroke-linecap="round"/></svg>'],
  calendar: ['<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="30" rx="3" fill="#fbf6ee" stroke="#5a4630" stroke-width="2"/><path d="M8 18h32M16 6v8M32 6v8" stroke="#5a4630" stroke-width="2.2" stroke-linecap="round"/><path d="M14 25h6M24 25h10M14 31h10M28 31h6" stroke="#3f5a87" stroke-width="2.4" stroke-linecap="round"/></svg>', '<svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="30" rx="3" fill="#fbf6ee" stroke="#5a4630" stroke-width="2"/><path d="M8 18h32M16 6v8M32 6v8" stroke="#5a4630" stroke-width="2.2" stroke-linecap="round"/><path d="M20 26q0-4 4-4t4 4q0 3-4 4v2" fill="none" stroke="#c77dba" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="36" r="1.5" fill="#c77dba"/></svg>'],
};

export class Slice {
  constructor(story) { this.st = story; this.G = story.G; }
  get S() { return this.G.S; }
  get ui() { return this.G.ui; }
  get on() { const S = this.S; return !!(S && S.v2 && (S.act || 1) === 1 && S.day === 1 && !this.st.ret && S.slice && S.slice.stage !== 'done'); }
  get stage() { return (this.S.slice || {}).stage || 'wake'; }
  set stage(v) { this.S.slice.stage = v; this.G.story.autoSoon(); }
  // a brand-new game gets the first day as a slice, and the town its colours to win back
  init() {
    const S = this.S; S.v2 = 1; S.color = Object.assign({}, START); S.slice = { stage: 'wake' }; S.guests = {}; S.cards = {}; S.marks = {};
    // Wren went round before you arrived and tagged one thing in each street (and the Standard's room has those clues)
    S.sights = Object.assign(S.sights || {}, { doors: 1, memo: 1 });
    S.flags.escort = 1; S.flags.shift1 = 1; S.flags.coached = 1;
  }
  say(who, t) { return this.st.say(who, t); }
  gut(t) { return this.st.gut(t); }
  note(t) { return this.st.note(t); }
  choose(opts, o) { return this.st.choose(opts, o); }
  frame(id) { this.G.talkFrame(id); this.ui.letterbox(true); }
  unframe() { this.ui.hideDialog(); this.ui.letterbox(false); this.G.endTalk(); }
  card(id) {
    const S = this.S; S.cards = S.cards || {}; if (S.cards[id] || !CARDS[id]) return; S.cards[id] = S.day || 1;
    const c = CARDS[id];
    const label = c.kind === 'insight' ? 'Insight' : c.kind === 'deal' ? 'Agreed' : 'Their words';
    this.ui.toast(`<span class="cardline"><span class="ck ${c.kind}">${label}</span><b>${esc(c.title)}</b></span><span class="tsub">${esc(c.text)}${c.src ? ' <em>' + esc(c.src) + '</em>' : ''}</span>`, 'cardt', 5200);
    this.G.audio.sfx('ink');
    if (c.kind === 'insight' && this.st.fieldNote) this.st.fieldNote({ perceptible: 'ud', zoning: 'zoning', curb: 'curb', average: 'average' }[id] || id);
  }
  // ---------- people, places, time ----------
  // someone walks to a spot in town (along the paths, not through walls); from: start there if they're elsewhere
  walkIn(id, to, from, force) {
    const G = this.G; const n = G.npcs[id]; if (!n) return;
    if (n.place !== 'town') { G.npcTo(id, to, 'town', from || to); n.path = from ? G.town.findPath(from[0], from[1], to[0], to[1]) : []; n.goal = to; return; }
    n.override = to; n.goal = to; const p = n.c.root.position;
    if (from && Math.hypot(p.x - from[0], p.z - from[1]) > 0.5 && (force || !this.visibleNow(n))) p.set(from[0], 0, from[1]);
    n.path = G.town.findPath(p.x, p.z, to[0], to[1]); if (!n.path.length) n.path = [to];
  }
  visibleNow(n) { const p = this.G.player.root.position, q = n.c.root.position; return Math.hypot(p.x - q.x, p.z - q.z) < 26; }
  release(id) { const n = this.G.npcs[id]; if (n) n.override = null; }
  // the afternoon passes in a few seconds: the sun moves, the shadows sweep
  async timelapse(to, caption) {
    const G = this.G, S = this.S; if (S.min >= to) return;
    const from = S.min; const ts = G.timeScale; G.timeScale = 0; G.audio.sfx('whoosh');
    if (caption) this.ui.cc(caption, 2600);
    const dur = FAST ? 0.1 : 2.2; const t0 = performance.now();
    await new Promise((r) => { const step = () => { const k = clamp((performance.now() - t0) / 1000 / dur); const e = k * k * (3 - 2 * k); S.min = from + (to - from) * e; if (k < 1) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); if (FAST) setTimeout(() => { S.min = to; r(); }, 120); });
    S.min = to; G.timeScale = ts;
  }
  addGuest(id, quiet) {
    const S = this.S; S.guests = S.guests || {}; if (S.guests[id]) return; S.guests[id] = 1;
    this.renderGuests(id);
    if (quiet) return;
    const G = this.G; const n = G.npcs[id]; const at = n && n.c.root.visible ? n.c.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)) : { x: innerWidth - 120, y: 150 };
    G.fx.pop(at, CAST[id].name + ' can come to lantern night', { kind: 'guest', hook: 'juice', hookCtx: { what: CAST[id].name + ' can come to lantern night' }, ms: 2400 });
    G.audio.sfx('guest');
  }
  // the guest list, top right: who you've made room for so far (Wren is coming whatever happens)
  renderGuests(fresh) {
    const S = this.S; const el = this.ui.el('#hud .gstrip'); if (!el) return;
    const all = ['wren', 'bea', 'moss', 'pomeroy', 'pip', 'gil', 'rue', 'hollis'];
    const show = (this.on || this.stage === 'night') && Object.keys(S.guests || {}).length > 0;
    el.hidden = !show; if (!show) return;
    const n = Object.keys(S.guests || {}).length;
    el.innerHTML = `<span class="gl">Lantern night</span><span class="gf">${all.map((id) => S.guests[id] ? `<img class="${id === fresh ? 'fresh' : ''}" alt="${esc(CAST[id].name)}" title="${esc(CAST[id].name)}" src="${this.ui.face(id, S)}">` : '<i title="Someone you haven\'t made room for yet"></i>').join('')}</span><b class="gn">${n}</b>`;
  }
  // tests and probes: the first day as if everything before this stage went the usual way
  debugTo(stage, o = {}) {
    const G = this.G, S = this.S; const order = ['wake', 'homerow', 'porch', 'tomarket', 'market', 'moss', 'rue', 'works', 'worksmarks', 'gil', 'hearing', 'tonight', 'night'];
    const k = order.indexOf(stage); if (k < 0) return false;
    const past = (s) => k > order.indexOf(s);
    S.flags.lantern = 1; G.rooms.home.setLantern(false); S.guests = { wren: 1 };
    const tagAll = (z) => { for (const m of MARKS) if (m.street === z && !m.rare && !m.fit) S.marks[m.id] = { day: 1, min: 600 }; };
    if (past('porch')) { tagAll('homerow'); S.slice.porch = 'teal'; S.fixes.lanterns = 'built'; G.town.setFix('lanterns', true); this.porchColors(); S.color.homerow = 1; S.color.street = 0.28; S.guests.bea = 1; S.cards.bea_knock = 1; S.cards.perceptible = 1; }
    else if (past('homerow')) tagAll('homerow');
    if (past('moss')) { tagAll('market'); S.fixes.quiet = 'built'; G.applyFix('quiet'); S.sketch = { quiet: 'zoned' }; S.stakes = { quiet: 'listened' }; S.color.market = 1; S.color.street = 0.5; Object.assign(S.guests, { moss: 1, pomeroy: 1 }); Object.assign(S.cards, { moss_kettle: 1, pomeroy_loud: 1, zoning: 1 }); }
    else if (past('market')) tagAll('market');
    if (past('rue')) { S.guests.rue = 1; S.slice.blend = o.blend ? 'yes' : 'no'; if (o.blend) G.installBlend(); }
    if (past('worksmarks')) { tagAll('works'); S.cards.bea_steps = 1; }
    if (past('gil')) { S.cards.gil_planter = 1; S.cards.curb = 1; S.slice.gil = 'asked'; }
    if (past('hearing')) { S.flags.hearingDone = 1; S.fixes.ramp = 'built'; G.applyFix('ramp'); S.color.works = 1; S.color.street = 0.72; Object.assign(S.guests, { pip: 1, gil: 1, hollis: 1 }); }
    S.min = { wake: 520, homerow: 545, porch: 560, tomarket: 690, market: 705, moss: 730, rue: 790, works: 800, worksmarks: 810, gil: 830, hearing: 850, tonight: 1110, night: 1150 }[stage];
    this.stage = stage; this.restore(); this.renderGuests();
    if (stage === 'works' || stage === 'worksmarks' || stage === 'gil') this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true);
    return true;
  }
  // ---------- the prologue: the bus, you, your room ----------
  async prologue(from) {
    const G = this.G, S = this.S, ui = this.ui, st = this.st; const made = from === 'setup';
    G.mode = 'cine'; ui.letterbox(true); st.inPrologue = true;
    S.min = 17.4 * 60;
    if (!made) {
      G.stage.shot(new THREE.Vector3(66, 9, 70), new THREE.Vector3(57, 1.5, 30), 34, 0.6, true);
      G.busRide = true;
      await ui.caption('The 5:40 into Larkspur. About a thousand people, give or take you.', 3000);
      G.stage.shot(new THREE.Vector3(35.5, 5.6, 31.5), new THREE.Vector3(30, 3.2, 24), 30, 0.5);
      await ui.caption('The whole town was planned around one resident. That one.', 3000);
      await ui.caption('The Standard. Nobody who lives here looks like it.', 3000);
      G.busRide = false;
      G.stage.shot(new THREE.Vector3(14, 6, 46), new THREE.Vector3(9.5, 1.5, 35), 34, 0.8);
      await ui.caption('No. 2, Home Row. Yours.', 2200);
    }
    st.inPrologue = false; st.skipIntro = false;
    await G.stage.fadeTo(1, 700);
    G.setLoc('home'); G.player.root.visible = true; G.place([0.6, 0.2]); G.player.heading = 0.25;
    G.audio.setScene('home');
    G.stage.shot(new THREE.Vector3(1.6, 1.55, 4.1), new THREE.Vector3(0.45, 0.62, 0.1), 34, 3, true);
    if (window.innerWidth > 760) G.stage.offsetX(Math.min(220, window.innerWidth * 0.17)); else G.stage.offsetX(0, Math.round(window.innerHeight * 0.24));
    await G.stage.fadeTo(0, 700);
    ui.letterbox(false);
    if (!made) {
      await ui.caption('First things first: you.', 1800);
      G.mode = 'creator'; G.player.heading = 0.6; G.posePreview = true; if (!S.look.comfort) S.look.comfort = 'hum';
      const look = await ui.creator(S.look, (L, k) => { S.look = L; S.wheels = !!L.wheels; G.player.setLook(L); if (k === 'comfort' || k === 'all') G.player.previewComfort(L.comfort || 'hum'); else G.player.hop(); if (k === 'voice') G.audio.voice(L.voice, 1, 'hello hello'); });
      G.posePreview = false; G.player.setComfort(look.comfort || 'hum', 0);
      S.look = look; S.wheels = !!look.wheels; S.look0 = Object.assign({}, look);
      G.player.setLook(look); S.portrait0 = G.portrait();
      st.saveNow('setup', 0);
    } else { G.player.setLook(S.look); G.player.setComfort(S.look.comfort || 'hum', 0); if (!S.portrait0) S.portrait0 = G.portrait(); }
    G.stage.offsetX(0, 0);
    // your room, in six taps: each one changes the room as you pick it
    G.mode = 'cine';
    G.place([1.6, 1.6]);
    const home = G.rooms.home; const keys = ['lamp', 'radio', 'sign', 'note', 'clock', 'calendar'];
    const focus = { lamp: [-0.4, 1.2, -2.35], radio: [2.9, 1.8, -2.75], sign: [-3.86, 1.45, 1.6], note: [0.75, 0.9, -2.35], clock: [-1.4, 0.85, -2.45], calendar: [-1.2, 1.9, -2.97] };
    for (let i = 0; i < keys.length;) {
      const k = keys[i]; const f = focus[k]; const spec = SETUP[k];
      const cp = k === 'sign' ? new THREE.Vector3(-1.2, 2.0, 2.4) : new THREE.Vector3(f[0] + 0.9, f[1] + 0.7, f[2] + 2.6);
      G.stage.shot(cp, new THREE.Vector3(f[0], f[1], f[2]), 36, 2.4); G.player.faceToward(f[0], f[2]);
      const apply = (val) => {
        if (k === 'lamp') home.setLight(val);
        if (k === 'radio') { G.audio.vol.music = 0.25 + val * 0.75; G.audio.applyVolumes(); }
        if (k === 'sign') home.setSign(val);
        if (k === 'calendar') home.setCalendar(val);
        if (k === 'clock') home.objs.clock.group.rotation.y = (val - 0.5) * 0.6;
        if (k === 'note') home.objs.note.group.rotation.y = 0.2 + val * 0.6;
      };
      const v = await this.tapStep(k, spec, i, keys.length, apply);
      if (v && v.back) { i = Math.max(0, i - 1); continue; }
      S.profile[spec.dim] = spec.invert ? 1 - v : v; apply(v);
      i++;
    }
    G.audio.vol.music = 0.7; G.audio.applyVolumes();
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 1.5); }
    G.walkTo(0.3, 0.6);
    await sleep(FAST ? 20 : 700);
    await this.note('There. Everything in this room is set exactly the way you like it.');
    await this.gut('Remember how this feels.');
    this.ui.hideDialog();
    S.tf0 = SIM.townFit(S.fixes, S.stakes).all;
    await sleep(FAST ? 20 : 500);
    await G.stage.fadeTo(1, 900);
    await ui.caption('Night falls on Home Row.', 1500);
  }
  // one object in your room, two pictures: tap the one that's you
  tapStep(key, spec, idx, total, apply) {
    const lo = 0.22, hi = 0.78; const ui = this.ui; const G = this.G;
    const pics = PICS[key];
    const p = ui.openPanel('setup taps', `<div class="q">${esc(spec.q)}</div><div class="twopick">${[[lo, spec.lo, pics[0]], [hi, spec.hi, pics[1]]].map(([v, label, svg], i) => `<button class="pick" data-v="${v}"><span class="pic">${svg}</span><span class="pl"><kbd>${i + 1}</kbd>${esc(label)}</span></button>`).join('')}</div><div class="foot"><div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div><div class="fbtns">${idx > 0 ? '<button class="btn" id="back">Back</button>' : ''}</div></div>`);
    const btns = [...p.querySelectorAll('.pick')];
    // hovering a picture shows it in the room
    btns.forEach((b) => { b.onpointerenter = () => apply(+b.dataset.v); b.onfocus = () => apply(+b.dataset.v); });
    if (!ui.touch) setTimeout(() => btns[0].focus(), 40);
    return new Promise((r) => {
      const finish = (v) => { window.removeEventListener('keydown', kh); ui.closePanel(); r(v); };
      const pick = (b) => { btns.forEach((x) => x.classList.toggle('on', x === b)); G.audio.sfx('confirm'); apply(+b.dataset.v); setTimeout(() => finish(+b.dataset.v), FAST ? 10 : 260); };
      const kh = (e) => { if (e.key === '1') pick(btns[0]); if (e.key === '2') pick(btns[1]); if (e.key === 'ArrowLeft') btns[0].focus(); if (e.key === 'ArrowRight') btns[1].focus(); };
      window.addEventListener('keydown', kh);
      btns.forEach((b) => { b.onclick = () => pick(b); });
      const bk = p.querySelector('#back'); if (bk) bk.onclick = () => { G.audio.sfx('back'); finish({ back: true }); };
    });
  }
  // ---------- the day ----------
  async day(phase) {
    const G = this.G, S = this.S, st = this.st;
    if (phase === 'morning') { st.saveNow('morning', 1); await this.morning(); }
    else { st.resumeDay(phase); this.restore(); }
    this.renderGuests();
    await new Promise((r) => { st.endDay = r; G.mode = 'play'; G.busy = 0; });
    // lantern night ended the day: the next morning is Tuesday
    SIM.nightUpdate(S);
    S.slice.stage = 'done';
    { const el = this.ui.el('#hud .gstrip'); if (el) el.hidden = true; }
    if (S.slice.stopAfter) { delete S.slice.stopAfter; this.st.saveNow('morning', 2); await G.stage.fadeTo(1, 600); location.reload(); await sleep(60000); }
  }
  async morning() {
    const G = this.G, S = this.S;
    S.day = 1; S.min = 520; G.timeScale = FAST ? 22 : 1.2;
    G.setLoc('home'); G.place(G.rooms.home.spots.center); G.player.heading = -0.9;
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
    S.dayStats = Object.assign({}, S.stats); S.metAt0 = Object.keys(S.met); S.fixAt0 = Object.assign({}, S.fixes);
    G.audio.setScene('home'); G.rooms.home.setLantern(!S.flags.lantern);
    this.ui.hud(true);
    await G.stage.fadeTo(0, 900);
    await this.ui.caption('Monday, ' + fmtTime(S.min), 1600);
  }
  // after a reload mid-day: put people back where this part of the day has them
  restore() {
    const G = this.G, S = this.S; G.timeScale = FAST ? 22 : 1.2; const s = this.stage;
    this.porchColors();
    if (s === 'porch') this.walkIn('bea', T.bea);
    if (['works', 'worksmarks', 'gil'].includes(s)) this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true);
    if (s === 'gil' || s === 'hearing') this.detour(true);
  }
  porchColors() {
    const S = this.S, town = this.G.town; if (!town.setPorch) return;
    const mine = (S.slice || {}).porch || 'teal';
    for (let i = 0; i < 5; i++) town.setPorch(i, i === 1 ? mine : i === 3 ? 'amber' : i % 2 ? 'amber' : 'teal');
  }
  objective() {
    const S = this.S, G = this.G; const s = this.stage;
    const c = (z) => this.G.marks.count(z);
    if (s === 'wake') {
      if (G.loc === 'home') return ob('Something is glowing on your windowsill.', T.home, 'Home', { inside: 'home', spot: 'sill', spotLabel: 'Windowsill' });
      return ob('Wren left something on your windowsill.', T.home, 'Home', { inside: 'home', spot: 'sill', spotLabel: 'Windowsill' });
    }
    if (s === 'homerow') {
      if (G.loc === 'home') return ob('Take the lantern out onto Home Row.', T.porch, 'Home Row', { inside: 'home', spot: 'out', spotLabel: 'Door' });
      if (!G.look.raised && c('homerow').done < c('homerow').total) return ob('Raise Wren\'s lantern' + (this.ui.touch ? ' (the lantern button)' : ' (' + G.keyOf('look') + ')') + ' and look around Home Row.', null);
      const m = this.nextMark('homerow');
      return ob('Tag what pinches people on Home Row (' + c('homerow').done + '/' + c('homerow').total + ').', m ? [m.at[0], m.at[2] + 1.6] : null, m ? m.name : '');
    }
    if (s === 'porch') return ob('Hang your porch lantern. Your door, No. 2.', T.porch, 'Your door');
    if (s === 'tomarket') return ob('Bea says noon is hard for Moss. Market Square.', T.cart, 'Moss\'s tea cart');
    if (s === 'market') {
      if (!G.look.raised && c('market').done < c('market').total) return ob('Raise the lantern in the square' + (this.ui.touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
      const m = this.nextMark('market');
      return ob('Tag what pinches people in Market Square (' + c('market').done + '/' + c('market').total + ').', m ? [m.at[0] + 1, m.at[2] + 1] : null, m ? m.name : '');
    }
    if (s === 'moss') return ob('Ask Moss how noon is for her.', this.near('moss', T.cart), 'Moss');
    if (s === 'rue') return ob('Rue is waving you over to the Blend kiosk.', this.near('rue', T.kiosk), 'Rue');
    if (s === 'works') return ob('Bea is stuck outside the Works.', [13.6, 15.6], 'Bea');
    if (s === 'worksmarks') {
      if (!G.look.raised && c('works').done < c('works').total) return ob('Raise the lantern at the Works' + (this.ui.touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
      const m = this.nextMark('works');
      return ob('Tag what pinches people at the Works (' + c('works').done + '/' + c('works').total + ').', m ? [m.at[0] + 0.6, m.at[2] + 2.4] : null, m ? m.name : '');
    }
    if (s === 'gil') return ob('Gil wants a word.', this.near('gil', [14.2, 14.4]), 'Gil');
    if (s === 'hearing') return ob('The hearing about the ramp: Town Hall, at three.', T.hall, 'Town Hall');
    if (s === 'tonight') return ob('Lantern night. Head home: your guests are on their way.', [9.5, 39.0], 'Your porch');
    return ob('');
  }
  near(id, dflt) { const n = this.G.npcs[id]; if (n && n.place === 'town') { const q = n.c.root.position; return [q.x, q.z + 0.9]; } return dflt; }
  nextMark(z) { const p = this.G.player.root.position; let best = null, bd = 1e9; for (const m of MARKS) { if (m.street !== z || m.rare || m.fit || this.G.marks.tagged(m.id)) continue; const d = Math.hypot(m.at[0] - p.x, m.at[2] - p.z); if (d < bd) { bd = d; best = m; } } return best; }
  goals() {
    const S = this.S; const g = S.guests || {}; const order = ['wake', 'homerow', 'porch', 'tomarket', 'market', 'moss', 'rue', 'works', 'worksmarks', 'gil', 'hearing', 'tonight', 'night', 'done'];
    const past = (st) => order.indexOf(this.stage) > order.indexOf(st);
    return [
      { t: 'Make room on Home Row', done: (S.color || {}).homerow >= 1 },
      { t: 'Make room in Market Square', done: (S.color || {}).market >= 1 },
      { t: 'The hearing about a ramp at the Works', done: !!S.flags.hearingDone || past('hearing') },
      { t: 'Lantern night (' + Object.keys(g).length + ' coming so far)', done: this.stage === 'done' },
    ];
  }
  label(it) {
    const s = this.stage;
    if (it.id === 'home' && s === 'porch') return 'Hang your porch lantern';
    if (it.id === 'home' && (this.S.slice.porch) && s !== 'porch' && this.G.loc === 'town') return 'Go home';
    if (it.id === 'hall' && s === 'hearing') return 'Go in: the hearing';
    if (it.id === 'sill' && !this.S.flags.lantern) return 'Pick up the lantern';
    return null;
  }
  // things you can use, while the slice is on: the windowsill, your door, the hall for the hearing
  async handle(t) {
    const G = this.G, S = this.S; const s = this.stage;
    if (t.id === 'sill' && !S.flags.lantern) { await this.pickLantern(); return true; }
    if (t.id === 'home' && s === 'porch') { await this.hangLantern(); return true; }
    if (t.id === 'hall' && s === 'hearing') { await this.hearing(); return true; }
    if ((t.id === 'home' || t.id === 'bed') && s === 'tonight') { await this.note('Your guests are coming here. Wait on the porch.'); this.ui.hideDialog(); return true; }
    return false;
  }
  // ---------- each part of the day ----------
  tick() {
    const G = this.G, S = this.S; const s = this.stage;
    if (G.busy || G.mode !== 'play') return;
    // the day waits for you: the clock never runs past what's still to do, and nobody runs out of energy today
    if (CAP[s] && S.min > CAP[s]) S.min = CAP[s];
    if (S.energy < 35) S.energy = 35;
    if (G.ui.waiter || !G.ui.panel.hidden || G.phoneOpen || G.mgActive) return;
    const z = G.zone;
    if (s === 'wake' && S.flags.lantern) { this.stage = 'homerow'; return; }
    if (s === 'homerow' && G.loc === 'town' && G.marks.complete('homerow') && !G.look.open) { G.run(() => this.beaOut()); return; }
    if (s === 'tomarket' && z === 'market') { G.run(() => this.marketArrive()); return; }
    if (s === 'market' && G.marks.complete('market')) { this.stage = 'moss'; this.ui.toast('<b>Market Square: seen.</b> Now ask the people it pinches.', 'good', 3800); return; }
    if (s === 'works' && G.loc === 'town' && this.nearPos([13.4, 14.2], 4.5)) { G.run(() => this.worksArrive()); return; }
    if (s === 'worksmarks' && G.marks.complete('works')) { G.run(() => this.gilOut()); return; }
    if (s === 'tonight' && G.loc === 'town' && this.nearPos([9.5, 38.6], 6)) { G.run(() => this.lanternNight()); return; }
    // Blend, if you have it, keeps pinging (in the story, never in real life)
    this.blendTick();
  }
  nearPos(at, r) { const p = this.G.player.root.position; return this.G.loc === 'town' && Math.hypot(p.x - at[0], p.z - at[1]) < r; }
  // the first list you see started with one already ticked, by Wren: a head start, shown as the hook it is
  onRaise() {
    const S = this.S, G = this.G; const z = G.marks.streetHere();
    if (z === 'homerow' && this.stage === 'homerow' && !S.flags.endowedShown) { S.flags.endowedShown = 1; setTimeout(() => G.fx.pop({ x: innerWidth / 2, y: 92 }, 'Wren already ticked 1 of 3', { kind: 'mark', hook: 'endowed', hookCtx: { what: 'Home Row started at 1 of 3, ticked by Wren' }, ms: 2600, rise: 16 }), 500); }
  }
  onMark(m, c) {
    if (m.id === 'wk_steps') { this.detour(true); setTimeout(() => this.G.fx.pop(new THREE.Vector3(20.4, 1.6, 10.2), 'The long way round', { kind: 'mark', ms: 2600 }), 600); }
  }
  // a hook mark on the street list the first time you see it (the head start is Wren's tag)
  async pickLantern() {
    const G = this.G, S = this.S;
    await this.note('A small lantern on the windowsill, with a tag: "For No. 2. Raise it to see what pinches people. I tagged one on Home Row to show you how."');
    await this.note('On the back: "Lantern night is tonight, on your porch. Bring whoever you can. —W."');
    this.ui.hideDialog();
    S.flags.lantern = 1; G.rooms.home.setLantern(false); G.ui.gearKey = '';
    G.audio.sfx('lantern'); G.fx.burst(G.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { n: 14, colors: ['#ffcf7a', '#fff4d6'] });
    S.guests = S.guests || {}; this.addGuest('wren', true); this.renderGuests('wren');
    this.ui.toast(`<b>Wren's lantern</b><br>${this.ui.touch ? 'The lantern button' : G.keyOf('look') + ', or the lantern button'} raises it. Lantern night: Wren's coming. Who else comes is up to you.`, 'idea', 6800);
    this.stage = 'homerow';
  }
  async beaOut() {
    const G = this.G, S = this.S;
    G.look.raised && G.look.lower();
    this.walkIn('bea', T.bea);
    await sleep(FAST ? 20 : 1400);
    this.frame('bea');
    await this.say('bea', 'Oh! It\'s the new one at Number Two. Sorry, dear. I heard steps and thought: the knocker again.');
    await this.say('bea', 'Fifty years on this row, and I still can\'t say "not today" without feeling rude. So some days I don\'t answer at all.');
    this.card('bea_knock');
    await this.gut('Wren\'s tag has a line you missed: "A light by the door says it without a word."');
    this.unframe();
    this.stage = 'porch';
  }
  async hangLantern() {
    const G = this.G, S = this.S, ui = this.ui;
    const k = await this.choose([{ t: 'Teal: come in, say hi', id: 'porch_teal' }, { t: 'Amber: not right now', id: 'porch_amber' }], { text: 'Your porch lantern. What does it say?', kind: 'gut' });
    ui.hideDialog();
    S.slice.porch = k === 0 ? 'teal' : 'amber';
    // up it goes: the lantern posts on the whole row, yours first
    G.town.setFix('lanterns', true); this.porchColors();
    S.fixes.lanterns = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.lanterns = 'slice';
    const door = new THREE.Vector3(8.5, 1.5, 36.5);
    G.fx.burst(door, { n: 26, colors: [S.slice.porch === 'teal' ? '#4fd1c5' : '#f2a33a', '#fff4d6'], speed: 3.4, up: 3 });
    G.audio.sfx('fix'); G.fx.punch(0.6);
    await sleep(FAST ? 20 : 500);
    await this.wave('homerow', [9.5, 36.6]);
    this.st.fieldNote('ud');
    this.frame('bea');
    await this.say('bea', S.slice.porch === 'teal' ? 'Teal! Well, then. Hello to you too.' : 'Amber! Ha. Quite right. I\'ll knock tomorrow.');
    await this.say('bea', 'Amber for me, I think. Most days. But I\'ll come to your lantern night. I\'ll bring lemon cake.');
    this.addGuest('bea');
    this.card('perceptible');
    await this.say('bea', 'If you\'re making room, dear, go and see Moss at the tea cart. Noon in the square is a racket.');
    this.unframe(); this.release('bea');
    await this.timelapse(Math.max(S.min, 690), 'The row spends the morning hanging lanterns.');
    this.stage = 'tomarket';
  }
  // colour rolls out from a fix; the music gains a voice
  async wave(zone, from) {
    const G = this.G; G.audio.sfx('wave'); G.fx.punch(0.9);
    G.fx.ring(new THREE.Vector3(from[0], 0, from[1]), { color: '#ffe2a0', r: 7, dur: 1.4 });
    const p = G.color.restore(zone, from);
    setTimeout(() => G.fx.pop(new THREE.Vector3(from[0], 2.6, from[1]), (STREETS[zone] ? STREETS[zone].name : 'Here') + ': room made', { kind: 'good', big: true, hook: 'juice', hookCtx: { what: 'A wave of colour over ' + (STREETS[zone] ? STREETS[zone].name : 'a street') }, ms: 2600 }), FAST ? 10 : 900);
    await p;
    this.S.restored = (this.S.restored || 0) + 1;
  }
  async marketArrive() {
    const G = this.G, S = this.S;
    if (S.min < 700) await this.timelapse(700, 'The square fills up toward noon.');
    this.stage = 'market';
    // the first time a place pinches you, the question the whole game asks
    const p = SIM.pinch(S, 'market', S.min, G.subFor('market'));
    if (p.total >= 0.25) await this.whoAdjusts(p);
    else { await this.gut('The jingle doesn\'t bother you much. It bothers Moss. She\'s stopped hearing her own kettle.'); this.ui.hideDialog(); }
  }
  async whoAdjusts(p) {
    const G = this.G, S = this.S;
    G.focusPinch(true);
    const top = p.top || 'sound';
    const what = { sound: 'The jingle comes off every post at once.', people: 'The whole square is one crowd at noon.', light: 'The noon sun bounces off every stall.' }[top] || 'Noon, in the square.';
    const opts = [
      { key: 'bend', who: 'You', label: 'Push through', sub: 'You stay, and nobody notices. It costs you, hidden.', hold: true },
      { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: 'nothing you own helps with this yet' },
      { key: 'ask', who: 'Them', label: 'Ask someone to turn it down', disabled: true, reason: 'the speakers are the council\'s; nobody here can' },
      { key: 'fix', who: 'The place', label: 'Make room here', sub: 'Find what pinches, and fix it for everyone. Slower. Lasts.' },
      { key: 'leave', who: 'Nobody', label: 'Go somewhere else', sub: 'You rest. You miss what you came for.' },
    ];
    const choice = await this.ui.barrier({ options: opts, title: 'Market Square, noon', text: what, coach: 'When a place doesn\'t fit, someone adjusts. Each answer costs something different.' });
    this.ui.hideBarrier(); G.focusPinch(false);
    this.st.fieldNote('fit');
    S.slice.adjust = choice;
    if (choice === 'bend') { S.masking = true; S.maskZone = 'market'; SIM.bendCost(S, false); S.stats.bend++; await this.gut('You push through. Nobody can tell. It costs you, and the square is still loud for Moss, every day.'); }
    else if (choice === 'leave') { S.stats.leave++; await this.gut('You step back to the edge of the square. The jingle keeps going without you.'); }
    else { S.stats.fix++; await this.gut('Then look at it properly. Raise the lantern.'); }
    this.ui.hideDialog();
  }
  // Moss, then Pomeroy (who it costs), then Clover with her sketchbook
  async talk(id) {
    const s = this.stage, S = this.S;
    if (id === 'moss' && s === 'moss') { await this.mossTalk(); return true; }
    if (id === 'rue' && s === 'rue') { await this.rueOffer(); return true; }
    if (id === 'bea' && s === 'works') { await this.worksArrive(); return true; }
    if (id === 'gil' && s === 'gil') { await this.gilTalk(); return true; }
    // anyone else: a word or two for this part of the day
    const line = this.bark(id); if (!line) return false;
    this.frame(id); await this.say(id, line);
    if (id === 'pip' && !S.cards.pip_cart && ['works', 'worksmarks', 'gil', 'hearing'].includes(s)) { await this.say('pip', 'The Works? I take the bread cart round by the loading dock every morning. Takes ages! Never mind.'); this.card('pip_cart'); }
    this.unframe(); return true;
  }
  bark(id) {
    const s = this.stage, S = this.S; const early = ['wake', 'homerow', 'porch'].includes(s);
    const B = {
      bea: early ? 'Morning, dear. Mind the knocker, it\'s louder than it looks.' : 'Lemon cake, tonight. Don\'t eat beforehand.',
      moss: s === 'tomarket' || s === 'market' ? 'Tea? You\'ll have to shout. Everyone does, at noon.' : 'Hear that? My own kettle. I\'d forgotten it whistles.',
      pip: early ? 'Morning! Buns are nearly up. Come back at eleven!' : 'Hello hello! Busy day? Mine too. Always!',
      pomeroy: S.color.market >= 1 ? (S.sketch && S.sketch.quiet === 'zoned' ? 'APPLES! Loud ones, by the music corner. Best of both!' : 'Apples. Quieter apples. Very quiet.') : 'APPLES! CRISP ONES! Sorry. Habit.',
      rue: S.blend && S.blend.has ? 'How\'s Smooth Mode? Don\'t tell anyone, but I turn it off on my break.' : 'Blend\'s free, you know. Free-ish.',
      gil: 'Hey hey! No worries about anything. Literally anything.',
      hollis: 'Ah, the new resident. Mind the steps everywhere, they\'re historic.',
      clover: 'Got something that pinches? Bring it to the Shed. Or I\'ll come to you, honestly.',
      wren: 'You have the lantern. Good. Tag what you see. Tonight, I\'ll show you one more thing.',
    };
    return B[id] || null;
  }
  async mossTalk() {
    const G = this.G, S = this.S;
    this.frame('moss');
    await this.say('moss', 'Noon, love. The jingle comes off every post. By twelve I can\'t hear my own kettle.');
    await this.say('moss', 'I\'d move, but this is the only pitch with shade. So I stay, and I smile, and I go home and lie in the dark.');
    this.card('moss_kettle');
    this.unframe();
    // Pomeroy has heard every word
    this.walkIn('pomeroy', [27.4, 29.6]);
    await sleep(FAST ? 20 : 1600);
    this.frame('pomeroy');
    await this.say('pomeroy', 'Oi! You\'re not turning the music off, are you? Half my sales are folk who hear me before they see me!');
    await this.say('pomeroy', 'Some of us like it loud. The square\'s my stage, it is.');
    this.card('pomeroy_loud');
    await this.gut('Every fix costs somebody something. Quiet for Moss could cost Pomeroy his crowd.');
    this.unframe(); this.release('pomeroy');
    // Clover, with her sketchbook
    this.walkIn('clover', [26.2, 30.6], [36, 33.6]);
    await sleep(FAST ? 20 : 2200);
    this.frame('clover');
    await this.say('clover', 'Right. I heard "kettle" and "stage". Both fair. Let\'s sketch it, so both of them fit.');
    this.unframe();
    const r = await new Blueprint(G, 'quiet', { where: 'Market Square, on Clover\'s sketchbook' }).run();
    const zoned = !!(r && r.zoned);
    if (zoned) { S.stakes = S.stakes || {}; S.stakes.quiet = 'listened'; }
    // the build, over lunch
    this.frame('clover');
    await this.say('clover', zoned ? 'A quiet corner by the benches, and a music corner by the apples. Give me an hour and the lads from the Shed.' : 'Quieter everywhere, then. It\'s a start. Give me an hour.');
    this.unframe();
    await this.build('quiet', [23.5, 31.2], Math.max(S.min, 790), 'Clover\'s crew builds it over lunch.');
    S.fixes.quiet = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.quiet = 'slice';
    await this.waveWide('market', [23.5, 31.2], [28, 27]);
    if (!zoned) G.color.hold('pomeroy', 0.36);
    this.frame('moss');
    await this.say('moss', 'Listen. That\'s my kettle. I\'d forgotten it whistles.');
    await this.say('moss', 'Tonight? Lantern night? I\'ll bring a pot.');
    this.addGuest('moss');
    this.unframe();
    this.frame('pomeroy');
    if (zoned) { await this.say('pomeroy', 'A music corner, right by my apples? Now you\'re talking! I\'ll bring a bag round tonight.'); this.addGuest('pomeroy'); }
    else { await this.say('pomeroy', 'Quieter everywhere, is it. Grand. Grand for some.'); await this.gut('He isn\'t wrong. The fix cost him, and nobody asked what would make up for it.'); }
    this.unframe();
    this.card('zoning');
    this.release('clover');
    this.stage = 'rue';
    G.ui.bubble('rue', 'Psst! New person! Over here!', { tint: CAST.rue.tint, ms: 4200 });
  }
  // a fix goes up: hammering, sparks, and the afternoon passing
  // the camera frames somewhere for a moment (a build, a wave), then comes back to you
  frameAt(at, o = {}) { const G = this.G; G.stage.shot(new THREE.Vector3(at[0] + (o.dx == null ? 5 : o.dx), o.h || 9.5, at[1] + (o.dz == null ? 11 : o.dz)), new THREE.Vector3(at[0], 0.8, at[1]), o.fov || 40, 2.6); }
  unframeAt() { const G = this.G; G.stage.follow(G.player.root.position, G.followOpts()); }
  async build(f, at, to, caption) {
    const G = this.G; const g = G.town.fixGroups[f];
    this.frameAt(at, f === 'ramp' ? { dx: 3, dz: 10 } : {});
    G.audio.sfx('fix'); const p = new THREE.Vector3(at[0], 1.2, at[1]);
    const tl = this.timelapse(to, caption);
    for (let i = 0; i < 4; i++) { G.fx.burst(p, { n: 10, colors: ['#e9dcc5', '#ffcf7a', '#c9bba0'], speed: 2.6, up: 2.6 }); if (i === 1) G.audio.sfx('fix'); await sleep(FAST ? 5 : 420); }
    await tl;
    G.applyFix(f);
    if (g) { g.visible = true; const t0 = performance.now(); const grow = () => { const k = clamp((performance.now() - t0) / 700); const e = 1 + Math.sin(k * Math.PI) * 0.12 * (1 - k); g.scale.set(1, k < 1 ? Math.max(0.02, k * e) : 1, 1); if (k < 1) requestAnimationFrame(grow); }; g.scale.set(1, 0.02, 1); requestAnimationFrame(grow); }
    G.fx.burst(p, { n: 34, colors: ['#ffcf7a', '#fff4d6', '#9ef2e4', '#f3a0c2'], speed: 4, up: 4 }); G.audio.sfx('prize'); G.fx.punch(0.7);
    await sleep(FAST ? 20 : 800);
  }
  // pull back for a wave over a whole street, then back to you
  async waveWide(zone, from, view) { this.frameAt(view || from, { dx: 4, dz: 15, h: 15, fov: 44 }); await sleep(FAST ? 10 : 500); await this.wave(zone, from); this.unframeAt(); }
  async rueOffer() {
    const G = this.G, S = this.S;
    this.frame('rue');
    await this.say('rue', 'Nice work! Honestly. That was a LOT of effort for some quiet, though.');
    await this.say('rue', 'Blend does it in one tap. Smooth Mode: you stop minding things, and you get points for every place you push through. Free!');
    const k = await this.choose([{ t: 'Go on, I\'ll try it', id: 'blend_yes', blend: true }, { t: 'No thanks', id: 'blend_no' }], { text: 'Install Blend?', kind: 'gut' });
    if (k === 0) {
      G.installBlend(); this.G.hooks.fire('points', { what: 'Blend: 30 welcome points', by: 'blend' });
      G.fx.pop(G.player.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '+30 points', { kind: 'blend', hook: 'points', hookCtx: { what: 'Blend: 30 welcome points', by: 'blend' } });
      await this.say('rue', 'Yay! Turn on Smooth Mode whenever a place gets to you. Your first streak starts now!');
      S.slice.blend = 'yes';
    } else { await this.say('rue', 'Suit yourself! It\'s always there if you change your mind.'); S.slice.blend = 'no'; }
    await this.say('rue', 'Oh, and Bea\'s been stuck outside the Works for ages. Something about steps?');
    this.unframe();
    this.addGuest('rue', true); this.renderGuests('rue');
    // Bea, at the Works steps with her cart
    this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true);
    this.stage = 'works';
  }
  // Smooth Mode in the slice: each place that pinches you, smoothed for points, in a row (and your lantern dims)
  blendTick() {
    const G = this.G, S = this.S, B = S.blend; if (!B || !B.has || B.deleted || !B.smooth || G.loc !== 'town') return;
    const z = G.zone; S.slice.smoothed = S.slice.smoothed || {};
    const p = G.pinchNow; if (!p || p.total < 0.25 || S.slice.smoothed[z]) return;
    S.slice.smoothed[z] = 1; B.score += 15; B.inRow = (B.inRow || 0) + 1; S.stats.smooth++; SIM.bendCost(S, true);
    const at = G.player.root.position.clone().add(new THREE.Vector3(0, 2.4, 0));
    G.fx.pop(at, 'Smoothed! +15', { kind: 'blend', hook: 'points', hookCtx: { what: 'Blend: +15 for pushing through', by: 'blend' } });
    G.audio.sfx('blend');
    if (B.inRow >= 2) setTimeout(() => G.fx.pop(at, B.inRow + ' in a row!', { kind: 'blend', hook: 'streak', hookCtx: { what: 'Blend: ' + B.inRow + ' in a row', by: 'blend' } }), 700);
    if (B.inRow === 2) setTimeout(() => G.fx.pop({ x: innerWidth / 2, y: 120 }, 'Bea liked your calm ♥', { kind: 'blend', hook: 'likes', hookCtx: { what: 'Blend: "Bea liked your calm"', by: 'blend' }, ms: 2200 }), 1500);
  }
  async worksArrive() {
    const G = this.G, S = this.S; if (this.stage !== 'works') return;
    this.stage = 'worksmarks';
    { const q = G.npcs.bea.c.root.position; if (Math.hypot(q.x - 13.4, q.z - 14.2) > 3) this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true); }
    this.frame('bea');
    await this.say('bea', 'There you are. The post counter\'s in there, dear. Three steps. My cart doesn\'t do steps.');
    await this.say('bea', 'So I go round the back with the parcels and wait for the dock. It opens at ten, when it opens.');
    this.card('bea_steps');
    this.unframe();
  }
  // the long way round, drawn on the ground when you tag the steps
  detour(on) {
    const G = this.G;
    if (!this.detourLine) {
      const pts = [[12, 12.4], [16.2, 12.4], [19.6, 12.4], [20.4, 10.6], [20.6, 8.4]].map(([x, z]) => new THREE.Vector3(x, 0.06, z));
      const geo = new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(60));
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#d9822b', dashSize: 0.45, gapSize: 0.3, linewidth: 2 }));
      line.computeLineDistances(); line.userData.noOcc = true; line.renderOrder = 3; G.town.scene.add(line); this.detourLine = line;
    }
    this.detourLine.visible = !!on;
  }
  async gilOut() {
    const G = this.G, S = this.S; if (this.stage !== 'worksmarks') return;
    this.stage = 'gil';
    G.npcTo('gil', [14.4, 14.4], 'town', [12, 12.9]);
    await sleep(FAST ? 20 : 900);
    await this.gilTalk();
  }
  async gilTalk() {
    const G = this.G, S = this.S;
    this.frame('gil');
    await this.say('gil', 'Hey hey! The new person! What\'s all this? Oh, Bea. Morning, Bea.');
    await this.say('you', 'A ramp. For Bea, and anyone else on wheels.');
    await this.say('gil', 'Love that. Love the energy. Anything structural goes to the council, though. Hollis is hearing things at three!');
    await this.say('gil', 'One thing. A ramp would go right where my planter is.');
    await this.gut('He planted it himself. The basil is doing very well.');
    const k = await this.choose([{ t: 'Could the planter go at the top of the ramp?', id: 'gil_ask' }, { t: 'We\'ll sort that out later', id: 'gil_later' }]);
    if (k === 0) { await this.say('gil', 'Oh! Yeah. Yeah, it could. Basil likes a view, honestly.'); this.card('gil_planter'); S.slice.gil = 'asked'; }
    else { await this.say('gil', 'Sure, sure. No worries!'); await this.gut('Three no-worries is one worry.'); S.slice.gil = 'later'; }
    this.unframe();
    G.npcTo('gil', null);
    // Clover, by text, with the one card she thinks you'll need
    this.st.text('Clover', 'Heard you\'re at the hearing at three. Take this with you. The curb-cut one. Trust me.');
    setTimeout(() => this.card('curb'), FAST ? 10 : 1200);
    this.stage = 'hearing';
  }
  async hearing() {
    const G = this.G, S = this.S;
    if (S.min < 900) await this.timelapse(900);
    await G.enterRoom('hall');
    G.audio.setScene('council'); G.placeCouncil();
    for (const id of ['hollis', 'pip', 'clover']) G.npcTo(id, G.rooms.hall.spots[id], 'hall');
    const gallery = ['bea', 'gil', 'moss'];
    [[-3.9, 2.0], [-2.6, 3.5], [3.8, 2.0]].forEach((pos, i) => G.npcTo(gallery[i], pos, 'hall'));
    G.walkTo(...G.rooms.hall.spots.lectern);
    await sleep(FAST ? 20 : 900);
    G.stage.shot(new THREE.Vector3(0, 3.3, 3.6), new THREE.Vector3(0, 0.2, -3.8), 46, 2.4);
    this.ui.letterbox(true);
    await this.say('hollis', 'Order, order. One item, at the new resident\'s request: a ramp at the Works. Objections first, as is tradition.');
    this.ui.hideDialog(); this.ui.hud(false); this.ui.letterbox(false);
    const h = new Hearing(G, RAMP, { gallery }); this.hearingNow = h;
    const r = await h.run(); this.hearingNow = null;
    this.ui.hud(true);
    S.flags.hearingDone = 1; S.slice.hearing = { passed: r.passed, yes: r.yes, consentSkipped: r.consentSkipped };
    this.ui.letterbox(true);
    if (r.passed) {
      await this.say('hollis', r.yes === 3 ? 'Carried, all three. The ramp goes up this afternoon. Goodness.' : 'Carried. The ramp goes up this afternoon.');
      if (r.consentSkipped) { await this.say('bea', 'Next time, ask me first, dear. I\'d have said yes.'); }
    } else {
      await this.say('hollis', 'Not carried, I\'m afraid. It goes on file.');
      await this.say('clover', 'You were missing ' + RAMP.missing[r.missing[0]] + '. Bring that back, and it\'ll carry.');
      S.fixes.ramp = 'proposal'; S.support.ramp = ['bea'];
    }
    this.ui.hideDialog(); this.ui.letterbox(false);
    for (const id of ['hollis', 'pip', 'clover', 'bea', 'gil', 'moss']) G.npcTo(id, null);
    if (r.passed) {
      S.fixes.ramp = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.ramp = 'slice';
      await G.stage.fadeTo(1, 500); G.setLoc('town'); G.place([14.4, 17.6]); G.player.heading = Math.PI; G.audio.setScene('town'); await G.stage.fadeTo(0, 500);
      await this.build('ramp', [16, 11.2], Math.max(S.min, 1000), 'The ramp goes up by teatime.');
      this.detour(false);
      await this.waveWide('works', [13, 12.6], [13, 11]);
      this.frameAt([16, 11.6], { dx: 2, dz: 9, h: 6.5, fov: 38 });
      await this.curbCut();
      this.unframeAt();
      this.addGuest('pip'); if (S.slice.gil === 'asked' || r.yes === 3) this.addGuest('gil'); this.addGuest('hollis', true); this.renderGuests('hollis');
    } else { await G.exitRoom(true); this.detour(false); this.addGuest('hollis', true); }
    await this.timelapse(Math.max(S.min, 1110), 'The light goes gold.');
    this.stage = 'tonight';
  }
  // built for Bea; used by everyone: Pip's bread cart and a pram, down the ramp, then Bea
  async curbCut() {
    const G = this.G;
    const cart = this.prop('bread'); const pram = this.prop('pram');
    const pip = G.npcs.pip;
    G.npcTo('pip', [18.6, 12.4], 'town', [14.0, 11.2]); pip.c.root.add(cart); cart.position.set(0.5, 0, 0.45);
    const extra = G.crowd.find((a) => !a.active) || G.crowd[0]; const pc = extra.c; extra.held = true; pc.root.visible = true; pc.root.position.set(13.6, 0.5, 11.2); pc.root.add(pram); pram.position.set(0, 0, 0.55);
    const t0 = performance.now(); let k = 0;
    await new Promise((r) => { const step = () => { k = clamp((performance.now() - t0) / 3200); pc.root.position.set(13.6 + k * 5.6, 0.5 * (1 - k), 11.2 + k * 1.4); pc.heading = Math.PI / 2; pc.speed = 0.5; pc.update(0.016); if (k < 1) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); if (FAST) setTimeout(r, 50); });
    G.fx.pop(new THREE.Vector3(17, 2.6, 12), 'Built for Bea. Used by everyone.', { kind: 'good', big: true, ms: 3000 });
    this.st.fieldNote('curb');
    await this.gut('A ramp for Bea, and the first two down it are a bread cart and a pram. That\'s the curb-cut effect.');
    this.ui.hideDialog();
    pip.c.root.remove(cart); pc.root.remove(pram); extra.held = false; extra.active = false; pc.root.visible = false; pc.speed = 0; pc.root.position.y = 0;
    G.npcTo('pip', null);
  }
  prop(kind) {
    const g = new THREE.Group(); const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    if (kind === 'bread') { const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.38), m('#d9a35e')); box.position.y = 0.4; g.add(box); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m('#c8894a')); b.position.set(-0.14 + i * 0.14, 0.63, 0); g.add(b); } }
    else { const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#9fb7d9')); body.rotation.x = Math.PI; body.position.y = 0.52; g.add(body); const hood = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI, 0, Math.PI / 2), m('#4f6f8f')); hood.position.set(0, 0.5, -0.05); hood.rotation.y = Math.PI / 2; g.add(hood); }
    for (const sx of [-0.18, 0.18]) for (const sz of [-0.12, 0.12]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), m('#2f3a4a')); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.07, sz); g.add(w); }
    g.traverse((o) => { o.userData.noOcc = true; });
    return g;
  }
  // ---------- lantern night ----------
  async lanternNight() {
    const G = this.G, S = this.S, ui = this.ui;
    this.stage = 'night';
    G.look.raised && G.look.lower();
    await this.timelapse(Math.max(S.min, 1170), 'Dusk on Home Row.');
    G.player.root.position.set(9.5, 0, 38.4); G.player.heading = Math.PI;
    ui.letterbox(true);
    G.stage.shot(new THREE.Vector3(9.5, 4.6, 46.5), new THREE.Vector3(9.5, 1.3, 38.6), 34, 1.6);
    G.audio.setScene('night');
    // the guests arrive, one by one, each with something
    const guests = Object.keys(S.guests || {}).filter((id) => id !== 'wren');
    let i = 0;
    for (const id of guests) {
      const n = G.npcs[id]; if (!n) continue; const sp = SPOTS[i++ % SPOTS.length];
      this.walkIn(id, sp, GUESTS[id].from);
      await sleep(FAST ? 10 : 700);
      G.fx.pop(new THREE.Vector3(sp[0], 2.5, sp[1]), CAST[id].name + ': ' + GUESTS[id].gift, { kind: 'guest', ms: 1700, rise: 34 });
      G.audio.sfx('guest');
    }
    await sleep(FAST ? 10 : 1800);
    for (const id of guests) { const n = G.npcs[id]; if (n) n.c.faceToward(9.5, 38.4); }
    const absent = ['bea', 'moss', 'pomeroy', 'pip', 'gil'].filter((id) => !S.guests[id]);
    if (guests.length) await this.note(guests.length === 1 ? CAST[guests[0]].name + ' came. One guest, and a whole porch of light.' : LIST(guests.map((g) => CAST[g].name)) + ' came. Your porch is full.');
    if (absent.length) await this.gut(this.absentLine(absent));
    // Wren, last, with the lantern tuned to one more person
    this.walkIn('wren', [9.5, 40.4], GUESTS.wren.from);
    await sleep(FAST ? 10 : 2600);
    this.frame('wren');
    await this.say('wren', 'I tuned the lantern. It reads one more person now: the one this town was built for. The Standard.');
    await this.say('wren', 'Raise it. Look at the whole town through the Standard\'s eyes.');
    this.unframe(); ui.letterbox(true);
    await this.standardReveal();
    this.frame('wren');
    await this.say('wren', 'Nothing pinches it. Not one mark. And not one of us fits it. Not one person in Larkspur.');
    await this.say('wren', 'They built the whole town for somebody who isn\'t here.');
    this.card('average');
    await this.say('wren', 'Every room you made today, you made for someone who is.');
    this.unframe();
    // the day's rewards, sorted: what did each one point you at?
    await this.hookSort();
    await this.dayCard();
    ui.letterbox(false);
    for (const id of Object.keys(CAST)) if (G.npcs[id]) G.npcTo(id, null);
    this.st.finishDay('night');
  }
  absentLine(absent) {
    const W = { moss: 'Moss couldn\'t come. The square was still too loud to pack up early.', pomeroy: 'Pomeroy didn\'t come. The quiet cost him, and nobody asked what would make it up to him.', pip: 'Pip couldn\'t come. Her cart still goes the long way round.', gil: 'Gil sent a text: "Next time!!" The planter question is still open.', bea: 'Bea\'s light stayed amber.' };
    return absent.map((id) => W[id]).filter(Boolean).slice(0, 2).join(' ');
  }
  async standardReveal() {
    const G = this.G, ui = this.ui; const M = G.marks;
    const total = MARKS.filter((m) => !m.fit).length;
    G.stage.shot(new THREE.Vector3(30, 46, 62), new THREE.Vector3(30, 0, 24), 40, 2.4);
    M.showAll = true; if (!G.look.raised) G.look.raise();
    const tag = document.createElement('div'); tag.className = 'revealcount'; ui.root.appendChild(tag);
    const set = (n, t) => { tag.innerHTML = `<b>${n}</b><span>${t}</span>`; };
    set(total, 'marks: what pinches the people who live here');
    await sleep(FAST ? 20 : 3600);
    set(total, 'Retuning to the Standard…');
    await sleep(FAST ? 20 : 900);
    M.standard = true;
    for (let n = total - 1; n >= 0; n--) { M.fade = n; set(n, 'marks: what pinches the Standard'); G.audio.sfx('tick'); await sleep(FAST ? 2 : 110); }
    await sleep(FAST ? 20 : 1400);
    G.stage.shot(new THREE.Vector3(9.5, 4.2, 45.5), new THREE.Vector3(9.5, 1.2, 39.2), 36, 1.4);
    set(0, 'residents who fit the Standard');
    G.fx.ring(new THREE.Vector3(9.5, 0, 39.6), { color: '#c9b8a6', r: 9, dur: 2.2 });
    await sleep(FAST ? 20 : 2600);
    tag.remove(); M.showAll = false; M.standard = false; M.fade = null; G.look.lower();
  }
  // ---------- the hooks, sorted ----------
  async hookSort() {
    const G = this.G, S = this.S, ui = this.ui;
    const log = (S.hookLog || []).slice();
    // up to six moments, one of each pull where possible, Blend's included
    const pickd = []; const seen = new Set(); const said = new Set();
    for (const e of log) if (!seen.has(e.id + e.by) && pickd.length < 6) { seen.add(e.id + e.by); said.add(e.what); pickd.push(e); }
    for (const e of log) if (pickd.length < 5 && !said.has(e.what)) { said.add(e.what); pickd.push(e); }
    if (pickd.length < 2) return;
    const p = ui.openPanel('center hooksort', `<h2>What did it point you at?</h2><p class="lede">Today the game rewarded you ${G.hooks.total()} times, each with a little hook mark. Sort a few.</p>
      <div class="hs">${pickd.map((e, i) => `<div class="hsrow" data-i="${i}"><div class="hsw"><i class="hk">${HOOK_SVG}</i>${esc(e.what)}${e.by === 'blend' ? ' <span class="hsb">Blend</span>' : ''}</div><div class="hsbtn"><button class="chip" data-v="real">Something real</button><button class="chip" data-v="hook">Just the hook</button></div></div>`).join('')}</div>
      <div class="pfoot"><button class="btn primary" id="hsGo" disabled>See what they were</button></div>`);
    const ans = {};
    p.querySelectorAll('.hsrow').forEach((row) => row.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; ans[row.dataset.i] = b.dataset.v; row.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); G.audio.sfx('select'); p.querySelector('#hsGo').disabled = Object.keys(ans).length < pickd.length; }));
    await new Promise((r) => { p.querySelector('#hsGo').onclick = r; if (FAST) setTimeout(r, 30); });
    const used = HOOK_ORDER.filter((id) => (S.hooks || {})[id]);
    const blendUsed = used.filter((id) => ['points', 'streak', 'likes'].includes(id));
    p.innerHTML = `<h2>Every one of those was a hook</h2><p class="lede">The same pulls apps use to keep you scrolling. Here's each one the game used on you today.</p>
      <div class="hooklist">${used.map((id) => `<div class="hookrow"><i class="hk">${HOOK_SVG}</i><div><b>${esc(HOOKS[id].name)}</b> <span class="cnt">×${S.hooks[id]}</span><span>${esc(HOOKS[id].what)}</span><span class="life">In real life: ${esc(HOOKS[id].life)}</span></div></div>`).join('')}</div>
      <p class="hsend">The hooks are the same. The difference is what they point you at${blendUsed.length ? ': Bea\'s door, or Blend\'s points' : ''}, and whether you can see them working. This game shows you its hooks. Most apps don't.</p>
      <p class="small">Each one, with the research behind it, is in your phone's Hook Log.</p>
      <div class="pfoot"><button class="btn primary" id="hsOk">Good to know</button></div>`;
    S.flags.hooksShown = 1; this.st.fieldNote('limbic');
    await new Promise((r) => { p.querySelector('#hsOk').onclick = r; if (FAST) setTimeout(r, 30); });
    ui.closePanel();
  }
  // the day's postcard: who came, what you made, and the open loop to tomorrow
  async dayCard() {
    const G = this.G, S = this.S, ui = this.ui;
    const guests = Object.keys(S.guests || {});
    const built = ['lanterns', 'quiet', 'ramp'].filter((f) => S.fixes[f] === 'built');
    const p = ui.openPanel('center daycard', `<div class="dk">Monday, Larkspur</div><h2>${guests.length} came to lantern night</h2>
      <div class="dfaces">${guests.map((id) => `<figure><img alt="" src="${ui.face(id, S)}"><figcaption>${esc(CAST[id].name)}</figcaption></figure>`).join('')}</div>
      <div class="dbuilt">${built.map((f) => `<span>${esc(SIM.FIXES[f].name)}</span>`).join('')}</div>
      <p class="lede">Tomorrow: the bus stop changes its route without a word, the Works is too bright for Gil, and Clover found something in the loft about how the Standard was made.</p>
      <div class="pfoot"><button class="btn primary" id="dGo">Keep playing: Tuesday</button><button class="btn" id="dStop">Stop here for now</button></div>`);
    G.hooks.fire('openloop', { what: 'Tuesday\'s open questions' });
    const k = await new Promise((r) => { p.querySelector('#dGo').onclick = () => r(0); p.querySelector('#dStop').onclick = () => r(1); if (FAST) setTimeout(() => r(0), 30); });
    ui.closePanel();
    if (k === 1 && (await G.menus.confirm('Stop for now?', 'Your game is saved on this device. Continue, on the title screen, picks up on Tuesday morning.', 'Back to the title', 'Keep playing'))) S.slice.stopAfter = 1;
  }
}
const LIST = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');
