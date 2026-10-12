# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, served separately:

- **Developers** adding social cards to a site or app. Job: make every page show a proper 1200×630 link preview without running a headless browser, a design tool or a build step.
- **Marketing and content teams** who share links. Job: get on-brand previews on every post, find out which design gets clicks, and fix previews on links already shared, without waiting on a developer beyond adding one tag once. Served today by `/for/marketing`.

The homepage serves both through the free link checker; each audience then has its own dedicated page (`/for/marketing` exists; a developer page is planned).

## Product Purpose

OGsmith renders Open Graph images on demand from a single GET request, so shared links stop showing blank or broken previews. Success: a visitor checks a link, sees what each platform shows today, and adds one `og:image` tag so every future share gets a card.

## Positioning

The reason to choose OGsmith over Bannerbear, Placid or building it with @vercel/og is all three together, not one alone:

- **Price:** from $19/mo, against $29–89/mo for comparable services.
- **Developer simplicity:** one tag, one GET request, no headless browser; works on any site that can set a meta tag.
- **The full loop:** check what platforms show, A/B test designs with a significance test, and update cards on links already shared via a cache version.

## Operating Context

- Entry point is the free link checker: no account, previews for X, LinkedIn, Slack, Discord, WhatsApp, Facebook and iMessage, with per-platform checker pages under `/check/[platform]`.
- Setup is one `og:image` meta tag in a site template; with `url=` the card reads each page's own title, description and image.
- After setup, designs, brand defaults, tests and refreshes happen in the dashboard. A rebrand needs a redeploy for the new cache version to reach already-shared links.
- Integrations in the repo: a WordPress plugin (`wordpress-plugin/`) and an MCP package (`packages/mcp`).

## Capabilities and Constraints

- Seven templates (gradient, minimal, split, terminal, quote, announce, link), dark/light themes, accent colours; visual editor with brand font and logo upload.
- A/B testing with significance; CSV batch rendering to zip with signed webhook; signed URLs; usage API; up to 10 API keys per account.
- Plans (prices net of tax, VAT added at checkout; EU reverse charge with tax ID): Free $0 with 500 renders/mo; Pro $19/mo, 20,000 renders; Scale $49/mo, 150,000 renders. Yearly billing is ten months' price. Flat quotas, no overage charges.
- Free accounts render clean for 14 days, then new renders carry a watermark. Cards platforms already fetched keep their clean cached copy.
- Demo renders on the public site are watermarked and rate limited.

## Brand Commitments

- Name: OGsmith. Tagline: "Open Graph images as an API. Every link, forged into a card."
- Voice: plain, honest and specific; acknowledges competitors fairly (e.g. that @vercel/og is free and good).

## Evidence on Hand

- No customers, usage figures or testimonials yet. Future work must not invent any.
- Available demonstrations: the live checker, the live playground, and showcase cards (`/showcase/blog`, `/changelog`, `/docs`, `/store`), which are examples, not customers. The `blog.acme.dev` example is fictional and must stay presented as an example.

## Product Principles

1. Show value before asking for anything: the checker works without an account.
2. One tag, then hands-off: anything after setup should not need a developer.
3. Demonstrate instead of claiming: with no social proof, the product's own output is the evidence.
4. Each audience gets its own language: developer detail lives on developer surfaces, not on the shared homepage.
5. No surprises in billing: flat quotas, clear trial terms, soft landings.
