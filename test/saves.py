# Saves: a new visit writes a morning save; reloading offers Continue with the right label and restores the state;
# a browser that blocks storage shows the banner and still offers a save code. Prints a JSON summary; exit 1 on failure.
import json, sys, time
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mute=1&seed=11'
BLOCK = "(() => { const thrower = { get() { throw new DOMException('blocked', 'SecurityError'); } }; Object.defineProperty(window, 'localStorage', thrower); })()"

def drive_to(pg, until, budget=150):
    """Answer the title, creator, setup, today and dialogue panels until until(state) is true."""
    t0 = time.time()
    while time.time() - t0 < budget:
        pg.wait_for_timeout(60)
        st = pg.evaluate("(() => { const s = __wb.state(); return { panel: __wb.panel(), waiter: __wb.waiter(), mode: __wb.mode(), busy: __wb.busy(), day: s.day, min: s.min, ov: !!document.querySelector('#overlay:not([hidden])') } })()")
        if until(st): return st
        panel = st['panel'] or ''
        if st['ov']: pg.evaluate("(() => { const b = document.querySelector('#overlay #cGo') || document.querySelector('#overlay #nOk') || document.querySelector('#overlay [data-back]'); if (b) b.click(); })()"); continue
        if 'title' in panel: pg.evaluate("(document.querySelector('#tNew')).click()"); continue
        if 'creator' in panel: pg.evaluate("document.querySelector('#done').click()"); continue
        if 'setup' in panel: pg.evaluate("document.querySelector('#next').click()"); continue
        if 'center' in panel:
            pg.evaluate("(() => { const g = document.querySelector('#panel #tgo') || document.querySelector('#panel #sleep') || document.querySelector('#panel #go') || document.querySelector('#panel #done'); if (g) g.click(); })()"); continue
        if st['waiter'] == 'line': pg.evaluate('__wb.adv()'); continue
        if st['waiter'] in ('choice', 'barrier'):
            opts = pg.evaluate('__wb.options()'); i = next((k for k, o in enumerate(opts) if not o['disabled']), 0); pg.evaluate('__wb.choose(%d)' % i); continue
    raise Exception('timeout waiting; last state %s' % st)

out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info]);
    if not cond: out['ok'] = False

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 760})
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    # play to the first morning's free time
    drive_to(pg, lambda st: st['day'] == 1 and st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'])
    sv = pg.evaluate("JSON.parse(localStorage.getItem('mtf.save') || 'null')")
    check('morning save written', sv and sv['day'] == 1 and sv['phase'] == 'morning', sv and (sv['day'], sv['phase'], sv['label']))
    check('no portrait in save', sv and 'portrait0' not in sv['S'])
    # end the day: go home and sleep, through the night page, to the next morning
    pg.evaluate("__wb.G.story.finishDay('sleep')")
    drive_to(pg, lambda st: st['day'] == 2 and st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'])
    sv2 = pg.evaluate("JSON.parse(localStorage.getItem('mtf.save') || 'null')")
    check('second morning save', sv2 and sv2['day'] == 2 and sv2['label'] == 'Tuesday morning', sv2 and sv2['label'])
    before = sv2['S']
    # reload: the title offers Continue with the label
    pg.reload(); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000); pg.wait_for_timeout(400)
    lab = pg.evaluate("(() => { const b = document.querySelector('#tCont'); return b ? b.innerText : null; })()")
    check('continue offered', lab and 'Tuesday morning' in lab, lab)
    pg.evaluate("document.querySelector('#tCont').click()")
    drive_to(pg, lambda st: st['day'] == 2 and st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'])
    after = pg.evaluate("(() => { const s = __wb.state(); return { energy: s.energy, self: s.self, coins: s.coins, bonds: s.bonds, fixes: s.fixes, flags: s.flags, look: s.look, profile: s.profile, name: s.name, jar: (s.jar||[]).length } })()")
    for k in ('coins', 'bonds', 'look', 'profile', 'name'):
        check('restored ' + k, after[k] == before[k], (after[k], before[k]))
    home_ok = pg.evaluate("(() => { const h = __wb.G.rooms.home; return !!h; })()")
    check('home room present', home_ok)
    check('no page errors (main)', not errors, errors[:3])
    ctx.close()
    # storage blocked
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 760}); ctx2.add_init_script(BLOCK)
    pg2 = ctx2.new_page(); err2 = []
    pg2.on('pageerror', lambda e: err2.append(str(e)[:300]))
    pg2.goto(URL); pg2.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000); pg2.wait_for_timeout(400)
    banner = pg2.evaluate("(() => { const b = document.querySelector('.tbanner'); return b ? b.innerText : null; })()")
    check('blocked: banner shown', bool(banner), banner)
    drive_to(pg2, lambda st: st['day'] == 1 and st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'])
    pg2.evaluate("__wb.G.openPause()"); pg2.wait_for_timeout(300)
    pg2.evaluate("document.querySelector('#overlay #pCode').click()"); pg2.wait_for_timeout(800)
    code = pg2.evaluate("(() => { const t = document.querySelector('#overlay .codebox'); return t ? t.value : null; })()")
    check('blocked: save code offered', code and code.startswith('MTFS1'), code and code[:12])
    check('blocked: code has no name', code and 'Sam' not in code)
    check('no page errors (blocked)', not err2, err2[:3])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
