import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', serif" };

const cards = [
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
    tag: "AI Video Generation",
    title: "Prompt to Video",
    description:
      "Describe your idea in one sentence and watch Short It transform it into a complete short-form video.",
  },
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4",
    tag: "Scripts",
    title: "Script to Video",
    description:
      "Upload your script and our AI automatically creates scenes, voiceovers, captions, transitions, and visuals.",
  },
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4",
    tag: "Distribution",
    title: "Platform Optimization",
    description:
      "Every video is formatted and optimized for TikTok Shorts, YouTube Shorts, Instagram Reels, Facebook Reels, and more.",
  },
];

export default function ServicesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="relative bg-black py-28 md:py-40 px-6 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02)_0%,_transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="flex items-end justify-between mb-12 md:mb-16"
        >
          <h2
            className="text-3xl md:text-5xl text-white tracking-tight"
            style={serif}
          >
            What we do
          </h2>
          <span className="hidden md:block text-white/40 text-sm">
            AI Video Generation
          </span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              className="group liquid-glass rounded-3xl overflow-hidden"
            >
              <div className="relative aspect-video overflow-hidden">
                <video
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  src={card.video}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="uppercase tracking-widest text-white/40 text-xs">
                    {card.tag}
                  </span>
                  <span className="liquid-glass rounded-full p-2 text-white">
                    <ArrowUpRight size={16} />
                  </span>
                </div>
                <h3
                  className="text-white text-xl md:text-2xl mb-3 tracking-tight"
                  style={serif}
                >
                  {card.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
