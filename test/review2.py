# The second review's fixes, played through the real game (Acts 2 and 3, from carries):
#  A  Act 2, the soft lights put back to the spec for Unit: they go back on file (not on tonight's agenda), the Works'
#     windows go cold again, Clover says so, and the ending says they came down for Unit; Bea's crossing and the
#     kiosk's call bell come back in Who decided? as what they were (Bea's pace, Sana with no face to draw)
#  B  Act 2, no soft lights: asking Gil ten years on (an old hand, no favour owed) and who pays at the next desks
#  C  Act 2, a push-through habit you brought: kept, it is the market's answer for the day (no second card)
#  D  Act 3, stepping out of the meeting: Home Row first, then the budget without asking you, two fixes at most
#  E  Act 3, the Fund builds the crossing: the button and the crossing's text agree; the board's text is Act 3's;
#     Juno's moment in Who decided? is Juno's pinch, at the Shed, not "too loud for you"
# usage: python3 test/review2.py [A B C D E]
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE
WANT = [a for a in sys.argv[1:] if a in 'ABCDE'] or list('ABCDE')
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + json.dumps(info, default=str)[:900]), flush=True)
first = lambda o: next((k for k, x in enumerate(o) if not x['disabled']), 0)
def by_id(i):
    return lambda o: next((k for k, x in enumerate(o) if x['id'] == i and not x['disabled']), first(o))
def by_key(key):
    return lambda o: next((k for k, x in enumerate(o) if x['key'] == key and not x['disabled']), first(o))
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
# what was said, noted and toasted, and every Who decided? card (test-only wrappers, installed after the reload)
TAP = """(() => { const st = __wb.G.story, ui = __wb.G.ui; window.__said = []; window.__cards = [];
  for (const k of ['say', 'note', 'gut']) { const o = st[k].bind(st); st[k] = (a, b, ...r) => { __said.push(k === 'say' ? [a, String(b)] : [k, String(typeof a === 'object' && a ? a.t || '' : a)]); return o(a, b, ...r); }; }
  const t0 = ui.toast.bind(ui); ui.toast = (h, ...r) => { __said.push(['toast', String(h)]); return t0(h, ...r); };
  const tx = st.text.bind(st); st.text = (who, t, ...r) => { __said.push(['text:' + who, String(t)]); return tx(who, t, ...r); };
  const dc = ui.decidedCard.bind(ui); ui.decidedCard = (d) => { __cards.push({ verb: d.verb, faced: d.faced, also: d.also, pay: d.pay.map((p) => [p.name, !!p.img]) }); return dc(d); };
  return true; })()"""
said = lambda pg: pg.evaluate('window.__said || []')
def heard(pg, frag): return any(frag in x[1] for x in said(pg))

def open_page(p, seed):
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console ' + m.text[:300]) if m.type == 'error' else None)
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=%d' % seed); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    return b, pg, errors
def goto(pg, act, o):
    pg.evaluate("__wb.gotoAct(%d, %s)" % (act, json.dumps(o)))
    pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=90000)
    pg.evaluate(TAP)
