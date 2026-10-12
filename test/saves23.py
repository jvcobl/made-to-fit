# Saves inside the later visits: Act 2's checkpoints (after the Works, after the meeting) and Act 3's (after Juno),
# each followed by a reload and Continue from the title. What Continue restores is compared with what was saved (the
# clock runs fast in tests, so the live state moves on); then the day carries on. Prints JSON; exit 1 on failure.
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
# autosave=0: these checks are about the story's own checkpoints (test/autosave.py covers saving as you play)
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=37&autosave=0'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def until(pg, js, t=30, pick=None):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        w = pg.evaluate('window.__wb && __wb.waiter && __wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w == 'choice' and pg.evaluate("__wb.options().some((o) => o.id === 'stake_change')"): pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'stake_change'))")
        elif w in ('choice', 'barrier') and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        elif pg.evaluate("!!document.querySelector('#panel:not([hidden]) #tgo')"): pg.evaluate("document.querySelector('#panel #tgo').click()")
        if pg.evaluate('window.__wb && __wb.mg && __wb.mg()'): pg.evaluate('__wb.mgAuto(0.9)')
        pg.wait_for_timeout(60)
    return False
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
FIELDS = "act: S.act, name: S.name || null, min: Math.round(S.min), fixes: S.fixes, w: S.w, wear: S.look.wear, log: S.log.length, jar: (S.jar || []).length, flags: Object.keys(S.flags).filter((k) => S.flags[k]).sort(), self: Math.round(S.self), coins: S.coins"
SAVED = "(() => { try { const o = JSON.parse(localStorage.getItem('mtf.save')); const S = o.S; return { phase: o.phase, label: o.label, %s } } catch (e) { return null } })()" % FIELDS
LIVE = "(() => { const S = __wb.state(); return { %s } })()" % FIELDS
def saved(pg): return pg.evaluate(SAVED)
def wait_saved(pg, phase, act, t=60):
    t0 = time.time()
    while time.time() - t0 < t:
        s = saved(pg)
        if s and s['phase'] == phase and s['act'] == act: return s
        if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
        pg.wait_for_timeout(50)
    return saved(pg)
def cont(pg):
    """reload, Continue from the title, and read the state the moment it is back"""
    pg.evaluate('sessionStorage.clear()'); pg.goto(URL)
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    label = pg.evaluate("(document.querySelector('#tCont') || {}).innerText || ''")
    pg.evaluate("document.querySelector('#tCont').click()")
    try:
        pg.wait_for_function("window.__wb.ret && __wb.ret() && __wb.state().act > 1 && __wb.mode() === 'play'", timeout=60000, polling=20)
        return label, pg.evaluate(LIVE)
    except Exception:
        return label, None
def same(a, b, keys): return a is not None and b is not None and all(a[k] == b[k] for k in keys)
KEYS = ['act', 'fixes', 'w', 'wear', 'log', 'jar', 'flags', 'coins']

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload()
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    # ---- Act 2: the morning, then after the Works ----
    pg.evaluate("__wb.gotoAct(2, { built: ['quiet', 'dim', 'ramp'], name: 'Kit' })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    s0 = wait_saved(pg, 'morning', 2)
    check('Act 2: a save at the start of the day', s0 and s0['phase'] == 'morning', s0 and s0['label'])
    until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'age_hat')", 60)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'age_hat'))")
    until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 40)
    pg.evaluate("(() => { __wb.state().min = 520; __wb.tp([12, 13.4]); })()")
    until(pg, "__wb.target() === 'works' && !__wb.busy() && !__wb.waiter()", 40, pick=first)
    pg.evaluate('__wb.act()')
    until(pg, "__wb.waiter() === 'barrier'", 40)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'leave'))")
    s1 = wait_saved(pg, 'shift', 2, 90)
    check('Act 2: stepping out of the Works saves the visit (after work)', s1 and s1['phase'] == 'shift' and 'works2' in s1['flags'] and s1['w'].get('unit_restored') == 1, s1 and [s1['label'], s1['flags']])
    label, back = cont(pg)
    # (Tomas may already be on his way to you: the ramp scene starts the moment you are back by the door)
    if back: back['flags'] = [f for f in back['flags'] if f != 'ramp2']
    check('Act 2: Continue after work restores exactly what was saved', same(s1, back, KEYS) and back['name'] == 'Kit', [label, s1, back])
    loc = pg.evaluate("[__wb.loc(), Math.round(__wb.G.player.root.position.x), Math.round(__wb.G.player.root.position.z), !!__wb.G.town.actLayer && __wb.G.town.actLayer.name]")
    check('Act 2: back outside the Works, in the town of ten years on', loc[0] == 'town' and abs(loc[1] - 12) <= 2 and loc[3] == 'act2', loc)
    ok = until(pg, "!!__wb.state().flags.ramp2 && __wb.mode() === 'play' && !__wb.busy() && !__wb.waiter()", 60, pick=first)
    check('Act 2: Tomas at the ramp is still to come, and comes', ok, pg.evaluate("Object.keys(__wb.state().flags)"))
    # ---- Act 2: after the meeting ----
    pg.evaluate("__wb.state().min = 1079")
    until(pg, "!!__wb.state().flags.councilDone", 120, pick=first)
    s2 = wait_saved(pg, 'meeting', 2, 60)
    check('Act 2: saved after the meeting', s2 and s2['phase'] == 'meeting' and 'councilDone' in s2['flags'], s2 and s2['label'])
    label, back = cont(pg)
    check('Act 2: Continue after the meeting restores exactly what was saved', same(s2, back, KEYS), [label, s2, back])
    pg.evaluate("__wb.state().min = Math.max(__wb.state().min, 1169)")
    until(pg, "!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 120, pick=first)
    pg.evaluate("__wb.state().min = 1289")
    ok = until(pg, "__wb.panel() && __wb.panel().includes('ending')", 120, pick=first)
    s3 = saved(pg)
    check('Act 2: on to the festival and the ending (saved as ended)', ok and s3 and s3['phase'] == 'end', s3 and s3['label'])
    # the title now offers the next visit, and Continue goes to the ending page
    pg.evaluate('sessionStorage.clear()'); pg.goto(URL)
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    t = pg.evaluate("[(document.querySelector('#tRet') || {}).innerText || '', (document.querySelector('#tCont') || {}).innerText || '']")
    check('after Act 2 ends: the title offers twenty years later', 'Twenty years later' in t[0], t)
    # ---- Act 3: after Juno ----
    pg.evaluate("document.querySelector('#tRet').click()")
    try: pg.wait_for_selector('#nm', timeout=20000); pg.fill('#nm', 'Kit'); pg.evaluate("document.querySelector('#nOk').click()")
    except Exception: pass
    until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'coop_no')", 90)
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'coop_no'))")
    until(pg, "__wb.waiter() === 'barrier'", 60, pick=lambda o: next((k for k, x in enumerate(o) if x['id'] == 'age_keep'), 0))
    pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'ask'))")
    s4 = wait_saved(pg, 'shift', 3, 60)
    check('Act 3 (from the Act 2 ending): saved after Juno, in the morning', s4 and s4['phase'] == 'shift' and 'juno3' in s4['flags'] and s4['min'] < 600, s4 and [s4['label'], s4['min']])
    label, back = cont(pg)
    jv = pg.evaluate("[__wb.state().junoV, __wb.state().junoFix]")
    check('Act 3: Continue after Juno restores exactly what was saved', same(s4, back, KEYS) and jv[0] == 'ask', [label, jv, s4, back])
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
