import Link from "next/link";
import type { CardRow } from "@/lib/db/schema";
import { timeAgo } from "@/lib/cards";

const card = "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6";

function label(row: CardRow): string {
  if (row.title) return row.title;
  if (row.pageUrl) return row.pageUrl.replace(/^https?:\/\//, "");
  return "Untitled card";
}

/**
 * Every card the account's pages have asked for, newest first, so people
 * can see their tag working without opening X or LinkedIn to find out.
 */
export default function PagesPanel({ rows, now }: { rows: CardRow[]; now: Date }) {
  if (rows.length === 0) {
    return (
      <div className={card}>
        <h3 className="font-semibold">No cards yet</h3>
        <p className="mt-1 text-sm text-zinc-400">
          A page shows up here the first time it asks for its card. Add the
          tag to your page, then open it or share the link.
        </p>
      </div>
    );
  }

  const problems = rows.filter((r) => r.error).length;

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Pages with a card</h3>
        <p className="text-sm text-zinc-400">
          {rows.length === 1 ? "1 page" : `${rows.length} pages`}
          {problems > 0 ? (
            <span className="text-amber-300">
              {", "}
              {problems === 1 ? "1 needs a look" : `${problems} need a look`}
            </span>
          ) : null}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-800">
        {rows.map((row) => (
          <li key={row.cardKey} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            {row.error ? (
              // Drawing it again would hit the same problem.
              <div
                aria-hidden="true"
                className="hidden aspect-[1200/630] w-40 shrink-0 items-center justify-center rounded-md border border-dashed border-amber-500/40 bg-zinc-950 text-xs text-amber-300/80 sm:flex"
              >
                No card
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/cards/${row.cardKey}/image`}
                alt=""
                width={1200}
                height={630}
                loading="lazy"
                className="hidden aspect-[1200/630] w-40 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 object-cover sm:block"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-100">{label(row)}</p>
              {row.pageUrl ? (
                <a
                  href={row.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {row.pageUrl}
                </a>
              ) : null}
              {row.error ? (
                <p className="mt-2 break-words text-sm text-amber-300">
                  Last try failed {timeAgo(row.lastSeenAt, now)}: {row.error}
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  {row.lastCrawler && row.lastCrawledAt ? (
                    <>
                      <span className="text-emerald-300">
                        Fetched by {row.lastCrawler} {timeAgo(row.lastCrawledAt, now)}.
                      </span>{" "}
                    </>
                  ) : (
                    "No social platform has fetched it yet. "
                  )}
                  Drawn {row.renders === 1 ? "once" : `${row.renders.toLocaleString()} times`},
                  last {timeAgo(row.lastSeenAt, now)}.
                </p>
              )}
              {row.pageUrl ? (
                <Link
                  href={`/check?url=${encodeURIComponent(row.pageUrl)}`}
                  className="mt-1 inline-block text-xs text-indigo-400 hover:underline"
                >
                  See how it looks on each platform
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        Platforms and our CDN keep a copy of each card, so a page shows up
        again only when its card is drawn fresh, not every time someone
        shares it.
      </p>
    </div>
  );
}
