# Reading time and sonder: text that carries meaning stays long enough to read, pauses under the pointer, can be closed,
# and with "Until I close it" waits for you; standing still in town shows a passerby's day.
# Usage: python3 test/reading.py
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
from drive import ARGS, BASE, drive_to, free

results = []
def check(name, ok, info=None):
    results.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else '  ' + json.dumps(info, default=str)[:400]))

CARD = ("<span class='cardline'><b>A test card</b></span><span class='tsub'>Curb cuts, the small ramps where a sidewalk meets the street, "
        "were won by wheelchair users and turned out to help parents with strollers, travelers with suitcases and workers with carts.</span>")
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&mute=1&seed=12'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    ms = pg.evaluate("__wb.G.ui.readMs(%s)" % json.dumps(CARD))
    check('a 30-word card gets at least 10 seconds', ms >= 10000, ms)
    n = pg.evaluate("__wb.G.ui.readMs('Night.', 1200)"); check('a one-word line stays short (1.2 to 2.5 s)', 1200 <= n <= 2500, n)
    # into the day and out in town (no panel over the notices)
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    pg.evaluate("__wb.sliceTo('tomarket')")
    if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=60)
    pg.evaluate("__wb.G.sonder.cool = 999")  # (no passersby while the notices are tested)
    # normal: the card outlives the old 5.2 s, then goes by itself
    pg.evaluate("__wb.G.ui.toast(%s, 'cardt', 5200)" % json.dumps(CARD)); pg.mouse.move(5, 700)
    pg.wait_for_timeout(7000); check('the card is still up after 7 s', pg.evaluate("!!document.querySelector('#toasts .toast.cardt:not(.out)')"))
    pg.wait_for_timeout(ms - 7000 + 1500); check('it goes by itself once read', not pg.evaluate("!!document.querySelector('#toasts .toast.cardt')"))
    # hovering pauses it
    pg.evaluate("__wb.G.ui.toast('<b>Hover test</b> a short notice with a few words in it', 'idea', 3000)")
    pg.hover('#toasts .toast.idea'); short = pg.evaluate("__wb.G.ui.readMs('Hover test a short notice with a few words in it', 3000)")
    pg.wait_for_timeout(short + 2500); check('hovering keeps a notice up past its time', pg.evaluate("!!document.querySelector('#toasts .toast.idea:not(.out)')"))
    pg.mouse.move(5, 700); pg.wait_for_timeout(short + 1500); check('moving away lets it go', not pg.evaluate("!!document.querySelector('#toasts .toast.idea')"))
    # "Until I close it"
    pg.evaluate("__wb.G.settings.readTime = 'hold'")
    pg.evaluate("__wb.G.ui.toast(%s, 'cardt', 5200)" % json.dumps(CARD)); pg.mouse.move(5, 700)
    pg.wait_for_timeout(16000); check('with Until I close it, a card stays up', pg.evaluate("!!document.querySelector('#toasts .toast.cardt:not(.out)')"))
    pg.click('#toasts .toast.cardt .tclose'); pg.wait_for_timeout(700); check('the close button closes it', not pg.evaluate("!!document.querySelector('#toasts .toast.cardt')"))
    pg.evaluate("(() => { window.__capDone = false; __wb.G.ui.caption('A caption that waits for you.', 1000).then(() => { window.__capDone = true; }); })()")
    pg.wait_for_timeout(6000); check('a caption waits for you', pg.evaluate("!window.__capDone && document.querySelector('#caption').classList.contains('on')"))
    check('and says how to go on', 'to continue' in pg.evaluate("document.querySelector('#caption').textContent"))
    pg.click('#caption'); pg.wait_for_timeout(900); check('a click moves on', pg.evaluate('window.__capDone'))
    pg.evaluate("__wb.G.settings.readTime = 'normal'")
    pg.evaluate("(() => { window.__capDone = false; __wb.G.ui.caption('Night.', 1200).then(() => { window.__capDone = true; }); })()")
    pg.wait_for_timeout(2200); check('in Normal, a short caption moves on by itself', pg.evaluate('window.__capDone'))
    # sonder: out in town, standing still
    pg.evaluate("__wb.G.sonder.cool = 0; __wb.tp([28.5, 34.5])"); pg.wait_for_timeout(500)
    t0 = time.time(); got = []
    while time.time() - t0 < 20 and not got:
        got = pg.evaluate("[...document.querySelectorAll('.pop.thought')].map((e) => e.textContent)"); pg.wait_for_timeout(400)
    check('standing still in town, a passerby shows their day', got, pg.evaluate("({ mode: __wb.G.mode, loc: __wb.G.loc, waiter: __wb.waiter(), panel: __wb.panel(), crowd: __wb.G.crowd.filter((a) => a.active).length })"))
    pg.wait_for_timeout(1500)
    check('the first time, the game names it (sonder)', pg.evaluate("[...document.querySelectorAll('#toasts .toast')].some((t) => /Sonder/.test(t.textContent))") or pg.evaluate("!!__wb.state().flags.sonderSeen"))
    check('and the note is in the notebook', pg.evaluate("!!(__wb.state().notes || {}).sonder"))
    check('no page errors', not errors, errors)
    b.close()
print(json.dumps({'ok': all(r[1] for r in results), 'failed': [r[0] for r in results if not r[1]]}))
