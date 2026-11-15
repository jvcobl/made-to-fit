# The first day saves as you play and picks up where it was: your room half set, the stage and its two threads, the
# town's colours, your guests, the marks you tagged, your cards, and Bea back at the Works steps if that's where the day
# had her. A save made by the version before this one (a fixed day, with other names for its moments) loads at the
# same moment of this one.
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
    check('a new game is the new first day, starting in your room', pg.evaluate("!!__wb.state().v2 && __wb.state().slice.stage === 'room'"), pg.evaluate("__wb.state().slice"))
    check('the room starts the way it came: bright, and the door not yet for going out', pg.evaluate("__wb.G.rooms.home.prefs.light > 0.85 && __wb.G.rooms.home.inter.find((i) => i.id === 'out').hidden === true"))
    # set two things (the lamp with the keyboard), save, and come back
    pg.evaluate("__wb.G.place([-0.4, -1.5])"); pg.wait_for_timeout(500)
    check('standing by the lamp, the prompt offers it', pg.evaluate("__wb.target()") == 'lamp', pg.evaluate("__wb.target()"))
    pg.keyboard.press('e'); pg.wait_for_function("__wb.panel() && __wb.panel().includes('taps')", timeout=20000); pg.keyboard.press('1')
    pg.wait_for_function("__wb.slice().room === 1 && !__wb.busy()", timeout=20000)
    pg.evaluate("__wb.G.place([2.8, -1.8])"); pg.wait_for_timeout(500); pg.keyboard.press('e'); pg.wait_for_function("__wb.panel() && __wb.panel().includes('taps')", timeout=20000); pg.keyboard.press('2')
    pg.wait_for_function("__wb.slice().room === 2 && !__wb.busy()", timeout=20000)
    check('two things set: the lamp soft, the radio lively', pg.evaluate("(() => { const P = __wb.state().profile; return P.light === 0.22 && P.sound === 0.78; })()"), pg.evaluate("__wb.state().profile"))
    check('it saves in the middle of setting the room', pg.evaluate("__wb.G.story.autosave(true)"))
    pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate("document.querySelector('#tCont').click()")
    drive_to(pg, lambda st: free(st) and st['loc'] == 'home', budget=90)
    check('Continue: still in your room, two of six set, and shown that way', pg.evaluate("(() => { const s = __wb.slice(); return s.stage === 'room' && s.room === 2 && __wb.G.rooms.home.prefs.light === 0.22 && __wb.G.rooms.home.inter.find((i) => i.id === 'out').hidden === true; })()"), pg.evaluate("[__wb.slice(), __wb.G.rooms.home.prefs]"))
    check('the objective counts them', '(2/6)' in pg.evaluate("__wb.obj().t"), pg.evaluate("__wb.obj().t"))
    # into the afternoon: the Works, Bea at the steps, two streets in colour
    pg.evaluate("__wb.sliceTo('worksmarks')")
    if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=60)
    pg.evaluate("__wb.tp([16, 16.5])"); pg.wait_for_timeout(600)
    before = pg.evaluate("(() => { const S = __wb.state(); return { stage: [S.slice.stage, S.slice.mk, S.slice.wk], color: S.color, guests: Object.keys(S.guests).sort(), marks: Object.keys(S.marks).sort(), cards: Object.keys(S.cards).sort(), fixes: S.fixes } })()")
    ok = pg.evaluate("__wb.G.story.autosave(true)")
    check('it saves mid-day', ok)
    pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    label = pg.evaluate("(document.querySelector('#tCont small') || {}).textContent || ''")
    check('the title offers Continue, Monday afternoon', 'Monday' in label, label)
    pg.evaluate("document.querySelector('#tCont').click()")
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=90)
    pg.wait_for_timeout(1500)
    after = pg.evaluate("(() => { const S = __wb.state(); return { stage: [S.slice.stage, S.slice.mk, S.slice.wk], color: S.color, guests: Object.keys(S.guests).sort(), marks: Object.keys(S.marks).sort(), cards: Object.keys(S.cards).sort(), fixes: S.fixes } })()")
    for k in ('stage', 'color', 'guests', 'marks', 'cards', 'fixes'): check('kept: ' + k, before[k] == after[k], [before[k], after[k]])
    check('the objective is the Works', 'Works' in pg.evaluate("__wb.obj().t"), pg.evaluate("__wb.obj()"))
    bea = pg.evaluate("(() => { const q = __wb.G.npcs.bea.c.root.position; return [q.x, q.z, __wb.G.npcs.bea.place] })()")
    check('Bea is back at the Works steps', bea[2] == 'town' and abs(bea[0] - 13.4) < 2.5 and abs(bea[1] - 14.2) < 2.5, bea)
    check('the guest list shows', pg.evaluate("!document.querySelector('#hud .gstrip').hidden"))
    check('the porch lanterns are up, yours teal', pg.evaluate("__wb.G.town.porchMode(1) === 'teal' && __wb.G.town.fixGroups.lanterns.visible"))
    check('the quiet corner is up', pg.evaluate("__wb.G.town.fixGroups.quiet.visible"))
    check('the day stands where it was: the square done, the Works being looked at', after['stage'] == ['open', 'done', 'marks'], after['stage'])
    # a save from the version before this one: the same moment, under its old name
    def old_save(stage, extra=''):
        # (the save is rewritten from the title screen, where no game is running: a game in progress saves itself as
        # the page closes, and would write over the change)
        pg.evaluate("__wb.G.story.autosave(true)")
        pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
        pg.evaluate("(a) => { const r = JSON.parse(localStorage.getItem('mtf.save')); const sl = r.S.slice; r.S.slice = { stage: a[0], porch: sl.porch, blend: sl.blend }; if (a[1] === 'nolantern') { r.S.flags.lantern = 0; r.S.resumeAt = { loc: 'home', x: 0, z: 0, h: 0 }; r.S.guests = {}; } if (a[1] === 'square') r.S.resumeAt = { loc: 'town', x: 27.5, z: 31.5, h: 0 }; localStorage.setItem('mtf.save', JSON.stringify(r)); }", [stage, extra])
        pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
        pg.evaluate("document.querySelector('#tCont').click()")
        drive_to(pg, lambda st: free(st), budget=90); pg.wait_for_timeout(800)
        return pg.evaluate("__wb.slice()")
    s2 = old_save('gil')
    check('an old save at "gil" opens at the same moment: the square done, Gil waiting', s2 and s2['stage'] == 'open' and s2['mk'] == 'done' and s2['wk'] == 'gil' and s2['room'] == 6, s2)
    check('  and the objective is Gil', 'Gil' in pg.evaluate("__wb.obj().t"), pg.evaluate("__wb.obj()"))
    s3 = old_save('moss', 'square')   # (that save was made standing in the square)
    check('an old save at "moss" opens with the square seen and its people still to ask', s3 and s3['stage'] == 'open' and s3['mk'] == 'ask' and s3['wk'] == 'go', s3)
    s4 = old_save('wake', 'nolantern')
    check('an old save from the first morning opens with Wren at the door, its room as it was set', s4 and s4['stage'] == 'door' and s4['room'] == 6, s4)
    check('no page errors', not errors, errors)
    print(json.dumps({'ok': all(c[1] for c in checks), 'failed': [c[0] for c in checks if not c[1]]}))
    b.close()
    sys.exit(0 if all(c[1] for c in checks) else 1)
