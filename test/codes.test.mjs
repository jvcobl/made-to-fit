// Tests for src/save.js: visit codes, save codes, validation, snapshots, merging and storage (with in-memory stand-ins
// for localStorage that work, throw, forget or fill up). Run with: node --test test/codes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import * as SV from '../src/save.js';
import * as SIM from '../src/sim.js';

// ---------- helpers ----------
// a small seeded generator (mulberry32), so every run checks the same cases
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const clone = (o) => JSON.parse(JSON.stringify(o));
// a code as the decoder sees it: case, separators and the I/L/O aliases do not matter
const canon = (s) => s.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
// independent of save.js: the nearest of the five profile steps
const nearest = (v) => SV.PROFILE_STEPS.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best));

function randomCarry(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const look = () => ({ shape: pick(SV.SHAPES), color: pick(SV.COLORS), pattern: pick(SV.PATTERNS), top: pick(SV.TOPS), wear: pick(SV.WEARS), voice: pick(SV.VOICES), wheels: r() < 0.5 });
  const profile = {}; for (const d of SV.DIMS) profile[d] = r();
  const fixes = {}; for (const id of SV.FIX_SLOTS) fixes[id] = { s: pick(SV.FIX_STATES), variant: pick(SV.VARIANTS), listened: r() < 0.5, via: pick(SV.VIA) };
  const people = {}; for (const id of SV.RESIDENTS) people[id] = { bond: int(0, 3), gw: int(0, 3), revealed: r() < 0.5, met: r() < 0.5 };
  const w = {}; for (const f of SV.WFLAGS) if (r() < 0.4) w[f] = 1;
  const tally = {}; for (const k of SV.TALLY) tally[k] = int(0, 31);
  return {
    act: int(1, 3), look: look(), look0: look(), comfort: pick(SV.COMFORT), pronoun: pick(SV.PRONOUNS), profile, fixes, people,
    rue: pick(SV.RUE), blend: pick(SV.BLEND), dep: int(0, 9), colour: pick(SV.COLOUR), selfEnd: int(0, 100), default: pick(SV.DEFAULTS),
    pushHabit: pick(SV.HABIT_ZONES), w, tally, endings: { 1: pick(SV.ENDINGS), 2: pick(SV.ENDINGS), 3: pick(SV.ENDINGS) }, jar: int(0, 12),
  };
}
const quantized = (c) => { const e = clone(c); for (const d of SV.DIMS) e.profile[d] = nearest(c.profile[d]); return e; };

// visit-code surgery for the 'range' tests: change data bits, then write a correct CRC
const bitsOf = (code) => SV.fromBase32(code.slice(5));
const setBits = (bits, at, n, v) => { for (let i = 0; i < n; i++) bits[at + i] = (v >> (n - 1 - i)) & 1; };
const readAt = (bits, at, n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[at + i]; return v; };
function withData(code, change) {
  const data = bitsOf(code).slice(0, SV.VISIT_DATA_BITS);
  change(data);
  const crc = SV.crc10(data); for (let i = 9; i >= 0; i--) data.push((crc >> i) & 1);
  return 'MTF1-' + SV.toBase32(data).match(/.{1,5}/g).join('-');
}
// bit offsets in the version 1 layout (checked against encoded values below)
const AT = { act: 0, shape: 2, color: 5, top: 11, wear: 14, voice: 17, wheels: 19, look0: 20, comfort: 38, pronoun: 41, profile: 43, fixes: 61, people: 133, rue: 181, blend: 183, dep: 185, colour: 189, selfEnd: 191, default: 198, pushHabit: 201, w: 205, tally: 229, endings: 254, jar: 266 };

// a state that has seen two days of play, with everything the snapshot should drop
function playedState(seed = 4242) {
  const S = SIM.newState(seed);
  S.look = { shape: 'tall', color: '#93c2ee', pattern: 'belly', top: 'longears', wear: 'scarf', voice: 'chime', wheels: true };
  S.look0 = Object.assign({}, S.look); S.wheels = true;
  S.name = 'Ulla Quist'; S.pronoun = 'she';
  S.day = 2; S.min = 545; S.energy = 81.25; S.self = 92.5; S.strain = 1.75; S.spot = 0.15; S.coins = 34;
  S.profile = { sound: 0.22, light: 0.8, people: 0.35, talk: 0.6, time: 0.7, change: 0.3 };
  S.flags = { shift1: 1, escort: 1, asked_moss: 1 }; S.met = { bea: 1, gil: 1, moss: 1 }; S.bonds.bea = 2; S.bonds.gil = -1;
  S.fixes = { quiet: 'proposal', ramp: 'built' }; S.support = { quiet: ['moss'] }; S.ideaFrom = { quiet: ['moss'] };
  S.handled = { '1:market': 'gear' }; S.mods = { market: { sound: -0.1 } }; S.unaskedDone = { '1:works': 1 };
  S.lantern.entries.henderson = { reading: 'Read between the lines', pending: 'right', result: null, day: 1, by: 'gil' };
  S.lantern.learned.gil = true;
  S.jar = [{ t: 'Gil adjusted before you asked', c: '#f6cf5b' }, { t: 'A quiet while by the pond', c: '#9edcd6' }];
  S.kept = { unasked_gil: 1, pond_quiet: 1 };
  S.blend.has = true; S.blend.score = 140; S.blend.badges = ['Smooth Operator']; S.blend.dep = 3;
  S.stats.bend = 3; S.stats.gear = 2; S.dayStats = Object.assign({}, S.stats); S.metAt0 = ['bea'];
  S.know = { gil: { over: true, no: true } }; S.revealed = { gil: 'pending' }; S.stakes = { quiet: 'yes' };
  S.lanternsMade = [{ id: 'bea', score: 3, name: 'Bea', glow: 'soft', color: '#ffcf7a', pattern: 'plain' }];
  S.texts = [['Bea', 'Pot back whenever. "Whenever."']];
  S.portrait0 = 'data:image/png;base64,' + 'A'.repeat(5000); S.tf0 = 0.41; S.tf = 0.5; S.work = { sort: { n: 5, day: 2 } };
  S._probe = { x: 1 }; S.lantern._cache = [1, 2, 3];
  return S;
}
const META = { build: 'test-build', act: 1, day: 2, phase: 'morning', label: 'Tuesday morning' };
function record(S = playedState(), meta = META) {
  const r = SV.validateSave(Object.assign({ v: SV.SAVE_V, savedAt: '2026-10-10T09:00:00.000Z', S: SV.snapshot(S).data }, meta));
  assert.ok(r.ok, r.why);
  return r.save;
}
const withoutName = (save) => { const e = clone(save); delete e.S.name; return e; };

