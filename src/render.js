// Stage: renderer, post-processing (bloom + a color grade that carries the sensory effects), sky, sun and the camera rig.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, lerp, damp, noise2, FlashGuard } from './util.js';
import { sampleTOD } from './palette.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uSat: { value: 1 }, uContrast: { value: 1 }, uTint: { value: new THREE.Vector3(0.84, 0.78, 0.68) }, uTintAmt: { value: 0 },
    uVignette: { value: 0.2 }, uAberr: { value: 0 }, uGrain: { value: 0.02 }, uTime: { value: 0 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Vector3(0.06, 0.05, 0.09) },
    uRes: { value: new THREE.Vector2(1, 1) }, uWarm: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat, uContrast, uTintAmt, uVignette, uAberr, uGrain, uTime, uFade, uWarm;
    uniform vec3 uTint, uFadeCol; uniform vec2 uRes; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = uv - 0.5;
      vec3 col;
      if (uAberr > 0.0005) { vec2 o = d * uAberr; col = vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b); }
      else col = texture2D(tDiffuse, uv).rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.32) * uContrast + 0.32;
      vec3 tinted = vec3(l) * uTint / dot(uTint, vec3(0.299, 0.587, 0.114));
      col = mix(col, tinted, uTintAmt);
      col += vec3(0.03, 0.012, -0.02) * uWarm;
      float v = smoothstep(0.92, 0.25, length(d * vec2(1.0, 0.82)));
      col *= mix(1.0, v, uVignette);
      col += (rand(uv * uRes + fract(uTime)) - 0.5) * uGrain;
      col = mix(col, uFadeCol, uFade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export function makeSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunAmt: { value: 1 }, stars: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; uniform float sunAmt, stars; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        vec3 dir = normalize(vDir); float y = dir.y;
        vec3 c = mix(hor, top, smoothstep(-0.02, 0.6, y));
        c = mix(c, hor * 0.8, smoothstep(0.0, -0.35, y));
        float s = max(dot(dir, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 10.0) * 0.22) * sunAmt;
        if (stars > 0.01 && y > 0.04) { vec3 q = floor(dir * 160.0); float st = step(0.9968, h(q)); c += vec3(st) * stars * smoothstep(0.04, 0.4, y) * 0.9; }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  scene.add(m);
  return m;
}

// Outdoor light: hemisphere fill + a shadow-casting sun that follows the camera focus.
export class Daylight {
  constructor(scene, quality) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    this.sun.castShadow = true;
    const sz = quality === 'low' ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const c = this.sun.shadow.camera; const e = quality === 'low' ? 20 : 26;
    c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = 1; c.far = 120;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.sky = makeSky(scene);
    scene.fog = new THREE.Fog('#eee2cd', 46, 150);
    this.tod = null;
  }
  update(hour, focus, camDist = 30) {
    const t = sampleTOD(hour);
    this.scene.fog.near = Math.max(46, camDist + 8); this.scene.fog.far = this.scene.fog.near + 115;
    this.tod = t;
    this.hemi.color.copy(t.hs); this.hemi.groundColor.copy(t.hg); this.hemi.intensity = t.hI;
    this.sun.color.copy(t.sun); this.sun.intensity = Math.max(t.sunI, 0.0001);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(t.dir, 55);
    this.scene.fog.color.copy(t.fog);
    const u = this.sky.material.uniforms;
    u.top.value.copy(t.top); u.hor.value.copy(t.hor); u.sunDir.value.copy(t.dir); u.sunCol.value.copy(t.sun);
    u.sunAmt.value = t.moon > 0.5 ? 0.15 : 1; u.stars.value = t.night;
    this.sky.position.copy(focus);
    return t;
  }
}

