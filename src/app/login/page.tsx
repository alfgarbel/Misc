import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/dashboard");
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20">
        <h1 className="mb-10 text-3xl font-bold">Welcome back</h1>
        <AuthForm mode="login" />
      </main>
    </>
  );
}
