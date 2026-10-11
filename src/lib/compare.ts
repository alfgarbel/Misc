import { PLANS } from "./plans";
import { TRIAL_DAYS } from "./trial";

/**
 * Honest comparisons with the alternatives people weigh OGsmith against.
 *
 * Every claim about another product comes from its own pricing page or
 * docs, linked in `sources`, and is dated by CHECKED. Where their page
 * doesn't say something (a price, a limit), we don't guess: a comparison
 * caught inventing numbers is worth less than none. Re-check before
 * changing a figure, and move CHECKED when you do.
 */
export const CHECKED = "October 2026";

export interface Comparison {
  slug: string;
  name: string;
  title: string;
  description: string;
  /** One paragraph: what they are, and the honest summary. */
  summary: string;
  rows: Array<{ label: string; them: string; us: string }>;
  chooseThem: string[];
  chooseUs: string[];
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ label: string; href: string }>;
}

const pro = PLANS.pro;
const scale = PLANS.scale;
const n = (v: number) => v.toLocaleString("en-US");

const OUR_PRICE = `Free (${n(PLANS.free.monthlyRenders)} renders, watermark after a ${TRIAL_DAYS}-day trial), Pro $${pro.priceMonthlyUsd}/month for ${n(pro.monthlyRenders)}, Scale $${scale.priceMonthlyUsd}/month for ${n(scale.monthlyRenders)}`;

