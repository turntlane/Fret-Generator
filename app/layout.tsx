import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fretboard CNC G-Code Builder",
  description: "Generate fretboard radius, fret slot, cutout, and marker G-code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
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
