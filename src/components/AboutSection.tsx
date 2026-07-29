import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const serif = { fontFamily: "'Instrument Serif', serif" };

export default function AboutSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="relative bg-black pt-32 md:pt-44 pb-10 md:pb-14 px-6 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.03)_0%,_transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-white/40 text-sm tracking-widest uppercase"
        >
          About Short It
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mt-6 text-4xl md:text-6xl lg:text-7xl text-white leading-[1.1] tracking-tight"
          style={serif}
        >
          AI-powered video creation for{" "}
          <em className="italic text-white/60">
            creators, businesses, and storytellers.
          </em>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-8 max-w-3xl text-white/60 text-base md:text-lg leading-relaxed"
        >
          Short It helps anyone turn simple ideas or existing scripts into
          professional short-form videos. Whether you're creating content for
          TikTok, YouTube Shorts, Instagram Reels, or other platforms, our AI
          handles the writing, visuals, voiceover, captions, and editing so you
          can focus on your creativity.
        </motion.p>
      </div>
    </section>
  );
}
