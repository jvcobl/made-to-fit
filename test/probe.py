from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1000, 'height': 620})
    pg.goto('file://' + REPO + '/dist/who-bends.html?test=1&v1=1&fast=1&mute=1&seed=8'); pg.wait_for_timeout(1200)
    pg.evaluate("document.querySelector('#tNew').click()")
    for i in range(150):
        st = pg.evaluate("[__wb.panel(), __wb.waiter(), __wb.mode(), __wb.busy()]")
        if st[0] and 'creator' in st[0]: pg.evaluate("document.querySelector('#done').click()")
        elif st[0] and 'setup' in st[0]: pg.evaluate("document.querySelector('#next').click()")
        elif st[1] == 'line': pg.evaluate('__wb.adv()')
        elif st[2] == 'play' and not st[3]: break
        pg.wait_for_timeout(120)
    for m in [520, 560, 680, 1210]:
        pg.evaluate("__wb.state().min = %d; __wb.tp([12, 15.5]); __wb.G.forceRender = true" % m); pg.wait_for_timeout(900)
        print(m, pg.evaluate("(() => { const G = __wb.G, f = G.town.scene.fog, st = G.stage; return { near: Math.round(f.near), far: Math.round(f.far), fog: '#' + f.color.getHexString(), fx: Object.fromEntries(Object.entries(st.fx).map(([k, v]) => [k, Math.round(v * 100) / 100])), fade: st.fade, mode: st.rig.mode, cam: st.camera.position.toArray().map(Math.round), zone: G.zone, pinch: G.pinchNow && Math.round(G.pinchNow.total * 100) / 100, sunI: G.town.light.sun.intensity.toFixed(2), hemi: G.town.light.hemi.intensity.toFixed(2) } })()"))
        pg.screenshot(path=REPO + '/test/probe_%d.png' % m)
    b.close()
