import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import type { OgParams } from "./params";
import { fittedFontSize } from "./spec";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

function loadFonts() {
  if (!fontsPromise) {
    const dir = join(process.cwd(), "src", "fonts");
    fontsPromise = Promise.all([
      readFile(join(dir, "Inter-Regular.ttf")),
      readFile(join(dir, "Inter-Bold.ttf")),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontsPromise;
}

function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function titleFontSize(title: string): number {
  if (title.length <= 40) return 76;
  if (title.length <= 80) return 60;
  if (title.length <= 120) return 48;
  return 40;
}

interface Palette {
  bg: string;
  fg: string;
  muted: string;
}

function palette(theme: "dark" | "light"): Palette {
  return theme === "dark"
    ? { bg: "#09090b", fg: "#fafafa", muted: "#a1a1aa" }
    : { bg: "#fafafa", fg: "#18181b", muted: "#52525b" };
}

interface TplProps {
  p: OgParams;
  watermark: boolean;
  logo?: string | null;
  /** The source page's own image, when rendering from ?url=. */
  hero?: string | null;
}

function Logo({ src, size = 40 }: { src: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      style={{ borderRadius: 8, objectFit: "contain", marginRight: 16 }}
      alt=""
    />
  );
}

function Watermark({ theme }: { theme: "dark" | "light" }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 28,
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        borderRadius: 999,
        backgroundColor:
          theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
        color: theme === "dark" ? "#d4d4d8" : "#3f3f46",
        fontSize: 22,
      }}
    >
      made with OGsmith
    </div>
  );
}

function GradientTemplate({ p, watermark, logo }: TplProps) {
  const c = palette(p.theme);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 80,
        backgroundColor: c.bg,
        backgroundImage: `radial-gradient(circle at 20% 0%, ${withAlpha(
          p.accent,
          0.55
        )} 0%, transparent 55%), radial-gradient(circle at 100% 100%, ${withAlpha(
          p.accent,
          0.35
        )} 0%, transparent 50%)`,
        color: c.fg,
      }}
    >
      <div
        style={{
          fontSize: titleFontSize(p.title),
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          maxWidth: 1000,
        }}
      >
        {p.title}
      </div>
      {p.subtitle ? (
        <div
          style={{
            marginTop: 24,
            fontSize: 34,
            color: c.muted,
            lineHeight: 1.35,
            maxWidth: 950,
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
      {p.site ? (
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            color: c.muted,
          }}
        >
          {logo ? (
            <Logo src={logo} />
          ) : (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                backgroundColor: p.accent,
                marginRight: 16,
              }}
            />
          )}
          {p.site}
        </div>
      ) : null}
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