// See-through circle: anything closer to the camera than you, near you on screen, dithers away.
export const OCC = { uOccPos: { value: new THREE.Vector2(0.5, 0.5) }, uOccDepth: { value: 0 }, uOccR: { value: 0 }, uOccAspect: { value: 1 }, uOccRes: { value: new THREE.Vector2(1, 1) } };
export function addOcclusion(material) {
  if (material.userData.occ) return; material.userData.occ = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, OCC);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vOccDepth;').replace('#include <project_vertex>', '#include <project_vertex>\nvOccDepth = -mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOccDepth; uniform vec2 uOccPos; uniform float uOccDepth; uniform float uOccR; uniform float uOccAspect; uniform vec2 uOccRes;')
      .replace('void main() {', `void main() {
        if (uOccR > 0.0 && vOccDepth < uOccDepth - 1.4) {
          vec2 q = (gl_FragCoord.xy / uOccRes - uOccPos) * vec2(uOccAspect, 1.0);
          float d = length(q);
          if (d < uOccR) { float edge = smoothstep(uOccR, uOccR * 0.45, d); ivec2 b = ivec2(mod(floor(gl_FragCoord.xy * 0.5), 4.0)); int i = b.x + b.y * 4; float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); float t = (m[i] + 0.5) / 16.0; if (t < edge * 0.97) discard; }
        }`);
  };
  material.customProgramCacheKey = () => 'occ1';
  material.needsUpdate = true;
}
const _v = new THREE.Vector3();

const FX_KEYS = ['sat', 'contrast', 'vignette', 'aberr', 'grain', 'tint', 'bloom', 'exposure', 'warm'];

