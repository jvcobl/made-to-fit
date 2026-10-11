// Interiors as cutaway dioramas: your home, the Works office, the Town Hall chamber.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, mtx, signMesh } from './town.js';
import { Creature, STANDARD } from './creature.js';
import { PAL, sampleTOD } from './palette.js';
import { clamp, lerp, now } from './util.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o));

class Room {
  constructor(id, w, d, h, o = {}) {
    this.id = id; this.w = w; this.d = d; this.h = h;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(o.bg || '#1d1b26');
    this.scene.fog = new THREE.Fog(o.bg || '#1d1b26', 28, 60);
    this.batch = new Batch(); this.blocks = []; this.inter = []; this.spots = {}; this.objs = {};
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.bounds = [-w / 2 + 0.45, -d / 2 + 0.45, w / 2 - 0.4, d / 2 - 0.3];
    const B = this.batch;
    // floor with planks or tiles
    const n = o.tiles ? Math.round(w) : Math.round(w / 0.5);
    for (let i = 0; i < n; i++) {
      const sw = w / n; const c = new THREE.Color(o.floor).multiplyScalar(i % 2 ? 1 : (o.tiles ? 0.97 : 0.93)).getHexString();
      B.add(new THREE.BoxGeometry(sw - 0.01, 0.12, d), '#' + c, mtx(-w / 2 + (i + 0.5) * sw, -0.06, 0));
    }
    B.add(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), '#2a2530', mtx(0, -0.38, 0));
    // back wall + left wall, with baseboards
    B.add(new THREE.BoxGeometry(w + 0.3, h, 0.25), o.wall, mtx(0, h / 2, -d / 2 - 0.12), { ao: [-h / 2, -h / 2 + 1.3, 0.8] });
    B.add(new THREE.BoxGeometry(0.25, h, d + 0.3), o.wall2 || o.wall, mtx(-w / 2 - 0.12, h / 2, 0), { ao: [-h / 2, -h / 2 + 1.3, 0.8] });
    B.add(new THREE.BoxGeometry(w + 0.3, 0.16, 0.05), o.trim || PAL.trim, mtx(0, 0.08, -d / 2 + 0.02));
    B.add(new THREE.BoxGeometry(0.05, 0.16, d + 0.3), o.trim || PAL.trim, mtx(-w / 2 + 0.02, 0.08, 0));
    B.add(new THREE.BoxGeometry(w + 0.3, 0.12, 0.3), o.trim || PAL.trim, mtx(0, h + 0.06, -d / 2 - 0.12));
    B.add(new THREE.BoxGeometry(0.3, 0.12, d + 0.3), o.trim || PAL.trim, mtx(-w / 2 - 0.12, h + 0.06, 0));
    this.hemi = new THREE.HemisphereLight('#fff4e0', '#3a3040', 0.7); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#fff1dc', 1.2); this.key.position.set(4, 9, 6); this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024); Object.assign(this.key.shadow.camera, { left: -w, right: w, top: d, bottom: -d, near: 1, far: 40 }); this.key.shadow.bias = -0.0005; this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key, this.key.target);
  }
  block(x0, z0, x1, z1) { this.blocks.push([x0, z0, x1, z1]); }
  walkable(x, z) { const b = this.bounds; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return false; for (const k of this.blocks) if (x > k[0] && x < k[2] && z > k[1] && z < k[3]) return false; return true; }
  finish() { const m = this.batch.mesh(this.mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }
  windowPane(x, y, z, w, h, side = false) {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(side ? 0.05 : w, h, side ? w : 0.05), new THREE.MeshStandardMaterial({ color: '#cfe6f2', emissive: '#cfe6f2', emissiveIntensity: 0.55, roughness: 0.2 }));
    glass.position.set(x, y, z); this.scene.add(glass);
    const fr = (gw, gh, gx, gy) => this.batch.add(new THREE.BoxGeometry(side ? 0.12 : gw, gh, side ? gw : 0.12), PAL.trim, side ? mtx(x + 0.03, gy, z + gx) : mtx(x + gx, gy, z + 0.03));
    fr(w + 0.16, 0.1, 0, y + h / 2); fr(w + 0.16, 0.1, 0, y - h / 2); fr(0.1, h, -w / 2, y); fr(0.1, h, w / 2, y); fr(0.06, h, 0, y);
    return glass;
  }
  desk(x, z, ry = 0, top = PAL.wood) {
    const M = (lx, ly, lz) => new THREE.Matrix4().multiplyMatrices(mtx(x, 0, z, ry), mtx(lx, ly, lz));
    this.batch.add(new RoundedBoxGeometry(1.8, 0.08, 0.85, 1, 0.03), top, M(0, 0.76, 0));
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.35, 0.35]) this.batch.add(new THREE.BoxGeometry(0.06, 0.76, 0.06), PAL.metal, M(sx, 0.38, sz));
  }
  chair(x, z, ry = 0, c = '#4f6f8f') {
    const M = (lx, ly, lz) => new THREE.Matrix4().multiplyMatrices(mtx(x, 0, z, ry), mtx(lx, ly, lz));
    this.batch.add(new RoundedBoxGeometry(0.6, 0.1, 0.6, 1, 0.04), c, M(0, 0.46, 0));
    this.batch.add(new RoundedBoxGeometry(0.6, 0.6, 0.08, 1, 0.04), c, M(0, 0.8, 0.28));
    this.batch.add(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), PAL.metal, M(0, 0.22, 0));
  }
  update() {}
}

