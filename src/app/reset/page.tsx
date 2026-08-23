import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import ResetForm from "@/components/ResetForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20">
        <h1 className="mb-10 text-3xl font-bold">Choose a new password</h1>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </main>
    </>
  );
}
