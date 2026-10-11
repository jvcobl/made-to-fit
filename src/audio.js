// Generative audio: adaptive music, layered ambience, babble voices and sound effects. No files.
import { clamp, lerp } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCENES = {
  title: { bpm: 62, bars: 2, prog: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]], scale: [62, 64, 66, 69, 71, 74, 76, 78, 81], pluck: 0.32, pad: 0.1, bass: 0.1 },
  town: { bpm: 74, bars: 1, prog: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]], scale: [62, 64, 66, 69, 71, 74, 76, 78], pluck: 0.48, pad: 0.075, bass: 0.09 },
  home: { bpm: 68, bars: 1, prog: [[41, 48, 53, 57, 60, 64], [38, 45, 50, 53, 57, 60], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67]], scale: [65, 67, 69, 72, 74, 77, 79, 81], pluck: 0.42, pad: 0.09, bass: 0.08 },
  works: { bpm: 84, bars: 1, prog: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62], [40, 47, 52, 55, 59]], scale: [69, 72, 74, 76, 79, 81], pluck: 0.22, pad: 0.05, bass: 0.07 },
  farend: { bpm: 58, bars: 2, prog: [[38, 45, 50, 54, 57, 61], [43, 50, 55, 59, 62, 66]], scale: [62, 64, 66, 68, 69, 73, 74], pluck: 0.3, pad: 0.11, bass: 0.07 },
  night: { bpm: 56, bars: 2, prog: [[45, 52, 57, 59, 64], [41, 48, 53, 57, 60]], scale: [64, 67, 69, 71, 74, 76], pluck: 0.24, pad: 0.09, bass: 0.07 },
  festival: { bpm: 92, bars: 1, prog: [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]], scale: [60, 62, 64, 67, 69, 72, 74, 76], pluck: 0.62, pad: 0.08, bass: 0.1, drums: true },
  blend: { bpm: 118, bars: 1, prog: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]], scale: [72, 76, 79, 84], pluck: 0, pad: 0.035, bass: 0.08, arp: true },
  council: { bpm: 64, bars: 2, prog: [[43, 50, 55, 59], [40, 47, 52, 55], [45, 52, 57, 60], [38, 45, 50, 54]], scale: [67, 69, 71, 74, 76], pluck: 0.18, pad: 0.08, bass: 0.07 },
  silence: { bpm: 60, bars: 4, prog: [[]], scale: [], pluck: 0, pad: 0, bass: 0 },
};
const VOICES = { chime: { type: 'sine', base: 520, var: 0.42, len: 0.07 }, hum: { type: 'triangle', base: 220, var: 0.35, len: 0.08 }, click: { type: 'square', base: 340, var: 0.3, len: 0.035 }, whistle: { type: 'sine', base: 880, var: 0.3, len: 0.07 }, standard: { type: 'triangle', base: 240, var: 0.0, len: 0.08 } };

