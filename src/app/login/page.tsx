import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import AuthForm from "@/components/AuthForm";
import GoogleButton, { GoogleError } from "@/components/GoogleButton";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
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
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <GoogleError code={error} />
        {google ? (
          <>
            <GoogleButton label="Continue with Google" />
            <div className="flex w-full max-w-sm items-center gap-3 text-xs text-zinc-600">
              <span className="h-px flex-1 bg-zinc-800" />
              or
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
          </>
        ) : null}
        <AuthForm mode="login" />
        {google ? (
          <p className="max-w-sm text-center text-xs text-zinc-600">
            Signed up with Google? Use the button above — that account has no
            password unless you set one.
          </p>
        ) : null}
      </main>
    </>
  );
}