// stand-ins for localStorage
class MemoryStorage {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); }
  getItem(k) { k = String(k); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(String(k)); }
  clear() { this.m.clear(); }
  key(i) { const ks = [...this.m.keys()]; return i < ks.length ? ks[i] : null; }
  get length() { return this.m.size; }
}
const denied = () => new DOMException('The operation is insecure.', 'SecurityError');
class BlockedStorage { getItem() { throw denied(); } setItem() { throw denied(); } removeItem() { throw denied(); } }
class ForgetfulStorage extends MemoryStorage { setItem() { /* accepts every write and keeps nothing */ } }
class FullStorage extends MemoryStorage {
  constructor(limit) { super(); this.limit = limit; }
  setItem(k, v) { if (String(v).length > this.limit) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); super.setItem(k, v); }
}
// runs fn with globalThis.localStorage set to storage (a function becomes a getter, to make the access itself throw)
function withStorage(storage, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', typeof storage === 'function' ? { get: storage, configurable: true } : { value: storage, configurable: true, writable: true });
  try { return fn(storage); } finally { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; }
}
// runs fn with a global (CompressionStream, DecompressionStream) taken away
async function without(name, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, name);
  delete globalThis[name];
  try { return await fn(); } finally { if (had) Object.defineProperty(globalThis, name, had); }
}

// ---------- visit codes ----------
test('visit code layout: 270 data bits + 10 CRC bits = 280 bits = 56 characters, 72 with prefix and hyphens', () => {
  assert.equal(SV.VISIT_DATA_BITS, 270);
  assert.equal(SV.VISIT_BITS, 280);
  assert.equal(SV.VISIT_CHARS, 56);
  const code = SV.encodeVisit(randomCarry(rng(1)));
  assert.equal(code.length, 72);
  assert.match(code, /^MTF1(-[0-9A-HJKMNP-TV-Z]{5}){11}-[0-9A-HJKMNP-TV-Z]$/);
});

test('visit code: 10,000 random valid carries round-trip exactly (after quantization)', () => {
  const r = rng(20261010);
  for (let i = 0; i < 10000; i++) {
    const c = randomCarry(r);
    if (i % 7 === 0) c.name = 'Ulla'; // never encoded
    const code = SV.encodeVisit(c);
    const out = SV.decodeVisit(code);
    assert.ok(out.carry, 'case ' + i + ': ' + out.error);
    const want = quantized(c); delete want.name;
    assert.deepEqual(out.carry, want, 'case ' + i);
    assert.deepEqual(SV.normalizeCarry(c), want);
  }
});

test('visit code: field offsets match the documented layout', () => {
  const c = randomCarry(rng(5));
  Object.assign(c, { act: 3, selfEnd: 100, jar: 12, dep: 9, rue: 'free', default: 'text_first', pushHabit: 'festival', colour: 'grey', comfort: 'charm', pronoun: 'he' });
  c.look.shape = 'boxy'; c.look.color = '#c9b8a6'; c.look.wheels = true; c.look0.shape = 'blobby';
  c.profile.sound = 0.9; c.fixes.quiet = { s: 'built', variant: 'shared', listened: true, via: 'owner' };
  c.people.gil = { bond: 3, gw: 2, revealed: true, met: false }; c.w = { hall_quiet_row: 1, spare: 1 };
  c.tally = { bend: 31, gear: 0, ask: 0, fix: 0, leave: 17 }; c.endings = { 1: 'working', 2: '', 3: 'blended' };
  const b = bitsOf(SV.encodeVisit(c));
  assert.equal(readAt(b, AT.act, 2), 3);
  assert.equal(readAt(b, AT.shape, 3), 4); assert.equal(readAt(b, AT.color, 4), 11); assert.equal(readAt(b, AT.wheels, 1), 1);
  assert.equal(readAt(b, AT.look0, 3), 3);
  assert.equal(readAt(b, AT.comfort, 3), 6); assert.equal(readAt(b, AT.pronoun, 2), 2);
  assert.equal(readAt(b, AT.profile, 3), 4);
  assert.equal(readAt(b, AT.fixes, 6), 0b101111); // built (2), shared (3), listened, owner
  assert.equal(readAt(b, AT.people, 6), 0b111010); // bond 3, gw 2, revealed, not met
  assert.equal(readAt(b, AT.rue, 2), 2); assert.equal(readAt(b, AT.dep, 4), 9); assert.equal(readAt(b, AT.colour, 2), 2);
  assert.equal(readAt(b, AT.selfEnd, 7), 100); assert.equal(readAt(b, AT.default, 3), 5); assert.equal(readAt(b, AT.pushHabit, 4), 9);
  assert.equal(readAt(b, AT.w, 24), (1 << 23) | 1);
  assert.equal(readAt(b, AT.tally, 5), 31); assert.equal(readAt(b, AT.tally + 20, 5), 17);
  assert.equal(readAt(b, AT.endings, 4), 8); assert.equal(readAt(b, AT.endings + 4, 4), 0); assert.equal(readAt(b, AT.endings + 8, 4), 1);
  assert.equal(readAt(b, AT.jar, 4), 12);
});

test('visit code: every single-character substitution is rejected', () => {
  const r = rng(77);
  const codes = [SV.encodeVisit({}), SV.encodeVisit(randomCarry(r))];
  for (let i = 0; i < 18; i++) codes.push(SV.encodeVisit(randomCarry(r)));
  const subs = [...B32, ...'UILOuilo*._#', '-', ' '];
  let checked = 0;
  for (const code of codes) {
    for (let i = 0; i < code.length; i++) for (const ch of subs) {
      const alt = code.slice(0, i) + ch + code.slice(i + 1);
      if (canon(alt) === canon(code)) continue; // the same code: an alias, a case change or a separator for a separator
      const out = SV.decodeVisit(alt);
      assert.ok(out.error, 'accepted ' + alt + ' (from ' + code + ')');
      checked++;
    }
  }
  assert.ok(checked > 50000, 'checked ' + checked);
});

