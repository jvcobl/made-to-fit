# Draw-call budget check. Plays into the busiest scenes with a fixed seed (and a seeded Math.random, so crowds stand in
# the same places every run), reads __wb.perf() over several freshly rendered frames in each, and checks the budgets.
# Then it visits every scene a second time and fails if any shader program compiles after that warm-up, or if starting
# the festival compiles any. Prints a table, then one JSON line with every number; exits 1 on any failure.
# The return visits (Acts 2 and 3) load by a reload, as in the game; each is measured the same way: the square at noon,
# the Works during the shift (Act 2, with Unit), the meeting, and the festival (the arrival shot and the follow camera).
# usage: python3 test/perf.py [high] [low] [--seed N] [--html PATH] [--shots DIR] [--env] [--report] [--act1]
#   --act1      only the first visit (skip Acts 2 and 3)
#   high / low  which quality to measure (default: both, one after the other)
#   --html      the build to measure (default: ../dist/who-bends.html next to this file)
#   --shots     save a screenshot of every scene into DIR
#   --env       also count each scene with every creature hidden (what the rest of the scene costs)
#   --report    print the numbers but never fail (for measuring an older build)
import sys, os, json, time
from playwright.sync_api import sync_playwright

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[1:]
def opt(name, default):
    if name in argv: i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    return default
SEED = int(opt('--seed', 5)); HTML = os.path.abspath(opt('--html', os.path.join(HERE, '..', 'dist', 'who-bends.html'))); SHOTS = opt('--shots', None)
ENV = '--env' in argv; REPORT = '--report' in argv; LATER = [] if '--act1' in argv else [2, 3]
QUALITIES = [a for a in argv if a in ('high', 'low')] or ['high', 'low']
# hall_meeting is the Hall with the meeting's audience (as first measured); hall_council adds the council and every backer
# (the square at noon is the busiest view: its count moves by about five from run to run with the crowd that happens to
# be in it, and the new game's speakers added two; 160 keeps the same guard with room for that)
BUDGET = {'square_noon': 160, 'works_shift': 150, 'hall_meeting': 150, 'hall_council': 150, 'festival_arrival': 200, 'festival_follow': 200, 'festival_fixes': 200}
for n in (2, 3): BUDGET.update({'a%d_square' % n: 160, 'a%d_works' % n: 150, 'a%d_council' % n: 150, 'a%d_festival_arrival' % n: 200, 'a%d_festival_follow' % n: 200})
SAMPLES, GAP_MS = 8, 220

# a seeded Math.random: crowd spots, blink timers and wander targets come out the same on every run
SEED_RANDOM = """(() => { let s = %d >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { localStorage.setItem('whobends.settings', JSON.stringify({ textSpeed: 'instant' })); } catch (e) {} })()"""

# __wb.perf() counts every pass of the last frame; this also splits off the shadow pass and the scene pass, and counts frames
HOOK = """(() => {
  const G = __wb.G, st = G.stage, r = st.renderer; __wb.perf();
  if (st._split) return true; st._split = { main: 0, shadow: 0, frames: 0 };
  const o0 = st.render; st.render = () => { o0(); st._split.frames++; };
  // every pass calls renderer.render, and so the shadow map; only the scene pass has shadow-casting lights
  const rp = st.renderPass, o1 = rp.render.bind(rp); rp.render = (...a) => { st._split.shadow = 0; const c = r.info.render.calls; o1(...a); st._split.main = r.info.render.calls - c - st._split.shadow; };
  const sm = r.shadowMap, o2 = sm.render.bind(sm); sm.render = (...a) => { const c = r.info.render.calls; o2(...a); st._split.shadow += r.info.render.calls - c; };
  return true; })()"""

