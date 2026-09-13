# Bag sticker

Artwork for the cudinham mini printer (Tiny Print app) — the table mark,
`@mcgrossman`, and a QR to the site. Four sizes; print whichever suits the job.

Everything is drawn at **8 px = 1 mm**, which is 203 dpi — the printer's own
resolution — so a PNG exported at the artboard's pixel size lands on the paper
1:1 with no resampling. The paper is 52 mm wide; everything is drawn to 48 mm,
leaving roughly 2 mm of margin each side.

Thermal printing is one bit per dot: pure black on white, no greys, no
gradients, nothing thinner than about 0.3 mm (3 px here).

    python3 build.py     # -> Main/Square/Tall/Seal.dc.html + proof.html

| Artboard  | Size       | |
|-----------|------------|--|
| `Main`    | 48 × 25 mm | the everyday bag sticker |
| `Square`  | 48 × 48 mm | framed shop stamp |
| `Tall`    | 48 × 64 mm | roomiest, largest QR |
| `Seal`    | 48 × 14 mm | mark and handle only, no QR |

## Assets

- `mark.png` — `images/Logo 2025-2.png` turned into a pure-black silhouette
  on transparency (same darkness-to-alpha trick as `tools/make-logo.py`, but
  black rather than the site's brown).
- `qr.svg` — `https://maxgrossman.com`, QR version 2, ECC M, 4-module quiet
  zone, drawn as merged rows of rects so it stays crisp at any size.
- `archivo-sub.woff2` — Archivo (SIL OFL) subset to the characters used and
  inlined into each artboard, because PNG/PDF export cannot pull a webfont.

`@mcgrossman` measures 7.593 em in Archivo 800 — size it against the column it
sits in rather than eyeballing it, or it clips.

The QRs were checked by rendering each artboard at true pixel size, thresholding
to 1-bit the way the print head does, and decoding the result.
