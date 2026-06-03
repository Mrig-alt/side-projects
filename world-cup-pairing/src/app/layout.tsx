import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { SessionProvider } from "next-auth/react";
import Script from "next/script";

const geist = Geist({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IE World Cup 2026",
  description: "Track your class pairings for World Cup 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WC 2026",
  },
  openGraph: {
    title: "IE World Cup 2026",
    description: "See who you're facing in each match",
    type: "website",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* iOS splash / PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WC 2026" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={geist.className}>
        <SessionProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">{children}</main>
          <MobileNav />
        </SessionProvider>
        {/* Register service worker */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered:', reg.scope); })
                  .catch(function(err) { console.log('SW failed:', err); });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
