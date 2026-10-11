// Act 3, Twenty years later: "Who decided? Sometimes you did."
// One festival day. Clover has retired and the Fix-It Shed is yours. The card turns around: a newcomer, Juno, brings
// you a card about one of your own fixes, and you are the one who pays. Scenes: the Shed key and the co-op question;
// Juno; the square, where Moss's lease is up and the Founders' Fund has an offer; the council asks the Shed's view on
// a quiet zone along your own street; the meeting at six; Who decided?; the festival.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST } from './content.js';
import { clamp, FAST } from './util.js';
import { TALK3, JUNO_CARD } from './talk23.js';
import { crossingState } from './layers.js';

const T = { shed: [52, 12.4], square: [30, 30], hall: [32, 14.2], farend: [46, 41.5], steps: [34.6, 15.6] };
const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});
const DIMS = ['sound', 'light', 'people', 'talk', 'time', 'change'];
// which of your fixes change which dials (what Juno is built against)
const FIX_DIM = { quiet: ['sound', 'people'], dim: ['light'], lanterns: ['people'], plain: ['talk'], board: ['change'], crossing: ['time'], counter: ['talk'] };

// Juno, built against your fixes: everywhere your fixes softened things, Juno wants it louder, brighter, busier and
// less blunt (the drums, the door that says KNOCK LOUD); on the other dials Juno is your opposite, and at least 0.35
// away wherever your fixes changed them. And a look that isn't yours.
const LIVELY = { sound: 0.85, light: 0.8, people: 0.85, talk: 0.8 };
export function junoProfile(S) {
  const P = S.profile; const out = {}; const changed = new Set();
  for (const f of Object.keys(FIX_DIM)) if (S.fixes[f] === 'built') for (const d of FIX_DIM[f]) changed.add(d);
  for (const d of DIMS) {
    if (LIVELY[d] != null) { out[d] = LIVELY[d]; continue; }
    const v = P[d]; let j = 1 - v;
    if (changed.has(d)) j = v < 0.5 ? Math.min(0.95, Math.max(j, v + 0.35)) : Math.max(0.05, Math.min(j, v - 0.35));
    out[d] = clamp(j, 0.05, 0.95);
  }
  return out;
}
function junoLook(S) {
  const shapes = ['round', 'spiky', 'tall', 'blobby', 'boxy']; const tops = ['ears', 'longears', 'horns', 'antennae', 'tuft'];
  const shape = shapes[(shapes.indexOf(S.look.shape) + 2) % shapes.length]; const top = tops[(tops.indexOf(S.look.top) + 3 + tops.length) % tops.length];
  const color = S.look.color === '#f2a99a' ? '#9edcd6' : '#f2a99a';
  return { shape, color, pattern: S.look.pattern === 'stripes' ? 'spots' : 'stripes', top, wear: 'flower', voice: 'whistle' };
}
// which of your fixes Juno brings: the built one that pinches Juno most (else the statue's benches, a default you kept)
function junoFix(S) {
  let best = null, bv = 0;
  for (const f of ['quiet', 'dim', 'lanterns', 'plain']) {
    if (S.fixes[f] !== 'built') continue; const C = JUNO_CARD[f];
    const L = SIM.levels(S, C.zone, 720, f === 'quiet' ? 'quietcorner' : null); const p = SIM.pinchOf(S.junoProfile, L, null, C.zone);
    const v = p.dims[C.dim] ? p.dims[C.dim].v : 0; if (v > bv) { bv = v; best = f; }
  }
  return best || 'bench';
}

