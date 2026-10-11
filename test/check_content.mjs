// Content checker: runs in Node in a second or two, before every build. Fails (exit 1) on anything that would break
// a scene at runtime or quietly never happen: unknown node keys, missing labels, unknown condition or effect terms,
// references to people, hints, notes, fixes or places that don't exist, backers without scripts, write-only flags,
// numbers in play text, and phrases the game has ruled out. Warnings are printed but don't fail.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');
const C = await import(path.join(src, 'content.js'));
const SIM = await import(path.join(src, 'sim.js'));
const SC = await import(path.join(src, 'script.js'));
const NB = await import(path.join(src, 'notes.js'));
const T23 = await import(path.join(src, 'talk23.js'));

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const SPEAKERS = new Set([...Object.keys(C.CAST), 'you']);
const SLOTS = new Set(['over', 'under', 'no', 'helps', 'love']);
const NOTES = new Set(NB.FIELD_NOTES.map((n) => n.id));
const CALLS = new Set(['shop', 'fold', 'proposals', 'archive', 'paint', 'onfile']);
const ZONES = new Set(Object.keys(SIM.PLACES).concat(['home']));
const flagWrites = new Map(), flagReads = new Map();
const note = (map, k, where) => { if (!map.has(k)) map.set(k, where); };

function checkCond(str, where) {
  let groups; try { groups = SC.parseCond(str); } catch (e) { err(where + ': ' + e.message); return; }
  for (const alts of groups) for (const t of alts) {
    const m = t.m;
    if (t.name === 'flag') note(flagReads, m[1], where);
    if (['met', 'bond', 'gw'].includes(t.name) && !C.CAST[m[1]]) err(where + ': unknown person "' + m[1] + '" in ' + t.src);
    if (t.name === 'fix' && !SIM.FIXES[m[1]]) err(where + ': unknown fix "' + m[1] + '"');
    if (t.name === 'hint' && !C.HINTS[m[1]]) err(where + ': unknown hint "' + m[1] + '"');
    if (t.name === 'know' && (!C.CAST[m[1]] || !SLOTS.has(m[2]))) err(where + ': bad know term ' + t.src);
  }
}
function checkEffect(e, where) {
  const p = SC.parseEffect(e); if (!p) { err(where + ': unknown effect "' + e + '"'); return; }
  const m = p.m;
  if (p.name === 'flag') note(flagWrites, m[1], where);
  if (['bond', 'gw'].includes(p.name) && !C.CAST[m[1]]) err(where + ': unknown person in ' + e);
  if (['idea', 'back'].includes(p.name) && !SIM.FIXES[m[1]]) err(where + ': unknown fix in ' + e);
  if (p.name === 'know' && (!C.CAST[m[1]] || !SLOTS.has(m[2]))) err(where + ': bad know effect ' + e);
  if (p.name === 'note' && !NOTES.has(m[1])) err(where + ': unknown note ' + e);
}
function walk(nodes, where) {
  if (!Array.isArray(nodes)) { err(where + ': not a node list'); return; }
  const labels = new Set(nodes.filter((n) => n.label).map((n) => n.label));
  const ids = new Set();
  nodes.forEach((n, i) => {
    const w = where + '[' + i + ']';
    for (const k of Object.keys(n)) if (!SC.NODE_KEYS.includes(k)) err(w + ': unknown key "' + k + '"');
    if (n.go && !labels.has(n.go)) err(w + ': go to missing label "' + n.go + '"');
    if (n.who && !SPEAKERS.has(n.who)) err(w + ': unknown speaker "' + n.who + '"');
    if (n.who && n.t == null && !n.face) err(w + ': speaker without text');
    if (n.hint && !C.HINTS[n.hint]) err(w + ': unknown hint "' + n.hint + '"');
    if (n.call && !CALLS.has(n.call)) err(w + ': unknown call "' + n.call + '"');
    if (n.notice && (!SIM.DIMS.includes(n.notice) || !ZONES.has(n.zone))) err(w + ': bad notice');
    if (n.if !== undefined) checkCond(n.if, w);
    for (const e of n.do || []) checkEffect(e, w);
    for (const [j, o] of (n.ask || []).entries()) {
      const ow = w + '.ask[' + j + ']';
      for (const k of Object.keys(o)) if (!SC.ASK_KEYS.includes(k)) err(ow + ': unknown key "' + k + '"');
      if (!o.t) err(ow + ': option without text');
      if (o.go && !labels.has(o.go)) err(ow + ': go to missing label "' + o.go + '"');
      if (o.if) checkCond(o.if, ow);
      for (const e of o.do || []) checkEffect(e, ow);
      if (!o.id) warn(ow + ': option without id ("' + o.t + '")'); else { if (ids.has(o.id)) err(ow + ': duplicate option id ' + o.id); ids.add(o.id); }
    }
  });
}
// every scene in the game
const scripts = [];
for (const [id, T] of Object.entries(C.TALK)) for (const [k, v] of Object.entries(T)) {
  if (k === 'back') for (const [f, s] of Object.entries(v)) { scripts.push(['TALK.' + id + '.back.' + f, s]); if (!SIM.FIXES[f]) err('TALK.' + id + '.back.' + f + ': unknown fix'); else if (!SIM.FIXES[f].backers.includes(id)) err('TALK.' + id + '.back.' + f + ': ' + id + ' is not a backer of ' + f + ', so this never plays'); }
  else scripts.push(['TALK.' + id + '.' + k, v]);
}
for (const k of ['open', 'none']) if (C.COUNCIL[k]) scripts.push(['COUNCIL.' + k, C.COUNCIL[k]]);
if (C.SCRIPTS) for (const [k, v] of Object.entries(C.SCRIPTS)) scripts.push(['SCRIPTS.' + k, v]);
// the later visits' talk (src/talk23.js)
for (const [k, v] of Object.entries(T23.TALK2)) scripts.push(['TALK2.' + k, v]);
for (const [k, v] of Object.entries(T23.TALK3)) scripts.push(['TALK3.' + k, v]);
for (const [w, s] of scripts) walk(s, w);
// backers
for (const [f, F] of Object.entries(SIM.FIXES)) for (const b of F.backers) if (!((C.TALK[b] || {}).back || {})[f]) err('FIXES.' + f + ': backer ' + b + ' has no back script');
// hints
for (const [id, H] of Object.entries(C.HINTS)) { if (!C.CAST[H.by]) err('HINTS.' + id + ': unknown speaker'); for (const k of ['t', 'literal', 'between', 'right', 'wrong', 'asked']) if (!H[k]) err('HINTS.' + id + ': missing ' + k); }
// night texts are code: try them over flag combinations
for (const d of Object.keys(C.NIGHT)) for (const flags of [{}, { bea_bus: 1, folded: 1, rue_cracked: 1 }]) for (const met of [{}, { wren: 1 }]) {
  try { const out = C.NIGHT[d]({ flags, met, fixes: {}, bonds: {}, blend: {} }); if (!Array.isArray(out) || !out.every((x) => Array.isArray(x) && x.length === 2 && x[1])) err('NIGHT[' + d + '] returned a bad list'); } catch (e) { err('NIGHT[' + d + '] threw: ' + e.message); }
}
// flags the code reads and writes (keys built at runtime are listed here on purpose)
const RUNTIME = /^(shift\d|missed\d|low1_\d|low2_\d|dusk\d|asked_\w+|gilasked_\w+|told_\w+|late\d|hpm\d)$/;
for (const f of fs.readdirSync(src).concat(fs.readdirSync(path.join(src, 'games')).map((x) => 'games/' + x))) {
  if (!f.endsWith('.js')) continue; const code = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of code.matchAll(/S\.flags\.(\w+)\b\s*=(?!=)/g)) note(flagWrites, m[1], f);
  for (const m of code.matchAll(/S\.flags\[['"](\w+)['"]\]\s*=(?!=)/g)) note(flagWrites, m[1], f);
  for (const m of code.matchAll(/S\.flags\.(\w+)\b(?!\s*=[^=])/g)) note(flagReads, m[1], f);
  for (const m of code.matchAll(/['"`&|!(\s]flag\.(\w+)\b/g)) if (!f.endsWith('script.js') && !['position', 'rotation', 'scale', 'visible', 'material'].includes(m[1])) note(flagReads, m[1], f);
}
for (const f of fs.readdirSync(src).concat(fs.readdirSync(path.join(src, 'games')).map((x) => 'games/' + x))) {
  if (!f.endsWith('.js')) continue; const code = fs.readFileSync(path.join(src, f), 'utf8');
  for (const m of code.matchAll(/fieldNote\('(\w+)'\)/g)) if (!NOTES.has(m[1])) err(f + ': fieldNote("' + m[1] + '") is not a note in notes.js');
}
// stakeholder talks are scripts too
for (const [f, T] of Object.entries(C.STAKES || {})) { walk(T.talk, 'STAKES.' + f + '.talk'); if (!C.CAST[T.who]) err('STAKES.' + f + ': unknown person'); if (!SIM.FIXES[f]) err('STAKES.' + f + ': unknown fix'); }
for (const [f, F] of Object.entries(SIM.FIXES)) if (!(C.STAKES || {})[f]) err('FIXES.' + f + ': no stakeholder in STAKES');
for (const [k, w] of flagWrites) if (!flagReads.has(k) && !RUNTIME.test(k)) warn('flag "' + k + '" is written (' + w + ') but never read');
for (const [k, w] of flagReads) if (!flagWrites.has(k) && !RUNTIME.test(k)) err('flag "' + k + '" is read (' + w + ') but never written');
// words: numbers stay in the notebook, and some phrases are ruled out everywhere
const BANNED = ['out sick', 'Rue is sad', 'Rue will be sad', "I'm used to it", 'get used to it', 'too boxy', 'You won', 'jackpot', 'free spins', 'addicting', 'wheelchair-bound', 'confined to', 'suffers from', 'high-functioning', 'low-functioning', 'special needs', 'normal people', 'the elderly', 'senior moment', 'silver tsunami', 'dying town', 'time bomb', 'We noticed you', 'six founders', 'seventy years', '저출산', '장애우', '장애자', '자폐아'];
const BANNED_IN_PLAY = ['limbic capitalism'];
function strings(o, where, out) { if (typeof o === 'string') out.push([where, o]); else if (Array.isArray(o)) o.forEach((x, i) => strings(x, where + '[' + i + ']', out)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) strings(v, where + '.' + k, out); return out; }
const all = [];
for (const [k, v] of Object.entries(C)) if (typeof v !== 'function') strings(v, k, all);
for (const [k, v] of Object.entries(NB)) if (typeof v !== 'function') strings(v, k, all);
for (const [k, v] of Object.entries(T23)) if (typeof v !== 'function') strings(v, k, all);
for (const [w, s] of all) {
  const inNotes = w.startsWith('FIELD_NOTES') || w.startsWith('NOTE_SECTIONS') || w.startsWith('SUPPORT') || w.startsWith('CONTENT_NOTES') || w.startsWith('INGREDIENTS') || w.startsWith('CREDIT');
  for (const b of BANNED) if (s.toLowerCase().includes(b.toLowerCase())) err(w + ': banned phrase "' + b + '"');
  if (!inNotes) { for (const b of BANNED_IN_PLAY) if (s.toLowerCase().includes(b)) err(w + ': "' + b + '" only belongs in the notebook'); if (/\d\s?%|percent/.test(s)) err(w + ': percentages only belong in the notebook'); }
}
// every string literal in the code, too: banned phrases ("You won" but not "You won't"), and ages given as numbers
// (residents' ages are never shown as numbers in play)
const AGE = /\b(?:fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?(?:,| and still| years old|\b(?= next))/i;
for (const f of fs.readdirSync(src).concat(fs.readdirSync(path.join(src, 'games')).map((x) => 'games/' + x))) {
  if (!f.endsWith('.js')) continue; const code = fs.readFileSync(path.join(src, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;,{}()])\/\/.*$/gm, '$1');
  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const t = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\'/g, "'"); if (t.length < 6) continue;
    for (const b of BANNED) { const re = b === 'You won' ? /\byou won\b(?!['’]t)/i : null; if (re ? re.test(t) : t.toLowerCase().includes(b.toLowerCase())) err(f + ': banned phrase "' + b + '" in "' + t.slice(0, 60) + '"'); }
    if (AGE.test(t)) err(f + ': an age given as a number in "' + t.slice(0, 70) + '"');
  }
}
console.log(warns.length ? warns.length + ' warnings' + (process.argv.includes('-v') ? ':\n  ' + warns.join('\n  ') : ' (run with -v to list)') : 'no warnings');
if (errors.length) { console.log(errors.length + ' errors:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('content OK: ' + scripts.length + ' scenes checked');
