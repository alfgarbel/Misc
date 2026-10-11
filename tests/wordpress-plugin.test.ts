import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { join } from "path";
import { readFileSync } from "fs";
import { verifySignature } from "@/lib/signing";

/**
 * The plugin signs card URLs in PHP; the API verifies them in TypeScript.
 * These run the real plugin code through the PHP CLI, so a difference in
 * percent-encoding or ordering shows up here rather than as broken cards.
 */
const php = (() => {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function pluginUrl(params: Record<string, string>, settings: Record<string, string>): URL {
  const out = execFileSync("php", [join(__dirname, "fixtures/wp-sign.php")], {
    input: JSON.stringify({
      params,
      settings: { account_id: "", secret: "", api_key: "", ...settings },
    }),
  }).toString();
  return new URL(out);
}

describe.skipIf(!php)("WordPress plugin", () => {
  it("signs URLs the API accepts, whatever the title contains", () => {
    const secret = "s3cret";
    for (const title of ["Hello world", "It's (almost) 100% *done*!", "Café — ünïcödé & more", "a+b=c?d#e/f~g"]) {
      const url = pluginUrl({ title, subtitle: "Sub", template: "split" }, { account_id: "acc_1", secret });
      expect(url.origin + url.pathname).toBe("https://ogsmith.app/api/og");
      expect(url.searchParams.get("title")).toBe(title);
      expect(url.searchParams.get("acct")).toBe("acc_1");
      expect(verifySignature(url.searchParams, secret)).toBe(true);
      expect(verifySignature(url.searchParams, "other")).toBe(false);
    }
  });

  it("falls back to an API key and leaves out empty values", () => {
    const url = pluginUrl({ title: "T", subtitle: "" }, { api_key: "og_abc" });
    expect(url.searchParams.get("key")).toBe("og_abc");
    expect(url.searchParams.has("subtitle")).toBe(false);
    expect(url.searchParams.has("sig")).toBe(false);
  });

  it("returns nothing until an account is connected", () => {
    const out = execFileSync("php", [join(__dirname, "fixtures/wp-sign.php")], {
      input: JSON.stringify({ params: { title: "T" }, settings: { account_id: "", secret: "", api_key: "" } }),
    }).toString();
    expect(out).toBe("");
  });
});

describe("WordPress plugin download", () => {
  it("is built from the current plugin source", () => {
    const zip = join(__dirname, "../public/downloads/ogsmith-wordpress.zip");
    for (const file of ["ogsmith.php", "readme.txt"]) {
      const zipped = execFileSync("unzip", ["-p", zip, `ogsmith/${file}`]).toString();
      const source = readFileSync(join(__dirname, "../wordpress-plugin/ogsmith", file), "utf8");
      // If this fails, run scripts/build-wp-plugin.sh.
      expect(zipped).toBe(source);
    }
  });
});
