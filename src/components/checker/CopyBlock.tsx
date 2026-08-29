"use client";

import { useState } from "react";

export default function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the text is on screen and
      // selectable either way, so there is nothing to apologise for.
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 pr-24 text-xs leading-relaxed text-emerald-300">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
