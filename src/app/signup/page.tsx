import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import AuthForm from "@/components/AuthForm";
import GoogleButton, { GoogleError } from "@/components/GoogleButton";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";
import RememberUrl from "@/components/onboarding/RememberUrl";
import { coerceUrl } from "@/lib/checker";
import { TRIAL_DAYS } from "@/lib/trial";
import { getDb } from "@/lib/db";
import { saveOnboardingUrl } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: "Sign up",
  description: `Create a free OGsmith account: an API key in seconds and ${TRIAL_DAYS} days of social cards without a watermark. No card required.`,
  alternates: { canonical: "/signup" },
};
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; url?: string }>;
}) {
  const { error, url } = await searchParams;
  // Arriving from the checker: the dashboard will open on this page's card.
  const fromCheck = url ? coerceUrl(url) : null;
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    // Already signed in: keep the page they just checked, unless their
    // card is already live and the checklist is gone anyway.
    if (fromCheck && !user.liveAt) {
      await saveOnboardingUrl(getDb(), user.id, fromCheck, { overwrite: true });
    }
    redirect("/dashboard");
  }
  const domain = fromCheck ? new URL(fromCheck).hostname.replace(/^www\./, "") : null;
  const google = googleConfigured();

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold">
            {domain ? `Get the card for ${domain}` : "Create your account"}
          </h1>
          <p className="text-zinc-400">
            {TRIAL_DAYS} days without a watermark, then 500 free renders a
            month. No card required.
          </p>
          {domain ? (
            <p className="mt-2 text-sm text-zinc-500">
              Your dashboard will open with this page&apos;s card and the tag
              to paste.
            </p>
          ) : null}
        </div>
        {fromCheck ? <RememberUrl url={fromCheck} /> : null}
        <GoogleError code={error} />
        {google ? (
          <>
            <GoogleButton label="Sign up with Google" />
            <div className="flex w-full max-w-sm items-center gap-3 text-xs text-zinc-600">
              <span className="h-px flex-1 bg-zinc-800" />
              or
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
          </>
        ) : null}
        <AuthForm mode="signup" />
      </main>
    </>
  );
}
