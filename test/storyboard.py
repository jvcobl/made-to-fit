# The first day as a player meets it: every word the game shows, in order, with what kind of thing showed it
# (caption, dialogue line, choice, card, notice, floating label, instruction), a screenshot at each beat, and the
# numbers a designer checks: how much there is to read, how many instructions, choices and pop-ups, and how much
# comes before the player first gets to move.
# Usage: python3 test/storyboard.py [desktop|phone] [OUTDIR] [seed] [policy] [fast]
#   policy: 'good' (listens, solves the sketch, asks, declines Blend) or 'blend' (tries Blend, rushes)
#   fast: '1' runs with ?fast=1 (short waits; for checking the flow), '0' the real pacing
#   env FIRST=works: go to the Works before the square. env EARLY=1: go home for lantern night after one of the two.
# Writes OUTDIR/transcript.txt, OUTDIR/events.json, OUTDIR/audit.json and numbered screenshots; exits 1 on a page error.
import json, sys, time, os, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS, BASE, drive_to, free

mode = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/storyboard'
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 31
POLICY = sys.argv[4] if len(sys.argv) > 4 else 'good'
FASTQ = (sys.argv[5] if len(sys.argv) > 5 else '0') == '1'
SHOTS = os.environ.get('SHOTS', '1') == '1'
FIRST = os.environ.get('FIRST', 'market'); EARLY = os.environ.get('EARLY', '') == '1'
os.makedirs(OUT, exist_ok=True)

# every way the game puts words on screen, wrapped so each use is logged with its kind
HOOK = r"""(() => {
  if (window.__T) return; const T = window.__T = []; const G = __wb.G, ui = G.ui;
  // (a notice's title, its heading and its sentence are separate lines on screen: " / " keeps them apart in the transcript)
  const clean = (t) => String(t == null ? '' : t).replace(/<button[^>]*tclose[^>]*>.*?<\/button>/g, ' ').replace(/<br\s*\/?>|<\/(b|div|small|h\d|p|strong)>/g, ' / ').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().replace(/( \/)+ /g, ' / ').replace(/^\/ ?| ?\/$/g, '').replace(/([.!?:]) \/ /g, '$1 ').trim();
  const push = (k, t, x) => { const S = G.S || {}; const e = Object.assign({ k, t: clean(t), d: S.day || 0, m: Math.round(S.min || 0), st: S.slice ? S.slice.stage : null, mode: G.mode }, x || {});
    const last = T[T.length - 1]; if (last && last.k === e.k && last.t === e.t) return; T.push(e); };
  const wrap = (obj, name, fn) => { if (!obj || !obj[name]) return; const orig = obj[name].bind(obj); obj[name] = (...a) => { try { fn(...a); } catch (err) { /* logging never breaks play */ } return orig(...a); }; };
  wrap(ui, 'caption', (t) => push('caption', t));
  wrap(ui, 'line', (o) => push('line', o.text, { kind: o.kind || 'say', who: o.who || null }));
  wrap(ui, 'choose', (opts, o) => push('choice', (o && o.text) || '', { opts: opts.map((x) => x.t) }));
  wrap(ui, 'barrier', (b) => push('barrier', b.title + '. ' + b.text + (b.coach ? ' ' + b.coach : ''), { opts: b.options.map((x) => x.label + (x.disabled ? ' (not available)' : '')) }));
  wrap(ui, 'toast', (html, kind) => { if (T.slice(-12).some((e) => e.k === 'toast' && e.t === clean(html))) return; push('toast', html, { kind: kind || '' }); });
  wrap(ui, 'cc', (t) => push('cc', t));
  wrap(ui, 'bubble', (key, t) => push('bubble', t, { who: key }));
  wrap(ui, 'openPanel', (cls, html) => push('panel', html, { cls }));
  wrap(G.fx, 'pop', (at, t, o) => push('pop', t, { kind: (o && o.kind) || '', hook: (o && o.hook) || null }));
  wrap(G.marks, 'showCard', (m) => push('markcard', (m.name || '') + '. ' + (m.line || '')));
  wrap(G.story, 'text', (from, t) => push('text', t, { who: from }));
  wrap(G.story.slice, 'lookCloser', () => push('prompt', 'Look closer. ' + (ui.touch ? 'Tap anyone.' : 'Click anyone. or press Space')));
  window.__Tobj = (t) => push('objective', t);
  window.__Tnote = (k, t) => push(k, t);
})()"""

