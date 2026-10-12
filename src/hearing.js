// A hearing at Town Hall: persuasion as play. Each councillor raises one objection, with the kind of reason it is
// (tradition, business, fairness...). You answer with a card from what you've gathered: a mark (what pinches, and
// who), someone's own words (a story card, used only with their say-so), or an insight (research, with its source).
// The right card turns a vote: a YES stamp lands. A card that doesn't answer it is spent, and costs you some
// composure. You can ask "why?" once for free, and call one witness from the gallery. Two votes of three carry it.
// Losing is soft: the motion goes on file, and Clover tells you what was missing.
import { CAST, STAKES } from './content.js';
import { KINDS, markById } from './marks.js';
import { esc, sleep, FAST } from './util.js';

// cards you can hold: id -> { kind: 'story' | 'insight' | 'deal', who (story/deal), title, text, src (insight) }
export const CARDS = {
  bea_knock: { kind: 'story', who: 'bea', title: 'Bea, about her door', text: 'Fifty years on this row, and I still can\'t say "not today" without feeling rude.' },
  moss_kettle: { kind: 'story', who: 'moss', title: 'Moss, about noon', text: 'By twelve I can\'t hear my own kettle. And this is the only pitch with shade.' },
  pomeroy_loud: { kind: 'story', who: 'pomeroy', title: 'Pomeroy, about his apples', text: 'Half my sales are folk who hear me before they see me!' },
  bea_steps: { kind: 'story', who: 'bea', title: 'Bea, at the Works steps', text: 'My cart doesn\'t do steps. So I go round the back with the parcels, and the dock opens at ten.' },
  pip_cart: { kind: 'story', who: 'pip', title: 'Pip, about her mornings', text: 'I take the bread cart round by the loading dock every morning. Takes ages. Never mind!' },
  perceptible: { kind: 'insight', title: 'Say it more than one way', text: 'A design principle: information should reach people however they take it in. A light by a door says "come in" or "not now" without a word.', src: 'Center for Universal Design, 1997' },
  zoning: { kind: 'insight', title: 'Zones, not sameness', text: 'Quiet places beside lively ones, rather than one level for everybody. Design guidance for neurodivergent people recommends it; the evidence is mostly expert consensus so far.', src: 'BSI PAS 6463, 2022; Mostafa, 2014' },
  curb: { kind: 'insight', title: 'The curb-cut effect', text: 'Curb cuts won by wheelchair users turned out to help parents with strollers, travelers with suitcases and workers with carts. Changes made for some often help many more.', src: 'Blackwell, 2017' },
  average: { kind: 'insight', title: 'Nobody is average', text: 'In 1950 the US Air Force measured 4,063 flyers on ten body dimensions. Not one fell in the middle range on all ten.', src: 'Daniels, 1952' },
};

// the ramp at the Works. accept: cards (or 'witness:id') that answer each objection, with the line it gets
export const RAMP = {
  fix: 'ramp', title: 'A ramp at the Works', street: 'works',
  objections: [
    { who: 'hollis', kind: 'Tradition', t: 'Those steps have stood since 1891. In all that time, nobody has complained.', weak: 'nobody has complained',
      why: 'Well. Nobody has written in about them. Not one letter.', hint: 'Who could have got inside to write?',
      accept: ['wk_steps', 'bea_steps', 'witness:bea'],
      yes: 'Ah. Nobody complained because nobody on wheels could get in to. I take the point.',
      wrong: 'I don\'t quite see what that has to do with the steps.' },
    { who: 'pip', kind: 'Money', t: 'A whole ramp, for Bea? That\'s a lot of the Works budget for one person!', weak: 'for one person',
      why: 'Money spent at the Works can\'t be spent twice. It should help the most people it can.', hint: 'Who else comes and goes on wheels?',
      accept: ['wk_dock', 'pip_cart', 'curb', 'witness:moss'],
      yes: 'Oh! The bread cart. I go round by the dock every single morning. That\'s me as well, isn\'t it?',
      wrong: 'Sorry, I don\'t see how that helps anyone else.' },
    { who: 'clover', kind: 'Fairness', t: 'Every fix costs somebody something. Who did you ask about what this one costs?', weak: 'what this one costs',
      why: 'The ramp goes right where Gil\'s tomato planters stand. Nine years, those tomatoes.', hint: 'Did anyone ask Gil?',
      accept: ['deal_ramp', 'witness:gil'],
      yes: 'Good. You asked the person it costs, and the plan got better for it. That\'s the whole job.',
      wrong: 'That\'s who it helps. I asked who it costs.' },
  ],
  witnesses: {
    bea: 'My cart doesn\'t do steps, Hollis. I go round with the parcels and wait for the dock. Nobody asked me to write in.',
    moss: 'I\'d use it with the tea urn. So would every pram on Home Row.',
    gil: 'Oh! Me? Could it run along the rail, with my tomatoes beside it? A bit narrower. Still fits a cart. I measured. Twice.',
    pip: 'I\'d use it with the bread cart, every morning.',
  },
  missing: { hollis: 'what the steps do to people who can\'t use them', pip: 'who else it helps', clover: 'who it costs, and what they said' },
};

