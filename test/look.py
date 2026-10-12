# Screenshots of the opening on desktop or phone: Today card, the room, Bea's walk, the trail, signposts, phone, barrier, evening page.
import sys, time, json
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'
out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'
tag = 'm' if mobile else 'd'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&v1=1&fast=1&mute=1&seed=5')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def shot(n, wait=500):
        pg.wait_for_timeout(wait); pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(250); pg.screenshot(path='%s/%s-%s.png' % (out, tag, n))
    def until(js, t=30000):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("__wb.waiter() === 'barrier'") and 'barrier' not in js: pg.evaluate("__wb.choose(0)")
            pg.wait_for_timeout(150)
        return False
    pg.evaluate("document.querySelector('#tNew').click()")
    until("__wb.panel() && __wb.panel().includes('creator')"); shot('01-creator')
    pg.evaluate("document.querySelector('#done').click()")
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')")
        if i == 0: shot('02-setup')
        pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % [0, 0, 4, 1, 2, 1][i])
    until("__wb.panel() && __wb.panel().includes('today')", 60000); shot('03-today')
    pg.evaluate("document.querySelector('#tgo').click()")
    until("__wb.mode() === 'play' && !__wb.busy()"); shot('04-home', 900)
    pg.evaluate("__wb.G.exitRoom()"); until("__wb.loc() === 'town' && !__wb.busy()"); shot('05-outside', 1200)
    pg.evaluate("__wb.way()"); shot('06-way', 1500)
    for k in range(10):
        pg.wait_for_timeout(1500)
        pg.evaluate('__wb.state().energy = 100')  # (fast time drains a day's energy in seconds; this walk is for looking)
        pos = pg.evaluate("[__wb.G.player.root.position.x, __wb.G.player.root.position.z, __wb.G.npcs.bea.c.root.position.x, __wb.G.npcs.bea.c.root.position.z, __wb.G.path.length]")
        print('pos', [round(v, 1) for v in pos])
        if k in (1, 3, 5, 8): shot('07-walk%d' % k, 100)
        if pg.evaluate("__wb.waiter() === 'barrier'"): pg.evaluate("__wb.choose(0)")
        if not pos[4]: pg.evaluate("__wb.way()")
    pg.evaluate("__wb.G.togglePhone()"); shot('08-phone', 600)
    pg.evaluate("document.querySelector('[data-tab=map]').click()"); shot('09-map', 500)
    pg.evaluate("__wb.G.togglePhone()")
    pg.evaluate("__wb.tp([12, 13.6])"); pg.wait_for_timeout(300); pg.evaluate("__wb.act()")
    until("__wb.waiter() === 'barrier'", 20000); shot('10-barrier', 600)
    print('errors', errs[:5])
    b.close()
