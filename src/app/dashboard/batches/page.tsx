import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BatchPanel from "@/components/batches/BatchPanel";
import WebhookPanel from "@/components/batches/WebhookPanel";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { listBatches, purgeExpired } from "@/lib/batches";
import { listWebhooks, parseEvents } from "@/lib/webhooks";

export const metadata: Metadata = { title: "Batches & webhooks" };
export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const db = getDb();
  // Opening the page is as good a moment as any to drop images whose
  // retention window has passed; there is no scheduler to do it for us.
  await purgeExpired(db, user.id).catch(() => 0);

  const [batches, hooks, plan] = await Promise.all([
    listBatches(db, user.id),
    listWebhooks(db, user.id),
    getUserPlan(db, user.id),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Batches &amp; webhooks</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Render many cards at once and get the files, and be told when
            things finish.
          </p>
        </div>
        <div className="grid gap-6 [&>*]:min-w-0">
          <BatchPanel
            initial={batches.map((b) => ({
              id: b.id,
              name: b.name,
              status: b.status,
              total: b.total,
              done: b.done,
              failed: b.failed,
              storeImages: b.storeImages,
              retainUntil: b.retainUntil?.toISOString() ?? null,
              createdAt: b.createdAt.toISOString(),
            }))}
            rowLimit={PLANS[plan].batchRows}
            planName={PLANS[plan].name}
          />
          <WebhookPanel
            initial={hooks.map((w) => ({
              id: w.id,
              url: w.url,
              events: parseEvents(w.events),
              active: w.active,
              lastStatus: w.lastStatus,
              lastDeliveredAt: w.lastDeliveredAt?.toISOString() ?? null,
            }))}
            limit={PLANS[plan].webhooks}
            planName={PLANS[plan].name}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
