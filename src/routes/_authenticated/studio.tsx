import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/short-it-logo.png";
import {
  createGeneration,
  getGenerationEvents,
  processGeneration,
} from "@/lib/generation.functions";

const PLATFORMS = [
  "TikTok Shorts",
  "YouTube Shorts",
  "Instagram Reels",
  "Facebook Reels",
  "X Video",
  "LinkedIn Video",
];

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Short It" },
      {
        name: "description",
        content: "Your Short It studio: generate AI short-form videos and track every render.",
      },
      { property: "og:title", content: "Studio — Short It" },
      { property: "og:description", content: "Generate and manage AI short-form videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

function Studio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [scriptName, setScriptName] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadVideo = async (id: string) => {
    setDownloading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — sign in again.");
      const response = await fetch(`/api/video/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "short-it.mp4";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };



  const create = useServerFn(createGeneration);
  const process = useServerFn(processGeneration);
  const fetchEvents = useServerFn(getGenerationEvents);

  // Pick up the idea typed on the landing page.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("shortit:draft");
      if (!raw) return;
      const draft = JSON.parse(raw) as { prompt?: string; platform?: string };
      if (draft.prompt) setPrompt(draft.prompt);
      if (draft.platform) setPlatform(draft.platform);
      sessionStorage.removeItem("shortit:draft");
    } catch {
      /* ignore */
    }
  }, []);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

  const { data: generations } = useQuery({
    queryKey: ["generations"],
    refetchInterval: activeId ? 4000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select(
          "id, prompt, platform, status, current_step, progress, video_url, thumbnail_url, audio_url, title, caption, hashtags, error, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["generation-events", activeId],
    enabled: Boolean(activeId),
    refetchInterval: 4000,
    queryFn: () => fetchEvents({ data: { id: activeId! } }),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { id } = await create({ data: { prompt, platform, scriptText } });
      setActiveId(id);
      await queryClient.invalidateQueries({ queryKey: ["generations"] });
      await process({ data: { id } });
      return id;
    },
    onSuccess: () => {
      toast.success("Your video is ready.");
      void queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Generation failed.");
      void queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });

  const onScript = async (file: File | undefined) => {
    if (!file) return;
    setScriptName(file.name);
    if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
      setScriptText((await file.text()).slice(0, 20000));
    } else {
      toast.message("Only .txt scripts are read automatically for now — paste the text below.");
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const active = generations?.find((g) => g.id === activeId);

  return (
    <main className="min-h-screen bg-black px-4 md:px-6 py-8 md:py-10">
      <div className="max-w-4xl mx-auto">
        <header className="liquid-glass rounded-full px-5 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoUrl} alt="Short It logo" className="h-7 w-7 rounded-full object-cover" />
            <span className="text-white font-semibold">Short It</span>
          </Link>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                to="/settings/api"
                className="text-white/70 hover:text-white text-sm font-medium"
              >
                API Configuration
              </Link>
            )}
            <button onClick={signOut} className="text-white/70 hover:text-white text-sm">
              Sign out
            </button>
          </div>
        </header>

        <h1
          className="mt-10 text-4xl md:text-5xl text-white tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Your studio
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          Describe an idea and Short It writes the script, generates the visuals, narrates it and
          renders the video — every step audited on the server.
        </p>

        <section className="mt-8 liquid-glass rounded-3xl p-5 md:p-7">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="What do you imagine? e.g. A 30-second story about a sneaker brand born in Lagos."
            className="w-full bg-transparent outline-none text-white placeholder:text-white/40 text-sm resize-none"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="liquid-glass rounded-full pl-4 pr-3 py-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                aria-label="Select Platform"
                className="appearance-none bg-transparent outline-none text-white text-sm [&>option]:bg-black"
              >
                <option value="">Select Platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="liquid-glass rounded-full px-5 py-2 text-white text-sm"
            >
              {scriptName ?? "Upload Script (.txt)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx"
              className="hidden"
              onChange={(e) => void onScript(e.target.files?.[0])}
            />
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="ml-auto rounded-full bg-white px-6 py-2 text-black text-sm font-medium disabled:opacity-50"
            >
              {generate.isPending ? "Generating…" : "Generate Video"}
            </button>
          </div>
          {generate.isPending && (
            <p className="mt-3 text-white/50 text-xs">
              This can take a few minutes — keep this tab open.
            </p>
          )}
        </section>

        {active && (
          <section className="mt-6 liquid-glass rounded-3xl p-5 md:p-7">
            <div className="flex items-center justify-between gap-4">
              <p className="text-white text-sm">{active.title ?? active.prompt}</p>
              <span className="text-white/40 text-xs uppercase tracking-widest">
                {active.current_step ?? active.status}
              </span>
            </div>
            <div className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${active.progress}%` }}
              />
            </div>
            {active.video_url && (
              <video
                src={active.video_url}
                poster={active.thumbnail_url ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="mt-5 w-full rounded-2xl bg-black"
              />
            )}
            {!active.video_url && active.thumbnail_url && (
              <img
                src={active.thumbnail_url}
                alt={active.title ?? "Generated scene"}
                className="mt-5 w-full rounded-2xl"
              />
            )}
            {active.audio_url && <audio src={active.audio_url} controls className="mt-4 w-full" />}
            {active.caption && <p className="mt-4 text-white/70 text-sm">{active.caption}</p>}
            {active.hashtags?.length ? (
              <p className="mt-2 text-white/40 text-xs">{active.hashtags.join(" ")}</p>
            ) : null}
            {active.error && <p className="mt-3 text-red-400 text-xs">{active.error}</p>}

            {active.video_url ? (
              <button
                onClick={() => void downloadVideo(active.id)}
                disabled={downloading}
                className="mt-5 rounded-full bg-white px-6 py-3 text-black text-sm font-medium disabled:opacity-50"
              >
                {downloading ? "Preparing…" : "Download MP4"}
              </button>
            ) : (
              <p className="mt-5 text-white/40 text-xs">
                The MP4 download appears here once the render finishes.
              </p>
            )}


            {events?.length ? (
              <div className="mt-5 border-t border-white/10 pt-4 space-y-1">
                {events.map((event) => (
                  <p key={event.id} className="text-white/40 text-xs font-mono">
                    {event.step} · {event.level}
                    {event.duration_ms ? ` · ${event.duration_ms}ms` : ""}
                  </p>
                ))}
              </div>
            ) : null}

          </section>
        )}

        <div className="mt-8 space-y-3">
          {generations?.length === 0 && (
            <div className="liquid-glass rounded-2xl p-6 text-white/50 text-sm">
              No generations yet. Describe your first idea above.
            </div>
          )}
          {generations?.map((generation) => (
            <button
              key={generation.id}
              onClick={() => setActiveId(generation.id)}
              className="w-full text-left liquid-glass rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-white text-sm truncate">
                  {generation.title ?? generation.prompt ?? "Script upload"}
                </p>
                <span className="text-white/40 text-xs uppercase tracking-widest">
                  {generation.status}
                </span>
              </div>
              <p className="mt-1 text-white/40 text-xs">
                {generation.platform ?? "Any platform"} · {generation.current_step ?? "waiting"} ·{" "}
                {generation.progress}%
              </p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
