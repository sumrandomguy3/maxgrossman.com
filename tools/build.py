#!/usr/bin/env python3
"""The site's only "build step". Run it from the repo root:

    python3 tools/build.py

It does two chores and nothing else:

1. Nav & footer sync — copies partials/nav.html and partials/footer.html into
   every page, between the <!-- nav:start --> / <!-- nav:end --> (and footer)
   marker comments. Edit those two partial files once instead of 27 pages.

2. Web-sized photos — any <img> that points at images/originals/... gets a
   fast-loading copy made in images/web/... (shrunk to at most 1600px, ~82%
   JPEG quality) and the page is rewritten to use the copy. The originals are
   never modified — they stay as the full-quality archive. Needs the Pillow
   library (pip install Pillow); pages that reference an original still work
   before the script runs, they just load the bigger file.

The script is safe to run any number of times; it only rewrites what changed.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_DIM = 1600      # longest edge of a web-sized photo, in pixels
JPEG_QUALITY = 82

ORIG_PREFIX = "images/originals/"
WEB_PREFIX = "images/web/"


def make_web_copy(src: Path, dst: Path) -> None:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        sys.exit("Pillow is needed to shrink photos — run:  pip install Pillow")
    dst.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)  # phone photos store rotation in EXIF
    im.thumbnail((MAX_DIM, MAX_DIM))
    if src.suffix.lower() in (".jpg", ".jpeg"):
        im.convert("RGB").save(dst, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    else:
        im.save(dst, optimize=True)
    # if the original was already small, shrinking can't help — keep it as-is
    if dst.stat().st_size >= src.stat().st_size:
        dst.write_bytes(src.read_bytes())


def sync_partial(name: str, text: str, page_name: str) -> str:
    partial = (ROOT / "partials" / f"{name}.html").read_text()
    # drop the explanatory comment at the top of the partial file
    partial = re.sub(r"^<!--.*?-->\s*", "", partial, flags=re.S).strip()
    pattern = re.compile(rf"(<!-- {name}:start[^>]*?-->).*?(<!-- {name}:end -->)", re.S)
    if not pattern.search(text):
        print(f"  note: {page_name} has no {name} markers, skipped")
        return text
    return pattern.sub(lambda m: f"{m.group(1)}\n  {partial}\n  {m.group(2)}", text)


def main() -> None:
    converted = 0
    for page in sorted(ROOT.glob("*.html")):
        text = original_text = page.read_text()
        for name in ("nav", "footer"):
            text = sync_partial(name, text, page.name)
        for src_ref in sorted(set(re.findall(rf'{ORIG_PREFIX}[^"\s]+', text))):
            src = ROOT / src_ref
            if not src.exists():
                print(f"  warning: {page.name} references missing file {src_ref}")
                continue
            dst_ref = WEB_PREFIX + src_ref[len(ORIG_PREFIX):]
            dst = ROOT / dst_ref
            if not dst.exists():
                make_web_copy(src, dst)
                converted += 1
            text = text.replace(src_ref, dst_ref)
        if text != original_text:
            page.write_text(text)
            print(f"updated {page.name}")
    print(f"done — {converted} new web-sized photo(s) created")


if __name__ == "__main__":
    main()
