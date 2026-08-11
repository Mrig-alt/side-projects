import { projects } from "@/lib/data";

export default function ProjectList() {
  return (
    <div className="divide-y divide-line border-t border-line">
      {projects.map((project) => (
        <article key={project.slug} className="group py-10 sm:py-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <h3 className="text-2xl font-bold tracking-tight transition group-hover:text-foreground/70 sm:text-4xl">
              {project.title}
            </h3>
            <span className="font-mono text-sm text-muted">{project.year}</span>
          </div>
          <p className="mt-2 text-sm uppercase tracking-widest text-muted">
            {project.subtitle}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            {project.description}
          </p>
          {project.highlights && (
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground/60">
              {project.highlights.map((h) => (
                <li key={h} className="before:mr-2 before:content-['→']">
                  {h}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-wide text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
