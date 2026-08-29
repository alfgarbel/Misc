import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/stripe";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const DESCRIPTION =
  "Generate beautiful social card images (Open Graph / Twitter cards) from a single URL. No headless browser, no design tool — just an API call.";

export const metadata: Metadata = {
  // Required for the og:image from opengraph-image.tsx to be absolute.
  // Crawlers won't resolve a relative one.
  metadataBase: new URL(appUrl()),
  title: {
    default: "OGsmith — Open Graph images as an API",
    template: "%s · OGsmith",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "OGsmith",
    title: "OGsmith — Open Graph images as an API",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    // Without this X shows the small square thumbnail instead of the wide
    // image — the exact finding our own checker reports on other people.
    card: "summary_large_image",
    title: "OGsmith — Open Graph images as an API",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
