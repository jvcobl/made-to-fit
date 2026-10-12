import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; tag = 'm' if mobile else 'd'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
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
        return False
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelector('#next').click()")
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("(() => { const S = __wb.state(); ['pip','moss','bea','gil','wren','rue'].forEach(k => S.met[k] = true); const st = __wb.G.story; st.know('wren','love'); st.know('wren','over'); st.know('gil','over'); st.know('bea','helps'); })()")
    pg.evaluate("__wb.mgTest('paint')"); until("__wb.mg() !== null"); pg.wait_for_timeout(900)
    pg.evaluate("document.querySelector('.mg-over .go').click()"); pg.wait_for_timeout(800)
    pg.evaluate("document.querySelector('.pf[data-id=wren]').click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-k=glow] [data-v=soft]').click(); document.querySelector('[data-k=color] [data-v=\"#ffcf7a\"]').click(); document.querySelector('[data-k=pattern] [data-v=plain]').click()")
    pg.wait_for_timeout(500); pg.screenshot(path='%s/%s-paint-1.png' % (out, tag))
    pg.evaluate("document.querySelector('.hang').click()"); pg.wait_for_timeout(700); pg.screenshot(path='%s/%s-paint-2.png' % (out, tag))
    pg.wait_for_timeout(2600)
    pg.evaluate("document.querySelector('.pf[data-id=bea]').click()"); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-k=pattern] [data-v=words]').click()"); pg.wait_for_timeout(300); pg.screenshot(path='%s/%s-paint-3.png' % (out, tag))
    pg.evaluate("document.querySelector('.hang').click()"); pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelector('.pdone') && document.querySelector('.pdone').click()"); pg.wait_for_timeout(1500); pg.screenshot(path='%s/%s-paint-end.png' % (out, tag))
    print(pg.evaluate("JSON.stringify(__wb.state().lanternsMade || null)"), 'errors', errs)
    b.close()
