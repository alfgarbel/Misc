/**
 * Best-effort in-memory fixed-window rate limiter. Per serverless instance —
 * a determined attacker can exceed it across instances, but it stops
 * single-source brute force and demo abuse without external infrastructure.
 */
export interface RateLimiter {
  /** Returns true when this hit exceeds the limit for `id`. */
  limited(id: string, now?: number): boolean;
}

export function makeRateLimiter(limit: number, windowMs = 60_000): RateLimiter {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return {
    limited(id: string, now: number = Date.now()): boolean {
      const entry = hits.get(id);
      if (!entry || now - entry.windowStart > windowMs) {
        hits.set(id, { count: 1, windowStart: now });
        if (hits.size > 10_000) {
          // Drop stale entries rather than growing unboundedly.
          for (const [k, v] of hits) {
            if (now - v.windowStart > windowMs) hits.delete(k);
          }
        }
        return false;
      }
      entry.count += 1;
      return entry.count > limit;
    },
  };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
