// Marks: what Wren's lantern shows. Raise it and the things in a street that pinch the people who live there glow
// as marks, each with its kind: ♪ sound, ☀ glare, ✱ crowd, ✎ unclear words, ⏱ fixed hours, ↻ unannounced change,
// ▲ steps (and ✓ for room someone has already made). Tag a mark to collect it: it goes in your Fit Book with who
// it pinches, and fills the street's list. A street whose list is full is ready for a fix.
// Marks are properties of the place (where the sound comes from, how high the step is), never a change to what
// you see or hear yourself.
import * as THREE from 'three';
import { CAST } from './content.js';
import { clamp, damp, esc, FAST } from './util.js';

// kinds of mark: icon, colour, the word for it
export const KINDS = {
  sound: ['♪', '#e07a5f', 'Sound'], light: ['☀', '#e9b949', 'Glare'], people: ['✱', '#c77dba', 'Crowd'], talk: ['✎', '#6c8ebf', 'Unclear words'],
  time: ['⏱', '#5fa8a0', 'Fixed hours'], change: ['↻', '#8f7fd1', 'Unannounced change'], steps: ['▲', '#d9822b', 'Steps'], fit: ['✓', '#3fae8c', 'Room made'],
};
// streets with a list: the fix each one is ready for once you have seen what pinches there
export const STREETS = {
  homerow: { name: 'Home Row', fix: 'lanterns', where: 'on Home Row' },
  market: { name: 'Market Square', fix: 'quiet', where: 'in Market Square' },
  works: { name: 'The Works', fix: 'ramp', where: 'at the Works' },
  transit: { name: 'The bus stop', fix: 'board', where: 'at the bus stop' },
  hall: { name: 'Town Hall', fix: null, where: 'at Town Hall' },
};
// at: [x, y, z]. who: residents it pinches. pinches you when your own dial is on the wrong side (you: [dim, 'over'|'under']).
// pre: Wren tagged it already. rare: [from, to] minutes, the only time it shows.
export const MARKS = [
  { id: 'hr_doors', sight: 'doors', street: 'homerow', kind: 'people', at: [15, 2.2, 35.75], name: 'The doors on Home Row', line: 'Knockers, and no signs. Whoever knocks, whenever they like, you are expected to answer.', who: ['wren', 'bea'], you: ['people', 'over'], pre: 'wren' },
  { id: 'hr_knock', street: 'homerow', kind: 'people', at: [23, 2.2, 35.75], name: 'Bea\'s knocker', line: 'Anyone can knock, any time. Bea never knows who it is, or whether she has the energy for a visitor today.', who: ['bea'], you: ['people', 'over'] },
  { id: 'hr_rule', street: 'homerow', kind: 'talk', at: [19, 3.1, 36.75], name: 'The unwritten rule', line: '"Drop by any time!" Everyone on the row says it. Nobody knows who means it.', who: ['wren', 'bea', 'moss'], you: ['talk', 'under'] },
  { id: 'hr_bins', street: 'homerow', kind: 'change', at: [2.4, 1.4, 37.6], name: 'Bin day', line: 'The bins went out on Tuesdays for twenty years. Now it\'s Mondays, and nobody told Bea. You only see this one in the early morning.', who: ['bea'], you: ['change', 'over'], rare: [500, 600] },
  { id: 'mk_speaker', street: 'market', kind: 'sound', at: [38, 3.0, 30], name: 'A speaker on every post', line: 'The market jingle, every four minutes, from all four corners at once.', who: ['moss', 'bea'], you: ['sound', 'over'], pre: 'wren' },
  { id: 'mk_bench', street: 'market', kind: 'sound', at: [22, 3.0, 30], name: 'The speaker over the benches', line: 'The only seats in the square sit right under the loudest speaker.', who: ['moss', 'bea', 'wren'], you: ['sound', 'over'] },
  { id: 'mk_crowd', street: 'market', kind: 'people', at: [30, 2.6, 30.6], name: 'No way round', line: 'At noon the whole square is one crowd. There is nowhere to stand that isn\'t in it.', who: ['moss', 'wren'], you: ['people', 'over'] },
  { id: 'mk_bell', sight: 'bell', street: 'market', kind: 'sound', at: [30, 3.6, 16.6], name: 'The noon bell', line: 'Twelve strokes at noon, right over the stalls. You only see this one at midday.', who: ['moss', 'bea'], you: ['sound', 'over'], rare: [705, 760] },
  { id: 'wk_memo', sight: 'memo', street: 'works', kind: 'talk', at: [15.6, 2.4, 10.62], name: 'The memo in the window', line: '"It would be great if everyone could maybe think about the festival mail at some point!!" Who, what and by when are left as an exercise.', who: ['wren', 'rue'], you: ['talk', 'under'], pre: 'wren' },
  { id: 'wk_steps', street: 'works', kind: 'steps', at: [12, 1.3, 11.9], name: 'Three steps, no ramp', line: 'The only way in from the street. Anyone on wheels goes round to the loading dock, which opens at ten.', who: ['bea', 'pip'], you: ['wheels'] },
  { id: 'wk_glare', sight: 'panels', street: 'works', kind: 'light', at: [8.2, 2.7, 10.62], name: 'The ceiling panels', line: 'Brighter than noon in here, all day long. Gil gets a headache from them most afternoons.', who: ['gil', 'wren'], you: ['light', 'over'], extra: true },
  { id: 'wk_dock', street: 'works', kind: 'steps', at: [20.4, 2.3, 8.2], name: 'The loading dock', line: 'The long way in for anything on wheels. Pip brings her bread cart round here every morning and waits for the door, which opens at ten.', who: ['pip', 'bea'], you: ['wheels'] },
  { id: 'wk_flicker', street: 'works', kind: 'light', at: [10.4, 3.3, 10.62], name: 'The flickering panel', line: 'One light panel in the second row flickers now and then. People say you stop noticing. Gil never does. It only acts up after lunch.', who: ['gil'], you: ['light', 'over'], rare: [780, 900] },
  { id: 'tr_speaker', street: 'transit', kind: 'change', at: [53.4, 3.0, 23.0], name: 'The crackly speaker', line: 'Route changes are announced once, over this. Miss it and you are on the wrong bus.', who: ['bea', 'pip'], you: ['change', 'over'] },
  { id: 'tr_step', sight: 'busstep', street: 'transit', kind: 'steps', at: [54.5, 1.0, 26.4], name: 'The bus step', line: 'Eight inches up. Just right for the Standard\'s knees.', who: ['bea'], you: ['wheels'] },
  { id: 'tr_last', sight: 'timetable', street: 'transit', kind: 'time', at: [52.95, 2.2, 23.8], name: 'The last bus', line: 'First bus 6:10 AM, last bus 7:40 PM. Set for someone up early and home by dark.', who: ['rue', 'pip'], you: ['time', 'over'] },
  { id: 'tr_bus', street: 'transit', kind: 'change', at: [53.6, 2.4, 25.4], name: 'Rerouted, again', line: 'Today: via Elm Street. Said once, over the crackly speaker, as the bus pulled in. You only see this one while a bus is due.', who: ['bea', 'rue'], you: ['change', 'over'], rare: [0, 1440], only: (S) => { const m = Math.floor(S.min) % 60; return m >= 34 && m < 46; } },
  { id: 'hl_notice', sight: 'notice', street: 'hall', kind: 'time', at: [35.4, 2.3, 13.95], name: 'The council notices', line: 'Meetings booked a year ahead, in pen. Bus routes change without a word. Some of each.', who: ['wren', 'rue'], you: ['change', 'under'] },
  { id: 'hl_ramp', street: 'hall', kind: 'fit', at: [26.8, 1.5, 12.2], name: 'Ramp, 1998', line: 'Someone made room here once. It took them nine years of asking.', who: [], fit: true },
  { id: 'fe_sign', street: 'farend', kind: 'fit', at: [48.6, 2.0, 40.4], name: 'Wren\'s sign', line: '"Knock once, then wait." Wren made her own corner fit her. Nobody else had to agree.', who: [], fit: true },
];
export const markById = (id) => MARKS.find((m) => m.id === id);
const REACH = 7.5, SHOW = 24;

