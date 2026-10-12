# Act 2 (ten years later), from a carry: arrival, Unit's turned card and Teach Unit, festival mail, Tomas at the ramp,
# the kiosk, Bea's crossing, Pip's rye, the meeting, Who decided?, the festival and the ending (with the carry for
# Act 3). Screenshots go to test/shots_a2. Prints JSON; exit 1 on failure.
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE, drive_to, free, STATE_JS
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=31'
SHOTS = '/home/claude/wb4/test/shots_a2'; os.makedirs(SHOTS, exist_ok=True)
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
    pg.evaluate("__wb.gotoAct(2, { built: ['quiet', 'dim', 'ramp', 'plain', 'board'], onfile: ['lanterns'] })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    check('a reload into Act 2', pg.evaluate('__wb.ret().act') == 2)
    # arrival: Bea, the key, change anything, the morning card
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'age_glasses')", 60)
    shot(pg, '01_arrival')
    check('arrival: change anything?', ok)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'age_scarf'))")
    ok = until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 40)
    S = pg.evaluate("(() => { const S = __wb.state(); return { act: S.act, day: S.day, min: S.min, fixes: S.fixes, lantern: S.flags.lantern, wear: S.look.wear, self: S.self, name: S.name, ready: Object.keys(S.fixes).filter((f) => S.fixes[f] === 'ready') } })()")
    check('arrival done: free play in Act 2', ok and S['act'] == 2 and S['day'] == 1, S)
    check('carry: fixes built, the lantern yours, the scarf on', S['fixes'].get('quiet') == 'built' and S['fixes'].get('dim') == 'built' and S['lantern'] and S['wear'] == 'scarf', S)
    shot(pg, '02_free')
    # the Works: Unit's card (dim was built), teach it
    pg.evaluate("(() => { const S = __wb.state(); S.min = 520; __wb.tp([12, 13.4]); })()")
    until(pg, "__wb.target() === 'works' && !__wb.busy() && !__wb.waiter()", 40, pick=first)
    pg.evaluate('__wb.act()')
    ok = until(pg, "__wb.waiter() === 'barrier'", 40)
    opts = pg.evaluate('__wb.options()')
    check('Unit\'s turned card: five answers, the machine in the second column', ok and [o['key'] for o in opts] == ['bend', 'gear', 'ask', 'fix', 'leave'] and 'Teach Unit' in opts[1]['t'], opts)
    shot(pg, '03_unitcard')
    pg.evaluate('__wb.choose(1)')
    ok = until(pg, "__wb.mg() === 'teach'", 30)
    check('Teach Unit opens', ok)
    pg.wait_for_timeout(400); shot(pg, '04_teach')
    ok = until(pg, "!__wb.busy() && !__wb.waiter() && !__wb.mg() && !!__wb.state().flags.mail2", 90, pick=by_key('leave'))
    S = pg.evaluate("(() => { const S = __wb.state(); return { taught: S.w.unit_taught, quirks: S.unitQuirks, mail: S.flags.mail2, log: S.log.filter((r) => r.v === 'teach').length } })()")
    check('taught Unit, then festival mail', ok and S['taught'] and S['mail'] == 'done' and S['log'] == 1 and S['quirks'], S)
    check('your old desk offers no first-visit shift ten years on', not pg.evaluate('__wb.G.story.shiftOpen()'))
    # out of the Works: Tomas at the ramp (the ramp was built)
    pg.evaluate("__wb.G.run(() => __wb.G.exitRoom())")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'ramp_bay')", 30)
    shot(pg, '05_ramp')
    check('Tomas and the bot on the ramp', ok)
    if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'ramp_bay'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30)
    check('bay: a proposal with Gil backing', pg.evaluate("__wb.state().fixes.bay") in ('proposal', 'ready'), pg.evaluate("[__wb.state().fixes.bay, __wb.state().support.bay]"))
    # (Pip, who the bay costs, would come to find you within the hour: say you listened, so the test can walk on;
    # the clock runs at 22 minutes a second here, so every wait below is short)
    pg.evaluate("(() => { const S = __wb.state(); S.stakeDue = {}; if (S.fixes.bay) S.stakes.bay = 'listened'; })()")
    # the kiosk in Town Hall
    pg.evaluate("(() => { const S = __wb.state(); S.min = Math.max(S.min, 700); __wb.tp([32, 14.6]); })()")
    until(pg, "__wb.target() === 'hall' && !__wb.busy() && !__wb.waiter()", 40, pick=first)
    pg.evaluate('__wb.act()')
    ok = until(pg, "__wb.waiter() === 'barrier' && __wb.options().some((o) => o.t.includes('counter'))", 40, pick=first)
    shot(pg, '06_kiosk')
    opts = pg.evaluate('__wb.options()')
    check('kiosk: it mishears you, and the card offers the counter', ok and any('counter' in o['t'] for o in opts), opts)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'fix'))")
    ok = until(pg, "__wb.waiter() === 'barrier'", 20)
    if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'gear'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30)
    check('counter: a proposal', pg.evaluate("__wb.state().fixes.counter") in ('proposal', 'ready'))
    pg.evaluate("__wb.G.run(() => __wb.G.exitRoom())"); pg.wait_for_timeout(800)
    # Bea's crossing
    pg.evaluate("(() => { const S = __wb.state(); S.min = 800; __wb.tp([45.6, 20.8]); })()")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'cross_sign')", 40)
    shot(pg, '07_crossing')
    check('the crossing: Bea and her petition', ok)
    if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'cross_sign'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 30)
    check('crossing: a proposal', pg.evaluate("__wb.state().fixes.crossing") in ('proposal', 'ready'))
    # Pip's rye
    pg.evaluate("(() => { __wb.state().min = 850; })()")
    pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('pip'))")
    ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'rye_buy')", 30)
    check('Pip: the rye nobody hearted', ok)
    if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'rye_buy'))")
    until(pg, "!__wb.busy() && !__wb.waiter()", 20, pick=first)
    check('rye bought, carried', pg.evaluate("!!__wb.state().w.rye_bought"))
    # Tomas only lives in this visit: talking to him must end cleanly
    pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('tomas'))")
    ok = until(pg, "!__wb.busy() && !__wb.waiter()", 20, pick=first)
    check('talking to Tomas (who only lives in this visit) ends cleanly', ok and not errors, errors[:3])
    # the meeting: second backers, found by asking (the stakeholders already listened to, so nobody walks up mid-test)
    pg.evaluate("(() => { const S = __wb.state(); S.stakes.crossing = 'listened'; S.stakes.counter = 'listened'; S.stakeDue = {}; for (const id of ['gil', 'bea', 'pip']) S.gw[id] = Math.max(1, S.gw[id] || 0); })()")
    for who, f in [('gil', 'counter'), ('bea', 'bay'), ('pip', 'crossing')]:
        if pg.evaluate("__wb.state().fixes.%s" % f) != 'proposal': continue
        pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('%s'))" % who)
        until(pg, "!__wb.busy() && !__wb.waiter()", 30, pick=by_id('back_' + f))
    S = pg.evaluate("(() => { const S = __wb.state(); return { fixes: { crossing: S.fixes.crossing, counter: S.fixes.counter, bay: S.fixes.bay }, support: S.support } })()")
    check('second backers, found by asking them', all(S['fixes'][f] == 'ready' for f in ['crossing', 'counter', 'bay']), S)
    pg.evaluate("__wb.state().min = 1079")
    ok = until(pg, "!!__wb.state().flags.councilDone && !__wb.busy()", 120, pick=first)
    S = pg.evaluate("(() => { const S = __wb.state(); return { fixes: S.fixes, act: S.act } })()")
    check('the meeting: two at most, built tonight', ok and sum(1 for f in ['crossing', 'counter', 'bay', 'lanterns'] if S['fixes'].get(f) == 'built') <= 2, S)
    # Who decided? and the festival, then the ending
    pg.evaluate("__wb.state().min = 1169")
    ok = until(pg, "!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 120, pick=first)
    shot(pg, '08_festival')
    check('festival', ok)
    pg.evaluate("__wb.state().min = 1289")
    ok = until(pg, "__wb.panel() && __wb.panel().includes('ending')", 120, pick=first)
    shot(pg, '09_ending')
    txt = pg.evaluate("document.querySelector('#panel').innerText") if ok else ''
    check('ending page, with twenty years later', ok and 'Twenty years later' in txt, txt[:500])
    carry = pg.evaluate("JSON.parse(localStorage.getItem('mtf.carry') || '{}')")
    check('carry for Act 2 written', '2' in (carry.get('acts') or {}), list((carry.get('acts') or {}).keys()))
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
