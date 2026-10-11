// Act 2, Ten years later: "The Standard finally moved in."
// One festival day. You come back by van. The fixes you won are ten years old and in use; the town has machines now,
// and the turn is that there is often nobody to ask. Scenes: arrival with Bea; Unit at the Works (a card turned toward
// a machine) and festival mail; Tomas at the ramp, if you built it; the kiosk where the clerk's counter was, with Rue's
// Blend Lounge outside; Bea's crossing; Pip's rye; the meeting at six; Who decided?; the festival.
import * as THREE from 'three';
import * as SIM from './sim.js';
import { CAST, STAKES } from './content.js';
import { clamp, FAST } from './util.js';
import { TeachUnit, QUIRK } from './games/teach.js';
import { FestivalMail } from './games/mail.js';
import { drone } from './robot.js';
import { rampY } from './layers.js';
import { TALK2 } from './talk23.js';

const T = { works: [12, 13.6], hall: [32, 14.2], crossing: [45.9, 21.3], square: [30, 30], shed: [52, 12.6], bakery: [22.3, 20.6], lounge: [38.4, 29.1], farend: [50, 42.4] };
const ob = (t, at, label, extra) => Object.assign({ t, at: at || null, label: label || '' }, extra || {});


// people's looks, ten years on: accessories, never numbers
const LOOKS = { bea: { wear: 'glasses' }, moss: { wear: 'scarf' }, clover: { wear: 'glasses' }, rue: { wear: 'glasses' }, gil: { wear: 'hat' } };
const FEST = { bea: [26.2, 28.6], wren: [33.6, 28.8], ines: [34.6, 29.4], rue: [35.6, 26.2], gil: [24.8, 25.2], moss: [25.4, 29.4], hollis: [30, 28.2], pip: [34.6, 21.8], clover: [27.0, 21.4], pomeroy: [25.4, 22.6], tomas: [28.4, 30.8], ada: [32.6, 30.6] };

