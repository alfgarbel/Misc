import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

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
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-16">
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
  content="https://YOUR-DEPLOYMENT/api/og?key=og_yourkey&template=split&title=My%20post&site=myblog.com&accent=%23f43f5e"
/>
<meta name="twitter:card" content="summary_large_image" />`}</CodeBlock>
        </div>

        <h2 className="mt-12 text-2xl font-semibold">Next.js example</h2>
        <div className="mt-4">
          <CodeBlock>{`export function generateMetadata({ params }) {
  const og = new URL("https://YOUR-DEPLOYMENT/api/og");
  og.searchParams.set("key", process.env.OGSMITH_KEY);
  og.searchParams.set("title", post.title);
  og.searchParams.set("site", "myblog.com");
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
          counts show on the dashboard.
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
          <code className="text-zinc-300">acct</code>, with decoded values),
          sort pairs by name, join as <code className="text-zinc-300">name=value</code>{" "}
          with <code className="text-zinc-300">&amp;</code>, and HMAC-SHA256 it
          with your secret (hex output).
        </p>
        <div className="mt-4">
          <CodeBlock>{`import { createHmac } from "crypto";

function signedOgUrl(params, accountId, secret) {
  const p = new URLSearchParams(params);
  p.set("acct", accountId);
  const msg = [...p.entries()]
    .sort(([a, x], [b, y]) =>
      a === b ? x.localeCompare(y) : a.localeCompare(b))
    .map(([k, v]) => \`\${k}=\${v}\`)
    .join("&");
  p.set("sig", createHmac("sha256", secret).update(msg).digest("hex"));
  return \`https://YOUR-DEPLOYMENT/api/og?\${p}\`;
}

signedOgUrl({ title: "My post", template: "split" }, ACCOUNT_ID, SECRET);`}</CodeBlock>
        </div>

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
          <li>Quotas reset on the 1st of each month (UTC).</li>
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
