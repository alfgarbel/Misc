import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import { Callout, Code, CodeBlock, H2, Lead, P } from "@/components/blog/prose";

export const meta: PostMeta = {
  slug: "wordpress-og-image",
  title: "Automatic Open Graph images in WordPress",
  description:
    "Give every WordPress post and page a proper social card without designing one each time: a free plugin, a few lines in functions.php, or a Yoast SEO filter.",
  cardSubtitle: "A card for every post, without opening Canva.",
  date: "2026-10-11",
  readingMinutes: 4,
};

export default function Post() {
  return (
    <>
      <Lead>
        Most WordPress sites share links with whatever image a post happens
        to have, or none. With a few lines of PHP every post and page gets a
        card made from its own title, in your colours.
      </Lead>

      <H2 id="plugin">The plugin: no code</H2>
      <P>
        Download the{" "}
        <a href="/downloads/ogsmith-wordpress.zip" className="text-indigo-400 hover:underline">
          OGsmith plugin for WordPress
        </a>
        , then upload it under Plugins → Add New → Upload Plugin and activate
        it. Under Settings → OGsmith, paste your Account ID and signing secret
        from the dashboard&apos;s Signed URLs panel. Every post, page and the
        home page then gets a card made from its title and excerpt, and the
        settings page shows a preview.
      </P>
      <P>
        It works next to Yoast SEO, Rank Math and similar plugins: their
        image tags are swapped for the card, so each page keeps exactly one{" "}
        <Code>og:image</Code>. The rest of this post is for doing the same by
        hand.
      </P>
      <H2 id="no-seo-plugin">Without an SEO plugin</H2>
      <P>
        Add this to your child theme&apos;s <Code>functions.php</Code>, or to
        a code snippets plugin so a theme update doesn&apos;t remove it.
      </P>
      <CodeBlock>{`add_action('wp_head', function () {
  if (!is_singular()) return;

  $og = add_query_arg([
    'key' => 'og_yourkey',
    'url' => rawurlencode(get_permalink()),
  ], 'https://ogsmith.app/api/og');

  echo '<meta property="og:image" content="' . esc_url($og) . '">' . "\\n";
  echo '<meta property="og:image:width" content="1200">' . "\\n";
  echo '<meta property="og:image:height" content="630">' . "\\n";
  echo '<meta name="twitter:card" content="summary_large_image">' . "\\n";
});`}</CodeBlock>
      <P>
        <Code>add_query_arg</Code> doesn&apos;t encode values, which is why
        the permalink goes through <Code>rawurlencode</Code>. With{" "}
        <Code>url</Code>, OGsmith reads the post&apos;s title and description
        and builds the card from them.
      </P>

      <H2 id="yoast">With Yoast SEO</H2>
      <P>
        Yoast already writes the Open Graph tags, so replace its image
        instead of adding a second one:
      </P>
      <CodeBlock>{`function ogsmith_card() {
  return add_query_arg([
    'key' => 'og_yourkey',
    'url' => rawurlencode(get_permalink()),
  ], 'https://ogsmith.app/api/og');
}
add_filter('wpseo_opengraph_image', function ($image) {
  return is_singular() ? ogsmith_card() : $image;
});
add_filter('wpseo_twitter_image', function ($image) {
  return is_singular() ? ogsmith_card() : $image;
});`}</CodeBlock>

      <H2 id="design">Your colours and logo</H2>
      <P>
        Set the template, accent colour and site name once under Brand
        defaults in the dashboard (paid plans can add a logo too). Any card that doesn&apos;t set
        its own values uses these, so the snippet above never needs to change.
      </P>

      <Callout>
        After saving, paste a post into the{" "}
        <Link href="/check" className="text-indigo-400 hover:underline">
          link preview checker
        </Link>
        . If a platform still shows the old image,{" "}
        <Link href="/blog/og-image-not-updating" className="text-indigo-400 hover:underline">
          this explains why and what clears it
        </Link>
        .
      </Callout>
    </>
  );
}
