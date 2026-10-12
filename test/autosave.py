# Saving as you play, the way a player meets it:
#  1. the creature is kept as soon as it is made: reload during the room setup, Continue ("Moving in") goes back to
#     the room with the same creature and name;
#  2. during the day the game saves by itself when play is calm; reload, and Continue says the day and the minute,
#     and puts you back at that minute, where you stood;
#  3. leaving the page (pagehide) saves first; opening the menu saves first and says what was saved;
#  4. "Play on another device": the code, and the save file (downloaded), opened on a fresh browser through
#     "Played before?" > "Open a save file", asks for the name and continues at the saved minute;
#  5. a later visit (ten years on) autosaves and continues the same way;
#  6. nothing autosaves during the prologue, a scene, the walk to the festival or the festival.
# usage: python3 test/autosave.py
import json, sys, time, os, tempfile
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=23'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:600]), flush=True)
SAVED = "(() => { try { const o = JSON.parse(localStorage.getItem('mtf.save')); return { phase: o.phase, label: o.label, day: o.day, act: o.act, min: Math.round(o.S.min), at: o.S.resumeAt || null, name: o.S.name, look: o.S.look, flags: o.S.flags } } catch (e) { return null } })()"
FREE = lambda st: st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'] and not st['ov'] and not st['mg']
def title(pg):
    pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000); pg.wait_for_timeout(300)
