#!/usr/bin/env python3
"""Fit card test (src/fitcard.js) in headless Chromium.

Renders the four sample cards in test/fitcard.html, saves them as PNGs, renders a few stress cards, walks every branch
of saveFitCard against a mocked window.claude, and fails on any console error from the page.

  python3 test/fitcard.py            stand-in creature portraits drawn by the test page (fast)
  python3 test/fitcard.py --game     real portraits rendered by dist/who-bends.html first (build it before)
  python3 test/fitcard.py --out DIR  where the PNGs go

The page is served by a local static server on a free port (module imports do not work from file://). The only
outside requests are the Google Fonts the page links, as the game does; offline, the cards fall back to system fonts.
"""
import argparse, base64, functools, http.server, json, os, struct, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/tmp/claude-0/-home-claude/cfac4721-fa9f-5c02-916d-61cf7c10d7ce/scratchpad/v12'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
FONT_HOSTS = ('fonts.googleapis.com', 'fonts.gstatic.com')
# real looks for --game (cards 1 to 3; card 4 has no portrait on purpose)
LOOKS = [
    ({'shape': 'round', 'color': '#93c2ee', 'pattern': 'belly', 'top': 'longears', 'wear': 'scarf'}, '#efe6d6'),
    ({'shape': 'spiky', 'color': '#f6cf5b', 'pattern': 'spots', 'top': 'none', 'wear': 'flower'}, '#2a2433'),
    ({'shape': 'tall', 'color': '#bfa9f0', 'pattern': 'stripes', 'top': 'antennae', 'wear': 'glasses'}, '#f3e6cf'),
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}

    def log_message(self, *a):
        pass


# dark text colours used on the card (ink, soft, heading brown, kept-note brown)
TEXT = {'ink': '#2b2530', 'soft': '#6b6170', 'heading': '#8a5a1a', 'kept note': '#5a4630'}


def text_contrast(path):
    """WCAG contrast of each text colour against the real background around it, measured on the PNG.

    Pixels painted exactly in a text colour are glyph interiors; the background is the light pixels 3 to 5 px away
    from them (past the anti-aliased edge). Returns {colour: 1st-percentile contrast}. Needs Pillow and numpy."""
    from PIL import Image, ImageFilter
    import numpy as np
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)

    def lum(rgb):
        c = rgb / 255.0
        c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    L = lum(a)
    out = {}
    for name, hx in TEXT.items():
        col = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
        mask = np.abs(a - col).max(axis=2) <= 2
        if mask.sum() < 200:
            continue
        img = Image.fromarray((mask * 255).astype(np.uint8))
        near, far = np.asarray(img.filter(ImageFilter.MaxFilter(5))) > 0, np.asarray(img.filter(ImageFilter.MaxFilter(11))) > 0
        ring = far & ~near & (L > 0.45)
        if ring.sum() < 50:
            continue
        lt = lum(col[None, None, :])[0, 0]
        out[name] = round(float(np.percentile((L[ring] + 0.05) / (lt + 0.05), 1)), 2)
    return out


