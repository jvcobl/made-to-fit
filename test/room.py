# Room events in tasks: moments happen in the room (glare, phones, stillness), a press made during one is held and
# used afterwards (never dropped), the chip sits beside the letter (never over it), captions make the room the
# subject, the comfort move ends a still moment early (not while hiding it), "Fewer" halves the rate, and the
# results say what the room took. Prints a JSON summary; exit 1 on failure.
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, '/home/claude/wb4/test')
from drive import ARGS, BASE, drive_to, free
URL = BASE + '?test=1&mute=1&seed=21'
out = {'ok': True, 'checks': []}
def check(name, cond, info=''):
    out['checks'].append([name, bool(cond), info])
    if not cond: out['ok'] = False

def start_sort(pg, profile, masked=False, fewer=False):
    pg.evaluate("(([pr, mk, fw]) => { const S = __wb.state(); Object.assign(S.profile, pr); S.min = 560; S.masking = mk; S.maskZone = 'works'; __wb.G.settings.interrupts = fw ? 'fewer' : 'usual'; __wb.G.settings.pace = 'steady'; })(%s)" % json.dumps([profile, masked, fewer]))
    pg.evaluate("__wb.mgTest('sort')")
    pg.wait_for_function("__wb.G.mg && __wb.G.mg.over && __wb.G.mg.over.querySelector('.go')", timeout=30000)
    pg.wait_for_timeout(300)
    pg.evaluate("__wb.G.mg.over.querySelector('.go').click()")
    pg.wait_for_function("__wb.G.mg && __wb.G.mg.running", timeout=10000)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(URL + '&fast=1&mgslow=1'); pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
    drive_to(pg, lambda st: st['day'] == 1 and free(st))
    # reload without fast so the task runs at real speed
    # 1) a bright, loud Works for a sensitive profile: glare and phones; no visits so presses are not blocked
    start_sort(pg, {'light': 0.05, 'sound': 0.05, 'people': 0.9, 'talk': 0.9})
    intro_ok = True
    held = 0; used = 0; chips_ok = True; caps = set(); shot = False; t0 = time.time()
    while time.time() - t0 < 150 and pg.evaluate("__wb.G.mg && __wb.G.mg.running"):
        st = pg.evaluate("(() => { const m = __wb.G.mg, R = m.room; return { paused: R.paused(), q: !!R.queued, block: R.blocking(), n: m.count + m.wrong, cap: m.ui.hint.textContent, ev: m.ui.ev.hidden ? null : m.ui.ev.getBoundingClientRect().toJSON(), fr: m.focusRect && m.focusRect(), cv: m.cv.getBoundingClientRect().toJSON(), kind: R.ev && R.ev.k } })()")
        if st['block']:
            pg.evaluate("__wb.G.mg.room.sure()"); pg.wait_for_timeout(100); continue
        if st['paused'] and not st['q']:
            caps.add(st['cap'])
            if st['ev'] and st['fr']:
                fr = st['fr']; ev = st['ev']; cv = st['cv']
                ex, ey, ew, eh = ev['x'] - cv['x'], ev['y'] - cv['y'], ev['width'], ev['height']
                overlap = ex < fr['x'] + fr['w'] and ex + ew > fr['x'] and ey < fr['y'] + fr['h'] and ey + eh > fr['y']
                if overlap: chips_ok = False
            if not shot: pg.screenshot(path='/home/claude/wb4/test/shots_f/room_event.png'); shot = True
            pg.keyboard.press('1')
            q = pg.evaluate("!!__wb.G.mg.room.queued")
            if q: held += 1 # (a press that lands just after the moment ends is simply used at once)
            pg.wait_for_function("!__wb.G.mg.room.paused() || !__wb.G.mg.running", timeout=8000); pg.wait_for_timeout(60)
            # the held press was used: nothing is left waiting once the moment has passed
            if q and not pg.evaluate("!!__wb.G.mg.room.queued"): used += 1
            continue
        pg.wait_for_timeout(40)
    res = pg.evaluate("(() => { const R = __wb.G.mg.room; return { count: R.count, cost: R.cost } })()")
    check('bright loud works: glare and phones happen', res['count']['glare'] > 0 and res['count']['chatter'] > 0, res)
    check('no stillness for a sensitive profile', res['count']['drift'] == 0, res)
    check('a press during a moment is used after it', held > 0 and used == held, (held, used))
    check('chip never over the letter', chips_ok)
    check('captions make the room the subject', any('The panel glares' in c for c in caps) and any('phone calls' in c for c in caps) and not any(c.startswith('You squint') for c in caps), list(caps)[:4])
    pg.wait_for_function("__wb.G.mg && __wb.G.mg.over && __wb.G.mg.over.querySelector('.mg-result')", timeout=60000)
    result = pg.evaluate("__wb.G.mg.over.querySelector('.mg-result').innerText")
    check('results: the room as subject', 'The glare took' in result and 'The phones took' in result and 'Dot has turned her desk' in result, result[:300])
    check('results: no grade', not any(w in result for w in ('You lost', 'Grade', 'Score:')), result[:200])
    pg.screenshot(path='/home/claude/wb4/test/shots_f/room_result.png')
    pg.evaluate("__wb.G.mg.over.querySelector('.go').click()"); pg.wait_for_function("!__wb.G.mgActive", timeout=10000)
    # 2) a dull Works for a lively profile: stillness; the comfort move ends it early
    pg.evaluate("(() => { const S = __wb.state(); S.look.comfort = 'rock'; })()")
    start_sort(pg, {'light': 0.98, 'sound': 0.98, 'people': 0.1, 'talk': 0.8})
    btn = pg.evaluate("(() => { const b = document.querySelector('.mg-move'); return b && !b.hidden ? b.innerText : null; })()")
    check('comfort button named after the move', btn and btn.startswith('Rock'), btn)
    ended_early = 0; drifts = 0; t0 = time.time()
    while time.time() - t0 < 90 and pg.evaluate("__wb.G.mg && __wb.G.mg.running") and drifts < 2:
        k = pg.evaluate("(() => { const R = __wb.G.mg.room; if (R.blocking()) { R.sure(); return 'b'; } return R.ev ? R.ev.k + ':' + R.ev.t.toFixed(2) : null; })()")
        if k and k.startswith('drift'):
            drifts += 1; c0 = pg.evaluate("__wb.G.mg.room.cost.drift"); pg.keyboard.press('c')
            face = pg.evaluate("__wb.G.mg.ui.face.dataset.k")
            pg.wait_for_function("!__wb.G.mg.room.paused() || !__wb.G.mg.running", timeout=8000)
            took = pg.evaluate("__wb.G.mg.room.cost.drift") - c0
            # in game seconds: a still moment lasts 1.5 s; the move ends it at once
            if took < 1.2 and face == 'move': ended_early += 1
            pg.wait_for_timeout(200)
            continue
        pg.wait_for_timeout(40)
    check('stillness happens for a lively profile', drifts > 0, drifts)
    check('comfort move ends a still moment early', drifts > 0 and ended_early == drifts, (drifts, ended_early))
    pg.evaluate("__wb.G.mg.pause()"); pg.wait_for_timeout(200); pg.evaluate("document.querySelector('.mg-pausecard [data-a=skip]').click()")
    pg.wait_for_function("__wb.G.mg && __wb.G.mg.over && __wb.G.mg.over.querySelector('.mg-result')", timeout=20000)
    pg.evaluate("__wb.G.mg.over.querySelector('.go').click()"); pg.wait_for_function("!__wb.G.mgActive", timeout=10000)
    # 3) hiding it: the same moments, a straight face, no comfort button, stillness waits it out
    start_sort(pg, {'light': 0.98, 'sound': 0.98, 'people': 0.1, 'talk': 0.8}, masked=True)
    btn = pg.evaluate("(() => { const b = document.querySelector('.mg-move'); return b ? b.hidden : null; })()")
    check('masked: no comfort button', btn is True, btn)
    seen = None; t0 = time.time()
    while time.time() - t0 < 90 and pg.evaluate("__wb.G.mg && __wb.G.mg.running"):
        st = pg.evaluate("(() => { const m = __wb.G.mg, R = m.room; if (R.blocking()) { R.sure(); return null; } return R.ev ? { k: R.ev.k, cap: m.ui.hint.textContent, face: m.ui.face.dataset.k } : null; })()")
        if st: seen = st; break
        pg.wait_for_timeout(40)
    check('masked: straight face and caption', seen and seen['face'] == 'straight' and 'straight face' in seen['cap'], seen)
    ratio = pg.evaluate("(() => { const R = __wb.G.mg.room; const avg = (f) => { R.m.fewer = f; let t = 0; for (let i = 0; i < 400; i++) t += R.gap('drift'); return t / 400; }; const a = avg(false), b = avg(true); R.m.fewer = false; return b / a; })()")
    check('Fewer: gaps about twice as long', 1.8 < ratio < 2.2, ratio)
    pg.evaluate("__wb.G.mg.pause()"); pg.wait_for_timeout(200); pg.evaluate("document.querySelector('.mg-pausecard [data-a=skip]').click()")
    pg.wait_for_function("__wb.G.mg && __wb.G.mg.over && __wb.G.mg.over.querySelector('.mg-result')", timeout=20000)
    pg.evaluate("__wb.G.mg.over.querySelector('.go').click()"); pg.wait_for_function("!__wb.G.mgActive", timeout=10000)
    check('no page errors', not errors, errors[:3])
    b.close()
print(json.dumps(out, indent=1))
sys.exit(0 if out['ok'] else 1)
