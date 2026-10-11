/**
 * One landing page per platform, for the searches people actually make
 * ("twitter card validator", "linkedin post inspector"…). Each runs the same
 * checker; what differs is the framing, the platform's own rules and the
 * questions people ask about it.
 *
 * These are our pages, not the platforms' tools: where a platform's own
 * tool is the search term (Post Inspector, Sharing Debugger) the title
 * calls ours an alternative and the copy points to theirs.
 *
 * Only state what the platform documents or what is plainly observable.
 * These pages are read by people debugging a live problem, and a wrong
 * number here costs them an afternoon.
 */

export interface PlatformPage {
  slug: string;
  /** Preview ids from PlatformPreviews to show first. */
  focus: string[];
  /** Short label for links between pages. */
  linkLabel: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  rules: Array<{ label: string; value: string }>;
  faq: Array<{ q: string; a: string }>;
}

export const PLATFORM_PAGES: PlatformPage[] = [
  {
    slug: "twitter-card-validator",
    focus: ["x-large", "x-small"],
    linkLabel: "X (Twitter) card validator",
    title: "Twitter card validator (X): free, no login needed",
    description:
      "X retired its Card Validator. Paste a URL to see how your Twitter card renders on X, check twitter:card and og:image, and find out why the large image isn't showing.",
    h1: "Twitter card validator",
    intro:
      "X retired its own Card Validator, so there is no official way left to preview a card before you post. Paste a URL and we read its twitter: and Open Graph tags, fetch the image and show both card layouts X can pick.",
    rules: [
      { label: "Large image card", value: 'Needs <meta name="twitter:card" content="summary_large_image">. Without it X shows a small square thumbnail.' },
      { label: "Fallbacks", value: "Missing twitter:title, twitter:description or twitter:image fall back to og:title, og:description and og:image." },
      { label: "Image", value: "A wide image around 2:1 or 1.91:1 (1200×630 works), JPG, PNG, WEBP or GIF, under 5 MB." },
      { label: "Refreshing a card", value: "There is no public tool. Change the URL (for example add ?v=2) so X treats it as a new link." },
    ],
    faq: [
      {
        q: "Where did the Twitter Card Validator go?",
        a: "X removed the preview from its Card Validator and there is no replacement. The only way to see a card on X is to post it, which is why a checker that renders the card from your tags is the practical substitute.",
      },
      {
        q: "Why does my link show a small image instead of a large one?",
        a: 'Almost always because twitter:card is missing or set to "summary". Set it to "summary_large_image" and make sure og:image (or twitter:image) points to a wide image at an absolute https URL.',
      },
      {
        q: "I fixed my tags but X still shows the old card. Why?",
        a: "X caches cards and offers no way to clear them. A changed URL, such as the same page with ?v=2, is read as a new link and gets a fresh card.",
      },
    ],
  },
  {
    slug: "linkedin-post-inspector",
    focus: ["linkedin"],
    linkLabel: "LinkedIn preview checker",
    title: "LinkedIn Post Inspector alternative: check your link preview",
    description:
      "See how your link previews on LinkedIn before you post: title, image and crop, plus the Open Graph problems that make LinkedIn show no image or an old one.",
    h1: "LinkedIn link preview checker",
    intro:
      "Paste a URL to see the preview LinkedIn builds from your Open Graph tags: the image, the crop and how much of the title survives. If it's wrong, the report says which tag to fix.",
    rules: [
      { label: "Tags it reads", value: "og:title, og:image, og:description and og:url. LinkedIn shows the title and image, but not the description, in the feed." },
      { label: "Image", value: "A wide 1.91:1 image; 1200×627 is LinkedIn's own recommendation and 1200×630 works the same." },
      { label: "Title", value: "Long titles are cut after roughly two lines, so put the words that matter first." },
      { label: "Refreshing a preview", value: "LinkedIn's Post Inspector (linkedin.com/post-inspector) re-reads the page on demand. Without it the old preview can stay for about a week." },
    ],
    faq: [
      {
        q: "Why is LinkedIn not showing an image for my link?",
        a: "Usually og:image is missing, uses a relative URL, points to an image LinkedIn can't fetch (blocked, too large or behind a login), or the old preview is still cached. Check the link here first, then ask LinkedIn's Post Inspector to re-read the page.",
      },
      {
        q: "How do I update a LinkedIn preview that's already cached?",
        a: "Paste the URL into LinkedIn's Post Inspector, which fetches it again. Posts already published keep the preview they had when they were shared.",
      },
      {
        q: "What image size does LinkedIn use?",
        a: "A 1.91:1 landscape image. 1200×627 or 1200×630 pixels both render without cropping anything important.",
      },
    ],
  },
  {
    slug: "facebook-debugger",
    focus: ["facebook"],
    linkLabel: "Facebook preview checker",
    title: "Facebook Sharing Debugger alternative: preview links without a login",
    description:
      "Check how a link looks when shared on Facebook without logging in: og:image, title, description and the tag problems the Facebook Sharing Debugger would flag.",
    h1: "Facebook link preview checker",
    intro:
      "Facebook's Sharing Debugger needs a logged-in account. This one doesn't: paste a URL and see the preview Facebook builds from your Open Graph tags, with what's wrong and how to fix it.",
    rules: [
      { label: "Tags it reads", value: "og:title, og:description, og:image and og:url. og:image must be an absolute URL." },
      { label: "Image", value: "1200×630 for a full-width preview. Smaller than 600×315 tends to show as a small thumbnail instead." },
      { label: "First share", value: "Adding og:image:width and og:image:height lets Facebook show the image on the very first share instead of after it's been processed." },
      { label: "Refreshing a preview", value: "The Sharing Debugger at developers.facebook.com/tools/debug, \"Scrape Again\". It requires a Facebook login." },
    ],
    faq: [
      {
        q: "Why is Facebook showing the wrong image or an old title?",
        a: "Facebook caches what it read the first time. After fixing your tags, open the Sharing Debugger and press \"Scrape Again\" so it re-reads the page.",
      },
      {
        q: "Can I check a Facebook preview without an account?",
        a: "Yes. This checker reads the same Open Graph tags Facebook does and shows the preview without any login. Only clearing Facebook's own cache needs their Debugger.",
      },
      {
        q: "Why does the image appear only on the second share?",
        a: "Facebook processes new images in the background. Declaring og:image:width and og:image:height in your page lets it render the image straight away.",
      },
    ],
  },
  {
    slug: "whatsapp-link-preview",
    focus: ["whatsapp"],
    linkLabel: "WhatsApp link preview",
    title: "WhatsApp link preview checker: why no image shows",
    description:
      "See the preview WhatsApp builds for your link and why it might show no image or no preview at all. Checks og:image, title and description in seconds.",
    h1: "WhatsApp link preview checker",
    intro:
      "WhatsApp has no debugging tool, and its previews are built on the sender's phone. Paste a URL and see what WhatsApp has to work with: your Open Graph title, description and image.",
    rules: [
      { label: "Tags it reads", value: "og:title, og:description and og:image." },
      { label: "Image", value: "Keep the file small and served over https. Heavy images are often dropped, leaving a text-only preview." },
      { label: "Shape", value: "Usually a square thumbnail beside the text; a wide image appears only for some links and senders." },
      { label: "Refreshing a preview", value: "There is no tool. Previews are generated on the sender's device, so a changed URL (?v=2) is the reliable way to get a new one." },
    ],
    faq: [
      {
        q: "Why is my WhatsApp link preview not showing an image?",
        a: "The most common reasons are a missing og:image, an image URL that isn't absolute https, or an image file that's too large. Check the link here to see which.",
      },
      {
        q: "How do I refresh a WhatsApp link preview?",
        a: "There is no cache to clear from outside: each phone builds its own preview. Sharing the URL with a small change, such as ?v=2, makes WhatsApp fetch it fresh.",
      },
      {
        q: "Why does WhatsApp crop my image to a square?",
        a: "Most WhatsApp previews use a square thumbnail. Keep the important part of the image near the centre so it survives the crop.",
      },
    ],
  },
  {
    slug: "slack-link-preview",
    focus: ["slack"],
    linkLabel: "Slack unfurl preview",
    title: "Slack link preview checker: test how your link unfurls",
    description:
      "Test how your link unfurls in Slack before you share it: title, description and image from your Open Graph tags, and what to fix when the unfurl is missing or wrong.",
    h1: "Slack link preview checker",
    intro:
      "Paste a URL to see how Slack unfurls it: the site name, title, description and image it takes from your page's tags.",
    rules: [
      { label: "Tags it reads", value: "Open Graph and Twitter tags (og:title, og:description, og:image, og:site_name), plus oEmbed where a site offers it." },
      { label: "Image", value: "A wide image shown below the text; 1200×630 works well." },
      { label: "Who fetches it", value: "Slack's own crawler (Slackbot-LinkExpanding). Pages behind a login or blocked to bots won't unfurl." },
      { label: "Refreshing an unfurl", value: "There is no way to flush the cache; unfurls expire on their own. A changed URL (?v=2) unfurls fresh straight away." },
    ],
    faq: [
      {
        q: "Why isn't my link unfurling in Slack?",
        a: "Slack's crawler may be blocked by a firewall or robots rule, the page may need a login, or it has no Open Graph tags. Check the link here to see what a crawler can read.",
      },
      {
        q: "How do I refresh a Slack unfurl?",
        a: "Slack doesn't offer a way to clear its cache. Share the URL with a small change, such as ?v=2, and Slack reads it as a new link.",
      },
      {
        q: "Can I stop Slack from unfurling a link?",
        a: "Whoever shares it can remove the preview from their message. Site-wide, Slack follows robots rules for its crawler.",
      },
    ],
  },
  {
    slug: "discord-embed-preview",
    focus: ["discord"],
    linkLabel: "Discord embed preview",
    title: "Discord embed preview: check your link embed",
    description:
      "Preview the embed Discord shows for your link: title, description, image size and colour. Find out why the image is small or the embed is missing.",
    h1: "Discord embed preview",
    intro:
      "Paste a URL to see the embed Discord builds from your page: title, description and image, and whether the image shows large or as a small thumbnail.",
    rules: [
      { label: "Tags it reads", value: "og:title, og:description, og:image and og:site_name." },
      { label: "Large image", value: 'Set <meta name="twitter:card" content="summary_large_image"> for a full-width image; otherwise it can show as a small thumbnail.' },
      { label: "Embed colour", value: 'The coloured bar on the left comes from <meta name="theme-color" content="#ff6a2b">.' },
      { label: "Refreshing an embed", value: "Cached, with no user-facing refresh. A changed URL (?v=2) embeds fresh." },
    ],
    faq: [
      {
        q: "Why is the image in my Discord embed so small?",
        a: 'Discord shows a large image when the page sets twitter:card to "summary_large_image". Without it the image often appears as a thumbnail beside the text.',
      },
      {
        q: "How do I change the colour of my Discord embed?",
        a: 'Add <meta name="theme-color" content="#yourcolor"> to your page. Discord uses it for the stripe on the left of the embed.',
      },
      {
        q: "Why is Discord still showing my old embed?",
        a: "Discord caches embeds and has no public way to clear them. Posting the URL with a small change, such as ?v=2, gets a fresh embed.",
      },
    ],
  },
];

export function platformPage(slug: string): PlatformPage | undefined {
  return PLATFORM_PAGES.find((p) => p.slug === slug);
}
