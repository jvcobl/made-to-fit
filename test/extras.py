# Act 1 extras, checked by setting the state directly: Blend's own lines (points, colour, log, dependence), Blend's
# one real help at the bus stop, the feed summarized, Moss's shelf (a pack, several packs, the binder, packs summarized),
# Gil's packs with their labels, a habit, residents adjusting before you ask (logged), and the comfort move welcome.
# Prints JSON; exit 1 on failure.
from pathlib import Path
REPO = str(Path(__file__).resolve().parents[1])  # the repo root, wherever it is cloned
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, REPO + '/test')
from drive import ARGS, BASE, drive_to, free, STATE_JS
URL = BASE + '?test=1&v1=1&fast=1&mute=1&seed=21'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
def lines(pg, until_js, t=20, pick=None):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(until_js): return True
        w = pg.evaluate('__wb.waiter()')
        if w == 'line': pg.evaluate('__wb.adv()')
        elif w == 'choice' and pick:
            i = pick(pg.evaluate('__wb.options()'))
            if i is not None: pg.evaluate('__wb.choose(%d)' % i)
        pg.wait_for_timeout(50)
    return False
def idle(pg, t=20):
    return lines(pg, "!__wb.busy() && !__wb.waiter() && !__wb.panel()", t, pick=lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0))

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    drive_to(pg, lambda st: st['day'] == 1 and free(st))
    # ---- 1) Blend's own line: only with Blend installed, and it costs what it says ----
    pg.evaluate("(() => { const S = __wb.state(); S.flags.shift1 = 1; S.handled['1:market'] = 1; S.handled['1:street'] = 1; S.min = 640; __wb.tp('bakery'); })()")
    pg.wait_for_timeout(300)
    pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('pip'))")
    lines(pg, "__wb.waiter() === 'choice'")
    ids = [o['id'] for o in pg.evaluate('__wb.options()')]
    check('no Blend line without Blend', 'blend_pip' not in ids, ids)
    pg.evaluate('__wb.choose(1)'); idle(pg)
    pg.evaluate("(() => { const S = __wb.state(); __wb.G.installBlend(); S.talked = {}; S.met.pip = 0; delete S.met.pip; })()")
    pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('pip'))")
    lines(pg, "__wb.waiter() === 'choice'")
    opts = pg.evaluate('__wb.options()')
    bi = next((k for k, o in enumerate(opts) if o['id'] == 'blend_pip'), None)
    check('Blend line offered, with its chip', bi is not None and 'Blend suggests' in opts[bi]['t'], opts)
    s0 = pg.evaluate("(() => { const S = __wb.state(); return { sc: S.blend.score, self: S.self, dep: S.blend.dep || 0 } })()")
    if bi is not None: pg.evaluate('__wb.choose(%d)' % bi)
    idle(pg)
    s1 = pg.evaluate("(() => { const S = __wb.state(); const r = S.log.filter((x) => x.k === 'default' && x.by === 'blend'); return { sc: S.blend.score, self: S.self, dep: S.blend.dep || 0, rows: r.length, line: r.length ? r[r.length - 1].line : null, note: !!(S.notes || {}).nudges, said: S.blend.said } })()")
    check('Blend line: +5 points, a little colour, logged with its words', s1['sc'] - s0['sc'] == 5 and abs((s0['self'] - s1['self']) - 1.5) < 0.01 and s1['rows'] == 1 and s1['line'] == 'He LOVED them!!' and s1['note'], [s0, s1])
    check('one Blend line: no dependence yet', s1['dep'] == s0['dep'], s1)
    # a second one: dependence goes up by one
    pg.evaluate("(() => { const S = __wb.state(); S.talked = {}; delete S.met.hollis; __wb.tp('hallSteps'); })()"); pg.wait_for_timeout(200)
    pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('hollis'))")
    lines(pg, "__wb.waiter() === 'choice'")
    opts = pg.evaluate('__wb.options()'); bi = next((k for k, o in enumerate(opts) if o['id'] == 'blend_hollis'), None)
    if bi is not None: pg.evaluate('__wb.choose(%d)' % bi)
    idle(pg)
    check('two Blend lines: dependence +1', pg.evaluate("__wb.state().blend.dep || 0") == s0['dep'] + 1, pg.evaluate("__wb.state().blend"))
    # ---- 2) Blend hears the bus speaker for you ----
    pg.evaluate("(() => { const S = __wb.state(); S.min = 1046; S.flags.busEvent = 0; __wb.tp([53.5, 24.2]); })()")
    ok = lines(pg, "!!__wb.state().flags.blend_heard", 30)
    check('Blend writes down what the speaker said', ok and any('Heard the speaker for you' in t[1] for t in pg.evaluate("__wb.G.texts")))
    idle(pg, 30)
    # ---- 3) the feed, summarized ----
    pg.evaluate("(() => { __wb.G.settings.feedContent = 'summary'; __wb.G.ui.phoneTab = 'blend'; __wb.G.togglePhone(true); })()"); pg.wait_for_timeout(400)
    has_btn = pg.evaluate("!!document.querySelector('#fscroll')")
    sc0 = pg.evaluate("__wb.state().blend.score"); m0 = pg.evaluate("__wb.state().min")
    if has_btn: pg.evaluate("document.querySelector('#fscroll').click()"); pg.wait_for_timeout(300)
    txt = pg.evaluate("(document.querySelector('.fsum') || {}).innerText || ''")
    check('feed summarized: one choice, the whole session in a sentence', has_btn and 'You scrolled through 12 cards: 24 points' in txt and pg.evaluate("__wb.state().blend.score") - sc0 == 24 and pg.evaluate("__wb.state().min") - m0 >= 23, txt)
    look = pg.evaluate("!!document.querySelector('#blook')")
    pg.evaluate("document.querySelector('.putdown').click()"); pg.wait_for_timeout(300)
    check('feed: Look again only once the lantern is yours', not look)
    # ---- 4) Moss's shelf ----
    pg.evaluate("(() => { const S = __wb.state(); S.coins = 40; S.cards = {}; __wb.G.settings.packs = 'show'; })()")
    pg.evaluate("__wb.G.run(() => __wb.G.ui.shop(__wb.state()))"); pg.wait_for_timeout(400)
    shop = pg.evaluate("document.querySelector('#panel').innerText")
    check('shelf: pack and binder, with prices', 'Sealed pack' in shop and '5 coins' in shop and 'Singles binder' in shop and '3 coins a card' in shop, shop[:400])
    pg.evaluate("document.querySelector('[data-pack]').click()"); pg.wait_for_timeout(250)
    res = pg.evaluate("document.querySelector('.packres').innerText")
    tiles = pg.evaluate("document.querySelectorAll('.packres .pcardtile').length")
    check('a pack: three cards at once, and what you already had', tiles == 3 and res.strip().endswith('you already had.'), res)
    check('a pack: five coins, three cards kept', pg.evaluate("__wb.state().coins") == 35 and sum(pg.evaluate("Object.values(__wb.state().cards)")) == 3)
    pg.evaluate("document.querySelector('[data-more=\"1\"]').click()"); pg.wait_for_timeout(150)
    pg.evaluate("document.querySelector('[data-packs]').click()"); pg.wait_for_timeout(250)
    res = pg.evaluate("document.querySelector('.packres').innerText")
    check('several packs: a summary, never a loop of taps', res.startswith('You opened three more. Nine cards') and pg.evaluate("__wb.state().coins") == 20, res)
    pg.evaluate("document.querySelector('[data-binder]').click()"); pg.wait_for_timeout(250)
    gold = pg.evaluate("!!document.querySelector('[data-single=gold]') || !!(__wb.state().cards || {}).gold")
    check('binder: every card, the golden one too', gold and pg.evaluate("document.querySelectorAll('.bslot').length") == 8)
    if pg.evaluate("!!document.querySelector('[data-single=gold]')"):
        pg.evaluate("document.querySelector('[data-single=gold]').click()"); pg.wait_for_timeout(200)
    check('binder: the card you picked, for three coins', pg.evaluate("!!__wb.state().cards.gold"))
    pg.screenshot(path=REPO + '/test/shots_f/binder.png')
    pg.evaluate("document.querySelector('#bback').click()"); pg.wait_for_timeout(150)
    pg.evaluate("document.querySelector('#done').click()"); idle(pg)
    check('packs note', pg.evaluate("!!(__wb.state().notes || {}).packs"))
    pg.evaluate("(() => { __wb.G.settings.packs = 'summary'; __wb.state().coins = 10; })()")
    pg.evaluate("__wb.G.run(() => __wb.G.ui.shop(__wb.state()))"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-pack]').click()"); pg.wait_for_timeout(250)
    res = pg.evaluate("document.querySelector('.packres').innerText")
    check('packs summarized: one line, no tiles', res.startswith('You open a pack: ') and pg.evaluate("document.querySelectorAll('.packres .pcardtile').length") == 0, res)
    pg.evaluate("document.querySelector('#done').click()"); idle(pg)
    pg.evaluate("__wb.G.settings.packs = 'show'")
    # ---- 5) Gil's packs, after work, at the cart ----
    pg.evaluate("(() => { const S = __wb.state(); S.min = 1062; S.handled['1:market'] = 1; })()")
    pg.wait_for_timeout(1500)
    pg.evaluate("(() => { const q = __wb.G.npcs.gil.c.root.position; __wb.tp([q.x + 2.5, q.z + 1.5]); })()")
    ok = lines(pg, "!!__wb.state().flags.gilPack1", 15)
    toast = pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map((t) => t.innerText).join(' | ')")
    check('Gil: a near-miss, with its label', ok and 'A near-miss. A loss made to look almost like a win.' in toast and 'Lantern:' in toast, toast[:300])
    pg.evaluate("__wb.state().min += 45"); ok = lines(pg, "!!__wb.state().flags.gilPack2", 15)
    toast = pg.evaluate("[...document.querySelectorAll('#toasts .toast')].map((t) => t.innerText).join(' | ')")
    check('Gil: a loss dressed as a win, labelled', ok and 'A loss dressed as a win' in toast, toast[:300])
    check('notes: near-miss and loss dressed as a win', pg.evaluate("['nearmiss','ldw'].every((k) => (__wb.state().notes || {})[k])"))
    # ---- 6) a habit: pushed through at the market on two days; on the third it happens first ----
    pg.evaluate("(() => { const S = __wb.state(); S.day = 3; S.min = 750; S.blend.smooth = false; Object.assign(S.profile, { sound: 0.1, people: 0.15, light: 0.5 }); S.gear.headphones = false; S.gear.shades = false; S.mods = {}; delete S.handled['3:market']; S.handled['3:street'] = 1; __wb.G.lastBarrier = -1e9; const p = __wb.G.story; })()")
    pg.evaluate("__wb.tp([30, 38])"); pg.wait_for_timeout(400)
    # plant the habit at exactly the key the market card will use
    pg.evaluate("(() => { const S = __wb.state(); const st = __wb.G.story; const orig = st.habitCard.bind(st); st.habitCard = async (z, t, d) => { const k = st.habitKey(z, t, d); S.habits = { [k]: { verb: 'bend', days: [1, 2], formed: 2 } }; window.__hk = k; st.habitCard = orig; return orig(z, t, d); }; })()")
    bend0 = pg.evaluate("__wb.state().stats.bend")
    pg.evaluate("__wb.tp([26.8, 29.4])")
    ok = lines(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'habit_ok')", 30)
    txt = pg.evaluate("(document.querySelector('#dialog .text') || {}).innerText || ''")
    check('habit: a small card instead of the five', ok and 'before you noticed' in txt, [txt, pg.evaluate('window.__hk')])
    if ok:
        pg.evaluate("__wb.choose(0)"); idle(pg)
    S = pg.evaluate("(() => { const S = __wb.state(); const r = S.log.filter((x) => x.k === 'habit'); return { rows: r.length, by: r.length ? r[0].by : null, masking: S.masking, bend: S.stats.bend, note: !!(S.notes || {}).habits } })()")
    check('habit: OK pushes through, logged as the habit deciding', S['rows'] == 1 and S['by'] == 'habit' and S['masking'] and S['bend'] == bend0 + 1 and S['note'], S)
    # ---- 7) someone adjusts before you ask, and it goes in the log ----
    pg.evaluate("(() => { const S = __wb.state(); S.day = 2; S.min = 700; S.flags.shift2 = 1; S.flags.afternoon = 1; S.masking = false; S.bonds.moss = 2; S.unaskedDone = {}; S.mods = {}; delete S.handled['2:market']; S.handled['2:street'] = 1; __wb.G.lastBarrier = -1e9; __wb.tp([30, 38]); })()"); pg.wait_for_timeout(400)
    pg.evaluate("(() => { const q = __wb.G.npcs.moss.c.root.position; __wb.tp([q.x + 1.6, q.z - 1.2]); })()")
    ok = lines(pg, "__wb.state().log.some((r) => r.k === 'barrier' && r.by === 'moss' && r.f && r.f.unasked)", 20)
    check('unasked: Moss adjusts first, logged with Moss deciding and paying', ok, pg.evaluate("__wb.state().log.slice(-3)"))
    idle(pg)
    # ---- 8) the comfort move, welcomed once by Moss ----
    pg.evaluate("(() => { const S = __wb.state(); S.flags.welcome_moss = 0; S.met.moss = 1; __wb.G.player.comfortStarted = 'rock'; })()")
    ok = lines(pg, "!!__wb.state().flags.welcome_moss", 8)
    check('comfort move: Moss says so, once, kindly', ok)
    check('no page errors', not errors, errors[:4])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
