# Act 1 systems, checked one at a time by setting the state directly: the card's costs and goodwill, a refusal,
# a bystander, the log, a favour, a stakeholder walking up, and a vote at the meeting. Prints JSON; exit 1 on failure.
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE, drive_to, free, STATE_JS
URL = BASE + '?test=1&fast=1&mute=1&seed=8'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def wait(pg, js, t=20000):
    pg.wait_for_function(js, timeout=t)
def answer_lines(pg, until_js, t=30):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(until_js): return True
        if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
        pg.wait_for_timeout(50)
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL); wait(pg, 'window.__wb && __wb.panel() !== null', 60000)
    drive_to(pg, lambda st: st['day'] == 1 and free(st))
    # 1) the card at the market at noon, Moss nearby with one goodwill
    pg.evaluate("(() => { const S = __wb.state(); Object.assign(S.profile, { sound: 0.1, people: 0.15, light: 0.5 }); S.min = 750; S.flags.shift1 = 1; S.gw.moss = 1; __wb.tp([26.8, 29.4]); })()")
    wait(pg, "__wb.waiter() === 'barrier'", 30000)
    opts = pg.evaluate('__wb.options()')
    texts = pg.evaluate("[...document.querySelectorAll('#barrier .opt')].map((b) => b.innerText.replace(/\\n/g, ' ')).join(' | ')")
    check('card: five answers in order', [o['key'] for o in opts] == ['bend', 'gear', 'ask', 'fix', 'leave'], [o['key'] for o in opts])
    check('card: push-through cost shown', '−4 energy' in texts, texts[:300])
    check('card: ask shows goodwill dots', '●○○' in texts and 'may ask a favour later' in texts, texts[:400])
    check('card: leaving says what you miss', 'You miss what you came for' in texts)
    pg.evaluate('__wb.choose(2)')
    answer_lines(pg, "!__wb.busy() && !__wb.waiter()")
    S = pg.evaluate("(() => { const s = __wb.state(); return { gw: s.gw.moss, owe: s.owe.moss, log: s.log.slice(-2) } })()")
    check('ask: goodwill spent', S['gw'] == 0, S['gw'])
    check('ask: Moss may ask for a hand later', S['owe'] is not None, S['owe'])
    row = [r for r in S['log'] if r['k'] == 'barrier' and r['v'] == 'ask']
    check('log: ask row with who paid', row and 'moss' in row[-1]['pay'] and 'A regular' in row[-1]['pay'], row)
    # 2) a second card with Moss at zero goodwill: probably no, and the card comes back without Ask
    pg.evaluate("(() => { const S = __wb.state(); delete S.handled['1:market']; S.handled['1:street'] = 1; S.mods = {}; S.min = 760; __wb.G.lastBarrier = -1e9; __wb.tp([30, 38]); })()")
    pg.wait_for_timeout(600)
    pg.evaluate("__wb.tp([26.8, 29.4])")
    wait(pg, "__wb.waiter() === 'barrier'", 30000)
    texts = ' | '.join(o['t'] for o in pg.evaluate('__wb.options()'))
    check('gw 0: card warns', "doesn't know you well yet" in texts, texts[:400])
    pg.evaluate('__wb.choose(2)')
    answer_lines(pg, "__wb.waiter() === 'barrier'")
    opts = pg.evaluate('__wb.options()')
    check('refused: card reopens without Ask', opts and opts[2]['disabled'], opts[2] if opts else None)
    check('log: refusal', pg.evaluate("__wb.state().log.some((r) => r.k === 'refused' && r.by === 'moss')"))
    pg.evaluate('__wb.choose(4)')
    answer_lines(pg, "!__wb.busy() && !__wb.waiter()")
    check('leave: twenty minutes of rest', pg.evaluate("__wb.state().restUntil > __wb.state().min - 1"))
    # 3) a favour comes due on festival day, two hours after the ask
    pg.evaluate("(() => { const S = __wb.state(); S.day = 3; S.min = 721; S.owe = { moss: { at: 3 * 1440 + 500 } }; S.favours = {}; S.burnout = false; __wb.tp([40, 18]); })()")
    wait(pg, "__wb.waiter() === 'choice'", 20000)
    opts = pg.evaluate('__wb.options()')
    check('favour: asks plainly, yes or not this time', any('Yes' in o['t'] for o in opts) and any('Not this time' in o['t'] for o in opts), opts)
    gw0 = pg.evaluate('__wb.state().gw.moss || 0'); m0 = pg.evaluate('__wb.state().min')
    pg.evaluate('__wb.choose(0)')
    answer_lines(pg, "!__wb.busy() && !__wb.waiter()")
    S = pg.evaluate("(() => { const s = __wb.state(); return { gw: s.gw.moss, fav: s.favours.moss, min: s.min, jar: (s.jar || []).map((j) => j.t) } })()")
    check('favour yes: goodwill back, half an hour, a moment kept', S['gw'] == gw0 + 1 and S['fav'] == 'yes' and S['min'] - m0 >= 29 and any('cart' in j for j in S['jar']), S)
    # 4) a stakeholder walks up after Clover's sketch (first, close any card the last step's walk opened)
    t0 = time.time()
    while time.time() - t0 < 20 and pg.evaluate("__wb.busy() || !!__wb.waiter()"):
        w = pg.evaluate('__wb.waiter()')
        if w == 'barrier': pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'bend'))")
        elif w == 'line': pg.evaluate('__wb.adv()')
        elif w == 'choice': pg.evaluate('__wb.choose(0)')
        pg.wait_for_timeout(100)
    pg.evaluate("(() => { const S = __wb.state(); S.day = 2; S.min = 800; S.flags.shift2 = 1; S.flags.afternoon = 1; S.handled['2:market'] = 1; S.handled['2:street'] = 1; S.fixes.quiet = 'proposal'; S.stakes = {}; S.stakeDue = { quiet: 2 * 1440 + 790 }; __wb.tp([30, 27.5]); })()")
    ok = answer_lines(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'stake_change')", 60)
    check('stakeholder: Pomeroy walks up and asks', ok, pg.evaluate("(() => { const S = __wb.state(), n = __wb.G.npcs.pomeroy; return { visit: n.visit || null, place: n.place, loc: __wb.loc(), energy: Math.round(S.energy), min: Math.round(S.min), day: S.day, busy: __wb.busy(), waiter: __wb.waiter(), panel: __wb.panel(), mode: __wb.mode(), others: Object.keys(__wb.G.npcs).filter((k) => __wb.G.npcs[k].visit), due: S.stakeDue, fix: S.fixes.quiet } })()"))
    if ok:
        pg.evaluate("__wb.choose(0)"); answer_lines(pg, "!__wb.busy() && !__wb.waiter()")
    check('stakeholder: listened', pg.evaluate("__wb.state().stakes.quiet") == 'listened')
    # 5) the meeting: two backers, Pomeroy listened to, the ledger shown to Hollis: it passes
    pg.evaluate("(() => { const S = __wb.state(); S.day = 2; S.fixes = { quiet: 'ready' }; S.support = { quiet: ['moss', 'bea'] }; S.flags.hollis_archive = 1; S.flags.council = 0; delete S.flags.councilDone; S.min = 1079; S.handled['2:hall'] = 1; __wb.tp([32, 15]); })()")
    seen = []
    t0 = time.time(); done = False
    while time.time() - t0 < 90:
        st = pg.evaluate(STATE_JS)
        if st['waiter'] == 'line': seen.append(pg.evaluate("document.querySelector('#dialog .text').innerText")); pg.evaluate('__wb.adv()')
        elif st['waiter'] in ('choice', 'barrier'):
            opts = pg.evaluate('__wb.options()'); i = next((k for k, o in enumerate(opts) if not o['disabled']), 0); pg.evaluate('__wb.choose(%d)' % i)
        elif st['panel'] and 'evening' in st['panel']: done = True; break
        pg.wait_for_timeout(40)
    txt = ' '.join(seen)
    check('meeting: leaning lines before the vote', 'Who did you ask about who it costs?' in txt and 'Does it bring people through my door?' in txt, txt[:300])
    check('meeting: passes and is approved', pg.evaluate("__wb.state().fixes.quiet") in ('approved', 'built'), pg.evaluate("__wb.state().fixes"))
    check('meeting: the day ends with it', done)
    check('no page errors', not errors, errors[:3])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
