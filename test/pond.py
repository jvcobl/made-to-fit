from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file://' + REPO + '/dist/who-bends.html?test=1&v1=1&fast=1&mgslow=1&mute=1&seed=4')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def until(js, t=60000):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            pg.wait_for_timeout(150)
        return False
    def tap(x, y):
        if mobile: pg.touchscreen.tap(x, y)
        else: pg.mouse.click(x, y)
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % [4,4,0,4,2,4][i])
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("__wb.G.zone = 'farend'; __wb.mgTest('pond')")
    until("__wb.mg() !== null"); pg.wait_for_timeout(1000); pg.screenshot(path='%s/%s-pond-intro.png' % (out, tag))
    go = pg.query_selector('.mg-over .go').bounding_box(); tap(go['x'] + go['width'] / 2, go['y'] + go['height'] / 2); pg.wait_for_timeout(800)
    cv = pg.query_selector('.mg-stage canvas').bounding_box(); caught = 0
    pg.screenshot(path='%s/%s-pond-play.png' % (out, tag))
    for attempt in range(8):
        if not pg.evaluate("!!(__wb.G.mg && __wb.G.mg.running)"): break
        if pg.evaluate("!!document.querySelector('.fishcard')"):
            pg.screenshot(path='%s/%s-pond-card%d.png' % (out, tag, caught)); caught += 1
            pg.evaluate("document.querySelector('.fishcard .rel').click()"); pg.wait_for_timeout(500); continue
        f = pg.evaluate("(() => { const g = __wb.G.mg; const f = g.fish.find(q => q.state === 'swim'); return f ? [f.x, f.y] : null; })()")
        if not f: pg.wait_for_timeout(500); continue
        tap(cv['x'] + f[0] + 6, cv['y'] + f[1]); t0 = time.time()
        while time.time() - t0 < 25:
            st = pg.evaluate("__wb.G.mg && __wb.G.mg.cast ? __wb.G.mg.cast.state : null")
            if st == 'bite':
                c = pg.evaluate("[__wb.G.mg.cast.x, __wb.G.mg.cast.y]"); tap(cv['x'] + c[0], cv['y'] + c[1]); pg.wait_for_timeout(600); break
            if st is None: break
            pg.wait_for_timeout(80)
    pg.wait_for_timeout(2500); pg.screenshot(path='%s/%s-pond-end.png' % (out, tag))
    print(pg.evaluate("JSON.stringify(__wb.state().pond || null)"), caught, 'errors', errs)
    b.close()