export const COMPARISONS: Comparison[] = [
  {
    slug: "vercel-og",
    name: "@vercel/og",
    title: "OGsmith vs @vercel/og: build your OG images or call an API",
    description:
      "@vercel/og is a free library you run yourself; OGsmith is a hosted API. How they compare on cost, limits, design work and what happens after a card is shared.",
    summary:
      "@vercel/og (ImageResponse in Next.js) is a free library that turns JSX into a PNG inside your own functions. If you're on Next.js and want one layout you fully control, it's a good choice. OGsmith is the same idea as a hosted service: you send a URL and get the card back, with templates, an editor, cache refresh and testing already built.",
    rows: [
      { label: "What it is", them: "A library you deploy in your own app", us: "A hosted API: one GET request returns the PNG" },
      { label: "Price", them: "Free; you pay for the function time it uses on your host", us: OUR_PRICE },
      { label: "Layout", them: "Flexbox and a subset of CSS; no grid", us: "Built-in templates plus a visual editor, no code" },
      { label: "Fonts and assets", them: "ttf, otf or woff, bundled; the bundle is capped at 500 KB", us: "Upload fonts and images in the dashboard" },
      { label: "Cards from a page's own tags", them: "You write it", us: "Built in with url=" },
      { label: "Changing a card already shared", them: "You build the cache-busting", us: "One click; platforms re-fetch the new version" },
      { label: "A/B testing designs", them: "You build it", us: "Built in, with significance" },
      { label: "Works outside Next.js", them: "Yes, on Vercel and other JS runtimes", us: "Any stack, including WordPress and Webflow" },
    ],
    chooseThem: [
      "You're on Next.js, need one or two layouts and like owning the code.",
      "You can't send page data to a third party.",
      "You're happy maintaining fonts, layout edge cases and caching yourself.",
    ],
    chooseUs: [
      "You want cards on every page today, on any stack, without writing a renderer.",
      "Someone who doesn't code should be able to change the design.",
      "You need to update cards platforms have already cached, or test which design gets more clicks.",
    ],
    faq: [
      {
        q: "Is @vercel/og really free?",
        a: "The library is free and open source. It runs in your own functions, so you pay your host for the compute it uses, and you maintain the code.",
      },
      {
        q: "Can I move from @vercel/og to OGsmith?",
        a: "Yes. Replace the image URL in your metadata with an OGsmith URL. With url= OGsmith reads each page's own title and description, so most sites change one line.",
      },
    ],
    sources: [
      { label: "Vercel OG image generation docs", href: "https://vercel.com/docs/og-image-generation" },
    ],
  },
  {
    slug: "bannerbear",
    name: "Bannerbear",
    title: "OGsmith vs Bannerbear for Open Graph images",
    description:
      "Bannerbear is a broad image, video and automation platform; OGsmith focuses on link preview cards. Compare prices per render, features and which fits your site.",
    summary:
      "Bannerbear is a general media automation platform: image and animation templates, workflows and AI features, driven by an API or no-code tools. OGsmith does one job, social cards for links, which is why its quotas are much larger for the price.",
    rows: [
      { label: "Focus", them: "Images, animations, workflows and AI features", us: "Open Graph and social cards for links" },
      { label: "Entry paid plan", them: "$49/month for 1,000 API credits", us: `$${pro.priceMonthlyUsd}/month for ${n(pro.monthlyRenders)} renders` },
      { label: "Larger plan", them: "$149/month for 10,000 API credits", us: `$${scale.priceMonthlyUsd}/month for ${n(scale.monthlyRenders)} renders` },
      { label: "Free start", them: "30 API credits, no card required", us: `${TRIAL_DAYS} days without a watermark, then ${n(PLANS.free.monthlyRenders)} renders a month free` },
      { label: "When you run out", them: "Requests are refused", us: "Rendering stops at the cap; no overage charges" },
      { label: "Cards from a page's own tags", them: "Not the core use", us: "Built in with url=" },
      { label: "Checking how a link previews", them: "Not included", us: "Free checker for X, LinkedIn, Facebook, Slack, Discord, WhatsApp and iMessage" },
    ],
    chooseThem: [
      "You also need videos, animated images or multi-step media workflows.",
      "Your team already builds automations around Bannerbear.",
    ],
    chooseUs: [
      "What you need is a card for every link you share, at a much lower cost per image.",
      "You want to test card designs against each other, or refresh cards already shared.",
    ],
    faq: [
      {
        q: "How much cheaper is OGsmith per image?",
        a: `Bannerbear's $49 plan includes 1,000 API credits; OGsmith Pro includes ${n(pro.monthlyRenders)} renders for $${pro.priceMonthlyUsd}. A Bannerbear credit can also cost more than one per image at higher scales or several formats.`,
      },
      {
        q: "Does OGsmith do video?",
        a: "No. OGsmith makes still images for link previews and social posts. For video, Bannerbear or a video tool is the better fit.",
      },
    ],
    sources: [{ label: "Bannerbear pricing", href: "https://www.bannerbear.com/pricing/" }],
  },
  {
    slug: "placid",
    name: "Placid",
    title: "OGsmith vs Placid for social card images",
    description:
      "Placid is a no-code creative automation tool for images, video and PDFs; OGsmith is an API for link preview cards. How they differ in use, quotas and setup.",
    summary:
      "Placid is a creative automation tool built around templates and no-code integrations, generating images, videos and PDFs. OGsmith is narrower: an API that gives every link a correct social card, plus the tools around that job (a preview checker, cache refresh, A/B tests).",
    rows: [
      { label: "Focus", them: "Images, video and PDFs from templates, often via no-code tools", us: "Open Graph and social cards for links" },
      { label: "Monthly allowance", them: "Plans from 500 to 100,000 credits; one image costs one credit", us: `${n(PLANS.free.monthlyRenders)} free, ${n(pro.monthlyRenders)} on Pro, ${n(scale.monthlyRenders)} on Scale` },
      { label: "Price", them: "See their pricing page; yearly plans are discounted", us: OUR_PRICE },
      { label: "Unused allowance", them: "Credits roll over, up to double the monthly amount", us: "Resets monthly" },
      { label: "Cards from a page's own tags", them: "Not the core use", us: "Built in with url=" },
      { label: "Checking how a link previews", them: "Not included", us: "Free checker for seven platforms" },
    ],
    chooseThem: [
      "You want to generate videos or PDFs too.",
      "Your images are driven from no-code tools rather than from your site.",
    ],
    chooseUs: [
      "Your goal is that every page of your site previews well when shared.",
      "You'd rather add one meta tag than set up an automation per page.",
    ],
    faq: [
      {
        q: "Can I use OGsmith without code, like Placid?",
        a: "Designs are made in a visual editor without code, and for WordPress and Webflow there are copy-paste guides. Adding the tag to your site is a one-time step.",
      },
    ],
    sources: [{ label: "Placid pricing", href: "https://placid.app/pricing" }],
  },
];

export function comparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
