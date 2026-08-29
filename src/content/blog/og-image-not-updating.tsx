import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import {
  Callout,
  Code,
  CodeBlock,
  H2,
  H3,
  LI,
  Lead,
  OL,
  P,
  Table,
  UL,
} from "@/components/blog/prose";

export const meta: PostMeta = {
  slug: "og-image-not-updating",
  title: "Why your og:image won't update, and what actually clears it",
  description:
    "You changed the card and reshared the link, and it's still the old image. There are two caches involved and almost every explanation online conflates them. Here's which one is biting you and what genuinely clears each.",
  cardSubtitle:
    "Two caches, not one — and only one of them is yours to control.",
  date: "2026-08-29",
  readingMinutes: 7,
};

export default function Post() {
  return (
    <>
      <Lead>
        You fixed the design, reshared the link, and the old image is still
        there. So you cleared your CDN, added a cache-control header, waited a
        day, and it is <em>still</em> there.
      </Lead>

      <P>
        The reason this is so maddening is that two different caches are
        involved, and almost every answer online treats one of them as if it
        were the only one. They fail in different ways and they clear
        differently. Once you can tell which one is holding your old card, the
        problem stops being mysterious — though for one of them the honest
        answer is that you cannot fix it, and knowing that is worth something
        too.
      </P>

      <H2 id="two-caches">The two caches</H2>

      <H3>One: the platform&apos;s copy of your page</H3>
      <P>
        The first time anybody shares your URL, the platform&apos;s crawler
        fetches the page, reads the meta tags, and stores what it found —
        title, description, and usually the image itself, copied onto the
        platform&apos;s own servers. That snapshot is keyed on the page URL.
      </P>
      <P>
        Every later share of that URL reads the snapshot.{" "}
        <strong className="text-zinc-200">
          Your server is never contacted again.
        </strong>{" "}
        This is the part people miss: resharing does nothing, because nobody
        is asking your server anything. You are looking at a copy that was
        taken once and kept.
      </P>

      <H3>Two: the image bytes</H3>
      <P>
        Separately, the image living at your <Code>og:image</Code> URL is
        cached — by your own CDN, and again by the platform when it copies the
        file. If you regenerate the card at the same address, everything
        downstream still holds the old bytes. A crawler that <em>does</em> come
        back for a fresh look can still be handed the old picture.
      </P>

      <Callout>
        <strong className="text-white">Which one is biting you?</strong>
        <br />
        If the link was shared before you made the change, it is almost always
        cache one, and there is usually nothing you can do for that
        already-posted link. If it is a brand-new share and the card is still
        wrong, it is cache two — and that one is entirely yours to fix.
      </Callout>

      <H2 id="what-clears-them">What actually clears each platform</H2>
      <P>
        Only two of the major platforms give you a button. The rest expire on
        their own schedule and do not publish it.
      </P>

      <Table
        head={["Platform", "Can you force a re-read?", "How"]}
        rows={[
          [
            "Facebook",
            "Yes",
            <>
              Sharing Debugger, &ldquo;Scrape Again&rdquo;. Requires a
              logged-in Facebook account.
            </>,
          ],
          [
            "LinkedIn",
            "Yes",
            <>Post Inspector re-reads the page on demand.</>,
          ],
          [
            "X",
            "No",
            <>
              The Card Validator was retired. There is no public way to make X
              re-read a URL.
            </>,
          ],
          ["Slack", "No", <>Unfurls expire on their own; no flush control.</>],
          ["Discord", "No", <>Same — cached, with no user-facing refresh.</>],
          [
            "WhatsApp",
            "No",
            <>No tool, and previews are generated on the sender&apos;s device.</>,
          ],
          ["iMessage", "No", <>Cached per device, with no way in.</>],
        ]}
      />

      <P>
        Treat that table as a starting point rather than gospel — these
        products change their behaviour without announcing it, and the two
        debuggers move around. If a card matters, check it before you publish
        rather than after.
      </P>

      <H2 id="the-one-lever">The one lever that always works</H2>
      <P>
        Both caches are keyed on a URL. You cannot flush them, but you can
        change the key. That is the whole trick, and it only helps in one of
        the two places:
      </P>
      <UL>
        <LI>
          <strong className="text-zinc-200">The page URL</strong> is not
          usefully changeable. A different URL is a different post, with none
          of the shares the old one had.
        </LI>
        <LI>
          <strong className="text-zinc-200">The image URL</strong> is entirely
          yours. Put a version in it, and bump the version whenever the artwork
          changes.
        </LI>
      </UL>

      <CodeBlock>{`<!-- before -->
<meta property="og:image" content="https://example.com/og/launch.png">

<!-- after: nothing anywhere has ever seen this URL -->
<meta property="og:image" content="https://example.com/og/launch.png?v=3">`}</CodeBlock>

      <P>
        Be clear about what this does and does not buy you.{" "}
        <strong className="text-zinc-200">
          It does not force anyone to re-read your page.
        </strong>{" "}
        What it means is that whenever a re-read <em>does</em> happen — a new
        share, a platform you have not been posted on yet, a scheduled
        recrawl, someone hitting the Facebook debugger — the crawler follows a
        URL nothing has ever cached and gets the current art. Without a
        version, your HTML can be right while the bytes served to that crawler
        are months old.
      </P>

      <H2 id="what-to-do">What to do about it</H2>
      <OL>
        <li>
          Version the image URL from the very first deploy. Retrofitting it
          after a page has been shared is the case that cannot be fixed.
        </li>
        <li>
          Bump the version whenever the design changes — not just when the
          title does.
        </li>
        <li>
          Use the Facebook and LinkedIn debuggers on anything important. They
          are the only two re-reads you can actually trigger.
        </li>
        <li>
          Accept that links already circulating on X, Slack, Discord and
          WhatsApp will keep the old card until their caches expire on their
          own. Do not burn a day trying; there is no lever.
        </li>
        <li>
          Do not rely on <Code>Cache-Control</Code> on the image. It
          influences well-behaved intermediaries, and it does nothing at all
          about a copy a platform has already taken onto its own servers.
        </li>
      </OL>

      <H2 id="check-first">The cheaper habit</H2>
      <P>
        All of this is recoverable if you catch it before the link goes out and
        close to unrecoverable afterwards, which makes checking the card part
        of publishing rather than part of debugging. Our{" "}
        <Link href="/check" className="text-indigo-400 hover:underline">
          link preview checker
        </Link>{" "}
        reads any public page, fetches the image, and shows you what each
        platform will do with it — no account, and it takes about four
        seconds.
      </P>
      <P>
        OGsmith puts the version in the image URL for you: every card carries a{" "}
        <Code>v</Code> parameter, and changing your design bumps it across
        every card on the account at once, so you never have to remember which
        pages need editing. That is the whole feature — it is not clever, it is
        just the one thing the caches leave you.
      </P>
    </>
  );
}
