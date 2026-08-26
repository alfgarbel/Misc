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
  as short as `?key=…&title=Hello` (explicit params always win). Paid plans
  can upload a logo (≤60KB PNG/JPEG/GIF, stored as a data URI — no blob
  storage needed) that renders on every card.
- **Quota alert emails** — one email at 80% of quota and one at the cap,
  at most once each per month (claimed atomically, safe under concurrency).
- **Abuse protection** — per-IP rate limits on login, signup, password reset
  (request + submit), and demo renders; a constant-time login path (no
  account-existence timing oracle); security headers (nosniff, frame-deny,
  HSTS, referrer & permissions policies) on every response.
- **Admin metrics** — `/admin` (emails listed in `ADMIN_EMAILS`, verified
  accounts only; others get a 404): MRR, plan mix, signups/day, renders/month,
  top accounts, active keys.
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
- **Tests** — 60 vitest unit tests over keys, quotas, signing, tokens, alerts,
  rate limiting, brand validation, admin metrics, params, and auth.

## Local development

```bash
npm install
cp .env.example .env          # set AUTH_SECRET (see below)
npm run db:migrate            # creates local.db
npm run dev
```

Generate `AUTH_SECRET` with Node, which works identically in PowerShell and
bash (no `openssl` required):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run tests with `npm test`. Build with `npm run build`.

## Deploying to production (≈30 minutes)

0. **Branch:** the code lives on `claude/saas-product-creation-cxufyo`. Merge it
   into your default branch first, or point Vercel's production branch at it —
   Vercel deploys the default branch and will otherwise find nothing.
1. **Database (Turso, free):** create a database in the
   [Turso dashboard](https://turso.tech) (no CLI needed — their `curl | bash`
   installer is macOS/Linux only), then copy its `libsql://` URL and a database
   token into `DATABASE_URL` and `DATABASE_AUTH_TOKEN`. Run migrations once
   against it — `db:migrate` reads real environment variables and does **not**
   parse `.env`:

   ```powershell
   # Windows PowerShell (no inline VAR=value syntax)
   $env:DATABASE_URL="libsql://…"; $env:DATABASE_AUTH_TOKEN="…"
   npm run db:migrate
   ```
   ```bash
   # macOS / Linux
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
   ```
2. **Host (Vercel, free):** import the repo, set env vars from `.env.example`
   (`AUTH_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_EMAILS`,
   `NEXT_PUBLIC_APP_URL=https://your-domain`).
3. **Stripe:** create two recurring prices (Pro $9/mo, Scale $29/mo), set
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`. Add a
   webhook endpoint `https://your-domain/api/stripe/webhook` subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`. Activate
   the Customer portal under Stripe → Settings → Billing, or the "Manage
   billing" button errors.
4. **Email (Resend, free tier):** set `RESEND_API_KEY` and `EMAIL_FROM` to
   send real verification/reset emails; without them the flows log links to
   the server console.
5. **Domain:** point one at the deployment and update `NEXT_PUBLIC_APP_URL`.

## Security notes

- API keys and auth tokens are stored only as SHA-256 hashes; passwords as
  bcrypt hashes. URL signatures are HMAC-SHA256 over an unambiguous
  (percent-encoded) canonical string, compared in constant time.
- Sessions are stateless JWTs (30-day expiry, httpOnly/secure/lax cookies), so
  a password reset does not revoke previously issued sessions before expiry —
  acceptable for v1; move to server-side sessions if this matters to you.
- Rate limits are in-memory per serverless instance: effective against
  single-source abuse, not a distributed attacker. Add an edge rate limiter
  (e.g. Vercel WAF) if that becomes a concern.
- Logo uploads accept only base64 PNG/JPEG/GIF data URIs (≤60KB); SVG is
  rejected deliberately (script risk).

## Roadmap ideas

- Custom fonts per account
- Team accounts with shared billing
