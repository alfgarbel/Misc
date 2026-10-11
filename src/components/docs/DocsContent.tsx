import { DOC_SECTIONS, Overview } from "./sections";

/**
 * The whole API reference on one page, without the page around it.
 * /llms-full.txt renders this to Markdown; the site shows the same sections
 * one per page under /docs, so the two can't drift.
 */
export default function DocsContent({
  base,
  link: A = "a",
}: {
  base: string;
  /** next/link on the page. Markdown rendering has no router, so it gets a plain <a>. */
  link?: React.ElementType;
}) {
  return (
    <>
      <h1 className="text-4xl font-bold">API reference</h1>
      <p className="mt-3 text-zinc-400">A GET request to one endpoint returns a 1200×630 PNG.</p>
      <Overview base={base} A={A} />
      {DOC_SECTIONS.map(({ slug, title, ownHeadings, Body }) => (
        <section key={slug}>
          {ownHeadings ? null : (
            <h2 id={slug} className="mt-12 text-2xl font-semibold">
              {title}
            </h2>
          )}
          <Body base={base} A={A} />
        </section>
      ))}
    </>
  );
}
