# Shared helpers for Playwright tests: launch args and a driver that answers the title, creator, setup, today and
# dialogue panels until a condition on the game state holds.
import time
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
BASE = 'file:///home/claude/wb4/dist/who-bends.html'
STATE_JS = "(() => { const s = __wb.state(); return { panel: __wb.panel(), waiter: __wb.waiter(), mode: __wb.mode(), busy: __wb.busy(), day: s.day, min: s.min, loc: __wb.loc(), zone: __wb.zone(), ov: !!document.querySelector('#overlay:not([hidden])'), mg: __wb.mg() } })()"

def free(st):
    return st['mode'] == 'play' and not st['panel'] and not st['waiter'] and not st['busy'] and not st['ov'] and not st['mg']

def drive_to(pg, until, budget=150, creator=None, choose=None):
    """Answer panels until until(state) is true. creator(pg) runs once when the creator opens; choose(opts) picks an
    option index (default: the first enabled one)."""
    t0 = time.time(); did_creator = False; st = None
    while time.time() - t0 < budget:
        pg.wait_for_timeout(60)
        st = pg.evaluate(STATE_JS)
        if until(st): return st
        panel = st['panel'] or ''
        if st['ov']: pg.evaluate("(() => { const b = document.querySelector('#overlay #cGo') || document.querySelector('#overlay #nOk') || document.querySelector('#overlay [data-back]'); if (b) b.click(); })()"); continue
        if st['mg']: pg.evaluate('__wb.mgAuto(0.8)'); continue
        if 'title' in panel: pg.evaluate("document.querySelector('#tNew').click()"); continue
        if 'creator' in panel:
            if creator and not did_creator: did_creator = True; creator(pg)
            pg.evaluate("document.querySelector('#done').click()"); continue
        if 'setup' in panel: pg.evaluate("document.querySelector('#next').click()"); continue
        if 'center' in panel:
            pg.evaluate("(() => { const g = document.querySelector('#panel #tgo') || document.querySelector('#panel #sleep') || document.querySelector('#panel #go') || document.querySelector('#panel #done'); if (g) g.click(); })()"); continue
        if st['waiter'] == 'line': pg.evaluate('__wb.adv()'); continue
        if st['waiter'] in ('choice', 'barrier'):
            opts = pg.evaluate('__wb.options()')
            i = choose(opts) if choose else None
            if i is None: i = next((k for k, o in enumerate(opts) if not o['disabled']), 0)
            pg.evaluate('__wb.choose(%d)' % i); continue
    raise Exception('timeout waiting; last state %s' % st)