test('visit code: every adjacent transposition of distinct characters is rejected', () => {
  const r = rng(78);
  let checked = 0;
  for (let n = 0; n < 200; n++) {
    const code = SV.encodeVisit(randomCarry(r));
    // as written (a swap with a hyphen only moves the hyphen, which is the same code)
    for (let i = 0; i + 1 < code.length; i++) {
      if (code[i] === code[i + 1]) continue;
      const alt = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
      if (canon(alt) === canon(code)) continue;
      assert.ok(SV.decodeVisit(alt).error, 'accepted ' + alt); checked++;
    }
    // as typed without hyphens, so neighbours across a group boundary are swapped too
    const flat = canon(code);
    for (let i = 0; i + 1 < flat.length; i++) {
      if (flat[i] === flat[i + 1]) continue;
      const alt = flat.slice(0, i) + flat[i + 1] + flat[i] + flat.slice(i + 2);
      assert.ok(SV.decodeVisit(alt).error, 'accepted ' + alt); checked++;
    }
  }
  assert.ok(checked > 20000, 'checked ' + checked);
});

test('visit code: CRC-10 matches the standard check value and catches every burst of up to 10 bits', () => {
  const bytes = [...Buffer.from('123456789')].flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (b >> i) & 1));
  assert.equal(SV.crc10(bytes), 0x199); // CRC-10/ATM
  const data = bitsOf(SV.encodeVisit(randomCarry(rng(9)))); // 280 bits: data + CRC
  const good = (bits) => SV.crc10(bits.slice(0, 270)) === readAt(bits, 270, 10);
  assert.ok(good(data));
  for (let start = 0; start < 280; start++) for (let pat = 1; pat < 1024; pat += 2) { // bursts that start at start
    if (start + 32 - Math.clz32(pat) > 280) continue;
    const bad = data.slice(); for (let j = 0; j < 10; j++) if ((pat >> j) & 1) bad[start + j] ^= 1;
    assert.ok(!good(bad), 'burst ' + pat + ' at ' + start);
  }
});

test('visit code: Crockford aliases, case, spacing and dash look-alikes decode', () => {
  const c = randomCarry(rng(11)); c.act = 1; c.selfEnd = 1; c.jar = 0;
  const code = SV.encodeVisit(c); const want = SV.decodeVisit(code).carry;
  assert.ok(want);
  const variants = [
    code.toLowerCase(),
    code.replace(/-/g, ' '),
    code.replace(/-/g, ''),
    '  ' + code.replace(/-/g, '  ') + '\n',
    code.replace(/1/g, 'I'), code.replace(/1/g, 'l'), code.replace(/1/g, 'L'), code.replace(/0/g, 'O'), code.replace(/0/g, 'o'),
    code.replace(/-/g, '–'), // en dash, as notes apps write it
    code.replace(/[0-9A-Z]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0)), // full-width letters and digits
    'MTFI' + code.slice(4), // the version digit typed as I
  ];
  for (const v of variants) assert.deepEqual(SV.decodeVisit(v).carry, want, v);
  assert.ok(code.includes('1') || code.includes('0'), 'the aliases above should have had something to replace');
});

test('visit code: U, junk, wrong length, wrong version and bad CRC are rejected', () => {
  const code = SV.encodeVisit(randomCarry(rng(12)));
  const at = code.lastIndexOf('-') - 1; // a payload character
  assert.equal(SV.decodeVisit(code.slice(0, at) + 'U' + code.slice(at + 1)).error, 'format');
  assert.equal(SV.decodeVisit(code.slice(0, at) + 'u' + code.slice(at + 1)).error, 'format');
  assert.equal(SV.decodeVisit('MTF2' + code.slice(4)).error, 'version');
  assert.equal(SV.decodeVisit('MTF0' + code.slice(4)).error, 'version');
  assert.equal(SV.decodeVisit('MTFO' + code.slice(4)).error, 'version'); // O reads as 0
  assert.equal(SV.decodeVisit('MTFX' + code.slice(4)).error, 'format');
  assert.equal(SV.decodeVisit('MTF' + code.slice(5)).error, 'format'); // no version at all
  assert.equal(SV.decodeVisit(code.slice(0, -1)).error, 'format');
  assert.equal(SV.decodeVisit(code + 'A').error, 'format');
  assert.equal(SV.decodeVisit('Code: ' + code).error, 'format'); // the whole input must be the code
  for (const junk of ['', 'MTF', 'MTF1', 'hello', 'MTFS1z.abc', null, undefined, 42, {}, 'MTF1-' + 'A'.repeat(500)]) assert.equal(SV.decodeVisit(junk).error, 'format', String(junk));
  const flip = code.slice(0, 8) + (code[8] === '7' ? '8' : '7') + code.slice(9);
  assert.equal(SV.decodeVisit(flip).error, 'check');
});

test('visit code: out-of-range values with a valid CRC are rejected as range', () => {
  const code = SV.encodeVisit(randomCarry(rng(13)));
  const cases = [['act', 2, 0], ['shape', 3, 5], ['shape', 3, 7], ['color', 4, 12], ['color', 4, 15], ['top', 3, 6], ['wear', 3, 7], ['comfort', 3, 7],
    ['pronoun', 2, 3], ['profile', 3, 5], ['profile', 3, 7], ['fixes', 2, 3], ['rue', 2, 3], ['dep', 4, 10], ['dep', 4, 15], ['colour', 2, 3],
    ['selfEnd', 7, 101], ['selfEnd', 7, 127], ['default', 3, 6], ['pushHabit', 4, 10], ['endings', 4, 9], ['jar', 4, 13], ['jar', 4, 15]];
  for (const [k, n, v] of cases) assert.equal(SV.decodeVisit(withData(code, (d) => setBits(d, AT[k], n, v))).error, 'range', k + '=' + v);
  // the largest valid values still decode
  const fine = withData(code, (d) => { setBits(d, AT.selfEnd, 7, 100); setBits(d, AT.jar, 4, 12); setBits(d, AT.dep, 4, 9); setBits(d, AT.act, 2, 3); });
  const out = SV.decodeVisit(fine);
  assert.ok(out.carry);
  assert.deepEqual([out.carry.selfEnd, out.carry.jar, out.carry.dep, out.carry.act], [100, 12, 9, 3]);
});

