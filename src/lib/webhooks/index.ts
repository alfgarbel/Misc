import { randomUUID } from "crypto";
import { and, desc, eq, lte, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { webhooks, webhookDeliveries } from "../db/schema";
import type { WebhookRow } from "../db/schema";
import { safeFetch, FETCH_MESSAGES } from "../urlcard/fetch";
import { checkUrl } from "../urlcard/safety";
import {
  DELIVERY_HEADER,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  generateWebhookSecret,
  signatureHeader,
} from "./sign";

export * from "./sign";

/** Events an endpoint can subscribe to. "*" means all of them. */
export const WEBHOOK_EVENTS = ["batch.completed", "quota.threshold"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const eventsSchema = z
  .array(z.union([z.enum(WEBHOOK_EVENTS), z.literal("*")]))
  .min(1)
  .max(WEBHOOK_EVENTS.length + 1);

const MAX_ATTEMPTS = 5;
/** Response bodies are read only far enough to log a useful error. */
const MAX_RESPONSE_BYTES = 8 * 1024;
const DELIVERY_TIMEOUT_NOTE = "endpoint did not respond in time";

export function parseEvents(json: string): string[] {
  try {
    const parsed = eventsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : ["*"];
  } catch {
    return ["*"];
  }
}

function subscribes(row: WebhookRow, event: string): boolean {
  const events = parseEvents(row.events);
  return events.includes("*") || events.includes(event);
}

export async function listWebhooks(
  db: Database,
  userId: string
): Promise<WebhookRow[]> {
  return db
    .select()
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt));
}

export async function countWebhooks(
  db: Database,
  userId: string
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhooks)
    .where(eq(webhooks.userId, userId));
  return count;
}

export type CreateWebhookResult =
  | { ok: true; webhook: WebhookRow }
  | { ok: false; reason: string };

/**
 * Registers an endpoint, refusing anything the outbound guard would refuse
 * anyway. Checking at registration means the user finds out immediately,
 * rather than wondering why deliveries silently never arrive.
 */
export async function createWebhook(
  db: Database,
  userId: string,
  input: { url: string; events: string[] }
): Promise<CreateWebhookResult> {
  const verdict = await checkUrl(input.url);
  if (!verdict.ok) {
    return { ok: false, reason: FETCH_MESSAGES[verdict.reason!] };
  }
  const row: WebhookRow = {
    id: randomUUID(),
    userId,
    url: input.url,
    secret: generateWebhookSecret(),
    events: JSON.stringify(input.events.length ? input.events : ["*"]),
    active: true,
    createdAt: new Date(),
    lastStatus: null,
    lastDeliveredAt: null,
  };
  await db.insert(webhooks).values(row);
  return { ok: true, webhook: row };
}

export async function getOwnedWebhook(
  db: Database,
  userId: string,
  id: string
): Promise<WebhookRow | null> {
  const row = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
  });
  return row ?? null;
}

export async function deleteWebhook(
  db: Database,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getOwnedWebhook(db, userId, id);
  if (!existing) return false;
  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)));
  return true;
}

export async function setWebhookActive(
  db: Database,
  userId: string,
  id: string,
  active: boolean
): Promise<boolean> {
  const existing = await getOwnedWebhook(db, userId, id);
  if (!existing) return false;
  await db
    .update(webhooks)
    .set({ active })
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)));
  return true;
}

/** Exponential, so a broken endpoint is retried a few times then left alone. */
export function backoffMs(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** (attempts - 1));
}

