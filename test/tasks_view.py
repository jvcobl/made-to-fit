# Every hands-on task at normal speed, on a laptop and on a phone: the intro card, the task a few seconds in, and the
# result card, screenshotted to test/shots_tasks (look at them). Checks that each task opens, shows its card, runs,
# ends with a result card and a button out, and that nothing overflows the phone screen.
# usage: python3 test/tasks_view.py [desktop] [phone] [task names, e.g. paint]
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to
D = '/home/claude/wb4/test/shots_tasks'; os.makedirs(D, exist_ok=True)
TASKS = [('sort', None), ('stamp', None), ('blueprint', 'quiet'), ('blueprint', 'dim'), ('plain', None), ('pond', None), ('paint', None), ('mail', None), ('teach', None)]
ONLY = [a for a in sys.argv[1:] if a not in ('desktop', 'phone')]
if ONLY: TASKS = [t for t in TASKS if t[0] in ONLY]
modes = [a for a in sys.argv[1:] if a in ('desktop', 'phone')] or ['desktop', 'phone']
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:500]), flush=True)
FREE = lambda st: st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'] and not st['ov'] and not st['mg']
WIDE = "(() => ({ sw: document.documentElement.scrollWidth, W: innerWidth, cut: [...document.querySelectorAll('#mg button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map((b) => b.innerText.slice(0, 30)) }))()"
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for mode in modes:
        ctx = b.new_context(viewport={'width': 390, 'height': 844} if mode == 'phone' else {'width': 1280, 'height': 760}, is_mobile=mode == 'phone', has_touch=mode == 'phone', device_scale_factor=1)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
        # normal speed (no fast=1), so the cards and timings are what a player sees
        pg.goto(BASE + '?test=1&mute=1&seed=5'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
        pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
        pg.evaluate("__wb.G.settings.textSpeed = 'instant'")
        drive_to(pg, lambda st: FREE(st) and st['day'] == 1, budget=300)
        # (painting is for people you know: by festival day you have met a few)
        pg.evaluate("Object.assign(__wb.state().met, { gil: true, bea: true, wren: true, moss: true, pip: true })")
        for name, arg in TASKS:
            tag = '%s_%s%s' % (mode, name, '_' + arg if arg else '')
            pg.evaluate("(a) => __wb.mgTest(a[0], a[1])", [name, arg])
            ok = True
            try: pg.wait_for_selector('.mg-intro .go', timeout=20000)
            except Exception: ok = False
            check('%s: opens with its intro card' % tag, ok)
            if not ok: pg.screenshot(path='%s/%s_0_missing.png' % (D, tag)); continue
            pg.wait_for_timeout(500); pg.screenshot(path='%s/%s_1_intro.png' % (D, tag))
            L = pg.evaluate(WIDE); check('%s: intro fits the screen' % tag, L['sw'] <= L['W'] + 1 and not L['cut'], L)
            loc = pg.locator('.mg-intro .go')
            (loc.tap() if mode == 'phone' else loc.click())
            pg.wait_for_timeout(2500); pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(200)
            pg.screenshot(path='%s/%s_2_play.png' % (D, tag))
            L = pg.evaluate(WIDE); check('%s: the task fits the screen' % tag, L['sw'] <= L['W'] + 1 and not L['cut'], L)
            # finish it the way the task's own helper plays it, then look at the result card
            t0 = time.time(); res = False
            while time.time() - t0 < 120:
                if pg.evaluate("!!document.querySelector('.mg-result .go')"): res = True; break
                pg.evaluate('__wb.mgAuto(0.9)'); pg.wait_for_timeout(250)
            check('%s: ends with a result card and a way out' % tag, res)
            if res:
                pg.wait_for_timeout(600); pg.screenshot(path='%s/%s_3_result.png' % (D, tag))
                txt = pg.evaluate("document.querySelector('.mg-result').innerText")
                check('%s: the result says something' % tag, len(txt.strip()) > 20, txt[:200])
                pg.locator('.mg-result .go').click()
            t0 = time.time()
            while time.time() - t0 < 30 and pg.evaluate('!!__wb.mg()'): pg.wait_for_timeout(200)
            drive_to(pg, FREE, budget=60)
        check('%s: no page errors' % mode, not errors, errors[:4])
        ctx.close()
    b.close()
print(json.dumps({'ok': out['ok'], 'failed': [c for c in out['checks'] if not c[1]]}, default=str)[:3000])
sys.exit(0 if out['ok'] else 1)
