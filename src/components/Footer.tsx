import { profile } from "@/lib/data";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">Get in touch</p>
        <a
          href={`mailto:${profile.email}`}
          className="mt-6 block break-words text-[12vw] font-bold leading-[0.95] tracking-tight transition hover:text-foreground/70 sm:text-[6.5rem]"
        >
          Let&apos;s talk.
        </a>
        <div className="mt-12 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <a href={`mailto:${profile.email}`} className="hover:text-foreground">
            {profile.email}
          </a>
          <span>{profile.location}</span>
          <span>&copy; {year} {profile.name}</span>
        </div>
      </div>
    </footer>
  );
}
