import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import { certifications } from "@/lib/data";

export const metadata: Metadata = {
  title: "Certifications — Mrigank Shekhar",
};

export default function CertificationsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
      <SectionHeading index="—" title="Certifications" />

      {certifications.length === 0 ? (
        <div className="max-w-2xl border-t border-line pt-10">
          <p className="text-lg text-foreground/70">
            Nothing published here yet — this page is wired up and ready. Certifications will
            appear here as they&apos;re added.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {certifications.map((cert) => (
            <div
              key={cert.title}
              className="flex flex-col gap-2 py-8 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <div>
                <h3 className="text-xl font-semibold">
                  {cert.url ? (
                    <a href={cert.url} className="underline underline-offset-4">
                      {cert.title}
                    </a>
                  ) : (
                    cert.title
                  )}
                </h3>
                <p className="mt-1 text-sm uppercase tracking-widest text-muted">
                  {cert.issuer}
                </p>
              </div>
              <span className="font-mono text-sm text-muted">{cert.date}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
