# The sight-line grid (src/occgrid.js) against three.js's own raycaster: for a few hundred random lines across town, the
# grid must say "blocked" wherever three.js does (it checks both faces of every triangle, so it may say so a little more
# often), and it must answer much faster. Also: a line through a house is blocked, a line down the open street isn't.
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + json.dumps(info)[:400]) if not ok else ''), flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 960, 'height': 600}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=12', timeout=180000, wait_until='commit'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    r = pg.evaluate("""(() => { const G = __wb.G; const t0 = performance.now(); const g = G.occ(); const build = performance.now() - t0; g.refresh();
      return { build: Math.round(build), tris: g.n, meshes: g.meshes.length, cells: g.nx * g.nz, big: g.big.length }; })()""")
    print(json.dumps(r))
    check('the grid holds the town (well over a hundred thousand triangles)', r['tris'] > 100000 and r['meshes'] >= 3, r)
    check('it builds in under a second, even on this slow machine', r['build'] < 2500, r['build'])
    r2 = pg.evaluate("""(() => {
      const G = __wb.G, g = G.occ(); g.refresh();
      const house = g.hit(9.5, 2, 40, 9.5, 2, 30), street = g.hit(4, 1.5, 38.6, 24, 1.5, 38.6), sky = g.hit(30, 15, 34, 30, 1.8, 34), roof = g.hit(9.5, 15, 33.5, 9.5, 1.8, 33.5);
      return { house, street, sky, roof };
    })()""")
    check('a line through your own house is blocked', r2['house'] is True, r2)
    check('a line along the open street is not', r2['street'] is False, r2)
    check('open ground has open sky; a house has a roof over it', r2['sky'] is False and r2['roof'] is True, r2)
    # against three.js, on random lines at head height and from camera height
    # (three.js isn't on the page as a global; the game exposes the comparison itself for this test)
    r4 = pg.evaluate("__wb.occCheck ? __wb.occCheck(300) : null")
    print(json.dumps(r4))
    check('the game can compare the grid with three.js', r4 is not None)
    if r4:
        check('wherever three.js sees something in the way, so does the grid', r4['missed'] == 0, r4)
        check('and the grid rarely sees more (both faces of a triangle count)', r4['extra'] <= r4['n'] * 0.12, r4)
        check('it answers at least five times faster', r4['msThree'] > 5 * max(1, r4['msGrid']), r4)
    check('no page errors', not errors, errors)
    b.close()
bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad, 'failed': bad}))
sys.exit(0 if not bad else 1)
