# The opening, at its real pace: the town from above, then "Look closer", where you tap people in the square and each
# shows what their day is about. Checks that a tap puts a thought over the person nearest it, that the keyboard does the
# same, that doing nothing still moves on, and that the first thing you can do comes within a few seconds of Begin.
# Usage: python3 test/opening.py [OUTDIR]
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/opening'
os.makedirs(OUT, exist_ok=True)
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)) if info and not ok else ''))

CAP = "(() => { const c = document.querySelector('#caption'); return c && c.classList.contains('on') ? c.textContent : ''; })()"
THOUGHTS = "[...document.querySelectorAll('.pop.thought')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })"

def begin(pg):
    pg.goto(BASE + '?test=1&mute=1&seed=12', timeout=180000, wait_until='commit')
    pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload()
    pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    pg.evaluate("document.querySelector('#tNew').click()")
    return time.time()

def wait_cap(pg, words, timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        c = pg.evaluate(CAP)
        if words in c: return c
        pg.wait_for_timeout(120)
    return None

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    errors = []
    # 1. with the mouse
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    t0 = begin(pg)
    first = wait_cap(pg, 'one crowd')
    check('the first caption is the town as one crowd', first is not None, first)
    c = wait_cap(pg, 'Look closer')
    t_in = time.time() - t0
    check('"Look closer" asks for a tap, and says the key too', c is not None and 'Click anyone' in c and 'Space' in c, c)
    check('the first thing to do comes within 15 seconds of Begin', t_in < 15, round(t_in, 1))
    pg.screenshot(path=os.path.join(OUT, '01_look_closer.jpg'), type='jpeg', quality=75)
    PPL = "__wb.G.sonder.people(true).map((q) => ({ x: q.sx, y: q.sy }))"
    ppl = pg.evaluate(PPL)
    check('there are people on screen to tap', len(ppl) >= 5, len(ppl))
    # three people well apart, below the strip the words sit in (each found where they are at the moment of the tap:
    # they keep walking)
    picks = []
    for i in range(3):
        before = pg.evaluate(THOUGHTS); ppl = pg.evaluate(PPL)
        # someone below the strip the words sit in (and above the dark bar at the foot of the picture), with nobody close
        # enough to be mistaken for them, as far as can be
        # from the people already tapped (the game takes a tap anywhere: this only keeps the check unambiguous)
        far = lambda q: min([abs(q['x'] - r['x']) + abs(q['y'] - r['y']) for r in picks + before] or [9999])
        q = None
        for alone, apart in ((70, 150), (50, 110), (35, 70), (0, 40)):   # (the crowd is where it is: ask for less when it's bunched up)
            cand = [c for c in ppl if 760 * 0.37 < c['y'] < 760 - 130 and 120 < c['x'] < 1160 and all(abs(c['x'] - r['x']) + abs(c['y'] - r['y']) > alone for r in ppl if r is not c) and far(c) > apart]
            if cand: q = sorted(cand, key=far, reverse=True)[0]; break
        if not q: check('tap %d: someone to tap' % (i + 1), False, {'picks': picks, 'people': ppl}); break
        picks.append(q)
        pg.mouse.click(q['x'], q['y'] + 30); pg.wait_for_timeout(900)
        after = pg.evaluate(THOUGHTS)
        new = [t for t in after if t['t'] not in [u['t'] for u in before]]
        near = [t for t in new if abs(t['x'] - q['x']) < 190 and abs(t['y'] - q['y']) < 190]
        check('tap %d: a thought appears over the person tapped' % (i + 1), len(new) >= 1 and len(near) >= 1, {'tap': q, 'new': new})
        if i == 0: pg.screenshot(path=os.path.join(OUT, '02_one_thought.jpg'), type='jpeg', quality=75)
    c = wait_cap(pg, 'middle of their own day', 30)
    th = pg.evaluate(THOUGHTS)
    check('after three taps the rest of the crowd joins in, and the caption says what you saw', c is not None and len(th) >= 5, {'cap': c, 'n': len(th)})
    pg.screenshot(path=os.path.join(OUT, '03_everyone.jpg'), type='jpeg', quality=75)
    box = pg.evaluate("(() => { const r = document.querySelector('#caption').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
    over = [t for t in th if box[0] < t['x'] < box[2] and box[1] - 6 < t['y'] < box[3] + 6]
    check('no thought sits on the caption', len(over) == 0, {'box': box, 'over': over})
    c = wait_cap(pg, 'Standard Resident', 30)
    check('then the statue: built to fit one person', c is not None, c)
    check('the thoughts are gone by the statue', len(pg.evaluate(THOUGHTS)) == 0)
    pg.screenshot(path=os.path.join(OUT, '04_statue.jpg'), type='jpeg', quality=75)
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=60000)
    t_cr = time.time() - t0
    check('from the statue, straight to you: the creator opens', True, round(t_cr, 1))
    pg.screenshot(path=os.path.join(OUT, '05_creator.jpg'), type='jpeg', quality=75)
    print(json.dumps({'first_input_s': round(t_in, 1), 'creator_s': round(t_cr, 1)}))
    pg.close()
    # 2. with the keyboard: Space shows one person's day at a time
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    begin(pg); wait_cap(pg, 'Look closer')
    for i in range(3):
        n0 = len(pg.evaluate(THOUGHTS)); pg.keyboard.press('Space'); pg.wait_for_timeout(700)
        check('Space %d: one more thought' % (i + 1), len(pg.evaluate(THOUGHTS)) >= n0 + 1)
    c = wait_cap(pg, 'middle of their own day', 30)
    check('the keyboard gets the same scene', c is not None and len(pg.evaluate(THOUGHTS)) >= 5)
    pg.close()
    # 3. doing nothing: it moves on by itself (nothing here needs quick hands)
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    begin(pg); wait_cap(pg, 'Look closer'); t1 = time.time()
    c = wait_cap(pg, 'middle of their own day', 40)
    dt = round(time.time() - t1, 1); n = len(pg.evaluate(THOUGHTS))
    check('with no tap at all, the thoughts appear by themselves within about ten seconds', c is not None and dt < 16 and n >= 5, {'s': dt, 'thoughts': n})
    # 4. Escape skips the opening
    pg.close()
    pg = b.new_page(viewport={'width': 1280, 'height': 760}); pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    begin(pg); wait_cap(pg, 'Look closer'); t1 = time.time(); pg.keyboard.press('Escape')
    pg.wait_for_function("__wb.panel() && __wb.panel().includes('creator')", timeout=60000)
    check('Escape skips straight to making your creature', time.time() - t1 < 20, round(time.time() - t1, 1))
    b.close()
bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad and not errors, 'failed': bad, 'errors': errors}))
sys.exit(0 if not bad and not errors else 1)
