import { createFileRoute } from "@tanstack/react-router";
import { zipSync, strToU8 } from "fflate";

async function download(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/export/$id")({
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
          .select(
            "id, user_id, title, prompt, caption, hashtags, script_text, storyboard, video_url, audio_url",
          )
          .eq("id", params.id)
          .maybeSingle();

        if (!generation || generation.user_id !== userId) {
          return new Response("Not found", { status: 404 });
        }

        const files: Record<string, Uint8Array> = {};

        // Media stored in the private bucket for this generation.
        const prefix = `${userId}/${generation.id}`;
        const { data: objects } = await supabaseAdmin.storage
          .from("generated-media")
          .list(prefix, { limit: 100 });

        for (const object of objects ?? []) {
          const { data: blob } = await supabaseAdmin.storage
            .from("generated-media")
            .download(`${prefix}/${object.name}`);
          if (!blob) continue;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const folder = object.name.endsWith(".mp3") ? "audio" : "images";
          files[`${folder}/${object.name}`] = bytes;
        }

        if (generation.video_url) {
          const bytes = await download(generation.video_url);
          if (bytes) files["video/final.mp4"] = bytes;
        }
        if (generation.audio_url && !Object.keys(files).some((name) => name.startsWith("audio/"))) {
          const bytes = await download(generation.audio_url);
          if (bytes) files["audio/narration.mp3"] = bytes;
        }

        const title = generation.title ?? generation.prompt ?? "Short It export";
        const hashtags = (generation.hashtags ?? []).join(" ");
        files["captions.txt"] = strToU8(
          [`Title: ${title}`, "", `Caption:`, generation.caption ?? "", "", "Script:", generation.script_text ?? ""].join(
            "\n",
          ),
        );
        files["hashtags.txt"] = strToU8(hashtags);
        files["storyboard.json"] = strToU8(JSON.stringify(generation.storyboard ?? {}, null, 2));

        const zipped = zipSync(files, { level: 6 });
        const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "short-it";

        return new Response(zipped as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
