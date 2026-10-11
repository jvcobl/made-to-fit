// Who Bends: the game loop, the world, movement, residents, crowds, and the sensory mapping.
import * as THREE from 'three';
import { Stage } from './render.js';
import { Town, ZONES } from './town.js';
import { Home, Office, Chamber } from './rooms.js';
import { Creature, OPTIONS } from './creature.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import * as SIM from './sim.js';
import { CAST, ROUTINES, BLEND } from './content.js';
import { Story } from './story.js';
import { Guide } from './guide.js';
import { updateLOD } from './lod.js';
import { Feed } from './games/feed.js';
import { params, FAST, FIXED, STEP, clock, keyName, clamp, lerp, damp, makeRng, pick, sleep } from './util.js';

const LEAVE_TO = { market: [30, 36.5], transit: [46, 24], commons: [38, 14.5], farend: [36, 41.5], homerow: [30, 30], street: [30, 30], festival: [30, 38] };
const FEST = { bea: [26.2, 28.6], wren: [33.6, 28.8], rue: [35.6, 26.2], gil: [24.8, 25.2], moss: [25.4, 29.4], hollis: [30, 28.2], pip: [34.6, 21.8], clover: [27.0, 21.4] };
const CROWD_ZONES = [['market', 13], ['street', 5], ['transit', 4], ['commons', 4], ['homerow', 4], ['farend', 1]];
// on tall phone screens the fixed room cameras look down from the open side so every door stays in view
const PORTRAIT_CAM = {
  home: { pos: new THREE.Vector3(4.37, 15.78, -0.58), look: new THREE.Vector3(0, 0.4, 0), fov: 50 },
  works: { pos: new THREE.Vector3(5.62, 23.47, 0), look: new THREE.Vector3(-1, 0.4, 0), fov: 54 },
  hall: { pos: new THREE.Vector3(5.62, 23.47, 0), look: new THREE.Vector3(-1, 0.4, 0), fov: 54 },
};

