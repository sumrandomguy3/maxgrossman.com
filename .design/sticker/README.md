# Bag sticker

Artwork for the cudinham mini printer (Tiny Print app) — the table mark,
the name, and a QR to the site. Four sizes; print whichever suits the roll.

Everything is drawn at **8 px = 1 mm**, which is 203 dpi — the printer's own
resolution — so a PNG exported at the artboard's pixel size lands on the paper
1:1 with no resampling. 48 mm is the printable width on a 57 mm roll.

Thermal printing is one bit per dot: pure black on white, no greys, no
gradients, nothing thinner than about 0.3 mm (3 px here).

    python3 build.py     # -> Main/Square/Tall/Seal.dc.html + proof.html

| Artboard  | Size       | |
|-----------|------------|--|
| `Main`    | 48 × 25 mm | the common 57×25 die-cut label |
| `Square`  | 48 × 48 mm | framed shop stamp |
| `Tall`    | 48 × 64 mm | roomiest, largest QR |
| `Seal`    | 48 × 16 mm | mark and name only, no QR |

## Assets

- `mark.png` — `images/Logo 2025-2.png` turned into a pure-black silhouette
  on transparency (same darkness-to-alpha trick as `tools/make-logo.py`, but
  black rather than the site's brown).
- `qr.svg` — `https://maxgrossman.com`, QR version 2, ECC M, 4-module quiet
  zone, drawn as merged rows of rects so it stays crisp at any size.
- `archivo-sub.woff2` — Archivo (SIL OFL) subset to the characters used and
  inlined into each artboard, because PNG/PDF export cannot pull a webfont.

The QRs were checked by rendering each artboard at true pixel size, thresholding
to 1-bit the way the print head does, and decoding the result.