// the bus board, at Tuesday's town meeting
export const BOARD = {
  fix: 'board', title: 'A bus board that shows changes', street: 'transit',
  objections: [
    { who: 'hollis', kind: 'Tradition', t: 'Route changes have been announced over the speaker since the buses began. People manage.', weak: 'People manage',
      why: 'Well. One hears it, or one asks somebody who did.', hint: 'Who misses a thing that\'s only said once?',
      accept: ['tr_speaker', 'tr_bus', 'witness:bea'], yes: 'Said once, over a crackle, while the bus pulls in. Put like that, "manage" is generous.', wrong: 'I\'m not sure that\'s about the buses.' },
    { who: 'pip', kind: 'Money', t: 'A screen at the bus stop costs the same as all the festival bunting! Is it worth that?', weak: 'Is it worth that',
      why: 'Only a few people miss the announcements, surely.', hint: 'Who else is helped when it\'s written down as well as said?',
      accept: ['perceptible', 'curb', 'witness:rue'], yes: 'Visitors, anyone with headphones in, anyone who was talking when it crackled. That\'s loads of people!', wrong: 'Hmm. That doesn\'t tell me who it helps.' },
    { who: 'clover', kind: 'Fairness', t: 'It comes out of the bunting budget. Who did you ask about that?', weak: 'Who did you ask',
      why: 'Hollis chairs the bunting committee. He does love the bunting.', hint: 'Did anyone ask Hollis what would make it work?',
      accept: ['deal_board'], yes: 'Bus changes first, festival news second, and the committee can call it theirs. Good. You asked.', wrong: 'That\'s who it helps. I asked who it costs.' },
  ],
  witnesses: {
    bea: 'I was on the wrong bus twice last month, Hollis. The speaker said Elm Street. I heard "helm treat".',
    rue: 'Half the people at that stop have headphones in. I do. The board would tell us.',
    moss: 'I miss it every time the kettle\'s on.',
    gil: 'Ooh. I never catch the announcements. I just get on whatever comes.',
  },
  missing: { hollis: 'what it\'s like to miss an announcement', pip: 'who else it helps', clover: 'who it costs, and what they said' },
};
export const HEARINGS = { ramp: RAMP, board: BOARD };
// a deal: what the person a fix costs said would make it work (you listened, and the design changed)
export function dealCard(f) { const T = STAKES[f]; if (!T || !T.listened) return null; return { id: 'deal_' + f, kind: 'deal', who: T.who, title: CAST[T.who].name + ': ' + T.change, text: T.listened.t }; }

