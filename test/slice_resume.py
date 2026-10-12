# The first day saves as you play and picks up where it was: the stage, the town's colours, your guests, the marks
# you tagged, your cards, and Bea back at the Works steps if that's where the day had her. Also: the save code.
import json, sys, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
from drive import ARGS, BASE, drive_to, free

checks = []
def check(name, ok, info=None): checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name, '' if ok else info, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=12'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    check('a new game is the new first day', pg.evaluate("!!__wb.state().v2 && __wb.state().slice.stage === 'wake'"), pg.evaluate("__wb.state().slice"))
    # into the afternoon: the Works, Bea at the steps, two streets in colour
    pg.evaluate("__wb.sliceTo('worksmarks')")
    if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=60)
    pg.evaluate("__wb.tp([16, 16.5])"); pg.wait_for_timeout(600)
    before = pg.evaluate("(() => { const S = __wb.state(); return { stage: S.slice.stage, color: S.color, guests: Object.keys(S.guests).sort(), marks: Object.keys(S.marks).sort(), cards: Object.keys(S.cards).sort(), fixes: S.fixes } })()")
    ok = pg.evaluate("__wb.G.story.autosave(true)")
    check('it saves mid-day', ok)
    pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    label = pg.evaluate("(document.querySelector('#tCont small') || {}).textContent || ''")
    check('the title offers Continue, Monday afternoon', 'Monday' in label, label)
    pg.evaluate("document.querySelector('#tCont').click()")
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=90)
    pg.wait_for_timeout(1500)
    after = pg.evaluate("(() => { const S = __wb.state(); return { stage: S.slice.stage, color: S.color, guests: Object.keys(S.guests).sort(), marks: Object.keys(S.marks).sort(), cards: Object.keys(S.cards).sort(), fixes: S.fixes } })()")
    for k in ('stage', 'color', 'guests', 'marks', 'cards', 'fixes'): check('kept: ' + k, before[k] == after[k], [before[k], after[k]])
    check('the objective is the Works', 'Works' in pg.evaluate("__wb.obj().t"), pg.evaluate("__wb.obj()"))
    bea = pg.evaluate("(() => { const q = __wb.G.npcs.bea.c.root.position; return [q.x, q.z, __wb.G.npcs.bea.place] })()")
    check('Bea is back at the Works steps', bea[2] == 'town' and abs(bea[0] - 13.4) < 2.5 and abs(bea[1] - 14.2) < 2.5, bea)
    check('the guest list shows', pg.evaluate("!document.querySelector('#hud .gstrip').hidden"))
    check('the porch lanterns are up, yours teal', pg.evaluate("__wb.G.town.porchMode(1) === 'teal' && __wb.G.town.fixGroups.lanterns.visible"))
    check('the quiet corner is up', pg.evaluate("__wb.G.town.fixGroups.quiet.visible"))
    check('no page errors', not errors, errors)
    print(json.dumps({'ok': all(c[1] for c in checks), 'failed': [c[0] for c in checks if not c[1]]}))
    b.close()
    sys.exit(0 if all(c[1] for c in checks) else 1)
