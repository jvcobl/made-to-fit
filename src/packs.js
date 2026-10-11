// Moss's shelf: sealed packs of pond cards, and a binder of singles beside them. Every fish is equally likely in a
// pack, and every card, the golden one too, is in the binder at a fixed price. Cards count toward nothing: not the jar,
// not the endings, not "things left to find". Opening a pack shows all three cards at once, with no reveal, no sound
// and no sparkle; buying several at once gives a sentence, never a loop of taps.
import { FISH } from './games/pond.js';
import { R, esc, shadeHex } from './util.js';

export const PACK_PRICE = 5, SINGLE_PRICE = 3, PACK_SIZE = 3, MORE_MAX = 4;
export const cardName = (f) => f.card || f.name;
const NUM = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function drawPack(rand = R) { const out = []; for (let i = 0; i < PACK_SIZE; i++) out.push(FISH[Math.floor(rand() * FISH.length) % FISH.length]); return out; }
// add cards one at a time; returns how many of them you already had
export function addCards(S, cards) {
  S.cards = S.cards || {}; let had = 0;
  for (const f of cards) { if (S.cards[f.id]) had++; S.cards[f.id] = (S.cards[f.id] || 0) + 1; }
  return had;
}
export function packLine(had) { return 'Three cards. ' + (had === 0 ? 'None you already had.' : had >= PACK_SIZE ? 'All three you already had.' : cap(NUM[had]) + ' you already had.'); }
// Settings, Summarize: the same pack, in one line
export function packSentence(cards, had) {
  const names = cards.map((f) => cardName(f).toLowerCase());
  return 'You open a pack: ' + names.join(', ') + '. ' + (had === 0 ? 'None you already had.' : had >= PACK_SIZE ? 'All three you already had.' : cap(NUM[had]) + ' you already had.');
}
// several at once: what came out, in a sentence
export function moreSentence(n, cards, had) {
  const by = {}; for (const f of cards) by[f.id] = (by[f.id] || 0) + 1;
  const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0]; const f = FISH.find((x) => x.id === top);
  const most = by[top] >= 2 && Object.values(by).filter((v) => v === by[top]).length === 1 ? 'mostly ' + f.pl : 'a bit of everything';
  return 'You opened ' + NUM[n] + ' more. ' + cap(NUM[cards.length]) + ' cards, ' + most + '; ' + NUM[had] + ' you already had. Opening them felt about the same as opening one.';
}

// a card: the fish drawn plainly on top, its name underneath. No foil, no rarity mark. Gil's two cards are the only
// ones with anything printed on: a gold fin (on a minnow), and a shine that holds still.
export function cardTile(f, o = {}) {
  const body = shadeHex(f.col, -0.25), fin = o.goldfin ? '#f2a24a' : shadeHex(f.col, -0.35);
  const svg = `<svg class="fishsvg" viewBox="0 0 64 32" aria-hidden="true"><path d="M30 8 Q36 1 42 9 Z" fill="${fin}"/><path d="M8 16 C18 4 38 4 46 16 C38 28 18 28 8 16 Z" fill="${body}"/><path d="M44 16 L57 7 L57 25 Z" fill="${body}"/><circle cx="16" cy="14" r="2" fill="#2b2530"/></svg>`;
  return `<span class="pcardtile${o.shiny ? ' shiny' : ''}" style="--c:${f.col}">${svg}<b>${esc(o.name || cardName(f))}</b></span>`;
}
