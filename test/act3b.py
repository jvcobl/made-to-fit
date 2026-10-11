# Act 3 when none of your own fixes pinches Juno: Juno brings the statue's benches (a default nobody chose), you put in
# a lower bench yourself, and the Founders' Fund offers Bea's crossing (it was never built). Checks the benches stand
# (and block), the sight says whose height they are, the Fund builds the crossing, and what Larkspur remembers.
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
URL = BASE + '?test=1&fast=1&mute=1&seed=35'
SHOTS = '/home/claude/wb4/test/shots_a3'; os.makedirs(SHOTS, exist_ok=True)
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def shot(pg, name): pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(150); pg.screenshot(path='%s/%s.png' % (SHOTS, name))
def until(pg, js, t=30, pick=None):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        w = pg.evaluate('__wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w == 'choice' and pg.evaluate("__wb.options().some((o) => o.id === 'stake_change')"): pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'stake_change'))")
        elif w in ('choice', 'barrier') and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        elif pg.evaluate("!!document.querySelector('#panel:not([hidden]) #tgo')"): pg.evaluate("document.querySelector('#panel #tgo').click()")
        if pg.evaluate('__wb.mg()'): pg.evaluate('__wb.mgAuto(0.9)')
        pg.wait_for_timeout(60)
    return False
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    pg.evaluate("__wb.gotoAct(3, { built: ['ramp', 'board'] })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'coop_yes')", 60)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'coop_yes'))")
    ok = until(pg, "__wb.waiter() === 'barrier'", 60, pick=lambda o: next((k for k, x in enumerate(o) if x['id'] == 'age_keep'), 0))
    opts = pg.evaluate('__wb.options()')
    ask = next((o for o in opts if o['key'] == 'ask'), {})
    check('Juno brings the benches: the Shed decides now, a lower bench', ok and pg.evaluate("__wb.state().junoFix") == 'bench' and 'the Shed decides now' in ask.get('t', '') and 'lower bench' in ask.get('t', ''), opts)
    shot(pg, 'b1_bench_card')
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'ask'))")
    ok = until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel() && !!__wb.state().flags.juno3", 60, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(), T = __wb.G.town; return { b: S.w.benches3, mods: S.mods.market || null, low: T.walkable(27.1, 24.0), high: T.walkable(32.9, 24.0), answer: S.junoAnswer } })()")
    check('a lower bench, by the statue: built, solid, and no rule of yours bent', ok and S['b'] == 'low' and S['low'] is False and S['high'] is True and not S['mods'], S)
    sight = pg.evaluate("(() => { const s = __wb.G.look.sight('myfix'); return s ? { name: s.name, line: s.line, at: s.at, you: !!s.ghostYou } : null })()")
    check('the sight is the benches, at the Standard\'s height, with the Standard as the stand-in', sight and sight['name'] == 'The benches' and 'Standard' in sight['line'] and not sight['you'], sight)
    pg.evaluate("(() => { __wb.tp([28.4, 26.6]); __wb.G.forceRender = true; })()"); shot(pg, 'b2_low_bench')
    # the square: the Fund offers the crossing (never built), accept
    pg.evaluate("(() => { const S = __wb.state(); S.min = 700; __wb.tp([27.4, 27.6]); })()")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'fund_yes')", 60, pick=first)
    no = next((o['t'] for o in pg.evaluate('__wb.options()') if o['id'] == 'fund_no'), '')
    check('the Fund offers Bea\'s crossing', ok and 'Bea' in no, no)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'fund_yes'))")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'moss_none')", 40)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'moss_none'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(); return { crossing: S.fixes.crossing, gift: S.flags.fundGift, button: __wb.G.town.crossButton && __wb.G.town.crossButton.visible, rem: __wb.G.story.ret.remember() } })()")
    check('the Fund builds the crossing within the hour', S['crossing'] == 'built' and S['gift'] == 'crossing', S)
    rem = ' '.join(S['rem'])
    check('what Larkspur remembers: the lower bench, and the Fund\'s crossing', 'When Juno came to you, you put in a lower bench.' in rem and 'for Bea\'s longer crossing' in rem and 'Ines works in the city' in rem, S['rem'])
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