// ---------- home: the one place that fits you exactly ----------
export class Home extends Room {
  constructor() {
    super('home', 8, 6, 3.2, { floor: '#c99b6d', wall: '#efe0c6', wall2: '#e8d6b8' });
    const B = this.batch;
    // bed, nightstand, rug
    B.add(new RoundedBoxGeometry(2.0, 0.45, 2.6, 2, 0.08), '#a8754f', mtx(-2.8, 0.25, -1.5));
    B.add(new RoundedBoxGeometry(1.9, 0.25, 2.45, 2, 0.12), '#f6efe2', mtx(-2.8, 0.58, -1.45));
    B.add(new RoundedBoxGeometry(1.95, 0.12, 1.6, 2, 0.06), '#93c2ee', mtx(-2.8, 0.72, -0.85));
    B.add(new RoundedBoxGeometry(0.9, 0.2, 0.5, 2, 0.08), '#fbf6ee', mtx(-2.8, 0.78, -2.45));
    B.add(new RoundedBoxGeometry(0.7, 0.6, 0.6, 1, 0.05), '#8a5a3c', mtx(-1.4, 0.3, -2.55));
    B.add(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 40), '#d9603b', mtx(0.4, 0.015, 0.6));
    B.add(new THREE.CylinderGeometry(1.0, 1.0, 0.035, 40), '#e2b34c', mtx(0.4, 0.02, 0.6));
    this.block(-3.9, -2.9, -1.7, -0.1); this.block(-1.8, -2.9, -1.0, -2.2);
    // desk + chair along the back wall
    this.desk(0.2, -2.45); this.chair(0.2, -1.7, Math.PI, '#6d7f5a'); this.block(-0.75, -2.95, 1.15, -1.95);
    // shelf + radio
    B.add(new RoundedBoxGeometry(1.6, 0.08, 0.4, 1, 0.02), PAL.wood, mtx(2.6, 1.5, -2.78));
    B.add(new RoundedBoxGeometry(1.6, 0.08, 0.4, 1, 0.02), PAL.wood, mtx(2.6, 2.2, -2.78));
    for (let i = 0; i < 5; i++) B.add(new THREE.BoxGeometry(0.12, 0.38 + (i % 3) * 0.06, 0.3), ['#c8553d', '#4f6f8f', '#e2b34c', '#6d7f5a', '#7a4e6e'][i], mtx(2.05 + i * 0.16, 2.43, -2.78));
    // moving boxes: empty, for now
    B.add(new RoundedBoxGeometry(0.8, 0.6, 0.6, 1, 0.03), '#c8a77d', mtx(3.2, 0.3, 1.9, 0.2));
    B.add(new RoundedBoxGeometry(0.6, 0.45, 0.5, 1, 0.03), '#d4b58a', mtx(3.15, 0.83, 1.85, -0.3));
    B.add(new RoundedBoxGeometry(0.7, 0.5, 0.6, 1, 0.03), '#c8a77d', mtx(2.4, 0.25, 2.3, 0.5));
    this.block(1.9, 1.4, 3.9, 2.8);
    // plant
    B.add(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 12), '#c8553d', mtx(-3.5, 0.23, 1.9));
    for (let i = 0; i < 6; i++) B.add(new THREE.SphereGeometry(0.22, 8, 6), '#6fae5b', mtx(-3.5 + Math.cos(i) * 0.18, 0.7 + (i % 3) * 0.15, 1.9 + Math.sin(i) * 0.18));
    this.block(-3.9, 1.5, -3.1, 2.3);
    // window with curtains
    this.glass = this.windowPane(2.3, 1.75, -2.98, 1.6, 1.2);
    // the jar on the sill: kept moments, up to twelve, and then it simply glows
    B.add(new RoundedBoxGeometry(1.9, 0.06, 0.26, 1, 0.02), PAL.wood, mtx(2.3, 1.1, -2.84));
    const jar = new THREE.Group(); jar.position.set(2.85, 1.13, -2.82);
    const jg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#dff1f5', transparent: true, opacity: 0.32, roughness: 0.08, emissive: '#ffcf7a', emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false }));
    jg.position.y = 0.15; jar.add(jg);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16), std('#a8754f')); lid.position.y = 0.32; jar.add(lid);
    this.marbles = [];
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffcf7a', emissiveIntensity: 1.2, roughness: 0.4 })); const a = i * 2.4; const r = i < 3 ? 0.05 : 0.07; m.position.set(Math.cos(a) * r, 0.04 + Math.floor(i / 4) * 0.065, Math.sin(a) * r); m.visible = false; jar.add(m); this.marbles.push(m); }
    this.jarGlass = jg; this.jarLight = new THREE.PointLight('#ffcf7a', 0, 2.2, 2); this.jarLight.position.set(0, 0.2, 0.1); jar.add(this.jarLight);
    this.scene.add(jar); this.jar = jar;
    // a small plant on the sill too
    B.add(new THREE.CylinderGeometry(0.09, 0.07, 0.14, 10), '#c8553d', mtx(1.75, 1.2, -2.82));
    for (let i = 0; i < 5; i++) B.add(new THREE.SphereGeometry(0.07, 7, 5), '#6fae5b', mtx(1.75 + Math.cos(i * 1.3) * 0.06, 1.33 + (i % 2) * 0.05, -2.82 + Math.sin(i * 1.3) * 0.05));
    this.curtains = [];
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.6, 0.08, 1, 0.03), std('#bfa9f0')); c.position.set(2.3 + sx * 1.0, 1.75, -2.88); this.scene.add(c); this.curtains.push(c); }
    // door on the left wall with its sign
    B.add(new THREE.BoxGeometry(0.1, 2.1, 1.1), '#4f6f8f', mtx(-3.93, 1.05, 1.6));
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), std('#fbf6ee')); this.sign.position.set(-3.86, 1.45, 1.6); this.sign.rotation.y = Math.PI / 2; this.scene.add(this.sign);
    this.spots.door = [-3.2, 1.6];
    // mirror, standing, angled toward the room
    const mg = new THREE.Group(); mg.position.set(3.3, 0, -0.6); mg.rotation.y = -1.0;
    const fr = new THREE.Mesh(new RoundedBoxGeometry(1.0, 2.0, 0.1, 2, 0.08), std('#a8754f')); fr.position.y = 1.15; mg.add(fr);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.8), new THREE.MeshStandardMaterial({ color: '#dfeef5', roughness: 0.05, metalness: 0.6, emissive: '#9fb8c8', emissiveIntensity: 0.25 })); gl.position.set(0, 1.15, 0.06); mg.add(gl);
    this.scene.add(mg); this.block(2.8, -1.2, 3.9, 0);
    this.spots.mirror = [2.1, -0.2]; this.spots.bed = [-1.4, -0.4]; this.spots.center = [0.3, 0.7];
    // the six things you set
    this.lampLight = new THREE.PointLight('#ffcf8a', 6, 9, 2); this.lampLight.position.set(-0.4, 1.45, -2.35); this.lampLight.castShadow = false; this.scene.add(this.lampLight);
    this.objs.lamp = this.group([
      [new THREE.CylinderGeometry(0.12, 0.16, 0.06, 12), '#2f3a4a', 0, 0.83, 0], [new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), '#2f3a4a', 0, 1.08, 0],
      [new THREE.ConeGeometry(0.22, 0.26, 16, 1, true), '#f6cf5b', 0, 1.42, 0], [new THREE.SphereGeometry(0.07, 10, 8), '#fff6d8', 0, 1.36, 0, { emissive: '#ffd88a', emissiveIntensity: 2 }],
    ], -0.4, -2.35);
    this.objs.note = this.group([[new THREE.BoxGeometry(0.34, 0.02, 0.46), '#fbf6ee', 0, 0.81, 0], [new THREE.BoxGeometry(0.03, 0.02, 0.3), '#c8553d', 0.12, 0.83, 0]], 0.75, -2.35, 0.2);
    this.objs.radio = this.group([[new RoundedBoxGeometry(0.62, 0.38, 0.28, 2, 0.05), '#c8553d', 0, 1.74, 0], [new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), '#fbf6ee', 0.13, 1.74, 0.15, { rx: Math.PI / 2 }], [new THREE.BoxGeometry(0.2, 0.2, 0.02), '#2f3a4a', -0.12, 1.74, 0.145], [new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), '#2f3a4a', 0.2, 2.05, 0, { rz: -0.4 }]], 2.9, -2.75);
    this.objs.clock = this.group([[new RoundedBoxGeometry(0.34, 0.28, 0.16, 2, 0.05), '#4fb3a9', 0, 0.75, 0], [new THREE.CircleGeometry(0.1, 16), '#fbf6ee', 0, 0.76, 0.085], [new THREE.SphereGeometry(0.05, 8, 6), '#e2b34c', -0.12, 0.92, 0], [new THREE.SphereGeometry(0.05, 8, 6), '#e2b34c', 0.12, 0.92, 0]], -1.4, -2.45);
    this.objs.calendar = this.group([[new THREE.BoxGeometry(0.7, 0.85, 0.03), '#fbf6ee', 0, 1.85, 0], [new THREE.BoxGeometry(0.7, 0.16, 0.035), '#c8553d', 0, 2.2, 0.002]], -1.2, -2.97);
    this.calTex = null;
    this.objs.sign = { group: this.sign, pos: new THREE.Vector3(-3.86, 1.45, 1.6) };
    this.objs.mirror = { group: mg, pos: new THREE.Vector3(3.3, 1.2, -0.6) };
    this.inter = [
      { id: 'lamp', kind: 'set', x: -0.4, z: -1.6, r: 1.1, label: 'The lamp' }, { id: 'note', kind: 'set', x: 0.8, z: -1.6, r: 1.0, label: 'Your house rules' },
      { id: 'radio', kind: 'set', x: 2.8, z: -1.9, r: 1.1, label: 'The radio' }, { id: 'clock', kind: 'set', x: -1.3, z: -1.7, r: 1.0, label: 'The alarm clock' },
      { id: 'calendar', kind: 'set', x: -1.2, z: -2.0, r: 1.0, label: 'The calendar' }, { id: 'sign', kind: 'set', x: -3.1, z: 1.6, r: 1.1, label: 'The door sign' },
      { id: 'mirror', kind: 'mirror', x: 2.2, z: -0.3, r: 1.1, label: 'The mirror' }, { id: 'bed', kind: 'bed', x: -1.5, z: -0.6, r: 1.2, label: 'Go to bed' },
      { id: 'out', kind: 'exit', x: -3.2, z: 1.6, r: 1.1, label: 'Head out' },
    ];
    this.spawn = [0.4, 1.2];
    this.cam = { pos: new THREE.Vector3(5.6, 6.2, 8.4), look: new THREE.Vector3(-0.3, 0.9, -0.7), fov: 36 };
    this.key.position.set(3, 8, 5); this.key.intensity = 0.8;
    this.finish();
    this.setSign(0.5); this.setCalendar(0.5); this.prefs = { light: 0.5, sound: 0.5 };
  }
  group(parts, x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    for (const [geo, c, px, py, pz, o = {}] of parts) { const m = new THREE.Mesh(geo, std(c, { emissive: o.emissive || '#000000', emissiveIntensity: o.emissiveIntensity || 0, side: THREE.DoubleSide })); m.position.set(px, py, pz); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = true; g.add(m); }
    this.scene.add(g); return { group: g, pos: new THREE.Vector3(x, 1, z) };
  }
  setSign(v) { const t = v < 0.4 ? 'Drop by\nany time!' : v > 0.6 ? 'Text first,\nplease' : 'Knock if\nyou like'; this.sign.material.map = signMeshTex(t); this.sign.material.needsUpdate = true; }
  setCalendar(v) {
    const t = v > 0.6 ? 'MON gym 7:00\nTUE groceries\nWED call mom\nTHU laundry' : v < 0.4 ? 'see what\nhappens!' : 'a few plans,\nroom to roam';
    const m = this.objs.calendar.group.children[0]; m.material.map = signMeshTex(t, 256, 300, 26); m.material.needsUpdate = true;
  }
  setLight(v) { this.prefs.light = v; }
  setJar(list) {
    (list || []).forEach((m, i) => { if (this.marbles[i]) { this.marbles[i].visible = true; this.marbles[i].material.color.set(m.c); this.marbles[i].material.emissive.set(m.c); } });
    const full = (list || []).length >= 12; this.jarFull = full;
    this.jarGlass.material.emissiveIntensity = full ? 0.6 : 0; this.jarLight.intensity = full ? 1.6 : (list || []).length * 0.06;
  }
  setCurtains(open) { this.curtains.forEach((c, i) => { c.position.x = 2.3 + (i ? 1 : -1) * (open ? 1.0 : 0.42); c.scale.x = open ? 1 : 1.7; }); }
  update(dt, hour) {
    const t = sampleTOD(hour); const day = 1 - t.night;
    const L = this.prefs.light;
    this.lampLight.intensity = lerp(1.5, 16, L) * (0.45 + 0.55 * t.night);
    this.hemi.intensity = lerp(0.3, 0.95, L) * (0.55 + 0.45 * day);
    this.hemi.color.set('#fff4e0'); this.key.intensity = day * lerp(0.4, 1.4, L);
    this.glass.material.emissive.copy(t.hor).lerp(t.top, 0.4); this.glass.material.emissiveIntensity = 0.5 + day * 0.9;
    if (this.jarFull) { const k = 0.5 + Math.sin(now() / 900) * 0.15; this.jarGlass.material.emissiveIntensity = k; this.jarLight.intensity = 1.2 + k; }
  }
}
function signMeshTex(text, w = 256, h = 180, size = 40) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#fbf6ee'; x.fillRect(0, 0, w, h); x.fillStyle = '#3b2f2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 ' + size + 'px "Fredoka", "Nunito", ui-rounded, system-ui, sans-serif';
  const lines = text.split('\n'); lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- the Works: open plan, fluorescent, a little loud ----------
