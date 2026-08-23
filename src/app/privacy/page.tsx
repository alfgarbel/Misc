import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            We store your email address, a hash of your password, a hash of your
            API key, and monthly render counts. That&apos;s the whole customer
            record.
          </p>
          <p>
            Render parameters (titles, subtitles) pass through the renderer and
            may appear transiently in server logs for debugging; they are not
            stored in the database or shared with third parties.
          </p>
          <p>
            Payments are processed by Stripe — card details never touch our
            servers. We don&apos;t sell data or run third-party ad trackers. To
            delete your account and all associated data, contact support.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
