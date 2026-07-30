import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/short-it-logo.png.asset.json";

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("id, prompt, platform, status, current_step, progress, video_url, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="min-h-screen bg-black px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <header className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="Short It logo" className="h-7 w-7 rounded-full" />
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
          className="mt-12 text-5xl text-white tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Your studio
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          Every generation runs on the server and is tracked here from prompt to published post.
        </p>

        <div className="mt-8 space-y-3">
          {generations?.length === 0 && (
            <div className="liquid-glass rounded-2xl p-6 text-white/50 text-sm">
              No generations yet. Start one from the home page.
            </div>
          )}
          {generations?.map((generation) => (
            <div key={generation.id} className="liquid-glass rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-white text-sm truncate">{generation.prompt ?? "Script upload"}</p>
                <span className="text-white/40 text-xs uppercase tracking-widest">
                  {generation.status}
                </span>
              </div>
              <p className="mt-1 text-white/40 text-xs">
                {generation.platform ?? "Any platform"} ·{" "}
                {generation.current_step ?? "waiting"} · {generation.progress}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
