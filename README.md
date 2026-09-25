# Orlando Call Map (Netlify version)

Live map of police, fire, medical and traffic calls in Orlando and Orange County, FL, with $10/month radius alerts by text and email.

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

## Data sources (do this first)

| Agency | Variable | Status |
|---|---|---|
| Orlando Police | `OPD_FEED_URL` | Default is the city's public XML feed. Confirm it opens in a browser. |
| Orlando Fire | `OFD_FEED_URL` | Same. |
| Orange County Sheriff | `OCSO_FEED_URL` | You must find this. On a computer, open https://www.ocso.com/calls-for-service/, press F12, open the Network tab, reload, and find the request that returns the list of calls. Paste its URL. |

The parser auto-detects XML or JSON and common field names. If a feed uses unusual names, add them to `FIELD` in `src/feeds.js`.

Before charging money, email each agency's public-information office to let them know you're republishing their feed, so your requests don't get blocked.

## Payments (Stripe)

1. Create a Product "Radius alerts" with a recurring Price of $10/month. Put its price ID in `STRIPE_PRICE_ID` and your secret key in `STRIPE_SECRET_KEY`.
2. Developers > Webhooks > Add endpoint: `https://yourdomain.com/webhooks/stripe`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the Customer Portal (Settings > Billing > Customer portal) so subscribers can cancel on their own.
4. Test with Stripe test keys and card 4242 4242 4242 4242 before switching to live keys.

## Alert delivery

- **Email:** any SMTP service (Postmark, Resend, SendGrid, Amazon SES). Set up SPF and DKIM on your domain so alerts don't land in spam.
- **Text:** Twilio. US business texting requires A2P 10DLC registration, which takes 1–3 weeks. Start early.

Alerts go out when the poller finds a new call, so they arrive up to 5 minutes after the agency posts it.

## Map tiles

The default OpenStreetMap tiles are fine for testing, but their usage policy doesn't allow heavy commercial use. Before launch, sign up with Stadia Maps, MapTiler or Thunderforest and set `TILE_URL` (with your key) and `TILE_ATTRIBUTION`.

## Search engines

Built in: server-rendered pages with the live call list, unique titles and descriptions, canonical URLs, social preview tags, structured data, `/sitemap.xml`, `/robots.txt`, and 15 neighborhood pages.

After launch:
1. Add the site to Google Search Console and Bing Webmaster Tools and submit `https://yourdomain.com/sitemap.xml`.
2. Add `public/og.png` (1200×630) for link previews.
3. Get a few local links: Orlando subreddits, neighborhood Facebook groups, Nextdoor, HOA newsletters.
4. Add more neighborhoods in `AREAS` in `src/config.js`.

## Local development (optional)

```bash
npm install
cp .env.example .env
npx netlify dev          # http://localhost:8888
# then open http://localhost:8888/api/poll-now to run a poll
```

## Before launch checklist

- [ ] Lawyer reviews `public/terms.html` and `public/privacy.html`
- [ ] `/api/health` shows every feed working
- [ ] Paid map tiles configured
- [ ] Stripe live keys, price, webhook and customer portal
- [ ] Email with SPF/DKIM; Twilio registration approved
- [ ] Personal or Pro Netlify plan with auto-recharge on
