import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { newCorrelationId, runPipeline } from "./generation.server";

export const createGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt?: string; platform?: string; scriptText?: string }) => {
    const prompt = (input?.prompt ?? "").trim().slice(0, 2000);
    const scriptText = (input?.scriptText ?? "").trim().slice(0, 20000);
    if (!prompt && !scriptText) throw new Error("Describe an idea or upload a script first.");
    return { prompt, platform: (input?.platform ?? "").trim().slice(0, 60), scriptText };
  })
  .handler(async ({ data, context }) => {
    const correlationId = newCorrelationId();
    const { data: row, error } = await context.supabase
      .from("generations")
      .insert({
        user_id: context.userId,
        prompt: data.prompt || null,
        platform: data.platform || null,
        script_text: data.scriptText || null,
        status: "queued",
        current_step: "queued",
        progress: 0,
        correlation_id: correlationId,
      })
      .select("id, correlation_id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, correlationId };
  });


export const processGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Generation id is required.");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await runPipeline(data.id, context.userId);
    return { ok: true };
  });

export const getGenerationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Generation id is required.");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("generation_events")
      .select("id, step, provider, level, message, duration_ms, created_at")
      .eq("generation_id", data.id)
      .order("created_at", { ascending: true })
      .limit(200);
    return rows ?? [];
  });
