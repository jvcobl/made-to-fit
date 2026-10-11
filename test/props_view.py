# Looks at the props that are merged into single meshes (one draw call each), so a change to how they are built can
# be checked by eye: the first visit's fixes (quiet corner, porch lanterns at dusk, ramp), ten years on (van, bots,
# crossing, Blend Lounge, the Works with Unit, its lamps and plants, the drone), twenty years on (benches, the Far
# End cart and stalls, the leases board, Founders' Row). Screens go to test/shots_props.
# usage: python3 test/props_view.py
import sys, os, time, json
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
from playwright.sync_api import sync_playwright
D = '/home/claude/wb4/test/shots_props'; os.makedirs(D, exist_ok=True)
errors = []
def free(pg, act):
    t0 = time.time()
    while time.time() - t0 < 150:
        if pg.evaluate("__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()" + (" && !!__wb.state().flags.juno3" if act == 3 else "")): return True
        panel = pg.evaluate('__wb.panel()') or ''
        if 'title' in panel: pg.evaluate("document.querySelector('#tNew').click()")
        elif 'creator' in panel: pg.evaluate("document.querySelector('#done').click()")
        elif 'setup' in panel: pg.evaluate("document.querySelector('#next').click()")
        elif 'today' in panel: pg.evaluate("document.querySelector('#tgo').click()")
        w = pg.evaluate('__wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w in ('choice', 'barrier'): pg.evaluate("__wb.choose(Math.max(0, __wb.options().findIndex((o) => !o.disabled)))")
        pg.wait_for_timeout(100)
    return False
def shot(pg, name, pos, look, minute=None, fov=40, room=None):
    pg.evaluate("""([pos, look, minute, fov, room]) => { const G = __wb.G, st = G.stage; G.busy = 1; G.mode = 'cine';
      if (room) { if (G.loc !== room) G.setLoc(room); } else if (G.loc !== 'town') G.setLoc('town');
      if (minute != null) __wb.state().min = minute; st.shot(st.camPos.clone().set(...pos), st.camLook.clone().set(...look), fov, 3, true); G.forceRender = true; }""", [pos, look, minute, fov, room])
    pg.wait_for_timeout(1600); pg.screenshot(path='%s/%s.png' % (D, name))
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # the first visit, with the fixes up
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=21'); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    free(pg, 1)
    pg.evaluate("(() => { const G = __wb.G; for (const f of ['quiet', 'lanterns', 'ramp', 'board', 'plain']) G.town.setFix(f, true); })()")
    shot(pg, 'a1_quiet', (29.5, 5, 34), (23.5, 1.2, 31.2), 720)
    shot(pg, 'a1_lanterns_dusk', (9.5, 5, 45), (9.5, 1.2, 36.5), 1230)
    shot(pg, 'a1_ramp', (10, 9, 22), (16, 0, 15), 720)
    pg.close()
    for act in (2, 3):
        pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
        pg.goto(BASE + '?test=1&fast=1&mute=1&seed=21'); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
        pg.evaluate("__wb.gotoAct(%d, { built: ['quiet', 'dim', 'ramp', 'lanterns', 'board'] })" % act)
        pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
        free(pg, act)
        if act == 2:
            shot(pg, 'a2_van_crossing', (51, 7, 33), (53, 1, 23), 720)
            shot(pg, 'a2_bots', (10, 9, 22), (16, 0, 15), 720)
            shot(pg, 'a2_lounge', (38.4, 4, 36), (38.4, 0.8, 30), 720)
            pg.evaluate("(() => { const G = __wb.G, R = G.story.ret; const d = G.town.scene.children.find((o) => o.userData && o.userData.rotors); })()")
            pg.evaluate("(() => { const G = __wb.G; G.busy = 1; G.run2(() => G.enterRoom('works')); })()"); pg.wait_for_timeout(1500)
            c = pg.evaluate("(() => { const c = __wb.G.roomCam('works'); return [[c.pos.x, c.pos.y, c.pos.z], [c.look.x, c.look.y, c.look.z]]; })()")
            shot(pg, 'a2_works', c[0], c[1], 600, 40, 'works')
            shot(pg, 'a2_unit_close', (-1.1, 2.0, 6.2), (-1.1, 1.0, 3.1), 600, 36, 'works')
            # the festival, for the drone
            pg.evaluate("""(() => { const G = __wb.G, S = __wb.state(); S.flags.council = 1; S.flags.councilDone = 1; S.flags.remind = 1; S.flags.decided = 1; for (const z of ['market', 'street', 'festival', 'homerow', 'transit', 'commons', 'farend', 'works', 'hall']) S.handled['1:' + z] = 1; S.handled['1:festival:f'] = 1; S.min = 1199; G.setLoc('town'); __wb.tp([30, 34]); G.busy = 0; G.mode = 'play'; G.run(() => G.story.festival()); })()""")
            t0 = time.time()
            while time.time() - t0 < 60 and not pg.evaluate("!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()"):
                if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
                pg.wait_for_timeout(100)
            pg.wait_for_timeout(2500)
            d = pg.evaluate("(() => { const R = __wb.G.story.ret; return R && R.drone ? [R.drone.position.x, R.drone.position.y, R.drone.position.z] : null; })()")
            if d: shot(pg, 'a2_drone', (d[0] + 2.5, d[1] + 0.6, d[2] + 3.2), (d[0], d[1] - 0.4, d[2]), None, 40)
        else:
            pg.evaluate("(() => { const T = __wb.G.town; T.showBenches('three'); T.farCart.visible = true; T.farStalls.visible = true; T.fundPlate.visible = true; })()")
            shot(pg, 'a3_benches', (30, 6, 31), (30, 0.8, 24), 720)
            shot(pg, 'a3_farend', (44, 7, 50), (44, 0.8, 41.5), 720)
            shot(pg, 'a3_leases', (34, 3, 32), (34, 1.2, 27.4), 720)
        pg.close()
    b.close()
print(json.dumps({'errors': errors[:5]}))
