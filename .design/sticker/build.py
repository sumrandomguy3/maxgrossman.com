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


# — Main: 48 x 25 mm, the common 57x25 die-cut label —
MAIN = f"""<div class="sticker" style="padding: 13px 15px; align-items: center; gap: 15px">
  <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 9px; flex: 1; min-width: 0">
    {mark(182)}
    <div style="display: flex; flex-direction: column; align-items: flex-start">
      <div style="font-size: 31px; font-weight: 800; letter-spacing: 0.04em; line-height: 0.98; text-transform: uppercase">Max</div>
      <div style="font-size: 31px; font-weight: 800; letter-spacing: 0.04em; line-height: 0.98; text-transform: uppercase">Grossman</div>
    </div>
    <div style="width: 100%; height: 3px; background: #000000"></div>
    <div style="font-size: 14px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase">maxgrossman.com</div>
  </div>
  {qr(154)}
</div>"""

# — Square: 48 x 48 mm, framed shop stamp —
SQUARE = f"""<div class="sticker" style="padding: 10px">
  <div style="flex: 1; border: 3px solid #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px 22px">
    {mark(250)}
    <div style="font-size: 32px; font-weight: 800; letter-spacing: 0.05em; line-height: 1; text-transform: uppercase; margin-top: 12px">Max Grossman</div>
    <div style="width: 100%; height: 3px; background: #000000; margin: 12px 0 6px"></div>
    {qr(152)}
    <div style="font-size: 14px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0">maxgrossman.com</div>
  </div>
</div>"""

# — Tall: 48 x 64 mm, the roomy one —
TALL = f"""<div class="sticker" style="padding: 30px 26px 26px; flex-direction: column; align-items: center">
  {mark(290)}
  <div style="display: flex; flex-direction: column; align-items: center; margin-top: 22px">
    <div style="font-size: 46px; font-weight: 800; letter-spacing: 0.03em; line-height: 0.96; text-transform: uppercase">Max</div>
    <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.03em; line-height: 1; text-transform: uppercase">Grossman</div>
  </div>
  <div style="width: 64px; height: 4px; background: #000000; margin: 18px 0 4px"></div>
  {qr(200)}
  <div style="font-size: 16px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 2px">maxgrossman.com</div>
</div>"""

# — Seal: 48 x 16 mm, no QR, for sealing a bag flap —
SEAL = f"""<div class="sticker" style="padding: 14px 16px; align-items: center; gap: 12px">
  {mark(150)}
  <div style="width: 3px; height: 62px; background: #000000; flex: none"></div>
  <div style="display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0">
    <div style="font-size: 29px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase">Max</div>
    <div style="font-size: 29px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase">Grossman</div>
  </div>
</div>"""

BOARDS = [
    ('Main',   MAIN,   384, 200, '48 x 25 mm'),
    ('Square', SQUARE, 384, 384, '48 x 48 mm'),
    ('Tall',   TALL,   384, 512, '48 x 64 mm'),
    ('Seal',   SEAL,   384, 128, '48 x 16 mm'),
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
