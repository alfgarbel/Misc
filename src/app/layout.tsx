import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "OGsmith — Open Graph images as an API",
    template: "%s · OGsmith",
  },
  description:
    "Generate beautiful social card images (Open Graph / Twitter cards) from a single URL. No headless browser, no design tool — just an API call.",
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