export class Stage {
  constructor(el, opts = {}) {
    this.quality = opts.quality || 'high';
    this.test = !!opts.test;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.test });
    this.maxPR = this.test ? 0.6 : this.quality === 'low' ? 1.1 : 1.75;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPR));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1;
    el.appendChild(r.domElement);
    r.domElement.id = 'gl'; r.domElement.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 700);
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality === 'low' || this.test ? 0 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.55, 0.92);
    this.output = new OutputPass();
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(this.output); this.composer.addPass(this.grade);
    this.grade.uniforms.uRes.value.set(size.x, size.y);
    this.scene = null;
    this.precompileTarget = rt;
    this.rig = { mode: 'follow', target: new THREE.Vector3(), focus: new THREE.Vector3(), yaw: 0, dist: 12.5, pitch: 0.82, push: 0, fov: 36, lookY: 0.9,
      shotPos: new THREE.Vector3(), shotLook: new THREE.Vector3(), shotFov: 32, shotK: 3, orbitC: new THREE.Vector3(), orbitR: 34, orbitH: 20, orbitT: 0, orbitSpeed: 0.035, bounds: null };
    this.camPos = new THREE.Vector3(30, 30, 60); this.camLook = new THREE.Vector3(30, 0, 24); this.curFov = 36;
    this.fx = { sat: 1, contrast: 1, vignette: 0.22, aberr: 0, grain: 0.02, tint: 0, bloom: 0.3, exposure: 1, warm: 0 };
    this.fxT = Object.assign({}, this.fx);
    this.fade = 0; this.fadeFrom = 0; this.fadeTo_ = 0; this.fadeT = 1; this.fadeDur = 0; this.fadeResolve = null;
    this.shake = 0; this.reduceMotion = false; this.fxScale = 1; this.time = 0;
    // backstops for the two screen-wide brightness controls; the grade is already smoothed, so these rarely act
    this.exposureGuard = new FlashGuard(1, 0.5); this.bloomGuard = new FlashGuard(0.3, 1.0);
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPR));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.grade.uniforms.uRes.value.set(size.x, size.y);
    this.camera.aspect = w / h; this.applyOffset(); this.camera.updateProjectionMatrix();
  }
  // compile a scene's shaders ahead of time, exactly as they will be drawn: into the effects chain's buffer (linear
  // colour), which is not what a bare renderer.compile() assumes (so its programs would never be used)
  precompile(scene) {
    const r = this.renderer, was = r.getRenderTarget();
    try { r.setRenderTarget(this.precompileTarget); r.compile(scene, this.camera); } catch (e) { /* best effort */ } finally { r.setRenderTarget(was); }
  }
  setScene(scene) { this.scene = scene; this.renderPass.scene = scene; }
  // shift the picture sideways (px), e.g. so a character is not hidden behind a side panel
  offsetX(px, py = 0) { this.viewOff = px; this.viewOffY = py; this.applyOffset(); }
  applyOffset() { const w = window.innerWidth, h = window.innerHeight; if (this.viewOff || this.viewOffY) this.camera.setViewOffset(w, h, -(this.viewOff || 0), this.viewOffY || 0, w, h); else this.camera.clearViewOffset(); }
  follow(target, o = {}) {
    const g = this.rig; g.mode = 'follow'; g.target = target;
    g.dist = o.dist || 14.5; g.pitch = o.pitch || 0.82; g.yaw = o.yaw || 0; g.fov = o.fov || 36; g.lookY = o.lookY == null ? 0.9 : o.lookY; g.bounds = o.bounds || null;
    if (o.snap) { g.focus.copy(target); this.place(1); }
  }
  shot(pos, look, fov = 32, k = 3, snap = false) {
    const g = this.rig; g.mode = 'shot'; g.shotPos.copy(pos); g.shotLook.copy(look); g.shotFov = fov; g.shotK = k;
    if (snap) { this.camPos.copy(pos); this.camLook.copy(look); this.curFov = fov; }
  }
  orbit(center, r, h, speed = 0.035, snap = false) {
    const g = this.rig; g.mode = 'orbit'; g.orbitC.copy(center); g.orbitR = r; g.orbitH = h; g.orbitSpeed = speed;
    if (snap) this.place(1);
  }
  setFx(o) { for (const k in o) if (k in this.fxT) this.fxT[k] = o[k]; }
  fadeTo(v, ms = 600) {
    this.fadeFrom = this.fade; this.fadeTo_ = v; this.fadeT = 0; this.fadeDur = Math.max(1, ms) / 1000 / (this.test ? 4 : 1);
    if (this.fadeResolve) this.fadeResolve();
    return new Promise((res) => { this.fadeResolve = res; });
  }
  place(k) {
    const g = this.rig; const dt = 1;
    if (g.mode === 'follow') {
      const d = lerp(g.dist, g.dist * 0.56, g.push);
      const p = lerp(g.pitch, 0.42, g.push);
      const ly = lerp(g.lookY, 1.15, g.push);
      const fx = g.focus;
      const want = new THREE.Vector3(fx.x + Math.sin(g.yaw) * Math.cos(p) * d, fx.y + Math.sin(p) * d, fx.z + Math.cos(g.yaw) * Math.cos(p) * d);
      const look = new THREE.Vector3(fx.x, fx.y + ly, fx.z);
      if (k >= 1) { this.camPos.copy(want); this.camLook.copy(look); this.curFov = lerp(g.fov, g.fov - 5, g.push); }
      return [want, look, lerp(g.fov, g.fov - 5, g.push)];
    }
    if (g.mode === 'orbit') {
      const a = g.orbitT;
      const want = new THREE.Vector3(g.orbitC.x + Math.sin(a) * g.orbitR, g.orbitC.y + g.orbitH, g.orbitC.z + Math.cos(a) * g.orbitR);
      if (k >= 1) { this.camPos.copy(want); this.camLook.copy(g.orbitC); }
      return [want, g.orbitC, 34];
    }
    return [g.shotPos, g.shotLook, g.shotFov];
  }
  update(dt) {
    this.time += dt;
    const g = this.rig;
    if (g.mode === 'follow') {
      g.focus.x = damp(g.focus.x, g.target.x, 7, dt); g.focus.y = damp(g.focus.y, g.target.y, 7, dt); g.focus.z = damp(g.focus.z, g.target.z, 7, dt);
      if (g.bounds) { g.focus.x = clamp(g.focus.x, g.bounds[0], g.bounds[2]); g.focus.z = clamp(g.focus.z, g.bounds[1], g.bounds[3]); }
    }
    if (g.mode === 'orbit') g.orbitT += dt * g.orbitSpeed;
    const [want, look, fov] = this.place(0);
    const k = g.mode === 'shot' ? g.shotK : g.mode === 'orbit' ? 2 : 9;
    this.camPos.x = damp(this.camPos.x, want.x, k, dt); this.camPos.y = damp(this.camPos.y, want.y, k, dt); this.camPos.z = damp(this.camPos.z, want.z, k, dt);
    this.camLook.x = damp(this.camLook.x, look.x, k, dt); this.camLook.y = damp(this.camLook.y, look.y, k, dt); this.camLook.z = damp(this.camLook.z, look.z, k, dt);
    this.curFov = damp(this.curFov, fov, 3, dt);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.001 && !this.reduceMotion) {
      const s = this.shake * 0.06 * this.fxScale;
      this.camera.position.x += noise2(this.time * 2.1, 3.3) * s; this.camera.position.y += noise2(this.time * 1.7, 9.1) * s;
    }
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.curFov) > 0.01) { this.camera.fov = this.curFov; this.camera.updateProjectionMatrix(); }
    for (const key of FX_KEYS) this.fx[key] = damp(this.fx[key], this.fxT[key], 2.5, dt);
    if (this.fadeT < 1) {
      this.fadeT = Math.min(1, this.fadeT + dt / this.fadeDur);
      this.fade = lerp(this.fadeFrom, this.fadeTo_, this.fadeT * this.fadeT * (3 - 2 * this.fadeT));
      if (this.fadeT >= 1 && this.fadeResolve) { const r = this.fadeResolve; this.fadeResolve = null; r(); }
    }
    const u = this.grade.uniforms, f = this.fx, s = this.fxScale;
    u.uSat.value = lerp(1, f.sat, s); u.uContrast.value = lerp(1, f.contrast, s); u.uVignette.value = f.vignette; u.uAberr.value = f.aberr * s * (this.reduceMotion ? 0.5 : 1);
    u.uGrain.value = f.grain; u.uTintAmt.value = f.tint; u.uTime.value = this.time; u.uFade.value = this.fade; u.uWarm.value = f.warm;
    this.bloom.strength = this.bloomGuard.update(lerp(0.3, f.bloom, s), dt);
    this.renderer.toneMappingExposure = this.exposureGuard.update(lerp(1, f.exposure, s), dt);
  }
  setOccluder(pos, on, radius = 0.13) {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    OCC.uOccRes.value.copy(size); OCC.uOccAspect.value = size.x / size.y;
    if (!on || !pos) { OCC.uOccR.value = 0; return; }
    _v.copy(pos); _v.y += 0.7; _v.project(this.camera);
    OCC.uOccPos.value.set((_v.x + 1) / 2, (_v.y + 1) / 2);
    _v.copy(pos); _v.y += 0.7; _v.applyMatrix4(this.camera.matrixWorldInverse);
    OCC.uOccDepth.value = -_v.z; OCC.uOccR.value = radius;
  }
  render() { if (this.scene) this.composer.render(); }
  // draw the current scene from a temporary camera into a small image (portraits for the ending)
  snapshot(scene, cam, w = 360, h = 360) {
    const r = this.renderer; const prev = this.scene;
    this.renderPass.scene = scene; this.renderPass.camera = cam;
    const saveFade = this.grade.uniforms.uFade.value; this.grade.uniforms.uFade.value = 0;
    const saveSat = this.grade.uniforms.uSat.value; this.grade.uniforms.uSat.value = 1; const saveTint = this.grade.uniforms.uTintAmt.value; this.grade.uniforms.uTintAmt.value = 0;
    this.composer.render();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const src = r.domElement; const s = Math.min(src.width, src.height);
    c.getContext('2d').drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, w, h);
    this.renderPass.scene = prev; this.renderPass.camera = this.camera;
    this.grade.uniforms.uFade.value = saveFade; this.grade.uniforms.uSat.value = saveSat; this.grade.uniforms.uTintAmt.value = saveTint;
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }
}
