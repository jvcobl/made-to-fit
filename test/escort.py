# Day one at normal speed: step outside, follow Bea with "show the way", screenshot her speech bubbles.
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 1280, 'height': 760})
    ctx.add_init_script("try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant' })); } catch (e) {}")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&mute=1&seed=4')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def until(js, t=60000):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            pg.wait_for_timeout(200)
        return False
    pg.evaluate("document.querySelector('#tNew').click()"); pg.wait_for_timeout(1500); pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelector('#next').click()")
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    pg.evaluate("__wb.G.exitRoom()"); until("__wb.loc() === 'town' && !__wb.busy()")
    for k in range(16):
        pg.wait_for_timeout(1800)
        if not pg.evaluate("__wb.G.path.length") : pg.evaluate("__wb.way()")
        info = pg.evaluate("[Math.round(__wb.state().min), __wb.G.player.root.position.x.toFixed(1), __wb.G.player.root.position.z.toFixed(1), __wb.G.npcs.bea.c.root.position.x.toFixed(1), __wb.G.npcs.bea.c.root.position.z.toFixed(1), [...document.querySelectorAll('.bubble.on .bt')].map(b => b.textContent.slice(0, 40))]")
        print(info)
        if k % 3 == 1: pg.screenshot(path='%s/esc-%02d.png' % (out, k))
    print('errors', errs)
    b.close()