export class Office extends Room {
  constructor() {
    super('works', 16, 10, 3.8, { floor: '#8d9aa8', wall: '#e3e8ec', wall2: '#d9e0e6', tiles: true, bg: '#1b1e26' });
    const B = this.batch;
    for (let i = 0; i < 4; i++) this.windowPane(-5.4 + i * 3.6, 2.0, -4.97, 2.6, 1.6);
    B.add(new RoundedBoxGeometry(0.08, 1.3, 2.6, 1, 0.03), '#fbfdff', mtx(-7.9, 1.7, -1.5));
    this.addText('Q3: SYNERGY!!', -7.84, 1.75, -1.5, 2.2, 0.5, Math.PI / 2, '#c8553d');
    this.seats = []; this.panels = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = -4.4 + c * 3.3, z = -2.6 + r * 2.4;
      this.desk(x, z, 0, '#e9e3d6'); this.chair(x, z + 0.75, Math.PI, '#4f6f8f');
      B.add(new RoundedBoxGeometry(0.7, 0.45, 0.06, 1, 0.02), '#2b2530', mtx(x, 1.1, z - 0.25));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), std('#bfe3ff', { emissive: '#bfe3ff', emissiveIntensity: 1.1 })); scr.position.set(x, 1.1, z - 0.215); this.scene.add(scr);
      B.add(new THREE.BoxGeometry(0.06, 0.25, 0.06), '#2b2530', mtx(x, 0.88, z - 0.25));
      this.block(x - 0.95, z - 0.5, x + 0.95, z + 0.5);
      this.seats.push([x, z + 0.75]);
    }
    // ceiling panels: cold, bright, one of them flickers
    const pm = std('#f4fbff', { emissive: '#eef8ff', emissiveIntensity: 2.4 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.6), r === 1 && c === 2 ? pm.clone() : pm); p.position.set(-5.4 + c * 3.6, 3.55, -3 + r * 2.6); this.scene.add(p); this.panels.push(p);
      B.add(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), PAL.metal, mtx(-5.4 + c * 3.6, 3.72, -3 + r * 2.6));
    }
    this.flicker = this.panels[6];
    this.flk = { wait: 3 + Math.random() * 5, t: 0, dips: null };
    // Gil's glass office
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.28, roughness: 0.05 });
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3, 4.2), glass); g1.position.set(4.4, 1.5, -2.9); this.scene.add(g1);
    const g2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 0.06), glass); g2.position.set(6.1, 1.5, -0.8); this.scene.add(g2);
    this.desk(6.2, -3.6, 0, '#a8754f'); this.chair(6.2, -2.9, Math.PI, '#7a4e3c');
    this.addText('GIL · MANAGER', 6.1, 2.6, -0.76, 1.6, 0.3, 0, '#2f3a4a');
    this.block(4.3, -5, 7.9, -0.7);
    // coffee corner, cooler, plants, printer
    B.add(new RoundedBoxGeometry(1.6, 0.9, 0.6, 1, 0.04), '#5b6470', mtx(6.6, 0.45, 2.6)); B.add(new RoundedBoxGeometry(0.4, 0.5, 0.35, 1, 0.04), '#2b2530', mtx(6.4, 1.15, 2.55));
    B.add(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 14), '#e3e8ec', mtx(7.4, 0.55, 0.6)); B.add(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 14), '#9fd3f0', mtx(7.4, 1.33, 0.6));
    this.block(5.7, 2.2, 7.6, 3.0); this.block(7.0, 0.2, 7.8, 1.0);
    for (const [px, pz] of [[-7.3, 3.8], [3.9, -4.4]]) { B.add(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), '#5b6470', mtx(px, 0.25, pz)); for (let i = 0; i < 7; i++) B.add(new THREE.SphereGeometry(0.24, 8, 6), '#5f8f4e', mtx(px + Math.cos(i) * 0.2, 0.75 + (i % 3) * 0.22, pz + Math.sin(i) * 0.2)); this.block(px - 0.4, pz - 0.4, px + 0.4, pz + 0.4); }
    this.spots.door = [-6.8, 4.2]; this.spots.gil = [4.0, -0.2]; this.spots.mydesk = this.seats[6]; this.spots.front = [0, 3.6]; this.spots.board = [-6.9, -1.5];
    this.spawn = [-6.6, 4.0];
    this.inter = [{ id: 'out', kind: 'exit', x: -7.2, z: 4.4, r: 1.2, label: 'Step outside' }, { id: 'mydesk', kind: 'desk', x: this.seats[6][0], z: this.seats[6][1] + 0.2, r: 1.1, label: 'Sit at your desk' }];
    this.cam = { pos: new THREE.Vector3(7.8, 9.6, 12.4), look: new THREE.Vector3(-0.6, 0.6, -0.4), fov: 38 };
    this.hemi.color.set('#eaf4ff'); this.hemi.groundColor.set('#40444f'); this.hemi.intensity = 1.1;
    this.key.color.set('#eef6ff'); this.key.intensity = 1.6;
    this.dimmed = false; this.finish();
  }
  addText(text, x, y, z, w, h, ry, fg) { const m = signMesh(text, w, h, { bg: '#fbfdff', fg, border: false, size: 48 }); m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); return m; }
  setDim(on) { this.dimmed = on; for (const p of this.panels) { p.material.emissive.set(on ? '#ffe2b8' : '#eef8ff'); } this.key.color.set(on ? '#ffe9cc' : '#eef6ff'); }
  update(dt, hour, ctx = {}) {
    const k = this.dimmed ? 0.55 : 1; const s = ctx.settings || {};
    for (const p of this.panels) p.material.emissiveIntensity = 2.4 * k;
    // the faulty panel dips now and then. It holds steady when Flicker is off, motion is reduced or screen effects are nearly off.
    const steady = s.flicker === false || !!s.reduceMotion || (s.fx != null && s.fx < 0.15);
    if (steady) this.flk.dips = null;
    if (!this.dimmed) this.flicker.material.emissiveIntensity = steady ? 2.4 : this.flickerLevel(dt);
    this.key.intensity = 1.6 * k; this.hemi.intensity = 1.1 * (this.dimmed ? 0.75 : 1);
  }
  // every 3 to 8 s, one or two brief dips (0.12 to 0.2 s each, starts at least 0.45 s apart), timed by dt alone
  flickerLevel(dt) {
    const f = this.flk;
    if (!f.dips) { f.wait -= dt; if (f.wait > 0) return 2.4; this.burst(Math.random() < 0.5 ? 1 : 2); }
    const dip = f.dips.some(([a, b]) => f.t >= a && f.t < b);
    f.t += dt;
    if (f.t >= f.dips[f.dips.length - 1][1]) { f.dips = null; f.wait = 3 + Math.random() * 5; }
    return dip ? 1.75 : 2.4;
  }
  burst(n = 1) {
    const dips = []; let at = 0;
    for (let i = 0; i < n; i++) { dips.push([at, at + 0.12 + Math.random() * 0.08]); at += 0.45 + Math.random() * 0.25; }
    this.flk.dips = dips; this.flk.t = 0;
  }
}

