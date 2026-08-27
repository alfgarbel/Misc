import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ExperimentEditor from "@/components/experiments/ExperimentEditor";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listActiveKeys } from "@/lib/keys";
import { appUrl } from "@/lib/stripe";
import {
  compareAll,
  experimentTotals,
  getOwnedExperiment,
  variantsOf,
} from "@/lib/experiments";

export const metadata: Metadata = { title: "Experiment" };
export const dynamic = "force-dynamic";

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const row = await getOwnedExperiment(db, user.id, id);
  if (!row) notFound();

  const variants = variantsOf(row);
  if (!variants.success) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <h1 className="text-xl font-bold">This experiment can&apos;t be opened</h1>
          <p className="mt-3 text-sm text-zinc-400">{variants.error}</p>
          <Link
            href="/dashboard/experiments"
            className="mt-6 inline-block text-sm text-indigo-400 hover:underline"
          >
            ← Back to experiments
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const [totals, keys] = await Promise.all([
    experimentTotals(db, row),
    listActiveKeys(db, user.id),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/experiments"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Experiments
        </Link>
        <div className="mt-4">
          <ExperimentEditor
            id={row.id}
            initialName={row.name}
            initialSlug={row.slug}
            initialStatus={row.status}
            initialVariants={variants.data}
            totals={totals}
            comparisons={compareAll(totals)}
            baseUrl={appUrl()}
            apiKeyHint={keys[0]?.keyPrefix ? `${keys[0].keyPrefix}…` : "YOUR_KEY"}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
