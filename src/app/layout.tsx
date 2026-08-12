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

/**
 * Applies the saved theme before the first paint. It has to run inline and
 * synchronously in <head> — anything deferred to React would let a dark page
 * flash before repainting light, which is worse than not offering the choice.
 * Falls back to the OS preference when nothing has been chosen yet.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('ensemble-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script sets data-theme on this
    // element before React hydrates, so server and client markup differ here
    // by design.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
