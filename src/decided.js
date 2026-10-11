// Who decided? On the walk to the festival, a few moments from your visit come back: what you faced, what was also
// true about the place, and who paid. Then one thing you could set differently next time. Never a grade, never "you
// should". The moments are picked from the event log (story.log) by who paid and how few options there were.
import * as THREE from 'three';
import { CAST } from './content.js';
import { ZONES } from './town.js';
import { fmtTime } from './util.js';

// one or two true things about how each place was set (Act 1)
export const CAUSES = {
  works: ['The panels were bought to the founders\' spec.', 'Shifts start at nine; the spec says so.'],
  market: ['Whoever owns a speaker sets its volume.', 'At noon the stalls funnel everyone into one lane.'],
  transit: ['Route changes are only announced aloud.', 'The speaker faces the road.'],
  hall: ['Meetings start at six, in a full room.', 'The rules say stillness in the chamber.'],
  homerow: ['No door on the row has a sign.'],
  commons: ['The lawn was laid out without shade.'],
  farend: ['The lanes are lit only on festival nights.'],
  street: ['The street was built for the Standard\'s pace.'],
  festival: ['The festival has always been held in the square, at full volume.'],
  home: ['Your room is set the way you set it.'],
};
// what was also true when you said Blend's line
const BLEND_ALSO = ['Blend suggests the line most people would say.', 'It pays the same points whoever you are talking to.'];
// a fixed shot of each place (exterior), for the moment's card
const SHOTS = {
  market: [[30, 14, 44], [30, 1, 26]], transit: [[62, 9, 34], [53, 1, 24]], commons: [[52, 12, 27], [50, 1, 10]], farend: [[52, 10, 54], [50, 1, 42]],
  homerow: [[14, 10, 50], [14, 1, 37]], street: [[30, 12, 36], [30, 1, 24]], festival: [[30, 14, 44], [30, 1, 26]],
};
const STAND = { market: [28.6, 27.8], transit: [52.6, 25.6], commons: [49.5, 12.8], farend: [48.5, 41.5], homerow: [13.8, 38.2], street: [30, 33.5], festival: [28.6, 27.8] };
const DIM_WORD = { light: ['too bright', 'too dim'], sound: ['too loud', 'too quiet'], people: ['too crowded', 'too lonely'], talk: ['full of hints', 'too blunt'], time: ['too late in your day', 'too early in your day'], change: ['full of surprises', 'too rigid'] };
// what you did, said plainly
function verbLine(r) {
  const who = (id) => (CAST[id] ? CAST[id].name : id);
  if (r.k === 'barrier' && r.turn) return 'Juno asked you. ' + ({ bend: 'You asked Juno to push through.', gear: 'You lent Juno your gear.', ask: 'You changed your own rule.', fix: 'You redesigned it together.', leave: 'You did nothing, and Juno went.' }[r.v] || '');
  if (r.k === 'choice') return { coop: 'You made the Shed a co-op. Ines left for the city.', nocoop: 'You kept the Shed as it was. Gil and Rue stayed on without a vote.', fund_yes: 'You took the Founders\' Fund\'s money, with its strings.', fund_no: 'You turned down the Fund\'s money. The repairs wait a year.', moved: 'You helped Moss move to the Far End.', mossbid: 'You let Moss bid like everyone else.', disclosed: 'You said you lived on Home Row, and then you judged it.', recused: 'You stepped back. Gil will judge it next season.', quietly: 'You judged the quiet zone on your own street, and said nothing about your house.', against: 'You recommended against a quiet zone on your own street.' }[r.v] || '';
  if (r.k === 'barrier') {
    // the later visits' turned cards
    if (r.v === 'teach') return 'You taught Unit the room, out of your own pay.';
    if (r.v === 'restore') return r.by === 'gil' ? 'Gil put the room back to the spec, for the machine.' : 'You put the room back to the spec, for the machine.';
    if (r.v === 'hurry') return 'You took Bea\'s arm and hurried her across.';
    if (r.v === 'wait') return 'You walked at Bea\'s pace, and the van waited.';
    if (r.v === 'none') return 'You let Bea be. She went round by the bakery.';
    if (r.v === 'fit') return 'The kiosk heard you the first time.';
    if (r.v === 'stand') return 'You stood with Tomas until the bot moved.';
    if (r.v === 'ring') return 'You rang the bot\'s bell for Tomas.';
    if (r.v === 'ask' && r.by === 'sana') return 'You rang the call bell. Sana answered, for twelve towns.';
    if (r.dim === 'bots' && r.v === 'leave') return 'You left Tomas to it.';
    if (r.v === 'bend') return r.by === 'blend' ? 'Blend\'s Smooth Mode pushed you through.' : r.by === 'rules' ? 'You kept still, because the rules said so.' : 'You pushed through, and hid it.';
    if (r.v === 'gear') return 'You put your gear on.';
    if (r.v === 'ask') return r.by !== 'you' && r.by ? who(r.by) + ' changed it before you asked.' : 'You asked ' + who(r.pay[0]) + ' to change it' + (r.pay[1] ? '. ' + who(r.pay[1]) + ' paid for the change.' : '.');
    if (r.v === 'fix') return 'You noted it for the Fix-It Shed.';
    if (r.v === 'leave') return 'You left.';
  }
  if (r.k === 'refused') return r.by === 'sana' ? 'You rang Unit\'s call bell. A script answered.' : 'You asked ' + who(r.by) + '. The answer was no.';
  if (r.k === 'missed') return r.v === 'shift' ? 'You missed your shift. Gil covered.' : r.v === 'meeting' ? 'You stepped out of the meeting.' : r.v === 'pond' ? 'You didn\'t make it to the pond. Rue waited.' : 'You slept through the afternoon.';
  if (r.k === 'favour') return r.v === 'yes' ? 'You said yes to a favour.' : r.v === 'no' ? 'You said no to a favour.' : 'A favour never came due.';
  if (r.k === 'vote') return r.v === 'passed' || r.v === 'approved' ? 'A fix went through.' : r.v === 'stalled' ? 'The Fund\'s clause stalled a fix. Referred for further study.' : 'A fix didn\'t pass.';
  if (r.k === 'stake') return r.v === 'listened' ? 'You changed a design for the person it cost.' : 'You kept a design as it was.';
  if (r.k === 'habit') return r.v === 'gear' ? 'You put your gear on before you noticed. It has become what you do there.' : r.v === 'leave' ? 'You were out the door before you noticed. It has become what you do there.' : 'You straightened up before you noticed. It has become what you do there.';
  if (r.k === 'default' && r.by === 'blend') return 'You said what Blend suggested' + (r.line ? ': "' + r.line + '"' : '.');
  return '';
}
// the moments worth looking at again
export function pickMoments(S, n) {
  const rows = (S.log || []).filter((r) => (['barrier', 'refused', 'missed', 'favour', 'vote', 'stake', 'habit', 'choice'].includes(r.k) || (r.k === 'default' && r.by === 'blend')) && r.v !== 'lapsed');
  const score = (r) => {
    let s = 0; const others = (r.pay || []).filter((p) => p !== 'you');
    if (others.length) s += 2;
    if ((r.pay || []).includes('you') && (r.v === 'bend' || r.v === 'said' || r.k === 'missed' || r.k === 'refused')) s += 1;
    if ((r.f || {}).off >= 2) s += 1;
    if (r.by === 'habit' || r.by === 'blend' || r.k === 'habit') s += 1;
    if (r.turn) s += 2; // the card turned around: always worth looking at again
    return s;
  };
  const picked = [];
  const cands = rows.map((r, i) => ({ r, i, s: score(r) }));
  while (picked.length < n && cands.length) {
    for (const c of cands) { c.adj = c.s - picked.filter((p) => p.r.z === c.r.z).length - (picked.some((p) => p.r.d === c.r.d) && new Set(rows.map((x) => x.d)).size > 1 ? 0.5 : 0); }
    cands.sort((a, b) => b.adj - a.adj || a.i - b.i);
    const c = cands.shift(); picked.push(c);
    // one of Blend's lines is enough to make the point
    if (c.r.k === 'default') for (let j = cands.length - 1; j >= 0; j--) if (cands[j].r.k === 'default') cands.splice(j, 1);
  }
  return picked.sort((a, b) => a.i - b.i).map((c) => c.r);
}
// what you faced: the place, the hour, and what you had to work with
function faced(S, r) {
  const out = [];
  const z = ZONES.find((q) => q.id === r.z); const place = z ? z.name : { works: 'The Works', hall: 'Town Hall', home: 'Home', street: 'The street', festival: 'The festival' }[r.z] || 'Larkspur';
  out.push(place + ', ' + ['', 'Monday', 'Tuesday', 'Wednesday'][r.d] + ' ' + fmtTime(r.m) + '.');
  if (r.dim && DIM_WORD[r.dim]) out.push('It was ' + DIM_WORD[r.dim][r.dir === 'under' ? 1 : 0] + ' for you.');
  const f = r.f || {};
  if (f.e != null) out.push(f.e < 25 ? 'You were running on empty.' : f.e < 50 ? 'You were low on energy.' : 'You had energy to spare.');
  if (r.dim === 'sound' || (r.dim === 'light' && r.dir !== 'under')) out.push(f.gear === 'none' ? 'You had no gear for it yet. Moss sells some.' : f.gear === 'own' ? 'Your gear was in your bag.' : 'You already had your gear on.');
  if (f.burn) out.push('You had woken up heavy that day.');
  if (r.k === 'barrier' && f.owner === '' && f.off >= 2) out.push('Nobody in charge was there to ask.');
  return out.slice(0, 4);
}
// one thing to set differently next time: each one helps with something and costs something
export const DEFAULTS = {
  headphones_market: { t: 'Headphones on at the market', sub: 'You start next visit wearing them in the square. People notice.' },
  leave_early: { t: 'Wake twenty minutes earlier', sub: 'More of the day before it fills up. A heavier start.' },
  rest_first: { t: 'Start the day at a bench that fits', sub: 'Half an hour that is yours, before anything else.' },
  text_first: { t: 'A door sign that says text first', sub: 'Fewer drop-ins. Bea\'s soup arrives by text.' },
  blend_off: { t: 'Start without Blend', sub: 'Its nudges are gone. So is the one thing it did that helped.' },
  as_is: { t: 'Keep things as they are', sub: 'Nothing changes. That is a choice too.' },
};
export function defaultOptions(S, moments) {
  const ids = [];
  const any = (fn) => moments.some(fn) || (S.log || []).some(fn);
  if (any((r) => r.z === 'market' && (r.dim === 'sound' || r.dim === 'people'))) ids.push('headphones_market');
  if (any((r) => r.dim === 'time' || (r.k === 'missed' && r.v === 'shift'))) ids.push('leave_early');
  if (any((r) => (r.f || {}).e < 35 || (r.f || {}).burn)) ids.push('rest_first');
  if (any((r) => r.z === 'homerow' && r.dim === 'people') || S.profile.people < 0.4) ids.push('text_first');
  if (S.blend.has) ids.push('blend_off');
  const pick = ids.slice(0, 4); if (pick.length < 2) for (const k of ['rest_first', 'leave_early']) if (!pick.includes(k)) pick.push(k);
  return pick.slice(0, 4).concat(['as_is']);
}