class Game {
  constructor(data = {}) {
    this.resume = data && data.S && data.S.day >= 1 ? data.S : null;
    this.settings = Object.assign({ fx: 1, reduceMotion: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, textSpeed: 'normal', textSize: 'm', holdToBend: true, quality: '', pace: 'steady', guide: 'full', blendPings: true, flicker: true }, this.loadSettings());
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
    const quality = params.get('q') || this.settings.quality || (mobile ? 'low' : 'high');
    this.test = params.get('test') === '1';
    this.stage = new Stage(document.body, { quality, test: this.test });
    this.town = new Town(quality);
    this.rooms = { home: new Home(), works: new Office(), hall: new Chamber() };
    this.audio = new Audio();
    if (params.get('mute') === '1') this.audio.setMuted(true);
    this.S = SIM.newState(+(params.get('seed') || Date.now() % 100000));
    this.S.look = { shape: 'round', color: '#93c2ee', pattern: 'belly', top: 'longears', wear: 'scarf', voice: 'chime', wheels: false };
    this.player = new Creature(this.S.look, { seed: 7 });
    this.texts = []; this.mode = 'title'; this.busy = 0; this.loc = 'town'; this.zone = 'street'; this.path = []; this.keys = {}; this.minAcc = 0; this.stepT = 0;
    this.timeScale = FAST ? 22 : 2.5; this.pinchNow = null; this.pinchT = 0; this.talking = null; this.target = null; this.phoneOpen = false; this.settingsOpen = false; this.holdK = 0;
    this.tall = innerHeight > innerWidth * 1.1;
    window.addEventListener('resize', () => { const was = this.tall; this.tall = innerHeight > innerWidth * 1.1; if (was !== this.tall && this.loc !== 'town' && this.mode === 'play' && !this.talking) { const c = this.roomCam(this.loc); this.stage.shot(c.pos, c.look, c.fov, 3); } });
    this.buildNPCs(); this.buildCrowd();
    this.story = new Story(this);
    this.ui = new UI(this);
    this.guide = new Guide(this);
    this.feed = new Feed(this);
    this.applySettings();
    this.bindInput();
    this.setLoc('town');
    this.last = performance.now();
    this.frameN = 0;
    // in fixed-step test mode the loop never runs by itself: window.__wb.step(n) drives stepFrames()
    const loop = (t) => { const dt = Math.min(FAST ? 0.25 : 0.05, (t - this.last) / 1000); this.last = t; try { this.update(dt); } catch (e) { console.error(e); } requestAnimationFrame(loop); };
    if (!FIXED) requestAnimationFrame(loop);
    const ld = document.getElementById('loading'); if (ld) { ld.style.opacity = '0'; setTimeout(() => ld.remove(), 700); }
    this.story.start().catch((e) => console.error(e));
  }
  // ---------- settings ----------
  loadSettings() { try { return JSON.parse(localStorage.getItem('whobends.settings') || '{}'); } catch (e) { return {}; } }
  saveSettings() { try { localStorage.setItem('whobends.settings', JSON.stringify(this.settings)); } catch (e) { /* storage may be blocked */ } }
  applySettings() {
    const s = this.settings; this.stage.fxScale = s.fx; this.stage.reduceMotion = !!s.reduceMotion;
    document.body.classList.remove('text-s', 'text-l', 'text-xl'); if (s.textSize !== 'm') document.body.classList.add('text-' + s.textSize);
    document.body.classList.toggle('reduce', !!s.reduceMotion);
  }
  async openSettings(fromTitle) { if (this.settingsOpen) return; this.settingsOpen = true; await this.ui.settings(fromTitle); this.settingsOpen = false; }
  togglePhone(fromButton) {
    if (this.mode === 'title' || this.mode === 'creator') return;
    if (!this.phoneOpen && (this.ui.waiter || !this.ui.panel.hidden || this.mgActive || this.mode === 'cine')) { if (fromButton) this.ui.toast('Your phone can wait until this is done.', '', 1800); return; }
    this.phoneOpen = !this.phoneOpen; if (this.phoneOpen) { this.ui.openPhone(); this.ui.ping(false); } else this.ui.closePhone();
  }
  met(id) { return !!this.S.met[id]; }
  goals() { return this.story.goals(); }
  roomCam(id) { const r = this.rooms[id]; return this.tall && PORTRAIT_CAM[id] ? PORTRAIT_CAM[id] : r.cam; }
  followOpts(o = {}) { return Object.assign(this.tall ? { dist: 17.5, fov: 44, pitch: 0.9 } : { dist: 14.5 }, o); }
  // ---------- residents ----------
  buildNPCs() {
    this.npcs = {};
    let seed = 400;
    for (const id of Object.keys(CAST)) {
      const c = new Creature(CAST[id].look, { seed: seed++ });
      if (CAST[id].cart) {
        const cart = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#4f6f8f', roughness: 0.7 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: '#c8553d', roughness: 0.8 })); box.position.set(0, 0.42, 0); cart.add(box);
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), m); h.position.set(0, 0.62, -0.14); h.rotation.x = 0.4; cart.add(h);
        for (const sx of [-0.2, 0.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), m); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.1, 0); cart.add(w); }
        cart.position.set(0.5, 0, 0.35); c.root.add(cart);
      }
      c.root.visible = false;
      this.npcs[id] = { id, c, place: 'away', spot: null, path: [], override: null };
    }
    // coworkers at the Works, neighbors on the council benches
    const R = makeRng(99); const rl = () => ({ shape: pick(OPTIONS.shape.map((x) => x[0]), R), color: pick(OPTIONS.color, R), pattern: 'plain', top: pick(OPTIONS.top.map((x) => x[0]), R), wear: R() < 0.3 ? pick(['scarf', 'glasses', 'hat', 'bow'], R) : 'none' });
    this.rl = rl;
    this.workers = this.rooms.works.seats.filter((_, i) => i !== 6).slice(0, 7).map(([x, z], i) => { const c = new Creature(i === 4 ? { shape: 'tall', color: '#9edcd6', pattern: 'spots', top: 'tuft', wear: 'glasses' } : rl(), { lod: 'low', seed: 700 + i, form: 'baked' }); c.root.position.set(x, 0.12, z - 0.15); c.heading = Math.PI; c.root.rotation.y = Math.PI; this.rooms.works.scene.add(c.root); return c; });
    const bs = [[-4.6, 2.0], [-3.2, 2.0], [-2.2, 2.0], [3.0, 2.0], [4.4, 2.0], [-4.2, 3.5], [-2.8, 3.5], [3.4, 3.5], [4.8, 3.5], [2.2, 3.5]];
    this.audience = bs.map(([x, z], i) => { const c = new Creature(rl(), { lod: 'low', seed: 800 + i, form: 'baked' }); c.root.position.set(x, 0.1, z); c.heading = Math.PI; c.root.rotation.y = Math.PI; this.rooms.hall.scene.add(c.root); return c; });
  }
  npcWant(id) {
    const S = this.S, d = S.day, m = S.min;
    if (d === 0) return { place: 'away' };
    if (id === 'bea' && this.beaWay) return { place: 'town', pos: this.beaWay };
    if (id === 'bea' && d === 1 && S.flags.escort_done && m < 630) return { place: 'town', spot: 'squareW' };
    if (S.flags.festival) {
      if (id === 'wren' && !S.flags.wren_invited) return { place: 'town', spot: 'workshop' };
      if (id === 'moss' && S.fixes.quiet === 'built') return { place: 'town', pos: [23.4, 31.0] };
      return { place: 'town', pos: FEST[id] };
    }
    if (d === 3 && m >= 1070 && m < 1185) {
      const council = { hollis: 'hollis', pip: 'pip', clover: 'clover' };
      if (council[id]) return { place: 'hall', spot: council[id] };
      const backs = Object.values(S.support).some((a) => a.includes(id));
      if (backs) { const order = ['bea', 'moss', 'wren', 'rue', 'gil']; return { place: 'hall', pos: [[-3.9, 2.0], [-2.6, 3.5], [3.8, 2.0], [2.8, 3.5], [-4.6, 3.5]][order.indexOf(id) % 5] }; }
    }
    const R = ROUTINES[id]; let w = R[R.length - 1];
    for (const r of R) if (m >= r[0] && m < r[1]) { w = r; break; }
    let place = w[2], spot = w[3];
    if (place === 'works' && d === 3) { place = 'town'; spot = 'cartFront'; }
    return { place, spot };
  }
  spotPos(place, spot, pos) {
    if (pos) return pos;
    if (place === 'town') return this.town.spots[spot] || (spot === 'cartFront' ? [26.6, 29.4] : [30, 30]);
    const r = this.rooms[place]; return (r && r.spots[spot]) || [0, 0];
  }
  sceneOf(place) { return place === 'town' ? this.town.scene : this.rooms[place] ? this.rooms[place].scene : null; }
  updateNPCs(dt) {
    for (const id in this.npcs) {
      const n = this.npcs[id]; const c = n.c;
      const w = n.override ? { place: n.place, pos: n.override } : this.npcWant(id);
      const pos = w.place === 'away' ? null : this.spotPos(w.place, w.spot, w.pos);
      if (w.place !== n.place) {
        if (c.root.parent) c.root.parent.remove(c.root);
        n.place = w.place; n.path = []; n.goal = pos;
        if (w.place === 'away') c.root.visible = false;
        else { this.sceneOf(w.place).add(c.root); c.root.visible = true; c.root.position.set(pos[0], w.place === 'hall' && pos[1] < -2.2 ? 0.35 : 0, pos[1]); }
      } else if (pos && n.goal && (Math.abs(pos[0] - n.goal[0]) > 0.05 || Math.abs(pos[1] - n.goal[1]) > 0.05)) {
        n.goal = pos;
        n.path = w.place === 'town' && !n.override ? this.town.findPath(c.root.position.x, c.root.position.z, pos[0], pos[1]) : [pos];
        if (!n.path.length) { c.root.position.set(pos[0], 0, pos[1]); }
      } else if (!n.goal && pos) n.goal = pos;
      let moving = false;
      if (n.path.length) {
        const [tx, tz] = n.path[0]; const dx = tx - c.root.position.x, dz = tz - c.root.position.z; const dist = Math.hypot(dx, dz);
        if (dist < 0.15) n.path.shift();
        else { const sp = Math.min(dist, (this.S.flags.festival ? 1.4 : 2.3) * dt); c.root.position.x += dx / dist * sp; c.root.position.z += dz / dist * sp; c.heading = Math.atan2(dx, dz); moving = true; }
      }
      c.speed = moving ? 0.55 : 0;
      if (!moving && c.root.visible) {
        const p = this.player.root.position; const same = c.root.parent === this.player.root.parent;
        if (this.talking === id) c.faceToward(p.x, p.z);
        else if (same && Math.hypot(p.x - c.root.position.x, p.z - c.root.position.z) < 4.5) c.faceToward(p.x, p.z);
        else c.heading = n.place === 'hall' ? Math.PI : 0;
      }
      if (c.root.visible) c.update(dt);
    }
  }
  npcNear(id, zone) {
    const n = this.npcs[id]; if (!n || n.place === 'away') return false;
    if (zone === 'works' || zone === 'hall') return n.place === zone && this.loc === zone;
    if (n.place !== 'town' || this.loc !== 'town') return false;
    const p = this.player.root.position, q = n.c.root.position; return Math.hypot(p.x - q.x, p.z - q.z) < 14;
  }
  npcTo(id, pos) { const n = this.npcs[id]; if (n) { n.override = pos; } }
  npcDots() { return Object.values(this.npcs).filter((n) => n.place === 'town').map((n) => ({ x: n.c.root.position.x, z: n.c.root.position.z, name: CAST[n.id].name, color: CAST[n.id].look.color })); }
  playerDot() { if (this.loc === 'town') return { x: this.player.root.position.x, z: this.player.root.position.z }; const d = { home: [9.5, 37], works: [12, 12], hall: [32, 12] }[this.loc]; return d ? { x: d[0], z: d[1] } : null; }
  routeSvg() { return this.guide ? this.guide.routeSvg() : ''; }
  // where to draw a speech bubble: above a head, in screen pixels
  anchorOf(key) {
    const c = key === 'you' ? this.player : this.npcs[key] && this.npcs[key].c;
    if (!c || !c.root.visible || c.root.parent !== this.player.root.parent) return null;
    const v = c.root.position.clone(); v.y += c.look && c.look.shape === 'tall' ? 2.45 : 2.05; v.project(this.stage.camera);
    if (v.z > 1 || v.x < -2.2 || v.x > 2.2 || v.y < -2.2 || v.y > 2.2) return null;
    const top = this.hudBottom ? this.hudBottom + 70 : 150;
    return { x: clamp((v.x + 1) / 2 * innerWidth, 150, innerWidth - 150), y: clamp((1 - v.y) / 2 * innerHeight, top, innerHeight - 40) };
  }
  // ---------- crowds ----------
  buildCrowd() {
    this.crowd = [];
    let i = 0;
    for (const [zone, n] of CROWD_ZONES) for (let k = 0; k < n; k++) {
      const c = new Creature(this.rl(), { lod: 'low', seed: 900 + i++, form: 'baked', shadow: this.stage.quality !== 'low' });
      c.root.visible = false; this.town.scene.add(c.root);
      this.crowd.push({ c, zone, path: [], wait: Math.random() * 3, active: false });
    }
    this.crowdPathBudget = 0;
  }
  randomIn(zone) {
    const z = ZONES.find((q) => q.id === zone); const rect = zone === 'street' ? [2, 22.5, 54, 25.5] : z.rect;
    for (let t = 0; t < 30; t++) { const x = rect[0] + 1 + Math.random() * (rect[2] - rect[0] - 2), zz = rect[1] + 1 + Math.random() * (rect[3] - rect[1] - 2); if (this.town.walkable(x, zz)) return [x, zz]; }
    return null;
  }
  updateCrowd(dt) {
    const S = this.S; const inTown = this.loc === 'town';
    const want = {};
    for (const [zone, n] of CROWD_ZONES) {
      const L = SIM.levels(S, S.flags.festival && zone === 'market' ? 'festival' : zone, S.min);
      want[zone] = S.flags.festival ? (zone === 'market' ? n : Math.round(n * 0.3)) : S.day === 0 ? Math.round(n * 0.3) : Math.round(n * clamp(L.people * 1.25));
    }
    const count = {};
    this.crowdPathBudget = 2;
    const p = this.player.root.position;
    for (const a of this.crowd) {
      const c = a.c; const far = Math.hypot(c.root.position.x - p.x, c.root.position.z - p.z) > 22 || !inTown;
      count[a.zone] = (count[a.zone] || 0);
      if (!a.active && count[a.zone] < want[a.zone] && (far || !c.root.visible)) { const q = this.randomIn(a.zone); if (q) { a.active = true; c.root.position.set(q[0], 0, q[1]); c.root.visible = true; } }
      if (a.active && count[a.zone] >= want[a.zone] && far) { a.active = false; c.root.visible = false; }
      if (!a.active) continue;
      count[a.zone]++;
      if (a.path.length) {
        const [tx, tz] = a.path[0]; const dx = tx - c.root.position.x, dz = tz - c.root.position.z; const d = Math.hypot(dx, dz);
        if (d < 0.2) a.path.shift(); else { const sp = Math.min(d, 1.5 * dt); c.root.position.x += dx / d * sp; c.root.position.z += dz / d * sp; c.heading = Math.atan2(dx, dz); }
        c.speed = 0.45;
      } else {
        c.speed = 0; a.wait -= dt;
        if (S.spot > 0.3 && Math.hypot(c.root.position.x - p.x, c.root.position.z - p.z) < 7) c.faceToward(p.x, p.z);
        if (a.wait <= 0 && this.crowdPathBudget > 0) { this.crowdPathBudget--; const q = this.randomIn(a.zone); if (q) a.path = this.town.findPath(c.root.position.x, c.root.position.z, q[0], q[1]).slice(0, 12); a.wait = 2 + Math.random() * 6; }
      }
      if (!far || c.root.visible) c.update(dt);
    }
  }
  // ---------- places ----------
  setLoc(loc) {
    this.loc = loc;
    const scene = loc === 'town' ? this.town.scene : this.rooms[loc].scene;
    this.stage.setScene(scene); scene.add(this.player.root);
    for (const w of this.audience) w.root.visible = false;
    this.path = []; this.stuckT = 0;
  }
  place(xz) { this.player.root.position.set(xz[0], 0, xz[1]); this.path = []; if (this.loc === 'town') this.stage.follow(this.player.root.position, this.followOpts({ snap: true })); }
  walkTo(x, z) {
    this.walkGoal = [x, z]; this.stuckT = 0; this.repathed = false;
    if (this.loc === 'town') this.path = this.town.findPath(this.player.root.position.x, this.player.root.position.z, x, z, this.S.wheels);
    else this.path = [[x, z]];
  }
  async enterRoom(id, quick) {
    await this.stage.fadeTo(1, quick ? 200 : 450);
    this.audio.sfx('door');
    this.setLoc(id); const r = this.rooms[id]; this.place(r.spawn);
    const c = this.roomCam(id); this.stage.shot(c.pos, c.look, c.fov, 3, true);
    this.audio.setScene(id === 'home' ? 'home' : id === 'works' ? 'works' : 'council');
    await this.stage.fadeTo(0, quick ? 200 : 450);
  }
  async exitRoom(silent) {
    const from = this.loc;
    await this.stage.fadeTo(1, 400);
    this.audio.sfx('door');
    this.setLoc('town');
    const spot = { home: [9.5, 38.7], works: [12, 13.8], hall: [32, 14.4] }[from] || [30, 30];
    this.place(spot); this.player.heading = from === 'home' ? Math.PI : 0;
    this.stage.follow(this.player.root.position, this.followOpts({ snap: true }));
    this.npcs.gil.override = null;
    await this.stage.fadeTo(0, 400);
    this.story.onOutside(from);
  }
  async leaveZone(zone) {
    if (zone === 'works' || zone === 'hall') { await this.exitRoom(); return; }
    const to = LEAVE_TO[zone]; if (to) this.walkTo(to[0], to[1]);
  }
  // "Show the way": walk toward the objective, and light the trail
  showWay() {
    const obj = this.story.objective(); if (!obj || !obj.at || this.mode !== 'play') return;
    if (this.busy || this.ui.waiter || this.phoneOpen) return;
    this.audio.sfx('select');
    this.guide.showTrail(true);
    if (this.loc !== 'town') { if (obj.inside === this.loc) return; this.run(async () => { await this.exitRoom(); this.walkTo(obj.at[0], obj.at[1]); }); return; }
    this.walkTo(obj.at[0], obj.at[1]);
  }
  advance(mins) {
    const S = this.S;
    for (let i = 0; i < mins; i++) {
      S.min += 1;
      const p = SIM.pinch(S, this.zone, S.min);
      SIM.tick(S, 1, { pinch: p, zone: this.zone, levels: SIM.levels(S, this.zone, S.min) });
      if (S.energy <= 0) break;
    }
  }
  run(fn) { if (this.busy) return; this.busy++; this.path = []; this.player.speed = 0; Promise.resolve().then(fn).catch((e) => console.error(e)).finally(() => { this.busy = Math.max(0, this.busy - 1); }); }
  run2(fn) { Promise.resolve().then(fn).catch((e) => console.error(e)); }
  // ---------- conversation framing ----------
  talkFrame(id) {
    const n = this.npcs[id]; if (!n) return; this.talking = id; this.ui.clearBubbles();
    const a = this.player.root.position, b = n.c.root.position;
    const mid = a.clone().lerp(b, 0.5); const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z); const len = dir.length() || 1; dir.divideScalar(len);
    const side = new THREE.Vector3(-dir.z, 0, dir.x); if (side.z < 0) side.negate();
    const inRoom = this.loc !== 'town';
    const camDir = side.clone().add(new THREE.Vector3(0, 0, inRoom ? 0.6 : 1.1)).normalize();
    const back = (inRoom ? 4.4 : 6.4) * (this.tall ? 1.35 : 1);
    const cam = mid.clone().addScaledVector(camDir, back + len * 0.6).add(new THREE.Vector3(0, inRoom ? 2.6 : 3.4, 0));
    this.stage.shot(cam, mid.clone().add(new THREE.Vector3(0, this.tall ? 1.1 : 0.75, 0)), this.tall ? 40 : 30, 3.2);
    this.talkMid = mid;
    this.player.faceToward(b.x, b.z); n.c.faceToward(a.x, a.z);
  }
  faceTalk(who) { const n = this.npcs[who]; if (!n) return; const a = this.player.root.position; n.c.faceToward(a.x, a.z); this.player.faceToward(n.c.root.position.x, n.c.root.position.z); n.c.hop && Math.random() < 0.25 && n.c.hop(); }
  setFace(who, e) { const c = who === 'you' ? this.player : this.npcs[who] && this.npcs[who].c; if (!c) return; c.setExpression(e); clearTimeout(c._ft); c._ft = setTimeout(() => c.setExpression('neutral'), 3500); }
  endTalk() {
    this.talking = null; this.talkMid = null;
    if (this.loc === 'town') this.stage.follow(this.player.root.position, this.followOpts());
    else { const c = this.roomCam(this.loc); this.stage.shot(c.pos, c.look, c.fov, 2.5); }
  }
  placeFestival() { /* residents take their festival spots through npcWant */ }
  placeCouncil() { for (const w of this.audience) w.root.visible = true; }
  applyFix(f) { this.town.setFix(f, true); if (f === 'dim') this.rooms.works.setDim(true); }
  focusPinch(on) { this.barrierFocus = on; }
  drift() { return clamp((100 - this.S.self) / 100 * 1.05); }
  ensurePScene() {
    if (this.pScene) return;
    this.pScene = new THREE.Scene(); this.pScene.background = new THREE.Color('#2a2433');
    this.pScene.add(new THREE.HemisphereLight('#fff4e0', '#3a3040', 1.3)); const k = new THREE.DirectionalLight('#fff1dc', 1.8); k.position.set(2, 4, 5); this.pScene.add(k);
    this.pCam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  }
  // snapshots crop the middle square of the screen, so on a tall screen the lens widens to keep the same framing
  fitPCam() { const a = this.stage.camera.aspect || 1; this.pCam.aspect = a; this.pCam.fov = a < 1 ? 2 * Math.atan(Math.tan(14 * Math.PI / 180) / a) * 180 / Math.PI : 28; this.pCam.updateProjectionMatrix(); }
  // a small picture of any creature, rendered with the same models as the town (portraits, permits, the People guide)
  portraitOf(look, o = {}) {
    this.ensurePScene();
    const key = JSON.stringify([look, o.drift || 0, o.bg || '', o.w || 360]);
    this.pCache = this.pCache || {}; if (this.pCache[key]) return this.pCache[key];
    const c = new Creature(look, { seed: o.seed || 31 }); c.setDrift(o.drift || 0); c.update(0.016);
    if (o.bg) this.pScene.background = new THREE.Color(o.bg);
    this.pScene.add(c.root);
    this.fitPCam();
    const tall = look.shape === 'tall';
    this.pCam.position.set(0, tall ? 1.25 : 1.0, tall ? 4.9 : 4.1); this.pCam.lookAt(0, tall ? 0.85 : 0.62, 0);
    const url = this.stage.snapshot(this.pScene, this.pCam, o.w || 360, o.h || 360);
    this.pScene.remove(c.root); this.pScene.background = new THREE.Color('#2a2433');
    this.pCache[key] = url;
    return url;
  }
  portrait() {
    this.ensurePScene();
    const root = this.player.root; const parent = root.parent; const pos = root.position.clone(); const rot = root.rotation.y; const head = this.player.heading;
    this.pScene.add(root); root.position.set(0, 0, 0); root.rotation.y = 0; this.player.heading = 0;
    this.fitPCam();
    this.pCam.position.set(0, 1.0, 4.1); this.pCam.lookAt(0, 0.62, 0);
    const url = this.stage.snapshot(this.pScene, this.pCam);
    if (parent) parent.add(root); root.position.copy(pos); root.rotation.y = rot; this.player.heading = head;
    return url;
  }
  // ---------- Blend ----------
  installBlend() { const B = this.S.blend; B.has = true; B.deleted = false; B.usedToday = true; B.score += 30; this.audio.sfx('blend'); this.ui.toast('<b>Blend installed</b><br>Smooth Mode is in your phone. Welcome gift: +30 Calm', 'blend'); this.story.fieldNote('limbic'); }
  dropReady() { const B = this.S.blend; return B.has && !B.deleted && B.dropDay !== this.S.day && this.S.day > 0; }
  blendDrop() { const B = this.S.blend; B.dropDay = this.S.day; B.score += 25; B.usedToday = true; B.drops++; this.audio.sfx('badge'); this.ui.toast('🎉 +25 Calm! You are in the top ' + Math.max(3, 40 - B.drops * 9) + '% of Larkspur!', 'blend'); if (this.S.min < 600) this.badge('early'); }
  badge(k) { const B = this.S.blend; const name = BLEND.badges[k]; if (!B.badges.includes(name)) { B.badges.push(name); this.audio.sfx('badge'); this.ui.toast('🏅 New badge: ' + name, 'blend'); } }
  setSmooth(on) { const B = this.S.blend; if (!B.has || B.deleted) return; B.smooth = on; if (on) { B.usedToday = true; this.badge('first'); this.audio.sfx('blend'); this.ui.toast('Smooth Mode on. We have got you.<br><span class="tsub">15 Calm per smoothing. You have ' + B.score + '.</span>', 'blend'); } else this.ui.toast('Smooth Mode off.'); }
  // Smooth Mode spends Calm, and the feed is where Calm comes from. That loop is the whole business model.
  blendSmooth(zone) {
    const S = this.S, B = S.blend; if (B.score < 15) return false;
    SIM.bendCost(S, true); S.masking = true; S.maskZone = zone; B.score -= 15; B.usedToday = true; S.stats.smooth++;
    this.ui.toast('✨ ' + pick(BLEND.smoothToast) + '<br><span class="tsub">−15 Calm · ' + B.score + ' left</span>', 'blend', 2600); this.audio.sfx('blend');
    if (zone === 'market') this.badge('crowd');
    return true;
  }
  deleteBlend() { const B = this.S.blend; B.deleted = true; B.smooth = false; this.S.self = clamp(this.S.self + 3, 0, 100); this.ui.toast('Blend deleted. It is very quiet. Then, slowly, there are birds.'); this.audio.sfx('back'); this.story.keep('blend_gone'); this.story.fieldNote('birdsong'); this.story.fieldNote('satiety'); }
  onGear(name) { this.ui.toast(`<b>${name === 'headphones' ? 'Headphones' : 'Shades'}</b> are yours. ${this.ui.touch ? 'Tap the button by your energy to put them on or take them off.' : 'Press ' + (name === 'headphones' ? 'H' : 'J') + ', or click the button by your energy, to put them on or take them off.'}`, 'good', 5200); }
  toggleGear(name) { const S = this.S; if (!S.gear[name]) { this.ui.toast(name === 'headphones' ? 'You do not have headphones yet. Moss sells them at the tea cart.' : 'You do not have shades yet. Moss sells them at the tea cart.', '', 2600); return; } S.wearing[name] = !S.wearing[name]; this.player.setGear(name, S.wearing[name]); this.audio.sfx('select'); }
  onHold(on, done) { this.holding = on; if (!on) this.holdK = 0; }
  onHoldProgress(k) { this.holdK = k; }
  // ---------- input ----------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      // letters and digits by position (e.code), so WASD works on AZERTY and in Hangul mode
      const k = keyName(e).toLowerCase(); this.keys[k] = true;
      if (k === 'escape') {
        if (this.ui.settingsClose) { this.ui.settingsClose(); return; }
        if (this.phoneOpen) { this.togglePhone(); return; }
        if (this.mgActive && this.mg && this.mg.escape) { this.mg.escape(); return; }
        if (this.mode === 'cine' && this.story.inPrologue) { this.story.skipIntro = true; this.ui.skipCaption(); return; }
      }
      if (this.mgActive) return;
      if (k === 'p' || (k === 'tab' && this.mode === 'play' && this.ui.panel.hidden && !this.settingsOpen)) { e.preventDefault(); this.togglePhone(); return; }
      if (this.ui.waiter || this.busy || this.mode !== 'play' || this.phoneOpen || this.settingsOpen) return;
      if (k === 'e' || k === 'enter' || k === ' ') { e.preventDefault(); this.interact(); }
      if (k === 'g') this.showWay();
      if (k === 'h') this.toggleGear('headphones');
      if (k === 'j') this.toggleGear('shades');
      if (k === 'b') { if (this.S.blend.has && !this.S.blend.deleted) this.setSmooth(!this.S.blend.smooth); }
    });
    window.addEventListener('keyup', (e) => { this.keys[keyName(e).toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    const cv = this.stage.renderer.domElement; let down = null;
    cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; this.audio.unlock(); if (this.ui.capSkip) this.ui.skipCaption(); });
    cv.addEventListener('pointerup', (e) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved >= 12) return;
      // a tap on the scene while someone is talking moves the conversation on
      if (this.ui.waiter && this.ui.waiter.type === 'line') { this.ui.advance(); return; }
      this.click(e.clientX, e.clientY);
    });
  }
  click(x, y) {
    if (this.busy || this.mode !== 'play' || this.phoneOpen || this.settingsOpen || this.ui.waiter || this.mgActive) return;
    const ndc = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.stage.camera);
    const bodies = Object.values(this.npcs).filter((n) => n.c.root.visible && n.c.root.parent === this.player.root.parent).map((n) => n.c.body);
    const hit = ray.intersectObjects(bodies, false)[0];
    if (hit) { const n = Object.values(this.npcs).find((q) => q.c.body === hit.object); const q = n.c.root.position; this.walkTo(q.x + 0.9, q.z + 0.9); this.pendingTalk = n.id; return; }
    const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) { this.pendingTalk = null; this.walkTo(pt.x, pt.z); }
  }
  // what is in reach, and what pressing E would do
  findTarget() {
    const p = this.player.root.position; let best = null, bd = 1e9;
    for (const n of Object.values(this.npcs)) { if (!n.c.root.visible || n.c.root.parent !== this.player.root.parent) continue; if (n.id === 'bea' && this.beaWay) continue; const d = Math.hypot(n.c.root.position.x - p.x, n.c.root.position.z - p.z); if (d < 2.1 && d < bd) { bd = d; best = { kind: 'npc', id: n.id, label: (this.S.met[n.id] ? 'Talk to ' : 'Say hi to ') + CAST[n.id].name, obj: n.c.root.position }; } }
    const list = this.loc === 'town' ? this.town.inter : this.rooms[this.loc].inter;
    for (const it of list) { if (it.kind === 'set') continue; const d = Math.hypot(it.x - p.x, it.z - p.z); const prio = it.id === 'statue' && this.S.flags.festival && !this.S.flags.released; if (d < it.r + (prio ? 0.6 : 0) && (d < bd - 0.4 || prio)) { bd = prio ? -1 : d; best = { kind: it.kind, id: it.id, label: this.labelFor(it), obj: new THREE.Vector3(it.x, 0, it.z) }; } }
    return best;
  }
  labelFor(it) {
    const S = this.S;
    if (it.id === 'statue' && S.flags.festival) return 'Release your lantern';
    if (it.id === 'home' && S.min >= 1020 && S.day > 0 && S.day < 3) return 'Go home for the night';
    if (it.id === 'bed') return S.min >= 1020 && S.day < 3 ? 'Go to bed' : 'Rest a while';
    return it.label;
  }
  interact() {
    const t = this.target; if (!t || this.busy || this.mode !== 'play') return;
    this.run(() => this.handle(t));
  }
  async handle(t) {
    const S = this.S, st = this.story;
    if (t.kind === 'npc') return st.talkTo(t.id);
    const id = t.id;
    if (id === 'home') { if (S.min >= 1020 && S.day > 0 && S.day < 3) { await this.stage.fadeTo(1, 600); st.finishDay('sleep'); return; } return this.enterRoom('home'); }
    if (id === 'out') return this.exitRoom();
    if (id === 'bed') { if (S.min >= 1020 && S.day < 3) { await this.stage.fadeTo(1, 600); st.finishDay('sleep'); return; } await st.note('You lie down for a while. The room is exactly as you set it.'); this.ui.hideDialog(); this.advance(45); S.energy = clamp(S.energy + 18, 0, S.maxE); S.self = clamp(S.self + 3, 0, 100); return; }
    if (id === 'mirror') { await st.gut(this.drift() > 0.3 ? 'Your reflection looks paler than it did on Sunday.' : 'There you are.'); this.ui.hideDialog(); return; }
    if (id === 'works' || id === 'dock') return st.enterWorks(id === 'dock' ? 'dock' : 'front');
    if (id === 'hall') { if (S.day === 3 && S.min >= 1050) { this.ui.toast('The town meeting starts at six.'); return; } await this.enterRoom('hall'); await st.note('The chamber is empty. The founders watch from their portrait.'); this.ui.hideDialog(); return; }
    if (id === 'portrait') { await st.note('The Founders, 1891. Six of them, all roughly the same shape, squinting into the sun.'); if (S.flags.statue_seen) await st.gut('Whoever was in the room.'); this.ui.hideDialog(); return; }
    if (id === 'statue') { if (S.flags.festival) return st.finale(); await st.note('THE STANDARD RESIDENT. Larkspur was built to fit them.'); await st.gut(this.drift() > 0.4 ? 'You are starting to look a little like it.' : 'You do not look like it. Nobody here does.'); this.ui.hideDialog(); return; }
    if (id === 'kiosk') { if (this.npcNear('rue', 'market') && this.npcs.rue.place === 'town') return st.talkTo('rue'); await st.note('The kiosk hums. The screen says: YOU COULD BE CALMER.'); this.ui.hideDialog(); return; }
    if (id === 'board') { await st.note(S.fixes.board === 'built' ? 'The new board glows: NEXT BUS 5:40. TODAY: VIA ELM ST. Simple as that.' : 'Route 12, forty past the hour. A tiny asterisk: subject to change. The changes are announced over the speaker.'); this.ui.hideDialog(); if (!S.fixes.board) S.flags.told_board = 1; return; }
    if (id === 'cart') { if (this.npcs.moss.place === 'town') return st.talkTo('moss'); await st.note('The tea cart is closed up for the night.'); this.ui.hideDialog(); return; }
    if (id === 'notice') { await st.note('LOST CAT, orange, answers to nothing. CHOIR, Thursdays. FIX-IT SHED: bring us what pinches!'); this.ui.hideDialog(); S.flags.knows_shed = 1; return; }
    if (id === 'shed') { if (this.npcs.clover.place === 'town') return st.talkTo('clover'); await st.note('The shed is locked. A sign says OPEN 8 TO 6.'); this.ui.hideDialog(); return; }
    if (id === 'workshop') { if (this.npcs.wren.place === 'town') return st.talkTo('wren'); await st.note('You knock once. Nobody answers, which is also an answer.'); this.ui.hideDialog(); return; }
    if (t.kind === 'bench') return st.sit(id);
    if (t.kind === 'pond') return st.fish();
    if (id === 'mydesk') { await st.note('Your desk. Your plant. Somebody has already left a sticky note on it that just says "!".'); this.ui.hideDialog(); }
    if (st.handleExtra) return st.handleExtra(t);
  }
  // ---------- movement ----------
  canStand(x, z) {
    if (this.loc === 'town') { const w = this.S.wheels; const r = 0.28; return this.town.walkable(x - r, z - r, w) && this.town.walkable(x + r, z - r, w) && this.town.walkable(x - r, z + r, w) && this.town.walkable(x + r, z + r, w); }
    return this.rooms[this.loc].walkable(x, z);
  }
  movePlayer(dt) {
    const p = this.player.root.position; const free = this.mode === 'play' && !this.busy && !this.phoneOpen && !this.settingsOpen && !this.ui.waiter && !this.mgActive;
    let dx = 0, dz = 0; const K = this.keys;
    if (free) { if (K.w || K.arrowup) dz -= 1; if (K.s || K.arrowdown) dz += 1; if (K.a || K.arrowleft) dx -= 1; if (K.d || K.arrowright) dx += 1; }
    const following = !(dx || dz) && this.path.length && (free || this.busy || this.mode === 'cine');
    if (dx || dz) { this.path = []; this.pendingTalk = null; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    else if (following) {
      const [tx, tz] = this.path[0]; const ddx = tx - p.x, ddz = tz - p.z; const d = Math.hypot(ddx, ddz);
      if (d < 0.22) { this.path.shift(); this.stuckT = 0; if (!this.path.length && this.pendingTalk && free) { const id = this.pendingTalk; this.pendingTalk = null; this.run(() => this.story.talkTo(id)); } }
      else { dx = ddx / d; dz = ddz / d; }
    }
    const speed = (this.loc === 'town' ? (this.S.wheels ? 4.4 : 4.0) : 2.6) * (this.S.energy < 15 ? 0.75 : 1);
    let moved = false;
    if (dx || dz) {
      const step = speed * dt; const ox = p.x, oz = p.z;
      const nx = p.x + dx * step, nz = p.z + dz * step;
      if (this.canStand(nx, nz)) { p.x = nx; p.z = nz; }
      else {
        if (this.canStand(nx, p.z)) p.x = nx;
        if (this.canStand(p.x, nz)) p.z = nz;
        // still pinned against a corner: try sliding along it at an angle
        if (p.x === ox && p.z === oz) for (const a of [0.7, -0.7, 1.3, -1.3]) { const c = Math.cos(a), s = Math.sin(a); const rx = dx * c - dz * s, rz = dx * s + dz * c; if (this.canStand(p.x + rx * step, p.z + rz * step)) { p.x += rx * step; p.z += rz * step; break; } }
      }
      moved = Math.hypot(p.x - ox, p.z - oz) > step * 0.3;
      if (following) {
        this.stuckT = moved ? 0 : (this.stuckT || 0) + dt;
        // no progress for a moment: plan the route again from here, and give up quietly if that fails too
        if (this.stuckT > 0.35 && this.walkGoal && this.loc === 'town' && !this.repathed) { const g = this.walkGoal; const np = this.town.findPath(p.x, p.z, g[0], g[1], this.S.wheels); this.repathed = true; this.stuckT = 0; if (np.length) this.path = np; }
        else if (this.stuckT > 0.6) { this.path.shift(); this.stuckT = 0; this.repathed = false; }
      }
      this.player.heading = Math.atan2(dx, dz);
    }
    this.player.speed = moved ? 1 : 0;
    if (moved && !this.S.wheels) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.34; this.audio.sfx('step', { v: 0.7 }); } }
  }
  // ---------- the felt part: fit becomes light, sound and camera ----------
  computeFx(dt) {
    const S = this.S, st = this.stage; const playing = this.mode === 'play' || this.mode === 'cine';
    const p = this.pinchNow; const smooth = S.blend.has && S.blend.smooth && !S.blend.deleted;
    const masked = S.masking && S.maskZone === this.zone;
    let fx = { sat: 1, contrast: 1, vignette: 0.2, aberr: 0, grain: 0.02, tint: 0, bloom: 0.32, exposure: 1, warm: 0 }; let push = 0, pressure = 0;
    if (p && playing && this.zone !== 'home' && !this.mgActive) {
      const o = p.dims; const under = o.sound.under * 0.8 + o.people.under + o.light.under * 0.6 + o.change.under * 0.3;
      push = clamp(o.people.over * 1.7 + o.sound.over * 0.9 + o.light.over * 0.6 + o.change.over * 0.4 + o.talk.over * 0.3);
      fx.bloom = Math.min(0.62, 0.32 + o.light.over * 0.9); fx.exposure = Math.min(1.1, 1 + o.light.over * 0.25); fx.aberr = o.sound.over * 0.016 + o.people.over * 0.006;
      fx.vignette = 0.2 + push * 0.4 + under * 0.4; fx.sat = 1 - under * 0.7; fx.contrast = 1 - under * 0.25;
      pressure = clamp(o.sound.over * 1.4 + o.people.over * 0.9 + o.light.over * 0.3);
      if (this.barrierFocus) { push = Math.max(push, 0.35); }
      if (masked) { push *= 0.3; pressure *= 0.35; fx.bloom = lerp(0.32, fx.bloom, 0.35); fx.exposure = lerp(1, fx.exposure, 0.35); fx.aberr *= 0.3; fx.vignette = lerp(0.2, fx.vignette, 0.4); fx.sat *= 0.92; }
    }
    if (smooth && this.zone !== 'home') { push = 0; pressure = 0; fx = Object.assign(fx, { sat: 0.42, contrast: 0.94, tint: 0.5, bloom: 0.28, exposure: 0.97, aberr: 0, vignette: 0.14 }); }
    const selfK = S.self / 100; fx.sat *= lerp(0.72, 1, selfK);
    if (this.holding) { push = Math.max(push, this.holdK * 0.6); this.player.tense = this.holdK; } else this.player.tense = damp(this.player.tense, masked ? 0.25 : smooth ? 0.15 : push > 0.35 ? 0.4 : 0, 3, dt);
    if (this.mode === 'title') fx = { sat: 1.05, contrast: 1.02, vignette: 0.3, aberr: 0, grain: 0.02, tint: 0, bloom: 0.4, exposure: 1, warm: 0.15 };
    if (this.mgActive) { fx.vignette = 0.5; fx.sat *= 0.75; }
    st.setFx(fx);
    st.rig.push = damp(st.rig.push, push * (this.settings.reduceMotion ? 0.4 : 1) * this.settings.fx, 2.2, dt);
    st.shake = damp(st.shake, pressure > 0.4 ? pressure * this.settings.fx : 0, 2, dt);
    const face = push > 0.45 && !masked && !smooth ? 'tense' : S.energy < 22 && this.mode === 'play' ? 'sad' : 'neutral';
    if (this.player.setExpression && !this.talking && this.player.expr !== face) this.player.setExpression(face);
    // sound of the place, and its music
    if (this.mode === 'play') {
      const nightNow = S.min >= 1230 || S.min < 400;
      this.audio.setScene(this.mgActive && this.mgScene ? this.mgScene : this.loc === 'home' ? 'home' : this.loc === 'works' ? 'works' : this.loc === 'hall' ? 'council' : S.flags.festival ? 'festival' : this.zone === 'farend' ? 'farend' : nightNow ? 'night' : 'town');
    }
    const L = SIM.levels(S, this.zone, S.min); const z = this.zone; const day = S.min > 400 && S.min < 1170;
    const blendOn = S.blend.has && !S.blend.deleted;
    this.audio.setMix({ crowd: z === 'home' ? 0 : L.people * (z === 'farend' ? 0.3 : 1), chatter: z === 'home' || z === 'farend' ? 0 : L.people, traffic: z === 'transit' ? 0.8 : z === 'street' || z === 'market' ? 0.25 : 0.05, hum: z === 'works' ? 1 : 0, birds: day && ['commons', 'farend', 'homerow', 'street'].includes(z) ? (blendOn ? 0.3 : S.blend.deleted ? 0.85 : 0.6) : 0.05, water: z === 'farend' ? 1 : 0, wind: this.loc === 'town' ? 0.6 : 0.05 });
    this.audio.setState({ pressure: pressure * this.settings.fx, muffle: S.wearing.headphones ? 0.8 : 0, smooth: smooth && this.zone !== 'home' ? 1 : 0, self: selfK });
  }
  update(dt) {
    const S = this.S; const st = this.stage;
    const paused = this.mode !== 'play' || this.busy > 0 || this.phoneOpen || this.settingsOpen || this.mgActive;
    if (!paused) { const dm = dt * this.timeScale; S.min += dm; this.minAcc += dm; while (this.minAcc >= 1) { this.minAcc -= 1; SIM.tick(S, 1, { pinch: this.pinchNow, zone: this.zone, levels: SIM.levels(S, this.zone, S.min) }); } }
    // where am I, and how does it fit
    const pos = this.player.root.position;
    let zone = this.loc === 'town' ? this.town.zoneAt(pos.x, pos.z).id : this.loc;
    if (zone === 'market' && S.flags.festival) zone = 'festival';
    if (this.loc === 'town' && (zone === 'works' || zone === 'hall')) zone = 'street';
    if (zone !== this.zone) { this.zone = zone; this.zoneTime = 0; if (S.masking && S.maskZone !== zone) S.masking = false; this.pinchT = 0; }
    if (!paused) this.zoneTime = (this.zoneTime || 0) + dt * (FAST ? 4 : 1);
    this.pinchT -= dt; if (this.pinchT <= 0) { this.pinchT = 0.25; this.pinchNow = SIM.pinch(S, zone, S.min); }
    this.movePlayer(dt);
    this.updateNPCs(dt);
    if (this.loc === 'town') this.updateCrowd(dt);
    for (const w of this.workers) if (this.loc === 'works') { w.update(dt); }
    if (this.loc === 'hall') for (const a of this.audience) if (a.root.visible) a.update(dt);
    if (!paused) this.story.tick();
    this.computeFx(dt);
    this.player.setDrift(this.drift() * 0.92);
    this.player.update(dt);
    updateLOD(this);
    // the world
    if (this.loc === 'town') {
      if (this.mode === 'title') { S.min = 18.4 * 60; }
      const focus = st.rig.mode === 'follow' ? st.rig.focus : st.rig.mode === 'orbit' ? st.rig.orbitC : st.camLook;
      const camDist = st.camera.position.distanceTo(focus);
      if (this.busRide) this.busClock = Math.min(41, (this.busClock || 35) + dt * 1.1); else this.busClock = 0;
      this.town.update(dt, S.min / 60, focus, { min: this.busRide ? 960 + this.busClock : S.min, skipStop: S.day === 1 && S.min >= 1020 && S.min < 1080, camDist });
      if (st.rig.mode !== 'orbit' && (st.rig.mode !== 'follow' || st.rig.target !== this.player.root.position) && !this.talking && this.mode === 'play' && !this.busy) st.follow(this.player.root.position, this.followOpts());
    } else this.rooms[this.loc].update(dt, S.min / 60, { settings: this.settings });
    this.guide.update(dt);
    st.update(dt);
    if (this.talking && this.talkMid) st.setOccluder(this.talkMid, true, 0.32);
    else st.setOccluder(this.player.root.position, this.loc === 'town' && st.rig.mode === 'follow' && this.player.root.visible);
    this.frameN++;
    // while a task card covers the screen the town behind it barely needs drawing (a fixed step draws every frame)
    const skipDraw = FIXED ? !!this.noDraw : this.mgActive ? this.frameN % 10 !== 0 : FAST && this.frameN % 4 !== 0;
    if (!skipDraw || this.forceRender) { st.render(); this.forceRender = false; }
    this.audio.update();
    // interface
    this.ui.updateHud(S, this.story.objective());
    const canAct = this.mode === 'play' && !this.busy && !this.ui.waiter && !this.phoneOpen && !this.mgActive && this.ui.panel.hidden;
    this.target = canAct ? this.findTarget() : null;
    if (this.target) { const v = this.target.obj.clone(); v.y = 1.9; v.project(st.camera); this.ui.prompt(this.target.label, (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight); } else this.ui.prompt(null);
    this.ui.act(this.target ? this.target.label : null);
    this.ui.placeBubbles((k) => this.anchorOf(k));
    if (this.phoneOpen && (this._pt = (this._pt || 0) - dt) <= 0) { this._pt = 1; this.ui.refreshPhone(); }
    if ((this._hb = (this._hb || 0) - dt) <= 0) { this._hb = 1; const ck = document.querySelector('#hud .clock'); this.hudBottom = ck && !this.ui.el('#hud').hidden ? ck.getBoundingClientRect().bottom : 0; }
  }
  // Fixed-step test mode: advance the whole game by exactly n frames of 1/60 s, synchronously: the clock, the
  // simulation and the 3D render, then the open task's update and draw (the same order as two rAF callbacks).
  // drawAll = false renders the 3D scene only on the last of the n frames, to move quickly through setup.
  stepFrames(n, drawAll = true) {
    for (let i = 0; i < n; i++) {
      clock.frame++;
      this.noDraw = !drawAll && i < n - 1;
      try { this.update(STEP); } catch (e) { console.error(e); }
      const mg = this.mg; if (mg && mg.frame) { try { mg.frame(STEP); } catch (e) { console.error(e); } }
    }
    this.noDraw = false;
    return clock.frame;
  }
}

