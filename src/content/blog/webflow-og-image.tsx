import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import { Callout, Code, CodeBlock, H2, LI, Lead, OL, P } from "@/components/blog/prose";

export const meta: PostMeta = {
  slug: "webflow-og-image",
  title: "Dynamic Open Graph images for Webflow CMS pages",
  description:
    "Give every Webflow CMS item its own social card without uploading an image per item: one line of custom head code on the collection template.",
  cardSubtitle: "One line on the collection template, a card per item.",
  date: "2026-10-11",
  readingMinutes: 3,
};

export default function Post() {
  return (
    <>
      <Lead>
        Webflow lets you set an Open Graph image per page, but for a CMS
        collection that means an image for every item. With one line of
        custom code on the collection template, each item gets a card made
        from its own title instead.
      </Lead>

      <H2 id="steps">On a collection template</H2>
      <OL>
        <LI>Open the collection template page and its page settings.</LI>
        <LI>
          Leave the Open Graph image field empty, so the page has only one
          og:image.
        </LI>
        <LI>
          In custom code, inside the <Code>&lt;head&gt;</Code> tag, paste
          the line below. Where it says <Code>SLUG</Code>, insert the
          item&apos;s Slug field with Webflow&apos;s add field button.
        </LI>
        <LI>Publish, then check an item&apos;s page.</LI>
      </OL>
      <CodeBlock>{`<meta property="og:image" content="https://ogsmith.app/api/og?key=og_yourkey&url=https%3A%2F%2Fyoursite.com%2Fblog%2FSLUG">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`}</CodeBlock>
      <P>
        The <Code>url</Code> parameter is your item&apos;s address, encoded
        (<Code>%3A%2F%2F</Code> is <Code>://</Code> and <Code>%2F</Code> is{" "}
        <Code>/</Code>). OGsmith reads that page&apos;s title and description
        and builds the card from them.
      </P>

      <H2 id="static-pages">Static pages</H2>
      <P>
        For a handful of static pages, upload an image in page settings as
        usual, or use the same line with the page&apos;s address in place of
        the slug.
      </P>

      <H2 id="design">Your colours and logo</H2>
      <P>
        Set the template, colours and site name once under Brand defaults in the
        dashboard (paid plans can add a logo too). Every card picks them up,
        so the line on your template never changes.
      </P>

      <Callout>
        Paste a published item into the{" "}
        <Link href="/check" className="text-indigo-400 hover:underline">
          link preview checker
        </Link>{" "}
        to see it the way X, LinkedIn and Slack will.
      </Callout>
    </>
  );
}
