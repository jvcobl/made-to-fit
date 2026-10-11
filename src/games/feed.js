// Blend's feed: the pull, made playable. It never ends, prizes come at random, time slips while you swipe,
// and every swipe makes you a little more like the statue. Lantern shows wanting going up while enjoying goes down.
// "Put it down" is always one tap away, and putting it down is the thing the game celebrates.
import { esc, clamp, pick, FAST, fmtTime } from '../util.js';
import { CAST } from '../content.js';

const CARDS = [
  { k: 'calm', e: '✨', t: '+3 Calm', s: 'Nice! Keep going.' },
  { k: 'rank', e: '📈', t: 'You are calmer than {p}% of Larkspur', s: 'For now.' },
  { k: 'rival', e: '🔥', t: 'Rue just hit {rueN} days!', s: 'Can you catch up?' },
  { k: 'nudge', e: '🙂', t: 'Smile more at the market', s: 'People trust a smile. Blend can remind you.' },
  { k: 'creepy', e: '👀', t: 'Your face did something unusual at {time}', s: 'Want help with that?' },
  { k: 'ad', e: '🥐', t: 'Pip\'s Bakery: two scones for one', s: 'Sponsored' },
  { k: 'like', e: '💗', t: 'People like you also liked:', s: 'being more like everyone else.' },
  { k: 'streak', e: '🔥', t: 'Your streak is counting on you', s: 'Do not let it down.' },
  { k: 'quiz', e: '🧩', t: 'Which Larkspur resident are you?', s: 'Spoiler: the Standard one!' },
  { k: 'calm2', e: '🌊', t: '+2 Calm', s: 'Smooth.' },
  { k: 'roll', e: '🎢', t: 'You are on a roll!', s: 'Do not stop now.' },
  { k: 'box', e: '🎁', t: 'Mystery box', s: 'Tap to open. Could be anything!' },
];
const PRIZES = [['🏅', 'RARE BADGE: Golden Smooth', 25], ['💎', '+20 Calm, a big one', 20], ['🎟️', 'Double Calm for one hour', 12], ['👑', 'Top 1% for a moment', 15]];
const LANTERN = ['', '', '', 'Lantern: you are reaching for the next one before this one has landed.', 'Lantern: wanting is up. Enjoying is down. They are not the same thing.', 'Lantern: it stopped being fun a few swipes ago. That is how these are built.', 'Lantern: the clock moved. You did not notice. That is also how these are built.'];

export class Feed {
  constructor(G) { this.G = G; this.n = 0; this.want = 0.2; this.like = 0.8; this.odds = false; this.card = null; this.sinceLook = 0; }
  get S() { return this.G.S; }
  // the next card: one in six is a prize, and you never know which
  next() {
    const S = this.S; this.n++;
    const prize = Math.random() < 1 / 6 && this.n > 1;
    if (prize) { const [e, t, v] = pick(PRIZES); return { prize: true, e, t, s: 'You won! Tap for more.', v }; }
    const c = Object.assign({}, CARDS[(this.n * 7 + Math.floor(Math.random() * 5)) % CARDS.length]);
    // a time from earlier today, never one that has not happened yet
    const past = Math.max(360, Math.floor(420 + Math.random() * Math.max(10, S.min - 435)));
    c.t = c.t.replace('{p}', String(55 + Math.floor(Math.random() * 40))).replace('{time}', fmtTime(past)).replace('{rueN}', String(411 + (S.day || 1)));
    return c;
  }
  swipe() {
    const G = this.G, S = this.S, B = S.blend; if (!B.has || B.deleted) return;
    if (!this.card) this.card = this.next();
    // the current card pays out, then the next arrives
    const c = this.card; const gain = c.prize ? c.v : 1 + Math.floor(Math.random() * 3);
    B.score += gain; B.usedToday = true; B.swipes = (B.swipes || 0) + 1;
    S.self = clamp(S.self - 0.45, 0, 100); // every swipe, a little more like the statue
    G.advance(2); // time slips while you scroll
    this.want = clamp(this.want + 0.09); this.like = clamp(this.like - 0.075, 0.08, 1);
    if (c.prize) { G.audio.sfx('prize'); this.like = clamp(this.like + 0.05); G.story.fieldNote('variable'); } else G.audio.sfx('swipe');
    this.card = this.next(); this.sinceLook++;
    if (this.sinceLook >= 9) G.story.fieldNote('wanting');
    if (B.swipes >= 25) G.badge && G.badge('streak');
    if (B.score >= 150) G.badge && G.badge('top');
    this.render(true);
  }
  putDown() {
    const G = this.G; this.sinceLook = 0; this.want = Math.max(0.2, this.want - 0.4); this.like = Math.min(0.8, this.like + 0.3);
    if (G.phoneOpen) G.togglePhone();
    G.ui.toast('Everything is still here. So are the birds.', 'good', 4200); G.audio.sfx('good');
    if ((this.S.blend.swipes || 0) >= 3) G.story.keep('putdown', 'You put the phone down', '#9edcd6');
  }
  mount(el) { this.el = el; if (!el) return; if (!this.card) this.card = this.next(); this.render(false); }
  render(anim) {
    const el = this.el; if (!el || !el.isConnected) return; const S = this.S; const c = this.card;
    const lan = Math.min(LANTERN.length - 1, Math.max(0, this.sinceLook));
    const showMeters = this.sinceLook >= 3;
    el.innerHTML = `<div class="feed">
      <div class="fcard ${c.prize ? 'prize' : ''} ${anim ? 'in' : ''}" role="button" tabindex="0" aria-label="Next card"><div class="fe">${c.e}</div><div class="ft">${esc(c.t)}</div><div class="fs">${esc(c.s)}</div><div class="fnext">Swipe up or tap ↑</div></div>
      ${showMeters ? `<div class="meters"><div><span>Wanting</span><i style="--v:${Math.round(this.want * 100)}%" class="w"></i></div><div><span>Enjoying</span><i style="--v:${Math.round(this.like * 100)}%" class="l"></i></div></div><div class="flan">${esc(LANTERN[lan])}</div>` : ''}
      ${this.sinceLook >= 5 ? '<button class="btn putdown">Put it down</button>' : ''}
      <button class="oddsbtn">${this.odds ? 'Hide how prizes work' : 'How prizes work'}</button>${this.odds ? '<div class="odds">Every swipe has a <b>1 in 6</b> chance of a prize. It is random on purpose: not knowing when the next one comes is what keeps thumbs moving. Slot machines pay out the same way.</div>' : ''}
    </div>`;
    const card = el.querySelector('.fcard'); let y0 = null;
    card.onpointerdown = (e) => { y0 = e.clientY; card.setPointerCapture && card.setPointerCapture(e.pointerId); };
    card.onpointerup = (e) => { const dy = y0 == null ? 0 : y0 - e.clientY; y0 = null; if (dy > 30 || Math.abs(dy) < 8) this.swipe(); };
    card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); this.swipe(); } };
    const pd = el.querySelector('.putdown'); if (pd) pd.onclick = () => this.putDown();
    el.querySelector('.oddsbtn').onclick = () => { this.odds = !this.odds; if (this.odds) this.G.story.fieldNote('variable'); this.render(false); };
    // the phone header numbers move too
    const ph = this.G.ui.phoneEl; const sc = ph.querySelector('.blendapp .score'); if (sc) sc.textContent = S.blend.score;
    const st = ph.querySelector('.st-time'); if (st) this.G.ui.refreshPhone();
  }
}
