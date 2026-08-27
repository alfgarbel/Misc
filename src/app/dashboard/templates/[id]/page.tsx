import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TemplateEditor from "@/components/editor/TemplateEditor";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { getOwnedTemplate, specOf } from "@/lib/templates";
import { listAssets } from "@/lib/assets";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = { title: "Edit template" };
export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const row = await getOwnedTemplate(db, user.id, id);
  if (!row) notFound();

  const spec = specOf(row);
  if (!spec.success) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <h1 className="text-xl font-bold">This template can&apos;t be opened</h1>
          <p className="mt-3 text-sm text-zinc-400">{spec.error}</p>
          <Link
            href="/dashboard/templates"
            className="mt-6 inline-block text-sm text-indigo-400 hover:underline"
          >
            ← Back to templates
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const [assets, plan] = await Promise.all([
    listAssets(db, user.id),
    getUserPlan(db, user.id),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/templates"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Templates
        </Link>
        <div className="mt-4">
          <TemplateEditor
            templateId={row.id}
            initialName={row.name}
            initialSlug={row.slug}
            initialSpec={spec.data}
            initialAssets={assets.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
            assetLimit={PLANS[plan].assets}
            baseUrl={appUrl()}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
