/**
 * Pings IndexNow with the site's URLs, so Bing and friends recrawl them
 * without waiting. Run it after a deploy that adds or changes pages:
 *
 *   npm run indexnow                          # every URL in the live sitemap
 *   npm run indexnow -- https://site/blog/x   # just these URLs
 *
 * The site is NEXT_PUBLIC_APP_URL. The key file must already be live at
 * /<key>.txt, so run this against the deployed site, not before.
 */
import { sitemapLocs, submitIndexNow, INDEXNOW_KEY } from "../src/lib/indexnow";

// In GitHub Actions these lines become annotations on the run, so the result
// is readable from the run's summary without opening the log.
const inActions = Boolean(process.env.GITHUB_ACTIONS);
const notice = (msg: string) => console.log(inActions ? `::notice::${msg}` : msg);
const fail = (msg: string): never => {
  throw new Error(msg);
};

async function main() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base || base.includes("localhost")) {
    fail("Set NEXT_PUBLIC_APP_URL to the public site, e.g. https://ogsmith.app");
  }
  const host = new URL(base!).host;

  const keyUrl = `${base}/${INDEXNOW_KEY}.txt`;
  const keyRes = await fetch(keyUrl);
  if (!keyRes.ok || (await keyRes.text()).trim() !== INDEXNOW_KEY) {
    fail(`Key file not live at ${keyUrl} (${keyRes.status}); deploy first.`);
  }
  // Engines don't follow a redirect to another host when verifying the key.
  if (new URL(keyRes.url).host !== host) {
    fail(`${keyUrl} redirects to ${keyRes.url}; set NEXT_PUBLIC_APP_URL to that host instead.`);
  }

  let urls = process.argv.slice(2);
  if (urls.length === 0) {
    const res = await fetch(`${base}/sitemap.xml`);
    if (!res.ok) fail(`Could not read ${base}/sitemap.xml (${res.status})`);
    urls = sitemapLocs(await res.text());
  }

  const own = urls.filter((u) => URL.canParse(u) && new URL(u).host === host);
  if (own.length === 0) {
    fail(`None of the ${urls.length} URLs are on ${host} (first: ${urls[0] ?? "none"}).`);
  }
  if (own.length < urls.length) {
    notice(`Skipping ${urls.length - own.length} URLs not on ${host} (e.g. ${urls.find((u) => !own.includes(u))}).`);
  }

  const results = await submitIndexNow(base!, own);
  for (const r of results) {
    notice(`IndexNow answered ${r.status} for ${r.urls} URLs on ${host}${r.body ? `: ${r.body}` : ""}`);
  }
  // 200 and 202 both mean accepted; anything else is worth reading.
  if (results.some((r) => r.status !== 200 && r.status !== 202)) {
    fail("IndexNow rejected the submission; see the answer above.");
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(inActions ? `::error::${msg}` : msg);
  process.exit(1);
});