export class Hearing {
  constructor(G, def, o = {}) { this.G = G; this.D = def; this.o = o; this.votes = []; this.spent = {}; this.composure = 3; this.whyFree = 1; this.witnessLeft = 1; this.consent = {}; }
  get S() { return this.G.S; }
  // the cards in your hand: people's words, deals and insights you hold, and the marks you tagged in this street first
  hand() {
    const S = this.S; const out = [];
    for (const id of Object.keys(S.cards || {})) { const c = CARDS[id]; if (c) out.push(Object.assign({ id }, c)); }
    // (a deal belongs to its own fix: only this hearing's is in your hand)
    { const f = this.D.fix; if ((S.stakes || {})[f] === 'listened') { const d = dealCard(f); if (d) out.push(d); } }
    const marks = Object.keys(S.marks || {}).map(markById).filter((m) => m && !m.fit && m.street === this.D.street);
    for (const m of marks) out.push({ id: m.id, kind: 'mark', mark: m, title: m.name, text: m.line, who: m.who });
    const order = { mark: 0, story: 1, deal: 2, insight: 3 };
    return out.sort((a, b) => order[a.kind] - order[b.kind]);
  }
  gallery() { return Object.keys(this.D.witnesses).filter((id) => this.o.gallery ? this.o.gallery.includes(id) : true); }
  // resolves with { passed, yes: n, missing: [councillor ids whose objection went unanswered], consentSkipped }
  run() {
    const G = this.G; const ui = G.ui;
    const el = document.createElement('div'); el.id = 'hearing'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Hearing: ' + this.D.title);
    ui.root.appendChild(el); this.el = el;
    const face = (id) => G.ui.face(id, this.S);
    el.innerHTML = `<div class="hbench">${this.D.objections.map((o, i) => `<div class="hseat" data-i="${i}"><img alt="" src="${face(o.who)}"><b>${esc(CAST[o.who].name)}</b><span class="hkind">${esc(o.kind)}</span><span class="hvote"></span></div>`).join('')}</div>
      <div class="hstage"><div class="htitle">Hearing · ${esc(this.D.title)}</div><div class="hobj"></div><div class="hsay"></div>
      <div class="hbtns"><button class="btn" id="hWhy">Ask why <small>free once</small></button><button class="btn" id="hWit">Call a witness <small>once</small></button><span class="hcomp" aria-label="Composure"></span></div></div>
      <div class="htabs" role="tablist"></div><div class="hhand" role="group" aria-label="Your cards"></div>`;
    this.renderComp();
    return new Promise((resolve) => { this.done = resolve; this.next(0); });
  }
  renderComp() { const c = this.el.querySelector('.hcomp'); c.innerHTML = 'Composure ' + '<i class="on"></i>'.repeat(this.composure) + '<i></i>'.repeat(3 - this.composure); c.setAttribute('aria-label', 'Composure ' + this.composure + ' of 3'); }
  // (the screen-reader feed gets plain words: tags out, and entities like &quot; read as the characters they stand for)
  setSay(html, who) { const s = this.el.querySelector('.hsay'); s.innerHTML = (who ? `<b>${esc(who)}:</b> ` : '') + html; const d = document.createElement('div'); d.innerHTML = html; this.G.ui.announce((who ? who + ': ' : '') + d.textContent); }
  async next(i) {
    this.i = i; const G = this.G;
    if (i >= this.D.objections.length || this.composure <= 0) return this.finish();
    const o = this.D.objections[i];
    this.el.querySelectorAll('.hseat').forEach((s, k) => s.classList.toggle('on', k === i));
    const t = esc(o.t).replace(esc(o.weak), `<mark>${esc(o.weak)}</mark>`);
    const ob = this.el.querySelector('.hobj');
    ob.innerHTML = `<div class="hbanner">${esc(o.kind)}!</div><img alt="" src="${G.ui.face(o.who, this.S)}"><p><b>${esc(CAST[o.who].name)}</b>${t}</p>`;
    ob.classList.remove('in'); void ob.offsetWidth; ob.classList.add('in');
    G.audio.sfx('objection'); G.audio.voice(CAST[o.who].voice[0], CAST[o.who].voice[1], o.t);
    if (G.npcs[o.who]) G.faceTalk(o.who);
    this.setSay('Answer with a card that meets <mark>' + esc(o.weak) + '</mark>.');
    this.renderHand();
    this.el.querySelector('#hWhy').onclick = () => this.askWhy();
    this.el.querySelector('#hWit').onclick = () => this.witness();
    this.el.querySelector('#hWit').disabled = this.witnessLeft <= 0;
    this.el.querySelector('#hWhy').querySelector('small').textContent = this.whyFree > 0 ? 'free once' : 'costs composure';
    if (!G.ui.touch) setTimeout(() => { const b = this.el.querySelector('.hcard:not(.spent)'); if (b) b.focus(); }, 60);
  }
  renderHand() {
    const box = this.el.querySelector('.hhand'); const all = this.hand();
    const KIND = [['mark', 'Marks'], ['story', 'Their words'], ['deal', 'Agreed'], ['insight', 'Insights']].filter(([k]) => all.some((c) => c.kind === k));
    if (!this.tab || !KIND.some(([k]) => k === this.tab)) this.tab = KIND.length ? KIND[0][0] : 'mark';
    const tabs = this.el.querySelector('.htabs');
    tabs.innerHTML = KIND.map(([k, n]) => `<button class="chip ${k === this.tab ? 'on' : ''}" role="tab" aria-selected="${k === this.tab}" data-k="${k}">${n} <span>${all.filter((c) => c.kind === k && !this.spent[c.id]).length}</span></button>`).join('');
    tabs.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.k; this.G.audio.sfx('select'); this.renderHand(); }; });
    const cards = all.filter((c) => c.kind === this.tab);
    box.innerHTML = cards.map((c) => {
      const spent = this.spent[c.id]; const K = c.kind === 'mark' ? KINDS[c.mark.kind] : null;
      const icon = c.kind === 'mark' ? `<span class="hci" style="--mk:${K[1]}">${K[0]}</span>` : c.kind === 'insight' ? '<span class="hci ins">✦</span>' : `<img class="hcf" alt="" src="${this.G.ui.face(c.who, this.S)}">`;
      const tag = c.kind === 'mark' ? 'Mark' : c.kind === 'insight' ? 'Insight' : c.kind === 'deal' ? 'Agreed' : 'Their words';
      return `<button class="hcard ${c.kind} ${spent ? 'spent' : ''}" data-id="${c.id}" ${spent ? 'aria-disabled="true"' : ''}>${icon}<span class="htag">${tag}</span><b>${esc(c.title)}</b><span class="htx">${esc(c.text)}</span>${c.src ? `<span class="hsrc">${esc(c.src)}</span>` : ''}</button>`;
    }).join('') || '<p class="hempty">No cards yet. Tag marks with the lantern, and listen to people.</p>';
    // (on a touch screen the first tap opens a card to read it whole, and a second tap presents it: a wrong card costs
    // composure, so nobody should have to play one they couldn't read)
    box.querySelectorAll('.hcard').forEach((b) => { b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') { this.G.ui.nudge(b, 'Already used.'); return; }
      if (this.G.ui.touch && !b.classList.contains('sel')) { box.querySelectorAll('.hcard.sel').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); this.G.audio.sfx('select'); this.G.ui.announce(b.textContent + '. Tap again to present it.'); return; }
      this.present(b.dataset.id);
    }; });
  }
  async askWhy() {
    if (this.busy || this.over) return;
    const o = this.D.objections[this.i]; const G = this.G;
    if (this.whyAsked === this.i) { this.setSay(esc(o.why) + ' <em>' + esc(o.hint) + '</em>', CAST[o.who].name); return; }
    if (this.whyFree > 0) this.whyFree--; else { this.composure--; this.renderComp(); if (this.composure <= 0) return this.finish(); }
    this.whyAsked = this.i; G.audio.sfx('page');
    this.setSay(esc(o.why) + ' <em class="hgut">' + esc(o.hint) + '</em>', CAST[o.who].name);
    this.el.querySelector('#hWhy').querySelector('small').textContent = this.whyFree > 0 ? 'free once' : 'costs composure';
  }
  // a witness from the gallery: one, once
  async witness() {
    if (this.witnessLeft <= 0 || this.busy) return; const G = this.G;
    const ids = this.gallery(); const box = this.el.querySelector('.hsay');
    box.innerHTML = '<span>Who do you call?</span> ' + ids.map((id) => `<button class="chip hwit" data-id="${id}"><img alt="" src="${G.ui.face(id, this.S)}">${esc(CAST[id].name)}</button>`).join('') + '<button class="chip hwit" data-id="">Never mind</button>';
    box.querySelectorAll('.hwit').forEach((b) => { b.onclick = () => { const id = b.dataset.id; if (!id) { this.setSay('Answer with a card, or ask why.'); return; } this.witnessLeft = 0; this.el.querySelector('#hWit').disabled = true; this.resolve('witness:' + id, id); }; });
  }
  async present(id) {
    if (this.busy) return; const c = CARDS[id];
    // someone's own words: ask them first (they're in the gallery)
    if (c && c.kind === 'story' && this.consent[c.who] == null) {
      const G = this.G; const box = this.el.querySelector('.hsay');
      box.innerHTML = `<span>These are ${esc(CAST[c.who].name)}'s words.</span> <button class="chip" id="hAsk">Ask ${esc(CAST[c.who].name)} first</button><button class="chip" id="hJust">Just use them</button>`;
      await new Promise((r) => { box.querySelector('#hAsk').onclick = () => { this.consent[c.who] = 'asked'; G.audio.sfx('select'); r(); }; box.querySelector('#hJust').onclick = () => { this.consent[c.who] = 'skipped'; r(); }; });
      if (this.consent[c.who] === 'asked') { this.setSay('Go on. Tell them.', CAST[c.who].name); if (G.npcs[c.who]) G.setFace(c.who, 'happy'); await sleep(FAST ? 20 : 900); }
      else { this.setSay('<em class="hgut">It was theirs to tell.</em>'); if (G.npcs[c.who]) G.setFace(c.who, 'sad'); this.consentSkipped = true; await sleep(FAST ? 20 : 900); }
    }
    this.resolve(id);
  }
  async resolve(id, witness) {
    const G = this.G, o = this.D.objections[this.i]; this.busy = true;
    const ok = o.accept.includes(id);
    if (witness) { this.setSay(esc(this.D.witnesses[witness] || '…'), CAST[witness].name); G.audio.voice(CAST[witness].voice[0], CAST[witness].voice[1], this.D.witnesses[witness] || ''); await sleep(FAST ? 20 : 1700); }
    else this.spent[id] = 1;
    const seat = this.el.querySelectorAll('.hseat')[this.i];
    if (ok) {
      this.votes[this.i] = 'yes';
      this.setSay(esc(o.yes), CAST[o.who].name); G.audio.voice(CAST[o.who].voice[0], CAST[o.who].voice[1], o.yes);
      seat.querySelector('.hvote').innerHTML = '<span class="stamp">YES</span>'; seat.classList.add('yes'); G.audio.sfx('stamp'); setTimeout(() => G.audio.sfx('yes'), 120);
      if (G.npcs[o.who]) G.setFace(o.who, 'happy');
      await sleep(FAST ? 30 : 2300);
      this.busy = false; this.next(this.i + 1); return;
    }
    this.composure--; this.renderComp(); G.audio.sfx('miss');
    const ob = this.el.querySelector('.hobj'); ob.classList.remove('shake'); void ob.offsetWidth; ob.classList.add('shake');
    this.setSay(esc(o.wrong) + (this.composure > 0 ? ' <em class="hgut">' + esc(o.hint) + '</em>' : ''), CAST[o.who].name);
    this.renderHand();
    await sleep(FAST ? 30 : 600);
    // out of cards that could answer it: the vote goes against, and the hearing moves on
    const left = this.hand().some((c) => !this.spent[c.id] && o.accept.includes(c.id)) || (this.witnessLeft > 0 && o.accept.some((a) => a.startsWith('witness:') && this.gallery().includes(a.slice(8))));
    if (this.composure <= 0 || !left) {
      this.votes[this.i] = 'no'; seat.querySelector('.hvote').innerHTML = '<span class="stamp no">NO</span>'; seat.classList.add('no'); G.audio.sfx('stamp');
      await sleep(FAST ? 30 : 1600); this.busy = false; this.next(this.i + 1); return;
    }
    this.busy = false;
  }
  async finish() {
    if (this.over) return; this.over = true;
    const G = this.G; const yes = this.votes.filter((v) => v === 'yes').length; const passed = yes >= 2;
    const missing = this.D.objections.map((o, i) => (this.votes[i] === 'yes' ? null : o.who)).filter(Boolean);
    this.el.querySelector('.hhand').innerHTML = ''; this.el.querySelector('.hbtns').hidden = true;
    const ob = this.el.querySelector('.hobj'); ob.innerHTML = `<div class="hresult ${passed ? 'pass' : 'fail'}">${passed ? 'Carried' : 'On file'}<small>${yes} of ${this.D.objections.length} votes</small></div>`;
    G.audio.sfx('gavel'); if (passed) setTimeout(() => G.audio.sfx('cheer'), 200);
    this.setSay(passed ? 'The motion carries. Hollis brings the gavel down.' : 'Not this time. The motion goes on file.');
    await sleep(FAST ? 40 : 2200);
    this.el.remove();
    this.done({ passed, yes, missing, consentSkipped: !!this.consentSkipped });
  }
  // tests: answer every objection with the right card if you hold it
  auto() { const o = this.D.objections[this.i]; if (!o || this.busy) return false; const c = this.hand().find((x) => !this.spent[x.id] && o.accept.includes(x.id)); if (c) { this.consent[c.who] = 'asked'; this.resolve(c.id); return true; } if (this.witnessLeft > 0) { const w = o.accept.find((a) => a.startsWith('witness:') && this.gallery().includes(a.slice(8))); if (w) { this.witnessLeft = 0; this.resolve(w, w.slice(8)); return true; } } const any = this.hand().find((x) => !this.spent[x.id]); if (any) { this.resolve(any.id); return true; } return false; }
}