// ---------- the Shed key, and the co-op ----------
async function arrival(R) {
  const G = R.G, S = R.S, st = R.st, ui = st.ui;
  G.mode = 'cine'; G.busy++;
  G.setLoc('town'); G.place([52, 13.4]); G.player.heading = Math.PI;
  G.stage.shot(new THREE.Vector3(52, 7, 21), new THREE.Vector3(52, 1.2, 11), 40, 3, true);
  G.audio.setScene('town');
  await G.stage.fadeTo(0, 900);
  await ui.caption('Twenty years later.', 2400);
  G.player.root.visible = true;
  await st.note('Festival day. The Fix-It Shed, at eight in the morning. Clover is waiting by the door with a key on a long piece of string.');
  G.talkFrame('clover'); ui.letterbox(true);
  await st.say('clover', 'There you are. It\'s yours now. Hinges are in the second drawer. The ledger is in the first. Don\'t read it at night.');
  await st.say('clover', 'I\'ll visit. I\'ll pretend I\'m not checking.');
  st.keep('shedkey', 'The key to the Fix-It Shed', '#cde38f');
  await st.say('gil', 'Retired, and here anyway. Fridays I\'m yours. Today\'s a Friday. I checked twice.');
  await st.run(TALK3.rue, { npc: 'rue' }); S.talked.rue = true;
  await st.say('ines', 'Ines. Best fixer you\'ve got, Wren says. We have a question before you open up.');
  await st.say('gil', 'We want the Shed to be a co-op. Everyone who works here votes. Pay evens out.');
  const k = await st.choose([
    { t: 'Yes: make it a co-op', sub: 'everyone votes, pay evens out, decisions take longer; Ines leaves for better pay in the city', id: 'coop_yes' },
    { t: 'No: keep it as it is', sub: 'decisions stay quick, and you can pay Ines what the city offers; Gil and Rue stay volunteers without a vote', id: 'coop_no' },
  ], { text: 'The Shed as a co-op?', kind: 'note' });
  if (k === 0) { S.w.coop_yes = 1; await st.say('ines', 'Then I\'ll take the job in the city. I\'ll miss this. I need the city\'s pay more.'); await st.say('rue', 'Our first vote, then. Who wants tea? That\'s a joke. Mostly.'); if (G.town.coopSign) { G.town.coopSign.visible = true; G.town.shedSign.visible = false; } st.log('choice', { z: 'commons', v: 'coop', by: 'you', pay: ['ines'] }); }
  else { await st.say('gil', 'Fair enough. You know where the kettle is.'); await st.say('ines', 'And I know where the hinges are. I\'ll stay.'); st.log('choice', { z: 'commons', v: 'nocoop', by: 'you', pay: ['gil', 'rue'] }); }
  st.fieldNote('coops');
  ui.hideDialog(); ui.letterbox(false); G.endTalk();
  await R.st.changeAnything();
  S.min = Math.max(S.min, S.carryDefault === 'leave_early' ? 485 : 505);
  const carried = S.carryDefault && S.carryDefault !== 'as_is' ? 'You set this last time: ' + R.st.defaultText(S.carryDefault) + '.' : '';
  await ui.today({ day: 'Twenty years on', title: 'Festival day', items: [{ t: 'Open the Shed', sub: 'You keep it now. Somebody always brings something.' }, { t: 'The council wants the Shed\'s view on a proposal, by six', sub: 'Hollis will come and find you.' }, { t: 'Town meeting, 6 PM', sub: 'Two items at most. They go up tonight.' }, { t: 'The Lantern Festival, 8 PM', sub: 'Market Square.' }], note: 'Sometimes you\'re the one who decides.', carried });
  R.st.applyDefault();
  G.busy = Math.max(0, G.busy - 1);
  await juno(R);
  G.stage.follow(G.player.root.position, G.followOpts({ snap: true }));
  G.mode = 'play'; ui.hud(true);
}

// benches at three heights round the statue: 'low' adds a low one; 'three' adds a low one and a higher one with arms
function showBenches(R, which) {
  const S = R.S; if (S.w.benches3 === 'three') return; S.w.benches3 = which === 'three' ? 'three' : 'low';
  if (R.G.town.showBenches) R.G.town.showBenches(S.w.benches3);
}