export class Audio {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false;
    this.vol = { master: 0.8, music: 0.7, amb: 0.7, sfx: 0.8 };
    this.scene = 'silence'; this.wantScene = 'silence'; this.pressure = 0; this.muffle = 0; this.smooth = 0; this.self = 1;
    this.mix = { crowd: 0, traffic: 0, hum: 0, birds: 0, wind: 0.2, water: 0, chatter: 0 };
    this.beat = 0; this.nextT = 0; this.bar = 0; this.lastMel = 4;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 3;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.rev = c.createConvolver(); this.rev.buffer = this.impulse(2.4); this.revGain = c.createGain(); this.revGain.gain.value = 0.28; this.rev.connect(this.revGain); this.revGain.connect(this.master);
    this.music = c.createGain(); this.musicLP = c.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 18000;
    this.music.connect(this.musicLP); this.musicLP.connect(this.master); this.musicLP.connect(this.rev);
    this.amb = c.createGain(); this.ambLP = c.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 18000;
    this.ambShelf = c.createBiquadFilter(); this.ambShelf.type = 'highshelf'; this.ambShelf.frequency.value = 2400; this.ambShelf.gain.value = 0;
    this.amb.connect(this.ambShelf); this.ambShelf.connect(this.ambLP); this.ambLP.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master); this.sfxBus.connect(this.rev);
    this.voiceBus = c.createGain(); this.voiceBus.gain.value = 0.55; this.voiceBus.connect(this.master); this.voiceBus.connect(this.rev);
    this.noise = { white: this.noiseBuf('white'), pink: this.noiseBuf('pink'), brown: this.noiseBuf('brown') };
    this.layers = {};
    const layer = (name, buf, type, f, q) => { const s = c.createBufferSource(); s.buffer = this.noise[buf]; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.amb); s.start(); this.layers[name] = { g, fl }; };
    layer('crowd', 'pink', 'bandpass', 700, 0.6); layer('traffic', 'brown', 'lowpass', 220, 0.7); layer('wind', 'pink', 'bandpass', 420, 0.5); layer('water', 'white', 'bandpass', 1700, 2.5);
    const hum = c.createGain(); hum.gain.value = 0; hum.connect(this.amb);
    for (const [f, a] of [[120, 0.5], [240, 0.25], [360, 0.12]]) { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = a; o.connect(g); g.connect(hum); o.start(); }
    this.layers.hum = { g: hum };
    this.ready = true; this.nextT = c.currentTime + 0.1;
    this.applyVolumes();
    this.timer = setInterval(() => this.schedule(), 90);
  }
  impulse(sec) { const c = this.ctx; const n = Math.floor(c.sampleRate * sec); const b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); } return b; }
  noiseBuf(kind) {
    const c = this.ctx; const n = c.sampleRate * 2; const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    return b;
  }
  applyVolumes() {
    if (!this.ready) return; const t = this.ctx.currentTime; const m = this.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.1);
    this.music.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }
  setMuted(v) { this.muted = v; this.applyVolumes(); }
  setScene(name) { this.wantScene = name; }
  setMix(o) { Object.assign(this.mix, o); }
  setState(o) { if ('pressure' in o) this.pressure = o.pressure; if ('muffle' in o) this.muffle = o.muffle; if ('smooth' in o) this.smooth = o.smooth; if ('self' in o) this.self = o.self; }
  // called every frame: glide everything toward its targets
  update() {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime;
    const P = this.pressure, Mu = this.muffle, Sm = this.smooth;
    const ambVol = this.vol.amb * (1 + P * 0.9) * (1 - Sm * 0.6);
    this.amb.gain.setTargetAtTime(ambVol, t, 0.4);
    this.ambShelf.gain.setTargetAtTime(P * 9 - Sm * 6, t, 0.4);
    const lp = Mu > 0.01 ? lerp(18000, 650, Mu) : 18000;
    this.ambLP.frequency.setTargetAtTime(lp, t, 0.2); this.musicLP.frequency.setTargetAtTime(Mu > 0.01 ? lerp(18000, 2200, Mu) : 18000, t, 0.2);
    const L = this.layers, x = this.mix;
    L.crowd.g.gain.setTargetAtTime(x.crowd * 0.5 * (1 + 0.25 * Math.sin(t * 0.7)), t, 0.5);
    L.traffic.g.gain.setTargetAtTime(x.traffic * 0.45, t, 0.6); L.wind.g.gain.setTargetAtTime(x.wind * 0.12, t, 0.8);
    L.wind.fl.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 140, t, 1); L.water.g.gain.setTargetAtTime(x.water * 0.05 * (0.6 + 0.4 * Math.sin(t * 7.3)), t, 0.05);
    L.hum.g.gain.setTargetAtTime(x.hum * 0.035, t, 0.4);
    const scene = Sm > 0.5 ? 'blend' : this.wantScene;
    if (scene !== this.scene) { this.scene = scene; this.bar = 0; this.beat = 0; }
  }
  schedule() {
    if (!this.ready) return; const c = this.ctx;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.35) { this.playBeat(this.nextT); const S = SCENES[this.scene] || SCENES.town; this.nextT += 60 / S.bpm / 2; }
    // ambience details: birds, babble, heartbeat
    const t = c.currentTime; const x = this.mix;
    if (x.birds > 0.05 && Math.random() < x.birds * 0.06) this.chirp(t + Math.random() * 0.3);
    if (x.chatter > 0.05 && Math.random() < x.chatter * (0.25 + this.pressure * 0.3)) this.voice('hum', 0.7 + Math.random() * 0.8, 'mmmhm yeah oh really', { bus: this.amb, gain: 0.09 * (1 + this.pressure), count: 4 + Math.floor(Math.random() * 5), when: t + Math.random() * 0.2 });
    if (this.pressure > 0.35) { this.hbT = (this.hbT || 0) - 0.09; if (this.hbT <= 0) { this.heart(t + 0.02); this.hbT = 60 / (66 + this.pressure * 50); } }
  }
  playBeat(t) {
    const S = SCENES[this.scene] || SCENES.town; const c = this.ctx;
    const beatsPerChord = 8 * S.bars; const idx = Math.floor(this.beat / beatsPerChord) % S.prog.length; const chord = S.prog[idx];
    const pos = this.beat % beatsPerChord;
    if (pos === 0 && chord.length) {
      const dur = (60 / S.bpm) * 4 * S.bars;
      chord.forEach((m, i) => { if (i === 0 && S.bass) this.bass(mtof(m - 12), t, dur, S.bass); if (S.pad) this.pad(mtof(m), t, dur, S.pad / chord.length * 3); });
    }
    if (S.arp && chord.length) { const m = chord[(this.beat % chord.length)] + 24; this.blip(mtof(m), t, 0.12, 0.045, 'square'); if (pos === 0) this.sparkle(t); }
    if (S.pluck && S.scale.length && pos % 2 === 0 && Math.random() < S.pluck * (0.35 + 0.65 * this.self)) {
      this.lastMel = clamp(this.lastMel + Math.floor(Math.random() * 5) - 2, 0, S.scale.length - 1);
      this.pluck(mtof(S.scale[this.lastMel]), t, 0.12 * (0.5 + 0.5 * this.self));
    }
    if (S.drums) { if (pos % 4 === 0) this.kick(t); if (pos % 2 === 1) this.shaker(t); }
    this.beat++;
  }
  env(g, t, a, peak, dec, sustain = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + dec); }
  pad(f, t, dur, vol) {
    const c = this.ctx; const g = c.createGain(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + this.self * 900; lp.connect(g); g.connect(this.music);
    for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d + (this.pressure * (Math.random() - 0.5) * 30); o.connect(lp); o.start(t); o.stop(t + dur + 2.6); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.5, t + 1.4); g.gain.setValueAtTime(vol * 0.5, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.5);
  }
  bass(f, t, dur, vol) { const c = this.ctx; const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); o.connect(g); g.connect(this.music); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.3); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6); o.start(t); o.stop(t + dur + 0.7); }
  pluck(f, t, vol) {
    const c = this.ctx; const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2; mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(this.music);
    this.env(g, t, 0.006, vol, 1.4); car.start(t); mod.start(t); car.stop(t + 1.6); mod.stop(t + 1.6);
  }
  blip(f, t, dur, vol, type = 'sine', bus) { const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); o.connect(g); g.connect(bus || this.music); this.env(g, t, 0.005, vol, dur); o.start(t); o.stop(t + dur + 0.05); }
  sparkle(t) { [84, 88, 91, 96].forEach((m, i) => this.blip(mtof(m), t + i * 0.04, 0.25, 0.03, 'sine')); }
  kick(t) { const c = this.ctx; const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); g.connect(this.music); this.env(g, t, 0.003, 0.22, 0.2); o.start(t); o.stop(t + 0.3); }
  shaker(t) { const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise.white; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(this.music); this.env(g, t, 0.003, 0.04, 0.06); s.start(t, Math.random()); s.stop(t + 0.1); }
  heart(t) { if (!this.ready) return; const c = this.ctx; for (const [dt, v] of [[0, 0.22], [0.18, 0.14]]) { const o = c.createOscillator(); o.frequency.value = 52; const g = c.createGain(); o.connect(g); g.connect(this.master); this.env(g, t + dt, 0.01, v * this.pressure * this.vol.sfx, 0.16); o.start(t + dt); o.stop(t + dt + 0.25); } }
  chirp(t) { const c = this.ctx; const o = c.createOscillator(); const g = c.createGain(); const f0 = 2400 + Math.random() * 1600; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.06); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.12); o.connect(g); g.connect(this.amb); this.env(g, t, 0.01, 0.025 * this.mix.birds, 0.12); o.start(t); o.stop(t + 0.2); }
  // babble voices: one blip per letter, pitch from the voice and the letter
  voice(kind, pitch, text, o = {}) {
    if (!this.ready || this.muted) return 0;
    const V = VOICES[kind] || VOICES.hum; const c = this.ctx; let t = o.when || c.currentTime + 0.02;
    const letters = String(text).replace(/[^a-zA-Z]/g, '').toLowerCase(); const n = Math.min(o.count || 40, Math.ceil(letters.length / 2));
    const variety = V.var * (o.flat ? 0.15 : 1);
    for (let i = 0; i < n; i++) {
      const ch = letters.charCodeAt(i * 2) || 97; const vowel = 'aeiouy'.includes(letters[i * 2]);
      const f = V.base * pitch * (1 + ((ch * 7) % 9 - 4) / 9 * variety) * (vowel ? 1.12 : 1);
      if (kind === 'click') { const s = c.createBufferSource(); s.buffer = this.noise.white; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 4; fl.Q.value = 4; const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(o.bus || this.voiceBus); this.env(g, t, 0.002, (o.gain || 0.5), 0.035); s.start(t, Math.random()); s.stop(t + 0.06); }
      else { const os = c.createOscillator(); os.type = V.type; os.frequency.setValueAtTime(f, t); if (kind === 'whistle') os.frequency.linearRampToValueAtTime(f * 1.04, t + V.len); const g = c.createGain(); os.connect(g); g.connect(o.bus || this.voiceBus); this.env(g, t, 0.006, (o.gain || 0.16), V.len); os.start(t); os.stop(t + V.len + 0.05); }
      t += o.rate || 0.062;
    }
    return n * (o.rate || 0.062);
  }
  announce(text) { if (!this.ready) return; this.voice('hum', 1.0, text, { gain: 0.32 * (1 - this.muffle * 0.85), rate: 0.07, count: 30 }); this.blip(660, this.ctx.currentTime, 0.4, 0.08, 'sine', this.sfxBus); this.blip(880, this.ctx.currentTime + 0.25, 0.5, 0.08, 'sine', this.sfxBus); }
  sfx(name, o = {}) {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime + 0.01, B = this.sfxBus; const bl = (f, dt, d, v, ty) => this.blip(f, t + dt, d, v, ty || 'sine', B);
    switch (name) {
      case 'step': { const s = c.createBufferSource(); s.buffer = this.noise.white; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.2; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(B); this.env(g, t, 0.003, 0.035 * (o.v || 1), 0.05); s.start(t, Math.random()); s.stop(t + 0.08); break; }
      case 'select': bl(880, 0, 0.06, 0.06, 'triangle'); break;
      case 'confirm': bl(659, 0, 0.12, 0.08, 'triangle'); bl(988, 0.07, 0.18, 0.07, 'triangle'); break;
      case 'back': bl(660, 0, 0.1, 0.06, 'triangle'); bl(495, 0.06, 0.14, 0.05, 'triangle'); break;
      case 'coin': bl(1319, 0, 0.12, 0.06); bl(1760, 0.08, 0.25, 0.06); break;
      case 'door': { const o2 = c.createOscillator(); o2.frequency.setValueAtTime(90, t); o2.frequency.exponentialRampToValueAtTime(55, t + 0.2); const g = c.createGain(); o2.connect(g); g.connect(B); this.env(g, t, 0.005, 0.25, 0.25); o2.start(t); o2.stop(t + 0.35); bl(320, 0.05, 0.3, 0.02, 'sawtooth'); break; }
      case 'bus': bl(196, 0, 0.5, 0.06, 'sawtooth'); bl(247, 0, 0.5, 0.05, 'sawtooth'); break;
      case 'blend': [72, 76, 79, 84, 88].forEach((m, i) => bl(mtof(m), i * 0.05, 0.3, 0.07)); bl(mtof(96), 0.3, 0.6, 0.05); break;
      case 'badge': [67, 72, 76, 79].forEach((m, i) => bl(mtof(m), i * 0.09, 0.35, 0.08, 'square')); break;
      case 'notify': bl(1175, 0, 0.18, 0.05); bl(1568, 0.1, 0.25, 0.04); break;
      case 'ink': case 'sign': { const s = c.createBufferSource(); s.buffer = this.noise.white; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(B); g.gain.setValueAtTime(0.0001, t); for (let i = 0; i < 6; i++) { g.gain.linearRampToValueAtTime(0.05, t + i * 0.06 + 0.02); g.gain.linearRampToValueAtTime(0.001, t + i * 0.06 + 0.05); } s.start(t); s.stop(t + 0.4); break; }
      case 'fix': for (let i = 0; i < 3; i++) { bl(180, i * 0.18, 0.08, 0.15, 'square'); bl(1200, i * 0.18, 0.04, 0.03); } break;
      case 'good': bl(mtof(72), 0, 0.3, 0.07); bl(mtof(76), 0.08, 0.4, 0.07); bl(mtof(79), 0.16, 0.5, 0.06); break;
      case 'bad': bl(mtof(64), 0, 0.3, 0.06, 'triangle'); bl(mtof(63), 0.12, 0.4, 0.05, 'triangle'); break;
      case 'phone': bl(1400, 0, 0.06, 0.04); bl(2000, 0.04, 0.08, 0.03); break;
      case 'lantern': [60, 67, 72, 76, 79, 84].forEach((m, i) => bl(mtof(m), i * 0.12, 1.2, 0.05)); break;
      case 'page': this.shaker(t); break;
      case 'jar': bl(mtof(88), 0, 0.9, 0.05); bl(mtof(95), 0.05, 1.1, 0.03); bl(mtof(100), 0.11, 0.8, 0.02); break;
      case 'thwip': bl(mtof(o.n || 79), 0, 0.09, 0.07, 'triangle'); bl(mtof((o.n || 79) + 7), 0.04, 0.12, 0.05, 'triangle'); break;
      case 'bonk': bl(mtof(48), 0, 0.16, 0.09, 'triangle'); bl(mtof(43), 0.05, 0.22, 0.06, 'sine'); break;
      case 'stamp': { const o2 = c.createOscillator(); o2.frequency.setValueAtTime(150, t); o2.frequency.exponentialRampToValueAtTime(60, t + 0.12); const g = c.createGain(); o2.connect(g); g.connect(B); this.env(g, t, 0.002, 0.3, 0.14); o2.start(t); o2.stop(t + 0.2); const s2 = c.createBufferSource(); s2.buffer = this.noise.pink; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g2 = c.createGain(); s2.connect(f); f.connect(g2); g2.connect(B); this.env(g2, t, 0.002, 0.18, 0.08); s2.start(t); s2.stop(t + 0.12); break; }
      case 'pop': bl(mtof(84 + Math.floor(Math.random() * 5)), 0, 0.06, 0.05, 'sine'); break;
      case 'tick': bl(2100, 0, 0.03, 0.025, 'square'); break;
      case 'plip': bl(mtof(86), 0, 0.12, 0.05); bl(mtof(81), 0.06, 0.18, 0.04); break;
      case 'splash': { const s2 = c.createBufferSource(); s2.buffer = this.noise.white; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.35); const g = c.createGain(); s2.connect(f); f.connect(g); g.connect(B); this.env(g, t, 0.01, 0.14, 0.35); s2.start(t); s2.stop(t + 0.5); break; }
      case 'swipe': { const s2 = c.createBufferSource(); s2.buffer = this.noise.pink; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.15); const g = c.createGain(); s2.connect(f); f.connect(g); g.connect(B); this.env(g, t, 0.02, 0.08, 0.15); s2.start(t); s2.stop(t + 0.25); bl(mtof(84), 0.06, 0.1, 0.03); break; }
      case 'prize': [72, 79, 84, 88, 91, 96].forEach((m, i) => bl(mtof(m), i * 0.06, 0.25, 0.06, i % 2 ? 'square' : 'triangle')); break;
      case 'hum': [0, 4, 7, 12].forEach((d, i) => bl(mtof((o.n || 67) + d), i * 0.14, 0.3, 0.04, 'sine')); break;
      case 'drop': bl(mtof(76), 0, 0.08, 0.05, 'triangle'); bl(mtof(72), 0.05, 0.1, 0.04, 'triangle'); break;
      case 'whoosh': { const s = c.createBufferSource(); s.buffer = this.noise.pink; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2000, t + 0.35); const g = c.createGain(); s.connect(f); f.connect(g); g.connect(B); this.env(g, t, 0.15, 0.12, 0.3); s.start(t); s.stop(t + 0.6); break; }
      case 'cheer': { const s = c.createBufferSource(); s.buffer = this.noise.pink; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(B); this.env(g, t, 0.3, 0.12, 1.6); s.start(t); s.stop(t + 2); break; }
      default: break;
    }
  }
}
