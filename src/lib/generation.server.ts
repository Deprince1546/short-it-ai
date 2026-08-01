// Server-only generation pipeline:
// OpenRouter (fallback Groq) -> Pollinations/Stability -> ElevenLabs -> Runway -> Coasty
// Every step writes an audit row to generation_events. API keys never leave this module.

import { coastyBase, envKey, fetchWithTimeout, withRetry } from "./providers.server";

export type Storyboard = {
  title: string;
  caption: string;
  hashtags: string[];
  scenes: { narration: string; visual: string }[];
};

type Level = "info" | "warn" | "error";

type Admin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Audit log. Stores step/provider/duration/message only — never request keys. */
export async function logEvent(
  generationId: string,
  userId: string,
  step: string,
  opts: { provider?: string; level?: Level; message?: string; durationMs?: number } = {},
) {
  try {
    const db = await admin();
    await db.from("generation_events").insert({
      generation_id: generationId,
      user_id: userId,
      step,
      provider: opts.provider ?? null,
      level: opts.level ?? "info",
      message: (opts.message ?? "").slice(0, 1000) || null,
      duration_ms: opts.durationMs ?? null,
    });
  } catch (error) {
    console.error("[generation] audit log failed", error);
  }
}

async function setProgress(
  generationId: string,
  patch: Record<string, unknown>,
) {
  const db = await admin();
  await db
    .from("generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", generationId);
}

/** Runs a provider call with retries + timing, and audits the outcome. */
async function step<T>(
  ctx: { id: string; userId: string },
  name: string,
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 700 });
    await logEvent(ctx.id, ctx.userId, name, {
      provider,
      message: "ok",
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    await logEvent(ctx.id, ctx.userId, name, {
      provider,
      level: "error",
      message: error instanceof Error ? error.message : "Unknown provider error",
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

function requireKey(name: string): string {
  const value = envKey(name);
  if (!value) throw new Error(`${name} is not configured. Add it in API Configuration.`);
  return value;
}


async function ok(response: Response, provider: string): Promise<Response> {
  if (response.ok) return response;
  const body = (await response.text().catch(() => "")).slice(0, 300);
  throw new Error(`${provider} responded ${response.status}. ${body}`.trim());
}

// ---------------------------------------------------------------- 1. Script

const SYSTEM_PROMPT = `You are Short It, an expert short-form video director.
Return ONLY compact JSON with this exact shape:
{"title":string,"caption":string,"hashtags":string[],"scenes":[{"narration":string,"visual":string}]}
Rules: 4-6 scenes, each narration max 22 words and spoken aloud naturally,
each visual a vivid cinematic image prompt (no text overlays), 5-8 hashtags without spaces.`;

function parseStoryboard(raw: string): Storyboard {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON.");
  const parsed = JSON.parse(match[0]) as Storyboard;
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Model returned no scenes.");
  }
  parsed.scenes = parsed.scenes.slice(0, 6);
  parsed.hashtags = (parsed.hashtags ?? []).slice(0, 8);
  return parsed;
}

async function chat(
  url: string,
  key: string,
  model: string,
  userPrompt: string,
): Promise<string> {
  const response = await ok(
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
        }),
      },
      45_000,
    ),
    url.includes("groq") ? "Groq" : "OpenRouter",
  );
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty model response.");
  return content;
}

