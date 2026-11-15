# Your room, and the knock at the door: the first thing you do with your hands in the game. The room comes set for
# somebody else; you walk to six things (or click them, or tap them) and set each the way you like it. Then Wren is at
# the door, the way your own door sign asked: a text first, or one knock.
# Usage: python3 test/firstroom.py [OUTDIR]
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/firstroom'
os.makedirs(OUT, exist_ok=True)
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + json.dumps(info, default=str)[:500]) if not ok else ''), flush=True)

TITLE = "window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')"
DOT = "(k) => { const sl = __wb.G.story.slice; const v = sl.dots[k].position.clone().project(__wb.G.stage.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }"
def fresh(b, phone=False):
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if phone else {'width': 1280, 'height': 760}, is_mobile=phone, has_touch=phone, device_scale_factor=1)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(BASE + '?test=1&fast=1&mute=1&seed=12', timeout=180000, wait_until='commit'); pg.wait_for_function(TITLE, timeout=240000)
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); pg.wait_for_function(TITLE, timeout=240000)
    drive_to(pg, lambda st: free(st) and st['day'] == 1, budget=300)
    pg.wait_for_timeout(400)
    return pg, errs
def shot(pg, name): pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(OUT, name + '.jpg'), type='jpeg', quality=75)
def dot(pg, k):
    # where a thing's dot is on screen, once the camera is back at rest over the room (it eases back after each choice)
    pg.wait_for_function("(() => { const G = __wb.G; const c = G.roomCam('home'); return !G.busy && G.stage.camera.position.distanceTo(c.pos) < 0.04; })()", timeout=30000)
    pg.wait_for_timeout(150)
    return pg.evaluate(DOT, k)
