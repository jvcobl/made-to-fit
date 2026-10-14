// Sonder: everyone you pass is in the middle of their own day, as full as yours.
// From far off, a town looks like one crowd, and a town planned from far off gets built for one imagined person (the
// Standard). Up close, it never was one person. Two ways in: the opening shot, where the crowd's thoughts appear over
// it, and in play, when you stand still for a moment, the people walking past show what their day is about.
// Most lines are just life. A few are about fit, the way most days have a little of it in them.
import * as THREE from 'three';
import { CAST } from './content.js';
import { FAST } from './util.js';

export const THOUGHTS = [
  'Late again.', 'First day at the new job.', 'On my way to see my mom.', 'Trying not to cry.', 'Just got good news.',
  'Thinking about quitting.', 'Last shift before I move away.', 'Going to say sorry.', 'Hope the bus is on time today.',
  'So loud. Again.', 'Is there a seat in the shade anywhere?', 'Practicing what I\'ll say.', 'I miss my old street.',
  'Why is everyone walking so fast?', 'Ten more minutes, then I can sit down.', 'Forgot my headphones. Today of all days.',
  'These steps are hard on my knees.', 'I said yes. I meant no.', 'Everyone else seems fine with it.', 'Is it rude to leave early?',
  'Got the job!', 'Just a normal day.', 'Nobody here knows it\'s my birthday.', 'Counting the steps to the door.',
  'Hoping nobody talks to me.', 'Hoping somebody talks to me.', 'Does anyone else hear the lights buzzing?', 'New in town too.',
  'Running on four hours of sleep.', 'Saving up for something big.', 'Was it four o\'clock or five?', 'Smile and nod. Nearly there.',
  'Finally, a quiet minute.', 'Picking up my kid.', 'Waiting to hear back from the doctor.', 'Am I doing this right?',
  'Thinking about dinner.', 'I need a bench. There isn\'t one.', 'Today I\'ll say no.', 'Quietly proud of myself.',
  'Don\'t make eye contact.', 'So many signs. None of them say what I need.', 'Getting groceries for my neighbor.',
  'Late for the bus. Running.', 'Wish I could say how I really feel.', 'Still learning the way home.', 'Too bright out here.',
  'Everybody else seems to know the unwritten rules.', 'My first walk outside in a week.', 'Going to meet a friend.',
  'Can\'t wait to take my shoes off.', 'I\'ll just hide it until I get home.',
];
// the opening shows the range of people's days (the pinches come later, once you can see them)
const OPENING = ['Late again.', 'First day at the new job.', 'On my way to see my mom.', 'Trying not to cry.', 'Just got good news.',
  'Thinking about quitting.', 'Going to say sorry.', 'Got the job!', 'Picking up my kid.', 'Nobody here knows it\'s my birthday.',
  'Going to meet a friend.', 'Last shift before I move away.', 'So loud. Again.', 'Saving up for something big.'];