export async function buildStoryboard(
  ctx: { id: string; userId: string },
  input: { prompt: string; platform: string | null; scriptText: string | null },
): Promise<Storyboard> {
  const userPrompt = [
    input.scriptText
      ? `Turn this script into a short-form video plan:\n${input.scriptText.slice(0, 6000)}`
      : `Idea: ${input.prompt}`,
    input.platform ? `Target platform: ${input.platform} (vertical 9:16).` : "Vertical 9:16.",
  ].join("\n");

  try {
    const key = requireKey("OPENROUTER_API_KEY");
    return parseStoryboard(
      await step(ctx, "script", "openrouter", () =>
        chat(
          "https://openrouter.ai/api/v1/chat/completions",
          key,
          "google/gemini-2.0-flash-001",
          userPrompt,
        ),
      ),
    );
  } catch {
    const key = requireKey("GROQ_API_KEY");
    return parseStoryboard(
      await step(ctx, "script-fallback", "groq", () =>
        chat(
          "https://api.groq.com/openai/v1/chat/completions",
          key,
          "llama-3.3-70b-versatile",
          userPrompt,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- 2. Images

async function pollinationsImage(prompt: string): Promise<ArrayBuffer> {
  const key = envKey("POLLINATIONS_API_KEY");
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=720&height=1280&nologo=true&model=flux`;
  const response = await ok(
    await fetchWithTimeout(
      url,
      { headers: key ? { Authorization: `Bearer ${key}` } : {} },
      60_000,
    ),
    "Pollinations",
  );
  return response.arrayBuffer();
}

async function stabilityImage(prompt: string): Promise<ArrayBuffer> {
  const key = requireKey("STABILITY_API_KEY");
  const form = new FormData();
  form.set("prompt", prompt);
  form.set("aspect_ratio", "9:16");
  form.set("output_format", "png");
  const response = await ok(
    await fetchWithTimeout(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
        body: form,
      },
      90_000,
    ),
    "Stability AI",
  );
  return response.arrayBuffer();
}

export async function generateSceneImages(
  ctx: { id: string; userId: string },
  storyboard: Storyboard,
): Promise<string[]> {
  const db = await admin();
  const urls: string[] = [];

  for (const [index, scene] of storyboard.scenes.entries()) {
    const prompt = `${scene.visual}. Cinematic, vertical 9:16, high detail, no text.`;
    let bytes: ArrayBuffer;
    try {
      bytes = await step(ctx, `image-${index + 1}`, "pollinations", () =>
        pollinationsImage(prompt),
      );
    } catch {
      bytes = await step(ctx, `image-${index + 1}-fallback`, "stability", () =>
        stabilityImage(prompt),
      );
    }

    const path = `${ctx.userId}/${ctx.id}/scene-${index + 1}.png`;
    const { error } = await db.storage
      .from("generated-media")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    urls.push(await signedUrl(path));
  }

  return urls;
}

export async function signedUrl(path: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  const db = await admin();
  const { data, error } = await db.storage
    .from("generated-media")
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`Could not sign media URL: ${error?.message}`);
  return data.signedUrl;
}

// ---------------------------------------------------------------- 3. Voice

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export async function generateVoiceover(
  ctx: { id: string; userId: string },
  storyboard: Storyboard,
): Promise<string | null> {
  const key = envKey("ELEVENLABS_API_KEY");
  if (!key) {
    await logEvent(ctx.id, ctx.userId, "voiceover", {
      provider: "elevenlabs",
      level: "warn",
      message: "ELEVENLABS_API_KEY missing — skipped narration.",
    });
    return null;
  }

  const text = storyboard.scenes.map((scene) => scene.narration).join(" ");
  try {
    const bytes = await step(ctx, "voiceover", "elevenlabs", async () => {
      const response = await ok(
        await fetchWithTimeout(
          `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE}`,
          {
            method: "POST",
            headers: { "xi-api-key": key, "content-type": "application/json" },
            body: JSON.stringify({
              text,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.4, similarity_boost: 0.8 },
            }),
          },
          120_000,
        ),
        "ElevenLabs",
      );
      return response.arrayBuffer();
    });

    const db = await admin();
    const path = `${ctx.userId}/${ctx.id}/narration.mp3`;
    const { error } = await db.storage
      .from("generated-media")
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return await signedUrl(path);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 4. Video

const RUNWAY_VERSION = "2024-11-06";

export async function generateVideo(
  ctx: { id: string; userId: string },
  storyboard: Storyboard,
  imageUrl: string,
): Promise<string | null> {
  const key = envKey("RUNWAY_API_KEY");
  if (!key) {
    await logEvent(ctx.id, ctx.userId, "video", {
      provider: "runway",
      level: "warn",
      message: "RUNWAY_API_KEY missing — returned storyboard preview only.",
    });
    return null;
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "content-type": "application/json",
  };

  try {
    const taskId = await step(ctx, "video", "runway", async () => {
      const response = await ok(
        await fetchWithTimeout(
          "https://api.dev.runwayml.com/v1/image_to_video",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: "gen4_turbo",
              promptImage: imageUrl,
              promptText: storyboard.scenes[0]?.visual?.slice(0, 480) ?? storyboard.title,
              ratio: "720:1280",
              duration: 5,
            }),
          },
          60_000,
        ),
        "Runway",
      );
      const json = (await response.json()) as { id?: string };
      if (!json.id) throw new Error("Runway did not return a task id.");
      return json.id;
    });

    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const response = await fetchWithTimeout(
        `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
        { headers },
        30_000,
      );
      if (!response.ok) continue;
      const task = (await response.json()) as {
        status?: string;
        output?: string[];
        failure?: string;
      };
      if (task.status === "SUCCEEDED" && task.output?.[0]) {
        await logEvent(ctx.id, ctx.userId, "video-ready", {
          provider: "runway",
          message: "Render complete.",
        });
        return task.output[0];
      }
      if (task.status === "FAILED") {
        throw new Error(task.failure ?? "Runway render failed.");
      }
    }
    throw new Error("Runway render timed out.");
  } catch (error) {
    await logEvent(ctx.id, ctx.userId, "video", {
      provider: "runway",
      level: "warn",
      message: error instanceof Error ? error.message : "Runway unavailable.",
    });
    return null;
  }
}

// ---------------------------------------------------------------- 5. Coasty QA

export async function coastyReview(
  ctx: { id: string; userId: string },
  storyboard: Storyboard,
): Promise<void> {
  const key = process.env.COASTY_API_KEY;
  const baseUrl = process.env.COASTY_BASE_URL;
  if (!key || !baseUrl) {
    await logEvent(ctx.id, ctx.userId, "review", {
      provider: "coasty",
      level: "warn",
      message: "Coasty base URL not configured — quality review and auto-publish skipped.",
    });
    return;
  }
  try {
    await step(ctx, "review", "coasty", async () => {
      await ok(
        await fetchWithTimeout(
          `${baseUrl.replace(/\/$/, "")}/v1/tasks`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify({ type: "quality_review", title: storyboard.title }),
          },
          60_000,
        ),
        "Coasty",
      );
      return true;
    });
  } catch {
    /* already audited; non-fatal */
  }
}

