import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import AuthForm from "@/components/AuthForm";
import GoogleButton, { GoogleError } from "@/components/GoogleButton";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser().catch(() => null)) redirect("/dashboard");
  const { error } = await searchParams;
  const google = googleConfigured();

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold">Create your account</h1>
          <p className="text-zinc-400">
            Free plan included — 500 renders a month, no card required.
          </p>
        </div>
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
