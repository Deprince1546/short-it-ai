import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./providers.server";

export type DiagnosticEvent = {
  id: string;
  generationId: string;
  correlationId: string | null;
  attempt: number | null;
  step: string;
  provider: string | null;
  level: string;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
  generationTitle: string | null;
  generationStatus: string | null;
};


export type ProviderDiagnostic = {
  provider: string;
  calls: number;
  failures: number;
  warnings: number;
  avgMs: number | null;
  slowestMs: number | null;
  lastCall: string | null;
  lastError: string | null;
};

/**
 * Admin-only troubleshooting feed. Returns per-provider timing/health rollups
 * plus the raw audit trail. Only step/provider/level/duration/message are stored
 * server-side, so no API keys or credentials can appear here.
 */
export const getDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number; onlyFailures?: boolean; correlationId?: string }) => ({
    limit: Math.min(Math.max(input?.limit ?? 200, 20), 500),
    onlyFailures: Boolean(input?.onlyFailures),
    correlationId: (input?.correlationId ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("generation_events")
      .select(
        "id, generation_id, correlation_id, attempt, step, provider, level, message, duration_ms, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.onlyFailures) query = query.in("level", ["error", "warn"]);
    if (data.correlationId) query = query.eq("correlation_id", data.correlationId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const events = rows ?? [];

    const generationIds = [...new Set(events.map((event) => event.generation_id))];
    const { data: generations } = generationIds.length
      ? await supabaseAdmin
          .from("generations")
          .select("id, title, prompt, status")
          .in("id", generationIds)
      : { data: [] as { id: string; title: string | null; prompt: string | null; status: string }[] };
    const byGeneration = new Map((generations ?? []).map((row) => [row.id, row]));

    const feed: DiagnosticEvent[] = events.map((event) => {
      const generation = byGeneration.get(event.generation_id);
      return {
        id: event.id,
        generationId: event.generation_id,
        correlationId: event.correlation_id,
        attempt: event.attempt,
        step: event.step,
        provider: event.provider,
        level: event.level,
        message: event.message,
        durationMs: event.duration_ms,
        createdAt: event.created_at,
        generationTitle: generation?.title ?? generation?.prompt ?? null,
        generationStatus: generation?.status ?? null,
      };
    });


    const groups = new Map<string, ProviderDiagnostic & { total: number }>();
    for (const event of feed) {
      const key = event.provider ?? "pipeline";
      const current =
        groups.get(key) ??
        ({
          provider: key,
          calls: 0,
          failures: 0,
          warnings: 0,
          avgMs: null,
          slowestMs: null,
          lastCall: null,
          lastError: null,
          total: 0,
        } as ProviderDiagnostic & { total: number });

      current.calls += 1;
      if (event.level === "error") current.failures += 1;
      if (event.level === "warn") current.warnings += 1;
      if (event.durationMs != null) {
        current.total += event.durationMs;
        current.slowestMs = Math.max(current.slowestMs ?? 0, event.durationMs);
      }
      if (!current.lastCall) current.lastCall = event.createdAt;
      if (!current.lastError && event.level !== "info") current.lastError = event.message;
      groups.set(key, current);
    }

    const summary: ProviderDiagnostic[] = [...groups.values()]
      .map(({ total, ...group }) => {
        const timed = feed.filter(
          (event) => (event.provider ?? "pipeline") === group.provider && event.durationMs != null,
        ).length;
        return { ...group, avgMs: timed ? Math.round(total / timed) : null };
      })
      .sort((a, b) => b.failures - a.failures || b.calls - a.calls);

    return { summary, events: feed };
  });
