import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fret Slot CNC G-Code Builder",
  description: "Generate radiused fret slot G-code for CNC fretboards.",
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
