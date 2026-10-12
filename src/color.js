// Street colour. Larkspur was built for one imaginary resident, and every part of town that doesn't fit the people
// who live there is drawn muted. A fix that makes room rolls a wave of colour out from where it was built: the street
// comes back, and so do the people on it (their colour only; never their shape, carts or aids).
// S.color holds how restored each part of town is (0 to 1). No S.color (a save from before this system, or the later
// visits) means the whole town is in colour, as it always was.
import { TOWN } from './render.js';
import { ZONES, QUIET_RECT } from './town.js';
import { clamp, lerp, smoothstep } from './util.js';

// lowest priority first: the shader blends in this order, so the last rectangle that covers a point wins, which
// matches town.zoneAt (the quiet corner first, then the zones in ZONES order)
const ORDER = ['market', 'homerow', 'farend', 'transit', 'commons', 'hall', 'works', 'quiet'];
// where colour starts on the first morning: the places someone has already made room in keep some of theirs
// (Wren's corner of the Far End, Clover's garden at the Commons)
export const START = { homerow: 0, market: 0, works: 0, transit: 0, hall: 0.12, commons: 0.42, farend: 0.5, street: 0.06 };
const RECTS = ORDER.map((id) => (id === 'quiet' ? QUIET_RECT : ZONES.find((z) => z.id === id).rect));
const inRect = (r, x, z) => smoothstep(-1.4, 1.4, Math.min(x - r[0], r[2] - x, z - r[1], r[3] - z));
const MUTE = 0.72;

export class StreetColor {
  constructor(G) {
    this.G = G; this.wave = null; this.t = 0; this.held = {};
    RECTS.forEach((r, i) => TOWN.uTRect.value[i].set(r[0], r[1], r[2], r[3]));
  }
  get S() { return this.G.S; }
  get on() { const S = this.S; return !!(S && S.color && (S.act || 1) === 1 && !this.G.titleColor); }
  // how restored a zone is (the quiet corner shares the square's)
  k(zone) { const C = this.S.color || {}; const id = zone === 'quiet' ? 'market' : zone; return C[id] == null ? 1 : C[id]; }
  // how restored the town is at a point, the same sum the shader does (the wave included)
  at(x, z) {
    if (!this.on) return 1;
    let k = this.k('street');
    for (let i = 0; i < RECTS.length; i++) k = lerp(k, this.k(ORDER[i]), inRect(RECTS[i], x, z));
    const w = this.wave;
    if (w && w.r > 0) { const wz = inRect(RECTS[w.i], x, z); const d = Math.hypot(x - w.x, z - w.z); k = lerp(k, 1, wz * smoothstep(w.r + 0.8, w.r - 0.8, d)); }
    return k;
  }
  // a fix rolls colour out from [x, z] over its zone; resolves when the wave has crossed it
  restore(zone, from, o = {}) {
    const S = this.S; if (!S.color) return Promise.resolve();
    const id = zone === 'quiet' ? 'market' : zone; const i = ORDER.indexOf(id); if (i < 0) return Promise.resolve();
    const r = RECTS[i]; const far = Math.max(...[[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]].map(([x, z]) => Math.hypot(x - from[0], z - from[1]))) + 3;
    const calm = this.G.settings && this.G.settings.calmFx;
    return new Promise((res) => { this.wave = { zone: id, i, x: from[0], z: from[1], r: 0.01, R: far, t: 0, dur: o.dur || (calm ? 2.6 : 3.4), res, street: o.street == null ? 0.22 : o.street }; });
  }
  // everything back at once (the festival, or a test)
  all(k = 1) { const C = this.S.color; if (!C) return; for (const id of Object.keys(C)) C[id] = Math.max(C[id], k); }
  // residents drained by where they stand: three steps, so a walk across a border isn't a flicker of rebuilds
  muteFor(k) { const m = MUTE * (1 - smoothstep(0.35, 0.8, k)); return m > MUTE * 0.66 ? MUTE : m > MUTE * 0.2 ? MUTE * 0.5 : 0; }
  // someone a fix cost something keeps a little grey until it's made up to them (S.colorHold[id])
  hold(id, v) { const S = this.S; S.colorHold = S.colorHold || {}; if (v) S.colorHold[id] = v; else delete S.colorHold[id]; }
  update(dt) {
    const G = this.G, S = this.S; const on = this.on;
    TOWN.uTOn.value = on ? 1 : 0;
    if (!on) { if (this.wasOn) { this.wasOn = false; this.unmuteAll(); } return; }
    this.wasOn = true;
    for (let i = 0; i < ORDER.length; i++) TOWN.uTK.value[i] = this.k(ORDER[i]);
    TOWN.uTStreet.value = this.k('street');
    const w = this.wave;
    if (w) {
      w.t += dt; const t = clamp(w.t / w.dur); const e = 1 - Math.pow(1 - t, 2.2);
      w.r = Math.max(0.01, w.R * e);
      TOWN.uTWave.value.set(w.x, w.z, w.r, w.i); TOWN.uTGlow.value = Math.min(1, w.t * 3) * (1 - smoothstep(0.75, 1, t));
      if (t >= 1) {
        S.color[w.zone] = 1; S.color.street = clamp(this.k('street') + w.street, 0, 1);
        TOWN.uTWave.value.set(0, 0, -1, -1); TOWN.uTGlow.value = 0; this.wave = null; w.res();
      }
    }
    // residents and passers-by, a few times a second (and every frame while a wave is rolling)
    this.t -= dt; if (this.t > 0 && !w) return; this.t = 0.25;
    this.mutePeople(w);
  }
  mutePeople(w) {
    const G = this.G, S = this.S; const hold = S.colorHold || {};
    for (const id in G.npcs) {
      const n = G.npcs[id], c = n.c; if (!c.root.visible) continue;
      const inTown = n.place === 'town'; const p = c.root.position;
      let m = inTown ? this.muteFor(this.at(p.x, p.z)) : 0;
      if (inTown && hold[id]) m = Math.max(m, hold[id]);
      if (m < (c.mute || 0) - 0.2 && inTown && w && this.G.fx) this.G.fx.colorBack(c, id);
      c.setMute(m);
    }
    for (const a of G.crowd || []) {
      const c = a.c; if (!c.root.visible) continue; const p = c.root.position;
      const m = this.muteFor(this.at(p.x, p.z));
      if (m < (c.mute || 0) - 0.2 && w && this.G.fx) this.G.fx.colorBack(c, null);
      c.setMute(m);
    }
  }
  unmuteAll() { const G = this.G; for (const id in G.npcs) G.npcs[id].c.setMute(0); for (const a of G.crowd || []) a.c.setMute(0); }
}