def png_size(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return struct.unpack('>II', data[16:24])


fails, notes = [], []


def check(ok, what):
    (notes if ok else fails).append(('ok   ' if ok else 'FAIL ') + what)
    print(('ok   ' if ok else 'FAIL ') + what, flush=True)
    return ok


def game_portraits(ctx, base):
    pg = ctx.new_page()
    try:
        pg.goto(base + '/dist/who-bends.html?test=1&mute=1', timeout=60000)
        pg.wait_for_function('window.__wb && window.__wb.G && window.__wb.G.stage', timeout=120000)
        return [pg.evaluate('([l, bg]) => window.__wb.G.portraitOf(Object.assign({ voice: "hum", wheels: false }, l), { bg, w: 600, h: 600 })', [look, bg]) for look, bg in LOOKS]
    except Exception as e:
        print('note: could not render game portraits (%s); using stand-ins' % str(e)[:160])
        return []
    finally:
        pg.close()


STRESS = [
    # everything at once, all long, counts past 40
    {'portrait': None, 'name': 'Alexandria Montgomery-Beauregard', 'showName': True, 'visits': 3,
     'places': ['The very far end of the long pier, past the lighthouse, when the fog has just lifted'] * 3,
     'tally': {'you': 57, 'gear': 41, 'them': 40, 'place': 21, 'nobody': 1234},
     'turned': 'Somebody asked me to change the whole way I do my morning so that it would suit them better, and I said I would try for one week and then we would talk about it again over tea. ' * 2,
     'nextTime': 'Ask first. Ask early. Ask the person who can actually change the room instead of the person who happens to be standing in it. ' * 2,
     'kept': 'The baker who kept the radio off for the whole afternoon because I mentioned once, weeks ago, that it was a lot. ' * 2},
    # other scripts, emoji and a word with no spaces
    {'portrait': None, 'name': '하늘 🌙 Sky', 'showName': True, 'visits': 2, 'places': ['시장 광장, 아침', 'Supercalifragilisticexpialidociouslylongplacenamewithoutanyspaces'],
     'tally': {'you': 1, 'gear': 0, 'them': 0, 'place': 0, 'nobody': 0}, 'turned': None, 'nextTime': '먼저 물어보기.', 'kept': None},
    # junk input must still draw a sensible card
    {'tally': {'you': -3, 'gear': 'x', 'them': float('inf'), 'place': 2.7, 'nobody': None}, 'visits': 9, 'places': 'Home Row', 'name': 'Hidden Name', 'showName': 'yes'},
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--game', action='store_true', help='render real portraits with dist/who-bends.html')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:%d' % srv.server_address[1]

    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)  # one browser for everything
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        portraits = game_portraits(ctx, base) if a.game else []
        pg = ctx.new_page()
        errs, font_misses, downloads = [], [], []

        def on_console(m):
            if m.type != 'error':
                return
            url = (m.location or {}).get('url', '')
            (font_misses if any(h in url for h in FONT_HOSTS) else errs).append(m.text[:300])
        pg.on('console', on_console)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
        pg.on('download', lambda d: downloads.append(d))
        requests = []
        pg.on('request', lambda r: requests.append(r.url))
        if portraits:
            pg.add_init_script('window.__fitcardPortraits = %s;' % json.dumps(portraits))
        pg.goto(base + '/test/fitcard.html')
        pg.wait_for_function('window.__fitcard && window.__fitcard.done', timeout=90000)
        st = pg.evaluate('({ error: __fitcard.error, fonts: __fitcard.fonts, n: __fitcard.cards.length })')
        check(st['error'] is None, 'page rendered without throwing %s' % (st['error'] or ''))
        check(st['n'] == 4, 'four sample cards')
        print('fonts:', 'Fredoka and Atkinson Hyperlegible loaded' if st['fonts'] else 'NOT loaded (system fallback fonts)')
        print('portraits:', 'from the game' if portraits else 'stand-ins drawn by the page')

        # the PNGs
        shots = []
        for i in range(st['n']):
            info = pg.evaluate('''async (i) => { const cv = __fitcard.cards[i]; const b = await __fitcard.api.cardBlob(cv);
                const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
                return { w: cv.width, h: cv.height, type: b.type, b64: btoa(s), layout: cv.fitLayout, label: cv.getAttribute('aria-label') }; }''', i)
            data = base64.b64decode(info['b64'])
            path = os.path.join(a.out, 'fitcard_%d.png' % (i + 1))
            open(path, 'wb').write(data)
            shots.append(path)
            check(info['w'] == 1080 and info['h'] == 1350, 'card %d canvas is 1080x1350' % (i + 1))
            check(info['type'] == 'image/png' and png_size(data) == (1080, 1350), 'card %d cardBlob is a 1080x1350 PNG (%d KB)' % (i + 1, len(data) // 1024))
            check(info['layout'] and info['layout']['slack'] >= 0, 'card %d fits without overflow %s' % (i + 1, json.dumps(info['layout'])))
            check(bool(info['label']), 'card %d canvas carries role=img and an aria-label' % (i + 1))
            try:
                cr = text_contrast(path)
                check(cr and min(cr.values()) >= 4.5, 'card %d text contrast is WCAG AA against its local background %s' % (i + 1, json.dumps(cr)))
            except ImportError:
                print('note: Pillow or numpy missing; contrast not measured')
            print('   saved', path)

        # alt text
        alts = pg.evaluate('__fitcard.alts')
        layouts = pg.evaluate('__fitcard.cards.map((c) => c.fitLayout)')
        check('Sam' not in alts[0] and "player's creature" in alts[0] and layouts[0]['name'] == '', 'card 1 keeps the hidden name off the card and out of the alt text')
        check(layouts[1]['name'] == 'Bartholomew Featherst…', 'card 2 draws the long name cut to 22 characters with an ellipsis (%r)' % layouts[1]['name'])
        check("Bartholomew Featherstonehaugh-Smythe the Second's creature" in alts[1] and 'after two visits' in alts[1], 'card 2 alt text names the creature in full and says two visits')
        check(layouts[2]['name'] == 'Mo', 'card 3 draws the short name whole')
        check('Places that fit me: still looking.' in alts[3] and 'nobody had to adjust yet' in alts[3], 'card 4 alt text describes an empty card')
        check(all('A game about who adjusts.' in t for t in alts), 'every alt text ends with the footer line')
        for i, t in enumerate(alts):
            print('   alt %d: %s' % (i + 1, t))

        # stress cards: long everything, other scripts, junk input
        for i, d in enumerate(STRESS):
            info = pg.evaluate('''async (d) => { const cv = await __fitcard.api.drawFitCard(d); return { w: cv.width, h: cv.height, layout: cv.fitLayout, url: cv.toDataURL('image/png'), alt: __fitcard.api.cardAltText(d) }; }''', d)
            path = os.path.join(a.out, 'fitcard_stress_%d.png' % (i + 1))
            open(path, 'wb').write(base64.b64decode(info['url'].split(',', 1)[1]))
            check(info['w'] == 1080 and info['h'] == 1350 and info['layout']['slack'] >= 0, 'stress card %d draws and fits %s' % (i + 1, json.dumps(info['layout'])))
            if i == 2:
                check('Hidden Name' not in info['alt'] and info['layout']['name'] == '' and 'after all three visits' in info['alt'], 'showName must be exactly true; visits clamp to 3')
        empty = pg.evaluate('async () => { const cv = await __fitcard.api.drawFitCard(); return [cv.width, cv.height, __fitcard.api.cardAltText()]; }')
        check(empty[0] == 1080 and 'After one visit'.lower() in empty[2], 'drawFitCard() with no argument still draws')
        bad = pg.evaluate('''async () => { const d = { portrait: 'data:image/png;base64,bm90IGFuIGltYWdl', places: ['Home Row'], tally: { you: 1 }, visits: 1 };
            const cv = await __fitcard.api.drawFitCard(d); const web = await __fitcard.api.drawFitCard({ ...d, portrait: 'https://example.com/me.png' });
            return [cv.getAttribute('aria-label'), web.getAttribute('aria-label')]; }''')
        check(all('soft circle' in t for t in bad), 'a portrait that will not decode, or is not a data:/blob: URL, is drawn and described as the placeholder')

        # saveFitCard, every branch, against a mocked window.claude
        run = '''async ([setup]) => { window.__calls = []; window.claude = undefined; (new Function(setup))();
            const t0 = performance.now(); const r = await __fitcard.api.saveFitCard(__fitcard.cards[2]);
            return { status: r.status, url: (r.url || '').slice(0, 22), ms: Math.round(performance.now() - t0), calls: window.__calls }; }'''
        rec = 'window.__calls.push({ filename: req.filename, blob: req.data instanceof Blob, size: req.data && req.data.size });'

        n0 = len(downloads)
        with pg.expect_download(timeout=20000) as di:
            r = pg.evaluate(run, [''])
        dl = di.value
        dl_path = dl.path()
        check(r['status'] == 'download' and dl.suggested_filename == 'made-to-fit-card.png', 'no window.claude: plain download of made-to-fit-card.png (%s)' % r['status'])
        check(png_size(open(dl_path, 'rb').read(32)) == (1080, 1350), 'the downloaded file is the 1080x1350 PNG')

        r = pg.evaluate(run, ['window.claude = { use: async (n) => n === "downloads" ? { save: async (req) => { %s return { status: "saved" }; } } : null };' % rec])
        c = r['calls'][0] if r['calls'] else {}
        check(r['status'] == 'saved' and c.get('filename') == 'made-to-fit-card.png' and c.get('blob') and c.get('size', 0) > 10000, 'downloads.save accepted: saved, with a PNG Blob (%s)' % json.dumps(r))

        n0 = len(downloads)
        r = pg.evaluate(run, ['window.claude = { use: async () => ({ save: async (req) => { %s throw { code: "declined", message: "no" }; } }) };' % rec])
        pg.wait_for_timeout(300)
        check(r['status'] == 'declined' and len(r['calls']) == 1 and len(downloads) == n0, 'viewer declined: declined, no retry, no download (%s)' % r['status'])

        r = pg.evaluate(run, ['window.claude = { use: async () => ({ save: async (req) => { %s throw { code: "unavailable", message: "x" }; } }) };' % rec])
        check(r['status'] == 'fallback' and r['url'].startswith('data:image/png'), 'saves unavailable in this view: fallback picture (%s)' % r['status'])

        r = pg.evaluate(run, ['window.claude = { use: async () => ({ save: async (req) => { %s throw { code: "something_new", message: "x" }; } }) };' % rec])
        check(r['status'] == 'fallback', 'unknown error code treated as unavailable (%s)' % r['status'])

        r = pg.evaluate(run, ['let k = 0; window.claude = { use: async () => ({ save: async (req) => { %s if (k++ === 0) throw { code: "rate_limited", message: "x" }; return { status: "saved" }; } }) };' % rec])
        check(r['status'] == 'saved' and len(r['calls']) == 2 and r['ms'] >= 1400, 'rate limited: waits, retries once, saved (%dms, %d calls)' % (r['ms'], len(r['calls'])))

        r = pg.evaluate(run, ['window.claude = { use: async () => ({ save: async (req) => { %s if (req.filename.endsWith(".png")) throw { code: "too_large", message: "x" }; return { status: "saved" }; } }) };' % rec])
        check(r['status'] == 'saved' and [x['filename'] for x in r['calls']] == ['made-to-fit-card.png', 'made-to-fit-card.jpg'], 'too large: offers a smaller JPEG (%s)' % json.dumps([x['filename'] for x in r['calls']]))

        with pg.expect_download(timeout=20000) as di:
            r = pg.evaluate(run, ['window.claude = { use: async () => null };'])
        check(r['status'] == 'download' and di.value.suggested_filename == 'made-to-fit-card.png', 'use() resolves null at top level: plain download (%s)' % r['status'])

        with pg.expect_download(timeout=20000) as di:
            r = pg.evaluate(run, ['window.claude = { use: () => new Promise(() => {}) };'])
        check(r['status'] == 'download' and 3900 <= r['ms'] < 7000, 'use() never answers: gives up after 4 s, then downloads (%dms)' % r['ms'])

        r = pg.evaluate('''async () => { window.__calls = []; let release; window.claude = { use: async () => ({ save: (req) => { window.__calls.push(req.filename); return new Promise((ok) => { release = ok; }); } }) };
            const a = __fitcard.api.saveFitCard(__fitcard.cards[0]); await new Promise((r) => setTimeout(r, 300));
            const b = __fitcard.api.saveFitCard(__fitcard.cards[0]); await new Promise((r) => setTimeout(r, 300)); release({ status: 'saved' });
            const [x, y] = await Promise.all([a, b]); return { x: x.status, y: y.status, calls: window.__calls.length }; }''')
        check(r == {'x': 'saved', 'y': 'saved', 'calls': 1}, 'a second tap while the prompt is open shares the first prompt (%s)' % json.dumps(r))

        r = pg.evaluate('''async () => { window.claude = undefined; const P = HTMLAnchorElement.prototype; const d = Object.getOwnPropertyDescriptor(P, 'download'); delete P.download;
            try { const r = await __fitcard.api.saveFitCard(__fitcard.cards[0]); return { status: r.status, url: (r.url || '').slice(0, 22) }; } finally { Object.defineProperty(P, 'download', d); } }''')
        check(r['status'] == 'fallback' and r['url'].startswith('data:image/png'), 'no download support: fallback picture (%s)' % r['status'])

        pg.wait_for_timeout(300)
        outside = [u for u in requests if not u.startswith(base) and not u.startswith(('data:', 'blob:')) and not any('//' + h + '/' in u for h in FONT_HOSTS)]
        check(not outside, 'nothing leaves the page but the Google Fonts it links%s' % ('' if not outside else ': ' + ', '.join(outside[:5])))
        if font_misses:
            print('note: the Google Fonts request failed (offline?); the cards used fallback fonts')
        check(not errs, 'no console errors' + ('' if not errs else ': ' + ' | '.join(errs[:5])))

        # a phone-width contact sheet, for eyeballing legibility (360 px per card)
        try:
            from PIL import Image
            ims = [Image.open(s).convert('RGB').resize((360, 450), Image.LANCZOS) for s in shots]
            sheet = Image.new('RGB', (360 * len(ims) + 16 * (len(ims) + 1), 450 + 32), '#e9dfcc')
            for i, im in enumerate(ims):
                sheet.paste(im, (16 + i * (360 + 16), 16))
            sheet.save(os.path.join(a.out, 'fitcard_phone.png'))
            print('   saved', os.path.join(a.out, 'fitcard_phone.png'))
        except ImportError:
            pass
        b.close()
    srv.shutdown()
    print('\n%d checks passed, %d failed' % (len(notes), len(fails)))
    for f in fails:
        print(f)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