def wait_save(pg, pred, t=30):
    t0 = time.time(); s = None
    while time.time() - t0 < t:
        s = pg.evaluate(SAVED)
        if s and pred(s): return s
        pg.wait_for_timeout(200)
    return s

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 760}, accept_downloads=True)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); title(pg); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); title(pg)
    # 1. the creature, kept before the room is set
    pg.evaluate("document.querySelector('#tNew').click()")
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=60000)
    pg.click('#cname'); pg.keyboard.press('Control+A'); pg.keyboard.type('Robin')
    pg.evaluate("['[data-k=shape] [data-v=tall]', '[data-k=color] [data-v=\"#f6cf5b\"]', '[data-k=top] [data-v=horns]'].forEach((q) => document.querySelector('.creator ' + q).click())")
    pg.click('#done')
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('setup')", timeout=60000)
    s = pg.evaluate(SAVED)
    check('the creature is saved as soon as it is made', s and s['phase'] == 'setup' and s['name'] == 'Robin' and s['look']['shape'] == 'tall' and s['look']['top'] == 'horns', s)
    pg.click('.scale button >> nth=4'); pg.click('#next')  # one answer given, then the tab is closed
    pg.reload(); title(pg)
    lab = pg.evaluate("(document.querySelector('#tCont') || {}).innerText || ''")
    check('Continue says where: moving in', 'Moving in' in lab, lab)
    pg.click('#tCont')
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('setup')", timeout=60000)
    st = pg.evaluate("(() => { const S = __wb.state(); return { name: S.name, look: S.look, q: document.querySelector('#panel .q').innerText } })()")
    check('Continue goes back to the room, same creature and name', st['name'] == 'Robin' and st['look']['shape'] == 'tall' and st['look']['top'] == 'horns' and 'bright' in st['q'], st)
    # 2. into Monday; the game saves by itself once play is calm
    drive_to(pg, lambda st: FREE(st) and st['day'] == 1)
    s = wait_save(pg, lambda s: s['phase'] == 'free' and s['day'] == 1, 20)
    check('Monday: saved by itself during free play', s and s['phase'] == 'free' and s['at'] is not None, s)
    check('the save label says the day and the time', s and s['label'].startswith('Monday, ') and ('AM' in s['label'] or 'PM' in s['label']), s and s['label'])
    # Continue from a save made at home on Monday morning: back in your room, the lantern still on the sill, and Bea
    # still walks you to work when you step out
    check('the first Monday save is at home', s and s['at'] and s['at']['loc'] == 'home', s and s['at'])
    if s and s['at'] and s['at']['loc'] == 'home':
        pg.evaluate('__wb.G.timeScale = 0'); pg.evaluate("window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(200)
        pg.reload(); title(pg); pg.evaluate('__wb.G.timeScale = 0'); pg.click('#tCont')
        drive_to(pg, FREE, budget=60)
        st = pg.evaluate("(() => ({ loc: __wb.loc(), obj: __wb.obj().t, lantern: !!__wb.state().flags.lantern, min: Math.round(__wb.state().min) }))()")
        check('Continue from home on Monday morning: in your room, with the lantern still to pick up', st['loc'] == 'home' and 'windowsill' in st['obj'] and not st['lantern'], st)
        pg.evaluate('__wb.G.timeScale = 1'); pg.evaluate("__wb.G.run(() => __wb.G.exitRoom())")
        ok = True
        try: pg.wait_for_function("!!(__wb.G.beaWay || __wb.state().flags.escort)", timeout=20000)
        except Exception: ok = False
        check('stepping out after Continue: Bea still walks you to the Works', ok, pg.evaluate("({ loc: __wb.loc(), min: __wb.state().min, flags: __wb.state().flags })"))
        # (let the walk end: past ten, Bea goes on without you, and saving resumes)
        pg.evaluate('__wb.state().min = Math.max(__wb.state().min, 605)')
        pg.wait_for_function('!__wb.G.beaWay', timeout=20000)
        drive_to(pg, FREE, budget=60)
    # walk somewhere in town, then leave the page: it saves on the way out (the clock slowed, to compare minutes)
    pg.evaluate('__wb.G.timeScale = 0.2')
    pg.evaluate("__wb.tp('commons')"); pg.wait_for_timeout(600)
    drive_to(pg, FREE, budget=40)
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(200)
    s = pg.evaluate(SAVED); now = pg.evaluate("(() => { const p = __wb.G.player.root.position; return { min: Math.round(__wb.state().min), x: p.x, z: p.z, loc: __wb.loc() } })()")
    check('leaving the page saves first (minute and place)', s and s['phase'] == 'free' and abs(s['min'] - now['min']) <= 2 and s['at'] and abs(s['at']['x'] - now['x']) < 0.3 and abs(s['at']['z'] - now['z']) < 0.3, [s and s['at'], s and s['min'], now])
    saved = s
    pg.reload(); title(pg)
    lab = pg.evaluate("(document.querySelector('#tCont') || {}).innerText || ''")
    check('Continue names the day and minute', saved['label'] in lab, [lab, saved['label']])
    pg.evaluate('__wb.G.timeScale = 0'); pg.click('#tCont')
    drive_to(pg, FREE, budget=60)
    st = pg.evaluate("(() => { const p = __wb.G.player.root.position; return { min: Math.round(__wb.state().min), x: p.x, z: p.z, loc: __wb.loc(), day: __wb.state().day, hud: !document.querySelector('#hud').hidden, obj: __wb.obj().t } })()")
    check('Continue: back at that minute, where you stood, with the HUD and an objective', st['day'] == 1 and abs(st['min'] - saved['min']) <= 6 and abs(st['x'] - saved['at']['x']) < 0.4 and abs(st['z'] - saved['at']['z']) < 0.4 and st['hud'] and st['obj'], [st, saved['at'], saved['min']])
    # 3. the menu saves first and says so
    pg.keyboard.press('Escape'); pg.wait_for_selector('#overlay:not([hidden]) #pCode', timeout=10000)
    note = pg.evaluate("document.querySelector('#overlay .small').innerText")
    s = pg.evaluate(SAVED)
    check('opening the menu saves, and the menu says what was saved', s and s['label'] in note and 'Continue' in note, [note, s and s['label']])
    # 4. another device: the code, and the file
    pg.click('#pCode'); pg.wait_for_selector('#overlay .codebox', timeout=10000)
    code = pg.evaluate("document.querySelector('#overlay .codebox').value")
    check('the save code is there (and has no name in it)', code.startswith('MTFS1') and 'Robin' not in code, code[:20])
    with pg.expect_download(timeout=15000) as dl:
        pg.click('#cFile')
    path = os.path.join(tempfile.mkdtemp(), 'made-to-fit-save.txt'); dl.value.save_as(path)
    txt = open(path).read().strip()
    check('Save as a file: a text file holding the same code', txt == code and dl.value.suggested_filename == 'made-to-fit-save.txt', [dl.value.suggested_filename, txt[:20]])
    msg = pg.evaluate("document.querySelector('#cMsg').innerText")
    check('and it says it was saved', 'Saved' in msg, msg)
    # a fresh browser (nothing stored): Played before? > Open a save file
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 760}); pg2 = ctx2.new_page(); pg2.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg2.goto(URL, wait_until='domcontentloaded', timeout=120000); title(pg2); pg2.evaluate('localStorage.clear(); sessionStorage.clear()'); pg2.reload(wait_until='domcontentloaded', timeout=120000); title(pg2)
    pg2.click('#tPb', timeout=90000); pg2.wait_for_selector('#overlay #cOpen', timeout=10000)
    pg2.evaluate('__wb.G.timeScale = 0')
    with pg2.expect_file_chooser() as fc:
        pg2.click('#cOpen')
    fc.value.set_files(path)
    pg2.wait_for_selector('#overlay #nm', timeout=20000)
    pg2.fill('#overlay #nm', 'Robin'); pg2.click('#overlay #nOk')
    drive_to(pg2, FREE, budget=60)
    st2 = pg2.evaluate("(() => ({ min: Math.round(__wb.state().min), day: __wb.state().day, name: __wb.state().name, look: __wb.state().look }))()")
    m0 = pg.evaluate(SAVED)
    check('the file opens on another browser: same day and minute, name asked for', st2['day'] == 1 and abs(st2['min'] - m0['min']) <= 6 and st2['name'] == 'Robin' and st2['look']['shape'] == 'tall', [st2, m0['min']])
    pg2.close(); ctx2.close()
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 6. nothing autosaves in a scene or on festival day's walk
    calm = pg.evaluate("(() => { const st = __wb.G.story; const S = __wb.state(); const out = {}; out.free = st.canAutosave(); S.flags.decided = 1; out.walk = st.canAutosave(); delete S.flags.decided; S.flags.festival = 1; out.fest = st.canAutosave(); delete S.flags.festival; __wb.G.busy++; out.scene = st.canAutosave(); __wb.G.busy--; return out; })()")
    check('autosave only when calm (yes in free play; no on the walk to the festival, at the festival, in a scene)', calm['free'] and not calm['walk'] and not calm['fest'] and not calm['scene'], calm)
    # 5. ten years on
    pg.evaluate("__wb.gotoAct(2, { built: ['quiet', 'dim'], name: 'Robin' })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    drive_to(pg, lambda st: FREE(st) and st['loc'] == 'town', budget=120)
    pg.evaluate('__wb.G.timeScale = 0.2')
    pg.evaluate("__wb.tp('square')"); pg.wait_for_timeout(500); drive_to(pg, FREE, budget=40)
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(200)
    s = pg.evaluate(SAVED)
    check('ten years on: saves as you play, labelled by the visit', s and s['act'] == 2 and s['phase'] == 'free' and s['label'].startswith('Ten years on, '), s and [s['act'], s['phase'], s['label']])
    pg.evaluate('sessionStorage.clear()'); pg.reload(); title(pg)
    lab = pg.evaluate("(document.querySelector('#tCont') || {}).innerText || ''")
    pg.evaluate('__wb.G.timeScale = 0'); pg.click('#tCont')
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    drive_to(pg, FREE, budget=60)
    st = pg.evaluate("(() => { const p = __wb.G.player.root.position; return { act: __wb.ret().act, min: Math.round(__wb.state().min), x: p.x, z: p.z, name: __wb.state().name } })()")
    check('ten years on: Continue returns to that minute and place', st['act'] == 2 and abs(st['min'] - s['min']) <= 6 and abs(st['x'] - s['at']['x']) < 0.4 and abs(st['z'] - s['at']['z']) < 0.4 and st['name'] == 'Robin', [lab, st, s['at'], s['min']])
    check('no page errors', not errors, errors[:4])
    b.close()
print(json.dumps({'ok': out['ok'], 'failed': [c for c in out['checks'] if not c[1]]}, default=str)[:3000])
sys.exit(0 if out['ok'] else 1)
