import { describe, it, expect } from "vitest";
import { createTestDb } from "./helpers";
import { provisionAccount } from "@/lib/accounts";
import {
  backoffMs,
  computeSignature,
  createWebhook,
  deleteWebhook,
  generateWebhookSecret,
  getOwnedWebhook,
  parseEvents,
  setWebhookActive,
  signatureHeader,
  signaturePayload,
  verifySignature,
  REPLAY_TOLERANCE_SECONDS,
} from "@/lib/webhooks";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ event: "batch.completed", data: { total: 3 } });

describe("signing", () => {
  it("signs the timestamp together with the body", () => {
    // Signed together, not sent alongside: otherwise a captured delivery
    // could be replayed with its timestamp rewritten.
    expect(signaturePayload(1700000000, "x")).toBe("1700000000.x");
    const a = computeSignature(SECRET, 1700000000, BODY);
    const b = computeSignature(SECRET, 1700000001, BODY);
    expect(a).not.toBe(b);
  });

  it("produces a header a receiver can verify", () => {
    const now = 1700000000;
    const header = signatureHeader(SECRET, now, BODY);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignature(header, SECRET, BODY, { nowSeconds: now })).toBe(true);
  });

  it("rejects the wrong secret", () => {
    const now = 1700000000;
    const header = signatureHeader(SECRET, now, BODY);
    expect(verifySignature(header, "whsec_other", BODY, { nowSeconds: now })).toBe(false);
  });

  it("rejects a tampered body", () => {
    const now = 1700000000;
    const header = signatureHeader(SECRET, now, BODY);
    const tampered = JSON.stringify({ event: "batch.completed", data: { total: 9999 } });
    expect(verifySignature(header, SECRET, tampered, { nowSeconds: now })).toBe(false);
  });

  it("rejects a replay outside the tolerance window", () => {
    const signedAt = 1700000000;
    const header = signatureHeader(SECRET, signedAt, BODY);
    const later = signedAt + REPLAY_TOLERANCE_SECONDS + 1;
    expect(verifySignature(header, SECRET, BODY, { nowSeconds: later })).toBe(false);
    // Just inside the window is still fine.
    expect(
      verifySignature(header, SECRET, BODY, { nowSeconds: signedAt + REPLAY_TOLERANCE_SECONDS - 1 })
    ).toBe(true);
  });

  it("tolerates a receiver clock that runs slightly fast", () => {
    const signedAt = 1700000000;
    const header = signatureHeader(SECRET, signedAt, BODY);
    expect(verifySignature(header, SECRET, BODY, { nowSeconds: signedAt - 30 })).toBe(true);
  });

  it("rejects malformed headers rather than throwing", () => {
    for (const header of ["", "garbage", "t=abc,v1=xyz", "v1=" + "a".repeat(64), "t=1700000000"]) {
      expect(() => verifySignature(header, SECRET, BODY)).not.toThrow();
      expect(verifySignature(header, SECRET, BODY, { nowSeconds: 1700000000 })).toBe(false);
    }
  });

  it("rejects a signature of the wrong shape without comparing lengths", () => {
    // timingSafeEqual throws on mismatched lengths, so the shape is checked
    // before the comparison.
    expect(
      verifySignature("t=1700000000,v1=abcd", SECRET, BODY, { nowSeconds: 1700000000 })
    ).toBe(false);
  });

  it("mints distinct, prefixed secrets", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe("backoff", () => {
  it("grows with each attempt and stops growing", () => {
    const delays = [1, 2, 3, 4, 5].map(backoffMs);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    expect(backoffMs(50)).toBeLessThanOrEqual(60 * 60_000);
  });
});

describe("parseEvents", () => {
  it("reads a stored list", () => {
    expect(parseEvents('["batch.completed"]')).toEqual(["batch.completed"]);
  });

  it("falls back to everything on unreadable input", () => {
    expect(parseEvents("{not json")).toEqual(["*"]);
    expect(parseEvents('["not.an.event"]')).toEqual(["*"]);
  });
});

async function seed() {
  const db = await createTestDb();
  const owner = await provisionAccount(db, { email: "o@example.com", passwordHash: "h" });
  const other = await provisionAccount(db, { email: "x@example.com", passwordHash: "h" });
  return { db, ownerId: owner.userId, otherId: other.userId };
}

describe("registering an endpoint", () => {
  it("refuses an address the outbound guard would refuse", async () => {
    // A webhook URL is an SSRF primitive with a friendlier name, so the
    // same guard applies — and it is applied at registration so the user
    // finds out immediately instead of wondering why nothing arrives.
    const { db, ownerId } = await seed();
    for (const url of [
      "http://127.0.0.1:9000/hook",
      "http://169.254.169.254/",
      "http://localhost/hook",
      "file:///etc/passwd",
      "http://admin:pw@example.com/",
      "http://10.0.0.5/hook",
    ]) {
      const result = await createWebhook(db, ownerId, { url, events: ["*"] });
      expect(result.ok, url).toBe(false);
    }
  });

  it("accepts a public https endpoint and mints a secret", async () => {
    const { db, ownerId } = await seed();
    const result = await createWebhook(db, ownerId, {
      url: "https://example.com/hooks/ogsmith",
      events: ["batch.completed"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.webhook.secret).toMatch(/^whsec_/);
      expect(parseEvents(result.webhook.events)).toEqual(["batch.completed"]);
    }
  });

  it("will not read, pause or delete another account's endpoint", async () => {
    const { db, ownerId, otherId } = await seed();
    const created = await createWebhook(db, ownerId, {
      url: "https://example.com/hook",
      events: ["*"],
    });
    if (!created.ok) throw new Error("setup failed");
    const id = created.webhook.id;

    expect(await getOwnedWebhook(db, otherId, id)).toBeNull();
    expect(await setWebhookActive(db, otherId, id, false)).toBe(false);
    expect(await deleteWebhook(db, otherId, id)).toBe(false);
    expect(await getOwnedWebhook(db, ownerId, id)).not.toBeNull();
  });
});
