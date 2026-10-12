# The first day (slice.js), played start to finish with real input where it matters: keys to raise the lantern and
# tag marks, the porch choice, the market sketch, the hearing, lantern night, the hook sort and the day card.
# Usage: python3 test/slice.py [desktop|phone] [OUTDIR] [seed] [policy]
#   policy: 'good' (listens, solves the sketch, asks consent, declines Blend) or 'blend' (tries Blend, rushes)
# Prints the time each part of the day took, and fails on any page error or a stage that never comes.
import json, sys, time, os
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
from drive import ARGS, BASE, drive_to, free

mode = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/slice_out'
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 31
POLICY = sys.argv[4] if len(sys.argv) > 4 else 'good'
os.makedirs(OUT, exist_ok=True)
ST = """(() => { const G = __wb.G, S = G.S, sl = G.story.slice; const o = G.story.objective();
  return { stage: S.slice ? S.slice.stage : null, day: S.day, min: Math.round(S.min), mode: G.mode, busy: G.busy, waiter: __wb.waiter(), panel: __wb.panel(), mg: __wb.mg(),
    loc: G.loc, zone: G.zone, raised: !!G.look.raised, near: G.marks.near ? G.marks.near.id : null, target: G.target ? G.target.id : null, hearing: !!document.querySelector('#hearing'),
    ov: !!document.querySelector('#overlay:not([hidden])'), obj: o ? o.t : '', at: o ? o.at : null, inside: o ? o.inside || null : null, spot: o ? o.spot || null : null,
    pos: [G.player.root.position.x, G.player.root.position.z], guests: Object.keys(S.guests || {}), color: S.color, path: G.path.length, phone: G.phoneOpen } })()"""

