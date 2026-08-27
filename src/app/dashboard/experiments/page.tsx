import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ExperimentList from "@/components/experiments/ExperimentList";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { experimentTotals, listExperiments } from "@/lib/experiments";

export const metadata: Metadata = { title: "Experiments" };
export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const db = getDb();
  const [rows, plan] = await Promise.all([
    listExperiments(db, user.id),
    getUserPlan(db, user.id),
  ]);
  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      totals: await experimentTotals(db, row),
    }))
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Experiments</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Serve different card designs to different pages and compare how they
            do. Half your posts get design A, half get design B.
          </p>
        </div>
        <ExperimentList
          initial={items}
          limit={PLANS[plan].experiments}
          planName={PLANS[plan].name}
        />
      </main>
      <Footer />
    </>
  );
}
