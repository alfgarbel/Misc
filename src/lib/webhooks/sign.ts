import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Signing for outgoing webhooks.
 *
 * The timestamp is signed alongside the body, not sent beside it, so a
 * captured delivery cannot be replayed later with its timestamp rewritten.
 * Receivers check the signature and then reject anything older than their
 * tolerance.
 */

export const SIGNATURE_HEADER = "X-OGsmith-Signature";
export const EVENT_HEADER = "X-OGsmith-Event";
export const DELIVERY_HEADER = "X-OGsmith-Delivery";

/** Default window a receiver should accept, and what our docs recommend. */
export const REPLAY_TOLERANCE_SECONDS = 300;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** The exact bytes that get signed: timestamp, a dot, then the body. */
export function signaturePayload(timestampSeconds: number, body: string): string {
  return `${timestampSeconds}.${body}`;
}

export function computeSignature(
  secret: string,
  timestampSeconds: number,
  body: string
): string {
  return createHmac("sha256", secret)
    .update(signaturePayload(timestampSeconds, body))
    .digest("hex");
}

/** Header value, in the `t=…,v1=…` form receivers already know from Stripe. */
export function signatureHeader(
  secret: string,
  timestampSeconds: number,
  body: string
): string {
  return `t=${timestampSeconds},v1=${computeSignature(secret, timestampSeconds, body)}`;
}

export interface VerifyOptions {
  /** Seconds of clock skew and delay to tolerate. */
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/**
 * Verifies a header the way a receiver should. Exported because it is the
 * reference the docs point at — a snippet people copy is worth having
 * tested rather than written out prose-style and hoped over.
 */
export function verifySignature(
  header: string,
  secret: string,
  body: string,
  options: VerifyOptions = {}
): boolean {
  const tolerance = options.toleranceSeconds ?? REPLAY_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  const parts = new Map(
    header
      .split(",")
      .map((chunk) => chunk.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()])
  );
  const timestamp = Number(parts.get("t"));
  const provided = parts.get("v1");
  if (!provided || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now - timestamp) > tolerance) return false;
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const expected = computeSignature(secret, timestamp, body);
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex")
  );
}
