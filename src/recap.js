// "Start from a recap": for someone who played the first visit somewhere else, or wants to start ten years on. About
// two minutes: make your creature in your room, set the room's six dials in one panel, then six things about that
// first week (or "Choose for me"). It writes a first-visit carry marked as a recap (w.recap), so later fit cards count
// only the visits you played, and nothing on it is a name.
import * as THREE from 'three';
import * as SIM from './sim.js';
import * as SAVE from './save.js';
import { CAST, SETUP } from './content.js';
import { DEFAULTS } from './decided.js';

export const RECAP_FIXES = ['quiet', 'board', 'lanterns', 'ramp', 'dim', 'plain'];
export const RECAP_PEOPLE = ['gil', 'pip', 'moss', 'rue', 'bea', 'wren', 'clover', 'hollis'];
const pickN = (list, n, rnd) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

// "Choose for me": a plausible first week, never the faded ending more than now and then
export function randomPast(rnd = Math.random) {
  const built = pickN(RECAP_FIXES, rnd() < 0.25 ? 1 : 2, rnd);
  const listened = {}; for (const f of built) listened[f] = rnd() < 0.6;
  const blend = ['never', 'kept', 'deleted'][Math.floor(rnd() * 3)];
  // "Start without Blend" only makes sense if Blend is still on your phone
  const dflts = Object.keys(DEFAULTS).filter((d) => d !== 'blend_off' || blend === 'kept');
  return {
    built, listened, people: pickN(RECAP_PEOPLE, 3 + (rnd() < 0.5 ? 1 : 0), rnd),
    rue: rnd() < 0.55 ? 'easing' : 'streak', blend,
    left: rnd() < 0.75 ? 'yourself' : 'faded', dflt: dflts[Math.floor(rnd() * dflts.length)],
  };
}

// the carry a first visit like that would have written (same shape as ending.js buildCarry)
export function recapCarry(look, pronoun, profile, past) {
  const fixes = {};
  for (const f of SAVE.FIX_SLOTS) {
    const on = past.built.includes(f); const l = on && !!past.listened[f];
    fixes[f] = { s: on ? 'built' : 'none', variant: l ? SIM.FIXES[f].variant : 'whole', listened: l, via: SIM.FIXES[f].approve === 'gil' ? 'owner' : 'meeting' };
  }
  const people = {};
  for (const id of SAVE.RESIDENTS) { const k = past.people.includes(id); people[id] = { bond: k ? 2 : 1, gw: k ? 2 : 1, revealed: false, met: true }; }
  // as in a real first visit: Rue at the festival if she was easing off, and Wren paid for the lanterns at her price
  const w = { recap: 1 }; if (past.rue === 'easing') w.rue_festival = 1; if (past.built.includes('lanterns')) w.wren_paid = 1;
  return SAVE.normalizeCarry({
    act: 1, look, look0: look, comfort: look.comfort || 'hum', pronoun, profile, fixes, people,
    rue: past.rue, blend: past.blend, dep: past.blend === 'kept' ? 3 : past.blend === 'deleted' ? 1 : 0,
    colour: past.left === 'faded' ? 'faded' : 'yourself', selfEnd: past.left === 'faded' ? 55 : 82, default: past.dflt || 'as_is', pushHabit: 'none',
    w, tally: {}, endings: { 1: '', 2: '', 3: '' }, jar: 0,
  });
}

// the whole recap, from the title: resolves with { carry, name }, or null if you went back
export async function recap(story, live) {
  const G = story.G, S = story.S, ui = story.ui;
  const had = SAVE.readCarry().carry; const done = Object.keys((had && had.acts) || {}).length > 0;
  // a recap replaces what this browser remembers: a visit in progress, and the finished ones
  const what = live && done ? 'your saved visit (' + (live.label || 'in progress') + ') and the finished visits this browser remembers' : live ? 'your saved visit (' + (live.label || 'in progress') + ')' : done ? 'the finished visits this browser remembers' : '';
  if (what && !(await G.menus.confirm('Start from a recap?', 'This replaces ' + what + '. Your settings stay.', 'Start from a recap', 'Go back'))) return null;
  // you: the mirror in your room, as on the first night
  G.mode = 'cine'; await G.stage.fadeTo(1, 500);
  G.setLoc('home'); G.player.root.visible = true; G.place([0.6, 0.2]); G.player.heading = 0.25;
  G.audio.setScene('home');
  G.stage.shot(new THREE.Vector3(1.6, 1.55, 4.1), new THREE.Vector3(0.45, 0.62, 0.1), 34, 3, true);
  if (window.innerWidth > 760) G.stage.offsetX(Math.min(220, window.innerWidth * 0.17)); else G.stage.offsetX(0, Math.round(window.innerHeight * 0.24));
  await G.stage.fadeTo(0, 500);
  G.mode = 'creator'; G.posePreview = true; if (!S.look.comfort) S.look.comfort = 'hum';
  const look = await ui.creator(S.look, (L, k) => { S.look = L; S.wheels = !!L.wheels; G.player.setLook(L); if (k === 'comfort' || k === 'all') G.player.previewComfort(L.comfort || 'hum'); else G.player.hop(); if (k === 'voice') G.audio.voice(L.voice, 1, 'hello hello'); });
  G.posePreview = false; G.player.setComfort(look.comfort || 'hum', 0);
  S.look = look; S.wheels = !!look.wheels; G.player.setLook(look); G.stage.offsetX(0, 0);
  // your room: six dials, one panel
  G.mode = 'cine'; { const c = G.roomCam('home'); G.stage.shot(c.pos, c.look, c.fov, 1.2); }
  const home = G.rooms.home; const P = S.profile; const dial = {};
  for (const [k, sp] of Object.entries(SETUP)) dial[k] = sp.invert ? 1 - P[sp.dim] : P[sp.dim];
  const set = await ui.roomDials(dial, (k, val) => {
    if (k === 'lamp') home.setLight(val);
    if (k === 'sign') home.setSign(val);
    if (k === 'calendar') home.setCalendar(val);
    if (k === 'clock') home.objs.clock.group.rotation.y = (val - 0.5) * 0.6;
    if (k === 'note') home.objs.note.group.rotation.y = 0.2 + val * 0.6;
  });
  const profile = Object.assign({}, P);
  for (const [k, sp] of Object.entries(SETUP)) profile[sp.dim] = sp.invert ? 1 - set[k] : set[k];
  // that first week: six things, or choose for me
  const past = await ui.recapChoices({
    fixes: RECAP_FIXES.map((f) => ({ id: f, t: SIM.FIXES[f].short[0].toUpperCase() + SIM.FIXES[f].short.slice(1), stake: CAST[SIM.FIXES[f].stake].name })),
    people: RECAP_PEOPLE.map((id) => ({ id, t: CAST[id].name })),
    defaults: Object.entries(DEFAULTS).map(([id, d]) => ({ id, t: d.t })),
    random: () => randomPast(),
  });
  const carry = recapCarry(look, S.pronoun || 'they', profile, past);
  SAVE.writeCarry({ acts: { 1: carry } });
  return { carry, name: S.name };
}
