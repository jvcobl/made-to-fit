import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&v1=1&fast=1&mute=1&seed=4')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def until(js, t=60000):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            pg.wait_for_timeout(150)
        return False
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelector('#next').click()")
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("__wb.G.installBlend()"); pg.wait_for_timeout(300)
    pg.evaluate("__wb.G.togglePhone()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-tab=blend]').click()"); pg.wait_for_timeout(500)
    pg.screenshot(path='%s/%s-feed0.png' % (out, tag))
    for i in range(7):
        bb = pg.query_selector('.fcard').bounding_box()
        if mobile: pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        else: pg.mouse.click(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(250)
    pg.screenshot(path='%s/%s-feed7.png' % (out, tag))
    pg.evaluate("document.querySelector('.oddsbtn').click()"); pg.wait_for_timeout(300); pg.screenshot(path='%s/%s-feedodds.png' % (out, tag))
    print(pg.evaluate("[__wb.state().blend.score, Math.round(__wb.state().self), Math.round(__wb.state().min), Object.keys(__wb.state().notes || {})]"))
    pg.evaluate("document.querySelector('.putdown') && document.querySelector('.putdown').click()"); pg.wait_for_timeout(400); pg.screenshot(path='%s/%s-feeddown.png' % (out, tag))
    print('errors', errs)
    b.close()
