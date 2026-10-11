# Keyboard-only conversations: E (or Space, or Enter) starts a conversation with the person in front of you, the same
# key moves through it, and the key that closes the last line does not start the conversation again.
# usage: python3 test/keys.py
import json, sys, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to
URL = BASE + '?test=1&fast=1&mute=1&seed=31'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:600]), flush=True)
FREE = lambda st: st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'] and not st['ov'] and not st['mg']
# stand next to someone in town who has had their conversation for today (their next one is a single line)
NEAR = """(() => { const G = __wb.G, S = G.S; const p = G.player.root.position;
  for (const z of ['market', 'commons', 'square', 'street', 'homerow', 'farend', 'transit', 'pond']) S.handled[S.day + ':' + z] = 1;
  for (const [id, n] of Object.entries(G.npcs)) { if (n.place !== 'town' || !n.c.root.visible || id === 'bea') continue;
    const q = n.c.root.position; S.met[id] = true; S.talked[id] = true; n.path = []; n.goal = null;
    G.place([q.x + 1.1, q.z + 0.2]); G.player.heading = -Math.PI / 2; return id; }
  return null; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    drive_to(pg, lambda st: FREE(st) and st['day'] == 1, budget=300)
    # out into town at noon (after the first-morning walk), the clock held still
    pg.evaluate("__wb.G.timeScale = 0; __wb.state().min = 700; __wb.state().flags.shift1 = 1; __wb.state().flags.lantern = 1")
    if pg.evaluate('__wb.loc()') != 'town': pg.evaluate('__wb.G.run(() => __wb.G.exitRoom())')
    drive_to(pg, lambda st: FREE(st) and st['loc'] == 'town', budget=60)
    # count conversations as they start
    pg.evaluate("(() => { const st = __wb.G.story; const t = st.talkTo.bind(st); window.__talks = 0; st.talkTo = (id) => { window.__talks++; return t(id); }; })()")
    for key in ['e', 'Space', 'Enter']:
        drive_to(pg, FREE, budget=30)
        who = pg.evaluate(NEAR); pg.evaluate('__wb.G.timeScale = 2.5'); pg.wait_for_timeout(400)
        tgt = pg.evaluate('__wb.target()')
        check('%s: standing next to %s, who is the one to talk to' % (key, who), who and tgt == who, [who, tgt])
        pg.evaluate('window.__talks = 0')
        pg.keyboard.press('e'); pg.wait_for_timeout(300)
        st = pg.evaluate("({ w: __wb.waiter(), n: window.__talks })")
        check('E starts the conversation', st['w'] == 'line' and st['n'] == 1, st)
        # move through it with the key, at a reader's pace, until it closes
        for _ in range(12):
            if pg.evaluate('__wb.waiter()') != 'line': break
            pg.keyboard.press(key); pg.wait_for_timeout(300)
        pg.wait_for_timeout(600)
        st = pg.evaluate("({ w: __wb.waiter(), n: window.__talks, busy: __wb.busy() })")
        check('%s on the last line closes it, and the conversation does not start again' % key, st['n'] == 1 and not st['w'], st)
        pg.evaluate('__wb.G.timeScale = 0')
    check('no page errors', not errors, errors[:4])
    b.close()
print(json.dumps({'ok': out['ok'], 'failed': [c for c in out['checks'] if not c[1]]}, default=str)[:3000])
sys.exit(0 if out['ok'] else 1)