export async function whoDecided(story) {
  const G = story.G, S = story.S, ui = story.ui;
  const moments = pickMoments(S, (S.act || 1) === 1 ? 3 : 5);
  G.mode = 'cine'; G.busy++; ui.hud(false); ui.letterbox(true);
  await G.stage.fadeTo(1, 600);
  let skip = false;
  for (let i = 0; i < moments.length && !skip; i++) {
    const r = moments[i];
    // the place, from a fixed spot; you, standing where it happened
    if (r.z === 'works' || r.z === 'hall') { G.setLoc(r.z); G.place(G.rooms[r.z].spawn); const c = G.roomCam(r.z); G.stage.shot(c.pos, c.look, c.fov, 3, true); }
    else { if (G.loc !== 'town') G.setLoc('town'); const sp = STAND[r.z] || STAND.street; G.place(sp); const sh = SHOTS[r.z] || SHOTS.street; G.stage.shot(new THREE.Vector3(...sh[0]), new THREE.Vector3(...sh[1]), 36, 3, true); }
    await G.stage.fadeTo(0, 500);
    const pay = (r.pay || []).map((id) => ({ id, name: id === 'you' ? 'You' : CAST[id] ? CAST[id].name : id, img: id === 'you' ? G.portraitOf(S.look, { bg: '#efe6d6', w: 120, h: 120 }) : CAST[id] ? G.portraitOf(CAST[id].look, { bg: '#efe6d6', w: 120, h: 120 }) : '' }));
    const causes = Object.assign({}, CAUSES, (story.ret && story.ret.causes()) || {});
    const k = await ui.decidedCard({ n: i + 1, of: moments.length, faced: faced(S, r), also: r.k === 'default' ? BLEND_ALSO : causes[r.z] || CAUSES.street, verb: verbLine(r), pay, first: i === 0 });
    if (k === 'skip') skip = true;
    await G.stage.fadeTo(1, 400);
  }
  story.fieldNote('situation'); story.fieldNote('freewill'); story.fieldNote('readiness');
  // one thing to set differently next time
  const opts = defaultOptions(S, moments);
  if (G.loc !== 'town') G.setLoc('town');
  G.place([30, 34.5]); G.stage.shot(new THREE.Vector3(30, 9, 46), new THREE.Vector3(30, 2, 26), 40, 3, true);
  await G.stage.fadeTo(0, 500);
  const pick = await ui.defaultCard(opts.map((id) => Object.assign({ id }, DEFAULTS[id])));
  S.default = pick; story.log('default', { z: 'street', v: pick, by: 'you', pay: [] }); story.fieldNote('defaults');
  ui.letterbox(false); G.busy = Math.max(0, G.busy - 1);
  await G.stage.fadeTo(1, 500);
}
