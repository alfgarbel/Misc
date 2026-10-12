/**
 * Example cards the marketing pages show, one per kind of site.
 *
 * They are served from /showcase/<slug>.png, prerendered at build time,
 * rather than from /api/og. The demo endpoint is rate-limited per visitor,
 * and a page showing a wall of cards would spend that limit just by being
 * looked at — then show broken images on the next reload.
 */
export interface ShowcaseCard {
  slug: string;
  /** Who it's for, as shown under the card. */
  useCase: string;
  blurb: string;
  params: Record<string, string>;
}

export const SHOWCASE: ShowcaseCard[] = [
  {
    slug: "blog",
    useCase: "Blog posts",
    blurb: "Every article gets its own card from its title and description.",
    params: {
      template: "minimal",
      theme: "light",
      accent: "#ff6a2b",
      title: "What we learned shipping 40 releases in a year",
      subtitle: "Engineering blog · 8 min read",
      site: "blog.acme.dev",
    },
  },
  {
    slug: "changelog",
    useCase: "Changelogs",
    blurb: "Release notes people actually click on.",
    params: {
      template: "announce",
      theme: "dark",
      accent: "#ff6a2b",
      title: "Dark mode is here",
      subtitle: "Plus 14 fixes and a faster editor",
      site: "v3.2",
    },
  },
  {
    slug: "docs",
    useCase: "Docs",
    blurb: "Shared doc links that say which page they point to.",
    params: {
      template: "terminal",
      theme: "dark",
      accent: "#ffb27a",
      title: "npx acme deploy --prod",
      subtitle: "Deploying to production · Acme docs",
      site: "docs.acme.dev",
    },
  },
  {
    slug: "store",
    useCase: "Online stores",
    blurb: "Product links with the name and price up front.",
    params: {
      template: "split",
      theme: "light",
      accent: "#e0521a",
      title: "Linen overshirt, sand",
      subtitle: "€89 · Free returns",
      site: "shop.example.com",
    },
  },
  {
    slug: "podcast",
    useCase: "Podcasts",
    blurb: "An episode card for every show, without opening a design tool.",
    params: {
      template: "quote",
      theme: "dark",
      accent: "#ff9a66",
      title: "Pricing is a product decision, not a finance one",
      subtitle: "Ep. 112 · Founders on Fridays",
      site: "fridays.fm",
    },
  },
  {
    slug: "event",
    useCase: "Events",
    blurb: "Talks and meetups with the date where people can see it.",
    params: {
      template: "gradient",
      theme: "dark",
      accent: "#ff6a2b",
      title: "Frontend Night Madrid",
      subtitle: "Thursday 14 November · 19:00 · Free entry",
      site: "meetup.example.com",
    },
  },
];

/**
 * Cards that illustrate a feature rather than a kind of site, so they stay
 * out of the example walls. "blog-redesign" is the blog card's page after a
 * change of design: same title, new artwork.
 */
export const SHOWCASE_EXTRAS: ShowcaseCard[] = [
  {
    slug: "blog-redesign",
    useCase: "Blog posts, after a redesign",
    blurb: "The same article with a new design.",
    params: {
      template: "split",
      theme: "dark",
      accent: "#ff6a2b",
      title: "What we learned shipping 40 releases in a year",
      subtitle: "Engineering blog · 8 min read",
      site: "blog.acme.dev",
    },
  },
];

/** Every prerendered card, examples and feature illustrations alike. */
export const ALL_SHOWCASE_CARDS: ShowcaseCard[] = [...SHOWCASE, ...SHOWCASE_EXTRAS];

export function showcaseSrc(slug: string): string {
  return `/showcase/${slug}`;
}
