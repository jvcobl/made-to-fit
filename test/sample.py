# "Short on time?" on the title: the end of a sample first day, for someone with two minutes. Checks that it goes
# straight to lantern night with a sample creature, shows the day's card with its three questions, comes back to the
# title when it ends, and never writes a save (a game already in progress on the device is exactly as it was).
# Usage: python3 test/sample.py [OUTDIR] [phone]
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sample'
PHONE = len(sys.argv) > 2 and sys.argv[2] == 'phone'
os.makedirs(OUT, exist_ok=True)
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + json.dumps(info, default=str)[:500]) if not ok else ''), flush=True)

TITLE = "window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')"
SAVE = "localStorage.getItem('mtf.save')"
def shot(pg, name): pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(OUT, name + '.jpg'), type='jpeg', quality=75)

def night(pg, said):
    """From the confirm to the day's card: every line is read, the guess is made, the lantern is raised."""
    t0 = time.time()
    while time.time() - t0 < 420:
        pg.wait_for_timeout(80)
        st = pg.evaluate("({ panel: __wb.panel(), waiter: __wb.waiter(), raise: !!document.querySelector('.raisebtn'), go: !!document.querySelector('.revealcount .rvgo'), look: !!document.querySelector('.lookbtn') })")
        if st['panel'] and 'daycard' in st['panel']: return True
        if st['waiter'] == 'line':
            t = pg.evaluate("document.querySelector('#dialog .text').textContent")
            if not said or said[-1] != t: said.append(t)
            pg.evaluate('__wb.adv()'); continue
        if st['waiter'] == 'choice':
            opts = pg.evaluate('__wb.options()'); said.append('CHOICE ' + ' | '.join(o['t'] for o in opts))
            pg.evaluate('__wb.choose(%d)' % next((i for i, o in enumerate(opts) if o['id'] == 'guess_half'), 0)); continue
        if st['raise']: pg.keyboard.press('l') if not PHONE else pg.evaluate("(() => { const b = document.querySelector('.raisebtn'); if (b) b.click(); })()"); pg.wait_for_timeout(400); continue
        if st['go']: pg.evaluate("(() => { const b = document.querySelector('.revealcount .rvgo'); if (b) b.click(); })()"); continue
        if st['look']: pg.evaluate("(() => { const b = document.querySelector('.lookbtn'); if (b) b.click(); })()"); continue
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if PHONE else {'width': 1280, 'height': 760}, is_mobile=PHONE, has_touch=PHONE, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=12', timeout=180000, wait_until='commit'); pg.wait_for_function(TITLE, timeout=240000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function(TITLE, timeout=240000)

    # ---------- 1. on a device with no game yet ----------
    t = pg.evaluate("(() => { const b = document.querySelector('#tShort'); const r = b.getBoundingClientRect(); return { text: b.textContent, w: r.width, h: r.height, on: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; })()")
    check('the title offers "Short on time?", on screen', t['text'] == 'Short on time?' and t['on'], t)
    shot(pg, '01_title')
    pg.click('#tShort'); pg.wait_for_selector('#overlay #yYes', timeout=20000)
    txt = pg.evaluate("document.querySelector('#overlay').textContent")
    check('it says what you will see, how long it takes, and that nothing is saved', 'sample day' in txt and 'two minutes' in txt and 'nothing is saved' in txt, txt)
    shot(pg, '02_confirm')
    pg.click('#overlay #yNo'); pg.wait_for_timeout(400)
    check('"Back" leaves you on the title', pg.evaluate(TITLE))
    pg.click('#tShort'); pg.wait_for_selector('#overlay #yYes', timeout=20000); pg.click('#overlay #yYes')
    said = []
    ok = night(pg, said)
    check('it goes to lantern night and reaches the day\'s card', ok, said[-4:])
    st = pg.evaluate("(() => { const S = __wb.state(); return { guests: Object.keys(S.guests || {}).length, fixes: S.fixes, name: S.name, stage: S.slice.stage }; })()")
    check('the sample day saw to all three places, and everyone came', st['guests'] == 8 and all(st['fixes'].get(f) == 'built' for f in ('lanterns', 'quiet', 'ramp')), st)
    check('Wren asks for a guess, and the lantern answers: nobody fits the Standard', any(s.startswith('CHOICE') and 'Most of them' in s and 'Nobody' in s for s in said) and any('not one of us fits it' in s for s in said), said)
    card = pg.evaluate("(() => { const p = document.querySelector('#panel'); const r = p.getBoundingClientRect(); const g = p.querySelector('#dGo'); const gr = g.getBoundingClientRect(); return { text: p.textContent, go: g.textContent, others: !!(p.querySelector('#dQuiet') || p.querySelector('#dStop')), box: [r.left, r.top, r.right, r.bottom], goOn: gr.top >= 0 && gr.bottom <= innerHeight, scroll: p.scrollHeight - p.clientHeight }; })()")
    check('the card asks the three questions', all(q in card['text'] for q in ('Who adjusted?', 'Who profited?', 'Who checked?')), card['text'][:300])
    check('it says this was a sample day, and offers only the way back', 'end of a sample day' in card['text'] and card['go'] == 'Back to the start' and not card['others'], card)
    check('the card fits the screen, with its button in reach', card['box'][0] >= 0 and card['box'][2] <= (390 if PHONE else 1280) and card['goOn'], card)
    shot(pg, '03_card')
    pg.click('#panel .dpick [data-v="hook"]'); pg.wait_for_timeout(300)
    ans = pg.evaluate("(() => { const a = document.querySelector('#panel .dans'); return a.hidden ? '' : a.textContent; })()")
    check('calling the reward a pull gets the honest answer: it was both', 'It was' in ans and 'who gains' in ans, ans)
    shot(pg, '04_card_answer')
    check('nothing was saved on the way', pg.evaluate(SAVE) is None, pg.evaluate(SAVE))
    pg.click('#panel #dGo')
    pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title') && !document.querySelector('#panel.daycard')", timeout=120000)
    pg.wait_for_timeout(500)
    check('it ends back at the title, with no game to continue (none was made)', pg.evaluate(SAVE) is None and not pg.evaluate("!!document.querySelector('#tCont')"), pg.evaluate("document.querySelector('#panel').textContent")[:200])

    # ---------- 2. on a device with a game in progress ----------
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    # (the room set, its two closing lines read, and Wren's knock still to answer: a game well under way)
    pg.evaluate("__wb.roomSet({})"); t0 = time.time()
    while time.time() - t0 < 60 and not pg.evaluate("__wb.slice().stage === 'door' && !__wb.busy() && !__wb.waiter()"):
        if pg.evaluate("__wb.waiter() === 'line'"): pg.evaluate('__wb.adv()')
        pg.wait_for_timeout(100)
    pg.wait_for_timeout(400)
    check('a real game, saved with the room set and Wren at the door', pg.evaluate("__wb.G.story.autosave(true)") and pg.evaluate(SAVE) is not None, pg.evaluate("[__wb.slice(), __wb.busy(), __wb.waiter(), __wb.mode()]"))
    pg.reload(); pg.wait_for_function(TITLE, timeout=240000)
    check('the title offers to continue it', pg.evaluate("!!document.querySelector('#tCont')"))
    # (read at the title: the game saved itself once more as its page closed)
    before = pg.evaluate(SAVE)
    pg.click('#tShort'); pg.wait_for_selector('#overlay #yYes', timeout=20000); pg.click('#overlay #yYes')
    said = []
    check('the sample night plays', night(pg, said), said[-4:])
    pg.click('#panel #dGo')
    pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title') && !document.querySelector('#panel.daycard')", timeout=120000)
    pg.wait_for_timeout(500)
    after = pg.evaluate(SAVE)
    check('the game in progress is exactly as it was', after == before, [len(before or ''), len(after or '')])
    check('and Continue is still on the title', pg.evaluate("!!document.querySelector('#tCont')"))
    check('no page errors', not errors, errors)
    b.close()
bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad, 'failed': bad}))
sys.exit(0 if not bad else 1)
