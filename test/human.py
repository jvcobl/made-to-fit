# A playthrough the way a person plays: real clicks, taps and keys, the real game clock, every word on screen written
# to a transcript, and a screenshot of each new screen. It reads the game's state to decide what to do next (the way
# a player reads the screen), but it never teleports, skips or sets anything: it walks with "Show the way" or by
# clicking on people, talks, answers cards and plays tasks (the task's own auto-player stands in for hands).
# usage: python3 test/human.py <desktop|phone> <engaged|pusher|mixed> <outdir> [seed] [acts=1|2|3] [clock=2.5] [page]
import json, sys, time, os, random, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import ARGS

MODE = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
POLICY = sys.argv[2] if len(sys.argv) > 2 else 'engaged'
OUT = sys.argv[3] if len(sys.argv) > 3 else '/tmp/human'
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
ACTS = int(sys.argv[5]) if len(sys.argv) > 5 else 3
CLOCK = float(sys.argv[6]) if len(sys.argv) > 6 else 2.5
PAGE = sys.argv[7] if len(sys.argv) > 7 else 'file:///home/claude/wb4/dist/who-bends.html'
BUDGET = float(os.environ.get('BUDGET', '7200'))
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(SEED)
T0 = time.time()
TRANS = open(os.path.join(OUT, 'transcript.txt'), 'w')
EVENTS = open(os.path.join(OUT, 'events.jsonl'), 'w')
shots = {'n': 0, 'seen': set()}
problems = []
def now(): return round(time.time() - T0, 1)
def say(kind, text):
    TRANS.write('%7.1fs %-8s %s\n' % (now(), kind, text)); TRANS.flush()
def event(**k):
    k['t'] = now(); EVENTS.write(json.dumps(k, default=str) + '\n'); EVENTS.flush()
def problem(text, **k):
    problems.append(text); say('PROBLEM', text); event(kind='problem', text=text, **k)

STATE = """(() => { const w = window.__wb; if (!w || !w.G) return null; const G = w.G, S = G.S; const ov = document.querySelector('#overlay:not([hidden])');
  const ob = G.story && G.story.objective ? G.story.objective() : null;
  const vis = (q) => { const e = document.querySelector(q); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; };
  return { panel: w.panel(), ov: ov ? ov.className : null, waiter: w.waiter(), mode: G.mode, busy: G.busy, mg: w.mg(), loc: G.loc, zone: G.zone,
    day: S.day, min: Math.round(S.min), act: S.act || 1, obj: ob ? ob.t : '', objAt: ob && ob.at ? ob.at : null, inside: ob && ob.inside || null, target: G.target ? G.target.id : null,
    walking: (G.path || []).length > 0, phone: !!G.phoneOpen, way: vis('#wayBtn'), prompt: vis('#prompt') || vis('#actbtn'), energy: Math.round(S.energy), flags: S.flags,
    festival: !!S.flags.festival, released: !!S.flags.released, talked: Object.keys(S.talked || {}), met: Object.keys(S.met || {}), cap: !!document.querySelector('#caption.on') }; })()"""

HOOK = """(() => { if (window.__T) return false; window.__T = []; const ui = __wb.G.ui; const orig = ui.announce.bind(ui);
  ui.announce = (t) => { try { const S = __wb.G.S; window.__T.push([S.day, Math.round(S.min), String(t).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim()]); } catch (e) { /* keep going */ } return orig(t); };
  const cap = ui.caption.bind(ui); ui.caption = (t, ms) => { try { const S = __wb.G.S; window.__T.push([S.day, Math.round(S.min), '[caption] ' + t]); } catch (e) { /* keep going */ } return cap(t, ms); };
  return true; })()"""

