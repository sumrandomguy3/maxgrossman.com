# maxgrossman.com

The website for Max Grossman Designs — furniture designer & maker, West Orange, NJ.

This is a plain static site: one HTML file, one stylesheet, no build step and no
frameworks. It can be hosted for free, so the only recurring cost is the domain
registration itself (roughly $10–15/year instead of ~$200/year on Squarespace).

## Files

| File | What it is |
|---|---|
| `index.html` | The whole homepage — nav, hero, work portfolio, about, shop, contact |
| `styles.css` | Design tokens (colors, fonts, spacing) and all component styles |
| `images/` | Curated photos used by the homepage, plus `logo.png` |
| `images/originals/` | Full archive of all 248 photos from the old Squarespace site, organized by page |
| `MIGRATION.md` | Every page's text, all shop prices/descriptions, and which photos belong to which page |
| `content.json` / `imgmap.json` | Machine-readable versions of the migrated text and page→photo map |

All photos, text and prices from the old Squarespace site were pulled into this
repo on 2026-07-18, so nothing is lost when the subscription is cancelled. The
homepage already uses a curated selection; `MIGRATION.md` is the checklist for
rebuilding the remaining portfolio and shop pages from the archive.

## Previewing locally

Just open `index.html` in a browser, or run a tiny server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding your photos

The hero, all six work cards, and the three shirt photos already use real
images pulled from your old site (stored in `images/`). Every image is a local
file — nothing loads from Squarespace anymore, so the homepage will keep working
after you cancel.

The **one** remaining placeholder is the About portrait — the old site never had
a photo of you, so it shows a striped box. To add one:

1. Drop a photo into `images/` (e.g. `portrait.jpg`).
2. In `index.html`, find the `<div class="img-slot">Add a photo of Max in the shop</div>`
   and replace it with the `<img>` tag shown in the comment right above it.

Plenty more of your photos are archived in `images/originals/` if you'd rather
use one of those.

## Instagram feed

The "Fresh from the workshop" section on the homepage currently shows a
hand-picked grid of your past posts. To make it **update automatically every
time you post to Instagram**, connect a free feed widget — Instagram itself
requires a one-time login to authorize any live feed, so this is a five-minute
setup you do once:

1. Go to [behold.so](https://behold.so) and create a free account (the free tier
   shows a live feed that refreshes on its own).
2. Connect your `@mcgrossman` Instagram account and create a feed. Behold gives
   you two lines: a `<script …>` tag and a `<behold-widget feed-id="…">` tag.
3. In `index.html`, find the `<!-- INSTAGRAM -->` section and replace the whole
   `<div class="mg-iggrid"> … </div>` block with the `<behold-widget …>` line,
   and paste the `<script …>` line just before `</body>` at the bottom of the file.

That's it — from then on the section mirrors your Instagram automatically.
(LightWidget and SnapWidget work the same way if you prefer one of those.)

## Publishing (free hosting)

Any of these work; GitHub Pages is simplest since the code already lives here:

**GitHub Pages** (recommended)
1. On GitHub: repo **Settings → Pages → Source: Deploy from a branch**, pick the
   main branch, `/ (root)` folder.
2. The site goes live at `https://<username>.github.io/maxgrossman.com/`.
3. To use the real domain: in the same Pages settings, add `maxgrossman.com` as
   the custom domain and enable "Enforce HTTPS".

Alternatives: [Cloudflare Pages](https://pages.cloudflare.com) and
[Netlify](https://netlify.com) — both have free tiers, connect directly to this
GitHub repo, and redeploy automatically on every push.

## Moving the domain off Squarespace

1. In Squarespace: **Settings → Domains → maxgrossman.com → Transfer domain**,
   unlock it and copy the transfer (EPP) code.
2. Start a transfer at a registrar such as Cloudflare Registrar (at-cost,
   ~$10/yr), Porkbun, or Namecheap, and paste the code. Transfers take up to
   5–7 days and add a year of registration.
3. Once transferred, point DNS at your host. For GitHub Pages:
   - `A` records on the apex (`maxgrossman.com`) → `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record on `www` → `<username>.github.io`
4. Keep the site live during the switch: don't cancel the Squarespace plan until
   the new site is up on the domain and the shirt images have been moved over.

Note: email that comes with the domain (e.g. `max@maxgrossman.com` via Google
Workspace or Squarespace email) keeps working as long as the MX records are
copied to the new DNS — check what MX records exist before switching.

## The store

The Shop section is currently a showcase — the cards don't check out. Options
for real purchases without a monthly platform fee, roughly in order of effort:

1. **Stripe Payment Links** — create a link per product in the Stripe dashboard
   and point each shirt card's `href` at it. No monthly fee, ~3% per sale.
2. **Snipcart or a "Buy" button embed** — adds a cart overlay to this static site.
3. **Print-on-demand storefront** (Printful/Printify) — they print and ship the
   shirts; link the cards to that storefront.
