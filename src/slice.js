// The first day, as one story that holds the whole game in about fifteen minutes:
//   Your room: it came set for somebody else. Six things, each set the way you like it. You change the place, not you.
//   Home Row: Wren brings a lantern to your door. Raise it, tag what pinches, hang a porch lantern, and colour rolls out.
//   Then the day is yours, in either order:
//     Market Square: every fix costs someone. Ask Moss, ask Pomeroy, sketch it so both fit, build it.
//     The Works: Bea's cart meets three steps. Argue for a ramp at a hearing, with the cards you've gathered.
//   Lantern night, when you go home: the guests you made room for, the lantern tuned to the Standard (nobody fits it),
//   and one card that asks the day's three questions: who adjusted, who profited, who checked.
// The day is a small state machine kept in S.slice: a stage (room, door, homerow, porch, open, tonight, night, done) and,
// while the day is open, one thread each for the square (mk) and the Works (wk). A save mid-day picks up where it was.
// Days two and three follow.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST, SETUP } from './content.js';
import { START } from './color.js';
import { STREETS, MARKS } from './marks.js';
import { Hearing, RAMP, CARDS, dealCard } from './hearing.js';
import { HOOKS, HOOK_ORDER } from './hooks.js';
import { HOOK_SVG } from './fx.js';
import { Blueprint } from './games/blueprint.js';
import { clamp, sleep, FAST, esc, fmtTime } from './util.js';