// ---------- the Works: Unit, and a card turned toward a machine ----------
async function works(R) {
  const G = R.G, S = R.S, st = R.st, ui = st.ui;
  S.flags.works2 = 1;
  await G.enterRoom('works');
  // a habit you brought from ten years ago: your body braces at the door before you notice
  if (S.carryHabit === 'works' && !S.flags.habitWorks) {
    S.flags.habitWorks = 1;
    const k = await st.choose([{ t: 'OK', sub: 'it is what you do here', id: 'habit_ok' }, { t: 'Not today', sub: 'notice it, and let it go', id: 'habit_no' }], { text: S.fixes.dim === 'built' ? 'You braced before you noticed. The room is dim now.' : 'You braced before you noticed.', kind: 'gut' });
    if (k === 0) { SIM.bendCost(S, false); S.stats.bend++; S.masking = true; S.maskZone = 'works'; st.log('habit', { z: 'works', v: 'bend', by: 'habit', pay: ['you'], dim: 'light', dir: 'over' }); st.fieldNote('habits'); }
    else { S.carryHabit = 'none'; S.pushHabit = 'none'; await st.gut('You let your shoulders drop. Ten years is a long time to brace for something.'); }
    ui.hideDialog();
  }
  G.npcTo('gil', [-2.4, 3.4]); G.talkFrame('gil'); ui.letterbox(true);
  await st.run(TALK2.gil, { npc: 'gil' });
  await st.say('gil', 'And this is Unit. Corporate sent it. It sorts mail. It was built from the founders\' building manual. Every page.');
  if (R.unit) R.unit.setScreen('HELLO.');
  await st.say('unit', 'HELLO. I AM UNIT. I WAS MADE TO FIT THIS BUILDING.');
  st.fieldNote('robots');
  if (S.fixes.plain === 'built') { await st.say('unit', 'PLAIN NOTE PARSED. THANK YOU.'); await st.gut('A fix for people that fits the machine too. Wren would like that.'); }
  let mode = 'spec';
  if (S.fixes.dim === 'built') {
    if (R.unit) R.unit.setScreen('ROOM DOES NOT\nMATCH SPEC');
    await st.say('unit', 'ROOM DOES NOT MATCH SPECIFICATION. RESTORE: PANELS 100%. REMOVE: 14 LAMPS, 9 PLANTS.');
    await st.say('gil', 'Corporate says either we put it back how the spec drew it, or we pay to teach it the room as it is. Mail\'s due at noon.');
    ui.hideDialog(); ui.letterbox(false); G.endTalk();
    mode = await unitCard(R);
  } else {
    if (R.unit) R.unit.setScreen('');
    await st.gut('Unit hums at exactly the pitch of the ceiling panels. The room is still the way the manual drew it, and so it works.');
    ui.hideDialog(); ui.letterbox(false); G.endTalk();
    const res = await st.barrier('works'); if (res === 'leave') { S.flags.mail2 = 'left'; st.saveNow('shift', S.day); return; }
  }
  if (mode === 'left') { st.saveNow('shift', S.day); return; }
  // festival mail, at Dot's old desk, with Unit at the next one
  G.walkTo(...G.rooms.works.spots.mydesk); await R.beat(600);
  const r = await new FestivalMail(G, { unitMode: mode }).run();
  const pay = mode === 'taught' ? 0 : 30; if (pay) { S.coins += pay; G.audio.sfx('coin'); ui.toast(`<b>+${pay} coins</b> for the festival mail`, 'good'); }
  S.flags.mail2 = 'done'; S.stats.shifts++;
  G.advance(Math.max(0, 690 - S.min));
  if (R.unit) R.unit.setScreen(mode === 'restored' ? 'ROOM OK.' : '');
  G.npcTo('gil', [-2.4, 3.4]); G.talkFrame('gil'); ui.letterbox(true);
  await st.run(TALK2.gilAfter, { npc: 'gil' }); ui.hideDialog(); ui.letterbox(false); G.endTalk(); G.npcs.gil.override = null;
  st.saveNow('shift', S.day);
  return r;
}
// the turned card: who adjusts so the machine fits? (the columns are relabelled; the order is the same as ever)
async function unitCard(R, o = {}) {
  const G = R.G, S = R.S, st = R.st;
  G.focusPinch(true);
  const options = [
    { key: 'bend', who: 'You', label: 'Do the mail by hand', sub: 'Unit idles. −10 energy; the room stays as it is.', hold: true },
    { key: 'gear', who: 'The machine', label: 'Teach Unit the room', sub: '30 coins of your festival pay, and about an hour. It learns what you show it.' },
    o.noBell ? { key: 'ask', who: 'Them', label: 'Ring the call bell', disabled: true, reason: 'you rang. Someone, somewhere, read you a script.' } : { key: 'ask', who: 'Them', label: 'Ring Unit\'s call bell', sub: 'Someone, somewhere, minds it. It may take a while.' },
    { key: 'fix', who: 'The place', label: 'Put the room back to the spec', sub: 'Panels up, lamps off. Unit sorts perfectly. You and Ada pinch.' },
    { key: 'leave', who: 'Nobody', label: 'Step outside', sub: 'Gil decides, after you go.' },
  ];
  const choice = await st.ui.barrier({ options, title: 'The Works, ten years on', text: 'The room has changed since the manual was written. The machine hasn\'t.', gut: o.noBell ? '' : 'Ten years ago the card asked who adjusts for you. Today it asks who adjusts for Unit.', notice: '', noticeLabel: '', coach: '' });
  st.ui.hideBarrier(); G.focusPinch(false);
  const row = { z: 'works', dim: 'machine', dir: 'over', f: { off: o.noBell ? 1 : 0, owner: 'gil' } };
  if (choice === 'bend') { S.energy = clamp(S.energy - 10, 0, S.maxE); S.stats.bend++; st.log('barrier', Object.assign({ v: 'bend', pay: ['you'] }, row)); await st.say('gil', 'By hand. Like the old days. I\'ll put the kettle on.'); st.ui.hideDialog(); return 'idle'; }
  if (choice === 'gear') {
    S.stats.fix++; S.w.unit_taught = 1; st.log('barrier', Object.assign({ v: 'teach', pay: ['you'] }, row));
    await st.say('gil', 'Teach it? Okay. Corporate takes it out of your festival pay. I\'m sorry. I asked.'); st.ui.hideDialog();
    const r = await new TeachUnit(G, { plain: S.fixes.plain === 'built' }).run();
    G.advance(45); st.fieldNote('othello'); st.fieldNote('worldmodel');
    if (R.unit) R.unit.setScreen('MAP UPDATED.');
    st.keep('unit_taught', 'You taught Unit the room', '#9edcd6');
    return 'taught';
  }
  if (choice === 'ask') {
    S.stats.ask++; G.advance(20);
    await st.note('You press the call bell on Unit\'s back. Twenty minutes of hold music. Then a calm voice.');
    await st.say('sana', 'Thank you for calling Unit support. Have you tried restoring the specification?');
    await st.say('sana', 'Is there anything else I can help you with today?');
    st.ui.hideDialog(); st.log('refused', Object.assign({ v: 'ask', by: 'sana', pay: ['you'] }, row)); st.fieldNote('sludge');
    return unitCard(R, { noBell: true });
  }
  if (choice === 'fix') {
    S.w.unit_restored = 1; S.mods.works = Object.assign(S.mods.works || {}, { light: 0.4 }); G.rooms.works.setDim(false);
    st.log('barrier', Object.assign({ v: 'restore', pay: ['you', 'ada'] }, row));
    st.ui.bubble('ada', 'Bright again. I\'ll wear my cap.', { tint: CAST.ada.tint, ms: 4200 });
    await st.note('The panels go up to full. The lamps go off, one by one, and the plants go out to the corridor. Unit sorts its first letter perfectly.'); st.ui.hideDialog();
    return 'restored';
  }
  // nobody: you step out, and Gil decides
  S.stats.leave++; S.w.unit_restored = 1; G.rooms.works.setDim(false);
  st.log('barrier', Object.assign({ v: 'leave', pay: ['you'] }, row)); st.log('barrier', { z: 'works', v: 'restore', by: 'gil', pay: ['ada'], dim: 'machine', dir: 'over' });
  S.flags.mail2 = 'left'; await G.exitRoom();
  await st.note('Through the glass, you watch Gil turn the panels back up. Unit starts sorting. Ada puts on her cap.'); st.ui.hideDialog();
  return 'left';
}

