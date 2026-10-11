// The fit engine and season state. No numbers from here are shown during play; they drive light, sound, camera and your body.
import { clamp, lerp, makeRng } from './util.js';

export const DIMS = ['sound', 'light', 'people', 'talk', 'time', 'change'];
export const BAND = 0.18;
export const DIM_WORDS = {
  sound: { over: 'louder than you like', under: 'so quiet your thoughts get loud' },
  light: { over: 'brighter than your eyes want', under: 'dimmer than you like' },
  people: { over: 'more crowded than you like', under: 'lonelier than you like' },
  talk: { over: 'full of hints', under: 'blunter than you are used to' },
  time: { over: 'later than your body wants', under: 'earlier than your body wants' },
  change: { over: 'full of surprises', under: 'stiff with rules' },
};
// sound, light, people per band (morning, midday, afternoon, evening); talk/change constant per place
export const PLACES = {
  works: { sound: [0.7, 0.75, 0.72, 0.45], light: [0.92, 0.92, 0.92, 0.9], people: [0.72, 0.7, 0.72, 0.3], talk: 0.8, change: 0.2, demand: true },
  hall: { sound: [0.45, 0.5, 0.5, 0.72], light: [0.7, 0.7, 0.7, 0.76], people: [0.4, 0.45, 0.45, 0.86], talk: 0.75, change: 0.3, demand: true },
  market: { sound: [0.5, 0.88, 0.62, 0.62], light: [0.62, 0.8, 0.72, 0.5], people: [0.45, 0.92, 0.6, 0.6], talk: 0.6, change: 0.55 },
  transit: { sound: [0.62, 0.6, 0.62, 0.66], light: [0.6, 0.72, 0.66, 0.45], people: [0.45, 0.5, 0.5, 0.7], talk: 0.5, change: 0.82 },
  commons: { sound: [0.32, 0.38, 0.36, 0.25], light: [0.6, 0.76, 0.66, 0.32], people: [0.28, 0.4, 0.4, 0.2], talk: 0.45, change: 0.45 },
  farend: { sound: [0.08, 0.1, 0.1, 0.06], light: [0.32, 0.4, 0.36, 0.18], people: [0.08, 0.12, 0.12, 0.06], talk: 0.1, change: 0.35 },
  homerow: { sound: [0.3, 0.35, 0.35, 0.3], light: [0.55, 0.66, 0.6, 0.3], people: [0.3, 0.35, 0.35, 0.25], talk: 0.5, change: 0.4 },
  street: { sound: [0.4, 0.5, 0.45, 0.35], light: [0.6, 0.72, 0.66, 0.35], people: [0.35, 0.5, 0.45, 0.3], talk: 0.5, change: 0.5 },
  festival: { sound: [0.82, 0.82, 0.82, 0.82], light: [0.7, 0.7, 0.7, 0.7], people: [0.92, 0.92, 0.92, 0.92], talk: 0.6, change: 0.6, demand: true },
};
export const OWNERS = { works: 'gil', market: 'moss', commons: 'clover', farend: 'wren', hall: 'hollis' };
export const FIX_FOR = { works: { light: 'dim', talk: 'plain', wheels: 'ramp' }, market: { sound: 'quiet', people: 'quiet' }, transit: { change: 'board', sound: 'board' }, homerow: { people: 'lanterns', talk: 'lanterns' }, farend: { people: 'lanterns' } };
export const bandOf = (min) => (min < 660 ? 0 : min < 840 ? 1 : min < 1080 ? 2 : 3);
export const timeDemand = (min) => clamp((min - 420) / 840);

