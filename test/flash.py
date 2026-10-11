# Photosensitivity check (WCAG 2.3.1, general flash). Runs the game in fixed-step mode (?fixedstep=1), advances it
# one frame (1/60 s) at a time, screenshots every frame, splits each screenshot into a 6x6 grid of tiles, and counts
# general flashes per tile: pairs of opposing changes in mean relative luminance of at least 0.10 where the darker
# state is below 0.80. Fails if any tile has more than 3 flashes in any one-second window.
# usage: python3 test/flash.py [sort] [stamp] [works] [outdoor] [pond] [blueprint] [paint] [teach] [mail] [look] [festival]
#   [release] [act2works] [act2fest] [act3fest] [--frames N] [--seed N] [--shots DIR]   (none named: all fifteen)
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
FRAMES = int(opt('--frames', 240)); SEED = int(opt('--seed', 9)); SHOTS = opt('--shots', None)
ALL = ['sort', 'stamp', 'works', 'outdoor', 'pond', 'blueprint', 'paint', 'teach', 'mail', 'look', 'festival', 'release', 'act2works', 'act2fest', 'act3fest']
SCENARIOS = [a for a in argv if not a.startswith('-')] or ALL
# the later visits reload the page, so they go last, in order; 'release' ends the first visit, so it goes just before them
LATE = ['release', 'act2works', 'act2fest', 'act3fest']
SCENARIOS = [x for x in SCENARIOS if x not in LATE] + [x for x in LATE if x in SCENARIOS]
URL = 'file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mgslow=1&mute=1&seed=%d&fixedstep=1' % SEED

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
            if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
            step(n, False); pg.wait_for_timeout(30)
        raise TimeoutError(js)
    def settings():
        # a light-sensitive player who has not turned anything down: full screen effects, full motion, normal clock
        pg.evaluate("(() => { const G = __wb.G, s = G.settings; s.fx = 1; s.reduceMotion = false; s.flicker = true; G.applySettings(); G.timeScale = 2.5; })()")
    # a light-sensitive player: the dimmest lamp (so glare is maximal), quiet, few visitors, plain talk
    pg.evaluate("document.querySelector('#tNew').click()")
    until("!!(__wb.panel() && __wb.panel().includes('creator'))"); pg.evaluate("document.querySelector('#done').click()")
    for v in [0, 0, 4, 0, 2, 0]:
        until("!!(__wb.panel() && __wb.panel().includes('setup'))"); pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % v)
    until("__wb.mode() === 'play' && !__wb.busy() && __wb.loc() === 'home'", 240)
    print('setup done: light profile %.2f, frame %d' % (pg.evaluate('__wb.state().profile.light'), pg.evaluate('__wb.frame()')), flush=True)

    def capture(name, before=None):
        series = []; t0 = time.time()
        for i in range(FRAMES):
            if before: before(i)
            step(1); png = shot(); series.append(tile_lum(png))
            if SHOTS and i in (0, FRAMES // 2, FRAMES - 1): open('%s/flash-%s-%03d.png' % (SHOTS, name, i), 'wb').write(png)
        r = analyze(series); r['secs'] = round(time.time() - t0); results[name] = r
        print(name, json.dumps(r), flush=True)

    def task(name):
        settings()
        until("!__wb.busy() && __wb.mode() === 'play' && !__wb.mg()")
        pg.evaluate("__wb.mgTest('%s')" % name)
        until("!!(__wb.G.mg && __wb.G.mg.mode === 'demo' && document.querySelector('.mg-over .go'))")
        mods = pg.evaluate("JSON.stringify(__wb.G.mg.mods)")
        pg.evaluate("document.querySelector('.mg-over .go').click()")
        t0 = time.time()
        while not pg.evaluate("__wb.G.mg && __wb.G.mg.mode === 'play'") and time.time() - t0 < 20: pg.wait_for_timeout(50)
        print(name, 'room', mods, 'chips:', pg.evaluate("document.querySelector('.mg-env').innerText.replace(/\\n/g, ' ')"), flush=True)
        capture(name)
        pg.evaluate("__wb.G.mg && __wb.G.mg.running && __wb.G.mg.end()")
        until("!!document.querySelector('.mg-result .go')", 60, 2)
        results[name]['result_text'] = pg.evaluate("document.querySelector('.mg-result').innerText.replace(/\\n+/g, ' | ')")[:300]
        pg.evaluate("document.querySelector('.mg-result .go').click()")
        until("!__wb.mg() && !__wb.busy()", 60, 2)

    for sc in SCENARIOS:
        if sc in ('sort', 'stamp'): task(sc)
        elif sc == 'works':
            # standing in the Works, the faulty ceiling panel in view; no "who adjusts?" card, so nothing covers it
            settings()
            until("!__wb.busy() && __wb.mode() === 'play' && !__wb.mg()")
            pg.evaluate("(() => { const S = __wb.state(); S.handled[S.day + ':works'] = 1; __wb.G.run(() => __wb.G.enterRoom('works')); })()")
            until("__wb.loc() === 'works' && !__wb.busy()", 60, 2)
            step(30, False)
            # make sure a burst of the scheduled panel dips (if this build has them) falls inside the window
            capture('works', lambda i: i == 30 and pg.evaluate("(() => { const r = __wb.G.rooms.works; if (r.burst) r.burst(2); })()"))
        elif sc == 'outdoor':
            # a calm control: the far end of town in the morning, standing still
            settings()
            pg.evaluate("(() => { const S = __wb.state(); S.flags.escort = 1; S.flags.escort_done = 1; __wb.tp([36, 41.5]); })()")
            step(60, False)
            capture('outdoor')
        elif sc in ('pond', 'blueprint', 'paint', 'teach', 'mail'): task(sc)
        elif sc == 'look':
            # Look again: the lantern raised in the square, halos on what was made for someone (and the card it opens)
            settings()
            until("!__wb.busy() && __wb.mode() === 'play' && !__wb.mg()")
            pg.evaluate("(() => { const S = __wb.state(); S.flags.lantern = 1; S.flags.lanternMeta = 1; S.handled[S.day + ':market'] = 1; S.handled[S.day + ':street'] = 1; __wb.tp([30, 27.4]); })()")
            step(30, False)
            capture('look', lambda i: (i == 10 and pg.evaluate("__wb.G.look.raise()")) or (i == 120 and pg.evaluate("__wb.G.look.near && __wb.G.look.near.length && __wb.G.look.pickIndex(0)")))
        elif sc == 'festival':
            # the festival at night: string lights, stalls, the crowd, standing in the square
            settings()
            until("!__wb.busy() && __wb.mode() === 'play' && !__wb.mg()")
            pg.evaluate("(() => { const S = __wb.state(); S.day = 3; S.min = 1199; S.flags.decided = 1; S.flags.shift1 = 1; S.flags.escort = 1; S.flags.escort_done = 1; for (const z of ['market', 'street', 'festival', 'homerow', 'transit', 'commons', 'farend']) S.handled['3:' + z] = 1; S.handled['3:festival:f'] = 1; S.energy = 100; __wb.G.run(() => __wb.G.story.festival()); })()")
            until("!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 120, 6)
            step(30, False)
            capture('festival')
        elif sc == 'release':
            # the lantern release at the end of the festival (the note is read, then the lanterns go up)
            settings()
            until("!!__wb.state().flags.festival && !__wb.busy()", 60, 2)
            pg.evaluate("__wb.G.run(() => __wb.G.story.finale())")
            capture('release', lambda i: pg.evaluate("__wb.waiter() === 'line' && __wb.adv()"))
        elif sc in ('act2works', 'act2fest', 'act3fest'):
            # ten and twenty years on: the Works with Unit (and the soft lights), the festival with the drone, the
            # festival twenty years on (benches, Juno, the Fund's plate); each one starts with a reload, as in the game
            act = 3 if sc == 'act3fest' else 2
            pg.evaluate("__wb.gotoAct(%d, { built: %s })" % (act, "['quiet', 'board']" if act == 3 else "['quiet', 'dim']"))
            pg.wait_for_timeout(1500); pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
            t0 = time.time()
            while time.time() - t0 < 240:
                if pg.evaluate("__wb.waiter() === 'choice' || __wb.waiter() === 'barrier'"): pg.evaluate("(() => { const o = __wb.options(); const k = o.findIndex((x) => x.id === 'age_keep'); __wb.choose(k >= 0 ? k : Math.max(0, o.findIndex((x) => !x.disabled))); })()")
                if pg.evaluate("__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()" + (" && !!__wb.state().flags.juno3" if act == 3 else "")): break
                pg.evaluate("__wb.waiter() === 'line' && __wb.adv()")
                if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('today'))"): pg.evaluate("document.querySelector('#tgo').click()")
                step(6, False); pg.wait_for_timeout(30)
            settings()
            if sc == 'act2works':
                # inside the Works with Unit at Dot's old desk, the lamps and plants of the soft lights; no card
                pg.evaluate("(() => { const S = __wb.state(); S.flags.works2 = 1; S.flags.mail2 = 'done'; S.min = 560; __wb.G.run(() => __wb.G.enterRoom('works')); })()")
                until("__wb.loc() === 'works' && !__wb.busy()", 60, 2)
                step(30, False)
                capture('act2works', lambda i: i == 30 and pg.evaluate("(() => { const r = __wb.G.rooms.works; if (r.burst) r.burst(2); })()"))
                continue
            pg.evaluate("(() => { const S = __wb.state(); S.flags.decided = 1; S.flags.council = 1; S.flags.councilDone = 1; S.flags.remind = 1; S.flags.square3 = 1; S.flags.conflict3 = 1; S.min = 1200; for (const z of ['market', 'street', 'festival', 'homerow', 'transit', 'commons', 'farend']) S.handled['1:' + z] = 1; S.handled['1:festival:f'] = 1; S.energy = 100; if (__wb.loc() !== 'town') __wb.tp([30, 34]); })()")
            until("!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 180, 6)
            step(30, False)
            capture(sc)
    print('errors', errs[:6])
    b.close()

print('\nscenario  frames  max flashes/s  transitions/s  worst tile  at (s)  max tile swing  verdict')
for k, r in results.items():
    print('%-9s %6d  %13d  %13d  %10s  %6s  %14.3f  %s' % (k, r['frames'], r['flashes'], r['transitions'], r['tile'], r['at_s'], r['max_tile_swing'], 'pass' if r['pass'] else 'FAIL'))
print(json.dumps(results))
sys.exit(0 if all(r['pass'] for r in results.values()) else 1)
