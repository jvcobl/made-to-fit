// The machines of the later visits, built from a few plain meshes each: Unit (the Standard Resident, built in metal,
// with a screen for a face), the delivery bots on the Works ramp, the festival drone, and the van that replaced the bus.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp } from './util.js';

const metal = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.38, metalness: 0.5 }, o));
const flat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0 }, o));

// Unit's screen: one canvas, redrawn only when what it says changes
function screenCanvas() { const c = document.createElement('canvas'); c.width = 256; c.height = 160; return c; }
function drawScreen(c, text) {
  const g = c.getContext('2d'); g.fillStyle = '#16222b'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#9ef2e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!text) { // two calm eyes
    for (const x of [88, 168]) { g.beginPath(); g.ellipse(x, 76, 15, 19, 0, 0, Math.PI * 2); g.fill(); }
    return;
  }
  const lines = String(text).split('\n'); const size = lines.length > 2 ? 26 : 32;
  g.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  lines.forEach((l, i) => g.fillText(l, 128, 80 + (i - (lines.length - 1) / 2) * (size + 6)));
}

export class Unit {
  constructor() {
    const root = new THREE.Group(); this.root = root;
    const beige = metal('#e3d4bb', { metalness: 0.22, roughness: 0.42 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 20), beige); body.scale.set(1, 1.08, 0.94); body.position.y = 0.78; body.castShadow = true; root.add(body); this.body = body;
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 14), beige); ear.position.set(0.27 * s, 1.36, 0); ear.rotation.z = -0.32 * s; body.parent.add(ear); (this.ears = this.ears || []).push(ear); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 20), metal('#5b6470', { roughness: 0.6 })); base.position.y = 0.12; root.add(base);
    this.canvas = screenCanvas(); this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.33), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    scr.position.set(0, 0.86, 0.5); root.add(scr); this.screenMesh = scr;
    this.text = null; this.setScreen(''); this.t = Math.random() * 6; this.heading = 0; this.busy = 0;
    root.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  }
  setScreen(text) { const t = text || ''; if (t === this.text) return; this.text = t; drawScreen(this.canvas, t); this.tex.needsUpdate = true; }
  // a short, steady bob (no flashing: the screen only changes when the words do)
  update(dt, reduce) {
    this.t += dt; const bob = reduce ? 0 : Math.sin(this.t * 1.6) * 0.012;
    this.body.position.y = 0.78 + bob; for (const e of this.ears) e.position.y = 1.36 + bob;
    this.screenMesh.position.y = 0.86 + bob;
    this.root.rotation.y = damp(this.root.rotation.y, this.heading, 6, dt);
  }
}

// a delivery bot: a white box on six wheels, with a little orange flag so people see it coming
export function deliveryBot() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.36, 0.62, 2, 0.06), flat('#f4f1ea')); box.position.y = 0.34; box.castShadow = true; g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.58), flat('#2f3a4a')); lid.position.y = 0.53; g.add(lid);
  const wm = flat('#2a2a30');
  for (const sx of [-0.27, 0.27]) for (const sz of [-0.22, 0, 0.22]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), wm); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.09, sz); g.add(w); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), wm); pole.position.set(0.16, 0.88, -0.22); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), flat('#f2a33a', { side: THREE.DoubleSide })); flag.position.set(0.24, 1.18, -0.22); g.add(flag);
  g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  return g;
}

// the festival drone, with one lantern hanging under it
export function drone(color = '#ffcf7a') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.1, 0.36, 2, 0.03), flat('#2f3a4a')); g.add(body);
  const rotors = [];
  for (const [x, z] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 16), flat('#c9cfd6', { transparent: true, opacity: 0.55 })); r.position.set(x, 0.07, z); g.add(r); rotors.push(r); }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4), flat('#2a2a30')); line.position.y = -0.33; g.add(line);
  const lan = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), flat(color, { emissive: color, emissiveIntensity: 1.3 })); lan.scale.y = 1.25; lan.position.y = -0.72; g.add(lan);
  g.userData.rotors = rotors;
  g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  return g;
}

// the van that replaced the bus: booked on the app, with a door that kneels
export function van(signMesh) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.1, 1.9, 4.4, 3, 0.3), flat('#9edcd6', { roughness: 0.55 })); body.position.y = 1.25; body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.62, 3.4), new THREE.MeshStandardMaterial({ color: '#2f4a5a', roughness: 0.1, metalness: 0.3 })); glass.position.set(0, 1.62, -0.2); g.add(glass);
  const wm = flat('#2a2a30');
  for (const sx of [-0.98, 0.98]) for (const sz of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16), wm); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.36, sz); g.add(w); }
  if (signMesh) { const s = signMesh('VAN · BOOK ON THE APP', 1.9, 0.3, { bg: '#13202e', fg: '#9ef2e4', border: false, size: 46 }); s.position.set(0, 2.32, 0); s.rotation.y = Math.PI / 2; g.add(s); const s2 = s.clone(); s2.rotation.y = -Math.PI / 2; g.add(s2); }
  g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  return g;
}
