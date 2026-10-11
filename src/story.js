// The season: prologue, three days, the council, the festival, the ending. Interprets the scripts in content.js.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST, TALK, HINTS, BARRIER, GUTS, NOTICE, ASK, PROLOGUE, SETUP, TEXTS, COUNCIL, FESTIVAL, ENDINGS, QUESTIONS, BLEND, NIGHT, PEOPLE, LIKED, UNASKED, FIELD_NOTES, SLOT_LABEL } from './content.js';
import { clamp, pick, sleep, FAST, fmtTime, now, seedRng, params } from './util.js';
import * as SAVE from './save.js';
import { escortBea } from './guide.js';
import { parseCond, parseEffect, compare } from './script.js';
import { SortGame } from './games/sort.js';
import { StampGame } from './games/stamp.js';
import { Blueprint, PlainNote, BLUEPRINTS } from './games/blueprint.js';
import { PondGame } from './games/pond.js';
import { PaintGame } from './games/paint.js';

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
const phaseLabel = (phase, day) => (phase === 'morning' ? DAYS[day] + ' morning' : phase === 'shift' ? DAYS[day] + ', after work' : phase === 'meeting' ? DAYS[day] + ', after the meeting' : 'the end of your visit');
const sens = (S, d) => Math.abs(S.profile[d] - 0.5) >= 0.28;

export class Story {
  constructor(G) { this.G = G; this.endDay = null; }
  get S() { return this.G.S; }
  get ui() { return this.G.ui; }