// ---------- Juno, and the card turned around ----------
async function juno(R) {
  const G = R.G, S = R.S, st = R.st, ui = st.ui;
  const f = S.junoFix; const C = JUNO_CARD[f];
  G.npcTo('juno', [51.2, 13.6], 'town', [55.4, 16.6]); await R.beat(1400);
  await st.note('Your first visitor. Somebody new, with a very specific face on.');
  G.talkFrame('juno'); ui.letterbox(true);
  await st.say('juno', 'Hi. Juno. New in town. Is this where you bring things that pinch?');
  await st.say('juno', C.says);
  ui.hideDialog(); ui.letterbox(false); G.endTalk();
  const me = G.portraitOf(S.look, { bg: '#efe6d6', w: 120, h: 120 }); const jf = G.portraitOf(CAST.juno.look, { bg: '#efe6d6', w: 160, h: 160 });
  // your bag only helps with noise: headphones let Juno drum along to something, and nobody else hears it
  const gear = f === 'quiet' && S.gear.headphones ? 'headphones' : null;
  const options = [
    { key: 'bend', who: 'Juno', label: 'Ask Juno to push through', sub: 'Nothing changes for you. Juno carries it, quietly.' },
    gear ? { key: 'gear', who: 'Your gear', label: 'Lend Juno your headphones', sub: 'Juno drums along in your headphones. You go without.' } : { key: 'gear', who: 'Your gear', label: 'Lend your gear', disabled: true, reason: S.gear.headphones || S.gear.shades ? 'nothing in your bag helps with this one' : 'you have nothing to lend today' },
    { key: 'ask', who: 'You', img: me, tag: C.tag || 'you own this fix now', label: C.askLabel || 'Change your own rule', sub: C.rule + '. ' + (C.ruleSub ? C.ruleSub + '.' : 'It costs you a little of the place you made.') },
    { key: 'fix', who: 'The place', label: 'Redesign it with Juno', sub: C.redesign + '. An hour of your day. ' + C.fixCost + '.' },
    { key: 'leave', who: 'Nobody', label: 'Do nothing', sub: 'Juno goes. Larkspur stays as you left it.' },
  ];
  const choice = await ui.barrier({ options, title: 'Twenty years on', text: 'Juno has a card, and it is about you.', face: { img: jf, name: 'Juno', sub: 'Goodwill with you ○○○' }, gut: 'Twenty years ago you stood where Juno is standing.', notice: '', noticeLabel: '', coach: '' });
  ui.hideBarrier(); S.junoV = choice;
  const row = { z: 'commons', turn: 1, why: f === 'bench' ? 'The benches were the Standard\'s height. Juno\'s feet didn\'t reach the ground.' : 'Your fix was made to fit you. It didn\'t fit Juno.' };
  G.talkFrame('juno'); ui.letterbox(true);
  if (choice === 'bend') { S.junoAnswer = 'I asked Juno to push through.'; st.log('barrier', Object.assign({ v: 'bend', by: 'you', pay: ['juno'] }, row)); await st.say('juno', 'Okay. I\'ll manage. I usually do.'); S.junoDim = 1; }
  else if (choice === 'gear') { S.junoAnswer = 'I lent Juno my ' + gear + '.'; S.gear[gear] = false; S.wearing[gear] = false; G.player.setGear(gear, false); S.lentGear = gear; st.log('barrier', Object.assign({ v: 'gear', by: 'you', pay: ['you'] }, row)); await st.say('juno', 'Really? Thank you. I\'ll bring them back tomorrow. I\'ll probably bring them back tomorrow.'); st.keep('juno_gear', 'Your headphones, on loan to Juno', CAST.juno.look.color); }
  else if (choice === 'ask') {
    if (f === 'bench') { S.junoAnswer = 'I put in a lower bench for Juno.'; showBenches(R, 'low'); }
    else {
      // your rule bends toward Juno: that place moves a little away from what you set it to (and adds to any change)
      S.junoAnswer = 'I changed my own rule for Juno.'; const m = S.mods[C.zone] = Object.assign({}, S.mods[C.zone] || {});
      const toward = (S.junoProfile[C.dim] || 0.5) >= (S.profile[C.dim] || 0.5) ? 1 : -1; m[C.dim] = (m[C.dim] || 0) + toward * (C.dim === 'people' || C.dim === 'talk' ? 0.2 : 0.25);
    }
    st.log('barrier', Object.assign({ v: 'ask', by: 'you', pay: ['you'], verb: f === 'bench' ? 'Juno asked you. You put in a lower bench.' : '' }, row)); await st.say('juno', f === 'bench' ? 'A lower bench? For me? Huh. Thank you.' : 'You\'d change your own rule? For me? Huh. Thank you.'); st.addBond('juno', 1);
    st.keep('juno_ask', f === 'bench' ? 'A lower bench, for Juno' : 'A rule you changed for Juno', CAST.juno.look.color);
  }
  else if (choice === 'fix') {
    S.junoAnswer = 'I redesigned it with Juno.'; S.w.juno_redesign = 1; G.advance(60); st.log('barrier', Object.assign({ v: 'fix', by: 'you', pay: f === 'quiet' ? ['you', 'bao'] : ['you'] }, row));
    await st.note('You sketch it together on Clover\'s graph paper. Juno draws faster than you. Juno also draws a drum on it.');
    if (f === 'bench') { showBenches(R, 'three'); S.flags.shedRoofWaits = 1; await st.note('Within the hour, Gil and ' + (S.w.coop_yes ? 'Rue' : 'Ines') + ' have two new benches round the statue: a low one, and a higher one with arms. The old ones stay.'); }
    await st.say('juno', f === 'bench' ? 'Three heights. The Standard\'s, mine, and a high one. I didn\'t know you could do all three.' : 'Both, then. Your way and mine. I didn\'t know you could do both.'); st.addBond('juno', 1); st.keep('juno', 'A redesign, with Juno', CAST.juno.look.color);
  }
  else { S.junoAnswer = 'I did nothing, and Juno went.'; S.junoLeft = 1; st.log('barrier', Object.assign({ v: 'leave', by: 'you', pay: ['juno'] }, row)); await st.say('juno', 'Right. Okay. I\'ll find somewhere.'); }
  st.fieldNote('mismatch');
  ui.hideDialog(); ui.letterbox(false); G.endTalk(); G.npcTo('juno', null);
  S.flags.juno3 = 1;
  st.saveNow('shift', S.day);
}

