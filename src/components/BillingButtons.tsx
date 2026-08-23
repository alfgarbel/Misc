"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function postAndRedirect(path: string, body?: object): Promise<string | null> {
  const res = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.url) {
    window.location.href = data.url;
    return null;
  }
  return data.error ?? "Something went wrong";
}

export function UpgradeButton({
  plan,
  label,
  primary,
}: {
  plan: "pro" | "scale";
  label: string;
  primary?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(await postAndRedirect("/api/stripe/checkout", { plan }));
          setBusy(false);
        }}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          primary
            ? "bg-indigo-600 text-white hover:bg-indigo-500"
            : "border border-zinc-700 hover:border-zinc-500"
        }`}
      >
        {busy ? "Redirecting…" : label}
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(await postAndRedirect("/api/stripe/portal"));
          setBusy(false);
        }}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 disabled:opacity-50"
      >
        {busy ? "Redirecting…" : "Manage billing"}
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm text-zinc-500 hover:text-zinc-300"
    >
      Log out
    </button>
  );
}
