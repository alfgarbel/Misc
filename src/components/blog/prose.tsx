import type { ReactNode } from "react";

/** Shared prose pieces, so posts read as one voice and one type scale. */

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 text-2xl font-semibold text-white">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-lg font-semibold text-white">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-relaxed text-zinc-400">{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-lg leading-relaxed text-zinc-300">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 flex flex-col gap-2 text-zinc-400">{children}</ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 leading-relaxed">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-zinc-400 marker:text-indigo-400">
      {children}
    </ol>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded bg-zinc-800/70 px-1.5 py-0.5 text-[0.9em] text-emerald-300">
      {children}
    </code>
  );
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-emerald-400">
      <code>{children}</code>
    </pre>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 text-zinc-300">
      {children}
    </div>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b border-zinc-700 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-zinc-800/70 px-3 py-2.5 align-top text-zinc-400"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
