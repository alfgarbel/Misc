import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TemplateList from "@/components/editor/TemplateList";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { listTemplates } from "@/lib/templates";

export const metadata: Metadata = { title: "Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const db = getDb();
  const [rows, plan] = await Promise.all([
    listTemplates(db, user.id),
    getUserPlan(db, user.id),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <a
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Dashboard
          </a>
          <h1 className="mt-2 text-2xl font-bold">Templates</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Design a card once, then render it with different text by passing
            values in the URL.
          </p>
        </div>
        <TemplateList
          initial={rows.map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            updatedAt: r.updatedAt.toISOString(),
          }))}
          limit={PLANS[plan].templates}
          planName={PLANS[plan].name}
        />
      </main>
      <Footer />
    </>
  );
}
