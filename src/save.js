// Saving and sharing a season. The save slot, the settings and the carry between visits live in localStorage, which
// inside a claude.ai artifact frame can be missing, blocked (every call throws) or quietly forgetful, so every access
// is wrapped and its outcome reported. Two codes move play elsewhere: a save code (the whole state, deflated, to take
// a morning to another device) and a visit code (the short carry between visits, typed by hand).
// Anything read back or pasted may come from a stranger: every value is checked, strings are capped and may not hold
// < or >, and the player's name never goes into a code. No imports: restoreState takes newState as an argument.

export const KEYS = { settings: 'mtf.settings', save: 'mtf.save', carry: 'mtf.carry', oldSettings: 'whobends.settings', test: 'mtf.test' };
export const SAVE_V = 1;
// morning, after the shift, after the meeting and the end are the story's own checkpoints; free is an autosave during
// free play (S.resumeAt says where), and setup is a creature made with the room still to arrange
export const PHASES = Object.freeze(['morning', 'shift', 'meeting', 'end', 'free', 'setup']);
// MIGRATE[v](S, save) brings a state restored from a version-v save up to v + 1 and returns it (or changes it in
// place). restoreState runs them in order after merging; version 1 needs none.
export const MIGRATE = {};

const MAX_STR = 300; // longest string kept anywhere in a save; longer ones are cut, not refused
const MAX_JSON = 200 * 1024; // largest save, in UTF-8 bytes of JSON
const MAX_LABEL = 40;
const MAX_KEY = 64;
const MAX_DEPTH = 24;
const MAX_PASTE = 1000000; // characters of pasted text searched for a save code
const DROP = new Set(['portrait0', 'tf0', 'tf', 'work']); // top-level state that is rebuilt on load, never saved
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BAD_KEY_CHARS = /[<>"'`&\u0000-\u001f\u007f]/;
const HEX = /^#[0-9a-fA-F]{6}$/;

// ---------- small helpers ----------
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function isPlain(o) {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return false;
  const p = Object.getPrototypeOf(o);
  return p === Object.prototype || p === null;
}
// cut to n UTF-16 units without splitting a surrogate pair
const cut = (s, n) => (s.length <= n ? s : s.slice(0, /[\ud800-\udbff]/.test(s[n - 1]) ? n - 1 : n));
// text the game itself writes into a save: angle brackets become look-alikes (‹ ›) instead of failing the save
const tidy = (s, n) => cut(String(s == null ? '' : s).replace(/</g, '\u2039').replace(/>/g, '\u203a'), n);
const keyOk = (k) => !BAD_KEYS.has(k) && k.length <= MAX_KEY && !BAD_KEY_CHARS.test(k);
const utf8Bytes = (s) => new TextEncoder().encode(s).length;
const labelFor = (day, phase) => (day >= 1 ? 'Day ' + day : 'Arrival') + ', ' + (phase === 'free' ? 'during the day' : phase === 'setup' ? 'moving in' : phase);

// ---------- storage ----------
// Even reading localStorage throws in a sandboxed frame, so every use goes through store() inside a try.
const store = () => globalThis.localStorage;
const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

// 'ok'; 'blocked' (no storage, or it throws); 'nopersist' (a write is accepted, then is not there)
export function storageStatus() {
  try {
    const ls = store(); const v = Math.random().toString(36).slice(2) + Date.now().toString(36);
    ls.setItem(KEYS.test, v); const back = ls.getItem(KEYS.test); ls.removeItem(KEYS.test);
    return back === v ? 'ok' : 'nopersist';
  } catch (e) { return 'blocked'; }
}
// write JSON, then read it back: { ok, error: null | 'quota' | 'blocked' | 'nopersist', bytes }
function putJSON(key, value) {
  const json = JSON.stringify(value); const bytes = utf8Bytes(json);
  try { store().setItem(key, json); } catch (e) { return { ok: false, error: isQuota(e) ? 'quota' : 'blocked', bytes }; }
  let back; try { back = store().getItem(key); } catch (e) { return { ok: false, error: 'blocked', bytes }; }
  if (typeof back !== 'string' || back.length !== json.length) return { ok: false, error: 'nopersist', bytes };
  return { ok: true, error: null, bytes };
}
// { value } | { error: 'none' | 'blocked' | 'corrupt' }
function getJSON(key) {
  let raw; try { raw = store().getItem(key); } catch (e) { return { error: 'blocked' }; }
  if (raw == null) return { error: 'none' };
  if (typeof raw !== 'string' || raw.length > MAX_JSON) return { error: 'corrupt' };
  try { return { value: JSON.parse(raw) }; } catch (e) { return { error: 'corrupt' }; }
}

// ---------- settings ----------
// Settings saved by the Who Bends prototype move across once: with no new key, the old one is read and copied under
// the new key (even when it was unreadable, as {}, so it is never tried again). Only plain data comes back.
export function loadSettings() {
  try {
    const ls = store(); const raw = ls.getItem(KEYS.settings);
    if (raw != null) return parseSettings(raw);
    const old = ls.getItem(KEYS.oldSettings); if (old == null) return {};
    const s = parseSettings(old);
    try { ls.setItem(KEYS.settings, JSON.stringify(s)); } catch (e) { /* full or read-only: use them this session */ }
    return s;
  } catch (e) { return {}; }
}
// true only when the settings were written and read back
export function saveSettings(obj) {
  try {
    const json = JSON.stringify(isPlain(obj) ? obj : {}); const ls = store();
    ls.setItem(KEYS.settings, json);
    return ls.getItem(KEYS.settings) === json;
  } catch (e) { return false; }
}
function parseSettings(raw) {
  try { const o = JSON.parse(raw); return isPlain(o) ? plainData(o, 0) : {}; } catch (e) { return {}; }
}
// finite numbers, booleans, null, short strings without < or >, and lists and objects of those; the rest is dropped
function plainData(v, depth) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean' || v === null) return v;
  if (typeof v === 'string') return /[<>]/.test(v) ? undefined : cut(v, MAX_STR);
  if (typeof v !== 'object' || depth >= 4) return undefined;
  if (Array.isArray(v)) return v.map((x) => plainData(x, depth + 1)).filter((x) => x !== undefined);
  if (!isPlain(v)) return undefined;
  const out = {};
  for (const k of Object.keys(v)) { if (!keyOk(k)) continue; const x = plainData(v[k], depth + 1); if (x !== undefined) out[k] = x; }
  return out;
}