function iconTexture(icon, color, done) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.fillStyle = done ? 'rgba(251,246,238,0.92)' : color; x.fill();
  x.lineWidth = 7; x.strokeStyle = done ? color : '#fffaf0'; x.stroke();
  x.fillStyle = done ? color : '#fffaf0'; x.font = '700 64px "Fredoka", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 64, 68);
  if (done) { x.beginPath(); x.arc(100, 26, 20, 0, Math.PI * 2); x.fillStyle = '#3fae8c'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(90, 26); x.lineTo(98, 34); x.lineTo(111, 18); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Marks {
  constructor(G) {
    this.G = G; this.k = 0; this.t = 0; this.near = null; this.card = null;
    this.tex = {};
    this.sprites = MARKS.map((m) => {
      const K = KINDS[m.kind]; const mat = new THREE.SpriteMaterial({ map: this.texOf(m, false), transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(mat); sp.position.set(m.at[0], m.at[1], m.at[2]); sp.scale.set(0.95, 0.95, 1); sp.renderOrder = 8; sp.visible = false; sp.userData.mark = m.id; sp.userData.noOcc = true;
      G.town.scene.add(sp); return sp;
    });
    // the list for the street you are in, under the clock
    const chip = document.createElement('div'); chip.id = 'streetchip'; chip.hidden = true; chip.setAttribute('role', 'status'); G.ui.root.appendChild(chip); this.chip = chip;
    const card = document.createElement('div'); card.id = 'markcard'; card.hidden = true; card.setAttribute('role', 'status'); G.ui.root.appendChild(card); this.cardEl = card;
    // the lantern you hold up, and its light (in the scene from the start, dark until raised, so no shader changes later)
    const lg = new THREE.Group(); lg.scale.setScalar(1.5); const glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 2.4, roughness: 0.4 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.07, 10), new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.6 })); cap.position.y = 0.14;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI), cap.material); handle.position.y = 0.18;
    lg.add(glass, cap, handle); lg.visible = false; lg.traverse((o) => { o.userData.noOcc = true; }); this.held = lg; G.player.root.add(lg);
    this.light = new THREE.PointLight('#ffcf8a', 0, 9, 1.6); this.light.position.set(0, -40, 0); G.town.scene.add(this.light);
    // the beam you can see: a soft fan of light on the ground, the way the lantern points (about forty degrees either
    // side), brighter as something unfound comes into line, so the sweep reads without sound and without motion
    { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,226,160,0.9)'); g.addColorStop(0.55, 'rgba(255,214,140,0.45)'); g.addColorStop(1, 'rgba(255,210,130,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.CircleGeometry(9, 28, Math.PI / 2 - 0.69, 1.38); geo.rotateX(Math.PI / 2);
      this.beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      this.beam.renderOrder = 2; this.beam.visible = false; this.beam.userData.noOcc = true; G.town.scene.add(this.beam); }
  }
  get S() { return this.G.S; }
  // marks are the lantern's job in the first visit, once the town has its colours to win back
  get active() { const S = this.S; return !!(S && S.color && (S.act || 1) === 1); }
  texOf(m, done) { const k = m.kind + (done ? '1' : '0'); if (!this.tex[k]) { const K = KINDS[m.kind]; this.tex[k] = iconTexture(K[0], K[1], done); } return this.tex[k]; }
  tagged(id) { const m = markById(id); return !!((this.S.marks || {})[id] || (m && m.pre)); }
  // what's left to find in a street: tagged / total (rare ones are extra)
  count(street) {
    const list = MARKS.filter((m) => m.street === street && !m.rare && !m.fit && !m.extra);
    return { done: list.filter((m) => this.tagged(m.id)).length, total: list.length, rare: MARKS.filter((m) => m.street === street && m.rare).map((m) => this.tagged(m.id)) };
  }
  complete(street) { const c = this.count(street); return c.total > 0 && c.done >= c.total; }
  visible(m) {
    if (m.rare) { const t = this.S.min; if (!(t >= m.rare[0] && t < m.rare[1]) && !this.tagged(m.id)) return false; }
    if (m.only && !m.only(this.S)) return false;
    return true;
  }
  // does it pinch you, by your own room's dials?
  pinchesYou(m) {
    const S = this.S, y = m.you; if (!y) return false;
    if (y[0] === 'wheels') return !!S.wheels;
    const v = S.profile[y[0]]; return y[1] === 'over' ? v < 0.42 : v > 0.58;
  }
  // the nearest mark you could tag right now: in front of you, within reach, lantern up
  pickTarget() {
    if (!this.active || !this.G.look.raised || this.G.loc !== 'town') return null;
    const p = this.G.player.root.position; let best = null, bd = 1e9;
    for (const m of MARKS) {
      if (this.tagged(m.id) || !this.visible(m) || !(this.seen && this.seen.has(m.id))) continue;
      const d = Math.hypot(m.at[0] - p.x, m.at[2] - p.z); if (d > REACH) continue;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  // a tap on a mark's icon
  // found: the beam passed over it (a soft ping and a few sparks, before you tag it)
  found(m) {
    const G = this.G; const K = KINDS[m.kind];
    G.fx.burst(new THREE.Vector3(m.at[0], m.at[1], m.at[2]), { n: 8, colors: [K[1], '#fff4d6'], speed: 1.4, up: 1.2, size: 0.12, life: 0.7 });
    G.audio.sfx('plip');
    const sp = this.sprites[MARKS.indexOf(m)]; sp.userData.popT = 0.5;
  }
  hit(ray) {
    if (!this.active || !this.G.look.raised) return null;
    const shown = this.sprites.filter((s) => s.visible); if (!shown.length) return null;
    const h = ray.intersectObjects(shown, false)[0]; return h ? markById(h.object.userData.mark) : null;
  }
  tag(id) {
    const G = this.G, S = this.S; const m = markById(id); if (!m || this.tagged(id)) return;
    S.marks = S.marks || {}; S.marks[id] = { day: S.day || 1, min: Math.round(S.min) };
    // a mark is also a clue to the Standard's room (the statue's puzzle)
    if (m.sight) { S.sights = S.sights || {}; if (!S.sights[m.sight]) S.sights[m.sight] = S.day || 1; }
    const c = this.count(m.street); const i = c.done - 1;
    { const B = S.blend; if (B && B.has && !B.deleted && (B.inRow || 0) > 0) { B.inRow = 0; setTimeout(() => G.fx.pop(G.player.root.position.clone(), 'Blend: streak lost', { kind: 'blend', hook: 'streak', hookCtx: { what: 'Blend: streak lost for noticing', by: 'blend' }, ms: 1800, dy: 2.6, follow: G.player.root }), 900); } }
    const at = new THREE.Vector3(m.at[0], m.at[1], m.at[2]);
    const K = KINDS[m.kind];
    G.fx.burst(at, { n: m.rare ? 30 : 20, colors: [K[1], '#fff4d6', '#ffcf7a'], speed: 3, up: 2.4, size: 0.17, life: 1 });
    G.fx.ring(new THREE.Vector3(m.at[0], 0, m.at[2]), { color: K[1], r: 2.2 });
    G.fx.chime(Math.max(0, i), { rare: !!m.rare }); G.fx.punch(0.35);
    const sp = this.sprites[MARKS.indexOf(m)]; sp.material.map = this.texOf(m, true); sp.material.needsUpdate = true; sp.userData.popT = 0.5;
    const st = STREETS[m.street];
    // a sound mark: the street goes quiet for a moment, to show what a fix could do
    if (m.kind === 'sound') { G.audio.preview(2.4); setTimeout(() => G.fx.pop(at.clone().add(new THREE.Vector3(0, -0.8, 0)), 'Imagine it quieter…', { kind: 'good', ms: 1900, rise: 20 }), 350); }
    const who = m.who.filter((id) => CAST[id]).map((id) => CAST[id].name); const whoTxt = who.length ? (who.length > 1 ? who.slice(0, -1).join(', ') + ' and ' + who[who.length - 1] : who[0]) : '';
    const point = m.name.charAt(0).toLowerCase() + m.name.slice(1) + (whoTxt ? ', which pinches ' + whoTxt : '');
    if (m.rare) G.fx.pop(at, 'Rare find: ' + m.name, { kind: 'rare', big: true, hook: 'rare', hookCtx: { what: 'A rare find: ' + m.name, point } });
    else if (m.fit) G.fx.pop(at, 'Room made: ' + m.name, { kind: 'good' });
    else if (m.extra) G.fx.pop(at, 'Also here: ' + m.name, { kind: 'mark' });
    else {
      const left = c.total - c.done;
      G.fx.pop(at, (st ? st.name + ' ' : '') + c.done + '/' + c.total, { kind: 'mark', hook: 'juice', hookCtx: { what: 'A mark tagged: ' + m.name, point } });
      if (left === 1) setTimeout(() => G.fx.chipPop('1 left ' + (st ? st.where : 'here') + '!', { kind: 'mark', hook: 'gradient', hookCtx: { what: '"1 left" ' + (st ? st.where : 'here'), point: 'the last thing ' + (st ? st.where : 'here') + ' that pinches someone' }, ms: 1900 }), 700);
    }
    this.showCard(m);
    G.story.fieldNote && m.kind === 'steps' && G.story.fieldNote('curb');
    if (G.story.slice && G.story.slice.on) G.story.slice.onMark(m, this.count(m.street));
    else if (!G.story.ret && this.complete(m.street)) {
      const f = (STREETS[m.street] || {}).fix; if (f && (S.fixes[f] || 'none') === 'none') G.story.addIdea(f);
      // (you've just looked at this place properly: it doesn't ask "who adjusts?" on top of that today)
      S.handled = S.handled || {}; S.handled[(S.day || 1) + ':' + m.street] = 1;
    }
    this.refreshChip(true);
  }
  // the card for a mark: what it is and who it pinches (a moment, then it tucks itself away; it never stops play)
  showCard(m) {
    const G = this.G; const K = KINDS[m.kind]; const you = this.pinchesYou(m);
    const faces = m.who.filter((id) => CAST[id]).map((id) => `<span class="mface"><img alt="" src="${G.ui.face(id, this.S)}"><b>${esc(CAST[id].name)}</b></span>`).join('') + (you ? `<span class="mface you"><img alt="" src="${G.ui.face('you', this.S)}"><b>You too</b></span>` : '');
    this.cardEl.innerHTML = `<div class="mk" style="--mk:${K[1]}"><span class="mi">${K[0]}</span><span class="mkind">${esc(K[2])}</span></div><div class="mbody"><h4>${esc(m.name)}</h4><p>${esc(m.line)}</p>${m.fit ? '' : `<div class="mwho"><span class="ml">Pinches</span>${faces || '<em>nobody you\'ve met yet</em>'}</div>`}</div><button type="button" class="tclose" aria-label="Close this card">×</button>`;
    this.cardEl.hidden = false; this.cardEl.classList.remove('out'); clearTimeout(this.cardT);
    G.ui.announce(m.name + '. ' + m.line + (m.who.length ? ' Pinches ' + m.who.map((id) => CAST[id] ? CAST[id].name : id).join(', ') + (you ? ', and you.' : '.') : ''));
    // (long enough to read; hovering pauses it; with "Until I close it" it stays until you close it or tag the next one;
    // every card is also kept in your phone's Fit Book, under Marks)
    const el = this.cardEl; const hide = () => { clearTimeout(this.cardT); el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 400); };
    let left = FAST ? 200 : G.ui.readMs(m.name + ' ' + m.line + ' Pinches ' + m.who.length + ' people', 5200), t0 = performance.now();
    const run = () => { clearTimeout(this.cardT); if (G.ui.holdText()) return; t0 = performance.now(); this.cardT = setTimeout(hide, left); };
    el.onpointerenter = () => { clearTimeout(this.cardT); left = Math.max(1500, left - (performance.now() - t0)); };
    el.onpointerleave = run;
    el.querySelector('.tclose').onclick = (ev) => { ev.stopPropagation(); hide(); };
    run();
  }
  hideCard() { clearTimeout(this.cardT); this.cardEl.hidden = true; }
  streetHere() {
    const G = this.G; if (G.loc !== 'town') return null;
    const z = G.zone === 'festival' ? 'market' : G.zone; return STREETS[z] ? z : null;
  }
  refreshChip(force) {
    const z = this.active && this.G.mode === 'play' && !this.G.ui.el('#hud').hidden ? this.streetHere() : null;
    const has = z && MARKS.some((m) => m.street === z && !m.fit);
    if (!has) { if (!this.chip.hidden) this.chip.hidden = true; this.chipKey = ''; return; }
    const c = this.count(z); const key = z + c.done + '/' + c.total + c.rare.join() + (this.G.look.raised ? 'u' : 'd');
    if (key === this.chipKey && !force) return; this.chipKey = key;
    const dots = Array.from({ length: c.total }, (_, i) => `<i class="${i < c.done ? 'on' : ''}"></i>`).join('') + c.rare.map((r) => `<i class="rare ${r ? 'on' : ''}"></i>`).join('');
    this.chip.innerHTML = `<b>${esc(STREETS[z].name)}</b><span class="dots">${dots}</span><span class="n">${c.done}/${c.total}</span>` + (c.done >= c.total ? '<span class="ready">seen</span>' : this.G.look.raised ? '' : `<span class="hint">${this.G.ui.touch ? 'Lantern' : esc(this.G.keyOf('look'))}: look</span>`);
    this.chip.hidden = false;
  }
  update(dt) {
    const G = this.G; this.t += dt;
    const on = this.active && G.loc === 'town';
    // (lantern night shows every mark in town at once, then retunes to the Standard and they go out one by one)
    const up = on && G.look.raised && (G.mode === 'play' || this.showAll);
    this.k = damp(this.k, up ? 1 : 0, 7, dt);
    const p = G.player.root.position;
    const pulse = G.settings.reduceMotion ? 1 : 1 + 0.08 * Math.sin(this.t * 3.4);
    // Smooth Mode dims the lantern: marks show only close by, and fainter
    const B = this.S.blend || {}; const dim = B.has && B.smooth && !B.deleted && !this.showAll; const range = this.showAll ? 999 : dim ? 9 : SHOW;
    let shownN = 0;
    // the lantern's beam: about forty degrees either side of where you face. A mark shows once the beam has swept over
    // it (or you're right beside it), and stays found; the lantern hums higher as an unfound one comes into line
    const hd = G.player.heading, fx0 = Math.sin(hd), fz0 = Math.cos(hd); let warm = 0; this.seen = this.seen || new Set();
    MARKS.forEach((m, i) => {
      const sp = this.sprites[i];
      const dx = m.at[0] - p.x, dz = m.at[2] - p.z, dist = Math.hypot(dx, dz); const cos = dist > 0.01 ? (dx * fx0 + dz * fz0) / dist : 1;
      if (up && !this.showAll && this.visible(m) && dist < range && !this.seen.has(m.id) && !this.tagged(m.id)) {
        if (cos > 0.77 || dist < 2.4) { this.seen.add(m.id); this.found(m); } else warm = Math.max(warm, clamp((cos - 0.15) / 0.62) * clamp(1.4 - dist / range));
      }
      let show = on && this.k > 0.02 && (this.visible(m) || this.showAll) && dist < range && !(this.showAll && m.fit) && (this.showAll || this.seen.has(m.id) || this.tagged(m.id));
      if (show && this.showAll && this.fade != null) { show = shownN < this.fade; shownN++; }
      sp.visible = show; if (!show) return;
      // (on lantern night, seen from above, every mark shows at full strength, tagged or not: it's still there)
      const done = this.tagged(m.id) && !this.showAll;
      if (sp.userData.popT > 0) sp.userData.popT -= dt;
      const pop = sp.userData.popT > 0 ? 1 + Math.sin((1 - sp.userData.popT / 0.5) * Math.PI) * 0.6 : 1;
      const s = (this.showAll ? 3.6 : 1) * (done ? 0.72 : 0.95 * pulse) * pop * (this.near === m ? 1.18 : 1);
      sp.scale.set(s, s, 1); sp.material.opacity = this.k * (done ? 0.75 : 1) * (dim ? 0.55 : 1);
      { const tx = this.texOf(m, done); if (sp.material.map !== tx) { sp.material.map = tx; sp.material.needsUpdate = true; } }
    });
    this.near = up ? this.pickTarget() : null;
    this.warm = damp(this.warm || 0, up ? warm : 0, 6, dt);
    G.audio.lanternHum(this.warm);
    // the lantern in your hand, and its warm light around you
    const lift = this.k; this.held.visible = lift > 0.05;
    if (this.held.visible) { const sw = G.settings.reduceMotion ? 0 : Math.sin(this.t * 2.2) * 0.05; this.held.position.set(0.42, 0.55 + lift * 0.75, 0.22); this.held.rotation.z = sw; }
    if (on) { this.light.position.set(p.x + 0.3, 1.6, p.z + 0.2); this.light.intensity = this.k * (dim ? 2.2 : 6) * (1 + (this.warm || 0) * 0.6 * (G.settings.reduceMotion ? 0 : 0.5 + 0.5 * Math.sin(this.t * (4 + 10 * (this.warm || 0))))); } else this.light.intensity = 0;
    { const b = this.beam; const show = on && lift > 0.05 && !this.showAll; b.visible = show;
      if (show) { b.position.set(p.x, 0.07, p.z); b.rotation.y = G.player.root.rotation.y; b.material.opacity = lift * (0.48 + 0.5 * (this.warm || 0)) * (dim ? 0.5 : 1); } }
    // the hum, said once in words for anyone without sound
    if (up && (this.warm || 0) > 0.35 && !this.S.flags.humCC) { this.S.flags.humCC = 1; G.ui.cc('The lantern glows and hums: something is close. Turn toward it.', 4200); }
    if ((this.ct = (this.ct || 0) - dt) <= 0) { this.ct = 0.3; this.refreshChip(false); }
  }
}
