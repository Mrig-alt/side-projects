import Link from "next/link";
import type { ReactNode } from "react";

export default function PostLayout({
  title,
  date,
  tags,
  children,
}: {
  title: string;
  date: string;
  tags: string[];
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 sm:px-10 sm:py-32">
      <Link
        href="/blog"
        className="text-sm uppercase tracking-[0.2em] text-muted underline underline-offset-4"
      >
        ← All writing
      </Link>

      <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-6xl">{title}</h1>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted">
        <span className="font-mono">{date}</span>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wide"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-12">{children}</div>
    </article>
  );
}
