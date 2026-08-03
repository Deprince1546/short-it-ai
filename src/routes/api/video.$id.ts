import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams a generation's final render back to its owner as a downloadable MP4.
 * The stored media URL is short-lived and private, so the browser never sees it.
 */
export const Route = createFileRoute("/api/video/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        const userId = auth?.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { data: generation } = await supabaseAdmin
          .from("generations")
          .select("id, user_id, title, prompt, video_path, video_url")
          .eq("id", params.id)
          .maybeSingle();

        if (!generation || generation.user_id !== userId) {
          return new Response("Not found", { status: 404 });
        }
        if (!generation.video_path && !generation.video_url) {
          return new Response("This generation has no video yet.", { status: 409 });
        }

        const sourceUrl = generation.video_path
          ? (
              await supabaseAdmin.storage
                .from("generated-media")
                .createSignedUrl(generation.video_path, 60)
            ).data?.signedUrl
          : generation.video_url;
        if (!sourceUrl) return new Response("Video is no longer available.", { status: 502 });

        const upstream = await fetch(sourceUrl);
        if (!upstream.ok || !upstream.body) {
          return new Response("Video is no longer available.", { status: 502 });
        }

        const title = generation.title ?? generation.prompt ?? "short-it";
        const safeTitle =
          title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "short-it";

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
