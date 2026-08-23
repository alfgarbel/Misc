"use client";

import { useState } from "react";

export default function VerifyBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
      <p className="text-amber-200">
        Your email isn&apos;t verified yet.{" "}
        {message ? <span className="text-amber-300">{message}</span> : null}
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/auth/resend-verification", {
              method: "POST",
            });
            const data = await res.json().catch(() => ({}));
            setMessage(data.message ?? data.error ?? "Done");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg border border-amber-500/60 px-3 py-1.5 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
