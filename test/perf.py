# Draw-call budget check. Plays into the busiest scenes with a fixed seed (and a seeded Math.random, so crowds stand in
# the same places every run), reads __wb.perf() over several freshly rendered frames in each, and checks the budgets.
# Then it visits every scene a second time and fails if any shader program compiles after that warm-up, or if starting
# the festival compiles any. Prints a table, then one JSON line with every number; exits 1 on any failure.
# usage: python3 test/perf.py [high] [low] [--seed N] [--html PATH] [--shots DIR] [--env] [--report]
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
ENV = '--env' in argv; REPORT = '--report' in argv
QUALITIES = [a for a in argv if a in ('high', 'low')] or ['high', 'low']
# hall_meeting is the Hall with the meeting's audience (as first measured); hall_council adds the council and every backer
BUDGET = {'square_noon': 150, 'works_shift': 150, 'hall_meeting': 150, 'hall_council': 150, 'festival_arrival': 200, 'festival_follow': 200}
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
    url = 'file://%s?test=1&fast=1&mute=1&seed=%d&q=%s' % (HTML, SEED, q)
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
                if 'title' in panel: ev("document.querySelector('#begin').click()")
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
                elif w == 'barrier': ev('__wb.choose(4)')
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
            return out

        res['scenes'] = visit()
        res['programs_after_warmup'] = progs()
        second = visit()  # every scene again: nothing may compile now
        res['programs_end'] = progs()
        res['second_visit_calls'] = {k: v['calls'] for k, v in second.items() if not k.startswith('_')}
        res['second_visit_festival_start_programs'] = second['_festival_start_programs']
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
        if r['errors']: fail.append('%s: page errors %s' % (q, r['errors'][:3]))
    table['seed'] = SEED; table['pass'] = not fail
    print(json.dumps(table))
    if fail: print('\nFAIL\n  ' + '\n  '.join(fail))
    else: print('\nPASS')
    sys.exit(0 if REPORT or not fail else 1)

main()