async function attemptDelivery(
  db: Database,
  webhook: WebhookRow,
  deliveryId: string,
  event: string,
  body: string,
  attempts: number,
  now: Date
): Promise<boolean> {
  const timestamp = Math.floor(now.getTime() / 1000);
  const res = await safeFetch(webhook.url, {
    method: "POST",
    body,
    maxBytes: MAX_RESPONSE_BYTES,
    // A redirected POST is ambiguous, and following one would step around
    // the guard that just approved this address.
    followRedirects: false,
    extraHeaders: {
      [SIGNATURE_HEADER]: signatureHeader(webhook.secret, timestamp, body),
      [EVENT_HEADER]: event,
      [DELIVERY_HEADER]: deliveryId,
    },
  });

  const nextAttempts = attempts + 1;
  if (res.ok) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "delivered",
        attempts: nextAttempts,
        responseStatus: 200,
        nextAttemptAt: null,
        deliveredAt: now,
        error: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    await db
      .update(webhooks)
      .set({ lastStatus: "delivered", lastDeliveredAt: now })
      .where(eq(webhooks.id, webhook.id));
    return true;
  }

  const exhausted = nextAttempts >= MAX_ATTEMPTS;
  await db
    .update(webhookDeliveries)
    .set({
      status: exhausted ? "failed" : "pending",
      attempts: nextAttempts,
      error:
        res.reason === "timeout"
          ? DELIVERY_TIMEOUT_NOTE
          : FETCH_MESSAGES[res.reason],
      nextAttemptAt: exhausted
        ? null
        : new Date(now.getTime() + backoffMs(nextAttempts)),
    })
    .where(eq(webhookDeliveries.id, deliveryId));
  await db
    .update(webhooks)
    .set({ lastStatus: exhausted ? "failed" : "retrying", lastDeliveredAt: now })
    .where(eq(webhooks.id, webhook.id));
  return false;
}

/**
 * Sends an event to every subscribed endpoint.
 *
 * Delivery is attempted inline and recorded either way. There is no queue
 * in this architecture, so a failure is written down with a retry time and
 * picked up by `retryDueDeliveries` rather than being retried in a loop
 * that would hold the request open.
 */
export async function dispatchEvent(
  db: Database,
  userId: string,
  event: WebhookEvent,
  data: unknown,
  now: Date = new Date()
): Promise<{ attempted: number; delivered: number }> {
  const endpoints = (await listWebhooks(db, userId)).filter(
    (w) => w.active && subscribes(w, event)
  );
  let delivered = 0;
  for (const endpoint of endpoints) {
    const deliveryId = randomUUID();
    const body = JSON.stringify({
      id: deliveryId,
      event,
      createdAt: now.toISOString(),
      data,
    });
    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: endpoint.id,
      event,
      payload: body,
      status: "pending",
      attempts: 0,
      responseStatus: null,
      error: null,
      nextAttemptAt: null,
      createdAt: now,
      deliveredAt: null,
    });
    const ok = await attemptDelivery(
      db,
      endpoint,
      deliveryId,
      event,
      body,
      0,
      now
    );
    if (ok) delivered += 1;
  }
  return { attempted: endpoints.length, delivered };
}

/** Retries deliveries whose backoff has elapsed. Bounded per call. */
export async function retryDueDeliveries(
  db: Database,
  userId: string,
  now: Date = new Date(),
  limit = 10
): Promise<{ retried: number; delivered: number }> {
  const due = await db
    .select({
      delivery: webhookDeliveries,
      webhook: webhooks,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(
      and(
        eq(webhooks.userId, userId),
        eq(webhooks.active, true),
        eq(webhookDeliveries.status, "pending"),
        or(
          isNull(webhookDeliveries.nextAttemptAt),
          lte(webhookDeliveries.nextAttemptAt, now)
        )
      )
    )
    .limit(limit);

  let delivered = 0;
  for (const { delivery, webhook } of due) {
    // Skip the very first attempt, which dispatchEvent already made.
    if (delivery.attempts === 0 && delivery.nextAttemptAt === null) continue;
    const ok = await attemptDelivery(
      db,
      webhook,
      delivery.id,
      delivery.event,
      delivery.payload,
      delivery.attempts,
      now
    );
    if (ok) delivered += 1;
  }
  return { retried: due.length, delivered };
}

export async function listDeliveries(
  db: Database,
  webhookId: string,
  limit = 20
) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}
