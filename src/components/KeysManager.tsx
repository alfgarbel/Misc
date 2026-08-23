"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface KeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  rendersThisMonth: number;
}

export default function KeysManager({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<{ id: string | null; key: string } | null>(
    null
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // One-time pickup of the plaintext key handed over from the signup flow.
    // sessionStorage isn't available during SSR, so this must run post-mount;
    // the resulting single re-render is intentional.
    try {
      const k = sessionStorage.getItem("ogsmith:newKey");
      if (k) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewKey({ id: null, key: k });
        sessionStorage.removeItem("ogsmith:newKey");
      }
    } catch {}
  }, []);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Default" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create key");
        return;
      }
      setNewKey({ id: data.id, key: data.apiKey });
      setCopied(false);
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, keyName: string) {
    if (
      !window.confirm(
        `Revoke "${keyName}"? Requests using it stop working immediately.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (newKey?.id === id) setNewKey(null);
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-1 font-semibold">API keys</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Up to 10 active keys — use separate keys per site or environment so you
        can revoke them independently and see per-key usage.
      </p>

      {newKey ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="mb-2 text-sm text-amber-400">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-emerald-400">
              {newKey.key}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newKey.key);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:border-zinc-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      {keys.length > 0 ? (
        <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Renders (month)</th>
                <th className="px-4 py-2.5 font-medium">Last used</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2.5">{k.name}</td>
                  <td className="px-4 py-2.5">
                    <code className="text-emerald-400">{k.keyPrefix}…</code>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    {k.rendersThisMonth.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleDateString()
                      : "never"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => revoke(k.id, k.name)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No active keys.</p>
      )}

      <form onSubmit={createKey} className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Key name (e.g. blog-production)"
          className="min-w-64 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create key"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
