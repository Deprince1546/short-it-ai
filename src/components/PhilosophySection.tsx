import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const serif = { fontFamily: "'Instrument Serif', serif" };

export default function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-black py-28 md:py-40 px-6 overflow-hidden">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl text-white tracking-tight mb-16 md:mb-24"
          style={serif}
        >
          Innovation <em className="italic text-white/40">x</em> Vision
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="rounded-3xl overflow-hidden aspect-[4/3]"
          >
            <video
              className="w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="flex flex-col justify-center gap-8"
          >
            <div>
              <p className="text-white/40 text-xs tracking-widest uppercase mb-4">
                Choose your platform
              </p>
              <p className="text-white/70 text-base md:text-lg leading-relaxed">
                We combine advanced AI with creative storytelling to help anyone
                produce engaging short-form videos without expensive software or
                editing skills. Simply describe your idea, choose a platform,
                and let Short It do the rest.
              </p>
            </div>
            <div className="w-full h-px bg-white/10" />
            <div>
              <p className="text-white/40 text-xs tracking-widest uppercase mb-4">
                How it works
              </p>
              <ol className="text-white/70 text-base md:text-lg leading-relaxed space-y-1">
                <li>1. Enter an idea — or upload a script.</li>
                <li>2. Select your target platform.</li>
                <li>3. Click Generate Video.</li>
                <li>4. Preview, then download or regenerate.</li>
              </ol>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-8 liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium"
              >
                Start Creating
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
