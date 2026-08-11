"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/#work", label: "Work" },
  { href: "/#about", label: "About" },
  { href: "/learning", label: "Learning" },
  { href: "/certifications", label: "Certifications" },
  { href: "/blog", label: "Blog" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.2em] uppercase"
          onClick={() => setOpen(false)}
        >
          Mrigank Shekhar
        </Link>

        <nav className="hidden gap-8 text-sm text-foreground/70 sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="text-sm uppercase tracking-widest sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-6 pb-6 text-base sm:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="py-3 text-foreground/80 transition hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
