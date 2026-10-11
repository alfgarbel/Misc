import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DocsContent from "@/components/docs/DocsContent";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "OGsmith API reference: one GET request returns a social card PNG. Parameters, sizes, signed URLs, cards from a URL, custom templates, A/B tests, batches, webhooks and quotas.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  // Shown in every snippet so the docs always quote this deployment's own URL.
  const base = appUrl().replace(/\/$/, "");
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <DocsContent base={base} link={Link} />
      </main>
      <Footer />
    </>
  );
}
