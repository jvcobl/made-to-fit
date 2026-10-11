// What changed in ten and twenty years: a layer of props for each later visit, built when the visit starts (the first
// visit never pays for them). Nothing moves on any lot that wasn't there before: new things take over old spots, or
// live indoors. Each prop that can be looked at again also gets an interactable or a sight anchor here.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { signMesh } from './town.js';
import { Unit, deliveryBot, van } from './robot.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
const RAMP = { x0: 13.6, x1: 18.8, h: 0.54, z: 11.2 };
export const rampY = (x) => Math.max(0, Math.min(RAMP.h, RAMP.h * (RAMP.x1 - x) / (RAMP.x1 - RAMP.x0)));
// the crossing light: 'push' (timed to the Standard), 'hold' (the button for more time, if Marta was listened to) or
// 'waits' (the light waits for anyone still in the street)
export const crossingState = (S) => ((S.fixes || {}).crossing === 'built' ? ((S.stakes || {}).crossing === 'listened' ? 'hold' : 'waits') : 'push');

export function townLayer(T, act, S) {
  if (T.actLayer) return T.actLayer;
  const g = new THREE.Group(); g.name = 'act' + act; T.scene.add(g); T.actLayer = g; T.busOff = true; if (T.bus) T.bus.visible = false;
  const F = S.fixes || {}; const W = S.w || {};
  const sign = (text, x, y, z, w, h, o = {}, ry = 0) => { const m = signMesh(text, w, h, o); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const box = (w, h, d, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y, z); g.add(m); return m; };
  // the van at the old stop (the bus became a van; the van became an app)
  { const v = van(signMesh); v.position.set(57.4, 0, 23.4); g.add(v); T.van = v; T.spots.van = [56.1, 25.6]; }
  // the board, if you won it ten years ago; otherwise a sticker on the old timetable
  if (F.board === 'built') {
    const old = T.fixGroups.board && T.fixGroups.board.children[0]; if (old) old.visible = false;
    sign('VAN EVERY 20 MIN\nAPP, OR THE KIOSK', 53.6, 2.0, 22.97, 1.5, 0.6, { size: 34, bg: '#13202e', fg: '#9ef2e4', border: '#4fb3a9', glow: 1.3 });
  } else sign('BOOK ON\nTHE APP', 52.97, 1.12, 23.8, 0.5, 0.36, { size: 40, bg: '#ff5fa2', fg: '#ffffff', border: false }, Math.PI / 2);
  // the crossing by the bus stop: a light timed to the Standard's stride
  {
    const x = 46.6; T.crossing = { x };
    for (let i = 0; i < 6; i++) box(1.5, 0.02, 0.32, '#f4f1ea', x, 0.02, 22.75 + i * 0.55);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), mat('#4a4f58', { metalness: 0.4 })); post.position.set(x - 1.1, 1.3, 22.0); g.add(post);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.62, 0.2, 2, 0.05), mat('#2a2a30')); head.position.set(x - 1.1, 2.45, 22.0); g.add(head);
    T.crossRed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat('#e4574a', { emissive: '#e4574a', emissiveIntensity: 1.6 })); T.crossRed.position.set(x - 1.1, 2.6, 22.11); g.add(T.crossRed);
    T.crossGreen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat('#4fd18b', { emissive: '#4fd18b', emissiveIntensity: 0.15 })); T.crossGreen.position.set(x - 1.1, 2.3, 22.11); g.add(T.crossGreen);
    // the button says what the light does: PUSH (timed to the Standard), or the fix in the shape it was voted
    const btn = { push: 'PUSH', hold: 'HOLD FOR\nMORE TIME', waits: 'WAITS FOR\nEVERYONE' }; const signs = {};
    for (const k of Object.keys(btn)) { signs[k] = sign(btn[k], x - 1.1, 1.35, 22.07, 0.34, 0.26, { size: k === 'push' ? 30 : 26, bg: '#f6cf5b', fg: '#2b2530', border: false }); signs[k].visible = false; }
    T.setCrossing = (state) => { for (const k of Object.keys(signs)) signs[k].visible = k === state; T.crossButton = signs[state]; };
    T.setCrossing(crossingState(S));
    T.spots.crossing = [x - 0.4, 21.3]; T.spots.crossFar = [x + 0.2, 26.4];
    T.addInter({ id: 'crossing', kind: 'prop', x: x - 0.5, z: 21.6, r: 1.6, label: 'Look at the crossing' });
  }
  // the Blend Lounge beside the old kiosk: a pink bench and a sign
  {
    const b = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.14, 0.6, 2, 0.05), mat('#ff8fbe')); b.position.set(38.4, 0.5, 30.0); g.add(b);
    const back = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.6, 0.12, 2, 0.05), mat('#ff5fa2')); back.position.set(38.4, 0.85, 30.3); g.add(back);
    sign('BLEND LOUNGE\n♥ a heart a day', 38.4, 1.65, 30.37, 1.4, 0.5, { size: 34, bg: '#fdf7fb', fg: '#d0457f', border: '#ff5fa2' }, Math.PI);
    T.block(37.4, 29.6, 39.4, 30.5);
    T.spots.lounge = [38.4, 29.1];
  }
  // delivery bots on the ramp, if you built it (they found it too)
  if (F.ramp === 'built') {
    const b1 = deliveryBot(); b1.position.set(16.0, rampY(16.0), RAMP.z); b1.rotation.set(0, Math.PI / 2, -Math.atan2(RAMP.h, RAMP.x1 - RAMP.x0)); g.add(b1);
    const b2 = deliveryBot(); b2.position.set(20.2, 0, 12.6); b2.rotation.y = Math.PI / 2; g.add(b2);
    T.bots = [b1, b2]; T.spots.rampFoot = [19.6, 11.6];
  }
  if (act === 3) {
    // the Shed has a new keeper (you), and maybe a new sign
    T.shedSign = sign('FIX-IT SHED\nnew keeper', 52, 2.2, 9.95, 1.6, 0.5, { size: 34, bg: '#fbf6ee', fg: '#7a4e3c', border: '#7a4e3c' });
    T.coopSign = sign('FIX-IT SHED\na co-op', 52, 2.2, 9.96, 1.6, 0.5, { size: 34, bg: '#9edcd6', fg: '#1e3a3a', border: '#1e3a3a' }); T.coopSign.visible = false;
    Object.assign(T.spots, { shedYard: [50.6, 12.7], shedYard2: [53.6, 12.9], shedYard3: [49.8, 13.9], shedYard4: [54.6, 12.2], shedDoor: [52, 12.0] });
    // Founders' Row: the lane into the Far End carries the founders' name now
    { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat('#4a4f58', { metalness: 0.4 })); post.position.set(44.6, 1.2, 39.0); g.add(post);
      sign('FOUNDERS\' ROW', 44.6, 2.25, 39.05, 1.3, 0.3, { size: 44, bg: '#2f4a3a', fg: '#fbf6ee', border: '#fbf6ee' });
      T.addInter({ id: 'foundersrow', kind: 'prop', x: 44.6, z: 39.8, r: 1.3, label: 'Read the street sign' }); }
    // the stall leases board, by the square
    { for (const sx of [-0.7, 0.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), mat('#5a3a2a')); p.position.set(34.0 + sx, 0.85, 27.4); g.add(p); }
      sign('STALL LEASES\nto the highest bid\nwaiting list: 14', 34.0, 1.45, 27.45, 1.5, 0.8, { size: 30, bg: '#efe3cf', fg: '#5a3a2a', border: '#8a6f4e' });
      T.block(33.2, 27.2, 34.8, 27.6); T.addInter({ id: 'rentboard', kind: 'prop', x: 34.0, z: 28.3, r: 1.2, label: 'Read the leases board' }); }
    // a plate on the statue's plinth, if the Fund's gift is accepted
    T.fundPlate = sign('WITH THANKS TO\nTHE FOUNDERS\' FUND', 30, 0.36, 25.34, 1.3, 0.34, { size: 30, bg: '#b8893a', fg: '#fbf6ee', border: false }); T.fundPlate.visible = !!W.benefactor_yes;
    // benches at three heights round the statue (a low one, the old ones, a higher one with arms): built today by the
    // Fund or by the Shed with Juno, so hidden until then, with no wall where they will stand
    { const wood = mat('#9a7350'), metal = mat('#4a4f58', { metalness: 0.4 }); const all = {};
      // each bench is two meshes (wood, metal), so the festival pays two draw calls a bench
      const part = (w, hh, d, x, y, z) => new THREE.BoxGeometry(w, hh, d).translate(x, y, z);
      const one = (id, x, z, ry, h, arms) => {
        const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry;
        s.add(new THREE.Mesh(mergeGeometries([part(1.6, 0.08, 0.5, 0, h, 0), part(1.6, 0.34, 0.07, 0, h + 0.3, -0.24)]), wood));
        const m = [];
        for (const lx of [-0.72, 0.72]) { m.push(part(0.08, h, 0.44, lx, h / 2, 0)); if (arms) m.push(part(0.07, 0.06, 0.46, lx, h + 0.24, 0), part(0.06, 0.24, 0.06, lx, h + 0.12, 0.2)); }
        s.add(new THREE.Mesh(mergeGeometries(m), metal));
        s.visible = false; g.add(s); all[id] = { s, box: [x - 0.3, z - 0.85, x + 0.3, z + 0.85] };
      };
      one('low', 27.1, 24.0, -Math.PI / 2, 0.3, false); one('high', 32.9, 24.0, Math.PI / 2, 0.62, true);
      T.showBenches = (which) => { for (const k of which === 'three' ? ['low', 'high'] : ['low']) { const b = all[k]; if (b.s.visible) continue; b.s.visible = true; T.block(...b.box); } };
      if (W.benches3) T.showBenches(W.benches3); }
    // Juno's door, two along from yours
    T.junoSign = sign('KNOCK LOUD!\nCOME IN!', 15.0 + 1.0, 2.35, 35.54, 0.9, 0.4, { size: 34, bg: '#f2a99a', fg: '#2b2530', border: '#2b2530' });
    T.spots.junoDoor = [15, 37.0]; T.spots.junoFar = [47.2, 42.6]; T.spots.junoSquare = [32.6, 30.2]; T.spots.junoShed = [50.8, 13.4];
    // Moss's lease is up: "to let" on the cart, and a second little cart at the Far End if she moves
    T.toLet = sign('STALL 7\nTO LET', 24.6, 1.95, 28.2, 0.7, 0.4, { size: 34, bg: '#fbf6ee', fg: '#a8483f', border: '#a8483f' }, 0.4); T.toLet.visible = false;
    { const c = new THREE.Group(); const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.8, 0.9, 1, 0.08), mat('#6d7f5a')); body.position.y = 0.7; c.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 10), mat('#e2b34c')); roof.position.y = 2.6; c.add(roof);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), mat('#5a3a2a')); pole.position.y = 1.6; c.add(pole);
      c.position.set(45.6, 0, 40.4); c.visible = false; g.add(c); T.farCart = c; T.spots.cartFar = [46.4, 41.4]; }
    // the Far End stalls, if they were voted through
    { const s = new THREE.Group(); for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.9, 0.8, 1, 0.06), mat(['#c8553d', '#4f6f8f', '#e2b34c'][i])); st.position.set(41.6 + i * 2.2, 0.45, 44.4); s.add(st); const aw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 1.0), mat('#fbf6ee')); aw.position.set(41.6 + i * 2.2, 2.0, 44.4); s.add(aw); }
      s.visible = F.farstalls === 'built'; g.add(s); T.farStalls = s; }
  }
  g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  return g;
}