let G;
const boot = (data) => { G = new Game(data || {}); window.__wb.G = G; };
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ S: G && G.S && G.S.day >= 1 ? JSON.parse(JSON.stringify(G.S)) : null }));
// hooks for automated playtests
const offOf = (b) => b.getAttribute('aria-disabled') === 'true' || b.disabled;
window.__wb = {
  state: () => G.S, mode: () => G.mode, busy: () => G.busy, loc: () => G.loc, zone: () => G.zone, waiter: () => (G.ui.waiter ? G.ui.waiter.type : null),
  tp: (spot) => { const xz = Array.isArray(spot) ? spot : G.town.spots[spot]; if (G.loc !== 'town') G.setLoc('town'); G.place(xz); },
  skip: (m) => { G.advance(m); }, act: () => G.interact(), adv: () => G.ui.advance(), target: () => G.target && G.target.id,
  choose: (i) => { const w = G.ui.waiter; if (w && w.buttons && w.buttons[i]) { const b = w.buttons[i]; if (offOf(b)) return false; if (b.dataset.hold) b._resolve(); else b.click(); return true; } return false; },
  options: () => { const w = G.ui.waiter; return w && w.buttons ? w.buttons.map((b) => ({ t: b.innerText.replace(/\n/g, ' ').slice(0, 80), id: b.dataset.id || null, disabled: offOf(b), key: [...b.classList].find((c) => ['bend', 'gear', 'ask', 'fix', 'leave'].includes(c)) || null })) : []; },
  // draw calls, triangles and compiled shader programs in the last rendered frame (all passes)
  perf: () => { const st = G.stage, r = st.renderer; if (!st._probe) { r.info.autoReset = false; const orig = st.render.bind(st); st._probe = { last: null }; st.render = () => { r.info.reset(); orig(); st._probe.last = { calls: r.info.render.calls, tris: r.info.render.triangles, programs: r.info.programs.length }; }; } return st._probe.last; },
  panel: () => (G.ui.panel.hidden ? null : G.ui.panel.className),
  obj: () => G.story.objective(), way: () => G.showWay(),
  mgTest: (n, a) => G.story.testGame(n, a), mg: () => (G.mgActive && G.mg ? G.mg.id : null), mgAuto: (q) => (G.mg && G.mg.auto ? G.mg.auto(q) : false),
  // ?fixedstep=1 only: advance exactly n frames of 1/60 s (see Game.stepFrames); returns the stepped frame count
  step: (n = 1, drawAll = true) => G.stepFrames(Math.max(0, Math.floor(n)), drawAll !== false), fixed: FIXED, frame: () => clock.frame,
  G: null,
};
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
