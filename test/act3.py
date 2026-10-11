# Act 3 (twenty years later), from a carry: the Shed key and the co-op, Juno's turned card, the square (Moss's lease
# and the Founders' Fund), the Shed's view on Home Row, the meeting (the Fund's clause), Who decided?, the festival
# and the final ending with the fit card. Screenshots go to test/shots_a3. Prints JSON; exit 1 on failure.
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE, drive_to, free, STATE_JS
URL = BASE + '?test=1&fast=1&mute=1&seed=33'
SHOTS = '/home/claude/wb4/test/shots_a3'; os.makedirs(SHOTS, exist_ok=True)
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def shot(pg, name): pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(150); pg.screenshot(path='%s/%s.png' % (SHOTS, name))
def until(pg, js, t=30, pick=None):
    """advance lines (and answer choices with pick) until js holds"""
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
        mg = pg.evaluate('__wb.mg()')
        if mg: pg.evaluate('__wb.mgAuto(0.9)')
        pg.wait_for_timeout(60)
    return False
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
def by_id(want):
    def f(o):
        for k, x in enumerate(o):
            if x['id'] == want and not x['disabled']: return k
        return first(o)
    return f
def by_key(want):
    def f(o):
        for k, x in enumerate(o):
            if x['key'] == want and not x['disabled']: return k
        return first(o)
    return f

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    pg.evaluate("__wb.gotoAct(3, { built: ['quiet', 'dim', 'crossing'], carry: { tally: { bend: 5, gear: 2, ask: 3, fix: 3, leave: 2 } } })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    check('a reload into Act 3', pg.evaluate('__wb.ret().act') == 3)
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'coop_yes')", 60)
    shot(pg, '01_coop')
    check('the Shed key, then the co-op question', ok)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'coop_yes'))")
    ok = until(pg, "__wb.waiter() === 'barrier'", 60, pick=by_id('age_keep'))
    shot(pg, '02_juno')
    face = pg.evaluate("!!document.querySelector('#barrier .bface img') && document.querySelector('#barrier .bface').innerText")
    opts = pg.evaluate('__wb.options()')
    check('Juno brings a card about your fix, with Juno at the top and you under Them', ok and face and 'Juno' in face and any('you own this fix now' in o['t'] for o in opts), [face, opts])
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'fix'))")
    ok = until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 60, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(); return { coop: S.w.coop_yes, redesign: S.w.juno_redesign, answer: S.junoAnswer, jfix: S.junoFix, jp: S.junoProfile, prof: S.profile, row: S.log.filter((r) => r.turn).length } })()")
    check('co-op yes, redesign with Juno, the turned row logged', ok and S['coop'] and S['redesign'] and S['answer'] and S['row'] == 1, S)
    # Juno is built against your fixes: on each dial your fixes changed, at least 0.35 away
    far = all(abs(S['jp'][d] - S['prof'][d]) >= 0.34 for d in ['sound', 'people', 'light', 'time'])
    check('Juno: at least 0.35 from you where your fixes changed things', far, [S['jp'], S['prof']])
    shot(pg, '03_free')
    # the square: Moss and Hester
    pg.evaluate("(() => { const S = __wb.state(); S.min = 700; __wb.tp([27.4, 27.6]); })()")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'fund_yes')", 60, pick=first)
    shot(pg, '04_fund')
    check('the Fund\'s offer, with its strings on the front', ok and 'Founders' in ' '.join(o['t'] for o in pg.evaluate('__wb.options()')))
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'fund_yes'))")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'moss_far')", 40)
    check('Moss: four ways', ok)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'moss_far'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(); return { fund: S.w.benefactor_yes, plate: __wb.G.town.fundPlate.visible, far: S.fixes.farstalls, benches: S.w.benches3, gift: S.flags.fundGift, walls: [__wb.G.town.walkable(27.1, 24.0), __wb.G.town.walkable(32.9, 24.0)] } })()")
    check('Fund accepted (plate up), Far End stalls proposed', S['fund'] and S['plate'] and S['far'] in ('proposal', 'ready'), S)
    check('the crossing was built already, so the Fund paid for benches at three heights (standing, and solid)', S['benches'] == 'three' and S['gift'] == 'benches' and S['walls'] == [False, False], S)
    shot(pg, '04b_benches')
    # Hollis and the Shed's view on Home Row
    pg.evaluate("(() => { const S = __wb.state(); S.min = 880; __wb.tp([30, 34]); })()")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'cf_quiet')", 60, pick=first)
    shot(pg, '05_conflict')
    check('the Shed\'s view: four ways, with the rule stated', ok)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'cf_quiet'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30, pick=first)
    # the meeting: the Shed's view first; the Far End stalls stall on the Fund's clause
    pg.evaluate("(() => { const S = __wb.state(); if (S.fixes.farstalls === 'proposal') { S.support.farstalls = ['moss', 'bea']; S.fixes.farstalls = 'ready'; } S.stakes.farstalls = 'listened'; S.stakeDue = {}; S.min = 1079; })()")
    ok = until(pg, "!!__wb.state().flags.councilDone && !__wb.busy()", 120, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(); return { qr: S.fixes.quietrow, far: S.fixes.farstalls, stalled: S.log.some((r) => r.k === 'vote' && r.v === 'stalled'), blocking: !!(S.notes || {}).blocking } })()")
    check('meeting: the quiet zone on the Shed\'s view; the Far End stalls stalled by the clause', ok and S['qr'] == 'built' and S['far'] == 'onfile' and S['stalled'] and S['blocking'], S)
    pg.evaluate("__wb.state().min = 1169")
    ok = until(pg, "!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 120, pick=first)
    shot(pg, '06_festival')
    check('festival', ok)
    pg.evaluate("__wb.state().min = 1289")
    ok = until(pg, "__wb.panel() && __wb.panel().includes('ending')", 120, pick=first)
    txt = pg.evaluate("document.querySelector('#panel').innerText") if ok else ''
    check('final ending: no next visit, Juno remembered', ok and 'years later' not in txt and 'When Juno came to you, the two of you redesigned your fix together.' in txt and 'benches at three heights' in txt, txt[:900])
    pg.evaluate("document.querySelector('#card').click()")
    try: pg.wait_for_function("!!document.querySelector('#cardbox img')", timeout=20000); alt = pg.evaluate("document.querySelector('#cardbox img').alt")
    except Exception: alt = ''
    shot(pg, '07_ending')
    check('fit card: when I was the one asked', 'When I was the one asked' in alt, alt[:400])
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