test('visit code: encoding forgives unknown values, clamps numbers and ignores everything else', () => {
  const out = SV.decodeVisit(SV.encodeVisit({
    act: 9, look: { shape: 'hexagon', color: '#F6CF5B', pattern: '<b>', top: null, voice: 'hum', wheels: 'yes' }, comfort: 'unknown', pronoun: 'xe',
    profile: { sound: -3, light: 7, people: 'loud', talk: 0.2, time: 0.6 }, fixes: { quiet: { s: 'idea', variant: 'zoned', listened: 0 }, nonsense: { s: 'built' } },
    people: { gil: { bond: -2, gw: 9 }, pip: { bond: 2.6, met: 1 }, stranger: { bond: 3 } }, dep: 99, selfEnd: 140.7, w: { rue_pond: true, wren_paid: 0, made_up: 1 },
    tally: { bend: 100, gear: -1, ask: 'x' }, endings: { 1: 'remade', 2: 'island' }, jar: 30, name: 'Ulla', email: 'u@example.com',
  })).carry;
  assert.equal(out.act, 3);
  assert.deepEqual(out.look, { shape: 'round', color: '#f6cf5b', pattern: 'plain', top: 'ears', wear: 'none', voice: 'hum', wheels: true });
  assert.equal(out.comfort, 'hum'); assert.equal(out.pronoun, 'they');
  assert.deepEqual(out.profile, { sound: 0.1, light: 0.9, people: 0.5, talk: 0.3, time: 0.7, change: 0.5 }); // 0.2 is a tie: rounds up
  assert.deepEqual(out.fixes.quiet, { s: 'none', variant: 'zoned', listened: false, via: 'meeting' });
  assert.equal(Object.keys(out.fixes).length, 12); assert.ok(!('nonsense' in out.fixes));
  assert.deepEqual(out.people.gil, { bond: 0, gw: 3, revealed: false, met: false });
  assert.deepEqual(out.people.pip, { bond: 3, gw: 0, revealed: false, met: true });
  assert.ok(!('stranger' in out.people));
  assert.equal(out.dep, 9); assert.equal(out.selfEnd, 100); assert.equal(out.jar, 12);
  assert.deepEqual(out.w, { rue_pond: 1 });
  assert.deepEqual(out.tally, { bend: 31, gear: 0, ask: 0, fix: 0, leave: 0 });
  assert.deepEqual(out.endings, { 1: '', 2: 'island', 3: '' });
  assert.ok(!('name' in out) && !('email' in out));
  assert.equal(SV.decodeVisit(SV.encodeVisit(null)).carry.act, 1);
});

test('base32 helpers round-trip and refuse U', () => {
  const r = rng(14);
  for (let n = 0; n < 200; n++) {
    const bits = Array.from({ length: 5 * (1 + Math.floor(r() * 30)) }, () => (r() < 0.5 ? 1 : 0));
    const s = SV.toBase32(bits);
    assert.match(s, /^[0-9A-HJKMNP-TV-Z]*$/);
    assert.deepEqual(SV.fromBase32(s), bits);
    assert.deepEqual(SV.fromBase32(s.toLowerCase()), bits);
  }
  assert.deepEqual(SV.toBase32([1]), 'G'); // padded with zeros: 10000
  assert.equal(SV.fromBase32('ABU'), null);
  assert.equal(SV.fromBase32('AB!'), null);
  assert.deepEqual(SV.fromBase32('IlO'), SV.fromBase32('110'));
});

test('enumerations match the game they describe', async (t) => {
  assert.deepEqual([...SV.DIMS], SIM.DIMS);
  assert.deepEqual([...SV.RESIDENTS], Object.keys(SIM.newState(1).bonds));
  for (const f of Object.keys(SIM.FIXES)) assert.ok(SV.FIX_SLOTS.includes(f), 'fix ' + f + ' has no slot');
  let C;
  try { C = await import('../src/creature.js'); } catch (e) { t.skip('creature.js did not load in Node: ' + e.message); return; }
  const names = (k) => C.OPTIONS[k].map((o) => o[0]);
  assert.deepEqual([...SV.SHAPES], names('shape'));
  assert.deepEqual([...SV.COLORS], C.OPTIONS.color);
  assert.deepEqual([...SV.PATTERNS], names('pattern'));
  assert.deepEqual([...SV.TOPS], names('top'));
  assert.deepEqual([...SV.WEARS], names('wear'));
  assert.deepEqual([...SV.VOICES], names('voice'));
});

// ---------- save codes ----------
test('save code: compressed (z) round trip, standard deflate-raw + base64url, and no name inside', async () => {
  const save = record();
  assert.equal(save.S.name, 'Ulla Quist');
  const code = await SV.makeSaveCode(save);
  assert.ok(code.startsWith('MTFS1z.'), code.slice(0, 10));
  assert.match(code, /^MTFS1z\.[A-Za-z0-9_-]+$/);
  const text = zlib.inflateRawSync(Buffer.from(code.slice(7), 'base64url')).toString('utf8');
  assert.ok(!/ulla|quist/i.test(text), 'the name is in the code');
  assert.equal(JSON.parse(text).S.name, undefined);
  const out = await SV.readSaveCode(code);
  assert.ok(out.save, out.error);
  assert.deepEqual(out.save, withoutName(save));
  assert.equal(save.S.name, 'Ulla Quist', 'makeSaveCode must not change its argument');
});

test('save code: plain (p) round trip when CompressionStream is missing', async () => {
  const save = record();
  const code = await without('CompressionStream', () => SV.makeSaveCode(save));
  assert.ok(code.startsWith('MTFS1p.'), code.slice(0, 10));
  const text = Buffer.from(code.slice(7), 'base64url').toString('utf8');
  assert.ok(!/ulla|quist/i.test(text), 'the name is in the code');
  assert.deepEqual(JSON.parse(text), withoutName(save));
  assert.deepEqual((await SV.readSaveCode(code)).save, withoutName(save));
  // a plain code needs no DecompressionStream; a compressed one reports 'browser' without it
  const z = await SV.makeSaveCode(save);
  await without('DecompressionStream', async () => {
    assert.deepEqual((await SV.readSaveCode(code)).save, withoutName(save));
    assert.equal((await SV.readSaveCode(z)).error, 'browser');
  });
});

test('save code: found inside surrounding text, whitespace trimmed', async () => {
  const save = record();
  const code = await SV.makeSaveCode(save);
  for (const pasted of ['  ' + code + '\n', 'Here is my morning:\n' + code + '\nsee you there.', '"' + code + '".', 'code=' + code + '&x=1']) {
    const out = await SV.readSaveCode(pasted);
    assert.deepEqual(out.save, withoutName(save), pasted.slice(0, 30));
  }
});