// the people you'll meet, glimpsed before you know them (the first visit only; ten years on, they're strangers again)
const RESIDENT = {
  bea: ['Was that the knocker?', 'Fifty years on this row.'], moss: ['I used to hear my kettle.', 'Smile, pour, smile.'],
  pip: ['Forty rolls today.', 'Which bus is this one?'], gil: ['Nine years of tomatoes.', 'Great! Great. Great?'],
  pomeroy: ['Louder is friendlier. Right?', 'Apples, apples, APPLES.'], rue: ['Streak still going. Feeling fine.', 'Everything is fine. The app says so.'],
  hollis: ['We have always done it this way.', 'Order, order.'], clover: ['That gate needs a hinge.', 'Who did they ask?'],
  wren: ['Knock once. Just once.', 'The lantern needs a new wick.'],
};
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export class Sonder {
  constructor(G) { this.G = G; this.order = shuffle(THOUGHTS); this.k = 0; this.still = 0; this.cool = 3; this.recent = []; this.els = []; this.lastPos = null; }
  line() { if (this.k >= this.order.length) { this.order = shuffle(THOUGHTS); this.k = 0; } return this.order[this.k++]; }
  lineFor(p) {
    const S = this.G.S; const first = !S.act || S.act === 1;
    if (p.id && first && RESIDENT[p.id] && Math.random() < 0.7) { const L = RESIDENT[p.id]; return L[Math.floor(Math.random() * L.length)]; }
    return this.line();
  }
  // everyone out in town and on screen: passersby and residents, with where they are on screen
  people() {
    const G = this.G; const cam = G.stage.camera; const out = []; const v = new THREE.Vector3();
    const add = (root, id) => {
      if (!root || !root.visible) return;
      v.copy(root.position); v.y += 2.1; v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 0.86 || v.y > 0.72 || v.y < -0.8) return;
      out.push({ root, id, sx: (v.x + 1) / 2 * innerWidth, sy: (1 - v.y) / 2 * innerHeight });
    };
    for (const a of G.crowd || []) if (a.active) add(a.c.root, null);
    for (const id of Object.keys(G.npcs || {})) { const n = G.npcs[id]; if (n && n.place === 'town' && CAST[id]) add(n.c.root, id); }
    return out;
  }
  say(p, ms, line) {
    const G = this.G; const text = line || this.lineFor(p);
    const el = G.fx.pop(p.root.position.clone(), text, { kind: 'thought', ms, follow: p.root, dy: 2.15, rise: 4 });
    if (el) this.els.push(el);
    this.recent.push(p.root); if (this.recent.length > 5) this.recent.shift();
    return text;
  }
  // the opening: a handful of thoughts at once, spread over the screen
  burst(n, ms = 60000, band = [0.27, 0.52]) {
    const G = this.G; if (!G.fx) return 0;
    const all = this.people().sort(() => Math.random() - 0.5); const picked = [];
    // (spread out, and clear of the band where the caption sits)
    for (const p of all) { if (picked.length >= n) break; if (p.sy > innerHeight * band[0] && p.sy < innerHeight * band[1]) continue; if (picked.every((q) => Math.hypot(q.sx - p.sx, q.sy - p.sy) > Math.min(150, innerWidth * 0.26))) picked.push(p); }
    const said = []; const open = shuffle(OPENING);
    picked.forEach((p, i) => setTimeout(() => said.push(this.say(p, ms, p.id && RESIDENT[p.id] ? null : open.at(i))), FAST ? 0 : 260 * i));
    if (picked.length) setTimeout(() => G.ui.announce('Over the crowd, one thought each: ' + said.join(' ')), FAST ? 10 : 260 * picked.length + 80);
    return picked.length;
  }
  clear() { const G = this.G; for (const el of this.els) G.fx.unpop(el); this.els = []; }
  // in play: stand still for a moment, and someone nearby shows what their day is about
  update(dt) {
    const G = this.G, S = G.S, ui = G.ui; if (!G.player || !G.fx) return;
    // (real seconds, not the game clock: "a moment" is a moment however fast the screen draws)
    const now = performance.now(); dt = Math.min(0.5, (now - (this.lastT || now)) / 1000); this.lastT = now;
    if (this.cool > 0) this.cool -= dt;
    const p = G.player.root.position;
    const moved = this.lastPos ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) : 1;
    if (!this.lastPos) this.lastPos = p.clone(); else this.lastPos.copy(p);
    const free = G.loc === 'town' && G.mode === 'play' && !G.busy && (S.day || 0) >= 1 && ui.panel.hidden && !ui.waiter && !G.phoneOpen && !G.mgActive && !(G.look && G.look.raised);
    if (!free || moved > 0.015 || (G.path && G.path.length)) { this.still = 0; return; }
    this.still += dt;
    if (this.still < 2.2 || this.cool > 0) return;
    const near = this.people().filter((q) => !this.recent.includes(q.root) && Math.hypot(q.root.position.x - p.x, q.root.position.z - p.z) < 14)
      .sort((a, b) => Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z) - Math.hypot(b.root.position.x - p.x, b.root.position.z - p.z));
    if (!near.length) { this.cool = 2; return; }
    const q = near[0]; const line = this.lineFor(q); const text = this.say(q, ui.readMs ? ui.readMs(line, 4200) : 5200, line);
    const who = q.id && S.met && S.met[q.id] && CAST[q.id] ? CAST[q.id].name : 'Someone passing';
    ui.announce(who + ', thinking: ' + text);
    this.cool = 5;
    // the first time: what this is, once, and a note to keep
    if (!S.flags.sonderSeen) {
      S.flags.sonderSeen = 1;
      setTimeout(() => ui.toast('<b>Sonder</b><span class="tsub">Everyone walking past is in the middle of their own day, as full as yours. Stand still for a moment and you\'ll catch a little of it.</span>', 'note', 9000), FAST ? 10 : 900);
      if (G.story && G.story.fieldNote) G.story.fieldNote('sonder');
    }
  }
}
