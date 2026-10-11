// Wayfinding: a floating lantern over where you are headed, a trail of warm dots on request,
// an arrow at the screen edge when the lantern is off-screen, and Bea walking you to work on day one.
import * as THREE from 'three';
import { clamp, lerp, FAST, sleep, now } from './util.js';
import { CAST } from './content.js';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,207,122,0.85)'); g.addColorStop(0.6, 'rgba(255,170,90,0.22)'); g.addColorStop(1, 'rgba(255,150,80,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beamGeometry(h) {
  const g = new THREE.CylinderGeometry(0.16, 0.38, h, 16, 6, true); g.translate(0, h / 2, 0);
  const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / h; const a = Math.pow(1 - y, 1.6) * 0.9; col[i * 3] = a; col[i * 3 + 1] = a * 0.78; col[i * 3 + 2] = a * 0.45; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

export class Guide {
  constructor(G) {
    this.G = G;
    const lamp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), new THREE.MeshStandardMaterial({ color: '#ffd58a', emissive: '#ffb04a', emissiveIntensity: 2.6, roughness: 0.5 }));
    body.scale.y = 1.28; lamp.add(body);
    for (const y of [0.34, -0.34]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.07, 12), new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.7 })); cap.position.y = y; lamp.add(cap); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    halo.scale.set(2.2, 2.2, 1); lamp.add(halo);
    const beam = new THREE.Mesh(beamGeometry(4.2), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 48), new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    this.mark = new THREE.Group(); this.mark.add(lamp, beam, ring); this.lamp = lamp; this.beam = beam; this.ring = ring; this.halo = halo;
    this.mark.visible = false;
    for (const o of [body, beam, ring]) o.userData.noOcc = true;
    // the trail: small warm dots on the ground
    const dot = new THREE.CircleGeometry(0.12, 12); dot.rotateX(-Math.PI / 2);
    this.trail = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.9, depthWrite: false }), 80);
    this.trail.count = 0; this.trail.frustumCulled = false; this.trailPts = [];
    this.trailOn = false; this.trailT = 0; this.repath = 0; this.idleT = 0; this.lastD = null;
    G.town.scene.add(this.trail);
    this.scene = null; this.target = null;
  }
  // which scene the marker lives in follows the player
  attach(scene) { if (this.scene === scene) return; if (this.mark.parent) this.mark.parent.remove(this.mark); scene.add(this.mark); this.scene = scene; }
  showTrail(on) { this.trailOn = on; this.repath = 0; if (!on) this.trail.count = 0; }
  // what to point at right now: in town, the objective; indoors, the thing the objective means in this room (your
  // desk, your bed, Gil) or else the door, when the objective is outside
  pick() {
    const G = this.G; const obj = G.story.objective();
    if (!obj || G.mode !== 'play') return null;
    const r = G.loc === 'town' ? null : G.rooms[G.loc];
    if (r && obj.inside === G.loc) { const s = this.spotOf(obj.spot); return s ? { x: s.x, z: s.z, label: obj.spotLabel || '', obj, room: true, here: true } : null; }
    if (!obj.at) return null;
    if (G.loc === 'town') return { x: obj.at[0], z: obj.at[1], label: obj.label || '', obj };
    if (!r) return null;
    const out = r.inter.find((i) => i.id === 'out'); if (!out) return null;
    return { x: out.x, z: out.z, label: 'Head out', obj, room: true };
  }
  // a spot inside the room you are in: a resident here, or one of the room's things
  spotOf(id) {
    const G = this.G; if (!id) return null;
    const n = G.npcs[id]; if (n && n.c.root.visible && n.c.root.parent === G.player.root.parent) return n.c.root.position;
    const r = G.rooms[G.loc]; const it = r && r.inter.find((i) => i.id === id); return it ? { x: it.x, z: it.z } : null;
  }
  update(dt) {
    const G = this.G; const set = G.settings.guide || 'full';
    const tgt = set === 'off' ? null : this.pick(); this.target = tgt;
    const scene = G.loc === 'town' ? G.town.scene : G.rooms[G.loc] && G.rooms[G.loc].scene; if (scene) this.attach(scene);
    const p = G.player.root.position;
    if (!tgt) { this.mark.visible = false; this.trail.count = 0; G.ui.edge(null); return; }
    const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
    const t = now() / 1000;
    this.mark.visible = true; this.mark.position.set(tgt.x, 0, tgt.z);
    const near = clamp((d - 1.2) / 3.5);
    const lift = tgt.room ? 2.3 : 3.9;
    this.lamp.position.y = lift + Math.sin(t * 2) * 0.12; this.lamp.rotation.y = t * 0.6;
    this.lamp.scale.setScalar(tgt.room ? 0.75 : 1);
    this.beam.scale.set(1, tgt.room ? 0.5 : 0.92, 1); this.beam.material.opacity = 0.5 * near;
    this.ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08); this.ring.material.opacity = 0.65 * near + 0.1;
    this.halo.material.opacity = 0.35 + 0.5 * near;
    // nudge: if you have been wandering away for a while, the trail appears by itself (it never nags)
    if (G.loc === 'town' && set === 'full') {
      if (this.lastD != null && d > this.lastD - 0.02 && !G.busy && !G.ui.waiter) this.idleT += dt; else this.idleT = Math.max(0, this.idleT - dt * 2);
      this.lastD = d;
      if (this.idleT > 28 && d > 10 && !this.trailOn) this.showTrail(true);
    }
    if (d < 2.2 && this.trailOn) this.showTrail(false);
    this.updateTrail(dt, tgt, d, set);
    this.updateEdge(tgt, d);
  }
  updateTrail(dt, tgt, d, set) {
    const G = this.G;
    if (!this.trailOn || G.loc !== 'town' || set !== 'full') { this.trail.count = 0; return; }
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.8; const p = G.player.root.position;
      const path = G.town.findPath(p.x, p.z, tgt.x, tgt.z, G.S.wheels); const pts = [];
      let prev = [p.x, p.z], acc = 0.9;
      for (const q of path) { const len = Math.hypot(q[0] - prev[0], q[1] - prev[1]); while (acc < len) { const k = acc / len; pts.push([lerp(prev[0], q[0], k), lerp(prev[1], q[1], k)]); acc += 1.15; if (pts.length >= 80) break; } acc -= len; prev = q; if (pts.length >= 80) break; }
      this.trailPts = pts; this.route = [[p.x, p.z]].concat(path);
    }
    const m = new THREE.Matrix4(); const t = now() / 1000; const n = this.trailPts.length;
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [x, z] = this.trailPts[i]; const wave = 0.75 + 0.5 * Math.max(0, Math.sin(i * 0.55 - t * 5));
      m.makeScale(wave, 1, wave); m.setPosition(x, 0.05, z); this.trail.setMatrixAt(i, m);
      col.setRGB(1, 0.85, 0.54).multiplyScalar(clamp(1 - i / 90) * 0.6 + 0.4); this.trail.setColorAt(i, col);
    }
    this.trail.count = n; this.trail.instanceMatrix.needsUpdate = true; if (this.trail.instanceColor) this.trail.instanceColor.needsUpdate = true;
  }
  // where on screen is the target? if it is off-screen, put an arrow at the edge
  updateEdge(tgt, d) {
    const G = this.G; const cam = G.stage.camera;
    if (G.loc !== 'town' || G.mode !== 'play' || G.ui.waiter || G.phoneOpen || G.mgActive || d < 3) { G.ui.edge(null); return; }
    const v = new THREE.Vector3(tgt.x, 2.2, tgt.z).project(cam);
    const W = innerWidth, H = innerHeight; const pad = 64; const top = (G.hudBottom || 80) + 46, bot = G.ui.touch ? 120 : 92;
    const behind = v.z > 1;
    let sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
    const onScreen = !behind && sx > pad && sx < W - pad && sy > top && sy < H - bot;
    if (onScreen) { G.ui.edge(null); return; }
    if (behind) { sx = W - sx; sy = H - sy; }
    const cx = W / 2, cy = H / 2; const dx = sx - cx, dy = sy - cy;
    const ang = Math.atan2(dy, dx);
    const kx = (W / 2 - pad) / Math.max(1e-3, Math.abs(Math.cos(ang))), ky = ((dy < 0 ? cy - top : H - bot - cy)) / Math.max(1e-3, Math.abs(Math.sin(ang)));
    const k = Math.min(kx, ky);
    G.ui.edge({ x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k, ang: ang + Math.PI / 2, label: tgt.label || 'There', dist: Math.max(1, Math.round(d)) });
  }
  // a dashed line on the phone map from you to where you are going
  routeSvg() {
    const G = this.G; const tgt = this.target; if (!tgt || G.loc !== 'town') return '';
    const p = G.player.root.position; const path = G.town.findPath(p.x, p.z, tgt.x, tgt.z, G.S.wheels);
    const pts = [[p.x, p.z]].concat(path).map(([x, z]) => (x * 5).toFixed(1) + ',' + (z * 5).toFixed(1)).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="#ffcf7a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 7"/><circle cx="${tgt.x * 5}" cy="${tgt.z * 5}" r="6" fill="#ffcf7a" stroke="#7a5236" stroke-width="1.5"/>`;
  }
}

// Day one: Bea walks you from Home Row to the Works, talking as you go. You keep control; she waits.
export async function escortBea(G) {
  const S = G.S; const n = G.npcs.bea; if (!n) return;
  S.flags.escort = 1;
  const say = (t, ms) => { G.ui.bubble('bea', t, { tint: CAST.bea.tint, ms }); G.audio.voice(CAST.bea.voice[0], CAST.bea.voice[1], t); };
  // she waits at your gate, then leads you east along the row, up the garden cut, and left to the Works path
  const pts = [[12.8, 38.9], [19.0, 38.3], [19.0, 30.4], [19.4, 25.4], [14.4, 25.0]];
  const lines = [
    'Morning, No. 2! First day at the Works? I\'m headed that way. Walk with me.',
    'We\'ll take the garden cut. Fifty years, and it\'s still the only shortcut on the row.',
    null,
    'That\'s the square. The statue in the middle is the Standard Resident. The whole town was built to fit it. Nobody looks like it. Least of all me.',
    'The Works is the gray one with the twitchy windows. Straight up that path. Go on, or Gil will say "no worries" at you.',
  ];
  const p = () => G.player.root.position; const q = () => n.c.root.position;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const worksDoor = { x: 12, z: 13.8 };
  const over = () => S.flags.shift1 || S.min > 600 || G.loc !== 'town' || S.day !== 1;
  G.beaWay = pts[0];
  await sleep(60);
  if (n.place === 'town' && dist(q(), { x: pts[0][0], z: pts[0][1] }) > 3) { n.c.root.position.set(pts[0][0], 0, pts[0][1]); n.path = []; n.goal = pts[0]; }
  // greet you when you come near
  let t = 0;
  while ((dist(p(), q()) > 6.5 || !G.anchorOf('bea')) && t < 45000 && !over()) { await sleep(150); t += 150; }
  if (!over()) { say(lines[0]); await sleep(FAST ? 50 : 1600); }
  let lastWait = 0;
  for (let i = 1; i < pts.length && !over(); i++) {
    G.beaWay = pts[i];
    while (!over() && dist(q(), { x: pts[i][0], z: pts[i][1] }) > 0.7) {
      if (dist(p(), worksDoor) < 13 && i >= 2) { say('Ah, you\'ve got it! Go on, then!'); G.beaWay = null; S.flags.escort_done = 1; return; }
      // fell behind: she stops and turns, and waits without nagging
      if (dist(p(), q()) > 8 && !G.busy) {
        G.beaWay = [q().x, q().z];
        if (now() - lastWait > 9000) { lastWait = now(); say(i <= 1 ? 'This way, dear! Along the row.' : 'This way!'); }
        let w = 0; while (dist(p(), q()) > 5 && w < 60000 && !over()) { await sleep(200); w += 200; }
        G.beaWay = pts[i];
      }
      await sleep(120);
    }
    if (lines[i] && !over()) say(lines[i]);
    if (i === 3) await sleep(FAST ? 50 : 2600);
  }
  G.beaWay = null; S.flags.escort_done = 1;
}
