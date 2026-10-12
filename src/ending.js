// The end of a visit: a title that says what mattered most in it, what Larkspur will remember (in plain sentences, no
// lessons), and what carries to the next visit (the carry record, kept on this device and as a code you can copy).
import * as SIM from './sim.js';
import { CAST, STAKES } from './content.js';
import { DEFAULTS } from './decided.js';
import * as SAVE from './save.js';

export const TITLES = {
  blended: { title: 'Blended', text: 'You fit. Everyone says so. Most days you cannot quite remember what you were like when you arrived, and Blend says that is the point.' },
  carried: { title: 'Carried', text: 'Larkspur never made room, so you carried it. It showed, in the end, in your color.' },
  roommade: { title: 'Room Made', text: 'Two things in Larkspur work differently now, and people you have never met use them. Someone lost something for each; you know who.' },
  wider: { title: 'A Little Wider', text: 'One thing in Larkspur works differently now, and people you will never meet will use it. Someone lost a little for it; you know who.' },
  movedon: { title: 'Moved On', text: 'You found the places that fit and stopped going to the ones that did not. The town kept its shape. You kept yours.' },
  known: { title: 'Known', text: 'People here started adjusting before you asked. You started doing it back.' },
  island: { title: 'The Island', text: 'You found your people and the places you could share. The rest of Larkspur stayed exactly as it was.' },
  working: { title: 'Still Working It Out', text: 'Some days you bent, some days you asked, some days you just went home. Most people\'s first weeks look like this.', later: 'Sometimes you bent, sometimes you asked, sometimes you just went home. Most festival days look like this.' },
};
// the new game's first day always makes room three times (it's how you learn the town): the titles count what you
// made after it, on your own
export const TITLES2 = {
  roommade: { title: 'Room Made', text: 'After your first day, you made room twice more, on your own, and people you have never met use what you built. Someone lost something for each; you know who.' },
  wider: { title: 'A Little Wider', text: 'After your first day, you made room once more, on your own. People you will never meet will use it. Someone lost a little for it; you know who.' },
};
const ZONE_NAME = { works: 'The Works', market: 'The market', transit: 'The bus stop', commons: 'The Commons', farend: 'The Far End', homerow: 'Home Row', hall: 'The hall', street: 'The street', festival: 'The festival' };
const STAYED = { works: 'stayed bright', market: 'stayed loud', transit: 'kept changing without a word', commons: 'stayed open and glaring', farend: 'stayed very still', homerow: 'kept its knockers and no signs', hall: 'stayed full and formal', street: 'kept the Standard\'s pace', festival: 'stayed full' };

