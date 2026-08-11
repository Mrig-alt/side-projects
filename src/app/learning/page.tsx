import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import { currentlyLearning, skillGroups } from "@/lib/data";

export const metadata: Metadata = {
  title: "Learning — Mrigank Shekhar",
};

export default function LearningPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <SectionHeading index="—" title="Currently Learning" />
        <ul className="max-w-2xl divide-y divide-line border-t border-line">
          {currentlyLearning.map((item) => (
            <li key={item} className="py-6 text-xl leading-snug text-foreground/80 sm:text-2xl">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-10 sm:pb-32">
        <SectionHeading index="—" title="Toolkit" />
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {skillGroups.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm uppercase tracking-[0.2em] text-muted">
                {group.category}
              </h3>
              <ul className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="text-lg leading-snug text-foreground/80">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