export function newState(seed) {
  return {
    seed, day: 0, min: 1140, profile: { sound: 0.5, light: 0.5, people: 0.5, talk: 0.5, time: 0.5, change: 0.5 }, wheels: false,
    look: null, look0: null, name: 'Sam', pronoun: 'they',
    energy: 100, maxE: 100, self: 100, strain: 0, spot: 0, coins: 20, burnoutDays: 0, burnout: false,
    gear: { headphones: false, shades: false }, wearing: { headphones: false, shades: false },
    blend: { has: false, smooth: false, score: 0, streak: 0, usedToday: false, badges: [], uses: 0, drops: 0, deleted: false, dep: 0 },
    lantern: { entries: {}, learned: {} },
    bonds: { gil: 0, pip: 0, moss: 0, rue: 0, bea: 0, wren: 0, clover: 0, hollis: 0 },
    met: {}, flags: {}, talked: {}, fixes: {}, support: {}, mods: {}, handled: {},
    stats: { bend: 0, ask: 0, gear: 0, fix: 0, leave: 0, smooth: 0, shifts: 0, sat: 0 },
    tf0: 0, tf: 0, log: [], zone: 'home', masking: false,
    act: 1, gw: { gil: 1, moss: 1, clover: 1, hollis: 1 }, owe: {}, w: {}, stakes: {}, ideaFrom: {}, sights: {}, texts: [], fired: {},
  };
}
export function levels(S, zone, min) {
  if (zone === 'home') return Object.assign({}, S.profile);
  const P = PLACES[zone] || PLACES.street; const b = bandOf(min);
  const L = { sound: P.sound[b], light: P.light[b], people: P.people[b], talk: P.talk, change: P.change, time: timeDemand(min) };
  const F = S.fixes || {};
  // the quiet hour is noon to one; the quiet corner helps a little all day
  if (zone === 'market' && F.quiet === 'built') { const k = min >= 720 && min < 780 ? 1 : b === 1 ? 0.4 : 0.25; L.sound -= 0.3 * k; L.people -= 0.25 * k; }
  if (zone === 'works' && F.dim === 'built') L.light = clamp(S.profile.light, 0.4, 0.75);
  if (zone === 'works' && F.plain === 'built') L.talk = 0.35;
  if (zone === 'transit' && F.board === 'built') L.change = 0.4;
  if ((zone === 'homerow' || zone === 'farend') && F.lanterns === 'built') { L.people = clamp(L.people + (S.profile.people - L.people) * 0.5); L.talk -= 0.25; }
  const m = S.mods[zone]; if (m) for (const k in m) L[k] = clamp(L[k] + m[k]);
  for (const k in L) L[k] = clamp(L[k]);
  return L;
}
export function pinchOf(profile, L, wearing, zone) {
  const demand = (PLACES[zone] || {}).demand;
  const W = { sound: 1, light: 1, people: 1, talk: 0.3, time: demand ? 0.7 : 0.15, change: 0.45 };
  const res = { total: 0, dims: {}, top: null, topV: 0, over: 0, under: 0 };
  for (const d of ['sound', 'light', 'people', 'talk', 'time', 'change']) {
    let lv = L[d];
    if (wearing && wearing.headphones && d === 'sound') lv = lv > profile.sound ? Math.max(profile.sound, lv - 0.42) : Math.min(profile.sound, lv + 0.3);
    if (wearing && wearing.shades && d === 'light' && lv > profile.light) lv = Math.max(profile.light, lv - 0.38);
    const diff = lv - profile[d];
    const over = Math.max(0, diff - BAND), under = Math.max(0, -diff - BAND);
    const v = (over + under * 0.75) * W[d];
    res.dims[d] = { over, under, v };
    res.total += v; res.over += over * W[d]; res.under += under * 0.75 * W[d];
    if (v > res.topV) { res.topV = v; res.top = d; }
  }
  return res;
}
export const pinch = (S, zone, min) => pinchOf(S.profile, levels(S, zone, min), S.wearing, zone);

// a minute of life: drains, recoveries, slow drift
export function tick(S, mins, ctx) {
  const p = ctx.pinch; const T = p ? p.total : 0;
  const smooth = S.blend.has && S.blend.smooth;
  const masked = S.masking || smooth;
  let drain = 0.03 + T * 0.36;
  if (masked) drain *= 0.8;
  if (ctx.zone === 'home') drain = -0.12;
  S.energy = clamp(S.energy - drain * mins, 0, S.maxE);
  if (masked && T > 0.08) { S.self = clamp(S.self - (smooth ? 0.05 : 0.025) * T * mins, 0, 100); S.strain += 0.004 * T * mins; }
  if (smooth) S.self = clamp(S.self - 0.013 * mins, 0, 100);
  if (!masked && T < 0.08) S.self = clamp(S.self + (ctx.zone === 'home' ? 0.05 : 0.025) * mins, 0, 100);
  if (!masked && T > 0.25) S.strain += 0.002 * T * mins;
  S.spot = clamp(S.spot - 0.003 * mins + ((S.wearing.headphones || S.wearing.shades) && ctx.levels ? 0.0016 * ctx.levels.people * mins : 0), 0, 1);
}
export function bendCost(S, smooth) { S.self = clamp(S.self - (smooth ? 3.4 : 3), 0, 100); S.strain += smooth ? 0.7 : 1; S.energy = clamp(S.energy - 4, 0, S.maxE); }

