// The return visits (Acts 2 and 3): one festival day each, ten and twenty years on. This is the day's engine. It turns
// a carry (what Larkspur remembers) back into a game state, builds the visit's layer of the town, keeps the clock (the
// visit's scenes, the meeting at six, Who decided? at half past seven, the festival at eight) and answers what the
// shared story asks of it: where is everyone, what's next, what does pressing E here do, who votes tonight.
// The visit's people and scenes live in act2.js and act3.js; everything else (talk, cards, the log, votes, Who
// decided?, the festival and the ending) is the same machinery as the first visit.
import * as SIM from './sim.js';
import { CAST, ROUTINES_ACT } from './content.js';
import { clamp, sleep, FAST } from './util.js';
import { townLayer, roomLayer } from './layers.js';
import { ACT2 } from './act2.js';
import { ACT3 } from './act3.js';

export const ACT_MOD = { 2: ACT2, 3: ACT3 };
export const selfStart = (selfEnd) => clamp(100 - (100 - (selfEnd == null ? 100 : selfEnd)) * 0.5, 0, 100);

// A game state for visit `act` from the carry the last visit wrote. Gear doesn't carry (ten years wears things out),
// except that the headphones default puts a pair in your bag. Your name isn't in a carry; the caller asks for it.
export function stateFromCarry(carry, act, seed) {
  const S = SIM.newState(seed); const c = carry || {};
  S.act = act; S.day = 1; S.min = 470; S.carryAct = c.act || act - 1; S.origin = c.origin || (c.w && c.w.recap ? 'recap' : 'carry');
  const look = Object.assign({}, c.look || {}); S.look = Object.assign({}, look, { comfort: c.comfort || 'hum' }); S.look0 = Object.assign({}, c.look0 || look, { comfort: c.comfort || 'hum' });
  S.wheels = !!look.wheels; S.pronoun = c.pronoun || 'they';
  if (c.profile) S.profile = Object.assign({}, S.profile, c.profile);
  // fixes: built ones stand (and were built in an earlier visit); ones on file can come back tonight
  S.fixAct = {}; S.fixVia = {}; S.stakes = {};
  for (const [f, v] of Object.entries(c.fixes || {})) {
    if (!SIM.FIXES[f] || !v) continue;
    if (v.s === 'built') { S.fixes[f] = 'built'; S.fixAct[f] = Math.max(1, Math.min(act - 1, S.carryAct)); S.fixVia[f] = v.via; }
    else if (v.s === 'onfile') S.fixes[f] = 'onfile';
    if (v.listened) S.stakes[f] = 'listened';
  }
  // people: who knows you, and how much goodwill is left (the four who start with one keep at least that)
  for (const [id, p] of Object.entries(c.people || {})) {
    if (!CAST[id]) continue; S.bonds[id] = p.bond || 0; S.gw[id] = Math.max(p.gw || 0, ['gil', 'moss', 'clover', 'hollis'].includes(id) ? 1 : 0);
    if (p.met) S.met[id] = true; if (p.revealed) { S.revealed = S.revealed || {}; S.revealed[id] = 'seen'; }
  }
  S.ruePrev = c.rue || 'streak'; S.rue = S.ruePrev;
  const B = S.blend; B.dep = c.dep || 0;
  if (c.blend === 'kept' || c.blend === 'smooth' || c.blend === 'deleted') { B.has = true; B.smooth = c.blend === 'smooth'; B.deleted = c.blend === 'deleted'; B.score = 40; B.streak = c.blend === 'deleted' ? 0 : 3650; }
  if (c.default === 'blend_off' && B.has) { B.deleted = true; B.smooth = false; }
  S.self = selfStart(c.selfEnd); S.carryDefault = c.default || 'as_is'; S.carryHabit = c.pushHabit || 'none'; S.pushHabit = S.carryHabit;
  S.w = Object.assign({}, c.w || {}); S.tallyPrev = Object.assign({}, c.tally || {}); S.endingsPrev = Object.assign({}, c.endings || {}); S.jarPrev = c.jar || 0;
  // you kept Wren's lantern; you know what the Standard was if you worked it out
  S.flags.lantern = 1; S.flags.lanternMeta = 1; if (S.w.standard_solved) S.flags.statue_seen = 1; if (S.w.hollis_archive) S.flags.hollis_archive = 1;
  if (c.default === 'headphones_market') S.gear.headphones = true;
  S.coins = 20;
  return S;
}

