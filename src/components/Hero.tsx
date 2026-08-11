"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { profile } from "@/lib/data";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[92vh] flex-col justify-between overflow-hidden px-6 pt-16 pb-10 sm:px-10"
    >
      <motion.div style={{ y, opacity }} className="flex flex-1 flex-col justify-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">{profile.role}</p>
        <h1 className="mt-6 text-[15vw] font-bold uppercase leading-[0.85] tracking-tight sm:text-[8.5rem]">
          {profile.name}
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-foreground/70 sm:text-xl">
          {profile.tagline}
        </p>
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted"
      >
        <span>{profile.location}</span>
        <span className="animate-bounce">Scroll ↓</span>
      </motion.div>
    </section>
  );
}