test('save code: a label that mentions the name is replaced; a hand-made name is stripped', async () => {
  for (const label of ['Ulla on Tuesday', 'QUIST, morning', 'Ulla Quist']) {
    const save = record(playedState(), Object.assign({}, META, { label }));
    const out = (await SV.readSaveCode(await SV.makeSaveCode(save))).save;
    assert.equal(out.label, 'Day 2, morning', label);
  }
  assert.equal((await SV.readSaveCode(await SV.makeSaveCode(record()))).save.label, 'Tuesday morning', 'other labels stay');
  const doc = withoutName(record()); doc.S.name = 'Somebody Else';
  const hand = 'MTFS1p.' + Buffer.from(JSON.stringify(doc)).toString('base64url');
  const r = await SV.readSaveCode(hand);
  assert.ok(r.save && !('name' in r.save.S));
  const S = SV.restoreState(r.save, SIM.newState);
  assert.equal(S.name, SIM.newState(1).name, 'restored saves fall back to the default name');
});

test('save code: format, corrupt, newer and oversized codes are rejected', async () => {
  const save = record();
  const z = await SV.makeSaveCode(save);
  const p = await without('CompressionStream', () => SV.makeSaveCode(save));
  const P = (o) => 'MTFS1p.' + Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const Z = (o) => 'MTFS1z.' + zlib.deflateRawSync(Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))).toString('base64url');
  const cases = [
    ['', 'format'], ['hello', 'format'], [42, 'format'], [null, 'format'], ['MTFS1z.', 'format'], ['MTFS1x.AAAA', 'format'], ['MTFS0z.AAAA', 'format'],
    ['MTFS1z AAAA', 'format'], ['mtfs1z.AAAA', 'format'],
    ['MTFS2z.AAAA', 'newer'], ['MTFS9p.AAAA', 'newer'],
    [z.slice(0, -12), 'corrupt'], [p.slice(0, -12), 'corrupt'], ['MTFS1z.AAAAA', 'corrupt'], ['MTFS1z.AAAA', 'corrupt'], ['MTFS1z.____', 'corrupt'],
    [P('not json'), 'corrupt'], [P('[1,2,3]'), 'corrupt'], [Z('{"v":1'), 'corrupt'], ['MTFS1p.' + Buffer.from([0xff, 0xfe, 0x00]).toString('base64url'), 'corrupt'],
    [P(Object.assign(withoutName(save), { v: 2 })), 'newer'], [Z(Object.assign(withoutName(save), { v: 3 })), 'newer'],
  ];
  const bad = withoutName(save); bad.S.flags.note = 'hi <img src=x onerror=alert(1)>'; cases.push([P(bad), 'corrupt'], [Z(bad), 'corrupt']);
  const nan = withoutName(save); nan.S.energy = null; cases.push([P(nan), 'corrupt']); // NaN becomes null in JSON
  const big = withoutName(save); big.S.log = Array.from({ length: 900 }, (_, i) => 'entry ' + i + ' ' + 'x'.repeat(280)); // ~260 KB
  cases.push([P(big), 'corrupt'], [Z(big), 'corrupt']);
  for (const [code, want] of cases) {
    const out = await SV.readSaveCode(code);
    assert.equal(out.error, want, String(code).slice(0, 40) + ' gave ' + JSON.stringify(out).slice(0, 80));
  }
});

test('save code: a tiny code that inflates to megabytes stops at 200 KB', async () => {
  // a valid save with one 20 MB string: without the cap it would load (the string cut to 300), so it must fail here
  const doc = withoutName(record()); doc.S.flags.big = 'x'.repeat(20 * 1024 * 1024);
  const bomb = 'MTFS1z.' + zlib.deflateRawSync(Buffer.from(JSON.stringify(doc))).toString('base64url');
  assert.ok(bomb.length < 60000, 'bomb code is ' + bomb.length + ' characters');
  const plain = 'MTFS1p.' + 'A'.repeat(300 * 1024);
  assert.equal((await SV.readSaveCode(plain)).error, 'corrupt');
  const t0 = Date.now();
  assert.equal((await SV.readSaveCode(bomb)).error, 'corrupt');
  assert.ok(Date.now() - t0 < 2000, 'took ' + (Date.now() - t0) + ' ms');
});

test('makeSaveCode refuses a save that would not load again', async () => {
  const save = record(); save.S.energy = 'full';
  await assert.rejects(() => SV.makeSaveCode(save), /S\.energy/);
});

// ---------- validation ----------
test('validateSave accepts a played state and returns a clean, capped copy', () => {
  const save = record();
  const S = save.S;
  for (const k of ['portrait0', 'tf0', 'tf', 'work', '_probe']) assert.ok(!(k in S), k + ' should be dropped');
  assert.ok(!('_cache' in S.lantern));
  const long = clone(save); long.S.texts = [['Bea', 'y'.repeat(1000)]]; long.label = 'L'.repeat(40);
  const r = SV.validateSave(long);
  assert.ok(r.ok, r.why);
  assert.equal(r.save.S.texts[0][1].length, 300);
  assert.notEqual(r.save, long);
  assert.equal(long.S.texts[0][1].length, 1000, 'the input is not changed');
  assert.deepEqual(SV.validateSave(r.save).save, r.save, 'validation is idempotent');
  const emoji = clone(save); emoji.S.flags.note = 'a'.repeat(299) + '\u{1F600}';
  assert.equal(SV.validateSave(emoji).save.S.flags.note, 'a'.repeat(299), 'no half surrogate pair at the cut');
  const frozen = clone(save); (function freeze(o) { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); })(frozen);
  assert.ok(SV.validateSave(frozen).ok);
});

test('validateSave turns < and > in the name into look-alikes instead of failing', () => {
  const save = record(); save.S.name = '<3 Ann>';
  const r = SV.validateSave(save);
  assert.ok(r.ok, r.why);
  assert.equal(r.save.S.name, '‹3 Ann›');
});

