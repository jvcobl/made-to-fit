# Conversations out in town are framed so you can see who is talking: for each place the first day has you talk to
# someone, the camera must end up with a clear line of sight to both of you, and both of you on screen.
# Usage: python3 test/talkcam.py [OUTDIR] [phone]   (screenshots of each framing go to OUTDIR)
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/talkcam'
PHONE = len(sys.argv) > 2 and sys.argv[2] == 'phone'
os.makedirs(OUT, exist_ok=True)
# (who, where they stand, where you stand)
SPOTS = [
  ('bea', [22.4, 38.0], [23.0, 37.4], 'home row, by Bea\'s gate'), ('bea', [11.4, 38.6], [9.6, 38.3], 'your porch'),
  ('moss', None, [26.6, 30.0], 'the tea cart'), ('pomeroy', [27.4, 29.6], [26.4, 30.3], 'the square, by the cart'), ('clover', [26.2, 30.6], [27.2, 31.0], 'the square'),
  ('rue', [30.0, 31.6], [28.5, 31.0], 'the square, open ground'), ('bea', [13.4, 14.2], [13.6, 15.6], 'the Works steps'), ('gil', [14.4, 14.4], [13.8, 15.8], 'the Works steps'),
  ('wren', [9.5, 40.2], [9.5, 38.4], 'your porch, at night'), ('wren', [11.3, 39.1], [9.5, 38.7], 'your gate, the first morning'), ('bea', [9.2, 39.6], [10.7, 39.2], 'home row, walking up to you'), ('bea', [11.4, 38.7], [9.5, 37.9], 'your gate, the porch lantern'),
  ('pomeroy', None, 'south', 'his own stall, you in front of him'), ('moss', None, 'south', 'the tea cart, you in front of her'), ('clover', [28.1, 33.1], [29.4, 32.2], 'the square, where you stop on the way in'), ('rue', [31.0, 33.2], [29.4, 32.2], 'the square, Rue walking up'),
  ('gil', [14.4, 14.4], [13.6, 15.6], 'the Works steps, Bea beside him'), ('hollis', [32.0, 16.0], [31.0, 17.0], 'outside Town Hall'), ('pip', [20.0, 24.0], [21.0, 24.8], 'the street'),
]
results = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if PHONE else {'width': 1280, 'height': 760}, is_mobile=PHONE, has_touch=PHONE, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=12', timeout=180000, wait_until='commit'); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    pg.evaluate("__wb.sliceTo('tomarket')")
    if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
    drive_to(pg, lambda st: free(st) and st['loc'] == 'town', budget=60)
    pg.evaluate("__wb.G.sonder && (__wb.G.sonder.cool = 9999)")
    # (the day's own triggers stay out of it: this is about the camera)
    pg.evaluate("__wb.G.story.slice.hold = true")
    for i, (who, at, you, name) in enumerate(SPOTS):
        if you is None: you = pg.evaluate("(who) => { const q = __wb.G.npcs[who].c.root.position; return __wb.G.story.standNear(q.x - 1.2, q.z + 0.9) || [q.x - 1.2, q.z + 0.9]; }", who)
        # (straight in front of them, where the objective's marker leads you)
        if you == 'south': you = pg.evaluate("(who) => { const q = __wb.G.npcs[who].c.root.position; return __wb.G.story.standNear(q.x, q.z + 0.9) || [q.x, q.z + 0.9]; }", who)
        if 'Bea beside' in name: pg.evaluate("(() => { const G = __wb.G, n = G.npcs.bea; G.npcTo('bea', [13.4, 14.2], 'town', [13.4, 14.2]); n.c.root.position.set(13.4, 0, 14.2); n.path = []; n.goal = [13.4, 14.2]; n.override = [13.4, 14.2]; })()")
        pg.evaluate("""([who, at, you]) => { const G = __wb.G; G.place(you); const n = G.npcs[who]; if (at) { G.npcTo(who, at, 'town', at); n.c.root.position.set(at[0], 0, at[1]); n.path = []; n.goal = at; n.override = at; } G.mode = 'cine'; G.talkFrame(who); G.ui.letterbox(true); }""", [who, at, you])
        pg.wait_for_timeout(5500)
        v = pg.evaluate('__wb.G.talkView()')
        pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(150)
        pg.screenshot(path=os.path.join(OUT, '%02d_%s.jpg' % (i, who)), type='jpeg', quality=70)
        # (on a phone held upright, each of you must also stand clear of the picture's edge, not half out of it)
        edge = pg.evaluate("(() => { const G = __wb.G, n = G.npcs[G.talking]; if (!n) return 9; return Math.max(...[G.player.root.position, n.c.root.position].map((q) => Math.abs(q.clone().setY(1).project(G.stage.camera).x))); })()")
        ok = bool(v) and v['blocked'] == 0 and all(v['onScreen']) and (not PHONE or edge < 0.8)
        if v: v['edge'] = round(edge, 2)
        results.append([who + ' at ' + name, ok, v]); print(('PASS ' if ok else 'FAIL ') + who + ' at ' + name + ('' if ok else '  ' + json.dumps(v)))
        pg.evaluate("(() => { const G = __wb.G; G.endTalk(); G.ui.letterbox(false); G.mode = 'play'; })()"); pg.wait_for_timeout(400)
    b.close()
bad = [r[0] for r in results if not r[1]]
print(json.dumps({'ok': not bad and not errors, 'failed': bad, 'errors': errors}))
sys.exit(0 if not bad and not errors else 1)