// for tests (__wb.gotoAct) and the recap: a plausible carry from a first visit, overridable field by field
export function sampleCarry(o = {}) {
  const look = { shape: 'round', color: '#93c2ee', pattern: 'belly', top: 'longears', wear: 'scarf', voice: 'chime', wheels: false };
  const fixes = {}; for (const f of Object.keys(SIM.FIXES)) fixes[f] = { s: 'none', variant: 'whole', listened: false, via: 'meeting' };
  for (const f of o.built || ['quiet', 'dim']) fixes[f] = { s: 'built', variant: SIM.FIXES[f].variant, listened: true, via: f === 'dim' ? 'owner' : 'meeting' };
  for (const f of o.onfile || []) fixes[f] = { s: 'onfile', variant: 'whole', listened: false, via: 'meeting' };
  const people = {}; for (const id of ['gil', 'pip', 'moss', 'rue', 'bea', 'wren', 'clover', 'hollis']) people[id] = { bond: (o.bonds || {})[id] != null ? o.bonds[id] : 1, gw: 1, revealed: false, met: true };
  return Object.assign({ act: 1, look, look0: look, comfort: 'hum', pronoun: 'they', profile: { sound: 0.3, light: 0.3, people: 0.5, talk: 0.3, time: 0.5, change: 0.5 }, fixes, people, rue: 'easing', blend: 'kept', dep: 1, colour: 'yourself', selfEnd: 80, default: 'as_is', pushHabit: 'none', w: { hollis_archive: 1, standard_solved: 1 }, tally: { bend: 3, gear: 1, ask: 2, fix: 2, leave: 1 }, endings: { 1: 'wider', 2: '', 3: '' }, jar: 6 }, o.carry || {});
}

