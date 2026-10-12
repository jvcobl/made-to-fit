// The season: prologue, three days, the council, the festival, the ending. Interprets the scripts in content.js.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST, TALK, HINTS, BARRIER, GUTS, NOTICE, NOTICE_OVER, ASK, BYSTANDER, FAVOURS, STAKES, FELT, PROLOGUE, SETUP, TEXTS, COUNCIL, FESTIVAL, ENDINGS, QUESTIONS, BLEND, NIGHT, PEOPLE, LIKED, UNASKED, SLOT_LABEL } from './content.js';
import { FIELD_NOTES } from './notes.js';
import { clamp, pick, sleep, FAST, fmtTime, now, seedRng, params } from './util.js';
import * as SAVE from './save.js';
import { escortBea } from './guide.js';
import { whoDecided, DEFAULTS } from './decided.js';
import { endingKey, TITLES, TITLES2, specificLine, remember, buildCarry, fitCardData } from './ending.js';
import { recap } from './recap.js';
import { parseCond, parseEffect, compare } from './script.js';
import { SortGame } from './games/sort.js';
import { StampGame } from './games/stamp.js';
import { Blueprint, PlainNote, BLUEPRINTS } from './games/blueprint.js';
import { PondGame, FISH } from './games/pond.js';
import { cardTile } from './packs.js';
import { PaintGame } from './games/paint.js';
import { TeachUnit } from './games/teach.js';
import { FestivalMail } from './games/mail.js';
import { Return, stateFromCarry } from './returns.js';
import { Slice } from './slice.js';
import { Hearing, HEARINGS } from './hearing.js';

// where objectives point: a spot just in front of each door
const T = { works: [12, 13.9], shed: [52, 11.8], hall: [32, 14.1], home: [9.5, 37.7], square: [30, 27.2], statue: [30, 26.6], farend: [50, 42.3], pond: [52.4, 43.9] };
const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});

const NAMES = (ids) => ids.map((i) => CAST[i].name).join(' and ');
// "Gil, Pip and Moss"
const LIST = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const WORDS = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + WORDS(n % 100) : ''));
const DIM_LABEL = { sound: 'Sound', light: 'Light', people: 'People', talk: 'Talk', time: 'Time', change: 'Change' };
export const BUILD = '1.0-dev';
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday'];
const ACT_DAY = { 2: 'Ten years on', 3: 'Twenty years on' };
const phaseLabel = (phase, day, act, min) => { const D = act > 1 ? ACT_DAY[act] : DAYS[day]; if (phase === 'free') return D + ', ' + fmtTime(min); if (phase === 'setup') return 'Moving in'; return phase === 'morning' ? (act > 1 ? D + ', arriving' : D + ' morning') : phase === 'shift' ? D + (act === 2 ? ', after the festival mail' : act === 3 ? ', the Shed open' : ', after work') : phase === 'meeting' ? D + ', after the meeting' : 'the end of your visit'; };
const sens = (S, d) => Math.abs(S.profile[d] - 0.5) >= 0.28;
export const DOOR = { home: [9.5, 38.7], works: [12, 13.8], hall: [32, 14.4] };
// what someone in charge can change when you ask: the sound, the light, the company. Not the hours, how people talk,
// or how often things change; those say why instead.
const ASKABLE = ['sound', 'light', 'people'];
// when the next one is still a while off
const FELT_LATER = { quiet: 'Around noon, the quiet corner is in use.', board: 'Around four, the bus board is in use.', lanterns: 'From nine, the porch lanterns are in use on Home Row.', ramp: 'From nine, the ramp is in use.', dim: 'From nine to eleven, the dimmable lights are on at the Works.', plain: 'From nine to eleven, the plain notes are up at the Works.' };
// where to see each fix in use on festival day: objective text, where to walk, its label, and the room it is in
const FELT_WAY = {
  quiet: ['The quiet corner is up. See it in use at noon, in Market Square.', [23.6, 30.2], 'The quiet corner'],
  board: ['The bus board is up. See it in use at the bus stop, around four.', [55.4, 24.2], 'The bus stop'],
  lanterns: ['The porch lanterns are up. Walk up Home Row and see them in use.', [15, 38], 'Home Row'],
  ramp: ['The ramp is up. See it in use at the Works door, before eleven.', [12, 15.2], 'The Works door'],
  dim: ['The dimmable lights are up. See them at the Works, 9 to 11.', [12, 13.9], 'The Works', { inside: 'works' }],
  plain: ['The plain notes are up. See them at the Works, 9 to 11.', [12, 13.9], 'The Works', { inside: 'works' }],
};
// a backer who has told you it pinches them too, in their own words
const MINE_TOO = { gil: 'Ha. This one\'s mine too.', pip: 'Oh, that one\'s me too!', moss: 'That one\'s for me as well, love.', rue: 'That one\'s mine too. Honestly.', bea: 'This one\'s for me too, dear.', wren: 'That is mine too.', clover: 'I\'ve been waiting for that one.', hollis: 'Ah. That one is rather mine as well.' };
const ASK_NOT = { time: 'nobody here can move the hours for you', talk: 'it\'s how people talk here, not a switch', change: 'nobody here can stop things changing' };

export class Story {
  constructor(G) { this.G = G; this.endDay = null; this.slice = new Slice(this); }
  get S() { return this.G.S; }
  get ui() { return this.G.ui; }

  async start() {
    const G = this.G;
    const read = SAVE.readSave();
    // a return visit straight after an ending ("Ten years later"), handed over across a reload. A bare link
    // (#return=N with a code) asks first if a visit is still in progress here.
    const hand = this.takeHandoff();
    if (hand) {
      const live0 = read.save && read.save.phase !== 'end' ? read.save : null;
      const ok = !hand.link || !live0 || (await G.menus.confirm('Start that visit?', 'This replaces your saved visit (' + (live0.label || 'in progress') + '). Finished visits stay.', 'Start it', 'Keep my save'));
      if (ok) { await this.startReturn(hand.act, hand.carry, hand.name); return; }
    }
    // "Play this visit again" reloads straight into a new visit, with the one thing you chose to set differently
    let again = null; try { again = JSON.parse(sessionStorage.getItem('mtf.again') || 'null'); sessionStorage.removeItem('mtf.again'); } catch (e) { again = null; }
    const pick = again && (again.act || 1) === 1 ? { kind: 'new' } : again ? { kind: 'return', act: again.act, carry: again.carry || this.carryFor(again.act - 1), again } : await this.titleScreen({ save: read.save || null, ret: this.nextReturn(read.save) });
    if (again && again.default) this.S.carryDefault = again.default;
    // starting another visit replaces a visit still in progress: say so first (finished visits always stay)
    const live = read.save && read.save.phase !== 'end' && !again ? read.save : null;
    const keepLive = async () => !live || G.menus.confirm('Start that visit?', 'This replaces your saved visit (' + (live.label || 'in progress') + '). Finished visits stay.', 'Start it', 'Keep my save');
    // a visit code, or the title's "Return to Larkspur": the visit after the one it holds
    if (pick.kind === 'code' && pick.carry) {
      const a = (pick.carry.act || 1) + 1;
      if (a > 3) { this.ui.toast('That code is from your last visit. There isn\'t another one after it, but you can start again from the beginning.', '', 6000); await this.start(); return; }
      if (!(await keepLive())) { await this.start(); return; }
      await this.startReturn(a, pick.carry, null, again && again.default); return;
    }
    if (pick.kind === 'return' && !pick.carry) pick.carry = this.carryFor(pick.act - 1);
    if (pick.kind === 'return') {
      if (!pick.carry) { this.ui.toast('This browser no longer remembers that visit. A visit code from its ending page still works.', '', 6000); await this.start(); return; }
      if (!pick.again && !(await keepLive())) { await this.start(); return; }
      await this.startReturn(pick.act, pick.carry, pick.again ? pick.again.name : null, pick.again && pick.again.default); return;
    }
    if (pick.kind === 'recap') { const r = await recap(this, live); if (r) { await this.startReturn(2, r.carry, r.name); return; } location.reload(); return; }
    // a save code from another device replaces the visit saved here, so that asks first too
    if (pick.kind === 'code' && pick.save && !(await keepLive())) { await this.start(); return; }
    const save = pick.kind === 'continue' ? pick.save : pick.kind === 'code' ? pick.save : null;
    if (save) {
      const at = await this.resumeFrom(save);
      if (at) {
        if ((this.S.act || 1) > 1) { this.ret = new Return(this); if (at.phase === 'end') { this.ret.setup(); await this.ending(); return; } await this.ret.run(at.phase); return; }
        if (at.phase === 'end') { await this.ending(); return; }
        if (at.phase === 'setup') { seedRng(this.S.seed); await this.prologue('setup'); await this.days(1, 'morning'); return; }
        await this.days(at.day, at.phase); return;
      }
    }
    // a new visit: the comfort check first (tests skip it unless they ask for it)
    if (!G.settings.comfortDone && (!G.test || params.get('comfort') === '1')) await G.menus.comfort();
    seedRng(this.S.seed);
    // (?v1=1 plays the first day the old way, for comparison and older tests)
    if (params.get('v1') !== '1') this.slice.init();
    await this.prologue();
    await this.days(1, 'morning');
  }
  // ---------- between visits ----------
  // The reload into the next visit carries the act (and your name, which no code holds) in this tab only. If the
  // browser keeps no storage, the visit code rides along in the address instead.
  takeHandoff() {
    let h = null; try { h = JSON.parse(sessionStorage.getItem('mtf.next') || 'null'); sessionStorage.removeItem('mtf.next'); } catch (e) { h = null; }
    let act = h && h.act, carry = null;
    const m = /(?:^|[#&])return=(\d)(?:&v=([A-Za-z0-9-]+))?/.exec(typeof location !== 'undefined' ? location.hash || '' : '');
    if (m) { act = act || +m[1]; if (m[2]) { const d = SAVE.decodeVisit(m[2]); if (d.carry) carry = d.carry; } try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { try { location.hash = ''; } catch (e2) { /* nothing more to do */ } } }
    if (!act || act < 2 || act > 3) return null;
    carry = carry || this.carryFor(act - 1);
    return carry ? { act, carry, name: h && h.name, link: !h } : null;
  }
  carryFor(act) { const r = SAVE.readCarry(); return (r.carry && r.carry.acts && r.carry.acts[String(act)]) || null; }
  // the title offers the next visit when the last one you finished has one after it
  nextReturn(save) {
    const r = SAVE.readCarry(); const acts = (r.carry && r.carry.acts) || {};
    const done = [1, 2].filter((a) => acts[String(a)] && !acts[String(a + 1)]); if (!done.length) return null;
    const act = Math.max(...done) + 1; if (save && (save.act || 1) >= act && save.phase !== 'end') return null;
    return { act, label: act === 2 ? 'Ten years later' : 'Twenty years later' };
  }
  async startReturn(act, carry, name, dflt) {
    const G = this.G;
    // "Play this visit again" with one thing set differently: that default replaces the carry's own
    const S = stateFromCarry(dflt ? Object.assign({}, carry, { default: dflt }) : carry, act, ((this.S && this.S.seed) || 1) + act * 7919);
    S.startCarry = carry; // so this visit can be played again, whichever way it was started
    G.mode = 'cine'; G.S = S; G.texts = [];
    S.name = name || (await G.menus.askName(''));
    this.applyWorld();
    if (!G.settings.comfortDone && (!G.test || params.get('comfort') === '1')) await G.menus.comfort();
    seedRng(S.seed);
    this.ret = new Return(this);
    await this.ret.run('morning');
  }
  // from the ending page: the next visit, across a reload
  nextAct() {
    const S = this.S; const act = (S.act || 1) + 1; if (act > 3) return;
    try { sessionStorage.setItem('mtf.next', JSON.stringify({ act, name: S.name })); } catch (e) { /* the address carries it */ }
    const stored = this.carryFor(act - 1);
    location.hash = 'return=' + act + (stored ? '' : '&v=' + (this.carryCode || ''));
    location.reload();
  }
  finalDay() { return this.ret ? true : this.S.day >= 3; }
  // the day can end at home from five o'clock, except on Tuesday before the town meeting (at six): going to bed then
  // would skip it without a word, so the bed is for a rest until the meeting is over
  bedtime() { const S = this.S; if (this.slice.on || this.finalDay() || S.day < 1 || S.min < 1020) return false; return !(S.day === 2 && !S.flags.councilDone); }
  defaultText(id) { return DEFAULTS[id] ? DEFAULTS[id].t.toLowerCase() : ''; }
  // ten or twenty years on: an accessory, a richer pattern, or nothing (never the faded look)
  async changeAnything() {
    const G = this.G, S = this.S; const years = S.act === 3 ? 'Twenty' : 'Ten';
    const opts = [['keep', 'Keep as I am'], ['glasses', 'Spectacles'], ['scarf', 'A scarf'], ['hat', 'A hat'], ['flower', 'A flower'], ['pattern', 'A richer pattern']];
    const k = await this.choose(opts.map(([id, t]) => ({ t, id: 'age_' + id })), { text: years + ' years on. Change anything?', kind: 'gut' });
    const pick = opts[k][0];
    if (pick === 'pattern') S.look.pattern = S.look.pattern === 'plain' ? 'spots' : S.look.pattern === 'spots' ? 'stripes' : 'belly';
    else if (pick !== 'keep') S.look.wear = pick;
    if (pick !== 'keep') { G.player.setLook(S.look); G.pCache = {}; }
    this.ui.hideDialog();
  }
  // the one thing you set differently last time
  applyDefault() {
    const G = this.G, S = this.S; const d = S.carryDefault;
    if (d === 'leave_early') { S.energy = clamp(S.energy - 8, 0, S.maxE); }
    if (d === 'text_first') S.mods.homerow = Object.assign(S.mods.homerow || {}, { people: -0.15 });
    if (d === 'rest_first') { G.advance(30); S.energy = clamp(S.energy + 10, 0, S.maxE); S.self = clamp(S.self + 2, 0, 100); this.ui.toast('You start with half an hour on a bench that fits. Nobody needs anything from you yet.', '', 4200); }
  }
  // the visit's days; a save is written before each morning, so Continue replays that morning exactly
  async days(first, phase) {
    for (let d = first; d <= 3; d++) {
      // the first day of a new game is its own story (slice.js), with its own evening
      if (d === 1 && this.S.v2) { await this.slice.day(d === first ? phase : 'morning'); continue; }
      if (d === first && phase !== 'morning') this.resumeDay(phase);
      else { this.saveNow('morning', d); await this.morning(d); }
      await new Promise((r) => { this.endDay = r; this.G.mode = 'play'; this.G.busy = 0; });
      if (d < 3) await this.night(d);
    }
    this.saveNow('end', 3);
    await this.ending();
  }
  saveNow(phase, day) {
    const G = this.G, S = this.S;
    S.texts = G.texts.slice(-40);
    const label = phaseLabel(phase, day, S.act || 1, Math.round(S.min));
    const meta = { act: S.act || 1, day, phase, label, build: BUILD };
    const r = SAVE.writeSave(meta, S);
    G.lastSaveObj = r.save || { v: SAVE.SAVE_V, build: BUILD, act: meta.act, day, phase, label, savedAt: new Date().toISOString(), S: SAVE.snapshot(S).data };
    G.lastSaveMeta = { ok: r.ok, label, phase, error: r.error || null };
    if (!r.ok && r.error !== 'invalid' && !this.warnedSave) { this.warnedSave = true; this.ui.toast('This browser isn\'t keeping saves. Your save code is in the Menu, if you want to pick up later.', '', 6000); }
    if (!r.ok && r.error === 'invalid') console.warn('save refused', r.why);
    return r.ok;
  }
  // Saving you never have to think about: whenever play is calm (walking around, nothing open, no scene running), at
  // most every 40 seconds, soon after a conversation or a card ends, when you open the menu, and when the page is
  // hidden or closed. Continue then brings you back to that minute, where you stood (outside, if you were indoors).
  // Not during the prologue, between days, on the walk to the festival or at the festival itself: those replay from
  // the last calm moment before them.
  canAutosave() {
    const G = this.G, S = this.S;
    if (params.get('autosave') === '0') return false;
    if (G.mode !== 'play' || G.busy || G.ui.waiter || !G.ui.panel.hidden || G.mgActive || (G.menus && G.menus.open)) return false;
    if (!this.endDay || this.inPrologue || G.beaWay || G.busRide) return false;
    if ((S.day || 0) < 1 || S.flags.decided || S.flags.festival || S.flags.council && !S.flags.councilDone) return false;
    return true;
  }
  autosave(force) {
    if (!this.canAutosave()) return false;
    const t = now(); if (!force && t < (this.autoAt || 0)) return false;
    this.autoAt = t + 40000; this.savedAt = t;
    const G = this.G, S = this.S; const p = G.player.root.position;
    S.resumeAt = { loc: G.loc, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, h: Math.round((G.player.heading || 0) * 100) / 100 };
    const ok = this.saveNow('free', S.day);
    // once per device: say that it saves by itself
    // (shown at a calm moment, so it never sits on top of a card or a conversation)
    if (ok && !G.settings.savedTip && !FAST && !this.tipWait) {
      this.tipWait = true;
      const tip = (n) => setTimeout(() => {
        const calm = G.mode === 'play' && !G.busy && !G.ui.waiter && G.ui.panel.hidden && !G.mgActive && !G.phoneOpen;
        if (calm) { G.settings.savedTip = true; G.saveSettings(); this.ui.toast('<b>Saved.</b> The game saves as you play. Close it any time: Continue picks up where you were.', 'good', 6500); this.tipWait = false; }
        else if (n < 40) tip(n + 1); else this.tipWait = false;
      }, n ? 1500 : 600);
      tip(0);
    }
    return ok;
  }
  // a conversation or a card just ended: save at the next calm moment (but not more than every 15 seconds)
  autoSoon() { const t = now(); this.autoAt = Math.min(this.autoAt || 0, Math.max(t + 1500, (this.savedAt || 0) + 15000)); }
  // a save from storage or a code: rebuild the state, then everything in the world that the state implies
  async resumeFrom(save) {
    const G = this.G; let S; G.mode = 'cine';
    try { S = SAVE.restoreState(save, SIM.newState); } catch (e) { console.error(e); this.ui.toast('That save could not be opened.'); return null; }
    this.sanitize(S);
    G.S = S;
    if (!S.name || !('name' in save.S)) S.name = await G.menus.askName(S.name);
    G.texts = (S.texts || []).filter((x) => Array.isArray(x) && x.length === 2).map((x) => [String(x[0]), String(x[1])]);
    this.applyWorld();
    return { day: save.day, phase: save.phase };
  }
  // ids from a code that the game doesn't know are dropped, so nothing downstream looks them up
  sanitize(S) {
    for (const k of Object.keys(S.fixes || {})) if (!SIM.FIXES[k]) delete S.fixes[k];
    for (const k of Object.keys(S.support || {})) if (!SIM.FIXES[k]) delete S.support[k]; else S.support[k] = (S.support[k] || []).filter((id) => CAST[id]);
    for (const k of Object.keys(S.lantern.entries || {})) if (!HINTS[k]) delete S.lantern.entries[k];
    for (const k of Object.keys(S.lantern.learned || {})) if (!CAST[k]) delete S.lantern.learned[k];
    for (const m of [S.bonds, S.gw, S.met, S.talked, S.know, S.revealed, S.owe, S.lg]) if (m && typeof m === 'object') for (const k of Object.keys(m)) if (!CAST[k]) delete m[k];
    S.lanternsMade = (S.lanternsMade || []).filter((m) => m && CAST[m.id]);
    S.hearsay = (S.hearsay || []).filter((id) => LIKED[id]);
    S.jar = (S.jar || []).filter((j) => j && typeof j.t === 'string').slice(0, 12);
  }
  applyWorld() {
    const G = this.G, S = this.S;
    G.player.setLook(S.look); for (const k of ['headphones', 'shades']) G.player.setGear(k, !!(S.wearing && S.wearing[k]));
    for (const k of Object.keys(S.fixes)) if (S.fixes[k] === 'built') G.applyFix(k);
    const home = G.rooms.home, P = S.profile;
    home.setLight(P.light); home.setSign(1 - P.people); home.setCalendar(P.change);
    home.objs.clock.group.rotation.y = (P.time - 0.5) * 0.6; home.objs.note.group.rotation.y = 0.2 + P.talk * 0.6;
    if (home.setJar) home.setJar(S.jar || []);
    home.setLantern(S.day >= 1 && !S.flags.lantern);
    if (S.w && S.w.standard_solved && G.town.setPlaque) G.town.setPlaque(true);
    this.revealQ = Object.keys(S.revealed || {}).filter((k) => S.revealed[k] === 'pending');
    if (S.look0) S.portrait0 = G.portraitOf(S.look0, {});
    G.player.root.visible = true;
  }
  // picking up in the middle of a day, in free play: where you stood (in your room, if you were home; outside the
  // door, if you were in the Works or the Hall), or outside the building a checkpoint was taken in
  resumeDay(phase) {
    const G = this.G, S = this.S; const at = phase === 'free' ? S.resumeAt : null;
    if (at && at.loc === 'home') {
      // home is yours: you wake up in it, so the windowsill lantern and the walk out with Bea are still ahead of you
      G.setLoc('home'); G.place(G.rooms.home.spawn); G.player.heading = 0;
      const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true);
      G.audio.setScene('home');
    } else {
      G.setLoc('town');
      const spot = at && at.loc === 'town' && Number.isFinite(at.x) && Number.isFinite(at.z) ? this.standNear(at.x, at.z) : null;
      if (spot) { G.place(spot); G.player.heading = Number.isFinite(at.h) ? at.h : 0; }
      else if (at && DOOR[at.loc]) { G.place(DOOR[at.loc]); G.player.heading = 0; }
      else { G.place(phase === 'shift' ? [12, 13.9] : [32, 14.4]); G.player.heading = 0; }
      G.stage.follow(G.player.root.position, G.followOpts({ snap: true }));
      G.audio.setScene('town');
    }
    this.ui.hud(true); this.ui.letterbox(false);
    G.stage.fadeTo(0, 600);
    this.ui.toast('Welcome back. ' + (phase === 'free' ? phaseLabel('free', S.day, S.act || 1, Math.round(S.min)) + '.' : phase === 'shift' ? 'Your shift is done for today.' : 'The meeting is over.'), '', 3600);
  }
  // the nearest spot within three metres where you can stand (a save made mid-step can sit on an edge)
  standNear(x, z) {
    const G = this.G; if (G.canStand(x, z)) return [x, z];
    for (let r = 0.25; r <= 3; r += 0.25) for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; const px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r; if (G.canStand(px, pz)) return [px, pz]; }
    return null;
  }
  finishDay(why) { if (this.endDay) { const r = this.endDay; this.endDay = null; this.G.mode = 'cine'; this.dayEndWhy = why; r(); } }

