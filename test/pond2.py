# Pond checks: the goldfish turns up after four kinds, the float shows its zone, "I'm done" ends it, the guide gives hints.
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
    ctx.add_init_script("try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant' })); } catch (e) {}")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mgslow=1&mute=1&seed=4')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def until(js, t=60000):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            pg.wait_for_timeout(150)
        print('TIMEOUT', js); return False
    def tap(x, y):
        if mobile: pg.touchscreen.tap(x, y)
        else: pg.mouse.click(x, y)
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % [4,4,0,4,2,4][i])
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("__wb.state().pond = { minnow: 1, perch: 1, carp: 1, gudgeon: 1 }; __wb.G.zone = 'farend'; __wb.mgTest('pond')")
    until("__wb.mg() !== null"); pg.wait_for_timeout(800)
    go = pg.query_selector('.mg-over .go').bounding_box(); tap(go['x'] + go['width'] / 2, go['y'] + go['height'] / 2); pg.wait_for_timeout(800)
    print('fish present:', pg.evaluate("__wb.G.mg.fish.map(q => q.f.id).join(',')"))
    cv = pg.query_selector('.mg-stage canvas').bounding_box()
    f = pg.evaluate("(() => { const g = __wb.G.mg; const f = g.fish.find(q => q.f.id === 'gold') || g.fish[0]; return [f.x, f.y]; })()")
    tap(cv['x'] + f[0] + 8, cv['y'] + f[1]); until("__wb.G.mg.cast && __wb.G.mg.cast.state === 'wait'", 20000); pg.wait_for_timeout(200)
    pg.screenshot(path='%s/%s-pond2-float.png' % (out, tag)); print('hint:', pg.evaluate("document.querySelector('.mg-hint').textContent"), '| side:', pg.evaluate("document.querySelector('.mg-side').innerText"))
    bb = pg.query_selector('.pdone').bounding_box(); tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(1500)
    pg.screenshot(path='%s/%s-pond2-done.png' % (out, tag)); print(pg.evaluate("document.querySelector('.mg-result') && document.querySelector('.mg-result').innerText"))
    r = pg.query_selector('.mg-over .go').bounding_box(); tap(r['x'] + r['width'] / 2, r['y'] + r['height'] / 2)
    until("!__wb.mg() && !__wb.busy()", 30000); pg.wait_for_timeout(500)
    pg.evaluate("__wb.G.phoneOpen || __wb.G.togglePhone()"); pg.wait_for_timeout(700)
    pg.evaluate("document.querySelector('[data-tab=lantern]').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-sub=notes]').click()"); pg.wait_for_timeout(500)
    pg.screenshot(path='%s/%s-pond2-guide.png' % (out, tag)); print('guide:', pg.evaluate("document.querySelector('.pondguide') && document.querySelector('.pondguide').innerText"))
    print('errors', errs)
    b.close()
