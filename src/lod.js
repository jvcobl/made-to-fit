// Which residents get the near rig, and one instanced draw for the blob shadows of every creature but you.
// Game.update calls updateLOD(G) once a frame, after creatures have moved and before the frame is drawn.
// - You always keep the near rig (creature.js), and so does anyone you are talking to (G.talking).
// - Up to NEAR_SLOTS other residents in your scene get it: those within NEAR_IN of you or of what the camera is looking
//   at (a room camera or a cutaway may frame them rather than you), nearest to that first; they keep it until NEAR_OUT.
// - Everyone else, and every extra (crowd, coworkers, the meeting audience, the founders, the statue), is baked.
import * as THREE from 'three';
import { blobMaterial } from './creature.js';

export const NEAR_IN = 13, NEAR_OUT = 16, NEAR_SLOTS = 4, NEAR_KEEP = 3;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

class LOD {
  constructor(G) {
    this.G = G;
    this.recs = Object.values(G.npcs).map((n) => ({ n, d: 0, ok: false, pick: false }));
    // every creature the game placed: residents, plus whatever stands in the town and the rooms
    const all = new Set(this.recs.map((r) => r.n.c));
    for (const scene of [G.town.scene, ...Object.values(G.rooms).map((r) => r.scene)]) scene.traverse((o) => { const c = o.userData.creature; if (c && c.root === o) all.add(c); });
    all.delete(G.player);
    this.all = [...all];
    // their blob shadows are drawn by one instanced mesh per scene (yours stays your own: portraits borrow you)
    for (const c of this.all) { c.blobLayer = true; c.blob.visible = false; }
    this.layers = new Map();
    this.blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }
  layer(scene) {
    let l = this.layers.get(scene);
    if (!l) {
      l = new THREE.InstancedMesh(this.blobGeo, blobMaterial(), this.all.length);
      l.instanceMatrix.setUsage(THREE.DynamicDrawUsage); l.frustumCulled = false; l.count = 0; l.userData.noOcc = true;
      scene.add(l); this.layers.set(scene, l);
    }
    return l;
  }
  update() {
    const G = this.G, here = G.player.root.parent, p = G.player.root.position, look = G.stage.camLook;
    // residents: who is close enough for the near rig, nearest first, at most NEAR_SLOTS
    for (const r of this.recs) {
      const c = r.n.c, q = c.root.position;
      r.pick = false; r.ok = false;
      if (!c.root.visible || c.root.parent !== here) continue;
      const dl = Math.hypot(q.x - look.x, q.z - look.z), d = Math.min(Math.hypot(q.x - p.x, q.z - p.z), dl), near = c.form === 'near';
      r.ok = G.talking === r.n.id || d < (near ? NEAR_OUT : NEAR_IN);
      // whoever you are talking to comes first, then whoever is closest to what the camera is looking at (in the
      // follow camera that is you); anyone already near keeps a slot unless someone clearly closer arrives
      r.d = G.talking === r.n.id ? -1e9 : near ? dl - NEAR_KEEP : dl;
    }
    for (let k = 0; k < NEAR_SLOTS; k++) {
      let best = null;
      for (const r of this.recs) if (r.ok && !r.pick && (!best || r.d < best.d)) best = r;
      if (!best) break;
      best.pick = true;
    }
    for (const r of this.recs) r.n.c.setForm(r.pick ? 'near' : 'baked');
    // the blob shadows of everyone in the scene being drawn
    const scene = G.stage.scene; if (!scene) return;
    const l = this.layer(scene); let n = 0;
    for (const c of this.all) {
      if (!c.root.visible || c.root.parent !== scene) continue;
      const q = c.root.position, k = c.S * 2.6;
      l.setMatrixAt(n++, _m.compose(_p.set(q.x, q.y + 0.015, q.z), _q, _s.set(k, k, k)));
    }
    if (n || l.count) { l.count = n; l.instanceMatrix.needsUpdate = true; }
  }
}

let lod = null;
export function updateLOD(G) {
  if (!lod || lod.G !== G) lod = new LOD(G);
  lod.update();
}
