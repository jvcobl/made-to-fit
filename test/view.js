import * as THREE from 'three';
import { Stage } from '../src/render.js';
import { Town } from '../src/town.js';
import { Home, Office, Chamber } from '../src/rooms.js';
import { Creature } from '../src/creature.js';
const q = new URLSearchParams(location.search);
const stage = new Stage(document.body, { quality: 'high', test: true });
stage.maxPR = 1; stage.resize();
const town = new Town('high');
const looks = [
  { shape: 'spiky', color: '#f6cf5b', pattern: 'belly', top: 'none', wear: 'flower' },
  { shape: 'tall', color: '#93c2ee', pattern: 'stripes', top: 'longears', wear: 'scarf' },
  { shape: 'blobby', color: '#9fd3b0', pattern: 'spots', top: 'antennae', wear: 'leaf' },
  { shape: 'boxy', color: '#bfa9f0', pattern: 'plain', top: 'horns', wear: 'glasses' },
  { shape: 'round', color: '#f2a99a', pattern: 'spots', top: 'ears', wear: 'hat', wheels: true },
];
const cs = looks.map((l, i) => { const c = new Creature(l, { seed: 10 + i }); c.root.position.set(26 + i * 1.6, 0, 30.5); c.heading = 0.15; c.update(0.02); town.scene.add(c.root); return c; });
window.__shots = async (name) => {
  const views = {
    noon: [13, () => { stage.follow(new THREE.Vector3(29, 0, 30.5), { snap: true }); }],
    golden: [18.6, () => { stage.shot(new THREE.Vector3(48, 22, 58), new THREE.Vector3(30, 0, 22), 40, 3, true); }],
    night: [21.6, () => { stage.shot(new THREE.Vector3(30, 26, 60), new THREE.Vector3(30, 0, 24), 42, 3, true); town.setFestival(true); }],
    works: [9, () => { stage.follow(new THREE.Vector3(12, 0, 14), { snap: true }); }],
    farend: [20.6, () => { stage.follow(new THREE.Vector3(51, 0, 42.5), { snap: true }); }],
    wide: [10.5, () => { stage.shot(new THREE.Vector3(32, 70, 78), new THREE.Vector3(32, 0, 22), 40, 3, true); }],
  };
  const [h, setup] = views[name];
  setup(); town.setFestival(name === 'night');
  stage.setScene(town.scene);
  for (let i = 0; i < 3; i++) { town.update(0.016, h, stage.rig.mode === 'follow' ? stage.rig.focus : new THREE.Vector3(30, 0, 24), { min: h * 60 }); stage.update(0.5); stage.render(); }
  return true;
};
window.__room = async (which) => {
  const r = which === 'home' ? new Home() : which === 'works' ? new Office() : new Chamber();
  const c = new Creature(looks[0], { seed: 3 }); c.root.position.set(r.spawn[0], 0, r.spawn[1] - 1); c.update(0.02); r.scene.add(c.root);
  stage.setScene(r.scene); stage.shot(r.cam.pos, r.cam.look, r.cam.fov, 3, true);
  for (let i = 0; i < 3; i++) { r.update(0.016, which === 'home' ? 20 : 10); stage.update(0.5); stage.render(); }
  return true;
};
window.__ready = true;
