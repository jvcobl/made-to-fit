from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1000, 'height': 640})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.type + ' ' + m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&seed=4'); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('#begin').click()")
    for i in range(200):
        st = pg.evaluate("[__wb.panel(), __wb.waiter(), __wb.mode(), __wb.busy()]")
        if st[0] and 'creator' in st[0]: pg.evaluate("document.querySelector('[data-k=voice] [data-v=whistle]').click(); document.querySelector('#done').click()")
        elif st[0] and 'setup' in st[0]: pg.evaluate("document.querySelector('#next').click()")
        elif st[1] == 'line': pg.evaluate('__wb.adv()')
        elif st[1] == 'choice': pg.evaluate('__wb.choose(0)')
        elif st[1] == 'barrier': pg.evaluate('__wb.choose(1)')
        elif st[2] == 'play' and not st[3]: break
        pg.wait_for_timeout(100)
    info = pg.evaluate("(() => { const A = __wb.G.audio; return { ready: A.ready, state: A.ctx && A.ctx.state, scene: A.scene, rate: A.ctx && A.ctx.sampleRate } })()")
    print('audio', info)
    for spot, m in [('square', 700), ('farend', 760), ('transit', 1050)]:
        pg.evaluate("__wb.state().min = %d; __wb.tp('%s')" % (m, spot)); pg.wait_for_timeout(1500)
        print(spot, pg.evaluate("[__wb.G.audio.scene, __wb.zone(), Math.round(__wb.G.audio.pressure*100)/100]"))
    pg.evaluate("__wb.G.audio.sfx('blend'); __wb.G.audio.sfx('fix'); __wb.G.audio.sfx('lantern'); __wb.G.audio.announce('route twelve'); __wb.G.audio.voice('click', 1, 'hello there friend')"); pg.wait_for_timeout(800)
    print('errors', errs[:6]); b.close()