// ---------- snapshot ----------
// A deep copy of the state for the local slot. Leaves out what is rebuilt on load (portrait0, tf0, tf and work, at
// the top level) and private keys (starting with _, at any depth); drops functions and undefined (inside lists they
// become null, as in JSON); turns NaN and ±Infinity into 0; throws on a cycle (shared references are fine).
// The name stays: only codes leave it out. bytes is the UTF-8 length of the JSON.
export function snapshot(S) {
  const data = copyState(S, new Set(), true);
  return { data, bytes: utf8Bytes(JSON.stringify(data === undefined ? null : data)) };
}
function copyState(v, stack, top) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' || typeof v === 'boolean' || v === null) return v;
  if (typeof v !== 'object') return undefined; // functions, undefined, symbols, bigints
  if (typeof v.toJSON === 'function') return copyState(v.toJSON(), stack, false); // dates become strings, as in JSON
  if (stack.has(v)) throw new TypeError('snapshot: the state contains a cycle');
  stack.add(v);
  let out;
  if (Array.isArray(v)) {
    out = [];
    for (let i = 0; i < v.length; i++) { const x = copyState(v[i], stack, false); out.push(x === undefined ? null : x); }
  } else {
    out = {};
    for (const k of Object.keys(v)) {
      if (k[0] === '_' || BAD_KEYS.has(k) || (top && DROP.has(k))) continue;
      const x = copyState(v[k], stack, false); if (x !== undefined) out[k] = x;
    }
  }
  stack.delete(v);
  return out;
}

// ---------- the save slot ----------
// meta = { build, act, day, phase, label }: act and day default to the state's own, phase to 'morning', the label to
// "Day 2, morning". Returns { ok, error, bytes }; error is 'quota', 'blocked', 'nopersist' (accepted but not read
// back) or 'invalid' (this state would not load again; why says what). Nothing invalid is ever written, so whatever
// sits in the slot loads.
export function writeSave(meta, S) {
  const m = isPlain(meta) ? meta : {};
  let snap;
  try { snap = snapshot(S); } catch (e) { return { ok: false, error: 'invalid', why: String(e && e.message), bytes: 0 }; }
  const st = isPlain(snap.data) ? snap.data : {};
  const day = m.day !== undefined ? m.day : st.day;
  const phase = m.phase !== undefined ? m.phase : 'morning';
  const rec = { v: SAVE_V, build: tidy(m.build, 40), act: m.act !== undefined ? m.act : st.act || 1, day, phase, label: tidy(m.label, MAX_LABEL) || labelFor(day, phase), savedAt: new Date().toISOString(), S: snap.data };
  const chk = validateSave(rec);
  if (!chk.ok) return { ok: false, error: 'invalid', why: chk.why, bytes: snap.bytes };
  // the checked record comes back too, so a save code still works when the browser keeps nothing
  return Object.assign(putJSON(KEYS.save, chk.save), { save: chk.save });
}
// { save } (validated; the name is kept) | { error: 'none' | 'corrupt' | 'newer' | 'blocked' }
export function readSave() {
  const r = getJSON(KEYS.save); if (r.error) return r;
  const chk = validateSave(r.value);
  return chk.ok ? { save: chk.save } : { error: chk.error, why: chk.why };
}
export function clearSave() {
  try { store().removeItem(KEYS.save); return true; } catch (e) { return false; }
}

