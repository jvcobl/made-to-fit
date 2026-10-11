// Larkspur: procedural town, nav grid, zones, interactables, fix visuals and festival decor.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';
import { makeRng, clamp, lerp, smoothstep, noise2, now } from './util.js';
import { Creature, STANDARD } from './creature.js';
import { Daylight, addOcclusion } from './render.js';

export const GW = 64, GD = 48;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export const mtx = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));

export class Batch {
  constructor() { this.list = []; }
  add(geo, color, m, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (o.flat || !g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(color); const n = g.attributes.position.count; const col = new Float32Array(n * 3); const pos = g.attributes.position;
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (o.ao) k = lerp(o.ao[2], 1, smoothstep(o.ao[0], o.ao[1], pos.getY(i)));
      if (o.jit) k *= 1 + (Math.sin(i * 12.9898) * 0.5) * o.jit;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (m) g.applyMatrix4(m);
    this.list.push(g);
    if (geo !== g && o.dispose) geo.dispose();
  }
  mesh(material) { if (!this.list.length) return new THREE.Group(); const m = new THREE.Mesh(mergeGeometries(this.list, false), material); this.list.forEach((g) => g.dispose()); this.list = []; return m; }
}

const fontStack = '"Fredoka", "Nunito", ui-rounded, "Segoe UI", system-ui, sans-serif';
export function signTexture(text, o = {}) {
  const w = o.w || 512, h = o.h || 128; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = o.bg || '#fbf6ee'; const r = o.radius == null ? 18 : o.radius;
  x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, h - 8, r) : x.rect(4, 4, w - 8, h - 8); x.fill();
  if (o.border !== false) { x.lineWidth = 6; x.strokeStyle = o.border || '#3b2f2a'; x.stroke(); }
  x.fillStyle = o.fg || '#3b2f2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(text).split('\n'); const fs = o.size || Math.min(72, (h - 24) / lines.length * 0.8);
  x.font = (o.weight || 600) + ' ' + fs + 'px ' + fontStack;
  lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.12));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function signMesh(text, w, h, o = {}) {
  const tex = signTexture(text, o);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: o.glow ? '#ffffff' : '#000000', emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow || 0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); return m;
}

function gableRoof(w, d, rh, over = 0.35) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - over, 0); s.lineTo(w / 2 + over, 0); s.lineTo(0, rh); s.lineTo(-w / 2 - over, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d + over * 2, bevelEnabled: false }); g.translate(0, 0, -(d + over * 2) / 2); return g;
}
const capsuleDist = (px, pz, s) => { const [ax, az, bx, bz] = s; const vx = bx - ax, vz = bz - az; const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)); const dx = px - (ax + vx * t), dz = pz - (az + vz * t); return Math.sqrt(dx * dx + dz * dz); };

export const QUIET_RECT = [20.6, 28.4, 26.6, 33];
export const ZONES = [
  { id: 'works', name: 'The Works', rect: [2, 1, 22.5, 14.5] },
  { id: 'hall', name: 'Town Hall', rect: [24, 1, 40, 13.6] },
  { id: 'commons', name: 'The Commons', rect: [41, 0, 64, 17.5] },
  { id: 'transit', name: 'Transit Stop', rect: [47.5, 18, 64, 31] },
  { id: 'farend', name: 'The Far End', rect: [40, 33, 64, 48] },
  { id: 'homerow', name: 'Home Row', rect: [0, 29.5, 28, 48] },
  { id: 'market', name: 'Market Square', rect: [15.5, 14, 44, 33] },
];
const PATHS = [
  [2, 24, 54.6, 24, 1.3], [30, 11.8, 30, 45.5, 1.2], [1.5, 38, 28.5, 38, 1.1], [28.5, 38, 30, 38, 1.1], [12, 12.4, 12, 24, 1.05], [30, 12.3, 33.5, 12.3, 1.2],
  [30, 14.5, 44, 14.5, 1.0], [44, 14.5, 52, 11.2, 0.95], [44, 14.5, 47, 15.2, 0.8], [30, 41.5, 44, 41.5, 1.0], [44, 41.5, 50, 40.9, 0.95], [50, 40.9, 53.5, 44.2, 0.75],
  [21, 20, 21, 24, 0.85], [4, 35.8, 4, 38, 0.6], [9.5, 35.8, 9.5, 38, 0.6], [15, 35.8, 15, 38, 0.6], [23, 35.8, 23, 38, 0.6], [19, 24.6, 19, 38, 0.85], [52.5, 24, 55.5, 24, 1.2], [20, 9, 20.8, 24, 0.7],
];

