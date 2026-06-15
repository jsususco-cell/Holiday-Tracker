import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Byrdson — Flexi Holiday",
  description: "Apply holidays and holiday credit, synced to Zoho People.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