ST = """(() => { const G = __wb.G, S = G.S, sl = G.story.slice; const o = G.story.objective();
  const sweep = sl.sweepZone();
  return { sl: __wb.slice(), more: o && o.more ? o.more.at : null, tap: !!G.onTap, stage: S.slice ? S.slice.stage : null, day: S.day, min: Math.round(S.min), mode: G.mode, busy: G.busy, waiter: __wb.waiter(), panel: __wb.panel(), mg: __wb.mg(),
    loc: G.loc, zone: G.zone, raised: !!G.look.raised, near: G.marks.near ? G.marks.near.id : null, target: G.target ? G.target.id : null, tkind: G.target ? G.target.kind : null, hearing: !!document.querySelector('#hearing'),
    ov: !!document.querySelector('#overlay:not([hidden])'), obj: o ? o.t : '', at: o ? o.at : null, inside: o ? o.inside || null : null, spot: o ? o.spot || null : null, sweep,
    pos: [G.player.root.position.x, G.player.root.position.z], guests: Object.keys(S.guests || {}), path: G.path.length, phone: G.phoneOpen, n: (window.__T || []).length } })()"""

SHOT_KINDS = ('caption', 'line', 'choice', 'barrier', 'panel', 'markcard')
INSTRUCT = re.compile(r"^(go |head |raise |sweep |take |ask |turn |find |walk |pick |hang |press |tap |talk |look |bring |come |follow |get |tag |set |make |see |visit |wait |step |try )", re.I)
def words(s): return len(re.findall(r"[A-Za-z0-9'’]+", s or ''))

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mode == 'phone' else {'width': 1280, 'height': 760}, is_mobile=mode == 'phone', has_touch=mode == 'phone', device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)[:400]))
    pg.on('console', lambda m: errors.append('console: ' + m.text[:400]) if m.type == 'error' else None)
    # PUMP=1 (real pace only): the game as a device drawing sixty frames a second plays it. A headless machine draws a
    # frame or two a second, and the game then moves at a tenth of its speed while its waits run on the clock, so people
    # are still walking when a scene needs them. With PUMP the game is stepped in fixed frames to keep up with the clock.
    PUMPED = os.environ.get('PUMP') == '1' and not FASTQ
    PUMP = "(() => { let last = performance.now(); window.__pump = setInterval(() => { const t = performance.now(); let n = Math.round((t - last) / 16.667); if (n < 1) return; if (n > 45) n = 45; last = t; try { __wb.step(n, false); } catch (e) {} }, 40); })()"
    url = BASE + '?test=1&mute=1&seed=%d' % SEED + ('&fast=1' if FASTQ else '') + ('&fixedstep=1' if PUMPED else '')
    def opened():
        if PUMPED: pg.wait_for_function('window.__wb && __wb.G', timeout=240000); pg.evaluate(PUMP)
        pg.wait_for_function("window.__wb && __wb.G && __wb.panel() && __wb.panel().includes('title')", timeout=240000)
    pg.goto(url, timeout=180000, wait_until='commit'); opened()
    pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload(); opened()
    pg.evaluate("__wb.G.settings.textSpeed = 'fast'")
    pg.evaluate(HOOK)
    t0 = time.time(); seen = 0; shot_n = 0; shots = []; last_obj = None; first_play = None; marks = {}
    def snap(tag):
        global shot_n
        if not SHOTS: return None
        shot_n += 1; name = '%03d_%s.jpg' % (shot_n, re.sub(r'[^a-z0-9]+', '_', tag.lower())[:28])
        try:
            pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(90)
            pg.screenshot(path=os.path.join(OUT, name), type='jpeg', quality=72)
        except Exception as e: return None
        return name
    def pump(st=None):
        """log objective changes, note the first moment of control, and photograph each new beat"""
        global seen, last_obj, first_play
        if st and st['mode'] == 'play' and not st['busy'] and not st['waiter'] and not st['panel'] and st['obj'] and st['obj'] != last_obj:
            last_obj = st['obj']; pg.evaluate('(t) => window.__Tobj(t)', st['obj'])
        if st and first_play is None and st['mode'] == 'play' and not st['busy'] and not st['waiter'] and not st['panel']:
            first_play = True; pg.evaluate("window.__Tnote('control', 'the player can move')"); marks['you_can_walk'] = round(time.time() - t0, 1)
        # (seconds from the title's Begin: clicking it is the first thing the loop below does)
        if st and st.get('tap') and 'look_closer' not in marks: marks['look_closer'] = round(time.time() - t0, 1)
        n = pg.evaluate('(window.__T || []).length')
        if n > seen:
            new = pg.evaluate('(a) => window.__T.slice(a)', seen); base = seen; seen = n
            for i, e in enumerate(new):
                if e['k'] in SHOT_KINDS and i == len(new) - 1:
                    name = snap(e['k'] + '_' + (e.get('who') or e.get('cls') or '') + '_' + e['t'][:18])
                    if name: shots.append([base + i, name])
    def click_first(sel):
        return pg.evaluate("(s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }", sel)

    # title -> the day
    stuck_t = time.time(); last_key = None
    while time.time() - t0 < (900 if FASTQ else 2400):
        st = pg.evaluate(ST); pump(st)
        key = (st['stage'], st['panel'], st['n'], st['obj'], st['loc'], len(st['guests']))
        if key != last_key: last_key = key; stuck_t = time.time()
        if time.time() - stuck_t > (120 if FASTQ else 300): raise Exception('stuck: %s\nerrors: %s' % (json.dumps(st), json.dumps(errors[-4:])))
        # (UNTIL=arrive: stop as soon as the first of the two places has been reached; for checking the walk there)
        if os.environ.get('UNTIL') == 'arrive' and st['sl'] and st['sl']['stage'] == 'open' and (st['sl']['mk'] != 'go' or st['sl']['wk'] != 'go'): print('ARRIVED', json.dumps(errors[-4:])); break
        tk = st['stage'] + (':%s/%s' % (st['sl']['mk'], st['sl']['wk']) if st['stage'] == 'open' and st['sl'] else '') if st['stage'] else None
        if tk and tk not in marks: marks[tk] = round(time.time() - t0, 1)
        if st['day'] >= 2: break
        panel = st['panel'] or ''
        if st['ov']:
            pg.evaluate("(() => { const b = document.querySelector('#overlay #cGo') || document.querySelector('#overlay #nOk') || document.querySelector('#overlay .btn.primary') || document.querySelector('#overlay [data-back]'); if (b) b.click(); })()"); pg.wait_for_timeout(200); continue
        if st['hearing']:
            pg.wait_for_timeout(300 if FASTQ else 900)
            if 'hearing_ui' not in marks: marks['hearing_ui'] = round(time.time() - t0, 1)
            # (the hearing writes its own words: what's on its bench and in its speech line goes in the transcript too)
            pg.evaluate("(() => { const q = (s) => { const e = document.querySelector('#hearing ' + s); return e ? e.textContent : ''; }; const o = q('.hobj p'), sy = q('.hsay'); if (o) window.__Tnote('hearing', o); if (sy) window.__Tnote('hearing', sy); })()")
            if pg.evaluate("(() => { const h = __wb.G.story.slice.hearingNow; return !!(h && !h.busy && !h.over); })()"): snap('hearing')
            pg.evaluate("(() => { const h = __wb.G.story.slice.hearingNow; if (h && !h.busy) h.auto(); })()"); pg.wait_for_timeout(400); continue
        if st['mg']:
            if 'mg' not in marks: marks['mg'] = round(time.time() - t0, 1); pg.wait_for_timeout(500); snap('sketch')
            pg.evaluate('__wb.mgAuto(%s)' % ('0.9' if POLICY == 'good' else '0.2')); pg.wait_for_timeout(400); continue
        if 'title' in panel: click_first('#tNew'); pg.wait_for_timeout(300); continue
        if 'creator' in panel: pg.wait_for_timeout(300); click_first('#done'); pg.wait_for_timeout(300); continue
        if 'daycard' in panel:
            # the one reward to call, then on to Tuesday
            if click_first('#panel .dpick [data-v="real"]'): pg.wait_for_timeout(500); pg.evaluate("(() => { const a = document.querySelector('#panel .dans'); if (a) window.__Tnote('panel', a.textContent); })()"); snap('daycard_answer')
            click_first('#panel #dGo'); pg.wait_for_timeout(400); continue
        if 'taps' in panel: click_first('#panel .pick'); pg.wait_for_timeout(350); continue
        if panel and ('center' in panel or 'today' in panel):
            pg.evaluate("(() => { const g = document.querySelector('#panel #tgo') || document.querySelector('#panel #go') || document.querySelector('#panel #done') || document.querySelector('#panel .btn.primary'); if (g) g.click(); })()"); pg.wait_for_timeout(200); continue
        if st['waiter'] == 'line': pg.wait_for_timeout(40); pg.evaluate('__wb.adv()'); pg.wait_for_timeout(60); continue
        if st['waiter'] in ('choice', 'barrier'):
            opts = pg.evaluate('__wb.options()'); pick = None
            for i, o in enumerate(opts):
                if o['disabled']: continue
                if st['waiter'] == 'barrier' and o['key'] == 'fix' and POLICY == 'good': pick = i
                if o['id'] in ('blend_no', 'gil_ask') and POLICY == 'good': pick = i
                if o['id'] in ('blend_yes', 'gil_later') and POLICY == 'blend': pick = i
                if o['id'] == 'night_now' and EARLY: pick = i
            # (someone who listens asks what Blend costs before answering)
            if POLICY == 'good' and any(o['id'] == 'blend_cost' for o in opts): pick = next(i for i, o in enumerate(opts) if o['id'] == 'blend_cost')
            if not EARLY and any(o['id'] == 'night_wait' for o in opts): pick = next(i for i, o in enumerate(opts) if o['id'] == 'night_wait')
            if pick is None: pick = next((k for k, o in enumerate(opts) if not o['disabled']), 0)
            pg.evaluate('__wb.choose(%d)' % pick); pg.wait_for_timeout(150); continue
        # a button the scene itself puts up (raise the lantern, continue past a list)
        if pg.evaluate("!!document.querySelector('.raisebtn')"): snap('raise'); pg.keyboard.press('l'); pg.wait_for_timeout(600 if FASTQ else 1800); snap('reveal'); continue
        if pg.evaluate("!!document.querySelector('.revealcount .rvgo')"): snap('porchfit'); click_first('.revealcount .rvgo'); pg.wait_for_timeout(300); continue
        if pg.evaluate("!!document.querySelector('.lookbtn')"): click_first('.lookbtn'); pg.wait_for_timeout(300); continue
        # the opening's "Look closer": tap three people in the square
        if st['tap']:
            q = pg.evaluate("(() => { const so = __wb.G.sonder; const done = new Set([...document.querySelectorAll('.pop.thought')].map((e) => e.textContent)); const ps = so.people(true).filter((p) => p.sy > innerHeight * 0.42 && p.sx > 120 && p.sx < innerWidth - 120); const p = ps[Math.floor(ps.length * 0.37 + done.size * 0.29) % Math.max(1, ps.length)]; return p ? [p.sx, p.sy] : null; })()")
            if q:
                if mode == 'phone': pg.touchscreen.tap(q[0], q[1] + 24)
                else: pg.mouse.click(q[0], q[1] + 24)
                pg.wait_for_timeout(700); snap('tap')
            else: pg.wait_for_timeout(200)
            continue
        if not free(st): pg.wait_for_timeout(120); continue
        # your room: click (or tap) the dot over each thing still to set; the two pictures are answered above
        if st['sl'] and st['sl']['stage'] == 'room':
            if st['sl']['room'] == 0 and 'roomshot' not in marks: marks['roomshot'] = 1; snap('room_as_it_came')
            q = pg.evaluate("(() => { const sl = __wb.G.story.slice; const k = Object.keys(sl.dots || {}).find((k) => !sl.roomHas(k)); if (!k) return null; const v = sl.dots[k].position.clone().project(__wb.G.stage.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; })()")
            if q and st['path'] == 0:
                if mode == 'phone': pg.touchscreen.tap(q[0], q[1])
                else: pg.mouse.click(q[0], q[1])
            pg.wait_for_timeout(500); continue
        # the open middle of the day: which place first, and (EARLY) home after one of them
        if st['sl'] and st['sl']['stage'] == 'open' and st['loc'] == 'town' and not st['sweep']:
            mk, wk = st['sl']['mk'], st['sl']['wk']; go = None
            if mk == 'go' and wk == 'go': go = [13.6, 15.6] if FIRST == 'works' else [25.9, 28.9]
            elif EARLY and 'done' in (mk, wk) and (mk, wk) != ('done', 'done') and (mk == 'go' or wk == 'go'):
                d = ((st['pos'][0] - 9.5) ** 2 + (st['pos'][1] - 38.0) ** 2) ** 0.5
                if d > 2.0:
                    if st['path'] == 0: pg.evaluate('__wb.G.walkTo(9.5, 37.9)')
                    pg.wait_for_timeout(500); continue
                if st['target'] == 'home': pg.keyboard.press('e'); pg.wait_for_timeout(700); continue
                pg.evaluate('__wb.G.walkTo(9.5, 37.6)'); pg.wait_for_timeout(400); continue
            if go:
                if st['path'] == 0: pg.evaluate('(a) => __wb.G.walkTo(a[0], a[1])', go)
                pg.wait_for_timeout(500); continue
        # in a room: walk to the spot the objective names and use it, or head out
        if st['loc'] != 'town':
            if st['inside'] == st['loc'] and st['spot']:
                if st['target'] == st['spot']: pg.keyboard.press('e'); pg.wait_for_timeout(500); continue
                if st['path'] == 0: pg.evaluate('__wb.way()')
                pg.wait_for_timeout(400); continue
            pg.evaluate("(() => { const r = __wb.G.rooms[__wb.G.loc]; const o = r.inter.find((i) => i.id === 'out'); __wb.G.walkTo(o.x, o.z); })()"); pg.wait_for_timeout(1200)
            pg.keyboard.press('e'); pg.wait_for_timeout(1500); continue
        # marks to tag: raise the lantern, walk up to the nearest, press E
        if st['sweep']:
            if not st['raised']: pg.keyboard.press('l'); pg.wait_for_timeout(400); continue
            if st['near']:
                # (E tags the mark when it's the thing in reach; with a neighbor standing closer, a player clicks the mark itself)
                if st['tkind'] == 'mark': pg.keyboard.press('e')
                else: pg.evaluate('(id) => __wb.G.marks.tag(id)', st['near'])
                pg.wait_for_timeout(700); continue
            nm = pg.evaluate("(z) => { const m = __wb.G.story.slice.nextMark(z); return m ? [m.at[0], m.at[2] + 1.6] : null; }", st['sweep'])
            if nm and st['path'] == 0: pg.evaluate('(a) => __wb.G.walkTo(a[0], a[1])', nm); pg.wait_for_timeout(500); continue
            pg.wait_for_timeout(200); continue
        if st['raised']: pg.keyboard.press('l'); pg.wait_for_timeout(200); continue
        if st['at']:
            d = ((st['pos'][0] - st['at'][0]) ** 2 + (st['pos'][1] - st['at'][1]) ** 2) ** 0.5
            if d > 2.2 and st['path'] == 0: pg.evaluate('__wb.way()'); pg.wait_for_timeout(400); continue
            if d <= 2.2 and st['target']: pg.keyboard.press('e'); pg.wait_for_timeout(600); continue
            if d <= 2.2: pg.evaluate('(a) => __wb.G.walkTo(a[0], a[1] - 0.6)', st['at']); pg.wait_for_timeout(500); continue
        pg.wait_for_timeout(200)
    pump(pg.evaluate(ST))
    T = pg.evaluate('window.__T'); final = pg.evaluate(ST)
    S = pg.evaluate("(() => { const S = __wb.state(); return { guests: Object.keys(S.guests || {}), cards: Object.keys(S.cards || {}), fixes: S.fixes, hooks: S.hooks || {}, notes: Object.keys(S.notes || {}).length, slice: S.slice, marks: Object.keys(S.marks || {}).length }; })()")
    b.close()

