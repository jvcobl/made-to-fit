// How a place fits, shown on bodies and in words, never on the player's own eyes and ears.
// - Your creature reacts to the top one or two things that pinch (squints, covers its ears, looks around, yawns...),
//   does its comfort move when a place fits, and keeps a straight face while you are hiding it (pushed through).
// - Residents near you react to the same places through their own small profiles (CAST[id].profile).
// - The pinch strip under the clock says it in words ("Too bright", "Too quiet"), for anyone who can't read a pose.
// Everything is re-evaluated a few times a second with hysteresis, so nothing flickers between two states.
import * as SIM from './sim.js';
import { CAST } from './content.js';

// reaction per dimension: [over, under]
export const REACT = { light: ['squint', 'lean'], sound: ['ears', 'look'], people: ['tense', 'droop'], talk: ['tilt', 'lean_back'], time: ['yawn', 'yawn'], change: ['glance', 'sigh'] };
// words per dimension: [over, under]; the icon is decoration, the words carry it
export const CHIP = {
  light: [['☀', 'Too bright'], ['☾', 'Too dim']],
  sound: [['♪', 'Too loud'], ['∿', 'Too quiet']],
  people: [['☺', 'Too crowded'], ['○', 'Too lonely']],
  talk: [['❝', 'Too many hints'], ['!', 'Too blunt']],
  time: [['◷', 'Too late in the day'], ['◷', 'Too early in the day']],
  change: [['↻', 'Too many surprises'], ['▤', 'Too rigid']],
};
const ON = 0.1, OFF = 0.06, KEEP = 0.04;
export const FITS = 0.12; // below this total, the strip says "Fits you"
const COMFORT_FITS = 0.15; // below this total, the comfort move plays freely
const WELCOMING = 0.35; // in a welcoming spot it plays freely up to this
const NEAR_NPC = 14; // residents react only this close to you (and only those drawn with the near rig)
// the only two people who ever mention your comfort move, once each, kindly; nobody else comments on it, ever
const WELCOME = {
  wren: { hum: 'You hum when you think. Good. So does the kettle.', tap: 'You tap when you think. Good. So does the rain.', rock: 'You rock when you think. Good. So does the porch swing.', spin: 'You turn about when you think. Good. So does the weathervane.', flap: 'You flap when you think. Good. So do the moths.', pace: 'You pace when you think. Good. So does the pendulum.', charm: 'You turn that charm over when you think. Good. I twist string.' },
  moss: { hum: 'Hum away, love. You\'re better than the speakers.', tap: 'Tap away, love. Keeps better time than the band.', rock: 'Rock away, love. The stool\'s sturdy.', spin: 'Spin away, love. Mind the teapot.', flap: 'Flap away, love. Plenty of room behind the cart.', pace: 'Pace away, love. I\'ll keep your tea warm.', charm: 'Fiddle away, love. Pretty charm, that.' },
};
const WELCOME_WHEELS = { wren: { pace: 'You roll back and forth when you think. Good. So does the pendulum.' }, moss: { rock: 'Rock away, love. Plenty of room by the cart.', pace: 'Roll away, love. I\'ll keep your tea warm.' } };

// The top one or two pinches, as [key, dim, dir (0 over, 1 under), score]. A pinch already showing stays until it
// drops below OFF, and keeps a small lead over newcomers, so two close pinches don't swap places every evaluation.
export function topPinches(p, prev = []) {
  const out = [];
  if (!p || !p.dims) return out;
  for (const d of SIM.DIMS) {
    const o = p.dims[d]; if (!o) continue;
    const dir = o.over >= o.under ? 0 : 1; const key = d + dir; const was = prev.includes(key);
    if (o.v > (was ? OFF : ON)) out.push([key, d, dir, o.v + (was ? KEEP : 0)]);
  }
  out.sort((a, b) => b[3] - a[3]);
  return out.slice(0, 2);
}