// ---------- the square: Moss's lease, and the Founders' Fund ----------
async function square(R) {
  const G = R.G, S = R.S, st = R.st, ui = st.ui; S.flags.square3 = 1;
  await st.note('The leases board by the square: STALL LEASES, TO THE HIGHEST BID. WAITING LIST: 14.');
  await st.note(S.fixes.quiet === 'built' || S.fixes.board === 'built' ? 'The square got popular: your fixes brought people, and the van hub brought more. The council leases the stalls, and the leases go to the highest bid now.' : 'The square got popular anyway: the van hub brings people through all day. The council leases the stalls, and the leases go to the highest bid now.');
  G.talkFrame('moss'); ui.letterbox(true);
  await st.say('moss', 'Popular square now. Popular costs. My lease is up at the end of the month.');
  ui.hideDialog(); ui.letterbox(false); G.endTalk();
  // Hester, of the Founders' Fund: one role, one sincere reason, and the strings on the front of the offer
  G.npcTo('hester', null); G.talkFrame('hester'); ui.letterbox(true);
  await st.say('hester', 'Hester. The Founders\' Fund. You keep the Shed now, I hear.');
  await st.say('hester', 'I grew up hearing the founders were heroes. I\'d like the name to mean something good.');
  // what the Fund offers besides the Shed's roof: Bea's crossing if it is still short, else the benches, if they aren't built
  const gift = S.fixes.crossing !== 'built' ? 'crossing' : S.w.benches3 !== 'three' ? 'benches' : null;
  const what = { crossing: 'for Bea\'s crossing to be lengthened', benches: 'for benches at three heights round the statue' }[gift];
  await st.say('hester', 'The Fund would like to pay for the Shed\'s repairs' + (what ? ', and ' + what : '') + '. The council says it\'s the Shed\'s call.');
  const k = await st.choose([
    { t: 'Accept the Fund\'s offer', sub: 'strings: anything on Founders\' Row needs the Fund\'s sign-off, and its name goes on the plinth. The council audits every gift.' + (gift === 'crossing' ? ((S.stakes || {}).crossing === 'listened' ? ' The van waits whenever someone holds the button.' : ' The van runs late at every long crossing.') : ''), id: 'fund_yes' },
    { t: 'Decline, with thanks', sub: 'the Shed\'s repairs wait a year' + (gift === 'crossing' ? ', and so does Bea\'s crossing' : gift === 'benches' ? ', and so do the benches' : ''), id: 'fund_no' },
  ], { text: 'The Founders\' Fund\'s offer, with its strings.', kind: 'note' });
  if (k === 0) {
    S.w.benefactor_yes = 1; if (G.town.fundPlate) G.town.fundPlate.visible = true;
    await st.say('hester', 'Thank you. The council will see the accounts. All of them.'); st.log('choice', { z: 'market', v: 'fund_yes', by: 'you', pay: [] });
    // the Fund's own crews build it: it doesn't use one of the season's two fixes
    if (gift === 'crossing') { S.fixes.crossing = 'built'; S.fixAct.crossing = 3; S.fixVia = S.fixVia || {}; S.fixVia.crossing = 'fund'; S.flags.fundGift = 'crossing'; G.applyFix('crossing'); await st.note(crossingState(S) === 'hold' ? 'Within the hour, the crossing has a new button: HOLD FOR MORE TIME.' : 'Within the hour, the crossing light waits for anyone still in the street.'); }
    else if (gift === 'benches') { const had = S.w.benches3 === 'low'; S.flags.fundGift = 'benches'; showBenches(R, 'three'); await st.note(had ? 'Within the hour, a higher bench with arms joins the low one by the statue. The old ones stay.' : 'Within the hour, there are two new benches round the statue: a low one, and a higher one with arms. The old ones stay.'); }
  } else { await st.say('hester', 'That\'s fair. The offer stands, if you change your mind next year.'); st.log('choice', { z: 'market', v: 'fund_no', by: 'you', pay: gift === 'crossing' ? ['you', 'bea'] : ['you'] }); }
  st.fieldNote('wealth'); st.fieldNote('audits');
  // Moss: four ways, each costing someone
  await st.say('moss', 'So. What does the keeper of the Shed think I should do?');
  const m = await st.choose([
    { t: 'Ask the council to cap rents for long-time stallholders', sub: 'a proposal for tonight; the waiting list pays', id: 'moss_cap' },
    { t: 'Open stalls at the Far End, through the Shed', sub: 'a proposal for tonight; the Far End\'s quiet pays' + (S.w.benefactor_yes ? '. It\'s on Founders\' Row.' : ''), id: 'moss_far' },
    { t: 'Help Moss move to the Far End today', sub: 'an hour of your day; Moss gives up her corner', id: 'moss_move' },
    { t: 'Nothing', sub: 'Moss bids like everyone else', id: 'moss_none' },
  ], { text: 'Moss\'s lease.', kind: 'note' });
  if (m === 0) { R.propose('rentcap', 'moss'); await st.say('moss', 'A cap. For the long-timers. I\'ll take it, if they will.'); }
  else if (m === 1) { R.propose('farstalls', 'moss'); await st.say('moss', 'The Far End? It\'s quiet there. I\'d like a bit of quiet.'); }
  else if (m === 2) {
    S.w.moss_moved = 1; G.advance(60); await G.stage.fadeTo(1, 500);
    if (G.town.farCart) G.town.farCart.visible = true; if (G.town.toLet) G.town.toLet.visible = true;
    await st.note('An hour of boxes, teacups and a very heavy kettle. By noon, Moss has a little cart at the Far End, under Wren\'s lanterns.');
    await G.stage.fadeTo(0, 500); await st.say('moss', 'Quieter out here. I\'ll miss the shouting. I won\'t tell anyone that.');
    st.log('choice', { z: 'market', v: 'moved', by: 'you', pay: ['you', 'moss'] }); st.keep('moss_moved', 'You helped Moss move', CAST.moss.look.color);
  } else { await st.say('moss', 'I\'ll bid like everyone else. I\'ve haggled on this square since before it had bunting.'); st.log('choice', { z: 'market', v: 'mossbid', by: 'you', pay: ['moss'] }); }
  st.fieldNote('money'); st.fieldNote('experiences');
  ui.hideDialog(); ui.letterbox(false); G.endTalk(); G.npcTo('hester', null);
}

