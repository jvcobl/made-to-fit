// Festival mail (the Works, ten years on): the same sorting as the first Monday, at your old desk, with Unit at the
// next one instead of Dot. How Unit does depends on what happened to the room this morning.
import { SortGame } from './sort.js';
import { loadImg } from './kit.js';
import { CAST } from '../content.js';

// what Unit does now, once, while you sort (from what you taught it)
const ONCE = { lamp: 'Once, it turned its screen down beside a lamp.', plant: 'Once, it stopped to water a plant.', board: 'Once, it read the plain notes aloud. Nobody had asked. Tomas said thank you anyway.' };

// Unit's face for the corner of the card: the Standard's shape in beige metal, with a screen
function unitIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#e3e8ec'; g.fillRect(0, 0, 96, 96);
  g.fillStyle = '#c9b8a6'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(48 + s * 12, 30); g.lineTo(48 + s * 26, 10); g.lineTo(48 + s * 30, 34); g.closePath(); g.fill(); }
  g.fillStyle = '#d6c6ad'; g.beginPath(); g.arc(48, 54, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16222b'; g.fillRect(28, 42, 40, 24); g.fillStyle = '#9ef2e4'; g.beginPath(); g.arc(40, 54, 4, 0, Math.PI * 2); g.arc(56, 54, 4, 0, Math.PI * 2); g.fill();
  return c.toDataURL('image/png');
}

export class FestivalMail extends SortGame {
  constructor(G, o = {}) {
    super(G, Object.assign({ id: 'mail', title: 'Festival mail', where: 'The Works · your old desk', how: 'Festival mail comes down the chute. Send each letter to the cubby with the <b>same symbol</b>: tap the cubby, or press <b>1 to 4</b>.' }, o));
    this.unitMode = o.unitMode || 'spec'; this.id = 'sort';
  }
  async prepare() {
    const G = this.G;
    const [unit, gil, tomas] = await Promise.all([loadImg(unitIcon()), loadImg(G.portraitOf({ shape: 'boxy', color: '#cbb9a2', pattern: 'plain', top: 'ears', wear: 'glasses' }, { bg: '#e3e8ec' })), loadImg(G.portraitOf(CAST.tomas.look, { bg: '#e3e8ec' }))]);
    this.dotImg = unit; this.mateName = 'Unit'; this.mateIdle = this.unitMode === 'idle';
    this.faces = [
      { name: 'Gil', img: gil, asks: ['Quick one! Got a sec?', 'Sorry! One more tiny thing?'], qs: ['Is the festival stamp in your drawer? No? Totally fine!', 'Has Unit said anything about my plants? No? Good.'], later: 'Oh! Yep! Later is great!', thanks: 'Great. Great, great.' },
      { name: 'Tomas', img: tomas, asks: ['Sack coming through. Got a sec?', 'Quick one, from the mail room?'], qs: ['This one says "the blue house". There are four blue houses. Which?', 'Is this a seven or a one? The festival makes people write fast.'], later: 'Sure. I\'ll leave it on the corner.', thanks: 'Cheers.' },
    ];
    this.dotPinch = 0;
    this.dotRate = this.unitMode === 'idle' ? 0 : this.unitMode === 'restored' ? 0.7 : this.unitMode === 'taught' ? 0.55 : 0.62;
  }
  results() {
    const r = super.results(); const n = Math.floor(this.dotN); const S = this.G.S;
    const q = (S.unitQuirks || [])[0];
    r.mate = this.unitMode === 'idle' ? 'Unit sorted nothing. It watched you work, politely, with its screen turned toward you.'
      : this.unitMode === 'restored' ? `Unit sorted <b>${n}</b>, perfectly. The room is the way the manual drew it.`
      : this.unitMode === 'taught' ? `Unit sorted <b>${n}</b>. ${ONCE[q] || 'It went round the lamps and plants like a surprise, every time.'}`
      : `Unit sorted <b>${n}</b>, humming at exactly the pitch of the ceiling panels.`;
    r.line = n && this.count ? 'Gil: "Festival mail, done by noon. Every year I say that like it\'s a surprise."' : r.line;
    return r;
  }
}
