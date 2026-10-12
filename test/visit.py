# The interruption visitor: keyboard "2" defers, the Sure button answers, the results mention who waited.
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'; game = sys.argv[2] if len(sys.argv) > 2 else 'sort'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
    ctx.add_init_script("try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant' })); } catch (e) {}")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&v1=1&fast=1&mgslow=1&mute=1&seed=4')
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
    pg.evaluate("__wb.mgTest('%s')" % game)
    until("__wb.mg() !== null"); pg.wait_for_timeout(1500)
    def tap(x, y):
        if mobile: pg.touchscreen.tap(x, y)
        else: pg.mouse.click(x, y)
    go = pg.query_selector('.mg-over .go').bounding_box(); tap(go['x'] + go['width'] / 2, go['y'] + go['height'] / 2); pg.wait_for_timeout(600)
    pg.evaluate("(() => { const r = __wb.G.mg.room; r.m.interrupt = 0.9; r.intT = 0.2; })()")
    until("__wb.G.mg.room.int && __wb.G.mg.room.int.phase === 'ask'"); pg.wait_for_timeout(700)
    pg.screenshot(path='%s/%s-visit-%s-ask.png' % (out, tag, game))
    print('visit opacity', pg.evaluate("getComputedStyle(document.querySelector('.mg-visit')).opacity"), pg.evaluate("document.getAnimations().map(a => a.animationName + ':' + a.playState + ':' + Math.round(a.currentTime)).join(', ')"))
    who = pg.evaluate("__wb.G.mg.room.int.face.name")
    # a tap on the work nudges instead of answering
    cv = pg.query_selector('.mg-stage canvas').bounding_box(); tap(cv['x'] + cv['width'] / 2, cv['y'] + cv['height'] - 60); pg.wait_for_timeout(200)
    print('after canvas tap phase:', pg.evaluate("__wb.G.mg.room.int && __wb.G.mg.room.int.phase"))
    if mobile:
        bb = pg.query_selector('.mg-visit [data-v=later]').bounding_box(); tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    else: pg.keyboard.press('2')
    pg.wait_for_timeout(250); pg.screenshot(path='%s/%s-visit-%s-later.png' % (out, tag, game))
    print('deferred:', pg.evaluate("__wb.G.mg.room.deferred.map(f => f.name)"), 'who', who)
    until("!__wb.G.mg.room.int"); pg.evaluate("__wb.G.mg.room.intT = 0.2")
    until("__wb.G.mg.room.int && __wb.G.mg.room.int.phase === 'ask'"); pg.wait_for_timeout(600)
    who2 = pg.evaluate("__wb.G.mg.room.int.face.name"); print('second visitor', who2)
    bb = pg.query_selector('.mg-visit [data-v=sure]').bounding_box(); tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(300)
    pg.screenshot(path='%s/%s-visit-%s-talk.png' % (out, tag, game))
    print('phase after sure:', pg.evaluate("__wb.G.mg.room.int && __wb.G.mg.room.int.phase"), 'answered', pg.evaluate("__wb.G.mg.room.answered"))
    until("!__wb.G.mg.room.int"); pg.evaluate("__wb.G.mg.room.intT = 0.2"); pg.wait_for_timeout(2500)
    print('third visit (should be none if everyone deferred or the other came back):', pg.evaluate("__wb.G.mg.room.int ? __wb.G.mg.room.int.face.name : null"))
    pg.evaluate("__wb.G.mg.room.int = null; __wb.G.mg.hideVisit(); __wb.G.mg.end()"); pg.wait_for_timeout(1800)
    pg.screenshot(path='%s/%s-visit-%s-result.png' % (out, tag, game))
    pg.wait_for_timeout(3000); pg.screenshot(path='%s/%s-visit-%s-result2.png' % (out, tag, game))
    print('result opacity', pg.evaluate("getComputedStyle(document.querySelector('.mg-result')).opacity"), pg.evaluate("document.getAnimations().map(a => a.animationName + ':' + a.playState + ':' + Math.round(a.currentTime)).join(', ')"))
    print(pg.evaluate("document.querySelector('.mg-result') && document.querySelector('.mg-result').innerText"))
    print('ask stat', pg.evaluate("JSON.stringify([__wb.state().stats.ask, __wb.state().stats.waits])"), 'errors', errs)
    b.close()