export function nightUpdate(S) {
  const r = { burnout: false };
  if (S.strain >= 5) { r.burnout = true; S.burnout = true; S.burnoutDays++; S.maxE = 72; S.strain = Math.max(0, S.strain - 3); }
  else { S.burnout = false; S.maxE = 100; S.strain = Math.max(0, S.strain - 2.5); S.self = clamp(S.self + 3, 0, 100); }
  S.energy = S.maxE;
  if (S.blend.has && !S.blend.deleted) { if (S.blend.usedToday) S.blend.streak++; else { r.lostStreak = S.blend.streak; S.blend.streak = 0; } S.blend.usedToday = false; }
  S.mods = {}; S.handled = {}; S.masking = false; S.talked = {};
  return r;
}
export const wakeMin = (S) => Math.round(420 + S.profile.time * 70);

// a thousand residents nobody designed for
const POP = (() => { const r = makeRng(4063); const a = []; for (let i = 0; i < 1000; i++) { const v = () => 0.05 + r() * 0.9; a.push({ profile: { sound: v(), light: v(), people: v(), talk: v(), time: v(), change: v() }, wheels: r() < 0.08 }); } return a; })();
const FIT_ZONES = ['works', 'market', 'transit', 'commons', 'farend', 'homerow', 'hall'];
export function townFit(fixes) {
  const fake = { fixes: fixes || {}, mods: {}, profile: null };
  const by = {}; let sum = 0;
  for (const z of FIT_ZONES) {
    let ok = 0;
    for (const p of POP) {
      fake.profile = p.profile;
      let worst = 0;
      for (const m of [540, 760, 960, 1200]) worst = Math.max(worst, pinchOf(p.profile, levels(fake, z, m), null, z).total);
      if (z === 'works' && p.wheels && fake.fixes.ramp !== 'built') worst += 1;
      if (worst < 0.42) ok++;
    }
    by[z] = ok / POP.length; sum += by[z];
  }
  return { by, all: sum / FIT_ZONES.length };
}

export const FIXES = {
  quiet: { name: 'A quiet hour at the market', short: 'quiet hour', zone: 'market', approve: 'council', backers: ['moss', 'bea'], principle: 'Flexibility in use', what: 'From noon to one the music goes off, the stalls spread out, and there is a quiet corner all day.', also: 'parents with sleeping babies, anyone on a phone call, people with hearing aids. The apple seller will miss shouting.' },
  board: { name: 'A bus board that shows changes', short: 'bus board', zone: 'transit', approve: 'council', backers: ['bea', 'pip'], principle: 'Perceptible information', what: 'Every route change goes up in big letters, not just over the speaker.', also: 'visitors, anyone with headphones in, anyone who was talking when the speaker crackled.' },
  lanterns: { name: 'Porch lanterns on Home Row', short: 'porch lanterns', zone: 'homerow', approve: 'council', backers: ['wren', 'moss'], principle: 'Perceptible information', what: 'A teal light means come say hi. An amber one means not now. No one has to guess.', also: 'shy neighbors, people who are unwell, new parents. People who love surprise visits will have to text.' },
  ramp: { name: 'A ramp at the Works', short: 'ramp', zone: 'works', approve: 'gil', backers: ['bea', 'pip'], principle: 'Low physical effort', what: 'A gentle ramp beside the front steps, with rails.', also: 'Pip and her bread cart, parents with strollers, delivery carts, anyone with a sore knee.' },
  dim: { name: 'Dimmable lights at the Works', short: 'dimmable lights', zone: 'works', approve: 'gil', backers: ['gil', 'clover'], principle: 'Flexibility in use', what: 'The overhead panels soften, and each desk gets its own lamp.', also: 'Gil and his headaches, anyone working late. People who like it bright turn their own lamp up.' },
  plain: { name: 'Plain-language meeting notes', short: 'plain notes', zone: 'works', approve: 'gil', backers: ['wren', 'rue'], principle: 'Simple and intuitive use', what: 'Every meeting ends with one note: who does what, by when.', also: 'new staff, tired staff, anyone who missed the meeting, and Gil, who forgets.' },
};
export function fixState(S, id) { return S.fixes[id] || 'none'; }
export function supporters(S, id) { return (S.support[id] || []).length; }
export function builtCount(S) { return Object.values(S.fixes).filter((v) => v === 'built').length; }
export function friends(S) { return Object.values(S.bonds).filter((v) => v >= 2).length; }

export function endingOf(S) {
  const built = builtCount(S);
  if (S.self < 40) return 'blended';
  if (built >= 3) return 'remade';
  if (built >= 1) return 'manyplace';
  if (S.stats.leave >= 4) return 'movedon';
  if (friends(S) >= 2) return 'island';
  return 'working';
}