def panel_q(pg): return pg.evaluate("(() => { const q = document.querySelector('#panel .q'); return __wb.panel() && q ? q.textContent : null; })()")
def wait_panel(pg): pg.wait_for_function("__wb.panel() && __wb.panel().includes('taps')", timeout=30000)
def wait_closed(pg, last=False):
    # (after the sixth thing the room's closing lines start by themselves, so there the wait is only for the choice to close)
    pg.wait_for_function("!__wb.panel()" if last else "!__wb.panel() && !__wb.busy()", timeout=30000)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # ---------- with a mouse and a keyboard ----------
    pg, errors = fresh(b)
    st = pg.evaluate("(() => { const G = __wb.G, sl = G.story.slice, h = G.rooms.home; return { sl: __wb.slice(), obj: __wb.obj().t, out: h.inter.find((i) => i.id === 'out').hidden, light: h.prefs.light, dots: Object.values(sl.dots || {}).filter((d) => d.visible).length, hud: !document.querySelector('#hud').hidden, min: G.S.min, lantern: !!G.S.flags.lantern, sill: h.inter.find((i) => i.id === 'sill').hidden }; })()")
    check('the day starts in your room, with nothing set yet', st['sl'] and st['sl']['stage'] == 'room' and st['sl']['room'] == 0, st)
    check('the room is the way it came: the lamp bright', st['light'] > 0.85, st)
    check('six glowing dots show what you can set', st['dots'] == 6, st)
    check('the objective says what to do, and how', 'Make this room fit you (0/6)' in st['obj'] and 'glowing dot' in st['obj'], st['obj'])
    check('the door is not for going out yet, and there is no lantern on the sill', st['out'] is True and st['sill'] is True and not st['lantern'], st)
    shot(pg, '01_room_as_it_came')
    # click the dot over the lamp: you walk to it and it opens
    xy = dot(pg, 'lamp'); pg.mouse.click(xy[0], xy[1]); wait_panel(pg)
    check('a click on the lamp\'s dot walks you over and asks about the light', panel_q(pg) == 'How bright do you like it?', panel_q(pg))
    check('the two pictures, a way to leave it, and six progress dots', pg.evaluate("document.querySelectorAll('#panel .pick').length === 2 && document.querySelector('#panel #back').textContent === 'Not now' && document.querySelectorAll('#panel .dots i').length === 6"))
    shot(pg, '02_lamp')
    pg.hover('#panel .pick:nth-child(1)'); pg.wait_for_timeout(150); lo = pg.evaluate('__wb.G.rooms.home.prefs.light')
    pg.hover('#panel .pick:nth-child(2)'); pg.wait_for_timeout(150); hi = pg.evaluate('__wb.G.rooms.home.prefs.light')
    check('pointing at a picture shows it in the room', lo == 0.22 and hi == 0.78, [lo, hi])
    pg.click('#panel .pick:nth-child(1)'); wait_closed(pg)
    s = pg.evaluate("[__wb.slice().room, __wb.state().profile.light, __wb.G.rooms.home.prefs.light, __wb.obj().t]")
    check('picking one sets it: 1 of 6, soft light, and the objective counts it', s[0] == 1 and s[1] == 0.22 and s[2] == 0.22 and '(1/6)' in s[3] and 'glowing dot' not in s[3], s)
    # "Not now" and Escape both leave a thing as it came
    xy = dot(pg, 'radio'); pg.mouse.click(xy[0], xy[1]); wait_panel(pg)
    check('the radio asks about sound', panel_q(pg) == 'How loud do you like the world?', panel_q(pg))
    pg.click('#panel #back'); wait_closed(pg)
    check('"Not now" leaves it unset', pg.evaluate("__wb.slice().room") == 1)
    xy = dot(pg, 'radio'); pg.mouse.click(xy[0], xy[1]); wait_panel(pg); pg.keyboard.press('Escape'); wait_closed(pg)
    check('Escape closes the choice (and does not open the pause menu)', pg.evaluate("__wb.slice().room === 1 && !(__wb.G.menus && __wb.G.menus.open)"))
    # with the keyboard: walk to the radio and press the use key, then 2
    pg.evaluate("__wb.G.place([1.4, -1.2])"); pg.wait_for_timeout(200)
    pg.keyboard.down('d'); pg.wait_for_function("__wb.target() === 'radio'", timeout=20000); pg.keyboard.up('d')
    check('walking up to the radio, the prompt names it', pg.evaluate("document.querySelector('#prompt').textContent").endswith('The radio'), pg.evaluate("document.querySelector('#prompt').textContent"))
    pg.keyboard.press('e'); wait_panel(pg); pg.keyboard.press('2'); wait_closed(pg)
    check('E opens it and 2 picks the second picture: lively', pg.evaluate("__wb.slice().room === 2 && __wb.state().profile.sound === 0.78"), pg.evaluate("__wb.state().profile"))
    # a thing you've set can be changed: it shows what you chose
    xy = dot(pg, 'lamp'); pg.mouse.click(xy[0], xy[1]); wait_panel(pg)
    check('opening the lamp again shows your choice, and offers to leave it', pg.evaluate("document.querySelector('#panel .pick.on') === document.querySelector('#panel .pick:nth-child(1)') && document.querySelector('#panel #back').textContent === 'Leave it'"))
    pg.click('#panel .pick:nth-child(2)'); wait_closed(pg)
    check('changing it changes you, and the count stays', pg.evaluate("__wb.slice().room === 2 && __wb.state().profile.light === 0.78"))
    # the bed and the mirror are still yours to use, and the morning waits
    pg.evaluate("__wb.G.place([2.1, -0.3])"); pg.wait_for_timeout(300)
    check('the mirror is still there to look in', pg.evaluate('__wb.target()') == 'mirror', pg.evaluate('__wb.target()'))
    check('the clock waits while you set up', pg.evaluate('__wb.state().min') <= 525, pg.evaluate('__wb.state().min'))
    check('no notice about saving while you are still setting up', not pg.evaluate("[...document.querySelectorAll('#toasts .toast')].some((t) => /Saved/.test(t.textContent))"))
    # the door sign: "Text first, please" (the second picture), then the rest
    xy = dot(pg, 'sign'); pg.mouse.click(xy[0], xy[1]); wait_panel(pg)
    check('the door sign asks who is welcome', 'door sign' in (panel_q(pg) or ''), panel_q(pg))
    pg.click('#panel .pick:nth-child(2)'); wait_closed(pg)
    check('the sign on the door now says to text first', pg.evaluate("__wb.state().profile.people") < 0.5)
    for k in ('note', 'clock', 'calendar'):
        xy = dot(pg, k); pg.mouse.click(xy[0], xy[1]); wait_panel(pg); pg.click('#panel .pick:nth-child(1)'); wait_closed(pg, k == 'calendar')
    lines = []
    def lines_until(cond, budget=60):
        import time; t0 = time.time()
        while time.time() - t0 < budget:
            if pg.evaluate(cond): return True
            if pg.evaluate("__wb.waiter() === 'line'"):
                t = pg.evaluate("document.querySelector('#dialog .text').textContent")
                if not lines or lines[-1] != t: lines.append(t)
                pg.evaluate('__wb.adv()')
            pg.wait_for_timeout(80)
        return False
    ok = lines_until("__wb.slice().stage === 'door' && !__wb.busy()")
    check('with all six set, the room says so, and the day moves on', ok and any('set the way you like it' in t for t in lines) and any('Remember how this feels' in t for t in lines), lines)
    pg.wait_for_timeout(500)
    st = pg.evaluate("(() => { const G = __wb.G, sl = G.story.slice, h = G.rooms.home; return { obj: __wb.obj(), out: h.inter.find((i) => i.id === 'out').hidden, dots: Object.values(sl.dots || {}).filter((d) => d.visible).length, texts: G.texts, radio: G.audio.radio }; })()")
    check('your sign said to text first, so Wren texts', any(t[0] == 'Wren' and 'text first' in t[1] for t in st['texts']) and st['obj']['t'].startswith('Wren texted'), st)
    check('the dots are gone, the door opens again, and the music is back as you had it', st['dots'] == 0 and st['out'] is False and st['radio'] == 1, st)
    check('the lamp cannot be set any more (the room is done)', pg.evaluate("(() => { __wb.G.place([-0.4, -1.5]); return true; })()") and (pg.wait_for_timeout(300) or True) and pg.evaluate('__wb.target()') != 'lamp', pg.evaluate('__wb.target()'))
    shot(pg, '03_door')
    # the door
    pg.evaluate("__wb.G.place([-2.4, 1.6])"); pg.wait_for_timeout(200)
    pg.keyboard.down('a'); pg.wait_for_function("__wb.target() === 'out'", timeout=20000); pg.keyboard.up('a')
    check('at the door, the prompt is to open it', pg.evaluate("document.querySelector('#prompt').textContent").endswith('Open the door'), pg.evaluate("document.querySelector('#prompt').textContent"))
    pg.keyboard.press('e'); lines.clear()
    pg.wait_for_function("__wb.waiter() === 'line' && __wb.loc() === 'town'", timeout=30000); pg.wait_for_timeout(600)
    v = pg.evaluate('__wb.G.talkView()')
    check('Wren is on your step, and the camera shows both of you', v and v['blocked'] == 0 and all(v['onScreen']), v)
    shot(pg, '04_wren')
    ok = lines_until("__wb.slice().stage === 'homerow' && !__wb.busy() && __wb.mode() === 'play' && !__wb.waiter()")
    check('Wren says who she is, gives you the lantern, and tells you about tonight', ok and len(lines) >= 5 and 'texted first' in lines[0] and any('shows what pinches people' in t for t in lines) and any('lantern night' in t for t in lines) and any('color is flat' in t for t in lines), lines)
    st = pg.evaluate("(() => { const S = __wb.state(); return { lantern: !!S.flags.lantern, guests: Object.keys(S.guests), strip: !document.querySelector('#hud .gstrip').hidden, btn: !!document.querySelector('#hud .gb[data-g=look]'), obj: __wb.obj().t, met: !!S.met.wren }; })()")
    check('you have the lantern, Wren is coming tonight, and the objective is to raise it', st['lantern'] and st['guests'] == ['wren'] and st['strip'] and st['btn'] and 'Raise Wren' in st['obj'] and st['met'], st)
    check('no page errors (mouse and keyboard)', not errors, errors)
    pg.context.close()

    # ---------- the other door sign: one knock ----------
    pg, errors = fresh(b)
    pg.evaluate("__wb.roomSet({ sign: 0.22 })")
    lines.clear(); lines_until("__wb.slice().stage === 'door' && !__wb.busy()"); pg.wait_for_timeout(600)
    cc = pg.evaluate("document.querySelector('#cc').textContent")
    check('with "Drop by any time!" on the door, there is one knock (said in words too)', 'One knock' in cc and pg.evaluate("__wb.obj().t") == 'Someone knocked, once.' and not pg.evaluate("__wb.G.texts.length"), [cc, pg.evaluate("__wb.obj().t")])
    pg.evaluate("__wb.G.place([-3.0, 1.6])"); pg.wait_for_timeout(300); pg.keyboard.press('e'); lines.clear()
    pg.wait_for_function("__wb.waiter() === 'line' && __wb.loc() === 'town'", timeout=30000)
    lines_until("__wb.slice().stage === 'homerow' && !__wb.busy() && !__wb.waiter()")
    check('and Wren says she knocked once', lines and 'I knocked once' in lines[0], lines[:1])
    check('no page errors (one knock)', not errors, errors)
    pg.context.close()

    # ---------- on a phone: taps ----------
    pg, errors = fresh(b, phone=True)
    st = pg.evaluate("[__wb.slice(), __wb.obj().t]")
    check('phone: the room, and the objective says to tap', st[0]['stage'] == 'room' and 'Tap a glowing dot' in st[1], st)
    shot(pg, '05_phone_room')
    on = pg.evaluate("(() => { const sl = __wb.G.story.slice; return Object.keys(sl.dots).map((k) => { const v = sl.dots[k].position.clone().project(__wb.G.stage.camera); return [k, (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); })()")
    check('phone: every dot is on the screen, clear of the top bar', all(16 < x < 374 and 90 < y < 800 for _, x, y in on), on)
    for i, k in enumerate(('lamp', 'radio', 'sign', 'note', 'clock', 'calendar')):
        xy = dot(pg, k); pg.touchscreen.tap(xy[0], xy[1]); wait_panel(pg)
        if i == 0:
            shot(pg, '06_phone_lamp')
            box = pg.evaluate("(() => { const r = document.querySelector('#panel').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
            check('phone: the two pictures fit the screen', box[0] >= 0 and box[2] <= 390 and box[3] <= 844, box)
        pg.tap('#panel .pick:nth-child(1)'); wait_closed(pg, k == 'calendar')
    lines.clear(); ok = lines_until("__wb.slice().stage === 'door' && !__wb.busy()")
    check('phone: six taps set the room', ok and pg.evaluate("__wb.slice().room") == 6)
    check('no page errors (phone)', not errors, errors)
    b.close()
bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad, 'failed': bad}))
sys.exit(0 if not bad else 1)