const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});
const PORCH_BEA = [11.4, 38.7]; // where Bea stands by your gate
const T = { home: [9.5, 37.7], porch: [9.5, 37.4], cart: [25.9, 28.9], works: [12.6, 14.6], hall: [32, 14.1], kiosk: [37.3, 29.6], bea: [22.4, 38.0] };
// the latest the clock may run to in each part of the day: the day waits for you (the open middle has its own, capNow)
const CAP = { room: 524, door: 530, homerow: 620, porch: 620, tonight: 1150, night: 1200 };
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
// the six things in your room: how each stood on the day you moved in (the lamp bright, the radio lively, the door open
// to anyone, hints on the note, the alarm set early, a bit of a plan), and where each one is
const ROOM_KEYS = ['lamp', 'radio', 'sign', 'note', 'clock', 'calendar'];
const CAME = { lamp: 0.9, radio: 0.9, sign: 0.1, note: 0.9, clock: 0.1, calendar: 0.5 };
const FOCUS = { lamp: [-0.4, 1.2, -2.35], radio: [2.9, 1.8, -2.75], sign: [-3.86, 1.45, 1.6], note: [0.75, 0.9, -2.35], clock: [-1.4, 0.85, -2.45], calendar: [-1.2, 1.9, -2.97] };
// the first day in the order most people play it (tests and older saves name a moment in it; see debugTo and migrate)
const ORDER = ['room', 'door', 'homerow', 'porch', 'tomarket', 'market', 'moss', 'rue', 'works', 'worksmarks', 'gil', 'hearing', 'tonight', 'night'];
const OLD = { wake: 'door', tomarket: ['go', 'go'], market: ['marks', 'go'], moss: ['ask', 'go'], rue: ['rue', 'go'], works: ['done', 'go'], worksmarks: ['done', 'marks'], gil: ['done', 'gil'], hearing: ['done', 'hearing'] };
const dotTex = (() => { const made = {}; return (done) => {
  const k = done ? 1 : 0; if (made[k]) return made[k];
  const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
  if (done) { x.beginPath(); x.arc(48, 48, 26, 0, Math.PI * 2); x.fillStyle = '#3fae8c'; x.fill(); x.strokeStyle = '#fffaf0'; x.lineWidth = 6; x.stroke(); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(36, 49); x.lineTo(45, 58); x.lineTo(61, 39); x.stroke(); }
  else { const g = x.createRadialGradient(48, 48, 14, 48, 48, 47); g.addColorStop(0, 'rgba(255,214,120,0.85)'); g.addColorStop(0.55, 'rgba(255,190,90,0.38)'); g.addColorStop(1, 'rgba(255,180,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 96, 96);
    x.beginPath(); x.arc(48, 48, 19, 0, Math.PI * 2); x.fillStyle = '#ffb840'; x.fill(); x.strokeStyle = '#fffaf0'; x.lineWidth = 6; x.stroke(); x.beginPath(); x.arc(48, 48, 23, 0, Math.PI * 2); x.strokeStyle = 'rgba(90,60,20,0.55)'; x.lineWidth = 2; x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; made[k] = t; return t;
}; })();

export class Slice {
  constructor(story) { this.st = story; this.G = story.G; }
  get S() { return this.G.S; }
  get ui() { return this.G.ui; }
  get on() { const S = this.S; return !!(S && S.v2 && (S.act || 1) === 1 && S.day === 1 && !this.st.ret && S.slice && S.slice.stage !== 'done'); }
  get stage() { return (this.S.slice || {}).stage || 'room'; }
  set stage(v) { this.S.slice.stage = v; this.G.story.autoSoon(); }
  // the two threads of the open middle of the day. The square: go, marks, ask, rue, done. The Works: go, marks, gil,
  // hearing, done.
  get mk() { return (this.S.slice || {}).mk || 'go'; }
  set mk(v) { this.S.slice.mk = v; this.G.story.autoSoon(); }
  get wk() { return (this.S.slice || {}).wk || 'go'; }
  set wk(v) { this.S.slice.wk = v; this.G.story.autoSoon(); }
  // a brand-new game gets the first day as a slice, and the town its colours to win back
  init() {
    const S = this.S; S.v2 = 1; S.color = Object.assign({}, START); S.slice = { stage: 'room', room: {}, mk: 'go', wk: 'go' }; S.guests = {}; S.cards = {}; S.marks = {};
    // Wren went round before you arrived and tagged one thing in each street (and the Standard's room has those clues)
    S.sights = Object.assign(S.sights || {}, { doors: 1, memo: 1 });
    S.flags.escort = 1; S.flags.shift1 = 1; S.flags.coached = 1;
  }
  say(who, t) { return this.st.say(who, t); }
  gut(t) { return this.st.gut(t); }
  note(t) { return this.st.note(t); }
  choose(opts, o) { return this.st.choose(opts, o); }
  frame(id) { const G = this.G; G.marks.hideCard(); if (G.look.raised) G.look.lower(); G.talkFrame(id); this.ui.letterbox(true); }
  // someone is about to speak to you from across a street: you walk over first, so the two of you share the picture
  // (on a phone held upright there's no room for two people standing far apart)
  async comeTo(id, gap = 1.9) {
    const G = this.G; const n = G.npcs[id]; if (!n || G.loc !== 'town' || n.place !== 'town') return;
    const p = G.player.root.position, q = n.goal && !n.path.length ? { x: n.goal[0], z: n.goal[1] } : n.c.root.position;
    const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < gap + 1.2) return;
    const ux = (p.x - q.x) / d, uz = (p.z - q.z) / d;
    const at = [[ux, uz], [ux * 0.7 + uz * 0.7, uz * 0.7 - ux * 0.7], [ux * 0.7 - uz * 0.7, uz * 0.7 + ux * 0.7], [uz, -ux], [-uz, ux]].map(([x, z]) => [q.x + x * gap, q.z + z * gap]).find(([x, z]) => G.canStand(x, z));
    if (!at) return;
    G.walkTo(at[0], at[1]); const t0 = performance.now();
    while (G.path.length && performance.now() - t0 < (FAST ? 1500 : 4500)) await sleep(60);
  }
  unframe() { this.ui.hideDialog(); this.ui.letterbox(false); this.G.endTalk(); }
  // a card for your hand. quiet: no notice (the day's card shows that one itself)
  card(id, quiet) {
    const S = this.S; S.cards = S.cards || {}; if (S.cards[id] || !CARDS[id]) return; S.cards[id] = S.day || 1;
    const c = CARDS[id];
    if (c.kind === 'insight' && this.st.fieldNote) this.st.fieldNote({ perceptible: 'ud', zoning: 'zoning', curb: 'curb', average: 'average' }[id] || id);
    if (quiet) return;
    const label = c.kind === 'insight' ? 'Insight' : c.kind === 'deal' ? 'Agreed' : 'Their words';
    // (someone's own words were said a moment ago, so their card is just named; an insight is new, so it says what it
    // is in a line, and the whole of it, with its source, is in the Fit Book)
    const first = Object.keys(S.cards).length === 1;
    const body = c.kind === 'insight' ? `<span class="tsub">${esc(c.gist || c.text)}${c.src ? ' <em>' + esc(c.src) + '</em>' : ''}</span>` : '';
    this.ui.toast(`<span class="cardline"><span class="ck ${c.kind}">${label}</span><b>${esc(c.title)}</b></span>${body}<span class="tfoot">${first ? 'A card, kept in your phone\'s Fit Book. Cards can speak for you at a hearing.' : c.kind === 'insight' ? 'The research is in your Fit Book' : 'Kept in your Fit Book'}</span>`, 'cardt', c.kind === 'insight' ? 4200 : first ? 4200 : 2600);
    this.G.audio.sfx('ink');
  }
  // a deal: the person a fix costs said what would make it work, and it's in your hand now
  dealToast(f) { const d = dealCard(f); if (!d) return; this.ui.toast(`<span class="cardline"><span class="ck deal">Agreed</span><b>${esc(d.title)}</b></span><span class="tfoot">Kept in your Fit Book</span>`, 'cardt', 3000); this.G.audio.sfx('sign'); }
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
  // (delay: when several are added at once, their pops come one after another, not on top of each other)
  addGuest(id, quiet, delay = 0) {
    const S = this.S; S.guests = S.guests || {}; if (S.guests[id]) return; S.guests[id] = 1;
    // (someone you made room for knows you a little now: goodwill to ask a small favour later; Wren, who lent you the
    // lantern, a little more)
    S.gw = S.gw || {}; S.gw[id] = Math.max(S.gw[id] || 0, id === 'wren' ? 2 : 1);
    this.renderGuests(id);
    if (quiet) return;
    const G = this.G;
    setTimeout(() => {
      const n = G.npcs[id]; const at = n && n.c.root.visible ? n.c.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)) : { x: innerWidth - 120, y: 150 };
      G.fx.pop(at, CAST[id].name + ' can come to lantern night', { kind: 'guest', hook: 'juice', hookCtx: { what: CAST[id].name + ' can come to lantern night', point: CAST[id].name + ', and a place on your porch tonight' }, ms: 2400 });
      G.audio.sfx('guest');
    }, FAST ? 0 : delay);
  }
  // the guest list, top right: who you've made room for so far (Wren is coming whatever happens)
  renderGuests(fresh) {
    const S = this.S; const el = this.ui.el('#hud .gstrip'); if (!el) return;
    const all = ['wren', 'bea', 'moss', 'pomeroy', 'pip', 'gil', 'rue', 'hollis'];
    const show = (this.on || this.stage === 'night') && Object.keys(S.guests || {}).length > 0;
    el.hidden = !show; if (!show) return;
    // (in the order they said yes, then the places still open)
    const got = Object.keys(S.guests || {}).filter((id) => CAST[id]); const n = got.length; const open = Math.max(0, all.length - n);
    el.innerHTML = `<span class="gl">Lantern night</span><span class="gf">${got.map((id) => `<img class="${id === fresh ? 'fresh' : ''}" alt="${esc(CAST[id].name)}" title="${esc(CAST[id].name)}" src="${this.ui.face(id, S)}">`).join('')}${'<i title="Someone you haven\'t made room for yet"></i>'.repeat(open)}</span><b class="gn">${n}</b>`;
  }
  // tests and probes: the first day as if everything before this moment went the usual way (the square first, then the
  // Works). A moment is one of ORDER, or 'open' with o.mk and o.wk. o.worksFirst: the Works was finished before the
  // square was begun. o.blend: you said yes to Blend.
  debugTo(name, o = {}) {
    const G = this.G, S = this.S; if (name === 'wake') name = 'door';
    const at = (n) => ORDER.indexOf(n); const k = name === 'open' ? at('tomarket') : at(name); if (k < 0) return false;
    const sl = S.slice = S.slice || {}; const past = (n) => k > at(n);
    // your room, set (the first picture of each, the way the test driver taps them)
    sl.room = sl.room || {};
    if (past('room')) {
      for (const key of ROOM_KEYS) { if (sl.room[key] == null) sl.room[key] = 0.22; const sp = SETUP[key]; S.profile[sp.dim] = sp.invert ? 1 - sl.room[key] : sl.room[key]; }
      if (!S.tf0) S.tf0 = SIM.townFit(S.fixes, S.stakes).all;
    }
    G.rooms.home.setLantern(false); S.guests = {}; S.stakes = S.stakes || {}; S.fixVia = S.fixVia || {};
    if (past('door')) { S.flags.lantern = 1; S.flags.firstOut = 1; S.guests.wren = 1; S.met.wren = true; }
    const tagAll = (z) => { for (const m of MARKS) if (m.street === z && !m.rare && !m.fit) S.marks[m.id] = { day: 1, min: 600 }; };
    if (past('porch')) { tagAll('homerow'); sl.porch = 'teal'; S.stakes.lanterns = 'listened'; S.fixes.lanterns = 'built'; S.fixVia.lanterns = 'slice'; G.town.setFix('lanterns', true); S.color.homerow = 1; S.guests.bea = 1; S.cards.bea_knock = 1; S.cards.perceptible = 1; S.met.bea = true; }
    else if (past('homerow')) tagAll('homerow');
    // the two threads: where each one stands
    const MK = ['go', 'marks', 'ask', 'rue', 'done'], WK = ['go', 'marks', 'gil', 'hearing', 'done'];
    let [mk, wk] = name === 'open' ? [o.mk || 'go', o.wk || 'go'] : Array.isArray(OLD[name]) ? OLD[name] : past('hearing') ? ['done', 'done'] : ['go', 'go'];
    if (o.worksFirst && k >= at('tomarket') && k <= at('rue')) wk = 'done';
    const mp = (x) => MK.indexOf(mk) > MK.indexOf(x), wp = (x) => WK.indexOf(wk) > WK.indexOf(x);
    if (mp('go')) tagAll('market');
    if (mp('marks')) sl.heard = mp('ask') ? { moss: 1, pomeroy: 1 } : sl.heard || {};
    if (mp('ask')) { S.fixes.quiet = 'built'; S.fixVia.quiet = 'slice'; G.applyFix('quiet'); S.sketch = { quiet: 'zoned' }; S.stakes.quiet = 'listened'; S.color.market = 1; Object.assign(S.guests, { moss: 1, pomeroy: 1 }); Object.assign(S.cards, { moss_kettle: 1, pomeroy_loud: 1, zoning: 1 }); for (const id of ['moss', 'pomeroy', 'clover']) S.met[id] = true; }
    if (mk === 'done') { S.guests.rue = 1; sl.blend = o.blend ? 'yes' : 'no'; S.flags.rue_pitched = 1; S.met.rue = true; if (o.blend) G.installBlend(); }
    if (wp('go')) { S.cards.bea_steps = 1; }
    if (wp('marks')) { tagAll('works'); S.met.gil = true; }
    if (wp('gil')) { S.stakes.ramp = 'listened'; S.cards.curb = 1; sl.gil = 'asked'; }
    if (wk === 'done') { S.flags.hearingDone = 1; S.fixes.ramp = 'built'; S.fixVia.ramp = 'slice'; G.applyFix('ramp'); S.color.works = 1; Object.assign(S.guests, { pip: 1, gil: 1, hollis: 1 }); for (const id of ['hollis', 'pip']) S.met[id] = true; }
    S.min = name === 'open' ? 690 + (mk === 'done' ? 100 : 0) + (wk === 'done' ? 60 : 0) : o.worksFirst && wk === 'done' && mk !== 'done' ? 805 : { room: 520, door: 524, homerow: 545, porch: 560, tomarket: 690, market: 705, moss: 730, rue: 790, works: 800, worksmarks: 810, gil: 830, hearing: 850, tonight: 1110, night: 1150 }[name];
    if (past('porch')) S.color.street = 0.28 + 0.22 * ((mp('ask') ? 1 : 0) + (wk === 'done' ? 1 : 0));
    // (a sample day, for the title's "Short on time?": the rewards a day like this one brings)
    if (o.sample) {
      S.hooks = { endowed: 3, juice: 12, gradient: 3 }; S.stats.fix = 1;
      S.hookLog = [['juice', 'Bea can come to lantern night', 'Bea, and a place on your porch tonight'], ['juice', 'A mark tagged: The speaker over the benches', 'the speaker over the benches, which pinches Moss, Bea and Wren'], ['gradient', '"1 left" in Market Square', 'the last thing in Market Square that pinches someone'], ['juice', 'Moss can come to lantern night', 'Moss, and a place on your porch tonight'], ['endowed', 'Home Row started at 1 of 3, ticked by Wren', 'the doors on Home Row, which Wren had already noticed']].map(([id, what, point]) => ({ id, what, by: 'game', day: 1, point }));
      sl.hearing = { passed: true, yes: 3 };
    }
    sl.mk = mk; sl.wk = wk;
    this.stage = k <= at('porch') ? name : k <= at('hearing') ? 'open' : name;
    this.restore(); this.renderGuests();
    return true;
  }
  // ---------- the prologue: the town from above, then you ----------
  async prologue(from) {
    const G = this.G, S = this.S, ui = this.ui, st = this.st; const made = from === 'setup';
    // (a creature saved by the version before this one had its room still to set)
    if (made && S.slice && S.slice.stage === 'wake') S.slice.stage = 'room';
    G.mode = 'cine'; ui.letterbox(true); st.inPrologue = true;
    S.min = 17.4 * 60;
    if (!made) {
      // sonder first: from up high the town is one crowd; look closer and everyone in it has a day of their own. A town
      // planned from up there gets built for one imagined person, which is where the Standard Resident comes in.
      G.openingCrowd = true; G.busRide = true;
      this.shot(new THREE.Vector3(30, 40, 74), new THREE.Vector3(30, 0, 27), 46, 0.6, true);
      await sleep(FAST ? 10 : 800);
      await ui.caption('From up here, Larkspur looks like one crowd.', 2600);
      // look closer: the camera comes down into the square, among the people, and you find out what their days are
      { const to = new THREE.Vector3(30.5, 10.5, 44); this.shot(to, new THREE.Vector3(29.5, 1.4, 28.5), 42, 1.1);
        // (the words wait until the camera is nearly down, so the people are big enough to tap)
        await sleep(FAST ? 10 : 600); await this.until(() => st.skipIntro || G.stage.camera.position.distanceTo(to) < 4.5, 2600); }
      // (the words sit up in the sky for this, so the thoughts can sit over the people in the square)
      const capEl = ui.el('#caption'); capEl.classList.add('high');
      const shown = await this.lookCloser();
      await ui.caption(shown ? 'Everyone is in the middle of their own day.' : 'Up close, everyone is in the middle of their own day.', 3200);
      capEl.classList.remove('high');
      if (G.sonder) G.sonder.clear();
      this.shot(new THREE.Vector3(35.5, 5.6, 31.5), new THREE.Vector3(30, 3.2, 24), 30, 0.5);
      // (these words sit low, under the statue they're about)
      capEl.classList.add('low');
      await ui.caption('But the town was built to fit one person: the Standard Resident. That\'s its statue.', 4200);
      capEl.classList.remove('low');
      G.busRide = false; G.openingCrowd = false;
    }
    st.inPrologue = false; st.skipIntro = false;
    await G.stage.fadeTo(1, 700);
    // (while the screen is dark: the map of what blocks a line of sight in town is drawn up now, so the first
    // conversation outside doesn't have to stop and make it)
    try { if (G.occ) G.occ(); } catch (e) { /* (made later, when it's first needed) */ }
    // from the one they built it for, to you: your first morning, in your new room
    S.min = 520;
    G.setLoc('home'); G.player.root.visible = true; G.place([0.6, 0.2]); G.player.heading = 0.25;
    G.audio.setScene('home'); G.rooms.home.setLantern(false);
    if (this.stage === 'room') this.roomRestore();
    ui.letterbox(false);
    if (!made) {
      G.stage.shot(new THREE.Vector3(1.6, 1.55, 4.1), new THREE.Vector3(0.45, 0.62, 0.1), 34, 3, true);
      if (window.innerWidth > 760) G.stage.offsetX(Math.min(220, window.innerWidth * 0.17)); else G.stage.offsetX(0, Math.round(window.innerHeight * 0.24));
      await G.stage.fadeTo(0, 700);
      G.mode = 'creator'; G.player.heading = 0.6; G.posePreview = true; if (!S.look.comfort) S.look.comfort = 'hum';
      const look = await ui.creator(S.look, (L, k) => { S.look = L; S.wheels = !!L.wheels; G.player.setLook(L); if (k === 'comfort' || k === 'all') G.player.previewComfort(L.comfort || 'hum'); else G.player.hop(); if (k === 'voice') G.audio.voice(L.voice, 1, 'hello hello'); });
      G.posePreview = false; G.player.setComfort(look.comfort || 'hum', 0);
      S.look = look; S.wheels = !!look.wheels; S.look0 = Object.assign({}, look);
      G.player.setLook(look); S.portrait0 = G.portrait();
      st.saveNow('setup', 0);
    } else { G.player.setLook(S.look); G.player.setComfort(S.look.comfort || 'hum', 0); if (!S.portrait0) S.portrait0 = G.portrait(); }
    G.stage.offsetX(0, 0);
    G.mode = 'cine';
  }
  // "Look closer": you tap people in the square, and each one shows what their day is about. Three, and the rest of the
  // crowd's thoughts appear too. Nothing here needs quick hands: wait a few seconds and they appear by themselves (with
  // Reading time set to "Until I close it", they wait for you). Resolves with how many thoughts are showing.
  lookCloser() {
    const G = this.G, ui = this.ui, st = this.st, so = G.sonder; const band = [0.03, 0.33];
    if (!so || !G.fx || st.skipIntro) return Promise.resolve(0);
    const used = new Set(); const said = []; const ms = 60000;
    const show = (p, tapped) => { if (!p) return false; used.add(p.root); const t = so.say(p, ms, so.openLine(p)); said.push(t); G.audio.sfx('pop'); if (tapped) ui.announce('Someone in the crowd, thinking: ' + t); return true; };
    const cap = ui.el('#caption'); cap.textContent = 'Look closer. ' + (ui.touch ? 'Tap anyone.' : 'Click anyone.');
    if (!ui.touch) { const h = document.createElement('small'); h.className = 'caphint'; h.textContent = 'or press Space'; cap.appendChild(h); }
    cap.classList.add('on'); ui.announce('Look closer. ' + (ui.touch ? 'Tap anyone in the crowd.' : 'Click anyone in the crowd, or press Space.'));
    return new Promise((resolve) => {
      let taps = 0, over = false, idle = 0;
      const finish = () => {
        if (over) return; over = true; G.onTap = null; clearInterval(iv); clearTimeout(idle); cap.classList.remove('on');
        if (st.skipIntro) { resolve(said.length); return; }
        // the rest of the square, one after another, each where its words have room
        // (well apart first; if the crowd is bunched up and fewer than five fit that way, a closer fit for the rest)
        const rest = [];
        for (const gap of [true, [Math.min(180, innerWidth * 0.42), 44], [Math.min(130, innerWidth * 0.34), 38]]) {
          for (let i = used.size; i < 7; i++) { const p = so.nearest(Math.random() * innerWidth, innerHeight * (0.3 + Math.random() * 0.6), used, band, gap); if (!p) break; used.add(p.root); rest.push(p); }
          if (used.size >= 5) break;
        }
        rest.forEach((p, i) => setTimeout(() => { said.push(so.say(p, ms, so.openLine(p))); }, FAST ? 0 : 220 * i));
        setTimeout(() => { if (said.length) ui.announce('Over the crowd, one thought each: ' + said.join(' ')); resolve(said.length); }, FAST ? 20 : 220 * rest.length + 500);
      };
      const wait = () => { clearTimeout(idle); idle = setTimeout(finish, FAST ? 30 : (taps ? 5000 : 7000) * (ui.holdText() ? 2.5 : 1)); };
      // (a tap shows the person nearest it; the keyboard, someone whose words have room)
      G.onTap = (x, y) => { if (over) return; if (show(so.nearest(x, y, used, band, x == null), true)) taps++; if (taps >= 3 || !so.nearest(null, null, used, band)) setTimeout(finish, FAST ? 0 : 700); else wait(); };
      const iv = setInterval(() => { if (st.skipIntro) finish(); }, 120);
      wait();
    });
  }
  // ---------- your room ----------
  roomHas(k) { return ((this.S.slice || {}).room || {})[k] != null; }
  roomCount() { return ROOM_KEYS.filter((k) => this.roomHas(k)).length; }
  // one of the six things, shown at a setting (0 to 1)
  applyRoom(k, val) {
    const G = this.G, home = G.rooms.home;
    if (k === 'lamp') home.setLight(val);
    // (the radio turns the game's own music down or up a little, never past the volume you chose in Settings)
    if (k === 'radio') { G.audio.radio = this.stage === 'room' ? 0.45 + val * 0.6 : 1; G.audio.applyVolumes(); }
    if (k === 'sign') home.setSign(val);
    if (k === 'calendar') home.setCalendar(val);
    if (k === 'clock') home.objs.clock.group.rotation.y = (val - 0.5) * 0.6;
    if (k === 'note') home.objs.note.group.rotation.y = 0.2 + val * 0.6;
  }
  // the room as it stands: each thing the way you set it, or the way it came if you haven't yet. While you're still
  // setting it, there's nothing to go out for.
  roomRestore() {
    const S = this.S, home = this.G.rooms.home; const R = S.slice.room = S.slice.room || {}; const setting = this.stage === 'room';
    for (const k of ROOM_KEYS) this.applyRoom(k, R[k] != null ? R[k] : CAME[k]);
    const out = home.inter.find((i) => i.id === 'out'); if (out) out.hidden = setting;
    this.roomDots();
  }
  // a glowing dot over each thing you can set, and a tick once you have
  roomDots() {
    const G = this.G; const on = this.stage === 'room' && G.loc === 'home' && G.mode === 'play';
    if (!this.dots) { if (!on) return; this.dots = {}; for (const k of ROOM_KEYS) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(false), transparent: true, depthTest: false, depthWrite: false })); const f = FOCUS[k]; sp.position.set(f[0] + (k === 'sign' ? 0.12 : 0), f[1] + (k === 'calendar' ? 0.72 : 0.5), f[2] + (k === 'sign' ? 0 : 0.1)); sp.renderOrder = 9; sp.userData.noOcc = true; G.rooms.home.scene.add(sp); this.dots[k] = sp; } }
    const t = performance.now() / 1000; const still = G.settings.reduceMotion;
    ROOM_KEYS.forEach((k, i) => {
      const sp = this.dots[k]; sp.visible = on; if (!on) return;
      const done = this.roomHas(k); const tex = dotTex(done); if (sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true; }
      const sc = done ? 0.34 : 0.66 * (still ? 1 : 1 + 0.12 * Math.sin(t * 3 + i * 1.3)); sp.scale.set(sc, sc, 1);
    });
  }
  // where each thing is on screen right now (a click or a tap near one walks you to it)
  roomHit(x, y) {
    const G = this.G; if (this.stage !== 'room' || G.loc !== 'home') return null;
    const v = new THREE.Vector3(); let best = null, bd = Math.max(46, Math.min(innerWidth, innerHeight) * 0.085);
    for (const k of ROOM_KEYS) { const f = FOCUS[k]; for (const dy of [0, 0.5]) { v.set(f[0], f[1] + dy, f[2]).project(G.stage.camera); const d = Math.hypot((v.x + 1) / 2 * innerWidth - x, (1 - v.y) / 2 * innerHeight - y); if (d < bd) { bd = d; best = k; } } }
    return best ? G.rooms.home.inter.find((i) => i.id === best) : null;
  }
  // one thing in your room: the camera goes to it, two pictures, and the room changes as you choose
  async setThing(k) {
    const G = this.G, S = this.S; const spec = SETUP[k]; const f = FOCUS[k]; if (!spec || this.stage !== 'room') return;
    const R = S.slice.room = S.slice.room || {}; const before = R[k] != null ? R[k] : CAME[k];
    const cp = k === 'sign' ? new THREE.Vector3(-1.2, 2.0, 2.4) : new THREE.Vector3(f[0] + 0.9, f[1] + 0.7, f[2] + 2.6);
    G.stage.shot(cp, new THREE.Vector3(f[0], f[1], f[2]), 36, 2.4); G.player.faceToward(f[0], f[2]);
    for (const sp of Object.values(this.dots || {})) sp.visible = false;
    const v = await this.tapStep(k, spec, (val) => this.applyRoom(k, val), R[k]);
    if (v == null) this.applyRoom(k, before);
    else { R[k] = v; S.profile[spec.dim] = spec.invert ? 1 - v : v; this.applyRoom(k, v); }
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 2.4); }
    this.roomDots();
  }
  // every thing is set: this is the one place in Larkspur that fits you exactly. Then, a knock.
  async roomDone() {
    const G = this.G, S = this.S;
    await sleep(FAST ? 20 : 700);
    await this.note('There. Everything in this room is set the way you like it.');
    await this.gut('Remember how this feels.');
    this.ui.hideDialog();
    S.tf0 = SIM.townFit(S.fixes, S.stakes).all;
    this.stage = 'door'; this.roomRestore();
    await sleep(FAST ? 20 : 1100);
    this.knock();
  }
  // Wren, at your door, the way your door sign asks: a text first, or one knock
  knock() {
    const G = this.G, S = this.S; if (this.stage !== 'door') return;
    if (S.profile.people < 0.5) this.st.text('Wren', 'I am outside your door. Your sign says to text first. This is the text.');
    else { G.audio.sfx('knock'); this.ui.cc('One knock at your door. Then quiet.', 3200); }
  }
  // one object in your room, two pictures: pick the one that's you (cur: what you picked before, if you're changing it)
  tapStep(key, spec, apply, cur) {
    const lo = 0.22, hi = 0.78; const ui = this.ui; const G = this.G;
    const pics = PICS[key]; const n = this.roomCount();
    const p = ui.openPanel('setup taps', `<div class="q">${esc(spec.q)}</div><div class="twopick">${[[lo, spec.lo, pics[0]], [hi, spec.hi, pics[1]]].map(([v, label, svg], i) => `<button class="pick ${cur === v ? 'on' : ''}" data-v="${v}" aria-pressed="${cur === v}"><span class="pic">${svg}</span><span class="pl"><kbd>${i + 1}</kbd>${esc(label)}</span></button>`).join('')}</div><div class="foot"><div class="dots" aria-label="${n} of ${ROOM_KEYS.length} set">${ROOM_KEYS.map((k) => `<i class="${this.roomHas(k) ? 'on' : ''}"></i>`).join('')}</div><div class="fbtns"><button class="btn" id="back">${cur == null ? 'Not now' : 'Leave it'}</button></div></div>`);
    const btns = [...p.querySelectorAll('.pick')];
    // hovering a picture shows it in the room
    btns.forEach((b) => { b.onpointerenter = () => apply(+b.dataset.v); b.onfocus = () => apply(+b.dataset.v); });
    if (!ui.touch) setTimeout(() => { const b = btns.find((x) => x.classList.contains('on')) || btns[0]; b.focus(); }, 40);
    return new Promise((r) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; window.removeEventListener('keydown', kh, true); ui.closePanel(); r(v); };
      const pick = (b) => { if (done) return; btns.forEach((x) => x.classList.toggle('on', x === b)); G.audio.sfx('confirm'); apply(+b.dataset.v); setTimeout(() => finish(+b.dataset.v), FAST ? 10 : 320); };
      const kh = (e) => {
        if (G.menus && G.menus.open) return;
        if (e.key === '1') pick(btns[0]); else if (e.key === '2') pick(btns[1]); else if (e.key === 'ArrowLeft') btns[0].focus(); else if (e.key === 'ArrowRight') btns[1].focus();
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); G.audio.sfx('back'); finish(null); }
      };
      window.addEventListener('keydown', kh, true);
      btns.forEach((b) => { b.onclick = () => pick(b); });
      p.querySelector('#back').onclick = () => { G.audio.sfx('back'); finish(null); };
    });
  }
  // ---------- the day ----------
  async day(phase) {
    const G = this.G, S = this.S, st = this.st;
    this.migrate();
    if (phase === 'morning') { st.saveNow('morning', 1); await this.morning(); }
    else if (phase === 'sample') {
      // (the title's "Short on time?": you're on your own porch, and the sample day is behind you)
      G.setLoc('town'); G.place([9.5, 38.6]); G.player.heading = Math.PI; G.stage.follow(G.player.root.position, G.followOpts({ snap: true })); G.audio.setScene('town');
      G.timeScale = FAST ? 22 : 1.2; this.ui.hud(true); this.ui.letterbox(false); this.restore(); G.stage.fadeTo(0, 600);
    } else { st.resumeDay(phase); this.restore(); }
    this.renderGuests();
    await new Promise((r) => { st.endDay = r; G.mode = 'play'; G.busy = 0; });
    if (st.sample) { await G.stage.fadeTo(1, 900); location.reload(); await sleep(60000); }
    // lantern night ended the day: the porch goes dark, and the next morning is Tuesday
    await G.stage.fadeTo(1, 1100);
    st.fieldNote('endings'); st.fieldNote('made'); st.openAutism();
    this.carryOpen();
    SIM.nightUpdate(S);
    await this.ui.caption('Night.', 1200);
    S.slice.stage = 'done'; G.timeScale = FAST ? 22 : 2.5;
    { const el = this.ui.el('#hud .gstrip'); if (el) el.hidden = true; }
    if (S.slice.stopAfter) { delete S.slice.stopAfter; this.st.saveNow('morning', 2); await G.stage.fadeTo(1, 600); location.reload(); await sleep(60000); }
  }
  // a save from the version before this one names a moment of the old, fixed day: the same moment in this one
  migrate() {
    const S = this.S, sl = S.slice; if (!sl) return;
    const was = OLD[sl.stage];
    if (was === 'door') sl.stage = 'door';
    else if (Array.isArray(was)) { sl.stage = 'open'; sl.mk = was[0]; sl.wk = was[1]; if (was[0] !== 'go' && was[0] !== 'marks') sl.heard = was[0] === 'ask' ? {} : { moss: 1, pomeroy: 1 }; }
    // (its room was set in the old opening: keep it as it was set)
    if (sl.stage !== 'room' && !sl.room) { sl.room = {}; for (const k of ROOM_KEYS) { const sp = SETUP[k]; const v = S.profile[sp.dim]; sl.room[k] = sp.invert ? 1 - v : v; } }
    if (!sl.mk) sl.mk = 'go'; if (!sl.wk) sl.wk = 'go';
  }
  // a street you looked at properly but didn't get to today is noted for the Fix-It Shed: Tuesday can pick it up
  carryOpen() {
    const S = this.S, G = this.G;
    for (const [z, who] of [['market', 'moss'], ['works', 'bea']]) {
      const f = STREETS[z].fix; if (!G.marks.complete(z) || (S.fixes[f] || 'none') !== 'none') continue;
      S.fixes[f] = 'idea'; S.flags.idea_any = true; S.ideaFrom = S.ideaFrom || {}; S.ideaFrom[f] = S.ideaFrom[f] || [who];
    }
  }
  async morning() {
    const G = this.G, S = this.S; const setting = this.stage === 'room';
    S.day = 1; S.min = 520; G.timeScale = FAST ? 22 : 1.2;
    G.setLoc('home'); G.audio.setScene('home'); G.rooms.home.setLantern(false);
    S.dayStats = Object.assign({}, S.stats); S.metAt0 = Object.keys(S.met); S.fixAt0 = Object.assign({}, S.fixes);
    this.roomRestore();
    if (setting) {
      // straight from the mirror: the camera eases back, and the room is yours to walk around
      G.place([0.9, 0.9]); G.player.heading = 0.4;
      { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, FAST ? 3 : 1.3); }
      this.ui.hud(true);
      await G.stage.fadeTo(0, 700);
      await sleep(FAST ? 20 : 900);
      await this.note('Your new room, at No. 2 Home Row. It came like this: bright, loud, and open to anyone.');
      this.ui.hideDialog();
      // (you saw how it came: the statue's puzzle can call back to it, later)
      S.slice.came = 1;
    } else {
      G.place(G.rooms.home.spots.center); G.player.heading = -0.9;
      { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
      this.ui.hud(true);
      await G.stage.fadeTo(0, 900);
      if (this.stage === 'door') setTimeout(() => this.knock(), FAST ? 20 : 900);
    }
  }
  // after a reload mid-day: the room and the people as this part of the day has them
  restore() {
    const G = this.G, S = this.S; G.timeScale = FAST ? 22 : 1.2; const s = this.stage;
    this.roomRestore();
    this.porchColors();
    if (s === 'porch') this.walkIn('bea', PORCH_BEA);
    if (s === 'open' && this.wk !== 'done') this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true);
    if ((S.marks || {}).wk_steps && S.fixes.ramp !== 'built') this.detour(true);
  }
  porchColors() {
    const S = this.S, town = this.G.town; if (!town.setPorch) return;
    const mine = (S.slice || {}).porch || 'teal';
    for (let i = 0; i < 5; i++) town.setPorch(i, i === 1 ? mine : i === 3 ? 'amber' : i % 2 ? 'amber' : 'teal');
  }
  objective() {
    const S = this.S, G = this.G; const s = this.stage; const touch = this.ui.touch;
    const c = (z) => this.G.marks.count(z);
    if (s === 'room') {
      const n = this.roomCount(); if (n >= ROOM_KEYS.length) return ob('');
      // (the first one says how; after that, the count is enough)
      return ob('Make this room fit you (' + n + '/' + ROOM_KEYS.length + ').' + (n ? '' : touch ? ' Tap a glowing dot.' : ' Click a glowing dot, or walk to one and press ' + G.keyOf('interact') + '.'), null, '', { inside: 'home' });
    }
    if (s === 'door') return ob(S.profile.people < 0.5 ? 'Wren texted. She\'s at your door.' : 'Someone knocked, once.', T.porch, 'Your door', { inside: 'home', spot: 'out', spotLabel: 'Door' });
    if (s === 'homerow') {
      if (G.loc === 'home') return ob('Take the lantern out onto Home Row.', T.porch, 'Home Row', { inside: 'home', spot: 'out', spotLabel: 'Door' });
      if (!G.look.raised && c('homerow').done < c('homerow').total) return ob('Raise Wren\'s lantern' + (touch ? ' (the lantern button).' : ' (' + G.keyOf('look') + ').'), null);
      // (the arrow leads the way, but a mark's name waits until the beam has found it: the lesson is the sweep)
      const m = this.nextMark('homerow'); const found = m && G.marks.seen && G.marks.seen.has(m.id);
      return ob('Turn, and sweep the beam along Home Row. It glows near what pinches people. Tag it with ' + (touch ? 'a tap' : G.keyOf('interact')) + ' (' + c('homerow').done + '/' + c('homerow').total + ').', m ? [m.at[0], m.at[2] + 1.6] : null, found ? m.name : 'Something to find');
    }
    if (s === 'porch') return ob('Hang a porch lantern at your door, No. 2.', T.porch, 'Your door');
    if (s === 'open') return this.openObjective();
    if (s === 'tonight') return ob('Lantern night. Your guests are on their way.', [9.5, 39.0], 'Your porch');
    return ob('');
  }
  // one thread of the open day, as the step it's on (nothing once it's done)
  threadOb(k) {
    const G = this.G, S = this.S; const touch = this.ui.touch; const c = (z) => G.marks.count(z);
    const raise = (where) => ob('Raise the lantern ' + where + (touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
    if (k === 'mk') {
      const m = this.mk; const h = S.slice.heard || {};
      if (m === 'go') return ob('Moss can\'t hear her own kettle in Market Square.', T.cart, 'Market Square');
      if (m === 'marks') {
        if (!this.inZone('market')) return ob('Market Square: see what pinches people there.', [29.5, 28.5], 'Market Square');
        if (!G.look.raised && c('market').done < c('market').total) return raise('in the square');
        return ob('Sweep the lantern around the square. Tag what pinches people (' + c('market').done + '/' + c('market').total + (this.wrenOnly('market') ? ': Wren tagged one' : '') + ').', null);
      }
      if (m === 'ask') return !h.moss ? ob('You\'ve seen the square. Now ask Moss.', this.near('moss', T.cart), 'Moss') : !h.pomeroy ? ob('A quiet square would cost someone. Ask Pomeroy.', this.near('pomeroy', [28.4, 26.2]), 'Pomeroy') : ob('Clover is sketching a square where everyone fits.', null);
      if (m === 'rue') return ob('Rue is waving you over to the Blend kiosk.', this.near('rue', T.kiosk), 'Rue');
      return null;
    }
    const w = this.wk;
    if (w === 'go') return ob('Bea is stuck outside the Works.', [13.6, 15.6], 'The Works');
    if (w === 'marks') {
      if (!this.nearPos([15, 13], 9)) return ob('The Works: see what pinches people there.', [14, 15], 'The Works');
      if (!G.look.raised && c('works').done < c('works').total) return raise('at the Works');
      return ob('Sweep the lantern around the Works. Tag what pinches people (' + c('works').done + '/' + c('works').total + (this.wrenOnly('works') ? ': Wren tagged one' : '') + '). Try the long way round, too.', null);
    }
    if (w === 'gil') return ob('Gil wants a word.', this.near('gil', [14.2, 14.4]), 'Gil');
    if (w === 'hearing') return ob('The hearing about the ramp, at Town Hall.', T.hall, 'Town Hall');
    return null;
  }
  // the open middle of the day. In the middle of something: that step. Nothing started: both places, each with its own
  // beacon. One finished: the other, or home. Both finished: home, for lantern night.
  openObjective() {
    const G = this.G; const mk = this.mk, wk = this.wk; const A = this.threadOb('mk'), B = this.threadOb('wk');
    const live = (v) => v !== 'go' && v !== 'done'; const HOME = { at: [9.5, 39.0], label: 'Home' };
    const p = G.player.root.position; const far = (o) => (o && o.at ? Math.hypot(o.at[0] - p.x, o.at[1] - p.z) : 0);
    const also = (o, x) => (x && x.at ? Object.assign(o, { more: { at: x.at, label: x.label } }) : o);
    if (!A && !B) return ob('Lantern night starts when you get home.', HOME.at, 'Your porch');
    if (live(mk) && live(wk)) return (G.loc === 'town' && G.zone === 'market') || far(A) <= far(B) ? also(A, B) : also(B, A);
    if (live(mk)) return A;
    if (live(wk)) return B;
    if (A && B) { const [x, y] = far(A) <= far(B) ? [A, B] : [B, A]; return also(ob('Two places pinch someone you know. Go to either one first.', x.at, x.label), y); }
    const one = A || B;
    return also(ob(one.t + ' Or go home: lantern night starts when you do.', one.at, one.label), HOME);
  }
  // the street whose marks you're looking for right now, standing in it (null anywhere else)
  sweepZone() {
    const s = this.stage; if (this.G.loc !== 'town') return null;
    if (s === 'homerow') return 'homerow';
    if (s !== 'open') return null;
    if (this.mk === 'marks' && this.inZone('market')) return 'market';
    if (this.wk === 'marks' && this.nearPos([15, 13], 9)) return 'works';
    return null;
  }
  inZone(z) { return this.G.loc === 'town' && this.G.zone === z; }
  // (Wren tags one mark on each street before you start: say so, until you've tagged one yourself)
  wrenOnly(z) { const mine = this.S.marks || {}; return MARKS.some((m) => m.street === z && m.pre) && !MARKS.some((m) => m.street === z && mine[m.id]); }
  near(id, dflt) { const n = this.G.npcs[id]; if (n && n.place === 'town') { const q = n.c.root.position; return [q.x, q.z + 0.9]; } return dflt; }
  nextMark(z) { const p = this.G.player.root.position; let best = null, bd = 1e9; for (const m of MARKS) { if (m.street !== z || m.rare || m.fit || this.G.marks.tagged(m.id)) continue; const d = Math.hypot(m.at[0] - p.x, m.at[2] - p.z); if (d < bd) { bd = d; best = m; } } return best; }
  goals() {
    const S = this.S; const g = S.guests || {}; const s = this.stage; const L = ['room', 'door', 'homerow', 'porch', 'open', 'tonight', 'night', 'done'];
    return [
      { t: 'Make your room fit you', done: L.indexOf(s) > 0 },
      { t: 'Home Row: a light by the door', done: (S.color || {}).homerow >= 1 },
      { t: 'Market Square: Moss and her kettle', done: this.mk === 'done' },
      { t: 'The Works: Bea and three steps', done: this.wk === 'done' },
      { t: 'Lantern night, when you go home (' + Object.keys(g).length + ' coming so far)', done: s === 'done' },
    ];
  }
  label(it) {
    const s = this.stage;
    if (it.kind === 'set') return s === 'room' ? it.label + (this.roomHas(it.id) ? ' ✓' : '') : null;
    if (it.id === 'out' && s === 'door') return 'Open the door';
    if (it.id === 'home' && s === 'porch') return 'Hang a porch lantern';
    if (it.id === 'home' && s === 'open' && this.G.loc === 'town') return this.mk === 'done' && this.wk === 'done' ? 'Go home: lantern night' : 'Go home';
    if (it.id === 'hall' && s === 'open' && this.wk === 'hearing') return 'Go in: the hearing';
    return null;
  }
  // things you can use, while the slice is on: the things in your room, your door, the hall for the hearing
  async handle(t) {
    const s = this.stage;
    if (t.kind === 'set') { if (s === 'room') await this.setThing(t.id); return true; }
    if (t.id === 'out' && s === 'door') { await this.wrenAtDoor(); return true; }
    if (t.id === 'home' && s === 'porch') { await this.hangLantern(); return true; }
    if (t.id === 'home' && s === 'open') return this.homeDoor();
    if (t.id === 'hall' && s === 'open' && this.wk === 'hearing') { await this.hearing(); return true; }
    if ((t.id === 'home' || t.id === 'bed') && s === 'tonight') { await this.note('Your guests are coming here. Wait on the porch.'); this.ui.hideDialog(); return true; }
    return false;
  }
  // your own front door, while the day is open: lantern night starts when you say so. With a place still unseen to,
  // it asks first, and says what waits until tomorrow.
  async homeDoor() {
    const S = this.S; const mk = this.mk !== 'done', wk = this.wk !== 'done';
    if (!mk && !wk) { this.stage = 'tonight'; return true; }
    const left = mk && wk ? 'Moss still can\'t hear her kettle, and Bea is still stuck at the Works steps. Both can wait until tomorrow.' : mk ? 'Moss still can\'t hear her kettle. That can wait until tomorrow.' : 'Bea is still stuck at the Works steps. That can wait until tomorrow.';
    const k = await this.choose([{ t: 'Yes, start lantern night', id: 'night_now' }, { t: 'Not yet', id: 'night_wait' }, { t: 'Just go inside for a bit', id: 'night_in' }], { text: 'End the day here? ' + left, kind: 'gut' });
    this.ui.hideDialog();
    if (k === 0) { S.slice.early = 1; this.stage = 'tonight'; return true; }
    return k === 1;
  }
  // ---------- each part of the day ----------
  // how late the clock may run in the open middle of the day. The square is at its loudest until two, so until you've
  // been there the clock waits before that, whichever place you go to first.
  capNow() {
    const s = this.stage; if (s !== 'open') return CAP[s];
    return this.mk !== 'done' ? 830 : this.wk !== 'done' ? 1000 : 1100;
  }
  tick() {
    const G = this.G, S = this.S; const s = this.stage;
    if (this.hold || G.busy || G.mode !== 'play') return;
    // the day waits for you: the clock never runs past what's still to do, and nobody runs out of energy today
    { const cap = this.capNow(); if (cap && S.min > cap) S.min = cap; }
    if (S.energy < 35) S.energy = 35;
    if (s === 'room') this.roomDots();
    if (G.ui.waiter || !G.ui.panel.hidden || G.phoneOpen || G.mgActive) return;
    const z = G.zone;
    if (s === 'room') { if (this.roomCount() >= ROOM_KEYS.length && !this.roomEnding) { this.roomEnding = true; G.run(() => this.roomDone()); } return; }
    if (s === 'homerow' && G.loc === 'town' && G.look.raised && !S.flags.endowedShown) this.onRaise();
    if (s === 'homerow' && G.loc === 'town' && G.marks.complete('homerow') && !G.look.open) { G.run(() => this.beaOut()); return; }
    if (s === 'open') {
      const mk = this.mk, wk = this.wk;
      if (mk === 'go' && z === 'market' && this.nearPos([29.5, 27], 10.5)) { G.run(() => this.marketArrive()); return; }
      if (mk === 'marks' && G.marks.complete('market')) { this.mk = 'ask'; this.ui.toast('<b>Market Square: seen.</b> Now ask the people it pinches.', 'good', 3600); return; }
      if (wk === 'go' && G.loc === 'town' && this.nearPos([13.4, 14.2], 4.5)) { G.run(() => this.worksArrive()); return; }
      if (wk === 'marks' && G.marks.complete('works')) { G.run(() => this.gilOut()); return; }
      // everything seen to: lantern night starts as you reach your own porch
      if (mk === 'done' && wk === 'done' && this.nearPos([9.5, 38.6], 3)) { this.stage = 'tonight'; return; }
    }
    if (s === 'tonight') { G.run(() => this.lanternNight()); return; }
    // Blend, if you have it, keeps pinging (in the story, never in real life)
    this.blendTick();
  }
  // nothing overhead at a spot in town (no roof, awning or umbrella): the camera can see you there
  openSky(x, z) { const g = this.G.occ(); g.refresh(); return !g.hit(x, 15, z, x, 1.8, z); }
  nearPos(at, r) { const p = this.G.player.root.position; return this.G.loc === 'town' && Math.hypot(p.x - at[0], p.z - at[1]) < r; }
  // the first list you see started with one already ticked, by Wren: a head start, shown as the hook it is
  onRaise() {
    const S = this.S, G = this.G; const z = G.marks.streetHere();
    if (z === 'homerow' && this.stage === 'homerow' && !S.flags.endowedShown) { S.flags.endowedShown = 1; setTimeout(() => G.fx.chipPop('Wren already ticked 1 of 3', { kind: 'mark', hook: 'endowed', hookCtx: { what: 'Home Row started at 1 of 3, ticked by Wren', point: 'the doors on Home Row, which Wren had already noticed' }, ms: 2600 }), 500); }
  }
  onMark(m, c) {
    if (m.id === 'wk_steps') { this.detour(true); setTimeout(() => this.G.fx.pop(new THREE.Vector3(20.4, 1.6, 10.2), 'The long way round', { kind: 'mark', ms: 2600 }), 600); }
  }
  // Wren, on your step, with a lantern she made for you. She came the way your door sign asked.
  async wrenAtDoor() {
    const G = this.G, S = this.S; const texted = S.profile.people < 0.5;
    // (beside your gate, so the two of you are seen side by side with your own front door behind you)
    { const w = G.npcs.wren; const at = [11.3, 39.1]; G.npcTo('wren', at, 'town', at); w.c.root.position.set(at[0], 0, at[1]); w.path = []; w.goal = at; w.override = at; }
    await G.exitRoom();
    S.flags.firstOut = 1;
    this.frame('wren');
    await this.say('wren', texted ? 'I\'m Wren. Your sign says to text first, so I texted first.' : 'I\'m Wren. I knocked once. I only ever knock once.');
    await this.say('wren', 'I make lanterns. This one is yours. Raise it, and it shows what pinches people here. The way a shoe pinches when it doesn\'t fit.');
    S.flags.lantern = 1; G.ui.gearKey = '';
    G.audio.sfx('lantern'); G.fx.burst(G.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { n: 14, colors: ['#ffcf7a', '#fff4d6'] });
    this.addGuest('wren', true); this.renderGuests('wren');
    await this.say('wren', 'Tonight is lantern night, on your porch. Whoever you make room for today can come.');
    await this.say('wren', 'I tagged one thing on Home Row, to show you how. Find the rest.');
    this.unframe(); this.release('wren');
    this.stage = 'homerow';
    await this.gut('Out here, the color is flat. Your room has color because it fits you.');
    this.ui.hideDialog();
  }
  async beaOut() {
    const G = this.G, S = this.S;
    G.look.raised && G.look.lower();
    // she comes over to you: on foot if she's near, else from just along the row, the side her house is on
    const p = G.player.root.position; const side = p.x > T.bea[0] ? -1 : 1; const bea = G.npcs.bea;
    const to = this.st.standNear(p.x + side * 1.5, Math.max(38.1, Math.min(39.4, p.z + 0.4))) || [p.x + side * 1.5, 38.6];
    const near = bea.place === 'town' && Math.hypot(bea.c.root.position.x - p.x, bea.c.root.position.z - p.z) < 13;
    this.walkIn('bea', to, near ? null : (this.st.standNear(Math.max(3, Math.min(26, p.x + side * 10)), 38.4) || T.bea), true);
    await this.until(() => { const q = bea.c.root.position; return Math.hypot(q.x - p.x, q.z - p.z) < 2.6; }, 6000);
    this.frame('bea');
    await this.say('bea', 'Oh! It\'s the new one at Number Two. Sorry, dear. I heard steps and thought: the knocker again.');
    await this.say('bea', 'Fifty years on this row, and I still can\'t say "not today" without feeling rude. So some days I don\'t answer at all.');
    this.card('bea_knock');
    await this.gut('A light by the door could say "not today" for her. Without a word.');
    this.unframe();
    // (she comes along to your gate, to see what you do)
    this.walkIn('bea', PORCH_BEA);
    this.stage = 'porch';
  }
  async hangLantern() {
    const G = this.G, S = this.S, ui = this.ui;
    const k = await this.choose([{ t: 'Teal: come in, say hi', id: 'porch_teal' }, { t: 'Amber: not right now', id: 'porch_amber' }], { text: 'Your porch lantern. What should it tell people?', kind: 'gut' });
    ui.hideDialog();
    S.slice.porch = k === 0 ? 'teal' : 'amber';
    // yours goes up first; the rest of the row follows by lunchtime
    G.town.setFix('lanterns', true); for (let i = 0; i < 5; i++) G.town.setPorch(i, i === 1 ? S.slice.porch : null);
    S.fixes.lanterns = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.lanterns = 'slice';
    const door = new THREE.Vector3(8.5, 1.5, 36.5);
    G.fx.burst(door, { n: 26, colors: [S.slice.porch === 'teal' ? '#4fd1c5' : '#f2a33a', '#fff4d6'], speed: 3.4, up: 3 });
    G.audio.sfx('fix'); G.fx.punch(0.6);
    await sleep(FAST ? 20 : 450);
    // the wave, framed so you see it roll down the row and reach Bea
    this.frameAt([16, 37.2], { dx: 0, dz: 12.5, h: 8.5, fov: 46 });
    await sleep(FAST ? 10 : 500);
    await this.wave('homerow', [9.5, 36.6]);
    this.unframeAt();
    this.st.fieldNote('ud');
    // Bea, beside your gate (she followed you over; if you ran ahead of her, she has caught up by now)
    { const q = G.npcs.bea.c.root.position; const far = () => Math.hypot(q.x - PORCH_BEA[0], q.z - PORCH_BEA[1]) > 2.5;
      if (far()) { this.walkIn('bea', PORCH_BEA); await this.until(() => !far(), 3500); }
      if (far()) { q.set(PORCH_BEA[0], 0, PORCH_BEA[1]); G.npcs.bea.path = []; } }
    this.frame('bea');
    await this.say('bea', S.slice.porch === 'teal' ? 'Teal! Well, then. Hello to you too.' : 'Amber! Ha. Quite right. I\'ll knock tomorrow.');
    await this.say('bea', 'Only, I\'ve dropped by with soup, unannounced, for fifty years. It\'s how this row says hello. Could amber still mean soup on the step? I won\'t knock.');
    const ks = await this.choose([{ t: 'Soup on the step sounds perfect', id: 'bea_soup' }, { t: 'Amber means not now. Even for soup.', id: 'bea_nosoup' }]);
    S.stakes = S.stakes || {};
    G.town.setPorch(3, 'amber'); G.fx.burst(new THREE.Vector3(22, 1.6, 36.5), { n: 14, colors: ['#f2a33a', '#fff4d6'] });
    if (ks === 0) { S.stakes.lanterns = 'listened'; await this.say('bea', 'Soup on the step, then. No knock. And I\'ll come to your lantern night. I\'ll bring lemon cake.'); this.dealToast('lanterns'); }
    else { S.stakes.lanterns = 'overruled'; await this.say('bea', 'Then I\'ll learn to text first. In capitals. I\'ll still come tonight, mind. Lemon cake.'); }
    this.addGuest('bea');
    this.card('perceptible');
    await this.say('bea', 'If you\'re making room, dear: Moss can\'t hear her own kettle in the square.');
    await this.say('bea', 'And I\'m off to the Works with these parcels. Three steps, and me with a cart. We\'ll see.');
    this.unframe();
    await this.timelapse(Math.max(S.min, 690), 'By lunchtime, the rest of the row has lanterns up too.');
    this.porchColors();
    // the middle of the day is yours: the square and the Works, in either order (Bea is on her way to the steps)
    this.walkIn('bea', [13.4, 14.2]);
    S.slice.mk = 'go'; S.slice.wk = 'go'; this.stage = 'open';
  }
  // colour rolls out from a fix; the music gains a voice
  async wave(zone, from) {
    const G = this.G; G.audio.sfx('wave'); G.fx.punch(0.9);
    G.fx.ring(new THREE.Vector3(from[0], 0, from[1]), { color: '#ffe2a0', r: 7, dur: 1.4 });
    const p = G.color.restore(zone, from);
    setTimeout(() => G.fx.pop(new THREE.Vector3(from[0], 2.6, from[1]), 'Room made ' + (STREETS[zone] ? STREETS[zone].where : 'here'), { kind: 'good', big: true, hook: 'juice', hookCtx: { what: 'A wave of color over ' + (STREETS[zone] ? STREETS[zone].name : 'a street'), point: (STREETS[zone] ? STREETS[zone].name : 'a street') + ', with room made for someone' }, ms: 2600 }), FAST ? 10 : 900);
    await p;
    this.S.restored = (this.S.restored || 0) + 1;
  }
  async marketArrive() {
    const G = this.G, S = this.S;
    // (a few steps in first, out from between the roofs and awnings, so the square is what you see when it asks)
    { const at = [[29.4, 32.2], [30.6, 31.2], [28.2, 32.6], [31.6, 32.4], [28.6, 30.4]].find(([x, z]) => G.canStand(x, z) && this.openSky(x, z)) || [28.6, 30.4];
      G.walkTo(at[0], at[1]); await this.until(() => !G.path.length, FAST ? 300 : 3200); }
    if (S.min < 700) await this.timelapse(700, 'The square fills up toward noon.');
    this.mk = 'marks'; if (!S.slice.first) S.slice.first = 'mk';
    // the first time a place pinches you, the question the whole game asks
    const p = SIM.pinch(S, 'market', S.min, G.subFor('market'));
    if (p.total >= 0.25) await this.whoAdjusts(p);
    else { await this.gut('The jingle doesn\'t bother you much. It bothers Moss. She\'s stopped hearing her own kettle.'); this.ui.hideDialog(); }
  }
  async whoAdjusts(p) {
    const G = this.G, S = this.S;
    G.focusPinch(true);
    const top = p.top || 'sound';
    const what = { sound: 'The same jingle blares from a speaker on every post.', people: 'The whole square is one crowd at this hour.', light: 'The sun bounces off every stall.' }[top] || 'The square, at its busiest.';
    const opts = [
      { key: 'bend', who: 'You', label: 'Push through', sub: 'You stay, and nobody notices what it costs you.', hold: true },
      { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: 'nothing you own helps with this yet' },
      { key: 'ask', who: 'Them', label: 'Ask someone to turn it down', disabled: true, reason: 'the speakers are the council\'s; nobody here can' },
      { key: 'fix', who: 'The place', label: 'Make room here', sub: 'Find what pinches, and fix it for everyone. Slower, but it lasts.' },
      { key: 'leave', who: 'Nobody', label: 'Go somewhere else', sub: 'You rest. You miss what you came for.' },
    ];
    const choice = await this.ui.barrier({ options: opts, title: 'Market Square, ' + (S.min < 760 ? 'noon' : 'lunchtime'), text: what, coach: 'When a place doesn\'t fit, someone adjusts. Each answer costs something different.' });
    this.ui.hideBarrier(); G.focusPinch(false);
    this.st.fieldNote('fit');
    S.slice.adjust = choice;
    if (choice === 'bend') { S.masking = true; S.maskZone = 'market'; SIM.bendCost(S, false); S.stats.bend++; await this.gut('You push through. Nobody can tell. It costs you, and the square is still loud for Moss, every day.'); }
    else if (choice === 'leave') { S.stats.leave++; await this.gut('You step back out of the square. The jingle keeps going without you, and Moss is still in it.'); this.ui.hideDialog(); G.walkTo(29.5, 35.5); S.slice.leftMarket = 1; }
    else { S.stats.fix++; await this.gut('Then look at it properly. Raise the lantern.'); }
    this.ui.hideDialog();
  }
  // the people each part of the day turns on; anyone else has a word or two
  async talk(id) {
    const s = this.stage, S = this.S; const mk = this.mk, wk = this.wk; const open = s === 'open';
    const h = S.slice.heard = S.slice.heard || {};
    if (open && mk === 'ask' && id === 'moss' && !h.moss) { await this.askMoss(); return true; }
    if (open && mk === 'ask' && id === 'pomeroy' && !h.pomeroy) { await this.askPomeroy(); return true; }
    if (open && mk === 'rue' && id === 'rue') { await this.rueOffer(); return true; }
    if (open && wk === 'go' && id === 'bea' && this.nearPos([13.4, 14.2], 8)) { await this.worksArrive(); return true; }
    if (open && wk === 'gil' && id === 'gil') { await this.gilTalk(); return true; }
    // anyone else: a word or two for this part of the day
    const line = this.bark(id); if (!line) return false;
    // (a word in passing shouldn't cost you the lantern: if it was up, it goes back up after)
    const up = this.G.look.raised;
    this.frame(id); await this.say(id, line);
    if (id === 'pip' && !S.cards.pip_cart && open && wk !== 'go' && wk !== 'done') { await this.say('pip', 'The Works? I take the bread cart round by the loading dock every morning. Takes ages! Never mind.'); this.card('pip_cart'); }
    this.unframe(); if (up && !this.G.look.raised) this.G.look.raise(); return true;
  }
  bark(id) {
    const s = this.stage, S = this.S; const early = ['room', 'door', 'homerow', 'porch'].includes(s);
    const B = {
      bea: early ? 'Morning, dear. Mind the knocker, it\'s louder than it looks.' : s === 'open' && this.wk !== 'done' ? 'Three steps, dear. And me with a cart.' : 'Lemon cake, tonight. Don\'t eat beforehand.',
      moss: (S.color || {}).market >= 1 ? 'Hear that? My own kettle. I\'d forgotten it whistles.' : early ? 'Morning, love. Come back at noon if you want to see what I put up with.' : 'Tea? You\'ll have to shout. Everyone does, at this hour.',
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
  // you've seen what pinches in the square: now you ask. Moss first or Pomeroy first, as you like. A quiet square is
  // what Moss needs, and what it would cost Pomeroy. Once you've heard both, Clover comes over with her sketchbook.
  async askMoss() {
    const G = this.G, S = this.S; const h = S.slice.heard;
    this.frame('moss');
    if (this.wk === 'done' && S.fixes.ramp === 'built') await this.say('moss', 'You\'re the one who got Bea her ramp! Then maybe you can do something about this.');
    await this.say('moss', 'It\'s the jingle, love. Every post, every four minutes. By noon I can\'t hear my own kettle.');
    await this.say('moss', 'This is the only spot with shade. So I stay, I smile, and I go home and lie in the dark.');
    this.card('moss_kettle'); h.moss = 1;
    this.unframe();
    // Pomeroy has heard every word
    if (!h.pomeroy) { const t = 'Oi! Don\'t you turn that music off!'; G.ui.bubble('pomeroy', t, { tint: CAST.pomeroy.tint, ms: 4200 }); G.audio.voice(CAST.pomeroy.voice[0], CAST.pomeroy.voice[1], t); this.ui.announce('Pomeroy, from his stall: ' + t); }
    await this.heardBoth();
  }
  async askPomeroy() {
    const S = this.S; const h = S.slice.heard;
    this.frame('pomeroy');
    await this.say('pomeroy', h.moss ? 'Don\'t you turn that music off! Half my sales are folk who hear me before they see me!' : 'A quieter square? Don\'t you dare! Half my sales are folk who hear me before they see me!');
    await this.say('pomeroy', 'Put your quiet on the bench side, and leave my side loud. Everybody gets a side.');
    this.card('pomeroy_loud'); h.pomeroy = 1;
    this.unframe();
    await this.heardBoth();
  }
  async heardBoth() {
    const G = this.G, S = this.S; const h = S.slice.heard; if (!h.moss || !h.pomeroy) return;
    // Clover, with her sketchbook, comes over to wherever you are
    const p = G.player.root.position;
    this.walkIn('clover', this.st.standNear(p.x - 1.3, p.z + 0.9) || [p.x - 1.3, p.z + 0.9], [36, 33.6]);
    await this.until(() => { const q = G.npcs.clover.c.root.position; return Math.hypot(q.x - p.x, q.z - p.z) < 2.8; }, 5000);
    this.frame('clover');
    await this.say('clover', 'I\'m Clover, from the Fix-It Shed. I heard "kettle" and I heard "side". Both fair. Let\'s sketch a square where everyone fits.');
    this.unframe();
    const r = await new Blueprint(G, 'quiet', { where: 'Market Square, on Clover\'s sketchbook', how: 'Each face can only walk a little way. Put changes <b>near the people who need them</b>, and get <b>every face glowing</b>.' }).run();
    const zoned = !!(r && r.zoned);
    S.stakes = S.stakes || {}; S.stakes.quiet = zoned ? 'listened' : 'overruled';
    // the build, over lunch
    this.frame('clover');
    await this.say('clover', zoned ? 'A quiet corner by the benches, and a music corner by the apples. Give me an hour and my crew from the Shed.' : 'Quieter everywhere, then. It\'s a start. Give me an hour.');
    this.unframe();
    // (Rue has been watching from the kiosk: she sets off toward you while the crew builds)
    { const p0 = G.player.root.position; this.walkIn('rue', this.st.standNear(p0.x + 1.6, p0.z + 1.0) || [p0.x + 1.6, p0.z + 1.0]); }
    await this.build('quiet', [23.5, 31.2], Math.max(S.min + 40, 790), 'Clover\'s crew builds it over lunch.');
    S.fixes.quiet = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.quiet = 'slice';
    await this.waveWide('market', [23.5, 31.2], [28, 27]);
    if (!zoned) G.color.hold('pomeroy', 0.36);
    await this.comeTo('moss'); this.frame('moss');
    await this.say('moss', 'Listen. That\'s my kettle. I\'d forgotten it whistles. Lantern night, is it? I\'ll bring a pot.');
    this.addGuest('moss');
    this.unframe();
    // Pomeroy, from his stall: pleased with his side, or not
    { const t = zoned ? 'A music corner, by my apples? Fair\'s fair. I\'ll bring a bag round tonight!' : 'Quieter everywhere, is it. Grand. Grand for some.';
      G.ui.bubble('pomeroy', t, { tint: CAST.pomeroy.tint, ms: 5200 }); G.audio.voice(CAST.pomeroy.voice[0], CAST.pomeroy.voice[1], t); this.ui.announce('Pomeroy: ' + t); S.met.pomeroy = true;
      if (zoned) { this.addGuest('pomeroy', false, 900); this.dealToast('quiet'); }
      else { await this.gut('He asked for a side of his own. The sketch didn\'t leave him one.'); this.ui.hideDialog(); } }
    this.card('zoning');
    this.release('clover');
    this.mk = 'rue';
    // Rue has been watching from the kiosk
    await this.rueOffer();
  }
  // a fix goes up: hammering, sparks, and the afternoon passing
  // the camera frames somewhere for a moment (a build, a wave), then comes back to you
  // your porch with everyone on it: on a phone held upright, from high enough to see over the trees, wide enough for
  // the whole porch
  porchShot(pos, look, fov, k, snap) { if (innerWidth / Math.max(1, innerHeight) < 1.25) { pos = pos.clone().set(9.5, 13.9, 49.2); look = look.clone().set(9.5, 0.8, 40.0); fov = 63; } this.G.stage.shot(pos, look, fov, k, snap); }
  // a town shot, kept as wide on a phone held upright (see Stage.fit)
  shot(pos, look, fov, k, snap) { const [p, l, f] = this.G.stage.fit(pos, look, fov); this.G.stage.shot(p, l, f, k, snap); }
  // a fixed shot of a place, from a set side. If a lamp post or a signpost stands in the middle of the view, or a wall
  // or a roof is in the line of sight, the camera swings round the place a little at a time, and then looks from
  // higher up, until the view is clear (and stays as asked if none is).
  frameAt(at, o = {}) {
    const G = this.G; const dx = o.dx == null ? 5 : o.dx, dz = o.dz == null ? 11 : o.dz, h0 = o.h || 9.5;
    const r = Math.hypot(dx, dz), a0 = Math.atan2(dx, dz); let cam = [at[0] + dx, h0, at[1] + dz];
    try {
      const poles = (G.town.lampPos || []).map(([x, z]) => [x, z, 3.4]).concat((G.town.postPos || []).map(([x, z]) => [x, z, 2.8]));
      const occ = G.occ ? G.occ() : null; if (occ) occ.refresh();
      const clear = (cx, h, cz) => {
        for (const [px, pz, ph] of poles) {
          const t = ((px - cx) * (at[0] - cx) + (pz - cz) * (at[1] - cz)) / (r * r); if (t < 0.05 || t > 0.96) continue;
          const d = Math.hypot(px - (cx + (at[0] - cx) * t), pz - (cz + (at[1] - cz) * t));
          // (in the way if it stands in the middle third of the picture and reaches up to the line of sight)
          if (d < Math.max(0.9, 0.3 * t * r) && ph > h + (0.8 - h) * t - 1.2) return false;
        }
        return !(occ && occ.hit(cx, h, cz, at[0], 1.0, at[1], 0.5, Math.hypot(r, h - 1) * 0.9));
      };
      find: for (const hk of [1, 1.35]) for (const da of [0, 0.22, -0.22, 0.44, -0.44, 0.66, -0.66]) {
        const cx = at[0] + Math.sin(a0 + da) * r, cz = at[1] + Math.cos(a0 + da) * r; if (clear(cx, h0 * hk, cz)) { cam = [cx, h0 * hk, cz]; break find; }
      }
    } catch (e) { /* (the shot as asked for) */ }
    this.shot(new THREE.Vector3(cam[0], cam[1], cam[2]), new THREE.Vector3(at[0], 0.8, at[1]), o.fov || 40, 2.6);
  }
  unframeAt() { const G = this.G; G.stage.follow(G.player.root.position, G.followOpts()); }
  async build(f, at, to, caption) {
    const G = this.G; const g = G.town.fixGroups[f];
    // (the ramp is seen from the south-west, past the steps: from the south-east a roof is in the way)
    this.frameAt(at, f === 'ramp' ? { dx: -4.5, dz: 8.5, h: 7.5 } : {});
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
  // Rue, from the Blend kiosk. She walks up without being asked: that's how the app gets to people. You can ask what
  // it costs before you answer.
  async rueOffer() {
    const G = this.G, S = this.S;
    const p = G.player.root.position; const to = this.st.standNear(p.x + 1.6, p.z + 1.0) || [p.x + 1.6, p.z + 1.0];
    const rue = G.npcs.rue; const off = () => rue.place !== 'town' || Math.hypot(rue.c.root.position.x - p.x, rue.c.root.position.z - p.z) > 2.8;
    if (off()) this.walkIn('rue', to);
    G.ui.bubble('rue', 'Psst! New person!', { tint: CAST.rue.tint, ms: 2600 });
    await this.until(() => !off(), 6000);
    // (if something kept her, she's beside you all the same: the talk doesn't start across the square)
    if (off()) { rue.c.root.position.set(to[0], 0, to[1]); rue.path = []; }
    this.frame('rue');
    await this.say('rue', 'Nice work! That was a LOT of effort for some quiet, though.');
    await this.say('rue', 'My app, Blend, does it in one tap. Smooth Mode: you stop minding things, and you get points for every place you push through.');
    let k = await this.choose([{ t: 'Go on, I\'ll try it', id: 'blend_yes', blend: true }, { t: 'No thanks', id: 'blend_no' }, { t: 'What does it cost?', id: 'blend_cost' }], { text: 'Install Blend?', kind: 'gut' });
    if (k === 2) {
      S.slice.askedCost = 1;
      await this.say('rue', 'Cost? It\'s free! You pay in attention. That\'s a joke. Mostly.');
      k = await this.choose([{ t: 'Go on, I\'ll try it', id: 'blend_yes', blend: true }, { t: 'No thanks', id: 'blend_no' }], { text: 'Install Blend?', kind: 'gut' });
    }
    const steps = this.wk === 'go' ? ' Oh, and Bea\'s been stuck outside the Works for ages. Something about steps?' : '';
    if (k === 0) {
      G.installBlend();
      G.fx.pop(G.player.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '+30 points', { kind: 'blend', hook: 'points', hookCtx: { what: 'Blend: 30 welcome points', by: 'blend' } });
      await this.say('rue', 'Yay! Turn on Smooth Mode whenever a place gets to you. Every push-through in a row adds to your streak!' + steps);
      S.slice.blend = 'yes';
    } else { await this.say('rue', 'Suit yourself! It\'s always there.' + steps); S.slice.blend = 'no'; }
    S.flags.rue_pitched = 1;
    this.unframe(); this.release('rue');
    this.addGuest('rue', true); this.renderGuests('rue');
    this.mk = 'done';
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
    const G = this.G, S = this.S; if (this.stage !== 'open' || this.wk !== 'go') return;
    this.wk = 'marks'; if (!S.slice.first) S.slice.first = 'wk';
    { const q = G.npcs.bea.c.root.position; if (G.npcs.bea.place !== 'town' || Math.hypot(q.x - 13.4, q.z - 14.2) > 3) this.walkIn('bea', [13.4, 14.2], [13.4, 14.2], true); }
    await this.comeTo('bea'); this.frame('bea');
    if (this.mk === 'done') await this.say('bea', 'There you are. Moss says she can hear her own kettle again. Well! Now look at this.');
    await this.say('bea', (this.mk === 'done' ? 'The' : 'There you are. The') + ' mail counter\'s in there, dear. Three steps. My cart doesn\'t do steps.');
    await this.say('bea', 'So I go round the back with the parcels and wait for the dock. It\'s meant to open at ten.');
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
    const G = this.G, S = this.S; if (this.stage !== 'open' || this.wk !== 'marks') return;
    this.wk = 'gil';
    G.npcTo('gil', [14.4, 14.4], 'town', [12, 12.9]);
    await sleep(FAST ? 20 : 900);
    await this.gilTalk();
  }
  async gilTalk() {
    const G = this.G, S = this.S;
    await this.comeTo('gil'); this.frame('gil');
    await this.say('gil', 'Hey hey! The new person! What\'s all this? Oh, Bea. ' + (this.S.min < 720 ? 'Morning' : 'Afternoon') + ', Bea.');
    await this.say('you', 'A ramp. For Bea, and anyone else on wheels.');
    await this.say('gil', 'Love that. Love the energy. Anything that changes the building goes to the council, though. Hollis is hearing items at Town Hall today. Go on over!');
    await this.say('gil', 'One tiny thing. The planters by the steps? My tomatoes. Nine years. They\'re the only thing in this building that\'s thriving.');
    const k = await this.choose([{ t: 'What would make a ramp work for you?', id: 'gil_ask' }, { t: 'We\'ll sort that out later', id: 'gil_later' }]);
    if (k === 0) {
      await this.say('gil', 'Could it run along the rail, with the tomatoes beside it? A bit narrower. Still fits a cart. I measured. Twice.');
      S.stakes = S.stakes || {}; S.stakes.ramp = 'listened'; S.slice.gil = 'asked'; this.dealToast('ramp');
    } else { await this.say('gil', 'Sure, sure. No worries!'); await this.gut('Three no-worries is one worry.'); S.slice.gil = 'later'; }
    this.unframe();
    G.npcTo('gil', null);
    this.wk = 'hearing';
  }
  async hearing() {
    const G = this.G, S = this.S; const sq = this.mk === 'done';
    // (before the square is seen to, the clock stays this side of two o'clock: the square is at its loudest until then)
    await this.timelapse(sq ? Math.max(S.min + 10, 900) : Math.min(812, Math.max(S.min + 10, 750)));
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
      await this.say('hollis', r.yes === 3 ? 'Three votes out of three. The ramp goes up today. Goodness.' : 'The vote passes. The ramp goes up today.');
      if (r.consentSkipped) { await this.say('bea', 'Next time, ask me first, dear. I\'d have said yes.'); }
    } else {
      await this.say('hollis', 'It doesn\'t pass, I\'m afraid. It goes on file for another meeting.');
      await this.say('clover', 'You were missing ' + RAMP.missing[r.missing[0]] + '. Bring that back, and it\'ll pass.');
      S.fixes.ramp = 'proposal'; S.support.ramp = ['bea'];
    }
    this.ui.hideDialog(); this.ui.letterbox(false);
    for (const id of ['hollis', 'pip', 'clover', 'bea', 'gil', 'moss']) G.npcTo(id, null);
    if (r.passed) {
      S.fixes.ramp = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.ramp = 'slice';
      await G.stage.fadeTo(1, 500); G.setLoc('town'); G.place([14.4, 17.6]); G.player.heading = Math.PI; G.audio.setScene('town'); await G.stage.fadeTo(0, 500);
      await this.build('ramp', [16, 11.2], sq ? Math.max(S.min, 1000) : Math.min(828, S.min + 45), sq ? 'The ramp goes up by late afternoon.' : 'The ramp goes up over lunch.');
      this.detour(false);
      await this.waveWide('works', [13, 12.6], [13, 11]);
      this.frameAt([16, 11.6], { dx: -4, dz: 8, h: 7, fov: 38 });
      await this.curbCut();
      this.unframeAt();
      this.addGuest('pip'); this.addGuest('hollis', false, 800);
      if (S.slice.gil === 'asked' || r.yes === 3) this.addGuest('gil', false, 1600);
      if (S.slice.gil !== 'asked' && r.yes === 3) { S.stakes = S.stakes || {}; S.stakes.ramp = 'listened'; }
    } else { await G.exitRoom(true); this.detour(false); }
    this.release('bea');
    this.wk = 'done';
  }
  // built for Bea, and used by everyone: Bea goes in first, then Pip's bread cart and a pram come down it
  async curbCut() {
    const G = this.G, S = this.S;
    const cart = this.prop('bread'); const pram = this.prop('pram');
    const bea = G.npcs.bea, pip = G.npcs.pip;
    this.walkIn('bea', [13.0, 10.9], [19.6, 12.7], true);
    await this.until(() => Math.hypot(bea.c.root.position.x - 13.0, bea.c.root.position.z - 10.9) < 0.6, 5000);
    G.fx.colorBack(bea.c, 'bea'); G.fx.pop(new THREE.Vector3(13.2, 2.6, 10.9), 'Bea, straight in', { kind: 'good', ms: 2000, follow: bea.c.root, dy: 2.4 });
    await sleep(FAST ? 10 : 900);
    this.walkIn('pip', [19.2, 12.6], [14.0, 11.2], true); pip.c.root.add(cart); cart.position.set(0.5, 0, 0.45);
    const extra = G.crowd.find((a) => !a.active) || G.crowd[0]; const pc = extra.c; extra.held = true; pc.root.visible = true; pc.root.position.set(13.6, 0.5, 11.2); pc.root.add(pram); pram.position.set(0, 0, 0.55);
    const t0 = performance.now(); let k = 0;
    await new Promise((r) => { const step = () => { k = clamp((performance.now() - t0) / 3200); pc.root.position.set(13.6 + k * 5.6, 0.5 * (1 - k), 11.2 + k * 1.4); pc.heading = Math.PI / 2; pc.speed = 0.5; pc.update(0.016); if (k < 1) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); if (FAST) setTimeout(r, 50); });
    G.fx.pop(new THREE.Vector3(17, 2.6, 12), 'Built for Bea. Used by everyone.', { kind: 'good', big: true, ms: 3000 });
    await this.gut('A ramp for Bea, and the next two down it are a bread cart and a stroller. That has a name.');
    this.card('curb');
    this.ui.hideDialog();
    pip.c.root.remove(cart); pc.root.remove(pram); extra.held = false; extra.active = false; pc.root.visible = false; pc.speed = 0; pc.root.position.y = 0;
    G.npcTo('pip', null); this.release('bea');
  }
  // wait for something in the world (someone arriving), at most ms
  until(fn, ms) { return new Promise((r) => { const t0 = performance.now(); const tick = () => { if (fn() || performance.now() - t0 > ms || FAST) r(); else setTimeout(tick, 100); }; tick(); }); }
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
    // (anything still under way when you called it a day waits for tomorrow)
    this.detour(false); G.focusPinch(false); for (const id of ['bea', 'moss', 'pomeroy', 'clover', 'rue', 'gil', 'wren']) this.release(id);
    if (G.loc !== 'town') { await G.stage.fadeTo(1, 400); G.setLoc('town'); G.place([9.5, 38.4]); G.audio.setScene('town'); await G.stage.fadeTo(0, 400); }
    // the afternoon goes by over the streets you made room in
    ui.letterbox(true);
    this.shot(new THREE.Vector3(26, 44, 66), new THREE.Vector3(24, 0, 28), 44, 1.8);
    await this.timelapse(Math.max(S.min, 1170), ['quiet', 'ramp'].some((f) => S.fixes[f] === 'built') ? 'The afternoon goes gold over the streets you made room in.' : 'The afternoon goes gold over Larkspur.');
    await sleep(FAST ? 10 : 1000);
    await G.stage.fadeTo(1, 500);
    G.place([9.5, 38.4]); G.player.heading = Math.PI;
    this.porchShot(new THREE.Vector3(9.5, 4.6, 46.5), new THREE.Vector3(9.5, 1.3, 38.6), 34, 3, true);
    G.audio.setScene('night');
    await G.stage.fadeTo(0, 600);
    // a text that leaves tomorrow open (on purpose: it's one of the pulls, and it says so)
    this.st.text('Clover', 'Found something in the loft about how the Standard was made. Come by the Shed tomorrow.');
    setTimeout(() => G.fx.pop({ x: innerWidth / 2, y: 120 }, 'Something to find out tomorrow', { kind: 'mark', hook: 'openloop', hookCtx: { what: 'Clover\'s loft: something to find out tomorrow', point: 'how the Standard was made, which is real and still to come' }, ms: 2400, rise: 18 }), FAST ? 10 : 1200);
    const guests = Object.keys(S.guests || {}).filter((id) => id !== 'wren');
    const amber = S.slice.porch === 'amber';
    // amber means not now: they come as far as the gate, and leave what they brought on the step
    let i = 0;
    for (const id of guests) {
      const n = G.npcs[id]; if (!n) continue; const sp = SPOTS[i++ % SPOTS.length]; const at = amber ? [sp[0], sp[1] + 3.6] : sp;
      this.walkIn(id, at, GUESTS[id].from);
      await sleep(FAST ? 10 : 650);
      G.fx.pop(new THREE.Vector3(at[0], 2.5, at[1]), CAST[id].name + (amber ? ' left ' : ': ') + GUESTS[id].gift + (amber ? ' on the step' : ''), { kind: 'guest', ms: 2200, rise: 26, follow: n.c.root, dy: 2.5 });
      G.audio.sfx('guest');
    }
    await sleep(FAST ? 10 : 1800);
    let full = !amber;
    if (amber && guests.length) {
      await this.gut('Your lantern says not now. So they stop at the gate, leave what they brought on the step, and wave.');
      const k = await this.choose([{ t: 'Switch it to teal, and call them up', id: 'porch_switch' }, { t: 'Keep it amber. A quiet night.', id: 'porch_keep' }], { text: 'Your lantern is amber.', kind: 'gut' });
      ui.hideDialog();
      if (k === 0) { S.slice.porch = 'teal'; this.porchColors(); G.fx.burst(new THREE.Vector3(8.5, 1.6, 36.5), { n: 22, colors: ['#4fd1c5', '#fff4d6'] }); G.audio.sfx('guest'); i = 0; for (const id of guests) { const sp = SPOTS[i++ % SPOTS.length]; this.walkIn(id, sp); } await sleep(FAST ? 10 : 2000); full = true; }
      else { S.slice.quietNight = 1; for (const id of guests) this.walkIn(id, GUESTS[id].from); await this.gut('They wave, and go. It\'s a quiet night. You chose it, and the lantern said so for you.'); ui.hideDialog(); }
    }
    for (const id of guests) { const n = G.npcs[id]; if (n) n.c.faceToward(9.5, 38.4); }
    const absent = ['moss', 'pomeroy', 'pip', 'gil'].filter((id) => !S.guests[id]);
    if (full && guests.length) await this.note(guests.length === 1 ? CAST[guests[0]].name + ' came. One guest, and a whole porch of light.' : LIST(guests.map((g) => CAST[g].name)) + ' came. Your porch is full.');
    { const t = this.absentLine(absent); if (t) await this.gut(t); }
    // Wren knocks once, then waits (that's her own sign), with the lantern tuned to one more person
    this.walkIn('wren', [9.5, 40.2], [15.5, 44.4], true);
    await this.until(() => { const q = G.npcs.wren.c.root.position; return Math.hypot(q.x - 9.5, q.z - 40.2) < 1.2; }, 5000);
    // (the two of you are seen from across the street, with everyone who came around you)
    const nightShot = () => this.porchShot(new THREE.Vector3(9.5, 5.2, 47.5), new THREE.Vector3(9.5, 1.2, 39.4), 38, 2.4);
    this.frame('wren'); nightShot();
    if (S.slice.quietNight) await this.say('wren', 'Knock. I\'m waiting, as your lantern says. I only came to show you one thing.');
    await this.say('wren', 'I tuned the lantern. It reads one more person now: the one this town was built for. The Standard.');
    const gi = await this.choose([{ t: 'Most of them', id: 'guess_most' }, { t: 'About half', id: 'guess_half' }, { t: 'A few', id: 'guess_few' }, { t: 'Nobody', id: 'guess_none' }], { text: 'Wren: "First, a guess. How many people in Larkspur fit the Standard?"', kind: 'say', who: 'wren' });
    S.slice.guess = ['most', 'half', 'few', 'none'][gi];
    await this.say('wren', 'Raise it, and see.');
    this.unframe(); ui.letterbox(true);
    await this.standardReveal();
    this.frame('wren'); nightShot();
    await this.say('wren', S.slice.guess === 'none' ? 'You guessed it. Nothing pinches the Standard, and not one of us fits it.' : 'Nothing pinches the Standard. Not one mark. And not one of us fits it. Not one person in Larkspur.');
    await this.say('wren', 'They built the whole town for somebody who isn\'t here. Today you made room for people who are.');
    await this.say('wren', 'When a place pinches someone, most towns ask what\'s wrong with them. Today you asked what\'s wrong with the place.');
    this.st.fieldNote('question');
    this.card('average', true);
    this.unframe();
    // the day's card: its three questions, answered from what you did, and tomorrow
    await this.dayCard();
    ui.letterbox(false);
    for (const id of Object.keys(CAST)) if (G.npcs[id]) G.npcTo(id, null);
    this.st.finishDay('night');
  }
  // who isn't here, and why: each one for the reason that's true of this day
  absentLine(absent) {
    const S = this.S; const quiet = S.fixes.quiet === 'built', ramp = S.fixes.ramp === 'built';
    const W = {
      moss: quiet ? null : 'Moss couldn\'t come. The square was still too loud to pack up early.',
      pomeroy: quiet ? 'Pomeroy didn\'t come. The quiet cost him, and the sketch left him no side of his own.' : null,
      pip: ramp ? null : 'Pip couldn\'t come. Her cart still goes the long way round.',
      gil: ramp ? 'Gil sent a text: "Next time!!" Nobody asked him about his tomatoes.' : null,
    };
    return absent.map((id) => W[id]).filter(Boolean).slice(0, 2).join(' ');
  }
  // the lantern, tuned to the Standard: first everything that pinches the people who live here, then what pinches the
  // Standard (nothing), then who here fits it (nobody; each of you has something that doesn't fit, you included)
  async standardReveal() {
    const G = this.G, ui = this.ui, S = this.S; const M = G.marks;
    const total = MARKS.filter((m) => !m.fit).length;
    // you raise it yourself
    await new Promise((r) => {
      const b = document.createElement('button'); b.className = 'btn primary raisebtn'; b.innerHTML = (ui.touch ? '' : '<kbd>' + esc(G.keyOf('look')) + '</kbd>') + 'Raise the lantern';
      ui.root.appendChild(b); setTimeout(() => b.focus(), 50);
      const done = () => { window.removeEventListener('keydown', kh, true); b.remove(); G.audio.sfx('lantern'); r(); };
      const kh = (e) => { if (G.actionOf(e) === 'look' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); done(); } };
      window.addEventListener('keydown', kh, true); b.onclick = done; if (FAST) setTimeout(done, 20);
    });
    // (high enough to hold the whole town: every street's marks at once)
    this.shot(new THREE.Vector3(32, 60, 62), new THREE.Vector3(32, 0, 23), 46, 2.6);
    M.showAll = true; if (!G.look.raised) { G.look.raised = true; G.ui.gearKey = ''; }
    const tag = document.createElement('div'); tag.className = 'revealcount'; ui.root.appendChild(tag);
    const set = (n, t) => { tag.innerHTML = `<b>${n}</b><span>${t}</span>`; };
    set(total, 'marks: what pinches the people who live here');
    await sleep(FAST ? 20 : 3400);
    set(total, 'Retuning to the Standard…'); G.audio.sfx('whoosh');
    await sleep(FAST ? 20 : 900);
    for (let n = total - 1; n >= 0; n--) { M.fade = n; set(n, 'marks: what pinches the Standard'); G.audio.sfx('tick'); await sleep(FAST ? 2 : 110); }
    set(0, 'Nothing in Larkspur pinches the Standard.');
    await sleep(FAST ? 20 : 2200);
    M.showAll = false; M.fade = null; G.look.raised = false; G.ui.gearKey = '';
    // the porch: each of you, and what doesn't fit you about a town built for the Standard
    this.porchShot(new THREE.Vector3(9.5, 5.2, 47.5), new THREE.Vector3(9.5, 1.2, 39.4), 38, 2.4);
    // (everyone who came, wherever on the porch they're standing; on a quiet night, only Wren came back)
    const here = ['you'].concat(Object.keys(S.guests || {}).filter((id) => CAST[id] && G.npcs[id] && (!S.slice.quietNight || id === 'wren')));
    set('?', 'of the people on your porch fit the Standard');
    await sleep(FAST ? 20 : 900);
    G.fx.ring(new THREE.Vector3(9.5, 0, 39.6), { color: '#c9b8a6', r: 9, dur: 2.2 });
    // each of you, and what doesn't fit them: a list under the number, each name beside its own face (labels over the
    // heads on the porch sat on top of this list, so the faces are in the list instead)
    { const cap = document.createElement('p'); cap.className = 'rvcap'; cap.textContent = 'Where each of you differs from the Standard'; tag.appendChild(cap); }
    const list = document.createElement('ul'); list.className = 'rvlist'; tag.appendChild(list);
    for (const id of here) {
      const prof = id === 'you' ? S.profile : (CAST[id].profile || {});
      const icons = misfits(prof, id === 'you' ? S.wheels : CAST[id].cart).slice(0, 3);
      const label = (id === 'you' ? 'You' : CAST[id].name) + ': ' + icons.join(', ');
      const li = document.createElement('li'); { const im = document.createElement('img'); im.alt = ''; try { im.src = ui.face(id, S); li.appendChild(im); } catch (e) { /* (no picture: the name alone) */ } }
      li.appendChild(document.createTextNode(label)); list.appendChild(li);
      G.audio.sfx('pop'); await sleep(FAST ? 2 : 300);
    }
    tag.querySelector('b').textContent = '0'; tag.querySelector('span').textContent = 'of ' + here.length + ' on your porch fit the Standard. Not even you.';
    this.ui.announce('None of the ' + here.length + ' on your porch fit the Standard. Not even you. Where each of you differs from it. ' + [...list.children].map((x) => x.textContent).join('. ') + '.');
    // the list waits long enough to read every name (or until you press Continue; with "Until I close it", until you do)
    await new Promise((r) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary rvgo'; b.textContent = 'Continue'; tag.appendChild(b); setTimeout(() => b.focus(), 60);
      let done = false; const go = () => { if (done) return; done = true; clearTimeout(tm); window.removeEventListener('keydown', kh, true); r(); };
      const kh = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); go(); } };
      window.addEventListener('keydown', kh, true); b.onclick = go;
      const tm = FAST ? setTimeout(go, 20) : ui.holdText() ? 0 : setTimeout(go, ui.readMs(tag.textContent, 6000));
    });
    tag.remove();
  }
  // ---------- the day's card ----------
  // The three questions this game keeps asking, answered from what you did today. Who adjusted: the places that changed,
  // and the times you did instead. Who profited: one of the day's rewards, to call as something real or as a pull (it was
  // both), with Blend's beside it. Who checked: whose cost you went by, and your guess against the lantern's count.
  // Then tomorrow, and how you'd like to play it (with the pulls, or without).
  async dayCard() {
    const G = this.G, S = this.S, ui = this.ui; const sl = S.slice;
    const guests = Object.keys(S.guests || {}).filter((id) => CAST[id]); const quiet = !!sl.quietNight;
    const built = ['lanterns', 'quiet', 'ramp'].filter((f) => S.fixes[f] === 'built');
    const TIMES = ['', 'once', 'twice', 'three times']; const times = (n) => TIMES[n] || n + ' times';
    const NAME = { lanterns: 'porch lanterns', quiet: 'a quiet corner', ramp: 'a ramp' };
    // who adjusted
    const bend = S.stats.bend || 0, smooth = S.stats.smooth || 0, left = S.stats.leave || 0;
    const you = bend ? 'You, ' + times(bend) + ': you pushed through, and nobody could tell.' : smooth ? '' : left ? 'You stepped away from the square, and missed what you came for.' : 'You, not once.';
    const smoothed = smooth ? ' Blend pushed through for you ' + times(smooth) + '. Those places stayed as they were.' : '';
    // who profited: one reward of the game's own (a guest, if there was one)
    const log = (S.hookLog || []).slice(); const mine = log.filter((e) => e.by !== 'blend'), theirs = log.filter((e) => e.by === 'blend');
    const pick = mine.find((e) => /lantern night/.test(e.what) && !/^Wren/.test(e.what)) || mine.find((e) => /^A mark tagged/.test(e.what)) || mine[0] || null;
    const used = HOOK_ORDER.filter((id) => (S.hooks || {})[id]);
    const blendLine = theirs.length ? ' Blend rewarded you ' + times(theirs.length) + '. Those pointed at Blend.' : sl.blend === 'no' ? ' Rue offered you Blend, and you said no.' : '';
    // who checked
    const WHO = { lanterns: 'Bea', quiet: 'Pomeroy', ramp: 'Gil' };
    const heard = built.filter((f) => (S.stakes || {})[f] === 'listened').map((f) => WHO[f]), unheard = built.filter((f) => (S.stakes || {})[f] !== 'listened').map((f) => WHO[f]);
    const cost = 'Every change costs someone.' + (heard.length ? ' You went with what ' + LIST(heard) + ' asked for.' : '') + (unheard.length ? ' ' + LIST(unheard) + (unheard.length > 1 ? ' were' : ' was') + ' overruled, or not asked.' : '');
    const GUESS = { most: 'most of Larkspur', half: 'about half', few: 'a few people', none: 'nobody' };
    const guess = sl.guess ? 'You guessed ' + GUESS[sl.guess] + ' would fit the Standard. The lantern counted: nobody.' + (sl.guess === 'none' ? ' You were right.' : '') : '';
    const hear = '';
    const open = [this.mk !== 'done' ? 'Market Square' : null, S.fixes.ramp !== 'built' ? 'the Works steps' : null].filter(Boolean);
    // (the notebook's section on where the game's question came from opens tonight: the card says so)
    this.st.openAutism();
    const p = ui.openPanel('center daycard', `<div class="dk">Monday, Larkspur</div><h2>${quiet ? 'A quiet lantern night' : guests.length + ' came to lantern night'}</h2>
      <div class="dfaces">${guests.map((id) => `<figure><img alt="" src="${ui.face(id, S)}"><figcaption>${esc(CAST[id].name)}</figcaption></figure>`).join('')}</div>
      <div class="d3">
        <section><h3>Who adjusted?</h3><p><b>The place, ${times(built.length)}.</b> ${esc(cap(LIST(built.map((f) => NAME[f]))))}.</p><p>${esc(you + smoothed)}</p></section>
        <section><h3>Who profited?</h3>${pick ? `<p>The game rewarded you ${mine.length} times today. One of them:</p>
          <div class="dhook"><i class="hk">${HOOK_SVG}</i><span>${esc(pick.what)}</span></div>
          <div class="dpick" role="group" aria-label="What was that reward?"><span>What was it?</span><button class="chip" data-v="real">Something real</button><button class="chip" data-v="hook">A pull to keep me playing</button></div>
          <p class="dans" role="status" hidden></p>` : `<p>You played without the game's hook marks today.${esc(blendLine)}</p>`}
          ${used.length ? `<details class="dall"><summary>Every kind of pull it used on you today</summary><div class="hooklist">${used.map((id) => `<div class="hookrow"><i class="hk">${HOOK_SVG}</i><div><b>${esc(HOOKS[id].name)}</b> <span class="cnt">×${S.hooks[id]}</span><span>${esc(HOOKS[id].what)}</span><span class="life">In real life: ${esc(HOOKS[id].life)}</span></div></div>`).join('')}</div><p class="small">Each one, with the research behind it, is in your phone's Fit Book, under Hook Log.</p></details>` : ''}</section>
        <section><h3>Who checked?</h3><p>${esc(cost + hear)}</p>${guess ? `<p>${esc(guess)}</p>` : ''}<p class="dsrc">${esc(CARDS.average.text)} <em>${esc(CARDS.average.src)}</em></p></section>
      </div>
      <p class="small dfrom">This game's question came from autistic people's accounts of masking. Their words, and the research, are in your phone's Notebook now.</p>
      ${this.st.sample ? `<p class="lede dtom">That was the end of a sample day. Your own goes the way you play it: your creature, your room, and whichever place you go to first.</p>
      <div class="pfoot dchoice"><button class="btn primary" id="dGo">Back to the start</button></div>` : `<p class="lede dtom"><i class="hk" title="A hook: unfinished business (an open loop)">${HOOK_SVG}</i>Tomorrow: the bus changes its route without warning, and Clover found something in the loft about how the Standard was made.${open.length ? ' Still waiting: ' + esc(LIST(open)) + '.' : ''}</p>
      <div class="pfoot dchoice"><p class="dq2">How would you like to play Tuesday? Neither is picked for you.</p><button class="btn" id="dGo">Keep playing<small>with the sparks and hook marks</small></button><button class="btn" id="dQuiet">Keep playing quietly<small>no hook marks, calm feedback</small></button><button class="btn" id="dStop">Stop here for now<small>your game is saved</small></button></div>`}`);
    ui.announce('Monday. Who adjusted? The place, ' + times(built.length) + '. ' + you + smoothed + ' Who profited? ' + (pick ? 'The game rewarded you ' + mine.length + ' times today. One of them: ' + pick.what + '. Was it something real, or a pull to keep you playing?' : '') + ' Who checked? ' + cost + hear + ' ' + guess);
    // the one reward: whichever you call it, it was both
    if (pick) {
      const ans = p.querySelector('.dans'); const btns = [...p.querySelectorAll('.dpick [data-v]')];
      const say = (v) => {
        btns.forEach((b) => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-pressed', b.dataset.v === v); });
        const at = pointedAt(pick);
        ans.textContent = (v === 'real' ? 'It was. It pointed you at ' + at + '. It was also a pull, built the way apps build theirs.' : 'It was, built the way apps build theirs. It also pointed you at ' + at + '.') + blendLine + ' A pull works the same either way. Ask what it points at, and who gains.';
        ans.hidden = false; sl.sortReal = v === 'real' ? 1 : 0; G.audio.sfx('select'); ui.announce(ans.textContent);
      };
      btns.forEach((b) => { b.onclick = () => say(b.dataset.v); });
    }
    S.flags.hooksShown = 1; this.st.fieldNote('limbic'); for (const id of used) this.st.fieldNote(HOOKS[id].note);
    // (two equal ways on, and neither picked in advance: the game doesn't choose its own pulls for you)
    const k = await new Promise((r) => { const on = (id, v) => { const b = p.querySelector(id); if (b) b.onclick = () => r(v); }; on('#dGo', 0); on('#dQuiet', 2); on('#dStop', 1); });
    ui.closePanel();
    if (k === 2) { S.flags.quietHooks = 1; G.settings.quietHooks = true; G.settings.calmFx = true; G.saveSettings(); }
    if (k === 1 && (await G.menus.confirm('Stop for now?', 'Your game is saved on this device. Continue, on the title screen, picks up on Tuesday morning.', 'Back to the title', 'Keep playing'))) S.slice.stopAfter = 1;
  }
}
// the dials on which someone sits far from the Standard's room (bright, loud, visitors any time, hints, early, a bit of
// both), as the marks' icons; wheels meet the town's steps
const STD = { light: 0.9, sound: 0.9, people: 0.9, talk: 0.9, time: 0.1, change: 0.5 };
const ICON_OF = { light: 'light', sound: 'noise', people: 'crowds', talk: 'how people talk', time: 'hours', change: 'change' };
function misfits(prof, wheels) {
  const out = Object.keys(STD).filter((d) => prof[d] != null && Math.abs(prof[d] - STD[d]) > 0.3).sort((a, b) => Math.abs(prof[b] - STD[b]) - Math.abs(prof[a] - STD[a])).map((d) => ICON_OF[d]);
  if (wheels) out.unshift('steps');
  return out.length ? out : ['change'];
}
// what a reward of the game's own pointed at, in a few words (its own words when it carried them)
function pointedAt(e) {
  if (e.point) return e.point;
  const w = e.what;
  if (/lantern night/.test(w)) return 'a neighbor, and a place on your porch';
  if (/colour|wave/i.test(w)) return 'a street that fits more people now';
  const m = /^A (?:mark tagged|rare find): (.+)$/.exec(w); if (m) return m[1].charAt(0).toLowerCase() + m[1].slice(1) + ', and who it pinches';
  if (/1 left/.test(w)) return 'the last thing on that street\'s list';
  if (/Clover|tomorrow/i.test(w)) return 'tomorrow';
  return 'a person';
}
const LIST = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
