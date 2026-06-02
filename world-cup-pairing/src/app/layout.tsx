import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { SessionProvider } from "next-auth/react";

const geist = Geist({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IE World Cup 2026",
  description: "Track your class pairings for World Cup 2026",
  openGraph: {
    title: "IE World Cup 2026",
    description: "See who you're facing in each match",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <SessionProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">{children}</main>
          <MobileNav />
        </SessionProvider>
      </body>
    </html>
  );
}