export const colourOf = (self) => (self >= 70 ? 'yourself' : self >= 40 ? 'faded' : 'grey');
// fixes you helped make: you presented it yourself, or you showed Gil (approved ones count; they go up on Thursday)
export function fixesMade(S) { return Object.keys(SIM.FIXES).filter((f) => ['approved', 'built'].includes(S.fixes[f]) && (S.fixMine || {})[f]); }
export function scores(S) {
  const made = fixesMade(S);
  const listened = Object.keys(S.stakes || {}).filter((f) => S.stakes[f] === 'listened' && made.includes(f)).length;
  const bonds = Object.keys(CAST).filter((id) => !CAST[id].minor && (S.bonds[id] || 0) >= 2).length;
  const unasked = Object.keys(S.kept || {}).filter((k) => k.startsWith('unasked_')).length;
  const favours = Object.values(S.favours || {}).filter((v) => v === 'yes').length;
  const showed = (S.flags.rue_pond ? 1 : 0) + (S.flags.wren_invited || S.flags.foldHour ? 1 : 0);
  return { town: made.length * 2 + listened, people: bonds + unasked + favours + showed, made };
}
// the title, in priority order: your colour first; then whether you changed the place (a fix you helped make, the
// rarest thing in a season: two at most, each needing backers, the person it costs, and a vote); then the answer you
// gave most (pushing through until it showed, or leaving); then who knows you. (Comparing a town score with a people
// score let friendliness erase a fix: the season caps the one and nothing caps the other, so every sociable fixer
// came out Known. And four exits out of thirty answers is not a way of life: leaving has to be your usual answer.)
export function endingKey(S) {
  const colour = colourOf(S.self); const dep = S.blend.dep || 0; const sm = S.blend.has && S.blend.smooth && !S.blend.deleted;
  if (colour === 'grey') return dep >= 4 || sm ? 'blended' : 'carried';
  const sc = scores(S);
  if (sc.made.length >= 1) return sc.made.length >= 2 ? 'roommade' : 'wider';
  const st = S.stats || {}; const bends = (st.bend || 0) + (st.smooth || 0), leaves = st.leave || 0;
  const answers = bends + (st.gear || 0) + (st.ask || 0) + (st.fix || 0) + leaves;
  if (colour === 'faded' && bends >= 8 && bends >= 0.6 * answers) return 'carried';
  if (leaves >= 4 && leaves >= 0.4 * answers && colour === 'yourself') return 'movedon';
  if (sc.people >= 3) return 'known';
  if (sc.people >= 2) return 'island';
  return 'working';
}
// the one line that names places and people, under the title
export function specificLine(S, key) {
  if (key === 'carried' || key === 'blended') {
    const n = {}; for (const r of S.log || []) if (r.k === 'barrier' && r.v === 'bend') n[r.z] = (n[r.z] || 0) + 1;
    const top = Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 2);
    if (!top.length) return '';
    return top.map((z) => (ZONE_NAME[z] || 'Larkspur') + ' ' + (STAYED[z] || 'stayed as it was') + '.').join(' ') + (top.length > 1 ? ' You carried both' : ' You carried it') + ', and it showed in your color.';
  }
  // leaving was your usual answer: name where you stepped out of, and what you still left the town
  if (key === 'movedon') {
    const n = {}; for (const r of S.log || []) if (r.k === 'barrier' && r.v === 'leave') n[r.z] = (n[r.z] || 0) + 1;
    const top = Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 2).map((z) => (ZONE_NAME[z] || 'Larkspur').replace(/^The /, 'the '));
    const filed = Object.keys(SIM.FIXES).filter((f) => ['proposal', 'ready', 'onfile', 'tabled'].includes(S.fixes[f])).length;
    const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    return ((top.length ? 'You stepped out of ' + list(top) + ' when ' + (top.length > 1 ? 'they' : 'it') + ' pinched.' : '') + (filed ? ' You still left ' + (filed > 1 ? (NUM[filed] || filed) + ' ideas' : 'an idea') + ' on file for the town.' : '')).trim();
  }
  // (Room Made and A Little Wider: each fix, and who lost something for it, is listed under what Larkspur will
  // remember, so the title needs no line of its own)
  return '';
}
// what Larkspur will remember: one plain sentence per thing that carries
export function remember(S, rueState, extra) {
  const out = (extra || []).slice(); const filed = [];
  for (const f of Object.keys(SIM.FIXES)) {
    const st = S.fixes[f]; const F = SIM.FIXES[f]; const T = STAKES[f]; const l = (S.stakes || {})[f] === 'listened';
    // "the counter hours are in place" (not "up", which reads as time running out); a fix from an earlier visit is
    // simply still there (whoever lost something for it was told at the time, and may not live here any more)
    const up = F.inplace ? 'in place' : 'up'; const older = (S.act || 1) > 1 && ((S.fixAct || {})[f] || 1) < (S.act || 1);
    if (st === 'built' && older) out.push('The ' + F.short + ' ' + SIM.agree(f, 'is', 'are') + ' still ' + up + '.');
    else if (st === 'built') out.push('The ' + F.short + ' ' + SIM.agree(f, 'is', 'are') + ' ' + up + (l ? ', ' + T.variantName : '') + '. ' + (l ? T.lessLoss : 'Who lost something: ' + T.loses));
    else if (st === 'approved') out.push('The ' + F.short + ' ' + SIM.agree(f, 'goes', 'go') + ' up on Thursday' + (l ? ', ' + T.variantName : '') + '. ' + (l ? T.lessLoss : 'Who loses something: ' + T.loses));
    else if (st === 'onfile' && S.fixRestored === f) out.push('The ' + F.short + ' came down for Unit. ' + SIM.agree(f, 'It is', 'They are') + ' on file again.');
    else if (['proposal', 'ready', 'onfile', 'tabled'].includes(st)) filed.push('the ' + F.short);
  }
  // ideas still on file, in one sentence rather than one line each
  if (filed.length) out.push((filed.length > 1 ? 'Your ideas for ' + list(filed) + ' are' : 'Your idea for ' + filed[0] + ' is') + ' on file for next season.');
  if ((S.w || {}).wren_paid) out.push('Wren was paid for the porch lanterns, at the price on the sign.');
  const close = Object.keys(CAST).filter((id) => !CAST[id].minor && (S.bonds[id] || 0) >= 2).sort((a, b) => (S.bonds[b] || 0) - (S.bonds[a] || 0)).slice(0, 4).map((id) => CAST[id].name);
  if (close.length) out.push(list(close) + (close.length > 1 ? ' know you best.' : ' knows you best.'));
  const rue = rueState;
  if ((S.act || 1) === 1) out.push(rue === 'easing' ? 'Rue went to the festival without the app. Tomorrow might be a bad one. That is allowed.' : 'Rue\'s streak is at four hundred and fourteen days.');
  const B = S.blend; out.push(!B.has ? 'You never installed Blend.' : B.deleted ? 'You deleted Blend. The birds seem louder.' : B.smooth ? 'Blend\'s Smooth Mode is still on.' : 'Blend is still on your phone.');
  const col = colourOf(S.self); out.push(col === 'yourself' ? 'You look like yourself.' : col === 'faded' ? 'You look a little faded around the edges.' : 'You are nearly the color of the statue.');
  if (S.default && DEFAULTS[S.default] && S.default !== 'as_is') out.push('Next time: ' + DEFAULTS[S.default].t.toLowerCase() + '.');
  return out;
}
const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');

