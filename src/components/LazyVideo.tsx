import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  className?: string;
};

/**
 * Defers downloading a video until it is close to the viewport, so the hero
 * video gets the full bandwidth on first paint.
 */
export default function LazyVideo({ src, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (active) void ref.current?.play().catch(() => {});
  }, [active]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      preload={active ? "auto" : "none"}
      src={active ? src : undefined}
    />
  );
}
