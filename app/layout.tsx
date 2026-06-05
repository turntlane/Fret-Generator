import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