// the carry: exactly what the next visit (and the visit code) needs, and nothing personal
export function buildCarry(S, key, rueState) {
  const fixes = {};
  for (const f of Object.keys(SIM.FIXES)) {
    const st = S.fixes[f]; const l = (S.stakes || {})[f] === 'listened';
    fixes[f] = { s: st === 'built' || st === 'approved' ? 'built' : st && st !== 'idea' ? 'onfile' : 'none', variant: l ? SIM.FIXES[f].variant : 'whole', listened: l, via: (S.fixVia || {})[f] === 'owner' ? 'owner' : 'meeting' };
  }
  const people = {};
  for (const id of SAVE.RESIDENTS) people[id] = { bond: Math.max(0, Math.min(3, S.bonds[id] || 0)), gw: Math.max(0, Math.min(3, (S.gw || {})[id] || 0)), revealed: (S.revealed || {})[id] === 'seen', met: !!S.met[id] };
  // the tally is cumulative across visits (each visit's code holds everything so far)
  const B = S.blend; const tally = {}; for (const k of SAVE.TALLY) tally[k] = Math.min(31, ((S.tallyPrev || {})[k] || 0) + (S.stats[k] || 0) + (k === 'bend' ? S.stats.smooth || 0 : 0));
  const w = Object.assign({}, S.w || {}); if (S.flags.hollis_archive) w.hollis_archive = 1; if (S.flags.wren_invited) w.wren_came = 1; if (rueState === 'easing') w.rue_festival = 1;
  const prev = (SAVE.readCarry().carry || { acts: {} }).acts;
  const endings = Object.assign({ 1: '', 2: '', 3: '' }, S.endingsPrev || ((prev[String((S.act || 1) - 1)] || {}).endings) || {}); endings[S.act || 1] = key;
  return SAVE.normalizeCarry({
    act: S.act || 1, look: S.look, look0: S.look0 || S.look, comfort: S.look.comfort || 'hum', pronoun: S.pronoun, profile: S.profile,
    fixes, people, rue: rueState === 'easing' ? 'easing' : 'streak', blend: !B.has ? 'never' : B.deleted ? 'deleted' : B.smooth ? 'smooth' : 'kept', dep: B.dep || 0,
    colour: colourOf(S.self), selfEnd: Math.round(S.self), default: S.default || 'as_is', pushHabit: S.pushHabit || 'none', w, tally, endings, jar: Math.min(12, (S.jarPrev || 0) + (S.jar || []).length),
  });
}
// where things fit, for the fit card: places where the fit was good (from where you felt pinches, inverted)
export function fitCardData(S, G, key) {
  const where = S.where || {}; const pinched = new Set(); for (const k of Object.keys(where)) for (const z of Object.keys(where[k])) if (where[k][z] >= 3) pinched.add(z);
  const places = ['farend', 'commons', 'homerow', 'market', 'transit', 'works'].filter((z) => !pinched.has(z)).slice(0, 3).map((z) => ({ farend: 'The Far End', commons: 'The Commons', homerow: 'Home Row', market: 'Market Square', transit: 'The bus stop', works: 'The Works' }[z]));
  if (S.fixes.quiet === 'built') places.unshift('The quiet corner');
  const st = S.stats; const P = S.tallyPrev || {}; const tally = { you: (P.bend || 0) + (st.bend || 0) + (st.smooth || 0), gear: (P.gear || 0) + (st.gear || 0), them: (P.ask || 0) + (st.ask || 0), place: (P.fix || 0) + (st.fix || 0), nobody: (P.leave || 0) + (st.leave || 0) };
  return { portrait: G.portrait(), name: S.name, showName: false, places: places.slice(0, 3), tally, turned: S.junoAnswer || null, nextTime: S.default && DEFAULTS[S.default] ? DEFAULTS[S.default].t : null, kept: (S.jar || []).length ? S.jar[S.jar.length - 1].t : null, visits: (S.act || 1) - ((S.w || {}).recap ? 1 : 0), title: TITLES[key].title };
}
