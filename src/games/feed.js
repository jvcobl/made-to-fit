// Blend's feed: the pull, shown on your creature rather than worked on you. Every card pays the same small number of
// points, printed on the card before you swipe. Prizes still turn up at random, because that is how feeds are built,
// but they go to your creature (a badge, a moment of rank), never to you: no prize sounds, no sparkle, no "You won".
// "Put it down" is there from the first card, and the session ends by itself after twelve.
import { esc, clamp, pick, fmtTime } from '../util.js';

export const POINTS_PER_CARD = 2;
const SESSION_CARDS = 12;
const CARDS = [
  { k: 'rank', e: '📈', t: 'You are calmer than {p} in 100 people in Larkspur', s: 'For now.' },
  { k: 'rival', e: '🔥', t: 'Rue just hit {rueN} days!', s: 'Can you catch up?' },
  { k: 'nudge', e: '🙂', t: 'Smile more at the market', s: 'People trust a smile. Blend can remind you.' },
  { k: 'creepy', e: '👀', t: 'Your face did something unusual at {time}', s: 'Want help with that?' },
  { k: 'ad', e: '🥐', t: 'Pip\'s Bakery: two scones for one', s: 'Sponsored' },
  { k: 'like', e: '💗', t: 'People like you also liked:', s: 'being more like everyone else.' },
  { k: 'streak', e: '🔥', t: 'Your streak is counting on you', s: 'Do not let it down.' },
  { k: 'quiz', e: '❓', t: 'Which Larkspur resident are you?', s: 'Spoiler: the Standard one.' },
  { k: 'roll', e: '🌀', t: 'You are on a roll!', s: 'Do not stop now.' },
  { k: 'box', e: '📦', t: 'Mystery box', s: 'It is always +2 points. Same as everything here.' },
];
// what the random prizes give your creature: a badge or a moment of rank, never extra points
const PRIZES = [['Badge for your creature: Golden Smooth', 'Your creature perks up. You get the same +2.'], ['Your creature is in the top few for a moment', 'It will not last. It is not meant to.'], ['A new frame for your creature\'s photo', 'It looks very shiny. Nothing else changes.']];
const LANTERN = ['', '', 'Lantern: it is reaching for the next one before this one has landed.', 'Lantern: wanting is up. Enjoying is not. They are not the same thing.', 'Lantern: it stopped being fun a few cards ago. Feeds are built that way.', 'Lantern: the clock moved, and it did not notice. That is also how feeds are built.'];

