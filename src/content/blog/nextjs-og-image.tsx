import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import { Callout, Code, CodeBlock, H2, LI, Lead, P, UL } from "@/components/blog/prose";

export const meta: PostMeta = {
  slug: "nextjs-og-image",
  title: "Open Graph images in Next.js without building them yourself",
  description:
    "Add a correct og:image to every page of a Next.js App Router site with generateMetadata and one URL, including dynamic routes, without a renderer of your own.",
  cardSubtitle: "One URL in generateMetadata, a card for every page.",
  date: "2026-10-11",
  readingMinutes: 4,
};

export default function Post() {
  return (
    <>
      <Lead>
        In Next.js an Open Graph image is just a URL you return from{" "}
        <Code>generateMetadata</Code>. It doesn&apos;t have to be an image
        you render: point it at OGsmith and every page gets its own card.
      </Lead>

      <H2 id="one-page">One page</H2>
      <P>
        Build the card URL from the page&apos;s data and return it as the
        Open Graph image. Keep the key in an environment variable.
      </P>
      <CodeBlock>{`// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);

  const og = new URL("https://ogsmith.app/api/og");
  og.searchParams.set("key", process.env.OGSMITH_KEY);
  og.searchParams.set("title", post.title);
  og.searchParams.set("subtitle", post.excerpt);
  og.searchParams.set("site", "example.com");

  return {
    openGraph: { images: [{ url: og.toString(), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image" },
  };
}`}</CodeBlock>
      <P>
        Setting <Code>width</Code> and <Code>height</Code> lets Facebook show
        the image on the very first share, and{" "}
        <Code>summary_large_image</Code> is what makes X show it wide instead
        of as a small square.
      </P>

      <H2 id="every-page">Every page, without passing a title</H2>
      <P>
        If your pages already have a title and description, you don&apos;t
        need to repeat them. Pass the page&apos;s own address with{" "}
        <Code>url</Code> and OGsmith reads its tags and builds the card from
        them.
      </P>
      <CodeBlock>{`const og = new URL("https://ogsmith.app/api/og");
og.searchParams.set("key", process.env.OGSMITH_KEY);
og.searchParams.set("url", \`https://example.com/blog/\${slug}\`);`}</CodeBlock>
      <P>
        Pages are read once and cached for a day, so a card that&apos;s
        fetched a thousand times reads your page once.
      </P>

      <H2 id="why-not-vercel-og">Why not render it in your own app?</H2>
      <P>
        Next.js can render images itself with an{" "}
        <Code>opengraph-image</Code> file. That works, and for one layout it
        may be all you need. What you take on with it:
      </P>
      <UL>
        <LI>Fonts, layout limits and edge cases in your own code.</LI>
        <LI>No way to change a card that platforms have already cached.</LI>
        <LI>A deploy for every design change, and no A/B test between two.</LI>
      </UL>

      <H2 id="key">Is the key safe in the page?</H2>
      <P>
        Image URLs are public by nature, because crawlers have to fetch them.
        If you&apos;d rather not show the key, use a{" "}
        <Link href="/docs#signed-urls" className="text-indigo-400 hover:underline">
          signed URL
        </Link>
        : the signature covers the exact parameters, so nobody can reuse it
        for other content.
      </P>

      <Callout>
        Before you ship, paste a page into the{" "}
        <Link href="/check" className="text-indigo-400 hover:underline">
          link preview checker
        </Link>{" "}
        to see what X, LinkedIn, Slack and the rest will show.
      </Callout>
    </>
  );
}
