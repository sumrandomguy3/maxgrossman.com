#!/usr/bin/env python3
"""Assemble the sticker artboards.

Everything is authored at 8 px = 1 mm, which is 203.2 dpi - the native
resolution of the cudinham printer - so an exported PNG is 1:1 with the
printer's dots and needs no resampling.
"""
import base64, json, pathlib

HERE = pathlib.Path(__file__).parent
MM = 8  # px per mm

FONT_B64 = (HERE / 'archivo-sub.b64').read_text().strip()
QR_SVG = (HERE / 'qr.svg').read_text().strip()
MARK_B64 = base64.b64encode((HERE / 'mark.png').read_bytes()).decode()
MARK_ASPECT = 1000 / 305

FONT_CSS = f"""
    @font-face {{
      font-family: 'Archivo';
      src: url(data:font/woff2;base64,{FONT_B64}) format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
    }}"""

BASE_CSS = FONT_CSS + """
    body {
      margin: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    a { color: #000000; } a:hover { color: #000000; }
    .sticker { box-sizing: border-box; width: 100%; height: 100%; background: #ffffff; display: flex; }
    .mark { display: block; width: 100%; height: auto; }
    .qr { display: block; }
"""


def mark(width_px, extra=''):
    return (f'<img src="mark.png" alt="Max Grossman Designs" class="mark" '
            f'style="width: {width_px}px; height: {round(width_px / MARK_ASPECT)}px{extra}">')


def qr(size_px, extra=''):
    return (f'<div class="qr" style="width: {size_px}px; height: {size_px}px; flex: none{extra}">'
            f'{QR_SVG}</div>')


def page(body, css=''):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>{BASE_CSS}{css}  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
"""


HANDLE = '@mcgrossman'
SITE = 'maxgrossman.com'


def handle(size_px, extra=''):
    return (f'<div style="font-size: {size_px}px; font-weight: 800; letter-spacing: 0.01em; '
            f'line-height: 1; white-space: nowrap{extra}">{HANDLE}</div>')


def site(size_px, extra=''):
    return (f'<div style="font-size: {size_px}px; font-weight: 600; letter-spacing: 0.1em; '
            f'text-transform: uppercase; white-space: nowrap{extra}">{SITE}</div>')


def rule(width, thickness=3, extra=''):
    return f'<div style="width: {width}; height: {thickness}px; background: #000000; flex: none{extra}"></div>'


# — Main: 48 x 25 mm, the everyday bag sticker —
MAIN = f"""<div class="sticker" style="padding: 13px 15px; align-items: center; gap: 15px">
  <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 10px; flex: 1; min-width: 0">
    {mark(189)}
    {handle(24)}
    {rule('100%')}
    {site(14)}
  </div>
  {qr(150)}
</div>"""

# — Square: 48 x 48 mm, framed shop stamp —
SQUARE = f"""<div class="sticker" style="padding: 10px">
  <div style="flex: 1; border: 3px solid #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 22px">
    {mark(250)}
    {handle(40, '; margin-top: 12px')}
    {rule('100%', 3, '; margin: 12px 0 6px')}
    {qr(152)}
    {site(14)}
  </div>
</div>"""

# — Tall: 48 x 64 mm, the roomy one —
TALL = f"""<div class="sticker" style="padding: 30px 26px 26px; flex-direction: column; align-items: center">
  {mark(310)}
  {handle(42, '; margin-top: 22px')}
  {rule('64px', 4, '; margin: 18px 0 4px')}
  {qr(220)}
  {site(16, '; margin-top: 2px')}
</div>"""

# — Seal: 48 x 14 mm, no QR, for sealing a bag flap —
SEAL = f"""<div class="sticker" style="padding: 12px 16px; align-items: center; gap: 12px">
  {mark(140)}
  {rule('3px', 0, '; width: 3px; height: 44px')}
  {handle(24)}
</div>"""

BOARDS = [
    ('Main',   MAIN,   384, 200, '48 x 25 mm'),
    ('Square', SQUARE, 384, 384, '48 x 48 mm'),
    ('Tall',   TALL,   384, 512, '48 x 64 mm'),
    ('Seal',   SEAL,   384, 112, '48 x 14 mm'),
]


def main():
    for name, body, w, h, _ in BOARDS:
        (HERE / f'{name}.dc.html').write_text(page(body))

    # a plain-HTML proof sheet, so the fit can be checked in a browser
    cards = ''.join(
        f'<figure style="margin:0"><figcaption style="font:12px/1.6 monospace;padding:4px 0">{n} &middot; {lbl} &middot; {w}x{h}px</figcaption>'
        f'<div style="width:{w}px;height:{h}px;outline:1px solid #f00;background:#fff">'
        f'{b.replace("src=&quot;mark.png&quot;", "")}</div></figure>'
        for n, b, w, h, lbl in BOARDS)
    proof = (f'<!doctype html><meta charset="utf-8"><style>{BASE_CSS}'
             'body{background:#e8e8e6;padding:40px;display:flex;gap:48px;align-items:flex-start;flex-wrap:wrap}'
             '</style>' + cards)
    proof = proof.replace('src="mark.png"', f'src="data:image/png;base64,{MARK_B64}"')
    (HERE / 'proof.html').write_text(proof)
    print('wrote', ', '.join(f'{n}.dc.html' for n, *_ in BOARDS), '+ proof.html')


if __name__ == '__main__':
    main()