def fmt(m): return '%d:%02d' % (m // 60, m % 60)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        if MODE == 'phone': ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        else: ctx = b.new_context(viewport={'width': 1280, 'height': 760}, device_scale_factor=1)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: (errs.append(str(e)[:500]), problem('page error: ' + str(e)[:300])))
        pg.on('console', lambda m: (problem('console error: ' + m.text[:300]) if m.type == 'error' else None))
        url = PAGE + ('&' if '?' in PAGE else '?') + 'test=1&fast=1&mute=1&seed=%d' % SEED + os.environ.get('EXTRA', '')
        pg.goto(url)
        pg.wait_for_function("window.__wb && __wb.G && __wb.panel() !== null", timeout=90000)
        pg.evaluate('localStorage.clear(); sessionStorage.clear()'); pg.reload()
        H = Human(pg, errs)
        try: H.play()
        except Exception as e: problem('driver stopped: ' + repr(e)[:400]); H.snap('zz_driver_stopped', force=True)
        H.flush()
        summary = {'mode': MODE, 'policy': POLICY, 'seed': SEED, 'secs': now(), 'problems': problems, 'reached': H.reached, 'shots': shots['n']}
        json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
        print(json.dumps(summary)[:3000])
        b.close()

class Human:
    def __init__(self, pg, errs):
        self.pg = pg; self.errs = errs; self.reached = []; self.panelSeen = {}; self.lastPanel = None; self.lastChange = time.time()
        self.stuckKey = None; self.picked = {}; self.cardN = 0; self.lastPhone = 0; self.toured = set(); self.lastWay = 0; self.tries = {}
        self.touch = MODE == 'phone'; self.act = 1; self.setupN = 0; self.lastT = 0
    # ---------- seeing ----------
    def st(self):
        for _ in range(40):
            try:
                s = self.pg.evaluate(STATE)
                if s: return s
            except Exception: pass
            self.pg.wait_for_timeout(250)
        raise Exception('the page stopped answering')
    def hook(self):
        try:
            if self.pg.evaluate(HOOK): self.lastT = 0
            self.pg.evaluate("window.__castName || (window.__castName = Object.fromEntries(Object.keys(__wb.G.npcs).map((id) => [id, (__wb.G.npcs[id].name) || id.charAt(0).toUpperCase() + id.slice(1)])))")
            self.pg.evaluate('__wb.G.timeScale = %f' % CLOCK)
        except Exception: pass
    def flush(self):
        try: rows = self.pg.evaluate('window.__T ? window.__T.splice(0) : []')
        except Exception: rows = []
        for d, m, t in rows: say('D%d %s' % (d, fmt(m)), t)
    def snap(self, name, force=False):
        key = re.sub(r'\d+$', '', name)
        if not force and key in shots['seen']: return
        shots['seen'].add(key); shots['n'] += 1
        try:
            self.pg.evaluate('__wb.G && (__wb.G.forceRender = true)'); self.pg.wait_for_timeout(250)
            path = os.path.join(OUT, '%03d_%s.png' % (shots['n'], re.sub(r'[^a-z0-9_]+', '_', name.lower())[:60]))
            self.pg.screenshot(path=path); event(kind='shot', path=path)
        except Exception as e: problem('screenshot failed: ' + str(e)[:200])
    # ---------- hands ----------
    def click(self, sel, nth=0):
        loc = self.pg.locator(sel).nth(nth)
        try:
            loc.scroll_into_view_if_needed(timeout=3000)
            if self.touch: loc.tap(timeout=5000)
            else: loc.click(timeout=5000)
            return True
        except Exception as e:
            problem('could not press %s: %s' % (sel, str(e).split('\n')[0][:200])); return False
    def key(self, k): self.pg.keyboard.press(k)
    def text_of(self, sel):
        try: return self.pg.inner_text(sel)
        except Exception: return ''
    # ---------- the loop ----------
    def play(self):
        last = None; stuck_since = time.time()
        while time.time() - T0 < BUDGET:
            self.hook(); self.flush()
            s = self.st()
            sig = json.dumps([s['panel'], s['ov'], s['waiter'], s['mode'], s['busy'], s['mg'], s['loc'], s['min'] // 3, s['walking'], s['obj']])
            if sig != last: last = sig; stuck_since = time.time()
            elif time.time() - stuck_since > 75:
                problem('nothing changed for 75 s', state={k: s[k] for k in ('panel', 'ov', 'waiter', 'mode', 'busy', 'mg', 'loc', 'zone', 'min', 'obj', 'target')})
                self.snap('stuck_%d' % int(now()), force=True); stuck_since = time.time()
                self.unstick(s)
            done = self.step(s)
            if done: return
            self.pg.wait_for_timeout(90)
        problem('ran out of time budget')
    def unstick(self, s):
        # what a person does when nothing happens: press Space, then Escape, then click the middle of the screen
        k = self.tries.get('unstick', 0); self.tries['unstick'] = k + 1
        if k % 3 == 0: self.key('Space')
        elif k % 3 == 1: self.key('Escape')
        else: self.pg.mouse.click(640 if not self.touch else 195, 380)
    def step(self, s):
        if s['ov']: self.overlay(s); return False
        if s['panel']: return self.panel(s)
        if s['mg']: self.task(s); return False
        if s['waiter'] == 'line': self.pg.wait_for_timeout(rnd.randint(150, 400)); self.key('Space') if not self.touch else self.click('#dialog'); return False
        if s['waiter'] == 'choice': self.choice(s); return False
        if s['waiter'] == 'barrier': self.card(s); return False
        if s['cap']: return False
        if s['mode'] == 'play' and not s['busy']: self.roam(s)
        return False
    # ---------- overlays: comfort check, menus, codes ----------
    def overlay(self, s):
        name = s['ov']; txt = self.text_of('#overlay')
        if self.panelSeen.get('ov:' + name) != txt[:200]: self.panelSeen['ov:' + name] = txt[:200]; say('OVERLAY', name + ' | ' + txt.replace('\n', ' / ')[:1500]); self.snap('ov_' + name.replace('ov ', ''))
        if 'comfort' in name: self.click('#cGo'); return
        if 'code' in name and self.pg.locator('#overlay #nm').count():
            self.click('#overlay #nm'); self.pg.keyboard.type('Jamie'); self.click('#overlay #nOk'); return
        if 'confirm' in name: self.click('#overlay #yYes'); return
        if self.pg.locator('#overlay [data-back]').count(): self.click('#overlay [data-back]'); return
        self.key('Escape')
    # ---------- panels ----------
    def panel(self, s):
        cls = s['panel']; txt = self.text_of('#panel')
        if self.panelSeen.get(cls) != txt[:300]:
            self.panelSeen[cls] = txt[:300]; say('PANEL', cls + ' | ' + txt.replace('\n', ' / ')[:2500]); self.snap('panel_' + cls.replace('panel', '').strip().replace(' ', '_') + '_d%d' % s['day'])
        if 'title' in cls: return self.title(s)
        if 'creator' in cls: self.creator(); return False
        if 'setup' in cls: self.setup(); return False
        if 'ending' in cls: return self.ending(s)
        if 'standard' in cls: self.standard(); return False
        if 'recap' in cls: self.click('#rdone') if self.pg.locator('#panel #rdone').count() else (self.click('#rrand'), self.click('#rgo')); return False
        if 'decided' in cls:
            if self.pg.locator('#panel #dnext').count(): self.pg.wait_for_timeout(600); self.click('#panel #dnext')
            elif self.pg.locator('#panel .choice').count(): self.click('#panel .choice', rnd.randrange(self.pg.locator('#panel .choice').count()))
            return False
        for sel in ('#tgo', '#sleep', '#pck', '#done', '#go', '#sdone'):
            if self.pg.locator('#panel ' + sel).count():
                if sel == '#done' and 'Moss' in txt and POLICY == 'engaged' and not self.tries.get('bought'):
                    self.tries['bought'] = 1; b = self.pg.locator('#panel [data-buy="headphones"]:not([aria-disabled="true"])')
                    if b.count(): self.click('#panel [data-buy="headphones"]'); self.snap('panel_shop_bought'); return False
                self.pg.wait_for_timeout(500); self.click('#panel ' + sel); return False
        problem('a panel with no button I know: ' + cls); self.key('Escape'); return False
    def title(self, s):
        if 'title' not in self.reached: self.reached.append('title')
        if self.pg.evaluate("!!sessionStorage.getItem('mtf.next')"): return False
        if not self.tries.get('titletour'):
            self.tries['titletour'] = 1
            for b in ('#tSet', '#tIng', '#tIn', '#tPb'):
                self.click('#panel ' + b); self.pg.wait_for_timeout(500)
                say('OVERLAY', b + ' | ' + self.text_of('#overlay').replace('\n', ' / ')[:2000]); self.snap('title_' + b[1:], force=True)
                self.key('Escape'); self.pg.wait_for_timeout(300)
                if self.pg.locator('#overlay:not([hidden])').count(): self.key('Escape'); self.pg.wait_for_timeout(300)
        for b in ('#tCont', '#tRet', '#tNew'):
            if self.pg.locator('#panel ' + b).count(): self.click('#panel ' + b); return False
        return False
    def creator(self):
        if self.tries.get('creator'): self.click('#done'); return
        self.tries['creator'] = 1; pg = self.pg
        self.click('#cname'); pg.keyboard.press('Control+A'); pg.keyboard.type('Jamie', delay=60)
        col = pg.evaluate("(() => { const e = document.querySelector('#cname'); const s = getComputedStyle(e); return [s.color, s.backgroundColor, e.value]; })()")
        say('CHECK', 'name box colours ' + json.dumps(col))
        if col[0] == col[1]: problem('typed name is invisible: ' + json.dumps(col))
        for q in ['[data-k=shape] [data-v=spiky]', '[data-k=color] [data-v="#9fd3b0"]', '[data-k=pattern] [data-v=spots]', '[data-k=top] [data-v=horns]', '[data-k=wear] [data-v=glasses]', '[data-k=comfort] [data-v=rock]']:
            self.click('.creator ' + q); pg.wait_for_timeout(250)
        self.snap('creator_filled', force=True)
        self.click('#done')
    def setup(self):
        self.setupN += 1; n = self.pg.locator('.scale button').count()
        idx = [1, 3, 0, 2, 4, 1][(self.setupN - 1) % 6] if n == 5 else 0
        self.click('.scale button', idx); self.pg.wait_for_timeout(300)
        if self.setupN <= 6: self.snap('setup_%d' % self.setupN, force=True)
        self.click('#next')
    def standard(self):
        # two tries by feel, then the clues read properly (a person who works it out)
        k = self.tries.get('std', 0); self.tries['std'] = k + 1
        if not self.pg.locator('#panel #scheck').count(): self.click('#panel #sdone'); return
        ans = self.pg.evaluate("__wb.G.look.rows().map((r) => r.answer)")
        chips = self.pg.locator('#panel .srow2 .chips')
        for i in range(chips.count()):
            opts = chips.nth(i).locator('[data-v]:not([aria-disabled="true"])')
            if not opts.count(): continue
            j = rnd.randrange(opts.count()) if k < 2 else None
            target = chips.nth(i).locator('[data-v="%d"]' % ans[i]) if j is None else opts.nth(j)
            try: (target.tap() if self.touch else target.click()); self.pg.wait_for_timeout(120)
            except Exception as e: problem('standard pick failed: ' + str(e)[:120])
            chips = self.pg.locator('#panel .srow2 .chips')
        self.click('#panel #scheck'); self.pg.wait_for_timeout(500)
        say('PANEL', 'standard after check | ' + self.text_of('#panel').replace('\n', ' / ')[:600])
        if k >= 4 and self.pg.locator('#panel #sdone').count(): self.click('#panel #sdone')
    def ending(self, s):
        name = 'ending_act%d' % s['act']
        if name in self.reached: return False
        self.reached.append(name); self.pg.wait_for_timeout(1500)
        self.snap(name, force=True)
        say('ENDING', self.text_of('#panel').replace('\n', ' / ')[:4000])
        self.click('#panel #notes'); self.pg.wait_for_timeout(800); self.snap(name + '_notes', force=True)
        say('NOTES', self.text_of('#noteslist').replace('\n', ' / ')[:6000])
        self.click('#panel #card')
        try: self.pg.wait_for_function("!!document.querySelector('#cardbox img')", timeout=30000); self.pg.evaluate("document.querySelector('#cardbox').scrollIntoView()"); self.snap(name + '_card', force=True)
        except Exception: problem('fit card did not draw')
        if s['act'] >= ACTS or s['act'] >= 3: return True
        self.act = s['act'] + 1
        self.click('#panel #next'); self.pg.wait_for_timeout(3000)
        return False
    # ---------- talk ----------
    def choice(self, s):
        opts = self.pg.evaluate('__wb.options()')
        prompt = self.text_of('#dialog .text')
        say('CHOICE', prompt[:300] + ' || ' + ' | '.join(('(x) ' if o['disabled'] else '') + o['t'] for o in opts))
        self.snap('choice_%s' % (s['loc']))
        en = [i for i, o in enumerate(opts) if not o['disabled']]
        if not en: problem('a choice with every option disabled: ' + prompt[:120]); self.key('Escape'); return
        pick = self.pick_choice(opts, en, s)
        say('PICK', opts[pick]['t'])
        if self.touch: self.click('#dialog .choice', pick)
        else: self.click('#dialog .choice', pick)
    def pick_choice(self, opts, en, s):
        texts = [o['t'] for o in opts]
        if POLICY == 'pusher':
            for i in en:
                if re.search(r'Install|Blend suggests|OK|Fine|Sure', texts[i]): return i
            return en[0]
        pri = ['Yes, I can do that', 'Yes. I would like', 'I will find you', 'How are you, though, really', 'Can I help', 'That sounds lonely', 'Ask what they mean', 'What helps', 'to back the', 'Show Gil', 'Present the', 'Change the design', 'Do you ever turn it off', 'What if the market', 'Can I see', 'Does it fit you', 'Note it', 'Teach it', 'Walk with', 'Disclose', 'Yes']
        if POLICY == 'mixed' and rnd.random() < 0.35: return rnd.choice(en)
        for key in pri:
            for i in en:
                if key.lower() in texts[i].lower(): return i
        return en[0] if rnd.random() < 0.6 else rnd.choice(en)
    def card(self, s):
        self.cardN += 1
        desc = self.text_of('#barrier')
        say('CARD', desc.replace('\n', ' / ')[:1500])
        self.snap('card_%s' % s['zone'])
        opts = self.pg.evaluate('__wb.options()'); keys = [o['key'] for o in opts]; en = [o['key'] for o in opts if not o['disabled']]
        if POLICY == 'pusher': order = ['bend', 'gear', 'leave']
        elif POLICY == 'mixed': order = rnd.sample(['bend', 'gear', 'ask', 'fix', 'leave'], 5)
        else: order = [['ask', 'fix', 'gear', 'bend', 'leave'], ['fix', 'ask', 'gear', 'bend'], ['gear', 'ask', 'fix', 'bend'], ['bend', 'ask'], ['leave', 'ask']][self.cardN % 5]
        pick = next((k for k in order if k in en), en[0] if en else keys[0])
        say('PICK', 'card: ' + pick)
        i = keys.index(pick)
        if self.touch: self.click('#barrier .opt', i)
        else:
            loc = self.pg.locator('#barrier .opt').nth(i)
            try: loc.hover(timeout=3000); self.pg.mouse.down(); self.pg.wait_for_timeout(1300); self.pg.mouse.up()
            except Exception as e: problem('card press failed: ' + str(e)[:150])
    # ---------- tasks ----------
    def task(self, s):
        name = s['mg']
        if self.pg.locator('.mg-over .go').count() and self.pg.locator('.mg-intro').count():
            say('TASK', name + ' intro | ' + self.text_of('.mg-intro').replace('\n', ' / ')[:1200]); self.snap('task_%s_intro' % name)
            self.click('.mg-over .go'); return
        if self.pg.locator('.mg-result').count():
            self.pg.wait_for_timeout(500); say('TASK', name + ' result | ' + self.text_of('.mg-result').replace('\n', ' / ')[:1200]); self.snap('task_%s_result' % name)
            if self.pg.locator('.mg-result .go').count(): self.click('.mg-result .go')
            return
        if self.pg.locator('.mg-visit').count(): self.snap('task_%s_visitor' % name)
        self.snap('task_%s_play' % name)
        self.pg.evaluate('__wb.mgAuto(%f)' % (0.85 if POLICY != 'mixed' else 0.6))
    # ---------- free play ----------
    def roam(self, s):
        pg = self.pg
        if s['act'] != self.act: self.act = s['act']
        key = 'play_d%d_%s' % (s['day'], s['loc'])
        self.snap('play_a%d_d%d_%s' % (s['act'], s['day'], s['loc']))
        # now and then, look at the phone like a person checks it
        if time.time() - self.lastPhone > 150 and not s['festival']:
            self.lastPhone = time.time(); self.phone(s); return
        if s['walking']: return
        if s['prompt'] and s['target']:
            t = s['target']; npc = pg.evaluate("(t) => !!__wb.G.npcs[t]", t)
            if t == 'out': press = s['inside'] != s['loc']
            elif s['inside'] and t == s['inside']: press = True
            elif t == 'mydesk': press = 'desk' in s['obj'] or 'sync' in s['obj']
            elif npc: tk = 'npc:%d:%d:%s:%d' % (s['act'], s['day'], t, s['min'] // 180); press = self.tries.get(tk, 0) < 1 or (t.capitalize() in s['obj'] and self.tries.get(tk, 0) < 4); self.tries[tk] = self.tries.get(tk, 0) + 1
            else: tk = 'thing:%d:%d:%s' % (s['act'], s['day'], t); press = self.tries.get(tk, 0) < 1 or (s['objAt'] is not None and self.near_obj(s)); self.tries[tk] = self.tries.get(tk, 0) + 1
            if press:
                say('DO', 'press E at %s (objective: %s)' % (t, s['obj']))
                if self.touch: self.click('#actbtn')
                else: self.key('e')
                return
        # inside a room with nothing to do: leave by walking out (the door) or pressing E at the door
        if s['loc'] in ('works', 'hall') and not s['inside']:
            if self.tries.get('exit_' + str(s['min'] // 30), 0) < 1:
                self.tries['exit_' + str(s['min'] // 30)] = 1; pg.evaluate('__wb.G.showWay()'); return
        # the objective names someone: walk up to them by clicking on them, when they are on screen
        if s['objAt'] and time.time() - self.lastWay > 4:
            pt = pg.evaluate("""(() => { const G = __wb.G; const ob = G.story.objective(); if (!ob || !ob.label) return null; const cam = G.stage.camera;
              for (const [id, n] of Object.entries(G.npcs)) { if (!n.c.root.visible || n.c.root.parent !== G.player.root.parent || n.c.name !== ob.label && (window.__castName || {})[id] !== ob.label) continue;
                const p = G.player.root.position, q = n.c.root.position; if (Math.hypot(p.x - q.x, p.z - q.z) > 9) return null;
                const v = q.clone(); v.y += 0.8; v.project(cam); if (v.z > 1 || Math.abs(v.x) > 0.9 || Math.abs(v.y) > 0.85) return null;
                return { id, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
              return null; })()""")
            if pt and s['target'] != pt['id']:
                self.lastWay = time.time(); say('DO', 'click on ' + pt['id'] + ' (named in the objective)')
                (pg.touchscreen.tap(pt['x'], pt['y']) if self.touch else pg.mouse.click(pt['x'], pt['y'])); return
        if (s['objAt'] or s['way']) and time.time() - self.lastWay > 4:
            self.lastWay = time.time()
            if s['way']:
                say('DO', 'Show the way: ' + s['obj']); self.click('#wayBtn')
                k = 'way:' + s['obj']; self.tries[k] = self.tries.get(k, 0) + 1
                if self.tries[k] in (8, 30): problem('pressed Show the way %d times for: %s' % (self.tries[k], s['obj'])); self.snap('stuck_way_%d' % int(now()), force=True)
                return
        # no objective target: walk up to someone not talked to today, by clicking on them
        if time.time() - self.lastWay > 4:
            self.lastWay = time.time()
            pt = pg.evaluate("""(() => { const G = __wb.G, S = G.S; const cam = G.stage.camera; const out = [];
              for (const [id, n] of Object.entries(G.npcs)) { if (!n.c.root.visible || n.c.root.parent !== G.player.root.parent || (S.talked || {})[id]) continue;
                const v = n.c.root.position.clone(); v.y += 0.8; v.project(cam); if (v.z > 1 || Math.abs(v.x) > 0.9 || Math.abs(v.y) > 0.85) continue;
                out.push({ id, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }); }
              return out[0] || null; })()""")
            if pt: say('DO', 'click on ' + pt['id']); (pg.touchscreen.tap(pt['x'], pt['y']) if self.touch else pg.mouse.click(pt['x'], pt['y'])); return
            # nobody in view: walk somewhere else in town (click on the ground ahead)
            W, Hh = pg.viewport_size['width'], pg.viewport_size['height']
            x, y = rnd.randint(int(W * 0.2), int(W * 0.8)), rnd.randint(int(Hh * 0.35), int(Hh * 0.6))
            (pg.touchscreen.tap(x, y) if self.touch else pg.mouse.click(x, y))
    def near_obj(self, s):
        try: return self.pg.evaluate("(a) => { const p = __wb.G.player.root.position; return Math.hypot(p.x - a[0], p.z - a[1]) < 2.2; }", s['objAt'])
        except Exception: return False
    def phone(self, s):
        say('DO', 'open the phone')
        if self.touch: self.click('#phoneBtn')
        else: self.key('p')
        self.pg.wait_for_timeout(600)
        if not self.pg.locator('#phone:not([hidden])').count(): problem('phone did not open'); return
        tabs = self.pg.locator('#phone .tabs button')
        for i in range(tabs.count()):
            name = tabs.nth(i).inner_text().strip().replace('\n', ' ')
            k = 'a%d_d%d_%s' % (s['act'], s['day'], name)
            if k in self.toured: continue
            self.toured.add(k)
            self.click('#phone .tabs button', i); self.pg.wait_for_timeout(400)
            say('PHONE', name + ' | ' + self.text_of('#phone .body').replace('\n', ' / ')[:1500])
            self.snap('phone_%s_a%d_d%d' % (name, s['act'], s['day']), force=True)
        self.key('Escape') if not self.touch else self.click('#phone .close')
        self.pg.wait_for_timeout(300)

if __name__ == '__main__':
    main()
