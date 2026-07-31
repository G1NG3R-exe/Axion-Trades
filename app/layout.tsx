import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Signal Forge - Persistent Trading Research Lab";
  const description =
    "A persistent AAPL intraday research lab with a regime-aware ORB, VWAP, EMA, Bollinger, momentum, volume, and key-level strategy ensemble.";

  return {
    title,
    description,
    metadataBase: new URL(origin),
    icons: {
      icon: [
        { url: "/favicon.png", type: "image/png", sizes: "64x64" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      shortcut: "/favicon.png",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og-liquid.png`, alt: "Signal Forge liquid-glass market research artwork" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-liquid.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className="antialiased">{children}</body>
    </html>
  );
}
