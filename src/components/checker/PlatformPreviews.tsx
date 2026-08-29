"use client";

import { useState } from "react";

/**
 * How each platform lays out a link preview.
 *
 * Two shapes do most of the work: a wide banner above the text, and a small
 * square thumbnail beside it. Which one you get is the whole point — the
 * same image is a hero on LinkedIn and a postage stamp on WhatsApp, and no
 * amount of reading documentation makes that as obvious as seeing it.
 *
 * These are close approximations, not pixel-exact clones. Platforms change
 * their rendering without notice, so the page says so rather than implying
 * a guarantee.
 */

type Shape = "wide" | "square";

interface Platform {
  id: string;
  name: string;
  shape: Shape;
  /** Roughly where the title gets cut off. */
  titleChars: number;
  showsDescription: boolean;
  note?: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "x-large",
    name: "X · summary_large_image",
    shape: "wide",
    titleChars: 70,
    showsDescription: false,
    note: "Only with twitter:card set to summary_large_image.",
  },
  {
    id: "x-small",
    name: "X · summary",
    shape: "square",
    titleChars: 70,
    showsDescription: true,
    note: "What you get when twitter:card is missing or set to summary.",
  },
  { id: "linkedin", name: "LinkedIn", shape: "wide", titleChars: 120, showsDescription: false },
  { id: "facebook", name: "Facebook", shape: "wide", titleChars: 100, showsDescription: true },
  { id: "slack", name: "Slack", shape: "wide", titleChars: 120, showsDescription: true },
  { id: "discord", name: "Discord", shape: "wide", titleChars: 120, showsDescription: true },
  {
    id: "whatsapp",
    name: "WhatsApp",
    shape: "square",
    titleChars: 60,
    showsDescription: true,
    note: "Shows a wide image only for some senders and sizes.",
  },
  { id: "imessage", name: "iMessage", shape: "wide", titleChars: 60, showsDescription: false },
];

function truncate(text: string, max: number): { text: string; cut: boolean } {
  if (text.length <= max) return { text, cut: false };
  return { text: `${text.slice(0, max).trimEnd()}…`, cut: true };
}

function Thumb({
  imageUrl,
  shape,
  failed,
  onFail,
}: {
  imageUrl: string | null;
  shape: Shape;
  failed: boolean;
  onFail: () => void;
}) {
  const box =
    shape === "wide"
      ? "aspect-[1200/630] w-full"
      : "aspect-square h-20 w-20 shrink-0 sm:h-24 sm:w-24";

  if (!imageUrl || failed) {
    return (
      <div
        className={`${box} flex items-center justify-center border-b border-zinc-800 bg-zinc-900 text-center text-[10px] text-zinc-600`}
      >
        {failed ? "image didn't load" : "no image"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      onError={onFail}
      className={`${box} bg-zinc-900 object-cover`}
      loading="lazy"
    />
  );
}

export default function PlatformPreviews({
  imageUrl,
  title,
  description,
  domain,
}: {
  imageUrl: string | null;
  title: string;
  description: string | null;
  domain: string;
}) {
  // The browser loads the image straight from its own host, so a site with
  // hotlink protection can fail here even though our server fetched it
  // fine. That difference is worth naming rather than hiding.
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const t = truncate(title, p.titleChars);
          return (
            <figure
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <figcaption className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">{p.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                  {p.shape === "wide" ? "wide 1.91:1" : "square thumb"}
                </span>
              </figcaption>

              <div
                className={`overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 ${
                  p.shape === "square" ? "flex items-stretch gap-3 p-3" : ""
                }`}
              >
                <Thumb
                  imageUrl={imageUrl}
                  shape={p.shape}
                  failed={failed}
                  onFail={() => setFailed(true)}
                />
                <div
                  className={`flex min-w-0 flex-col justify-center gap-1 ${
                    p.shape === "wide" ? "p-3" : ""
                  }`}
                >
                  <span className="truncate text-[10px] uppercase tracking-wider text-zinc-500">
                    {domain}
                  </span>
                  <span className="text-xs font-medium leading-snug text-zinc-100">
                    {t.text}
                    {t.cut ? (
                      <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] text-amber-300">
                        cut
                      </span>
                    ) : null}
                  </span>
                  {p.showsDescription && description ? (
                    <span className="line-clamp-2 text-[11px] leading-snug text-zinc-500">
                      {description}
                    </span>
                  ) : null}
                </div>
              </div>

              {p.note ? (
                <p className="text-[11px] leading-snug text-zinc-600">{p.note}</p>
              ) : null}
            </figure>
          );
        })}
      </div>

      {failed && imageUrl ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Your browser couldn&apos;t load that image, but our server could. That
          usually means hotlink protection or a firewall rule that lets crawlers
          through and blocks browsers — worth checking, since some platforms
          fetch the image the same way your browser just did.
        </p>
      ) : null}

      <p className="text-xs text-zinc-600">
        Approximate layouts. Every platform changes how it renders previews
        without announcing it, so treat these as the shape and crop you&apos;ll
        get rather than a pixel-exact copy.
      </p>
    </div>
  );
}
