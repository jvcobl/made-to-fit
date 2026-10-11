# The ways into a later visit from the title: "Played before?" → "Start from a recap" (creator, the room's six dials,
# six things about the first week with "Choose for me") → ten years later; then, with only the finished first visit
# remembered, the title's "Return to Larkspur" → your name → ten years later. Prints JSON; exit 1 on failure.
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
URL = BASE + '?test=1&fast=1&mute=1&seed=41'
SHOTS = '/home/claude/wb4/test/shots_recap'; os.makedirs(SHOTS, exist_ok=True)
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def shot(pg, name): pg.wait_for_timeout(200); pg.screenshot(path='%s/%s.png' % (SHOTS, name))
def until(pg, js, t=30, pick=None):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        w = pg.evaluate('window.__wb && __wb.waiter && __wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w in ('choice', 'barrier') and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        pg.wait_for_timeout(60)
    return False
def by_id(want):
    def f(o):
        for k, x in enumerate(o):
            if x['id'] == want and not x['disabled']: return k
        return 0
    return f

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload()
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    check('a first visit: no Return to Larkspur on the title', not pg.evaluate("!!document.querySelector('#tRet')"))
    # Played before? → Start from a recap
    pg.evaluate("document.querySelector('#tPb').click()")
    pg.wait_for_selector('#cRecap', timeout=10000); shot(pg, '01_played_before')
    pg.evaluate("document.querySelector('#cRecap').click()")
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=30000)
    pg.fill('#cname', 'Robin')
    pg.evaluate("document.querySelector('[data-k=\"wear\"] [data-v=\"bow\"]').click(); document.querySelector('[data-k=\"top\"] [data-v=\"antennae\"]').click()")
    shot(pg, '02_creator')
    pg.evaluate("document.querySelector('#done').click()")
    pg.wait_for_selector('#rdone', timeout=20000)
    dials = pg.evaluate("document.querySelectorAll('.recap .scale').length")
    check('your room: six dials in one panel', dials == 6, dials)
    pg.evaluate("document.querySelector('.scale[data-k=\"lamp\"] [data-v=\"0.1\"]').click(); document.querySelector('.scale[data-k=\"radio\"] [data-v=\"0.9\"]').click()")
    shot(pg, '03_room')
    pg.evaluate("document.querySelector('#rdone').click()")
    pg.wait_for_selector('#rgo', timeout=20000)
    # pick two fixes, then a third is refused with a note; listen to one stakeholder; then Choose for me
    pg.evaluate("document.querySelector('[data-fix=\"quiet\"]').click()"); pg.evaluate("document.querySelector('[data-fix=\"ramp\"]').click()"); pg.evaluate("document.querySelector('[data-fix=\"dim\"]').click()")
    on = pg.evaluate("[...document.querySelectorAll('[data-fix].on')].map((b) => b.dataset.fix)")
    note = pg.evaluate("(document.querySelector('.rnote') || {}).textContent || ''")
    check('two fixes at most, said plainly', on == ['quiet', 'ramp'] and 'Two at most' in note, [on, note])
    pg.evaluate("document.querySelector('[data-listen=\"quiet\"]').click()")
    shot(pg, '04_choices')
    pg.evaluate("document.querySelector('#rrand').click()")
    picked = pg.evaluate("({ fixes: document.querySelectorAll('[data-fix].on').length, people: document.querySelectorAll('[data-person].on').length, ones: document.querySelectorAll('[data-one].on').length })")
    check('Choose for me fills in all six, to look over', 1 <= picked['fixes'] <= 2 and 3 <= picked['people'] <= 4 and picked['ones'] == 4, picked)
    shot(pg, '05_chosen')
    # put back a known past, to check the carry
    pg.evaluate("""(() => { for (let i = 0; i < 4; i++) { const b = document.querySelector('[data-fix].on'); if (b) b.click(); } })()""")
    pg.evaluate("document.querySelector('[data-fix=\"quiet\"]').click()"); pg.evaluate("document.querySelector('[data-fix=\"plain\"]').click()")
    pg.evaluate("document.querySelector('[data-listen=\"plain\"]').click()")
    pg.evaluate("document.querySelector('[data-one=\"blend\"][data-v=\"deleted\"]').click(); document.querySelector('[data-one=\"rue\"][data-v=\"easing\"]').click()")
    pg.evaluate("document.querySelector('#rgo').click()")
    ok = until(pg, "window.__wb && __wb.ret && __wb.ret() && __wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'age_glasses')", 90)
    shot(pg, '06_ten_years')
    S = pg.evaluate("(() => { const S = __wb.state(); return { act: S.act, name: S.name, origin: S.origin, recap: S.w.recap, fixes: Object.keys(S.fixes).filter((f) => S.fixes[f] === 'built'), plain: S.stakes.plain, quiet: S.stakes.quiet || null, blend: S.blend.deleted, rue: S.ruePrev, wear: S.look.wear, top: S.look.top, light: S.profile.light, sound: S.profile.sound } })()")
    check('ten years later, from the recap', ok and S['act'] == 2 and S['name'] == 'Robin' and S['origin'] == 'recap' and S['recap'] == 1, S)
    check('the recap carried: fixes, who you listened to, Blend, Rue, look, room', sorted(S['fixes']) == ['plain', 'quiet'] and S['plain'] == 'listened' and not S['quiet'] and S['blend'] and S['rue'] == 'easing' and S['wear'] == 'bow' and S['top'] == 'antennae' and S['light'] == 0.1 and S['sound'] == 0.9, S)
    carry = pg.evaluate("JSON.parse(localStorage.getItem('mtf.carry') || '{}')")
    a1 = (carry.get('acts') or {}).get('1') or {}
    check('the recap is written as a first visit, marked as a recap, with no name in it', a1.get('act') == 1 and (a1.get('w') or {}).get('recap') == 1 and 'Robin' not in json.dumps(carry), list(a1.keys())[:8])
    # Return to Larkspur: only the finished first visit remembered (no save in progress)
    pg.evaluate("localStorage.removeItem('mtf.save'); sessionStorage.clear()"); pg.goto(URL)
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    t = pg.evaluate("(document.querySelector('#tRet') || {}).innerText || ''")
    check('the title offers Return to Larkspur, ten years later', 'Return to Larkspur' in t and 'Ten years later' in t, t)
    shot(pg, '07_title_return')
    pg.evaluate("document.querySelector('#tRet').click()")
    pg.wait_for_selector('#nm', timeout=20000)
    pg.fill('#nm', 'Robin'); pg.evaluate("document.querySelector('#nOk').click()")
    ok = until(pg, "window.__wb && __wb.ret && __wb.ret() && __wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'age_glasses')", 90)
    S = pg.evaluate("(() => { const S = __wb.state(); return { act: S.act, name: S.name, origin: S.origin } })()")
    check('Return to Larkspur: your name, then ten years later', ok and S['act'] == 2 and S['name'] == 'Robin' and S['origin'] == 'recap', S)
    # a visit code typed on the title: a second visit's code starts the third
    code = pg.evaluate("__wb.visitCode(2, { built: ['quiet', 'crossing'] })")
    pg.evaluate("localStorage.clear(); sessionStorage.clear()"); pg.goto(URL)
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    pg.evaluate("document.querySelector('#tPb').click()"); pg.wait_for_selector('.codebox', timeout=10000)
    pg.fill('.codebox', 'here it is: ' + code.lower()[:-3])
    pg.evaluate("document.querySelector('#cUse').click()")
    err = pg.evaluate("(document.querySelector('.codeerr') || {}).textContent || ''")
    pg.fill('.codebox', 'my code from last time: ' + code.lower().replace('-', ' ') + ' (thanks!)')
    pg.evaluate("document.querySelector('#cUse').click()")
    named = False
    try: pg.wait_for_selector('#nm', timeout=20000); pg.fill('#nm', 'Robin'); pg.evaluate("document.querySelector('#nOk').click()"); named = True
    except Exception: pass
    ok = until(pg, "window.__wb && __wb.ret && __wb.ret() && __wb.ret().act === 3 && !!__wb.state().flags && __wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'coop_yes')", 90)
    S = pg.evaluate("(() => { const S = __wb.state(); return { act: S.act, built: Object.keys(S.fixes).filter((f) => S.fixes[f] === 'built') } })()")
    check('a visit code on the title: a cut-off code is refused plainly; the code inside a sentence starts twenty years later', 'look right' in err and named and ok and S['act'] == 3 and 'crossing' in S['built'], [err, named, S])
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
