# maxgrossman.com

The website for Max Grossman Designs — furniture designer & maker, West Orange, NJ.

This is a plain static site: plain HTML pages, one stylesheet, no frameworks —
plus one tiny optional script (`tools/build.py`) that keeps the shared nav/footer
in sync and shrinks photos for the web. It can be hosted for free, so the only recurring cost is the domain
registration itself (roughly $10–15/year instead of ~$200/year on Squarespace).

## Files

**New to editing the site? Start with [`HOW-TO-EDIT.md`](HOW-TO-EDIT.md) — the
plain-English guide to changing text, photos and prices.**

| File | What it is |
|---|---|
| `index.html` | The whole homepage — nav, hero, work portfolio, restoration, about, shop, contact |
| `restoration.html`, `seating.html`, … | The restoration page and the portfolio pages |
| `shop.html`, `shop-*.html`, `shop.js` | The store index, one page per product, and the PayPal checkout wiring |
| `styles.css` | Design tokens (colors, fonts, spacing) and all component styles |
| `partials/` | The one shared copy of the nav bar and footer (synced into pages by `tools/build.py`) |
| `tools/build.py` | The only "build step": syncs partials into pages and makes web-sized photo copies |
| `images/` | Curated photos used by the homepage, plus `logo.png` |
| `images/originals/` | Full archive of all 248 photos from the old Squarespace site, organized by page |
| `images/web/` | Auto-generated fast-loading copies of the originals — the pages serve these |
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

## The store

`shop.html` is the store index (products grouped by category); each product has
its own page, `shop-<product>.html` (e.g. `shop-check-the-logs.html`), generated
with photos, price, description, and size/color/wood selectors where relevant.

**Checkout runs on PayPal, wired through one file: `shop.js`.**

- Right now `PAYPAL_MERCHANT` in `shop.js` is empty, so every "Add to cart"
  button falls back to opening a **pre-filled order email** to
  `maxgrossman@outlook.com` (with the item, size/color, and price). The shop is
  usable today with zero setup.
- To turn on real PayPal checkout, put your PayPal account email in that one line:

  ```js
  const PAYPAL_MERCHANT = "you@your-paypal-email.com";
  ```

  Every button then adds the item — with the chosen size/color/wood — to your
  PayPal cart and checks out through PayPal. Same PayPal account as your market
  (Zettle) POS, so all sales land in one place. No monthly fee; PayPal takes its
  standard per-sale cut.

### Inventory sync with your PayPal Zettle POS

Honest answer: a hand-built static site like this **can't do automatic two-way
stock sync** with Zettle — that needs a live backend talking to the Zettle API,
which a plain HTML site doesn't have. Two realistic paths:

1. **Made-to-order (recommended here).** Almost everything in the shop — shirts,
   spoons, vases, kits, toys — is made to order, so there's no fixed stock to
   sync. Leave those as always-available. For genuine one-offs (the Leaf Table,
   a specific finished piece), just remove or mark that product page sold when it
   goes, on whichever channel sells it. Low volume, quick to do by hand.
2. **A platform with a native Zettle integration** (WooCommerce via the official
   "PayPal Zettle for WooCommerce" plugin, or Wix/BigCommerce). Those *do* sync
   stock with Zettle automatically — but they reintroduce a hosted platform (and
   usually a monthly cost), which is the thing we're moving away from. Worth it
   only if you carry real finished-goods inventory and want it tracked live.

## Instagram feed

The "Fresh from the workshop" section on the homepage is a **live Behold feed**
([behold.so](https://behold.so), feed id `XoXLpXGcmHFl1GwgqtGf`) — it updates on
its own every time you post to `@mcgrossman`, no code changes needed.

- The widget itself is the `<behold-widget feed-id="…">` tag inside the
  `<!-- INSTAGRAM -->` section of `index.html`; its loader `<script>` sits just
  before `</body>`.
- To change how it looks (columns, number of posts, spacing), adjust the feed in
  your Behold dashboard — the changes flow through automatically.
- To point it at a different account, create a new feed in Behold and swap the
  `feed-id`.

Note: the feed only renders where the browser can reach `w.behold.so`, so it will
look empty in a purely offline preview but populates normally once the site is
published.

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
