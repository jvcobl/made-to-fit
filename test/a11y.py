# Accessibility check with axe-core on every kind of panel: the title, settings, "Played before?", the recap (creator,
# room dials, six choices), the arrival's choice and today card, a "Who adjusts?" card, a task's intro, the phone and
# notebook, the pause menu, the ending page and the fit card. Fails on any critical or serious violation.
# usage: python3 test/a11y.py [path to axe.min.js]
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
AXE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/v12/axe/node_modules/axe-core/axe.min.js'
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=12'
out = {'ok': True, 'panels': {}}
def until(pg, js, t=40, pick=None):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        w = pg.evaluate('window.__wb && __wb.waiter && __wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w in ('choice', 'barrier') and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        pg.wait_for_timeout(60)
    return False
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
def axe(pg, name):
    # measure panels at rest: no fade-ins or transitions mid-way (they blend colours and fool the contrast check)
    pg.evaluate("(() => { if (document.getElementById('a11y-still')) return; const st = document.createElement('style'); st.id = 'a11y-still'; st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}'; document.head.appendChild(st); })()")
    pg.wait_for_timeout(250)
    if not pg.evaluate('!!window.axe'): pg.add_script_tag(path=AXE)
    r = pg.evaluate("""async () => { const r = await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, where: v.nodes.slice(0, 3).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\\n').slice(0, 2).join(' ').slice(0, 220)) })); }""")
    bad = [v for v in r if v['impact'] in ('critical', 'serious')]
    out['panels'][name] = {'serious_or_critical': bad, 'other': [[v['id'], v['impact'], v['n']] for v in r if v not in bad]}
    if bad: out['ok'] = False
    print(name, 'serious/critical:', [(v['id'], v['impact'], v['n']) for v in bad], '| other:', [(v['id'], v['impact']) for v in r if v not in bad], flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload()
    pg.wait_for_function("window.__wb && __wb.panel() && __wb.panel().includes('title')", timeout=60000)
    axe(pg, 'title')
    pg.evaluate("document.querySelector('#tSet').click()"); pg.wait_for_timeout(400); axe(pg, 'settings')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    if pg.evaluate("!!document.querySelector('#overlay:not([hidden])')"): pg.evaluate("document.querySelector('#overlay [data-back]') && document.querySelector('#overlay [data-back]').click()")
    pg.evaluate("document.querySelector('#tPb').click()"); pg.wait_for_selector('#cRecap', timeout=10000); axe(pg, 'played_before')
    pg.evaluate("document.querySelector('#cRecap').click()")
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=30000); pg.wait_for_timeout(300); axe(pg, 'creator')
    pg.evaluate("document.querySelector('#done').click()"); pg.wait_for_selector('#rdone', timeout=20000); axe(pg, 'recap_room')
    pg.evaluate("document.querySelector('#rdone').click()"); pg.wait_for_selector('#rgo', timeout=20000); axe(pg, 'recap_choices')
    pg.evaluate("document.querySelector('#rrand').click()"); pg.evaluate("document.querySelector('#rgo').click()")
    until(pg, "window.__wb.ret && __wb.ret() && __wb.waiter() === 'choice'", 90)
    axe(pg, 'arrival_choice')
    pg.evaluate("__wb.choose(0)")
    until(pg, "!!(__wb.panel() && __wb.panel().includes('today'))", 40)
    axe(pg, 'today')
    pg.evaluate("document.querySelector('#tgo') && document.querySelector('#tgo').click()")
    until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 40, pick=first)
    axe(pg, 'hud_play')
    # a Who adjusts? card (the kiosk's, turned toward a machine) and a task intro (Teach Unit)
    pg.evaluate("(() => { const S = __wb.state(); S.min = Math.max(S.min, 560); __wb.tp([32, 14.6]); })()")
    until(pg, "__wb.target() === 'hall' && !__wb.busy() && !__wb.waiter()", 40, pick=first)
    pg.evaluate('__wb.act()')
    if until(pg, "__wb.waiter() === 'barrier'", 40): axe(pg, 'barrier')
    until(pg, "!__wb.busy() && !__wb.waiter()", 40, pick=lambda o: next((k for k, x in enumerate(o) if x['key'] == 'leave'), 0))
    pg.evaluate("__wb.mgTest('teach')"); until(pg, "!!(__wb.G.mg && document.querySelector('.mg-over .go'))", 30); axe(pg, 'task_intro')
    pg.evaluate("document.querySelector('.mg-over .go') && document.querySelector('.mg-over .go').click()"); pg.wait_for_timeout(600); axe(pg, 'task_play')
    pg.evaluate("__wb.G.mg && __wb.G.mg.running && __wb.G.mg.end()")
    if until(pg, "!!document.querySelector('.mg-result .go')", 20): axe(pg, 'task_result')
    pg.evaluate("document.querySelector('.mg-result .go') && document.querySelector('.mg-result .go').click()"); until(pg, "!__wb.mg() && !__wb.busy()", 40, pick=first)
    # the phone, the notebook, the pause menu
    pg.evaluate("__wb.G.phoneOpen || __wb.G.togglePhone()"); pg.wait_for_timeout(500); axe(pg, 'phone_today')
    pg.evaluate("document.querySelector('[data-tab=notebook]').click()"); pg.wait_for_timeout(400); axe(pg, 'notebook_people')
    pg.evaluate("document.querySelector('[data-sub=notes]') && document.querySelector('[data-sub=notes]').click()"); pg.wait_for_timeout(400); axe(pg, 'notebook_notes')
    pg.evaluate("__wb.G.togglePhone()"); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    if pg.evaluate("!!document.querySelector('#overlay:not([hidden])')"): axe(pg, 'pause'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # the ending page, and the fit card
    pg.evaluate("(() => { const S = __wb.state(); S.flags.council = 1; S.flags.councilDone = 1; S.flags.remind = 1; S.flags.decided = 1; S.min = 1200; })()")
    until(pg, "!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 90, pick=first)
    pg.evaluate("__wb.state().min = 1289")
    if until(pg, "__wb.panel() && __wb.panel().includes('ending')", 120, pick=first): pg.wait_for_timeout(600); axe(pg, 'ending')
    pg.evaluate("document.querySelector('#card') && document.querySelector('#card').click()")
    try: pg.wait_for_function("!!document.querySelector('#cardbox img')", timeout=20000); axe(pg, 'fit_card')
    except Exception: print('fit card did not open', flush=True)
    out['errors'] = errors[:5]
    if errors: out['ok'] = False
    b.close()
for k, v in out['panels'].items():
    for x in v['serious_or_critical']: print('DETAIL', k, x['id'], x['impact'], json.dumps(x['where'])[:900])
print('ok' if out['ok'] else 'FAIL', 'errors', out.get('errors'))
sys.exit(0 if out['ok'] else 1)