export class Feel {
  constructor(G) {
    this.G = G; this.t = 0; this.clock = 0; this.mine = []; this.npc = {};
    this.strip = { key: null, since: 0, said: null };
  }
  get S() { return this.G.S; }
  update(dt) {
    this.clock += dt; this.strip.since += dt; this.t -= dt;
    const c = this.G.player;
    if (c && c.comfortStarted) { const k = c.comfortStarted; c.comfortStarted = null; if (this.G.settings.comfortSound !== false) this.G.audio.sfx('comfort', { kind: k, voice: this.S.look && this.S.look.voice }); this.welcome(k); }
    if (this.t > 0) { this.announce(); return; }
    this.t = 0.3;
    this.player(); this.residents(); this.stripUpdate(); this.announce();
  }
  // Wren at the workshop or Moss at the cart, close by, the first time your move plays near them
  welcome(kind) {
    const G = this.G, S = this.S; if (G.mode !== 'play' || G.busy || G.ui.waiter || G.loc !== 'town' || S.day < 1) return;
    const me = G.player.root.position;
    for (const id of ['wren', 'moss']) {
      if (S.flags['welcome_' + id] || !S.met[id]) continue;
      const n = G.npcs[id]; if (!n || n.place !== 'town' || n.visit) continue;
      const q = n.c.root.position; if (Math.hypot(q.x - me.x, q.z - me.z) > 4.5) continue;
      const line = (S.wheels && (WELCOME_WHEELS[id] || {})[kind]) || WELCOME[id][kind] || WELCOME[id].hum;
      S.flags['welcome_' + id] = 1;
      G.ui.bubble(id, line, { tint: CAST[id].tint, ms: 5200 }); G.audio.voice(CAST[id].voice[0], CAST[id].voice[1], line); G.ui.announce(CAST[id].name + ': ' + line);
      return;
    }
  }
  masked() { const S = this.S; return !!(S.masking && S.maskZone === this.G.zone); }
  smooth() { const B = this.S.blend; return !!(B.has && B.smooth && !B.deleted); }
  // a spot made for you: home, Wren's workshop door, Moss's stool by the cart
  welcoming() {
    const G = this.G; if (G.zone === 'home') return true;
    if (G.loc !== 'town' || !G.town || !G.town.inter) return false;
    const p = G.player.root.position;
    for (const it of G.town.inter) if ((it.id === 'workshop' && G.S.met.wren) || (it.id === 'cart' && G.S.met.moss)) { if (Math.hypot(it.x - p.x, it.z - p.z) < 3.2) return true; }
    return false;
  }
  pushesToday() { const S = this.S; return (S.log || []).filter((r) => r.d === S.day && r.v === 'bend').length; }
  player() {
    const G = this.G, S = this.S, c = G.player; if (!c || !S.look || G.posePreview) return;
    const kind = S.look.comfort || 'hum';
    const p = G.pinchNow; const live = (G.mode === 'play' || G.mode === 'cine') && !G.mgActive && S.day > 0;
    if (!live || !p) { c.setReaction(null); c.setComfort(kind, 0); this.mine = []; return; }
    // hiding it: a straight face, no reactions, no comfort move
    if (this.masked() || this.smooth() || G.holding) { c.setReaction(null); c.setComfort(kind, 0); this.mine = topPinches(p, this.mine.map((x) => x[0])); return; }
    this.mine = topPinches(p, this.mine.map((x) => x[0]));
    const freq = this.pushesToday() >= 3 ? 0.5 : 1; const self = S.self / 100;
    const fits = G.zone === 'home' || p.total < COMFORT_FITS || (p.total < WELCOMING && this.welcoming());
    if (fits || !this.mine.length) { c.setReaction(null); c.setComfort(kind, fits ? 0.4 + 0.6 * self : 0.5 * (0.4 + 0.6 * self), freq); return; }
    // pinched: the top reaction, taking turns with the second one every few seconds; the move, gently, in between
    const pick = this.mine.length > 1 && Math.floor(this.clock / 6) % 2 ? this.mine[1] : this.mine[0];
    c.setReaction(REACT[pick[1]][pick[2]]);
    c.setComfort(kind, 0.5 * (0.4 + 0.6 * self), freq);
  }
  // residents near you, through their own profiles; anyone hiding it (Rue, on the streak) keeps a straight face
  residents() {
    const G = this.G, S = this.S; const here = G.player.root.parent, me = G.player.root.position;
    for (const n of Object.values(G.npcs)) {
      const c = n.c, id = n.id, prof = CAST[id] && CAST[id].profile; const st = this.npc[id] || (this.npc[id] = { top: [] });
      const q = c.root.position;
      const near = c.root.visible && c.root.parent === here && c.form === 'near' && Math.hypot(q.x - me.x, q.z - me.z) < NEAR_NPC;
      if (!near || !prof || G.mode === 'title' || this.npcMasked(id)) { c.setReaction(null); st.top = []; continue; }
      const zone = this.zoneOf(n);
      const p = SIM.pinchOf(prof, SIM.levels(S, zone, S.min), null, zone);
      st.top = topPinches(p, st.top.map((x) => x[0]));
      const pick = st.top.length > 1 && Math.floor((this.clock + id.length * 2.3) / 7) % 2 ? st.top[1] : st.top[0];
      c.setReaction(pick ? REACT[pick[1]][pick[2]] : null, { aid: !!prof.aid });
    }
  }
  npcMasked(id) {
    const S = this.S;
    if (id === 'rue') return this.G.story.rueState ? this.G.story.rueState() === 'streak' : !S.flags.rue_cracked;
    return false;
  }
  zoneOf(n) {
    const G = this.G;
    if (n.c.root.parent !== G.town.scene) return G.loc;
    const q = n.c.root.position; let z = G.town.zoneAt(q.x, q.z).id;
    if (z === 'market' && G.S.flags.festival) z = 'festival';
    if (z === 'works' || z === 'hall') z = 'street';
    return z;
  }
  // ---------- the pinch strip ----------
  chips() {
    const G = this.G, S = this.S, p = G.pinchNow; if (!p) return null;
    const out = { items: [], tags: [] };
    if (p.total < FITS || G.zone === 'home') out.items.push(['✓', 'Fits you', 'ok']);
    else {
      let top = this.mine;
      // a place can be a little off in several small ways at once: name the biggest
      if (!top.length && p.top) { const o = p.dims[p.top]; top = [[p.top + (o.over >= o.under ? 0 : 1), p.top, o.over >= o.under ? 0 : 1, o.v]]; }
      for (const [, d, dir] of top) { const [ic, w] = CHIP[d][dir]; out.items.push([ic, w, '']); }
    }
    const pinched = p.total >= FITS && G.zone !== 'home';
    if (pinched && this.smooth()) out.tags.push('Blend is hiding it'); else if (pinched && this.masked()) out.tags.push('hiding it');
    if (S.wearing.headphones && G.zone !== 'home') { const L = SIM.levels(S, G.zone, S.min, G.sub); if (L.sound - S.profile.sound > SIM.BAND) out.tags.push('muffled'); }
    return out;
  }
  stripUpdate() {
    const G = this.G; const on = G.settings.pinchStrip !== false && G.mode === 'play' && !G.mgActive && G.S.day > 0;
    const c = on ? this.chips() : null;
    const key = c ? c.items.map((x) => x[1]).join(',') + '|' + c.tags.join(',') : '';
    if (key !== this.strip.key) { this.strip.key = key; this.strip.since = 0; G.ui.pinchStrip(c); }
  }
  // read out once the strip has held still for a moment and says something new
  announce() {
    const s = this.strip; if (!s.key || s.key === s.said || s.since < 1.5) return;
    s.said = s.key; const [items, tags] = s.key.split('|');
    const list = items.split(',').map((x) => x.toLowerCase()); const t = tags ? ' (' + tags.split(',').join(', ') + ')' : '';
    const words = list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
    this.G.ui.announce(list.length === 1 && /fits you/.test(list[0]) ? 'This place fits you' + t + '.' : 'Here, for you: ' + words + t + '.');
  }
}
