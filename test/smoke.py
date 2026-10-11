import sys, time
from playwright.sync_api import sync_playwright
url = 'file:///home/claude/wb4/dist/who-bends.html?test=1&mute=1&seed=3' + (sys.argv[1] if len(sys.argv) > 1 else '')
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760})
    errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:500]))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.screenshot(path='/home/claude/wb4/test/s_title.png')
    print('mode', pg.evaluate('__wb.mode()'), 'panel', pg.evaluate('__wb.panel()'))
    pg.click('#tNew'); pg.wait_for_timeout(3000)
    pg.screenshot(path='/home/claude/wb4/test/s_pro1.png')
    for i in range(40):
        pnl = pg.evaluate('__wb.panel()')
        if pnl and 'creator' in pnl: break
        pg.wait_for_timeout(500)
    pg.wait_for_timeout(800)
    pg.screenshot(path='/home/claude/wb4/test/s_creator.png')
    print('panel', pg.evaluate('__wb.panel()'))
    print('\n'.join(errs[:12]))
    b.close()
