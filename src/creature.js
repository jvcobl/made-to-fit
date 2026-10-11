// Creatures: one parametric body (superellipsoid + spikes + blob) so a look can drift smoothly toward the Standard Resident.
// Each creature has two forms on one rig, built once and switched by visibility (setForm):
// - near: the body, one merged eye mesh (both eyes and their highlights), the mouth, both cheeks in one mesh, one merged
//   top-and-wear mesh, the hands and feet (they animate) and the blob shadow: about ten draws. Merged parts carry each
//   part's colour, roughness, metalness and glow per vertex, so they shade exactly as the separate parts did.
// - baked: every part at rest merged into one vertex-coloured mesh beside the body (low-detail extras merge the body in
//   too): one or two draws. It moves only by the root and rig (bob, squash, heading). Crowds, coworkers, the meeting
//   audience, the founders, the statue and residents far from you use it; src/lod.js decides for residents.
import * as THREE from 'three';
import { clamp, lerp, noise3, mixHex, shadeHex, makeRng, angDamp, damp } from './util.js';

export const SHAPES = {
  round: { exp: 2.0, spike: 0, height: 1.0, blob: 0, width: 1.0 },
  spiky: { exp: 2.0, spike: 1, height: 1.0, blob: 0, width: 0.96 },
  tall: { exp: 2.1, spike: 0, height: 1.42, blob: 0, width: 0.86 },
  blobby: { exp: 2.0, spike: 0, height: 0.86, blob: 1, width: 1.12 },
  boxy: { exp: 4.3, spike: 0, height: 1.02, blob: 0, width: 0.97 },
};
export const OPTIONS = {
  shape: [['round', 'Round'], ['spiky', 'Spiky'], ['tall', 'Tall'], ['blobby', 'Blobby'], ['boxy', 'Boxy']],
  color: ['#f2a99a', '#f6cf5b', '#9fd3b0', '#93c2ee', '#bfa9f0', '#f3a0c2', '#ffc98e', '#9edcd6', '#cde38f', '#e4796a', '#7d9fe0', '#c9b8a6'],
  pattern: [['plain', 'Plain'], ['spots', 'Spots'], ['stripes', 'Stripes'], ['belly', 'Light belly']],
  top: [['ears', 'Round ears'], ['longears', 'Long ears'], ['horns', 'Horns'], ['antennae', 'Antennae'], ['tuft', 'Tuft'], ['none', 'Nothing']],
  wear: [['none', 'Nothing'], ['scarf', 'Scarf'], ['leaf', 'Leaf'], ['bow', 'Bow'], ['glasses', 'Glasses'], ['hat', 'Hat'], ['flower', 'Flower']],
  voice: [['chime', 'Chime'], ['hum', 'Hum'], ['click', 'Click'], ['whistle', 'Whistle']],
};
export const STANDARD = { shape: 'round', color: '#d6c6ad', pattern: 'plain', top: 'ears', wear: 'none', voice: 'hum', wheels: false };

const SPIKE_DIRS = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; const seen = new Map(); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const k = v.x.toFixed(2) + v.y.toFixed(2) + v.z.toFixed(2); if (!seen.has(k)) seen.set(k, v.clone()); }
  return [...seen.values()].filter((d) => d.y > -0.35 && !(d.z > 0.7 && Math.abs(d.y) < 0.5));
})();

function radial(n, p) {
  const e = p.exp;
  const r = Math.pow(Math.pow(Math.abs(n.x), e) + Math.pow(Math.abs(n.y), e) + Math.pow(Math.abs(n.z), e), -1 / e);
  let k = r;
  if (p.blob > 0.001) k *= 1 + p.blob * 0.13 * noise3(n.x * 1.8 + 3.1, n.y * 1.8 + 0.4, n.z * 1.8 + 1.7);
  return k;
}
function bodyGeometry(p, segW, segH) {
  const g = new THREE.SphereGeometry(1, segW, segH);
  const pos = g.attributes.position; const n = new THREE.Vector3();
  const floor = -0.86 * p.height;
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    let k = radial(n, p);
    if (p.spike > 0.001 && !(n.z > 0.62 && Math.abs(n.y) < 0.55)) {
      let s = 0;
      for (let j = 0; j < SPIKE_DIRS.length; j++) { const c = n.dot(SPIKE_DIRS[j]); if (c > 0.93) s = Math.max(s, Math.pow((c - 0.93) / 0.07, 2.2)); }
      k *= 1 + p.spike * s * 0.5;
    }
    let x = n.x * k * p.width, y = n.y * k * p.height, z = n.z * k * p.width;
    if (y < floor) y = floor + (y - floor) * 0.2;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
const tmpN = new THREE.Vector3();
function surf(dx, dy, dz, p, push = 0) {
  tmpN.set(dx, dy, dz).normalize();
  const k = radial(tmpN, p) + push;
  return new THREE.Vector3(tmpN.x * k * p.width, tmpN.y * k * p.height, tmpN.z * k * p.width);
}
export function lookParams(look, drift = 0) {
  const a = SHAPES[look.shape] || SHAPES.round, b = SHAPES.round;
  const o = {};
  for (const k in a) o[k] = lerp(a[k], b[k], drift);
  return o;
}

const texCache = new Map();
function patternTexture(look, color, alpha, seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 128);
  const r = makeRng(seed);
  const dark = shadeHex(color, -0.22), light = shadeHex(color, 0.45);
  x.globalAlpha = alpha;
  const face = (u, v) => u > 0.15 && u < 0.36 && v > 0.25 && v < 0.62;
  if (look.pattern === 'spots') {
    x.fillStyle = dark;
    for (let i = 0; i < 26; i++) { const u = r(), v = 0.12 + r() * 0.72; if (face(u, v)) continue; x.beginPath(); x.ellipse(u * 256, v * 128, 7 + r() * 9, 6 + r() * 7, r() * 3, 0, Math.PI * 2); x.fill(); }
  } else if (look.pattern === 'stripes') {
    x.strokeStyle = dark; x.lineWidth = 9; x.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const u0 = (i + 0.5) / 9; if (u0 > 0.13 && u0 < 0.38) continue; x.beginPath(); for (let v = 0.08; v <= 0.8; v += 0.04) { const u = u0 + Math.sin(v * 9 + i) * 0.012; if (v === 0.08) x.moveTo(u * 256, v * 128); else x.lineTo(u * 256, v * 128); } x.stroke(); }
  } else if (look.pattern === 'belly') {
    x.fillStyle = light; x.beginPath(); x.ellipse(0.25 * 256, 0.66 * 128, 30, 36, 0, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const M = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));
