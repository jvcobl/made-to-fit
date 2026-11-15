# The first day (slice.js), played start to finish the ways a player can take it: the square first, the Works first,
# and going home for lantern night after only one of them. Each run is a full playthrough by test/storyboard.py (real
# clicks on the room's dots, keys to raise the lantern and tag marks, the porch choice, the two talks in the square,
# the sketch, the hearing, lantern night, the day's card), in fast mode; this file checks what each run left behind.
# Usage: python3 test/slice.py [desktop|phone] [OUTDIR] [seed]
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else 'desktop'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/slice_out'
SEED = sys.argv[3] if len(sys.argv) > 3 else '31'
checks = []
def check(name, ok, info=''):
    checks.append([name, bool(ok), info]); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)[:400]) if info and not ok else ''))

def play(tag, policy='good', **env):
    out = os.path.join(OUT, tag); os.makedirs(out, exist_ok=True)
    e = dict(os.environ, SHOTS=os.environ.get('SHOTS', '0'), **env)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'storyboard.py'), mode, out, SEED, policy, '1'], env=e, capture_output=True, text=True, timeout=1500)
    try: a = json.load(open(os.path.join(out, 'audit.json'))); T = json.load(open(os.path.join(out, 'events.json')))
    except Exception: a = None; T = []
    if a is None or r.returncode != 0: print(r.stdout[-1500:], r.stderr[-1500:])
    return a, T, r.returncode

def said(T, words): return any(words in e['t'] or any(words in o for o in (e.get('opts') or [])) for e in T)
ALL = ['wren', 'bea', 'moss', 'pomeroy', 'rue', 'pip', 'hollis', 'gil']
built = lambda a, f: (a['state']['fixes'] or {}).get(f) == 'built'

# 1. the square first, then the Works, then home
a, T, rc = play('square_first')
ok = a is not None and rc == 0
check('square first: plays through to Tuesday with no page errors', ok and a['reached_day_2'] and not a['errors'], a and a['errors'])
if ok:
    check('  the opening asks you to look closer, then the room is yours to set, then Wren is at the door', said(T, 'Look closer') and said(T, 'Make this room fit you (0/6)') and said(T, 'Make this room fit you (5/6)') and (said(T, 'I only ever knock once') or said(T, 'so I texted first')))
    check('  very little to read before you can first do something', a['words_before_first_input'] <= 12 and a['words_before_control'] <= 140, [a['words_before_first_input'], a['words_before_control']])
    check('  the day opens on two places, and says so', said(T, 'Two places pinch someone you know'))
    check('  in the square you ask Moss, then Pomeroy, and then Clover sketches', said(T, 'Now ask Moss') and said(T, 'Ask Pomeroy') and said(T, 'Let\'s sketch a square where everyone fits'))
    check('  Rue can be asked what Blend costs', said(T, 'What does it cost?') and said(T, 'You pay in attention'))
    check('  Bea knows about the square by the time you reach the Works', said(T, 'Moss says she can hear her own kettle again'))
    check('  all three places changed, and everyone came', all(built(a, f) for f in ('lanterns', 'quiet', 'ramp')) and sorted(a['guests']) == sorted(ALL), [a['state']['fixes'], a['guests']])
    check('  with both done, lantern night starts when you get home', said(T, 'Lantern night starts when you get home'))
    check('  the day\'s card asks the three questions', said(T, 'Who adjusted?') and said(T, 'Who profited?') and said(T, 'Who checked?'))
    check('  no sentence in the day runs past 25 words', a['longest_sentence_words'] <= 25, a['longest_sentence_words'])

# 2. the Works first
a, T, rc = play('works_first', FIRST='works')
ok = a is not None and rc == 0
check('Works first: plays through to Tuesday with no page errors', ok and a['reached_day_2'] and not a['errors'], a and a['errors'])
if ok:
    iw = next((i for i, e in enumerate(T) if 'My cart doesn\'t do steps' in e['t']), -1); im = next((i for i, e in enumerate(T) if 'I can\'t hear my own kettle' in e['t']), -1)
    check('  Bea at the steps comes before Moss at the cart', 0 <= iw < im, [iw, im])
    check('  the square is still at its loudest when you get there (the clock waited)', any(e['k'] == 'barrier' and e['m'] < 840 for e in T), [(e['k'], e['m']) for e in T if e['k'] == 'barrier'])
    check('  Moss knows about the ramp, and Bea doesn\'t mention the kettle', said(T, 'You\'re the one who got Bea her ramp') and not said(T, 'Moss says she can hear her own kettle again'))
    check('  Rue doesn\'t send you to steps that already have a ramp', not said(T, 'Something about steps?'))
    check('  all three places changed, and everyone came', all(built(a, f) for f in ('lanterns', 'quiet', 'ramp')) and sorted(a['guests']) == sorted(ALL), [a['state']['fixes'], a['guests']])

# 3. the square, then home early
a, T, rc = play('early_square', EARLY='1')
ok = a is not None and rc == 0
check('home after the square only: plays through to Tuesday with no page errors', ok and a['reached_day_2'] and not a['errors'], a and a['errors'])
if ok:
    check('  your door asks before the day ends, and says what waits', said(T, 'End the day here?') and said(T, 'Bea is still stuck at the Works steps'))
    check('  the people from the square came; the people the ramp was for did not', sorted(a['guests']) == sorted(['wren', 'bea', 'moss', 'pomeroy', 'rue']), a['guests'])
    check('  the night says who is missing, and why', said(T, 'Pip couldn\'t come'))
    check('  the ramp is not built, and the card says the steps are still waiting', not built(a, 'ramp') and said(T, 'Still waiting: the Works steps'), a['state']['fixes'])

# 4. the Works, then home early
a, T, rc = play('early_works', FIRST='works', EARLY='1')
ok = a is not None and rc == 0
check('home after the Works only: plays through to Tuesday with no page errors', ok and a['reached_day_2'] and not a['errors'], a and a['errors'])
if ok:
    check('  the people the ramp was for came; Moss could not', sorted(a['guests']) == sorted(['wren', 'bea', 'pip', 'hollis', 'gil']) and said(T, 'Moss couldn\'t come'), a['guests'])
    check('  the square is still waiting, and Rue never made her pitch', not built(a, 'quiet') and said(T, 'Still waiting: Market Square') and not said(T, 'Install Blend?'), a['state']['fixes'])

# 5. the other way through the choices: Blend, the rushed sketch, Gil not asked
a, T, rc = play('blend', policy='blend')
ok = a is not None and rc == 0
check('saying yes to Blend and rushing: plays through to Tuesday with no page errors', ok and a['reached_day_2'] and not a['errors'], a and a['errors'])
if ok:
    check('  Blend is installed, and the card counts what it did', (a['state']['slice'] or {}).get('blend') == 'yes', a['state']['slice'])

bad = [c[0] for c in checks if not c[1]]
print(json.dumps({'ok': not bad, 'failed': bad}))
sys.exit(0 if not bad else 1)
