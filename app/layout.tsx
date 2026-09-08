import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import {
  authorEmail,
  authorName,
  siteDescription,
  siteKeywords,
  siteName,
  siteTitle,
  siteUrl,
  sourceRepositoryUrl,
} from "./site";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: siteKeywords,
  authors: [{ name: authorName, url: sourceRepositoryUrl }],
  creator: authorName,
  publisher: authorName,
  category: "technology",
  classification: "CNC G-code generator for guitar fretboards",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f2ead7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

/* Structured data so search engines understand this is a free web tool. */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${siteUrl.origin}/#app`,
      name: siteName,
      alternateName: [
        "Fretboard CNC G-Code Builder",
        "Fret Slot G-Code Generator",
        "Fretboard CNC Generator",
      ],
      url: siteUrl.origin,
      description: siteDescription,
      applicationCategory: ["DesignApplication", "UtilitiesApplication"],
      applicationSubCategory: "CNC G-code generator",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Fret slot G-code with accurate fret spacing for any scale length and fret count",
        "Fretboard top radius surfacing toolpaths",
        "Fretboard outline cutout with tabs",
        "Fret marker and inlay pocket G-code",
        "Fret position schedule with cutter-center coordinates",
        "Millimeter and inch units",
        "Exports .nc, .gcode, .tap, .cnc and .ngc files",
        "Compatible with GRBL, Mach3, LinuxCNC and other G-code controllers",
        "Plan view and cross-section preview of the toolpaths",
        "Save and reload named fretboard profiles",
      ],
      keywords: siteKeywords.join(", "),
      author: { "@id": `${siteUrl.origin}/#author` },
      image: `${siteUrl.origin}/opengraph-image`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl.origin}/#website`,
      url: siteUrl.origin,
      name: siteName,
      description: siteDescription,
      inLanguage: "en-US",
      publisher: { "@id": `${siteUrl.origin}/#author` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl.origin}/#author`,
      name: authorName,
      email: authorEmail,
      url: sourceRepositoryUrl,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <Script
          type="module"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({
            token: "60b601875041475f9fc3d1506a0f7055",
          })}
        />
      </body>
    </html>
  );
}
