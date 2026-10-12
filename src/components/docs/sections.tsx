import { SIZES, SIZE_IDS } from "@/lib/og/sizes";
import { TRIAL_DAYS } from "@/lib/trial";

const PARAMS: Array<{
  name: string;
  type: string;
  def: string;
  desc: string;
}> = [
  {
    name: "key",
    type: "string",
    def: "none",
    desc: "Your API key (og_…). Omit for watermarked, rate-limited demo renders.",
  },
  {
    name: "template",
    type: "gradient | minimal | split | terminal | quote | announce | link | cover",
    def: "gradient",
    desc: "Which card layout to render.",
  },
  {
    name: "title",
    type: "string (≤ 200 chars)",
    def: "Hello, world",
    desc: "Main headline. Font size auto-scales with length.",
  },
  {
    name: "subtitle",
    type: "string (≤ 300 chars)",
    def: "none",
    desc: "Supporting line under the title.",
  },
  {
    name: "site",
    type: "string (≤ 100 chars)",
    def: "none",
    desc: "Site or brand name shown in the footer of the card.",
  },
  {
    name: "theme",
    type: "dark | light",
    def: "dark",
    desc: "Base color scheme (the terminal template is always dark).",
  },
  {
    name: "accent",
    type: "hex color",
    def: "#6366f1",
    desc: "Accent color. URL-encode the hash: %236366f1.",
  },
  {
    name: "size",
    type: "og | square | story | youtube | wide",
    def: "og",
    desc: "Canvas the card is rendered at. See Sizes. Ignored with tpl, where the size belongs to the design.",
  },
  {
    name: "exp",
    type: "string",
    def: "none",
    desc: "Slug of one of your experiments. Picks a design variant for this page and records that a card was served. See Experiments.",
  },
  {
    name: "k",
    type: "string (≤ 500 chars)",
    def: "url, if given",
    desc: "Identifies the page under test, for exp. Must be a stable id, such as a post slug or database id, never the title. Defaults to the url value when you pass one.",
  },
  {
    name: "url",
    type: "https URL",
    def: "none",
    desc: "Read this page and use its title, description, site name and image. Anything you pass explicitly wins. See Cards from a URL.",
  },
  {
    name: "tpl",
    type: "string",
    def: "none",
    desc: "Slug of one of your own templates from the visual editor. Replaces template; every other parameter becomes a {{placeholder}} value.",
  },
  {
    name: "v",
    type: "string (≤ 32 chars)",
    def: "none",
    desc: "Cache-busting token. Ignored when rendering; changing it is what forces social platforms to re-fetch. See Refreshing cached cards.",
  },
  {
    name: "acct + sig",
    type: "string",
    def: "none",
    desc: "Signed-URL auth: your account ID plus an HMAC signature. An alternative to key. See Signed URLs.",
  },
];

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-emerald-400">
      {children}
    </pre>
  );
}

export interface SectionProps {
  base: string;
  /** next/link on the site. Markdown rendering has no router, so it gets a plain <a>. */
  A: React.ElementType;
}

export interface DocSection {
  slug: string;
  title: string;
  description: string;
  /** The body carries its own h2 headings, so no title heading goes above it. */
  ownHeadings?: boolean;
  Body: (props: SectionProps) => React.ReactElement;
}

