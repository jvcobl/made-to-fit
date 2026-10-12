// The hooks, shown. This game uses some of the same pulls apps use to keep people playing, and it says so as they
// happen: every reward built to pull you on carries a small hook mark, and the Hook Log (in your phone) names each
// one, with what it does, where you meet it in real life, and the research behind it (a field note). At lantern night
// you sort the day's rewards into the ones that pointed you at something real and the ones that pointed at the hook.
// What this game never uses on you: real money, notifications, timers on real time, or anything that punishes you for
// leaving. Blend, the app inside the story, uses the harder ones on your character.
import { esc } from './util.js';
import { HOOK_SVG } from './fx.js';

export const HOOKS = {
  endowed: { name: 'A head start', short: 'a head start (endowed progress)', what: 'Each street\'s list starts with one already ticked, so the rest feels closer and you\'re likelier to finish.', life: 'Loyalty cards that come with two stamps already on them.', note: 'endowed', use: 'It used a head start: the list began part-filled, so the rest felt closer.' },
  gradient: { name: 'Almost there', short: 'almost there (the goal gradient)', what: '"1 left!" People speed up as a goal gets close, so the game tells you when it is.', life: 'Progress bars, "your profile is 80% complete".', note: 'gradient', use: 'It used "almost there": the closer a goal looks, the harder it pulls.' },
  rare: { name: 'Not knowing when', short: 'not knowing when (a variable reward)', what: 'Some finds only turn up at certain times. Not knowing when keeps you looking.', life: 'Pull-to-refresh, loot boxes, slot machines.', note: 'variable', use: 'It used not knowing when: some finds only turn up at certain hours.' },
  juice: { name: 'Fireworks', short: 'fireworks (celebration)', what: 'Sparks, chimes and a push of the camera make a small act feel big.', life: 'Confetti when a payment goes through. Slot machines celebrate small losses the same way.', note: 'ldw', use: 'It used fireworks: sparks and a chime made a small act feel big.' },
  openloop: { name: 'Unfinished business', short: 'unfinished business (an open loop)', what: 'Something left half done pulls you back to it. The day ends on one on purpose.', life: '"Continue watching", cliffhangers, a half-full progress ring.', note: 'openloop', use: 'It used unfinished business: a question left open for tomorrow.' },
  points: { name: 'Numbers that go up', short: 'numbers that go up (points)', what: 'Points feel like progress, even when they measure nothing you care about.', life: 'App points, badges, levels, XP.', note: 'points', use: 'It used numbers that go up.' },
  streak: { name: 'Don\'t break the chain', short: 'don\'t break the chain (a streak)', what: 'A run of uses in a row becomes something to protect, so you keep it going.', life: 'Language-app streaks, daily login bonuses.', note: 'streaks', use: 'It used a streak: something to protect, so you keep going.' },
  likes: { name: 'Being liked', short: 'being liked (social approval)', what: 'A heart from someone else is a reward of its own, and it\'s hard to stop checking for more.', life: 'Likes, hearts, follower counts.', note: 'likes', use: 'It used being liked.' },
};
export const HOOK_ORDER = ['endowed', 'gradient', 'rare', 'juice', 'openloop', 'points', 'streak', 'likes'];

export class Hooks {
  constructor(G) { this.G = G; }
  get S() { return this.G.S; }
  // a hook just fired: count it, keep the moment for tonight's sort, and return its name for the mark's tooltip
  // ctx: { what: words for the moment ("Home Row: 2 of 3"), by: 'game' | 'blend' }
  fire(id, ctx = {}) {
    const H = HOOKS[id]; if (!H) return '';
    const S = this.S; S.hooks = S.hooks || {}; S.hookLog = S.hookLog || [];
    const first = !Object.keys(S.hooks).length;
    S.hooks[id] = (S.hooks[id] || 0) + 1;
    if (ctx.what && S.hookLog.length < 60) S.hookLog.push({ id, what: String(ctx.what).slice(0, 60), by: ctx.by || 'game', day: S.day || 1, point: ctx.point ? String(ctx.point).slice(0, 80) : undefined });
    if (first && !S.flags.hookTip) {
      S.flags.hookTip = 1; const G = this.G;
      // (after the moment that earned it has finished: no pops still in the air)
      const tip = (n) => setTimeout(() => {
        const calm = G.mode === 'play' && !G.busy && !G.ui.waiter && G.ui.panel.hidden && !G.phoneOpen && !(G.fx && G.fx.pops.length);
        if ((calm && n >= 2) || n > 30) G.ui.toast(`<span class="hkline"><i class="hk">${HOOK_SVG}</i><b>That little hook</b></span>It marks a reward built to keep you playing. Your phone's Fit Book has a Hook Log that says which pull each one is.${S.v2 && (S.day || 1) === 1 ? ' Tonight, the game shows you all of them.' : ''}`, 'idea', 7600);
        else tip(n + 1);
      }, 1600);
      tip(0);
    }
    return H.short;
  }
  count(id) { return ((this.S.hooks || {})[id]) || 0; }
  total() { return Object.values(this.S.hooks || {}).reduce((a, b) => a + b, 0); }
  // the phone's Hook Log: hooks you've met so far, and the ones still to come as blanks
  logHtml(notes) {
    const S = this.S; const seen = S.hooks || {};
    const rows = HOOK_ORDER.map((id) => {
      const H = HOOKS[id]; const n = seen[id] || 0;
      if (!n) return `<div class="hookrow locked"><i class="hk">${HOOK_SVG}</i><div><b>Not yet</b><span>A pull you haven't met yet.</span></div></div>`;
      const note = notes && notes.find((x) => x.id === H.note);
      return `<div class="hookrow"><i class="hk">${HOOK_SVG}</i><div><b>${esc(H.name)}</b> <span class="cnt">×${n}</span><span>${esc(H.what)}</span><span class="life">In real life: ${esc(H.life)}</span>${note ? `<span class="src">${esc(note.text)} <em>${esc(note.src)}</em></span>` : ''}</div></div>`;
    }).join('');
    return `<h3>Hook Log</h3><p class="small">Rewards with a little hook mark were built to keep you playing. Here's which pull each one is. Blend, the app in the story, uses the harder ones.</p><div class="hooklist">${rows}</div>`;
  }
}
