# How to edit this site

This is a plain website: every page is one HTML file you can read, and all the
text on the site is typed right into those files. There's no admin panel like
Squarespace — the files **are** the site. Edit a file, and once it's saved
("committed") to GitHub, the live site updates itself in a minute or two.

The good news: for 95% of what you'll want to do — fixing a word, changing a
price, adding a photo — you only ever touch one file, right in your web browser
on github.com.

## Which file is which page

| You want to change… | Edit this file |
|---|---|
| Homepage (hero, work cards, about, contact) | `index.html` |
| Restoration page | `restoration.html` |
| A portfolio page | `seating.html`, `tables.html`, `casework.html`, `library-steps.html`, `metalwork.html`, `theater-sets.html` |
| Shop front page | `shop.html` |
| One product | `shop-<product-name>.html` (e.g. `shop-spoon.html`) |
| The nav bar at the top of every page | `partials/nav.html` (see "Nav & footer" below) |
| The footer on every page | `partials/footer.html` (see "Nav & footer" below) |
| Colors and fonts | `styles.css` (the color codes are at the very top) |

## Editing text

1. On github.com, open the repo and click the file for the page you want.
2. Click the **pencil icon** (top right of the file view).
3. Find the sentence you want to change — `Ctrl+F` / `Cmd+F` works — and edit
   it. The text sits between tags like `<p>…</p>` or `<h2>…</h2>`; change the
   words, leave the tags alone.
4. Click **Commit changes** (the green button), then commit again on the
   confirmation screen.
5. Wait a minute or two, then refresh the live site. If you don't see the
   change, do a hard refresh (`Ctrl+Shift+R`, or on a phone: clear the tab and
   reopen).

Two characters to know: in page text, `&amp;` means `&` and `&quot;` means `"`.
Type those codes instead of the bare character and everything stays happy.

## Adding photos

Photos live in `images/originals/`, sorted into one folder per page (e.g.
`images/originals/furniture-repair/` feeds the restoration page).

1. On github.com, navigate into the right folder under `images/originals/`,
   then **Add file → Upload files**. Drag your photos in (straight off your
   phone is fine) and commit. Avoid spaces and punctuation in filenames —
   `new-walnut-table.jpg` is perfect.
2. Edit the page and add one line where the other gallery photos are:

   ```html
   <figure><img src="images/originals/furniture-repair/new-walnut-table.jpg" alt="A restored walnut side table" loading="lazy"></figure>
   ```

   The `alt` text is a short description — it's what search engines and screen
   readers see, so describe the piece.
3. That's it — the photo shows up immediately. When you get a chance, run the
   build script (next section) or ask Claude to; it makes a smaller
   fast-loading copy of your photo and points the page at it. Until then the
   page just loads the full-size original, which works but is slower.

To swap a photo that's already on a page, upload the new one and change the
filename inside the `src="…"` of the existing line.

## The build script (the site's only "machinery")

`tools/build.py` does two chores:

- copies the shared nav bar and footer from `partials/` into every page, and
- makes fast-loading copies (in `images/web/`) of any full-size photos you've
  added, then points the pages at them. Your originals are never touched.

Run it from the repo folder on a computer with Python:

```sh
pip install Pillow        # first time only
python3 tools/build.py
```

…or just ask Claude: *"run the build script and commit"*. Nothing on the site
breaks if you forget to run it — things are only slightly slower or, for a nav
edit, not yet copied to every page.

## Nav & footer (the bars on every page)

The top nav and the footer appear on all 27 pages, but you only edit them in
**one place**: `partials/nav.html` and `partials/footer.html`. After editing,
run the build script (or ask Claude) — it stamps your change into every page.
Please don't edit the nav directly inside a page; the next build run would
overwrite it.

## Shop changes

- **Change a price:** edit the product's page (`shop-<name>.html`) — update the
  visible price in `<div class="mg-price-lg">$25.00</div>` **and** the hidden
  checkout amount `<input type="hidden" name="amount" value="25.00">` — and
  then the price on its card in `shop.html`. (Also on `index.html` if the
  product is one of the three featured there.)
- **Retire a product:** delete its card from `shop.html`. The product page can
  stay (dead pages hurt nothing) or be deleted too.
- **New product:** copy an existing product page's contents into a new file
  named `shop-your-new-thing.html`, change the title, photos, price and
  description, and add a card for it in `shop.html` (copy a neighboring card
  block and adjust). Easiest done by asking Claude.

## When in doubt

Open a Claude Code session on this repo and say what you want in plain English
— "raise the spoon price to $30", "add these five photos to the tables page",
"reword the about section". It can make the edit, run the build, and show you
the result before anything goes live.
