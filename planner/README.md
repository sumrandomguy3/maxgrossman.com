# Bench — market production planner

A private production planner: per-market inventory targets, current stock counts,
and the weekly pace needed to close the gap before the date. It answers, in June,
what needs to be on the bench for a September fair.

**It is not part of the public site.** Nothing links to it, and the page carries a
`noindex` tag so it stays out of search results. Reach it directly at
`https://maxgrossman.com/planner/`.

It is also invisible to `tools/build.py`, which only touches root-level `*.html` —
so it will never have the site nav injected into it.

Source, full documentation and tests live in the
[Market-inventory-](https://github.com/sumrandomguy3/Market-inventory-) repo.
Change it there, then copy `index.html`, `styles.css`, `app.js` and `sync.js` back
into this folder.

**Setting this up for the first time? See [`SETUP.md`](SETUP.md)** — every step
in plain English, no terminal needed.

## Using it on more than one device

Out of the box each browser keeps its own separate copy — the phone and the laptop
would drift apart. To share one dataset, deploy the small Cloudflare Worker in
`worker/` and connect each device to it under **Settings → Sync across devices**.

```sh
cd planner/worker
npx wrangler login
npx wrangler kv namespace create BENCH      # paste the printed id into wrangler.toml
npx wrangler secret put SYNC_PASSPHRASE     # a long passphrase; typed once per device
npx wrangler deploy
```

If maxgrossman.com's DNS is on Cloudflare, uncomment the `[[routes]]` block in
`wrangler.toml` first — the Worker then answers on this same domain and the sync
URL is simply `/api/bench`, with no cross-origin setup at all.

Otherwise use the `*.workers.dev` URL that deploy prints, and set
`ALLOWED_ORIGIN = "https://maxgrossman.com"` in `wrangler.toml`.

The passphrase is stored per-device in the browser and never appears in the page
source, so the page being publicly reachable does not expose the data.
