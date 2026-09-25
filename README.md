# Orlando Call Map

Live map of police, fire, medical and traffic calls in Orlando and Orange County, FL, with $10/month radius alerts by text and email.

- Pulls official "active calls" feeds every 5 minutes (server) and refreshes the map every 5 minutes (browser, with a countdown).
- Each call stays on the map for 45 minutes from when it first appears, fading as it ages, then drops off.
- Subscribers pick an address, a radius (0.25–10 mi), and call types. Up to 3 places per subscriber. Stripe handles billing; Twilio sends texts; any SMTP provider sends email.
- Pages are server-rendered with real call lists, per-neighborhood landing pages, a sitemap, robots.txt and structured data so search engines can index them.

## 1. Run it locally

```bash
npm install
cp .env.example .env      # fill in what you have; everything is optional for a first run
npm run dev               # http://localhost:3000
```
Check feed status any time at `/api/health`.

## 2. Data sources (do this first)

| Agency | Feed | Status |
|---|---|---|
| Orlando Police (OPD) | `OPD_FEED_URL` | Default URL is the city's public XML feed. Confirm it loads in a browser. |
| Orlando Fire (OFD) | `OFD_FEED_URL` | Same as above. |
| Orange County Sheriff (OCSO) | `OCSO_FEED_URL` | You must find this. Open https://www.ocso.com/calls-for-service/ on a computer, press F12, go to the Network tab, reload, and look for the request that returns the call list (XML or JSON). Paste that URL here. |

The parser auto-detects XML or JSON and common field names (incident, desc/type, location/address, date/entrytime, zip). If a feed uses unusual field names, add them to `FIELD` in `src/feeds.js`.

Why dispatch feeds and not radio audio: most Orange County law-enforcement talkgroups are encrypted, transcribing radio is unreliable for addresses, and scanner-stream sites don't allow reuse in commercial products. The dispatch feeds carry the same calls with cleaner data. Unincorporated fire/EMS (Orange County Fire Rescue) doesn't publish an open feed; you could request one from the county.

Before charging money, email each agency's public-information office to say you're republishing their feed. It's public data, but a heads-up avoids having your server blocked.

## 3. Deploy

Any Node 20 host with a persistent disk works (SQLite file). Easiest options:

- **Render**: New Web Service from your GitHub repo, start command `npm start`, add a Disk mounted at `/data`, set `DB_PATH=/data/callmap.db`. About $7–10/month.
- **Railway** or **Fly.io**: use the included `Dockerfile` and attach a volume.

Set every variable from `.env.example` in the host's dashboard. `BASE_URL` must be your real domain with https.

## 4. Payments (Stripe)

1. Create a Product "Radius alerts" with a recurring Price of $10/month. Copy the price ID into `STRIPE_PRICE_ID`.
2. Add a webhook endpoint `https://YOURDOMAIN/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the Customer Portal (Settings → Billing → Customer portal) so people can cancel themselves.

## 5. Alerts delivery

- **Email**: any SMTP service (Postmark, Resend, SendGrid, Amazon SES). Set up SPF/DKIM on your domain so alerts don't land in spam.
- **Text**: Twilio. US business texting requires A2P 10DLC registration (brand + campaign), which takes 1–3 weeks. Start this early. Budget roughly $0.01 per text plus carrier fees.

Alert timing: a call is detected on the next poll, so alerts arrive up to `POLL_MINUTES` after the agency posts it. Setting `POLL_MINUTES=1` makes alerts faster; the map still shows the 5-minute countdown only if you keep it at 5. If you want both, poll every minute and leave the browser refresh at 5 (change `POLL_MS` in `public/app.js`).

## 6. Map tiles

The default OpenStreetMap tile server is fine for testing but its usage policy doesn't allow heavy commercial traffic. Before launch, sign up for Stadia Maps, MapTiler or Thunderforest, and set `TILE_URL` (with your key) and `TILE_ATTRIBUTION`.

## 7. Getting found on search engines

Already built in: server-rendered HTML with the live call list, unique titles and descriptions per page, canonical URLs, Open Graph tags, JSON-LD (WebSite, WebPage with Place, BreadcrumbList), `/sitemap.xml`, `/robots.txt`, fast pages, mobile layout, and 15 neighborhood pages (`/area/winter-park`, `/area/lake-nona`, etc.) targeting searches like "police activity Winter Park today".

After launch:
1. Add the site to **Google Search Console** and **Bing Webmaster Tools**, verify the domain, and submit `https://YOURDOMAIN/sitemap.xml`.
2. Create `public/og.png` (1200×630) so shared links show a preview image.
3. Earn a few local links: Orlando subreddits, neighborhood Facebook groups, Nextdoor, HOA newsletters, local news tip lines. Local links matter more than anything else here.
4. Add more `/area/` pages in `src/config.js` for neighborhoods people search (College Park, Baldwin Park, Hunters Creek, MetroWest, Avalon Park).
5. Consider a daily "calls in Orange County today" archive page later; fresh, indexable content helps rankings more than the live map alone.

## 8. Before launch checklist

- [ ] Have a lawyer review `public/terms.html` and `public/privacy.html`.
- [ ] Confirm all feed URLs return data (`/api/health`).
- [ ] Paid tile provider configured.
- [ ] Stripe live keys, price, webhook, customer portal.
- [ ] SMTP with SPF/DKIM; Twilio 10DLC approved.
- [ ] Test a full signup with a Stripe test card (4242 4242 4242 4242) using test keys first.
