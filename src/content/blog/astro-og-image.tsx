import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import { Callout, Code, CodeBlock, H2, Lead, P } from "@/components/blog/prose";

export const meta: PostMeta = {
  slug: "astro-og-image",
  title: "Open Graph images for every Astro page, from one layout",
  description:
    "Give every page of an Astro site its own og:image by adding one tag to your base layout. No image pipeline, no build step, works with static and server output.",
  cardSubtitle: "One tag in your base layout covers every page.",
  date: "2026-10-11",
  readingMinutes: 3,
};

export default function Post() {
  return (
    <>
      <Lead>
        Astro sites usually share one base layout, which makes it the right
        place for the Open Graph image too. Add one tag there and every page
        gets a card built from its own title and description.
      </Lead>

      <H2 id="layout">Add it to the layout</H2>
      <P>
        This uses the page&apos;s full address, so set <Code>site</Code> in{" "}
        <Code>astro.config.mjs</Code> if you haven&apos;t already.
      </P>
      <CodeBlock>{`---
// src/layouts/Base.astro
const og = new URL("https://ogsmith.app/api/og");
og.searchParams.set("key", import.meta.env.OGSMITH_KEY);
og.searchParams.set("url", new URL(Astro.url.pathname, Astro.site).href);
---
<head>
  <meta property="og:image" content={og.href} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <slot name="head" />
</head>`}</CodeBlock>
      <P>
        With <Code>url</Code>, OGsmith reads the page&apos;s own{" "}
        <Code>og:title</Code> and <Code>og:description</Code> (or its{" "}
        <Code>&lt;title&gt;</Code> and meta description) and builds the card
        from them. The page is read once and cached for a day.
      </P>

      <H2 id="explicit">Or say exactly what goes on the card</H2>
      <P>
        If a page knows better, pass the text yourself. Anything you set
        wins over what the page says.
      </P>
      <CodeBlock>{`og.searchParams.set("title", Astro.props.title);
og.searchParams.set("site", "example.com");`}</CodeBlock>

      <H2 id="static">Static builds</H2>
      <P>
        Nothing changes for <Code>output: &quot;static&quot;</Code>. The tag
        is written into the HTML at build time and the image is rendered the
        first time a platform asks for it, so your build doesn&apos;t get any
        slower.
      </P>

      <Callout>
        Check a deployed page in the{" "}
        <Link href="/check" className="text-indigo-400 hover:underline">
          link preview checker
        </Link>{" "}
        to see the card the way each platform will.
      </Callout>
    </>
  );
}
