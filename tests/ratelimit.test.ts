import { describe, it, expect } from "vitest";
import { makeRateLimiter, clientIp } from "@/lib/ratelimit";

describe("rate limiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const rl = makeRateLimiter(3, 60_000);
    const t = 1_000_000;
    expect(rl.limited("a", t)).toBe(false);
    expect(rl.limited("a", t + 1)).toBe(false);
    expect(rl.limited("a", t + 2)).toBe(false);
    expect(rl.limited("a", t + 3)).toBe(true);
    expect(rl.limited("a", t + 4)).toBe(true);
  });

  it("tracks ids independently", () => {
    const rl = makeRateLimiter(1, 60_000);
    const t = 1_000_000;
    expect(rl.limited("a", t)).toBe(false);
    expect(rl.limited("b", t)).toBe(false);
    expect(rl.limited("a", t + 1)).toBe(true);
    expect(rl.limited("b", t + 1)).toBe(true);
  });

  it("resets after the window elapses", () => {
    const rl = makeRateLimiter(1, 60_000);
    const t = 1_000_000;
    expect(rl.limited("a", t)).toBe(false);
    expect(rl.limited("a", t + 30_000)).toBe(true);
    expect(rl.limited("a", t + 60_001)).toBe(false);
  });

  it("extracts the first forwarded IP", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(clientIp(h)).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
