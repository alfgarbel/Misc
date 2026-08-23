import type { Metadata } from "next";
import Nav from "@/components/Nav";
import ForgotForm from "@/components/ForgotForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20">
        <h1 className="mb-2 text-3xl font-bold">Reset your password</h1>
        <p className="mb-10 text-zinc-400">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <ForgotForm />
      </main>
    </>
  );
}
