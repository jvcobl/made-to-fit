# Screenshots of the phone, Blend, Lantern, Fix-It, a hint, the council and the festival, by driving state directly.
import time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
D = '/home/claude/wb4/test/tour'
import os; os.makedirs(D, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1280, 'height': 760})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mute=1&seed=8'); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('#begin').click()")
    def drain(n=60):
        for i in range(n):
            st = pg.evaluate("[__wb.panel(), __wb.waiter(), __wb.mode(), __wb.busy()]")
            if st[0] and 'creator' in st[0]: pg.evaluate("document.querySelector('[data-k=shape] [data-v=tall]').click(); document.querySelector('[data-k=color] [data-v=\"#bfa9f0\"]').click(); document.querySelector('[data-k=wear] [data-v=hat]').click(); document.querySelector('#done').click()")
            elif st[0] and 'setup' in st[0]: pg.evaluate("document.querySelectorAll('.scale button')[0].click(); document.querySelector('#next').click()")
            elif st[1] == 'line': pg.evaluate('__wb.adv()')
            elif st[1] == 'choice': return 'choice'
            elif st[1] == 'barrier': return 'barrier'
            elif st[2] == 'play' and not st[3]: return 'play'
            pg.wait_for_timeout(150)
        return None
    def shot(n): pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(250); pg.screenshot(path=D + '/' + n + '.png')
    print('a', drain(120))
    G = '__wb.G'
    # give the season some history
    pg.evaluate(G + ".installBlend(); __wb.state().blend.score = 85; __wb.state().blend.streak = 2; " + G + ".badge('first'); __wb.state().fixes = { quiet: 'proposal', board: 'ready', dim: 'idea' }; __wb.state().support = { quiet: ['moss'], board: ['bea', 'pip'] }; __wb.state().met = { bea: 1, moss: 1, pip: 1, wren: 1 }; __wb.state().lantern.entries = { henderson: { reading: 'Take it at face value', pending: 'wrong', result: 'wrong', by: 'gil' }, comein: { reading: 'Ask what they mean', result: 'asked', by: 'wren' } }")
    pg.evaluate("__wb.state().min = 660"); pg.evaluate("__wb.tp([30, 30])"); pg.wait_for_timeout(800)
    for tab in ['today', 'map', 'blend', 'lantern', 'fix', 'texts']:
        pg.evaluate(G + ".phoneOpen || " + G + ".togglePhone(); " + G + ".ui.phoneTab = '%s'; " % tab + G + ".ui.renderPhone()"); shot('phone-' + tab)
    pg.evaluate(G + ".togglePhone()")
    pg.evaluate("document.querySelector('#maptoggle') && 0")
    pg.evaluate(G + ".phoneOpen || " + G + ".togglePhone(); " + G + ".ui.phoneTab = 'map'; " + G + ".ui.mapAll = true; " + G + ".ui.renderPhone()"); shot('phone-map-all'); pg.evaluate(G + ".togglePhone(); " + G + ".ui.mapAll = false")
    # a hint: talk to Gil in the Works on day 1
    pg.evaluate("__wb.state().min = 520; __wb.state().day = 1"); pg.evaluate("__wb.tp([12, 13.4])"); pg.wait_for_timeout(400); pg.evaluate('__wb.act()')
    for i in range(80):
        st = pg.evaluate("[__wb.waiter(), __wb.loc()]")
        if st[0] == 'barrier': shot('works-barrier'); pg.evaluate('__wb.choose(0)')
        elif st[0] == 'line':
            txt = pg.inner_text('#dialog .text')
            if 'Henderson' in txt: shot('hint-line')
            pg.evaluate('__wb.adv()')
        elif st[0] == 'choice':
            txt = pg.inner_text('#dialog')
            if 'face value' in txt: shot('hint-choice')
            pg.evaluate('__wb.choose(0)')
        pg.wait_for_timeout(150)
        if pg.evaluate('__wb.loc()') == 'town' and i > 10: break
    shot('after-shift')
    # the council
    pg.evaluate("__wb.state().day = 3; __wb.state().min = 1079; __wb.state().flags.hollis_archive = true; __wb.state().fixes.board = 'ready'; __wb.state().support.board = ['bea', 'pip']")
    pg.evaluate("__wb.tp([30, 30])"); pg.wait_for_timeout(1500)
    for i in range(120):
        st = pg.evaluate("[__wb.waiter(), __wb.loc(), __wb.mode(), __wb.busy()]")
        if st[1] == 'hall' and i in (8, 30): shot('council-%d' % i)
        if st[0] == 'line': pg.evaluate('__wb.adv()')
        elif st[0] == 'choice': shot('council-choice'); pg.evaluate('__wb.choose(0)')
        elif st[0] == 'barrier': shot('council-barrier'); pg.evaluate('__wb.choose(0)')
        elif st[1] == 'town' and i > 20 and not st[3]: break
        pg.wait_for_timeout(150)
    pg.evaluate("__wb.state().min = 1196"); pg.wait_for_timeout(2500)
    for i in range(40):
        st = pg.evaluate("[__wb.waiter(), __wb.mode(), __wb.busy()]")
        if st[0] == 'line': pg.evaluate('__wb.adv()')
        elif st[0] == 'barrier': pg.evaluate('__wb.choose(0)')
        elif st[1] == 'play' and not st[2]: break
        pg.wait_for_timeout(150)
    pg.wait_for_timeout(600); shot('festival-play')
    print(errs[:6]); b.close()
