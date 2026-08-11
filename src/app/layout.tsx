import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ensemble — Landing pages & dashboards for creators",
  description:
    "Spin up a landing page for your bonus content, merch and community — or plug your existing website into one powerful creator dashboard.",
  // Declared here rather than as src/app/favicon.ico: the file-based icon is
  // injected into every route unconditionally, so a creator page ended up
  // serving both their tab icon and ours, and browsers picked whichever they
  // liked. As metadata, a creator page's own `icons` replaces it outright.
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