  // ---------- small verbs ----------
  async say(who, t, o = {}) {
    const G = this.G;
    if (t && t.includes('{rueStreak}')) t = t.replace('{rueStreak}', WORDS(411 + (this.S.day || 1)).replace(/ /g, '-'));
    if (who && who !== 'you' && CAST[who]) G.faceTalk(who);
    const voice = (txt) => { const v = who === 'you' ? [this.S.look.voice, 1] : CAST[who] ? CAST[who].voice : null; if (v) G.audio.voice(v[0], v[1] * (who === 'you' ? 1 - 0.2 * G.drift() : 1), txt, { flat: who === 'you' && G.drift() > 0.6 }); };
    await this.ui.line({ who, kind: o.kind || 'say', text: t, voice: who ? voice : null, extra: o.extra });
    if (who && CAST[who]) this.S.met[who] = true;
  }
  async gut(t) { await this.ui.line({ kind: 'gut', text: t }); }
  async note(t) { await this.ui.line({ kind: 'note', text: t }); }
  choose(opts, o) { return this.ui.choose(opts, o); }
  // a text message: residents' texts pop up; Blend's pings only land on your creature (it glances at its phone) and
  // the unread dot, with no sound, so the pull shows on the creature rather than being worked on you
  text(from, t, silent) {
    this.G.texts.push([from, t]); if (silent) return;
    if (from === 'Blend') { if (this.G.player.once) this.G.player.once('glance'); this.ui.ping(true); return; }
    this.ui.toast(`<b>${from}</b><br>${t}`, ''); this.G.audio.sfx('notify'); this.ui.ping(true);
  }

  // ---------- conditions and effects ----------
  cond(str, ctx = {}) {
    if (!str) return true;
    let groups; try { groups = parseCond(str); } catch (e) { console.warn(e.message); return false; }
    return groups.every((alts) => alts.some((t) => this.term(t, ctx)));
  }
  term(t, ctx) {
    const S = this.S, m = t.m; let v;
    switch (t.name) {
      case 'blend': v = S.blend.has && !S.blend.deleted; break;
      case 'smooth': v = S.blend.has && S.blend.smooth; break;
      case 'wheels': v = S.wheels; break;
      case 'late': v = S.min >= 840; break;
      case 'plain': v = S.profile.talk < 0.4; break;
      case 'flag': v = !!S.flags[m[1]]; break;
      case 'met': v = !!S.met[m[1]]; break;
      case 'sens': v = sens(S, m[1]); break;
      case 'gear': v = !!S.gear[m[1]]; break;
      case 'fix': { const st = SIM.fixState(S, m[1]); v = m[2] === '=' ? st === m[3] : st !== m[3]; break; }
      case 'hint': { const e = S.lantern.entries[m[1]]; v = !!e && (e.result || e.pending) === m[2]; break; }
      case 'num': v = compare(m[1] === 'dep' ? (S.blend.dep || 0) : S[m[1]], m[2], +m[3]); break;
      case 'bond': v = compare(S.bonds[m[1]] || 0, m[2], +m[3]); break;
      case 'gw': v = compare((S.gw || {})[m[1]] || 0, m[2], +m[3]); break;
      case 'act': v = compare(S.act || 1, m[1], +m[2]); break;
      case 'w': v = !!(S.w || {})[m[1]]; break;
      case 'know': v = !!((S.know || {})[m[1]] || {})[m[2]]; break;
      case 'stake': v = ((S.stakes || {})[m[1]] || 'unasked') === m[2]; break;
      case 'rue': v = (S.rue || 'streak') === m[1]; break;
      case 'sight': v = !!(S.sights || {})[m[1]]; break;
      case 'told': v = ((S.ideaFrom || {})[m[1]] || []).includes(m[2]); break;
      case 'shift': case 'meetingday': case 'festivalday': v = this.role ? this.role(t.name) : false; break;
      default: v = false;
    }
    return t.neg ? !v : v;
  }
  // every change to a bond goes through here; a warmer bond also earns goodwill (capped at 3), unless the
  // scene says otherwise (backing a fix is its own reward, so back scripts pass { gw: false })
  addBond(id, n, o = {}) {
    const S = this.S; S.bonds[id] = (S.bonds[id] || 0) + n;
    if (n > 0 && o.gw !== false) { S.gw = S.gw || {}; S.gw[id] = Math.min(3, (S.gw[id] || 0) + n); }
  }
  async effect(e, ctx = {}) {
    const S = this.S, G = this.G; const p = parseEffect(e); if (!p) { console.warn('unknown effect', e); return; }
    const m = p.m;
    switch (p.name) {
      case 'bond': this.addBond(m[1], +m[2], { gw: !ctx.back }); break;
      case 'gw': { S.gw = S.gw || {}; S.gw[m[1]] = clamp((S.gw[m[1]] || 0) + +m[2], 0, 3); break; }
      case 'stat': if (m[1] === 'dep') S.blend.dep = clamp((S.blend.dep || 0) + +m[2], 0, 9); else { S[m[1]] = clamp(S[m[1]] + +m[2], 0, m[1] === 'coins' ? 9999 : m[1] === 'spot' ? 1 : m[1] === 'energy' ? S.maxE : 100); if (m[1] === 'coins' && +m[2] > 0) G.audio.sfx('coin'); } break;
      case 'flag': S.flags[m[1]] = true; break;
      case 'unflag': delete S.flags[m[1]]; break;
      case 'w': S.w = S.w || {}; S.w[m[1]] = 1; break;
      case 'idea': this.addIdea(m[1], ctx.npc); break;
      case 'back': this.addBacker(m[1], ctx.npc); break;
      case 'know': this.know(m[1], m[2]); break;
      case 'note': this.fieldNote(m[1]); break;
      case 'gear': S.gear[m[1]] = true; G.onGear(m[1]); break;
      case 'install': G.installBlend(); break;
      case 'score': S.blend.score = Math.max(0, S.blend.score + +m[1]); break;
      case 'time': G.advance(+m[1]); break;
      case 'stake': S.stakes = S.stakes || {}; S.stakes[m[1]] = m[2]; break;
      case 'keep': this.keep(m[1]); break;
      default: console.warn('unhandled effect', e);
    }
  }
  addIdea(id, from) {
    const S = this.S; S.flags.idea_any = true;
    // who told you about it: they back it without being asked for goodwill
    if (from && CAST[from]) { S.ideaFrom = S.ideaFrom || {}; const a = S.ideaFrom[id] = S.ideaFrom[id] || []; if (!a.includes(from)) a.push(from); }
    if (SIM.fixState(S, id) !== 'none') return;
    S.fixes[id] = 'idea';
    this.ui.toast(`<b>Noted for the Fix-It Shed</b><br>${SIM.FIXES[id].name}`, 'idea'); this.G.audio.sfx('ink');
    this.fieldNote('social');
  }
  // for automated tests: run any task on its own
  testGame(name, arg) { const map = { sort: SortGame, stamp: StampGame, blueprint: Blueprint, plain: PlainNote, pond: PondGame, paint: PaintGame, teach: TeachUnit, mail: FestivalMail }; const g = name === 'blueprint' ? new Blueprint(this.G, arg || 'quiet') : new map[name](this.G); this.G.run(() => g.run()); return true; }
  // ---------- knowing people ----------
  know(id, slot) {
    const S = this.S; if (!PEOPLE[id]) return; S.know = S.know || {}; const k = S.know[id] = S.know[id] || {};
    if (k[slot]) return; k[slot] = S.day || 1;
    const label = slot === 'love' ? 'Something they love' : SLOT_LABEL[slot];
    this.ui.toast(`<span class="lanticon">✦</span><b>${CAST[id].name}</b> · ${label}<br><span class="tsub">${PEOPLE[id][slot]}</span>`, 'lantern', 4200); this.G.audio.sfx('ink'); this.ui.ping(true);
    if (this.known(id) >= 3 && !(S.revealed || {})[id]) { S.revealed = S.revealed || {}; S.revealed[id] = 'pending'; (this.revealQ = this.revealQ || []).push(id); }
  }
  known(id) { const k = (this.S.know || {})[id] || {}; return ['over', 'under', 'no', 'helps'].filter((x) => k[x]).length; }
  async flushReveals() {
    const S = this.S; const q = this.revealQ || []; this.revealQ = []; S.revealed = S.revealed || {};
    for (const id of q) {
      const first = !Object.values(S.revealed || {}).includes('seen');
      S.revealed[id] = 'seen';
      await this.ui.postcard({ img: this.G.portraitOf(CAST[id].look, { bg: '#f3e6cf' }), name: CAST[id].name, text: PEOPLE[id].reveal, first });
      this.keep('reveal_' + id, CAST[id].name + ' adjusts too', CAST[id].look.color);
      if (id === 'bea') this.fieldNote('listening');
    }
  }
  // Field notes unlock quietly, after the thing they describe has happened to you: a dot on the Notebook, and the
  // evening page counts them. The autism section is never triggered by a moment; it opens whole on the first night.
  fieldNote(id) {
    const S = this.S; S.notes = S.notes || {}; if (S.notes[id]) return;
    const n = FIELD_NOTES.find((x) => x.id === id); if (!n || n.act > (S.act || 1) || n.section === 'autism') return;
    S.notes[id] = S.day || 1; S.notesNew = (S.notesNew || 0) + 1;
    if (this.G.mode !== 'title' && S.day > 0) this.ui.ping(true);
  }
  openAutism() {
    const S = this.S; S.notes = S.notes || {}; if (S.flags.autismOpen) return; S.flags.autismOpen = 1;
    for (const n of FIELD_NOTES) if (n.section === 'autism' && n.act <= (S.act || 1) && !S.notes[n.id]) { S.notes[n.id] = S.day || 1; S.notesNew = (S.notesNew || 0) + 1; }
  }
  // after a first conversation: how do you think that went? (the answer you overhear later is usually warmer)
  async likingGap(id) {
    const S = this.S; S.lg = S.lg || {}; S.hearsay = S.hearsay || [];
    if (S.lg[id] != null || !LIKED[id]) return;
    if (Object.keys(S.lg).length < 3) {
      const k = await this.choose([{ t: 'A bit awkward' }, { t: 'Fine, I think' }, { t: 'Good' }], { text: 'How do you think that went with ' + CAST[id].name + '?', kind: 'gut' });
      S.lg[id] = k;
    } else S.lg[id] = -1;
    S.hearsay.push(id);
  }
  addBacker(id, npc) {
    const S = this.S; if (!npc) return; S.support[id] = S.support[id] || [];
    if (!S.support[id].includes(npc)) S.support[id].push(npc);
    if (S.support[id].length >= 2 && SIM.fixState(S, id) === 'proposal') {
      S.fixes[id] = 'ready';
      const F = SIM.FIXES[id];
      const after = this.S.day >= 3 || this.S.flags.councilDone;
      this.ui.toast(`<b>${F.name}</b><br>${this.ret ? (this.S.flags.councilDone ? 'Enough backers. It goes on file for next year.' : 'Enough backers. It goes to tonight\'s meeting at six.') : F.approve === 'gil' ? (after ? 'Enough backers. Gil can still sign it off.' : 'Enough backers. Gil can approve it, or it can go to the town meeting.') : (this.S.day === 1 ? 'Enough backers. It goes to the town meeting on Tuesday at six.' : this.S.day === 2 && !this.S.flags.councilDone ? 'Enough backers. It goes to the town meeting tonight at six.' : 'Enough backers. It goes on file for next season\'s meeting.')}`, 'good'); this.G.audio.sfx('sign');
    } else { this.ui.toast(`<b>${CAST[npc].name} is backing it</b><br>${SIM.FIXES[id].name}`, 'good'); this.G.audio.sfx('sign'); }
  }

  // ---------- the script interpreter ----------
  async run(nodes, ctx = {}) {
    if (!nodes) return;
    const labels = {}; nodes.forEach((n, i) => { if (n.label) labels[n.label] = i; });
    let i = 0, guard = 0;
    while (i < nodes.length && guard++ < 400) {
      const n = nodes[i];
      if (n.label) { i++; continue; }
      if (n.if !== undefined && !n.who && !n.ask) { if (this.cond(n.if, ctx)) { if (n.end) return; if (n.go) { i = labels[n.go] ?? nodes.length; continue; } } i++; continue; }
      if (n.go) { i = labels[n.go] ?? nodes.length; continue; }
      if (n.end) return;
      if (n.face) { this.G.setFace(n.who || ctx.npc, n.face); if (n.t) await this.say(n.who, n.t); }
      else if (n.who) { await this.say(n.who, n.t); }
      else if (n.gut) await this.gut(n.gut);
      else if (n.note) await this.note(n.note);
      else if (n.notice) {
        const zt = NOTICE[n.zone] && NOTICE[n.zone][n.notice];
        if (sens(this.S, n.notice) && zt) { await this.ui.line({ kind: 'notice', label: DIM_LABEL[n.notice], text: zt }); if (n.do) for (const e of n.do) await this.effect(e, ctx); }
      }
      else if (n.hint) await this.hint(n.hint, ctx);
      else if (n.face) this.G.setFace(n.who || ctx.npc, n.face);
      else if (n.call) await this.call(n.call, ctx);
      else if (n.ask) {
        const blendOn = this.cond('blend');
        const opts = n.ask.filter((o) => !o.if || this.cond(o.if, ctx)).map((o) => Object.assign({}, o, { blend: blendOn && o.blend }));
        const k = await this.choose(opts.map((o) => ({ t: o.t, sub: o.sub, tag: o.tag, blend: o.blend, id: o.id })));
        const o = opts[k];
        if (o.blend) this.saidBlend(o);
        if (o.do) for (const e of o.do) await this.effect(e, ctx);
        if (o.go) { i = labels[o.go] ?? nodes.length; continue; }
      }
      else if (n.do) for (const e of n.do) await this.effect(e, ctx);
      i++;
    }
  }
  // Blend's own line, in Blend's voice: a few points, a little of your colour, and every second one makes the app
  // a little more of a habit. It goes in the log with Blend as the one who decided what you said.
  saidBlend(o) {
    const S = this.S, B = S.blend;
    B.score += 5; B.usedToday = true; B.said = (B.said || 0) + 1; if (B.said % 2 === 0) B.dep = clamp((B.dep || 0) + 1, 0, 9);
    S.self = clamp(S.self - 1.5, 0, 100);
    this.ui.toast('+5 points', 'blend', 1600);
    this.log('default', { v: 'said', by: 'blend', pay: ['you'], line: o.t });
    this.fieldNote('nudges');
  }
  async call(name, ctx) {
    if (this.ret && this.ret.A.call && (await this.ret.A.call(this.ret, name, ctx))) return;
    if (name === 'shop') { this.ui.hideDialog(); await this.ui.shop(this.S); }
    else if (name === 'fold') {
      this.ui.hideDialog(); await this.ui.fold(); this.S.flags.folded = true;
      // on Tuesday afternoon the folding takes a while: it is one of the things there isn't time for all of
      if (this.S.day === 2 && !this.S.flags.foldHour) { this.S.flags.foldHour = 1; await this.G.stage.fadeTo(1, 500); this.G.advance(60); await this.note('An hour goes by, folding along the line. Wren hums at the creases.'); this.ui.hideDialog(); await this.G.stage.fadeTo(0, 500); }
    }
    else if (name === 'proposals') await this.proposals();
    else if (name === 'archive') await this.run(TALK.clover.archive, ctx);
    else if (name === 'paint') { if (!this.S.flags.painted) { this.S.flags.painted = 1; this.ui.hideDialog(); this.ui.letterbox(false); await new PaintGame(this.G).run(); this.ui.letterbox(true); } }
  }
  async hint(id, ctx) {
    const H = HINTS[id], S = this.S;
    const learned = S.lantern.learned[H.by];
    const tr = learned && !(S.lantern.off || {})[H.by] && this.G.settings.lanternVoice !== false;
    await this.say(H.by, H.t, { kind: 'hint', extra: tr ? `<div class="lantern">Lantern: "${H.truth === 'literal' ? H.literal : H.between}"</div>` : '' });
    const t = S.profile.talk;
    const read = t < 0.38 ? 'literal' : t > 0.62 ? 'between' : null;
    await this.gut(read === 'literal' ? 'Take the words as they come: "' + H.literal + '"' : read === 'between' ? 'Translation: "' + H.between + '"' : pick(['It could mean two different things. You are not sure which.', 'Two ways to hear that. You can\'t tell which one they meant.', 'You turn it over. It could go either way.']));
    const opts = [{ t: 'Take it at face value', sub: H.literal }, { t: 'Read between the lines', sub: H.between }, { t: 'Ask what they mean', sub: 'a little awkward' }];
    const k = await this.choose(opts);
    const reading = ['literal', 'between', 'asked'][k];
    const result = reading === 'asked' ? 'asked' : reading === H.truth ? 'right' : 'wrong';
    S.lantern.entries[id] = { reading: opts[k].t, pending: result, result: null, day: S.day, by: H.by };
    // asking plainly is a small kindness both ways: it warms things up, and nobody minds
    if (reading === 'asked') { await this.say(H.by, H.asked.replace(/^"|"$/g, '')); S.lantern.entries[id].result = 'asked'; this.addBond(H.by, 1); this.learn(H.by); this.know(H.by, 'no'); this.fieldNote('ask'); }
    else if (id === 'comein' || id === 'busy' || id === 'advisement' || id === 'advisement_gil' || id === 'moss_leave') { this.resolveHint(id, true); }
  }
  resolveHint(id, now) {
    const S = this.S, e = S.lantern.entries[id], H = HINTS[id]; if (!e || e.result) return;
    e.result = e.pending;
    if (e.result === 'right') this.addBond(H.by, 1);
    if (now) this.ui.toast(e.result === 'right' ? H.right : H.wrong, e.result === 'right' ? 'good' : '', 5200);
    else this.text('Lantern', e.result === 'right' ? H.right : H.wrong, true);
    if (e.result === 'right') { this.learn(H.by); this.know(H.by, 'no'); }
  }
  learn(who) {
    const S = this.S; const n = Object.values(S.lantern.entries).filter((e) => e.by === who && (e.result === 'right' || e.result === 'asked')).length;
    if (n >= 2 && !S.lantern.learned[who]) { S.lantern.learned[who] = true; this.ui.toast(`<b>Lantern learned how ${CAST[who].name} talks</b><br>It will quietly translate from now on. You can turn that off on ${CAST[who].name}'s page.`, 'idea', 5000); }
  }

