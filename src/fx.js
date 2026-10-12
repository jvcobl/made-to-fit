// Feedback: floating words, sparks, rings on the ground, a small push of the camera, chimes that climb as a set fills.
// Every reward that is built to keep you playing carries a small hook mark (hooks.js), and the Hook Log names it.
// Calm feedback (Settings, and the comfort check) keeps the words and the sounds and drops most of the motion.
import * as THREE from 'three';
import { clamp, esc } from './util.js';

const POOL = 360;
const VERT = `attribute float psize; attribute float palpha; attribute vec3 pcolor; uniform float uPx; varying vec3 vC; varying float vA;
  void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, psize * uPx / -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `varying vec3 vC; varying float vA;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5 || vA < 0.004) discard; float a = smoothstep(0.5, 0.12, r) * vA; gl_FragColor = vec4(vC, a); }`;
export const HOOK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="10" cy="2.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 4v6.6a3.3 3.3 0 0 1-6.6 0V7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.4 7.2l2.6 2.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

export class FX {
  constructor(G) {
    this.G = G; this.pops = []; this.parts = []; this.rings = []; this.kick = 0;
    const layer = document.createElement('div'); layer.id = 'pops'; layer.setAttribute('aria-hidden', 'true'); G.ui.root.appendChild(layer); this.layer = layer;
    // one pool of particles, moved into whichever scene is on screen
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(POOL * 3); this.col = new Float32Array(POOL * 3); this.size = new Float32Array(POOL); this.alpha = new Float32Array(POOL);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    for (const k of ['position', 'pcolor', 'psize', 'palpha']) g.attributes[k].setUsage(THREE.DynamicDrawUsage);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uPx: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; this.points.userData.noOcc = true;
    this.p = Array.from({ length: POOL }, () => ({ life: 0 }));
    this.next = 0;
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
  }
  get calm() { const s = this.G.settings; return !!(s && (s.calmFx || s.reduceMotion)); }
  // put the particles in a scene ahead of time, so the first burst doesn't compile a shader mid-play
  warm(scenes) { for (const sc of scenes) { sc.add(this.points); this.G.stage.precompile(sc); } this.points.parent && this.points.parent.remove(this.points); }
  // ---------- words that float up ----------
  // at: a THREE.Vector3 in the world, or { x, y } on screen. o: { kind: 'good' | 'mark' | 'rare' | 'blend' | 'guest', hook: id, big, ms }
  pop(at, text, o = {}) {
    // played quietly (chosen on the first day's postcard): the game's own pulls are left out ("1 left!", the head start,
    // the teaser), and what's left carries no hook mark; Blend, the app in the story, still does what it does
    const S = this.G.S; const quiet = (this.G.settings && this.G.settings.quietHooks) || (S && S.flags && S.flags.quietHooks);
    if (quiet && o.hook && !(o.hookCtx && o.hookCtx.by === 'blend')) {
      if (['gradient', 'endowed', 'openloop'].includes(o.hook)) return null;
      o = Object.assign({}, o, { hook: null, big: false });
    }
    const el = document.createElement('div'); el.className = 'pop ' + (o.kind || '') + (o.big ? ' big' : '');
    const hook = o.hook && this.G.hooks ? this.G.hooks.fire(o.hook, o.hookCtx) : '';
    // (the pop layer is hidden from screen readers, so a reward with a hook is also said, with the hook's name)
    if (hook && this.G.ui) this.G.ui.announce(text.replace(/<[^>]*>/g, '') + '. A hook: ' + hook + '.');
    el.innerHTML = `<span class="pt">${o.html ? text : esc(text)}</span>` + (hook ? `<i class="hk" title="A hook: ${esc(hook)}">${HOOK_SVG}</i>` : '');
    this.layer.appendChild(el);
    const p = { el, follow: o.follow || null, dy: o.dy == null ? 2.4 : o.dy, at: at && at.isVector3 ? at.clone() : null, sx: at && !at.isVector3 ? at.x : 0, sy: at && !at.isVector3 ? at.y : 0, t: 0, ms: (o.ms || 1500) / 1000, rise: o.rise == null ? 54 : o.rise, dx: o.dx || 0 };
    this.pops.push(p); if (this.pops.length > 12) { const old = this.pops.shift(); old.el.remove(); }
    this.place(p);
    return el;
  }
  // a pop about the street's list, next to that list: just under it at the top of a wide screen, just above it at the
  // bottom of a phone (never in the middle of the notices)
  chipPop(text, o = {}) {
    const c = document.querySelector('#streetchip'); let x = innerWidth / 2, y = 110;
    if (c && !c.hidden) { const r = c.getBoundingClientRect(); if (r.width) { x = r.left + r.width / 2; y = r.top > innerHeight / 2 ? r.top - 8 : r.bottom + 42; } }
    return this.pop({ x, y }, text, Object.assign({ rise: 12 }, o));
  }
  place(p) {
    let x = p.sx, y = p.sy;
    if (p.follow) { if (!p.at) p.at = new THREE.Vector3(); p.at.copy(p.follow.position); p.at.y += p.dy; }
    if (p.at) { const v = p.at.clone().project(this.G.stage.camera); if (v.z > 1) { p.el.style.opacity = '0'; return; } x = (v.x + 1) / 2 * innerWidth; y = (1 - v.y) / 2 * innerHeight; }
    if (!p.w) { p.w = p.el.offsetWidth || 160; p.h = p.el.offsetHeight || 34; } x = clamp(x, p.w / 2 + 8, innerWidth - p.w / 2 - 8);
    const t = clamp(p.t / p.ms); let up = (1 - Math.pow(1 - t, 3)) * p.rise;
    // a pop over someone near the top of the screen stays below the top bar instead of riding up under it
    if (p.at) { const minY = p.h + 62; if (y - up < minY) { y = minY; up = 0; } }
    const s = this.calm ? 1 : t < 0.12 ? 0.6 + t / 0.12 * 0.55 : t < 0.24 ? 1.15 - (t - 0.12) / 0.12 * 0.15 : 1;
    p.el.style.transform = `translate(${Math.round(x + p.dx * t)}px, ${Math.round(y - up)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
    p.el.style.opacity = String(t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1);
  }
  // ---------- sparks ----------
  // at: Vector3. o: { n, colors: ['#hex'], speed, up, size, life, gravity, spread }
  burst(at, o = {}) {
    if (!at) return;
    const n = Math.round((o.n || 18) * (this.calm ? 0.35 : 1)); const cols = (o.colors || ['#ffcf7a', '#fff4d6', '#9ef2e4']).map((c) => new THREE.Color(c));
    const sc = this.G.stage.scene; if (sc && this.points.parent !== sc) { this.clearParts(); sc.add(this.points); }
    for (let i = 0; i < n; i++) {
      const q = this.p[this.next]; this.next = (this.next + 1) % POOL;
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 3.2) * (0.45 + Math.random() * 0.75) * (this.calm ? 0.6 : 1);
      const up = (o.up == null ? 3.4 : o.up) * (0.5 + Math.random() * 0.8);
      const spread = o.spread == null ? 1 : o.spread;
      q.x = at.x + (Math.random() - 0.5) * 0.3; q.y = at.y + (Math.random() - 0.5) * 0.2; q.z = at.z + (Math.random() - 0.5) * 0.3;
      q.vx = Math.cos(a) * sp * spread; q.vz = Math.sin(a) * sp * spread; q.vy = up;
      q.g = o.gravity == null ? 7 : o.gravity; q.drag = o.drag == null ? 1.6 : o.drag;
      q.life = q.max = (o.life || 1.1) * (0.7 + Math.random() * 0.6); q.s = (o.size || 0.16) * (0.6 + Math.random() * 0.8);
      q.c = cols[i % cols.length]; q.fade = o.fade || 0;
    }
  }
  // a little puff of dust at the feet (starting off, turning hard, landing)
  dust(at, o = {}) { if (this.calm && !o.force) return; this.burst(at, { n: o.n || 5, colors: ['#d8ccb4', '#c9bba0', '#e8dfcc'], speed: 1.1, up: 0.7, size: 0.2, life: 0.55, gravity: -0.4, drag: 3, spread: 1 }); }
  clearParts() { for (const q of this.p) q.life = 0; this.alpha.fill(0); this.points.geometry.attributes.palpha.needsUpdate = true; }
  // ---------- a ring that spreads on the ground ----------
  ring(at, o = {}) {
    const sc = this.G.stage.scene; if (!sc || !at) return;
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: o.color || '#ffe2a0', transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(at.x, (at.y || 0) + 0.05, at.z); m.renderOrder = 4; m.userData.noOcc = true; sc.add(m);
    this.rings.push({ m, t: 0, dur: o.dur || 0.9, r: o.r || 2.4 });
  }
  // ---------- the camera leans in for a moment ----------
  punch(k = 1) { if (this.calm) return; this.kick = Math.min(1.4, this.kick + k); }
  // ---------- chimes that climb as a set fills ----------
  chime(i = 0, o = {}) { this.G.audio.sfx('tag', { n: i, rare: o.rare }); }
  // a resident getting their colour back as the wave reaches them
  colorBack(c, id) {
    const at = c.root.position.clone(); at.y += 1.0;
    this.burst(at, { n: 14, colors: [c.look.color, '#fff4d6', '#ffcf7a'], speed: 2.2, up: 3, size: 0.14, life: 0.9 });
    if (c.hop) c.hop();
    if (id) { c.setExpression && c.setExpression('happy'); clearTimeout(c._ft); c._ft = setTimeout(() => c.setExpression && c.setExpression('neutral'), 4000); this.G.audio.sfx('pop'); }
  }
  update(dt) {
    const st = this.G.stage;
    // pops
    // (a cut to black ends them, and so does a panel opening: a pop belongs to the moment it came from)
    const dark = st.fade > 0.8 || (this.G.ui && this.G.ui.panel && !this.G.ui.panel.hidden);
    for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t >= p.ms || dark) { p.el.remove(); this.pops.splice(i, 1); continue; } this.place(p); }
    // sparks
    const cam = st.camera; this.mat.uniforms.uPx.value = st.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    let live = false;
    for (let i = 0; i < POOL; i++) {
      const q = this.p[i];
      if (q.life <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; live = true; } continue; }
      live = true; q.life -= dt;
      const k = Math.exp(-q.drag * dt); q.vx *= k; q.vz *= k; q.vy = q.vy * k - q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.03) { q.y = 0.03; q.vy *= -0.3; }
      const t = clamp(q.life / q.max);
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.c.r; this.col[i * 3 + 1] = q.c.g; this.col[i * 3 + 2] = q.c.b;
      this.size[i] = q.s * (0.5 + 0.5 * t); this.alpha[i] = Math.min(1, t * 2.2);
    }
    if (live) { const a = this.points.geometry.attributes; a.position.needsUpdate = a.pcolor.needsUpdate = a.psize.needsUpdate = a.palpha.needsUpdate = true; }
    // (no sparks in the air: no draw call for them either)
    this.points.visible = live;
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const t = clamp(r.t / r.dur);
      const s = 0.3 + (1 - Math.pow(1 - t, 3)) * r.r; r.m.scale.set(s, 1, s); r.m.material.opacity = 0.8 * (1 - t);
      if (t >= 1) { r.m.parent && r.m.parent.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    // the camera kick decays quickly
    this.kick = Math.max(0, this.kick - dt * 3.2); st.kick = this.kick;
  }
}
