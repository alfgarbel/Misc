import Link from "next/link";
import { DOC_SECTIONS } from "./sections";

/** Every docs page, with the current one marked. A sidebar on desktop, a list above the page on phones. */
export default function DocsNav({ current }: { current: string | null }) {
  const items = [{ slug: null, title: "API reference" }, ...DOC_SECTIONS];
  return (
    <nav aria-label="Docs" className="text-sm">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-1">
        {items.map((s) => {
          const active = s.slug === current;
          return (
            <li key={s.slug ?? "index"}>
              <Link
                href={s.slug ? `/docs/${s.slug}` : "/docs"}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "font-medium text-indigo-400"
                    : "text-zinc-400 hover:text-zinc-100"
                }
              >
                {s.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