// ---------- validation ----------
// Checks a save record from storage or a code and returns a clean copy: { ok: true, error: null, save } or
// { ok: false, error: 'newer' | 'corrupt', why, save: null }. Strings are cut to 300 characters. A string or key with
// < or >, a number that is not finite, a key that could reach a prototype, nesting deeper than 24 or more than 200 KB
// of JSON fails the whole save. The copy leaves out portrait0, tf0, tf, work and keys starting with _.
// Colours are the one kind of value the UI puts into attributes unescaped (ui.js), so they must be #rrggbb.
// The name is the one string a player types, so its angle brackets become look-alikes instead of failing.
const NUMBERS = ['seed', 'day', 'min', 'energy', 'maxE', 'self', 'strain', 'spot', 'coins'];
const OBJECTS = ['flags', 'met', 'talked', 'fixes', 'support', 'mods', 'handled', 'bonds', 'blend'];
class Problem extends Error {}
export function validateSave(obj) {
  const no = (error, why) => ({ ok: false, error, why, save: null });
  if (!isPlain(obj)) return no('corrupt', 'not an object');
  const v = obj.v;
  if (!Number.isInteger(v) || v < 1) return no('corrupt', 'bad version');
  if (v > SAVE_V) return no('newer', 'made by a newer version of the game');
  if (!Number.isInteger(obj.act) || obj.act < 1 || obj.act > 3) return no('corrupt', 'act is not 1 to 3');
  if (!Number.isInteger(obj.day) || obj.day < 0 || obj.day > 3) return no('corrupt', 'day is not 0 to 3');
  if (PHASES.indexOf(obj.phase) < 0) return no('corrupt', 'unknown phase');
  if (typeof obj.label !== 'string' || obj.label.length > MAX_LABEL) return no('corrupt', 'label is not a short string');
  if (obj.build !== undefined && typeof obj.build !== 'string') return no('corrupt', 'build is not a string');
  if (obj.savedAt !== undefined && (typeof obj.savedAt !== 'string' || obj.savedAt.length > 40)) return no('corrupt', 'savedAt is not a date string');
  if (!isPlain(obj.S)) return no('corrupt', 'S is not an object');
  const S = {};
  for (const k of Object.keys(obj.S)) {
    if (BAD_KEYS.has(k)) return no('corrupt', 'S has a key that is not allowed');
    if (!DROP.has(k)) S[k] = obj.S[k];
  }
  if (typeof S.name === 'string') S.name = S.name.replace(/</g, '\u2039').replace(/>/g, '\u203a');
  const rec = { v, build: obj.build === undefined ? '' : obj.build, act: obj.act, day: obj.day, phase: obj.phase, label: obj.label };
  if (obj.savedAt !== undefined) rec.savedAt = obj.savedAt;
  rec.S = S;
  let save;
  try { save = cleanTree(rec, 'save', 0); } catch (e) { return no('corrupt', e instanceof Problem ? e.message : 'unreadable'); }
  if (utf8Bytes(JSON.stringify(save)) > MAX_JSON) return no('corrupt', 'larger than 200 KB');
  const why = stateProblem(save.S);
  return why ? no('corrupt', why) : { ok: true, error: null, why: '', save };
}
// a checked copy of JSON-shaped data; throws a Problem at the first thing that is not allowed
function cleanTree(v, path, depth) {
  switch (typeof v) {
    case 'string': if (/[<>]/.test(v)) throw new Problem(path + ' contains < or >'); return cut(v, MAX_STR);
    case 'number': if (!Number.isFinite(v)) throw new Problem(path + ' is not a finite number'); return v;
    case 'boolean': return v;
    case 'object': if (v === null) return null; break;
    default: throw new Problem(path + ' holds a ' + typeof v);
  }
  if (depth >= MAX_DEPTH) throw new Problem(path + ' is nested too deeply');
  if (Array.isArray(v)) {
    const out = [];
    for (let i = 0; i < v.length; i++) out.push(v[i] === undefined ? null : cleanTree(v[i], path + '[' + i + ']', depth + 1));
    return out;
  }
  if (!isPlain(v)) throw new Problem(path + ' is not plain data');
  const out = {};
  for (const k of Object.keys(v)) {
    if (!keyOk(k)) throw new Problem(path + ' has a key that is not allowed');
    if (k[0] === '_' || v[k] === undefined) continue;
    out[k] = cleanTree(v[k], path + '.' + k, depth + 1);
  }
  return out;
}
// the fields the game cannot do without, by type ('' when all is well)
function stateProblem(S) {
  for (const k of NUMBERS) if (typeof S[k] !== 'number') return 'S.' + k + ' is not a number';
  if (!isPlain(S.profile)) return 'S.profile is not an object';
  for (const d of DIMS) { const x = S.profile[d]; if (typeof x !== 'number' || x < 0 || x > 1) return 'S.profile.' + d + ' is not between 0 and 1'; }
  const lp = lookProblem(S.look, 'S.look') || (S.look0 == null ? '' : lookProblem(S.look0, 'S.look0'));
  if (lp) return lp;
  for (const k of OBJECTS) if (!isPlain(S[k])) return 'S.' + k + ' is not an object';
  const B = S.blend;
  for (const k of ['score', 'streak', 'uses', 'drops', 'dep']) if (B[k] !== undefined && typeof B[k] !== 'number') return 'S.blend.' + k + ' is not a number';
  for (const k of ['has', 'smooth', 'usedToday', 'deleted']) if (B[k] !== undefined && typeof B[k] !== 'boolean') return 'S.blend.' + k + ' is not true or false';
  if (B.badges !== undefined && !(Array.isArray(B.badges) && B.badges.every((b) => typeof b === 'string'))) return 'S.blend.badges is not a list of strings';
  if (S.jar !== undefined) {
    if (!Array.isArray(S.jar)) return 'S.jar is not a list';
    for (const j of S.jar) if (!isPlain(j) || typeof j.t !== 'string' || typeof j.c !== 'string' || !HEX.test(j.c)) return 'S.jar holds a bad moment';
  }
  if (S.name !== undefined && typeof S.name !== 'string') return 'S.name is not a string';
  return '';
}
function lookProblem(L, path) {
  if (!isPlain(L)) return path + ' is not an object';
  for (const k of Object.keys(L)) if (k !== 'wheels' && (typeof L[k] !== 'string' || L[k].length > 20)) return path + '.' + k + ' is not a short string';
  if (typeof L.wheels !== 'boolean') return path + '.wheels is not true or false';
  if (!HEX.test(L.color)) return path + '.color is not a #rrggbb colour';
  return '';
}