// ---------- the ramp, if you built it: the bots found it too ----------
async function ramp(R) {
  const G = R.G, S = R.S, st = R.st; S.flags.ramp2 = 1;
  G.npcTo('tomas', [19.9, 12.2]); await R.beat(400);
  await st.note('A delivery bot sits halfway down the ramp, waiting for something only it can see. Tomas waits at the bottom, with a sack of festival mail on his knees.');
  G.talkFrame('tomas'); st.ui.letterbox(true);
  await st.say('tomas', 'I\'ll ring it. I always ring it. Stand where it can see two of us.');
  const k = await st.choose([
    { t: 'Stand with him', sub: 'it sees two of you', id: 'ramp_stand' },
    { t: 'Ring it for him', sub: 'if he wants', id: 'ramp_ring' },
    { t: 'Ask Gil about a passing bay, with him', sub: 'a fix: bots pull in, people go first', id: 'ramp_bay' },
    { t: 'Leave him to it', sub: 'he\'s done this before', id: 'ramp_leave' },
  ]);
  const row = { z: 'works', dim: 'bots', dir: 'over' };
  if (k === 0) { await st.note('The bot considers the two of you. Then it reverses up the ramp, very slowly, like a cat leaving a room on purpose.'); await st.say('tomas', 'Two of us. It respects a crowd.'); st.log('barrier', Object.assign({ v: 'stand', by: 'tomas', pay: ['you', 'tomas'] }, row)); st.addBond('tomas', 1); }
  else if (k === 1) { await st.say('tomas', 'Go on, then. It answers anyone.'); await st.note('You press the bot\'s little bell. It beeps, thinks, and backs away.'); st.log('barrier', Object.assign({ v: 'ring', by: 'you', pay: ['tomas'] }, row)); }
  else if (k === 2) { await st.say('tomas', 'With me. Not for me. All right.'); R.propose('bay', 'gil'); await st.say('gil', 'A bay? Paint and a sign. I can do paint and a sign. It needs the meeting, though. Six o\'clock.'); st.log('barrier', Object.assign({ v: 'fix', pay: [] }, row)); }
  else { await st.say('tomas', 'I\'ve done this a hundred times. Go on.'); st.log('barrier', Object.assign({ v: 'leave', pay: ['tomas'] }, row)); }
  await st.say('tomas', 'Festival mail week. People write each other letters like it\'s a hundred years ago. Best week of the year.');
  st.ui.hideDialog(); st.ui.letterbox(false); G.endTalk(); G.npcTo('tomas', null);
  if (G.town.bots) G.town.bots[0].position.set(14.4, rampY(14.4), 11.2);
}

