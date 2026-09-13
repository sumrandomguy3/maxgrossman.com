#!/usr/bin/env python3
"""Lift black line art off a coloured background.

    python3 extract-logo.py crafty-rosen-source.png crafty-rosen.png

The Crafty Rosen logo arrives sitting on a blue band. The band and the paper
are both far lighter than the ink, so a luminance split separates them
cleanly - no keying on the blue itself, which would leave a halo wherever a
stem crosses the edge of the strip. Darkness becomes opacity, so the
antialiased edges of the script lettering survive.

Thermal printing is one bit per dot, so --gain thickens the ink first: the
wreath's hatching is finer than a 203 dpi head can resolve, and without it
the leaves fill in as grey mush.
"""
import argparse
import sys
from PIL import Image, ImageFilter


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--width', type=int, default=1200, help='output width in px')
    ap.add_argument('--ink', type=int, default=150,
                    help='luminance at or below which a pixel is fully ink (0-255)')
    ap.add_argument('--paper', type=int, default=225,
                    help='luminance at or above which a pixel is fully background')
    ap.add_argument('--gain', type=float, default=0.0,
                    help='px of line thickening before downscaling, for thermal')
    args = ap.parse_args()

    art = Image.open(args.src).convert('RGB')
    lum = art.convert('L')

    if args.gain:
        # a min-filter grows dark areas; odd kernel, so round up to the next odd px
        k = max(3, int(args.gain) * 2 + 1)
        lum = lum.filter(ImageFilter.MinFilter(k))

    span = max(1, args.paper - args.ink)
    alpha = lum.point(lambda v: 255 if v <= args.ink
                      else (0 if v >= args.paper else int((args.paper - v) * 255 / span)))

    box = alpha.getbbox()
    if not box:
        sys.exit('nothing above the ink threshold - is --ink too low?')
    alpha = alpha.crop(box)

    mark = Image.new('RGBA', alpha.size, (0, 0, 0, 0))
    mark.paste(Image.new('RGBA', alpha.size, (0, 0, 0, 255)), (0, 0), alpha)
    mark.putalpha(alpha)

    out = mark.resize((args.width, round(alpha.height * args.width / alpha.width)),
                      Image.LANCZOS)
    out.save(args.out, optimize=True)
    print(f'{args.out} - {out.width}x{out.height}, aspect {out.width / out.height:.3f}')


if __name__ == '__main__':
    main()