// the Works and Town Hall, ten years on: Unit at Dot's old desk, lamps and plants if the panels were softened, a
// plain-notes board if you won it; in the hall, a kiosk where the clerk's counter was, and this year's school photo
export function roomLayer(rooms, act, S) {
  const F = S.fixes || {}; const out = {};
  const W = rooms.works;
  if (act === 2 && !W.actLayer) {
    const g = new THREE.Group(); W.scene.add(g); W.actLayer = g;
    const u = new Unit(); const seat = W.seats[7]; u.root.position.set(seat[0], 0.02, seat[1] + 0.15); u.heading = Math.PI; u.root.rotation.y = Math.PI; g.add(u.root); out.unit = u; W.unit = u;
    W.spots.unit = [seat[0] + 0.9, seat[1] + 0.4]; W.spots.tomas = [-5.4, 3.0]; W.spots.ada = W.seats[8];
    // the lamps and plants (only if you softened the panels in your first visit: the room you left behind)
    if (F.dim === 'built') {
      const lg = new THREE.Group(); W.actLamps = lg; const n0 = g.children.length;
      const lampM = mat('#2f3a4a'); const shade = mat('#ffd9a0', { emissive: '#ffcf7a', emissiveIntensity: 0.9 });
      W.seats.forEach(([x, z], i) => { if (i === 7) return; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.42, 6), lampM); b.position.set(x + 0.6, 1.0, z - 1.0); g.add(b); const s = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 12, 1, true), shade); s.position.set(x + 0.6, 1.26, z - 1.0); g.add(s); });
      for (const [px, pz] of [[-7.2, -3.6], [-2.6, 4.3], [0.6, 4.3], [3.6, 3.6], [7.3, -0.6]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10), mat('#c97f5a')); pot.position.set(px, 0.2, pz); g.add(pot); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat('#5f8f4e')); l.position.set(px + Math.cos(i * 1.3) * 0.15, 0.6 + (i % 3) * 0.16, pz + Math.sin(i * 1.3) * 0.15); g.add(l); } }
      for (const ch of g.children.slice(n0)) lg.add(ch); g.add(lg);
      out.lampsShown = true;
    }
    if (F.plain === 'built') { const s = signMesh('THIS WEEK\nwho · what · by when', 1.5, 0.9, { size: 40, bg: '#fbf6ee', fg: '#2f3a4a', border: '#4fb3a9' }); s.position.set(-7.86, 1.75, 1.2); s.rotation.y = Math.PI / 2; g.add(s); }
    g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  }
  const H = rooms.hall;
  if (act >= 2 && !H.actLayer) {
    const g = new THREE.Group(); H.scene.add(g); H.actLayer = g;
    // the kiosk where the clerk's counter was
    const ped = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.1, 0.4, 2, 0.05), mat('#e9e3d6')); ped.position.set(5.6, 0.55, 0.2); g.add(ped);
    const scr = signMesh(act === 2 ? 'SPEAK OR TAP\n●  call bell' : 'SPEAK OR TAP', 0.7, 0.5, { size: 30, bg: '#13202e', fg: '#9ef2e4', border: '#4fb3a9', glow: 1.1 }); scr.position.set(5.36, 1.35, 0.2); scr.rotation.y = -Math.PI / 2; g.add(scr);
    H.inter.push({ id: 'hallkiosk', kind: 'prop', x: 4.7, z: 0.4, r: 1.2, label: 'Use the kiosk' });
    H.spots.kiosk = [4.6, 1.3]; H.spots.counter = [4.7, -0.9];
    // this year's school photo, by the door
    const frame = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.0, 0.06, 1, 0.03), mat('#b8893a', { metalness: 0.3 })); frame.position.set(6.92, 2.1, -1.8); frame.rotation.y = -Math.PI / 2; g.add(frame);
    const ph = signMesh(act === 2 ? 'LARKSPUR SCHOOL\n☺ ☺ ☺ ☺ ☺ ☺\n☺ ☺ ☺ ☺ ☺ ☺' : 'LARKSPUR SCHOOL\n☺ ☺ ☺ ☺ ☺\n☺ ☺ ☺ ☺', 1.24, 0.84, { size: 30, bg: '#f4ead8', fg: '#5a4630', border: false }); ph.position.set(6.88, 2.1, -1.8); ph.rotation.y = -Math.PI / 2; g.add(ph);
    H.inter.push({ id: 'schoolphoto', kind: 'prop', x: 6.0, z: -1.8, r: 1.2, label: 'Look at the school photo' });
    if (F.counter === 'built') { const c = signMesh('COUNTER OPEN\nfestival mornings', 1.0, 0.5, { size: 32, bg: '#fbf6ee', fg: '#2b7a78', border: '#2b7a78' }); c.position.set(6.9, 1.4, -0.4); c.rotation.y = -Math.PI / 2; g.add(c); }
    g.traverse((o) => { if (o.isMesh) o.userData.noOcc = true; });
  }
  return out;
}
