# Orlando Call Map (Netlify version)

Live map of police, fire, medical and traffic calls inside Orlando city limits, funded by monthly supporters, who choose their own amount and get radius alerts by text and email.

## How it runs on Netlify

| Piece | What it does |
|---|---|
| `netlify/functions/poll-scheduled.mjs` | Runs every 5 minutes: fetches the agency feeds, saves calls, places them on the map, sends alerts. Stops at about 24 seconds (Netlify's limit is 30) and finishes any leftover addresses on the next run. |
| `netlify/functions/poll-now.mjs` | Visit `/api/poll-now` to run a poll immediately and see a report. Use it for setup and troubleshooting. |
| `netlify/functions/page.mjs` | Builds the map pages (`/` and `/area/...`) with the live call list in the HTML, so Google can read it. |
| Other functions | Call data, signup, Stripe webhook, manage page, sitemap, robots.txt. |
| Netlify Blobs | Stores calls, subscribers and the address cache. Built in, nothing to set up. |
| `public/` | Static pages, styles and map scripts. Copied to `dist/` at build time. |

The map in visitors' browsers refreshes every 5 minutes. Each call stays on the map for 45 minutes from when it first appears.

## Deploy (about 15 minutes)

1. **Put the code on GitHub.** Create a new repository and upload this folder (GitHub's website lets you drag and drop files).
2. **Create the site.** In Netlify: Add new project > Import an existing project > pick the repo. Netlify reads `netlify.toml`, so leave the build settings as they are.
3. **Add environment variables.** Site configuration > Environment variables. Copy every line from `.env.example` and fill in real values. At minimum for launch: `BASE_URL`, `SITE_NAME`, `CONTACT_EMAIL`. Variables put in `netlify.toml` are not visible to functions, so always use the dashboard.
4. **Redeploy** (Deploys > Trigger deploy) so the build picks up the variables.
5. **Connect your domain.** Domain management > Add a domain. You can buy it through Netlify or point one bought elsewhere. Netlify adds free HTTPS automatically. Then set `BASE_URL` to `https://yourdomain.com` and redeploy.
6. **Check it's working.** Open `https://yourdomain.com/api/poll-now`. It runs a poll right away and shows how many calls each feed returned, how many were placed on the map, and any errors. Then open the home page. After that, the 5-minute schedule keeps it updated; `/api/health` shows the last run time.
7. **Make the project public.** New Netlify projects start private. Open your site in a private/incognito window; if it asks you to log in, publish the project from its settings so visitors (and search engines) can see it.

Scheduled functions only run on your published production site, not on preview deploys.

## Plan and cost

Netlify's Free plan has hard monthly limits, and when you run out the site pauses until the next month. Polling every 5 minutes plus normal visitor traffic uses a steady amount of compute, so for a paid service use the **Personal** or **Pro** plan with auto-recharge turned on. Watch Usage & billing for the first couple of weeks to see your real usage. The pages are cached at Netlify's edge for 30–60 seconds, which keeps function usage low even when many people visit at once.

## Data sources

The site covers the City of Orlando only, using two public feeds that give block-level locations:

| Agency | Variable |
|---|---|
| Orlando Police | `OPD_FEED_URL` (default: the city's public XML feed) |
| Orlando Fire | `OFD_FEED_URL` (default: the city's public XML feed) |

Before charging money, email the city's public-information office to let them know you're republishing the feeds, so your requests don't get blocked.

To expand beyond city limits later, add another feed to `FEEDS` in `src/feeds.js`. The parser already reads XML, JSON and HTML tables.

## Payments (Stripe)

1. Put your Stripe secret key in `STRIPE_SECRET_KEY`. No price setup is needed: each supporter picks an amount, and the site creates a matching monthly price at checkout.
2. Optional: create a Product named "Orlando Call Map monthly support" and put its ID (`prod_...`) in `STRIPE_PRODUCT_ID`, so all supporters appear under one product in your dashboard.
3. Set `SUPPORT_MIN_DOLLARS` (default 3) and `SUPPORT_PRESETS` (default `5,10,15`). Keep the minimum high enough to cover a supporter's text-message costs.
4. Developers > Webhooks > Add endpoint: `https://yourdomain.com/webhooks/stripe`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Turn on the Customer Portal (Settings > Billing > Customer portal) so supporters can cancel and update their card on their own. Supporters change their monthly amount on their manage page; the new amount starts with their next bill.
6. Test with Stripe test keys and card 4242 4242 4242 4242 before switching to live keys.

**Wording matters.** The site calls this "support," not "donations," and says it isn't tax-deductible, because supporters receive alerts in return and the project isn't a registered nonprofit. Keep it that way unless you form a nonprofit. If you do, talk to an accountant about Florida's charitable-solicitation registration before asking for donations.

## Advertising (Google AdSense)

The map pages have one ad spot in the side panel, below the call list and notes. It's labeled "Advertisement," and there are no pop-ups and no ads on the map or between calls. Supporters never see it: finishing checkout or opening their manage link marks that browser as ad-free, and the ad script isn't loaded for them at all. If someone stops supporting, ads come back.

1. Apply at adsense.google.com with your live domain. Approval can take from a few days to a few weeks and isn't guaranteed. Google reviews content, traffic and your Terms and Privacy pages.
2. Once approved, create a **Display ad unit** (responsive). Copy the publisher ID (`ca-pub-...`) into `ADSENSE_CLIENT` and the ad unit's numeric ID into `ADSENSE_SLOT`, then redeploy. The build creates `/ads.txt` for you.
3. In AdSense, leave **Auto ads off**. Auto ads would place more ads around the site, including over the map.
4. In AdSense > Privacy & messaging, turn on Google's consent messages for Europe and for US state privacy laws. Google requires this before serving ads to those visitors.
5. Consider blocking sensitive ad categories (for example dating or gambling) in AdSense > Blocking controls, since ads appear next to emergency calls.

If the ad box never appears, open the browser console on the map page and look for "Content Security Policy" errors; ad hosts are allowed in `src/http.js`.

## Alert delivery

- **Email:** any SMTP service (Postmark, Resend, SendGrid, Amazon SES). Set up SPF and DKIM on your domain so alerts don't land in spam.
- **Text:** Twilio. US business texting requires A2P 10DLC registration, which takes 1–3 weeks. Start early.

Alerts go out when the poller finds a new call, so they arrive up to 5 minutes after the agency posts it.

## Map tiles

The default OpenStreetMap tiles are fine for testing, but their usage policy doesn't allow heavy commercial use. Before launch, sign up with Stadia Maps, MapTiler or Thunderforest and set `TILE_URL` (with your key) and `TILE_ATTRIBUTION`.

## Search engines

Built in: server-rendered pages with the live call list, unique titles and descriptions, canonical URLs, social preview tags, structured data, `/sitemap.xml`, `/robots.txt`, and 12 Orlando neighborhood pages (Downtown, College Park, Lake Nona, MetroWest and others).

After launch:
1. Add the site to Google Search Console and Bing Webmaster Tools and submit `https://yourdomain.com/sitemap.xml`.
2. Add `public/og.png` (1200×630) for link previews.
3. Get a few local links: Orlando subreddits, neighborhood Facebook groups, Nextdoor, HOA newsletters.
4. Add more Orlando neighborhoods in `AREAS` in `src/config.js` (for example Vista Park, Dover Shores, Lake Fairview). The center points are approximate; adjust them if a neighborhood page shows too few or too many calls.

## Local development (optional)

```bash
npm install
cp .env.example .env
npx netlify dev          # http://localhost:8888
# then open http://localhost:8888/api/poll-now to run a poll
```

## Before launch checklist

- [ ] Lawyer reviews `public/terms.html` and `public/privacy.html`
- [ ] `/api/poll-now` shows both Orlando feeds working
- [ ] Paid map tiles configured
- [ ] Stripe live key, webhook and customer portal; minimum amount set
- [ ] Email with SPF/DKIM; Twilio registration approved
- [ ] Personal or Pro Netlify plan with auto-recharge on
- [ ] AdSense approved, `ADSENSE_CLIENT`/`ADSENSE_SLOT` set, Auto ads off, consent messages on