  async start() {
    const G = this.G;
    const read = SAVE.readSave();
    const pick = await this.titleScreen({ save: read.save || null });
    if (pick.kind === 'code' && pick.carry) this.ui.toast('That visit code is for a return visit. Start here first; return visits open once a visit ends.', '', 6000);
    const save = pick.kind === 'continue' ? pick.save : pick.kind === 'code' ? pick.save : null;
    if (save) {
      const at = await this.resumeFrom(save);
      if (at) { if (at.phase === 'end') { await this.ending(); return; } await this.days(at.day, at.phase); return; }
    }
    // a new visit: the comfort check first (tests skip it unless they ask for it)
    if (!G.settings.comfortDone && (!G.test || params.get('comfort') === '1')) await G.menus.comfort();
    seedRng(this.S.seed);
    await this.prologue();
    await this.days(1, 'morning');
  }
  // the visit's days; a save is written before each morning, so Continue replays that morning exactly
  async days(first, phase) {
    for (let d = first; d <= 3; d++) {
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
    const label = phaseLabel(phase, day);
    const meta = { act: S.act || 1, day, phase, label, build: BUILD };
    const r = SAVE.writeSave(meta, S);
    const snap = SAVE.snapshot(S);
    G.lastSaveObj = { v: SAVE.SAVE_V, build: BUILD, act: meta.act, day, phase, label, savedAt: new Date().toISOString(), S: snap.data };
    G.lastSaveMeta = { ok: r.ok, label, error: r.error || null };
    if (!r.ok && r.error !== 'invalid' && !this.warnedSave) { this.warnedSave = true; this.ui.toast('This browser isn\'t keeping saves. Your save code is in the Menu, if you want to pick up later.', '', 6000); }
    if (!r.ok && r.error === 'invalid') console.warn('save refused', r.why);
  }
  // a save from storage or a code: rebuild the state, then everything in the world that the state implies
  async resumeFrom(save) {
    const G = this.G; let S;
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
    this.revealQ = Object.keys(S.revealed || {}).filter((k) => S.revealed[k] === 'pending');
    if (S.look0) S.portrait0 = G.portraitOf(S.look0, {});
    G.player.root.visible = true;
  }
  // picking up in the middle of a day: outside the building you left, in free play
  resumeDay(phase) {
    const G = this.G;
    G.setLoc('town'); G.place(phase === 'shift' ? [12, 13.9] : [32, 14.4]); G.player.heading = 0;
    G.stage.follow(G.player.root.position, G.followOpts({ snap: true }));
    G.audio.setScene('town'); this.ui.hud(true); this.ui.letterbox(false);
    G.stage.fadeTo(0, 600);
    this.ui.toast('Welcome back. ' + (phase === 'shift' ? 'Your shift is done for today.' : 'The meeting is over.'), '', 3200);
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
  text(from, t, silent) { this.G.texts.push([from, t]); if (!silent) { this.ui.toast(`<b>${from}</b><br>${t}`, from === 'Blend' ? 'blend' : ''); this.G.audio.sfx(from === 'Blend' ? 'blend' : 'notify'); this.ui.ping(true); } }

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
  testGame(name, arg) { const map = { sort: SortGame, stamp: StampGame, blueprint: Blueprint, plain: PlainNote, pond: PondGame, paint: PaintGame }; const g = name === 'blueprint' ? new Blueprint(this.G, arg || 'quiet') : new map[name](this.G); this.G.run(() => g.run()); return true; }
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
      this.keep('reveal_' + id, CAST[id].name + ' bends too', CAST[id].look.color);
      // the notes about hiding arrive through people you know, not through your own bending
      if (id === 'bea' || id === 'pip') this.fieldNote('masking'); if (id === 'clover' || id === 'gil') this.fieldNote('hiding');
    }
  }
  // field notes unlock right after the thing they describe has happened to you
  fieldNote(id) {
    const S = this.S; S.notes = S.notes || {}; if (S.notes[id]) return; const n = FIELD_NOTES.find((x) => x.id === id); if (!n) return;
    S.notes[id] = S.day || 1;
    if (this.G.mode === 'title' || S.day === 0) return;
    this.ui.toast(`<span class="noteicon">✎</span><b>New field note</b> in Lantern<br><span class="tsub">${n.title}</span>`, 'note', 3600); this.ui.ping(true);
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
      this.ui.toast(`<b>${F.name}</b><br>${F.approve === 'gil' ? 'Enough backers. Gil can approve it, or it can go to the town meeting.' : 'Enough backers. It goes to the town meeting ' + (this.S.day === 3 ? 'tonight' : 'on Wednesday') + ' at six.'}`, 'good'); this.G.audio.sfx('sign');
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
        if (o.blend) { this.S.blend.score += 5; this.S.blend.usedToday = true; this.S.self = clamp(this.S.self - 1.5, 0, 100); this.ui.toast('+5 points', 'blend', 1600); }
        if (o.do) for (const e of o.do) await this.effect(e, ctx);
        if (o.go) { i = labels[o.go] ?? nodes.length; continue; }
      }
      else if (n.do) for (const e of n.do) await this.effect(e, ctx);
      i++;
    }
  }
  async call(name, ctx) {
    if (name === 'shop') { this.ui.hideDialog(); await this.ui.shop(this.S); }
    else if (name === 'fold') { this.ui.hideDialog(); await this.ui.fold(); this.S.flags.folded = true; }
    else if (name === 'proposals') await this.proposals();
    else if (name === 'archive') await this.run(TALK.clover.archive, ctx);
    else if (name === 'paint') { if (!this.S.flags.painted) { this.S.flags.painted = 1; this.ui.hideDialog(); this.ui.letterbox(false); await new PaintGame(this.G).run(); this.ui.letterbox(true); } }
  }
  async hint(id, ctx) {
    const H = HINTS[id], S = this.S;
    const learned = S.lantern.learned[H.by];
    await this.say(H.by, H.t, { kind: 'hint', extra: learned ? `<div class="lantern">Lantern: "${H.truth === 'literal' ? H.literal : H.between}"</div>` : '' });
    const t = S.profile.talk;
    const read = t < 0.38 ? 'literal' : t > 0.62 ? 'between' : null;
    await this.gut(read === 'literal' ? 'Take the words as they come: "' + H.literal + '"' : read === 'between' ? 'Translation: "' + H.between + '"' : 'It could mean two different things. You are not sure which.');
    const opts = [{ t: 'Take it at face value', sub: H.literal }, { t: 'Read between the lines', sub: H.between }, { t: 'Ask what they mean', sub: 'a little awkward' }];
    const k = await this.choose(opts);
    const reading = ['literal', 'between', 'asked'][k];
    const result = reading === 'asked' ? 'asked' : reading === H.truth ? 'right' : 'wrong';
    S.lantern.entries[id] = { reading: opts[k].t, pending: result, result: null, day: S.day, by: H.by };
    if (reading === 'asked') { await this.say(H.by, H.asked.replace(/^"|"$/g, '')); S.lantern.entries[id].result = 'asked'; S.spot = clamp(S.spot + 0.05, 0, 1); this.learn(H.by); this.know(H.by, 'no'); this.fieldNote('ask'); }
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
    if (n >= 2 && !S.lantern.learned[who]) { S.lantern.learned[who] = true; this.ui.toast(`<b>Lantern learned how ${CAST[who].name} talks</b><br>It will quietly translate from now on.`, 'idea', 5000); this.fieldNote('double'); }
  }

  // ---------- the title and the prologue ----------
  async titleScreen(o = {}) {
    const G = this.G; const keepMin = G.S.min;
    G.setLoc('town'); G.mode = 'title';
    G.stage.orbit(new THREE.Vector3(30, 2, 24), 36, 17, 0.03, true);
    G.S.min = 18.4 * 60; G.player.root.visible = false;
    const pick = await this.ui.title({ save: o.save, storage: G.storage });
    G.S.min = keepMin;
    G.audio.unlock(); G.audio.setScene('title');
    return pick;
  }
  async prologue() {
    const G = this.G, S = this.S, ui = this.ui;
    G.mode = 'cine'; ui.letterbox(true); this.inPrologue = true;
    S.min = 17.2 * 60;
    G.stage.shot(new THREE.Vector3(66, 9, 70), new THREE.Vector3(57, 1.5, 30), 34, 0.6, true);
    G.busRide = true;
    await ui.caption(PROLOGUE.bus[0], 3000);
    G.stage.shot(new THREE.Vector3(36, 6.5, 33), new THREE.Vector3(30, 3.0, 24), 30, 0.5);
    await ui.caption(PROLOGUE.bus[1], 2800);
    await ui.caption(PROLOGUE.bus[2], 3200);
    G.busRide = false;
    G.stage.shot(new THREE.Vector3(14, 6, 46), new THREE.Vector3(9.5, 1.5, 35), 34, 0.8);
    await ui.caption(PROLOGUE.arrive, 2400);
    this.inPrologue = false; this.skipIntro = false;
    await G.stage.fadeTo(1, 700);
    G.setLoc('home'); G.player.root.visible = true; G.place([0.6, 0.2]); G.player.heading = 0.25;
    G.audio.setScene('home');
    G.stage.shot(new THREE.Vector3(1.6, 1.55, 4.1), new THREE.Vector3(0.45, 0.62, 0.1), 34, 3, true);
    if (window.innerWidth > 760) G.stage.offsetX(Math.min(220, window.innerWidth * 0.17)); else G.stage.offsetX(0, Math.round(window.innerHeight * 0.24));
    await G.stage.fadeTo(0, 700);
    ui.letterbox(false);
    await ui.caption(PROLOGUE.room, 2200);
    // the mirror: make yourself
    G.mode = 'creator';
    G.player.heading = 0.6;
    const look = await ui.creator(S.look, (L, k) => { S.look = L; S.wheels = !!L.wheels; G.player.setLook(L); G.player.hop(); if (k === 'voice') G.audio.voice(L.voice, 1, 'hello hello'); });
    S.look = look; S.wheels = !!look.wheels; S.look0 = Object.assign({}, look);
    G.player.setLook(look);
    S.portrait0 = G.portrait();
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
    S.tf0 = SIM.townFit(S.fixes).all;
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
    G.setLoc('home'); G.place(G.rooms.home.spots.center); G.player.heading = -0.9;
    { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
    S.dayStats = Object.assign({}, S.stats); S.metAt0 = Object.keys(S.met); S.fixAt0 = Object.assign({}, S.fixes);
    for (const k of Object.keys(S.fixes)) if (S.fixes[k] === 'approved') { S.fixes[k] = 'built'; G.applyFix(k); this.ui.toast(`<b>Built overnight</b><br>${SIM.FIXES[k].name}`, 'good', 5000); this.fieldNote('curb'); this.keep('built_' + k, 'The ' + SIM.FIXES[k].short + ', built', '#9fd3b0'); }
    for (const id of Object.keys(S.lantern.entries)) this.resolveHint(id, false);
    G.audio.setScene('home');
    this.ui.hud(true);
    await G.stage.fadeTo(0, 900);
    await this.ui.caption(['', 'Monday', 'Tuesday', 'Wednesday'][d] + ', ' + fmtTime(S.min), 1800);
    if (S.burnout) { await this.gut('You wake up heavy, like the day started without you. Everything will cost more today.'); this.ui.hideDialog(); }
    if (d === 1) this.text('Gil (work)', 'See you at 9! :)');
    if (d === 2) this.text('Gil (work)', 'Weekly sync at 9! Should be quick :)');
    if (d === 3) { this.text('Clover', 'Come by the Fix-It Shed this morning! I found something in the loft you need to see.'); this.text('Hollis', 'Reminder: Town meeting, 6 PM, Town Hall. The Lantern Festival follows at 8!'); }
    if (S.blend.has && !S.blend.deleted) this.text('Blend', pick(BLEND.drop) + (S.blend.streak ? ' Streak: ' + S.blend.streak + ' days!' : ''));
    await sleep(400);
    await this.ui.today(this.todayCard(d));
  }
  todayCard(d) {
    const S = this.S;
    if (d === 1) return { day: 'Monday', title: 'Your first day', items: [{ t: 'Get to the Works by 9:00', sub: 'Bea from next door is heading that way.' }, { t: 'Say hi to your neighbors' }, { t: 'Find the Fix-It Shed', sub: 'In the Commons, past Town Hall.' }], note: 'When a place pinches, someone adjusts. Sometimes it is you. Sometimes it can be the place.' };
    if (d === 2) { const open = this.openThread(); return { day: 'Tuesday', title: 'A full day', items: [{ t: 'Weekly sync at the Works, 9:00' }, { t: 'Take your ideas to Clover at the Fix-It Shed' }, { t: 'Find two people to back each idea' }], note: open ? 'Still open from yesterday: ' + open : 'Listen to people. They tell you what pinches them, if you let them.' }; }
    return { day: 'Wednesday', title: 'Festival day', items: [{ t: 'See what Clover found at the Fix-It Shed' }, { t: 'Town meeting, 6 PM, Town Hall', sub: 'Proposals with two backers get a vote.' }, { t: 'The Lantern Festival, 8 PM' }], note: S.burnout ? 'You woke up running on less. Places will cost more today.' : '' };
  }
  // the one unfinished thing worth coming back to (an open loop, not a streak)
  openThread() {
    const S = this.S;
    for (const f of Object.keys(SIM.FIXES)) {
      const st = SIM.fixState(S, f); const F = SIM.FIXES[f];
      if (st === 'idea') return 'your idea for the ' + F.short + ' is waiting for Clover at the Fix-It Shed.';
      if (st === 'proposal') { const need = F.backers.filter((b) => !(S.support[f] || []).includes(b)); return 'the ' + F.short + ' needs ' + (2 - SIM.supporters(S, f)) + ' more backer' + (2 - SIM.supporters(S, f) > 1 ? 's' : '') + '. Try ' + NAMES(need) + '.'; }
      if (st === 'ready' && F.approve === 'gil' && !S.flags['gilasked_' + f]) return 'the ' + F.short + ' has its backers. Show Gil at the Works.';
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
    this.ui.toast(`<span class="jaricon"></span><b>Kept:</b> ${t}`, 'keep', 2600);
    if (S.jar.length === 12) { S.flags.jarFull = 1; setTimeout(() => this.ui.toast('Your jar is full. That is what enough looks like.', 'idea', 4800), 900); this.fieldNote('satiety'); }
    if (this.G.rooms.home.setJar) this.G.rooms.home.setJar(S.jar);
  }
  onOutside(from) {
    const G = this.G, S = this.S;
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
    const S = this.S, d = S.day, m = S.min;
    if (d === 0) return ob('Make yourself at home.');
    if (S.flags.festival) return S.flags.released ? ob('') : ob('Enjoy the festival. When you are ready, release your lantern at the statue.', T.statue, 'The statue');
    if (d === 3 && S.flags.council) return ob('The Lantern Festival starts at 8 in Market Square.', T.square, 'Market Square');
    if (d === 3 && m >= 1020) return ob('Town meeting at 6 PM, Town Hall.', T.hall, 'Town Hall', { inside: 'hall' });
    if (m >= 1260) return ob('It is getting late. Head home.', T.home, 'Home', { inside: 'home' });
    const backers = () => { const nb = this.needBackers(); if (!nb.length) return null; const near = this.nearestOf([...new Set(nb.map((x) => x[1]))]); if (!near) return null; const f = nb.find((x) => x[1] === near.id)[0]; return ob('Ask ' + CAST[near.id].name + ' to back the ' + SIM.FIXES[f].short + '.', near.at, CAST[near.id].name); };
    const hasIdea = Object.keys(SIM.FIXES).some((f) => SIM.fixState(S, f) === 'idea');
    if (d === 1) {
      if (!S.flags.shift1 && !S.flags.missed1 && m < 690) return ob(m > 545 ? 'You are running late. You can still start your shift until 11:30.' : 'Get to the Works by 9:00. Up the garden cut, then left.', T.works, 'The Works', { inside: 'works' });
      if (!S.met.clover && m < 1080) return ob('Find Clover at the Fix-It Shed, in the Commons.', T.shed, 'Fix-It Shed');
      if (m >= 1170) return ob('That is enough for today. Head home when you like.', T.home, 'Home', { inside: 'home' });
      const n = this.nearestOf(Object.keys(CAST).filter((id) => !S.met[id]));
      if (n) return ob('Say hi to ' + CAST[n.id].name + '. Home by 10 PM.', n.at, CAST[n.id].name);
      return ob('Explore Larkspur. Home by 10 PM.');
    }
    if (d === 2) {
      if (!S.flags.shift2 && !S.flags.missed2 && m < 690) return ob('Weekly sync at the Works, 9:00.', T.works, 'The Works', { inside: 'works' });
      if (hasIdea && m < 1080) return ob('Take your ideas to Clover at the Fix-It Shed.', T.shed, 'Fix-It Shed');
      const b = backers(); if (b && m < 1170) return b;
      const gilReady = Object.keys(SIM.FIXES).some((f) => SIM.FIXES[f].approve === 'gil' && SIM.fixState(S, f) === 'ready' && !S.flags['gilasked_' + f]);
      if (gilReady && m < 1040) return ob('Show Gil the plans at the Works.', T.works, 'The Works', { inside: 'works' });
      if (m >= 1170) return ob('That is enough for today. Head home when you like.', T.home, 'Home', { inside: 'home' });
      if (!Object.keys(S.fixes).length) { const n = this.nearestOf(Object.keys(CAST).filter((id) => !S.talked[id])); if (n) return ob('Listen for what pinches people. Try ' + CAST[n.id].name + '.', n.at, CAST[n.id].name); }
      return ob('Explore, or rest somewhere that fits. Home by 10 PM.');
    }
    if (d === 3) {
      if (!S.flags.statue_seen) return ob('Clover found something. Visit the Fix-It Shed.', T.shed, 'Fix-It Shed');
      const b = backers(); if (b) return Object.assign(b, { t: b.t + ' The meeting is at 6.' });
      if (!S.flags.hollis_archive && this.G.npcs.hollis.place === 'town') { const h = this.nearestOf(['hollis']); if (h) return ob('Tell Hollis what Clover found.', h.at, 'Hollis'); }
      return ob('Town meeting at 6 PM, Town Hall.', T.hall, 'Town Hall', { inside: 'hall' });
    }
    return ob('');
  }
  goals() {
    const S = this.S, d = S.day; const met = Object.keys(S.met).length;
    if (d === 1) return [{ t: 'Get to the Works by 9:00', done: !!S.flags.shift1 }, { t: 'Meet at least four neighbors (' + Math.min(4, met) + '/4)', done: met >= 4 }, { t: 'Find the Fix-It Shed', done: !!S.met.clover }, { t: 'Home by 10 PM', done: false }];
    if (d === 2) return [{ t: 'Weekly sync at the Works, 9:00', done: !!S.flags.shift2 }, { t: 'Turn an idea into a proposal at the Shed', done: Object.values(S.fixes).some((v) => v !== 'idea') }, { t: 'Find two backers for something', done: Object.values(S.fixes).some((v) => ['ready', 'approved', 'built'].includes(v)) }, { t: 'Home by 10 PM', done: false }];
    if (d === 3) return [{ t: 'See what Clover found', done: !!S.flags.statue_seen }, { t: 'Town meeting, 6 PM', done: !!S.flags.council }, { t: 'The Lantern Festival, 8 PM', done: !!S.flags.released }];
    return [{ t: 'Make yourself at home', done: false }];
  }
  // called by the game loop every frame while playing
  tick() {
    const G = this.G, S = this.S; if (G.busy || G.mode !== 'play') return;
    const m = S.min, d = S.day;
    if (d === 1 && m >= 555 && !S.flags.shift1 && !S.flags.ping1) { S.flags.ping1 = 1; this.text('Gil (work)', 'No worries if you\'re running late! :)'); }
    if (d === 1 && m >= 690 && !S.flags.shift1 && !S.flags.missed1) { S.flags.missed1 = 1; this.text('Gil (work)', 'Missed you today! No worries!! Tomorrow :)'); }
    if (d === 2 && m >= 690 && !S.flags.shift2 && !S.flags.missed2) { S.flags.missed2 = 1; this.text('Gil (work)', 'We missed you at sync! Notes to follow :)'); }
    if (d === 1 && m >= 1045 && m < 1070 && !S.flags.busEvent && G.zone === 'transit') { S.flags.busEvent = 1; G.run(() => this.busEvent()); return; }
    { const e6 = S.lantern.entries.clover_six; if (e6 && e6.day === d && m >= 1080 && !S.flags.clover6) { S.flags.clover6 = 1; this.text('Clover', 'Drawings attached. Six on the dot.'); } }
    if (d === 3 && m >= 1065 && !S.flags.remind) { S.flags.remind = 1; this.text('Hollis', 'Town meeting in 15 minutes! Town Hall.'); }
    if (d === 3 && m >= 1080 && !S.flags.council) { S.flags.council = 1; G.run(() => this.council()); return; }
    if (d === 3 && m >= 1195 && !S.flags.festival) { G.run(() => this.festival()); return; }
    if (S.flags.festival && m >= 1290 && !S.flags.released) { G.run(() => this.finale()); return; }
    if (!S.flags.festival && m >= 1260 && !S.flags.late) { S.flags.late = 1; this.ui.toast('It is getting late. Home is on Home Row, to the southwest.'); }
    if (!S.flags.festival && m >= 1320) { G.run(() => this.goHome('late')); return; }
    if (S.energy <= 0.5 && !S.flags.festival) { G.run(() => this.exhausted()); return; }
    if (S.energy < 30 && !S.flags['low1_' + d]) { S.flags['low1_' + d] = 1; this.ui.toast('<b>Running low.</b><br>Home, a bench somewhere that fits you, or tea with Moss will help.', '', 5600); }
    if (S.energy < 12 && !S.flags['low2_' + d]) { S.flags['low2_' + d] = 1; this.ui.toast('<b>Nearly empty.</b> Head home soon, or the day will end for you.', '', 5600); }
    // Blend keeps pinging while it is installed: a small noise layer of its own
    if (S.blend.has && !S.blend.deleted && d >= 1 && G.settings.blendPings !== false) { const t = now(); if (!this.pingAt) this.pingAt = t + (FAST ? 4000 : 90000); if (t > this.pingAt) { this.pingAt = t + (FAST ? 8000 : 120000 + Math.random() * 60000); this.text('Blend', S.blend.smooth && S.blend.score < 15 ? 'You are out of points! The feed has plenty.' : pick(BLEND.pings)); } }
    if (d < 3 && m >= 1170 && !S.flags['dusk' + d]) { S.flags['dusk' + d] = 1; this.ui.toast('The light is going gold. That is enough for today.', 'idea', 5200); }
    if ((this.revealQ || []).length) { G.run(() => this.flushReveals()); return; }
    const z = G.zone; if (z === 'home') return;
    if (this.unasked(z)) return;
    // barriers: when a place pinches, ask who adjusts
    const key = d + ':' + z + (z === 'festival' ? ':f' : '');
    if (d === 1 && !S.flags.shift1 && m < 600 && z !== 'works') return;
    if (z === 'homerow' && G.pinchNow && !['people', 'talk'].includes(G.pinchNow.top)) return;
    if (!S.handled[key]) {
      const p = G.pinchNow; const need = z === 'street' || z === 'homerow' ? 0.45 : 0.3;
      const calm = FAST || now() - (G.lastBarrier || -1e9) > 30000;
      if (p && p.total >= need && (G.zoneTime || 0) > 0.6 && calm) { S.handled[key] = 1; G.run(() => this.barrier(z)); }
    }
  }

  // ---------- who adjusts? ----------
  async barrier(zone, o = {}) {
    const G = this.G, S = this.S;
    const p = SIM.pinch(S, zone, S.min); if (p.total < 0.12 && !o.force) return 'none';
    const top = p.top || 'sound'; const dir = p.dims[top].over > 0 ? 'over' : 'under';
    const B = BARRIER[zone] || BARRIER.street; const text = (B[dir] && B[dir][top]) || (BARRIER.street[dir] && BARRIER.street[dir][top]) || 'This place is not quite right for you.';
    if (S.blend.has && S.blend.smooth && !S.blend.deleted) { if (G.blendSmooth(zone)) return 'bend'; this.ui.toast('<b>Out of points.</b><br>Blend has a feed for that.', 'blend', 4200); this.fieldNote('dark'); }
    G.focusPinch(true); G.lastBarrier = now();
    const coach = !S.flags.coached ? 'Five ways to handle a place that does not fit. None of them is wrong, and each one costs something different.' : ''; S.flags.coached = 1;
    this.fieldNote('fit'); if (p.dims[p.top || 'sound'] && p.dims[p.top || 'sound'].under > 0) this.fieldNote('both');
    const fixId = (SIM.FIX_FOR[zone] || {})[top];
    const noticed = sens(S, top) && NOTICE[zone] && NOTICE[zone][top];
    let noted = false;
    while (true) {
      const owner = SIM.OWNERS[zone]; const ownerHere = owner && G.npcNear(owner, zone);
      const gearKey = top === 'sound' ? 'headphones' : top === 'light' && dir === 'over' ? 'shades' : null;
      const options = [
        { key: 'bend', who: 'You', label: 'Push through', sub: 'costs energy now, and a little of you', hold: true },
        gearKey ? (S.gear[gearKey] && !S.wearing[gearKey] ? { key: 'gear', who: 'Your gear', label: 'Put on your ' + gearKey, sub: 'it helps, and people may notice' } : { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: S.wearing[gearKey] ? 'already on, and still not enough' : 'nothing for this yet. Moss sells some.' }) : { key: 'gear', who: 'Your gear', label: 'Use gear', disabled: true, reason: 'nothing you own helps with this' },
        ownerHere && !o.noAsk ? { key: 'ask', who: 'Them', label: 'Ask ' + CAST[owner].name + ' to change it', sub: 'uses a little goodwill' } : { key: 'ask', who: 'Them', label: 'Ask someone', disabled: true, reason: o.noAsk ? 'you asked. The answer was no.' : owner ? 'nobody in charge is here right now' : 'nobody here is in charge of it' },
        fixId && !noted && SIM.fixState(S, fixId) === 'none' ? (noticed || S.flags['told_' + fixId] ? { key: 'fix', who: 'The place', label: 'Note it for the Fix-It Shed', sub: 'slow, but it could last' } : { key: 'fix', who: 'The place', label: 'Note it', disabled: true, reason: 'you are not sure what is causing it' }) : { key: 'fix', who: 'The place', label: 'Fix it', disabled: true, reason: fixId && SIM.fixState(S, fixId) !== 'none' ? 'already in your notes' : 'nothing obvious to change here' },
        { key: 'leave', who: 'Nobody', label: zone === 'works' || zone === 'hall' ? 'Step outside' : 'Go somewhere else', sub: 'you miss whatever you came for' },
      ];
      const choice = await this.ui.barrier({ options, title: B.title, text, gut: noted ? '' : pick(dir === 'over' ? GUTS.over : GUTS.under), notice: noticed && !noted ? NOTICE[zone][top] : '', noticeLabel: DIM_LABEL[top], coach: noted ? '' : coach });
      if (choice === 'fix') { noted = true; this.addIdea(fixId); S.stats.fix++; continue; }
      this.ui.hideBarrier(); G.focusPinch(false);
      if (choice === 'bend') { S.masking = true; S.maskZone = zone; SIM.bendCost(S, false); S.stats.bend++; G.player.setExpression('neutral'); }
      else if (choice === 'gear') { S.wearing[gearKey] = true; G.player.setGear(gearKey, true); S.spot = clamp(S.spot + 0.15, 0, 1); S.stats.gear++; G.audio.sfx('select'); if (zone === 'market' && S.day >= 2 && !S.flags.pipBold && S.bonds.pip < 2 && G.npcNear('pip', zone)) { S.flags.pipBold = 1; this.ui.bubble('pip', 'Ooh! Those are very... bold!', { tint: CAST.pip.tint, ms: 3800 }); } }
      else if (choice === 'ask') {
        S.stats.ask++; const ok = (S.bonds[owner] || 0) >= 1 || !S.flags['asked_' + owner];
        S.flags['asked_' + owner] = 1;
        G.faceTalk(owner);
        const A = ASK[owner]; const under = dir === 'under' && A.yesUnder;
        await this.say(owner, (ok ? (under ? A.yesUnder : A.yes) : (under ? A.noUnder : A.no)).replace(/^"|"$/g, ''));
        this.ui.hideDialog();
        if (ok) { S.mods[zone] = S.mods[zone] || {}; for (const dd of ['sound', 'light', 'people']) if (p.dims[dd].v > 0.02 || dd === top) S.mods[zone][dd] = (S.mods[zone][dd] || 0) + (p.dims[dd].over > 0 ? -0.35 : 0.3); S.bonds[owner] = (S.bonds[owner] || 0) + 0; }
        else { S.spot = clamp(S.spot + 0.1, 0, 1); this.know(owner, 'no'); return await this.barrier(zone, { force: true, noAsk: true }); }
      }
      else if (choice === 'leave') { S.stats.leave++; S.self = clamp(S.self + 1, 0, 100); await G.leaveZone(zone); }
      return choice;
    }
  }

  // ---------- the Works ----------
  async enterWorks(via) {
    const G = this.G, S = this.S;
    if (S.day === 3) { await this.note('A sign on the door: CLOSED FOR THE FESTIVAL. SEE YOU THURSDAY!'); this.ui.hideDialog(); return; }
    if (S.min < 480) { await this.note('The Works opens at eight. It is ' + fmtTime(S.min) + '. The bakery is open, and so is the square.'); this.ui.hideDialog(); return; }
    if (S.wheels && via !== 'dock' && SIM.fixState(S, 'ramp') !== 'built') {
      await this.note('Three steps up to the front door, and no other way in at the front.');
      const opts = [{ t: 'Ask someone to help you up the steps', sub: 'people will watch', k: 'ask' }, { t: 'Go around to the loading dock', sub: 'the long way, past the dumpsters', k: 'dock' }];
      if (SIM.fixState(S, 'ramp') === 'none') opts.push({ t: 'Note it for the Fix-It Shed', sub: 'slow, but it could last', k: 'fix' });
      opts.push({ t: 'Go home', sub: 'no shift today', k: 'leave' });
      const pickK = opts[await this.choose(opts)].k;
      this.ui.hideDialog();
      if (pickK === 'fix') { this.addIdea('ramp'); S.stats.fix++; return this.enterWorks(via); }
      if (pickK === 'leave') { S.stats.leave++; return; }
      const k = pickK === 'ask' ? 0 : 1;
      if (k === 0) { S.spot = clamp(S.spot + 0.25, 0, 1); S.self = clamp(S.self - 2, 0, 100); S.stats.ask++; await this.note('Two people from accounting lift the front of your chair. Everyone in the lobby watches. Someone says "there we go" in a voice usually used for toddlers.'); this.ui.hideDialog(); }
      if (k === 1) { G.advance(12); S.stats.gear++; await this.note('Around the side, past the dumpsters, through the loading dock. It takes twelve minutes.'); this.ui.hideDialog(); }
    }
    const day = S.day; const doShift = !S.flags['shift' + day] && S.min < 690;
    await G.enterRoom('works');
    if (!doShift) { await this.note(S.flags['shift' + day] ? 'Your desk, your chair, your plant. The work will still be here tomorrow.' : 'Most people have gone to lunch. Your shift has already happened without you.'); this.ui.hideDialog(); return; }
    if (day === 1 && S.min > 550) S.flags.late1 = true;
    if (day === 2 && ((S.bonds.gil || 0) >= 1 || (S.know && S.know.gil && S.know.gil.over)) && SIM.pinch(S, 'works', S.min).dims.light.over > 0) {
      S.mods.works = S.mods.works || {}; S.mods.works.light = (S.mods.works.light || 0) - 0.35;
      this.ui.bubble('gil', UNASKED.works.over, { tint: CAST.gil.tint, ms: 6000 }); this.keep('unasked_gil', 'Gil adjusted before you asked', CAST.gil.look.color); this.fieldNote('responsive');
      await sleep(FAST ? 50 : 1800);
    }
    const res = await this.barrier('works');
    if (res === 'leave') return;
    G.walkTo(...G.rooms.works.spots.mydesk);
    await sleep(900);
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
    if (S.energy < 28) { S.energy = Math.min(e0, 28); this.ui.toast('<b>The morning took a lot out of you.</b><br>Somewhere quiet, or home, will help this afternoon.', '', 5600); }
    S.flags['shift' + day] = 1; S.stats.shifts++;
    if (day === 2 && r && r.stats) {
      const st = r.stats;
      G.npcTo('gil', [G.rooms.works.spots.mydesk[0] + 1.3, G.rooms.works.spots.mydesk[1] - 0.6]); G.talkFrame('gil'); this.ui.letterbox(true);
      if (st.approvedWho.includes('gil')) { await this.say('gil', 'You approved... mine? Ha. Huh. I haven\'t hung a lantern in about nine years. Thank you.'); this.addBond('gil', 1); }
      else if (st.approved > 0) await this.say('gil', 'You approved some? Are we allowed to... Honestly? Good. It\'s a lantern.');
      else await this.say('gil', 'Zero matches again! Every year. Every single year. Weird, right?');
      S.flags.permits = 1; this.fieldNote('average'); this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
    }
    if (S.energy > 0) { S.coins += 30; G.audio.sfx('coin'); this.ui.toast('<b>+30 coins</b> for the shift', 'good'); }
    if (S.blend.has && S.blend.smooth && !S.blend.deleted && S.masking) this.ui.toast('Blend smoothed you through the whole shift. Nobody noticed a thing.', 'blend');
    S.masking = false;
    await G.exitRoom();
    this.saveNow('shift', S.day);
  }
  async officeApproval() {
    const S = this.S;
    const ready = Object.keys(SIM.FIXES).filter((f) => SIM.FIXES[f].approve === 'gil' && SIM.fixState(S, f) === 'ready' && !S.flags['gilasked_' + f]);
    for (const f of ready) {
      const k = await this.choose([{ t: 'Show Gil the plan for the ' + SIM.FIXES[f].short, sub: SIM.supporters(S, f) + ' backers' }, { t: 'Not now' }]);
      if (k === 1) break;
      S.flags['gilasked_' + f] = 1;
      await this.say('you', SIM.FIXES[f].what);
      if ((S.bonds.gil || 0) >= 1 || (f === 'dim' && S.flags.gil_head) || (S.sketch || {})[f] === 'zoned') { await this.say('gil', 'Okay. Yes. Let\'s do it. Don\'t tell corporate. Actually, tell corporate.'); S.fixes[f] = 'approved'; this.ui.toast(`<b>Gil approved it</b><br>${SIM.FIXES[f].name}. Up by tomorrow.`, 'good'); this.G.audio.sfx('fix'); }
      else { await this.hint('advisement_gil', {}); }
    }
  }
  async talkTo(id) {
    const G = this.G, S = this.S; const T = TALK[id]; const firstMeet = !S.met[id];
    G.talkFrame(id); this.ui.letterbox(true);
    if (S.flags.festival) { await this.festivalLine(id); }
    else {
      let script;
      if (id === 'rue' && !S.flags.rue_pitched) { S.flags.rue_pitched = 1; script = T.pitch; }
      else if (id === 'bea' && S.flags.bea_bus && !S.flags.bea_bus_told && S.day === 1) { S.flags.bea_bus_told = 1; script = T.bus1; }
      else if (S.talked[id]) script = T.again;
      else script = T['d' + S.day] || T.again;
      S.talked[id] = true;
      await this.run(script, { npc: id });
      if (id === 'gil') await this.officeApproval();
      const asks = Object.keys(SIM.FIXES).filter((f) => ['proposal', 'ready'].includes(SIM.fixState(S, f)) && SIM.FIXES[f].backers.includes(id) && !(S.support[f] || []).includes(id) && T.back && T.back[f]);
      if (asks.length) {
        const k = await this.choose(asks.map((f) => ({ t: 'Ask about the ' + SIM.FIXES[f].short })).concat([{ t: 'That is all for now' }]));
        if (k < asks.length) await this.run(T.back[asks[k]], { npc: id, back: true });
      }
      if (firstMeet && S.met[id]) await this.likingGap(id);
    }
    this.ui.hideDialog(); this.ui.letterbox(false); G.endTalk();
    if ((this.revealQ || []).length) await this.flushReveals();
  }
  async proposals() {
    const S = this.S;
    const ideas = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'idea');
    if (!ideas.length && !Object.keys(S.fixes).length) { await this.say('clover', 'Nothing yet? Not yet is fine. Not yet never means no. Notice what pinches, or listen: people tell you, if you let them.'); this.know('clover', 'no'); return; }
    for (const f of ideas) {
      const F = SIM.FIXES[f];
      await this.say('clover', 'The ' + F.short + '? Ooh. Let me sketch it.' + (BLUEPRINTS[f] || f === 'plain' ? ' Actually, you sketch it. I\'ll hold the pencil sharpener.' : ''));
      // some fixes are worked out on paper first: a zoning puzzle, or a plain note
      if (BLUEPRINTS[f] || f === 'plain') {
        this.ui.hideDialog(); this.ui.letterbox(false);
        const r = await (f === 'plain' ? new PlainNote(this.G) : new Blueprint(this.G, f)).run();
        this.ui.letterbox(true);
        if (r && r.zoned) await this.say('clover', f === 'plain' ? 'One line. Who, what, by when. I want to frame it.' : 'Everyone fits. I\'m bringing this one to the town meeting myself.');
      }
      S.fixes[f] = 'proposal'; this.G.audio.sfx('ink'); this.fieldNote('ud'); this.know('clover', 'helps');
      this.ui.toast(`<b>New proposal</b><br>${F.name}`, 'idea');
      if (!BLUEPRINTS[f] && f !== 'plain' && !S.lantern.entries.clover_six && S.min < 1050) await this.hint('clover_six');
      await this.say('clover', 'Who else does it pinch? I\'d ask ' + NAMES(F.backers) + '. ' + (F.approve === 'gil' ? 'Then show Gil. Or bring it to the town meeting ' + (S.day === 3 ? 'tonight.' : 'on Wednesday.') : 'Then it goes to the town meeting ' + (S.day === 3 ? 'tonight' : 'on Wednesday') + ' at six.'));
    }
    if (!ideas.length) await this.say('clover', 'Nothing new to sketch. Your proposals are on your phone, under Fix-It.');
  }
  async busEvent() {
    const G = this.G, S = this.S;
    G.audio.announce('attention route twelve diverted via elm street this evening');
    await this.ui.caption('A crackle from the speaker, aimed at the road. Something about the route.', 2600);
    G.busSkip = true;
    await sleep(2500);
    S.flags.bea_bus = 1;
    if (G.npcNear('bea', 'transit')) await this.talkTo('bea');
    else { await this.note('The 5:40 sails past without stopping. Nobody at the bench is sure why.'); this.ui.hideDialog(); S.flags.told_board = 1; }
    if (sens(S, 'change') || sens(S, 'sound')) { await this.ui.line({ kind: 'notice', label: DIM_LABEL.change, text: NOTICE.transit.change }); this.ui.hideDialog(); S.flags.told_board = 1; }
  }
  async exhausted() {
    const G = this.G, S = this.S;
    await this.gut('You hit a wall. Everything is too much and also too far away.');
    this.ui.hideDialog();
    if (S.day === 3) {
      await G.stage.fadeTo(1, 700);
      G.setLoc('home'); G.place(G.rooms.home.spots.bed); { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
      S.min = Math.max(S.min, 1035); S.energy = Math.max(S.energy, 45); S.self = clamp(S.self + 4, 0, 100);
      await G.stage.fadeTo(0, 700);
      await this.note('You sleep through the afternoon. The town meeting is at six.'); this.ui.hideDialog();
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
    const G = this.G, S = this.S; const U = UNASKED[zone]; if (!U || S.day < 2 || zone === 'works') return false;
    const who = U.who; const key = S.day + ':' + zone; S.unaskedDone = S.unaskedDone || {};
    if (S.unaskedDone[key] || (G.zoneTime || 0) < 0.3 || !G.npcNear(who, zone)) return false;
    const b = S.bonds[who] || 0; if (!(b >= 2 || (b >= 1 && this.known(who) >= 2))) return false;
    const p = SIM.pinch(S, zone, S.min); if (p.total < 0.12) return false;
    const top = p.top || 'sound'; const line = p.dims[top] && p.dims[top].under > 0 ? U.under : U.over;
    S.unaskedDone[key] = 1; S.mods[zone] = S.mods[zone] || {};
    for (const d of ['sound', 'light', 'people']) if (p.dims[d].over > 0) S.mods[zone][d] = (S.mods[zone][d] || 0) - 0.35; else if (p.dims[d].under > 0) S.mods[zone][d] = (S.mods[zone][d] || 0) + 0.3;
    S.handled[S.day + ':' + zone] = 1;
    G.ui.bubble(who, line, { tint: CAST[who].tint, ms: 6000 }); G.audio.voice(CAST[who].voice[0], CAST[who].voice[1], line);
    this.keep('unasked_' + who, CAST[who].name + ' adjusted before you asked', CAST[who].look.color); this.fieldNote('responsive');
    return true;
  }
  // a bench: rest works when the place fits you, and only a little when it does not
  async sit(id) {
    const G = this.G, S = this.S;
    const p = SIM.pinch(S, G.zone, S.min); const fits = p.total < 0.15; const pond = id === 'bench_pond';
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
    for (const f of Object.keys(S.fixes)) { const was = (S.fixAt0 || {})[f]; const now = S.fixes[f]; if (was === now) continue; const F = SIM.FIXES[f]; if (now === 'approved') news.push('Gil approved the ' + F.short + '. It goes up overnight.'); else if (now === 'built') news.push('The ' + F.short + ' is built.'); else if (now === 'ready') news.push('The ' + F.short + ' has its two backers.'); else if (now === 'proposal' && was !== 'ready') news.push('Clover sketched the ' + F.short + '.'); else if (now === 'idea' && !was) news.push('You noticed something worth fixing: the ' + F.short + '.'); }
    const PR = { she: ['she', 's'], he: ['he', 's'] }[S.pronoun] || ['they', ''];
    for (const id of S.hearsay || []) { const g = (S.lg || {})[id]; news.push(LIKED[id].replace(/\{they\}/g, PR[0]).replace(/\{s\}/g, PR[1]) + (g === 0 ? ' (You thought it went a bit awkwardly.)' : g === 1 ? ' (You thought it went fine.)' : '')); if (g === 0 || g === 1) this.fieldNote('liked'); }
    S.hearsay = [];
    const n = (S.jar || []).length;
    const title = c.fix + c.ask > c.bend && c.fix + c.ask > 0 ? 'You changed something today.' : c.bend >= 3 ? 'You carried a lot today.' : c.leave >= 2 ? 'You looked after yourself today.' : 'A day in Larkspur.';
    const tomorrow = d === 1 ? ['Weekly sync at the Works, 9:00.', 'The Fix-It Shed is open 8 to 6.'] : d === 2 ? ['Town meeting at 6 PM. Proposals with two backers get a vote.', 'The Lantern Festival at 8 PM.'] : [];
    return { day: ['', 'Monday', 'Tuesday', 'Wednesday'][d], title, counts: c, jar: S.jar || [], jarMax: 12, jarText: n >= 12 ? 'Full, and glowing.' : n + ' of 12. It does not need to be full.', news, open: this.openThread(), tomorrow };
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
    for (const [w, t] of NIGHT[d](S)) { this.text(w, t); await sleep(1100); }
    await sleep(600);
    await this.ui.evening(this.eveningData(d));
    this.fieldNote('endings'); if (d === 1) this.fieldNote('made');
    const r = SIM.nightUpdate(S);
    if (S.blend.has && !S.blend.deleted && S.blend.streak >= 1) this.fieldNote('streaks');
    if (S.blend.has && S.blend.smooth && !S.blend.deleted) S.self = clamp(S.self - 2, 0, 100);
    if (r.lostStreak) { this.text('Blend', BLEND.lose); this.fieldNote('dark'); }
    await sleep(900);
    await G.stage.fadeTo(1, 900);
    await this.ui.caption('Night.', 1200);
  }

  // ---------- the town meeting ----------
  async council() {
    const G = this.G, S = this.S, ui = this.ui;
    await G.stage.fadeTo(1, 500);
    if (G.loc !== 'hall') { await G.enterRoom('hall', true); }
    G.stage.fadeTo(0, 600);
    G.audio.setScene('council');
    G.placeCouncil();
    G.walkTo(...G.rooms.hall.spots.lectern);
    await sleep(700);
    const res = await this.barrier('hall');
    if (res === 'leave') { S.flags.councilLeft = 1; await this.note('You slip out before your name is called. Through the door you hear Hollis say, "Nothing from the floor? Splendid."'); this.tableAll(); ui.hideDialog(); return; }
    ui.letterbox(true);
    G.stage.shot(new THREE.Vector3(4.6, 3.1, 2.2), new THREE.Vector3(-0.6, 1.05, -3.1), 36, 2);
    await this.run(COUNCIL.open); this.know('hollis', 'over');
    const ready = Object.keys(SIM.FIXES).filter((f) => SIM.fixState(S, f) === 'ready');
    if (!ready.length) { await this.run(COUNCIL.none); this.tableAll(); }
    for (const f of ready) {
      const F = SIM.FIXES[f];
      await this.say('you', COUNCIL.present[f]);
      const k = await this.choose(COUNCIL.frame.map((x) => ({ t: x.t })));
      const frame = COUNCIL.frame[k].key;
      if (frame === 'voices' || frame === 'many') for (const b of S.support[f] || []) { const line = (TALK[b].back[f] || []).find((n) => n.who); if (line) await this.say(b, line.t); }
      if (frame === 'need') await this.say('you', 'This is not a favor. I live here too.');
      let blendArg = S.blend.score >= 120 && !S.flags.blendArgued;
      if (blendArg) { S.flags.blendArgued = 1; await this.say('hollis', COUNCIL.blendArg.t); if (S.flags.rue_free) { await this.say('rue', COUNCIL.rueRebut.t); this.fieldNote('burnout'); blendArg = false; } }
      const votes = {
        pip: ['quiet', 'board', 'ramp'].includes(f) || frame === 'many' || (S.bonds.pip || 0) >= 2,
        clover: SIM.supporters(S, f) >= 2,
        hollis: !!S.flags.hollis_archive || (S.bonds.hollis || 0) >= 2 || (frame === 'need' && (S.bonds.hollis || 0) >= 1),
      };
      if (blendArg || (S.blend.score >= 120 && !S.flags.rue_free)) votes.pip = votes.pip && frame === 'many' && !blendArg;
      // a sketch where everybody fits is hard to argue with
      if ((S.sketch || {})[f] === 'zoned' && !votes.hollis) { votes.hollis = true; await this.say('hollis', 'A sketch where every single person has a place that fits. I can hardly argue with that. I have tried.'); }
      let yes = 0;
      for (const who of ['pip', 'clover', 'hollis']) { await this.say(who, COUNCIL.votes[who][votes[who] ? (who === 'hollis' && !S.flags.hollis_archive ? 'yesPlain' : 'yes') : 'no']); if (votes[who]) yes++; else if (who === 'clover') this.know('clover', 'no'); }
      if (yes >= 2) { await this.say('hollis', COUNCIL.passed); await this.say('clover', COUNCIL.passedClover); S.fixes[f] = 'built'; G.applyFix(f); G.audio.sfx('fix'); this.fieldNote('curb'); this.keep('built_' + f, 'The ' + F.short + ', voted through', '#9fd3b0'); }
      else { await this.say('hollis', COUNCIL.failed); S.fixes[f] = 'tabled'; }
    }
    ui.hideDialog(); ui.letterbox(false);
    S.min = Math.max(S.min, 1140);
    await G.stage.fadeTo(1, 600);
    await G.exitRoom(true);
    await G.stage.fadeTo(0, 600);
    this.saveNow('meeting', S.day);
    this.ui.toast('The festival starts at 8 in Market Square.');
  }
  tableAll() { for (const f of Object.keys(this.S.fixes)) if (this.S.fixes[f] === 'ready') this.S.fixes[f] = 'tabled'; }

  // ---------- the Lantern Festival ----------
  async festival() {
    const G = this.G, S = this.S;
    S.flags.festival = 1; G.busy++;
    await G.stage.fadeTo(1, 700);
    if (G.loc !== 'town') G.setLoc('town');
    G.town.setFestival(true); S.min = Math.max(S.min, 1200);
    for (const k of Object.keys(S.fixes)) if (S.fixes[k] === 'approved') { S.fixes[k] = 'built'; G.applyFix(k); }
    G.place([30, 34.5]); G.player.heading = Math.PI;
    G.placeFestival();
    G.audio.setScene('festival');
    G.stage.shot(new THREE.Vector3(30, 22, 54), new THREE.Vector3(30, 1, 24), 40, 0.5, true);
    await G.stage.fadeTo(0, 900);
    await this.ui.caption(FESTIVAL.arrive, 3000);
    G.stage.follow(G.player.root.position, { dist: 15, pitch: 0.8 });
    G.busy--; G.mode = 'play';
    S.handled[S.day + ':festival:3'] = 0;
  }
  async festivalLine(id) {
    const S = this.S, L = FESTIVAL.lines, F = S.fixes;
    const pickLine = {
      bea: F.board === 'built' ? L.bea_daughter : L.bea_alone, wren: S.flags.wren_invited ? L.wren_here : L.wren_work, rue: S.flags.rue_free ? L.rue_free : L.rue_streak,
      gil: F.dim === 'built' ? L.gil_dim : F.plain === 'built' ? L.gil_plain : L.gil_same, moss: F.quiet === 'built' ? L.moss_quiet : L.moss_same,
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
    const G = this.G, S = this.S, F = S.fixes;
    const key = SIM.endingOf(S); const E = ENDINGS[key];
    const after = G.portrait();
    const fates = [];
    fates.push(F.board === 'built' ? 'Bea\'s daughter made the 7:40, because the bus board said Elm Street in big letters.' : 'Bea waited at the bench for the 7:40. It went down Elm Street again.');
    fates.push(S.flags.wren_invited ? 'Wren came to the festival, and pointed out which lanterns were theirs. Most of them.' : 'Wren spent the festival in the workshop, finishing lanterns nobody had ordered yet.');
    fates.push(S.flags.rue_free ? 'Rue came without the app, and said her face was doing things she had not told it to.' : 'Rue spent the festival chasing a four-hundred-and-fourteen-day streak.');
    { const w = ['ramp', 'dim', 'plain'].filter((f) => F[f] === 'built'); if (w.length) fates.push('The Works is a little different now: ' + LIST(w.map((f) => SIM.FIXES[f].short)) + '. Other people use ' + (w.length > 1 ? 'them' : 'it') + ' more than you do.'); }
    fates.push(S.flags.hollis_archive ? 'Hollis has started talking about a new statue, with lots of shapes, possibly designed by committee.' : 'The statue of the Standard Resident still stands in the square, fitting no one.');
    const seenBend = Object.keys(S.revealed || {}).filter((k) => S.revealed[k] === 'seen').map((k) => CAST[k].name);
    if (seenBend.length) fates.push('You got to know ' + LIST(seenBend) + ' well enough to see how they bend. Everyone bends somewhere. Some people bend all day.');
    const made = S.lanternsMade || []; const right = made.filter((m) => m.score === 3).map((m) => m.name);
    if (made.length) fates.push(right.length ? LIST(right) + (right.length > 1 ? ' each' : '') + ' found the lantern you made, and knew it was theirs before reading the name.' : made.length === 1 ? 'One lantern rose for ' + made[0].name + '. It was not quite right. ' + made[0].name + ' watched it all the way up anyway.' : (['', '', 'Two', 'Three'][made.length] || made.length) + ' lanterns rose for people you know. They were not quite right. People watched them all the way up anyway.');
    const fish = Object.keys(S.pond || {}).length; if (fish) fates.push('You met ' + fish + ' kind' + (fish > 1 ? 's' : '') + ' of fish in the pond, each in its own part of the water, and let every one go.');
    const jar = (S.jar || []).length; fates.push(jar >= 12 ? 'The jar on your windowsill is full. It does not need anything else. It just glows.' : 'The jar on your windowsill holds ' + jar + ' kept moment' + (jar === 1 ? '' : 's') + '. It never needed to be full.');
    if (S.blend.deleted) fates.push('Blend sent you three emails asking you to come back. The birds did not send anything. They were just there.');
    const tf = SIM.townFit(S.fixes).all;
    if (tf > S.tf0 + 0.001) fates.push('Of a thousand simulated residents, about ' + Math.round((tf - S.tf0) * 1000) + ' more now get by in Larkspur than when you arrived.');
    G.audio.setScene('title');
    this.ui.hud(false); this.ui.letterbox(false); this.ui.clearBubbles();
    this.fieldNote('avatar'); this.fieldNote('nosim');
    const seen = S.notes || {}; const notes = FIELD_NOTES.map((n) => Object.assign({ seen: !!seen[n.id] }, n)).sort((a, b) => (b.seen ? 1 : 0) - (a.seen ? 1 : 0));
    await this.ui.ending({ before: S.portrait0, after, title: E.title, text: E.text, fates, questions: QUESTIONS, notes });
  }
}
