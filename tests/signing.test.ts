import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  canonicalMessage,
  signParams,
  verifySignature,
  buildSignedUrl,
  generateSigningSecret,
  getOrCreateSigningSecret,
  rotateSigningSecret,
} from "@/lib/signing";
import { createTestDb } from "./helpers";
import { users } from "@/lib/db/schema";

describe("URL signing", () => {
  const secret = "s".repeat(64);

  it("canonicalizes params sorted by name, excluding sig", () => {
    const p = new URLSearchParams(
      "title=Hello&acct=u1&template=split&sig=deadbeef"
    );
    expect(canonicalMessage(p)).toBe("acct=u1&template=split&title=Hello");
  });

  it("uses decoded values in the canonical message", () => {
    const p = new URLSearchParams("title=Caf%C3%A9%20%26%20Bar&acct=u1");
    expect(canonicalMessage(p)).toBe("acct=u1&title=Café & Bar");
  });

  it("round-trips sign and verify", () => {
    const p = new URLSearchParams("title=Hello&acct=u1&template=split");
    p.set("sig", signParams(p, secret));
    expect(verifySignature(p, secret)).toBe(true);
  });

  it("rejects tampered parameters", () => {
    const p = new URLSearchParams("title=Hello&acct=u1");
    p.set("sig", signParams(p, secret));
    p.set("title", "Hacked");
    expect(verifySignature(p, secret)).toBe(false);
  });

  it("rejects wrong secrets and malformed signatures", () => {
    const p = new URLSearchParams("title=Hello&acct=u1");
    p.set("sig", signParams(p, secret));
    expect(verifySignature(p, "different-secret")).toBe(false);
    p.set("sig", "nothex");
    expect(verifySignature(p, secret)).toBe(false);
    p.delete("sig");
    expect(verifySignature(p, secret)).toBe(false);
  });

  it("buildSignedUrl produces a verifiable URL", () => {
    const url = buildSignedUrl(
      "https://ogsmith.example/",
      { title: "My post", template: "quote" },
      "acct-1",
      secret
    );
    const params = new URL(url).searchParams;
    expect(url).toContain("https://ogsmith.example/api/og?");
    expect(params.get("acct")).toBe("acct-1");
    expect(verifySignature(params, secret)).toBe(true);
  });

  it("stores, reuses, and rotates secrets per user", async () => {
    const db = await createTestDb();
    const id = randomUUID();
    await db.insert(users).values({ id, email: `${id}@t.dev`, passwordHash: "x" });

    const s1 = await getOrCreateSigningSecret(db, id);
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(await getOrCreateSigningSecret(db, id)).toBe(s1);

    const s2 = await rotateSigningSecret(db, id);
    expect(s2).not.toBe(s1);
    expect(await getOrCreateSigningSecret(db, id)).toBe(s2);
    expect(await getOrCreateSigningSecret(db, "missing-user")).toBeNull();
  });

  it("generates distinct secrets", () => {
    expect(generateSigningSecret()).not.toBe(generateSigningSecret());
  });
});