function MinimalTemplate({ p, watermark, logo }: TplProps) {
  const c = palette(p.theme);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        backgroundColor: c.bg,
        color: c.fg,
      }}
    >
      <div
        style={{ width: 120, height: 10, backgroundColor: p.accent, borderRadius: 999 }}
      />
      <div
        style={{
          marginTop: 56,
          fontSize: titleFontSize(p.title),
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          maxWidth: 1000,
        }}
      >
        {p.title}
      </div>
      {p.subtitle ? (
        <div
          style={{
            marginTop: 26,
            fontSize: 32,
            color: c.muted,
            lineHeight: 1.4,
            maxWidth: 950,
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
      <div style={{ display: "flex", flexGrow: 1 }} />
      {p.site || logo ? (
        <div
          style={{
            fontSize: 28,
            color: c.muted,
            display: "flex",
            alignItems: "center",
          }}
        >
          {logo ? <Logo src={logo} /> : null}
          {p.site}
        </div>
      ) : null}
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

function SplitTemplate({ p, watermark, logo }: TplProps) {
  const c = palette(p.theme);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: c.bg,
        color: c.fg,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 60px 80px 80px",
          width: 760,
        }}
      >
        <div
          style={{
            fontSize: titleFontSize(p.title),
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
          }}
        >
          {p.title}
        </div>
        {p.subtitle ? (
          <div
            style={{ marginTop: 26, fontSize: 30, color: c.muted, lineHeight: 1.4 }}
          >
            {p.subtitle}
          </div>
        ) : null}
        {p.site || logo ? (
          <div
            style={{
              marginTop: 44,
              fontSize: 26,
              color: c.muted,
              display: "flex",
              alignItems: "center",
            }}
          >
            {logo ? <Logo src={logo} size={36} /> : null}
            {p.site}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          position: "relative",
          backgroundColor: p.accent,
          backgroundImage: `linear-gradient(135deg, ${p.accent} 0%, ${withAlpha(
            p.accent,
            0.6
          )} 100%)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.18)",
            top: -90,
            right: -110,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.15)",
            bottom: -60,
            left: -40,
          }}
        />
      </div>
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

function TerminalTemplate({ p, watermark, logo }: TplProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        backgroundImage: `radial-gradient(circle at 50% 120%, ${withAlpha(
          p.accent,
          0.35
        )} 0%, transparent 60%)`,
        padding: 70,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          borderRadius: 20,
          backgroundColor: "#18181b",
          border: "1px solid #3f3f46",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 28px",
            backgroundColor: "#27272a",
          }}
        >
          <div style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: "#f87171", marginRight: 12 }} />
          <div style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: "#fbbf24", marginRight: 12 }} />
          <div style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: "#34d399" }} />
          {p.site || logo ? (
            <div
              style={{
                marginLeft: 24,
                fontSize: 22,
                color: "#a1a1aa",
                display: "flex",
                alignItems: "center",
              }}
            >
              {logo ? <Logo src={logo} size={26} /> : null}
              {p.site}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 48,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ fontSize: 44, color: p.accent, marginRight: 20 }}>$</div>
            <div
              style={{
                fontSize: Math.min(titleFontSize(p.title), 60),
                fontWeight: 700,
                color: "#fafafa",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                maxWidth: 900,
              }}
            >
              {p.title}
            </div>
          </div>
          {p.subtitle ? (
            <div
              style={{
                marginTop: 28,
                marginLeft: 64,
                fontSize: 30,
                color: "#a1a1aa",
                lineHeight: 1.4,
                maxWidth: 880,
              }}
            >
              {p.subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {watermark ? <Watermark theme="dark" /> : null}
    </div>
  );
}

function QuoteTemplate({ p, watermark, logo }: TplProps) {
  const c = palette(p.theme);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "70px 90px",
        backgroundColor: c.bg,
        backgroundImage: `radial-gradient(circle at 0% 100%, ${withAlpha(
          p.accent,
          0.18
        )} 0%, transparent 55%)`,
        color: c.fg,
      }}
    >
      <div
        style={{
          fontSize: 160,
          fontWeight: 700,
          color: p.accent,
          lineHeight: 0.6,
          marginBottom: 8,
        }}
      >
        “
      </div>
      <div
        style={{
          fontSize: Math.min(titleFontSize(p.title), 60),
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          maxWidth: 1000,
        }}
      >
        {p.title}
      </div>
      {p.subtitle ? (
        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            color: c.muted,
          }}
        >
          <div
            style={{
              width: 48,
              height: 4,
              backgroundColor: p.accent,
              borderRadius: 999,
              marginRight: 20,
            }}
          />
          {p.subtitle}
        </div>
      ) : null}
      {p.site || logo ? (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 90,
            fontSize: 24,
            color: c.muted,
            display: "flex",
            alignItems: "center",
          }}
        >
          {logo ? <Logo src={logo} size={34} /> : null}
          {p.site}
        </div>
      ) : null}
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

function AnnounceTemplate({ p, watermark, logo }: TplProps) {
  const c = palette(p.theme);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        backgroundColor: c.bg,
        backgroundImage: `radial-gradient(circle at 50% -20%, ${withAlpha(
          p.accent,
          0.4
        )} 0%, transparent 60%)`,
        color: c.fg,
        textAlign: "center",
      }}
    >
      {logo ? (
        <div style={{ display: "flex", marginBottom: 28 }}>
          <Logo src={logo} size={64} />
        </div>
      ) : null}
      {p.site ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            border: `2px solid ${withAlpha(p.accent, 0.6)}`,
            backgroundColor: withAlpha(p.accent, 0.12),
            color: p.theme === "dark" ? "#e4e4e7" : "#3f3f46",
            fontSize: 26,
            marginBottom: 44,
          }}
        >
          {p.site}
        </div>
      ) : null}
      <div
        style={{
          fontSize: titleFontSize(p.title),
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          maxWidth: 1000,
        }}
      >
        {p.title}
      </div>
      {p.subtitle ? (
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: c.muted,
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          {p.subtitle}
        </div>
      ) : null}
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

/**
 * Built for ?url= cards: the page's own artwork on one side, its title and
 * description on the other. Falls back to a tinted panel when the page has
 * no usable image, so the layout never collapses.
 */
function LinkTemplate({ p, watermark, logo, hero }: TplProps) {
  const c = palette(p.theme);
  // og:images are overwhelmingly 1.91:1, so the artwork spans the top
  // rather than sitting in a side panel: cropping a wide image into a
  // portrait column throws most of it away, as any repository card shows.
  const HERO_HEIGHT = 270;
  const COLUMN = 1200 - 144;
  // Scraped metadata is whatever the page happens to say, and satori does
  // not clip overflow — an over-long description would draw straight over
  // the line beneath it. So the remaining height is budgeted explicitly.
  const titleSize = fittedFontSize(
    { fontSize: 52, w: COLUMN, lineHeight: 1.15, autoFit: true },
    p.title,
    2
  );
  const subtitle = p.subtitle ?? "";
  const descSize = fittedFontSize(
    { fontSize: 26, w: COLUMN, lineHeight: 1.4, autoFit: true },
    subtitle,
    2
  );
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: c.bg,
        color: c.fg,
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: HERO_HEIGHT,
          overflow: "hidden",
          backgroundColor: withAlpha(p.accent, 0.18),
          // Spread rather than set-to-undefined: satori reads the property
          // if it is present at all, and trips over an undefined value.
          ...(hero
            ? {}
            : {
                backgroundImage: `linear-gradient(120deg, ${withAlpha(
                  p.accent,
                  0.75
                )} 0%, ${withAlpha(p.accent, 0.2)} 100%)`,
              }),
        }}
      >
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            width={1200}
            height={HERO_HEIGHT}
            alt=""
            style={{ objectFit: "cover" }}
          />
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
          padding: "0 72px",
          // Belt and braces: nothing escapes even if the budget above is
          // beaten by an unusual string.
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          {p.title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 18,
              fontSize: descSize,
              color: c.muted,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        {p.site ? (
          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              fontSize: 23,
              color: c.muted,
            }}
          >
            {logo ? (
              <Logo src={logo} size={30} />
            ) : (
              <div
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  backgroundColor: p.accent,
                  marginRight: 13,
                }}
              />
            )}
            {p.site}
          </div>
        ) : null}
      </div>
      {watermark ? <Watermark theme={p.theme} /> : null}
    </div>
  );
}

export async function renderOgImage(
  p: OgParams,
  opts: { watermark: boolean; logo?: string | null; hero?: string | null }
): Promise<ImageResponse> {
  const fonts = await loadFonts();
  const props = {
    p,
    watermark: opts.watermark,
    logo: opts.logo ?? null,
    hero: opts.hero ?? null,
  };
  let element: React.ReactElement;
  switch (p.template) {
    case "minimal":
      element = <MinimalTemplate {...props} />;
      break;
    case "split":
      element = <SplitTemplate {...props} />;
      break;
    case "terminal":
      element = <TerminalTemplate {...props} />;
      break;
    case "quote":
      element = <QuoteTemplate {...props} />;
      break;
    case "announce":
      element = <AnnounceTemplate {...props} />;
      break;
    case "link":
      element = <LinkTemplate {...props} />;
      break;
    default:
      element = <GradientTemplate {...props} />;
  }
  return new ImageResponse(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: "Inter", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Inter", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
}