# ---------- the transcript and the numbers ----------
shot_of = {i: n for i, n in shots}
fmt = lambda m: '%d:%02d' % (m // 60, m % 60)
with open(os.path.join(OUT, 'transcript.txt'), 'w') as f:
    for i, e in enumerate(T):
        tag = e['k'] + (':' + e['kind'] if e.get('kind') else '') + (' ' + e['who'] if e.get('who') else '')
        f.write('%3d D%d %5s %-12s %-18s %s%s%s\n' % (i, e['d'], fmt(e['m']), e.get('st') or '-', '[' + tag + ']', e['t'][:600], ('  {' + ' | '.join(e['opts']) + '}') if e.get('opts') else '', ('   <' + shot_of[i] + '>') if i in shot_of else ''))
ctl = next((i for i, e in enumerate(T) if e['k'] == 'control'), len(T))
day1 = [e for e in T if e['d'] <= 1]
def count(pred, xs=day1): return sum(1 for e in xs if pred(e))
READ = ('caption', 'prompt', 'line', 'choice', 'barrier', 'toast', 'markcard', 'text', 'cc', 'bubble', 'pop', 'panel', 'hearing')
# (a panel's words, capped: the creator and the two-picture choices are menus you scan; the day's card is read through)
wc = lambda e: (words(e['t']) if 'daycard' in (e.get('cls') or '') else min(words(e['t']), 70)) if e['k'] == 'panel' else words(e['t']) + sum(words(o) for o in e.get('opts', []))
inp = next((i for i, e in enumerate(T) if e['k'] in ('prompt', 'control') or (e['k'] == 'panel' and 'creator' in (e.get('cls') or ''))), len(T))
audit = {
  'words_total': sum(wc(e) for e in day1 if e['k'] in READ),
  'words_before_first_input': sum(wc(e) for e in T[:inp] if e['k'] in READ),
  'words_before_control': sum(wc(e) for e in T[:ctl] if e['k'] in READ and e.get('kind') != 'thought'),
  'beats_before_control': {k: count(lambda e, k=k: e['k'] == k, T[:ctl]) for k in ('caption', 'prompt', 'panel', 'line', 'choice')},
  'captions': count(lambda e: e['k'] == 'caption'), 'lines': count(lambda e: e['k'] == 'line'),
  'lines_by_kind': {k: count(lambda e, k=k: e['k'] == 'line' and e.get('kind') == k) for k in ('say', 'gut', 'note')},
  'choices': count(lambda e: e['k'] in ('choice', 'barrier')),
  'toasts': count(lambda e: e['k'] == 'toast'), 'toast_words': sum(words(e['t']) for e in day1 if e['k'] == 'toast'), 'pops': count(lambda e: e['k'] == 'pop' and e.get('kind') != 'thought'), 'thoughts': count(lambda e: e['k'] == 'pop' and e.get('kind') == 'thought'), 'pops_with_hook': count(lambda e: e['k'] == 'pop' and e.get('hook')),
  'markcards': count(lambda e: e['k'] == 'markcard'), 'texts': count(lambda e: e['k'] == 'text'),
  'objectives': count(lambda e: e['k'] == 'objective'), 'objectives_that_instruct': count(lambda e: e['k'] == 'objective' and INSTRUCT.match(e['t'])),
  'reading_minutes_at_180wpm': round(sum(wc(e) for e in day1 if e['k'] in READ) / 180, 1),
  'longest_sentence_words': max([len(re.findall(r"[A-Za-z0-9'’]+", x)) for e in day1 if e['k'] in ('caption', 'line', 'objective', 'toast', 'cc') for x in re.split(r'(?<=[.!?])\s+| / ', e['t'])] or [0]),
  'stage_seconds': marks, 'guests': S['guests'], 'state': S, 'errors': errors, 'reached_day_2': final['day'] >= 2,
}
json.dump(T, open(os.path.join(OUT, 'events.json'), 'w'))
json.dump(audit, open(os.path.join(OUT, 'audit.json'), 'w'), indent=1)
print(json.dumps({k: v for k, v in audit.items() if k != 'state'}, indent=1))
if errors or final['day'] < 2: sys.exit(1)
