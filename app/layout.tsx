import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Figtree } from "next/font/google";
import "./globals.css";

// Fonts are downloaded at build time and served from your own site.
const display = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display", adjustFontFallback: false });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Movie Queue",
  description: "Your next ten movies, in order.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#202023",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
