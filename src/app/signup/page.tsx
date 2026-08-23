import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/dashboard");
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20">
        <h1 className="mb-2 text-3xl font-bold">Create your account</h1>
        <p className="mb-10 text-zinc-400">
          Free plan included — 500 renders a month, no card required.
        </p>
        <AuthForm mode="signup" />
      </main>
    </>
  );
}
