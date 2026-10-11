# Plays a whole season in headless Chromium with a scripted strategy. Prints a JSON summary.
import json, sys, time, random
from playwright.sync_api import sync_playwright
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
PROFILES = {
  'sens': {'light': 0.1, 'sound': 0.1, 'people': 0.9, 'talk': 0.1, 'time': 0.9, 'change': 0.1},
  'std': {'light': 0.5, 'sound': 0.5, 'people': 0.5, 'talk': 0.5, 'time': 0.5, 'change': 0.5},
  'lively': {'light': 0.9, 'sound': 0.9, 'people': 0.1, 'talk': 0.9, 'time': 0.1, 'change': 0.9},
}
SETUP_DIM = ['light', 'sound', 'people', 'talk', 'time', 'change']
def run(policy, seed, prof, wheels=False, shots=None, mobile=False, budget=420):
    t0 = time.time(); rnd = random.Random(seed); errors = []; taken = set(); out = {'policy': policy, 'profile': prof + ('+wheels' if wheels else ''), 'seed': seed}
    plan = {'talked': {}, 'step': 0}
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        vp = {'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 760}
        pg = b.new_page(viewport=vp, device_scale_factor=1)
        pg.on('console', lambda m: errors.append(m.type + ': ' + m.text[:300]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)[:600]))
        pg.goto('file:///home/claude/wb4/dist/who-bends.html?test=1&fast=1&mute=1&seed=%d' % seed)
        pg.wait_for_function('window.__wb && __wb.panel() !== null', timeout=60000)
        def snap(name, force=False):
            if shots and (name not in taken or force):
                taken.add(name); pg.evaluate('__wb.G.forceRender = true'); pg.wait_for_timeout(120); pg.screenshot(path='%s/%s.png' % (shots, name))
        setup_i = 0
        while time.time() - t0 < budget:
            pg.wait_for_timeout(60)
            try:
                st = pg.evaluate("(() => { const s = __wb.state(); return { panel: __wb.panel(), waiter: __wb.waiter(), mode: __wb.mode(), busy: __wb.busy(), loc: __wb.loc(), zone: __wb.zone(), day: s.day, min: s.min, target: __wb.target(), smooth: s.blend.smooth, has: s.blend.has, flags: s.flags } })()")
            except Exception as e:
                errors.append('eval ' + str(e)[:200]); continue
            panel = st['panel'] or ''
            if 'title' in panel:
                snap('00-title'); pg.evaluate("document.querySelector('#tNew').click()"); continue
            if 'creator' in panel:
                pg.wait_for_timeout(300); snap('01-creator')
                if prof == 'sens': pg.evaluate("""['[data-k=shape] [data-v=spiky]','[data-k=color] [data-v=\"#f6cf5b\"]','[data-k=wear] [data-v=flower]','[data-k=top] [data-v=none]'].forEach(q => document.querySelector(q).click())""")
                if wheels: pg.evaluate("document.querySelector('[data-k=wheels] [data-v=wheels]').click()")
                pg.evaluate("document.querySelector('#done').click()"); continue
            if 'setup' in panel:
                dim = SETUP_DIM[setup_i % 6]; v = PROFILES[prof][dim]; idx = min(4, int(round(v * 5 - 0.5)))
                if setup_i == 0: snap('02-setup')
                pg.evaluate("document.querySelectorAll('.scale button')[%d].click(); document.querySelector('#next').click()" % idx); setup_i += 1; continue
            if 'ending' in panel:
                pg.wait_for_timeout(1200); snap('30-ending'); pg.evaluate("document.querySelector('#notes').click()"); pg.wait_for_timeout(300); snap('31-notes')
                out['ending'] = pg.evaluate("document.querySelector('.ending h1').innerText"); break
            mg = pg.evaluate('__wb.mg && __wb.mg()')
            if mg:
                snap('15-mg-' + mg); pg.evaluate('__wb.mgAuto(%f)' % (0.9 if policy != 'random' else rnd.random())); pg.wait_for_timeout(200); continue
            if 'center' in panel:
                txt = pg.inner_text('#panel')
                if 'Moss' in txt and policy == 'fixer':
                    for k in ('headphones', 'shades'):
                        el = pg.query_selector('[data-buy=%s]:not([disabled])' % k)
                        if el: el.evaluate('e => e.click()'); pg.wait_for_timeout(100)
                    snap('12-shop')
                pg.evaluate("(() => { const g = document.querySelector('#panel #go') || document.querySelector('#panel #tgo') || document.querySelector('#panel #sleep'); if (g) g.click(); })()"); pg.wait_for_timeout(150)
                pg.evaluate("(() => { const d = document.querySelector('#panel #done') || document.querySelector('#panel #go'); if (d) d.click(); })()")
                continue
            w = st['waiter']
            if w == 'line':
                pg.evaluate('__wb.adv()'); pg.evaluate('__wb.adv()'); continue
            if w == 'choice':
                opts = pg.evaluate('__wb.options()')
                if st['loc'] == 'town' and st['day'] >= 1: snap('10-talk-d%d' % st['day'])
                texts = [o['t'] for o in opts]; pick = 0
                if policy == 'blender':
                    for i, t in enumerate(texts):
                        if 'Install' in t or 'Blend suggests' in t: pick = i; break
                elif policy in ('fixer', 'asker'):
                    pri = ['to back the', 'Show Gil', 'Change the design', 'Present the', 'Yes, I can do that', 'Ask what they mean', 'Yes. I would like', 'Do you ever turn it off', 'I will find you', 'What helps', 'It helps more people', 'Can I see', 'Can I help', 'They give me one too', 'I like specific', 'Does it fit you', 'He did not say', 'How do I get', 'Note it', 'What if the market']
                    found = False
                    for key in pri:
                        for i, t in enumerate(texts):
                            if key in t and not opts[i]['disabled']: pick = i; found = True; break
                        if found: break
                else: pick = rnd.randrange(len(opts))
                while opts[pick]['disabled']: pick = (pick + 1) % len(opts)
                pg.evaluate('__wb.choose(%d)' % pick); continue
            if w == 'barrier':
                opts = pg.evaluate('__wb.options()'); snap('11-barrier')
                keys = [o['key'] for o in opts]; en = [o['key'] for o in opts if not o['disabled']]
                order = {'fixer': ['fix', 'gear', 'ask', 'bend'], 'blender': ['bend'], 'leaver': ['leave'], 'asker': ['ask', 'gear', 'leave']}.get(policy, None)
                choice = None
                if order:
                    for k in order:
                        if k in en: choice = k; break
                if not choice: choice = rnd.choice(en)
                pg.evaluate('__wb.choose(%d)' % keys.index(choice)); continue
            if st['mode'] != 'play' or st['busy'] or w: continue
            # free roam: decide where to go
            day, mn, loc = st['day'], st['min'], st['loc']
            if policy == 'blender' and st['has'] and not st['smooth']:
                pg.evaluate('__wb.G.setSmooth(true)')
            if loc != 'town' and loc != 'home':
                pg.evaluate('__wb.tp("works") ; 0') if False else None
            if loc == 'works' and pg.evaluate('__wb.G.story.shiftOpen()'):
                pg.evaluate("__wb.G.place(__wb.G.rooms.works.spots.mydesk)"); pg.wait_for_timeout(250)
                if pg.evaluate('__wb.target()') == 'mydesk': pg.evaluate('__wb.act()')
                continue
            if loc in ('works', 'hall'):
                pg.evaluate("__wb.G.exitRoom()"); pg.wait_for_timeout(400); continue
            if loc == 'home':
                if day >= 1 and mn < 1260:
                    pg.evaluate("__wb.G.exitRoom()"); pg.wait_for_timeout(400); continue
            snap('05-town-d%d' % day)
            if day in (1, 2) and 482 <= mn < 660 and not st['flags'].get('shift%d' % day) and plan.get('worksTries%d' % day, 0) < 6:
                plan['worksTries%d' % day] = plan.get('worksTries%d' % day, 0) + 1
                pg.evaluate("__wb.tp([12, 13.4])")
                for _k in range(10):
                    pg.wait_for_timeout(150)
                    if pg.evaluate('__wb.target()') == 'works': pg.evaluate('__wb.act()'); break
                continue
            if day == 1 and 1030 <= mn < 1068 and not st['flags'].get('busEvent'):
                pg.evaluate("__wb.tp([53.4, 25.6])"); pg.wait_for_timeout(200); continue
            if st['flags'].get('festival'):
                snap('20-festival')
                if not plan.get('festTalk'):
                    plan['festTalk'] = 1; dots = pg.evaluate('__wb.G.npcDots()')
                    if dots:
                        d0 = dots[0]; pg.evaluate("__wb.tp([%f, %f])" % (d0['x'] + 0.8, d0['z'] + 0.9)); pg.wait_for_timeout(150); pg.evaluate('__wb.act()'); continue
                pg.evaluate("__wb.tp([30, 26.4])"); pg.wait_for_timeout(150); pg.evaluate('__wb.act()'); continue
            if mn >= 1250:
                pg.evaluate("__wb.tp([9.5, 37.6])"); pg.wait_for_timeout(150); pg.evaluate('__wb.act()'); continue
            # visit residents in town who have not been talked to today
            dots = pg.evaluate("__wb.G.npcDots().map(d => Object.assign(d, { id: Object.keys(__wb.G.npcs).find(k => __wb.G.npcs[k].c.root.position.x === d.x && __wb.G.npcs[k].c.root.position.z === d.z) }))")
            talked = pg.evaluate('Object.keys(__wb.state().talked)')
            todo = [d for d in dots if d['id'] and d['id'] not in talked]
            if policy == 'blender': todo = [d for d in todo if d['id'] in ('rue', 'moss', 'pip')] or []
            if todo:
                d0 = todo[0]; pg.evaluate("__wb.tp([%f, %f])" % (d0['x'] + 0.7, d0['z'] + 0.9)); pg.wait_for_timeout(150)
                tgt = pg.evaluate('__wb.target()')
                if tgt: pg.evaluate('__wb.act()')
                else: pg.evaluate("__wb.tp([%f, %f])" % (d0['x'] - 0.8, d0['z'] + 0.6)); pg.wait_for_timeout(120); pg.evaluate('__wb.act()')
                continue
            spots = ['square', 'commons', 'farend', 'transit', 'street', 'mainW']
            pg.evaluate("__wb.tp(%s)" % json.dumps(spots[plan['step'] % len(spots)])); plan['step'] += 1
            pg.wait_for_timeout(500); pg.evaluate('__wb.skip(20)')
        out['last'] = pg.evaluate("(() => [__wb.mode(), __wb.busy(), __wb.waiter(), __wb.panel(), __wb.loc(), __wb.zone(), __wb.target()])()")
        S = pg.evaluate("(() => { const s = __wb.state(); return { day: s.day, min: Math.round(s.min), self: Math.round(s.self), energy: Math.round(s.energy), blend: s.blend.score, fixes: s.fixes, support: s.support, stats: s.stats, burnout: s.burnoutDays, coins: s.coins, bonds: s.bonds, flags: Object.keys(s.flags).filter(k => /shift|missed|late|statue|hollis|wren_inv|rue_/.test(k)), lantern: Object.fromEntries(Object.entries(s.lantern.entries).map(([k, e]) => [k, e.result || e.pending])) } })()")
        out.update(S); out['secs'] = round(time.time() - t0); out['errors'] = errors[:6]
        b.close()
    return out
if __name__ == '__main__':
    a = sys.argv[1:]
    print(json.dumps(run(a[0], int(a[1]), a[2], wheels=len(a) > 3 and a[3] == 'wheels', shots=a[4] if len(a) > 4 and a[4] != '-' else None, mobile=len(a) > 5 and a[5] == 'mobile')))
