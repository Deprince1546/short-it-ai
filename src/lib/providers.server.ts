// Server-only provider registry.
// Adding a new AI provider = add one entry here. No frontend change required.

export type Capability = "llm" | "video" | "tts" | "image" | "agent";

export type ProviderStatusValue = "connected" | "invalid" | "missing" | "unknown";

export type ProviderCheckResult = {
  status: ProviderStatusValue;
  detail: string;
};

export type ProviderDefinition = {
  id: string;
  label: string;
  capability: Capability;
  envVar: string;
  purpose: string;
  /** Lightweight request proving the key works. Only called server-side. */
  healthCheck: (apiKey: string) => Promise<ProviderCheckResult>;
};

const TIMEOUT_MS = 12_000;

/**
 * Keys pasted through chat/forms often carry invisible unicode (LRM/RTL marks,
 * zero-width spaces, NBSP) or stray whitespace. Providers reject those verbatim,
 * so every key read goes through this.
 */
export function sanitizeKey(value: string | undefined | null): string {
  return (value ?? "").replace(/[\s\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "");
}

export function envKey(name: string): string {
  return sanitizeKey(process.env[name]);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  // Some provider edge/WAF layers reject requests without a User-Agent.
  if (!headers.has("User-Agent")) headers.set("User-Agent", "ShortIt/1.0 (+https://shortit.app)");
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}


/** Retry transient failures (429 / 5xx / network) with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 400 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}

async function classify(response: Response, okDetail: string): Promise<ProviderCheckResult> {
  if (response.ok) return { status: "connected", detail: okDetail };
  const body = (await response.text().catch(() => "")).slice(0, 200);
  if (response.status === 401 || response.status === 403) {
    return { status: "invalid", detail: `Rejected (${response.status}). ${body}`.trim() };
  }
  if (response.status === 402) {
    return { status: "invalid", detail: "Key valid but the account has no credit (402)." };
  }
  return { status: "unknown", detail: `Unexpected response ${response.status}. ${body}`.trim() };
}

function bearer(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    capability: "llm",
    envVar: "OPENROUTER_API_KEY",
    purpose: "Primary LLM: script expansion, storyboard, captions, titles, hashtags.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://openrouter.ai/api/v1/key", { headers: bearer(apiKey) }),
        "Key accepted by OpenRouter.",
      ),
  },
  {
    id: "runway",
    label: "Runway ML",
    capability: "video",
    envVar: "RUNWAY_API_KEY",
    purpose: "Primary AI video generation engine.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://api.dev.runwayml.com/v1/organization", {
          headers: { ...bearer(apiKey), "X-Runway-Version": "2024-11-06" },
        }),
        "Key accepted by Runway.",
      ),
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    capability: "tts",
    envVar: "ELEVENLABS_API_KEY",
    purpose: "AI voice narration and multi-language voiceover.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://api.elevenlabs.io/v1/models", {
          headers: { "xi-api-key": apiKey },
        }),
        "Key accepted by ElevenLabs.",
      ),
  },

  {
    id: "pollinations",
    label: "Pollinations",
    capability: "image",
    envVar: "POLLINATIONS_API_KEY",
    purpose: "Fast image generation and thumbnails.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout(
          "https://image.pollinations.ai/prompt/connectivity%20test?width=64&height=64&nologo=true",
          { headers: bearer(apiKey) },
        ),
        "Pollinations reachable with this key.",
      ),
  },
  {
    id: "stability",
    label: "Stability AI",
    capability: "image",
    envVar: "STABILITY_API_KEY",
    purpose: "High-quality image generation.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://api.stability.ai/v1/user/account", {
          headers: bearer(apiKey),
        }),
        "Key accepted by Stability AI.",
      ),
  },
  {
    id: "replicate",
    label: "Replicate",
    capability: "video",
    envVar: "REPLICATE_API_KEY",
    purpose: "Additional AI models (video, image, audio).",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://api.replicate.com/v1/account", {
          headers: { Authorization: `Token ${apiKey}` },
        }),
        "Key accepted by Replicate.",
      ),
  },
  {
    id: "groq",
    label: "Groq",
    capability: "llm",
    envVar: "GROQ_API_KEY",
    purpose: "Fast LLM inference used as the OpenRouter fallback.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://api.groq.com/openai/v1/models", { headers: bearer(apiKey) }),
        "Key accepted by Groq.",
      ),
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    capability: "llm",
    envVar: "HUGGINGFACE_API_KEY",
    purpose: "Translation, captions and experimental models.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout("https://huggingface.co/api/whoami-v2", { headers: bearer(apiKey) }),
        "Key accepted by Hugging Face.",
      ),
  },
  {
    id: "coasty",
    label: "Coasty (Computer-Use Agent)",
    capability: "agent",
    envVar: "COASTY_API_KEY",
    purpose:
      "Desktop/browser automation: thumbnails, trend research, quality review and publishing to social accounts.",
    healthCheck: async (apiKey) =>
      classify(
        await fetchWithTimeout(`${coastyBase()}/v1/models`, {
          headers: { "X-API-Key": apiKey },
        }),
        "Key accepted by Coasty.",
      ),
  },
];

export function coastyBase(): string {
  return (process.env.COASTY_BASE_URL || "https://coasty.ai").replace(/\/$/, "");
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export async function runHealthCheck(
  provider: ProviderDefinition,
): Promise<ProviderCheckResult> {
  const apiKey = envKey(provider.envVar);
  if (!apiKey) {
    return { status: "missing", detail: `${provider.envVar} is not configured.` };
  }
  try {
    return await withRetry(() => provider.healthCheck(apiKey), { attempts: 2 });

  } catch (error) {
    console.error(`[provider:${provider.id}] health check failed`, error);
    return {
      status: "unknown",
      detail: error instanceof Error ? error.message : "Network error during health check.",
    };
  }
}

export async function persistStatus(
  provider: ProviderDefinition,
  result: ProviderCheckResult,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("provider_status").upsert(
    {
      id: provider.id,
      label: provider.label,
      capability: provider.capability,
      env_var: provider.envVar,
      status: result.status,
      detail: result.detail,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) console.error(`[provider:${provider.id}] could not persist status`, error);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertAdmin(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin access required.");
}