// ---------- restoring ----------
// A new object. Plain objects merge key by key, and keys only in saved are kept (maps like flags have no fixed keys).
// Lists and primitives from saved replace base. A saved value of the wrong type (a string where base has a number, a
// list where base has an object, NaN) is ignored in favour of base. Where base is null or missing, saved is taken.
export function deepMerge(base, saved) {
  if (saved === undefined) return copyData(base);
  if (base === null || base === undefined) return copyData(saved);
  if (isPlain(base)) {
    if (!isPlain(saved)) return copyData(base);
    const out = {};
    for (const k of Object.keys(base)) if (!BAD_KEYS.has(k)) out[k] = deepMerge(base[k], hasOwn(saved, k) ? saved[k] : undefined);
    for (const k of Object.keys(saved)) if (!BAD_KEYS.has(k) && !hasOwn(base, k)) out[k] = copyData(saved[k]);
    return out;
  }
  if (Array.isArray(base)) return copyData(Array.isArray(saved) ? saved : base);
  if (typeof saved === typeof base && (typeof saved === 'string' || typeof saved === 'boolean' || Number.isFinite(saved))) return saved;
  return copyData(base);
}
function copyData(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(copyData);
  const out = {};
  for (const k of Object.keys(v)) if (!BAD_KEYS.has(k)) out[k] = copyData(v[k]);
  return out;
}
// The state to play from a validated save: newState for the saved seed, the save merged over it, then MIGRATE[v]
// for every v from the save's version up to SAVE_V - 1. A save read from a code has no name, so S.name is then
// newState's default: check !('name' in save.S) before restoring and ask for one.
export function restoreState(save, newStateFn) {
  const saved = save && isPlain(save.S) ? save.S : {};
  let S = deepMerge(newStateFn(saved.seed), saved);
  const from = save && Number.isInteger(save.v) ? save.v : SAVE_V;
  for (let v = from; v < SAVE_V; v++) if (typeof MIGRATE[v] === 'function') S = MIGRATE[v](S, save) || S;
  return S;
}

