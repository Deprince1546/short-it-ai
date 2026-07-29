import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Globe, Instagram, Twitter } from "lucide-react";
import AboutSection from "@/components/AboutSection";
import FeaturedVideoSection from "@/components/FeaturedVideoSection";
import PhilosophySection from "@/components/PhilosophySection";
import ServicesSection from "@/components/ServicesSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Asme — Know it then all" },
      {
        name: "description",
        content:
          "Asme is a strategy and design studio turning curiosity into research, insight, and standout digital experiences.",
      },
      { property: "og:title", content: "Asme — Know it then all" },
      {
        property: "og:description",
        content:
          "Strategy, research and design for minds that create, build, and inspire.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const serif = { fontFamily: "'Instrument Serif', serif" };

function useHeroVideoFade() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const animate = (from: number, to: number, duration = 500) => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        video.style.opacity = String(from + (to - from) * t);
        if (t < 1) frameRef.current = requestAnimationFrame(step);
      };
      frameRef.current = requestAnimationFrame(step);
    };

    const onCanPlay = () => {
      void video.play().catch(() => {});
      animate(0, 1);
    };

    const onTimeUpdate = () => {
      if (!video.duration) return;
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && !fadingOutRef.current) {
        fadingOutRef.current = true;
        animate(Number(video.style.opacity || 1), 0);
      }
    };

    const onEnded = () => {
      video.style.opacity = "0";
      window.setTimeout(() => {
        video.currentTime = 0;
        void video.play().catch(() => {});
        fadingOutRef.current = false;
        animate(0, 1);
      }, 100);
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return videoRef;
}

function Index() {
  const videoRef = useHeroVideoFade();

  return (
    <main className="bg-black">
      <section className="relative min-h-screen overflow-hidden flex flex-col">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          style={{ opacity: 0 }}
          muted
          autoPlay
          playsInline
          preload="auto"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
        />

        <header className="relative z-20 px-6 py-6">
          <nav className="liquid-glass rounded-full max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <Globe size={24} className="text-white" />
              <span className="ml-2 text-white font-semibold text-lg">Asme</span>
              <div className="hidden md:flex items-center gap-8 ml-8">
                {["Features", "Pricing", "About"].map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="text-white/80 hover:text-white text-sm font-medium"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-white text-sm font-medium">Sign Up</button>
              <button className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium">
                Login
              </button>
            </div>
          </nav>
        </header>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
          <h1
            className="text-7xl md:text-8xl lg:text-9xl text-white tracking-tight whitespace-nowrap"
            style={serif}
          >
            Know it <em className="italic">all</em>.
          </h1>

          <div className="mt-10 max-w-xl w-full">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3"
            >
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="bg-white rounded-full p-3 text-black"
              >
                <ArrowRight size={20} />
              </button>
            </form>

            <p className="mt-6 text-white text-sm leading-relaxed px-4">
              Stay updated with the latest news and insights. Subscribe to our
              newsletter today and never miss out on exciting updates.
            </p>
          </div>

          <button className="mt-8 liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors">
            Manifesto
          </button>
        </div>

        <div className="relative z-10 flex justify-center gap-4 pb-12">
          {[Instagram, Twitter, Globe].map((Icon, i) => (
            <button
              key={i}
              className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </section>

      <AboutSection />
      <FeaturedVideoSection />
      <PhilosophySection />
      <ServicesSection />
    </main>
  );
}
