import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'; which = sys.argv[2] if len(sys.argv) > 2 else 'quiet'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
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
        return False
    pg.evaluate("document.querySelector('#begin').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % [0,0,4,0,2,0][i])
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("__wb.mgTest(%s, %s)" % (('"plain"', 'null') if which == 'plain' else ('"blueprint"', '"%s"' % which)))
    until("__wb.mg() !== null"); pg.wait_for_timeout(1200); pg.screenshot(path='%s/%s-bp-%s-intro.png' % (out, tag, which))
    def tap(x, y):
        if mobile: pg.touchscreen.tap(x, y)
        else: pg.mouse.click(x, y)
    go = pg.query_selector('.mg-over .go').bounding_box(); tap(go['x'] + go['width'] / 2, go['y'] + go['height'] / 2); pg.wait_for_timeout(800)
    cv = pg.query_selector('.mg-stage canvas').bounding_box()
    def btn(i):
        bb = pg.evaluate("(() => { const b = __wb.G.mg.btns[%d]; return [b.x + b.w / 2, b.y + b.h / 2]; })()" % i)
        tap(cv['x'] + bb[0], cv['y'] + bb[1]); pg.wait_for_timeout(350)
    def cell(c, r):
        xy = pg.evaluate("(() => { const g = __wb.G.mg; const [x, y] = g.cellXY(%d, %d); return [x + g.cs / 2, y + g.cs / 2]; })()" % (c, r))
        tap(cv['x'] + xy[0], cv['y'] + xy[1]); pg.wait_for_timeout(500)
    def status(): return pg.evaluate("(() => { const g = __wb.G.mg; return g.people.map(p => p.id + (p.fit ? ':ok' : ':' + p.why)).join(' | '); })()")
    if which == 'plain':
        pg.screenshot(path='%s/%s-bp-plain-play.png' % (out, tag))
        def pick(k, ok):
            pg.evaluate("document.querySelector('[data-slot=%s] [data-plain=\"%d\"]').click()" % (k, ok)); pg.wait_for_timeout(200)
        pick('who', 1); pick('what', 0); pick('when', 1)
        pg.evaluate("document.querySelector('.send').click()"); pg.wait_for_timeout(500)
        print('why:', pg.evaluate("document.querySelector('.memo .why').textContent"))
        pg.screenshot(path='%s/%s-bp-plain-wrong.png' % (out, tag))
        pick('what', 1)
        pg.screenshot(path='%s/%s-bp-plain-filled.png' % (out, tag)); print('note:', pg.evaluate("document.querySelector('.preview').textContent")); pg.evaluate("document.querySelector('.send').click()")
    else:
        pg.screenshot(path='%s/%s-bp-%s-play0.png' % (out, tag, which)); print('start ', status())
        if which == 'quiet':
            btn(1); btn(1); pg.wait_for_timeout(600); print('same  ', status())
            pg.screenshot(path='%s/%s-bp-%s-same.png' % (out, tag, which))
            btn(1)  # third tap turns it off
            btn(0); cell(5, 3); print('one   ', status()); pg.screenshot(path='%s/%s-bp-%s-one.png' % (out, tag, which))
            cell(0, 3)
        else:
            btn(0); pg.wait_for_timeout(600); print('soft  ', status()); pg.screenshot(path='%s/%s-bp-%s-same.png' % (out, tag, which))
            btn(1); cell(0, 0); print('lamp  ', status()); pg.screenshot(path='%s/%s-bp-%s-one.png' % (out, tag, which))
            if not pg.evaluate("__wb.G.mg.allFit"): cell(1, 3)
        print('end   ', status()); pg.wait_for_timeout(300)
        pg.screenshot(path='%s/%s-bp-%s-solved.png' % (out, tag, which))
    pg.wait_for_timeout(2500); pg.screenshot(path='%s/%s-bp-%s-result.png' % (out, tag, which))
    print(pg.evaluate("JSON.stringify(__wb.state().sketch || null)"), 'errors', errs)
    b.close()