// ---------- the carry between visits ----------
// Stored as { v, acts: { '1': carry, '2': carry, '3': carry } }, each carry cleaned to exactly what a visit code
// holds (normalizeCarry), so anything else in it is dropped. writeCarry takes { acts } (a bare acts map works too) and
// returns { ok, error, bytes } like writeSave; readCarry returns { carry: { v, acts } } or { error } like readSave.
const ACTS = ['1', '2', '3'];
function cleanActs(acts) {
  const out = {};
  if (isPlain(acts)) for (const a of ACTS) if (hasOwn(acts, a) && isPlain(acts[a])) out[a] = normalizeCarry(acts[a]);
  return out;
}
export function readCarry() {
  const r = getJSON(KEYS.carry); if (r.error) return r;
  const o = r.value;
  if (!isPlain(o) || !Number.isInteger(o.v) || o.v < 1) return { error: 'corrupt' };
  if (o.v > VISIT_V) return { error: 'newer' };
  if (!isPlain(o.acts)) return { error: 'corrupt' };
  return { carry: { v: VISIT_V, acts: cleanActs(o.acts) } };
}
export function writeCarry(obj) {
  const acts = obj && isPlain(obj.acts) ? obj.acts : obj;
  return putJSON(KEYS.carry, { v: VISIT_V, acts: cleanActs(acts) });
}

// ---------- save code ----------
// The whole save, for taking a morning to another device: 'MTFS1z.' + base64url of the deflate-raw JSON where the
// browser can compress, else 'MTFS1p.' + base64url of the JSON itself. The name is taken out first, and a label that
// mentions it is replaced. readSaveCode finds the code inside any pasted text, inflates at most 200 KB (a small code
// cannot unpack into something huge), validates the result and strips any name a hand-made code carries.
const SAVE_CODE = /MTFS(\d{1,3})([A-Za-z])\.([A-Za-z0-9_-]*)/;
const MAX_CODE = Math.ceil(MAX_JSON * 4 / 3) + 4;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_AT = (() => { const t = new Int8Array(128).fill(-1); for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i; return t; })();