// ---------- your street, and the Shed's view ----------
async function conflict(R) {
  const G = R.G, S = R.S, st = R.st, ui = st.ui; S.flags.conflict3 = 1;
  G.talkFrame('hollis'); ui.letterbox(true);
  await st.say('hollis', 'A word, keeper of the Shed. The council asks the Shed\'s view on a proposal: extend the quiet zone the length of Home Row.');
  await st.note('Home Row is your street. A quiet zone would make your house quieter, and worth more. It would also hush Juno\'s shortcut to the square: no speaker, no bike.');
  await st.note('Larkspur\'s rule, on the council notice: if you have a stake, say so. Then you may still judge.');
  const k = await st.choose([
    { t: 'Say you live there, then back it', sub: 'the rule followed; Juno loses the shortcut; one of this year\'s two fixes', id: 'cf_disclose' },
    { t: 'Step back and let Gil judge it', sub: 'he\'s careful, and slow: next season', id: 'cf_recuse' },
    { t: 'Back it, and don\'t mention your house', sub: 'quick, and nobody asks; Juno loses the shortcut; one of this year\'s two fixes', id: 'cf_quiet' },
    { t: 'Recommend against it', sub: 'Home Row stays as it is, loud on festival nights', id: 'cf_decline' },
  ], { text: 'The Shed\'s view.', kind: 'note' });
  const row = { z: 'homerow', dim: 'sound', dir: 'over' };
  if (k === 0) { S.w.conflict_disclosed = 1; S.quietrowView = 'for'; await st.say('you', 'I live on Home Row. I\'d gain from this. With that said: I\'m for it.'); await st.say('hollis', 'Thank you for saying so. Honestly, it makes me trust your view more.'); st.log('choice', { z: 'homerow', v: 'disclosed', by: 'you', pay: ['juno'] }); st.fieldNote('disclosure'); }
  else if (k === 1) { S.quietrowView = 'recused'; await st.say('gil', 'I\'ll walk it twice and sleep on it. Next season.'); st.log('choice', { z: 'homerow', v: 'recused', by: 'gil', pay: ['you'] }); }
  else if (k === 2) { S.quietrowView = 'for'; S.quietrowQuiet = 1; await st.say('you', 'The Shed is for it.'); await st.say('hollis', 'Splendid. The Shed has spoken.'); st.log('choice', { z: 'homerow', v: 'quietly', by: 'you', pay: ['juno'] }); }
  else { S.quietrowView = 'against'; await st.say('you', 'The Shed recommends against it.'); await st.say('hollis', 'Against. Noted. Your street, too. Hm.'); st.log('choice', { z: 'homerow', v: 'against', by: 'you', pay: ['you'] }); }
  ui.hideDialog(); ui.letterbox(false); G.endTalk();
}