test('validateSave rejects markup, NaN, wrong types, bad shapes, oversized JSON and newer versions', () => {
  const save = record();
  const cases = [
    ['< in a nested string', (s) => { s.S.lantern.entries.henderson.reading = '<b>bold</b>'; }],
    ['> in a string in a list', (s) => { s.S.texts = [['Bea', 'a > b']]; }],
    ['< in the label', (s) => { s.label = 'Tue <morning>'; }],
    ['< in the build', (s) => { s.build = '<x>'; }],
    ['> in a key', (s) => { s.S.flags['a>b'] = 1; }],
    ['a quote in a key', (s) => { s.S.flags['a"b'] = 1; }],
    ['an overlong key', (s) => { s.S.flags['k'.repeat(65)] = 1; }],
    ['NaN', (s) => { s.S.energy = NaN; }],
    ['nested NaN', (s) => { s.S.stats.bend = NaN; }],
    ['Infinity', (s) => { s.S.mods.market.sound = Infinity; }],
    ['a function', (s) => { s.S.flags.f = () => 1; }],
    ['a Map', (s) => { s.S.flags = new Map(); }],
    ['energy as a string', (s) => { s.S.energy = '100'; }],
    ['coins missing', (s) => { delete s.S.coins; }],
    ['seed missing', (s) => { delete s.S.seed; }],
    ['profile out of range', (s) => { s.S.profile.sound = 1.5; }],
    ['profile missing a dim', (s) => { delete s.S.profile.change; }],
    ['look missing', (s) => { s.S.look = null; }],
    ['look.wheels not boolean', (s) => { s.S.look.wheels = 'no'; }],
    ['look string too long', (s) => { s.S.look.wear = 'x'.repeat(21); }],
    ['look.color an attribute escape', (s) => { s.S.look.color = 'x" onclick="alert(1)'; }],
    ['look0.color not a colour', (s) => { s.S.look0.color = 'red'; }],
    ['flags a list', (s) => { s.S.flags = []; }],
    ['bonds missing', (s) => { delete s.S.bonds; }],
    ['blend a string', (s) => { s.S.blend = 'smooth'; }],
    ['blend.score a string', (s) => { s.S.blend.score = '9000'; }],
    ['jar colour an attribute escape', (s) => { s.S.jar[0].c = '#fff;background:url(x)'; }],
    ['jar entry without text', (s) => { s.S.jar.push({ c: '#ffffff' }); }],
    ['name not a string', (s) => { s.S.name = 7; }],
    ['act 4', (s) => { s.act = 4; }], ['act 0', (s) => { s.act = 0; }], ['act 1.5', (s) => { s.act = 1.5; }],
    ['day 4', (s) => { s.day = 4; }], ['day -1', (s) => { s.day = -1; }],
    ['unknown phase', (s) => { s.phase = 'noon'; }],
    ['label 41 characters', (s) => { s.label = 'L'.repeat(41); }],
    ['label missing', (s) => { delete s.label; }],
    ['v 0', (s) => { s.v = 0; }], ['v 1.5', (s) => { s.v = 1.5; }], ['v a string', (s) => { s.v = '1'; }],
    ['S a list', (s) => { s.S = []; }],
    ['nested too deeply', (s) => { let o = s.S.flags; for (let i = 0; i < 40; i++) o = o.d = {}; }],
    ['oversized JSON', (s) => { s.S.log = Array.from({ length: 900 }, (_, i) => 'entry ' + i + ' ' + 'x'.repeat(280)); }],
  ];
  for (const [what, change] of cases) {
    const s = clone(save); change(s);
    const r = SV.validateSave(s);
    assert.equal(r.ok, false, what + ' was accepted');
    assert.equal(r.error, 'corrupt', what + ': ' + r.error);
    assert.equal(r.save, null);
  }
  for (const obj of [null, undefined, 5, 'save', [], new Date()]) assert.equal(SV.validateSave(obj).error, 'corrupt');
  const newer = clone(save); newer.v = SV.SAVE_V + 1; newer.S = 'whatever a later version stores';
  assert.equal(SV.validateSave(newer).error, 'newer');
  // keys that reach a prototype, as JSON.parse produces them
  for (const json of ['{"__proto__":{"x":1}}', '{"a":{"constructor":{"prototype":{"x":1}}}}']) {
    const s = clone(save); s.S.flags = JSON.parse(json);
    assert.equal(SV.validateSave(s).error, 'corrupt', json);
  }
  const top = JSON.parse(JSON.stringify(save).replace('"S":{', '"S":{"__proto__":{"coins":1},'));
  assert.equal(SV.validateSave(top).error, 'corrupt');
  assert.equal({}.coins, undefined, 'nothing leaked into Object.prototype');
});

// ---------- snapshot ----------
test('snapshot drops rebuilt and private keys, functions and undefined, fixes non-finite numbers, keeps the name', () => {
  const S = playedState();
  S.flags.portrait0 = 1; // only the top-level keys are dropped
  S.fn = () => 1; S.nothing = undefined; S.stats.bend = NaN; S.stats.ask = Infinity; S.stats.fix = -Infinity;
  S.list = [1, NaN, undefined, () => 2, { _x: 1, y: 2 }]; S.when = new Date(0);
  const { data, bytes } = SV.snapshot(S);
  for (const k of ['portrait0', 'tf0', 'tf', 'work', '_probe', 'fn', 'nothing']) assert.ok(!(k in data), k);
  assert.ok(!('_cache' in data.lantern));
  assert.equal(data.flags.portrait0, 1);
  assert.equal(data.name, 'Ulla Quist');
  assert.deepEqual([data.stats.bend, data.stats.ask, data.stats.fix], [0, 0, 0]);
  assert.deepEqual(data.list, [1, 0, null, null, { y: 2 }]);
  assert.equal(data.when, '1970-01-01T00:00:00.000Z');
  assert.equal(bytes, Buffer.byteLength(JSON.stringify(data), 'utf8'));
  assert.ok(Number.isNaN(S.stats.bend) && 'portrait0' in S, 'the state itself is not changed');
  const K = playedState(); K.name = '한결'; // multi-byte: bytes counts UTF-8, not characters
  const k = SV.snapshot(K);
  assert.equal(k.bytes, Buffer.byteLength(JSON.stringify(k.data), 'utf8'));
  assert.ok(k.bytes > JSON.stringify(k.data).length);
});

test('snapshot refuses cycles but allows shared references', () => {
  const S = playedState(); const shared = { a: 1 }; S.one = shared; S.two = [shared, shared];
  assert.deepEqual(SV.snapshot(S).data.two, [{ a: 1 }, { a: 1 }]);
  const C = playedState(); C.flags.loop = C.flags;
  assert.throws(() => SV.snapshot(C), /cycle/);
  const D = playedState(); D.list = [D];
  assert.throws(() => SV.snapshot(D), /cycle/);
});

