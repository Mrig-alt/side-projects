export default function SectionHeading({
  index,
  title,
}: {
  index: string;
  title: string;
}) {
  return (
    <div className="mb-12 flex items-baseline gap-4 sm:mb-16">
      <span className="font-mono text-sm text-muted">{index}</span>
      <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
    </div>
  );
}