export class Town {
  constructor(quality = 'high') {
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.light = new Daylight(this.scene, quality);
    this.rng = makeRng(77);
    this.grid = new Uint8Array(GW * GD); // 0 free, 1 blocked, 2 steps (blocked on wheels), 3 water
    this.spots = {}; this.inter = []; this.anim = []; this.fixGroups = {}; this.signs = {};
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    this.glassLit = new THREE.MeshStandardMaterial({ color: '#9db8c6', roughness: 0.25, emissive: '#ffbe6b', emissiveIntensity: 0 });
    this.glassDark = new THREE.MeshStandardMaterial({ color: '#8ba7b8', roughness: 0.22, emissive: '#000000' });
    this.glassWorks = new THREE.MeshStandardMaterial({ color: '#cfe4ef', roughness: 0.2, emissive: '#e9f6ff', emissiveIntensity: 0.55 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.4, emissive: '#ffcf7a', emissiveIntensity: 0 });
    this.batch = new Batch(); this.lit = new Batch(); this.dark = new Batch(); this.worksWin = new Batch(); this.lamps = new Batch();
    this.trees = []; this.lampPos = [];
    this.buildGround();
    this.buildHomeRow();
    this.buildWorks();
    this.buildHall();
    this.buildMarket();
    this.buildCommons();
    this.buildTransit();
    this.buildFarEnd();
    this.buildStreetscape();
    this.buildTrees();
    const main = this.batch.mesh(this.mat); main.castShadow = true; main.receiveShadow = true; this.scene.add(main); this.mainMesh = main;
    for (const [b, m] of [[this.lit, this.glassLit], [this.dark, this.glassDark], [this.worksWin, this.glassWorks], [this.lamps, this.lampMat]]) { const mm = b.mesh(m); this.scene.add(mm); }
    this.buildFixes();
    this.buildFestival();
    this.buildAmbient();
    this.nightK = 0;
    // warm pools of light: a few real lights follow you to the nearest street lamps
    this.lampLights = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ffc27a', 0, 10, 1.5); l.position.set(0, -50, 0); this.scene.add(l); this.lampLights.push(l); }
    const skip = new Set([this.ground, this.water]);
    this.scene.traverse((o) => { if (o.isMesh && !skip.has(o) && o.material && o.material.isMeshStandardMaterial && !o.userData.noOcc) addOcclusion(o.material); });
  }
  block(x0, z0, x1, z1, v = 1) { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && z >= 0 && x < GW && z < GD) this.grid[z * GW + x] = v; }
  cell(x, z) { const cx = Math.floor(x), cz = Math.floor(z); if (cx < 1 || cz < 1 || cx >= GW - 1 || cz >= GD - 1) return 1; return this.grid[cz * GW + cx]; }
  walkable(x, z, wheels) { const c = this.cell(x, z); return c === 0 || (c === 2 && !wheels); }
  // the quiet corner of the market square, by the benches (a sub-zone: the zone stays the market)
  subAt(x, z) { const r = QUIET_RECT; return x >= r[0] && x < r[2] && z >= r[1] && z < r[3] ? 'quietcorner' : null; }
  zoneAt(x, z) {
    for (const zn of ZONES) { const r = zn.rect; if (x >= r[0] && x < r[2] && z >= r[1] && z < r[3]) return zn; }
    return { id: 'street', name: 'Larkspur' };
  }
  addInter(o) { this.inter.push(o); return o; }

  // ---------- ground ----------
  groundColorAt(x, z, out) {
    const g1 = new THREE.Color(PAL.grass), g2 = new THREE.Color(PAL.grass2), g3 = new THREE.Color(PAL.grass3);
    const n = noise2(x * 0.09, z * 0.09) * 0.5 + 0.5, n2 = noise2(x * 0.31 + 7, z * 0.31) * 0.5 + 0.5;
    out.copy(g1).lerp(g2, n).lerp(g3, smoothstep(0.62, 0.9, n2) * 0.6);
    const outside = Math.max(0, -x, x - GW, -z, z - GD);
    if (outside > 0) { const f = new THREE.Color('#b5b77c'); out.lerp(f, clamp(outside / 20) * 0.5); if (Math.sin(x * 0.7) > 0.6 && outside > 6) out.multiplyScalar(0.94); }
    // garden dirt in the commons
    if (x > 46 && x < 50.5 && z > 3 && z < 6.5) out.set(PAL.dirt);
    // paths
    let pd = 99; for (const s of PATHS) pd = Math.min(pd, capsuleDist(x, z, s) - s[4]);
    const pathK = smoothstep(0.12, -0.12, pd);
    if (pathK > 0) out.lerp(new THREE.Color(PAL.path).multiplyScalar(0.98 + noise2(x * 2, z * 2) * 0.03), pathK);
    // plaza
    const dc = Math.hypot(x - 30, z - 24);
    if (dc < 9.8) {
      const tile = ((Math.floor(x * 1.2) + Math.floor(z * 1.2)) & 1) ? 1 : 0.965;
      const pc = new THREE.Color(PAL.plaza).multiplyScalar(tile);
      if (dc > 8.9) pc.set(PAL.plaza2);
      if (dc < 2.6 && dc > 2.2) pc.set(PAL.plaza2);
      out.lerp(pc, smoothstep(9.8, 9.6, dc));
    }
    // road
    if (x > 55.4 && x < 59.4) {
      if (x < 55.65 || x > 59.15) out.set(PAL.curb);
      else { out.set(PAL.road).multiplyScalar(0.97 + noise2(x * 3, z * 3) * 0.03); if (Math.abs(x - 57.4) < 0.09 && ((z % 3) + 3) % 3 < 1.5) out.set(PAL.roadLine); }
    }
    // pond edge
    const dp = Math.hypot(x - 56.5, z - 43.5);
    if (dp < 4.1) out.lerp(new THREE.Color('#7d8a5a'), smoothstep(4.1, 3.5, dp));
    return out;
  }
  buildGround() {
    const W = 150, H = 130, sx = 300, sz = 260;
    const g = new THREE.PlaneGeometry(W, H, sx, sz); g.rotateX(-Math.PI / 2); g.translate(32, 0, 24);
    const pos = g.attributes.position; const col = new Float32Array(pos.count * 3); const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      this.groundColorAt(x, z, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      const outside = Math.max(0, -x - 4, x - GW - 4, -z - 4, z - GD - 4);
      if (outside > 0) pos.setY(i, Math.min(6, outside * outside * 0.012) * (0.6 + 0.4 * noise2(x * 0.05, z * 0.05)));
      if (Math.hypot(x - 56.5, z - 43.5) < 3.3) pos.setY(i, -0.25);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.receiveShadow = true; this.scene.add(m); this.ground = m;
    // map edges
    for (let x = 0; x < GW; x++) { this.grid[x] = 1; this.grid[(GD - 1) * GW + x] = 1; }
    for (let z = 0; z < GD; z++) { this.grid[z * GW] = 1; this.grid[z * GW + GW - 1] = 1; }
  }

  // ---------- building kit ----------
  house(x, z, w, d, h, wall, roof, o = {}) {
    const B = this.batch;
    B.add(new RoundedBoxGeometry(w, h, d, 2, 0.1), wall, mtx(x, h / 2, z), { ao: [-h / 2, -h / 2 + 1.2, 0.72] });
    const rh = o.roofH || Math.min(w, d) * 0.42;
    if (o.flat) {
      B.add(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), o.trim || PAL.trim, mtx(x, h + 0.15, z));
    } else {
      const rg = gableRoof(w, d, rh, 0.3);
      B.add(rg, roof, mtx(x, h - 0.02, z, o.roofRot || 0), { flat: true, jit: 0.04 });
      B.add(new THREE.BoxGeometry(w + 0.7, 0.12, d + 0.7), PAL.trim, mtx(x, h - 0.04, z));
      if (o.chimney) B.add(new THREE.BoxGeometry(0.6, 1.4, 0.6), '#b56a4f', mtx(x + w * 0.25, h + rh * 0.6, z - d * 0.15));
    }
    const fz = z + d / 2;
    // door
    if (o.door !== false) {
      const dx = x + (o.doorX || 0);
      B.add(new THREE.BoxGeometry(1.2, 1.95, 0.12), PAL.trim, mtx(dx, 0.98, fz + 0.04));
      B.add(new RoundedBoxGeometry(0.95, 1.8, 0.12, 1, 0.04), o.doorColor || '#7a5236', mtx(dx, 0.92, fz + 0.09));
      B.add(new THREE.SphereGeometry(0.06, 8, 6), '#e2b34c', mtx(dx + 0.32, 0.95, fz + 0.17));
      B.add(new THREE.BoxGeometry(1.5, 0.14, 0.7), PAL.stone, mtx(dx, 0.07, fz + 0.35));
    }
    // windows
    const rows = o.rows || 1, cols = o.cols || 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let wx = x - w / 2 + (c + 0.5) * (w / cols);
      if (o.door !== false && Math.abs(wx - (x + (o.doorX || 0))) < 0.9) continue;
      if (o.skipCenter && r === 0 && Math.abs(wx - x) < 1.6) continue;
      const wy = rows === 1 ? h * 0.55 : 1.4 + r * (h - 1.6) / rows;
      this.window(wx, wy, fz, o.winW || 0.8, o.winH || 0.9, o.works ? this.worksWin : (this.rng() < 0.6 ? this.lit : this.dark));
    }
    if (o.side !== false) for (let c = 0; c < Math.max(1, Math.floor(d / 2.5)); c++) this.window(x + w / 2 + 0.01, h * 0.55, z - d / 2 + (c + 0.5) * (d / Math.max(1, Math.floor(d / 2.5))), 0.7, 0.8, this.rng() < 0.5 ? this.lit : this.dark, true);
    this.block(x - w / 2 - 0.15, z - d / 2 - 0.15, x + w / 2 + 0.15, z + d / 2 + 0.25);
  }
  window(x, y, z, w, h, glassBatch, side = false) {
    const ry = side ? Math.PI / 2 : 0;
    const off = (dx, dz) => side ? [x + dz, z - dx] : [x + dx, z + dz];
    const [fx, fz] = off(0, 0.03);
    this.batch.add(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.08), PAL.trim, mtx(fx, y, fz, ry));
    const [gx, gz] = off(0, 0.075);
    glassBatch.add(new THREE.BoxGeometry(w, h, 0.04), '#ffffff', mtx(gx, y, gz, ry));
    const [bx, bz] = off(0, 0.1);
    this.batch.add(new THREE.BoxGeometry(0.05, h, 0.03), PAL.trim, mtx(bx, y, bz, ry));
    this.batch.add(new THREE.BoxGeometry(w, 0.05, 0.03), PAL.trim, mtx(bx, y, bz, ry));
    const [sx2, sz2] = off(0, 0.12);
    this.batch.add(new THREE.BoxGeometry(w + 0.3, 0.08, 0.2), PAL.trim, mtx(sx2, y - h / 2 - 0.1, sz2, ry));
  }
  addSign(text, x, y, z, w, h, o = {}) { const m = signMesh(text, w, h, o); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; this.scene.add(m); return m; }
  awning(x, y, z, w, depth, c1, c2, ry = 0) {
    const n = Math.max(4, Math.round(w / 0.42)); const sw = w / n;
    for (let i = 0; i < n; i++) {
      const lx = -w / 2 + (i + 0.5) * sw; const m = new THREE.Matrix4().multiplyMatrices(mtx(x, y, z, ry), mtx(lx, 0, depth / 2, 0, 1, 1, 1, 0.42));
      this.batch.add(new THREE.BoxGeometry(sw, 0.05, depth), i % 2 ? c1 : c2, m);
    }
    const vm = new THREE.Matrix4().multiplyMatrices(mtx(x, y, z, ry), mtx(0, -0.38, depth * 0.95, 0));
    for (let i = 0; i < n; i++) { const lx = -w / 2 + (i + 0.5) * sw; this.batch.add(new THREE.CylinderGeometry(sw / 2, sw / 2, 0.06, 8, 1, false, 0, Math.PI), i % 2 ? c1 : c2, new THREE.Matrix4().multiplyMatrices(vm, mtx(lx, 0, 0, 0, 1, 1, 1, Math.PI / 2))); }
  }
  fence(x0, z0, x1, z1, color = PAL.trim, gapAt = []) {
    const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.floor(len / 0.5); const ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n; const x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      if (gapAt.some((g) => Math.hypot(g[0] - x, g[1] - z) < 0.9)) continue;
      this.batch.add(new THREE.BoxGeometry(0.12, 0.75, 0.12), color, mtx(x, 0.37, z));
      this.batch.add(new THREE.ConeGeometry(0.09, 0.14, 4), color, mtx(x, 0.8, z, Math.PI / 4));
      if (i < n && !gapAt.some((g) => Math.hypot(g[0] - lerp(x0, x1, (i + 0.5) / n), g[1] - lerp(z0, z1, (i + 0.5) / n)) < 0.9)) {
        const mx = lerp(x0, x1, (i + 0.5) / n), mz = lerp(z0, z1, (i + 0.5) / n);
        this.batch.add(new THREE.BoxGeometry(0.06, 0.08, len / n), color, mtx(mx, 0.55, mz, ry));
        this.batch.add(new THREE.BoxGeometry(0.06, 0.08, len / n), color, mtx(mx, 0.25, mz, ry));
        const horiz = Math.abs(z1 - z0) < Math.abs(x1 - x0);
        if (horiz) this.block(mx - 0.26, mz - 0.06, mx + 0.26, mz + 0.06); else this.block(mx - 0.06, mz - 0.26, mx + 0.06, mz + 0.26);
      }
    }
  }
  bench(x, z, ry = 0) {
    const m = (lx, ly, lz) => new THREE.Matrix4().multiplyMatrices(mtx(x, 0, z, ry), mtx(lx, ly, lz));
    for (const lz of [-0.15, 0.05, 0.25]) this.batch.add(new THREE.BoxGeometry(1.8, 0.07, 0.17), PAL.wood, m(0, 0.48, lz));
    this.batch.add(new THREE.BoxGeometry(1.8, 0.4, 0.07), PAL.wood, m(0, 0.82, -0.3));
    for (const lx of [-0.75, 0.75]) { this.batch.add(new THREE.BoxGeometry(0.08, 0.48, 0.6), PAL.metal, m(lx, 0.24, 0)); this.batch.add(new THREE.BoxGeometry(0.08, 0.6, 0.08), PAL.metal, m(lx, 0.62, -0.3)); }
    this.block(x - 0.8, z - 0.4, x + 0.8, z + 0.4);
  }
  lamp(x, z) {
    this.batch.add(new THREE.CylinderGeometry(0.06, 0.09, 3.0, 8), PAL.metal, mtx(x, 1.5, z));
    this.batch.add(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), PAL.metal, mtx(x, 3.05, z));
    this.lamps.add(new THREE.SphereGeometry(0.22, 12, 8), '#ffffff', mtx(x, 2.86, z));
    this.lampPos.push([x, z]);
  }
  crate(x, z, s = 0.6, c = PAL.wood, ry = 0) { this.batch.add(new RoundedBoxGeometry(s, s, s, 1, 0.04), c, mtx(x, s / 2, z, ry)); }
  planter(x, z, w, d, flower) {
    this.batch.add(new RoundedBoxGeometry(w, 0.4, d, 1, 0.06), PAL.woodDark, mtx(x, 0.2, z));
    this.batch.add(new THREE.BoxGeometry(w - 0.15, 0.08, d - 0.15), PAL.dirt, mtx(x, 0.4, z));
    const n = Math.round(w * d * 4);
    for (let i = 0; i < n; i++) { const fx = x - w / 2 + 0.2 + this.rng() * (w - 0.4), fz = z - d / 2 + 0.2 + this.rng() * (d - 0.4); this.batch.add(new THREE.SphereGeometry(0.11, 6, 5), flower[i % flower.length], mtx(fx, 0.5 + this.rng() * 0.1, fz)); this.batch.add(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 4), '#5c8a46', mtx(fx, 0.43, fz)); }
  }

  // a wooden arch with climbing leaves over the garden cut: the way out of Home Row should look like a way out
  gardenArch(x, z) {
    const B = this.batch; const w = 2.5, h = 2.35;
    for (const sx of [-w / 2, w / 2]) { B.add(new THREE.CylinderGeometry(0.07, 0.08, h, 8), PAL.woodDark, mtx(x + sx, h / 2, z)); this.block(x + sx - 0.05, z - 0.05, x + sx + 0.05, z + 0.05); }
    const arc = new THREE.TorusGeometry(w / 2, 0.07, 6, 18, Math.PI); B.add(arc, PAL.woodDark, mtx(x, h, z));
    const greens = ['#7f9e52', '#9cae55', '#6d8f45'], flowers = ['#f3a0c2', '#fff4d6', '#f6cf5b'];
    for (let i = 0; i < 30; i++) {
      const a = this.rng() * Math.PI; const onPost = i < 12; const side = i % 2 ? 1 : -1;
      const px = onPost ? x + side * w / 2 + (this.rng() - 0.5) * 0.18 : x + Math.cos(a) * w / 2;
      const py = onPost ? 0.4 + this.rng() * (h - 0.4) : h + Math.sin(a) * w / 2;
      B.add(new THREE.IcosahedronGeometry(0.13 + this.rng() * 0.08, 0), greens[i % 3], mtx(px, py, z + (this.rng() - 0.5) * 0.2, this.rng() * 3), { flat: true });
      if (i % 3 === 0) B.add(new THREE.SphereGeometry(0.06, 6, 5), flowers[i % 3], mtx(px + 0.08, py + 0.05, z + 0.14));
    }
  }
  // wooden signposts at the junctions where a new arrival would hesitate
  signpost(x, z, lines) {
    this.batch.add(new THREE.CylinderGeometry(0.06, 0.075, 2.5, 8), PAL.woodDark, mtx(x, 1.25, z));
    this.batch.add(new THREE.ConeGeometry(0.09, 0.14, 8), PAL.woodDark, mtx(x, 2.57, z));
    lines.forEach((t, i) => { const m = signMesh(t, 1.55, 0.34, { size: 44, bg: '#fbf6ee', fg: '#5a4630', border: '#8a6f4e', w: 512, h: 112 }); m.position.set(x + (i % 2 ? 0.06 : -0.06), 2.12 - i * 0.42, z + 0.07); m.rotation.z = (i % 2 ? 0.025 : -0.03); this.scene.add(m); });
    this.block(x - 0.08, z - 0.08, x + 0.08, z + 0.08);
  }
  mapRoads() { return PATHS.filter((s) => s[4] >= 0.75).map((s) => s.slice(0, 4)); }

  // ---------- districts ----------
  buildHomeRow() {
    const xs = [4, 9.5, 15, 23];
    xs.forEach((x, i) => {
      const mine = i === 1;
      const wall = mine ? '#f6e2b8' : PAL.walls[(i * 3 + 1) % PAL.walls.length];
      this.house(x, 33.5, 4.4, 4, 3.0, wall, PAL.roofs[(i * 2 + 1) % PAL.roofs.length], { cols: 2, chimney: i % 2 === 0, doorColor: mine ? '#4f6f8f' : ['#7a5236', '#a8483f', '#6d7f5a', '#7a4e6e'][i] });
      this.batch.add(new THREE.BoxGeometry(0.2, 1.0, 0.2), PAL.woodDark, mtx(x + 1.6, 0.5, 37.2));
      this.batch.add(new RoundedBoxGeometry(0.5, 0.35, 0.3, 1, 0.05), ['#c8553d', '#4f6f8f', '#6d7f5a', '#e2b34c'][i], mtx(x + 1.6, 1.1, 37.2));
      this.planter(x - 1.5, 36.2, 1.0, 0.5, ['#f3a0c2', '#fff4d6', '#f6cf5b']);
      this.spots['house' + i] = [x, 37.0];
    });
    this.fence(1.5, 36.9, 25.4, 36.9, PAL.trim, xs.map((x) => [x, 36.9]).concat([[18.5, 36.9], [19.5, 36.9]]));
    this.gardenArch(19, 36.75);
    this.spots.cut = [19, 37.6];
    this.addSign('No. 2', 9.5 + 1.0, 2.35, 35.53, 0.9, 0.36, { size: 54, bg: '#4f6f8f', fg: '#fbf6ee', border: '#fbf6ee' });
    this.spots.home = [9.5, 37.0];
    this.addInter({ id: 'home', kind: 'door', x: 9.5, z: 36.5, r: 1.6, label: 'Go home' });
    // south side: a little green with a swing and a vegetable patch
    this.bench(8, 42, 0); this.bench(18, 42, 0);
    this.planter(13, 44, 3, 1.2, ['#e4796a', '#f6cf5b', '#9fd3b0']);
    this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), PAL.woodDark, mtx(23, 1.3, 43.2, 0, 1, 1, 1, 0, 0.2));
    this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), PAL.woodDark, mtx(25, 1.3, 43.2, 0, 1, 1, 1, 0, -0.2));
    this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), PAL.woodDark, mtx(24, 2.5, 43.2, 0, 1, 1, 1, 0, Math.PI / 2));
    this.batch.add(new THREE.BoxGeometry(0.7, 0.06, 0.35), '#c8553d', mtx(24, 0.6, 43.2));
    this.block(22.5, 42.8, 25.5, 43.6);
    this.spots.bench_home = [8, 42.8];
  }
  buildWorks() {
    const x = 12, z = 7, w = 14, d = 7, h = 6.2;
    this.house(x, z, w, d, h, '#dfe5ea', '#8a9aa8', { flat: true, rows: 2, cols: 7, works: true, winW: 1.2, winH: 1.3, door: false, side: false, trim: '#c7d0d8', skipCenter: true });
    const fz = z + d / 2;
    // glass doors + canopy
    this.batch.add(new THREE.BoxGeometry(2.6, 2.4, 0.14), '#5b6470', mtx(x, 1.7, fz + 0.04));
    this.worksWin.add(new THREE.BoxGeometry(2.3, 2.2, 0.05), '#ffffff', mtx(x, 1.65, fz + 0.12));
    this.batch.add(new THREE.BoxGeometry(4.2, 0.18, 1.8), '#5b6470', mtx(x, 3.2, fz + 0.9));
    // steps: three of them, a little landing, no ramp
    for (let i = 0; i < 3; i++) this.batch.add(new THREE.BoxGeometry(3.2, 0.18, 0.45), PAL.stone, mtx(x, 0.09 + i * 0.18, fz + 1.25 - i * 0.4));
    this.batch.add(new THREE.BoxGeometry(3.2, 0.54, 0.6), PAL.stone, mtx(x, 0.27, fz + 0.3));
    for (const sx of [-1.65, 1.65]) { this.batch.add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), PAL.metal, mtx(x + sx, 1.0, fz + 0.9, 0, 1, 1, 1, -0.45)); }
    this.block(x - 1.6, fz, x + 1.6, fz + 1.5, 2);
    this.addSign('THE WORKS', x, 4.6, fz + 0.08, 4.6, 0.95, { bg: '#2f3a4a', fg: '#e9f6ff', border: '#e9f6ff', size: 70, weight: 700 });
    // loading dock on the east side, the long way round
    this.batch.add(new THREE.BoxGeometry(0.14, 2.6, 2.4), '#9aa6b2', mtx(x + w / 2 + 0.05, 1.3, z + 1.2));
    this.batch.add(new THREE.BoxGeometry(1.6, 0.06, 2.6), PAL.stone, mtx(x + w / 2 + 0.8, 0.03, z + 1.2));
    this.addSign('DELIVERIES', x + w / 2 + 0.1, 2.95, z + 1.2, 1.6, 0.4, { ry: Math.PI / 2, bg: '#e2b34c', size: 50 });
    this.addInter({ id: 'works', kind: 'door', x, z: fz + 2.0, r: 1.7, label: 'Go in to work' });
    this.addInter({ id: 'dock', kind: 'door', x: x + w / 2 + 1.3, z: z + 1.2, r: 1.4, label: 'Use the loading dock' });
    this.spots.works = [x, fz + 2.6]; this.spots.dock = [x + w / 2 + 1.5, z + 1.2];
    this.planter(x - 4.5, fz + 1.0, 3, 0.8, ['#9cae55', '#7f9e52']); this.planter(x + 4.5, fz + 1.0, 3, 0.8, ['#9cae55', '#7f9e52']);
    this.lamp(x - 3.2, fz + 3.2); this.lamp(x + 3.2, fz + 3.2);
  }
  buildHall() {
    const x = 32, z = 6.8, w = 10, d = 7, h = 5.2;
    this.house(x, z, w, d, h, '#f0e6d6', '#9a6b56', { cols: 4, rows: 1, door: false, side: false, roofH: 1.8 });
    const fz = z + d / 2;
    this.batch.add(new THREE.BoxGeometry(w - 1, 0.4, 2.4), PAL.stone, mtx(x, 0.2, fz + 1.1));
    for (let i = 0; i < 6; i++) { const cx = x - (w - 2) / 2 + i * (w - 2) / 5; this.batch.add(new THREE.CylinderGeometry(0.22, 0.26, 3.8, 14), PAL.trim, mtx(cx, 2.3, fz + 1.9)); }
    const pd = gableRoof(w - 0.6, 2.6, 1.2, 0.1); this.batch.add(pd, '#e9dcc5', mtx(x, 4.2, fz + 1.4), { flat: true });
    this.batch.add(new THREE.BoxGeometry(w - 0.4, 0.3, 2.9), PAL.trim, mtx(x, 4.2, fz + 1.4));
    this.batch.add(new RoundedBoxGeometry(1.8, 2.4, 0.15, 1, 0.05), '#7a4e3c', mtx(x, 1.6, fz + 0.06));
    // the ramp the town already built, after a long campaign
    this.batch.add(new THREE.BoxGeometry(1.3, 0.4, 3.2), PAL.stone, mtx(x - w / 2 - 0.2, 0.2, fz + 1.4, 0, 1, 1, 1, 0.12));
    this.addSign('TOWN HALL', x, 4.75, fz + 2.87, 3.6, 0.6, { size: 64, bg: '#f0e6d6' });
    this.addSign('Ramp, 1998', x - w / 2 - 0.9, 0.9, fz + 3.0, 0.9, 0.32, { size: 40, bg: '#fbf6ee' });
    this.batch.add(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), PAL.metal, mtx(x + 6.5, 3.5, fz + 2.5));
    const flag = signMesh('LARKSPUR', 1.6, 0.9, { bg: '#c8553d', fg: '#fbf6ee', border: false, size: 46 }); flag.position.set(x + 7.3, 6.4, fz + 2.5); this.scene.add(flag); this.flag = flag;
    this.block(x - w / 2 - 0.9, fz, x + w / 2, fz + 2.4, 0);
    this.block(x - w / 2 + 0.5, fz, x + w / 2 - 0.5, fz + 0.4, 1);
    this.addInter({ id: 'hall', kind: 'door', x, z: fz + 3.0, r: 1.8, label: 'Go into Town Hall' });
    this.spots.hall = [x, fz + 3.4]; this.spots.hallSteps = [x + 2.5, fz + 3.2];
    this.lamp(x - 6.8, fz + 3.6); this.lamp(x + 5, fz + 3.8);
  }
  buildMarket() {
    // the statue of the Standard Resident
    const cx = 30, cz = 24;
    this.batch.add(new RoundedBoxGeometry(2.6, 1.5, 2.6, 2, 0.12), '#d9ccb6', mtx(cx, 0.75, cz), { ao: [-0.75, 0.2, 0.75] });
    this.batch.add(new RoundedBoxGeometry(3.2, 0.3, 3.2, 1, 0.08), '#cbbca2', mtx(cx, 0.15, cz));
    const st = new Creature(STANDARD, { scale: 2.3, seed: 1945, form: 'baked' });
    st.root.position.set(cx, 1.5, cz); st.update(0.01);
    st.bodyMat.roughness = 0.38; st.bodyMat.metalness = 0.12;
    st.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noOcc = true; } });
    this.scene.add(st.root); this.statue = st;
    this.addSign('THE STANDARD RESIDENT\nLarkspur was built to fit them.', cx, 0.8, cz + 1.32, 2.2, 0.62, { size: 30, bg: '#efe3cf', border: '#8a6f4e', fg: '#5a4630', h: 160 });
    this.block(cx - 1.6, cz - 1.6, cx + 1.6, cz + 1.6);
    this.addInter({ id: 'statue', kind: 'prop', x: cx, z: cz + 2.3, r: 1.5, label: 'Read the plaque' });
    // stalls on the north arc, facing the statue
    const stalls = [[200, '#c8553d', 'Apples'], [238, '#4f6f8f', 'Bread'], [302, '#6d7f5a', 'Flowers'], [340, '#7a4e6e', 'Records']];
    stalls.forEach(([deg, col, name], i) => {
      const a = deg * Math.PI / 180; const x = cx + Math.cos(a) * 7, z = cz + Math.sin(a) * 7; const ry = Math.atan2(cx - x, cz - z);
      const M = (lx, ly, lz) => new THREE.Matrix4().multiplyMatrices(mtx(x, 0, z, ry), mtx(lx, ly, lz));
      this.batch.add(new RoundedBoxGeometry(2.4, 0.95, 1.0, 1, 0.06), PAL.wood, M(0, 0.48, 0), { ao: [-0.48, 0.2, 0.7] });
      this.batch.add(new THREE.BoxGeometry(2.6, 0.08, 1.1), '#e9dcc5', M(0, 0.98, 0));
      for (const lx of [-1.15, 1.15]) for (const lz of [-0.45]) this.batch.add(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), PAL.woodDark, M(lx, 1.15, lz));
      const produce = { Apples: ['#c8553d', '#e4796a', '#d9913e'], Bread: ['#d9a35e', '#c8894a', '#e9c58a'], Flowers: ['#f3a0c2', '#fff4d6', '#bfa9f0'], Records: ['#2b2530', '#4f6f8f', '#c8553d'] }[name];
      for (let k = 0; k < 9; k++) this.batch.add(new THREE.SphereGeometry(0.13, 8, 6), produce[k % 3], M(-0.9 + (k % 5) * 0.42, 1.12, 0.12 - Math.floor(k / 5) * 0.28));
      const am = new THREE.Matrix4().multiplyMatrices(mtx(x, 0, z, ry), mtx(0, 0, -0.6));
      const ax = new THREE.Vector3().setFromMatrixPosition(am);
      this.awning(ax.x, 2.3, ax.z, 2.7, 1.5, col, '#fbf6ee', ry);
      const s = this.addSign(name, 0, 0, 0, 1.1, 0.34, { size: 52 }); s.position.copy(new THREE.Vector3(0, 0.6, 0.52).applyMatrix4(mtx(x, 0, z, ry))); s.rotation.y = ry;
      this.block(x - 1.3, z - 0.8, x + 1.3, z + 0.8);
      // Pomeroy stands in front of the apples, facing the statue, and shouts at them
      if (name === 'Apples') { const f = new THREE.Vector3(0, 0, 1.45).applyMatrix4(mtx(x, 0, z, ry)); this.spots.apples = [f.x, f.z]; }
    });
    // Pip's bakery
    this.house(21, 17.4, 6, 4.4, 3.5, '#f5e7c4', '#a8483f', { cols: 3, chimney: true, doorColor: '#c8553d' });
    this.awning(21, 2.55, 19.6, 6, 1.2, '#c8553d', '#fbf6ee');
    this.addSign("Pip's Bakery", 21, 3.15, 19.66, 2.6, 0.5, { size: 56, bg: '#fbf6ee', fg: '#a8483f', border: '#a8483f' });
    this.spots.bakery = [22.3, 20.6];
    // Moss's tea cart
    const mx = 24.6, mz = 27.6;
    this.batch.add(new RoundedBoxGeometry(1.8, 0.9, 1.0, 1, 0.08), '#6d7f5a', mtx(mx, 0.75, mz, 0.4));
    for (const sx of [-0.6, 0.6]) this.batch.add(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), PAL.woodDark, mtx(mx + Math.cos(0.4) * sx, 0.28, mz - Math.sin(0.4) * sx, 0.4, 1, 1, 1, 0, Math.PI / 2));
    this.batch.add(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), PAL.woodDark, mtx(mx, 2.0, mz));
    this.batch.add(new THREE.ConeGeometry(1.4, 0.6, 10), '#e2b34c', mtx(mx, 3.05, mz), { flat: true });
    for (let i = 0; i < 4; i++) this.batch.add(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 10), ['#fbf6ee', '#c8553d', '#4f6f8f', '#f6cf5b'][i], mtx(mx - 0.5 + i * 0.3, 1.3, mz + 0.1, 0.4));
    this.addSign('Moss · Tea', mx, 1.4, mz + 0.52, 1.1, 0.3, { size: 50, bg: '#fbf6ee' }).rotation.y = 0.4;
    this.block(mx - 1, mz - 0.7, mx + 1, mz + 0.7);
    this.spots.cart = [mx + 1.2, mz + 0.9];
    this.addInter({ id: 'cart', kind: 'prop', x: mx + 0.6, z: mz + 1.2, r: 1.3, label: 'Look at the tea cart' });
    // the Blend kiosk: glossy, pink, a little too bright
    const kx = 36, kz = 28.4;
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.1, 8, 20), new THREE.MeshStandardMaterial({ color: '#fdf7fb', roughness: 0.18, metalness: 0.05 }));
    pod.position.set(kx, 1.4, kz); pod.castShadow = true; this.scene.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.06, 10, 40), new THREE.MeshStandardMaterial({ color: '#ff5fa2', emissive: '#ff5fa2', emissiveIntensity: 1.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(kx, 1.05, kz); this.scene.add(ring);
    const screen = signMesh('blend', 1.1, 0.62, { bg: '#ff5fa2', fg: '#ffffff', border: false, size: 84, weight: 700, glow: 1.2, radius: 40 });
    screen.position.set(kx, 1.75, kz + 0.87); this.scene.add(screen);
    this.kiosk = { ring, screen };
    this.block(kx - 1, kz - 1, kx + 1, kz + 1);
    this.addInter({ id: 'kiosk', kind: 'prop', x: kx - 0.2, z: kz + 1.6, r: 1.4, label: 'Look at the Blend kiosk' });
    this.spots.kiosk = [kx + 1.3, kz + 1.1];
    this.bench(26.5, 31.0, Math.PI); this.bench(33.5, 31.0, Math.PI);
    this.spots.bench_square = [26.5, 31.9];
    this.addInter({ id: 'bench_square', kind: 'bench', x: 26.5, z: 31.9, r: 1.2, label: 'Sit for a while' });
    this.planter(cx - 4, cz + 4.6, 1.2, 1.2, ['#f3a0c2', '#e2b34c']); this.planter(cx + 4, cz + 4.6, 1.2, 1.2, ['#bfa9f0', '#fff4d6']);
    this.spots.square = [cx, cz + 3.4]; this.spots.squareW = [cx - 4, cz + 2.5]; this.spots.squareE = [cx + 4, cz + 2.5]; this.spots.statueSide = [cx - 2.4, cz + 1.4];
    for (const [lx, lz] of [[22, 22], [38, 22], [22, 30], [38, 30]]) this.lamp(lx, lz);
  }
  buildCommons() {
    this.house(52, 7.5, 6, 4.6, 3.3, '#c97f5a', '#7a4e3c', { cols: 1, door: false, side: false, roofH: 1.9 });
    this.batch.add(new THREE.BoxGeometry(2.4, 2.4, 0.12), '#8a5a3c', mtx(52, 1.2, 9.86));
    this.batch.add(new THREE.BoxGeometry(0.1, 2.4, 0.14), PAL.trim, mtx(52, 1.2, 9.9));
    this.batch.add(new THREE.BoxGeometry(2.4, 0.1, 0.14), PAL.trim, mtx(52, 1.2, 9.9, 0, 1, 1, 1, 0, 0.78));
    this.addSign('FIX-IT SHED', 52, 2.85, 9.88, 2.4, 0.5, { size: 60, bg: '#fbf6ee', fg: '#7a4e3c', border: '#7a4e3c' });
    // workbench + tools
    this.batch.add(new RoundedBoxGeometry(2.2, 0.85, 0.8, 1, 0.05), PAL.wood, mtx(55.6, 0.43, 10.6));
    for (let i = 0; i < 4; i++) this.batch.add(new THREE.BoxGeometry(0.08, 0.6, 0.08), PAL.metal, mtx(54.9 + i * 0.45, 1.15, 10.4, 0, 1, 1, 1, 0, 0.2 * (i - 1.5)));
    this.batch.add(new RoundedBoxGeometry(0.6, 0.3, 0.4, 1, 0.04), '#c8553d', mtx(55.2, 1.0, 10.7));
    this.block(54.4, 10.1, 56.8, 11.1);
    this.addInter({ id: 'shed', kind: 'door', x: 52, z: 11.2, r: 1.6, label: 'Visit the Fix-It Shed' });
    this.spots.shed = [52.8, 11.5];
    // garden
    this.planter(48.2, 4.8, 4.0, 3.0, ['#9cae55', '#c8553d', '#e2b34c', '#7f9e52']);
    this.planter(58, 4.5, 3.0, 2.0, ['#f3a0c2', '#bfa9f0', '#fff4d6']);
    // notice board
    this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), PAL.woodDark, mtx(46.2, 0.9, 13.6)); this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), PAL.woodDark, mtx(47.8, 0.9, 13.6));
    this.addSign('NOTICES\nlost cat · choir · fix-it', 47, 1.55, 13.62, 1.7, 0.95, { size: 34, bg: '#f0e0c0' });
    this.block(46, 13.3, 48, 13.9);
    this.addInter({ id: 'notice', kind: 'prop', x: 47, z: 14.8, r: 1.3, label: 'Read the notice board' });
    // picnic table + bench
    this.batch.add(new RoundedBoxGeometry(2, 0.1, 0.9, 1, 0.03), PAL.wood, mtx(58, 0.75, 13));
    for (const sz of [-0.75, 0.75]) this.batch.add(new RoundedBoxGeometry(2, 0.08, 0.35, 1, 0.03), PAL.wood, mtx(58, 0.45, 13 + sz));
    for (const sx of [-0.8, 0.8]) this.batch.add(new THREE.BoxGeometry(0.08, 0.75, 1.9), PAL.woodDark, mtx(58 + sx, 0.38, 13));
    this.block(57, 12, 59, 14);
    this.bench(44, 9, Math.PI / 2);
    this.spots.bench_commons = [45, 9]; this.addInter({ id: 'bench_commons', kind: 'bench', x: 45.1, z: 9, r: 1.2, label: 'Sit for a while' });
    this.spots.commons = [50, 13.6]; this.spots.garden = [48.2, 7];
    this.fence(42, 1.5, 63, 1.5, '#e9dcc5');
  }
  buildTransit() {
    const x = 53.6, z = 24.8;
    this.batch.add(new THREE.BoxGeometry(0.12, 2.3, 3.4), '#5b6470', mtx(x - 0.7, 1.15, z));
    this.batch.add(new THREE.BoxGeometry(1.7, 0.12, 3.8), '#4f6f8f', mtx(x, 2.36, z));
    for (const sz of [-1.65, 1.65]) this.batch.add(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), '#5b6470', mtx(x + 0.75, 1.15, z + sz));
    this.batch.add(new RoundedBoxGeometry(0.5, 0.08, 2.6, 1, 0.03), PAL.wood, mtx(x - 0.35, 0.5, z));
    this.batch.add(new THREE.BoxGeometry(0.1, 0.5, 0.1), PAL.metal, mtx(x - 0.35, 0.25, z - 1.1)); this.batch.add(new THREE.BoxGeometry(0.1, 0.5, 0.1), PAL.metal, mtx(x - 0.35, 0.25, z + 1.1));
    // the old timetable: tiny print, sun-faded
    this.addSign('Route 12\n:40 past\nthe hour*', x - 0.62, 1.55, z - 1.0, 0.8, 0.8, { ry: Math.PI / 2, size: 30, bg: '#e9e3d6', fg: '#8a8578', border: '#8a8578', h: 256, w: 256 });
    this.batch.add(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), PAL.metal, mtx(55.2, 1.4, 22.2));
    this.addSign('BUS', 55.2, 2.6, 22.25, 0.6, 0.6, { size: 60, bg: '#4f6f8f', fg: '#fff', border: '#fff', w: 128, h: 128 });
    this.block(x - 0.9, z - 1.8, x - 0.5, z + 1.8);
    this.addInter({ id: 'board', kind: 'prop', x: x + 0.2, z: z - 2.3, r: 1.4, label: 'Read the timetable' });
    this.spots.transit = [x + 0.3, z + 0.3]; this.spots.busBench = [x - 0.2, z + 0.5];
    // the bus
    const bus = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: '#e2b34c', roughness: 0.5 });
    const b = new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.3, 7.2, 3, 0.35), bodyM); b.position.y = 1.55; b.castShadow = true; bus.add(b);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.25, 7.0), new THREE.MeshStandardMaterial({ color: '#fbf6ee', roughness: 0.6 })); stripe.position.y = 1.0; bus.add(stripe);
    const wins = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.8, 6.2), this.glassLit); wins.position.y = 2.05; bus.add(wins);
    for (const sx of [-1.15, 1.15]) for (const sz of [-2.4, 2.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.8 })); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.42, sz); bus.add(w); }
    const dest = signMesh('12 · ELM', 1.6, 0.36, { bg: '#1b1b22', fg: '#ffcf7a', border: false, size: 60, glow: 1 }); dest.position.set(0, 2.55, 3.62); bus.add(dest);
    this.bus = bus; bus.position.set(57.4, 0, -40); this.scene.add(bus);
    this.busState = { z: -40, stopUntil: 0, mode: 'away', skip: false };
  }
  buildFarEnd() {
    const x = 50, z = 38.4;
    this.house(x, z, 5.6, 4.0, 3.1, '#d9cfc0', '#4f6f8f', { cols: 2, doorColor: '#6d7f5a', chimney: true });
    this.batch.add(new THREE.BoxGeometry(5.8, 0.12, 1.6), PAL.wood, mtx(x, 0.06, z + 2.7));
    for (const sx of [-2.6, 2.6]) this.batch.add(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), PAL.woodDark, mtx(x + sx, 1.2, z + 3.4));
    this.batch.add(new THREE.BoxGeometry(5.6, 0.1, 1.8), PAL.woodDark, mtx(x, 2.45, z + 2.7, 0, 1, 1, 1, 0.08));
    this.batch.add(new RoundedBoxGeometry(1.8, 0.8, 0.7, 1, 0.05), PAL.wood, mtx(x + 1.6, 0.4, z + 2.9));
    this.addSign("Wren's Lanterns\nknock once", x - 1.4, 2.0, z + 2.02, 1.5, 0.62, { size: 36, bg: '#fbf6ee', fg: '#4f6f8f', border: '#4f6f8f' });
    // hanging paper lanterns: the Far End's signature light
    this.paperLanterns = [];
    const cols = ['#f6cf5b', '#e4796a', '#9edcd6', '#bfa9f0', '#ffc98e', '#f3a0c2'];
    for (let i = 0; i < 7; i++) {
      const lx = x - 2.4 + i * 0.8; const c = cols[i % cols.length];
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.7 }));
      m.scale.y = 1.25; m.position.set(lx, 2.05 - (i % 2) * 0.12, z + 3.3); this.scene.add(m); this.paperLanterns.push(m);
    }
    this.block(x - 2.8, z + 2.2, x + 2.8, z + 2.4, 0);
    this.addInter({ id: 'workshop', kind: 'door', x, z: z + 3.6, r: 1.7, label: 'Knock once' });
    this.spots.workshop = [x + 1.0, z + 3.9]; this.spots.wrenBench = [x + 1.6, z + 3.6];
    // pond
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.35, 48), new THREE.MeshStandardMaterial({ color: '#79acbb', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.94 }));
    water.rotation.x = -Math.PI / 2; water.position.set(56.5, 0.02, 43.5); this.scene.add(water); this.water = water;
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; this.batch.add(new THREE.DodecahedronGeometry(0.22 + this.rng() * 0.15, 0), '#b8b0a2', mtx(56.5 + Math.cos(a) * 3.45, 0.06, 43.5 + Math.sin(a) * 3.45, a), { flat: true }); }
    for (let i = 0; i < 22; i++) { const a = 2.4 + this.rng() * 2.2; const r = 3.0 + this.rng() * 0.5; this.batch.add(new THREE.ConeGeometry(0.04, 0.9 + this.rng() * 0.6, 4), '#7a8f4e', mtx(56.5 + Math.cos(a) * r, 0.5, 43.5 + Math.sin(a) * r, 0, 1, 1, 1, (this.rng() - 0.5) * 0.3)); }
    for (let z2 = 40; z2 < 47; z2++) for (let x2 = 52; x2 < 61; x2++) if (Math.hypot(x2 + 0.5 - 56.5, z2 + 0.5 - 43.5) < 3.6) this.grid[z2 * GW + x2] = 3;
    this.bench(52.6, 44.8, Math.PI / 2 + 0.3);
    this.spots.pond = [52.4, 43.6]; this.addInter({ id: 'bench_pond', kind: 'bench', x: 51.8, z: 44.6, r: 1.3, label: 'Sit by the pond' });
    // a little jetty, for catch and release
    this.batch.add(new THREE.BoxGeometry(2.2, 0.1, 0.9), PAL.wood, mtx(53.6, 0.12, 42.2, -0.25));
    for (const [px, pz] of [[52.7, 41.9], [52.7, 42.6], [54.5, 41.7], [54.5, 42.4]]) this.batch.add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), PAL.woodDark, mtx(px, 0.05, pz));
    this.batch.add(new THREE.CylinderGeometry(0.02, 0.025, 2.2, 5), PAL.woodDark, mtx(52.5, 1.0, 41.7, 0, 1, 1, 1, 0.5, 0.25));
    this.addInter({ id: 'pond', kind: 'pond', x: 52.6, z: 42.4, r: 1.3, label: 'Fish (catch and release)' });
    this.spots.farend = [46, 41.5];
  }
  buildStreetscape() {
    for (const [lx, lz] of [[6, 26], [16, 26], [44, 26], [50, 22], [6, 39.8], [16, 39.8], [26, 39.8], [28, 44], [32, 36], [38, 41.8], [46, 39.6], [32, 16], [40, 13], [48, 16.5]]) this.lamp(lx, lz);
    for (const [cx, cz] of [[40.5, 26.4], [41.3, 25.9], [17.6, 21.4]]) this.crate(cx, cz, 0.55, PAL.wood, this.rng());
    this.spots.street = [30, 34]; this.spots.mainW = [8, 24]; this.spots.mainE = [46, 24];
    this.spots.cross = [30, 38];
    this.signpost(20.9, 39.6, ['↑ The Works · Market', '→ Far End · Pond']);
    this.signpost(21.0, 26.3, ['← The Works', '→ Market Square']);
    this.signpost(13.8, 26.1, ['↑ The Works']);
    this.signpost(31.9, 16.4, ['↑ Town Hall', '→ Fix-It Shed']);
    this.signpost(31.7, 40.0, ['→ Wren · the pond', '← Home Row']);
  }
  buildTrees() {
    const pts = [];
    const add = (x, z, s) => { if (this.cell(x, z) !== 0) return; if (x > 17 && x < 21 && z > 23.5 && z < 38.5) return; pts.push([x, z, s]); this.block(x - 0.35, z - 0.35, x + 0.35, z + 0.35); };
    // a fixed camera looks north, so nothing tall stands just south of a walkway
    for (let i = 0; i < 22; i++) add(43 + this.rng() * 19, 2.2 + this.rng() * 5.5, 0.9 + this.rng() * 0.5);
    for (let i = 0; i < 6; i++) add(60 + this.rng() * 2.5, 8 + this.rng() * 8, 0.9 + this.rng() * 0.4);
    for (let i = 0; i < 16; i++) add(41 + this.rng() * 21, 33.6 + this.rng() * 2.6, 0.9 + this.rng() * 0.6);
    for (let i = 0; i < 6; i++) add(60.5 + this.rng() * 2.3, 37 + this.rng() * 10, 0.9 + this.rng() * 0.5);
    for (let i = 0; i < 10; i++) add(2 + this.rng() * 24, 45.6 + this.rng() * 1.6, 0.8 + this.rng() * 0.5);
    for (let i = 0; i < 10; i++) add(2 + this.rng() * 24, 29.6 + this.rng() * 1.2, 0.8 + this.rng() * 0.4);
    for (const x of [4, 9, 16, 42, 47]) add(x, 21.6, 0.8);
    for (let i = 0; i < 40; i++) { const a = this.rng() * Math.PI * 2, r = 40 + this.rng() * 22; pts.push([32 + Math.cos(a) * r * 1.1, 24 + Math.sin(a) * r * 0.9, 1.2 + this.rng() * 0.8]); }
    for (let i = 0; i < 12; i++) add(25 + this.rng() * 14, 1.2 + this.rng() * 1.5, 0.8);
    const trunkG = new THREE.CylinderGeometry(0.13, 0.2, 1, 7); trunkG.translate(0, 0.5, 0);
    const canG = new THREE.IcosahedronGeometry(1, 1); const cp = canG.attributes.position;
    for (let i = 0; i < cp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(cp, i); const k = 1 + noise2(v.x * 2 + 1, v.z * 2 + v.y) * 0.12; cp.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k); }
    const can2 = canG.index ? canG.toNonIndexed() : canG; can2.computeVertexNormals();
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: PAL.trunk, roughness: 0.9 }), pts.length);
    const cans = new THREE.InstancedMesh(can2, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), pts.length * 2);
    const c = new THREE.Color();
    pts.forEach(([x, z, s], i) => {
      const h = 1.3 * s + 0.4;
      trunks.setMatrixAt(i, mtx(x, 0, z, 0, s, h, s));
      const leaf = PAL.leaves[Math.floor(this.rng() * PAL.leaves.length)];
      cans.setMatrixAt(i * 2, mtx(x, h + 0.75 * s, z, this.rng() * 3, 1.35 * s, 1.25 * s, 1.35 * s));
      cans.setMatrixAt(i * 2 + 1, mtx(x + (this.rng() - 0.5) * s, h + 1.55 * s, z + (this.rng() - 0.5) * 0.6 * s, this.rng() * 3, 0.85 * s, 0.85 * s, 0.85 * s));
      c.set(leaf); cans.setColorAt(i * 2, c); c.offsetHSL(0, 0, 0.05); cans.setColorAt(i * 2 + 1, c);
    });
    trunks.castShadow = cans.castShadow = true; cans.receiveShadow = true;
    this.scene.add(trunks, cans); this.treePts = pts;
  }

  // ---------- fixes you can win ----------
  buildFixes() {
    const G = (id) => { const g = new THREE.Group(); g.visible = false; this.scene.add(g); this.fixGroups[id] = g; return g; };
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
    // ramp beside the Works steps
    {
      const g = G('ramp'); const fz = 10.5;
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(5.2, 0); s.lineTo(0, 0.54); s.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false });
      const r = new THREE.Mesh(geo, mat('#d9ccb6')); r.position.set(13.6, 0, fz + 0.02); r.castShadow = r.receiveShadow = true; g.add(r);
      for (const dz of [0.05, 1.35]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.3, 6), mat('#4f6f8f', { metalness: 0.4 })); rail.rotation.z = Math.PI / 2 - 0.104; rail.position.set(16.2, 1.15, fz + dz); g.add(rail); }
      const sign = signMesh('Ramp · this way', 1.3, 0.34, { size: 44, bg: '#4fb3a9', fg: '#fff', border: '#fff' }); sign.position.set(18.8, 0.9, fz + 1.5); g.add(sign);
    }
    // dimmable lights: handled by window material
    // plain notes board by the Works door
    {
      const g = G('plain');
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), mat(PAL.woodDark)); post.position.set(8.2, 0.85, 12.1); g.add(post);
      const s = signMesh('THIS WEEK\nwho · what · by when', 1.5, 0.9, { size: 40, bg: '#fbf6ee', fg: '#2f3a4a', border: '#4fb3a9' }); s.position.set(8.2, 1.65, 12.18); g.add(s);
    }
    // quiet corner in the square
    {
      const g = G('quiet'); const qx = 23.5, qz = 31.2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 6), mat('#9edcd6')); roof.position.set(qx, 2.6, qz); roof.castShadow = true; g.add(roof);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mat(PAL.woodDark)); p.position.set(qx + Math.cos(a) * 1.7, 1.1, qz + Math.sin(a) * 1.7); g.add(p); }
      for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.25, 0.7, 2, 0.1), mat(['#bfa9f0', '#f6cf5b', '#9fd3b0'][i])); c.position.set(qx - 0.7 + i * 0.7, 0.13, qz + (i % 2) * 0.4); g.add(c); }
      const s = signMesh('Quiet corner\nsofter at noon', 1.4, 0.6, { size: 38, bg: '#fbf6ee', fg: '#2b7a78', border: '#2b7a78' }); s.position.set(qx, 1.85, qz + 1.75); g.add(s);
    }
    // a bus board that shows changes
    {
      const g = G('board');
      const b = signMesh('NEXT BUS 5:40\nTODAY: VIA ELM ST', 1.5, 0.6, { size: 40, bg: '#13202e', fg: '#9ef2e4', border: '#4fb3a9', glow: 1.3 }); b.position.set(53.6, 2.0, 22.95); g.add(b);
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.08), mat('#2f3a4a')); p.position.set(53.6, 2.0, 22.88); g.add(p);
    }
    // porch lanterns: teal circle means come say hi, amber square means not now
    {
      const g = G('lanterns'); this.porch = [];
      const spots = [[4, 36.3], [9.5, 36.3], [15, 36.3], [23, 36.3], [48.6, 41.0]];
      spots.forEach(([x, z], i) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), mat(PAL.woodDark)); post.position.set(x - 1.0, 0.7, z + 0.2); g.add(post);
        const on = i % 2 === 0; const c = on ? '#4fd1c5' : '#f2a33a';
        const lt = new THREE.Mesh(on ? new THREE.SphereGeometry(0.17, 14, 10) : new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(c, { emissive: c, emissiveIntensity: 1.4 }));
        lt.position.set(x - 1.0, 1.55, z + 0.2); g.add(lt); this.porch.push(lt);
      });
    }
  }
  setFix(id, on) {
    if (id === 'dim') { this.glassWorks.emissive.set(on ? '#ffd9a0' : '#e9f6ff'); this.glassWorks.color.set(on ? '#e9dcc5' : '#cfe4ef'); this.worksDim = on; return; }
    if (this.fixGroups[id]) this.fixGroups[id].visible = on;
    if (id === 'ramp') { if (on) this.block(13.6, 10.5, 18.8, 11.9, 0); }
  }

  // ---------- the festival ----------
  buildFestival() {
    const g = new THREE.Group(); g.visible = false; this.scene.add(g); this.festival = g;
    const bulbs = []; const poles = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; poles.push(new THREE.Vector3(30 + Math.cos(a) * 9.6, 4.2, 24 + Math.sin(a) * 9.6)); }
    // the eight poles are one mesh, and so are all the bulbs (their colours ride on the vertices): two draws in all
    const pb = new Batch(); const pole = new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6);
    poles.forEach((p) => pb.add(pole, PAL.woodDark, mtx(p.x, 2.1, p.z)));
    g.add(pb.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
    for (let i = 0; i < 8; i++) {
      const a = poles[i], b = poles[(i + 1) % 8], c = new THREE.Vector3(30, 5.2, 24);
      for (let k = 1; k < 12; k++) { const t = k / 12; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.8; bulbs.push(p); }
      for (let k = 1; k < 9; k++) { const t = k / 9; const p = a.clone().lerp(c, t); p.y -= Math.sin(t * Math.PI) * 0.6; bulbs.push(p); }
    }
    const cols = ['#ffcf7a', '#ff9f8a', '#9ef2e4', '#ffe9a8', '#f3a0c2'];
    const bb = new Batch(); const bulb = new THREE.SphereGeometry(0.09, 8, 6);
    bulbs.forEach((p, i) => bb.add(bulb, cols[i % cols.length], mtx(p.x, p.y, p.z)));
    g.add(bb.mesh(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.8, roughness: 0.5, vertexColors: true })));
    const col = new THREE.Color();
    // floating lanterns for the finale
    const n = 90; this.sky = { n, mesh: null, data: [] };
    const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.2, roughness: 0.6 }), n);
    for (let i = 0; i < n; i++) {
      const d = { x: 30 + (this.rng() - 0.5) * 44, z: 24 + (this.rng() - 0.5) * 34, y: -5, v: 0.6 + this.rng() * 0.7, ph: this.rng() * 6, c: cols[i % cols.length] };
      this.sky.data.push(d); col.set(d.c); lm.setColorAt(i, col); lm.setMatrixAt(i, mtx(d.x, -10, d.z, 0, 1, 1.2, 1));
    }
    lm.visible = false; this.scene.add(lm); this.sky.mesh = lm; this.skyLaunch = 0;
    // the festival's two lights are in the scene from the start, dark until it begins, so the number of lights (and
    // with it every lit shader) never changes mid-game
    const glow = new THREE.PointLight('#ffb468', 0, 26, 1.4); glow.position.set(30, 6, 24); this.scene.add(glow); this.festGlow = glow;
    const glow2 = new THREE.PointLight('#ff8fb0', 0, 16, 1.6); glow2.position.set(36, 3, 28); this.scene.add(glow2); this.festGlow2 = glow2;
  }
  setFestival(on) { this.festival.visible = on; if (this.festGlow) { this.festGlow.intensity = on ? 18 : 0; this.festGlow2.intensity = on ? 6 : 0; } }
  // your lantern goes first, then the ones you painted for people, then everyone else's
  launchLanterns(color, extras = []) {
    this.skyLaunch = 0.001; this.sky.mesh.visible = true; this.extraN = extras.length;
    if (color) { const c = new THREE.Color(color); for (let i = 0; i < 6; i++) this.sky.mesh.setColorAt(i, c); }
    extras.slice(0, 3).forEach((e, k) => { const d = this.sky.data[6 + k]; d.x = 30 + (k - 1) * 2.2; d.z = 26.5; this.sky.mesh.setColorAt(6 + k, new THREE.Color(e)); });
    this.sky.mesh.instanceColor.needsUpdate = true;
  }

  // ---------- ambient motion: leaves, fireflies ----------
  buildAmbient() {
    const n = 70; const geo = new THREE.BufferGeometry(); const p = new Float32Array(n * 3); const col = new Float32Array(n * 3); const c = new THREE.Color();
    this.leafData = [];
    for (let i = 0; i < n; i++) { const t = this.treePts[Math.floor(this.rng() * Math.min(this.treePts.length, 100))]; const d = { x: t[0], z: t[1], y: 1 + this.rng() * 4, ox: t[0], oz: t[1], h: 3 + this.rng() * 2, v: 0.3 + this.rng() * 0.4, ph: this.rng() * 6 }; this.leafData.push(d); c.set(PAL.leaves[i % PAL.leaves.length]); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.leaves = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, sizeAttenuation: true })); this.scene.add(this.leaves);
    const fn = 36; const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fn * 3), 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.13, color: '#f8ff9a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fireData = []; for (let i = 0; i < fn; i++) this.fireData.push({ x: 50 + this.rng() * 12, z: 38 + this.rng() * 9, y: 0.4 + this.rng() * 1.6, ph: this.rng() * 9 });
    this.scene.add(this.fireflies);
  }

  update(dt, hour, focus, opts = {}) {
    const tod = this.light.update(hour, focus, opts.camDist || 30);
    const night = clamp((tod.night - 0.08) / 0.6);
    this.nightK = night;
    this.glassLit.emissiveIntensity = night * 1.9;
    this.lampMat.emissiveIntensity = 0.15 + night * 2.6;
    if (night > 0.02) {
      const near = this.lampPos.map((p) => [p, (p[0] - focus.x) ** 2 + (p[1] - focus.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, this.lampLights.length);
      this.lampLights.forEach((l, i) => { const p = near[i] && near[i][0]; if (p) { l.position.set(p[0], 2.7, p[1]); l.intensity = night * 7; } });
    } else this.lampLights.forEach((l) => { l.intensity = 0; });
    this.glassWorks.emissiveIntensity = (this.worksDim ? 0.45 : 0.75) + night * (this.worksDim ? 0.9 : 1.6);
    for (const l of this.paperLanterns) l.material.emissiveIntensity = 0.35 + night * 2.2;
    if (this.porch) for (const l of this.porch) l.material.emissiveIntensity = 0.8 + night * 2;
    const t = now() / 1000;
    this.kiosk.ring.material.emissiveIntensity = 1.4 + Math.sin(t * 3.2) * 0.5 + night;
    if (this.flag) this.flag.rotation.y = Math.sin(t * 1.3) * 0.15;
    // leaves drift down and loop
    const lp = this.leaves.geometry.attributes.position;
    this.leafData.forEach((d, i) => { d.y -= d.v * dt; d.x += Math.sin(t * 1.3 + d.ph) * dt * 0.5; d.z += Math.cos(t * 0.9 + d.ph) * dt * 0.3; if (d.y < 0.05) { d.y = d.h; d.x = d.ox + (Math.random() - 0.5) * 2; d.z = d.oz + (Math.random() - 0.5) * 2; } lp.setXYZ(i, d.x, d.y, d.z); });
    lp.needsUpdate = true;
    this.fireflies.material.opacity = night * 0.95;
    if (night > 0.05) { const fp = this.fireflies.geometry.attributes.position; this.fireData.forEach((d, i) => fp.setXYZ(i, d.x + Math.sin(t * 0.7 + d.ph) * 0.8, d.y + Math.sin(t * 1.9 + d.ph) * 0.3, d.z + Math.cos(t * 0.6 + d.ph) * 0.8)); fp.needsUpdate = true; }
    if (this.water) this.water.material.color.setHSL(0.53, 0.3, 0.55 - night * 0.3 + Math.sin(t) * 0.01);
    // the bus: arrives at :40 past the hour, waits, leaves
    this.updateBus(dt, opts.min || 0, opts.skipStop);
    // sky lanterns
    if (this.skyLaunch > 0) {
      this.skyLaunch += dt; const m = this.sky.mesh;
      this.sky.data.forEach((d, i) => { const start = i < 6 ? (i % 30) * 0.25 : i < 6 + (this.extraN || 0) ? 0.9 + (i - 6) * 0.45 : (i % 30) * 0.25 + 1.5; const tt = Math.max(0, this.skyLaunch - start); const y = tt <= 0 ? -10 : 1 + tt * d.v * 1.6; m.setMatrixAt(i, mtx(d.x + Math.sin(tt * 0.5 + d.ph) * 0.6, y, d.z + Math.cos(tt * 0.4 + d.ph) * 0.6, 0, 1, 1.25, 1)); });
      m.instanceMatrix.needsUpdate = true;
    }
  }
  updateBus(dt, min, skip) {
    const b = this.busState; const m = ((min % 60) + 60) % 60;
    const target = m < 34 ? -50 : m < 39 ? lerp(-50, 24, (m - 34) / 5) : m < 42 ? 24 : m < 48 ? lerp(24, 100, (m - 42) / 6) : 100;
    let z = target;
    if (skip && m >= 34 && m < 48) z = lerp(-50, 100, (m - 34) / 14);
    if (Math.abs(z - b.z) > 60) b.z = z; else b.z = lerp(b.z, z, 1 - Math.exp(-6 * dt));
    this.bus.position.z = b.z; this.bus.visible = b.z > -45 && b.z < 95;
    b.atStop = !skip && m >= 39 && m < 42;
  }

  // ---------- navigation ----------
  findPath(x0, z0, x1, z1, wheels = false) {
    const ok = (cx, cz) => cx > 0 && cz > 0 && cx < GW - 1 && cz < GD - 1 && (this.grid[cz * GW + cx] === 0 || (!wheels && this.grid[cz * GW + cx] === 2));
    let sx = Math.floor(x0), sz = Math.floor(z0), tx = Math.floor(x1), tz = Math.floor(z1);
    const near = (x, z) => { if (ok(x, z)) return [x, z]; for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (ok(x + dx, z + dz)) return [x + dx, z + dz]; return null; };
    const s = near(sx, sz), t = near(tx, tz); if (!s || !t) return [];
    [sx, sz] = s; [tx, tz] = t;
    const N = GW * GD; const gS = new Float32Array(N).fill(1e9); const prev = new Int32Array(N).fill(-1); const closed = new Uint8Array(N);
    const open = [[0, sz * GW + sx]]; gS[sz * GW + sx] = 0;
    const H = (i) => { const x = i % GW, z = (i / GW) | 0; return Math.hypot(x - tx, z - tz); };
    const goal = tz * GW + tx;
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const cur = open[bi][1]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % GW, cz = (cur / GW) | 0;
      for (const [dx, dz, c] of NB) {
        const nx = cx + dx, nz = cz + dz; if (!ok(nx, nz)) continue;
        if (dx && dz && (!ok(cx + dx, cz) || !ok(cx, cz + dz))) continue;
        const ni = nz * GW + nx; const g = gS[cur] + c;
        if (g < gS[ni]) { gS[ni] = g; prev[ni] = cur; open.push([g + H(ni), ni]); }
      }
    }
    if (!found) return [];
    const pts = []; let c = goal; while (c !== -1) { pts.push([(c % GW) + 0.5, ((c / GW) | 0) + 0.5]); c = prev[c]; }
    pts.reverse();
    pts[pts.length - 1] = [x1, z1];
    if (!ok(Math.floor(x1), Math.floor(z1))) pts[pts.length - 1] = [tx + 0.5, tz + 0.5];
    // string-pull: drop points we can see past
    const out = [pts[0]];
    const clear = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.ceil(d * 3); for (let i = 1; i < n; i++) { const x = lerp(a[0], b[0], i / n), z = lerp(a[1], b[1], i / n); if (!ok(Math.floor(x), Math.floor(z)) || !ok(Math.floor(x + 0.3), Math.floor(z)) || !ok(Math.floor(x - 0.3), Math.floor(z)) || !ok(Math.floor(x), Math.floor(z + 0.3)) || !ok(Math.floor(x), Math.floor(z - 0.3))) return false; } return true; };
    let i = 0; while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    return out.slice(1);
  }
}
