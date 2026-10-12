# Screenshots of the Lantern People guide, a person page, notes, and a reveal postcard.
from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
import sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
mobile = len(sys.argv) > 1 and sys.argv[1] == 'mobile'
out = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/shots'; tag = 'm' if mobile else 'd'
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file://' + REPO + '/dist/who-bends.html?test=1&v1=1&fast=1&mute=1&seed=4')
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
    pg.evaluate("(() => { const S = __wb.state(); ['pip','moss','bea','gil','wren'].forEach(k => S.met[k] = true); const st = __wb.G.story; st.know('pip','love'); st.know('pip','over'); st.know('pip','no'); st.know('moss','over'); st.know('gil','over'); st.fieldNote('fit'); })()")
    pg.wait_for_timeout(500)
    pg.evaluate("__wb.G.togglePhone()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-tab=notebook]').click()"); pg.wait_for_timeout(1200); pg.screenshot(path='%s/%s-people.png' % (out, tag))
    pg.evaluate("document.querySelector('[data-person=pip]').click()"); pg.wait_for_timeout(600); pg.screenshot(path='%s/%s-person.png' % (out, tag))
    pg.evaluate("document.querySelector('[data-person]') ; document.querySelector('#pback').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-person=you]').click()"); pg.wait_for_timeout(600); pg.screenshot(path='%s/%s-you.png' % (out, tag))
    pg.evaluate("document.querySelector('[data-sub=notes]').click()"); pg.wait_for_timeout(400); pg.screenshot(path='%s/%s-notes.png' % (out, tag))
    pg.evaluate("__wb.G.togglePhone()"); pg.wait_for_timeout(300)
    pg.evaluate("__wb.G.story.know('pip', 'helps'); __wb.G.run(() => __wb.G.story.flushReveals())"); pg.wait_for_timeout(800); pg.screenshot(path='%s/%s-postcard.png' % (out, tag))
    pg.wait_for_timeout(600); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    print('notes after Pip reveal:', pg.evaluate("Object.keys(__wb.state().notes || {}).join(',')"))
    print('hearsay line:', pg.evaluate("(() => { const S = __wb.state(); S.pronoun = 'she'; S.hearsay = ['pip']; S.lg = { pip: 0 }; return __wb.G.story.eveningData(1).news.join(' | '); })()"))
    print('rue pitch:', pg.evaluate("(() => { __wb.state().day = 2; return 'ok'; })()"))
    print('errors', errs)
    b.close()
