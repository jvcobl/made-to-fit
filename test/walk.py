# Walking somewhere you clicked gets you there. For the walks the first day asks for (home to the Works, home to the
# square, between them, and back), each from a few slightly different starting spots, on foot and on wheels: the route
# must end beside the place asked for, without standing pinned against a corner on the way. (Fast mode takes steps of up
# to a metre and a half; a walk that steps over a corner of its route and back, over and over, shows up here as one that
# never arrives.)
# Usage: python3 test/walk.py
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + json.dumps(info, default=str)[:400]) if not ok else ''), flush=True)

HOME, WORKS, SQUARE, HALL = [9.5, 38.0], [13.6, 15.6], [25.9, 28.9], [32.0, 15.0]
ROUTES = [('home to the Works', HOME, WORKS), ('home to the square', HOME, SQUARE), ('the square to the Works', SQUARE, WORKS), ('the Works to home', WORKS, HOME),
          ('the square to home', SQUARE, HOME), ('the Works to Town Hall', WORKS, HALL), ('Town Hall to the square', HALL, SQUARE)]
JIT = [(0, 0), (0.21, -0.17), (-0.19, 0.2), (0.33, 0.31)]

def walk(pg, a, b):
    pg.evaluate("(q) => { const G = __wb.G; G.place(q[0]); G.walkTo(q[1][0], q[1][1]); }", [a, b])
    t0 = time.time(); still = 0; last = None; worst = 0
    while time.time() - t0 < 150:
        pg.wait_for_timeout(250)
        st = pg.evaluate("(() => { const G = __wb.G, p = G.player.root.position; return { n: G.path.length, x: p.x, z: p.z, free: G.mode === 'play' && !G.busy && !G.ui.waiter }; })()")
        if not st['free']: return {'ok': False, 'why': 'something interrupted the walk', 'at': [st['x'], st['z']]}
        if last and abs(st['x'] - last[0]) + abs(st['z'] - last[1]) < 0.02 and st['n']: still += 0.25; worst = max(worst, still)
        else: still = 0
        last = (st['x'], st['z'])
        if st['n'] == 0:
            d = ((st['x'] - b[0]) ** 2 + (st['z'] - b[1]) ** 2) ** 0.5
            return {'ok': d < 2.2 and worst < 4, 'd': round(d, 2), 's': round(time.time() - t0, 1), 'pinned_s': worst, 'at': [round(st['x'], 2), round(st['z'], 2)]}
    return {'ok': False, 'why': 'never arrived', 'at': last, 'pinned_s': worst}

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=31', timeout=180000, wait_until='commit'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    # the open middle of the day, with the day's own events held back so nothing interrupts a walk
    pg.evaluate("(() => { __wb.sliceTo('open', {}); const G = __wb.G; G.story.slice.hold = true; })()"); pg.wait_for_timeout(1200)
    if pg.evaluate("__wb.G.loc") != 'town': pg.evaluate("(() => { const G = __wb.G; G.setLoc('town'); G.place([9.5, 38.0]); })()"); pg.wait_for_timeout(600)
    for wheels in (False, True):
        pg.evaluate("(w) => { __wb.state().wheels = w; }", wheels)
        for name, a, bb in ROUTES:
            res = []
            for j in JIT:
                r = walk(pg, [a[0] + j[0], a[1] + j[1]], bb); res.append(r)
            check('%s%s: arrives from each of %d starting spots' % (name, ' (on wheels)' if wheels else '', len(JIT)), all(r['ok'] for r in res), res)
            ts = [r['s'] for r in res if 's' in r]
            check('  and no walk takes much longer than the quickest of them', len(ts) == len(JIT) and max(ts) < min(ts) * 2.2 + 4, ts)
    check('no page errors', not errors, errors)
    b.close()
bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad, 'failed': bad}))
sys.exit(0 if not bad else 1)
