#!/usr/bin/env python3
"""Build images/logo-mark.png — the nav logo — from the source drawing.

    python3 tools/make-logo.py "images/Logo 2025-2.png"

The drawing arrives as black-on-white with no transparency. Pasted straight
into the nav that shows as a white box on the greige bar, so this turns ink
coverage into alpha (soft edges survive), tints it the site's dark brown,
trims the dead margin, and writes a 200px-tall copy — enough for the 50px
nav slot on a high-resolution screen.

Re-run it whenever the drawing changes.
"""
import sys
from pathlib import Path
from PIL import Image

BROWN = (50, 42, 32)          # --color-text
OUT = Path('images/logo-mark.png')
HEIGHT = 200


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f'no such file: {src}')

    art = Image.open(src).convert('RGB')
    # Darkness becomes opacity, so antialiased edges stay soft.
    alpha = art.convert('L').point(lambda v: 255 - v)
    box = alpha.getbbox()
    if not box:
        sys.exit('that image looks blank')

    mark = Image.new('RGBA', art.size, BROWN + (0,))
    mark.putalpha(alpha)
    mark.paste(Image.new('RGBA', art.size, BROWN + (255,)), (0, 0), alpha)
    mark = mark.crop(box)

    out = mark.resize((round(mark.width * HEIGHT / mark.height), HEIGHT), Image.LANCZOS)
    out.save(OUT, optimize=True)
    print(f'{OUT} — {out.width}x{out.height}, aspect {out.width / out.height:.2f}')
    print(f'  in the nav at 50px tall that is {round(out.width * 50 / out.height)}px wide')


if __name__ == '__main__':
    main()
