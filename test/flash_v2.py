# Photosensitivity check for the new game's own moments (WCAG 2.3.1, general flash), the same method as flash.py:
# fixed-step mode, one frame (1/60 s) at a time, a screenshot of every frame split into a 6x6 grid, and a count of
# general flashes per tile (pairs of opposing changes in mean relative luminance of at least 0.10 where the darker
# state is below 0.80). Fails if any tile has more than 3 flashes in any one-second window.
# The moments: a colour wave rolling over Home Row (with its ring, sparks and camera punch), the wave over Market
# Square, tagging a mark with the lantern up (beam, burst, ring, chime), and lantern night's retune, when every mark
# in town goes out one by one.
# usage: python3 test/flash_v2.py [wave] [wavemarket] [tag] [reveal] [--frames N] [--shots DIR]
import sys, time, json, base64, io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
GRID, FPS, THR, DARK, LIMIT = 6, 60, 0.10, 0.80, 3
argv = sys.argv[1:]
def opt(name, default):
    if name in argv: i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    return default
FRAMES = int(opt('--frames', 240)); SHOTS = opt('--shots', None)
ALL = ['wave', 'wavemarket', 'tag', 'reveal']
SCENARIOS = [a for a in argv if not a.startswith('-')] or ALL
URL = 'file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mute=1&seed=9&fixedstep=1'

