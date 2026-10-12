# A phone (390 x 844, touch) through the later visits and the recap: every panel screenshotted, and checked for
# sideways overflow (nothing wider than the screen, no button cut off at the edge) and for tap targets that are too
# small (under 40 px tall). Screens go to test/shots_phone; look at them.
# usage: python3 test/phone23.py
from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, REPO + '/test')
from drive import ARGS, BASE
D = REPO + '/test/shots_phone'; os.makedirs(D, exist_ok=True)
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:700]), flush=True)
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
def until(pg, js, t=40, pick=first):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        w = pg.evaluate('__wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w in ('choice', 'barrier') and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        elif pg.evaluate("!!document.querySelector('#panel:not([hidden]) #tgo')"): pg.evaluate("document.querySelector('#panel #tgo').click()")
        if pg.evaluate('__wb.mg()'): pg.evaluate('__wb.mgAuto(0.9)')
        pg.wait_for_timeout(60)
    return False
# sideways overflow and small tap targets, on whatever is showing
LAYOUT = """(() => { const W = innerWidth; const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const btns = [...document.querySelectorAll('button, [role=button], a.btn, .choice')].filter(vis);
  const cut = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.right > W + 1 || r.left < -1; }).map((b) => (b.innerText || b.getAttribute('aria-label') || b.id || b.className).slice(0, 40));
  const small = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 40 && !b.closest('.scale') && !b.classList.contains('mini-btn') && !b.closest('.phone-tabs'); }).map((b) => [(b.innerText || b.getAttribute('aria-label') || b.id || b.className).slice(0, 30), Math.round(b.getBoundingClientRect().height)]);
  return { sw: document.documentElement.scrollWidth, W, cut, small: small.slice(0, 8) }; })()"""
def snap(pg, name, strict=True):
    pg.evaluate('__wb.G && (__wb.G.forceRender = true)'); pg.wait_for_timeout(350)
    pg.screenshot(path='%s/%s.png' % (D, name))
    L = pg.evaluate(LAYOUT)
    check('%s: nothing wider than the screen, no button cut off' % name, L['sw'] <= L['W'] + 1 and not L['cut'], L)
    if strict: check('%s: tap targets at least 40 px tall' % name, not L['small'], L['small'])
    return L

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(BASE + '?test=1&v1=1&fast=1&mute=1&seed=61'); pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    snap(pg, '01_title')
    # the recap
    pg.evaluate("document.querySelector('#tPb').click()"); pg.wait_for_selector('#cRecap', timeout=10000); snap(pg, '02_played_before')
    pg.evaluate("document.querySelector('#cRecap').click()"); pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=30000); snap(pg, '03_recap_creator', strict=False)
    pg.evaluate("document.querySelector('#done').click()"); pg.wait_for_selector('#rdone', timeout=20000); snap(pg, '04_recap_room', strict=False)
    pg.evaluate("document.querySelector('#rdone').click()"); pg.wait_for_selector('#rgo', timeout=20000); snap(pg, '05_recap_choices', strict=False)
    pg.evaluate("document.querySelector('#rrand').click()"); pg.wait_for_timeout(200); snap(pg, '06_recap_random', strict=False)
    pg.evaluate("document.querySelector('#rgo').click()")
    ok = until(pg, "!!(window.__wb.ret && __wb.ret()) && __wb.waiter() === 'choice'", 90, pick=None)
    check('recap: into ten years later', ok)
    snap(pg, '07_a2_arrival_choice')
    pg.evaluate("__wb.choose(0)")
    until(pg, "!!(__wb.panel() && __wb.panel().includes('today'))", 40, pick=None); snap(pg, '08_a2_today')
    pg.evaluate("document.querySelector('#tgo').click()")
    until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 40)
    snap(pg, '09_a2_play', strict=False)
    # the kiosk card, then Teach Unit (as a task)
    pg.evaluate("(() => { const S = __wb.state(); S.min = Math.max(S.min, 560); S.look.voice = 'chime'; __wb.tp([32, 14.6]); })()")
    until(pg, "__wb.target() === 'hall' && !__wb.busy() && !__wb.waiter()", 40)
    pg.evaluate('__wb.act()')
    if until(pg, "__wb.waiter() === 'barrier'", 40, pick=None): snap(pg, '10_a2_kiosk_card')
    until(pg, "!__wb.busy() && !__wb.waiter()", 40, pick=lambda o: next((k for k, x in enumerate(o) if x['key'] == 'leave'), 0))
    pg.evaluate("__wb.mgTest('teach')"); until(pg, "!!(__wb.G.mg && document.querySelector('.mg-over .go'))", 30, pick=None); snap(pg, '11_teach_intro')
    pg.evaluate("document.querySelector('.mg-over .go') && document.querySelector('.mg-over .go').click()"); pg.wait_for_timeout(700); snap(pg, '12_teach_play', strict=False)
    pg.evaluate("__wb.G.mg && __wb.G.mg.running && __wb.G.mg.end()")
    if until(pg, "!!document.querySelector('.mg-result .go')", 20, pick=None): snap(pg, '13_teach_result')
    pg.evaluate("document.querySelector('.mg-result .go') && document.querySelector('.mg-result .go').click()"); until(pg, "!__wb.mg() && !__wb.busy()", 40)
    # the phone and the notebook, ten years on
    pg.evaluate("__wb.G.phoneOpen || __wb.G.togglePhone()"); pg.wait_for_timeout(500); snap(pg, '14_phone', strict=False)
    pg.evaluate("document.querySelector('[data-tab=notebook]') && document.querySelector('[data-tab=notebook]').click()"); pg.wait_for_timeout(400); snap(pg, '15_notebook', strict=False)
    pg.evaluate("__wb.G.phoneOpen && __wb.G.togglePhone()"); pg.wait_for_timeout(300)
    # Who decided? and the ending, then the fit card
    pg.evaluate("(() => { const S = __wb.state(); S.stakeDue = {}; S.flags.council = 1; S.flags.councilDone = 1; S.flags.remind = 1; S.min = 1169; })()")
    t0 = time.time(); got = False
    while time.time() - t0 < 120:
        if pg.evaluate("!!(__wb.panel() && __wb.panel().includes('decided'))"):
            if not got: snap(pg, '16_who_decided'); got = True
            pg.evaluate("(() => { const b = document.querySelector('#panel #dnext') || document.querySelector('#panel [data-id]'); if (b) b.click(); })()")
        if pg.evaluate("!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()"): break
        if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
        elif pg.evaluate("__wb.waiter() === 'choice'"): pg.evaluate('__wb.choose(0)')
        pg.wait_for_timeout(60)
    pg.evaluate("__wb.state().min = 1289")
    if until(pg, "!!(__wb.panel() && __wb.panel().includes('ending'))", 120):
        pg.wait_for_timeout(600); snap(pg, '17_ending', strict=False)
        pg.evaluate("document.querySelector('#card') && document.querySelector('#card').click()")
        try: pg.wait_for_function("!!document.querySelector('#cardbox img')", timeout=20000); pg.evaluate("document.querySelector('#cardbox').scrollIntoView()"); snap(pg, '18_fit_card', strict=False)
        except Exception: check('fit card opens on a phone', False)
    else: check('Act 2 ending reached on a phone', False)
    # Act 3: Juno's card, with Juno's face
    pg.evaluate("__wb.gotoAct(3, { built: ['quiet', 'board'] })")
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    ok = until(pg, "__wb.waiter() === 'barrier'", 90, pick=lambda o: next((k for k, x in enumerate(o) if x['id'] in ('coop_yes', 'age_keep')), first(o)))
    if ok: snap(pg, '19_a3_juno_card')
    check('Act 3: Juno\'s card on a phone', ok)
    check('no page errors', not errors, errors[:5])
    b.close()
print(json.dumps({'ok': out['ok'], 'failed': [c for c in out['checks'] if not c[1]]}, default=str)[:3000])
sys.exit(0 if out['ok'] else 1)