# creatures drawn in the current scene, and how many use each form (builds without forms count as 'full')
CENSUS = """(() => {
  const G = __wb.G, scene = G.stage.scene; const out = { creatures: 0, forms: {} };
  const shown = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; } return false; };
  scene.traverse((o) => { const c = o.userData && o.userData.creature; if (c && c.root === o && shown(o)) { out.creatures++; const f = c.form || 'full'; out.forms[f] = (out.forms[f] || 0) + 1; } });
  return out; })()"""

# each sample is a freshly rendered frame (the fast test mode draws only every fourth frame, and SwiftShader is slow)
SAMPLE = """async ([n, gap]) => { const G = __wb.G, st = G.stage; const out = []; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < n; i++) {
    await wait(gap); const f0 = st._split.frames; G.forceRender = true; const t0 = performance.now();
    while (st._split.frames < f0 + 2 && performance.now() - t0 < 8000) { G.forceRender = true; await wait(15); }
    const p = __wb.perf(); if (p) out.push({ calls: p.calls, tris: p.tris, programs: p.programs, main: st._split.main, shadow: st._split.shadow });
  }
  return out; }"""

def run(q):
    url = 'file://%s?test=1&v1=1&fast=1&mute=1&seed=%d&q=%s' % (HTML, SEED, q)
    res = {'quality': q, 'scenes': {}, 'errors': []}
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        ctx = b.new_context(viewport={'width': 1280, 'height': 760}, device_scale_factor=1)
        ctx.add_init_script(SEED_RANDOM % (SEED * 7919 + 13))
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: res['errors'].append(str(e)[:300]))
        pg.on('console', lambda m: res['errors'].append(m.text[:300]) if m.type == 'error' else None)
        pg.goto(url); pg.wait_for_function('window.__wb && __wb.G && __wb.panel() !== null', timeout=90000)
        ev = pg.evaluate

        def until(js, timeout=120):
            t0 = time.time()
            while time.time() - t0 < timeout:
                if ev(js): return True
                panel = ev('__wb.panel()') or ''
                if 'title' in panel: ev("document.querySelector('#tNew').click()")
                elif 'creator' in panel: ev("document.querySelector('#done').click()")
                elif 'setup' in panel: ev("document.querySelector('#next').click()")
                elif 'today' in panel: ev("document.querySelector('#tgo').click()")
                elif ev('__wb.waiter()') == 'line': ev('__wb.adv()')
                elif ev('__wb.waiter()') == 'barrier': ev('__wb.choose(4)')
                pg.wait_for_timeout(80)
            raise TimeoutError(js)

        def settle(ms):
            # close anything the story opened, then let the scene run (crowds walk, residents arrive)
            t0 = time.time()
            while (time.time() - t0) * 1000 < ms:
                w = ev('__wb.waiter()')
                if w == 'line': ev('__wb.adv()')
                elif w == 'barrier': ev("__wb.choose(4) || __wb.choose(Math.max(0, __wb.options().findIndex((o) => !o.disabled)))")
                elif w == 'choice': ev("__wb.choose(Math.max(0, __wb.options().findIndex((o) => !o.disabled)))")
                pg.wait_for_timeout(100)

        def measure(name):
            # hold the story (and the clock) still while counting, so nothing opens a card mid-count
            ev('__wb.G.busy++')
            s = pg.evaluate(SAMPLE, [SAMPLES, GAP_MS])
            c = ev(CENSUS)
            calls = [x['calls'] for x in s]; worst = max(s, key=lambda x: x['calls'])
            r = {'calls': max(calls), 'calls_min': min(calls), 'main': worst['main'], 'shadow': worst['shadow'], 'post': worst['calls'] - worst['main'] - worst['shadow'],
                 'tris': worst['tris'], 'programs': max(x['programs'] for x in s), 'creatures': c['creatures'], 'forms': c['forms'], 'budget': BUDGET[name]}
            if SHOTS: pg.screenshot(path=os.path.join(SHOTS, '%s-%s.png' % (q, name)))
            if ENV:
                ev("(() => { const G = __wb.G; G._hid = []; G.stage.scene.traverse((o) => { const c = o.userData && o.userData.creature; if (c && c.root === o) for (const k of o.children) if (k.visible) { k.visible = false; G._hid.push(k); } }); })()")
                e = pg.evaluate(SAMPLE, [3, GAP_MS])
                ev("(() => { for (const o of __wb.G._hid) o.visible = true; })()")
                r['env'] = {'calls': max(x['calls'] for x in e), 'main': max(x['main'] for x in e), 'shadow': max(x['shadow'] for x in e)}
            ev('__wb.G.busy = Math.max(0, __wb.G.busy - 1)')
            return r

        until("__wb.mode() === 'play' && !__wb.busy() && __wb.state().day === 1", 150)
        ev(HOOK)
        progs = lambda: ev('__wb.G.stage.renderer.info.programs.length')

        def visit():
            out = {}
            # Market Square at noon on day 1, the crowd near its peak; the day's stories already handled
            ev("""(() => { const S = __wb.state(); S.day = 1; S.flags.festival = 0; __wb.G.town.setFestival(false); S.flags.escort = 1; S.flags.escort_done = 1; S.flags.shift1 = 1; S.min = 735;
                for (const z of ['market', 'street', 'homerow', 'transit', 'commons', 'farend', 'works', 'hall']) S.handled['1:' + z] = 1;
                if (__wb.loc() !== 'town') __wb.G.setLoc('town'); __wb.tp([30, 30]); })()""")
            settle(3000); ev('__wb.state().min = 735'); out['square_noon'] = measure('square_noon')
            # the Works during the shift: coworkers at their desks, Gil in his office
            ev("(() => { const S = __wb.state(); S.min = 600; __wb.G.run(() => __wb.G.enterRoom('works')); })()")
            until("__wb.loc() === 'works' && !__wb.busy()", 60); settle(1500); ev('__wb.state().min = 600')
            out['works_shift'] = measure('works_shift')
            # the Hall with the meeting's audience on the benches
            ev("(() => { __wb.G.run(async () => { await __wb.G.exitRoom(); await __wb.G.enterRoom('hall'); __wb.G.placeCouncil(); }); })()")
            until("__wb.loc() === 'hall' && !__wb.busy()", 60); settle(1500)
            out['hall_meeting'] = measure('hall_meeting')
            # the town meeting itself (day 3, 6 PM): the council at the dais, all five backers on the benches, you at the lectern
            ev("""(() => { const S = __wb.state(); S.day = 3; S.min = 1080; S.flags.council = 1; S.flags.statue_seen = 1; S.flags.remind = 1; S.handled['3:hall'] = 1;
                S.support = Object.assign({}, S.support, { ramp: ['bea', 'moss', 'wren', 'rue', 'gil'] });
                __wb.G.place(__wb.G.rooms.hall.spots.lectern); __wb.G.placeCouncil(); })()""")
            settle(1500); ev('__wb.state().min = 1080')
            out['hall_council'] = measure('hall_council')
            ev("(() => { __wb.G.run(() => __wb.G.exitRoom()); })()")
            until("__wb.loc() === 'town' && !__wb.busy()", 60); settle(800)
            # the Lantern Festival: the arrival wide shot, then the follow camera in the square
            # first stand in the square at dusk, so everything there (the beacon over the square too) has been drawn
            ev("""(() => { const S = __wb.state(); S.day = 3; S.min = 1190; S.flags.festival = 0; S.flags.council = 1; S.flags.statue_seen = 1; S.flags.remind = 1;
                for (const z of ['market', 'street', 'homerow', 'transit', 'commons', 'farend']) S.handled['3:' + z] = 1; S.handled['3:festival:f'] = 1;
                __wb.G.town.setFestival(false); __wb.G.busy++; __wb.tp([30, 34.5]); })()""")
            settle(1500); ev("__wb.tp([30, 30])"); settle(1500); ev('__wb.state().min = 1190; __wb.G.busy = Math.max(0, __wb.G.busy - 1)')
            before = progs()
            ev("__wb.G.run(() => __wb.G.story.festival())")
            until("__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 90)
            settle(1200); out['_festival_start_programs'] = progs() - before
            # the exact camera the festival opens on (story.festival), held while we count
            ev("""(() => { const G = __wb.G, st = G.stage; G.busy++; G.place([30, 34.5]); G.player.heading = Math.PI;
                st.shot(st.camPos.clone().set(30, 22, 54), st.camLook.clone().set(30, 1, 24), 40, 0.5, true); })()""")
            settle(1500); out['festival_arrival'] = measure('festival_arrival'); ev('__wb.G.busy = Math.max(0, __wb.G.busy - 1)')
            ev("__wb.tp([30, 30])"); settle(2500)
            out['festival_follow'] = measure('festival_follow')
            # the arrival shot again with the fixes you can see from the square built (the quiet corner, the porch
            # lanterns, the ramp, the bus board): a season that went well costs a few more draw calls
            ev("""(() => { const G = __wb.G, st = G.stage; for (const f of ['quiet', 'lanterns', 'ramp', 'board']) G.town.setFix(f, true); G.busy++; G.place([30, 34.5]); G.player.heading = Math.PI;
                st.shot(st.camPos.clone().set(30, 22, 54), st.camLook.clone().set(30, 1, 24), 40, 0.5, true); })()""")
            settle(1500); out['festival_fixes'] = measure('festival_fixes')
            ev("(() => { const G = __wb.G; for (const f of ['quiet', 'lanterns', 'ramp', 'board']) G.town.setFix(f, false); G.busy = Math.max(0, G.busy - 1); })()")
            return out

        res['scenes'] = visit()
        res['programs_after_warmup'] = progs()
        second = visit()  # every scene again: nothing may compile now
        res['programs_end'] = progs()
        res['second_visit_calls'] = {k: v['calls'] for k, v in second.items() if not k.startswith('_')}
        res['second_visit_festival_start_programs'] = second['_festival_start_programs']

        def play_on(js, timeout=150):
            # lines advance, choices and cards take their first open option, the today card starts the day
            t0 = time.time()
            while time.time() - t0 < timeout:
                if ev(js): return True
                w = ev('__wb.waiter()')
                if w == 'line': ev('__wb.adv()')
                elif w in ('choice', 'barrier'): ev("__wb.choose(Math.max(0, __wb.options().findIndex((o) => !o.disabled)))")
                if ev("!!(__wb.panel() && __wb.panel().includes('today'))"): ev("document.querySelector('#tgo').click()")
                pg.wait_for_timeout(80)
            raise TimeoutError(js)

        def later(n):
            # one return visit: the square, the Works (Act 2), the meeting and the festival, with the story held still
            out = {}; P = 'a%d_' % n
            ev("""(() => { const G = __wb.G, S = __wb.state(), R = G.story.ret; G.busy++;
                if (R && R.drone) { R.drone.parent && R.drone.parent.remove(R.drone); R.drone = null; }
                S.flags.festival = 0; G.town.setFestival(false); S.min = 735; G.run2(async () => { if (G.loc !== 'town') await G.exitRoom(); __wb.tp([30, 30]); }); })()""")
            play_on("__wb.loc() === 'town'", 60); settle(3000); ev('__wb.state().min = 735'); out[P + 'square'] = measure(P + 'square')
            if n == 2:
                ev("(() => { const G = __wb.G; __wb.state().min = 600; G.run2(() => G.enterRoom('works')); })()")
                play_on("__wb.loc() === 'works'", 60); settle(2500); ev('__wb.state().min = 600'); out[P + 'works'] = measure(P + 'works')
            # the meeting at six: the council at the dais, five backers on the benches, you at the lectern
            ev("""(() => { const G = __wb.G, S = __wb.state(); S.min = 1080; S.flags.council = 1; S.flags.remind = 1;
                S.support = Object.assign({}, S.support, { _perf: ['bea', 'moss', 'wren', 'gil', 'rue'] });
                G.run2(async () => { if (G.loc !== 'town') await G.exitRoom(); await G.enterRoom('hall'); G.place(G.rooms.hall.spots.lectern); G.placeCouncil(); }); })()""")
            play_on("__wb.loc() === 'hall'", 60); settle(2500); ev('__wb.state().min = 1080'); out[P + 'council'] = measure(P + 'council')
            ev("""(() => { const G = __wb.G, S = __wb.state(); delete S.support._perf; S.min = 1190; S.flags.councilDone = 1; S.flags.decided = 1;
                for (const z of ['market', 'street', 'festival', 'homerow', 'transit', 'commons', 'farend', 'works', 'hall']) S.handled['1:' + z] = 1; S.handled['1:festival:f'] = 1;
                G.run2(async () => { await G.exitRoom(); __wb.tp([30, 34.5]); }); })()""")
            play_on("__wb.loc() === 'town'", 60); settle(1500); ev("__wb.tp([30, 30])"); settle(1500)
            before = progs()
            ev("(() => { const G = __wb.G; __wb.state().min = 1190; G.busy = 0; G.run(() => G.story.festival()); })()")
            play_on("__wb.state().flags.festival && __wb.mode() === 'play' && !__wb.busy()", 90)
            settle(1200); out['_festival_start_programs'] = progs() - before
            ev("""(() => { const G = __wb.G, st = G.stage; G.busy++; G.place([30, 34.5]); G.player.heading = Math.PI;
                st.shot(st.camPos.clone().set(30, 22, 54), st.camLook.clone().set(30, 1, 24), 40, 0.5, true); })()""")
            settle(1500); out[P + 'festival_arrival'] = measure(P + 'festival_arrival')
            ev("__wb.tp([30, 30])"); settle(2500)
            out[P + 'festival_follow'] = measure(P + 'festival_follow'); ev('__wb.G.busy = Math.max(0, __wb.G.busy - 1)')
            return out

        res['later'] = {}
        for n in LATER:
            # Acts 2 and 3 start by a reload (the carry in storage), as in the game
            # (the page is reloaded from here, not from inside the page, so the test waits for exactly that navigation)
            h = ev("__wb.prepAct(%d, { built: ['quiet', 'dim', 'ramp', 'lanterns'] })" % n)
            ev("(h) => { history.replaceState(null, '', location.pathname + location.search + '#' + h); }", h)
            pg.reload(wait_until='load'); pg.wait_for_timeout(1500)
            try: pg.wait_for_function('window.__wb && __wb.G && __wb.ret && __wb.ret()', timeout=150000)
            except Exception:
                print('reload into act %d did not start: url %s; state %s; errors %s' % (n, pg.url, ev("window.__wb && __wb.G ? [__wb.mode(), __wb.busy(), __wb.panel(), __wb.waiter(), __wb.state().act] : 'no game'"), res['errors'][:6]), flush=True)
                raise
            play_on("__wb.mode() === 'play' && !__wb.busy() && !__wb.waiter() && !__wb.panel()", 240)
            ev(HOOK)
            a = later(n); w = progs(); b2 = later(n); e = progs()
            res['later'][n] = {'scenes': a, 'programs_after_warmup': w, 'programs_end': e, 'second_visit_calls': {k: v['calls'] for k, v in b2.items() if not k.startswith('_')},
                               'festival_start': a['_festival_start_programs'], 'festival_start_again': b2['_festival_start_programs']}
        b.close()
    return res

def main():
    allres = [run(q) for q in QUALITIES]
    fail = []; table = {}
    print('\nquality  scene              calls  budget  (min   scene  shadow  post)  creatures  forms                     programs')
    for r in allres:
        q = r['quality']; table[q] = {}
        for k, v in r['scenes'].items():
            if k.startswith('_'): continue
            over = v['calls'] > BUDGET[k]
            table[q][k] = {x: v[x] for x in ('calls', 'budget', 'calls_min', 'main', 'shadow', 'post', 'programs', 'creatures', 'forms')}
            print('%-7s  %-17s  %5d  %6d  (%4d  %5d  %6d  %4d)  %9d  %-24s  %8d  %s' % (q, k, v['calls'], BUDGET[k], v['calls_min'], v['main'], v['shadow'], v['post'], v['creatures'], json.dumps(v['forms'], separators=(',', ':')), v['programs'], 'OVER' if over else 'ok'))
            if over: fail.append('%s %s: %d draw calls > %d' % (q, k, v['calls'], BUDGET[k]))
        for k, v in r['second_visit_calls'].items():
            if v > BUDGET[k]: fail.append('%s %s (second visit): %d draw calls > %d' % (q, k, v, BUDGET[k]))
        grow = r['programs_end'] - r['programs_after_warmup']; fs = r['scenes']['_festival_start_programs']
        table[q]['programs'] = {'after_warmup': r['programs_after_warmup'], 'after_second_visit': r['programs_end'], 'festival_start': fs, 'festival_start_again': r['second_visit_festival_start_programs']}
        print('%-7s  shader programs: %d after warm-up, %d after visiting everything again (+%d); starting the festival compiled %d' % (q, r['programs_after_warmup'], r['programs_end'], grow, fs))
        if grow > 0: fail.append('%s: %d shader programs compiled after warm-up' % (q, grow))
        if fs > 0: fail.append('%s: starting the festival compiled %d shader programs' % (q, fs))
        for n, L in r.get('later', {}).items():
            for k, v in L['scenes'].items():
                if k.startswith('_'): continue
                over = v['calls'] > BUDGET[k]
                table[q][k] = {x: v[x] for x in ('calls', 'budget', 'calls_min', 'main', 'shadow', 'post', 'programs', 'creatures', 'forms')}
                print('%-7s  %-17s  %5d  %6d  (%4d  %5d  %6d  %4d)  %9d  %-24s  %8d  %s' % (q, k, v['calls'], BUDGET[k], v['calls_min'], v['main'], v['shadow'], v['post'], v['creatures'], json.dumps(v['forms'], separators=(',', ':')), v['programs'], 'OVER' if over else 'ok'))
                if over: fail.append('%s %s: %d draw calls > %d' % (q, k, v['calls'], BUDGET[k]))
            # (a later visit's second pass replays noon after the festival, which the game never does: people are still
            # walking back from the festival spots, so its draw calls are reported, not judged; its shader count is)
            sec = {k: v for k, v in L['second_visit_calls'].items() if v > BUDGET[k]}
            if sec: print('%-7s  act %d second pass (not judged): %s' % (q, n, ', '.join('%s %d' % kv for kv in sec.items())))
            g2 = L['programs_end'] - L['programs_after_warmup']
            table[q]['programs_act%d' % n] = {'after_warmup': L['programs_after_warmup'], 'after_second_visit': L['programs_end'], 'festival_start': L['festival_start'], 'festival_start_again': L['festival_start_again']}
            print('%-7s  act %d shader programs: %d after warm-up, %d after visiting everything again (+%d); starting the festival compiled %d, then %d' % (q, n, L['programs_after_warmup'], L['programs_end'], g2, L['festival_start'], L['festival_start_again']))
            if g2 > 0: fail.append('%s act %d: %d shader programs compiled after warm-up' % (q, n, g2))
            if L['festival_start'] > 0: fail.append('%s act %d: starting the festival compiled %d shader programs' % (q, n, L['festival_start']))
        if r['errors']: fail.append('%s: page errors %s' % (q, r['errors'][:3]))
    table['seed'] = SEED; table['pass'] = not fail
    print(json.dumps(table))
    if fail: print('\nFAIL\n  ' + '\n  '.join(fail))
    else: print('\nPASS')
    sys.exit(0 if REPORT or not fail else 1)

main()
