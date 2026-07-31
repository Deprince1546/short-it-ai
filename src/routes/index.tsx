import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Upload } from "lucide-react";
import AboutSection from "@/components/AboutSection";
import FeaturedVideoSection from "@/components/FeaturedVideoSection";
import PhilosophySection from "@/components/PhilosophySection";
import ServicesSection from "@/components/ServicesSection";
import logoUrl from "@/assets/short-it-logo.png";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Short It — AI Short-Form Video Generator" },
      {
        name: "description",
        content:
          "Short It turns your idea or script into engaging short-form videos for TikTok, YouTube Shorts, Instagram Reels and more — in minutes.",
      },
      { property: "og:title", content: "Short It — AI Short-Form Video Generator" },
      {
        property: "og:description",
        content:
          "Describe your idea or upload a script and let AI create ready-to-publish short-form videos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://d8j0ntlcm91z4.cloudfront.net", crossOrigin: "anonymous" },
      { rel: "preload", as: "video", href: HERO_VIDEO, fetchpriority: "high" },
    ],
  }),
  component: Index,
});

const serif = { fontFamily: "'Instrument Serif', serif" };

const PLATFORMS = [
  "TikTok Shorts",
  "YouTube Shorts",
  "Instagram Reels",
  "Facebook Reels",
  "X Video",
  "LinkedIn Video",
];

const NAV = [
  { label: "Features", href: "#services" },
  { label: "How it Works", href: "#approach" },
  { label: "About", href: "#about" },
];



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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("");
  const [scriptName, setScriptName] = useState<string | null>(null);

  const handleGenerate = (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      sessionStorage.setItem(
        "shortit:draft",
        JSON.stringify({ prompt, platform, scriptName }),
      );
    } catch {
      /* storage unavailable */
    }
    navigate({ to: "/studio" });
  };

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
          src={HERO_VIDEO}
        />

        <header className="relative z-20 px-4 md:px-6 py-6">
          <nav className="liquid-glass rounded-full max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              <img
                src={logoUrl}
                alt="Short It logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover shrink-0"
              />
              <div className="ml-2 flex flex-col leading-tight min-w-0">
                <span className="text-white font-semibold text-base md:text-lg">Short It</span>
                <span className="hidden lg:block text-white/40 text-[10px] truncate">
                  Turn ideas into viral short-form videos with AI.
                </span>
              </div>
              <div className="hidden lg:flex items-center gap-6 ml-8">
                {NAV.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-white/80 hover:text-white text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/auth"
                search={{ redirect: "/studio" }}
                className="text-white text-sm font-medium whitespace-nowrap"
              >
                Sign Up
              </Link>
              <Link
                to="/auth"
                search={{ redirect: "/studio" }}
                className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium"
              >
                Login
              </Link>
            </div>
          </nav>
        </header>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center md:-translate-y-[8%]">
          <h1
            className="text-white tracking-tight whitespace-nowrap leading-[0.95] text-[clamp(3.5rem,13vw,8rem)]"
            style={serif}
          >
            Short <em className="italic">It</em>.
          </h1>

          <div className="mt-8 md:mt-10 max-w-xl w-full">
            <form
              onSubmit={handleGenerate}
              className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3"
            >
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What do you imagine?"
                className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
              />
              <button
                type="button"
                aria-label="Upload Script"
                title="Upload Script (PDF, DOCX, TXT)"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full p-3 text-white/70 hover:text-white transition-colors"
              >
                <Upload size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => setScriptName(e.target.files?.[0]?.name ?? null)}
              />
              <button
                type="submit"
                aria-label="Generate Video"
                className="bg-white rounded-full p-3 text-black shrink-0"
              >
                <ArrowRight size={20} />
              </button>
            </form>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="liquid-glass rounded-full pl-5 pr-3 py-2 flex items-center gap-2">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  aria-label="Select Platform"
                  className="appearance-none bg-transparent outline-none text-white text-sm pr-1 [&>option]:bg-black"
                >
                  <option value="">Select Platform</option>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="text-white/60" />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium flex items-center gap-2"
              >
                <Upload size={16} />
                {scriptName ?? "Upload Script"}
              </button>
            </div>

            <p className="mt-3 text-white/50 text-xs">
              Already have a script? Upload it (PDF, DOCX, TXT) and let AI turn it into a video.
            </p>

            <p className="mt-6 text-white text-sm leading-relaxed px-4">
              Bring your imagination to life. Describe your idea or upload a script, and Short It
              transforms it into engaging short-form videos optimized for TikTok, YouTube Shorts,
              Instagram Reels, and more—in just minutes.
            </p>
          </div>

          <button
            onClick={() => handleGenerate()}
            className="mt-8 liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Generate Video
          </button>
        </div>
      </section>

      <AboutSection />
      <FeaturedVideoSection />
      <PhilosophySection />
      <ServicesSection />
    </main>
  );
}