// ---------------------------------------------------------------- orchestrator

export async function runPipeline(generationId: string, userId: string): Promise<void> {
  const ctx = { id: generationId, userId };
  const db = await admin();
  const { data: row } = await db
    .from("generations")
    .select("id, user_id, prompt, platform, script_text, status")
    .eq("id", generationId)
    .maybeSingle();

  if (!row || row.user_id !== userId) throw new Error("Generation not found.");
  if (row.status === "running" || row.status === "complete") return;

  await setProgress(generationId, { status: "running", current_step: "script", progress: 5 });
  await logEvent(generationId, userId, "start", { message: "Pipeline started." });

  try {
    const storyboard = await buildStoryboard(ctx, {
      prompt: row.prompt ?? "",
      platform: row.platform,
      scriptText: row.script_text,
    });
    await setProgress(generationId, {
      current_step: "visuals",
      progress: 30,
      storyboard: storyboard as unknown as Record<string, unknown>,
      title: storyboard.title,
      caption: storyboard.caption,
      hashtags: storyboard.hashtags,
      script_text: storyboard.scenes.map((s) => s.narration).join("\n"),
    });

    const images = await generateSceneImagesSafe(ctx, storyboard);
    await setProgress(generationId, {
      current_step: "voiceover",
      progress: 55,
      thumbnail_url: images[0] ?? null,
    });

    const audioUrl = await generateVoiceover(ctx, storyboard);
    await setProgress(generationId, { current_step: "video", progress: 70, audio_url: audioUrl });

    const videoUrl = images[0] ? await generateVideo(ctx, storyboard, images[0]) : null;
    await setProgress(generationId, { current_step: "review", progress: 90, video_url: videoUrl });

    await coastyReview(ctx, storyboard);

    await setProgress(generationId, {
      status: "complete",
      current_step: "done",
      progress: 100,
      error: null,
    });
    await logEvent(generationId, userId, "complete", { message: "Pipeline finished." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    await setProgress(generationId, { status: "failed", error: message });
    await logEvent(generationId, userId, "failed", { level: "error", message });
    throw error;
  }
}

async function generateSceneImagesSafe(
  ctx: { id: string; userId: string },
  storyboard: Storyboard,
): Promise<string[]> {
  try {
    return await generateSceneImages(ctx, storyboard);
  } catch (error) {
    await logEvent(ctx.id, ctx.userId, "visuals", {
      level: "warn",
      message: error instanceof Error ? error.message : "Image generation unavailable.",
    });
    return [];
  }
}