// ---------- the kiosk where the clerk's counter was ----------
async function kiosk(R) {
  const G = R.G, S = R.S, st = R.st; S.flags.kiosk2 = 1;
  await st.note('Where the clerk\'s counter used to be, there is a kiosk. A card taped to the old counter says: NOBODY APPLIED FOR THE MORNING SHIFT.');
  if (G.npcs.bea.place === 'hall') {
    G.talkFrame('bea'); st.ui.letterbox(true);
    await st.say('bea', '"Read it to me," I say, and it does! Every word. Best thing in this building.');
    st.ui.hideDialog(); st.ui.letterbox(false); G.endTalk();
  }
  st.fieldNote('kiosklaw');
  await st.note('Pip comes in, out of breath, and leans toward the screen. "Rye flour delivery."');
  await st.note('The screen says: RIDE? BOOKING A VAN...');
  await st.say('pip', 'No! Flour! Never mind. I\'ll walk.');
  st.fieldNote('speech');
  // your errand: register your festival lantern
  await st.note('Your turn. You need to register your festival lantern.');
  await st.say('you', 'Register a lantern, please.');
  const standard = (S.look.voice || 'chime') === 'hum';
  if (standard) {
    await st.note('LANTERN REGISTERED. The kiosk heard you the first time.'); await st.gut('It was trained on a voice a lot like yours. Pip\'s wasn\'t so lucky.');
    st.ui.hideDialog(); st.log('barrier', { z: 'hall', v: 'fit', by: 'kiosk', pay: [], dim: 'voice', dir: 'over' }); return;
  }
  await st.note('The screen says: REGISTERED: LANDLORD. PLEASE HOLD.');
  return kioskCard(R);
}
async function kioskCard(R, o = {}) {
  const G = R.G, S = R.S, st = R.st;
  const options = [
    { key: 'bend', who: 'You', label: 'Say it again, slower and flatter', sub: 'Sound like the voice it learned from. −4 energy.', hold: true },
    { key: 'gear', who: 'Your gear', label: 'Type it on the screen', sub: 'The keyboard is tiny, and the queue waits behind you.' },
    o.noBell ? { key: 'ask', who: 'Them', label: 'Ring the call bell', disabled: true, reason: 'you rang; it\'s done' } : { key: 'ask', who: 'Them', label: 'Ring the call bell', sub: 'A person answers, eventually. For twelve towns.' },
    SIM.fixState(S, 'counter') === 'none' ? { key: 'fix', who: 'The place', label: 'Back a person at the counter', sub: 'A proposal for tonight: someone at the counter on festival mornings.' } : { key: 'fix', who: 'The place', label: 'A person at the counter', disabled: true, reason: 'already on tonight\'s agenda' },
    { key: 'leave', who: 'Nobody', label: 'Leave it', sub: 'Your lantern stays unregistered, for now.' },
  ];
  const choice = await st.ui.barrier({ options, title: 'Town Hall, ten years on', text: 'The kiosk listens. It learned to listen from one kind of voice.', gut: '', notice: '', noticeLabel: '', coach: '' });
  st.ui.hideBarrier();
  const row = { z: 'hall', dim: 'voice', dir: 'over', f: { owner: '' } };
  if (choice === 'bend') { S.stats.bend++; S.energy = clamp(S.energy - 4, 0, S.maxE); S.self = clamp(S.self - 1.5, 0, 100); st.log('barrier', Object.assign({ v: 'bend', pay: ['you'] }, row)); await st.note('You say it the way the kiosk seems to want it said. LANTERN REGISTERED.'); await st.gut('You sounded like someone else. It worked.'); st.ui.hideDialog(); return; }
  if (choice === 'gear') { S.stats.gear++; st.log('barrier', Object.assign({ v: 'gear', pay: ['you'] }, row)); await st.note('You type it, one small key at a time. Behind you, somebody sighs, then catches themselves. LANTERN REGISTERED.'); st.ui.hideDialog(); return; }
  if (choice === 'ask') {
    S.stats.ask++; G.advance(20); await st.note('You press the call bell. Twenty minutes. Then a voice.');
    await st.say('sana', 'Hi, this is Sana. Twelve towns, one headset. I\'ve registered it for you.');
    await st.say('sana', 'I\'ll put a note in about the counter.');
    S.met.sana = true; st.log('barrier', Object.assign({ v: 'ask', by: 'sana', pay: ['sana'] }, row)); st.fieldNote('aging_auto'); st.ui.hideDialog(); return;
  }
  if (choice === 'fix') { S.stats.fix++; R.propose('counter', 'pip'); st.log('barrier', Object.assign({ v: 'fix', pay: [] }, row)); await st.say('pip', 'A person at the counter? One who knows rye from ride? I\'ll back that.'); st.ui.hideDialog(); return kioskCard(R, Object.assign({}, o, { noFix: true })); }
  S.stats.leave++; st.log('barrier', Object.assign({ v: 'leave', pay: ['you'] }, row)); S.flags.beaRegisters = 1;
  await st.note('You leave it. The lantern can wait.'); st.ui.hideDialog();
}

// ---------- Bea's crossing ----------
async function crossing(R) {
  const G = R.G, S = R.S, st = R.st; S.flags.cross2 = 1;
  G.talkFrame('bea'); st.ui.letterbox(true);
  await st.note('The light at the crossing by the bus stop has a new beep. It gives you exactly the Standard\'s stride.');
  await st.say('bea', 'Forty seconds. I\'ve timed it. The petition\'s in my bag, and a pen.');
  st.ui.hideDialog(); st.ui.letterbox(false); G.endTalk();
  G.npcTo('bea', [46.6, 24.0]); await R.beat(900);
  if (G.town.crossRed) { G.town.crossRed.material.emissiveIntensity = 1.6; G.town.crossGreen.material.emissiveIntensity = 0.15; }
  G.audio.sfx('bus'); st.ui.cc('[A van horn, twice]');
  await st.note('Bea is halfway across when the light changes. The van waits, and honks. Nobody is in any danger. Everybody is looking.');
  const k = await st.choose([
    { t: 'Take Bea\'s arm and hurry', sub: 'quick; she didn\'t ask', id: 'cross_hurry' },
    { t: 'Walk with her, and let the van wait', sub: 'it honks; it runs a minute late', id: 'cross_wait' },
    { t: 'Sign Bea\'s petition', sub: 'a fix for tonight: a crossing long enough for everyone', id: 'cross_sign' },
    { t: 'Let her be', sub: 'she knows the way', id: 'cross_none' },
  ], { text: 'Bea, the light, and the van.', kind: 'note' });
  const row = { z: 'transit', dim: 'time', dir: 'over' };
  if (k === 0) { await st.say('bea', 'I can walk, dear. I\'d just rather not run.'); st.log('barrier', Object.assign({ v: 'hurry', by: 'you', pay: ['bea'] }, row)); }
  else if (k === 1) { await st.note('You walk at Bea\'s pace. The van honks once more, as if to say so.'); st.log('barrier', Object.assign({ v: 'wait', by: 'you', pay: ['marta'] }, row)); st.ui.bubble('marta', 'Honking\'s the only word the van knows. I wasn\'t cross.', { tint: CAST.marta.tint, ms: 5200 }); st.fieldNote('metaperception'); }
  else if (k === 2) { R.propose('crossing', 'bea'); st.addBond('bea', 1); await st.say('bea', 'Two signatures make a petition. Pip will sign too; she crosses with that cart twice a day.'); st.log('barrier', Object.assign({ v: 'fix', by: 'you', pay: [] }, row)); st.fieldNote('agefriendly'); }
  else { await st.say('bea', 'I\'ll go round by Pip\'s next time. She saves me a bun for the trouble.'); st.log('barrier', Object.assign({ v: 'none', by: 'you', pay: ['bea'] }, row)); }
  st.fieldNote('crossing');
  st.ui.hideDialog(); G.npcTo('bea', null);
}