  // ---------- the title and the prologue ----------
  async titleScreen(o = {}) {
    const G = this.G; const keepMin = G.S.min;
    G.setLoc('town'); G.mode = 'title';
    G.stage.orbit(new THREE.Vector3(30, 2, 24), 36, 17, 0.03, true);
    G.S.min = 18.4 * 60; G.player.root.visible = false;
    const pick = await this.ui.title({ save: o.save, storage: G.storage, ret: o.ret });
    // leave the title's evening behind: the world clock is pinned at dusk only while the title shows
    G.mode = 'cine'; G.S.min = keepMin;
    G.audio.unlock(); G.audio.setScene('title');
    return pick;
  }
  // from = 'setup': the creature was made last time (it was saved then), so this starts at the room
  async prologue(from) {
    if (this.S.v2) return this.slice.prologue(from);
    const G = this.G, S = this.S, ui = this.ui; const made = from === 'setup';
    G.mode = 'cine'; ui.letterbox(true); this.inPrologue = true;
    S.min = 17.2 * 60;
    if (!made) {
      G.stage.shot(new THREE.Vector3(66, 9, 70), new THREE.Vector3(57, 1.5, 30), 34, 0.6, true);
      G.busRide = true;
      await ui.caption(PROLOGUE.bus[0], 3000);
      G.stage.shot(new THREE.Vector3(36, 6.5, 33), new THREE.Vector3(30, 3.0, 24), 30, 0.5);
      await ui.caption(PROLOGUE.bus[1], 2800);
      await ui.caption(PROLOGUE.bus[2], 3200);
      G.busRide = false;
      G.stage.shot(new THREE.Vector3(14, 6, 46), new THREE.Vector3(9.5, 1.5, 35), 34, 0.8);
      await ui.caption(PROLOGUE.arrive, 2400);
    }
    this.inPrologue = false; this.skipIntro = false;
    await G.stage.fadeTo(1, 700);
    G.setLoc('home'); G.player.root.visible = true; G.place([0.6, 0.2]); G.player.heading = 0.25;
    G.audio.setScene('home');
    G.stage.shot(new THREE.Vector3(1.6, 1.55, 4.1), new THREE.Vector3(0.45, 0.62, 0.1), 34, 3, true);
    if (window.innerWidth > 760) G.stage.offsetX(Math.min(220, window.innerWidth * 0.17)); else G.stage.offsetX(0, Math.round(window.innerHeight * 0.24));
    await G.stage.fadeTo(0, 700);
    ui.letterbox(false);
    if (!made) {
      await ui.caption(PROLOGUE.room, 2200);
      // the mirror: make yourself
      G.mode = 'creator';
      G.player.heading = 0.6;
      G.posePreview = true; if (!S.look.comfort) S.look.comfort = 'hum';
      const look = await ui.creator(S.look, (L, k) => { S.look = L; S.wheels = !!L.wheels; G.player.setLook(L); if (k === 'comfort' || k === 'all') G.player.previewComfort(L.comfort || 'hum'); else G.player.hop(); if (k === 'voice') G.audio.voice(L.voice, 1, 'hello hello'); });
      G.posePreview = false; G.player.setComfort(look.comfort || 'hum', 0);
      S.look = look; S.wheels = !!look.wheels; S.look0 = Object.assign({}, look);
      G.player.setLook(look);
      S.portrait0 = G.portrait();
      // the creature you made is kept even if you stop here
      this.saveNow('setup', 0);
    } else { G.player.setLook(S.look); G.player.setComfort(S.look.comfort || 'hum', 0); if (!S.portrait0) S.portrait0 = G.portrait(); }
    G.stage.offsetX(0, 0);
    // the room: make it yours
    G.mode = 'cine';
    await ui.caption(PROLOGUE.setup, 2400);
    G.place([1.6, 1.6]);
    const home = G.rooms.home; const keys = ['lamp', 'radio', 'sign', 'note', 'clock', 'calendar'];
    const focus = { lamp: [-0.4, 1.2, -2.35], radio: [2.9, 1.8, -2.75], sign: [-3.86, 1.45, 1.6], note: [0.75, 0.9, -2.35], clock: [-1.4, 0.85, -2.45], calendar: [-1.2, 1.9, -2.97] };
    for (let i = 0; i < keys.length;) {
      const k = keys[i]; const f = focus[k]; const spec = SETUP[k];
      const cp = k === 'sign' ? new THREE.Vector3(-1.2, 2.0, 2.4) : new THREE.Vector3(f[0] + 0.9, f[1] + 0.7, f[2] + 2.6);
      G.stage.shot(cp, new THREE.Vector3(f[0], f[1], f[2]), 36, 2.4);
      G.player.faceToward(f[0], f[2]);
      const v = await ui.setupStep(k, S.profile[spec.dim], i, keys.length, (val) => {
        const pv = spec.invert ? 1 - val : val; S.profile[spec.dim] = pv;
        if (k === 'lamp') home.setLight(val);
        if (k === 'radio') G.audio.vol.music = 0.25 + val * 0.75, G.audio.applyVolumes();
        if (k === 'sign') home.setSign(val);
        if (k === 'calendar') home.setCalendar(val);
        if (k === 'clock') home.objs.clock.group.rotation.y = (val - 0.5) * 0.6;
        if (k === 'note') home.objs.note.group.rotation.y = 0.2 + val * 0.6;
      });
      if (v && v.back) { i = Math.max(0, i - 1); continue; }
      S.profile[spec.dim] = spec.invert ? 1 - v : v;
      i++;
    }
    G.audio.vol.music = 0.7; G.audio.applyVolumes();
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 1.5); }
    G.walkTo(0.3, 0.6);
    await sleep(900);
    await this.note(PROLOGUE.done);
    await this.gut(PROLOGUE.doneGut);
    this.ui.hideDialog();
    S.tf0 = SIM.townFit(S.fixes, S.stakes).all;
    // the evening texts
    for (const [w, t] of TEXTS.arrival) { this.text(w, t); await sleep(1300); }
    await sleep(800);
    await G.stage.fadeTo(1, 900);
    await ui.caption('Night falls on Home Row.', 1600);
  }

  // ---------- days ----------
  async morning(d) {
    const G = this.G, S = this.S;
    S.day = d; S.min = SIM.wakeMin(S); seedRng((S.seed * 31 + d * 7919 + (S.act || 1) * 104729) >>> 0);
    const dflt = S.carryDefault;
    if (dflt === 'leave_early') { S.min -= 20; S.energy = clamp(S.energy - 8, 0, S.maxE); }
    if (dflt === 'text_first') { S.mods.homerow = Object.assign(S.mods.homerow || {}, { people: -0.15 }); }
    if (dflt === 'headphones_market') S.gear.headphones = true;
    if (dflt === 'blend_off' && d === 1 && !S.blend.has) { S.blend.deleted = true; }
    G.setLoc('home'); G.place(G.rooms.home.spots.center); G.player.heading = -0.9;
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
    S.dayStats = Object.assign({}, S.stats); S.metAt0 = Object.keys(S.met); S.fixAt0 = Object.assign({}, S.fixes);
    // whatever was approved yesterday went up overnight; today shows it in use rather than announcing it
    const upNow = [];
    for (const k of Object.keys(S.fixes)) if (S.fixes[k] === 'approved' && d <= 3) { S.fixes[k] = 'built'; G.applyFix(k); this.fieldNote('curb'); upNow.push(k); }
    if (S.color) for (const k of upNow) { const z = SIM.FIXES[k].zone; if (S.color[z] != null && S.color[z] < 1) { S.color[z] = 1; S.color.street = Math.min(1, (S.color.street || 0) + 0.15); } }
    S.rue = this.rueState();
    for (const id of Object.keys(S.lantern.entries)) this.resolveHint(id, false);
    G.audio.setScene('home');
    G.rooms.home.setLantern(!S.flags.lantern);
    this.ui.hud(true);
    await G.stage.fadeTo(0, 900);
    await this.ui.caption(['', 'Monday', 'Tuesday', 'Wednesday'][d] + ', ' + fmtTime(S.min), 1800);
    if (S.burnout) { await this.gut('You wake up heavy, like the day started without you. Everything will cost more today.'); this.ui.hideDialog(); }
    if (d === 1) this.text('Gil (work)', 'See you at 9! :)');
    if (d === 2) { this.text('Gil (work)', 'Weekly sync at 9! Should be quick :)'); this.text('Clover', 'Found something in the loft. Come by when you can.'); this.text('Hollis', 'Town meeting tonight at 6, Town Hall. Proposals with two backers get a vote.'); }
    if (d === 3) { this.text('Gil (work)', 'Festival mail 9 to 11, then we close! :)'); this.text('Hollis', 'The Lantern Festival is tonight at 8, in the square!'); }
    if (S.blend.has && !S.blend.deleted) this.text('Blend', pick(BLEND.drop) + (S.blend.streak ? ' Streak: ' + S.blend.streak + ' days!' : ''));
    await sleep(400);
    const card = this.todayCard(d); if (dflt && DEFAULTS[dflt] && dflt !== 'as_is') card.carried = 'You set this last time: ' + DEFAULTS[dflt].t.toLowerCase() + '.';
    await this.ui.today(card);
    if (dflt === 'rest_first') { await this.note('You start the day with half an hour on a bench that fits. Nobody needs anything from you yet.'); this.ui.hideDialog(); G.advance(30); S.energy = clamp(S.energy + 10, 0, S.maxE); S.self = clamp(S.self + 2, 0, 100); }
  }
  todayCard(d) {
    const S = this.S;
    if (d === 1) return { day: 'Monday', title: 'Your first day', items: [{ t: 'Get to the Works by 9:00', sub: 'Bea from next door is heading that way.' }, { t: 'Say hi to your neighbors' }, { t: 'Find the Fix-It Shed', sub: 'In the Commons, past Town Hall.' }], note: 'When a place pinches, you choose who adjusts.' };
    if (d === 2 && S.v2) return { day: 'Tuesday', title: 'A full day', items: [{ t: 'The bus stop, before work', sub: 'Something there changes without a word. Take the lantern.' }, { t: 'Weekly sync at the Works, 9:00' }, { t: 'Clover found something in the loft', sub: 'The Fix-It Shed.' }, { t: 'Town meeting, 6 PM, Town Hall', sub: 'Ideas with two backers get a hearing.' }], note: 'Two more fixes fit in this season\'s budget. Monday\'s were made on the spot.' };
    if (d === 2) { const open = this.openThread(); return { day: 'Tuesday', title: 'A full day', items: [{ t: 'Weekly sync at the Works, 9:00' }, { t: 'Clover found something in the loft', sub: 'The Fix-It Shed.' }, { t: 'Town meeting, 6 PM, Town Hall', sub: 'Proposals with two backers get a vote.' }], note: open ? 'Still open from yesterday: ' + open : 'Listen to people. They tell you what pinches them, if you let them.' }; }
    // Wednesday: the fixes in use first, then Wren's lanterns and the festival
    const items = [];
    for (const f of Object.keys(FELT)) if (S.fixes[f] === 'built' && items.length < 3) items.push({ t: { quiet: 'Noon at the quiet corner', board: 'The bus stop, around four', lanterns: 'Festival programmes up Home Row', ramp: 'The Works door, before eleven', dim: 'The Works, festival morning (9 to 11)', plain: 'The Works, festival morning (9 to 11)' }[f], sub: 'The ' + SIM.FIXES[f].short + ' ' + SIM.agree(f, 'is', 'are') + ' up. See ' + SIM.agree(f, 'it', 'them') + ' in use.' });
    if (!S.flags.statue_seen) items.push({ t: 'Clover found something in the loft', sub: 'The Fix-It Shed.' });
    items.push({ t: 'Wren needs three lanterns painted', sub: 'The Far End.' }, { t: 'The Lantern Festival, 8 PM', sub: 'Market Square.' });
    return { day: 'Wednesday', title: 'Festival day', items, note: S.burnout ? 'You woke up running on less. Places will cost more today.' : '' };
  }
  // the one unfinished thing worth coming back to (an open loop, not a streak)
  openThread() {
    const S = this.S;
    for (const f of Object.keys(SIM.FIXES)) {
      const st = SIM.fixState(S, f); const F = SIM.FIXES[f];
      if (st === 'idea') return 'your idea for the ' + F.short + ' is waiting for Clover at the Fix-It Shed.';
      if (st === 'proposal' && (!S.flags.councilDone || F.approve === 'gil')) { const need = F.backers.filter((b) => !(S.support[f] || []).includes(b)); return 'the ' + F.short + ' ' + SIM.agree(f, 'needs', 'need') + ' ' + (2 - SIM.supporters(S, f)) + ' more backer' + (2 - SIM.supporters(S, f) > 1 ? 's' : '') + '. Try ' + NAMES(need) + '.'; }
      if (st === 'ready' && F.approve === 'gil' && !S.flags['gilasked_' + f]) return 'the ' + F.short + ' ' + SIM.agree(f, 'has its', 'have their') + ' backers. Show Gil at the Works.';
    }
    return '';
  }
  // a moment worth keeping goes in the jar on your shelf; the jar has a top
  keep(id, text, color) {
    const S = this.S; S.jar = S.jar || []; S.kept = S.kept || {};
    if (S.kept[id]) return; S.kept[id] = 1;
    const T2 = { blend_gone: ['You deleted Blend', '#9edcd6'] };
    const [t, c] = text ? [text, color || '#ffcf7a'] : T2[id] || [id, '#ffcf7a'];
    if (S.jar.length >= 12) { S.flags.jarFull = 1; return; }
    S.jar.push({ t, c }); this.G.audio.sfx('jar');
    const first = !S.flags.jarTold; S.flags.jarTold = 1;
    this.ui.toast(`<span class="jaricon"></span><b>${first ? 'Kept, in the jar on your shelf:' : 'Kept:'}</b> ${t}`, 'keep', first ? 4600 : 2600);
    if (S.jar.length === 12) { S.flags.jarFull = 1; setTimeout(() => this.ui.toast('Your jar is full.', 'idea', 4800), 900); this.fieldNote('glp1'); }
    if (this.G.rooms.home.setJar) this.G.rooms.home.setJar(S.jar);
  }
  onOutside(from) {
    const G = this.G, S = this.S;
    if (this.ret) { if (this.ret.A.onOutside) this.ret.A.onOutside(this.ret, from); return; }
    if (from === 'home' && S.day === 1 && !S.flags.shift1 && !S.flags.escort && S.min < 560) G.run2(() => escortBea(G));
  }
  nearestOf(ids) {
    const G = this.G; const p = G.player.root.position; let best = null, bd = 1e9;
    for (const id of ids) { const n = G.npcs[id]; if (!n || n.place !== 'town') continue; const q = n.c.root.position; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = { id, at: [q.x, q.z + 0.9] }; } }
    return best;
  }
  needBackers() {
    const S = this.S; const out = [];
    for (const f of Object.keys(SIM.FIXES)) if (SIM.fixState(S, f) === 'proposal') for (const b of SIM.FIXES[f].backers) if (!(S.support[f] || []).includes(b)) out.push([f, b]);
    return out;
  }
  objective() {
    if (this.ret) return this.ret.objective();
    if (this.slice.on) return this.slice.objective();
    const S = this.S, d = S.day, m = S.min;
    if (d === 0) return ob('Make yourself at home.');
    if (S.flags.festival) return S.flags.released ? ob('') : ob('Enjoy the festival. When you are ready, release your lantern at the statue.', T.statue, 'The statue');
    if (m >= 1260) return ob('It is getting late. Head home.', T.home, 'Home', { inside: 'home', spot: 'bed', spotLabel: 'Bed' });
    const backers = () => { const nb = this.needBackers(); if (!nb.length) return null; const near = this.nearestOf([...new Set(nb.map((x) => x[1]))]); if (!near) return null; const f = nb.find((x) => x[1] === near.id)[0]; return ob('Ask ' + CAST[near.id].name + ' to back the ' + SIM.FIXES[f].short + '.', near.at, CAST[near.id].name); };
    const hasIdea = Object.keys(SIM.FIXES).some((f) => SIM.fixState(S, f) === 'idea');
    const shiftOpen = (k) => !S.flags['shift' + k] && !S.flags['missed' + k] && m < 690;
    if (d === 1) {
      // Wren's lantern is on your windowsill on the first morning: the game points at it once, before you head out
      if (this.G.loc === 'home' && !S.flags.lantern && m < 600) return ob('Wren left a lantern on your windowsill. Pick it up on your way out.', T.works, 'The Works', { inside: 'home', spot: 'sill', spotLabel: 'Lantern' });
      if (shiftOpen(1)) return ob(this.G.loc === 'works' ? 'Sit at your desk to start your shift. It\'s the one by the door, with the plant.' : m > 545 ? 'You are running late. You can still start your shift until 11:30.' : 'Get to the Works by 9:00. Up the garden cut, then left.', this.G.loc === 'works' ? null : T.works, 'The Works', { inside: 'works', spot: 'mydesk', spotLabel: 'Your desk' });
      if (!S.met.clover && m < 1080) return ob('Find Clover at the Fix-It Shed, in the Commons.', T.shed, 'Fix-It Shed');
      if (m >= 1170) return ob('That is enough for today. Head home when you like.', T.home, 'Home', { inside: 'home', spot: 'bed', spotLabel: 'Bed' });
      const metN = Object.keys(S.met).filter((k) => CAST[k] && !CAST[k].minor).length;
      // an idea noted today can go to Clover today, while the Shed is open
      if (hasIdea && metN >= 4 && this.G.npcs.clover.place === 'town' && m < 1060) return ob('Take your idea to Clover at the Fix-It Shed. Home by 10 PM.', T.shed, 'Fix-It Shed');
      const n = this.nearestOf(Object.keys(CAST).filter((id) => !S.met[id] && !CAST[id].minor));
      if (n) return ob('Say hi to ' + CAST[n.id].name + '. Home by 10 PM.', n.at, CAST[n.id].name);
      if (S.energy < 40) return ob('You have met everyone. Rest somewhere that fits you, or head home early.', T.home, 'Home', { inside: 'home' });
      return ob('You have met everyone. Explore, or fish at the pond. Home by 10 PM.', T.pond, 'The pond');
    }
    if (d === 2) {
      if (S.flags.councilDone) return ob(m >= 1170 ? 'That is enough for today. Head home when you like.' : 'The meeting is over. The evening is yours.', T.home, 'Home', m >= 1170 ? { inside: 'home', spot: 'bed', spotLabel: 'Bed' } : { inside: 'home' });
      // the new game's Tuesday: the bus stop first, before the sync (Monday's postcard promised it), then the loft
      const bus = this.busList();
      if (bus && m < 520) return bus;
      if (shiftOpen(2)) return ob(this.G.loc === 'works' ? 'Sit at your desk for the weekly sync.' : 'Weekly sync at the Works, 9:00.', this.G.loc === 'works' ? null : T.works, 'The Works', { inside: 'works', spot: 'mydesk', spotLabel: 'Your desk' });
      if (m >= 1020) return ob('Town meeting at 6 PM, Town Hall.', T.hall, 'Town Hall', { inside: 'hall' });
      if (bus) return bus;
      if (!S.flags.statue_seen && m >= 600 && this.G.npcs.clover.place === 'town') return ob('Clover found something in the loft. Visit the Fix-It Shed.', T.shed, 'Fix-It Shed');
      if (hasIdea) return ob(Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'idea').length > 1 ? 'Take your ideas to Clover at the Fix-It Shed.' : 'Take your idea to Clover at the Fix-It Shed.', T.shed, 'Fix-It Shed');
      if (S.flags.rue_invite && !S.flags.rue_pond && m >= 945 && m < 1050) return ob('Rue asked to meet at the pond.', T.pond, 'The pond');
      const b = backers(); if (b) return Object.assign(b, { t: b.t + ' The meeting is at 6.' });
      const gilReady = Object.keys(SIM.FIXES).some((f) => SIM.FIXES[f].approve === 'gil' && SIM.fixState(S, f) === 'ready' && !S.flags['gilasked_' + f]);
      if (gilReady && m < 1020) return ob('Show Gil the plans at the Works, or take them to the meeting.', T.works, 'The Works', { inside: 'works', spot: 'gil', spotLabel: 'Gil' });
      if (S.flags.statue_seen && !S.flags.hollis_archive && this.G.npcs.hollis.place === 'town') { const h = this.nearestOf(['hollis']); if (h) return ob('Tell Hollis what Clover found, before the meeting.', h.at, 'Hollis'); }
      if (!Object.keys(S.fixes).length) { const n = this.nearestOf(Object.keys(CAST).filter((id) => !S.talked[id] && !CAST[id].minor)); if (n) return ob('Listen for what pinches people. Try ' + CAST[n.id].name + '.', n.at, CAST[n.id].name); }
      return ob('Explore, or rest somewhere that fits. The meeting is at 6.');
    }
    if (d === 3) {
      if (m >= 1140) return ob('The Lantern Festival starts at 8 in Market Square.', T.square, 'Market Square');
      // the fixes you won, in use: each has its own hour and place, said on Wednesday's card; the game points at one
      // while its hour is on, and at the next one once there is nothing else to do
      const seen = (f) => S.fixes[f] !== 'built' || (S.felt || {})[f];
      const feltOb = (f) => { const [t, at, label, o] = FELT_WAY[f]; return ob(t, at, label, o); };
      const feltNow = Object.keys(FELT).find((f) => FELT_WAY[f] && !seen(f) && m >= FELT[f].from && m < FELT[f].to && FELT[f].to - FELT[f].from <= 300);
      if (feltNow) return feltOb(feltNow);
      // a Works fix with its backers can still be signed off by Gil, whose budget allows it
      if (SIM.approvedCount(S) < SIM.SEASON_CAP && Object.keys(SIM.FIXES).some((f) => SIM.FIXES[f].approve === 'gil' && SIM.fixState(S, f) === 'ready' && !S.flags['gilasked_' + f])) {
        const g = this.nearestOf(['gil']); if (g) return ob('Show Gil the plans. He can still sign off a Works fix.', g.at, 'Gil');
        if (this.G.npcs.gil.place === 'works' && m >= 540 && m < 660) return ob('Show Gil the plans at the Works. He can still sign off a Works fix.', T.works, 'The Works', { inside: 'works', spot: 'gil', spotLabel: 'Gil' });
      }
      if (!S.flags.statue_seen && this.G.npcs.clover.place === 'town') return ob('Clover found something. Visit the Fix-It Shed.', T.shed, 'Fix-It Shed');
      if (!S.flags.painted && this.G.npcs.wren.place === 'town') return ob('Wren needs three lanterns painted, at the Far End.', T.farend, 'The Far End');
      // the next fix in use: point there once its hour is near; until then, say when, and leave the time to you
      const feltNext = Object.keys(FELT).filter((f) => FELT_WAY[f] && !seen(f) && m < FELT[f].to).sort((a, b) => FELT[a].from - FELT[b].from)[0];
      if (feltNext && FELT[feltNext].from - m <= 45) return feltOb(feltNext);
      if (feltNext) return ob('Festival day. ' + FELT_LATER[feltNext] + ' Until then, the day is yours.');
      return ob('Festival day. The lanterns go up at 8.');
    }
    return ob('');
  }
  // Tuesday in the new game: what pinches at the bus stop, with the lantern, until its list is full (or the idea is made)
  busList() {
    const G = this.G, S = this.S; if (!S.v2 || this.ret || S.day !== 2 || !G.marks) return null;
    const c = G.marks.count('transit'); if (c.done >= c.total || SIM.fixState(S, 'board') !== 'none' || S.min >= 1000) return null;
    const here = G.loc === 'town' && G.zone === 'transit';
    if (here && !G.look.raised) return ob('Raise the lantern at the bus stop' + (this.ui.touch ? '.' : ' (' + G.keyOf('look') + ').'), null);
    return ob('The bus stop: sweep the lantern round and tag what pinches people (' + c.done + '/' + c.total + ').', here ? null : G.town.spots.transit, 'The bus stop');
  }
  goals() {
    if (this.ret) return this.ret.goals();
    if (this.slice.on) return this.slice.goals();
    const S = this.S, d = S.day; const met = Object.keys(S.met).filter((k) => CAST[k] && !CAST[k].minor).length;
    if (d === 2 && S.v2 && this.G.marks) { const c = this.G.marks.count('transit'); return [{ t: 'What pinches at the bus stop (' + Math.min(c.done, c.total) + '/' + c.total + ')', done: c.done >= c.total }, { t: 'Weekly sync at the Works, 9:00', done: !!S.flags.shift2 }, { t: 'See what Clover found', done: !!S.flags.statue_seen }, { t: 'Take an idea to the Shed, and find its backers', done: Object.values(S.fixes).some((v) => v === 'ready' || v === 'proposal') || !!S.flags.councilDone }, { t: 'Town meeting, 6 PM', done: !!S.flags.councilDone }]; }
    if (d === 1) return [{ t: 'Get to the Works by 9:00', done: !!S.flags.shift1 }, { t: 'Meet at least four neighbors (' + Math.min(4, met) + '/4)', done: met >= 4 }, { t: 'Find the Fix-It Shed', done: !!S.met.clover }, { t: 'Home by 10 PM', done: false }];
    if (d === 2) return [{ t: 'Weekly sync at the Works, 9:00', done: !!S.flags.shift2 }, { t: 'See what Clover found', done: !!S.flags.statue_seen }, { t: 'Turn an idea into a proposal at the Shed', done: Object.values(S.fixes).some((v) => v !== 'idea') }, { t: 'Town meeting, 6 PM', done: !!S.flags.councilDone }];
    if (d === 3) return [{ t: 'See the fixes in use', done: Object.keys(S.felt || {}).length > 0 || !Object.values(S.fixes).includes('built') }, { t: 'Paint three lanterns with Wren', done: !!S.flags.painted }, { t: 'The Lantern Festival, 8 PM', done: !!S.flags.released }];
    return [{ t: 'Make yourself at home', done: false }];
  }
  // called by the game loop every frame while playing
  tick() {
    const G = this.G, S = this.S; if (G.busy || G.mode !== 'play') return;
    if (this.slice.on) { this.slice.tick(); return; }
    const m = S.min, d = S.day; const a1 = !this.ret;
    if (!a1 && this.ret.tick()) return;
    if (a1) {
      // (Gil texts you, unless you're in the Works with him: then he calls across the room)
      const gilSays = (inRoom, txt) => { if (G.loc === 'works' && G.npcs.gil.place === 'works') { G.ui.bubble('gil', inRoom, { tint: CAST.gil.tint, ms: 5200 }); G.ui.announce('Gil: ' + inRoom); } else this.text('Gil (work)', txt); };
      if (d === 1 && m >= 555 && !S.flags.shift1 && !S.flags.ping1) { S.flags.ping1 = 1; gilSays('Your desk\'s the one by the door, with the plant. Whenever you\'re ready!', 'No worries if you\'re running late! :)'); }
      if (d === 1 && m >= 690 && !S.flags.shift1 && !S.flags.missed1) { S.flags.missed1 = 1; gilSays('That\'s the mail done for today. No worries!! Tomorrow!', 'Missed you today! No worries!! Tomorrow :)'); this.log('missed', { z: 'works', v: 'shift', pay: ['you', 'gil'] }); }
      if (d === 2 && m >= 690 && !S.flags.shift2 && !S.flags.missed2) { S.flags.missed2 = 1; gilSays('Sync\'s done! I\'ll send you the notes!', 'We missed you at sync! Notes to follow :)'); this.log('missed', { z: 'works', v: 'shift', pay: ['you', 'gil'] }); }
      if (d === 1 && m >= 1045 && m < 1070 && !S.flags.busEvent && G.zone === 'transit') { S.flags.busEvent = 1; G.run(() => this.busEvent()); return; }
      { const e6 = S.lantern.entries.clover_six; if (e6 && e6.day === d && m >= 1080 && !S.flags.clover6) { S.flags.clover6 = 1; this.text('Clover', 'Drawings attached. Six on the dot.'); } }
      // Tuesday: Rue at the pond if she asked, the town meeting at six
      if (d === 2 && S.flags.rue_invite && m >= 1050 && !S.flags.rue_pond && !S.flags.rue_missed) { S.flags.rue_missed = 1; this.text('Rue', 'Missed you at the pond. Moss gave me tea instead. Festival?'); this.log('missed', { z: 'farend', v: 'pond', pay: ['you', 'rue'] }); }
      if (d === 2 && S.flags.rue_cracked && !S.flags.rue_invite && S.rueAskedAt == null) S.rueAskedAt = m;
      if (d === 2 && S.flags.rue_cracked && !S.flags.rue_invite && m < 930 && m >= S.rueAskedAt + 30) { S.flags.rue_invite = 1; this.text('Rue', 'Can I ask you something? Not on the app. The pond, half four?'); }
      if (d === 2 && m >= 1065 && !S.flags.remind) { S.flags.remind = 1; if (G.loc !== 'hall') this.text('Hollis', 'Town meeting in 15 minutes! Town Hall.'); }
      if (d === 2 && m >= 1080 && !S.flags.council) { S.flags.council = 1; G.run(() => this.council()); return; }
      if (S.cloverAt != null && m >= S.cloverAt && !G.ui.waiter) { G.run(() => this.cloverAfter()); return; }
      if (d === 2 && S.flags.shift2 && !S.flags.afternoon && G.loc === 'town' && G.ui.panel.hidden) { S.flags.afternoon = 1; G.run(() => this.afternoon()); return; }
      if (d === 2 && S.flags.missed2 && !S.flags.afternoon && G.ui.panel.hidden) { S.flags.afternoon = 1; G.run(() => this.afternoon()); return; }
      // Wednesday: what the fixes are like in use, Who decided? on the walk over, then the festival
      { const ff = this.feltDue(); if (ff) { G.run(() => this.felt(ff)); return; } }
      if (d === 3 && m >= 1170 && !S.flags.decided) { S.flags.decided = 1; G.run(() => this.toFestival()); return; }
      if (d === 3 && m >= 1200 && !S.flags.festival) { G.run(() => this.festival()); return; }
      if (S.flags.festival && m >= 1290 && !S.flags.released) { G.run(() => this.finale()); return; }
      if (!S.flags.festival && m >= 1260 && !S.flags.late) { S.flags.late = 1; this.ui.toast('It is getting late. Home is on Home Row, to the southwest.'); }
      if (!S.flags.festival && m >= 1320) { G.run(() => this.goHome('late')); return; }
    }
    if (S.energy <= 0.5 && !S.flags.festival) { G.run(() => (a1 ? this.exhausted() : this.ret.exhausted())); return; }
    // (never at the festival, or on the walk there: the evening ends by itself, and nobody needs telling to go home)
    if (S.flags.festival || S.flags.decided) { /* no energy warnings now */ }
    else if (S.energy < 30 && !S.flags['low1_' + d]) { S.flags['low1_' + d] = 1; this.ui.toast('<b>Running low.</b><br>Home, a bench somewhere that fits you, or tea with Moss will help.', '', 5600); }
    if (S.energy < 12 && !S.flags['low2_' + d] && !S.flags.festival && !S.flags.decided) { S.flags['low2_' + d] = 1; this.ui.toast(a1 ? '<b>Nearly empty.</b> Head home soon, or the day will end for you.' : '<b>Nearly empty.</b> Rest somewhere that fits, or the afternoon will end for you.', '', 5600); }
    // Blend keeps pinging while it is installed: a small noise layer of its own
    if (S.blend.has && !S.blend.deleted && d >= 1 && G.settings.blendPings !== false) { const t = now(); if (!this.pingAt) this.pingAt = t + (FAST ? 4000 : 90000); if (t > this.pingAt) { this.pingAt = t + (FAST ? 8000 : 120000 + Math.random() * 60000); this.text('Blend', S.blend.smooth && S.blend.score < 15 ? 'You are out of points! The feed has plenty.' : pick(BLEND.pings)); } }
    if (a1 && d < 3 && m >= 1170 && !S.flags['dusk' + d]) { S.flags['dusk' + d] = 1; this.ui.toast('The light is going gold. That is enough for today.', 'idea', 5200); }
    if ((this.revealQ || []).length) { G.run(() => this.flushReveals()); return; }
    if (a1) { const fv = this.dueFavour(); if (fv && !G.ui.waiter && G.ui.panel.hidden && !G.phoneOpen) { G.run(() => this.favour(fv)); return; } }
    { const sf = !G.ui.waiter && G.ui.panel.hidden && !G.phoneOpen ? this.stakeVisit() : null; if (sf) { G.run(() => this.stakeTalk(sf)); return; } }
    if (a1 && !G.ui.waiter && G.ui.panel.hidden && !G.phoneOpen) this.gilPacks();
    const z = G.zone; if (z === 'home') return;
    if (S.carryDefault === 'headphones_market' && z === 'market' && S.gear.headphones && !S.wearing.headphones && !S.flags['hpm' + d]) { S.flags['hpm' + d] = 1; S.wearing.headphones = true; G.player.setGear('headphones', true); S.spot = clamp(S.spot + 0.15, 0, 1); this.ui.toast('You put your headphones on as you reached the market, like you decided last time. People notice.', '', 4200); this.log('default', { z, v: 'headphones', by: 'you', pay: ['you'] }); }
    if (this.unasked(z)) return;
    // a later visit's own card for a place (Unit at the Works, the kiosk at Town Hall) is that place's card for the day
    if (this.ret && this.ret.owns(z)) return;
    // barriers: when a place pinches, ask who adjusts
    const key = d + ':' + z + (z === 'festival' ? ':f' : '');
    if (a1 && d === 1 && !S.flags.shift1 && m < 600 && z !== 'works') return;
    if (z === 'homerow' && G.pinchNow && !['people', 'talk'].includes(G.pinchNow.top)) return;
    if (!S.handled[key]) {
      // (the new game, after its first day: fewer cards, further apart; the first day already made the point once)
      const light = S.v2 && a1 && d >= 2;
      const p = G.pinchNow; const need = z === 'street' || z === 'homerow' ? 0.45 : light ? 0.4 : 0.3;
      const calm = FAST || now() - (G.lastBarrier || -1e9) > (light ? 75000 : 30000);
      if (p && p.total >= need && (G.zoneTime || 0) > 0.6 && calm) { S.handled[key] = 1; G.run(() => this.barrier(z)); }
    }
  }

  // ---------- who adjusts? ----------
  // Five answers, always in the same order, each with one thing it gets you and one thing it costs. Disabled ones
  // say why. Everything chosen here goes in the log, with who decided and who paid.
  async barrier(zone, o = {}) {
    const G = this.G, S = this.S;
    const p = SIM.pinch(S, zone, S.min, G.subFor(zone)); if (p.total < 0.12 && !o.force) return 'none';
    const top = p.top || 'sound'; const dir = p.dims[top].over > 0 ? 'over' : 'under';
    const B = BARRIER[zone] || BARRIER.street; const text = (B[dir] && B[dir][top]) || (BARRIER.street[dir] && BARRIER.street[dir][top]) || 'This place is not quite right for you.';
    if (S.blend.has && S.blend.smooth && !S.blend.deleted) {
      if (G.blendSmooth(zone)) { this.log('barrier', { z: zone, v: 'bend', by: 'blend', pay: ['you'], dim: top, dir }); return 'bend'; }
      this.ui.toast('<b>Out of points.</b><br>Blend has a feed for that.', 'blend', 4200); this.fieldNote('dark');
    }
    G.focusPinch(true); G.lastBarrier = now();
    // a habit: the same answer here, on different days, and now it happens before you notice (you can still stop it)
    if (!o.noAsk && !o.noHabit) { const h = await this.habitCard(zone, top, dir); if (h) return h; }
    const coach = !S.flags.coached ? 'Five ways to handle a place that does not fit. None of them is wrong, and each one costs something different.' : ''; S.flags.coached = 1;
    this.fieldNote('fit');
    const fix0 = (SIM.FIX_FOR[zone] || {})[top]; const fixId = fix0 && (dir === 'over' || !SIM.FIX_OVER_ONLY.has(fix0)) ? fix0 : null;
    const noticed = sens(S, top) && NOTICE[zone] && NOTICE[zone][top] && (dir === 'over' || !(NOTICE_OVER[zone] || []).includes(top));
    const gutList = (GUTS[dir] && GUTS[dir][top]) || [];
    let noted = false;
    while (true) {
      const owner = SIM.OWNERS[zone]; const ownerHere = owner && G.npcNear(owner, zone);
      const name = owner ? CAST[owner].name : '';
      const gw = owner ? this.gwOf(owner) : 0; const shared = owner ? this.sharedPinch(owner, zone, top, dir) : false;
      const gearKey = top === 'sound' ? 'headphones' : top === 'light' && dir === 'over' ? 'shades' : null;
      const exitWord = zone === 'works' || zone === 'hall' ? 'Step outside' : 'Go somewhere else';
      const options = [
        { key: 'bend', who: 'You', label: 'Push through', sub: 'You stay, and nobody notices. −4 energy; the pinch stays, hidden.', hold: true },
        gearKey ? (S.gear[gearKey] && !S.wearing[gearKey] ? { key: 'gear', who: 'Your gear', label: 'Put on your ' + gearKey, sub: 'You stay. ' + (gearKey === 'headphones' ? 'Sound' : 'Glare') + ' only; people may notice.' } : { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: S.wearing[gearKey] ? 'already on, and still not enough' : 'nothing for this yet. Moss sells some.' }) : { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: 'nothing you own helps with this' },
        // (favours come due only on the first visit; ten years on, people know you, or they don't have goodwill to spare)
        ownerHere && !o.noAsk && ASKABLE.includes(top) ? { key: 'ask', who: 'Them', label: 'Ask ' + name + ' to change it', sub: gw >= 1 ? 'It may change for you now. Goodwill with ' + name + ' ' + this.dots(gw) + '; this uses one.' + (this.ret ? '' : ' ' + name + ' may ask a favour later.') : shared ? 'It pinches ' + name + ' too, and you know it.' + (this.ret ? '' : ' ' + name + ' may ask a favour later.') : this.ret ? name + ' has no goodwill to spare today. Probably a no.' : (S.gwUsed || {})[owner] ? 'You have already asked ' + name + ' for one favour. Probably a no.' : name + ' doesn\'t know you well yet. Probably a no.' } : { key: 'ask', who: 'Them', label: 'Ask someone', disabled: true, reason: o.noAsk ? 'you asked. The answer was no.' : !ASKABLE.includes(top) ? ASK_NOT[top] || 'nobody can change this for you' : owner ? 'nobody in charge is here right now' : 'nobody here is in charge of it' },
        // (in a later visit there's no time to sketch it: it goes straight to tonight's meeting, if it finds two backers;
        // after the meeting, it goes on file for next year)
        fixId && !noted && (SIM.fixState(S, fixId) === 'none' || (this.ret && SIM.fixState(S, fixId) === 'onfile' && !S.flags.councilDone)) ? (noticed || S.flags['told_' + fixId] ? (this.ret ? (S.flags.councilDone ? { key: 'fix', who: 'The place', label: 'Put it on file for next year', sub: 'The meeting is over for this year. Someone can bring it back.' } : { key: 'fix', who: 'The place', label: 'Propose it for tonight', sub: 'Two backers by six, then the meeting. Two fixes a year; someone loses something.' }) : { key: 'fix', who: 'The place', label: 'Note it for the Fix-It Shed', sub: 'Could change it for everyone, later. Slow; two a season; someone loses something.' }) : { key: 'fix', who: 'The place', label: 'Note it', disabled: true, reason: 'you are not sure what is causing it' }) : { key: 'fix', who: 'The place', label: 'Fix it', disabled: true, reason: fixId && SIM.fixState(S, fixId) !== 'none' ? (['built', 'approved'].includes(SIM.fixState(S, fixId)) ? 'it\'s already built' : !this.ret ? 'already in your notes' : SIM.fixState(S, fixId) === 'onfile' ? 'it\'s on file for next year' : 'you\'ve proposed it for tonight') : 'nothing obvious to change here' },
        { key: 'leave', who: 'Nobody', label: exitWord, sub: 'You rest. You miss what you came for.' },
      ];
      { const fo = options[3]; if (fo.disabled) fo.label = this.ret ? 'Propose a fix' : 'Note it for the Fix-It Shed'; }
      const off = options.filter((x) => x.disabled).length;
      // what someone changed for you here on an earlier day lasted that day only: say so, rather than let it vanish
      const undone = !this.ret && (S.log || []).find((r) => r.k === 'barrier' && r.v === 'ask' && r.by === 'you' && r.z === zone && r.d < S.day && r.dim === top && CAST[(r.pay || [])[0]]);
      const gutText = noted ? '' : undone ? 'What ' + CAST[undone.pay[0]].name + ' changed for you here didn\'t last the night.' : gutList.length ? pick(gutList) : '';
      const choice = await this.ui.barrier({ options, title: B.title, text, gut: gutText, notice: noticed && !noted ? NOTICE[zone][top] : '', noticeLabel: DIM_LABEL[top], coach: noted ? '' : coach });
      const row = { z: zone, dim: top, dir, f: { off, owner: ownerHere ? owner : '' } };
      if (choice === 'fix') { noted = true; const after = this.ret && S.flags.councilDone; if (this.ret) this.ret.propose(fixId, null); else this.addIdea(fixId); S.stats.fix++; this.log('barrier', Object.assign({ v: 'fix', pay: [], verb: this.ret ? (after ? 'You put it on file for next year.' : 'You proposed it for tonight\'s meeting.') : '' }, row)); continue; }
      this.ui.hideBarrier(); G.focusPinch(false);
      if (choice === 'bend') { S.masking = true; S.maskZone = zone; SIM.bendCost(S, false); S.stats.bend++; G.player.setExpression('neutral'); this.log('barrier', Object.assign({ v: 'bend', pay: ['you'] }, row)); }
      else if (choice === 'gear') {
        S.wearing[gearKey] = true; G.player.setGear(gearKey, true); S.spot = clamp(S.spot + 0.15, 0, 1); S.stats.gear++; G.audio.sfx('select'); this.log('barrier', Object.assign({ v: 'gear', pay: ['you'] }, row));
        if (zone === 'market' && S.day >= 2 && !S.flags.pipBold && S.bonds.pip < 2 && G.npcNear('pip', zone)) { S.flags.pipBold = 1; this.ui.bubble('pip', 'Ooh! Those are very... bold!', { tint: CAST.pip.tint, ms: 3800 }); }
      }
      else if (choice === 'ask') {
        S.stats.ask++; const ok = gw >= 1 || shared;
        G.faceTalk(owner);
        // a later visit can have its own words for this (ten years on, you're not the new person)
        const A = (this.ret && (this.ret.A.ask || {})[owner]) || ASK[owner]; const under = dir === 'under';
        // the answer is about what you asked: the light, the sound or the company, too much or too little
        const yes = (under ? (A.yesUnderBy || {})[top] || A.yesUnder : (A.yesBy || {})[top]) || A.yes; const no = (under && A.noUnder) || A.no;
        await this.say(owner, (ok ? yes : no).replace(/^"|"$/g, ''));
        if (ok && zone === 'works' && top === 'light' && !under) S.flags['rowdim' + S.day] = 1;
        if (ok) {
          S.mods[zone] = S.mods[zone] || {}; for (const dd of ['sound', 'light', 'people']) if (p.dims[dd].v > 0.02 || dd === top) S.mods[zone][dd] = (S.mods[zone][dd] || 0) + (p.dims[dd].over > 0 ? -0.35 : 0.3);
          if (gw >= 1) { S.gw[owner] = gw - 1; S.gwUsed = S.gwUsed || {}; S.gwUsed[owner] = (S.gwUsed[owner] || 0) + 1; if (!S.flags.gwTold) { S.flags.gwTold = 1; this.ui.toast('<b>Goodwill</b><br>People who know you will do a little for you. Asking spends it. Time together, and favours, earn it back.', 'idea', 6500); } }
          this.owe(owner);
          // someone else pays for the change, and says so, plainly
          const by = ((this.ret && (this.ret.A.bystander || {})[owner]) || BYSTANDER[owner] || {})[dir] || {}; const [bn, bt] = by[top] || by.other || [];
          if (bn) await this.say(bn, bt);
          this.ui.hideDialog();
          this.log('barrier', Object.assign({ v: 'ask', pay: [owner].concat(bn && bn !== owner ? [bn] : []) }, row));
        } else {
          this.ui.hideDialog(); G.advance(5); this.know(owner, 'no');
          this.log('refused', Object.assign({ v: 'ask', by: owner, pay: ['you'] }, row)); this.fieldNote('sludge');
          return await this.barrier(zone, { force: true, noAsk: true });
        }
      }
      else if (choice === 'leave') { S.stats.leave++; S.self = clamp(S.self + 1, 0, 100); S.restUntil = S.min + 20; this.log('barrier', Object.assign({ v: 'leave', pay: ['you'] }, row)); await G.leaveZone(zone); }
      this.noteHabit(zone, top, dir, choice);
      return choice;
    }
  }
  // ---------- Gil's packs, across the cart (after work, 17:30 to 19:10) ----------
  // Ambient: two bubbles on two visits, each with its label (in Lantern's voice if it's on, a plain caption if not).
  // The scene never plays without its label. Settings can summarize it to one sentence.
  gilPacks() {
    const G = this.G, S = this.S; if (G.loc !== 'town' || S.min < 1050 || S.min >= 1150 || S.flags.festival) return;
    const n = G.npcs.gil; if (!n || n.place !== 'town' || n.visit) return;
    const me = G.player.root.position, q = n.c.root.position; if (Math.hypot(q.x - me.x, q.z - me.z) > 9) return;
    const lan = G.settings.lanternVoice !== false ? 'Lantern: ' : '';
    if (G.settings.packs === 'summary') {
      if (S.flags.gilPack1) return; S.flags.gilPack1 = S.flags.gilPack2 = 1;
      this.ui.toast('Across the cart, Gil opens card packs, chasing the golden one: a near-miss, then a shiny worth less than the pack. He doesn\'t get it.', '', 7000);
      this.fieldNote('nearmiss'); this.fieldNote('ldw'); return;
    }
    let line, card, label;
    if (!S.flags.gilPack1) {
      S.flags.gilPack1 = 1; S.gilPack1At = S.day * 1440 + S.min;
      line = 'So close! Gold fin. Wrong fish. Next pack for sure.';
      card = cardTile(FISH.find((f) => f.id === 'minnow'), { goldfin: true });
      label = '<b>Gil\'s card:</b> Reed minnow, gold-fin print. Not the golden one.<br>' + lan + 'A near-miss. A loss made to look almost like a win.';
      this.fieldNote('nearmiss');
    } else if (!S.flags.gilPack2 && S.day * 1440 + S.min >= (S.gilPack1At || 0) + 40) {
      S.flags.gilPack2 = 1;
      line = 'A shiny! Worth one coin. Packs are five. Still. A shiny!';
      card = cardTile(FISH.find((f) => f.id === 'perch'), { shiny: true });
      label = '<b>Gil\'s card:</b> a shiny sun perch, worth one coin. The pack cost five.<br>' + lan + 'A loss dressed as a win: less than it cost, celebrated anyway.';
      this.fieldNote('ldw'); this.fieldNote('packs');
    } else return;
    this.ui.bubble('gil', line, { tint: CAST.gil.tint, ms: 6500 }); G.audio.voice(CAST.gil.voice[0], CAST.gil.voice[1], line);
    this.ui.toast('<div class="pkrow">' + card + '<div>' + label + '</div></div>', lan ? 'lantern' : '', 9000);
    this.ui.announce('Gil, opening a card pack at the cart: ' + line + ' ' + label);
  }
  // ---------- habits ----------
  // The key is the place, what pinches most and which way, and the gear you own. The same answer (push through, gear,
  // leave) at the same key on different days becomes a habit: works, market and the hall after two days, elsewhere three.
  // At most four a visit. In return visits only the habit you brought with you fires (one day isn't enough to form one).
  habitKey(zone, top, dir) { const S = this.S; const g = (S.gear.headphones ? 'h' : '') + (S.gear.shades ? 's' : ''); return zone + '|' + top + '|' + dir + '|' + (g || '-'); }
  noteHabit(zone, top, dir, verb) {
    const S = this.S; if ((S.act || 1) > 1) return;
    S.habits = S.habits || {}; const k = this.habitKey(zone, top, dir); const H = S.habits[k];
    if (!H || H.verb !== verb) { S.habits[k] = { verb, days: [S.day] }; return; }
    if (!H.days.includes(S.day)) H.days.push(S.day);
    const need = { works: 2, market: 2, hall: 2, transit: 3 }[zone] || 3;
    const formed = Object.values(S.habits).filter((h) => h.formed).length;
    if (!H.formed && ['bend', 'gear', 'leave'].includes(verb) && H.days.length >= need && formed < 4) {
      H.formed = S.day;
      if (verb === 'bend' && (!S.pushHabit || S.pushHabit === 'none' || zone === 'works')) S.pushHabit = zone;
    }
  }
  async habitCard(zone, top, dir) {
    const G = this.G, S = this.S; const k = this.habitKey(zone, top, dir); const H = (S.habits || {})[k];
    if (!H || !H.formed || H.formed === S.day) return null;
    const gearKey = top === 'sound' ? 'headphones' : top === 'light' && dir === 'over' ? 'shades' : null;
    if (H.verb === 'gear' && !(gearKey && S.gear[gearKey] && !S.wearing[gearKey])) return null;
    const line = H.verb === 'bend' ? 'You straightened up before you noticed.' : H.verb === 'gear' ? 'You put your ' + gearKey + ' on before you noticed.' : zone === 'works' || zone === 'hall' ? 'You were out the door before you noticed.' : 'You were on your way out before you noticed.';
    // the habit's cost is the same as the answer it replaces, so it says so
    const cost = H.verb === 'bend' ? '−4 energy; the pinch stays, hidden' : H.verb === 'gear' ? 'you stay; people may notice' : 'you rest; you miss what you came for';
    const pick = await this.choose([{ t: 'OK', sub: 'it is what you do here. ' + cost[0].toUpperCase() + cost.slice(1) + '.', id: 'habit_ok' }, { t: 'Not today', sub: 'see all five ways', id: 'habit_no' }], { text: line, kind: 'gut' });
    this.ui.hideDialog();
    if (pick !== 0) { delete S.habits[k]; return null; }
    const row = { z: zone, dim: top, dir, by: 'habit', pay: ['you'] };
    if (H.verb === 'bend') { S.masking = true; S.maskZone = zone; SIM.bendCost(S, false); S.stats.bend++; G.player.setExpression('neutral'); }
    else if (H.verb === 'gear') { S.wearing[gearKey] = true; G.player.setGear(gearKey, true); S.spot = clamp(S.spot + 0.15, 0, 1); S.stats.gear++; G.audio.sfx('select'); }
    G.focusPinch(false);
    this.log('habit', Object.assign({ v: H.verb }, row)); this.fieldNote('habits');
    if (H.verb === 'leave') { S.stats.leave++; S.self = clamp(S.self + 1, 0, 100); S.restUntil = S.min + 20; await G.leaveZone(zone); }
    return H.verb;
  }
  gwOf(id) { return (this.S.gw || {})[id] || 0; }
  dots(n) { return '●'.repeat(clamp(n, 0, 3)) + '○'.repeat(3 - clamp(n, 0, 3)); }
  // you know it pinches them too, the same way, right here: then a change for you is a change for them
  sharedPinch(owner, zone, dim, dir) {
    const S = this.S, prof = CAST[owner] && CAST[owner].profile; const k = ((S.know || {})[owner] || {})[dir === 'over' ? 'over' : 'under'];
    if (!prof || !k) return false;
    const q = SIM.pinchOf(prof, SIM.levels(S, zone, S.min, this.G.subFor(zone)), null, zone).dims[dim];
    return !!q && (dir === 'over' ? q.over > 0 : q.under > 0);
  }
  // an owner who changed something for you may ask for a hand later (one favour per person per visit)
  owe(id) { const S = this.S; S.owe = S.owe || {}; if (S.owe[id] || (S.favours || {})[id]) return; S.owe[id] = { at: S.day * 1440 + Math.round(S.min) }; }
  // the event log: what you faced, what you chose, who decided and who paid (Who decided? reads it)
  log(k, o = {}) {
    const S = this.S, G = this.G; S.log = S.log || []; if (S.log.length >= 300) return;
    const gear = S.gear.headphones || S.gear.shades ? (S.wearing.headphones || S.wearing.shades ? 'wear' : 'own') : 'none';
    const row = { d: S.day, m: Math.round(S.min), k, z: o.z || G.zone, v: o.v || '', by: o.by || 'you', pay: o.pay || [] };
    if (o.dim) { row.dim = o.dim; row.dir = o.dir; }
    if (o.line) row.line = String(o.line).slice(0, 80);
    if (o.turn) row.turn = 1;
    // a scene can say in its own words what you did (verb) and what you faced (why), for Who decided?
    if (o.verb) row.verb = String(o.verb).slice(0, 120);
    if (o.why) row.why = String(o.why).slice(0, 120);
    row.f = Object.assign({ e: Math.round(S.energy), gear, burn: S.burnout ? 1 : 0 }, o.f || {});
    S.log.push(row);
  }
  // a favour comes due at the owner's busy time, at least two hours after you asked; yes or no, both are fine
  async favour(id) {
    const G = this.G, S = this.S, F = FAVOURS[id]; S.favours = S.favours || {};
    delete S.owe[id]; S.favours[id] = 'asked';
    this.text(F.from, F.ask);
    const k = await this.choose([{ t: 'Yes, I can do that', sub: 'about half an hour', id: 'fav_yes' }, { t: 'Not this time', id: 'fav_no' }], { text: CAST[id].name + ' is asking: ' + F.ask, kind: 'say', who: id });
    if (k === 0) {
      S.favours[id] = 'yes'; await G.stage.fadeTo(1, 500);
      for (const n of F.yes) { if (n.note) await this.note(n.note); else await this.say(n.who, n.t); }
      G.advanceIn(F.zone, 30); S.gw[id] = Math.min(3, this.gwOf(id) + 1); this.keep('favour_' + id, F.keep, CAST[id].look.color);
      this.log('favour', { z: F.zone, v: 'yes', by: 'you', pay: ['you'] });
      this.ui.hideDialog(); await G.stage.fadeTo(0, 500);
    } else {
      S.favours[id] = 'no'; await this.say(F.no.who, F.no.t); this.ui.hideDialog();
      this.log('favour', { z: F.zone, v: 'no', by: 'you', pay: [id] });
    }
  }
  dueFavour() {
    const S = this.S; if (S.day !== 3 || !S.owe) return null;
    const nowAbs = S.day * 1440 + S.min;
    for (const id of Object.keys(S.owe)) {
      const F = FAVOURS[id]; if (!F) continue;
      if (S.burnout) continue;
      if (S.min >= F.m && S.min < F.m + 120 && nowAbs - S.owe[id].at >= 120) return id;
    }
    return null;
  }

  // ---------- the Works ----------
  async enterWorks(via) {
    const G = this.G, S = this.S;
    if (S.day === 3 && (S.min < 540 || S.min >= 660)) { await this.note('A sign on the door: FESTIVAL MAIL 9 TO 11. CLOSED AFTER THAT. SEE YOU THURSDAY!'); this.ui.hideDialog(); return; }
    if (S.min < 480) { await this.note('The Works opens at eight. It is ' + fmtTime(S.min) + '. The bakery is open, and so is the square.'); this.ui.hideDialog(); return; }
    if (S.day < 3 && S.min >= 1050) { await this.note('The Works has closed for the day. A cleaner waves at you through the glass.'); this.ui.hideDialog(); return; }
    if (S.wheels && via !== 'dock' && SIM.fixState(S, 'ramp') !== 'built') {
      await this.note('Three steps up to the front door, and no other way in at the front.');
      const opts = [{ t: 'Ask someone to help you up the steps', sub: 'people will watch', k: 'ask' }, { t: 'Go around to the loading dock', sub: 'a separate door, the long way, past the dumpsters', k: 'dock' }];
      if (SIM.fixState(S, 'ramp') === 'none') opts.push({ t: 'Note it for the Fix-It Shed', sub: 'slow, but it could last', k: 'fix' });
      opts.push({ t: 'Go home', sub: S.day < 3 ? 'no shift today' : 'skip it', k: 'leave' });
      const pickK = opts[await this.choose(opts)].k;
      this.ui.hideDialog();
      if (pickK === 'fix') { this.addIdea('ramp'); S.stats.fix++; this.log('barrier', { z: 'works', v: 'fix', pay: [], dim: 'wheels', dir: 'over' }); return this.enterWorks(via); }
      if (pickK === 'leave') { S.stats.leave++; this.log('barrier', { z: 'works', v: 'leave', pay: ['you'], dim: 'wheels', dir: 'over' }); return; }
      if (pickK === 'ask') { S.spot = clamp(S.spot + 0.25, 0, 1); S.self = clamp(S.self - 2, 0, 100); S.stats.ask++; this.log('barrier', { z: 'works', v: 'ask', pay: ['you'], dim: 'wheels', dir: 'over' }); await this.note('Two people from accounting lift the front of your chair. Everyone in the lobby watches. Someone says "there we go" in a voice usually used for toddlers.'); this.ui.hideDialog(); }
      // a separate door sets you apart, and takes longer: that is bending, not gear
      if (pickK === 'dock') { this.fieldNote('sludge'); G.advance(12); S.stats.bend++; this.log('barrier', { z: 'works', v: 'bend', pay: ['you'], dim: 'wheels', dir: 'over' }); await this.note('Around the side, past the dumpsters, through the loading dock. It takes twelve minutes.'); this.ui.hideDialog(); }
    }
    await G.enterRoom('works');
    // late or not is decided at the door: looking around inside first doesn't make you late
    if (S.day === 1 && !S.flags.in1) { S.flags.in1 = 1; if (S.min > 550) S.flags.late1 = 1; }
    if (S.day === 2 && ((S.bonds.gil || 0) >= 1 || (S.know && S.know.gil && S.know.gil.over)) && SIM.pinch(S, 'works', S.min).dims.light.over > 0) {
      S.mods.works = S.mods.works || {}; S.mods.works.light = (S.mods.works.light || 0) - 0.35;
      this.ui.bubble('gil', UNASKED.works.over, { tint: CAST.gil.tint, ms: 6000 }); this.keep('unasked_gil', 'Gil adjusted before you asked', CAST.gil.look.color); this.fieldNote('responsive');
      this.log('barrier', { z: 'works', v: 'ask', by: 'gil', pay: ['gil'], dim: 'light', dir: 'over', f: { unasked: 1 } });
      await sleep(FAST ? 50 : 1800);
    }
    // the Works asks who adjusts once a day, at the door; going in again later that day doesn't ask again
    if (!S.handled[S.day + ':works']) {
      S.handled[S.day + ':works'] = 1;
      const res = await this.barrier('works');
      if (res === 'leave') return;
    }
    // inside, the time is yours: the shift starts when you sit down at your desk
    if (this.shiftOpen()) this.ui.toast(S.day === 1 ? 'Your desk is the one by the plant. Sit down when you are ready to start.' : 'The sync happens at your desk. Sit down when you are ready.', '', 4200);
  }
  shiftOpen() { const S = this.S; return !this.ret && S.day >= 1 && S.day < 3 && !S.flags['shift' + S.day] && !S.flags['missed' + S.day] && S.min < 690; }
  async startShift() {
    const G = this.G, S = this.S; const day = S.day;
    G.walkTo(...G.rooms.works.spots.mydesk);
    await sleep(700);
    G.npcTo('gil', [G.rooms.works.spots.mydesk[0] + 1.3, G.rooms.works.spots.mydesk[1] - 0.6]);
    await sleep(800);
    G.talkFrame('gil');
    this.ui.letterbox(true);
    await this.run(TALK.gil[day === 1 ? 'shift1' : 'meeting2'], { npc: 'gil' });
    await this.officeApproval();
    await this.say('gil', day === 1 ? 'Okay! You\'re on the mail today. Letters come down the chute, and each one goes in the cubby with the same symbol. Easy!' : 'Okay! Festival paperwork. Lantern permits! Rules are rules: to hang a lantern, you have to match the Standard Resident. Template\'s on your desk. Easy!');
    this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
    { const c = G.roomCam('works'); G.stage.shot(c.pos, c.look, c.fov, 2); }
    // the work itself: a short task whose difficulty comes from the room
    const r = await new (day === 1 ? SortGame : StampGame)(G).run();
    const e0 = S.energy; G.advance(Math.max(0, 720 - S.min));
    if (S.energy < 40) { S.energy = Math.max(S.energy, Math.min(e0, 40)); this.ui.toast('<b>The morning took a lot out of you.</b><br>Somewhere quiet, or home, will help this afternoon.', '', 5600); }
    S.flags['shift' + day] = 1; S.stats.shifts++;
    if (day === 2 && r && r.stats) {
      const st = r.stats;
      G.npcTo('gil', [G.rooms.works.spots.mydesk[0] + 1.3, G.rooms.works.spots.mydesk[1] - 0.6]); G.talkFrame('gil'); this.ui.letterbox(true);
      if (st.approvedWho.includes('gil')) { await this.say('gil', 'You approved... mine? Ha. Huh. I haven\'t hung a lantern in about nine years. Thank you.'); this.addBond('gil', 1); }
      else if (st.approved > 0) await this.say('gil', 'You approved some? Are we allowed to... Honestly? Good. It\'s a lantern.');
      else await this.say('gil', 'Zero matches again! Every year. Every single year. Weird, right?');
      S.flags.permits = 1; this.fieldNote('average'); this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
    }
    G.npcs.gil.override = null;
    if (S.energy > 0) { S.coins += 30; G.audio.sfx('coin'); this.ui.toast('<b>+30 coins</b> for the shift', 'good'); }
    if (S.blend.has && S.blend.smooth && !S.blend.deleted && S.masking) this.ui.toast('Blend smoothed you through the whole shift. Nobody noticed a thing.', 'blend');
    this.saveNow('shift', S.day);
  }
  // Gil can sign off Works fixes that have their backers; "Not now" skips that one (only: offer just these)
  async officeApproval(only) {
    const S = this.S;
    const ready = Object.keys(SIM.FIXES).filter((f) => (!only || only.includes(f)) && SIM.FIXES[f].approve === 'gil' && SIM.fixState(S, f) === 'ready' && !S.flags['gilasked_' + f]);
    for (const f of ready) {
      if (SIM.approvedCount(S) >= SIM.SEASON_CAP) { await this.say('gil', 'Two this season already? That\'s the budget. Next year, I promise. Ish.'); break; }
      const k = await this.choose([{ t: 'Show Gil the plan for the ' + SIM.FIXES[f].short, sub: SIM.supporters(S, f) + ' backers · this uses one of the season\'s two', id: 'gil_show_' + f }, { t: 'Not now', id: 'gil_not' }]);
      if (k === 1) continue;
      S.flags['gilasked_' + f] = 1;
      await this.say('you', SIM.FIXES[f].what);
      // Gil signs a Works fix off himself only with a reason of his own: the soft lights once he has admitted the
      // panels give him headaches (or he knows you very well); the others once he knows you, or once you changed the
      // design for him. Otherwise it is "let's think about it", and the fix goes to the town meeting.
      const gb = S.bonds.gil || 0; const heardGil = (S.stakes || {})[f] === 'listened' && STAKES[f] && STAKES[f].who === 'gil';
      if ((S.sketch || {})[f] === 'zoned' || (f === 'dim' ? !!S.flags.gil_head || gb >= 4 : gb >= 2 || heardGil)) {
        await this.say('gil', 'Okay. Yes. Let\'s do it. Don\'t tell corporate. Actually, tell corporate.');
        this.approve(f, 'owner', true);
        this.ui.toast(`<b>Gil approved it</b><br>${SIM.FIXES[f].name}. ${S.day >= 3 ? 'It goes up on Thursday.' : 'Up by tomorrow.'} ${this.capLine()}`, 'good'); this.G.audio.sfx('fix');
        this.log('vote', { z: SIM.FIXES[f].zone, v: 'approved', by: 'gil', pay: [STAKES[f].who].filter((w) => (S.stakes || {})[f] !== 'listened') });
      }
      else { await this.hint('advisement_gil', {}); }
    }
  }
  async talkTo(id) {
    if (this.slice.on && (await this.slice.talk(id))) return;
    const G = this.G, S = this.S; const T = TALK[id] || {}; const firstMeet = !S.met[id];
    G.talkFrame(id); this.ui.letterbox(true);
    if (S.flags.festival) { await this.festivalLine(id); }
    else {
      let script;
      if (this.ret) script = this.ret.script(id);
      else if (id === 'rue' && S.day === 2 && S.flags.rue_invite && !S.flags.rue_pond && G.npcs.rue.place === 'town' && G.zone === 'farend') script = G.settings.rueScenes === 'summary' ? T.pondSummary : T.pond;
      else if (id === 'rue' && !S.flags.rue_pitched) { S.flags.rue_pitched = 1; script = T.pitch; }
      else if (id === 'bea' && S.flags.bea_bus && !S.flags.bea_bus_told && S.day === 1) { S.flags.bea_bus_told = 1; script = T.bus1; }
      else if (S.talked[id]) script = T.again;
      else script = T['d' + S.day] || T.again;
      S.talked[id] = true;
      await this.run(script, { npc: id });
      if (script === T.pond || script === T.pondSummary) { await G.stage.fadeTo(1, 500); G.advance(45); S.rue = this.rueState(); this.ui.hideDialog(); await G.stage.fadeTo(0, 500); }
      if (id === 'gil' && !this.ret) await this.officeApproval();
      const asks = Object.keys(SIM.FIXES).filter((f) => ['proposal', 'ready'].includes(SIM.fixState(S, f)) && SIM.FIXES[f].backers.includes(id) && !(S.support[f] || []).includes(id) && T.back && T.back[f]);
      if (asks.length) {
        const k = await this.choose(asks.map((f) => ({ t: 'Ask ' + CAST[id].name + ' to back the ' + SIM.FIXES[f].short, sub: this.backerTold(f, id) ? 'it pinches them too' : this.gwOf(id) >= 1 ? 'goodwill ' + this.dots(this.gwOf(id)) + '; this uses one' : this.ret ? 'no goodwill to spare today' : 'not enough goodwill yet', id: 'back_' + f })).concat([{ t: 'That is all for now', id: 'back_none' }]));
        if (k < asks.length) await this.askBacker(asks[k], id);
        // Gil just put his name to a Works fix: he's right here, so he can sign it off too
        if (id === 'gil' && !this.ret && k < asks.length && SIM.fixState(S, asks[k]) === 'ready') await this.officeApproval([asks[k]]);
      }
      if (firstMeet && S.met[id]) await this.likingGap(id);
    }
    this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
    if ((this.revealQ || []).length) await this.flushReveals();
  }
  // a backer who told you about the problem backs it for free; anyone else spends a little goodwill, or asks you to wait
  backerTold(f, id) {
    const S = this.S; if (((S.ideaFrom || {})[f] || []).includes(id)) return true;
    const k = (S.know || {})[id] || {}; return !!(k.over || k.under) && (SIM.FIXES[f].helps || []).includes(id);
  }
  async askBacker(f, id) {
    const S = this.S, T = TALK[id] || {}; if (!T.back || !T.back[f]) return;
    if (this.backerTold(f, id)) { await this.say(id, MINE_TOO[id] || 'This one\'s for me too.'); await this.run(T.back[f], { npc: id, back: true }); return; }
    if (this.gwOf(id) >= 1) { S.gw[id] = this.gwOf(id) - 1; await this.run(T.back[f], { npc: id, back: true }); return; }
    await this.say(id, this.ret ? 'Not today. I\'ve said yes to enough this week.' : 'Ask me again when I know you better.');
  }
  capLine() { return SIM.capText(this.S); }
  async proposals() {
    const S = this.S, G = this.G;
    const ideas = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'idea');
    if (!ideas.length && !Object.keys(S.fixes).length) { await this.say('clover', 'Nothing yet? Not yet is fine. Not yet never means no. Notice what pinches, or listen: people tell you, if you let them.'); this.know('clover', 'no'); return; }
    if (ideas.length && SIM.approvedCount(S) >= SIM.SEASON_CAP) { await this.say('clover', 'That\'s the season\'s two. The rest wait for next year. I\'ll keep them on file.'); for (const f of ideas) S.fixes[f] = 'onfile'; return; }
    // the first idea gets the whole walk-through; after that, Clover keeps it short
    let n = 0;
    for (const f of ideas) {
      const F = SIM.FIXES[f]; const full = !S.flags.cloverWalk; const draw = BLUEPRINTS[f] || f === 'plain';
      await this.say('clover', (n === 0 ? 'The ' + F.short + '? Ooh. Let me sketch it.' : 'And the ' + F.short + '.') + (draw ? (n === 0 ? ' Actually, you sketch it. I\'ll hold the pencil sharpener.' : ' You sketch, I\'ll sharpen.') : ''));
      n++;
      // some fixes are worked out on paper first: a zoning puzzle, or a plain note
      if (draw) {
        this.ui.hideDialog(); this.ui.letterbox(false);
        const r = await (f === 'plain' ? new PlainNote(G) : new Blueprint(G, f)).run();
        this.ui.letterbox(true);
        const met = S.day >= 3 || S.flags.councilDone;
        if (r && r.zoned) await this.say('clover', f === 'plain' ? 'One line. Who, what, by when. I want to frame it.' : met ? 'Fits more of us than before. This one goes on top of the pile for next season.' : 'Fits more of us than before. That one will stand up at the meeting.');
      }
      S.fixes[f] = 'proposal'; G.audio.sfx('ink'); this.fieldNote('ud'); this.know('clover', 'helps'); if ((S.sketch || {})[f] === 'zoned') this.fieldNote('zoning');
      S.gw.clover = Math.min(3, this.gwOf('clover') + 1);
      // whoever it costs will come and find you; a sketch that already zones has thought of them
      S.stakes = S.stakes || {}; S.stakeDue = S.stakeDue || {};
      if ((f === 'quiet' || f === 'dim') && (S.sketch || {})[f] === 'zoned') S.stakes[f] = 'listened';
      S.stakeDue[f] = S.day * 1440 + Math.round(S.min) + 30;
      this.ui.toast(`<b>New proposal</b><br>${F.name}`, 'idea');
      if (!BLUEPRINTS[f] && f !== 'plain' && !S.lantern.entries.clover_six && S.min < 1050) await this.hint('clover_six');
      const meet = S.day === 1 ? 'the town meeting tomorrow at six' : S.day === 2 && !S.flags.council ? 'the town meeting tonight at six' : 'next season\'s meeting';
      // (when Clover is one of the backers, she puts her own name on it rather than asking you to ask her)
      const others = F.backers.filter((b) => b !== 'clover'); const mine = F.backers.includes('clover');
      const then = F.approve === 'gil' ? 'Then show Gil, or bring it to ' + meet + '.' : 'Then it goes to ' + meet + '.';
      if (full) await this.say('clover', 'Who else does it pinch? ' + (others.length ? 'I\'d ask ' + NAMES(others) + '. ' : '') + (mine ? 'I\'ll put my own name on it. ' : '') + then);
      else await this.say('clover', (others.length ? 'Ask ' + NAMES(others) + '. ' : '') + (mine ? 'My name\'s on it. ' : '') + then);
      if (mine) { if (TALK.clover.back && TALK.clover.back[f]) await this.run(TALK.clover.back[f], { npc: 'clover', back: true }); else this.addBacker(f, 'clover'); }
      const who = CAST[STAKES[f].who].name; const heard = S.stakes[f] === 'listened';
      await this.say('clover', heard ? 'Your sketch already makes room for ' + who + '. Expect a thank-you.' : full ? 'And somebody always loses something. ' + who + ' will want a word. Listen, and then decide.' : who + ' will want a word.');
      S.flags.cloverWalk = 1;
    }
    if (!ideas.length) await this.say('clover', 'Nothing new to sketch. Your proposals are on your phone, under Fix-It. ' + this.capLine());
  }
  // whoever a fix costs walks up to you, a little while after the sketch, wherever you are in town
  stakeVisit() {
    const G = this.G, S = this.S; if (!S.stakeDue || G.loc !== 'town') return null;
    const nowAbs = S.day * 1440 + S.min; const me = G.player.root.position;
    for (const f of Object.keys(S.stakeDue)) {
      const st = SIM.fixState(S, f);
      if (!['proposal', 'ready'].includes(st)) { delete S.stakeDue[f]; const v = G.npcs[STAKES[f].who]; if (v && v.visitFix === f) { v.visit = false; v.visitPos = null; } continue; }
      if (nowAbs < S.stakeDue[f] || S.min >= 1260) continue;
      if (STAKES[f].call) return f;
      const who = STAKES[f].who; const n = G.npcs[who]; if (!n || n.place === 'away') continue;
      if (Object.values(G.npcs).some((q) => q.visit && q !== n)) return null; // one at a time
      if (!n.visit) { n.visit = true; n.visitPos = n.place === 'town' ? [n.c.root.position.x, n.c.root.position.z] : this.visitFrom(who); n.visitFix = f; n.visitT = 0; n.visitAt = now(); }
      const q = n.c.root.position;
      if (n.place === 'town' && Math.hypot(q.x - me.x, q.z - me.z) < 2.3) return f;
      // still not caught up after a while: they call out, and you stop for them
      if (n.place === 'town' && now() - (n.visitAt || now()) > (FAST ? 4000 : 14000)) { n.c.root.position.set(me.x + 1.6, 0, me.z + 0.8); n.visitPos = [me.x + 1.6, me.z + 0.8]; this.ui.bubble(who, 'Got a minute? About the ' + SIM.FIXES[f].short + '.', { tint: CAST[who].tint, ms: 2400 }); return f; }
      // follow you at a walk, aiming a step to your side
      if (Math.hypot(n.visitPos[0] - me.x, n.visitPos[1] - me.z) > 1.6 && (n.visitT = (n.visitT || 0) + 1) % 20 === 0) n.visitPos = [me.x + 1.1, me.z + 0.6];
      return null;
    }
    return null;
  }
  visitFrom(who) { const sp = this.G.town.spots; return { fen: [12, 13.8], dot: [12, 13.8], gil: [12, 13.8], hollis: sp.hallSteps, pomeroy: sp.apples || sp.squareW, bea: sp.house3 || sp.home }[who] || sp.square; }
  async stakeTalk(f) {
    const G = this.G, S = this.S, T = STAKES[f], who = T.who, n = G.npcs[who];
    if (T.call) await this.note('Your phone rings. A calm voice you might have heard before.'); else G.talkFrame(who);
    this.ui.letterbox(true);
    if (S.stakes[f] === 'listened' && T.thanks) { await this.say(who, T.thanks); this.log('stake', { z: SIM.FIXES[f].zone, v: 'listened', by: 'you', pay: ['you'] }); }
    else {
      await this.run(T.talk, { npc: who });
      const k = await this.choose([{ t: 'Change the design', sub: T.change, id: 'stake_change' }, { t: 'Keep it as it is', sub: T.keep, id: 'stake_keep' }]);
      S.stakes[f] = k === 0 ? 'listened' : 'overruled';
      const r = k === 0 ? T.listened : T.overruled; await this.say(r.who, r.t);
      this.log('stake', { z: SIM.FIXES[f].zone, v: S.stakes[f], by: 'you', pay: k === 0 ? ['you'] : [who] });
    }
    delete S.stakeDue[f]; if (n) { n.visit = false; n.visitPos = null; }
    this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
  }
  async busEvent() {
    const G = this.G, S = this.S;
    G.audio.announce('attention route twelve diverted via elm street this evening');
    await this.ui.caption('A crackle from the speaker, aimed at the road. Something about the route.', 2600);
    G.busSkip = true;
    // the one thing Blend does that plainly helps: it listens to the speaker and writes it down for you
    const heard = S.blend.has && !S.blend.deleted;
    if (heard) { const t = 'Heard the speaker for you: "Route twelve is going via Elm Street this evening."'; this.text('Blend', t, true); this.ui.toast('<b>Blend</b><br>' + t, 'blend', 5600); S.flags.blend_heard = 1; }
    await sleep(2500);
    S.flags.bea_bus = 1;
    if (G.npcNear('bea', 'transit')) await this.talkTo('bea');
    else { await this.note(heard ? 'The 5:40 sails past without stopping. Your phone told you why. Nobody else at the bench is sure.' : 'The 5:40 sails past without stopping. Nobody at the bench is sure why.'); this.ui.hideDialog(); S.flags.told_board = 1; }
    if (sens(S, 'change') || sens(S, 'sound')) { await this.ui.line({ kind: 'notice', label: DIM_LABEL.change, text: NOTICE.transit.change }); this.ui.hideDialog(); S.flags.told_board = 1; }
  }
  async exhausted() {
    const G = this.G, S = this.S;
    await this.gut('You hit a wall. Everything is too much and also too far away.');
    this.ui.hideDialog();
    // Tuesday before the meeting, or festival day: you sleep it off, and the evening still happens
    const meeting = S.day === 2 && !S.flags.councilDone && S.min < 1080, festival = S.day === 3;
    // the meeting is less than an hour away: you rest at the back of the Town Hall instead, and the gavel wakes you
    if (meeting && S.min >= 1020) {
      if (G.loc !== 'hall') await G.enterRoom('hall');
      S.min = Math.max(S.min, 1078); S.flags.remind = 1; S.energy = Math.max(S.energy, 40); S.self = clamp(S.self + 2, 0, 100);
      await this.note('You find a chair at the back of the Town Hall and close your eyes. The gavel wakes you.'); this.ui.hideDialog();
      return;
    }
    if (meeting || festival) {
      await G.stage.fadeTo(1, 700);
      G.setLoc('home'); G.place(G.rooms.home.spots.bed); { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
      const slept = Math.max(meeting ? 1035 : 1125, S.min) - S.min;
      S.min = Math.max(S.min, meeting ? 1035 : 1125); S.energy = Math.max(S.energy, 45); S.self = clamp(S.self + 4, 0, 100);
      this.log('missed', { z: 'home', v: 'afternoon', pay: ['you'] });
      await G.stage.fadeTo(0, 700);
      await this.note((slept >= 150 ? 'You sleep through the afternoon.' : 'You sleep for a while.') + (meeting ? ' The meeting is at six.' : ' The festival is at eight.')); this.ui.hideDialog();
      return;
    }
    await this.goHome('exhausted');
  }
  async goHome(why) {
    const G = this.G, S = this.S;
    if (why === 'late' || why === 'exhausted') { await G.stage.fadeTo(1, 700); }
    this.finishDay(why);
  }
  // once people know you, they start to adjust before you ask (returns true if it happened)
  unasked(zone) {
    const G = this.G, S = this.S; const U = UNASKED[zone]; if (!U || (S.day < 2 && !this.ret) || zone === 'works') return false;
    const who = U.who; const key = S.day + ':' + zone; S.unaskedDone = S.unaskedDone || {};
    if (S.unaskedDone[key] || (G.zoneTime || 0) < 0.3 || !G.npcNear(who, zone)) return false;
    const b = S.bonds[who] || 0; if (!(b >= 2 || (b >= 1 && this.known(who) >= 2))) return false;
    const p = SIM.pinch(S, zone, S.min, G.subFor(zone)); if (p.total < 0.12) return false;
    const top = p.top || 'sound'; const line = p.dims[top] && p.dims[top].under > 0 ? (S.day >= 3 && U.under3) || U.under : U.over;
    // people can turn a speaker down or a lamp up, or keep you company; they can't move the clock or change how a place talks
    if (!['sound', 'light', 'people'].includes(top)) return false;
    S.unaskedDone[key] = 1; S.mods[zone] = S.mods[zone] || {};
    for (const d of ['sound', 'light', 'people']) if (p.dims[d].over > 0) S.mods[zone][d] = (S.mods[zone][d] || 0) - 0.35; else if (p.dims[d].under > 0) S.mods[zone][d] = (S.mods[zone][d] || 0) + 0.3;
    S.handled[S.day + ':' + zone] = 1;
    G.ui.bubble(who, line, { tint: CAST[who].tint, ms: 6000 }); G.audio.voice(CAST[who].voice[0], CAST[who].voice[1], line); G.ui.announce(CAST[who].name + ': ' + line);
    this.keep('unasked_' + who, CAST[who].name + ' adjusted before you asked', CAST[who].look.color); this.fieldNote('responsive');
    this.log('barrier', { z: zone, v: 'ask', by: who, pay: [who], dim: top, dir: p.dims[top] && p.dims[top].under > 0 ? 'under' : 'over', f: { unasked: 1 } });
    return true;
  }
  // a bench: rest works when the place fits you, and only a little when it does not
  async sit(id) {
    const G = this.G, S = this.S;
    const p = SIM.pinch(S, G.zone, S.min, G.sub); const fits = p.total < 0.15; const pond = id === 'bench_pond';
    await this.note(pond ? 'You sit by the pond. Reeds, still water, one frog with opinions.' : 'You sit for a while and watch Larkspur go by.');
    this.ui.hideDialog(); G.advance(40); S.stats.sat++;
    if (fits) { S.energy = clamp(S.energy + (pond ? 18 : 14), 0, S.maxE); S.self = clamp(S.self + 2, 0, 100); this.keep('sat_' + id, pond ? 'A quiet while by the pond' : 'A bench that fit', '#9fd3b0'); if (pond) { this.fieldNote('nature'); this.fieldNote('birdsong'); } }
    else { S.energy = clamp(S.energy + 4, 0, S.maxE); this.ui.toast('A short rest. This spot does not quite fit you right now, so it only helps a little.', '', 3600); }
  }
  // the pond: catch and release, and it goes quiet by itself after a few
  async fish() {
    const G = this.G, S = this.S; S.pondDay = S.pondDay || {};
    if ((S.pondDay[S.day] || 0) >= 3) { await this.note('The pond is still. The fish have had enough company for one day, and so, maybe, have you.'); this.ui.hideDialog(); return; }
    const p = SIM.pinch(S, G.zone, S.min); const fits = p.total < 0.15;
    const g = new PondGame(G); g.prior = S.pondDay[S.day] || 0; g.limit = 3 - g.prior;
    const r = await g.run();
    S.pondDay[S.day] = (S.pondDay[S.day] || 0) + (r.n || 0);
    G.advance(15 + 10 * (r.n || 0)); S.stats.sat++;
    if (fits) { S.energy = clamp(S.energy + 10 + 4 * (r.n || 0), 0, S.maxE); S.self = clamp(S.self + 2, 0, 100); this.fieldNote('nature'); this.keep('pond_quiet', 'A quiet while by the pond', '#9edcd6'); }
    else this.ui.toast('Fun, but this spot is a bit too ' + (p.dims.sound.under + p.dims.people.under > 0.05 ? 'quiet' : 'much') + ' for you to really rest here.', '', 3600);
    this.fieldNote('birdsong');
  }
  eveningData(d) {
    const S = this.S; const s0 = S.dayStats || {}; const c = {};
    for (const k of ['bend', 'gear', 'ask', 'fix', 'leave']) c[k] = Math.max(0, (S.stats[k] || 0) - (s0[k] || 0));
    c.bend += Math.max(0, (S.stats.smooth || 0) - (s0.smooth || 0));
    const news = [];
    const met = Object.keys(S.met).filter((k) => CAST[k] && !(S.metAt0 || []).includes(k)).map((k) => CAST[k].name);
    if (met.length) news.push('You met ' + (met.length > 1 ? met.slice(0, -1).join(', ') + ' and ' + met[met.length - 1] : met[0]) + '.');
    for (const f of Object.keys(S.fixes)) { const was = (S.fixAt0 || {})[f]; const now = S.fixes[f]; if (was === now) continue; const F = SIM.FIXES[f]; if (now === 'approved') news.push(((S.fixVia || {})[f] === 'owner' ? 'Gil approved the ' + F.short + '.' : 'The town meeting voted for the ' + F.short + '.') + ' It goes up overnight.'); else if (now === 'built') news.push('The ' + F.short + ' ' + SIM.agree(f, 'is', 'are') + ' built.'); else if (now === 'ready') news.push('The ' + F.short + ' ' + SIM.agree(f, 'has its', 'have their') + ' two backers.'); else if (now === 'proposal' && was !== 'ready') news.push('Clover sketched the ' + F.short + '.'); else if (now === 'idea' && !was) news.push('You noticed something worth fixing: the ' + F.short + '.'); }
    const PR = { she: ['she', 's'], he: ['he', 's'] }[S.pronoun] || ['they', ''];
    for (const id of S.hearsay || []) { const g = (S.lg || {})[id]; news.push(LIKED[id].replace(/\{they\}/g, PR[0]).replace(/\{s\}/g, PR[1]) + (g === 0 ? ' (You thought it went a bit awkwardly.)' : g === 1 ? ' (You thought it went fine.)' : '')); if (g === 0 || g === 1) this.fieldNote('liked'); }
    S.hearsay = [];
    const n = (S.jar || []).length;
    const title = c.fix + c.ask > c.bend && c.fix + c.ask > 0 ? 'You changed something today.' : c.bend >= 3 ? 'You carried a lot today.' : c.leave >= 2 ? 'You looked after yourself today.' : 'A day in Larkspur.';
    const tomorrow = d === 1 ? ['Weekly sync at the Works, 9:00.', 'Town meeting at 6 PM. Proposals with two backers get a vote.'] : d === 2 ? ['Festival day. The Works opens 9 to 11 for festival mail.', 'The Lantern Festival at 8 PM.'] : [];
    const nb = S.notesNew || 0;
    return { day: ['', 'Monday', 'Tuesday', 'Wednesday'][d], title, counts: c, jar: S.jar || [], jarMax: 12, jarText: n >= 12 ? 'Full, and glowing.' : n + ' of 12. It does not need to be full.', news, open: this.openThread(), tomorrow, notebook: nb ? 'New in your notebook: ' + nb + (d === 1 && S.flags.autismOpen ? ', including where this game\'s question came from.' : '.') : '' };
  }
  // ---------- nights ----------
  async night(d) {
    const G = this.G, S = this.S;
    await G.stage.fadeTo(1, 600);
    G.setLoc('home'); G.place(G.rooms.home.spots.mirror); G.player.heading = 0.6 - Math.PI; S.min = Math.max(S.min, 1290);
    this.ui.hud(false);
    G.stage.shot(new THREE.Vector3(0.6, G.tall ? 2.6 : 1.9, G.tall ? 4.4 : 3.2), new THREE.Vector3(2.4, 0.75, -0.6), G.tall ? 46 : 34, 3, true);
    G.audio.setScene('night');
    await G.stage.fadeTo(0, 700);
    const dr = G.drift();
    await this.gut(this.dayEndWhy === 'exhausted' ? 'You made it home. Barely. The mirror is kind about it.' : dr > 0.45 ? 'In the mirror your colors look washed out, as if someone turned you down.' : dr > 0.18 ? 'Your reflection looks a little faded tonight. Probably the light.' : 'You look like yourself. That took some doing today.');
    this.ui.hideDialog();
    if (d === 1 && S.flags.rue_cracked) S.flags.rue_invite = 1;
    for (const [w, t] of NIGHT[d](S)) { this.text(w, t); await sleep(1100); }
    await sleep(600);
    this.fieldNote('endings'); if (d === 1) { this.fieldNote('made'); this.openAutism(); }
    await this.ui.evening(this.eveningData(d));
    S.notesNew = 0;
    const r = SIM.nightUpdate(S);
    if (S.blend.has && !S.blend.deleted && S.blend.streak >= 1) this.fieldNote('streaks');
    if (S.blend.has && S.blend.smooth && !S.blend.deleted) S.self = clamp(S.self - 2, 0, 100);
    if (r.lostStreak) { this.text('Blend', BLEND.lose); this.fieldNote('dark'); }
    await sleep(900);
    await G.stage.fadeTo(1, 900);
    await this.ui.caption('Night.', 1200);
  }

  // ---------- the town meeting (Tuesday at six) ----------
  async council() {
    const G = this.G, S = this.S, ui = this.ui;
    const waited = G.loc === 'hall';
    await G.stage.fadeTo(1, 500);
    if (G.loc !== 'hall') { await G.enterRoom('hall', true); }
    G.stage.fadeTo(0, 600);
    G.audio.setScene('council');
    G.placeCouncil();
    G.walkTo(...G.rooms.hall.spots.lectern);
    await sleep(700);
    S.handled[S.day + ':hall'] = 1;
    // waiting in the hall, you already chose how to handle what pinches here: the same pinch doesn't ask twice
    const before = waited && (S.log || []).filter((r) => r.k === 'barrier' && r.z === 'hall' && r.d === S.day).pop();
    const top0 = SIM.pinch(S, 'hall', S.min, G.subFor('hall')).top;
    const res = before && ['bend', 'gear', 'ask'].includes(before.v) && before.dim === top0 ? before.v : await this.barrier('hall');
    if (res === 'leave') { S.flags.councilLeft = 1; await this.note('You slip out before your name is called. Behind you, Hollis clears his throat.'); ui.hideDialog(); await this.leftMeeting(); return; }
    ui.letterbox(true);
    G.stage.shot(new THREE.Vector3(4.6, 3.1, 2.2), new THREE.Vector3(-0.6, 1.05, -3.1), 36, 2);
    await this.run(this.ret ? COUNCIL.openFest : COUNCIL.open); this.know('hollis', 'over');
    // the chamber has a rule about keeping still; it comes up once, and only if your comfort move is playing here
    if (!S.flags.ruleAsked && G.player.comfortLevel > 0 && !(S.masking && S.maskZone === 'hall')) {
      S.flags.ruleAsked = 1; await this.say(COUNCIL.rule.who, COUNCIL.rule.t);
      const k = await this.choose(COUNCIL.ruleAsk);
      if (k === 0) { S.masking = true; S.maskZone = 'hall'; this.log('barrier', { z: 'hall', v: 'bend', by: 'rules', pay: ['you'] }); }
      else await this.say(COUNCIL.ruleMove.who, COUNCIL.ruleMove.t);
    }
    if (this.ret && this.ret.A.council) await this.ret.A.council(this.ret);
    // proposals that came without two backers aren't voted on: Clover says which, and what each still needs
    await this.notReady();
    const ready = await this.budget();
    if (!ready.length && !Object.values(S.fixes).some((v) => v === 'onfile') && !(this.ret && this.ret.A.council)) await this.run(this.ret ? COUNCIL.noneFest : COUNCIL.none);
    for (const f of ready) { if (S.v2 && !this.ret && HEARINGS[f]) await this.hearOn(f); else await this.voteOn(f, null); }
    ui.hideDialog(); ui.letterbox(false);
    S.min = Math.max(S.min, 1140); S.flags.councilDone = 1;
    await G.stage.fadeTo(1, 600);
    await G.exitRoom(true);
    this.saveNow('meeting', S.day);
    // the first visit's Tuesday ends with the meeting; a return visit's festival is still to come
    if (!this.ret) this.finishDay('meeting');
  }
  async notReady() {
    const S = this.S; const pend = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'proposal'); const raw = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'idea');
    if (!pend.length && !raw.length) return;
    const n = (f) => ['none', 'one'][Math.min(1, SIM.supporters(S, f))] || 'one';
    const works = pend.some((f) => SIM.FIXES[f].approve === 'gil');
    const it = (k) => (k > 1 ? 'They go' : 'It goes');
    let t = pend.length ? 'Before the vote: a proposal needs two backers to get one. ' + pend.map((f) => 'The ' + SIM.FIXES[f].short + ' has ' + n(f) + '.').join(' ') + ' ' + (this.ret ? it(pend.length) + ' on file for next year. ' : works ? it(pend.length) + ' on file. Gil can still sign off a Works fix tomorrow, if it finds its backers. ' : it(pend.length) + ' on file for next season. ') : '';
    if (raw.length) t += (pend.length ? 'And your ' : 'Your ') + (raw.length > 1 ? 'ideas for ' : 'idea for ') + LIST(raw.map((f) => 'the ' + SIM.FIXES[f].short)) + ' never made it to the Shed. ' + (this.ret ? it(raw.length) + ' on file for next year.' : 'Bring ' + (raw.length > 1 ? 'them' : 'it') + ' by tomorrow, and I\'ll put ' + (raw.length > 1 ? 'them' : 'it') + ' on file for next season.');
    await this.say('clover', t.trim());
  }
  voters() { return this.ret ? this.ret.voters() : ['pip', 'clover', 'hollis']; }
  // more ready proposals than the season's budget: you choose which go forward, the rest go on file
  async budget() {
    const S = this.S;
    let ready = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'ready');
    if (!ready.length) return [];
    const room = SIM.SEASON_CAP - SIM.approvedCount(S);
    if (room <= 0) { await this.say('hollis', COUNCIL.budget0); for (const f of ready) S.fixes[f] = 'onfile'; return []; }
    if (ready.length > room) {
      await this.say('hollis', room === 1 ? COUNCIL.budget1 : COUNCIL.budget2);
      const chosen = [];
      while (chosen.length < room) { const left = ready.filter((f) => !chosen.includes(f)); const k = await this.choose(left.map((f) => ({ t: 'Present the ' + SIM.FIXES[f].short, id: 'pick_' + f }))); chosen.push(left[k]); }
      for (const f of ready) if (!chosen.includes(f)) S.fixes[f] = 'onfile';
      ready = chosen;
    }
    return ready;
  }
  // how each of the three would vote, and why (see the leaning lines)
  votesFor(f, frame) {
    const S = this.S; const stake = (S.stakes || {})[f] || 'unasked'; const dep = S.blend.dep || 0;
    const foot = f === 'board' || f === 'ramp' || (f === 'quiet' && stake === 'listened');
    // (whoever the fix costs, if you changed the design for them, votes for it: they said what would make it work)
    const heard = (who) => stake === 'listened' && STAKES[f] && STAKES[f].who === who;
    const v = {
      pip: foot || frame === 'many' || (S.bonds.pip || 0) >= 2 || heard('pip'),
      clover: stake === 'listened' && SIM.supporters(S, f) >= 2,
      rue: stake === 'listened' && SIM.supporters(S, f) >= 2,
      hollis: !!S.flags.hollis_archive || (S.bonds.hollis || 0) >= 2 || (frame === 'need' && (S.bonds.hollis || 0) >= 1) || (S.sketch || {})[f] === 'zoned' || heard('hollis'),
    };
    if (f === 'quiet' && stake === 'overruled') v.pip = false;
    // Blend's scores say everyone is coping; unless someone says otherwise, Pip needs the numbers argument
    if (dep >= 4 && !S.flags.rueSpoke) v.pip = v.pip && frame === 'many';
    return v;
  }
  async voteOn(f, presenter) {
    const G = this.G, S = this.S; const F = SIM.FIXES[f]; const stake = (S.stakes || {})[f] || 'unasked';
    await this.say(presenter || 'you', COUNCIL.present[f]);
    const voters = this.voters();
    // the Founders' Fund's clause (twenty years on): a project on Founders' Row needs its sign-off, and stalls without it
    if (F.founders && (S.w || {}).benefactor_yes) {
      await this.say(this.ret && this.ret.act === 3 ? 'rue' : COUNCIL.clause.who, COUNCIL.clause.t); await this.say(COUNCIL.stalled.who, COUNCIL.stalled.t);
      S.fixes[f] = 'onfile'; this.log('vote', { z: F.zone, v: 'stalled', by: 'fund', pay: ['you'].concat(S.support[f] || []), verb: 'The Fund\'s clause stalled the ' + F.short + '. Referred for further study.' }); this.fieldNote('blocking'); this.fieldNote('waiting');
      return false;
    }
    for (const who of ['pip', 'hollis', voters[1]]) await this.say(who, COUNCIL.lean[who]);
    let frame = 'voices';
    if (!presenter) { const k = await this.choose(COUNCIL.frame.map((x) => ({ t: x.t, id: 'frame_' + x.key }))); frame = COUNCIL.frame[k].key; }
    if (frame === 'voices' || frame === 'many') for (const b of S.support[f] || []) { if (b === presenter) continue; const line = (TALK[b].back[f] || []).find((n) => n.who); if (line) await this.say(b, line.t); }
    if (frame === 'need') await this.say('you', 'This is not a favor. I live here too.');
    if ((S.blend.dep || 0) >= 4 && !S.flags.blendArgued) {
      S.flags.blendArgued = 1; await this.say('hollis', ((this.ret && this.ret.A.blendArg) || COUNCIL.blendArg).t);
      if (this.rueState() === 'easing' && !S.flags.rueSpoke && G.npcs.rue.place === 'hall') await this.rueTestimony();
    }
    const votes = this.votesFor(f, frame);
    if ((S.sketch || {})[f] === 'zoned' && !S.flags.hollis_archive && (S.bonds.hollis || 0) < 2) await this.say('hollis', 'A sketch where every single person has a place that fits. I can hardly argue with that. I have tried.');
    let yes = 0;
    for (const who of voters) {
      const V = COUNCIL.votes[who];
      const line = votes[who] ? (V.heard && stake === 'listened' && STAKES[f] && STAKES[f].who === who ? V.heard : who === 'hollis' && !S.flags.hollis_archive ? V.yesPlain : V.yes) : who === 'pip' && f === 'quiet' && stake === 'overruled' ? V.neighbour : (who === 'clover' || who === 'rue') && stake === 'overruled' ? V.overruled : V.no;
      await this.say(who, line); if (votes[who]) yes++; else if (who === 'clover') this.know('clover', 'no');
    }
    if (yes >= 2) {
      await this.say('hollis', this.ret ? (F.inplace ? COUNCIL.passedRule : COUNCIL.passedTonight) : COUNCIL.passed); if (voters.includes('clover')) await this.say('clover', F.inplace ? COUNCIL.passedCloverRule : COUNCIL.passedClover); else await this.say('rue', 'I\'ll write the plain note tonight. Who, what, by when.');
      this.approve(f, 'meeting', !presenter); G.audio.sfx('fix'); this.fieldNote('curb'); this.keep('built_' + f, 'The ' + F.short + ', voted through', '#9fd3b0');
      if (this.ret) { S.fixes[f] = 'built'; G.applyFix(f); }
      this.log('vote', { z: F.zone, v: 'passed', by: 'meeting', pay: stake === 'listened' ? [] : [STAKES[f].who], verb: 'The ' + F.short + ' ' + SIM.agree(f, 'was', 'were') + ' voted through.' });
    } else { await this.say('hollis', COUNCIL.failed); S.fixes[f] = 'onfile'; this.log('vote', { z: F.zone, v: 'failed', by: 'meeting', pay: ['you'], verb: 'The ' + F.short + ' didn\'t pass. ' + SIM.agree(f, 'It', 'They') + ' went on file.' }); }
    return yes >= 2;
  }
  // the new game's town meeting: each proposal gets a hearing (hearing.js), argued with the cards you hold
  async hearOn(f) {
    const G = this.G, S = this.S, ui = this.ui; const F = SIM.FIXES[f]; const stake = (S.stakes || {})[f] || 'unasked';
    await this.say('you', COUNCIL.present[f]);
    ui.hideDialog(); ui.hud(false); ui.letterbox(false);
    const gallery = ['bea', 'gil', 'moss', 'rue', 'wren'].filter((id) => G.npcs[id] && G.npcs[id].place === 'hall');
    const h = new Hearing(G, HEARINGS[f], { gallery: gallery.length ? gallery : ['bea'] }); this.hearingNow = h;
    const r = await h.run(); this.hearingNow = null;
    ui.hud(true); ui.letterbox(true);
    if (r.passed) {
      await this.say('hollis', COUNCIL.passed); await this.say('clover', COUNCIL.passedClover);
      this.approve(f, 'meeting', true); G.audio.sfx('fix'); this.fieldNote('curb'); this.keep('built_' + f, 'The ' + F.short + ', voted through', '#9fd3b0');
      this.log('vote', { z: F.zone, v: 'passed', by: 'meeting', pay: stake === 'listened' ? [] : [STAKES[f].who], verb: 'The ' + F.short + ' ' + SIM.agree(f, 'was', 'were') + ' voted through.' });
    } else {
      await this.say('hollis', COUNCIL.failed); if (r.missing.length && HEARINGS[f].missing[r.missing[0]]) await this.say('clover', 'You were missing ' + HEARINGS[f].missing[r.missing[0]] + '. Bring it back next season.');
      S.fixes[f] = 'onfile'; this.log('vote', { z: F.zone, v: 'failed', by: 'meeting', pay: ['you'], verb: 'The ' + F.short + ' didn\'t pass. ' + SIM.agree(f, 'It', 'They') + ' went on file.' });
    }
    return r.passed;
  }
  approve(f, via, mine) {
    const S = this.S; S.fixes[f] = 'approved'; S.fixAct = S.fixAct || {}; S.fixAct[f] = S.act || 1; S.fixVia = S.fixVia || {}; S.fixVia[f] = via; if (mine) { S.fixMine = S.fixMine || {}; S.fixMine[f] = 1; }
    // Wren makes the porch lanterns, at the price on the sign
    if (f === 'lanterns') { S.w = S.w || {}; S.w.wren_paid = 1; }
  }
  // Rue speaks at the meeting only if she is easing, and only because she wants to
  async rueTestimony() {
    const S = this.S; S.flags.rueSpoke = 1;
    const A = (this.ret && this.ret.A.rueSpeaks) || { sum: 'Rue tells the hall that the streak was hiding some very hard mornings.', lines: COUNCIL.rueSpeaks };
    if (this.G.settings.rueScenes === 'summary') { await this.note(A.sum); return; }
    for (const t of A.lines) await this.say('rue', t);
  }
  // you stepped out: someone who knows you presents for you, or it waits; Clover finds you after
  async leftMeeting() {
    const G = this.G, S = this.S;
    const news = { passed: [], tabled: [], by: {} };
    // the visit's own first item (Act 3's Home Row) comes first, as it does with you in the room
    if (this.ret && this.ret.A.council) { const r = await this.ret.A.council(this.ret, { away: true }); if (r) { for (const f of r.passed || []) { news.passed.push(f); news.by[f] = r.by || 'hollis'; } for (const f of r.tabled || []) news.tabled.push(f); } }
    // the season's budget, without you there to choose: the ones with the most backers go forward, the rest wait
    let ready = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'ready');
    const room = Math.max(0, SIM.SEASON_CAP - SIM.approvedCount(S));
    if (ready.length > room) {
      const order = ready.slice().sort((a, b) => SIM.supporters(S, b) - SIM.supporters(S, a));
      for (const f of order.slice(room)) { S.fixes[f] = 'onfile'; news.tabled.push(f); }
      ready = order.slice(0, room);
    }
    for (const f of ready) {
      const pres = (S.support[f] || []).find((id) => G.npcs[id] && G.npcs[id].place === 'hall') || Object.keys(CAST).find((id) => !CAST[id].minor && (S.bonds[id] || 0) >= 2 && G.npcs[id] && G.npcs[id].place === 'hall');
      if (!pres) { S.fixes[f] = 'onfile'; news.tabled.push(f); this.log('missed', { z: 'hall', v: 'meeting', pay: ['you'].concat(S.support[f] || []) }); continue; }
      const v = this.votesFor(f, 'voices'); const yes = this.voters().filter((w) => v[w]).length;
      news.by[f] = pres;
      const short = SIM.FIXES[f].short;
      if (SIM.FIXES[f].founders && (S.w || {}).benefactor_yes) { S.fixes[f] = 'onfile'; news.tabled.push(f); this.log('vote', { z: SIM.FIXES[f].zone, v: 'stalled', by: 'fund', pay: ['you'], verb: 'The Fund\'s clause stalled the ' + short + '. Referred for further study.' }); continue; }
      if (yes >= 2) { this.approve(f, 'meeting'); if (this.ret) { S.fixes[f] = 'built'; G.applyFix(f); } news.passed.push(f); this.log('vote', { z: SIM.FIXES[f].zone, v: 'passed', by: 'meeting', pay: (S.stakes || {})[f] === 'listened' ? [] : [STAKES[f].who], verb: CAST[pres].name + ' presented the ' + short + ' for you. ' + SIM.agree(f, 'It', 'They') + ' passed.' }); }
      else { S.fixes[f] = 'onfile'; news.tabled.push(f); this.log('vote', { z: SIM.FIXES[f].zone, v: 'failed', by: 'meeting', pay: ['you'], verb: CAST[pres].name + ' presented the ' + short + ' for you. ' + SIM.agree(f, 'It', 'They') + ' didn\'t pass.' }); }
    }
    S.flags.councilDone = 1; S.cloverNews = news; S.cloverAt = S.min + 20;
    await G.exitRoom(true);
    this.saveNow('meeting', S.day);
  }
  async cloverAfter() {
    const S = this.S, n = S.cloverNews || { passed: [], tabled: [], by: {} }; delete S.cloverAt;
    if (this.ret) { const L = n.passed.map((f) => CAST[n.by[f]].name + ' presented the ' + SIM.FIXES[f].short + ' for you. ' + (SIM.FIXES[f].inplace ? SIM.agree(f, 'It passed. It takes', 'They passed. They take') + ' effect tonight.' : SIM.agree(f, 'It passed, and it goes', 'They passed, and they go') + ' up tonight.')).concat(n.tabled.map((f) => 'The ' + SIM.FIXES[f].short + ' ' + SIM.agree(f, 'waits', 'wait') + ' for next year.')); if (L.length) this.text(this.ret.act === 3 ? 'Rue' : 'Clover', L.join(' ')); return; }
    const lines = [];
    for (const f of n.passed) lines.push(CAST[n.by[f]].name + ' presented the ' + SIM.FIXES[f].short + ' for you. ' + SIM.agree(f, 'It', 'They') + ' passed.');
    for (const f of n.tabled) if (n.by[f]) lines.push(CAST[n.by[f]].name + ' presented the ' + SIM.FIXES[f].short + ' for you. Not carried, this time.');
    const tabled = n.tabled.filter((f) => !n.by[f]).length > 0 || (!n.passed.length && !Object.keys(n.by).length);
    if (tabled) { lines.push(COUNCIL.tabledClover); S.w = S.w || {}; S.w.hall_quiet_row = 1; }
    if (!lines.length) return;
    // a door sign that says "text first" gets a text
    if (S.profile.people <= 0.35) { this.text('Clover', lines.join(' ')); return; }
    this.G.npcTo('clover', null);
    await this.say('clover', lines.join(' ')); this.ui.hideDialog();
  }
  // the Standard's room, solved: the plaque says what the Standard was, and every Look again card gains a line
  solveStandard() {
    const S = this.S; S.w = S.w || {}; if (S.w.standard_solved) return; S.w.standard_solved = 1;
    this.keep('standard', 'You found the Standard\'s room', '#d6c6ad');
    for (const id of ['misfit', 'reference', 'ranges', 'average']) this.fieldNote(id);
    this.log('sight', { z: 'market', v: 'standard', by: 'you', pay: [] });
    if (this.G.town.setPlaque) this.G.town.setPlaque(true);
  }
  // ---------- festival day ----------
  // a built fix, used by the people it was for, the first time you pass through its place at its time
  feltDue() {
    const G = this.G, S = this.S; if (S.day !== 3 || S.flags.festival || G.ui.waiter || !G.ui.panel.hidden) return null;
    for (const f of Object.keys(FELT)) {
      if (S.fixes[f] !== 'built' || (S.felt || {})[f]) continue;
      const F = FELT[f];
      if (S.min < F.from || S.min >= F.to) continue;
      const here = F.at === 'works' ? G.loc === 'town' && Math.hypot(G.player.root.position.x - 12, G.player.root.position.z - 13.4) < 5 : F.zone === 'works' ? G.loc === 'works' : G.loc === 'town' && G.zone === F.zone && (!F.sub || G.sub === F.sub);
      if (here) return f;
    }
    return null;
  }
  async felt(f) {
    const S = this.S, F = FELT[f]; S.felt = S.felt || {}; S.felt[f] = 1;
    const lines = f === 'quiet' && (S.stakes || {}).quiet !== 'listened' ? F.hush : f === 'dim' && (S.stakes || {}).dim !== 'listened' ? F.own : F.lines;
    for (const t of lines) await this.note(t);
    this.ui.hideDialog(); this.keep('felt_' + f, F.keep, '#9fd3b0');
  }
  // Tuesday after work: everything that's on this afternoon, and a reminder that it won't all fit
  async afternoon() {
    const S = this.S; const items = [];
    if (this.busList()) items.push({ t: 'The bus stop, with the lantern', sub: 'What pinches people there. A few minutes.' });
    else if (S.v2 && SIM.fixState(S, 'board') === 'idea') items.push({ t: 'Take the bus board to Clover', sub: 'The Fix-It Shed, until six.' });
    if (!S.flags.statue_seen) items.push({ t: 'Clover found something in the loft', sub: 'The Fix-It Shed, until six.' });
    items.push({ t: 'Wren could use a hand folding lanterns', sub: 'The Far End, 2 to 4. About an hour.' });
    if (S.flags.rue_invite) items.push({ t: 'Rue asked to meet at the pond', sub: 'Half past four to half past five. About 45 minutes.' });
    const nb = this.needBackers(); if (nb.length) items.push({ t: 'Find backers for your proposals', sub: 'Two each, before six.' });
    items.push({ t: 'The town meeting', sub: '6 PM, Town Hall. Proposals with two backers get a vote.' });
    await this.ui.today({ day: 'The rest of Tuesday', title: 'You won\'t have time for everything', items, note: 'Whatever you pick, the meeting is at six.', button: 'Go' });
  }
  // Rue's state is her own: she eases off the streak only if you asked, and others are around her too
  rueState() {
    const S = this.S; if (this.ret) return S.rue || S.ruePrev || 'streak';
    if (!S.flags.rue_cracked) return 'streak';
    const near = ['moss', 'wren', 'pip'].filter((id) => (S.bonds[id] || 0) >= 1).length;
    return S.flags.rue_pond || near >= 2 ? 'easing' : 'streak';
  }
  async whoDecided() { await whoDecided(this); }
  // 7:30 on Wednesday: Who decided?, on the walk over, then the festival
  async toFestival() {
    const S = this.S;
    for (const id of Object.keys(S.owe || {})) this.log('favour', { v: 'lapsed', by: id, pay: [] });
    if (this.whoDecided) await this.whoDecided();
    await this.festival();
  }

  // ---------- the Lantern Festival ----------
  async festival() {
    const G = this.G, S = this.S;
    S.flags.festival = 1; G.busy++;
    await G.stage.fadeTo(1, 700);
    if (G.loc !== 'town') G.setLoc('town');
    G.town.setFestival(true); S.min = Math.max(S.min, 1200);
    G.place([30, 34.5]); G.player.heading = Math.PI;
    G.placeFestival();
    G.audio.setScene('festival');
    G.stage.shot(new THREE.Vector3(30, 22, 54), new THREE.Vector3(30, 1, 24), 40, 0.5, true);
    await G.stage.fadeTo(0, 900);
    await this.ui.caption(FESTIVAL.arrive, 3000);
    if (this.ret) await this.ret.festivalExtras();
    G.stage.follow(G.player.root.position, { dist: 15, pitch: 0.8 });
    G.busy--; G.mode = 'play';
    S.handled[S.day + ':festival:3'] = 0;
  }
  async festivalLine(id) {
    if (this.ret) return this.ret.festivalLine(id);
    const S = this.S, L = FESTIVAL.lines, F = S.fixes;
    const pickLine = {
      bea: F.board === 'built' ? L.bea_daughter : L.bea_alone, wren: S.flags.wren_invited ? L.wren_here : L.wren_work, rue: S.flags.rue_free ? L.rue_free : L.rue_streak,
      gil: F.dim === 'built' ? L.gil_dim : F.plain === 'built' ? L.gil_plain : L.gil_same, moss: F.quiet === 'built' ? ((S.stakes || {}).quiet === 'listened' ? L.moss_quiet : L.moss_quiet_hush) : L.moss_same,
      hollis: S.flags.hollis_archive ? L.hollis_new : L.hollis_same, pip: L.pip, clover: L.clover,
    }[id];
    if (pickLine) await this.say(pickLine.who, pickLine.t);
  }
  async finale() {
    const G = this.G, S = this.S;
    if (S.flags.released) return; S.flags.released = 1;
    G.busy++; G.mode = 'cine';
    this.ui.letterbox(true);
    G.walkTo(30, 27.2);
    G.stage.shot(new THREE.Vector3(33, 4, 33), new THREE.Vector3(30, 2.6, 24), 36, 1.2);
    await sleep(1400);
    await this.note(G.drift() > 0.55 ? FESTIVAL.releaseBlend : FESTIVAL.release);
    this.ui.hideDialog();
    const made = S.lanternsMade || [];
    G.town.launchLanterns(G.drift() > 0.55 ? '#d6c6ad' : S.look.color, made.map((m) => m.color));
    setTimeout(() => made.forEach((m, i) => setTimeout(() => { if (G.npcs[m.id] && G.npcs[m.id].place === 'town') G.ui.bubble(m.id, m.score === 3 ? 'That one is mine. Look. That one.' : m.score >= 1 ? 'Is that one for me?' : 'Oh! Someone made one for me.', { tint: CAST[m.id].tint, ms: 4200 }); }, i * 1500)), FAST ? 10 : 2600);
    G.audio.sfx('lantern'); G.audio.sfx('cheer');
    G.stage.shot(new THREE.Vector3(30, 9, 40), new THREE.Vector3(30, 8, 24), 46, 0.35);
    await sleep(FAST ? 200 : 5200);
    G.stage.shot(new THREE.Vector3(30, 46, 58), new THREE.Vector3(30, 14, 22), 50, 0.25);
    await sleep(FAST ? 200 : 6500);
    await G.stage.fadeTo(1, 1400);
    this.finishDay('festival');
  }

  // ---------- the ending ----------
  async ending() {
    const G = this.G, S = this.S;
    const rue = this.rueState(); const key = endingKey(S); const E = (S.v2 && !this.ret && TITLES2[key]) || TITLES[key];
    const after = G.portrait();
    this.openAutism(); this.fieldNote('avatar'); this.fieldNote('nosim');
    // proposals that never got a vote wait for next season
    for (const f of Object.keys(S.fixes)) if (['proposal', 'ready', 'tabled'].includes(S.fixes[f])) S.fixes[f] = 'onfile';
    const carry = buildCarry(S, key, rue);
    // this visit's carry replaces its own slot, and any later visits built on the old one
    const prev = SAVE.readCarry(); const acts = Object.assign({}, (prev.carry && prev.carry.acts) || {}); const n = S.act || 1;
    acts[String(n)] = carry; for (const k of Object.keys(acts)) if (+k > n) delete acts[k]; SAVE.writeCarry({ acts });
    this.carry = carry; this.carryCode = SAVE.encodeVisit(carry);
    G.audio.setScene('title'); this.ui.hud(false); this.ui.letterbox(false); this.ui.clearBubbles();
    await this.ui.ending({ before: S.portrait0 || after, after, title: E.title, text: (S.act || 1) > 1 && E.later ? E.later : E.text, line: specificLine(S, key), remember: remember(S, rue, this.ret ? this.ret.remember() : null), code: this.carryCode, act: S.act || 1, key, card: () => fitCardData(S, G, key) });
  }
}