// throws if the save would not load again (it fails validateSave)
export async function makeSaveCode(save) {
  const chk = validateSave(save);
  if (!chk.ok) throw new Error('makeSaveCode: ' + chk.why);
  const rec = chk.save; // a fresh copy, safe to change
  // any word of the name (two letters or more) in the label, even a first name alone, means a plain label instead
  const words = typeof rec.S.name === 'string' ? rec.S.name.toLowerCase().split(/[\s.,'\u2019_-]+/).filter((w) => w.length >= 2) : [];
  delete rec.S.name;
  const label = rec.label.toLowerCase();
  if (words.some((w) => label.indexOf(w) >= 0)) rec.label = labelFor(rec.day, rec.phase);
  const bytes = new TextEncoder().encode(JSON.stringify(rec));
  if (streams(globalThis.CompressionStream)) {
    try { return 'MTFS1z.' + toBase64url(await through(bytes, new globalThis.CompressionStream('deflate-raw'), Infinity)); } catch (e) { /* fall back to plain */ }
  }
  return 'MTFS1p.' + toBase64url(bytes);
}
// { save } (no name) | { error: 'format' | 'browser' | 'corrupt' | 'newer' }
export async function readSaveCode(str) {
  if (typeof str !== 'string' || str.length > MAX_PASTE) return { error: 'format' };
  const m = SAVE_CODE.exec(str);
  if (!m) return { error: 'format' };
  if (+m[1] > 1) return { error: 'newer' };
  if (m[1] !== '1' || (m[2] !== 'z' && m[2] !== 'p') || !m[3]) return { error: 'format' };
  if (m[3].length > MAX_CODE) return { error: 'corrupt' };
  let bytes = fromBase64url(m[3]);
  if (!bytes) return { error: 'corrupt' };
  if (m[2] === 'z') {
    if (!streams(globalThis.DecompressionStream)) return { error: 'browser' };
    try { bytes = await through(bytes, new globalThis.DecompressionStream('deflate-raw'), MAX_JSON); } catch (e) { return { error: 'corrupt' }; }
  } else if (bytes.length > MAX_JSON) return { error: 'corrupt' };
  let obj;
  try { obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (e) { return { error: 'corrupt' }; }
  const chk = validateSave(obj);
  if (!chk.ok) return { error: chk.error, why: chk.why };
  delete chk.save.S.name;
  return { save: chk.save };
}
function streams(C) {
  if (typeof C !== 'function') return false;
  try { new C('deflate-raw'); return true; } catch (e) { return false; }
}
// push bytes through a (de)compression stream, refusing output past max bytes
async function through(bytes, ts, max) {
  const w = ts.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {}); // failures surface through the reader
  const r = ts.readable.getReader(); const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    n += value.length;
    if (n > max) { r.cancel().catch(() => {}); throw new Error('too large'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
function toBase64url(bytes) {
  const out = []; const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const x = (bytes[i] << 16) | ((i + 1 < n ? bytes[i + 1] : 0) << 8) | (i + 2 < n ? bytes[i + 2] : 0);
    out.push(B64[x >> 18], B64[(x >> 12) & 63]);
    if (i + 1 < n) out.push(B64[(x >> 6) & 63]);
    if (i + 2 < n) out.push(B64[x & 63]);
  }
  return out.join('');
}
// null when the text is not base64url
function fromBase64url(s) {
  if (s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor(s.length * 3 / 4)); let o = 0, acc = 0, nb = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i); const v = c < 128 ? B64_AT[c] : -1;
    if (v < 0) return null;
    acc = ((acc << 6) | v) & 0xfff; nb += 6;
    if (nb >= 8) { nb -= 8; out[o++] = (acc >> nb) & 255; }
  }
  return out.subarray(0, o);
}

// ---------- visit code ----------
// Version 1 holds 270 data bits and a 10-bit CRC: 280 bits, exactly 56 Crockford base32 characters (no padding).
// Written as MTF1- and eleven groups of five plus a last group of one, a code is 72 characters long.
// Encoding forgives: unknown names become the first entry of their list, numbers are rounded and clamped, booleans
// are truthiness, and each profile value snaps to the nearest of 0.1, 0.3, 0.5, 0.7, 0.9 (0.5 when it is not a
// number). Decoding is strict: the whole input must be the code, in any case, with or without spaces and hyphens, I
// and L read as 1 and O as 0, U refused. Errors: 'format', 'version', 'check' (CRC) and 'range' (a value with a valid
// CRC that is out of range, which only a deliberately made code can have).
export const VISIT_V = 1;
export const SHAPES = Object.freeze(['round', 'spiky', 'tall', 'blobby', 'boxy']);
export const COLORS = Object.freeze(['#f2a99a', '#f6cf5b', '#9fd3b0', '#93c2ee', '#bfa9f0', '#f3a0c2', '#ffc98e', '#9edcd6', '#cde38f', '#e4796a', '#7d9fe0', '#c9b8a6']);
export const PATTERNS = Object.freeze(['plain', 'spots', 'stripes', 'belly']);
export const TOPS = Object.freeze(['ears', 'longears', 'horns', 'antennae', 'tuft', 'none']);
export const WEARS = Object.freeze(['none', 'scarf', 'leaf', 'bow', 'glasses', 'hat', 'flower']);
export const VOICES = Object.freeze(['chime', 'hum', 'click', 'whistle']);
export const COMFORT = Object.freeze(['hum', 'tap', 'rock', 'spin', 'flap', 'pace', 'charm']);
export const PRONOUNS = Object.freeze(['they', 'she', 'he']);
export const DIMS = Object.freeze(['sound', 'light', 'people', 'talk', 'time', 'change']); // frozen copy of sim.DIMS
export const PROFILE_STEPS = Object.freeze([0.1, 0.3, 0.5, 0.7, 0.9]);
export const FIX_SLOTS = Object.freeze(['quiet', 'board', 'lanterns', 'ramp', 'dim', 'plain', 'crossing', 'counter', 'bay', 'rentcap', 'farstalls', 'quietrow']);
export const FIX_STATES = Object.freeze(['none', 'onfile', 'built']);
export const VARIANTS = Object.freeze(['whole', 'zoned', 'timed', 'shared']);
export const VIA = Object.freeze(['meeting', 'owner']);
export const RESIDENTS = Object.freeze(['gil', 'pip', 'moss', 'rue', 'bea', 'wren', 'clover', 'hollis']);
export const RUE = Object.freeze(['streak', 'easing', 'free']);
export const BLEND = Object.freeze(['never', 'kept', 'smooth', 'deleted']);
export const COLOUR = Object.freeze(['yourself', 'faded', 'grey']);
export const DEFAULTS = Object.freeze(['as_is', 'headphones_market', 'blend_off', 'leave_early', 'rest_first', 'text_first']);
export const HABIT_ZONES = Object.freeze(['none', 'works', 'market', 'transit', 'hall', 'homerow', 'commons', 'farend', 'street', 'festival']);
export const WFLAGS = Object.freeze(['hall_quiet_row', 'standard_solved', 'wren_paid', 'bea_soup', 'gil_lamp', 'pomeroy_overruled', 'hollis_archive', 'rue_pond', 'wren_came', 'rue_festival', 'dot_lamp', 'tomato_rail', 'rye_bought', 'unit_taught', 'unit_restored', 'counter_hours', 'bay_marked', 'crossing_long', 'benefactor_yes', 'coop_yes', 'conflict_disclosed', 'juno_redesign', 'moss_moved', 'recap']);
export const TALLY = Object.freeze(['bend', 'gear', 'ask', 'fix', 'leave']);
export const ENDINGS = Object.freeze(['', 'blended', 'carried', 'roommade', 'wider', 'movedon', 'known', 'island', 'working']);

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O or U
const ALIAS = { I: '1', L: '1', O: '0' };
const SEPARATORS = /[\s\u200b-\u200d\ufeff\u2010-\u2015\u2212\u30fc\ufe58\ufe63\uff0d-]/g; // spaces, hyphens, dash look-alikes
const OUT = Symbol('out of range');

export function quantize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return PROFILE_STEPS[Math.min(4, Math.max(0, Math.round((n - 0.1) / 0.2)))];
}
// field kinds: norm (forgiving, for encoding), put (value to number) and take (number to value, or OUT)
const choice = (list, bits, prep) => ({ bits, norm: (v) => { const x = prep ? prep(v) : v; return list.indexOf(x) >= 0 ? x : list[0]; }, put: (v) => list.indexOf(v), take: (i) => (i < list.length ? list[i] : OUT) });
const count = (lo, hi, bits) => ({ bits, norm: (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo; }, put: (v) => v, take: (i) => (i >= lo && i <= hi ? i : OUT) });
const yesno = { bits: 1, norm: (v) => !!v, put: (v) => (v ? 1 : 0), take: (i) => i === 1 };
const flag = { bits: 1, norm: (v) => (v ? 1 : undefined), put: (v) => (v ? 1 : 0), take: (i) => (i ? 1 : undefined) }; // only set flags appear
const step = { bits: 3, norm: quantize, put: (v) => PROFILE_STEPS.indexOf(v), take: (i) => (i < PROFILE_STEPS.length ? PROFILE_STEPS[i] : OUT) };
const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v);