// ---------- the visit ----------
export const ACT2 = {
  looks: LOOKS, festival: FEST,
  resumeAt: { shift: [12, 13.9], meeting: [32, 14.4] }, resumeLine: { shift: 'Festival mail went out at noon.', meeting: 'The meeting is over. The festival is at eight.' },
  causes: {
    works: ['Unit was built from the founders\' building manual.', 'Corporate pays for the spec, not for the room.'],
    hall: ['Nobody applied for the morning shift at the counter.', 'The kiosk learned to listen from one kind of voice.'],
    transit: ['The crossing light is timed to the Standard\'s stride.', 'The van is booked on the app.'],
    market: ['Blend\'s top-ten list decides what sells.', 'Whoever owns a speaker sets its volume.'],
  },
  async arrival(R) {
    const G = R.G, S = R.S, st = R.st, ui = st.ui;
    G.mode = 'cine'; G.busy++;
    G.setLoc('town'); G.place([55.2, 26.2]); G.player.heading = Math.PI;
    G.stage.shot(new THREE.Vector3(60, 7, 33), new THREE.Vector3(53, 1.2, 24.6), 40, 3, true);
    G.audio.setScene('town');
    await G.stage.fadeTo(0, 900);
    await ui.caption('Ten years later.', 2400);
    G.player.root.visible = true;
    await st.note('The van kneels with a hiss, and lets you down at the old bus stop. It is festival day.');
    G.talkFrame('bea'); ui.letterbox(true);
    await st.say('bea', 'Well, look who it is. Ten years! I\'d know you anywhere.');
    await st.say('bea', 'The bus became a van. The van became an app. I became a regular at the library, for the computers.');
    await st.say('bea', 'The computers were a gift from the Founders\' Fund. Hester\'s idea. She\'s all right, for a founder\'s great-great-granddaughter.');
    st.fieldNote('oldwell'); st.fieldNote('aging_auto');
    await st.note(S.fixes.board === 'built' ? 'The board you fought for still glows, and someone has added a line: VAN EVERY 20 MIN. APP, OR THE COUNTER.' : 'On the old timetable, a pink sticker: BOOK ON THE APP.');
    await st.say('bea', 'Here. Your key. No. 2 kept your room the way you left it. I aired it out, which you didn\'t ask for.');
    ui.hideDialog(); ui.letterbox(false); G.endTalk();
    // ten years on, change anything? (an accessory, or nothing; never the faded look)
    await R.st.changeAnything();
    S.min = Math.max(S.min, 495);
    const items = [{ t: 'Festival mail at the Works, 9:00', sub: 'Gil asked you back. Dot\'s old desk.' }, { t: 'See what ten years changed', sub: 'Town Hall has a kiosk now. Bea has a petition.' }, { t: 'Town meeting, 6 PM', sub: 'Two items at most. They go up tonight.' }, { t: 'The Lantern Festival, 8 PM', sub: 'Market Square.' }];
    const onfile = Object.keys(S.fixes).filter((f) => S.fixes[f] === 'onfile');
    const carried = S.carryDefault && S.carryDefault !== 'as_is' ? 'You set this last time: ' + R.st.defaultText(S.carryDefault) + '.' : '';
    await ui.today({ day: 'Ten years on', title: 'Festival day', items, note: onfile.length ? 'Still on file from last time: the ' + onfile.map((f) => SIM.FIXES[f].short).join(' and the ') + '. Clover has it.' : 'Nobody here is the Standard. Some things here are.', carried });
    R.st.applyDefault();
    G.stage.follow(G.player.root.position, G.followOpts({ snap: true }));
    G.busy = Math.max(0, G.busy - 1); G.mode = 'play'; ui.hud(true);
  },
  tick(R) {
    const G = R.G, S = R.S, st = R.st, m = S.min;
    // Tomas at the ramp: the first time you are outside the Works after the mail (also after a save, by the door)
    if (S.fixes.ramp === 'built' && S.flags.works2 && !S.flags.ramp2 && G.loc === 'town' && m < 1060) {
      const p = G.player.root.position; if (S.flags.rampDue || Math.hypot(p.x - 12, p.z - 13.8) < 5) { G.run(() => ramp(R)); return true; }
    }
    // mail went out without you
    if (m >= 700 && !S.flags.works2) { S.flags.works2 = 1; S.flags.mail2 = 'missed'; S.w.unit_restored = S.fixes.dim === 'built' ? 1 : S.w.unit_restored; st.text('Gil (work)', 'Mail\'s out! Unit and I managed. I put the panels back up so it would stop asking. Festival tonight!'); st.log('missed', { z: 'works', v: 'shift', pay: ['you', 'gil'] }); if (S.fixes.dim === 'built') st.log('barrier', { z: 'works', v: 'restore', by: 'gil', pay: ['ada'], dim: 'machine', dir: 'over' }); }
    // Bea at the crossing (early afternoon), if you are close
    if (!S.flags.cross2 && m >= 770 && m < 975 && G.loc === 'town' && G.npcs.bea.place === 'town') {
      const p = G.player.root.position; if (Math.hypot(p.x - 46.2, p.z - 22.6) < 6.5) { G.run(() => crossing(R)); return true; }
    }
    // Moss, at noon, if your quiet corner is busy
    if (!S.flags.moss2 && S.fixes.quiet === 'built' && m >= 720 && m < 840 && G.zone === 'market' && G.npcNear('moss', 'market')) { S.flags.moss2 = 1; st.ui.bubble('moss', 'Your corner. Busiest bit of the square now. Funny.', { tint: CAST.moss.tint, ms: 5600 }); st.ui.announce('Moss: Your corner. Busiest bit of the square now. Funny.'); }
    // Bea registers your lantern for you, if you left it
    if (S.flags.beaRegisters && !S.flags.beaRegistered && m >= 990) { S.flags.beaRegistered = 1; st.text('Bea, No. 4', 'I registered your lantern with my voice. Took me thirty seconds. It likes me.'); }
    return false;
  },
  npcWant() { return null; },
  // Unit's card is the Works' card today, and the kiosk's is Town Hall's
  owns(R, z) { return z === 'works' || z === 'hall'; },
  async handle(R, t) {
    const G = R.G, S = R.S, st = R.st, id = t.id;
    if (id === 'works' || id === 'dock') {
      if (S.min < 480) { await st.note('The Works opens at eight.'); st.ui.hideDialog(); return true; }
      if (!S.flags.works2 && S.min < 700) { await works(R); return true; }
      if (S.min >= 1050) { await st.note('The Works is closed for the festival.'); st.ui.hideDialog(); return true; }
      await G.enterRoom('works'); return true;
    }
    if (id === 'hall') {
      await G.enterRoom('hall');
      if (!S.flags.kiosk2 && S.min >= 540 && S.min < 1050) await kiosk(R);
      else await st.note(S.min >= 1020 && !S.flags.councilDone ? 'People are filing in for the meeting. It starts at six.' : 'The chamber is quiet. The kiosk hums by the door.');
      st.ui.hideDialog(); return true;
    }
    if (id === 'hallkiosk') { if (!S.flags.kiosk2) { await kiosk(R); return true; } await st.note('The kiosk says: SPEAK OR TAP. Underneath, in smaller letters: OR RING THE BELL.'); st.ui.hideDialog(); return true; }
    if (id === 'schoolphoto') { await st.note('This year\'s school photo. The classroom behind them was built for thirty desks. Twelve children, and a lot of floor.'); st.fieldNote('births'); st.fieldNote('whyfewer'); st.ui.hideDialog(); return true; }
    if (id === 'crossing') { await st.note(S.fixes.crossing === 'built' ? 'HOLD FOR MORE TIME, says the button. The light waits.' : 'The button says PUSH. The light gives you forty seconds, exactly the Standard\'s stride.'); st.ui.hideDialog(); return true; }
    if (id === 'board') { await st.note(S.fixes.board === 'built' ? 'The board: VAN EVERY 20 MIN. APP, OR THE COUNTER.' : 'Route 12, forty past the hour. Over it, a pink sticker: BOOK ON THE APP.'); st.ui.hideDialog(); return true; }
    if (id === 'kiosk') { if (G.npcs.rue.place === 'town') { await st.talkTo('rue'); return true; } await st.note('The Blend Lounge is closed. The bench is still pink.'); st.ui.hideDialog(); return true; }
    if (id === 'statue' && !S.flags.festival) { await st.note(S.w.standard_solved ? 'THE STANDARD RESIDENT. A composite from one summer. Not a portrait of anyone. Same statue. New plaque. Same pigeons.' : 'THE STANDARD RESIDENT. Larkspur\'s measure.'); st.ui.hideDialog(); return true; }
    if (id === 'shed') { if (G.npcs.clover.place === 'town') { await st.talkTo('clover'); return true; } return false; }
    return false;
  },
  label(R, it) {
    if (it.id === 'works' && !R.S.flags.works2 && R.S.min < 700) return 'Go in for festival mail';
    return null;
  },
  talk(R, id) {
    const S = R.S, first = !S.talked[id];
    if (id === 'pip') return !S.flags.rye2 ? TALK2.pip : TALK2.pipAgain;
    if (id === 'rue') return !S.flags.coach ? TALK2.rue : TALK2.rueAgain;
    if (id === 'wren') return first ? TALK2.wren : TALK2.wrenAgain;
    if (id === 'clover') return first ? TALK2.clover : TALK2.cloverAgain;
    if (id === 'hollis') return first ? TALK2.hollis : TALK2.hollisAgain;
    if (id === 'gil') return S.flags.mail2 === 'done' ? TALK2.gilAfter : TALK2.gil;
    return TALK2[id] || [{ who: id, t: 'Festival day!' }];
  },
  async call(R, name) {
    const S = R.S, st = R.st;
    if (name === 'onfile') {
      const on = Object.keys(S.fixes).filter((f) => S.fixes[f] === 'onfile');
      if (!on.length) { await st.say('clover', 'Anything pinching? Bring it tonight. We can do two this year.'); return true; }
      for (const f of on) { S.fixes[f] = 'ready'; S.support[f] = (S.support[f] || []).concat(SIM.FIXES[f].backers.filter((b) => !(S.support[f] || []).includes(b))).slice(0, 2); }
      const many = on.length > 1 || SIM.agree(on[0], false, true);
      await st.say('clover', 'Your ' + on.map((f) => SIM.FIXES[f].short).join(' and your ') + ' ' + (many ? 'are' : 'is') + ' still on file. Same backers, ten years older. I\'ve put ' + (many ? 'them' : 'it') + ' on tonight\'s agenda.');
      for (const f of on) if ((S.stakes || {})[f] !== 'listened') { S.stakeDue = S.stakeDue || {}; S.stakeDue[f] = S.day * 1440 + S.min + 30; }
      return true;
    }
    return false;
  },
  objective(R) {
    const S = R.S, m = S.min;
    if (S.flags.festival) return S.flags.released ? ob('') : ob('Enjoy the festival. When you are ready, release your lantern at the statue.', [30, 26.6], 'The statue');
    if (S.flags.councilDone) return ob('The festival starts at 8, in the square.', T.square, 'Market Square');
    if (m >= 1020) return ob('Town meeting at 6 PM, Town Hall.', T.hall, 'Town Hall', { inside: 'hall' });
    if (!S.flags.works2 && m < 700) return ob(R.G.loc === 'works' ? 'Gil is waiting by Dot\'s old desk.' : 'Festival mail at the Works. Gil asked you back.', R.G.loc === 'works' ? null : T.works, 'The Works', { inside: 'works' });
    if (!S.flags.cross2 && m >= 760 && m < 975) return ob('Bea is at the crossing by the bus stop.', T.crossing, 'The crossing');
    const nb = R.st.needBackers(); if (nb.length) { const near = R.st.nearestOf([...new Set(nb.map((x) => x[1]))]); if (near) { const f = nb.find((x) => x[1] === near.id)[0]; return ob('Ask ' + CAST[near.id].name + ' to back the ' + SIM.FIXES[f].short + '. The meeting is at 6.', near.at, CAST[near.id].name); } }
    if (!S.flags.kiosk2 && m < 1050) return ob('Town Hall has a kiosk now, where the counter was.', T.hall, 'Town Hall', { inside: 'hall' });
    if (!S.talked.clover && R.G.npcs.clover.place === 'town') return ob('Clover is at the Fix-It Shed.', T.shed, 'Fix-It Shed');
    return ob('See what ten years changed. The meeting is at 6.');
  },
  goals(R) {
    const S = R.S;
    return [{ t: 'Festival mail at the Works', done: !!S.flags.works2 }, { t: 'The kiosk at Town Hall', done: !!S.flags.kiosk2 }, { t: 'Bea\'s crossing', done: !!S.flags.cross2 }, { t: 'Town meeting, 6 PM', done: !!S.flags.councilDone }, { t: 'The Lantern Festival, 8 PM', done: !!S.flags.released }];
  },
  festivalLine(R, id) {
    const S = R.S, F = S.fixes;
    const L = {
      bea: F.crossing === 'built' ? 'Forty seconds, and then some. I walked across tonight like a queen.' : 'I came round by Pip\'s. Two buns, for the trouble.',
      gil: S.w.unit_taught ? 'Unit watered my tomatoes. Nobody asked it to. I think I\'m moved.' : S.w.unit_restored ? 'Panels back at full. I brought sunglasses. Indoors. Don\'t tell corporate.' : 'Great festival! Great, great. Unit hums along.',
      moss: F.quiet === 'built' ? 'Your corner. Busiest bit of the square. My regulars have to arrive early now.' : 'Tea? Ten years, same tea.',
      rue: S.rue === 'easing' ? 'I measure things at Blend all year. Tonight I\'m not measuring anything.' : 'Hearts are up! Everyone looks so happy. Look happy!',
      wren: S.w.wren_paid ? 'Ines came. I came. The apprentice says maybe. Maybe means yes.' : 'I am here. Ines made me. That was a joke. Ines says I should mark my jokes.',
      pip: S.w.rye_bought ? 'I baked one more rye. Nobody hearted it. It\'s gone already.' : 'Sold every bun. The top-ten list is very pleased with me.',
      clover: 'Still on the council, still reading the ledger. Look at it. A town is just a lot of fixes nobody remembers asking for.',
      hollis: F.crossing === 'built' ? 'A crossing for everyone! I timed it myself. With Bea.' : 'A triumph! The county top five, for smoothness!',
      tomas: 'Festival mail, delivered. Every blue house got its letter. All four of them.',
      ines: 'Wren told me you were plain-spoken. So: it is nice to meet you.',
      ada: 'I like the festival. It\'s dark, apart from the lanterns.',
      pomeroy: 'APPLES! Festival apples! They\'re the same apples!',
    }[id];
    return L ? { who: id, t: L } : null;
  },
  async festivalExtras(R) {
    const G = R.G, S = R.S, st = R.st;
    // a drone brings one lantern over the square; fewer children's lanterns than ten years ago; one heart lantern
    const d = drone('#ff8fbe'); d.position.set(30, 9, 40); G.town.scene.add(d); R.drone = d; R.droneT = 0;
    st.ui.cc('[A drone, humming]');
    if (S.fixes.crossing === 'built') setTimeout(() => st.ui.cc('[The crossing by the bus stop beeps, a little longer now]'), FAST ? 50 : 6000);
    await st.ui.caption('Fewer children\'s lanterns than ten years ago. A drone carries one in, pink, shaped like a heart. Its little screen says DELIVERED.', 3800);
  },
  update(R, dt) {
    if (R.drone) { R.droneT += dt; const k = Math.min(1, R.droneT / 8); R.drone.position.set(30 + Math.sin(R.droneT * 0.3) * 2, 9 - k * 3, 40 - k * 14); for (const r of R.drone.userData.rotors) r.rotation.y += dt * 30; }
  },
  remember(R) {
    const S = R.S, out = [];
    if (S.w.unit_taught) { const q = (S.unitQuirks || [])[0]; out.push('Unit ' + (q ? QUIRK[q] : 'goes round the lamps like a surprise, every time') + '.'); }
    else if (S.w.unit_restored) out.push('The Works went back to the spec. Ada wears a cap indoors.');
    else if (S.flags.mail2 === 'done') out.push('Unit hums along with the panels.');
    if (S.fixes.bay === 'built') out.push('The bots pull in at the bay now. Tomas goes first.');
    if (S.fixes.crossing === 'built') out.push('The crossing waits for everyone in the middle of the street.'); else if (S.flags.cross2) out.push('Bea goes round by Pip\'s. Pip saves her a bun.');
    if (S.fixes.counter === 'built') out.push('On festival mornings, there is a person at the counter.');
    if (S.w.rye_bought) out.push('You bought a rye that nobody had hearted.');
    return out;
  },
  sights: [
    { id: 'unit', name: 'Unit', loc: 'works', at: [-1.1, 2.0, 3.1], ghost: [-1.1, 3.1], dial: null, place: 'the Works', line: 'The first thing in Larkspur the Standard fits.' },
    { id: 'kiosk2', name: 'The kiosk', loc: 'hall', at: [5.4, 1.6, 0.2], ghost: [4.6, 0.6], dial: null, place: 'Town Hall', line: 'One voice behind the kiosk: the voice it learned from.' },
    { id: 'crossing', name: 'The crossing', loc: 'town', at: [45.5, 2.6, 22.0], ghost: [46.6, 24.0], dial: null, place: 'the bus stop', line: 'Timed to the Standard\'s stride.' },
    { id: 'van', name: 'The van', loc: 'town', at: [57.4, 2.6, 23.4], ghost: [56.1, 24.6], dial: null, place: 'the bus stop', line: 'Made for someone with a phone, a card and steady hands.' },
    { id: 'school', name: 'The school photo', loc: 'hall', at: [6.8, 2.1, -1.8], ghost: null, dial: null, place: 'Town Hall', line: 'Built for thirty desks.' },
    { id: 'hearts', name: 'The Blend Lounge', loc: 'town', at: [38.4, 1.9, 30.3], ghost: [38.4, 29.2], dial: null, place: 'the square', line: 'Hearts count what\'s easy to tap.' },
    { id: 'bots', name: 'The bots on the ramp', loc: 'town', at: [16.0, 1.0, 11.2], ghost: [19.6, 11.8], dial: null, place: 'the Works', line: 'The ramp was made for carts and chairs. The bots found it too.', if: (S) => S.fixes.ramp === 'built' },
    { id: 'statue2', name: 'The statue', loc: 'town', at: [30, 4.2, 24], ghost: null, dial: null, place: 'the square', line: 'Same statue. New plaque. Same pigeons.', if: (S) => !!(S.w || {}).standard_solved },
  ],
  // out of the Works after the mail: Tomas at the ramp comes next (from the clock, so it never talks over another scene)
  onOutside(R, from) {
    const S = R.S;
    if (from === 'works' && S.fixes.ramp === 'built' && !S.flags.ramp2 && S.flags.works2) S.flags.rampDue = 1;
  },
};