// ---------- merging and restoring ----------
test('deepMerge keeps dynamic keys, replaces lists and primitives, ignores wrong types', () => {
  const base = { n: 1, s: 'a', b: false, map: { x: 1 }, list: [1, 2], nul: null, nested: { deep: { k: 0 } } };
  const saved = { n: 'two', s: 'b', b: true, map: { y: 2 }, list: [3], nul: { z: 1 }, nested: { deep: 'flat', extra: [1] }, only: { q: 1 } };
  const before = clone(saved);
  const out = SV.deepMerge(base, saved);
  assert.deepEqual(out, { n: 1, s: 'b', b: true, map: { x: 1, y: 2 }, list: [3], nul: { z: 1 }, nested: { deep: { k: 0 }, extra: [1] }, only: { q: 1 } });
  assert.deepEqual(saved, before, 'saved is not changed');
  assert.deepEqual(base, { n: 1, s: 'a', b: false, map: { x: 1 }, list: [1, 2], nul: null, nested: { deep: { k: 0 } } }, 'base is not changed');
  out.list.push(9); out.only.q = 2; assert.deepEqual(saved.list, [3]); assert.equal(saved.only.q, 1);
  assert.deepEqual(SV.deepMerge({ n: 1, list: [1], map: {} }, { n: NaN, list: { 0: 5 }, map: [1] }), { n: 1, list: [1], map: {} });
  assert.deepEqual(SV.deepMerge({ n: 1 }, { n: null }), { n: 1 });
  const evil = JSON.parse('{"__proto__":{"polluted":1},"flags":{"__proto__":{"polluted":1},"ok":1}}');
  const m = SV.deepMerge({ flags: {} }, evil);
  assert.deepEqual(m, { flags: { ok: 1 } });
  assert.equal(Object.getPrototypeOf(m.flags), Object.prototype);
  assert.equal({}.polluted, undefined);
});

test('restoreState rebuilds a played state on newState for the saved seed', () => {
  const S = playedState(777);
  const saved = record(S);
  let seenSeed = null;
  const R = SV.restoreState(saved, (seed) => { seenSeed = seed; return SIM.newState(seed); });
  assert.equal(seenSeed, 777);
  for (const k of Object.keys(saved.S)) assert.deepEqual(R[k], saved.S[k], k);
  assert.equal(R.tf0, 0, 'dropped fields come back from newState');
  assert.equal(R.portrait0, undefined);
  assert.equal(R.name, 'Ulla Quist', 'a local save keeps the name');
  // a save that lost a field, or holds one of the wrong type, gets newState's value
  const thin = clone(saved); delete thin.S.stats; thin.S.gear = 'none'; thin.S.flags.extra_flag = 1;
  const T = SV.restoreState(thin, SIM.newState);
  assert.deepEqual(T.stats, SIM.newState(1).stats);
  assert.deepEqual(T.gear, { headphones: false, shades: false });
  assert.equal(T.flags.extra_flag, 1);
});

test('restoreState runs MIGRATE from the save version up to SAVE_V - 1', () => {
  const calls = [];
  SV.MIGRATE[0] = (S, save) => { calls.push(save.v); S.migrated = true; return S; };
  try {
    const S = SV.restoreState({ v: 0, S: { seed: 3, coins: 7 } }, SIM.newState);
    assert.deepEqual(calls, [0]);
    assert.equal(S.migrated, true); assert.equal(S.coins, 7);
    calls.length = 0;
    SV.restoreState({ v: SV.SAVE_V, S: { seed: 3 } }, SIM.newState);
    assert.deepEqual(calls, []);
  } finally { delete SV.MIGRATE[0]; }
});

// ---------- storage ----------
test('storageStatus: ok, blocked, nopersist', () => {
  withStorage(new MemoryStorage(), (ls) => { assert.equal(SV.storageStatus(), 'ok'); assert.equal(ls.getItem(SV.KEYS.test), null, 'the test key is removed'); });
  withStorage(new BlockedStorage(), () => assert.equal(SV.storageStatus(), 'blocked'));
  withStorage(() => { throw denied(); }, () => assert.equal(SV.storageStatus(), 'blocked'));
  withStorage(undefined, () => assert.equal(SV.storageStatus(), 'blocked'));
  withStorage(null, () => assert.equal(SV.storageStatus(), 'blocked'));
  withStorage(new ForgetfulStorage(), () => assert.equal(SV.storageStatus(), 'nopersist'));
});

test('loadSettings moves the old Who Bends settings across once; saveSettings reports success', () => {
  withStorage(new MemoryStorage({ 'whobends.settings': '{"fx":0.5,"textSize":"l","reduceMotion":true}' }), (ls) => {
    assert.deepEqual(SV.loadSettings(), { fx: 0.5, textSize: 'l', reduceMotion: true });
    assert.deepEqual(JSON.parse(ls.getItem(SV.KEYS.settings)), { fx: 0.5, textSize: 'l', reduceMotion: true });
    ls.setItem('whobends.settings', '{"fx":0.1}');
    assert.deepEqual(SV.loadSettings(), { fx: 0.5, textSize: 'l', reduceMotion: true }, 'the new key wins after the move');
    assert.equal(SV.saveSettings({ fx: 0.8, guide: 'quiet' }), true);
    assert.deepEqual(SV.loadSettings(), { fx: 0.8, guide: 'quiet' });
  });
  withStorage(new MemoryStorage({ 'whobends.settings': '{broken' }), (ls) => {
    assert.deepEqual(SV.loadSettings(), {});
    assert.equal(ls.getItem(SV.KEYS.settings), '{}', 'an unreadable old value is not tried again');
  });
  withStorage(new MemoryStorage(), () => assert.deepEqual(SV.loadSettings(), {}));
  withStorage(new MemoryStorage({ 'mtf.settings': '[1,2]' }), () => assert.deepEqual(SV.loadSettings(), {}));
  withStorage(new MemoryStorage({ 'mtf.settings': '{"quality":"<script>","fx":1,"bad\\"key":1,"nested":{"a":"ok"}}' }), () => assert.deepEqual(SV.loadSettings(), { fx: 1, nested: { a: 'ok' } }));
  withStorage(new BlockedStorage(), () => { assert.deepEqual(SV.loadSettings(), {}); assert.equal(SV.saveSettings({ fx: 1 }), false); });
  withStorage(() => { throw denied(); }, () => { assert.deepEqual(SV.loadSettings(), {}); assert.equal(SV.saveSettings({ fx: 1 }), false); });
  withStorage(new ForgetfulStorage(), () => assert.equal(SV.saveSettings({ fx: 1 }), false));
  withStorage(new FullStorage(5), () => assert.equal(SV.saveSettings({ fx: 1 }), false));
});

