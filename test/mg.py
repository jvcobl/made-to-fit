# Play the two Works mini-games with real pointer input and take screenshots: intro, play, results.
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'; prof = sys.argv[2] if len(sys.argv) > 2 else 'sens'
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'; tag = ('m' if mobile else 'd') + '-' + prof
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    ctx.add_init_script("try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant' })); } catch (e) {}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&mute=1&seed=9')
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    def shot(n, wait=400): pg.wait_for_timeout(wait); pg.screenshot(path='%s/%s-%s.png' % (out, tag, n))
    def until(js, t=40000, bar=0):
        t0 = time.time()
        while time.time() - t0 < t / 1000:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("__wb.waiter() === 'barrier'"): pg.evaluate("__wb.choose(%d)" % bar)
            if pg.evaluate("__wb.waiter() === 'choice'"): pg.evaluate("__wb.choose(0)")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('evening'))"): pg.evaluate("document.querySelector('#sleep').click()")
            pg.wait_for_timeout(150)
        print('TIMEOUT', js); return False
    pg.evaluate("document.querySelector('#begin').click()")
    pg.wait_for_timeout(1500); pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    until("__wb.panel() && __wb.panel().includes('creator')"); pg.evaluate("document.querySelector('#done').click()")
    vals = {'sens': [0, 0, 4, 0, 2, 0], 'std': [2, 2, 2, 2, 2, 2], 'lively': [4, 4, 0, 4, 2, 4]}[prof]
    for i in range(6):
        until("__wb.panel() && __wb.panel().includes('setup')"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % vals[i])
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 60000)
    def to_works():
        pg.evaluate("__wb.G.exitRoom()"); until("__wb.loc() === 'town' && !__wb.busy()")
        pg.evaluate("__wb.state().min < 485 && __wb.skip(485 - Math.floor(__wb.state().min))")
        pg.evaluate("__wb.tp([12, 13.6])")
        for _ in range(20):
            pg.wait_for_timeout(400)
            if pg.evaluate("__wb.target() === 'works'"): pg.evaluate("__wb.act()"); break
        until("__wb.mg() !== null", 60000)
    def tap(x, y):
        if mobile: pg.touchscreen.tap(x, y)
        else: pg.mouse.click(x, y)
    shots_v = {}
    for day, gid in ((1, 'sort'), (2, 'stamp')):
        to_works(); shot('mg-%s-intro' % gid, 900)
        go = pg.query_selector('.mg-over .go'); bb = go.bounding_box(); tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(600)
        cv = pg.query_selector('.mg-stage canvas').bounding_box()
        t0 = time.time(); k = 0
        while pg.evaluate("__wb.G.mg && __wb.G.mg.running") and time.time() - t0 < 70:
            k += 1
            if pg.evaluate("__wb.G.mg.room && __wb.G.mg.room.blocking()"):
                vb = pg.query_selector('.mg-visit [data-v=%s]' % ('later' if k % 2 else 'sure'))
                if vb and not shots_v.get(gid): shot('mg-%s-visit' % gid, 350); shots_v[gid] = 1
                vb = pg.query_selector('.mg-visit [data-v=%s]' % ('later' if k % 2 else 'sure'))
                if vb: bb2 = vb.bounding_box(); tap(bb2['x'] + bb2['width'] / 2, bb2['y'] + bb2['height'] / 2)
                pg.wait_for_timeout(300); continue
            if gid == 'sort':
                i = pg.evaluate("(() => { const g = __wb.G.mg; const c = g.queue[0]; if (!c) return -1; return g.cubbies.findIndex(cb => cb.s === c.s); })()")
                if i >= 0:
                    cb = pg.evaluate("(() => { const c = __wb.G.mg.cubbies[%d]; return [c.x + c.w / 2, c.y + c.h / 2]; })()" % i)
                    tap(cv['x'] + cb[0], cv['y'] + cb[1])
                pg.wait_for_timeout(350)
            else:
                st = pg.evaluate("(() => { const g = __wb.G.mg; const f = g.cur(); if (!f || g.anim) return null; return { diff: f.diff, rows: [0,1,2,3].map(r => [g.rx + g.rw / 2, g.ry + r * g.rh + 16]), stamps: g.stamps.map(s => [s.x + s.w / 2, s.y + s.h / 2]), id: f.id }; })()")
                if st:
                    keys = ['shape', 'color', 'top', 'pattern']
                    for r, kk in enumerate(keys):
                        if kk in st['diff']: tap(cv['x'] + st['rows'][r][0], cv['y'] + st['rows'][r][1]); pg.wait_for_timeout(120)
                    if k < 3: shot('mg-%s-play%d' % (gid, k), 100)
                    s = st['stamps'][1 if st['id'] in ('bea', 'you') else 0]; tap(cv['x'] + s[0], cv['y'] + s[1])
                pg.wait_for_timeout(500)
            if gid == 'sort' and k in (8, 30): shot('mg-%s-play%d' % (gid, k), 50)
        pg.evaluate("__wb.G.mg && __wb.G.mg.running && __wb.G.mg.end()")
        shot('mg-%s-result' % gid, 1500)
        r = pg.query_selector('.mg-over .go'); 
        if r: bb = r.bounding_box(); tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        until("!__wb.mg() && __wb.loc() === 'town' && !__wb.busy()", 60000)
        if day == 1:
            pg.evaluate("__wb.G.story.finishDay('sleep')")
            until("!!(__wb.panel() && __wb.panel().includes('evening'))", 60000) and shot('evening1', 600)
            until("__wb.state().day === 2 && __wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 90000)
    print('errors', errs[:6])
    b.close()