const BLACK = M('#1d1a24', 0.18); const WHITE = M('#ffffff', 0.3, { emissive: '#ffffff', emissiveIntensity: 0.35 });
const CHEEK = new THREE.MeshBasicMaterial({ color: '#ff8fa6', transparent: true, opacity: 0.45, depthWrite: false });
const G = {
  eye: new THREE.SphereGeometry(0.125, 16, 12), hl: new THREE.SphereGeometry(0.038, 8, 6), arc: new THREE.TorusGeometry(0.1, 0.028, 6, 14, Math.PI),
  mouth: new THREE.TorusGeometry(0.085, 0.024, 6, 14, Math.PI), ring: new THREE.TorusGeometry(0.06, 0.022, 6, 14), cheek: new THREE.CircleGeometry(0.1, 16),
  hand: new THREE.SphereGeometry(0.15, 12, 10), foot: new THREE.SphereGeometry(0.2, 14, 10),
};
let blobTex = null, blobMat = null;
function shadowTex() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(30,20,30,0.55)'); g.addColorStop(1, 'rgba(30,20,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}
// the soft round shadow under every creature; src/lod.js draws the baked ones' shadows with it in one instanced mesh
export function blobMaterial() { return blobMat || (blobMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })); }
const BLOB_GEO = new THREE.PlaneGeometry(1, 1);

// One shared material for every merged part. Vertex colours carry each part's colour, and a 'pbr' attribute carries its
// roughness, metalness and glow (emissive, in its own colour), so a merged mesh shades like the separate materials did.
const PARTS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
PARTS.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nattribute vec3 pbr;\nvarying vec3 vPbr;')
    .replace('#include <color_vertex>', '#include <color_vertex>\nvPbr = pbr;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <color_pars_fragment>', '#include <color_pars_fragment>\nvarying vec3 vPbr;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPbr.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPbr.y;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vPbr.z;');
};
PARTS.customProgramCacheKey = () => 'creature-parts-pbr';

// A paint is what a part's material used to be: a colour (linear, as THREE.Color keeps it) and roughness, metalness, glow.
// paintOf(material, true) follows that material's colour later (the parts tinted like the body as you drift).
const paint = (color, rough = 0.6, metal = 0, glow = 0) => ({ color: new THREE.Color(color), pbr: [rough, metal, glow], live: null });
const paintOf = (m, live = false) => ({ color: m.color, pbr: [m.roughness, m.metalness, m.emissive && m.emissive.getHex() ? m.emissiveIntensity : 0], live: live ? m : null });
const P = {
  eye: paintOf(BLACK), hl: paintOf(WHITE), inner: paint('#ff9fb3', 0.7), std: paint(STANDARD.color, 0.6),
  horn: paint('#f3e6c8', 0.45), stalk: paint('#3a3340', 0.5), scarf: paint('#d9603b', 0.85), leaf: paint('#6fae5b', 0.6), stem: paint('#4e7a3f', 0.7),
  bow: paint('#ef6f9f', 0.5), glasses: paint('#2b2530', 0.35), hat: paint('#3f5a87', 0.75), band: paint('#e2b34c', 0.6),
  flower: paint('#f2c14e', 0.5), petalW: paint('#ffffff', 0.6), petalP: paint('#ffd6e4', 0.6),
  phones: paint('#2f3a4a', 0.4), cup: paint('#2f3a4a', 0.35), pad: paint('#4fb3a9', 0.5), shades: paint('#16161c', 0.12, 0.3),
  frame: paint('#3d4b5c', 0.4, 0.4), tire: paint('#2a2a30', 0.8), seat: paint('#4f6f8f', 0.7),
};

// part geometries with fixed sizes are shared by every creature
const GEO = new Map();
const shared = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; };
const sph = (...a) => shared('s' + a, () => new THREE.SphereGeometry(...a));
const cyl = (...a) => shared('y' + a, () => new THREE.CylinderGeometry(...a));
const cone = (...a) => shared('c' + a, () => new THREE.ConeGeometry(...a));
const tor = (...a) => shared('t' + a, () => new THREE.TorusGeometry(...a));
const box = (...a) => shared('b' + a, () => new THREE.BoxGeometry(...a));
const circ = (...a) => shared('o' + a, () => new THREE.CircleGeometry(...a));
const cap = (...a) => shared('p' + a, () => new THREE.CapsuleGeometry(...a));
const EMPTY = new THREE.BufferGeometry();

// a part's placement, composed the way Object3D does it: translate, rotate (XYZ), scale
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3(), _v = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _o = new THREE.Object3D();
const mtx = (pos, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(_p.copy(pos), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const scaled = (k) => new THREE.Matrix4().makeScale(k, k, k);

// Merge a kit, a list of [geometry, paint, matrix], into one indexed geometry with colour and pbr per vertex. The vertex
// ranges painted with a live material are kept, so their colour can follow it (refreshLive).
function mergeKit(list) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), pbr = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const live = []; let v = 0, i = 0;
  for (const [g, pt, m] of list) {
    const Pa = g.attributes.position, Na = g.attributes.normal, n = Pa.count, c = pt.color, r = pt.pbr;
    _n3.getNormalMatrix(m);
    for (let k = 0; k < n; k++) {
      const o = (v + k) * 3;
      _v.fromBufferAttribute(Pa, k).applyMatrix4(m); pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z;
      _v.fromBufferAttribute(Na, k).applyMatrix3(_n3).normalize(); nor[o] = _v.x; nor[o + 1] = _v.y; nor[o + 2] = _v.z;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; pbr[o] = r[0]; pbr[o + 1] = r[1]; pbr[o + 2] = r[2];
    }
    if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) idx[i + k] = I[k] + v; i += I.length; }
    else { for (let k = 0; k < n; k++) idx[i + k] = v + k; i += n; }
    if (pt.live) live.push([v, n, pt.live]);
    v += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('pbr', new THREE.BufferAttribute(pbr, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); out.userData.live = live;
  return out;
}
function refreshLive(geo) {
  const L = geo.userData.live; if (!L || !L.length) return;
  const a = geo.attributes.color.array;
  for (const [v, n, m] of L) { const c = m.color; for (let k = v * 3, e = (v + n) * 3; k < e; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } }
  geo.attributes.color.needsUpdate = true;
}
const swap = (mesh, geo) => { const old = mesh.geometry; mesh.geometry = geo; if (old !== EMPTY && old !== geo) old.dispose(); };

