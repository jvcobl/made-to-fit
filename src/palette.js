// Larkspur's colors and the light across a day. Hex values are sRGB; THREE.Color converts them.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export const PAL = {
  grass: '#a9bf7c', grass2: '#98b46c', grass3: '#bcc583', dirt: '#c8a77d', path: '#dccaa8', plaza: '#ddcfb5', plaza2: '#c8b391',
  road: '#a59a8f', roadLine: '#f4ead2', water: '#7fb1bf', curb: '#d8c8ae',
  walls: ['#f2e3c9', '#e9d3bb', '#f3d6c9', '#dfe5d6', '#e6dcef', '#f5e7c4', '#d9e2e8'],
  roofs: ['#c8553d', '#b8683f', '#7a4e6e', '#4f6f8f', '#8a5a3c', '#6d7f5a', '#a8483f'],
  trim: '#fbf6ee', wood: '#a8754f', woodDark: '#7a5236', stone: '#cfc4b3', metal: '#5b6470',
  leaves: ['#d9913e', '#c96a32', '#e2b34c', '#9cae55', '#b9a944', '#7f9e52', '#d67d3c'],
  trunk: '#7a5a41', blendPink: '#ff5fa2', beige: '#d6c6ad',
};

// keyframes: hour, sky top, sky horizon, sun color, sun intensity, hemi sky, hemi ground, hemi intensity, fog, night (0-1)
const K = [
  [5.0, '#141c36', '#3b3f62', '#ffb48a', 0.0, '#3a4a72', '#22222e', 0.32, '#30365a', 1],
  [6.4, '#5f73ad', '#f2b199', '#ffb07a', 1.2, '#c3bfe0', '#695852', 0.75, '#e6bdaa', 0.45],
  [8.3, '#86b8e6', '#f6e6cd', '#fff0d4', 2.1, '#e9f0ff', '#8c8665', 0.92, '#eee2cd', 0],
  [13.0, '#73b0e8', '#e4eff5', '#fff8ec', 2.3, '#eef3ff', '#97977a', 0.95, '#e6edf0', 0],
  [17.0, '#7fadde', '#f7e0bd', '#ffe0ad', 2.3, '#f5e8d6', '#8c7c60', 0.92, '#f1d9bd', 0],
  [18.9, '#6886c2', '#ffbb88', '#ffaa6a', 1.8, '#efc6ad', '#79584e', 0.8, '#f0b591', 0.12],
  [20.2, '#2f3a6a', '#c27397', '#ff8a68', 0.5, '#8a7aac', '#3a3048', 0.62, '#6f5476', 0.7],
  [21.4, '#0f1730', '#2a3158', '#a9bfff', 0.42, '#5065a0', '#272838', 0.62, '#222847', 1],
  [29.0, '#141c36', '#3b3f62', '#ffb48a', 0.0, '#3a4a72', '#22222e', 0.32, '#30365a', 1],
].map((k) => ({ h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), sunI: k[4], hs: new THREE.Color(k[5]), hg: new THREE.Color(k[6]), hI: k[7], fog: new THREE.Color(k[8]), night: k[9] }));

const out = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), fog: new THREE.Color(), sunI: 1, hI: 1, night: 0, dir: new THREE.Vector3(), moon: 0 };

export function sampleTOD(hour) {
  let h = hour;
  if (h < 5) h += 24;
  let i = 0;
  while (i < K.length - 2 && K[i + 1].h <= h) i++;
  const a = K[i], b = K[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h));
  out.top.copy(a.top).lerp(b.top, t); out.hor.copy(a.hor).lerp(b.hor, t); out.sun.copy(a.sun).lerp(b.sun, t);
  out.hs.copy(a.hs).lerp(b.hs, t); out.hg.copy(a.hg).lerp(b.hg, t); out.fog.copy(a.fog).lerp(b.fog, t);
  out.sunI = lerp(a.sunI, b.sunI, t); out.hI = lerp(a.hI, b.hI, t); out.night = lerp(a.night, b.night, t);
  // sun arcs from east (6am) through south, toward the camera, to west (8pm); at night a soft moon from the south-east
  const hh = hour % 24;
  const day = clamp((hh - 6) / 14);
  const az = day * Math.PI;
  const el = Math.sin(day * Math.PI) * 0.95 + 0.18;
  out.moon = clamp((hh >= 20.5 || hh < 5.5) ? 1 : 0);
  if (out.moon > 0.5) out.dir.set(0.45, 0.85, 0.5).normalize();
  else out.dir.set(Math.cos(az) * 0.9, el, Math.sin(az) * 0.75 + 0.25).normalize();
  return out;
}
