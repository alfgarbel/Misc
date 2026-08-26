import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="prose prose-invert mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            By using OGsmith you agree to these terms. The service generates
            images from parameters you supply; you are responsible for the
            content of those parameters and must not use the service to produce
            unlawful, deceptive, or infringing content.
          </p>
          <p>
            Paid plans renew monthly and can be canceled any time from the
            billing portal; access continues until the end of the paid period.
            Quotas reset monthly and unused renders do not roll over.
          </p>
          <p>
            All prices are stated exclusive of VAT. Where VAT is due, it is
            calculated at checkout based on your billing country and shown
            separately before you pay. Business customers in the EU outside
            Spain who supply a valid VAT number are not charged VAT, and the
            reverse charge mechanism applies.
          </p>
          <p>
            The service is provided &quot;as is&quot; without warranty. Our total
            liability is limited to the amount you paid in the preceding month.
            We may update these terms; continued use constitutes acceptance.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