def shot(pg, name):
    pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(120)
    pg.screenshot(path=os.path.join(OUT, name + '.png'))

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mode == 'phone' else {'width': 1280, 'height': 760}, is_mobile=mode == 'phone', has_touch=mode == 'phone', device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console: ' + m.text[:400]) if m.type == 'error' else None)
    pg.goto(BASE + '?test=1&mute=1&seed=%d' % SEED); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=90000)
    pg.evaluate("__wb.G.settings.textSpeed = 'fast'")
    t0 = time.time(); marks = {}
    shots_done = set()
    def mark_time(name):
        if name not in marks: marks[name] = round(time.time() - t0, 1)
    drive_to(pg, lambda st: st['mode'] == 'creator', budget=200)
    mark_time('creator'); shot(pg, '01_creator')
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    mark_time('morning'); shot(pg, '02_room')
    last_stage = None; stuck = 0; last_pos = None; t_stage = time.time()
    while time.time() - t0 < 1500:
        st = pg.evaluate(ST)
        if st['stage'] != last_stage:
            mark_time(st['stage'] or 'none'); last_stage = st['stage']; t_stage = time.time()
            if st['stage'] not in shots_done: shots_done.add(st['stage']); shot(pg, '10_' + str(st['stage']))
        if st['day'] >= 2: mark_time('tuesday'); shot(pg, '90_tuesday'); break
        if time.time() - t_stage > 240: raise Exception('stuck in stage %s: %s' % (st['stage'], json.dumps(st)))
        if st['ov']:
            pg.evaluate("(() => { const b = document.querySelector('#overlay #cGo') || document.querySelector('#overlay #nOk') || document.querySelector('#overlay .btn.primary') || document.querySelector('#overlay [data-back]'); if (b) b.click(); })()"); pg.wait_for_timeout(200); continue
        if st['hearing']:
            if 'hearingui' not in shots_done: shots_done.add('hearingui'); pg.wait_for_timeout(900); shot(pg, '50_hearing')
            pg.evaluate("(() => { const h = __wb.G.story.slice.hearingNow; if (h && !h.busy) h.auto(); })()"); pg.wait_for_timeout(500); continue
        if st['mg']:
            if 'mg' not in shots_done: shots_done.add('mg'); pg.wait_for_timeout(800); shot(pg, '40_sketch')
            pg.evaluate('__wb.mgAuto(%s)' % ('0.9' if POLICY == 'good' else '0.2')); pg.wait_for_timeout(400); continue
        panel = st['panel'] or ''
        if 'hooksort' in panel:
            if 'hooksort' not in shots_done: shots_done.add('hooksort'); shot(pg, '70_hooksort')
            pg.evaluate("(() => { const p = document.querySelector('#panel'); p.querySelectorAll('.hsrow').forEach((r, i) => { const b = r.querySelectorAll('[data-v]')[i % 2]; b.click(); }); const go = p.querySelector('#hsGo'); if (go && !go.disabled) go.click(); else { const ok = p.querySelector('#hsOk'); if (ok) { ok.click(); } } })()")
            pg.wait_for_timeout(500)
            if 'hookreveal' not in shots_done and pg.evaluate("!!document.querySelector('#panel #hsOk')"): shots_done.add('hookreveal'); shot(pg, '71_hookreveal'); pg.evaluate("document.querySelector('#panel #hsOk').click()")
            continue
        if 'daycard' in panel:
            shot(pg, '80_daycard'); pg.evaluate("document.querySelector('#panel #dGo').click()"); pg.wait_for_timeout(400); continue
        if 'taps' in panel: pg.evaluate("document.querySelector('#panel .pick').click()"); pg.wait_for_timeout(300); continue
        if panel and 'center' in panel:
            pg.evaluate("(() => { const g = document.querySelector('#panel #tgo') || document.querySelector('#panel #go') || document.querySelector('#panel #done') || document.querySelector('#panel .btn.primary'); if (g) g.click(); })()"); pg.wait_for_timeout(200); continue
        if st['waiter'] == 'line': pg.evaluate('__wb.adv()'); pg.wait_for_timeout(60); continue
        if st['waiter'] in ('choice', 'barrier'):
            opts = pg.evaluate('__wb.options()')
            if st['waiter'] == 'barrier' and 'whoadjusts' not in shots_done: shots_done.add('whoadjusts'); pg.wait_for_timeout(500); shot(pg, '30_whoadjusts')
            pick = None
            for i, o in enumerate(opts):
                if o['disabled']: continue
                if st['waiter'] == 'barrier' and o['key'] == 'fix' and POLICY == 'good': pick = i
                if o['id'] == 'blend_yes' and POLICY == 'blend': pick = i
                if o['id'] == 'blend_no' and POLICY == 'good': pick = i
                if o['id'] == 'gil_ask' and POLICY == 'good': pick = i
                if o['id'] == 'gil_later' and POLICY == 'blend': pick = i
            if pick is None: pick = next((k for k, o in enumerate(opts) if not o['disabled']), 0)
            pg.evaluate('__wb.choose(%d)' % pick); pg.wait_for_timeout(150); continue
        if not free(st): pg.wait_for_timeout(120); continue
        # in a room: walk to the spot the objective names and use it, or head out
        if st['loc'] != 'town':
            if st['inside'] == st['loc'] and st['spot']:
                pg.evaluate("__wb.way()"); pg.wait_for_timeout(900)
                pg.keyboard.press('e'); pg.wait_for_timeout(500); continue
            pg.evaluate("(() => { const r = __wb.G.rooms[__wb.G.loc]; const o = r.inter.find((i) => i.id === 'out'); __wb.G.walkTo(o.x, o.z); })()"); pg.wait_for_timeout(1200)
            pg.keyboard.press('e'); pg.wait_for_timeout(1500); continue
        # marks to tag: raise the lantern, walk up to the nearest, press E
        if st['stage'] in ('homerow', 'market', 'worksmarks'):
            if not st['raised']: pg.keyboard.press('l'); pg.wait_for_timeout(400); continue
            if st['near']:
                if st['stage'] + '_raised' not in shots_done: shots_done.add(st['stage'] + '_raised'); shot(pg, '20_%s_raised' % st['stage'])
                pg.keyboard.press('e'); pg.wait_for_timeout(700); continue
            if st['at'] and st['path'] == 0: pg.evaluate("(a) => __wb.G.walkTo(a[0], a[1])", st['at']); pg.wait_for_timeout(500); continue
            pg.wait_for_timeout(200); continue
        if st['raised']: pg.keyboard.press('l'); pg.wait_for_timeout(200); continue
        # otherwise: follow the objective, and use whatever is at the end of it
        if st['at']:
            d = ((st['pos'][0] - st['at'][0]) ** 2 + (st['pos'][1] - st['at'][1]) ** 2) ** 0.5
            if d > 2.2 and st['path'] == 0: pg.evaluate('__wb.way()'); pg.wait_for_timeout(400); continue
            if d <= 2.2 and st['target']: pg.keyboard.press('e'); pg.wait_for_timeout(600); continue
            if d <= 2.2: pg.evaluate("(a) => __wb.G.walkTo(a[0], a[1] - 0.6)", st['at']); pg.wait_for_timeout(500); continue
        pg.wait_for_timeout(200)
    res = {'times': marks, 'errors': errors, 'final': pg.evaluate(ST), 'hooks': pg.evaluate('__wb.state().hooks'), 'cards': pg.evaluate('Object.keys(__wb.state().cards || {})'), 'fixes': pg.evaluate('__wb.state().fixes'), 'hearing': pg.evaluate('(__wb.state().slice || {}).hearing || null')}
    print(json.dumps(res, indent=1))
    b.close()
    if errors: sys.exit(1)
