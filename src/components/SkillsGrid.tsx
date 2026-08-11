import { skillGroups } from "@/lib/data";

export default function SkillsGrid() {
  return (
    <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
      {skillGroups.map((group) => (
        <div key={group.category}>
          <h3 className="text-sm uppercase tracking-[0.2em] text-muted">{group.category}</h3>
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
  );
}