export const ACT3 = {
  looks: { bea: { wear: 'scarf' }, moss: { wear: 'glasses' }, clover: { wear: 'scarf' }, gil: { wear: 'hat' }, rue: { wear: 'flower' }, hollis: { wear: 'glasses' }, pip: { wear: 'scarf' }, wren: { wear: 'glasses' } },
  festival: { bea: [26.2, 28.6], wren: [33.6, 28.8], rue: [35.6, 26.2], gil: [24.8, 25.2], moss: [25.4, 29.4], hollis: [30, 28.2], pip: [34.6, 21.8], clover: [27.0, 21.4], juno: [32.4, 30.6], hester: [28.0, 21.2], bao: [25.4, 22.6], ines: [34.6, 29.6] },
  resumeAt: { shift: [52, 13.4], meeting: [32, 14.4] }, resumeLine: { shift: 'The Shed is open.', meeting: 'The meeting is over. The festival is at eight.' },
  causes: {
    commons: ['The Shed decides what gets fixed now. That\'s you.', 'Clover kept the ledger. You keep it now.'],
    market: ['The council leases the stalls to the highest bid.', 'Foot traffic brought a waiting list.'],
    homerow: ['The quiet zone stops where the council says it stops.', 'Your house is on Home Row.'],
  },
  // at the meeting, Rue sits where Clover did
  bystander: { hollis: { over: { light: ['rue', 'Now I can\'t see my notes. Fine. I know them by heart.'], sound: ['rue', 'I liked the murmur. It meant people came.'], other: ['rue', 'Bit nippy. I\'ll keep my coat on.'] }, under: { other: ['rue', 'Bit nippy. I\'ll keep my coat on.'] } } },
  blendArg: { who: 'hollis', t: 'But the Smooth Scores still say we\'re coping beautifully!' },
  rueSpeaks: { sum: 'Rue tells the hall what the measures never asked.', lines: ['Can I say something? I ran those measures, once.', 'They counted whether we looked all right. They never asked whether we were.'] },
  setup(R) {
    const S = R.S, G = R.G;
    S.junoProfile = junoProfile(S); CAST.juno.profile = S.junoProfile; const look = junoLook(S); CAST.juno.look = look;
    if (G.npcs.juno) G.npcs.juno.c.setLook(look);
    S.junoFix = S.junoFix || junoFix(S);
    // "your fix" (a sight): wherever the fix Juno brings stands
    const AT = { quiet: [[23.5, 2.6, 31.2], [23.5, 30.2]], dim: [[12, 2.6, 12.6], [12.6, 13.8]], lanterns: [[8.5, 1.8, 36.5], [9.6, 37.8]], plain: [[8.2, 1.9, 12.2], [8.8, 13.3]], bench: [[26.5, 1.3, 31.0], [26.5, 32.0]] }[S.junoFix];
    // the benches were never your fix: the sight says whose height they are, and the stand-in is the Standard
    const extra = S.junoFix === 'bench' ? { name: 'The benches', line: 'The Standard\'s height. Juno\'s feet don\'t touch the ground.', ghostYou: false } : null;
    if (AT && G.look) G.look.relocate('myfix', 'town', AT[0], AT[1], extra);
    if (S.w.moss_moved && G.town.farCart) { G.town.farCart.visible = true; if (G.town.toLet) G.town.toLet.visible = true; }
    if (S.w.coop_yes && G.town.coopSign) { G.town.coopSign.visible = true; G.town.shedSign.visible = false; }
  },
  async arrival(R) { await arrival(R); },
  tick(R) {
    const G = R.G, S = R.S, st = R.st, m = S.min;
    // the square, once Moss and Hester are both there
    if (!S.flags.square3 && m >= 670 && m < 1020 && G.loc === 'town' && G.zone === 'market' && G.npcs.hester.place === 'town' && G.npcNear('moss', 'market')) { G.run(() => square(R)); return true; }
    // Hollis comes to find you about Home Row
    if (!S.flags.conflict3 && m >= 870 && m < 1060 && G.loc === 'town' && G.npcs.hollis.place === 'town') {
      const p = G.player.root.position; const n = G.npcs.hollis; n.c.root.position.set(p.x + 1.6, 0, p.z + 0.8); n.override = [p.x + 1.6, p.z + 0.8];
      st.ui.bubble('hollis', 'A word, about Home Row?', { tint: CAST.hollis.tint, ms: 2400 });
      G.run(async () => { await conflict(R); n.override = null; }); return true;
    }
    // Juno at the Far End, alone and fine, if you sent Juno away
    if (S.junoLeft && !S.flags.junoSeen && G.zone === 'farend' && G.npcNear('juno', 'farend')) { S.flags.junoSeen = 1; st.ui.bubble('juno', 'Found a spot. It\'s quiet. I\'ve got my drum. It\'s fine.', { tint: CAST.juno.tint, ms: 5200 }); st.fieldNote('solitude'); }
    return false;
  },
  npcWant(R, id) {
    const S = R.S;
    if (id === 'juno') { if (!S.flags.juno3) return { place: 'away' }; const T2 = R.G.town.spots; return { place: 'town', pos: S.junoLeft ? T2.junoFar : S.flags.festival ? ACT3.festival.juno : T2.junoSquare }; }
    if (id === 'moss' && S.w.moss_moved && !S.flags.festival) return { place: 'town', pos: R.G.town.spots.cartFar };
    return null;
  },
  async handle(R, t) {
    const G = R.G, S = R.S, st = R.st, id = t.id;
    if (id === 'shed') { await st.note(S.w.coop_yes ? 'The Shed, a co-op now. On the board, in Rue\'s handwriting: WHO, WHAT, BY WHEN. Underneath, in Gil\'s: AND TEA.' : 'Your Shed. The hinges are in the second drawer. The ledger is in the first.'); st.ui.hideDialog(); return true; }
    if (id === 'rentboard') { await st.note('STALL LEASES, TO THE HIGHEST BID. WAITING LIST: 14. Someone has written, very small: the highest bid was never Moss.'); st.ui.hideDialog(); return true; }
    if (id === 'foundersrow') { await st.note('FOUNDERS\' ROW. The lane to the Far End has a name now, and the name is on a sign.'); st.ui.hideDialog(); return true; }
    if (id === 'works' || id === 'dock') { await st.note('The Works is closed for the festival. A note on the door, in plain language: CLOSED TODAY. OPEN MONDAY, 9.'); st.ui.hideDialog(); return true; }
    if (id === 'hall') { await G.enterRoom('hall'); await st.note(S.min >= 1020 && !S.flags.councilDone ? 'People are filing in for the meeting. It starts at six.' : 'The chamber is quiet. The kiosk by the door says SPEAK OR TAP.'); st.ui.hideDialog(); return true; }
    if (id === 'hallkiosk') { await st.note('SPEAK OR TAP. It hears more voices than it did. Not all of them.'); st.ui.hideDialog(); return true; }
    if (id === 'schoolphoto') { await st.note('This year\'s school photo. Nine children, and a teacher who looks delighted with every one of them.'); st.ui.hideDialog(); return true; }
    if (id === 'statue' && !S.flags.festival) { await st.note(S.w.benefactor_yes ? 'THE STANDARD RESIDENT. Under it, a new plate: WITH THANKS TO THE FOUNDERS\' FUND. The statue hasn\'t changed.' : 'THE STANDARD RESIDENT. Twenty years. Same statue. Older pigeons.'); st.ui.hideDialog(); return true; }
    if (id === 'crossing') { await st.note({ hold: 'HOLD FOR MORE TIME, says the button. Bea holds it like a handshake.', waits: 'WAITS FOR EVERYONE, says the button. Bea crosses at her own pace, and the light lets her.', push: 'The light still gives you exactly the Standard\'s stride.' }[crossingState(S)]); st.ui.hideDialog(); return true; }
    if (id === 'board') { await st.note(S.fixes.board === 'built' ? 'The board: VAN EVERY 20 MIN. APP, OR THE KIOSK. Someone has added, in pen: OR ASK BEA.' : 'Route 12 is a van now. Over the old timetable, a faded pink sticker: BOOK ON THE APP.'); st.ui.hideDialog(); return true; }
    return false;
  },
  talk(R, id) {
    const S = R.S;
    if (id === 'rue' && S.talked.rue) return [{ who: 'rue', t: 'Somebody has to ask who it costs. Today it\'s me. Tonight it\'s you.' }];
    return TALK3[id] || [{ who: id, t: 'Festival day!' }];
  },
  objective(R) {
    const S = R.S, m = S.min, G = R.G;
    if (S.flags.festival) return S.flags.released ? ob('') : ob('Enjoy the festival. When you are ready, release your lantern at the statue.', [30, 26.6], 'The statue');
    if (S.flags.councilDone) return ob('The festival starts at 8, in the square.', T.square, 'Market Square');
    if (m >= 1020) return ob('Town meeting at 6 PM, Town Hall.', T.hall, 'Town Hall', { inside: 'hall' });
    if (!S.flags.square3 && m >= 660) return ob('Moss\'s lease is up. She\'s at her cart in the square.', T.square, 'Market Square');
    const nb = R.st.needBackers(); if (nb.length) { const near = R.st.nearestOf([...new Set(nb.map((x) => x[1]))]); if (near) { const f = nb.find((x) => x[1] === near.id)[0]; return ob('Ask ' + CAST[near.id].name + ' to back the ' + SIM.FIXES[f].short + '. The meeting is at 6.', near.at, CAST[near.id].name); } }
    if (!S.flags.conflict3) return ob(m < 870 ? 'Look around. Hollis wants the Shed\'s view this afternoon.' : 'Hollis is looking for you.');
    return ob('Twenty years on. The meeting is at 6.');
  },
  goals(R) {
    const S = R.S;
    return [{ t: 'Open the Shed', done: !!S.flags.juno3 }, { t: 'Moss\'s lease', done: !!S.flags.square3 }, { t: 'The Shed\'s view on Home Row', done: !!S.flags.conflict3 }, { t: 'Town meeting, 6 PM', done: !!S.flags.councilDone }, { t: 'The Lantern Festival, 8 PM', done: !!S.flags.released }];
  },
  // the meeting's first item: the Shed's view on the quiet zone along Home Row (your view decides it)
  async council(R, o = {}) {
    const S = R.S, st = R.st, G = R.G;
    if (o.away) {
      if (!S.flags.conflict3 || S.quietrowView !== 'for') return { passed: [], tabled: S.flags.conflict3 && S.quietrowView === 'against' ? ['quietrow'] : [] };
      S.fixes.quietrow = 'built'; S.fixAct.quietrow = 3; S.fixVia = S.fixVia || {}; S.fixVia.quietrow = 'meeting'; G.applyFix('quietrow');
      st.log('vote', { z: 'homerow', v: 'passed', by: S.quietrowQuiet ? 'you' : 'meeting', pay: ['juno'], verb: 'The quiet zone along Home Row went through, on the Shed\'s view, with you out of the room.' });
      return { passed: ['quietrow'], tabled: [], by: 'hollis' };
    }
    if (!S.flags.conflict3) { await st.say('hollis', 'The Shed sent no view on Home Row. Next season, then.'); return; }
    await st.say('hollis', 'And the council\'s own item: the quiet zone along Home Row. The Shed\'s view?');
    const v = S.quietrowView;
    if (v === 'for') {
      await st.say('you', S.w.conflict_disclosed ? 'For it. And, again, I live there.' : 'The Shed is for it.');
      await st.say('hollis', 'On the Shed\'s view: carried. It takes effect tonight.');
      S.fixes.quietrow = 'built'; S.fixAct.quietrow = 3; S.fixVia = S.fixVia || {}; S.fixVia.quietrow = 'meeting'; G.applyFix('quietrow');
      st.log('vote', { z: 'homerow', v: 'passed', by: S.quietrowQuiet ? 'you' : 'meeting', pay: ['juno'], verb: 'The quiet zone along Home Row went through, on the Shed\'s view.' });
      if (G.npcs.juno && G.npcs.juno.place !== 'away') st.ui.bubble('juno', 'Okay. I\'ll go the long way. With the speaker.', { tint: CAST.juno.tint, ms: 4200 });
    } else if (v === 'recused') { await st.say('hollis', 'Gil has walked it once. He\'d like to walk it twice. Next season, then.'); st.log('vote', { z: 'homerow', v: 'failed', by: 'gil', pay: ['you'], verb: 'You stepped back. Gil will judge Home Row next season.' }); }
    else { await st.say('you', 'The Shed recommends against it.'); await st.say('hollis', 'Not carried. Home Row stays as it is.'); st.log('vote', { z: 'homerow', v: 'failed', by: 'you', pay: ['you'], verb: 'On the Shed\'s view, Home Row stays as it is.' }); }
  },
  applyFix(R, f) {
    const T2 = R.G.town;
    if (f === 'farstalls' && T2.farStalls) T2.farStalls.visible = true;
    if (f === 'crossing' && T2.setCrossing) T2.setCrossing(crossingState(R.S));
  },
  festivalLine(R, id) {
    const S = R.S;
    const L = {
      bea: 'Soup for three hundred, and the ladle never left my hand. Next year I\'m after the bunting.',
      pip: S.w.rye_bought ? 'The rye is back. You asked for one when nobody hearted it. I thought about that.' : 'Twenty years of buns. I hid a rye under the counter, for old times\' sake.',
      moss: S.w.moss_moved ? 'Quieter out at the Far End. Come for tea. Bring nobody.' : 'Still on the corner. Still pouring. Nobody outbid me tonight.',
      rue: S.rue === 'easing' ? 'I drew the festival. Badly. On purpose.' : 'No streak, no score, no app. Just me and a lot of lanterns.',
      wren: 'One hundred and twelve. I counted twice. Ines would have counted three times.',
      gil: 'Retired! I volunteer. It\'s like working, with more tea and fewer panels.',
      hollis: 'Still mayor. Next year, perhaps, a statue of a committee.',
      clover: 'Look at it. Every one of those fixes was somebody\'s idea.' + (Object.values(S.fixes).some((v) => v === 'built') ? ' Some of them were yours.' : ' Next year, one could be yours.'),
      juno: S.junoLeft ? null : S.w.juno_redesign ? (S.junoFix === 'bench' ? 'Three heights! The Standard\'s, mine, and one for tall people. See you next Friday. Loudly.' : 'Both ways! My way and yours. See you next Friday. Loudly.') : S.lentGear ? 'Your ' + S.lentGear + ' are great. I\'ll give them back. Tomorrow.' : S.junoDim ? 'I managed. I always manage.' : S.junoV === 'ask' ? (S.junoFix === 'bench' ? 'My feet touch the ground now. On one bench, anyway.' : 'You changed your own rule. For me. Huh.') : null,
      hester: S.w.benefactor_yes ? 'The name means a little more tonight, I hope. The accounts are on the notice board.' : S.flags.square3 ? 'Next year, maybe. The offer stands.' : 'I come every year for the lanterns. It\'s the one night the name isn\'t the point.',
      bao: S.fixes.rentcap === 'built' ? ((S.stakes || {}).rentcap === 'listened' ? 'Half the stalls that come free go to the list now. Fourteenth feels shorter already.' : 'Capped stalls never come free. Fourteenth it is. The dumplings are still good.') : 'Fourteenth on the list, first with the dumplings.',
      ines: S.w.coop_yes ? 'I start in the city on Monday. It pays better. It doesn\'t have this.' : 'Best fixer in Larkspur, tonight off duty.',
    }[id];
    return L ? { who: id, t: L } : null;
  },
  async festivalExtras(R) {
    const S = R.S, st = R.st;
    if (S.junoLeft) await st.ui.caption('Far off at the Far End, someone is playing a drum, alone.', 3200);
  },
  remember(R) {
    const S = R.S, out = [];
    out.push(S.w.coop_yes ? 'The Shed is a co-op. Everyone votes. Ines works in the city.' : 'The Shed is yours. Ines stayed. Gil and Rue help without a vote.');
    const bench = S.junoFix === 'bench';
    const jv = { bend: 'you asked Juno to push through', gear: 'you lent Juno your ' + (S.lentGear || 'gear'), ask: bench ? 'you put in a lower bench' : 'you changed your own rule', fix: bench ? 'the two of you redesigned the benches together' : 'the two of you redesigned your fix together', leave: 'you did nothing, and Juno went' }[S.junoV];
    if (jv) out.push('When Juno came to you, ' + jv + '.');
    if (S.w.benefactor_yes) out.push('The Founders\' Fund paid for the Shed\'s repairs' + ({ crossing: ', and for Bea\'s longer crossing', benches: ', and for benches at three heights' }[S.flags.fundGift] || '') + '. Its name is on the plinth.');
    else if (S.flags.square3) out.push('You turned down the Founders\' Fund. The Shed\'s roof waits a year.');
    else if (S.flags.shedRoofWaits) out.push('The benches came out of the Shed\'s budget. The roof waits a year.');
    out.push(S.w.moss_moved ? 'Moss pours tea at the Far End now.' : S.fixes.rentcap === 'built' ? 'Moss keeps her corner, at last year\'s rent.' : 'Moss is bidding for her corner.');
    if (S.fixes.quietrow === 'built') out.push(S.w.conflict_disclosed ? 'Home Row is a quiet zone. You said you lived there.' : 'Home Row is a quiet zone. You didn\'t say you lived there.');
    return out;
  },
  sights: [
    { id: 'myfix', name: 'Your fix', loc: 'town', at: [23.5, 2.6, 31.2], ghost: [23.5, 30.4], ghostYou: true, dial: null, place: 'town', line: 'Made to fit you. It doesn\'t fit Juno.' },
    { id: 'foundersrow', name: 'Founders\' Row', loc: 'town', at: [44.6, 2.4, 39.05], ghost: null, dial: null, place: 'the Far End', line: 'The founders\' name on a lot.' },
    { id: 'rentboard', name: 'The leases board', loc: 'town', at: [34.0, 1.6, 27.45], ghost: [34.0, 28.4], dial: null, place: 'the square', line: 'Made for whoever bids highest. Fourteen names are waiting for a turn.' },
    { id: 'coopsign', name: 'The Shed\'s sign', loc: 'town', at: [52, 2.4, 9.95], ghost: null, dial: null, place: 'the Commons', line: 'A sign that says who decides here.' },
    { id: 'plinth', name: 'The plinth', loc: 'town', at: [30, 0.6, 25.34], ghost: null, dial: null, place: 'the square', line: 'A new plate. The statue didn\'t change.', if: (S) => !!(S.w || {}).benefactor_yes },
    { id: 'crossing3', name: 'The crossing', loc: 'town', at: [45.5, 2.6, 22.0], ghost: [46.6, 24.0], dial: null, place: 'the bus stop', line: 'Twenty years on, still the first thing Bea checks.' },
    { id: 'junosign', name: 'Juno\'s door', loc: 'town', at: [16.0, 2.35, 35.54], ghost: null, dial: null, place: 'Home Row', line: 'Made for someone who likes visitors. Juno does.' },
    { id: 'statue3', name: 'The statue', loc: 'town', at: [30, 4.2, 24], ghost: null, dial: null, place: 'the square', line: 'Twenty years. Same statue. Older pigeons.' },
  ],
};
