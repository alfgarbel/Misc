import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = { title: "Docs" };

const PARAMS: Array<{
  name: string;
  type: string;
  def: string;
  desc: string;
}> = [
  {
    name: "key",
    type: "string",
    def: "—",
    desc: "Your API key (og_…). Omit for watermarked, rate-limited demo renders.",
  },
  {
    name: "template",
    type: "gradient | minimal | split | terminal | quote | announce",
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
    def: "—",
    desc: "Supporting line under the title.",
  },
  {
    name: "site",
    type: "string (≤ 100 chars)",
    def: "—",
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
    name: "tpl",
    type: "string",
    def: "—",
    desc: "Slug of one of your own templates from the visual editor. Replaces template; every other parameter becomes a {{placeholder}} value.",
  },
  {
    name: "v",
    type: "string (≤ 32 chars)",
    def: "—",
    desc: "Cache-busting token. Ignored when rendering; changing it is what forces social platforms to re-fetch. See Refreshing cached cards.",
  },
  {
    name: "acct + sig",
    type: "string",
    def: "—",
    desc: "Signed-URL auth: your account ID plus an HMAC signature. Alternative to key — see Signed URLs below.",
  },
];

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm leading-relaxed text-emerald-400">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  // Shown in every snippet so the docs always quote this deployment's own URL.
  const base = appUrl().replace(/\/$/, "");
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold">API reference</h1>
        <p className="mt-3 text-zinc-400">
          One endpoint. GET it, get a 1200×630 PNG back.
        </p>

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
          10 named API keys and revoke them independently — per-key render
          counts show on the dashboard. On paid plans, an uploaded logo
          (dashboard → Brand defaults) renders on every card next to the site
          name.
        </p>

        <h2 id="signed-urls" className="mt-12 text-2xl font-semibold">
          Signed URLs
        </h2>
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

        <h2 id="templates" className="mt-12 text-2xl font-semibold">
          Your own templates
        </h2>
        <p className="mt-4 text-sm text-zinc-400">
          The built-in templates cover the common cases. When you need your own
          layout, brand typeface or logo placement, design one in the visual
          editor at{" "}
          <Link
            href="/dashboard/templates"
            className="text-indigo-400 hover:underline"
          >
            Dashboard → Templates
          </Link>
          : drag text, images and shapes onto a 1200×630 canvas, upload the
          fonts and images you want, and save. Each design gets a slug you
          render by name.
        </p>
        <div className="mt-4">
          <CodeBlock>{`${base}/api/og?key=og_yourkey&tpl=launch-card&title=Shipping%20today&author=Ada`}</CodeBlock>
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Text layers hold <code className="text-zinc-300">{"{{placeholders}}"}</code>{" "}
          rather than fixed words, and any query parameter fills one in — the
          names are yours, so{" "}
          <code className="text-zinc-300">{"{{author}}"}</code> or{" "}
          <code className="text-zinc-300">{"{{readingTime}}"}</code> work just
          as well as <code className="text-zinc-300">{"{{title}}"}</code>. A
          placeholder with no matching parameter renders as nothing, so optional
          fields leave no gap. Long values shrink to fit their box unless you
          turn that off.
        </p>

        <h3 className="mt-8 text-lg font-semibold">Fonts and images</h3>
        <p className="mt-4 text-sm text-zinc-400">
          Upload fonts as <code className="text-zinc-300">TTF</code>,{" "}
          <code className="text-zinc-300">OTF</code> or{" "}
          <code className="text-zinc-300">WOFF</code>, and images as{" "}
          <code className="text-zinc-300">PNG</code>,{" "}
          <code className="text-zinc-300">JPEG</code> or{" "}
          <code className="text-zinc-300">GIF</code>, up to 512KB each.{" "}
          <strong className="text-zinc-300">WOFF2 is not supported</strong> —
          the renderer cannot parse it — so upload the TTF or WOFF build of the
          same family. SVG and WebP aren&apos;t supported either; export a PNG.
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
          <a href="#cache-refresh" className="text-indigo-400 hover:underline">
            cache version
          </a>{" "}
          automatically, because a design change leaves every card you have
          already shared showing the old artwork.
        </p>

        <h2 id="cache-refresh" className="mt-12 text-2xl font-semibold">
          Refreshing cached cards
        </h2>
        <p className="mt-4 text-sm text-zinc-400">
          Once a link has been shared, X, Slack, Discord and WhatsApp keep
          serving the image they cached the first time, and none of them offer a
          way to clear it. Facebook and LinkedIn have scraper tools; the rest do
          not. Every one of them keys the cache on the image URL alone, so the
          only reliable lever is a different URL.
        </p>
        <p className="mt-4 text-sm text-zinc-400">
          That is what <code className="text-zinc-300">v</code> is for. It never
          reaches the renderer — two URLs that differ only in{" "}
          <code className="text-zinc-300">v</code> produce the identical image —
          but to a cache they are different resources:
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
          default or your logo — the edits that silently leave published cards
          looking wrong — and you can bump it by hand from the same panel. Read
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

        <h2 className="mt-12 text-2xl font-semibold">Check your usage</h2>
        <p className="mt-4 text-sm text-zinc-400">
          Poll your quota programmatically — useful for alerting before you hit
          the cap:
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
            Responses are CDN-cached for 24 hours — repeat crawls of the same URL
            usually never hit the API (and never count against quota).
          </li>
          <li>
            To break that cache after a design change, change the URL with{" "}
            <a href="#cache-refresh" className="text-indigo-400 hover:underline">
              <code>v</code>
            </a>
            . Nothing else reaches a social platform&apos;s cache.
          </li>
          <li>Quotas reset on the 1st of each month (UTC).</li>
          <li>
            You get one email at 80% of quota and one when the cap is reached —
            never more than one of each per month.
          </li>
          <li>Demo requests (no key) are watermarked and limited to ~20/minute.</li>
        </ul>

        <h2 className="mt-12 text-2xl font-semibold">Keep your key secret-ish</h2>
        <p className="mt-4 text-sm text-zinc-400">
          OG image URLs are public by nature — crawlers must fetch them — so the
          key rides in the URL. That&apos;s standard for this category of API. If a
          key leaks and gets abused, rotate it from the dashboard; old URLs stop
          working immediately and your quota protects your bill (rendering stops
          at the cap — there are no overage charges).
        </p>
      </main>
      <Footer />
    </>
  );
}