export class Feed {
  constructor(G) { this.G = G; this.n = 0; this.want = 0.2; this.like = 0.75; this.odds = false; this.card = null; this.session = 0; this.counted = false; this.ended = false; }
  get S() { return this.G.S; }
  // the next card: about one in six is a prize for your creature, and there is no telling which
  next() {
    const S = this.S; this.n++;
    if (this.n > 1 && Math.random() < 1 / 6) { const [t, s] = pick(PRIZES); return { prize: true, e: '◆', t, s }; }
    const c = Object.assign({}, CARDS[(this.n * 7 + Math.floor(Math.random() * 5)) % CARDS.length]);
    // a time from earlier today, never one that has not happened yet
    const past = Math.max(360, Math.floor(420 + Math.random() * Math.max(10, S.min - 435)));
    c.t = c.t.replace('{p}', String(55 + Math.floor(Math.random() * 40))).replace('{time}', fmtTime(past)).replace('{rueN}', String(411 + (S.day || 1)));
    return c;
  }
  swipe() {
    const G = this.G, S = this.S, B = S.blend; if (!B.has || B.deleted || this.ended) return;
    if (!this.card) this.card = this.next();
    const c = this.card;
    B.score += POINTS_PER_CARD; B.usedToday = true; B.swipes = (B.swipes || 0) + 1; this.session++;
    S.self = clamp(S.self - 0.45, 0, 100); // every card, a little more like the statue (your creature's colour)
    G.advance(2); // time slips while it scrolls
    // wanting climbs, and jumps on a prize; enjoying drifts down
    this.want = clamp(this.want + (c.prize ? 0.2 : 0.08)); this.like = clamp(this.like - 0.07, 0.08, 1);
    if (c.prize) { G.player.hop && G.player.hop(); G.story.fieldNote('variable'); }
    if (this.session >= 5 && !this.counted) { this.counted = true; B.dep = clamp((B.dep || 0) + 1, 0, 9); }
    if (this.session >= 8) G.story.fieldNote('wanting');
    if (B.swipes >= 25) G.badge && G.badge('streak');
    if (B.score >= 150) G.badge && G.badge('top');
    if (this.session >= SESSION_CARDS) { this.ended = true; this.render(false); return; }
    this.card = this.next();
    this.render(true);
  }
  putDown(auto) {
    const G = this.G;
    const was = this.session; this.session = 0; this.counted = false; this.ended = false; this.want = Math.max(0.2, this.want - 0.4); this.like = Math.min(0.75, this.like + 0.3);
    if (G.phoneOpen) G.togglePhone();
    G.ui.toast(auto ? 'Your phone is at 1%. You put it down. Everything is still here.' : 'Everything is still here. So are the birds.', 'good', 4200);
    if (was >= 3) G.story.keep('putdown', 'You put the phone down', '#9edcd6');
  }
  mount(el) { this.el = el; if (!el) return; if (!this.card) this.card = this.next(); this.render(false); }
  render(anim) {
    const el = this.el; if (!el || !el.isConnected) return; const S = this.S; const c = this.card;
    const lanOn = this.G.settings.lanternVoice !== false;
    const lan = lanOn ? LANTERN[Math.min(LANTERN.length - 1, this.session)] : '';
    const card = this.ended
      ? `<div class="fcard end"><div class="fe">🔋</div><div class="ft">Your phone is at 1%.</div><div class="fs">That is twelve cards. The feed would have kept going.</div></div>`
      : `<div class="fcard ${c.prize ? 'prize' : ''} ${anim ? 'in' : ''}" role="button" tabindex="0" aria-label="Next card: ${esc(c.t)}. Plus ${POINTS_PER_CARD} points"><div class="fe" aria-hidden="true">${c.e}</div><div class="ft">${esc(c.t)}</div><div class="fs">${esc(c.s)}</div><div class="fpts">+${POINTS_PER_CARD} points</div><div class="fnext">Swipe up or tap ↑</div></div>`;
    el.innerHTML = `<div class="feed">${card}
      <div class="meters" aria-label="Your creature: wanting ${Math.round(this.want * 10)} of 10, enjoying ${Math.round(this.like * 10)} of 10"><div class="mh">Your creature</div><div><span>Wanting</span><i style="--v:${Math.round(this.want * 100)}%" class="w"></i></div><div><span>Enjoying</span><i style="--v:${Math.round(this.like * 100)}%" class="l"></i></div></div>${lan ? `<div class="flan">${esc(lan)}</div>` : ''}
      <button class="btn putdown">Put it down</button>
      <button class="oddsbtn">${this.odds ? 'Hide how prizes work' : 'How prizes work'}</button>${this.odds ? '<div class="odds">Prizes come at random on purpose, because not knowing when keeps a thumb moving. Here they only go to your creature. Points are the same on every card.</div>' : ''}
    </div>`;
    const cd = el.querySelector('.fcard[role=button]');
    if (cd) {
      let y0 = null;
      cd.onpointerdown = (e) => { y0 = e.clientY; cd.setPointerCapture && cd.setPointerCapture(e.pointerId); };
      cd.onpointerup = (e) => { const dy = y0 == null ? 0 : y0 - e.clientY; y0 = null; if (dy > 30 || Math.abs(dy) < 8) this.swipe(); };
      cd.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); this.swipe(); } };
    }
    el.querySelector('.putdown').onclick = () => this.putDown(this.ended);
    el.querySelector('.oddsbtn').onclick = () => { this.odds = !this.odds; if (this.odds) this.G.story.fieldNote('variable'); this.render(false); };
    // the phone header numbers move too
    const ph = this.G.ui.phoneEl; const sc = ph.querySelector('.blendapp .score'); if (sc) sc.textContent = S.blend.score;
  }
}