// How a place shows on a creature (reactions), and the creature's own comfort move. Reactions are animation only:
// they never move the creature anyone is steering, change its speed or take its input. Episodic ones come and go:
// [shortest gap, longest gap, seconds]. Hands to ears lasts about a second and never plays with a comfort move.
const EPISODIC = { ears: [6, 9, 1.0], look: [7, 10, 2.0], droop: [9, 13, 2.0], tilt: [7, 10, 1.5], lean_back: [8, 12, 1.0], yawn: [25, 35, 1.3], glance: [8, 12, 0.8], sigh: [20, 28, 1.6] };
export const COMFORT_MOVES = ['hum', 'tap', 'rock', 'spin', 'flap', 'pace', 'charm'];
let noteTex = null;
function noteTexture() {
  if (noteTex) return noteTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fffaf0'; x.strokeStyle = 'rgba(43,37,48,0.55)'; x.lineWidth = 3; x.font = '600 46px "Fredoka", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeText('\u266a', 32, 34); x.fillText('\u266a', 32, 34);
  noteTex = new THREE.CanvasTexture(c); noteTex.colorSpace = THREE.SRGBColorSpace; return noteTex;
}
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

let nextSeed = 101;
export class Creature {
  // o: { seed, lod: 'low' (fewer segments, no pattern or cheeks), scale, form: 'near' | 'baked', shadow: false (casts none) }
  constructor(look, o = {}) {
    this.o = o;
    this.look = Object.assign({}, STANDARD, look);
    this.seed = o.seed || nextSeed++;
    this.size = o.scale || 1;
    this.low = o.lod === 'low';
    this.drift = 0; this.tense = 0; this.speed = 0; this.heading = 0; this.phase = 0; this.time = Math.random() * 10;
    this.blinkT = 1 + Math.random() * 3; this.hopT = 0; this.expr = 'neutral'; this.wave = 0; this.stare = null;
    this.moving = false; this.waving = false; this.eyeY = 1;
    // reactions to the place, and the comfort move (see setReaction, setComfort)
    this.react = null; this.reactO = {}; this.reactOn = 0; this.reactNext = 1; this.reactDur = 1;
    this.comfortKind = null; this.comfortLevel = 0; this.comfortFreq = 1; this.comfortOn = 0; this.comfortDur = 1.6; this.comfortNext = 3 + Math.random() * 4; this.comfortActive = 0; this.comfortStarted = null; this.onceOn = 0; this.onceK = null; this.onceDur = 1;
    this.pz = { rx: 0, rz: 0, ry: 0, px: 0, pzz: 0, sy: 1, tense: 0 }; this.eyeMul = 1; this.handK = 0; this.handMode = null; this.poseNow = null; this.fixedPose = null;
    // form: 'near' or 'baked' (setForm); blobLayer: src/lod.js draws this one's blob shadow; owned: geometries to dispose
    this.form = 'near'; this.blobLayer = false; this.owned = []; this.kit = null; this.nearDirty = true; this.bakeDirty = true;
    this.root = new THREE.Group(); this.root.userData.creature = this;
    this.rig = new THREE.Group(); this.root.add(this.rig);
    const S = 0.5 * this.size; this.S = S;
    this.rig.scale.setScalar(S);
    this.bodyMat = M('#ffffff', 0.58);
    this.partMat = M(this.look.color, 0.6);
    this.footMat = M(shadeHex(this.look.color, -0.18), 0.7);
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.bodyMat);
    this.body.castShadow = o.shadow !== false; this.body.receiveShadow = !this.low;
    this.rig.add(this.body);
    // the near rig: everything in this group is hidden in the baked form
    this.near = new THREE.Group();
    this.face = new THREE.Group(); this.handGroup = new THREE.Group(); this.gear = new THREE.Group();
    this.eyes = [new THREE.Mesh(EMPTY, PARTS)]; this.arcs = [new THREE.Mesh(EMPTY, BLACK)]; this.arcs[0].visible = false;
    this.mouth = new THREE.Mesh(G.mouth, BLACK); this.mouth.rotation.z = Math.PI;
    this.mouthO = new THREE.Mesh(G.ring, BLACK); this.mouthO.visible = false;
    this.face.add(this.eyes[0], this.arcs[0], this.mouth, this.mouthO);
    // hands live in their own group (not the face), so they can move anywhere around the body
    this.hands = [new THREE.Mesh(G.hand, this.partMat), new THREE.Mesh(G.hand, this.partMat)];
    for (const h of this.hands) { h.castShadow = false; this.handGroup.add(h); }
    // the top (ears, horns...) and what you wear share one merged mesh. Drift shrinks the top into the body (its
    // vertices come first and are scaled in place); what you wear keeps its size: ageing adds, it never fades
    this.top = new THREE.Mesh(EMPTY, PARTS);
    this.stdTop = new THREE.Mesh(EMPTY, PARTS); this.stdTop.visible = false;
    this.gearParts = { headphones: new THREE.Mesh(EMPTY, PARTS), shades: new THREE.Mesh(EMPTY, PARTS) };
    this.gearParts.headphones.visible = this.gearParts.shades.visible = false; this.gear.add(this.gearParts.headphones, this.gearParts.shades);
    this.near.add(this.face, this.handGroup, this.top, this.stdTop, this.gear);
    // both cheeks in one mesh, shown in both forms (low-detail creatures have none)
    this.cheeks = this.low ? null : new THREE.Mesh(EMPTY, CHEEK);
    // the baked form: every other part at rest in one mesh; low-detail extras merge the body in too
    this.baked = new THREE.Mesh(EMPTY, PARTS); this.baked.visible = false;
    this.baked.castShadow = this.low && this.body.castShadow; this.baked.receiveShadow = false;
    this.rig.add(this.near, this.baked); if (this.cheeks) this.rig.add(this.cheeks);
    this.feet = new THREE.Group(); this.root.add(this.feet);
    const blob = new THREE.Mesh(BLOB_GEO, blobMaterial());
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015; blob.scale.setScalar(S * 2.6); this.root.add(blob); this.blob = blob;
    this.params = null; this.texKey = '';
    this.wearing = { headphones: false, shades: false };
    if (o.form === 'baked') this.form = 'baked';
    this.rebuild(true);
    this.applyForm();
    // the town's see-through circle must never rewrite the shared creature materials
    this.root.traverse((m) => { if (m.isMesh) m.userData.noOcc = true; });
  }
  get position() { return this.root.position; }
  effLook() { const d = this.drift; return { color: mixHex(this.look.color, STANDARD.color, clamp(d * 1.1)), patAlpha: clamp(1 - d * 1.4), partScale: clamp(1 - d * 1.25), stdScale: clamp((d - 0.35) * 1.8) }; }
  rebuild(full) {
    const p = lookParams(this.look, this.drift);
    const changed = !this.params || Object.keys(p).some((k) => Math.abs(p[k] - this.params[k]) > 0.015);
    const L = this.effLook();
    if (changed || full) {
      this.params = p;
      const seg = this.low ? [22, 16] : [44, 32];
      const old = this.body.geometry; this.body.geometry = bodyGeometry(p, seg[0], seg[1]); old.dispose();
      this.placeParts();
    }
    const key = L.color + '|' + this.look.pattern + '|' + L.patAlpha.toFixed(2);
    if (key !== this.texKey) {
      this.texKey = key;
      if (this.low || this.look.pattern === 'plain') { if (this.bodyMat.map) { this.bodyMat.map.dispose(); this.bodyMat.map = null; } this.bodyMat.color.set(L.color); }
      else { if (this.bodyMat.map) this.bodyMat.map.dispose(); this.bodyMat.map = patternTexture(this.look, L.color, L.patAlpha, this.seed); this.bodyMat.color.set('#ffffff'); }
      this.bodyMat.needsUpdate = true;
      this.partMat.color.set(shadeHex(L.color, -0.06)); this.footMat.color.set(shadeHex(L.color, -0.2));
      refreshLive(this.top.geometry); this.bakeDirty = true;
    }
    this.applyLook(L);
    if (this.form === 'baked' && this.bakeDirty) this.bake();
  }
  applyLook(L) {
    const K = this.kit, k = Math.max(0.0001, L.partScale), g = this.top.geometry, u = g.userData;
    if (u.rest && u.k !== k) {
      const a = g.attributes.position.array, r = u.rest; for (let i = 0; i < r.length; i++) a[i] = r[i] * k;
      g.attributes.position.needsUpdate = true; g.computeBoundingSphere(); u.k = k;
    }
    this.top.visible = (L.partScale > 0.01 && K.top.length > 0) || K.wear.length > 0;
    this.stdTop.scale.setScalar(Math.max(0.0001, L.stdScale)); this.stdTop.visible = L.stdScale > 0.01;
    // the Standard's ears are only built once someone starts to grow them
    if (this.stdTop.visible && this.stdBuilt !== this.kit) { this.stdBuilt = this.kit; swap(this.stdTop, mergeKit(this.kit.std)); }
  }
  setLook(look) { this.look = Object.assign({}, STANDARD, look); this.params = null; this.texKey = ''; this.rebuild(true); }
  setDrift(d) { d = clamp(d); if (Math.abs(d - this.drift) < 0.004) return; this.drift = d; this.rebuild(false); }
  // 'near' or 'baked'; each form is built once (and again after placeParts) and then only shown or hidden
  setForm(f) {
    if (f === this.form) return;
    this.form = f;
    if (f === 'near' && this.nearDirty) this.buildNear();
    if (f === 'baked' && this.bakeDirty) this.bake();
    this.applyForm();
  }
  applyForm() {
    const near = this.form === 'near';
    this.near.visible = near; this.feet.visible = near; if (this.chair) this.chair.visible = near;
    this.baked.visible = !near; this.body.visible = near || !this.low;
    this.blob.visible = !this.blobLayer;
    if (near) this.poseParts();
  }
  placeParts() {
    const p = this.params, look = this.look, S = this.S;
    for (const g of this.owned) g.dispose(); this.owned.length = 0;
    const K = this.kit = { eyes: [], arcs: [], top: [], wear: [], std: [], hp: [], sh: [] };
    // face: both eyes and their highlights in one mesh, centred between the eyes so a blink can squash it in y
    const ep = this.eyePos = [-1, 1].map((sx) => surf(sx * 0.34, 0.2, 0.92, p, -0.035));
    const ec = this.eyeC = ep[0].clone().lerp(ep[1], 0.5); this.eyeOff = ep[1].clone().sub(ec);
    for (const e of ep) {
      K.eyes.push([G.eye, P.eye, at(e.x - ec.x, e.y - ec.y, e.z - ec.z)]);
      K.eyes.push([G.hl, P.hl, at(e.x - ec.x + 0.04, e.y - ec.y + 0.045, e.z - ec.z + 0.1)]);
      K.arcs.push([G.arc, P.eye, at(e.x, e.y - 0.02, e.z + 0.03)]);
    }
    const mp = surf(0, -0.06, 1, p, 0.0);
    this.mouth.position.copy(mp); this.mouthO.position.copy(mp);
    if (this.cheeks) {
      const ck = [];
      for (const sx of [-1, 1]) { const cp = surf(sx * 0.58, -0.04, 0.8, p, 0.012); _o.position.copy(cp); _o.lookAt(cp.x * 2, cp.y * 2, cp.z * 2); _o.updateMatrix(); ck.push([G.cheek, P.eye, _o.matrix.clone()]); }
      swap(this.cheeks, mergeKit(ck));
    }
    // hands
    [-1, 1].forEach((sx, i) => { const h = this.hands[i]; h.position.copy(surf(sx, -0.3, 0.12, p, -0.06)); h.userData.base = h.position.clone(); h.userData.ear = surf(sx * 0.95, 0.42, 0.18, p, 0.06); h.userData.flap = surf(sx * 1.05, 0.05, 0.1, p, 0.12); });
    this.charmAt = surf(0.18, -0.18, 1, p, 0.1);
    // top and wear (one mesh), the Standard's ears, gear
    this.topKit(K.top, look.top, p, paintOf(this.partMat, true));
    this.wearKit(K.wear, look.wear, p);
    this.topKit(K.std, 'ears', lookParams(STANDARD), P.std);
    this.gearKit(K, p);
    // feet or chair
    while (this.feet.children.length) this.feet.remove(this.feet.children[0]);
    if (this.chair) { this.root.remove(this.chair); for (const g of this.chairGeo) g.dispose(); this.chair = null; this.wheels = null; }
    if (look.wheels) { this.footL = this.footR = null; this.buildChair(p); }
    else {
      this.footL = new THREE.Mesh(G.foot, this.footMat); this.footR = new THREE.Mesh(G.foot, this.footMat);
      for (const [f, sx] of [[this.footL, -1], [this.footR, 1]]) { f.scale.set(S * 0.95, S * 0.55, S * 1.25); f.position.set(sx * S * 0.38 * p.width, S * 0.1, S * 0.08); f.castShadow = false; f.userData.noOcc = true; this.feet.add(f); }
    }
    this.baseY = (0.86 * p.height) * S + (look.wheels ? S * 0.86 : S * 0.1);
    this.topY = (p.height + 0.1) * S + this.baseY;
    this.nearDirty = true; this.bakeDirty = true;
    if (this.form === 'near') this.buildNear();
  }
  // the merged meshes of the near rig, from the kit placeParts laid out
  buildNear() {
    const K = this.kit; this.nearDirty = false;
    swap(this.eyes[0], mergeKit(K.eyes)); this.eyes[0].position.copy(this.eyeC);
    swap(this.arcs[0], mergeKit(K.arcs));
    const tw = K.top.concat(K.wear);
    swap(this.top, tw.length ? mergeKit(tw) : EMPTY);
    // the top's vertices come first: keep them at rest, so drift can scale them and leave what you wear alone
    if (K.top.length) { let n = 0; for (const [g] of K.top) n += g.attributes.position.count; const u = this.top.geometry.userData; u.rest = this.top.geometry.attributes.position.array.slice(0, n * 3); u.k = 1; }
    if (this.wearing.headphones || this.wearing.shades) this.ensureGear();
    this.applyLook(this.effLook()); this.setExpression(this.expr);
  }
  ensureGear() {
    if (this.gearBuilt === this.kit) return;
    this.gearBuilt = this.kit;
    swap(this.gearParts.headphones, mergeKit(this.kit.hp)); swap(this.gearParts.shades, mergeKit(this.kit.sh));
  }
  // every part at rest in rig space, merged into one mesh
  bake() {
    const K = this.kit, S = this.S, L = this.effLook(), list = [];
    this.bakeDirty = false;
    if (this.low) list.push([this.body.geometry, { color: this.bodyMat.color, pbr: [this.bodyMat.roughness, this.bodyMat.metalness, 0] }, new THREE.Matrix4()]);
    const ec = at(this.eyeC.x, this.eyeC.y, this.eyeC.z);
    for (const [g, pt, m] of K.eyes) list.push([g, pt, ec.clone().multiply(m)]);
    list.push([G.mouth, P.eye, mtx(this.mouth.position, 0, 0, Math.PI)]);
    const part = paintOf(this.partMat), foot = paintOf(this.footMat);
    for (const h of this.hands) { const b = h.userData.base; list.push([G.hand, part, at(b.x, b.y, b.z)]); }
    if (L.partScale > 0.01) { const k = scaled(L.partScale); for (const [g, pt, m] of K.top) list.push([g, pt, k.clone().multiply(m)]); }
    for (const e of K.wear) list.push(e);
    if (L.stdScale > 0.01) { const k = scaled(L.stdScale); for (const [g, pt, m] of K.std) list.push([g, pt, k.clone().multiply(m)]); }
    // feet and chair hang from the root: bring them into rig space at rest
    const inv = scaled(1 / S).multiply(at(0, -this.baseY, 0));
    if (this.footL) for (const f of [this.footL, this.footR]) list.push([G.foot, foot, inv.clone().multiply(mtx(_t.set(f.position.x, S * 0.1, S * 0.08), 0, 0, 0, f.scale.x, f.scale.y, f.scale.z))]);
    if (this.chair) {
      const cs = inv.clone().multiply(scaled(S));
      for (const [g, pt, m] of this.chairKit.stat) list.push([g, pt, cs.clone().multiply(m)]);
      for (const w of this.wheels) { const wm = cs.clone().multiply(at(w.position.x, w.position.y, w.position.z)); for (const [g, pt, m] of this.chairKit.wheel) list.push([g, pt, wm.clone().multiply(m)]); }
    }
    swap(this.baked, mergeKit(list));
  }
  topKit(K, kind, p, main) {
    // a spiky body's spikes stand up to half a radius proud: lift what sits on top so it shows above them
    const lift = 0.34 * (p.spike || 0), big = 1 + 0.35 * (p.spike || 0);
    if (kind === 'ears') {
      for (const sx of [-1, 1]) { const m = mtx(surf(sx * 0.55, 0.84, 0.02, p, -0.04 + lift), 0, 0, -sx * 0.35, 1, 1, 0.55); K.push([sph(0.26, 14, 10), main, m], [circ(0.13, 14), P.inner, m.clone().multiply(at(0, 0, 0.145))]); }
    } else if (kind === 'longears') {
      for (const sx of [-1, 1]) { const m = mtx(surf(sx * 0.32, 0.95, 0, p, -0.05 + lift).add(_t.set(sx * 0.12, 0.38, 0)), 0, 0, -sx * 0.32, 1, 1, 0.6); K.push([cap(0.11, 0.62, 4, 10), main, m], [cap(0.055, 0.42, 4, 8), P.inner, m.clone().multiply(mtx(_t.set(0, 0.02, 0.06), 0, 0, 0, 1, 1, 0.4))]); }
    } else if (kind === 'horns') {
      for (const sx of [-1, 1]) K.push([cone(0.11, 0.44, 12), P.horn, mtx(surf(sx * 0.42, 0.88, 0.12, p, -0.03 + lift).add(_t.set(sx * 0.08, 0.18, 0)), 0, 0, -sx * 0.45, big, big, big)]);
    } else if (kind === 'antennae') {
      const tip = paint(shadeHex(this.look.color, -0.35), 0.4);
      for (const sx of [-1, 1]) { const s = mtx(surf(sx * 0.22, 0.97, 0.05, p, -0.03 + lift).add(_t.set(sx * 0.08, 0.24, 0)), 0, 0, -sx * 0.3); K.push([cyl(0.022, 0.022, 0.5, 6), P.stalk, s], [sph(0.09, 12, 8), tip, s.clone().multiply(at(0, 0.27, 0))]); }
    } else if (kind === 'tuft') {
      const b = surf(0, 1, 0, p, -0.05 + lift);
      for (const a of [-0.45, 0, 0.45]) K.push([cone(0.09, 0.34, 8), main, mtx(_t.set(b.x + Math.sin(a) * 0.14, b.y + 0.13 * big, b.z), 0, 0, -a, big, big, big)]);
    }
  }
  wearKit(K, kind, p) {
    if (kind === 'scarf') {
      const y = -0.28 * p.height; const r = surf(1, -0.28, 0, p).x;
      const ring = new THREE.TorusGeometry(r + 0.02, 0.12, 10, 28); this.owned.push(ring);
      K.push([ring, P.scarf, mtx(_t.set(0, y, 0), Math.PI / 2, 0, 0, 1, (surf(0, -0.28, 1, p).z + 0.02) / (r + 0.02), 1)]);
      K.push([box(0.2, 0.46, 0.1), P.scarf, mtx(surf(0.4, -0.45, 0.85, p, 0.05), 0, 0, 0.25)]);
    } else if (kind === 'leaf') {
      const b = surf(0.15, 1, 0, p, -0.02);
      K.push([sph(0.3, 12, 8), P.leaf, mtx(_t.set(b.x + 0.16, b.y + 0.08, b.z), 0.1, 0.6, 0.35, 1, 0.16, 0.48)], [cyl(0.018, 0.018, 0.18, 5), P.stem, at(b.x, b.y + 0.05, b.z)]);
    } else if (kind === 'bow') {
      const b = surf(0.55, 0.78, 0.25, p, -0.02);
      for (const sx of [-1, 1]) K.push([cone(0.13, 0.26, 10), P.bow, mtx(_t.set(b.x + sx * 0.13, b.y + 0.06, b.z), 0, 0, sx * Math.PI / 2)]);
      K.push([sph(0.075, 10, 8), P.bow, at(b.x, b.y + 0.06, b.z)]);
    } else if (kind === 'glasses') {
      const [e0, e1] = this.eyePos;
      for (const e of this.eyePos) K.push([tor(0.16, 0.024, 6, 20), P.glasses, at(e.x, e.y, e.z + 0.07)]);
      const m = e0.clone().lerp(e1, 0.5); K.push([cyl(0.018, 0.018, 0.3, 5), P.glasses, mtx(_t.set(m.x, m.y + 0.02, m.z + 0.07), 0, 0, Math.PI / 2)]);
    } else if (kind === 'hat') {
      // the hat sits tilted a little: its parts turn together about the rig's z axis
      const b = surf(0, 1, 0, p, -0.06); const tilt = new THREE.Matrix4().makeRotationZ(0.08);
      K.push([cyl(0.4, 0.45, 0.4, 20), P.hat, tilt.clone().multiply(at(b.x, b.y + 0.2, b.z))], [cyl(0.7, 0.7, 0.05, 24), P.hat, tilt.clone().multiply(at(b.x, b.y + 0.02, b.z))], [cyl(0.455, 0.455, 0.09, 20), P.band, tilt.clone().multiply(at(b.x, b.y + 0.08, b.z))]);
    } else if (kind === 'flower') {
      const b = surf(-0.5, 0.78, 0.3, p, 0.0);
      K.push([sph(0.075, 10, 8), P.flower, at(b.x, b.y, b.z)]);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.push([sph(0.085, 10, 8), i % 2 ? P.petalW : P.petalP, at(b.x + Math.cos(a) * 0.13, b.y + Math.sin(a) * 0.13, b.z + 0.02)]); }
    }
  }
  gearKit(K, p) {
    const r = surf(1, 0.25, 0, p).x;
    const band = new THREE.TorusGeometry(r + 0.06, 0.05, 8, 24, Math.PI); this.owned.push(band);
    K.hp.push([band, P.phones, mtx(_t.set(0, 0.25 * p.height, 0), 0, 0, 0, 1, (p.height * 0.95) / (r + 0.06), 1)]);
    for (const sx of [-1, 1]) K.hp.push([cyl(0.22, 0.22, 0.16, 18), P.cup, mtx(_t.set(sx * (r + 0.05), 0.2 * p.height, 0), 0, 0, Math.PI / 2)], [cyl(0.17, 0.17, 0.03, 16), P.pad, mtx(_t.set(sx * (r + 0.14), 0.2 * p.height, 0), 0, 0, Math.PI / 2)]);
    const [e0, e1] = this.eyePos;
    for (const e of this.eyePos) K.sh.push([box(0.34, 0.2, 0.05), P.shades, at(e.x, e.y + 0.01, e.z + 0.08)]);
    const m = e0.clone().lerp(e1, 0.5); K.sh.push([box(0.22, 0.04, 0.04), P.shades, at(m.x, m.y + 0.05, m.z + 0.08)]);
  }
  buildChair(p) {
    const ch = new THREE.Group(); const S = this.S; ch.scale.setScalar(S);
    const stat = [[box(1.7, 0.16, 1.4), P.seat, at(0, 0.78, 0)]];
    const wheel = [[tor(0.6, 0.07, 8, 28), P.tire, mtx(_t.set(0, 0, 0), 0, Math.PI / 2, 0)], [tor(0.5, 0.025, 6, 24), P.frame, mtx(_t.set(0, 0, 0), 0, Math.PI / 2, 0)]];
    for (let i = 0; i < 4; i++) wheel.push([box(0.03, 1.0, 0.03), P.frame, mtx(_t.set(0, 0, 0), i * Math.PI / 4, 0, 0)]);
    // each wheel is one mesh (it spins); seat, casters and footrest are one more
    const wg = mergeKit(wheel); this.wheels = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(wg, PARTS); w.position.set(sx * (p.width + 0.2), 0.66, -0.05); ch.add(w); this.wheels.push(w);
      stat.push([sph(0.13, 10, 8), P.tire, at(sx * 0.55, 0.13, 0.62)]);
    }
    stat.push([box(1.2, 0.06, 0.4), P.frame, at(0, 0.3, 0.75)]);
    const sm = new THREE.Mesh(mergeKit(stat), PARTS); ch.add(sm);
    ch.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noOcc = true; } });
    this.chairKit = { stat, wheel }; this.chairGeo = [wg, sm.geometry];
    ch.visible = this.form === 'near';
    this.root.add(ch); this.chair = ch;
  }
  ensureNote() { if (this.note) return; this.note = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthWrite: false })); this.note.scale.set(0.5, 0.5, 1); this.note.userData.noOcc = true; this.near.add(this.note); }
  ensureCharm() { if (this.charm) return; this.charm = new THREE.Mesh(sph(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#e2b34c', roughness: 0.35, metalness: 0.4 })); this.charm.position.set(0, 0.06, 0.12); this.charm.userData.noOcc = true; this.hands[1].add(this.charm); }
  setGear(name, on) { this.wearing[name] = on; if (on) this.ensureGear(); if (this.gearParts && this.gearParts[name]) this.gearParts[name].visible = on; }
  setExpression(e) {
    this.expr = e;
    const happy = e === 'happy';
    this.eyes.forEach((m) => { m.visible = !happy; }); this.arcs.forEach((m) => { m.visible = happy; });
    this.mouth.visible = e !== 'surprised'; this.mouthO.visible = e === 'surprised';
    this.mouth.rotation.z = e === 'sad' ? 0 : Math.PI;
    this.mouth.scale.set(e === 'happy' ? 1.35 : 1, e === 'tense' ? 0.25 : e === 'happy' ? 1.4 : 1, 1);
  }
  hop() { this.hopT = 0.45; }
  // kind: 'squint' | 'lean' | 'tense' | 'ears' | 'look' | 'droop' | 'tilt' | 'lean_back' | 'yawn' | 'glance' | 'sigh' | null
  // o.aid: reach for a hearing aid with one hand instead of covering both ears
  setReaction(kind, o = {}) { if (kind !== this.react) { this.react = kind; this.reactOn = 0; this.reactNext = 0.4 + Math.random() * 1.2; } this.reactO = o; }
  // level 0 (held in) to 1 (free); freq < 1 makes it come less often (after a lot of pushing through)
  setComfort(kind, level, freq = 1) { this.comfortKind = kind || null; this.comfortLevel = level || 0; this.comfortFreq = freq; if (!level) this.comfortOn = 0; }
  // the creator shows a move the moment you pick it, and keeps showing it while you look
  previewComfort(kind) { this.comfortKind = kind; this.comfortLevel = 1; this.comfortFreq = 3; this.comfortOn = 0; this.comfortNext = 0.05; }
  // one reaction, once, now (a glance at the phone when Blend pings)
  once(kind) { const E = EPISODIC[kind]; if (!E) return; this.onceK = kind; this.onceOn = this.onceDur = E[2]; }
  // a still pose for portraits: 'squint', 'ears', 'drift', 'straight', or a comfort move name
  posePortrait(kind) { this.fixedPose = kind; this.handK = 1; }
  posePlan(dt) {
    const t = this.time; const P = { rx: 0, rz: 0, ry: 0, px: 0, pzz: 0, sy: 1, eye: 1, hands: null, mouthO: false, tense: 0, note: 0, tap: 0, spin: 0 };
    if (this.fixedPose) {
      const f = this.fixedPose;
      if (f === 'squint') { P.eye = 0.4; P.rx = 0.06; } else if (f === 'ears') P.hands = 'ears'; else if (f === 'drift') { P.ry = 0.5; P.rx = 0.05; } else if (f === 'straight') P.tense = 0.15;
      else if (f === 'flap' || f === 'charm') P.hands = f; else if (f === 'hum') P.note = 1; else if (f === 'rock') P.rx = 0.1; else if (f === 'tap') P.tap = 1;
      return P;
    }
    const k0 = this.react, moving = this.moving;
    if (k0 && EPISODIC[k0]) {
      if (this.reactOn > 0) this.reactOn -= dt;
      else { this.reactNext -= dt; if (this.reactNext <= 0) { const E = EPISODIC[k0]; this.reactOn = this.reactDur = E[2]; this.reactNext = E[0] + Math.random() * (E[1] - E[0]); } }
    } else this.reactOn = 0;
    let k = k0, on = this.reactOn > 0 ? Math.sin(Math.PI * clamp(1 - this.reactOn / this.reactDur)) : 0;
    if (this.onceOn > 0) { this.onceOn -= dt; k = this.onceK; on = Math.sin(Math.PI * clamp(1 - this.onceOn / this.onceDur)); }
    switch (k) {
      case 'squint': P.eye = 0.45; P.rx = 0.06; break;
      case 'lean': P.rx = 0.1; P.eye = 1.12; break;
      case 'tense': P.tense = 0.4; break;
      case 'ears': if (on > 0.05 && !moving) P.hands = this.reactO.aid ? 'ear1' : 'ears'; break;
      case 'look': P.ry = Math.sin(t * 2.2) * 0.4 * on; break;
      case 'droop': P.rx = 0.06; P.sy = 0.97; P.ry = Math.sin(t * 2.2) * 0.3 * on; break;
      case 'tilt': P.rz = 0.14 * on; break;
      case 'lean_back': P.rx = -0.08 * on; if (on > 0.6) P.eye = 0.12; break;
      case 'yawn': P.mouthO = on > 0.2; P.sy = 1 + 0.06 * on; break;
      case 'glance': P.ry = 0.6 * on; break;
      case 'sigh': P.sy = 1 - 0.05 * on; P.rx = 0.03 * on; break;
      default: break;
    }
    // the comfort move: only when standing still, never during hands-to-ears
    const lvl = this.comfortLevel;
    if (lvl > 0 && this.comfortKind && !moving) {
      if (this.comfortOn > 0) this.comfortOn -= dt;
      else { this.comfortNext -= dt * (lvl >= 1 ? 1 : 0.6); if (this.comfortNext <= 0 && !P.hands) { this.comfortOn = this.comfortDur = 1.2 + Math.random() * 0.8; this.comfortNext = (5 + Math.random() * 4) / Math.max(0.3, this.comfortFreq); this.comfortStarted = this.comfortKind; } }
    } else this.comfortOn = 0;
    const tt = this.comfortDur - this.comfortOn;
    const c = this.comfortOn > 0 && !P.hands ? clamp(Math.min(1, tt * 4, this.comfortOn * 4)) * Math.min(1, lvl) : 0;
    if (c > 0) {
      const wheels = this.look.wheels;
      switch (this.comfortKind) {
        case 'hum': P.rz += Math.sin(t * Math.PI * 3.2) * 0.05 * c; P.note = c; break;
        case 'tap': P.tap = c; break;
        case 'rock': P.rx += Math.sin(t * Math.PI * 1.6) * 0.1 * c; break;
        // on wheels: a slow turn of the chair one way and back, not a twirl
        case 'spin': P.spin = wheels ? Math.sin(clamp(tt / this.comfortDur) * Math.PI * 2) * 0.55 * c : Math.PI * 2 * easeIO(clamp(tt / Math.min(1.2, this.comfortDur))); break;
        case 'flap': P.hands = 'flap'; break;
        case 'pace': if (wheels) P.pzz += Math.sin(tt * Math.PI * 1.2) * 0.2 * c; else P.px += Math.sin(tt * Math.PI * 1.2) * 0.2 * c; break;
        case 'charm': P.hands = 'charm'; break;
        default: break;
      }
    }
    this.comfortActive = c;
    return P;
  }
  faceToward(x, z) { this.heading = Math.atan2(x - this.root.position.x, z - this.root.position.z); }
  update(dt) {
    this.time += dt;
    const t = this.time;
    const moving = this.speed > 0.05; this.moving = moving;
    this.phase += dt * (moving ? 7 + this.speed * 5 : 0);
    let bob = moving && !this.look.wheels ? Math.abs(Math.sin(this.phase)) * 0.09 * this.S * 2 : 0;
    if (this.hopT > 0) { this.hopT -= dt; bob += Math.sin((1 - this.hopT / 0.45) * Math.PI) * 0.22; }
    const breathe = Math.sin(t * 2.1 + this.seed) * 0.014;
    const sq = moving && !this.look.wheels ? Math.sin(this.phase * 2) * 0.04 : breathe;
    const P = this.poseNow = this.posePlan(dt); const z = this.pz;
    for (const key of ['rx', 'rz', 'ry', 'px', 'pzz', 'sy', 'tense']) z[key] = this.fixedPose ? P[key] : damp(z[key], P[key], 7, dt);
    const tq = Math.max(this.tense, z.tense) * 0.07;
    this.rig.position.y = this.baseY + bob - tq * this.S;
    const s = this.S;
    this.rig.scale.set(s * (1 - sq * 0.5 + tq * 0.4), s * (1 + sq - tq) * z.sy, s * (1 - sq * 0.5 + tq * 0.4));
    this.rig.position.x = z.px; this.rig.position.z = z.pzz;
    // the chair rolls and turns with you (pace and spin on wheels); leans and looks stay in the body
    if (this.chair) { this.chair.position.z = this.look.wheels ? z.pzz : 0; this.chair.rotation.y = this.look.wheels ? P.spin : 0; }
    this.rig.rotation.x = (moving ? 0.07 * Math.min(1, this.speed) : 0) + z.rx;
    this.rig.rotation.z = z.rz; this.rig.rotation.y = z.ry + P.spin;
    this.root.rotation.y = angDamp(this.root.rotation.y, this.heading, 10, dt);
    // timers run in both forms; the parts that show them only in the near form
    this.waving = this.wave > 0; if (this.waving) this.wave -= dt;
    this.blinkT -= dt;
    let eyeY = this.tense > 0.3 ? 0.55 : 1;
    if (this.blinkT < 0) { eyeY = 0.1; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4; }
    this.eyeY = eyeY;
    if (this.form === 'near') {
      if (this.wheels) for (const w of this.wheels) w.rotation.x -= this.speed * dt * 6;
      this.poseParts(dt);
    }
  }
  // feet stepping, hands swinging (and waving), eyes blinking: the near rig's pose for the current moment
  poseParts(dt = 1 / 60) {
    const S = this.S, moving = this.moving;
    if (this.footL) {
      const a = moving ? Math.sin(this.phase) : 0;
      this.footL.position.z = S * (0.08 + a * 0.28); this.footR.position.z = S * (0.08 - a * 0.28);
      this.footL.position.y = S * (0.1 + Math.max(0, a) * 0.14); this.footR.position.y = S * (0.1 + Math.max(0, -a) * 0.14);
    }
    const h = this.hands, a = moving ? Math.sin(this.phase) * 0.18 : 0; const P = this.poseNow || {};
    h[0].position.z = h[0].userData.base.z - a; h[1].position.z = h[1].userData.base.z + a;
    h[0].position.x = h[0].userData.base.x; h[0].position.y = h[0].userData.base.y; h[1].position.x = h[1].userData.base.x;
    h[1].position.y = this.waving ? h[1].userData.base.y + 0.35 + Math.sin(this.time * 16) * 0.12 : h[1].userData.base.y;
    // hands to ears, flapping, holding a charm: blend from the resting hands
    if (P.hands) this.handMode = P.hands;
    this.handK = this.fixedPose ? (P.hands ? 1 : 0) : damp(this.handK, P.hands ? 1 : 0, 12, dt);
    if (this.handK > 0.01 && this.handMode) {
      const m = this.handMode, k = this.handK;
      for (let i = 0; i < 2; i++) {
        const H = h[i], u = H.userData; let tgt = null;
        if (m === 'ears' || (m === 'ear1' && i === 1)) tgt = u.ear;
        else if (m === 'flap') { tgt = _t.copy(u.flap); tgt.y += Math.sin(this.time * 31) * 0.07; }
        else if (m === 'charm' && i === 1) tgt = this.charmAt;
        if (tgt) H.position.lerp(tgt, k);
      }
    }
    if (this.charm) this.charm.visible = this.handMode === 'charm' && this.handK > 0.3;
    if (this.handMode === 'charm' && this.handK > 0.3) this.ensureCharm();
    // a foot taps (on wheels, fingers drum on the rim)
    if (P.tap) { const b = Math.abs(Math.sin(this.time * Math.PI * 6)) * P.tap; if (this.footR) this.footR.position.y += b * S * 0.16; else h[1].position.y += b * 0.08; }
    // humming: a note drifts up
    if (P.note > 0.02) { this.ensureNote(); const n = this.note; n.visible = true; const ph = (this.time * 0.6) % 1; n.position.set(0.55, 1.15 + ph * 0.6, 0.2); n.material.opacity = P.note * 0.9 * Math.sin(Math.PI * ph); } else if (this.note) this.note.visible = false;
    if (P.mouthO !== undefined && this.expr === 'neutral') { this.mouthO.visible = !!P.mouthO; this.mouth.visible = !P.mouthO; }
    this.eyeMul = this.fixedPose ? (P.eye || 1) : damp(this.eyeMul, P.eye || 1, 10, dt);
    // Both eyes squash about the point between them. On a lopsided (blobby) face one eye sits a little higher than the
    // other, so a slight turn keeps each eye at its own height, as if each squashed about its own centre.
    const s = clamp(this.eyeY * this.eyeMul, 0.08, 1.2), dx = this.eyeOff.x, dy = this.eyeOff.y;
    const rz = s === 1 || !dy ? 0 : Math.asin(clamp(dy / Math.hypot(dx, s * dy), -1, 1)) - Math.atan2(s * dy, dx);
    for (const e of this.eyes) { e.scale.y = s; e.rotation.z = rz; }
  }
}
