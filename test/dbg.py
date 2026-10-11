import json, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1000, 'height': 640})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mute=1&seed=5'); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('#begin').click()")
    def pump(n, label):
        for i in range(n):
            st = pg.evaluate("(() => { const s = __wb.state(); return [__wb.mode(), __wb.busy(), __wb.waiter(), __wb.panel(), s.day, Math.round(s.min), __wb.loc(), Math.round(__wb.G.stage.fade*100)/100, __wb.G.stage.fadeT] })()")
            if st[3] and 'creator' in st[3]: pg.evaluate("document.querySelector('#done').click()")
            elif st[3] and 'setup' in st[3]: pg.evaluate("document.querySelector('#next').click()")
            elif st[2] in ('line',): pg.evaluate('__wb.adv()')
            elif st[2] == 'choice': pg.evaluate('__wb.choose(0)')
            elif st[2] == 'barrier': pg.evaluate("__wb.choose(4)")
            if i % 5 == 0: print(label, st)
            pg.wait_for_timeout(200)
    pump(40, 'pro')
    pg.evaluate("__wb.G.mode='play'; __wb.G.busy=0; __wb.tp([9.5, 37.8]); __wb.state().min = 1262")
    pg.wait_for_timeout(300); print('target', pg.evaluate('__wb.target()')); pg.evaluate('__wb.act()')
    pump(40, 'night')
    print(errs[:5]); b.close()
