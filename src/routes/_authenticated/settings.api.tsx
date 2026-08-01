import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProviders, testAllProviders, testProvider } from "@/lib/providers.functions";
import { getDiagnostics } from "@/lib/diagnostics.functions";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, CircleHelp, Loader2, RefreshCw } from "lucide-react";


export const Route = createFileRoute("/_authenticated/settings/api")({
  head: () => ({
    meta: [
      { title: "API Configuration — Short It" },
      {
        name: "description",
        content:
          "Admin-only view of every connected AI provider, with live server-side key validation.",
      },
      { property: "og:title", content: "API Configuration — Short It" },
      { property: "og:description", content: "Manage and validate Short It AI provider keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiSettings,
});

const STATUS_UI = {
  connected: { label: "Connected", icon: CheckCircle2, cls: "text-emerald-400" },
  invalid: { label: "Invalid", icon: CircleAlert, cls: "text-red-400" },
  missing: { label: "Not configured", icon: CircleAlert, cls: "text-amber-400" },
  unknown: { label: "Not verified", icon: CircleHelp, cls: "text-white/40" },
} as const;

function ApiSettings() {
  const queryClient = useQueryClient();
  const fetchProviders = useServerFn(listProviders);
  const runTest = useServerFn(testProvider);
  const runAll = useServerFn(testAllProviders);

  const { data, isLoading, error } = useQuery({
    queryKey: ["providers"],
    queryFn: () => fetchProviders(),
    retry: false,
  });

  const single = useMutation({
    mutationFn: (id: string) => runTest({ data: { id } }),
    onSuccess: (result) => {
      toast[result.status === "connected" ? "success" : "error"](
        `${result.id}: ${STATUS_UI[result.status].label}`,
        { description: result.detail },
      );
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = useMutation({
    mutationFn: () => runAll(),
    onSuccess: () => {
      toast.success("All providers checked");
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <Link to="/studio" className="text-white/40 text-xs tracking-widest uppercase">
          ← Studio
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-4xl md:text-5xl text-white tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              API Configuration
            </h1>
            <p className="mt-2 text-white/50 text-sm max-w-xl">
              Keys are stored as encrypted server-side environment variables and are never sent to
              the browser. Only their connection status is shown here.
            </p>
          </div>
          <button
            onClick={() => all.mutate()}
            disabled={all.isPending}
            className="liquid-glass rounded-full px-6 py-3 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            {all.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Test all
          </button>
        </div>

        {isLoading && <p className="mt-10 text-white/40 text-sm">Loading providers…</p>}
        {error && (
          <p className="mt-10 text-red-400 text-sm">
            {error instanceof Error && error.message.includes("Forbidden")
              ? "This page is restricted to admin accounts."
              : "Could not load provider status."}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {data?.map((provider) => {
            const ui = STATUS_UI[provider.status];
            const Icon = ui.icon;
            return (
              <div
                key={provider.id}
                className="liquid-glass rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-white text-base">{provider.label}</span>
                    <span className="text-white/30 text-[10px] tracking-widest uppercase">
                      {provider.capability}
                    </span>
                  </div>
                  <p className="mt-1 text-white/50 text-sm">{provider.purpose}</p>
                  <p className="mt-2 text-white/25 text-xs font-mono">{provider.envVar}</p>
                  {provider.detail && (
                    <p className="mt-2 text-white/40 text-xs">{provider.detail}</p>
                  )}
                  {provider.checkedAt && (
                    <p className="mt-1 text-white/25 text-xs">
                      Last checked {new Date(provider.checkedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-2 text-sm ${ui.cls}`}>
                    <Icon size={16} />
                    {ui.label}
                  </span>
                  <button
                    onClick={() => single.mutate(provider.id)}
                    disabled={single.isPending}
                    className="liquid-glass rounded-full px-5 py-2 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Test
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