/** Endpoint, parameters and the basics: what /docs itself shows. */
export function Overview({ base }: SectionProps) {
  return (
    <>
        <h2 className="mt-12 text-2xl font-semibold">Endpoint</h2>
        <div className="mt-4">
          <CodeBlock>GET /api/og</CodeBlock>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Returns <code className="text-zinc-300">image/png</code> on success.
          Errors return JSON with an <code className="text-zinc-300">error</code>{" "}
          field: <code className="text-zinc-300">400</code> invalid parameters,{" "}
          <code className="text-zinc-300">401</code> bad key,{" "}
          <code className="text-zinc-300">429</code> quota or rate limit
          exceeded.
        </p>

        <h2 className="mt-12 text-2xl font-semibold">Parameters</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3">Param</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map((p) => (
                <tr key={p.name} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-mono text-indigo-300">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.type}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.def}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Use it in your HTML</h2>
        <div className="mt-4">
          <CodeBlock>{`<meta
  property="og:image"
  content="${base}/api/og?key=og_yourkey&template=split&title=My%20post&site=example.com&accent=%23f43f5e"
/>
<meta name="twitter:card" content="summary_large_image" />`}</CodeBlock>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Next.js example</h2>
        <div className="mt-4">
          <CodeBlock>{`export function generateMetadata({ params }) {
  const og = new URL("${base}/api/og");
  og.searchParams.set("key", process.env.OGSMITH_KEY);
  og.searchParams.set("title", post.title);
  og.searchParams.set("site", "example.com");
  return { openGraph: { images: [og.toString()] } };
}`}</CodeBlock>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Account defaults</h2>
        <p className="mt-4 text-sm text-zinc-400">
          Set default <code className="text-zinc-300">template</code>,{" "}
          <code className="text-zinc-300">theme</code>,{" "}
          <code className="text-zinc-300">accent</code>, and{" "}
          <code className="text-zinc-300">site</code> values in the dashboard
          (Brand defaults). They apply to authenticated renders whenever the
          parameter is omitted, so a URL can be as short as{" "}
          <code className="text-zinc-300">/api/og?key=…&amp;title=Hello</code>.
          Parameters in the URL always override defaults. You can create up to
          10 named API keys and revoke each one separately. The dashboard
          shows render counts per key. On paid plans, an uploaded logo
          (dashboard → Brand defaults) renders on every card next to the site
          name.
        </p>

    </>
  );
}

function SignedUrls({ base }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Instead of embedding your API key, you can sign each URL with your
          account&apos;s signing secret (dashboard → Signed URLs). The signature
          binds the exact parameters, so a leaked URL can&apos;t be modified or
          reused for other content, and your secret never appears in markup.
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Signature: take every query parameter except{" "}
          <code className="text-zinc-300">sig</code> (including{" "}
          <code className="text-zinc-300">acct</code>), percent-encode each name
          and value with{" "}
          <code className="text-zinc-300">encodeURIComponent</code>, sort pairs
          by name, join as <code className="text-zinc-300">name=value</code>{" "}
          with <code className="text-zinc-300">&amp;</code>, and HMAC-SHA256 it
          with your secret (hex output).
        </p>
        <div className="mt-4">
          <CodeBlock>{`import { createHmac } from "crypto";

function signedOgUrl(params, accountId, secret) {
  const p = new URLSearchParams(params);
  p.set("acct", accountId);
  const msg = [...p.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a, x], [b, y]) =>
      a === b ? x.localeCompare(y) : a.localeCompare(b))
    .map(([k, v]) => \`\${k}=\${v}\`)
    .join("&");
  p.set("sig", createHmac("sha256", secret).update(msg).digest("hex"));
  return \`${base}/api/og?\${p}\`;
}

signedOgUrl({ title: "My post", template: "split" }, ACCOUNT_ID, SECRET);`}</CodeBlock>
        </div>

    </>
  );
}