def to_ending(pg):
    # the meeting, Who decided?, the festival, the release, the ending (each answered with its first open option)
    pg.evaluate("(() => { const S = __wb.state(); S.stakeDue = {}; for (const f of Object.keys(S.fixes)) if (['proposal', 'ready'].includes(S.fixes[f])) S.stakes[f] = 'listened'; S.min = Math.max(S.min, 1079); })()")
    until(pg, "!!__wb.state().flags.councilDone && !__wb.busy()", 150)
    pg.evaluate("__wb.state().min = Math.max(__wb.state().min, 1169)")
    until(pg, "!!__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 150)
    pg.evaluate("__wb.state().min = 1289")
    return until(pg, "!!(__wb.panel() && __wb.panel().includes('ending'))", 150)

with sync_playwright() as p:
    if 'A' in WANT:
        b, pg, errors = open_page(p, 41)
        goto(pg, 2, {'built': ['quiet', 'dim'], 'onfile': ['lanterns']})
        until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 60, pick=by_id('age_keep'))
        check('A: the soft lights stand at the start (warm windows)', pg.evaluate("__wb.state().fixes.dim === 'built' && __wb.G.town.worksDim === true"))
        pg.evaluate("(() => { const S = __wb.state(); S.min = 520; __wb.tp([12, 13.4]); })()")
        until(pg, "__wb.target() === 'works' && !__wb.busy() && !__wb.waiter()", 40)
        pg.evaluate('__wb.act()')
        ok = until(pg, "__wb.waiter() === 'barrier'", 40, pick=None)
        full = pg.evaluate("__wb.G.ui.waiter.buttons.map((b) => b.innerText.replace(/\\n/g, ' '))")
        fx = next((t for t in full if 'back to the spec' in t), ''); lv = next((t for t in full if 'Step outside' in t), '')
        check('A: putting the room back says your soft lights go back on file; stepping out says Corporate wants the spec', ok and 'go back on file' in fx and 'Corporate wants the spec' in lv, [fx, lv])
        pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'fix'))")
        ok = until(pg, "!__wb.busy() && !__wb.waiter() && !__wb.mg() && !!__wb.state().flags.mail2", 90)
        S = pg.evaluate("(() => { const S = __wb.state(), G = __wb.G; return { dim: S.fixes.dim, restored: S.fixRestored, windows: G.town.worksDim, lamps: G.rooms.works.actLamps ? G.rooms.works.actLamps.visible : null, mail: S.flags.mail2 } })()")
        check('A: restored: the soft lights are on file, the windows cold, the lamps gone', ok and S['dim'] == 'onfile' and S['restored'] == 'dim' and S['windows'] is False and S['lamps'] is False, S)
        pg.evaluate("__wb.G.run(() => __wb.G.exitRoom())"); until(pg, "__wb.loc() === 'town' && !__wb.busy() && !__wb.waiter()", 30)
        # the kiosk: ring the call bell (Sana answers; she has no face to draw)
        pg.evaluate("(() => { const S = __wb.state(); S.min = Math.max(S.min, 700); S.look.voice = 'chime'; __wb.tp([32, 14.6]); })()")
        until(pg, "__wb.target() === 'hall' && !__wb.busy() && !__wb.waiter()", 40)
        pg.evaluate('__wb.act()')
        ok = until(pg, "__wb.waiter() === 'barrier' && __wb.options().some((o) => o.t.includes('counter'))", 40)
        if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'ask'))")
        until(pg, "!__wb.busy() && !__wb.waiter()", 40)
        check('A: the call bell: Sana registered it', ok and heard(pg, 'Twelve towns, one headset'))
        pg.evaluate("__wb.G.run(() => __wb.G.exitRoom())"); until(pg, "__wb.loc() === 'town' && !__wb.busy() && !__wb.waiter()", 30)
        # Clover, first talk after the restore: the soft lights stay on file; the lanterns go on tonight's agenda
        pg.evaluate("(() => { __wb.state().min = Math.max(__wb.state().min, 760); })()")
        pg.evaluate("__wb.G.run(() => __wb.G.story.talkTo('clover'))")
        until(pg, "!__wb.busy() && !__wb.waiter()", 30)
        S = pg.evaluate("(() => { const S = __wb.state(); return { dim: S.fixes.dim, lanterns: S.fixes.lanterns } })()")
        check('A: Clover: the soft lights stay on file, said plainly; the lanterns go on tonight\'s agenda', S['dim'] == 'onfile' and S['lanterns'] == 'ready' and heard(pg, 'won twice') and heard(pg, 'Same backers as ten years ago'), [S, [x for x in said(pg) if x[0] == 'clover']])
        check('A: Gil, after the mail', (pg.evaluate("__wb.G.story.ret.script('gil')[0].t") or '').startswith('Festival mail, done'))
        # Bea's crossing: let her be
        pg.evaluate("(() => { const S = __wb.state(); S.stakeDue = {}; S.stakes.lanterns = 'listened'; S.min = 800; __wb.tp([45.6, 20.8]); })()")
        ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'cross_none')", 40, pick=None)
        if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'cross_none'))")
        until(pg, "!__wb.busy() && !__wb.waiter()", 30)
        row = pg.evaluate("__wb.state().log.find((r) => r.v === 'none' && r.z === 'transit') || null")
        check('A: Bea\'s crossing is logged as her pace, not your clock', row and row.get('dim') == 'pace' and 'forty seconds' in (row.get('why') or ''), row)
        ok = to_ending(pg)
        cards = pg.evaluate('window.__cards')
        print('   Who decided? verbs:', [c['verb'] for c in cards], flush=True)
        sana = [c for c in cards if 'Sana' in c['verb']]
        bea = [c for c in cards if c['verb'].startswith('You let Bea be')]
        check('A: Who decided?: no moment says Bea\'s crossing was "too late in your day"', not any(any('late in your day' in f for f in c['faced']) for c in cards), cards)
        check('A: Who decided?: Bea\'s crossing, if shown, says what happened', all('finished crossing alone' in c['verb'] and 'The light gave Bea forty seconds.' in c['faced'] for c in bea), bea)
        check('A: Who decided?: Sana, if shown, is a name without a drawn face', all(all(not img for (n, img) in c['pay'] if n == 'Sana') for c in sana), sana)
        rem = pg.evaluate("[...document.querySelectorAll('.fates li')].map((x) => x.innerText)")
        check('A: the ending: the soft lights came down for Unit; the quiet corner is still up, with no first-visit loss line', ok and any('came down for Unit' in r for r in rem) and 'The quiet corner is still up.' in rem and not any('Pomeroy' in r for r in rem), rem)
        check('A: no page errors', not errors, errors[:4])
        b.close()

    if 'B' in WANT:
        b, pg, errors = open_page(p, 43)
        goto(pg, 2, {'built': ['quiet'], 'carry': {'profile': {'sound': 0.12, 'light': 0.08, 'people': 0.5, 'talk': 0.3, 'time': 0.5, 'change': 0.5}}})
        until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 60, pick=by_id('age_keep'))
        pg.evaluate("(() => { const S = __wb.state(); S.min = 520; S.gw.gil = 2; __wb.tp([12, 13.4]); })()")
        until(pg, "__wb.target() === 'works' && !__wb.busy() && !__wb.waiter()", 40)
        pg.evaluate('__wb.act()')
        ok = until(pg, "__wb.waiter() === 'barrier'", 60, pick=None)
        opts = pg.evaluate('__wb.options()'); ask = next((o for o in opts if o['key'] == 'ask'), {})
        askt = pg.evaluate("(() => { const b = __wb.G.ui.waiter.buttons.find((x) => x.classList.contains('ask')); return b ? b.innerText.replace(/\\n/g, ' ') : ''; })()")
        check('B: the Works\' own card, with Gil to ask (no favour owed ten years on)', ok and not ask.get('disabled') and 'Gil' in askt and 'favour' not in askt, [askt, opts])
        if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'ask'))")
        until(pg, "!__wb.busy() && !__wb.waiter() && !__wb.mg() && !!__wb.state().flags.mail2", 90)
        row = pg.evaluate("__wb.state().log.find((r) => r.k === 'barrier' && r.v === 'ask' && r.z === 'works') || null")
        check('B: Gil: "Anything for an old hand"; and someone at the next desk pays (Unit, Tomas or Ada, never Fen or Ola)', heard(pg, 'old hand') and row and len(row['pay']) == 2 and row['pay'][1] in ('unit', 'tomas', 'ada'), [row, [x for x in said(pg) if x[0] in ('gil', 'unit', 'tomas', 'ada')]])
        check('B: no page errors', not errors, errors[:4])
        b.close()

    if 'C' in WANT:
        b, pg, errors = open_page(p, 45)
        goto(pg, 2, {'built': ['ramp'], 'carry': {'pushHabit': 'market', 'profile': {'sound': 0.1, 'light': 0.3, 'people': 0.1, 'talk': 0.3, 'time': 0.5, 'change': 0.5}}})
        until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 60, pick=by_id('age_keep'))
        pg.evaluate("(() => { const S = __wb.state(); S.min = 715; S.flags.works2 = 1; S.flags.mail2 = 'done'; __wb.tp([28.4, 28.2]); })()")
        ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'habit_ok')", 40, pick=None)
        sub = pg.evaluate("(() => { const b = __wb.G.ui.waiter && __wb.G.ui.waiter.buttons.find((x) => x.dataset.id === 'habit_ok'); return b ? b.innerText.replace(/\\n/g, ' ') : ''; })()")
        check('C: the habit you brought, with its cost said', ok and '−4 energy' in sub, sub)
        if ok: pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'habit_ok'))")
        t0 = time.time(); card = False
        while time.time() - t0 < 4:
            if pg.evaluate("__wb.waiter() === 'barrier'"): card = True; break
            if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
            pg.wait_for_timeout(80)
        S = pg.evaluate("(() => { const S = __wb.state(); return { handled: S.handled['1:market'] || 0, zone: __wb.zone(), habit: S.log.filter((r) => r.k === 'habit').length, cards: S.log.filter((r) => r.k === 'barrier' && r.z === 'market').length } })()")
        check('C: kept, it is the market\'s answer: no second card, one push paid', ok and not card and S['handled'] == 1 and S['habit'] == 1 and S['cards'] == 0, S)
        check('C: no page errors', not errors, errors[:4])
        b.close()

    if 'D' in WANT:
        b, pg, errors = open_page(p, 47)
        goto(pg, 3, {'built': ['quiet', 'board']})
        until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel() && !!__wb.state().flags.juno3", 90, pick=lambda o: next((k for k, x in enumerate(o) if x['id'] in ('coop_no', 'age_keep')), next((k for k, x in enumerate(o) if x['key'] == 'leave'), first(o))))
        pg.evaluate("""(() => { const S = __wb.state(); S.flags.square3 = 1; S.flags.conflict3 = 1; S.quietrowView = 'for';
            S.fixes.rentcap = 'ready'; S.support.rentcap = ['moss', 'pip']; S.fixes.farstalls = 'ready'; S.support.farstalls = ['moss', 'bea'];
            S.stakes.rentcap = 'listened'; S.stakes.farstalls = 'listened'; S.stakeDue = {}; S.flags.council = 1; S.flags.remind = 1; S.min = 1085; __wb.tp([32, 15.6]); })()""")
        pg.wait_for_timeout(1200)
        pg.evaluate("__wb.G.run(() => __wb.G.story.leftMeeting())")
        asked = False; t0 = time.time()
        while time.time() - t0 < 30:
            if pg.evaluate("__wb.waiter() === 'choice' && __wb.options().some((o) => (o.id || '').startsWith('pick_'))"): asked = True; pg.evaluate('__wb.choose(0)')
            if pg.evaluate("!!__wb.state().flags.councilDone && !__wb.busy()"): break
            if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
            pg.wait_for_timeout(80)
        # Rue's text comes twenty minutes later (lines answered, nothing else waiting)
        until(pg, "__wb.state().cloverAt == null && !__wb.busy()", 30)
        print('   after:', pg.evaluate("(() => { const S = __wb.state(); return { min: Math.round(S.min), at: S.cloverAt, w: __wb.waiter(), mode: __wb.mode(), busy: __wb.busy(), loc: __wb.loc() } })()"), flush=True)
        S = pg.evaluate("(() => { const S = __wb.state(); const n = Object.keys(S.fixes).filter((f) => ['built', 'approved'].includes(S.fixes[f]) && (S.fixAct || {})[f] === 3 && (S.fixVia || {})[f] !== 'fund').length; return { n, qr: S.fixes.quietrow, rc: S.fixes.rentcap, fs: S.fixes.farstalls, news: S.cloverNews } })()")
        check('D: away from the meeting: Home Row first, then the budget without asking you; two fixes at most', not asked and S['n'] <= 2 and S['qr'] == 'built' and sorted([S['rc'], S['fs']]) == ['built', 'onfile'], S)
        check('D: Rue texts what passed and what waits', heard(pg, 'for next year') and any(x[0] == 'text:Rue' for x in said(pg)), [x for x in said(pg) if x[0].startswith('text')])
        check('D: no page errors', not errors, errors[:4])
        b.close()

    if 'E' in WANT:
        b, pg, errors = open_page(p, 49)
        goto(pg, 3, {'built': ['quiet', 'board']})
        until(pg, "__wb.waiter() === 'barrier'", 90, pick=lambda o: next((k for k, x in enumerate(o) if x['id'] in ('coop_yes', 'age_keep')), first(o)))
        jf = pg.evaluate('__wb.state().junoFix')
        full = pg.evaluate("__wb.G.ui.waiter.buttons.map((b) => b.innerText.replace(/\\n/g, ' '))"); fx = next((t for t in full if 'Redesign' in t), '')
        check('E: Juno\'s redesign names who it costs, and only people you can know', jf != 'quiet' or 'Bao and Lin' in fx, [jf, fx])
        pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.key === 'fix'))")
        until(pg, "__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel() && !!__wb.state().flags.juno3", 60)
        row = pg.evaluate("__wb.state().log.find((r) => r.turn) || null")
        check('E: Juno\'s moment is logged at the Shed, as Juno\'s pinch', row and row['z'] == 'commons' and not row.get('dim') and 'Juno' in (row.get('why') or ''), row)
        pg.evaluate("(() => { const S = __wb.state(); S.min = 700; __wb.tp([27.4, 27.6]); })()")
        ok = until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'fund_yes')", 60)
        yes = pg.evaluate("(() => { const b = __wb.G.ui.waiter.buttons.find((x) => x.dataset.id === 'fund_yes'); return b ? b.innerText.replace(/\\n/g, ' ') : ''; })()")
        check('E: the Fund\'s crossing says the van runs late', ok and 'van runs late' in yes, yes)
        pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'fund_yes'))")
        until(pg, "__wb.waiter() === 'choice' && __wb.options().some((o) => o.id === 'moss_none')", 40)
        pg.evaluate("__wb.choose(__wb.options().findIndex((o) => o.id === 'moss_none'))")
        until(pg, "!__wb.busy() && !__wb.waiter()", 30)
        st = pg.evaluate("(() => { const T = __wb.G.town; return { cs: __wb.state().fixes.crossing, sign: T.crossButton ? T.crossButton.visible : null } })()")
        # (nothing else may start meanwhile: Hollis's Home Row question is answered, nobody is due to visit)
        pg.evaluate("(() => { const S = __wb.state(); S.flags.conflict3 = 1; S.stakeDue = {}; })()"); until(pg, "!__wb.busy() && !__wb.waiter()", 20)
        for prop in ('crossing', 'board'):
            t0 = time.time()
            while time.time() - t0 < 10 and not pg.evaluate("(() => { if (__wb.G.busy) return false; __wb.G.run(() => __wb.G.story.ret.handle({ id: '%s' })); return true; })()" % prop): pg.wait_for_timeout(100)
            until(pg, "!__wb.busy() && !__wb.waiter()", 20)
        notes = [x[1] for x in said(pg) if x[0] == 'note']
        check('E: the crossing\'s text says what its button says (the Fund\'s: waits for everyone)', st['cs'] == 'built' and any('WAITS FOR EVERYONE' in n for n in notes) and not any('HOLD FOR MORE TIME' in n for n in notes), [st, notes[-3:]])
        check('E: the board, twenty years on', any('APP, OR THE KIOSK' in n for n in notes), notes[-2:])
        ok = to_ending(pg)
        cards = pg.evaluate('window.__cards')
        print('   Who decided? verbs:', [c['verb'] for c in cards], flush=True)
        juno = [c for c in cards if c['verb'].startswith('Juno asked you')]
        check('E: Who decided?: Juno\'s moment is at the Shed and is Juno\'s pinch, never "for you"', juno and all(c['faced'][0].startswith('The Commons') and not any(' for you.' in f or 'Moss sells' in f for f in c['faced']) and any('Juno' in f for f in c['faced']) for c in juno), juno or cards)
        check('E: no page errors', not errors, errors[:4])
        b.close()

print(json.dumps({'ok': out['ok'], 'failed': [c for c in out['checks'] if not c[1]]}, default=str)[:3000])
sys.exit(0 if out['ok'] else 1)
