# Looks at two Who decided? cards from the later visits at the normal clock (no fast mode, so each card waits for a
# click): Tomas at the ramp (Act 2: the ramp outside, not the room inside) and Juno at the Shed (Act 3). Saves
# screenshots to test/shots_decided and checks the card text.
# usage: python3 test/decided_view.py
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
D = '/home/claude/wb4/test/shots_decided'; os.makedirs(D, exist_ok=True)
ok_all = True
def check(name, cond, info=''):
    global ok_all
    if not cond: ok_all = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:600]), flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for act, row, name in [
        (2, {'k': 'barrier', 'z': 'ramp', 'v': 'stand', 'by': 'tomas', 'pay': ['you', 'tomas'], 'dim': 'bots', 'dir': 'over'}, 'ramp'),
        (3, {'k': 'barrier', 'z': 'commons', 'v': 'fix', 'by': 'you', 'pay': ['you', 'bao'], 'turn': 1, 'why': 'Your fix was made to fit you. It didn\'t fit Juno.'}, 'juno'),
    ]:
        pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
        pg.goto(BASE + '?test=1&mute=1&seed=71'); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
        pg.evaluate("__wb.gotoAct(%d, { built: ['quiet', 'ramp', 'board'] })" % act)
        pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
        # play the arrival through (lines, the first open option, the today card) until you are free to walk
        t0 = time.time()
        while time.time() - t0 < 180:
            if pg.evaluate("__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()" + (" && !!__wb.state().flags.juno3" if act == 3 else "")): break
            w = pg.evaluate('__wb.waiter()')
            if w == 'line': pg.evaluate('__wb.adv()')
            elif w in ('choice', 'barrier'): pg.evaluate("(() => { const o = __wb.options(); const k = o.findIndex((x) => ['age_keep', 'coop_no'].includes(x.id)); __wb.choose(k >= 0 ? k : Math.max(0, o.findIndex((x) => !x.disabled))); })()")
            elif pg.evaluate("!!document.querySelector('#panel:not([hidden]) #tgo')"): pg.evaluate("document.querySelector('#panel #tgo').click()")
            pg.wait_for_timeout(150)
        # straight to Who decided?, with this one moment in the log
        r = dict(row); r.update({'d': 1, 'm': 640, 'f': {'e': 70, 'gear': 'none', 'burn': 0}})
        pg.evaluate("(r) => { const G = __wb.G, S = __wb.state(); G.ui.closePanel && G.ui.closePanel(); G.ui.hideDialog && G.ui.hideDialog(); S.log = [r]; G.busy = 0; G.mode = 'play'; G.run(() => G.story.whoDecided()); }", r)
        try: pg.wait_for_function("!!(__wb.panel() && __wb.panel().includes('decided')) && !!document.querySelector('#panel #dnext')", timeout=60000)
        except Exception: check(name + ': the card opens', False, errors[:3]); pg.close(); continue
        pg.wait_for_timeout(1800); pg.screenshot(path='%s/%s.png' % (D, name))
        txt = pg.evaluate("document.querySelector('#panel').innerText")
        if name == 'ramp': check('ramp: the Works ramp, its own causes, Tomas pays', 'The Works ramp' in txt and 'carts and chairs' in txt and 'Tomas' in txt and 'founders\' building manual' not in txt, txt)
        else: check('juno: at the Commons, Juno\'s pinch, the Shed\'s causes, no "for you"', 'The Commons' in txt and 'didn\'t fit Juno' in txt and 'The Shed decides' in txt and ' for you.' not in txt, txt)
        check(name + ': no page errors', not errors, errors[:3])
        pg.close()
    b.close()
sys.exit(0 if ok_all else 1)
