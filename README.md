# OGsmith — Open Graph images as an API

A monetizable micro-SaaS: generate beautiful 1200×630 social-card PNGs
(Open Graph / Twitter cards) from a single GET request. Customers point their
`<meta property="og:image">` tag at the API and never open a design tool again.

```
GET /api/og?key=og_yourkey&template=split&title=My%20post&site=myblog.com&accent=%23f43f5e
→ image/png, 1200×630
```

## Why this is a business

- **Proven market.** Bannerbear, Placid, and Dynapictures charge $29–$89/mo for
  the same job. OGsmith undercuts them at $9/mo with a developer-first API.
- **Near-zero marginal cost.** Rendering uses satori (no headless browser), so
  it runs on serverless functions; responses are CDN-cached, so most crawler
  traffic never even hits the API. Free tier costs pennies.
- **Built-in funnel.** Free renders carry a "made with OGsmith" watermark —
  every free user's social feed advertises the product. Paid plans remove it.

| Plan  | Price  | Renders/mo | Watermark |
| ----- | ------ | ---------- | --------- |
| Free  | $0     | 500        | Yes       |
| Pro   | $9/mo  | 20,000     | No        |
| Scale | $29/mo | 150,000    | No        |

## What's inside

- **Next.js 16** (App Router, TypeScript, Tailwind) — landing page with live
  playground, template gallery, docs, pricing, terms/privacy, sitemap/robots.
- **Image API** — `GET /api/og` with 6 templates (gradient, minimal, split,
  terminal, quote, announce), dark/light themes, accent colors, auto-scaling
  typography. Rendered with `next/og` (satori) + bundled Inter fonts (OFL).
- **Auth** — email + password (bcrypt), JWT session cookies (jose), email
  verification and password reset (single-use hashed tokens; sends via Resend
  when `RESEND_API_KEY` is set, logs to console otherwise).
- **API keys** — up to 10 named keys per account (e.g. per site/environment),
  SHA-256 hashed at rest, shown once, independently revocable, with per-key
  monthly render counts and last-used timestamps on the dashboard.
- **Brand defaults** — saved template/theme/accent/site per account, applied
  to authenticated renders when a parameter is omitted, so image URLs can be
  as short as `?key=…&title=Hello` (explicit params always win).
- **Signed URLs** — alternative auth mode: HMAC-SHA256-signed image URLs
  (`acct` + `sig`) bind the exact parameters, so leaked links can't be reused
  or modified; per-account rotatable signing secret.
- **Usage API** — `GET /api/usage` (Bearer key) returns plan, used, remaining;
  the dashboard shows a 6-month usage history chart.
- **Metering** — per-user monthly render counters with hard quota enforcement
  (429 when exceeded; no overage billing surprises).
- **Billing** — Stripe Checkout subscriptions + customer portal + webhook
  sync. Degrades gracefully: without Stripe env vars the app runs fine and
  upgrade buttons explain billing isn't configured yet.
- **Database** — SQLite/libSQL via Drizzle ORM: `file:local.db` locally,
  [Turso](https://turso.tech) in production (free tier is plenty to start).
- **Tests** — 22 vitest unit tests over keys, quotas, params, and auth.

## Local development

```bash
npm install
cp .env.example .env          # set AUTH_SECRET (openssl rand -hex 32)
npm run db:migrate            # creates local.db
npm run dev
```

Run tests with `npm test`. Build with `npm run build`.

## Deploying to production (≈30 minutes)

1. **Database (Turso, free):**
   `turso db create ogsmith` → set `DATABASE_URL` (libsql://…) and
   `DATABASE_AUTH_TOKEN`, then run `npm run db:migrate` once with those vars.
2. **Host (Vercel, free):** import the repo, set env vars from `.env.example`
   (`AUTH_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`,
   `NEXT_PUBLIC_APP_URL=https://your-domain`).
3. **Stripe:** create two recurring prices (Pro $9/mo, Scale $29/mo), set
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`. Add a
   webhook endpoint `https://your-domain/api/stripe/webhook` subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`.
4. **Email (Resend, free tier):** set `RESEND_API_KEY` and `EMAIL_FROM` to
   send real verification/reset emails; without them the flows log links to
   the server console.
5. **Domain:** point one at the deployment and update `NEXT_PUBLIC_APP_URL`.

## Roadmap ideas

- Custom fonts / logo upload per account (paid-tier differentiator)
- Team accounts with shared billing
- Webhook/email alerts when nearing the monthly quota
