// Look again: Wren's lantern. Raise it (L, or the lantern button) and the things in Larkspur that were made for
// someone in particular glow softly. Pick one and a pale stand-in for the Standard Resident appears where it was made
// to fit, with one line about it. Each sight is also a clue to the Standard's room, the puzzle at the statue: six
// dials, the same six as your own room, and the question of how the Standard liked them.
import * as THREE from 'three';
import { Creature, STANDARD } from './creature.js';
import { SETUP } from './content.js';
import { ZONES } from './town.js';
import { ACT2 } from './act2.js';
import { ACT3 } from './act3.js';
import { esc, clamp, damp } from './util.js';

// world sights (at most eight a visit), and your own room. at: [x, y, z] of the glow; ghost: [x, z] where the
// stand-in appears; dial: which of the six it is a clue for. Lines describe the place, never the dial's words.
export const SIGHTS = [
  { id: 'panels', name: 'The ceiling panels', loc: 'works', at: [-1.8, 3.3, -0.4], ghost: [-1.6, 0.9], dial: 'light', place: 'the Works', line: 'The panels are as bright as the Standard liked its desk.' },
  { id: 'memo', name: 'The memo board', loc: 'works', at: [-7.6, 1.75, -1.5], ghost: [-6.4, -1.0], dial: 'talk', place: 'the Works', line: 'Every memo says "would be great." The Standard always knew what that meant.' },
  { id: 'bell', name: 'The noon bell', loc: 'town', at: [30, 3.15, 16.6], ghost: [31.2, 17.6], dial: 'sound', place: 'the square', line: 'The noon bell rings as loud as the Standard liked its lunch.' },
  { id: 'doors', name: 'The doors on Home Row', loc: 'town', at: [15, 1.7, 35.95], ghost: [15.8, 37.3], dial: 'people', place: 'Home Row', line: 'Knockers, and no signs. The Standard liked visitors at any time.' },
  { id: 'timetable', name: 'The bus timetable', loc: 'town', at: [52.95, 1.6, 23.8], ghost: [52.0, 22.6], dial: 'time', place: 'the bus stop', line: 'First bus 6:10 AM. Last bus 7:40 PM. Set for someone up early and home by dark.' },
  { id: 'notice', name: 'The council notices', loc: 'town', at: [35.4, 1.75, 13.95], ghost: [35.4, 15.3], dial: 'change', place: 'Town Hall', line: 'Council meetings are booked a year ahead, in pen. The bus routes change without a word. Some of each.' },
  { id: 'busstep', name: 'The bus step', loc: 'town', at: [54.5, 0.5, 26.4], ghost: [55.5, 26.0], dial: null, place: 'the bus stop', line: 'The bus step is eight inches: just right for the Standard\'s knees.' },
  { id: 'podium', name: 'The podium', loc: 'hall', at: [0, 1.35, 0.3], ghost: [1.2, 0.7], dial: null, place: 'Town Hall', line: 'Built to the Standard\'s height. Hollis stands on a box.' },
  { id: 'myroom', name: 'Your room', loc: 'home', at: [0.3, 1.5, -0.8], ghost: null, dial: null, place: 'home', line: 'Made to fit you. You made it.', mine: true },
];
// the later visits' sights (eight each), defined with their scenes; act tells them apart
for (const [act, A] of [[2, ACT2], [3, ACT3]]) for (const s of A.sights || []) SIGHTS.push(Object.assign({ act }, s));
export const SECOND = 'Who decided: the founders\' committee, from one summer\'s measurements.';
const META = { lantern: 'Wren\'s lantern. Made for people who read English and see color. Wren is working on that.' };
const RANGE = 14;

