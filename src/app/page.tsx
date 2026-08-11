import Link from "next/link";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import ProjectList from "@/components/ProjectList";
import SkillsGrid from "@/components/SkillsGrid";
import { profile, blogPosts } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Hero />

      <section id="about" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <SectionHeading index="01" title="About" />
        <div className="max-w-3xl space-y-6">
          {profile.about.map((paragraph, i) => (
            <p key={i} className="text-lg leading-relaxed text-foreground/80 sm:text-xl">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section id="work" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <SectionHeading index="02" title="Projects" />
        <ProjectList />
      </section>

      <section id="skills" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <SectionHeading index="03" title="Skills" />
        <SkillsGrid />
      </section>

      <section id="writing" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <SectionHeading index="04" title="Writing" />
        <div className="divide-y divide-line border-t border-line">
          {blogPosts.slice(0, 4).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col gap-2 py-6 transition hover:text-foreground/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-xl font-semibold tracking-tight sm:text-2xl">
                {post.title}
              </span>
              <span className="font-mono text-sm text-muted">{post.date}</span>
            </Link>
          ))}
        </div>
        <Link
          href="/blog"
          className="mt-10 inline-block text-sm uppercase tracking-[0.2em] underline underline-offset-4"
        >
          All writing →
        </Link>
      </section>
    </>
  );
}
