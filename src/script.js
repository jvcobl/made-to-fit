// The script grammar: conditions and effects used by the scenes in content.js. Pure (no imports), so the game
// (story.js) and the content checker (test/check_content.mjs) parse exactly the same way.
// A condition string is ANDs of ORs: "flag.a & bond.gil>=1|met.pip". A term may start with ! to negate it.

const OP = '(<=|>=|<|>|=|!=)';
export const COND_TERMS = [
  ['blend', /^blend$/], ['smooth', /^smooth$/], ['wheels', /^wheels$/], ['late', /^late$/], ['plain', /^plain$/],
  ['flag', /^flag\.(\w+)$/], ['met', /^met\.(\w+)$/], ['sens', /^sens\.(\w+)$/], ['gear', /^gear\.(\w+)$/],
  ['fix', /^fix\.(\w+)(!?=)(\w+)$/], ['hint', /^hint\.(\w+)=(\w+)$/],
  ['num', new RegExp('^(self|day|coins|spot|energy|min|dep)' + OP + '([\\d.]+)$')],
  ['bond', new RegExp('^bond\\.(\\w+)' + OP + '(-?\\d+)$')], ['gw', new RegExp('^gw\\.(\\w+)' + OP + '(\\d+)$')],
  ['act', new RegExp('^act' + OP + '(\\d)$')], ['w', /^w\.(\w+)$/], ['know', /^know\.(\w+)\.(\w+)$/],
  ['stake', /^stake\.(\w+)=(\w+)$/], ['rue', /^rue=(\w+)$/], ['sight', /^sight\.(\w+)$/], ['told', /^told\.(\w+)\.(\w+)$/],
  ['shift', /^shift$/], ['meetingday', /^meetingday$/], ['festivalday', /^festivalday$/],
];
export const EFFECT_TERMS = [
  ['bond', /^bond\.(\w+)([+-]\d+)$/], ['gw', /^gw\.(\w+)([+-]\d+)$/], ['stat', /^(self|energy|coins|spot|dep)([+-][\d.]+)$/],
  ['flag', /^flag\.(\w+)$/], ['unflag', /^unflag\.(\w+)$/], ['w', /^w\.(\w+)$/], ['idea', /^idea\.(\w+)$/], ['back', /^back\.(\w+)$/],
  ['know', /^know\.(\w+)\.(\w+)$/], ['note', /^note\.(\w+)$/], ['gear', /^gear\.(\w+)$/], ['install', /^blend\.install$/],
  ['score', /^blend\.score([+-]\d+)$/], ['time', /^time\+(\d+)$/], ['stake', /^stake\.(\w+)=(\w+)$/], ['keep', /^keep\.(\w+)$/],
];

// one term: { neg, name, m } or null when nothing matches
export function parseTerm(t) {
  let s = String(t).trim(); let neg = false;
  if (s[0] === '!') { neg = true; s = s.slice(1); }
  for (const [name, re] of COND_TERMS) { const m = re.exec(s); if (m) return { neg, name, m, src: s }; }
  return null;
}
const condCache = new Map();
// a whole condition: an array of OR-groups, all of which must hold. Unknown terms throw, so typos fail loudly.
export function parseCond(str) {
  if (condCache.has(str)) return condCache.get(str);
  const groups = String(str).split('&').map((part) => part.split('|').map((alt) => {
    const p = parseTerm(alt); if (!p) throw new Error('unknown condition term "' + alt.trim() + '" in "' + str + '"'); return p;
  }));
  condCache.set(str, groups);
  return groups;
}
export function parseEffect(e) {
  const s = String(e).trim();
  for (const [name, re] of EFFECT_TERMS) { const m = re.exec(s); if (m) return { name, m, src: s }; }
  return null;
}
export function compare(a, op, b) {
  switch (op) { case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; case '=': return a === b; case '!=': return a !== b; default: return false; }
}
// node kinds a scene may contain, and the keys each may carry (the checker rejects anything else)
export const NODE_KEYS = ['who', 't', 'gut', 'note', 'notice', 'zone', 'do', 'hint', 'ask', 'label', 'go', 'if', 'face', 'call', 'end', 'id', 'sum', 'hard'];
export const ASK_KEYS = ['id', 't', 'sub', 'if', 'do', 'go', 'tag', 'blend'];
