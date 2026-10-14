import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { appUrl } from "@/lib/stripe";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
// Headings only; body copy stays in Inter for legibility at small sizes.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-face",
});

const DESCRIPTION =
  "Generate social card images (Open Graph and Twitter cards) from a single URL with one API call. You don't need a headless browser or a design tool.";

export const metadata: Metadata = {
  // Required for the og:image from opengraph-image.tsx to be absolute.
  // Crawlers won't resolve a relative one.
  metadataBase: new URL(appUrl()),
  title: {
    default: "OGsmith: Open Graph images as an API",
    template: "%s · OGsmith",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "OGsmith",
    title: "OGsmith: Open Graph images as an API",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    // Without this X shows the small square thumbnail instead of the wide
    // image — the exact finding our own checker reports on other people.
    card: "summary_large_image",
    title: "OGsmith: Open Graph images as an API",
    description: DESCRIPTION,
  },
};

const GA_MEASUREMENT_ID = "G-7BTTPZ7849";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        {/* Google tag (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
