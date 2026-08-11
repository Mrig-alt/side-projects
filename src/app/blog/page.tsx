import type { Metadata } from "next";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { blogPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Blog — Mrigank Shekhar",
};

export default function BlogIndexPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
      <SectionHeading index="—" title="Blog" />
      <div className="divide-y divide-line border-t border-line">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-3 py-8 transition hover:text-foreground/70 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
          >
            <div>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{post.title}</h3>
              <p className="mt-2 max-w-2xl text-base text-foreground/60">{post.premise}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wide text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <span className="font-mono text-sm text-muted">
              {post.status === "draft" ? "Draft" : post.date}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