// ---------- Town Hall: where the town decides what counts as standard ----------
export class Chamber extends Room {
  constructor() {
    super('hall', 14, 10, 4.4, { floor: '#a87850', wall: '#efe3cf', wall2: '#e6d6bc', bg: '#1e1a20' });
    const B = this.batch;
    for (let i = 0; i < 3; i++) this.windowPane(-3.6 + i * 3.6, 2.4, -4.97, 1.6, 2.2);
    // banners
    for (const [x, c] of [[-5.6, '#c8553d'], [5.6, '#4f6f8f']]) B.add(new THREE.BoxGeometry(1.0, 2.2, 0.04), c, mtx(x, 2.7, -4.95));
    // dais + council table + chairs
    B.add(new RoundedBoxGeometry(9, 0.35, 2.4, 1, 0.05), '#8a5a3c', mtx(0, 0.17, -3.4));
    B.add(new RoundedBoxGeometry(6.4, 0.5, 0.8, 1, 0.05), '#7a4e3c', mtx(0, 0.6, -2.85));
    for (const x of [-2.2, 0, 2.2]) { B.add(new RoundedBoxGeometry(0.8, 1.4, 0.15, 1, 0.05), '#5a3a2a', mtx(x, 1.3, -4.1)); }
    this.block(-4.5, -5, 4.5, -2.3);
    this.addPlaque('THE TOWN COUNCIL', 0, 0.62, -2.43, 2.2, 0.32);
    // lectern for whoever speaks
    B.add(new RoundedBoxGeometry(0.8, 1.15, 0.6, 1, 0.05), '#8a5a3c', mtx(0, 0.58, 0.3)); this.block(-0.45, -0.05, 0.45, 0.65);
    // benches
    for (let r = 0; r < 2; r++) for (const sx of [-3.6, 3.6]) { B.add(new RoundedBoxGeometry(3.6, 0.12, 0.6, 1, 0.04), '#8a5a3c', mtx(sx, 0.5, 2.0 + r * 1.5)); B.add(new RoundedBoxGeometry(3.6, 0.6, 0.1, 1, 0.04), '#7a4e3c', mtx(sx, 0.85, 2.3 + r * 1.5)); this.block(sx - 1.8, 1.7 + r * 1.5, sx + 1.8, 2.35 + r * 1.5); }
    // the founders' portrait: every one of them the same shape
    const pg = new THREE.Group(); pg.position.set(-6.88, 2.6, -0.6); pg.rotation.y = Math.PI / 2;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(3.0, 1.9, 0.1, 1, 0.04), std('#b8893a', { metalness: 0.4, roughness: 0.4 })); pg.add(frame);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.6), std('#3a3340')); canvas.position.z = 0.06; pg.add(canvas);
    this.scene.add(pg);
    for (let i = 0; i < 5; i++) { const f = new Creature(STANDARD, { scale: 0.62, seed: 300 + i, lod: 'low' }); f.root.position.set(-6.8, 1.9, -1.6 + i * 0.5); f.root.rotation.y = Math.PI / 2; f.heading = Math.PI / 2; f.update(0.01); this.scene.add(f.root); }
    this.addPlaque('The Founders, 1891', -6.86, 1.45, -0.6, 1.4, 0.26, Math.PI / 2);
    this.spots = { door: [5.6, 4.2], lectern: [0, 1.1], hollis: [0, -3.75], pip: [-2.2, -3.75], clover: [2.2, -3.75], benchL: [-3.6, 2.6], benchR: [3.6, 2.6], benchL2: [-3.6, 4.1], benchR2: [3.6, 4.1], portrait: [-5.6, -0.6] };
    this.spawn = [5.6, 4.0];
    this.inter = [{ id: 'out', kind: 'exit', x: 6.2, z: 4.4, r: 1.2, label: 'Step outside' }, { id: 'portrait', kind: 'prop', x: -5.8, z: -0.6, r: 1.3, label: 'Look at the portrait' }];
    this.cam = { pos: new THREE.Vector3(6.8, 9.2, 11.6), look: new THREE.Vector3(-0.6, 0.6, -0.8), fov: 38 };
    this.hemi.intensity = 0.95; this.key.color.set('#ffe7c4');
    this.finish();
  }
  addPlaque(text, x, y, z, w, h, ry = 0) { const m = signMesh(text, w, h, { bg: '#efe3cf', fg: '#5a3a2a', border: '#8a6f4e', size: 44 }); m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); }
}
