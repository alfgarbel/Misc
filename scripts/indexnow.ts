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

async function main() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base || base.includes("localhost")) {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the public site, e.g. https://ogsmith.com");
  }

  const keyRes = await fetch(`${base}/${INDEXNOW_KEY}.txt`);
  if (!keyRes.ok || (await keyRes.text()).trim() !== INDEXNOW_KEY) {
    throw new Error(`Key file not live at ${base}/${INDEXNOW_KEY}.txt; deploy first.`);
  }

  let urls = process.argv.slice(2);
  if (urls.length === 0) {
    const res = await fetch(`${base}/sitemap.xml`);
    if (!res.ok) throw new Error(`Could not read ${base}/sitemap.xml (${res.status})`);
    urls = sitemapLocs(await res.text());
  }

  const statuses = await submitIndexNow(base, urls);
  // 200 and 202 both mean accepted; anything else is worth reading.
  console.log(`Submitted ${urls.length} URLs to IndexNow: ${statuses.join(", ")}`);
  if (statuses.some((s) => s !== 200 && s !== 202)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
