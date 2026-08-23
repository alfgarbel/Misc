import { describe, it, expect, beforeAll } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-not-for-production";
});

describe("auth", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("round-trips session tokens", async () => {
    const token = await createSessionToken("user-123");
    expect(await verifySessionToken(token)).toBe("user-123");
  });

  it("rejects tampered and garbage tokens", async () => {
    const token = await createSessionToken("user-123");
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await createSessionToken("user-123");
    process.env.AUTH_SECRET = "a-different-secret-entirely";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = "test-secret-not-for-production";
  });
});