test('writeSave and readSave: round trip, and every way storage can fail', () => {
  const S = playedState();
  withStorage(new MemoryStorage(), (ls) => {
    assert.equal(SV.readSave().error, 'none');
    const w = SV.writeSave(META, S);
    assert.deepEqual(w, { ok: true, error: null, bytes: Buffer.byteLength(ls.getItem(SV.KEYS.save), 'utf8') });
    const r = SV.readSave();
    assert.ok(r.save, r.error);
    assert.deepEqual([r.save.v, r.save.build, r.save.act, r.save.day, r.save.phase, r.save.label], [SV.SAVE_V, 'test-build', 1, 2, 'morning', 'Tuesday morning']);
    assert.ok(!Number.isNaN(Date.parse(r.save.savedAt)));
    assert.equal(r.save.S.name, 'Ulla Quist');
    assert.ok(!('portrait0' in r.save.S) && !('_probe' in r.save.S));
    const R = SV.restoreState(r.save, SIM.newState);
    assert.deepEqual(R.flags, S.flags); assert.deepEqual(R.look, S.look); assert.equal(R.min, S.min);
    // defaults and tidying of meta
    assert.equal(SV.writeSave({ phase: 'shift', label: 'Tue <shift>', build: 'b'.repeat(99) }, S).ok, true);
    const d = SV.readSave().save;
    assert.deepEqual([d.act, d.day, d.label, d.build.length], [1, 2, 'Tue ‹shift›', 40]);
    assert.equal(SV.writeSave({}, S).ok, true);
    assert.equal(SV.readSave().save.label, 'Day 2, morning');
    // stored saves that were tampered with, broken or written by a newer game
    ls.setItem(SV.KEYS.save, '{"v":1'); assert.equal(SV.readSave().error, 'corrupt');
    ls.setItem(SV.KEYS.save, JSON.stringify(Object.assign(record(), { v: 2 }))); assert.equal(SV.readSave().error, 'newer');
    const t = record(); t.S.flags.x = '<img>'; ls.setItem(SV.KEYS.save, JSON.stringify(t)); assert.equal(SV.readSave().error, 'corrupt');
    ls.setItem(SV.KEYS.save, 'x'.repeat(300 * 1024)); assert.equal(SV.readSave().error, 'corrupt');
    assert.equal(SV.clearSave(), true);
    assert.equal(SV.readSave().error, 'none');
  });
  withStorage(new BlockedStorage(), () => {
    assert.equal(SV.writeSave(META, S).error, 'blocked');
    assert.equal(SV.readSave().error, 'blocked');
    assert.equal(SV.clearSave(), false);
  });
  withStorage(() => { throw denied(); }, () => { assert.equal(SV.writeSave(META, S).error, 'blocked'); assert.equal(SV.readSave().error, 'blocked'); });
  withStorage(undefined, () => { assert.equal(SV.writeSave(META, S).error, 'blocked'); assert.equal(SV.readSave().error, 'blocked'); });
  withStorage(new ForgetfulStorage(), () => {
    const w = SV.writeSave(META, S);
    assert.equal(w.ok, false); assert.equal(w.error, 'nopersist'); assert.ok(w.bytes > 1000);
    assert.equal(SV.readSave().error, 'none');
  });
  withStorage(new FullStorage(1000), () => assert.equal(SV.writeSave(META, S).error, 'quota'));
});

test('writeSave refuses a state that would not load again, and writes nothing', () => {
  withStorage(new MemoryStorage(), (ls) => {
    const fresh = SIM.newState(5); // before the creature exists: look is null
    const a = SV.writeSave(META, fresh);
    assert.equal(a.error, 'invalid'); assert.match(a.why, /look/);
    const C = playedState(); C.flags.self = C;
    const b = SV.writeSave(META, C);
    assert.equal(b.error, 'invalid'); assert.match(b.why, /cycle/);
    const L = playedState(); L.flags.html = '<b>';
    assert.equal(SV.writeSave(META, L).error, 'invalid');
    assert.equal(SV.writeSave(Object.assign({}, META, { phase: 'noon' }), playedState()).error, 'invalid');
    assert.equal(SV.writeSave(META, null).error, 'invalid');
    assert.equal(ls.getItem(SV.KEYS.save), null);
  });
});

test('readCarry and writeCarry: normalized round trip and failures', () => {
  const r = rng(99); const c1 = randomCarry(r); const c2 = randomCarry(r);
  c1.name = 'Ulla'; c1.notes = 'not part of a carry';
  withStorage(new MemoryStorage(), (ls) => {
    assert.equal(SV.readCarry().error, 'none');
    const w = SV.writeCarry({ acts: { 1: c1, 2: c2, 4: c2, x: c1 } });
    assert.equal(w.ok, true, w.error);
    const got = SV.readCarry();
    assert.deepEqual(got.carry, { v: SV.VISIT_V, acts: { 1: SV.normalizeCarry(c1), 2: SV.normalizeCarry(c2) } });
    assert.ok(!ls.getItem(SV.KEYS.carry).includes('Ulla'));
    assert.deepEqual(got.carry.acts['1'], SV.decodeVisit(SV.encodeVisit(c1)).carry, 'a stored carry is exactly what a visit code holds');
    assert.equal(SV.writeCarry({ 3: c2 }).ok, true, 'a bare acts map works too');
    assert.deepEqual(Object.keys(SV.readCarry().carry.acts), ['3']);
    ls.setItem(SV.KEYS.carry, 'nope'); assert.equal(SV.readCarry().error, 'corrupt');
    ls.setItem(SV.KEYS.carry, '{"v":1,"acts":[]}'); assert.equal(SV.readCarry().error, 'corrupt');
    ls.setItem(SV.KEYS.carry, '{"v":2,"acts":{}}'); assert.equal(SV.readCarry().error, 'newer');
    ls.setItem(SV.KEYS.carry, '{"v":1,"acts":{"1":{"look":{"color":"x\\" onclick=\\"1"}}}}');
    assert.equal(SV.readCarry().carry.acts['1'].look.color, SV.COLORS[0], 'stored carries are cleaned like codes');
  });
  withStorage(new BlockedStorage(), () => { assert.equal(SV.readCarry().error, 'blocked'); assert.equal(SV.writeCarry({ acts: { 1: c1 } }).error, 'blocked'); });
  withStorage(new ForgetfulStorage(), () => assert.equal(SV.writeCarry({ acts: { 1: c1 } }).error, 'nopersist'));
  withStorage(new FullStorage(10), () => assert.equal(SV.writeCarry({ acts: { 1: c1 } }).error, 'quota'));
});