// the version 1 layout, in code order: [path in the carry, field kind]
const LAYOUT = [];
const field = (path, kind) => LAYOUT.push(Object.assign({ path }, kind));
field(['act'], count(1, 3, 2));
for (const k of ['look', 'look0']) {
  field([k, 'shape'], choice(SHAPES, 3)); field([k, 'color'], choice(COLORS, 4, lower)); field([k, 'pattern'], choice(PATTERNS, 2));
  field([k, 'top'], choice(TOPS, 3)); field([k, 'wear'], choice(WEARS, 3)); field([k, 'voice'], choice(VOICES, 2)); field([k, 'wheels'], yesno);
}
field(['comfort'], choice(COMFORT, 3)); field(['pronoun'], choice(PRONOUNS, 2));
for (const d of DIMS) field(['profile', d], step);
for (const id of FIX_SLOTS) {
  field(['fixes', id, 's'], choice(FIX_STATES, 2)); field(['fixes', id, 'variant'], choice(VARIANTS, 2));
  field(['fixes', id, 'listened'], yesno); field(['fixes', id, 'via'], choice(VIA, 1));
}
for (const id of RESIDENTS) {
  field(['people', id, 'bond'], count(0, 3, 2)); field(['people', id, 'gw'], count(0, 3, 2));
  field(['people', id, 'revealed'], yesno); field(['people', id, 'met'], yesno);
}
field(['rue'], choice(RUE, 2)); field(['blend'], choice(BLEND, 2)); field(['dep'], count(0, 9, 4)); field(['colour'], choice(COLOUR, 2));
field(['selfEnd'], count(0, 100, 7)); field(['default'], choice(DEFAULTS, 3)); field(['pushHabit'], choice(HABIT_ZONES, 4));
for (const f of WFLAGS) field(['w', f], flag);
for (const k of TALLY) field(['tally', k], count(0, 31, 5));
for (const a of ACTS) field(['endings', a], choice(ENDINGS, 4));
field(['jar'], count(0, 12, 4));
export const VISIT_DATA_BITS = LAYOUT.reduce((n, f) => n + f.bits, 0); // 270
export const VISIT_BITS = VISIT_DATA_BITS + 10; // 280
export const VISIT_CHARS = Math.ceil(VISIT_BITS / 5); // 56

