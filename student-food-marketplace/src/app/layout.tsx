import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export const metadata: Metadata = {
  title: "Campus Bites — IE Business School",
  description: "Home-cooked food by IE students, served at the cafeteria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          <Header />
          <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">{children}</main>
          <MobileNav />
        </SessionProvider>
      </body>
    </html>
  );
}
