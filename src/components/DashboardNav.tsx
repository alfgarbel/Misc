"use client";

import { useEffect, useState } from "react";

export interface DashboardSection {
  id: string;
  label: string;
}

/**
 * Jump links for the dashboard's sections: a sticky sidebar on wide screens,
 * a horizontally scrolling row on phones. The section in view is highlighted.
 */
export default function DashboardNav({ sections }: { sections: DashboardSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A section counts as current once its top passes the upper third.
      { rootMargin: "-20% 0px -60% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur lg:top-8 lg:mx-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0"
    >
      <ul className="flex gap-1 whitespace-nowrap lg:flex-col">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`block rounded-lg px-3 py-1.5 text-sm ${
                active === s.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
