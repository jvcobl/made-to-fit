// Creatures: one parametric body (superellipsoid + spikes + blob) so a look can drift smoothly toward the Standard Resident.
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
let blobTex = null;
function shadowTex() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(30,20,30,0.55)'); g.addColorStop(1, 'rgba(30,20,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}

let nextSeed = 101;
export class Creature {
  constructor(look, o = {}) {
    this.o = o;
    this.look = Object.assign({}, STANDARD, look);
    this.seed = o.seed || nextSeed++;
    this.size = o.scale || 1;
    this.low = o.lod === 'low';
    this.drift = 0; this.tense = 0; this.speed = 0; this.heading = 0; this.phase = 0; this.time = Math.random() * 10;
    this.blinkT = 1 + Math.random() * 3; this.hopT = 0; this.expr = 'neutral'; this.wave = 0; this.stare = null;
    this.root = new THREE.Group(); this.root.userData.creature = this;
    this.rig = new THREE.Group(); this.root.add(this.rig);
    const S = 0.5 * this.size; this.S = S;
    this.rig.scale.setScalar(S);
    this.bodyMat = M('#ffffff', 0.58);
    this.partMat = M(this.look.color, 0.6);
    this.footMat = M(shadeHex(this.look.color, -0.18), 0.7);
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.bodyMat);
    this.body.castShadow = true; this.body.receiveShadow = !this.low;
    this.rig.add(this.body);
    this.face = new THREE.Group(); this.top = new THREE.Group(); this.wear = new THREE.Group(); this.gear = new THREE.Group(); this.stdTop = new THREE.Group();
    this.rig.add(this.face, this.top, this.wear, this.gear, this.stdTop);
    this.feet = new THREE.Group(); this.root.add(this.feet);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015; blob.scale.setScalar(S * 2.6); this.root.add(blob); this.blob = blob;
    this.params = null; this.texKey = '';
    this.wearing = { headphones: false, shades: false };
    this.rebuild(true);
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
    }
    this.top.scale.setScalar(Math.max(0.0001, L.partScale)); this.wear.scale.setScalar(Math.max(0.0001, L.partScale));
    this.stdTop.scale.setScalar(Math.max(0.0001, L.stdScale)); this.stdTop.visible = L.stdScale > 0.01;
    this.top.visible = L.partScale > 0.01; this.wear.visible = L.partScale > 0.01;
  }
  setLook(look) { this.look = Object.assign({}, STANDARD, look); this.params = null; this.texKey = ''; this.rebuild(true); }
  setDrift(d) { d = clamp(d); if (Math.abs(d - this.drift) < 0.004) return; this.drift = d; this.rebuild(false); }
  placeParts() {
    const p = this.params, look = this.look;
    for (const g of [this.face, this.top, this.wear, this.stdTop, this.feet, this.gear]) { while (g.children.length) { const c = g.children.pop(); c.traverse((o) => { if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); }); } }
    if (this.chair) { this.root.remove(this.chair); this.chair = null; }
    // face
    this.eyes = []; this.arcs = [];
    for (const sx of [-1, 1]) {
      const pos = surf(sx * 0.34, 0.2, 0.92, p, -0.035);
      const e = new THREE.Mesh(G.eye, BLACK); e.position.copy(pos); this.face.add(e); this.eyes.push(e);
      const h = new THREE.Mesh(G.hl, WHITE); h.position.set(0.04, 0.045, 0.1); e.add(h);
      const a = new THREE.Mesh(G.arc, BLACK); a.position.copy(pos).add(new THREE.Vector3(0, -0.02, 0.03)); a.visible = false; this.face.add(a); this.arcs.push(a);
      if (!this.low) { const ch = new THREE.Mesh(G.cheek, CHEEK); const cp = surf(sx * 0.58, -0.04, 0.8, p, 0.012); ch.position.copy(cp); ch.lookAt(cp.clone().multiplyScalar(2)); this.face.add(ch); }
    }
    const mp = surf(0, -0.06, 1, p, 0.0);
    this.mouth = new THREE.Mesh(G.mouth, BLACK); this.mouth.position.copy(mp); this.mouth.rotation.z = Math.PI; this.face.add(this.mouth);
    this.mouthO = new THREE.Mesh(G.ring, BLACK); this.mouthO.position.copy(mp); this.mouthO.visible = false; this.face.add(this.mouthO);
    // hands
    this.hands = [];
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(G.hand, this.partMat); h.position.copy(surf(sx, -0.3, 0.12, p, -0.06)); h.castShadow = false; this.face.add(h); this.hands.push(h); this.hands[this.hands.length - 1].userData.base = h.position.clone(); }
    // top
    this.buildTop(this.top, look.top, p, this.partMat);
    this.buildTop(this.stdTop, 'ears', lookParams(STANDARD), M(STANDARD.color, 0.6));
    this.buildWear(look.wear, p);
    this.buildGear(p);
    // feet or chair
    const S = this.S;
    if (look.wheels) this.buildChair(p);
    else {
      this.footL = new THREE.Mesh(G.foot, this.footMat); this.footR = new THREE.Mesh(G.foot, this.footMat);
      for (const [f, sx] of [[this.footL, -1], [this.footR, 1]]) { f.scale.set(S * 0.95, S * 0.55, S * 1.25); f.position.set(sx * S * 0.38 * p.width, S * 0.1, S * 0.08); f.castShadow = false; this.feet.add(f); }
    }
    this.baseY = (0.86 * p.height) * S + (look.wheels ? S * 0.86 : S * 0.1);
    this.topY = (p.height + 0.1) * S + this.baseY;
  }
  buildTop(g, kind, p, mat) {
    const inner = M('#ff9fb3', 0.7);
    if (kind === 'ears') {
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), mat); m.scale.set(1, 1, 0.55); m.position.copy(surf(sx * 0.55, 0.84, 0.02, p, -0.04)); m.rotation.z = -sx * 0.35; g.add(m); const i = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), inner); i.position.set(0, 0, 0.145); m.add(i); }
    } else if (kind === 'longears') {
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 4, 10), mat); const b = surf(sx * 0.32, 0.95, 0, p, -0.05); m.position.copy(b).add(new THREE.Vector3(sx * 0.12, 0.38, 0)); m.rotation.z = -sx * 0.32; m.scale.set(1, 1, 0.6); g.add(m); const i = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), inner); i.position.set(0, 0.02, 0.06); i.scale.set(1, 1, 0.4); m.add(i); }
    } else if (kind === 'horns') {
      const hm = M('#f3e6c8', 0.45);
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.44, 12), hm); const b = surf(sx * 0.42, 0.88, 0.12, p, -0.03); m.position.copy(b).add(new THREE.Vector3(sx * 0.08, 0.18, 0)); m.rotation.z = -sx * 0.45; g.add(m); }
    } else if (kind === 'antennae') {
      const tip = M(shadeHex(this.look.color, -0.35), 0.4);
      for (const sx of [-1, 1]) { const b = surf(sx * 0.22, 0.97, 0.05, p, -0.03); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 6), M('#3a3340', 0.5)); s.position.copy(b).add(new THREE.Vector3(sx * 0.08, 0.24, 0)); s.rotation.z = -sx * 0.3; g.add(s); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), tip); ball.position.set(0, 0.27, 0); s.add(ball); }
    } else if (kind === 'tuft') {
      const b = surf(0, 1, 0, p, -0.05);
      for (const a of [-0.45, 0, 0.45]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), mat); c.position.copy(b).add(new THREE.Vector3(Math.sin(a) * 0.14, 0.13, 0)); c.rotation.z = -a; g.add(c); }
    }
  }
  buildWear(kind, p) {
    const g = this.wear;
    if (kind === 'scarf') {
      const y = -0.28 * p.height; const r = surf(1, -0.28, 0, p).x;
      const t = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.12, 10, 28), M('#d9603b', 0.85)); t.rotation.x = Math.PI / 2; t.position.y = y; t.scale.set(1, (surf(0, -0.28, 1, p).z + 0.02) / (r + 0.02), 1); g.add(t);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.1), M('#d9603b', 0.85)); tail.position.copy(surf(0.4, -0.45, 0.85, p, 0.05)); tail.rotation.z = 0.25; g.add(tail);
    } else if (kind === 'leaf') {
      const b = surf(0.15, 1, 0, p, -0.02);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), M('#6fae5b', 0.6)); l.scale.set(1, 0.16, 0.48); l.position.copy(b).add(new THREE.Vector3(0.16, 0.08, 0)); l.rotation.set(0.1, 0.6, 0.35); g.add(l);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 5), M('#4e7a3f', 0.7)); s.position.copy(b).add(new THREE.Vector3(0, 0.05, 0)); g.add(s);
    } else if (kind === 'bow') {
      const b = surf(0.55, 0.78, 0.25, p, -0.02); const bm = M('#ef6f9f', 0.5);
      for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 10), bm); c.rotation.z = sx * Math.PI / 2; c.position.copy(b).add(new THREE.Vector3(sx * 0.13, 0.06, 0)); g.add(c); }
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bm); k.position.copy(b).add(new THREE.Vector3(0, 0.06, 0)); g.add(k);
    } else if (kind === 'glasses') {
      const gm = M('#2b2530', 0.35);
      for (const e of this.eyes) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 6, 20), gm); r.position.copy(e.position).add(new THREE.Vector3(0, 0, 0.07)); g.add(r); }
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 5), gm); br.rotation.z = Math.PI / 2; br.position.copy(this.eyes[0].position).lerp(this.eyes[1].position, 0.5).add(new THREE.Vector3(0, 0.02, 0.07)); g.add(br);
    } else if (kind === 'hat') {
      const b = surf(0, 1, 0, p, -0.06); const hm = M('#3f5a87', 0.75);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 20), hm); crown.position.copy(b).add(new THREE.Vector3(0, 0.2, 0)); g.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 24), hm); brim.position.copy(b).add(new THREE.Vector3(0, 0.02, 0)); g.add(brim);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.09, 20), M('#e2b34c', 0.6)); band.position.copy(b).add(new THREE.Vector3(0, 0.08, 0)); g.add(band);
      g.rotation.z = 0.08;
    } else if (kind === 'flower') {
      const b = surf(-0.5, 0.78, 0.3, p, 0.0);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), M('#f2c14e', 0.5)); c.position.copy(b); g.add(c);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M(i % 2 ? '#ffffff' : '#ffd6e4', 0.6)); pe.position.copy(b).add(new THREE.Vector3(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.02)); g.add(pe); }
    }
  }
  buildGear(p) {
    const g = this.gear; this.gearParts = {};
    const hp = new THREE.Group();
    const r = surf(1, 0.25, 0, p).x;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.05, 8, 24, Math.PI), M('#2f3a4a', 0.4)); band.position.y = 0.25 * p.height; band.scale.y = (p.height * 0.95) / (r + 0.06); hp.add(band);
    for (const sx of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 18), M('#2f3a4a', 0.35)); cup.rotation.z = Math.PI / 2; cup.position.set(sx * (r + 0.05), 0.2 * p.height, 0); hp.add(cup); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), M('#4fb3a9', 0.5)); pad.rotation.z = Math.PI / 2; pad.position.set(sx * (r + 0.14), 0.2 * p.height, 0); hp.add(pad); }
    hp.visible = this.wearing.headphones; g.add(hp); this.gearParts.headphones = hp;
    const sh = new THREE.Group(); const sm = M('#16161c', 0.12, { metalness: 0.3 });
    for (const e of this.eyes) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.05), sm); l.position.copy(e.position).add(new THREE.Vector3(0, 0.01, 0.08)); sh.add(l); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), sm); br.position.copy(this.eyes[0].position).lerp(this.eyes[1].position, 0.5).add(new THREE.Vector3(0, 0.05, 0.08)); sh.add(br);
    sh.visible = this.wearing.shades; g.add(sh); this.gearParts.shades = sh;
  }
  buildChair(p) {
    const ch = new THREE.Group(); const S = this.S; ch.scale.setScalar(S);
    const frame = M('#3d4b5c', 0.4, { metalness: 0.4 }); const tire = M('#2a2a30', 0.8); const seat = M('#4f6f8f', 0.7);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.4), seat); st.position.y = 0.78; ch.add(st);
    this.wheels = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(sx * (p.width + 0.2), 0.66, -0.05);
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 28), tire); t.rotation.y = Math.PI / 2; w.add(t);
      const hub = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 24), frame); hub.rotation.y = Math.PI / 2; w.add(hub);
      for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 0.03), frame); s.rotation.x = i * Math.PI / 4; w.add(s); }
      ch.add(w); this.wheels.push(w);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), tire); c.position.set(sx * 0.55, 0.13, 0.62); ch.add(c);
    }
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), frame); fr.position.set(0, 0.3, 0.75); ch.add(fr);
    ch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(ch); this.chair = ch;
  }
  setGear(name, on) { this.wearing[name] = on; if (this.gearParts && this.gearParts[name]) this.gearParts[name].visible = on; }
  setExpression(e) {
    this.expr = e;
    const happy = e === 'happy';
    this.eyes.forEach((m) => { m.visible = !happy; }); this.arcs.forEach((m) => { m.visible = happy; });
    this.mouth.visible = e !== 'surprised'; this.mouthO.visible = e === 'surprised';
    this.mouth.rotation.z = e === 'sad' ? 0 : Math.PI;
    this.mouth.scale.set(e === 'happy' ? 1.35 : 1, e === 'tense' ? 0.25 : e === 'happy' ? 1.4 : 1, 1);
  }
  hop() { this.hopT = 0.45; }
  faceToward(x, z) { this.heading = Math.atan2(x - this.root.position.x, z - this.root.position.z); }
  update(dt) {
    this.time += dt;
    const t = this.time;
    const moving = this.speed > 0.05;
    this.phase += dt * (moving ? 7 + this.speed * 5 : 0);
    let bob = moving && !this.look.wheels ? Math.abs(Math.sin(this.phase)) * 0.09 * this.S * 2 : 0;
    if (this.hopT > 0) { this.hopT -= dt; bob += Math.sin((1 - this.hopT / 0.45) * Math.PI) * 0.22; }
    const breathe = Math.sin(t * 2.1 + this.seed) * 0.014;
    const sq = moving && !this.look.wheels ? Math.sin(this.phase * 2) * 0.04 : breathe;
    const tq = this.tense * 0.07;
    this.rig.position.y = this.baseY + bob - tq * this.S;
    const s = this.S;
    this.rig.scale.set(s * (1 - sq * 0.5 + tq * 0.4), s * (1 + sq - tq), s * (1 - sq * 0.5 + tq * 0.4));
    this.rig.position.x = this.tense > 0.05 ? Math.sin(t * 47) * 0.012 * this.tense : 0;
    this.rig.rotation.x = moving ? 0.07 * Math.min(1, this.speed) : 0;
    this.root.rotation.y = angDamp(this.root.rotation.y, this.heading, 10, dt);
    if (this.footL) {
      const a = moving ? Math.sin(this.phase) : 0;
      this.footL.position.z = this.S * (0.08 + a * 0.28); this.footR.position.z = this.S * (0.08 - a * 0.28);
      this.footL.position.y = this.S * (0.1 + Math.max(0, a) * 0.14); this.footR.position.y = this.S * (0.1 + Math.max(0, -a) * 0.14);
    }
    if (this.wheels) for (const w of this.wheels) w.rotation.x -= this.speed * dt * 6;
    if (this.hands) {
      const a = moving ? Math.sin(this.phase) * 0.18 : 0;
      this.hands[0].position.z = this.hands[0].userData.base.z - a; this.hands[1].position.z = this.hands[1].userData.base.z + a;
      if (this.wave > 0) { this.wave -= dt; this.hands[1].position.y = this.hands[1].userData.base.y + 0.35 + Math.sin(t * 16) * 0.12; } else this.hands[1].position.y = this.hands[1].userData.base.y;
    }
    this.blinkT -= dt;
    let eyeY = this.tense > 0.3 ? 0.55 : 1;
    if (this.blinkT < 0) { eyeY = 0.1; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4; }
    for (const e of this.eyes) e.scale.y = eyeY;
  }
}