export class Return {
  constructor(story) { this.st = story; this.G = story.G; this.act = story.S.act; this.A = ACT_MOD[this.act]; this.t = 0; }
  get S() { return this.G.S; }
  // the world for this visit: the town's layer, the rooms', the people's looks (accessories, never numbers)
  setup() {
    const G = this.G, S = this.S;
    townLayer(G.town, this.act, S); const r = roomLayer(G.rooms, this.act, S); this.unit = r.unit || null;
    for (const [id, look] of Object.entries(this.A.looks || {})) { const n = G.npcs[id]; if (n) n.c.setLook(Object.assign({}, CAST[id].look, look)); }
    if (this.A.setup) this.A.setup(this);
    if (this.A.applyFix) for (const f of Object.keys(S.fixes)) if (S.fixes[f] === 'built') this.A.applyFix(this, f);
    try { G.stage.renderer.compile(G.town.scene, G.stage.camera); } catch (e) { /* best effort */ }
  }
  // the day: arrival (or a checkpoint), then free play until the festival's end
  async run(phase) {
    const G = this.G, S = this.S, st = this.st;
    this.setup();
    if (phase === 'morning') { st.saveNow('morning', 1); await this.A.arrival(this); }
    else this.resume(phase);
    await new Promise((r) => { st.endDay = r; G.mode = 'play'; G.busy = 0; });
    st.saveNow('end', 1);
    await st.ending();
  }
  resume(phase) {
    const G = this.G; const at = (this.A.resumeAt || {})[phase] || [30, 34];
    G.setLoc('town'); G.place(at); G.player.heading = 0; G.stage.follow(G.player.root.position, G.followOpts({ snap: true }));
    G.audio.setScene('town'); this.st.ui.hud(true); this.st.ui.letterbox(false); G.stage.fadeTo(0, 600);
    this.st.ui.toast('Welcome back. ' + ((this.A.resumeLine || {})[phase] || ''), '', 3200);
  }
  update(dt) { if (this.A.update) this.A.update(this, dt); if (this.unit && this.G.loc === 'works') this.unit.update(dt, this.G.settings.reduceMotion); }
  // the clock: the visit's scenes first, then the evening (returns true if it started something)
  tick() {
    const G = this.G, S = this.S, st = this.st, m = S.min;
    if (this.A.tick && this.A.tick(this)) return true;
    // the push-through habit you brought from last time fires once, the first time you are back in that place
    if (S.carryHabit && S.carryHabit !== 'none' && !S.flags.habitCarried && G.zone === S.carryHabit && !S.flags.festival) { G.run(() => this.carriedHabit(S.carryHabit)); return true; }
    if (S.cloverAt != null && m >= S.cloverAt && !G.ui.waiter) { G.run(() => st.cloverAfter()); return true; }
    if (m >= 1065 && !S.flags.remind) { S.flags.remind = 1; st.text('Hollis', 'Town meeting in 15 minutes! Town Hall.'); }
    if (m >= 1080 && !S.flags.council) { S.flags.council = 1; G.run(() => st.council()); return true; }
    if (m >= 1170 && !S.flags.decided) { S.flags.decided = 1; G.run(() => st.toFestival()); return true; }
    if (m >= 1200 && !S.flags.festival) { G.run(() => st.festival()); return true; }
    if (S.flags.festival && m >= 1290 && !S.flags.released) { G.run(() => st.finale()); return true; }
    return false;
  }
  // your body braces before you notice: keep it (it's what you do here) or let it go
  // (kept, it is this place's answer for the day, as a habit is on the first visit: returns 'bend'; let go, the place
  // can still ask who adjusts)
  async carriedHabit(zone) {
    const G = this.G, S = this.S, st = this.st; if (S.flags.habitCarried || S.carryHabit !== zone) return null;
    S.flags.habitCarried = 1;
    const dimNote = zone === 'works' && S.fixes.dim === 'built' ? ' The room is dim now.' : '';
    const k = await st.choose([{ t: 'OK', sub: 'it is what you do here. −4 energy; the pinch stays, hidden.', id: 'habit_ok' }, { t: 'Not today', sub: 'notice it, and let it go', id: 'habit_no' }], { text: 'You braced before you noticed.' + dimNote, kind: 'gut' });
    if (k === 0) {
      SIM.bendCost(S, false); S.stats.bend++; S.masking = true; S.maskZone = zone; S.handled[S.day + ':' + zone + (zone === 'festival' ? ':f' : '')] = 1;
      st.log('habit', { z: zone, v: 'bend', by: 'habit', pay: ['you'], dir: 'over', verb: 'You braced before you noticed, the way you used to here.' }); st.fieldNote('habits');
    }
    else { S.carryHabit = 'none'; S.pushHabit = 'none'; await st.gut('You let your shoulders drop. ' + (this.act === 3 ? 'Twenty' : 'Ten') + ' years is a long time to brace for something.'); }
    st.ui.hideDialog();
    return k === 0 ? 'bend' : null;
  }
  // a day spent: you sleep it off at home, and the evening still happens
  async exhausted() {
    const G = this.G, S = this.S, st = this.st;
    await st.gut('You hit a wall. Everything is too much and also too far away.'); st.ui.hideDialog();
    await G.stage.fadeTo(1, 700);
    G.setLoc('home'); G.place(G.rooms.home.spots.bed); { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
    const to = S.flags.councilDone ? 1125 : 1035; S.min = Math.max(S.min, to); S.energy = Math.max(S.energy, 45); S.self = clamp(S.self + 4, 0, 100);
    st.log('missed', { z: 'home', v: 'afternoon', pay: ['you'] });
    await G.stage.fadeTo(0, 700);
    await st.note(S.flags.councilDone ? 'You sleep through the afternoon. The festival is at eight.' : 'You sleep through the afternoon. The meeting is at six.'); st.ui.hideDialog();
  }
  // where everyone is: the meeting's seating, the festival, the visit's own scenes, then the day's routine
  npcWant(id) {
    const S = this.S, m = S.min, G = this.G;
    const me = G.npcs[id]; if (me && me.visit && me.visitPos) return { place: 'town', pos: me.visitPos };
    const own = this.A.npcWant ? this.A.npcWant(this, id) : null; if (own) return own;
    if (S.flags.festival) { const f = (this.A.festival || {})[id]; return f ? { place: 'town', pos: f } : { place: 'away' }; }
    if (m >= 1070 && m < 1185 && !S.flags.councilDone) {
      const seats = this.act === 3 ? { hollis: 'hollis', pip: 'pip', rue: 'clover' } : { hollis: 'hollis', pip: 'pip', clover: 'clover' };
      if (seats[id]) return { place: 'hall', spot: seats[id] };
      const backs = Object.values(S.support).some((a) => a.includes(id));
      if (backs) { const order = ['bea', 'moss', 'wren', 'gil', 'rue', 'clover']; const k = order.indexOf(id); if (k >= 0) return { place: 'hall', pos: [[-3.9, 2.0], [-2.6, 3.5], [3.8, 2.0], [2.8, 3.5], [-4.6, 3.5], [4.4, 2.0]][k] }; }
    }
    const R = (ROUTINES_ACT[this.act] || {})[id]; if (!R) return { place: 'away' };
    let w = R[R.length - 1]; for (const r of R) if (m >= r[0] && m < r[1]) { w = r; break; }
    return { place: w[2], spot: w[3] };
  }
  voters() { return this.act === 3 ? ['pip', 'rue', 'hollis'] : ['pip', 'clover', 'hollis']; }
  // a proposal straight out of a scene (no sketch at the Shed this time): one backer from the scene, one more to find,
  // and whoever it costs comes to find you (or calls) within the hour. Two a visit, like every season.
  propose(f, by) {
    const S = this.S, st = this.st; const cur = SIM.fixState(S, f); const F = SIM.FIXES[f];
    if (!['none', 'onfile', 'idea'].includes(cur)) return false;
    // after the meeting there is no tonight: it waits on file for next year
    if (S.flags.councilDone) { S.fixes[f] = 'onfile'; st.ui.toast('<b>' + F.name + '</b><br>The meeting is over for this year. It goes on file.', '', 4800); return false; }
    if (SIM.approvedCount(S) >= SIM.SEASON_CAP) { S.fixes[f] = 'onfile'; st.ui.toast('<b>' + F.name + '</b><br>That would be a third fix this year. It goes on file.', '', 4800); return false; }
    S.fixes[f] = 'proposal'; S.support[f] = S.support[f] || []; if (by && !S.support[f].includes(by)) S.support[f].push(by);
    if (S.support[f].length >= 2) S.fixes[f] = 'ready';
    S.stakes = S.stakes || {}; S.stakeDue = S.stakeDue || {}; if (S.stakes[f] !== 'listened') S.stakeDue[f] = S.day * 1440 + Math.round(S.min) + 30;
    S.flags.idea_any = true; st.fieldNote('ud');
    const need = F.backers.filter((b) => !S.support[f].includes(b)).map((b) => CAST[b].name); const left = 2 - S.support[f].length;
    const msg = S.fixes[f] === 'ready' ? 'It has its two backers. Tonight at six.' : left >= 2 && need.length >= 2 ? 'Two backers by six: try ' + need[0] + ' and ' + need[1] + '.' : need.length ? 'One more backer: try ' + need[0] + '. Tonight at six.' : 'It needs backers by six.';
    st.ui.toast(`<b>New proposal</b><br>${F.name}<br>${msg}`, 'idea', 5600);
    return true;
  }
  // places whose card today is the visit's own scene, not the everyday one
  owns(zone) { return this.A.owns ? this.A.owns(this, zone) : false; }
  // what pressing E does here, if this visit changes it (returns true if handled)
  async handle(t) { return this.A.handle ? this.A.handle(this, t) : false; }
  label(it) { return this.A.label ? this.A.label(this, it) : null; }
  script(id) { return this.A.talk(this, id); }
  objective() { return this.A.objective(this); }
  goals() { return this.A.goals(this); }
  dayName() { return this.act === 2 ? 'Ten years on' : 'Twenty years on'; }
  async festivalLine(id) { const L = this.A.festivalLine && this.A.festivalLine(this, id); if (L) await this.st.say(L.who, L.t); }
  async festivalExtras() { if (this.A.festivalExtras) await this.A.festivalExtras(this); }
  remember() { return this.A.remember ? this.A.remember(this) : []; }
  causes() { return this.A.causes || null; }
  sights() { return this.A.sights || []; }
  // a short wait that respects the fast test mode
  async beat(ms) { await sleep(FAST ? 30 : ms); }
}
