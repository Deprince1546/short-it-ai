import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PROVIDERS,
  assertAdmin,
  getProvider,
  persistStatus,
  runHealthCheck,
  type ProviderStatusValue,
} from "./providers.server";

export type ProviderRow = {
  id: string;
  label: string;
  capability: string;
  envVar: string;
  purpose: string;
  configured: boolean;
  status: ProviderStatusValue;
  detail: string | null;
  checkedAt: string | null;
};

export const listProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("provider_status").select("*");
    const byId = new Map((data ?? []).map((row) => [row.id, row]));

    return PROVIDERS.map((provider) => {
      const stored = byId.get(provider.id);
      const configured = Boolean(process.env[provider.envVar]);
      return {
        id: provider.id,
        label: provider.label,
        capability: provider.capability,
        envVar: provider.envVar,
        purpose: provider.purpose,
        configured,
        status: configured
          ? ((stored?.status as ProviderStatusValue) ?? "unknown")
          : ("missing" as ProviderStatusValue),
        detail: stored?.detail ?? null,
        checkedAt: stored?.checked_at ?? null,
      };
    });
  });

export const testProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("Provider id is required");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const provider = getProvider(data.id);
    if (!provider) throw new Error(`Unknown provider: ${data.id}`);
    const result = await runHealthCheck(provider);
    await persistStatus(provider, result);
    return { id: provider.id, ...result, checkedAt: new Date().toISOString() };
  });

export const testAllProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const results = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const result = await runHealthCheck(provider);
        await persistStatus(provider, result);
        return { id: provider.id, ...result };
      }),
    );
    return results;
  });