# sRGB 8-bit -> linear, then relative luminance Y = 0.2126 R + 0.7152 G + 0.0722 B
_c = np.arange(256) / 255.0
LIN = np.where(_c <= 0.04045, _c / 12.92, ((_c + 0.055) / 1.055) ** 2.4).astype(np.float32)
W_RGB = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
def tile_lum(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB'))
    y = LIN[a] @ W_RGB
    h, w = y.shape; rs = np.linspace(0, h, GRID + 1).astype(int); cs = np.linspace(0, w, GRID + 1).astype(int)
    return np.array([[y[rs[r]:rs[r + 1], cs[c]:cs[c + 1]].mean() for c in range(GRID)] for r in range(GRID)], dtype=np.float64)

def turning_points(y, thr=THR):
    """Turning points (frame, value) of a series, ignoring any wiggle smaller than thr."""
    pts = []; hi = lo = y[0]; hi_i = lo_i = 0; d = 0
    for i in range(1, len(y)):
        v = y[i]
        if d == 0:
            if v > hi: hi, hi_i = v, i
            if v < lo: lo, lo_i = v, i
            if hi - lo >= thr:
                if hi_i > lo_i: pts.append((lo_i, lo)); d = 1
                else: pts.append((hi_i, hi)); d = -1
        elif d == 1:
            if v > hi: hi, hi_i = v, i
            elif hi - v >= thr: pts.append((hi_i, hi)); d = -1; lo, lo_i = v, i
        else:
            if v < lo: lo, lo_i = v, i
            elif v - lo >= thr: pts.append((lo_i, lo)); d = 1; hi, hi_i = v, i
    if d == 1: pts.append((hi_i, hi))
    elif d == -1: pts.append((lo_i, lo))
    return pts

def transitions(y):
    """Luminance changes of at least THR whose darker end is below DARK: (start frame, end frame, +1 up / -1 down)."""
    p = turning_points(y)
    return [(a[0], b[0], 1 if b[1] > a[1] else -1) for a, b in zip(p, p[1:]) if abs(b[1] - a[1]) >= THR and min(a[1], b[1]) < DARK]

def flashes_in(trs):
    """A flash is a pair of opposing transitions."""
    n = 0; pend = 0
    for _, _, s in trs:
        if pend and s == -pend: n += 1; pend = 0
        else: pend = s
    return n

def analyze(series):
    S = np.array(series)  # frames x GRID x GRID
    worst = {'flashes': 0, 'transitions': 0, 'tile': None, 'at_s': None}
    swing = float((S.max(axis=0) - S.min(axis=0)).max())
    for r in range(GRID):
        for c in range(GRID):
            trs = transitions(S[:, r, c])
            for s0 in range(0, max(1, len(S) - FPS + 1)):
                win = [t for t in trs if s0 <= t[1] < s0 + FPS]
                f = flashes_in(win)
                if f > worst['flashes'] or (f == worst['flashes'] and len(win) > worst['transitions']):
                    worst.update(flashes=f, transitions=len(win), tile=[r, c], at_s=round(s0 / FPS, 2))
    worst['max_tile_swing'] = round(swing, 3)
    worst['frames'] = len(S)
    worst['pass'] = worst['flashes'] <= LIMIT
    return worst

results = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 760}, device_scale_factor=1)
    ctx.add_init_script("try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant', fx: 1, reduceMotion: false, flicker: true })); } catch (e) {}")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    if not pg.evaluate('__wb.fixed === true'): sys.exit('this build has no fixed-step mode (?fixedstep=1)')
    cdp = ctx.new_cdp_session(pg)
    def step(n=1, draw=True): return pg.evaluate('([n, d]) => __wb.step(n, d)', [n, draw])
    def shot(): return base64.b64decode(cdp.send('Page.captureScreenshot', {'format': 'png', 'optimizeForSpeed': True})['data'])
    def until(js, timeout=180, n=6):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if pg.evaluate(js): return True
            pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
            if pg.evaluate("!!document.querySelector('#overlay:not([hidden]) #cGo')"): pg.evaluate("document.querySelector('#overlay #cGo').click()")
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('taps'))"): pg.evaluate("document.querySelector('#panel .pick').click()")
            step(n, False); pg.wait_for_timeout(30)
        raise TimeoutError(js)
    def settings():
        # a light-sensitive player who has not turned anything down: full screen effects, full motion, lively feedback
        pg.evaluate("(() => { const G = __wb.G, s = G.settings; s.fx = 1; s.reduceMotion = false; s.calmFx = false; s.flicker = true; G.applySettings(); })()")
    pg.evaluate("document.querySelector('#tNew').click()")
    until("!!(__wb.panel() && __wb.panel().includes('creator'))"); pg.evaluate("document.querySelector('#done').click()")
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home' && __wb.state().day === 1", 300)
    print('setup done: light profile %.2f, frame %d' % (pg.evaluate('__wb.state().profile.light'), pg.evaluate('__wb.frame()')), flush=True)

    def capture(name, before=None):
        series = []; t0 = time.time()
        for i in range(FRAMES):
            if before: before(i)
            step(1); png = shot(); series.append(tile_lum(png))
            if SHOTS and i in (0, FRAMES // 3, 2 * FRAMES // 3, FRAMES - 1): open('%s/flash2-%s-%03d.png' % (SHOTS, name, i), 'wb').write(png)
        r = analyze(series); r['secs'] = round(time.time() - t0); results[name] = r
        print(name, json.dumps(r), flush=True)
    def outside(stage, at):
        pg.evaluate("__wb.sliceTo('%s')" % stage)
        if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
        until("__wb.loc() === 'town' && !__wb.busy() && __wb.mode() === 'play'", 120)
        pg.evaluate("(a) => { __wb.tp(a); }", at); step(40, False); settings()

    for sc in SCENARIOS:
        if sc == 'wave':
            # your porch lantern goes up and colour rolls out over Home Row (the muted row, then the wave and its front)
            outside('porch', [9.5, 38.4])
            pg.evaluate("(() => { const S = __wb.state(); S.color.homerow = 0; __wb.G.busy = 1; })()"); step(30, False)
            capture('wave', lambda i: i == 6 and pg.evaluate("(() => { __wb.G.story.slice.wave('homerow', [8.5, 36.5]); })()"))
            pg.evaluate("__wb.G.busy = 0")
        elif sc == 'wavemarket':
            outside('moss', [27.5, 31.5])
            pg.evaluate("(() => { const S = __wb.state(); S.color.market = 0; __wb.G.busy = 1; __wb.G.story.slice.frameAt([28, 27], { dx: 4, dz: 15, h: 15, fov: 44 }); })()"); step(60, False)
            capture('wavemarket', lambda i: i == 6 and pg.evaluate("(() => { __wb.G.story.slice.wave('market', [23.5, 31.2]); })()"))
            pg.evaluate("(() => { __wb.G.busy = 0; __wb.G.story.slice.unframeAt(); })()")
        elif sc == 'tag':
            # the lantern up on Home Row, a mark in the beam, and tagging it: burst, ring, chime, the camera's little punch
            outside('homerow', [21.5, 38.6])
            pg.evaluate("(() => { const G = __wb.G; G.player.heading = Math.PI; G.look.raise(); })()"); step(60, False)
            capture('tag', lambda i: i == 20 and pg.evaluate("(() => { const G = __wb.G; const m = ['hr_rule', 'hr_knock'].find((id) => !G.marks.tagged(id)); if (m) G.marks.tag(m); })()"))
        elif sc == 'reveal':
            # lantern night: every mark in town from above, then the retune, one going out every 110 ms
            outside('worksmarks', [16, 16.5])
            pg.evaluate("(() => { const G = __wb.G, M = G.marks; G.busy = 1; M.showAll = true; G.look.raised = true; G.story.slice.shot(G.stage.camPos.clone().set(32, 60, 62), G.stage.camPos.clone().set(32, 0, 23), 46, 2.6); })()"); step(150, False)
            total = pg.evaluate("__wb.G.marks.sprites.filter((s) => s.visible).length")
            capture('reveal', lambda i: i % 7 == 0 and pg.evaluate("(n) => { const M = __wb.G.marks; M.fade = Math.max(0, n); }", total - i // 7))
            pg.evaluate("(() => { const G = __wb.G, M = G.marks; M.showAll = false; M.fade = null; G.look.raised = false; G.busy = 0; })()")
    b.close()
ok = all(r['pass'] for r in results.values()) and not errs
print(json.dumps({'ok': ok, 'results': results, 'errors': errs}))
sys.exit(0 if ok else 1)
