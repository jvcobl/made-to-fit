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
import { Hearing, RAMP, CARDS, dealCard } from './hearing.js';
import { HOOKS, HOOK_ORDER } from './hooks.js';
import { HOOK_SVG } from './fx.js';
import { Blueprint } from './games/blueprint.js';
import { clamp, sleep, FAST, esc, fmtTime } from './util.js';

const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});
const T = { home: [9.5, 37.7], porch: [9.5, 37.4], cart: [25.9, 28.9], works: [12.6, 14.6], hall: [32, 14.1], kiosk: [37.3, 29.6], bea: [22.4, 38.0] };
// the latest the clock may run to in each part of the day: the day waits for you
const CAP = { wake: 540, homerow: 620, porch: 620, tomarket: 780, market: 790, moss: 790, rue: 900, works: 900, worksmarks: 900, gil: 900, hearing: 920, tonight: 1150, night: 1200 };
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
  frame(id) { this.G.marks.hideCard(); this.G.talkFrame(id); this.ui.letterbox(true); }
  unframe() { this.ui.hideDialog(); this.ui.letterbox(false); this.G.endTalk(); }
  card(id) {
    const S = this.S; S.cards = S.cards || {}; if (S.cards[id] || !CARDS[id]) return; S.cards[id] = S.day || 1;
    const c = CARDS[id];
    const label = c.kind === 'insight' ? 'Insight' : c.kind === 'deal' ? 'Agreed' : 'Their words';
    this.ui.toast(`<span class="cardline"><span class="ck ${c.kind}">${label}</span><b>${esc(c.title)}</b></span><span class="tsub">${esc(c.text)}${c.src ? ' <em>' + esc(c.src) + '</em>' : ''}</span>`, 'cardt', 5200);
    this.G.audio.sfx('ink');
    if (c.kind === 'insight' && this.st.fieldNote) this.st.fieldNote({ perceptible: 'ud', zoning: 'zoning', curb: 'curb', average: 'average' }[id] || id);
  }
  // a deal: the person a fix costs said what would make it work, and it's in your hand now
  dealToast(f) { const d = dealCard(f); if (!d) return; this.ui.toast(`<span class="cardline"><span class="ck deal">Agreed</span><b>${esc(d.title)}</b></span><span class="tsub">${esc(d.text)}</span>`, 'cardt', 5200); this.G.audio.sfx('sign'); }
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
  // tests and probes: the first day as if everything before this stage went the usual way
  debugTo(stage, o = {}) {
    const G = this.G, S = this.S; const order = ['wake', 'homerow', 'porch', 'tomarket', 'market', 'moss', 'rue', 'works', 'worksmarks', 'gil', 'hearing', 'tonight', 'night'];
    const k = order.indexOf(stage); if (k < 0) return false;
    const past = (s) => k > order.indexOf(s);
    S.flags.lantern = 1; G.rooms.home.setLantern(false); S.guests = { wren: 1 };
    const tagAll = (z) => { for (const m of MARKS) if (m.street === z && !m.rare && !m.fit) S.marks[m.id] = { day: 1, min: 600 }; };
    if (past('porch')) { tagAll('homerow'); S.slice.porch = 'teal'; S.stakes = Object.assign(S.stakes || {}, { lanterns: 'listened' }); S.fixes.lanterns = 'built'; S.fixVia = Object.assign(S.fixVia || {}, { lanterns: 'slice' }); G.town.setFix('lanterns', true); this.porchColors(); S.color.homerow = 1; S.color.street = 0.28; S.guests.bea = 1; S.cards.bea_knock = 1; S.cards.perceptible = 1; }
    else if (past('homerow')) tagAll('homerow');
    if (past('moss')) { tagAll('market'); S.fixes.quiet = 'built'; S.fixVia = Object.assign(S.fixVia || {}, { quiet: 'slice' }); G.applyFix('quiet'); S.sketch = { quiet: 'zoned' }; S.stakes = Object.assign(S.stakes || {}, { quiet: 'listened' }); S.color.market = 1; S.color.street = 0.5; Object.assign(S.guests, { moss: 1, pomeroy: 1 }); Object.assign(S.cards, { moss_kettle: 1, pomeroy_loud: 1, zoning: 1 }); }
    else if (past('market')) tagAll('market');
    if (past('rue')) { S.guests.rue = 1; S.slice.blend = o.blend ? 'yes' : 'no'; S.flags.rue_pitched = 1; if (o.blend) G.installBlend(); }
    // (whoever the day had you speak with by now)
    for (const [st, ids] of [['porch', ['bea', 'clover']], ['moss', ['moss', 'pomeroy']], ['rue', ['rue']], ['gil', ['gil']], ['hearing', ['hollis', 'pip']], ['tonight', ['wren']]]) if (past(st)) for (const id of ids) S.met[id] = true;
    if (past('worksmarks')) { tagAll('works'); S.cards.bea_steps = 1; }
    if (past('gil')) { S.stakes = Object.assign(S.stakes || {}, { ramp: 'listened' }); S.cards.curb = 1; S.slice.gil = 'asked'; }
    if (past('hearing')) { S.flags.hearingDone = 1; S.fixes.ramp = 'built'; S.fixVia = Object.assign(S.fixVia || {}, { ramp: 'slice' }); G.applyFix('ramp'); S.color.works = 1; S.color.street = 0.72; Object.assign(S.guests, { pip: 1, gil: 1, hollis: 1 }); }
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
      this.shot(new THREE.Vector3(66, 9, 70), new THREE.Vector3(57, 1.5, 30), 34, 0.6, true);
      G.busRide = true;
      await ui.caption('Your bus pulls into Larkspur. About a thousand people live here, and now you do too.', 3800);
      this.shot(new THREE.Vector3(35.5, 5.6, 31.5), new THREE.Vector3(30, 3.2, 24), 30, 0.5);
      await ui.caption('The whole town was planned around one person, the Standard Resident.', 3200);
      await ui.caption('That\'s its statue, in the square. Every step, door and light in town was made to fit it.', 4000);
      G.busRide = false;
      this.shot(new THREE.Vector3(14, 6, 46), new THREE.Vector3(9.5, 1.5, 35), 34, 0.8);
      await ui.caption('No. 2, Home Row. Your new home.', 2400);
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
      await ui.caption('First, who are you?', 1800);
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
    // lantern night ended the day: the porch goes dark, and the next morning is Tuesday
    await G.stage.fadeTo(1, 1100);
    st.fieldNote('endings'); st.fieldNote('made'); st.openAutism();
    SIM.nightUpdate(S);
    await this.ui.caption('Night.', 1200);
    S.slice.stage = 'done'; G.timeScale = FAST ? 22 : 2.5;
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
    if ((S.marks || {}).wk_steps && S.fixes.ramp !== 'built') this.detour(true);
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
      // (the arrow leads the way, but a mark's name waits until the beam has found it: the lesson is the sweep)
      const m = this.nextMark('homerow'); const found = m && G.marks.seen && G.marks.seen.has(m.id);
      return ob('Turn to sweep the beam along Home Row. The lantern glows and hums near what pinches people. Tag it with ' + (this.ui.touch ? 'a tap' : G.keyOf('interact')) + ' (' + c('homerow').done + '/' + c('homerow').total + ').', m ? [m.at[0], m.at[2] + 1.6] : null, found ? m.name : 'Something to find');
    }
    if (s === 'porch') return ob('Go to your door (No. 2) and hang a porch lantern.', T.porch, 'Your door');
    if (s === 'tomarket') return ob('Bea says noon is hard for Moss. Go to Market Square.', T.cart, 'Moss\'s tea cart');
    if (s === 'market') {
      if (!G.look.raised && c('market').done < c('market').total) return ob('Raise the lantern in the square' + (this.ui.touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
      return ob('Sweep the lantern around Market Square and tag what pinches people (' + c('market').done + '/' + c('market').total + (this.wrenOnly('market') ? ', and Wren already tagged one' : '') + '). The lantern glows and hums when it\'s close.', this.inZone('market') ? null : [29.5, 28.5], 'Market Square');
    }
    if (s === 'moss') return ob('Ask Moss how noon is for her.', this.near('moss', T.cart), 'Moss');
    if (s === 'rue') return ob('Rue is waving you over to the Blend kiosk.', this.near('rue', T.kiosk), 'Rue');
    if (s === 'works') return ob('Bea is stuck outside the Works.', [13.6, 15.6], 'Bea');
    if (s === 'worksmarks') {
      if (!G.look.raised && c('works').done < c('works').total) return ob('Raise the lantern at the Works' + (this.ui.touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
      return ob('Sweep the lantern around the Works and tag what pinches people (' + c('works').done + '/' + c('works').total + (this.wrenOnly('works') ? ', and Wren already tagged one' : '') + '). Try the long way around, too.', this.nearPos([15, 13], 9) ? null : [14, 15], 'The Works');
    }
    if (s === 'gil') return ob('Gil wants a word.', this.near('gil', [14.2, 14.4]), 'Gil');
    if (s === 'hearing') return ob('The hearing about the ramp: Town Hall, at three.', T.hall, 'Town Hall');
    if (s === 'tonight') return ob('Lantern night. Head home: your guests are on their way.', [9.5, 39.0], 'Your porch');
    return ob('');
  }
  inZone(z) { return this.G.loc === 'town' && this.G.zone === z; }
  // (Wren tags one mark on each street before you start: say so, until you've tagged one yourself)
  wrenOnly(z) { const mine = this.S.marks || {}; return MARKS.some((m) => m.street === z && m.pre) && !MARKS.some((m) => m.street === z && mine[m.id]); }
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
    if (it.id === 'home' && s === 'porch') return 'Hang a porch lantern';
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
    // the first step outside: the colour goes out of things (your room was in colour because you made it fit you)
    if (s === 'homerow' && G.loc === 'town' && !S.flags.firstOut) { S.flags.firstOut = 1; G.run(async () => { await sleep(FAST ? 10 : 600); await this.gut('Outside, the color goes flat. Your room was in color because you set it to fit you.'); this.ui.hideDialog(); }); return; }
    if (s === 'homerow' && G.loc === 'town' && G.look.raised && !S.flags.endowedShown) this.onRaise();
    if (s === 'homerow' && G.loc === 'town' && G.marks.complete('homerow') && !G.look.open) { G.run(() => this.beaOut()); return; }
    if (s === 'tomarket' && z === 'market' && this.nearPos([29.5, 27], 10.5)) { G.run(() => this.marketArrive()); return; }
    if (s === 'market' && G.marks.complete('market')) { this.stage = 'moss'; this.ui.toast('<b>Market Square: seen.</b> Now ask the people it pinches.', 'good', 3800); return; }
    if (s === 'works' && G.loc === 'town' && this.nearPos([13.4, 14.2], 4.5)) { G.run(() => this.worksArrive()); return; }
    if (s === 'worksmarks' && G.marks.complete('works')) { G.run(() => this.gilOut()); return; }
    if (s === 'tonight') { G.run(() => this.lanternNight()); return; }
    // Blend, if you have it, keeps pinging (in the story, never in real life)
    this.blendTick();
  }
  nearPos(at, r) { const p = this.G.player.root.position; return this.G.loc === 'town' && Math.hypot(p.x - at[0], p.z - at[1]) < r; }
  // the first list you see started with one already ticked, by Wren: a head start, shown as the hook it is
  onRaise() {
    const S = this.S, G = this.G; const z = G.marks.streetHere();
    if (z === 'homerow' && this.stage === 'homerow' && !S.flags.endowedShown) { S.flags.endowedShown = 1; setTimeout(() => G.fx.chipPop('Wren already ticked 1 of 3', { kind: 'mark', hook: 'endowed', hookCtx: { what: 'Home Row started at 1 of 3, ticked by Wren', point: 'the doors on Home Row, which Wren had already noticed' }, ms: 2600 }), 500); }
  }
  onMark(m, c) {
    if (m.id === 'wk_steps') { this.detour(true); setTimeout(() => this.G.fx.pop(new THREE.Vector3(20.4, 1.6, 10.2), 'The long way round', { kind: 'mark', ms: 2600 }), 600); }
  }
  // a hook mark on the street list the first time you see it (the head start is Wren's tag)
  async pickLantern() {
    const G = this.G, S = this.S;
    await this.note('A small lantern on the windowsill, with a note: "For No. 2. Raise it to see what pinches people here, the way a shoe pinches when it doesn\'t fit. I\'ve tagged one thing on Home Row to show you how."');
    await this.note('On the back, it says "Tonight is lantern night, a little get-together on your porch. Invite whoever you like. Wren."');
    this.ui.hideDialog();
    S.flags.lantern = 1; G.rooms.home.setLantern(false); G.ui.gearKey = '';
    G.audio.sfx('lantern'); G.fx.burst(G.player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { n: 14, colors: ['#ffcf7a', '#fff4d6'] });
    S.guests = S.guests || {}; this.addGuest('wren', true); this.renderGuests('wren');
    this.ui.toast(`<b>Wren's lantern</b><br>Outside, ${this.ui.touch ? 'the lantern button' : G.keyOf('look') + ' (or the lantern button)'} raises it. Wren is coming to lantern night. Who else comes is up to you.`, 'idea', 6800);
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
    await this.gut('Wren\'s note has one more line, at the bottom. "A light by the door can say it without a word."');
    this.unframe();
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
    await this.say('bea', 'If you\'re making room, dear, go and see Moss at the tea cart. Noon in the square is terribly loud.');
    this.unframe(); this.release('bea');
    await this.timelapse(Math.max(S.min, 690), 'By lunchtime, the rest of the row has lanterns up too.');
    this.porchColors();
    this.stage = 'tomarket';
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
    // (a few steps in first, out from between the roofs, so the square is what you see when it asks)
    G.walkTo(28.6, 30.4); await this.until(() => !G.path.length, FAST ? 300 : 2600);
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
    const what = { sound: 'The same jingle blares from a speaker on every post.', people: 'The whole square is one crowd at noon.', light: 'The noon sun bounces off every stall.' }[top] || 'Noon, in the square.';
    const opts = [
      { key: 'bend', who: 'You', label: 'Push through', sub: 'You stay, and nobody notices what it costs you.', hold: true },
      { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: 'nothing you own helps with this yet' },
      { key: 'ask', who: 'Them', label: 'Ask someone to turn it down', disabled: true, reason: 'the speakers are the council\'s; nobody here can' },
      { key: 'fix', who: 'The place', label: 'Make room here', sub: 'Find what pinches, and fix it for everyone. Slower, but it lasts.' },
      { key: 'leave', who: 'Nobody', label: 'Go somewhere else', sub: 'You rest. You miss what you came for.' },
    ];
    const choice = await this.ui.barrier({ options: opts, title: 'Market Square, noon', text: what, coach: 'When a place doesn\'t fit, someone adjusts. Each answer costs something different.' });
    this.ui.hideBarrier(); G.focusPinch(false);
    this.st.fieldNote('fit');
    S.slice.adjust = choice;
    if (choice === 'bend') { S.masking = true; S.maskZone = 'market'; SIM.bendCost(S, false); S.stats.bend++; await this.gut('You push through. Nobody can tell. It costs you, and the square is still loud for Moss, every day.'); }
    else if (choice === 'leave') { S.stats.leave++; await this.gut('You step back out of the square. The jingle keeps going without you, and Moss is still in it.'); this.ui.hideDialog(); G.walkTo(29.5, 35.5); S.slice.leftMarket = 1; }
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
      moss: (S.color || {}).market >= 1 ? 'Hear that? My own kettle. I\'d forgotten it whistles.' : early ? 'Morning, love. Come back at noon if you want to see what I put up with.' : 'Tea? You\'ll have to shout. Everyone does, at noon.',
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
    await this.say('moss', 'Noon, love. That jingle blares from every post, and by twelve I can\'t hear my own kettle. It\'s the only spot with shade, so I stay, I smile, and I go home and lie in the dark.');
    this.card('moss_kettle');
    this.unframe();
    // Pomeroy has heard every word
    this.walkIn('pomeroy', [27.4, 29.6]);
    await sleep(FAST ? 20 : 1600);
    this.frame('pomeroy');
    await this.say('pomeroy', 'Oi! Don\'t you turn that music off! Half my sales are folk who hear me before they see me!');
    await this.say('pomeroy', 'Put your quiet on the bench side, and leave me my side loud. Everybody gets a side.');
    this.card('pomeroy_loud');
    this.unframe(); this.release('pomeroy');
    // Clover, with her sketchbook
    this.walkIn('clover', [26.2, 30.6], [36, 33.6]);
    await sleep(FAST ? 20 : 2200);
    this.frame('clover');
    await this.say('clover', 'Right. I\'m Clover, I run the Fix-It Shed. I heard "kettle" and I heard "side". Both fair. Let\'s sketch a square where everyone fits.');
    this.unframe();
    const r = await new Blueprint(G, 'quiet', { where: 'Market Square, on Clover\'s sketchbook', how: 'Each face can only walk a little way. Put changes <b>near the people who need them</b>, and get <b>every face glowing</b>.' }).run();
    const zoned = !!(r && r.zoned);
    S.stakes = S.stakes || {}; S.stakes.quiet = zoned ? 'listened' : 'overruled';
    // the build, over lunch
    this.frame('clover');
    await this.say('clover', zoned ? 'A quiet corner by the benches, and a music corner by the apples. Give me an hour and my crew from the Shed.' : 'Quieter everywhere, then. It\'s a start. Give me an hour.');
    this.unframe();
    await this.build('quiet', [23.5, 31.2], Math.max(S.min, 790), 'Clover\'s crew builds it over lunch.');
    S.fixes.quiet = 'built'; S.fixVia = S.fixVia || {}; S.fixVia.quiet = 'slice';
    await this.waveWide('market', [23.5, 31.2], [28, 27]);
    if (!zoned) G.color.hold('pomeroy', 0.36);
    this.frame('moss');
    await this.say('moss', 'Listen. That\'s my kettle. I\'d forgotten it whistles. Lantern night, is it? I\'ll bring a pot.');
    this.addGuest('moss');
    this.unframe();
    this.frame('pomeroy');
    if (zoned) { await this.say('pomeroy', 'A music corner, right by my apples? Fair\'s fair. I\'ll shout in the other direction. And I\'ll bring a bag round tonight.'); this.addGuest('pomeroy'); this.dealToast('quiet'); }
    else { await this.say('pomeroy', 'Quieter everywhere, is it. Grand. Grand for some.'); await this.gut('He asked for a side of his own. The sketch didn\'t leave him one.'); }
    this.unframe();
    this.card('zoning');
    this.release('clover');
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
  frameAt(at, o = {}) { const G = this.G; this.shot(new THREE.Vector3(at[0] + (o.dx == null ? 5 : o.dx), o.h || 9.5, at[1] + (o.dz == null ? 11 : o.dz)), new THREE.Vector3(at[0], 0.8, at[1]), o.fov || 40, 2.6); }
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
    const p = G.player.root.position; this.walkIn('rue', [p.x + 1.5, p.z + 0.6]);
    G.ui.bubble('rue', 'Psst! New person!', { tint: CAST.rue.tint, ms: 2600 });
    await sleep(FAST ? 20 : 2200);
    this.frame('rue');
    await this.say('rue', 'Nice work! That was a LOT of effort for some quiet, though. My app, Blend, does it in one tap. Turn on Smooth Mode and you stop minding things, and you get points for every place you push through. Free!');
    const k = await this.choose([{ t: 'Go on, I\'ll try it', id: 'blend_yes', blend: true }, { t: 'No thanks', id: 'blend_no' }], { text: 'Install Blend?', kind: 'gut' });
    if (k === 0) {
      G.installBlend();
      G.fx.pop(G.player.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '+30 points', { kind: 'blend', hook: 'points', hookCtx: { what: 'Blend: 30 welcome points', by: 'blend' } });
      await this.say('rue', 'Yay! Turn on Smooth Mode whenever a place gets to you, and every push-through in a row adds to your streak! Oh, and Bea\'s been stuck outside the Works for ages. Something about steps?');
      S.slice.blend = 'yes';
    } else { await this.say('rue', 'Suit yourself! It\'s always there. Oh, and Bea\'s been stuck outside the Works for ages. Something about steps?'); S.slice.blend = 'no'; }
    S.flags.rue_pitched = 1;
    this.unframe(); this.release('rue');
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
    await this.say('bea', 'There you are. The mail counter\'s in there, dear. Three steps. My cart doesn\'t do steps.');
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
    const G = this.G, S = this.S; if (this.stage !== 'worksmarks') return;
    this.stage = 'gil';
    G.npcTo('gil', [14.4, 14.4], 'town', [12, 12.9]);
    await sleep(FAST ? 20 : 900);
    await this.gilTalk();
  }
  async gilTalk() {
    const G = this.G, S = this.S;
    this.frame('gil');
    await this.say('gil', 'Hey hey! The new person! What\'s all this? Oh, Bea. Afternoon, Bea.');
    await this.say('you', 'A ramp. For Bea, and anyone else on wheels.');
    await this.say('gil', 'Love that. Love the energy. Anything that changes the building goes to the council, though. Hollis runs the hearings, and there\'s one at three, at Town Hall!');
    await this.say('gil', 'One tiny thing. The planters by the steps? My tomatoes. Nine years. They\'re the only thing in this building that\'s thriving.');
    const k = await this.choose([{ t: 'What would make a ramp work for you?', id: 'gil_ask' }, { t: 'We\'ll sort that out later', id: 'gil_later' }]);
    if (k === 0) {
      await this.say('gil', 'Could it run along the rail, with the tomatoes beside it? A bit narrower. Still fits a cart. I measured. Twice.');
      S.stakes = S.stakes || {}; S.stakes.ramp = 'listened'; S.slice.gil = 'asked'; this.dealToast('ramp');
    } else { await this.say('gil', 'Sure, sure. No worries!'); await this.gut('Three no-worries is one worry.'); S.slice.gil = 'later'; }
    this.unframe();
    G.npcTo('gil', null);
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
      await this.say('hollis', r.yes === 3 ? 'Three votes out of three. The ramp goes up this afternoon. Goodness.' : 'The vote passes. The ramp goes up this afternoon.');
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
      await this.build('ramp', [16, 11.2], Math.max(S.min, 1000), 'The ramp goes up by late afternoon.');
      this.detour(false);
      await this.waveWide('works', [13, 12.6], [13, 11]);
      this.frameAt([16, 11.6], { dx: 2, dz: 9, h: 6.5, fov: 38 });
      await this.curbCut();
      this.unframeAt();
      this.addGuest('pip'); this.addGuest('hollis', false, 800);
      if (S.slice.gil === 'asked' || r.yes === 3) this.addGuest('gil', false, 1600);
      if (S.slice.gil !== 'asked' && r.yes === 3) { S.stakes = S.stakes || {}; S.stakes.ramp = 'listened'; }
    } else { await G.exitRoom(true); this.detour(false); }
    this.stage = 'tonight';
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
    if (G.loc !== 'town') { await G.stage.fadeTo(1, 400); G.setLoc('town'); G.place([9.5, 38.4]); G.audio.setScene('town'); await G.stage.fadeTo(0, 400); }
    // the afternoon goes by over the streets you made room in
    ui.letterbox(true);
    this.shot(new THREE.Vector3(26, 44, 66), new THREE.Vector3(24, 0, 28), 44, 1.8);
    await this.timelapse(Math.max(S.min, 1170), 'The afternoon goes gold over the streets you made room in.');
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
    const absent = ['bea', 'moss', 'pomeroy', 'pip', 'gil'].filter((id) => !S.guests[id]);
    if (full && guests.length) await this.note(guests.length === 1 ? CAST[guests[0]].name + ' came. One guest, and a whole porch of light.' : LIST(guests.map((g) => CAST[g].name)) + ' came. Your porch is full.');
    if (absent.length) await this.gut(this.absentLine(absent));
    // Wren knocks once, then waits (that's her own sign), with the lantern tuned to one more person
    this.walkIn('wren', [9.5, 40.2], [15.5, 44.4], true);
    await this.until(() => { const q = G.npcs.wren.c.root.position; return Math.hypot(q.x - 9.5, q.z - 40.2) < 1.2; }, 5000);
    this.frame('wren');
    if (S.slice.quietNight) await this.say('wren', 'Knock. I\'m waiting, as your lantern says. I only came to show you one thing.');
    await this.say('wren', 'I tuned the lantern. It reads one more person now: the one this town was built for. The Standard.');
    const gi = await this.choose([{ t: 'Most of them', id: 'guess_most' }, { t: 'About half', id: 'guess_half' }, { t: 'A few', id: 'guess_few' }, { t: 'Nobody', id: 'guess_none' }], { text: 'Wren: "First, a guess. How many people in Larkspur fit the Standard?"', kind: 'say', who: 'wren' });
    S.slice.guess = ['most', 'half', 'few', 'none'][gi];
    await this.say('wren', 'Raise it, and see.');
    this.unframe(); ui.letterbox(true);
    await this.standardReveal();
    this.frame('wren');
    await this.say('wren', S.slice.guess === 'none' ? 'You guessed it. Nothing pinches the Standard, and not one of us fits it.' : 'Nothing pinches the Standard. Not one mark. And not one of us fits it. Not one person in Larkspur.');
    await this.say('wren', 'They built the whole town for somebody who isn\'t here. Today you made room for people who are.');
    this.card('average');
    this.unframe();
    // the day's rewards, sorted: what did each one point you at? Then the postcard, and tomorrow.
    await this.hookSort();
    await this.dayCard();
    ui.letterbox(false);
    for (const id of Object.keys(CAST)) if (G.npcs[id]) G.npcTo(id, null);
    this.st.finishDay('night');
  }
  absentLine(absent) {
    const W = { moss: 'Moss couldn\'t come. The square was still too loud to pack up early.', pomeroy: 'Pomeroy didn\'t come. The quiet cost him, and the sketch left him no side of his own.', pip: 'Pip couldn\'t come. Her cart still goes the long way round.', gil: 'Gil sent a text: "Next time!!" Nobody asked him about his tomatoes.', bea: 'Bea\'s light stayed amber.' };
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
    // each of you, and what doesn't fit them: a list under the number (readable on any screen), and on a wide screen
    // a label over each head as well
    const wide = innerWidth / Math.max(1, innerHeight) >= 1.25;
    { const cap = document.createElement('p'); cap.className = 'rvcap'; cap.textContent = 'Where each of you differs from the Standard'; tag.appendChild(cap); }
    const list = document.createElement('ul'); list.className = 'rvlist'; tag.appendChild(list);
    for (const id of here) {
      const prof = id === 'you' ? S.profile : (CAST[id].profile || {});
      const icons = misfits(prof, id === 'you' ? S.wheels : CAST[id].cart).slice(0, 3);
      const label = (id === 'you' ? 'You' : CAST[id].name) + ': ' + icons.join(', ');
      const li = document.createElement('li'); li.textContent = label; list.appendChild(li);
      if (wide) { const obj = id === 'you' ? G.player.root : G.npcs[id].c.root; G.fx.pop(obj.position.clone(), label, { kind: id === 'you' ? 'mark' : 'guest', ms: 3000, rise: 20, follow: obj, dy: 2.3 }); }
      G.audio.sfx('pop'); await sleep(FAST ? 2 : 300);
    }
    tag.querySelector('b').textContent = '0'; tag.querySelector('span').textContent = 'of ' + here.length + ' on your porch fit the Standard. Not even you.';
    this.ui.announce('None of the ' + here.length + ' on your porch fit the Standard. Not even you. Where each of you differs from it. ' + [...list.children].map((x) => x.textContent).join('. ') + '.');
    await sleep(FAST ? 20 : 3200);
    tag.remove();
  }
  // ---------- the hooks, sorted ----------
  async hookSort() {
    const G = this.G, S = this.S, ui = this.ui;
    const log = (S.hookLog || []).slice();
    // three or four moments: a guest, then different pulls where it can, and Blend's if it was used
    const pickd = []; const seen = new Set(); const said = new Set();
    const add = (e) => { if (!e || said.has(e.what) || pickd.length >= 4) return; said.add(e.what); seen.add(e.id + e.by); pickd.push(e); };
    add(log.find((e) => /lantern night/.test(e.what)));
    add(log.find((e) => e.by === 'blend'));
    for (const id of ['endowed', 'rare', 'gradient', 'openloop', 'juice']) if (pickd.length < 3 && !seen.has(id + 'game')) add(log.find((e) => e.id === id && e.by !== 'blend'));
    for (const e of log) if (pickd.length < 3) add(e);
    if (pickd.length < 2) return;
    const p = ui.openPanel('center hooksort', `<h2>Where did the hooks point you?</h2><p class="lede">Today the game rewarded you ${G.hooks.total()} times, each with a little hook mark. Here are ${pickd.length === 3 ? 'three' : pickd.length === 4 ? 'four' : 'two'}. For each one, did it point you at something real, or was it just a pull to keep you playing?</p>
      <div class="hs">${pickd.map((e, i) => `<div class="hsrow" data-i="${i}"><div class="hsw"><i class="hk">${HOOK_SVG}</i>${esc(e.what)}${e.by === 'blend' ? ' <span class="hsb">Blend</span>' : ''}</div><div class="hsbtn"><button class="chip" data-v="real">Something real</button><button class="chip" data-v="hook">Just a pull</button></div></div>`).join('')}</div>
      <div class="pfoot"><button class="btn primary" id="hsGo" disabled>See what they were</button></div>`);
    const ans = {};
    p.querySelectorAll('.hsrow').forEach((row) => row.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; ans[row.dataset.i] = b.dataset.v; row.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); G.audio.sfx('select'); p.querySelector('#hsGo').disabled = Object.keys(ans).length < pickd.length; }));
    await new Promise((r) => { p.querySelector('#hsGo').onclick = r; if (FAST) setTimeout(r, 30); });
    const realN = pickd.filter((e, i) => ans[i] === 'real').length;
    const game = pickd.map((e, i) => [e, i]).filter(([e]) => e.by !== 'blend'); const gameReal = game.filter(([, i]) => ans[i] === 'real').length;
    const blend = pickd.map((e, i) => [e, i]).filter(([e]) => e.by === 'blend');
    const used = HOOK_ORDER.filter((id) => (S.hooks || {})[id]);
    // the answer to what you said: the game's rewards were both things at once; Blend's pointed at its own points
    const [head, lead] = gameReal === game.length ? ['Real, and a pull', `You called ${game.length === 1 ? 'the game\'s reward' : 'every one of the game\'s rewards'} something real, and ${game.length === 1 ? 'it was' : 'they were'}. Each was also a pull, the same kinds apps use.`]
      : gameReal === 0 ? ['A pull, and real', `You called ${game.length === 1 ? 'it' : 'every one'} just the pull, and you were right. Each also pointed you at something real.`]
      : ['Both, every time', `You called ${gameReal} of ${game.length} something real. All of them were both: a pull, and something real underneath it.`];
    const blendLine = blend.length ? ` Blend's ${blend.length > 1 ? 'were' : 'was'} the pull with nothing underneath: ${blend.length > 1 ? 'they' : 'it'} pointed at ${blend.length > 1 ? 'their' : 'its'} own points.` : '';
    const rows = pickd.map((e, i) => `<div class="hsrow res"><div class="hsw"><i class="hk">${HOOK_SVG}</i><span><b>${esc(e.what)}</b><br><span class="hsr">${ans[i] === 'real' ? 'You said: something real.' : 'You said: just the pull.'} ${esc(HOOKS[e.id].use || '')} ${e.by === 'blend' ? 'It pointed you at Blend\'s points.' : 'It pointed you at ' + esc(pointedAt(e)) + '.'}</span></span></div></div>`).join('');
    p.innerHTML = `<h2>${esc(head)}</h2><p class="lede">${esc(lead + blendLine)}</p>
      <div class="hs">${rows}</div>
      <div class="hooklist">${used.map((id) => `<div class="hookrow"><i class="hk">${HOOK_SVG}</i><div><b>${esc(HOOKS[id].name)}</b> <span class="cnt">×${S.hooks[id]}</span><span>${esc(HOOKS[id].what)}</span><span class="life">In real life: ${esc(HOOKS[id].life)}</span></div></div>`).join('')}</div>
      <p class="hsend">The pull works the same either way. What changes is what it points you at, and whether you can see it working.</p>
      <p class="small">Each pull, with the research behind it, is in your phone's Fit Book, under Hook Log.</p>
      <div class="pfoot"><button class="btn primary" id="hsOk">Go on</button></div>`;
    S.flags.hooksShown = 1; S.slice.sortReal = realN; this.st.fieldNote('limbic'); for (const id of used) this.st.fieldNote(HOOKS[id].note);
    await new Promise((r) => { p.querySelector('#hsOk').onclick = r; if (FAST) setTimeout(r, 30); });
    ui.closePanel();
  }
  // the day's postcard: who came, what you made, and how you'd like tomorrow (with the pulls, or without)
  async dayCard() {
    const G = this.G, S = this.S, ui = this.ui;
    const guests = Object.keys(S.guests || {}); const quiet = !!S.slice.quietNight;
    const built = ['lanterns', 'quiet', 'ramp'].filter((f) => S.fixes[f] === 'built');
    const p = ui.openPanel('center daycard', `<div class="dk">Monday, Larkspur</div><h2>${quiet ? 'A quiet lantern night' : guests.length + ' came to lantern night'}</h2>
      <div class="dfaces">${guests.map((id) => `<figure><img alt="" src="${ui.face(id, S)}"><figcaption>${esc(CAST[id].name)}</figcaption></figure>`).join('')}</div>
      <div class="dbuilt">${built.map((f) => `<span>${esc(SIM.FIXES[f].name)}</span>`).join('')}</div>
      <p class="lede dtom"><i class="hk" title="A hook: unfinished business (an open loop)">${HOOK_SVG}</i>Tomorrow: the bus changes its route without warning, the Works is too bright for Gil, and Clover found something in the loft about how the Standard was made.</p>
      <p class="dq2">Choose how you'd like to play Tuesday. Neither option is picked for you.</p>
      <div class="pfoot dchoice"><button class="btn" id="dGo">Keep playing<small>with the sparks and hook marks</small></button><button class="btn" id="dQuiet">Keep playing quietly<small>no hook marks, calm feedback</small></button></div>
      <div class="dstop"><button class="linkbtn" id="dStop">Stop here for now</button></div>`);
    // (two equal ways on, and neither picked in advance: the game doesn't choose its own pulls for you)
    const k = await new Promise((r) => { p.querySelector('#dGo').onclick = () => r(0); p.querySelector('#dQuiet').onclick = () => r(2); p.querySelector('#dStop').onclick = () => r(1); if (FAST) setTimeout(() => r(0), 30); });
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
