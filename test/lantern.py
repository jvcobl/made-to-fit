# Look again and the Standard's room: the lantern on the sill, raising it, a sight with its stand-in, the notebook's
# Sights page, and the puzzle at the statue (three right lock in; six solve it). Prints JSON; exit 1 on failure.
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE, drive_to, free, STATE_JS
URL = BASE + '?test=1&fast=1&mute=1&seed=12'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def lines(pg, until_js, t=20):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(until_js): return True
        if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
        pg.wait_for_timeout(50)
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    drive_to(pg, lambda st: st['day'] == 1 and free(st) and st['loc'] == 'home')
    pg.evaluate("__wb.G.place([2.3, -1.7])"); pg.wait_for_timeout(300)
    check('the lantern is on the sill', pg.evaluate('__wb.target()') == 'sill', pg.evaluate('__wb.target()'))
    pg.evaluate('__wb.act()'); lines(pg, "!__wb.busy() && !__wb.waiter()")
    check('picked up', pg.evaluate('__wb.state().flags.lantern') == 1)
    try: pg.wait_for_function("!!document.querySelector('.gearbtns [data-g=look]')", timeout=5000); hb = True
    except Exception: hb = False
    check('lantern button on the HUD', hb)
    # into town, by the noon bell
    pg.evaluate("__wb.G.exitRoom()"); pg.wait_for_function("__wb.loc() === 'town' && !__wb.busy()", timeout=20000)
    pg.evaluate("(() => { const S = __wb.state(); S.flags.shift1 = 1; S.handled['1:market'] = 1; S.handled['1:street'] = 1; S.min = 600; __wb.tp([30.2, 19.4]); })()"); pg.wait_for_timeout(600)
    pg.keyboard.press('l'); pg.wait_for_timeout(500)
    meta = pg.evaluate("(() => { const c = document.querySelector('#sightcard'); return c.hidden ? null : c.innerText; })()")
    check('first raise: the lantern itself', meta and 'English' in meta, meta)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    lst = pg.evaluate("document.querySelector('#litlist').innerText")
    check('lit here lists the bell', 'noon bell' in lst, lst)
    halo = pg.evaluate("(() => { const L = __wb.G.look; const i = L.near.findIndex((s) => s.id === 'bell'); return { vis: L.halos[2].visible, k: L.k } })()")
    check('the bell glows', halo['vis'], halo)
    i = pg.evaluate("__wb.G.look.near.findIndex((s) => s.id === 'bell')")
    pg.keyboard.press(str(i + 1)); pg.wait_for_timeout(900)
    card = pg.evaluate("document.querySelector('#sightcard').innerText")
    check('the card describes the place', 'noon bell rings as loud' in card, card)
    check('the stand-in appears', pg.evaluate("__wb.G.look.ghostK") > 0.3)
    check('the sight is noted', pg.evaluate("!!(__wb.state().sights || {}).bell"))
    pg.screenshot(path='/home/claude/wb4/test/shots_f/lantern_bell.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('lowered', not pg.evaluate("__wb.G.look.raised"))
    # the Standard's room
    pg.evaluate("(() => { const S = __wb.state(); S.flags.statue_seen = 1; __wb.tp([30, 26.6]); })()"); pg.wait_for_timeout(500)
    pg.evaluate('__wb.act()'); pg.wait_for_function("__wb.panel() && __wb.panel().includes('standard')", timeout=10000)
    def pick(vals):
        for k, v in vals.items(): pg.evaluate("document.querySelector('[data-k=%s] [data-v=\"%d\"]').click()" % (k, v))
        pg.evaluate("document.querySelector('#scheck').click()"); pg.wait_for_timeout(200)
        return pg.evaluate("document.querySelector('.smsg') ? document.querySelector('.smsg').innerText : document.querySelector('.plaque').innerText")
    m1 = pick({'lamp': 2, 'radio': 0, 'sign': 2, 'note': 0, 'clock': 2, 'calendar': 1})
    check('two right: not yet', m1.startswith('Not yet'), m1)
    m2 = pick({'lamp': 2, 'radio': 2, 'sign': 0, 'note': 0, 'clock': 0, 'calendar': 0})
    check('four right: say so and lock', m2 == 'Four are right.' and pg.evaluate("Object.keys(__wb.state().stdLock).length") == 4, m2)
    pg.screenshot(path='/home/claude/wb4/test/shots_f/standard_room.png')
    m3 = pick({'note': 2, 'calendar': 1})
    check('six right: the plaque', 'composite' in m3, m3)
    check('solved: carried and kept', pg.evaluate("__wb.state().w.standard_solved") == 1 and pg.evaluate("__wb.G.town.plaque2.visible"))
    check('solved: notes', pg.evaluate("['misfit','reference','ranges'].every((k) => (__wb.state().notes || {})[k])"))
    pg.screenshot(path='/home/claude/wb4/test/shots_f/standard_solved.png')
    pg.evaluate("document.querySelector('#sdone').click()"); pg.wait_for_timeout(300)
    # the notebook
    pg.evaluate("__wb.G.togglePhone(true)"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-tab=notebook]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-sub=sights]').click()"); pg.wait_for_timeout(200)
    sights = pg.evaluate("document.querySelector('#phone .body').innerText")
    check('notebook: sights page', 'noon bell' in sights and "founders' committee" in sights, sights[:300])
    pg.evaluate("document.querySelector('[data-sub=notes]').click()"); pg.wait_for_timeout(200)
    notes = pg.evaluate("document.querySelector('#phone .body').innerText")
    check('notebook: autism section waits for the first night', 'Opens on your first night' in notes, notes[:400])
    check('no page errors', not errors, errors[:3])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
