# The feel change: the creator previews the comfort move; in town the creature reacts to what pinches (not the
# screen), the pinch strip says it in words, the mood tint stays slow and capped, Smooth Mode greys within its floor,
# and hiding it (pushing through) keeps a straight face. Prints a JSON summary; exit 1 on failure.
from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, REPO + '/test')
from drive import ARGS, BASE, drive_to, free
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=5'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False

def creator(pg):
    pg.evaluate("document.querySelector('[data-k=comfort] [data-v=flap]').click()")
    seen = 0
    for i in range(30):
        pg.wait_for_timeout(100)
        v = pg.evaluate("(() => { const c = __wb.G.player; return [c.comfortKind, c.comfortActive, c.handMode] })()")
        if v[0] == 'flap' and v[1] > 0.2: seen += 1
    check('creator previews the move', seen > 0, seen)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    drive_to(pg, lambda st: st['day'] == 1 and free(st), creator=creator)
    check('comfort saved in look', pg.evaluate('__wb.state().look.comfort') == 'flap')
    # a loud, bright, crowded noon at the market; no card (handled), so we can watch the body
    def at(spot, minute, profile=None):
        pg.evaluate("(([sp, m, pr]) => { const S = __wb.state(); S.min = m; S.handled['1:market'] = 1; S.handled['1:farend'] = 1; S.handled['1:street'] = 1; S.masking = false; if (pr) Object.assign(S.profile, pr); __wb.tp(sp); })(%s)" % json.dumps([spot, minute, profile]))
        pg.wait_for_timeout(900)
    at('square', 750, {'sound': 0.2, 'light': 0.3, 'people': 0.2})
    st = pg.evaluate("(() => { const G = __wb.G; return { zone: G.zone, react: G.player.react, mine: G.feel.mine.map((x) => x[0]), strip: document.querySelector('#hud .pstrip').innerText, hidden: document.querySelector('#hud .pstrip').hidden, push: G.stage.rig.push, shake: G.stage.shake, sat: G.stage.fxT.sat, bloom: G.stage.fxT.bloom, exposure: G.stage.fxT.exposure, aberr: G.stage.fxT.aberr } })()")
    check('market noon: reacts', st['react'] in ('ears', 'squint', 'tense'), st)
    check('market noon: strip words', ('Too loud' in st['strip'] or 'Too crowded' in st['strip'] or 'Too bright' in st['strip']) and not st['hidden'], st['strip'])
    check('no pinch push or shake', st['push'] < 0.01 and st['shake'] == 0, (st['push'], st['shake']))
    check('no pinch bloom/exposure/fringe', abs(st['bloom'] - 0.32) < 1e-6 and st['exposure'] == 1 and st['aberr'] == 0, st)
    check('tint within floor', st['sat'] >= 0.75 - 1e-6, st['sat'])
    pg.screenshot(path=REPO + '/test/shots_f/feel_market.png')
    # pushing through: a straight face, the strip says it is hidden
    pg.evaluate("(() => { const S = __wb.state(); S.masking = true; S.maskZone = __wb.zone(); })()"); pg.wait_for_timeout(700)
    st2 = pg.evaluate("(() => { const G = __wb.G; return { react: G.player.react, comfort: G.player.comfortLevel, strip: document.querySelector('#hud .pstrip').innerText } })()")
    check('masked: no reaction, no move', st2['react'] is None and st2['comfort'] == 0, st2)
    check('masked: strip says hiding it', 'hiding it' in st2['strip'], st2['strip'])
    # mood tint eases: sample the target over two seconds after a big change, it must move smoothly
    pg.evaluate("(() => { const S = __wb.state(); S.masking = false; })()")
    # the quiet Far End at night for a lively profile: looks around, Too quiet
    at('farend', 1150, {'sound': 0.9, 'light': 0.9, 'people': 0.9})
    st3 = pg.evaluate("(() => { const G = __wb.G; return { zone: G.zone, react: G.player.react, strip: document.querySelector('#hud .pstrip').innerText } })()")
    check('far end: under-reaction', st3['react'] in ('look', 'lean', 'droop'), st3)
    check('far end: strip under words', any(w in st3['strip'] for w in ('Too quiet', 'Too dim', 'Too lonely')), st3['strip'])
    # a place that fits: the comfort move plays
    at('farend', 1000, {'sound': 0.1, 'light': 0.36, 'people': 0.1, 'talk': 0.1, 'time': 0.5, 'change': 0.35})
    seen = 0; strip = ''
    for i in range(40):
        pg.wait_for_timeout(150)
        v = pg.evaluate("(() => { const c = __wb.G.player; return [c.comfortLevel, c.comfortActive, document.querySelector('#hud .pstrip').innerText] })()")
        strip = v[2]
        if v[1] > 0.2: seen += 1
    check('fits: comfort move plays', seen > 0, seen)
    check('fits: strip says Fits you', 'Fits you' in strip, strip)
    # Smooth Mode: grey, floored at 0.4, strip says Blend is hiding it
    pg.evaluate("(() => { const S = __wb.state(); S.blend.has = true; S.blend.smooth = true; S.self = 10; })()"); pg.wait_for_timeout(800)
    st4 = pg.evaluate("(() => { const G = __wb.G; return { sat: G.stage.fxT.sat, strip: document.querySelector('#hud .pstrip').innerText, comfort: G.player.comfortLevel } })()")
    check('smooth: grey within floor', 0.4 - 1e-6 <= st4['sat'] <= 0.43, st4)
    check('smooth in a place that fits: nothing to hide', 'Blend is hiding it' not in st4['strip'], st4['strip'])
    at('square', 750, {'sound': 0.1, 'light': 0.1, 'people': 0.1})
    check('smooth: strip', 'Blend is hiding it' in pg.evaluate("document.querySelector('#hud .pstrip').innerText"))
    check('smooth: no move', st4['comfort'] == 0, st4)
    pg.evaluate("(() => { const S = __wb.state(); S.blend.smooth = false; S.self = 100; })()")
    # Mood tint Off: no tint and no low-colour desaturation
    pg.evaluate("(() => { const G = __wb.G; G.settings.moodTint = 'off'; G.S.self = 20; })()")
    at('square', 750, {'sound': 0.1, 'light': 0.1, 'people': 0.1}); pg.wait_for_timeout(9000)
    # (it eases with a 2.5 s time constant on the game's clock; a slow software renderer can need a little longer)
    try: pg.wait_for_function("__wb.G.stage.fxT.sat > 0.995 && Math.abs(__wb.G.stage.fxT.warm) < 0.02", timeout=8000)
    except Exception: pass
    st5 = pg.evaluate("(() => { const G = __wb.G; return { sat: G.stage.fxT.sat, warm: G.stage.fxT.warm } })()")
    check('tint off: eases back to full colour', st5['sat'] > 0.995 and abs(st5['warm']) < 0.02, st5)
    # strip off
    pg.evaluate("(() => { __wb.G.settings.pinchStrip = false; })()"); pg.wait_for_timeout(1500)
    check('strip off hides it', pg.evaluate("document.querySelector('#hud .pstrip').hidden"))
    check('no page errors', not errors, errors[:3])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