function getPath(o, path) {
  for (const k of path) { if (o === null || typeof o !== 'object' || !hasOwn(o, k)) return undefined; o = o[k]; }
  return o;
}
function setPath(o, path, v) {
  for (let i = 0; i < path.length - 1; i++) { if (!hasOwn(o, path[i])) o[path[i]] = {}; o = o[path[i]]; }
  if (v !== undefined) o[path[path.length - 1]] = v;
}
const putBits = (bits, v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
const readBits = (bits, at, n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[at + i]; return v; };

// The carry exactly as a visit code holds it: every field present (all 12 fix slots, all 8 residents, endings 1 to 3),
// w listing only the flags that are set (as 1), anything else left out. decodeVisit(encodeVisit(c)).carry deep-equals
// normalizeCarry(c).
export function normalizeCarry(carry) {
  const out = {};
  for (const f of LAYOUT) setPath(out, f.path, f.norm(getPath(carry, f.path)));
  return out;
}
export function encodeVisit(carry) {
  const c = normalizeCarry(carry); const bits = [];
  for (const f of LAYOUT) putBits(bits, f.put(getPath(c, f.path)), f.bits);
  putBits(bits, crc10(bits), 10);
  return 'MTF' + VISIT_V + '-' + toBase32(bits).match(/.{1,5}/g).join('-');
}
// { carry } | { error: 'format' | 'check' | 'version' | 'range' }
export function decodeVisit(str) {
  if (typeof str !== 'string' || str.length > 400) return { error: 'format' };
  const s = str.normalize('NFKC').toUpperCase().replace(SEPARATORS, '');
  const m = /^MTF([0-9A-Z])([0-9A-Z]*)$/.exec(s);
  if (!m) return { error: 'format' };
  const ver = ALIAS[m[1]] || m[1];
  if (!/^[0-9]$/.test(ver)) return { error: 'format' };
  if (+ver !== VISIT_V) return { error: 'version' };
  if (m[2].length !== VISIT_CHARS) return { error: 'format' };
  const bits = fromBase32(m[2]);
  if (!bits) return { error: 'format' };
  if (crc10(bits.slice(0, VISIT_DATA_BITS)) !== readBits(bits, VISIT_DATA_BITS, 10)) return { error: 'check' };
  const carry = {}; let at = 0;
  for (const f of LAYOUT) {
    const v = f.take(readBits(bits, at, f.bits)); at += f.bits;
    if (v === OUT) return { error: 'range' };
    setPath(carry, f.path, v);
  }
  return { carry };
}

// bits (0/1, most significant first) to Crockford base32, zero-padded to a whole character
export function toBase32(bits) {
  let out = '';
  for (let i = 0; i < bits.length; i += 5) { let v = 0; for (let j = 0; j < 5; j++) v = (v << 1) | (bits[i + j] ? 1 : 0); out += B32[v]; }
  return out;
}
// Crockford base32 to bits, ignoring case, spaces and hyphens and reading I and L as 1 and O as 0; null on any other
// character (U included)
export function fromBase32(str) {
  const s = String(str).toUpperCase().replace(/[\s-]/g, ''); const bits = [];
  for (const ch of s) {
    const v = B32.indexOf(ALIAS[ch] || ch);
    if (v < 0) return null;
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  return bits;
}
// CRC-10 over a bit list: x^10+x^9+x^5+x^4+x+1 (0x233), init 0, unreflected, no final xor (check value 0x199 for the
// bytes of "123456789"). The polynomial has a constant term, so every error confined to 10 consecutive bits changes
// the CRC. One mistyped character changes at most 5 consecutive bits and two swapped neighbours at most 10, so each is
// always caught, whether it falls in the data or in the CRC characters.
export function crc10(bits) {
  let r = 0;
  for (let i = 0; i < bits.length; i++) { const top = ((r >> 9) ^ bits[i]) & 1; r = (r << 1) & 0x3ff; if (top) r ^= 0x233; }
  return r;
}
