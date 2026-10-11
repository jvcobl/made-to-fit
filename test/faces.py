# Portrait framing on a tall phone screen: People guide, permits, and the "You" page.
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
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
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % [0,0,4,0,2,0][i])
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("Object.assign(__wb.state().met, { pip: true, moss: true, bea: true, gil: true })")
    pg.evaluate("__wb.G.phoneOpen || __wb.G.togglePhone()"); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('[data-tab=notebook]').click()"); pg.wait_for_timeout(600)
    pg.screenshot(path='%s/m-faces-people.png' % out)
    pg.evaluate("__wb.G.togglePhone()"); pg.wait_for_timeout(300)
    pg.evaluate("__wb.mgTest('stamp')"); until("__wb.mg() !== null"); pg.wait_for_timeout(800)
    go = pg.query_selector('.mg-over .go').bounding_box(); pg.touchscreen.tap(go['x'] + go['width'] / 2, go['y'] + go['height'] / 2); pg.wait_for_timeout(1500)
    pg.screenshot(path='%s/m-faces-stamp.png' % out)
    st = pg.evaluate("(() => { const g = __wb.G.mg; return { stamps: g.stamps.map(s => [s.x + s.w / 2, s.y + s.h / 2]) }; })()")
    cv = pg.query_selector('.mg-stage canvas').bounding_box(); s0 = st['stamps'][0]; pg.touchscreen.tap(cv['x'] + s0[0], cv['y'] + s0[1]); pg.wait_for_timeout(2500)
    pg.screenshot(path='%s/m-faces-stamp2.png' % out)
    print('errors', errs)
    b.close()