function Sizes({ base, A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Cards render at 1200×630 by default, the shape every link unfurler
          expects. <code className="text-zinc-300">size</code> renders the same
          template at another platform&apos;s shape instead, so one design can
          serve link previews, feed posts and stories.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3">size</th>
                <th className="px-4 py-3">Pixels</th>
                <th className="px-4 py-3">Where it&apos;s used</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_IDS.map((id) => (
                <tr key={id} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-mono text-indigo-300">{id}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {SIZES[id].width}×{SIZES[id].height}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{SIZES[id].blurb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <CodeBlock>{`${base}/api/og?key=og_yourkey&size=square&title=Also%20on%20Instagram`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Built-in templates are laid out once and scaled to whichever canvas
          you ask for, so type and spacing keep their proportions and the
          shorter shapes don&apos;t simply leave gaps. Templates that anchor
          copy to one edge gather it into the middle on the taller canvases.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Your own templates work differently: their layers hold absolute
          coordinates, so the canvas is part of the design and you choose it
          in the editor. Passing <code className="text-zinc-300">size</code>{" "}
          alongside <code className="text-zinc-300">tpl</code> has no effect;
          the design&apos;s own canvas applies.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Changing size changes the image, so bump your{" "}
          <A href="/docs/cache-refresh" className="text-indigo-400 hover:underline">
            cache version
          </A>{" "}
          if you are switching an already-published card to a new shape.
        </p>

    </>
  );
}

function Checker({ A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          The{" "}
          <A href="/check" className="text-indigo-400 hover:underline">
            link preview checker
          </A>{" "}
          reads any public page&apos;s Open Graph tags, fetches its image, and
          reports what will go wrong when the link is shared: a missing or
          unreachable <code className="text-zinc-300">og:image</code>, one too
          small or the wrong shape, dimensions that disagree with the file, a{" "}
          <code className="text-zinc-300">twitter:card</code> that throws away
          a wide image. It needs no account, and results have a shareable URL:{" "}
          <code className="text-zinc-300">/check?url=…</code>
        </p>

    </>
  );
}

function UrlToCard({ base, A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Instead of describing the card, point at the page and let OGsmith
          read it. It takes the title, description, site name and image from
          the page&apos;s own OpenGraph tags (the same ones social crawlers
          use), falling back to Twitter card tags and then to the ordinary{" "}
          <code className="text-zinc-300">&lt;title&gt;</code> and meta
          description.
        </p>
        <div className="mt-4">
          <CodeBlock>{`${base}/api/og?key=og_yourkey&template=link&url=https%3A%2F%2Fexample.com%2Fblog%2Fpost`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Remember to URL-encode the address you pass. The{" "}
          <code className="text-zinc-300">link</code> and{" "}
          <code className="text-zinc-300">cover</code> templates are built for
          this. <code className="text-zinc-300">link</code> places the
          page&apos;s own image whole in a panel beside the title;{" "}
          <code className="text-zinc-300">cover</code> crops it to fill the card
          and sets the title over it. Every other template works too, using
          only the text. Without an image, <code className="text-zinc-300">cover</code>{" "}
          falls back to a block of your accent colour.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Anything you state explicitly wins, so you can let the page supply
          most of the card and override one field:{" "}
          <code className="text-zinc-300">
            &amp;url=…&amp;title=My%20own%20headline
          </code>
          . With a{" "}
          <A href="/docs/templates" className="text-indigo-400 hover:underline">
            custom template
          </A>
          , the scraped values fill{" "}
          <code className="text-zinc-300">{"{{title}}"}</code>,{" "}
          <code className="text-zinc-300">{"{{subtitle}}"}</code>,{" "}
          <code className="text-zinc-300">{"{{description}}"}</code>,{" "}
          <code className="text-zinc-300">{"{{site}}"}</code> and{" "}
          <code className="text-zinc-300">{"{{domain}}"}</code>.
        </p>

        <p className="mt-4 text-sm text-zinc-400">
          To see what a link produces before you ship it, paste it into{" "}
          <A href="/dashboard" className="text-indigo-400 hover:underline">
            Dashboard → Card from a URL
          </A>
          . That renders the real image through the same code path as the API,
          brand defaults and plan included, so what you see is exactly the card
          the API returns.
        </p>

        <h3 className="mt-8 text-lg font-semibold">What to expect</h3>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-400">
          <li>
            Pages are read once and cached for 24 hours, so a card that renders
            a thousand times reads the page once. If a site is briefly down we
            keep serving the last copy rather than breaking your card.
          </li>
          <li>
            Needs an API key or a signed URL. Unauthenticated demo renders
            can&apos;t use it.
          </li>
          <li>
            We only fetch public <code className="text-zinc-300">http</code> and{" "}
            <code className="text-zinc-300">https</code> addresses, and refuse
            private network, loopback and cloud metadata addresses, whether
            named directly, reached by redirect, or arrived at through DNS.
          </li>
          <li>
            We identify ourselves as{" "}
            <code className="text-zinc-300">OGsmithBot/1.0</code>, follow up to
            4 redirects, give up after 5 seconds, and read at most 512KB of
            HTML.
          </li>
          <li>
            If the page can&apos;t be read and you passed no{" "}
            <code className="text-zinc-300">title</code>, you get a{" "}
            <code className="text-zinc-300">422</code> saying why, rather than
            a card with no text.
          </li>
        </ul>

    </>
  );
}

function Templates({ base, A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          The built-in templates cover the common cases. When you need your own
          layout, brand typeface or logo placement, design one in the visual
          editor at{" "}
          <A
            href="/dashboard/templates"
            className="text-indigo-400 hover:underline"
          >
            Dashboard → Templates
          </A>
          : drag text, images and shapes onto a 1200×630 canvas, upload the
          fonts and images you want, and save. Each design gets a slug you
          render by name.
        </p>
        <div className="mt-4">
          <CodeBlock>{`${base}/api/og?key=og_yourkey&tpl=launch-card&title=Shipping%20today&author=Ada`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Text layers hold <code className="text-zinc-300">{"{{placeholders}}"}</code>{" "}
          rather than fixed words, and any query parameter fills one in. You
          choose the names, so{" "}
          <code className="text-zinc-300">{"{{author}}"}</code> or{" "}
          <code className="text-zinc-300">{"{{readingTime}}"}</code> work just
          as well as <code className="text-zinc-300">{"{{title}}"}</code>. A
          placeholder with no matching parameter renders as nothing, so optional
          fields leave no gap. Long values shrink to fit their box unless you
          turn that off.
        </p>

        <h3 className="mt-8 text-lg font-semibold">Fonts and images</h3>
        <p className="mt-4 text-sm text-zinc-400">
          Drag a file straight onto the card to add it: an image lands where
          you dropped it, at its own proportions, and a font becomes available
          to your text layers. The image picker and the font control each
          upload too, and the Assets tab lists everything you have, what each
          file is used by, and how much of your quota is left.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Upload fonts as <code className="text-zinc-300">TTF</code>,{" "}
          <code className="text-zinc-300">OTF</code> or{" "}
          <code className="text-zinc-300">WOFF</code>, and images as{" "}
          <code className="text-zinc-300">PNG</code>,{" "}
          <code className="text-zinc-300">JPEG</code> or{" "}
          <code className="text-zinc-300">GIF</code>, up to 512KB each.{" "}
          <strong className="text-zinc-300">WOFF2 is not supported</strong>{" "}
          because the renderer cannot parse it, so upload the TTF or WOFF build
          of the same family. SVG and WebP aren&apos;t supported either; export a PNG.
          Google Fonts all publish TTF files on their GitHub repositories.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Images and fonts can only come from files you have uploaded. There is
          deliberately no way to point a template at an arbitrary URL: the
          renderer runs on our servers, and fetching URLs on your behalf is a
          class of problem we would rather not have.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Editing a template bumps your{" "}
          <A href="/docs/cache-refresh" className="text-indigo-400 hover:underline">
            cache version
          </A>{" "}
          automatically, because a design change leaves every card you have
          already shared showing the old artwork.
        </p>

    </>
  );
}

function Experiments({ base, A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Start with the main constraint:{" "}
          <strong className="text-zinc-200">
            you cannot A/B test a card across viewers
          </strong>
          . A social platform fetches your image once and shows that single
          copy to everyone who sees the post. There is no per-viewer request
          to split on. Any tool claiming otherwise is either splitting
          something else or not doing what it says.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          What does work is randomising by <em>page</em>. Half your articles
          get design A, half get design B, and you compare the two groups. That
          is a real experiment. It needs more pages than a viewer-level
          test would need viewers, and it answers &ldquo;which design works
          better across my content&rdquo; rather than &ldquo;which works better
          for this one post&rdquo;.
        </p>
        <div className="mt-4">
          <CodeBlock>{`${base}/api/og?key=og_yourkey&exp=headline-test&k=post-123&title=My%20post`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          <code className="text-zinc-300">k</code> identifies the page and must
          never change for it, so a post slug or database id works best. With{" "}
          <code className="text-zinc-300">&amp;url=</code> it defaults to that
          URL. OGsmith picks a page&apos;s variant once and stores it, so
          editing an experiment later never changes the artwork on posts already shared.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          <strong className="text-zinc-200">Never key on the headline.</strong>{" "}
          It is content, and content gets edited. Fixing one typo would change
          the key, and a changed key is a new page: it would be counted twice
          in the denominator and land in the other variant about half the time,
          with its history split across both arms. The API refuses the title
          for exactly this reason and asks for an id instead.
        </p>

        <h3 className="mt-8 text-lg font-semibold">Editing during a test</h3>
        <p className="mt-4 text-sm text-zinc-400">
          Fixing a typo in a card is fine. Change the text, bump your{" "}
          <A href="/docs/cache-refresh" className="text-indigo-400 hover:underline">
            cache version
          </A>{" "}
          so platforms refetch, and the experiment is unaffected: the key
          didn&apos;t change, so the page keeps its variant and its numbers.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Changing what a <em>variant</em> looks like is different. The numbers
          you have already describe the old design, so leaving them in place
          pools two different cards into one rate. The dashboard warns when you
          do this and offers <em>Reset results</em>, which clears the counters
          while keeping every page on the variant it already has.
          Measurement starts over, and nothing already shared changes
          appearance.
        </p>

        <h3 className="mt-8 text-lg font-semibold">Measuring the outcome</h3>
        <p className="mt-4 text-sm text-zinc-400">
          OGsmith can count how often a card was rendered, but a render is a
          crawler fetch, not a person or a click. Nothing about what a
          human does with your post ever reaches us. So outcomes have to come
          from the side that can see them: your analytics.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          Ask which variant a page is in, tag your own analytics with it, and
          report back what happened:
        </p>
        <div className="mt-4">
          <CodeBlock>{`GET ${base}/api/experiments/assign?key=og_yourkey&exp=headline-test&k=post-123

{ "experiment": "headline-test", "variant": "b",
  "label": "B — terminal", "params": { "template": "terminal" } }`}</CodeBlock>
        </div>
        <div className="mt-4">
          <CodeBlock>{`POST ${base}/api/experiments/convert
Authorization: Bearer og_yourkey

{ "exp": "headline-test", "k": "post-123" }`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Asking for an assignment doesn&apos;t count as a render, and neither
          call costs quota. Results appear under{" "}
          <A href="/dashboard/experiments" className="text-indigo-400 hover:underline">
            Dashboard → Experiments
          </A>
          , which reports a rate per page and a two-proportion test. It
          won&apos;t call anything a winner until each variant has at least 20
          pages and 5 reported outcomes. Stopping at the first good-looking
          number is the way most split tests go wrong.
        </p>

    </>
  );
}

function CacheRefresh({ base }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Once a link has been shared, X, Slack, Discord and WhatsApp keep
          serving the image they cached the first time, and none of them offer a
          way to clear it. Facebook and LinkedIn have scraper tools; the rest do
          not. Every one of them keys the cache on the image URL alone, so the
          only reliable fix is a different URL.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          That is what <code className="text-zinc-300">v</code> is for. It never
          reaches the renderer, so two URLs that differ only in{" "}
          <code className="text-zinc-300">v</code> produce the identical image,
          but a cache treats them as different resources:
        </p>
        <div className="mt-4">
          <CodeBlock>{`<meta
  property="og:image"
  content="${base}/api/og?key=og_yourkey&title=My%20post&v=3"
/>`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Your account carries a version number, shown in the dashboard under
          Cache refresh. It increments automatically whenever you change a brand
          default or your logo, because those edits leave published cards
          looking wrong without any warning. You can also bump it by hand from
          the same panel. Read
          it into your templates and every page you re-deploy picks up the new
          artwork:
        </p>
        <div className="mt-4">
          <CodeBlock>{`const og = new URL("${base}/api/og");
og.searchParams.set("key", process.env.OGSMITH_KEY);
og.searchParams.set("title", post.title);
og.searchParams.set("v", process.env.OGSMITH_CACHE_VERSION);`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Values are limited to 32 characters of{" "}
          <code className="text-zinc-300">A-Z a-z 0-9 . - _</code>. A build ID or
          content hash works just as well as the account version if you would
          rather refresh per page. Signed URLs cover{" "}
          <code className="text-zinc-300">v</code> like any other parameter, so
          re-sign after changing it.
        </p>

    </>
  );
}

function Batches({ base }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Cards render on demand at a URL, so you never need to generate them
          ahead of time. A batch is for the case a URL can&apos;t serve: when
          you need the <em>files</em>: to upload into a CMS media library, to
          embed in an email tool that won&apos;t fetch a dynamic image, or to
          keep as an archive.
        </p>
        <div className="mt-4">
          <CodeBlock>{`POST ${base}/api/batches
Authorization: Bearer og_yourkey

{ "name": "Back catalogue",
  "rows": [
    { "key": "launch-post", "params": { "title": "Introducing our API" } },
    { "key": "pricing", "params": { "title": "Simpler pricing", "template": "minimal" } }
  ] }`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Each row&apos;s <code className="text-zinc-300">params</code> are
          exactly the parameters{" "}
          <code className="text-zinc-300">/api/og</code> takes, so anything you
          can render one at a time you can render in bulk, including templates, sizes and{" "}
          <code className="text-zinc-300">url</code>. Rows count
          against your monthly quota, because they are real renders. A row that
          fails is recorded with its error and the rest carry on.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          <strong className="text-zinc-200">
            OGsmith works through a batch one slice at a time.
          </strong>{" "}
          There is no background queue: the submit call renders the first ten
          cards, and the response tells you whether it finished. If it
          didn&apos;t, call{" "}
          <code className="text-zinc-300">POST /api/batches/:id/run</code> until{" "}
          <code className="text-zinc-300">finished</code> is true. The dashboard
          does this for you.
        </p>
        <div className="mt-4">
          <CodeBlock>{`GET  ${base}/api/batches/:id            # status and per-row results
POST ${base}/api/batches/:id/run        # render the next slice
GET  ${base}/api/batches/:id/download   # zip of the rendered cards`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          We keep rendered images for 24 hours and then delete them, because a
          batch is a handoff, not file hosting. Pass{" "}
          <code className="text-zinc-300">&quot;storeImages&quot;: false</code>{" "}
          to validate a set of rows without keeping anything, which is a cheap
          way to find the broken ones before a migration.
        </p>

    </>
  );
}

function Webhooks({ A }: SectionProps) {
  return (
    <>
        <p className="mt-4 text-sm text-zinc-400">
          Add an endpoint under{" "}
          <A href="/dashboard/batches" className="text-indigo-400 hover:underline">
            Dashboard → Batches &amp; webhooks
          </A>{" "}
          and we POST JSON to it when something happens:{" "}
          <code className="text-zinc-300">batch.completed</code> and{" "}
          <code className="text-zinc-300">quota.threshold</code>.
        </p>
        <div className="mt-4">
          <CodeBlock>{`POST https://your-app.example.com/hooks/ogsmith
X-OGsmith-Event: batch.completed
X-OGsmith-Delivery: 6f1c…
X-OGsmith-Signature: t=1787840000,v1=9a3f…

{ "id": "6f1c…", "event": "batch.completed",
  "createdAt": "2026-08-27T15:51:02.000Z",
  "data": { "batchId": "…", "total": 14, "done": 14, "failed": 0 } }`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          The signing secret is shown once when you add the endpoint. Verify a
          delivery by recomputing the HMAC over{" "}
          <code className="text-zinc-300">timestamp + &quot;.&quot; + body</code>
          . The timestamp is signed together with the body rather than sent
          beside it, so nobody can replay a captured request with a fresh
          timestamp:
        </p>
        <div className="mt-4">
          <CodeBlock>{`import { createHmac, timingSafeEqual } from "crypto";

function verify(header, body, secret) {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!(age < 300)) return false;                 // reject replays
  const expected = createHmac("sha256", secret)
    .update(\`\${parts.t}.\${body}\`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex"));
}`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Reply with any 2xx. We retry a failed delivery with a growing delay,
          up to five attempts, and record every attempt so you can see what
          happened. Endpoints must be public addresses: we refuse private,
          loopback and cloud metadata addresses when you add them, and we
          don&apos;t follow redirects.
        </p>

    </>
  );
}

function Usage({ A }: SectionProps) {
  return (
    <>
        <h2 className="mt-12 text-2xl font-semibold">Check your usage</h2>
        <p className="mt-4 text-sm text-zinc-400">
          Poll your quota from code, for example to alert yourself before you
          hit the cap:
        </p>
        <div className="mt-4">
          <CodeBlock>{`GET /api/usage
Authorization: Bearer og_yourkey

{ "month": "2026-08", "plan": "pro", "used": 1204,
  "limit": 20000, "remaining": 18796, "watermark": false }`}</CodeBlock>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Quotas & caching</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-400">
          <li>Each successful render counts one unit against your monthly quota.</li>
          <li>
            The CDN caches responses for 24 hours, so repeat crawls of the same
            URL usually never reach the API (and cached hits never count
            against quota).
          </li>
          <li>
            To break that cache after a design change, change the URL with{" "}
            <A href="/docs/cache-refresh" className="text-indigo-400 hover:underline">
              <code>v</code>
            </A>
            . Nothing else reaches a social platform&apos;s cache.
          </li>
          <li>Quotas reset on the 1st of each month (UTC).</li>
          <li>
            We email you once at 80% of quota and once when you reach the cap,
            never more than one of each per month.
          </li>
          <li>Demo requests (no key) are watermarked and limited to ~20/minute.</li>
          <li>
            New accounts render without a watermark for {TRIAL_DAYS} days, so
            you can put real cards on a real site before deciding. After that
            the free plan carries a small watermark, but cards already fetched
            keep the clean copy platforms cached, so nothing changes overnight.
          </li>
          <li>
            Upgrading bumps your{" "}
            <A href="/docs/cache-refresh" className="text-indigo-400 hover:underline">
              cache version
            </A>{" "}
            automatically, so once your site republishes, new shares of links
            you&apos;ve already posted get the clean card too. Posts that are
            already out may keep the preview the platform stored.
          </li>
        </ul>

        <h2 className="mt-12 text-2xl font-semibold">Keep your key secret-ish</h2>
        <p className="mt-4 text-sm text-zinc-400">
          OG image URLs are public because crawlers must fetch them, so the
          key rides in the URL. That&apos;s standard for this category of API. If a
          key leaks and gets abused, rotate it from the dashboard; old URLs stop
          working immediately and your quota protects your bill (rendering stops
          at the cap, and there are no overage charges).
        </p>
    </>
  );
}

/** In reading order. Each one is a page at /docs/<slug>. */
export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "signed-urls",
    title: "Signed URLs",
    description:
      "Sign each OGsmith image URL with your account secret instead of putting your API key in the markup.",
    Body: SignedUrls,
  },
  {
    slug: "sizes",
    title: "Sizes",
    description:
      "Render the same card at 1200×630, square, story, YouTube and wide sizes with one parameter.",
    Body: Sizes,
  },
  {
    slug: "checker",
    title: "Check an existing link",
    description:
      "See what X, LinkedIn, Slack, WhatsApp and other platforms will show for a link, and what is wrong with its Open Graph tags.",
    Body: Checker,
  },
  {
    slug: "url-to-card",
    title: "Cards from a URL",
    description:
      "Point OGsmith at a page and it builds the card from the page's own title, description and image.",
    Body: UrlToCard,
  },
  {
    slug: "templates",
    title: "Your own templates",
    description:
      "Design your own card layouts in the visual editor, with your fonts and images, and render them by name.",
    Body: Templates,
  },
  {
    slug: "experiments",
    title: "Experiments",
    description:
      "A/B test card designs across your pages and read the result with a significance test.",
    Body: Experiments,
  },
  {
    slug: "cache-refresh",
    title: "Refreshing cached cards",
    description:
      "Make X, Slack, Discord and WhatsApp show your new card when a link is shared again, even after they cached the old one.",
    Body: CacheRefresh,
  },
  {
    slug: "batches",
    title: "Batches",
    description:
      "Render many cards at once and download them as a zip.",
    Body: Batches,
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    description:
      "Receive a signed POST when a batch finishes or you near your quota, and verify that it came from OGsmith.",
    Body: Webhooks,
  },
  {
    slug: "usage",
    title: "Usage, quotas and keys",
    description:
      "How to check usage from the API, how quotas and caching work, and how to look after your API key.",
    ownHeadings: true,
    Body: Usage,
  },
];

export function docSection(slug: string): DocSection | null {
  return DOC_SECTIONS.find((s) => s.slug === slug) ?? null;
}