// the six rows of the Standard's room: your room's objects, the dial each one sets, its clue, and the answer
// (0 = the low words, 1 = somewhere in between, 2 = the high words, as in the setup)
export const ROOM_ROWS = [
  { key: 'lamp', dim: 'light', sight: 'panels', answer: 2 },
  { key: 'radio', dim: 'sound', sight: 'bell', answer: 2 },
  { key: 'sign', dim: 'people', sight: 'doors', answer: 0 },
  { key: 'note', dim: 'talk', sight: 'memo', answer: 2 },
  { key: 'clock', dim: 'time', sight: 'timetable', answer: 0 },
  { key: 'calendar', dim: 'change', sight: 'notice', answer: 1 },
];
const ITS_Q = { lamp: 'Its lamp: how bright did it like it?', radio: 'Its radio: how loud did it like the world?', sign: 'Its door sign: who was welcome, and when?', note: 'Its house rules: how did it like to be told things?', clock: 'Its clock: when did its day start?', calendar: 'Its calendar: what was its week like?' };
export const PLAQUE = 'THE STANDARD RESIDENT. A composite of measurements taken one summer from young volunteers at the Works. Not a portrait of anyone. Not a random sample.';
const FELT = {
  light: ['was brighter than you like.', 'was dimmer than you like.', 'Nowhere was too dim or too bright for you. Maybe it\'s set like yours.'],
  sound: ['was louder than you like.', 'was quieter than you like.', 'Nowhere was too loud or too quiet for you. Maybe it\'s set like yours.'],
  people: ['was more crowded than you like.', 'was lonelier than you like.', 'Nowhere was too crowded or too lonely for you. Maybe it\'s set like yours.'],
  talk: ['was full of hints.', 'was blunter than you are used to.', 'Nobody\'s way of talking threw you. Maybe it\'s set like yours.'],
  time: ['ran later than your body wants.', 'started earlier than your body wants.', 'The hours never fought you. Maybe they\'re set like yours.'],
  change: ['was full of surprises.', 'was stiff with rules.', 'Nothing changed too much or too little for you. Maybe it\'s set like yours.'],
};

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(255,246,214,0.95)'); r.addColorStop(0.35, 'rgba(255,226,160,0.55)'); r.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Look {
  constructor(G) {
    this.G = G; this.raised = false; this.k = 0; this.t = 0; this.open = null; this.ghostK = 0; this.near = [];
    this.haloMat = new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false, depthTest: true, opacity: 0, fog: false });
    this.halos = SIGHTS.map((s) => { const h = new THREE.Sprite(this.haloMat); h.scale.set(1.5, 1.5, 1); h.position.set(s.at[0], s.at[1], s.at[2]); h.visible = false; h.userData.noOcc = true; return h; });
    // the stand-in: the Standard, pale and see-through; built once (its shader is compiled at boot)
    this.ghost = new Creature(STANDARD, { lod: 'low', form: 'baked', seed: 13 });
    this.ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, roughness: 1, metalness: 0, emissive: '#fff3d6', emissiveIntensity: 0.35 });
    this.ghost.root.traverse((o) => { if (o.isMesh) { o.material = o === this.ghost.blob ? o.material : this.ghostMat; o.castShadow = false; o.userData.noOcc = true; } });
    if (this.ghost.blob) this.ghost.blob.visible = false;
    this.ghost.root.visible = false; this.ghost.root.userData.creature = null; this.ghost.update(0.016);
    const ui = G.ui.root;
    this.list = document.createElement('div'); this.list.id = 'litlist'; this.list.hidden = true; this.list.setAttribute('role', 'region'); this.list.setAttribute('aria-label', 'Lit here'); ui.appendChild(this.list);
    this.card = document.createElement('div'); this.card.id = 'sightcard'; this.card.hidden = true; this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-label', 'Look again'); ui.appendChild(this.card);
  }
  get S() { return this.G.S; }
  get unlocked() { return !!this.S.flags.lantern; }
  // put the halos and the stand-in into every scene once, and compile their shaders before anyone needs them
  warm() {
    const G = this.G; const scenes = { town: G.town.scene, works: G.rooms.works.scene, hall: G.rooms.hall.scene, home: G.rooms.home.scene };
    SIGHTS.forEach((s, i) => scenes[s.loc].add(this.halos[i]));
    G.town.scene.add(this.ghost.root);
    try { for (const h of this.halos) h.visible = true; this.ghost.root.visible = true; for (const sc of Object.values(scenes)) G.stage.precompile(sc); } catch (e) { /* compile is best-effort */ }
    for (const h of this.halos) h.visible = false; this.ghost.root.visible = false;
  }
  pickUp() {
    const S = this.S; if (S.flags.lantern) return; S.flags.lantern = 1;
    this.G.ui.toast(`<b>Wren's lantern</b><br>${this.G.ui.touch ? 'The lantern button' : this.G.keyOf('look') + ', or the lantern button'}: raise it. Things made for someone glow.`, 'idea', 6000);
    this.G.ui.gearKey = '';
  }
  toggle() { if (!this.unlocked || this.G.mode !== 'play' || this.G.busy || this.G.ui.waiter) return; if (this.raised) this.lower(); else this.raise(); }
  raise() {
    const S = this.S;
    // the first visit, with the town's colours to win back: the lantern shows marks (marks.js) instead of sights
    if (this.G.marks && this.G.marks.active) {
      if (this.G.loc !== 'town') { this.G.ui.toast('The lantern shows what pinches people out in the streets. Try it outside.', '', 3600); return; }
      this.raised = true; this.G.audio.sfx('lantern'); this.G.ui.gearKey = '';
      // (the first day's objective says how it works; anywhere else, a tip the first time)
      const sl = this.G.story.slice;
      if (!S.flags.markTip) { S.flags.markTip = 1; if (!(sl && sl.on)) this.G.ui.toast(`<b>Turn to sweep the beam.</b> It glows and hums near what pinches people. ${this.G.ui.touch ? 'Tap a mark' : 'Get close and press ' + this.G.keyOf('interact') + ', or click a mark,'} to tag it.`, 'idea', 6500); }
      if (sl && sl.on) sl.onRaise();
      return;
    }
    this.raised = true; this.G.audio.sfx('lantern'); this.G.ui.gearKey = '';
    this.list.hidden = false; this.refresh(true);
    if (!S.flags.lanternMeta) { S.flags.lanternMeta = 1; this.showCard({ name: 'Wren\'s lantern', line: META.lantern }); }
  }
  lower() { this.raised = false; this.list.hidden = true; this.closeCard(); this.G.ui.gearKey = ''; this.G.audio.sfx('back'); }
  inRange(s) {
    const G = this.G; if (s.loc !== G.loc) return false;
    const act = this.S.act || 1; if ((s.act || 1) !== act && !(s.mine && act > 1 && !s.act)) return false;
    if (s.if && !s.if(this.S)) return false;
    if (s.loc !== 'town') return true;
    const p = G.player.root.position; return Math.hypot(s.at[0] - p.x, s.at[2] - p.z) < RANGE;
  }
  refresh(force) {
    const near = SIGHTS.filter((s) => this.inRange(s));
    const key = near.map((s) => s.id).join(',');
    if (!force && key === this.nearKey) return; this.nearKey = key; this.near = near;
    const keys = !this.G.ui.touch;
    this.list.innerHTML = `<h4>Lit here</h4>` + (near.length ? near.map((s, i) => `<button class="litbtn ${this.S.sights && this.S.sights[s.id] ? 'seen' : ''}" data-i="${i}">${keys ? `<kbd>${i + 1}</kbd>` : ''}${esc(s.name)}</button>`).join('') : `<p>Nothing here was made for anyone in particular. Or you haven't learned to see it yet.</p>`) + `<button class="mini-btn" id="litoff">${keys ? 'Lower it (' + esc(this.G.keyOf('look')) + ')' : 'Lower the lantern'}</button>`;
    this.list.querySelectorAll('.litbtn').forEach((b) => { b.onclick = () => this.pickIndex(+b.dataset.i); });
    this.list.querySelector('#litoff').onclick = () => this.lower();
  }
  pickIndex(i) { const s = this.near[i]; if (s) this.pick(s); }
  pick(s) {
    const S = this.S; S.sights = S.sights || {};
    const first = !S.sights[s.id]; if (first) S.sights[s.id] = S.day || 1;
    this.showCard({ name: s.name, line: s.line, second: S.w && S.w.standard_solved && !s.mine && !s.act ? SECOND : '' });
    if (s.ghost && s.ghostYou) this.useGhostYou(); else this.useGhostStandard();
    if (s.ghost) { const g = this.ghost; const sc = this.G.player.root.parent; if (g.root.parent !== sc) sc.add(g.root); g.root.position.set(s.ghost[0], 0, s.ghost[1]); const p = this.G.player.root.position; g.faceToward(p.x, p.z); g.root.rotation.y = g.heading; g.root.visible = true; this.ghostOn = true; }
    if (s.mine) this.G.story.keep('myroom', 'Your room, made to fit you', this.S.look.color);
    this.refresh(true);
  }
  // the later visits' "your fix" sight: the stand-in is you, not the Standard (built once, when first needed)
  useGhostYou() {
    if (!this.ghostYouC) {
      const g = new Creature(Object.assign({}, this.S.look), { lod: 'low', form: 'baked', seed: 17 });
      g.root.traverse((o) => { if (o.isMesh) { o.material = o === g.blob ? o.material : this.ghostMat; o.castShadow = false; o.userData.noOcc = true; } });
      if (g.blob) g.blob.visible = false; g.root.visible = false; g.root.userData.creature = null; g.update(0.016); this.ghostYouC = g;
    }
    if (this.ghost !== this.ghostYouC) { this.ghostStd = this.ghostStd || this.ghost; this.ghost.root.visible = false; this.ghost = this.ghostYouC; }
  }
  useGhostStandard() { if (this.ghostStd && this.ghost !== this.ghostStd) { this.ghost.root.visible = false; this.ghost = this.ghostStd; } }
  sight(id) { return SIGHTS.find((s) => s.id === id) || null; }
  // move a sight (a later visit decides where "your fix" is)
  relocate(id, loc, at, ghost, extra) {
    const i = SIGHTS.findIndex((s) => s.id === id); if (i < 0) return; const s = SIGHTS[i];
    s.loc = loc; s.at = at; s.ghost = ghost; if (extra) Object.assign(s, extra); const h = this.halos[i]; h.position.set(at[0], at[1], at[2]);
    const G = this.G; const sc = loc === 'town' ? G.town.scene : G.rooms[loc] && G.rooms[loc].scene; if (sc && h.parent !== sc) sc.add(h);
  }
  showCard(c) {
    this.open = c; this.card.hidden = false;
    this.card.innerHTML = `<div class="sc-k">Look again</div><h4>${esc(c.name)}</h4><p>${esc(c.line)}</p>${c.second ? `<p class="sc-2">${esc(c.second)}</p>` : ''}<button class="btn" id="scclose">Close</button>`;
    this.card.querySelector('#scclose').onclick = () => this.closeCard();
    this.G.ui.announce(c.name + '. ' + c.line + (c.second ? ' ' + c.second : ''));
  }
  closeCard() { this.open = null; this.card.hidden = true; this.ghostOn = false; }
  // the notebook's Sights page
  sightsList() { const S = this.S; return SIGHTS.filter((s) => (S.sights || {})[s.id]).map((s) => ({ name: s.name, line: s.line, second: S.w && S.w.standard_solved && !s.mine && !s.act ? SECOND : '' })); }
  update(dt) {
    const G = this.G; this.t += dt;
    if (this.raised && (G.mode !== 'play' || G.mgActive)) this.lower();
    this.k = damp(this.k, this.raised ? 1 : 0, 6, dt);
    const breathe = G.settings.reduceMotion ? 1 : 1 + 0.1 * Math.sin(this.t * Math.PI * 0.6); // 0.3 Hz, ±10%
    this.haloMat.opacity = 0.85 * this.k * breathe;
    const v2 = !!(G.marks && G.marks.active);
    SIGHTS.forEach((s, i) => { this.halos[i].visible = !v2 && this.k > 0.02 && this.inRange(s) && !s.mine; });
    if (this.raised && !v2 && (this.tr = (this.tr || 0) - dt) <= 0) { this.tr = 0.4; this.refresh(false); }
    this.ghostK = damp(this.ghostK, this.ghostOn ? 1 : 0, 7.5, dt);
    this.ghostMat.opacity = 0.45 * this.ghostK; this.ghost.root.visible = this.ghostK > 0.01;
    if (this.ghost.root.visible) this.ghost.update(dt);
  }
  // ---------- the Standard's room ----------
  // where you felt each dial pinch most, from what the day recorded ("The Works was brighter than you like.")
  feltLine(dim) {
    const W = (this.S.where || {}); let best = null, bv = 0;
    for (const dir of [0, 1]) { const m = W[dim + dir] || {}; for (const z of Object.keys(m)) if (m[z] > bv) { bv = m[z]; best = [z, dir]; } }
    if (!best || bv < 3) return FELT[dim][2];
    const z = ZONES.find((q) => q.id === best[0]); const name = z ? z.name : best[0] === 'works' ? 'The Works' : best[0] === 'hall' ? 'Town Hall' : 'Larkspur';
    return name + ' ' + FELT[dim][best[1]];
  }
  rows() {
    const S = this.S; const seen = S.sights || {};
    return ROOM_ROWS.map((r) => {
      const sp = SETUP[r.key]; const sg = SIGHTS.find((x) => x.id === r.sight);
      return { key: r.key, q: ITS_Q[r.key], opts: [sp.lo, 'Somewhere in between', sp.hi], clue: seen[r.sight] ? sg.line : 'No clue yet. ' + (S.flags.lantern ? 'Raise Wren\'s lantern around ' + sg.place + ' to look again.' : 'Wren left a lantern on your windowsill. Raise it around ' + sg.place + ' to look again.'), felt: this.feltLine(r.dim), answer: r.answer };
    });
  }
  // values for the two rooms side by side (0 to 1 along each row's low-to-high words)
  roomValues() {
    const P = this.S.profile;
    const mine = ROOM_ROWS.map((r) => { const v = P[r.dim]; return SETUP[r.key].invert ? 1 - v : v; });
    const its = ROOM_ROWS.map((r) => [0.1, 0.5, 0.9][r.answer]);
    return { mine, its };
  }
}
