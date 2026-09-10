# Setting this up, step by step

Written to be followed start to finish without knowing any of the background.
Nothing here needs a terminal, and everything is free.

There are three separate jobs. **They don't depend on each other**, so you can
stop after any one of them and still have something that works:

| | What you get | Roughly |
|---|---|---|
| **A** | Start using the planner today, at its GitHub address | 10 min |
| **B** | The real site at `maxgrossman.com`, planner at `/planner/` | 30 min + waiting |
| **C** | Phone and laptop sharing one set of numbers | 30 min |

---

## A. Start using it today

The planner is already live here:

**https://sumrandomguy3.github.io/maxgrossman.com/planner/**

That address works right now and keeps working forever, even after the domain
moves. Nothing links to it and search engines are told to ignore it.

1. Open it on your laptop. Bookmark it.
2. Open it on your phone too. In Safari tap **Share → Add to Home Screen**
   (Chrome: **⋮ → Add to Home screen**). It gets an icon like an app.
3. Go to **Settings** and set **Hours / week** to the number of shop hours you
   *actually* get in a normal week. Not a good week. This one number drives
   every other number in the app, and guessing high is exactly how West Orange
   happened.
4. Go to **Stock**. Add each thing you sell at markets, with how long **one**
   takes you start to finish — including sanding, oiling and finishing, not
   just the fun part. Put in how many you have on the shelf right now.
5. Go to **Markets**. Add your next few fairs with their dates, then open
   **Targets** on each and type how many of each item you want on the table.
6. Go to **Commissions**. Add anything already promised to someone — including
   a made-to-order shirt when an order comes in — with your honest hours and
   the date it's due.
7. Go back to **Plan**. The top card tells you what to put on the bench this
   week. That's the whole tool.

> ⚠️ At this stage the numbers live in **that one browser**. Your phone and your
> laptop each keep their own separate copy. Job C fixes that. Until then, use
> one device, and use **Settings → Export backup** now and then.

---

## B. Point maxgrossman.com at the new site

Right now `maxgrossman.com` still shows the Squarespace site. This moves it to
the new one. **You are keeping Squarespace as the place the domain is
registered** — you're only changing where it points. Nothing is being
transferred, so there is no 5–7 day wait and no transfer code.

### B1. Write down your email settings first

This is the one step with real consequences. If you have email at
`@maxgrossman.com`, it is controlled by **MX records**, and losing them means
mail silently stops arriving.

1. In Squarespace, go to **Settings → Domains → maxgrossman.com → DNS Settings**.
2. **Screenshot the whole list.** Every row.
3. Find any rows of type **MX**. Leave those completely alone for the rest of
   this. You are only touching rows of type **A** and **CNAME**.

If there are no MX records, you have no email on this domain and there's
nothing to protect.

### B2. Change where the domain points

Still on that DNS Settings page:

1. **Delete** the existing **A** records whose Host is `@` (they point at
   Squarespace's servers).
2. **Add four new A records**, all with Host `@`:

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   Four separate rows, same Host, one address each. These are GitHub's.
3. Find the **CNAME** record with Host `www` and change its value to:

   ```
   sumrandomguy3.github.io
   ```

   If there isn't one, add it.
4. Save. **Do not touch the MX rows.**

### B3. Tell GitHub the domain is yours

1. Go to https://github.com/sumrandomguy3/maxgrossman.com/settings/pages
2. Under **Custom domain**, type `maxgrossman.com` and press **Save**.
3. It will check the DNS. A green tick means it worked. A warning usually just
   means DNS hasn't spread yet — wait and press Save again.
4. Once the tick appears, wait for the **Enforce HTTPS** checkbox to become
   available and tick it. This can take up to 24 hours; it's normal, and the
   site works in the meantime.

### B4. Check, then tidy up

Wait 10 minutes to a few hours, then in a **private/incognito window**:

- `https://maxgrossman.com` → the new site
- `https://www.maxgrossman.com` → also the new site
- `https://maxgrossman.com/planner/` → the planner
- Send yourself an email at your `@maxgrossman.com` address and confirm it
  arrives

**Only once all four are right**, cancel the Squarespace *website* subscription.
Keep the *domain registration* — that's a separate line item, and cancelling it
would lose the domain.

Next September, when the domain renews, you can move the registration to
Cloudflare (about $10/year instead of Squarespace's price). Nothing in this
setup breaks when you do.

---

## C. Share one set of numbers across phone and laptop

Without this, each browser keeps its own copy and they drift apart. This puts
the numbers in one place both devices read from.

You need a free Cloudflare account. **No credit card, no terminal, no domain**
— this works whether or not you've done job B.

### C1. Make the account

1. Go to https://dash.cloudflare.com/sign-up and sign up.
2. If it pushes you to "add a website", you can skip that. Go straight to
   **Workers & Pages** in the left sidebar.

### C2. Make the storage

1. Left sidebar → **Storage & Databases → KV**.
2. **Create a namespace**. Name it exactly:

   ```
   BENCH
   ```
3. Create.

### C3. Make the Worker

1. Left sidebar → **Workers & Pages → Create → Start with Hello World! → Deploy**.
   Name it `bench-sync`. You now have a do-nothing Worker; that's fine.
2. Click **Edit code**.
3. Open `planner/worker/src/index.js` from your repo on github.com, click the
   **copy** icon, and paste it over *everything* in the Cloudflare editor,
   replacing what's there.
4. **Deploy**.

### C4. Wire the three settings

In the Worker's **Settings** tab:

1. **Bindings → Add → KV namespace**
   - Variable name: `BENCH`
   - Namespace: the `BENCH` you made in C2
2. **Variables and Secrets → Add → type: Secret**
   - Name: `SYNC_PASSPHRASE`
   - Value: a long passphrase you invent. Four random words is ideal —
     `walnut-chisel-porch-lantern`. **Write it down**, you'll type it on each
     device. This is the only thing protecting your numbers.
3. **Variables and Secrets → Add → type: Plaintext**
   - Name: `ALLOWED_ORIGIN`
   - Value — paste both addresses, comma separated, so it works before *and*
     after the domain switch:

     ```
     https://maxgrossman.com,https://sumrandomguy3.github.io
     ```

Deploy after saving.

### C5. Get the address

At the top of the Worker page is its address, like:

```
https://bench-sync.something.workers.dev
```

Copy it. This address does **not** change when your domain moves.

### C6. Connect your devices

On your **laptop**:

1. Open the planner → **Settings → Sync across devices**.
2. **Sync URL**: paste the `workers.dev` address from C5.
   (Clear out the `/api/bench` that's pre-filled — that's for a different
   setup.)
3. **Passphrase**: the one from C4.
4. **Connect.** The top of the page should show **synced**.

On your **phone**, same two values. When it asks, choose:

- **OK / replace** — the phone had nothing real on it yet (most likely)
- **Cancel / merge** — you'd entered real numbers on both and want to keep both

Test it: change a count on your phone, wait a couple of seconds, then open the
laptop. The new number should be there.

---

## Things worth knowing

- **Offline is fine.** At a market with no signal, edits save on the device and
  go up when you're back in range.
- **Both devices at once is fine.** Editing spoons on the phone while editing
  vases on the laptop keeps both changes. Only editing *the same item* at the
  same moment picks a winner.
- **The address is not a secret, the passphrase is.** Anyone with the link can
  load the page, but they see nothing without the passphrase. It's stored on
  each device and is never part of the page.
- **Still export a backup occasionally.** Settings → Export backup.
- **It's free.** Cloudflare's free tier allows 1,000 writes a day; this uses a
  handful.

## If something looks wrong

| What you see | What it means |
|---|---|
| Chip says **passphrase rejected** | Typo, or the secret in C4 doesn't match. Re-enter on the device. |
| Chip says **sync failed** | Usually `ALLOWED_ORIGIN` doesn't include the address you're loading the page from. Check C4 step 3. |
| Chip says **offline — queued** | No connection. It'll catch up on its own. |
| Planner page is blank | Hard refresh: `Ctrl+Shift+R`, or on a phone close the tab and reopen. |
| GitHub Pages shows a DNS warning | DNS hasn't spread yet. Wait, press Save again. |
| `maxgrossman.com` still shows the old site | Your browser cached it. Try a private window. |
