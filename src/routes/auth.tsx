import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Short It" },
      {
        name: "description",
        content: "Sign in to Short It to generate AI short-form videos and manage your workspace.",
      },
      { property: "og:title", content: "Sign in — Short It" },
      { property: "og:description", content: "Access your Short It AI video workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const destination = safePath(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const saved = sessionStorage.getItem("shortit:redirect");
        sessionStorage.removeItem("shortit:redirect");
        navigate({ to: safePath(saved ?? destination), replace: true });
      }
    });
  }, [destination, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(destination)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: destination, replace: true });
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: destination, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      sessionStorage.setItem("shortit:redirect", destination);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: destination, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="liquid-glass rounded-3xl w-full max-w-md p-8">
        <Link to="/" className="text-white/40 text-xs tracking-widest uppercase">
          Short It
        </Link>
        <h1
          className="mt-3 text-4xl text-white tracking-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-2 text-white/50 text-sm">
          Sign in to generate videos and manage your API connections.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="liquid-glass w-full rounded-full px-5 py-3 bg-transparent outline-none text-white placeholder:text-white/30 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="liquid-glass w-full rounded-full px-5 py-3 bg-transparent outline-none text-white placeholder:text-white/30 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-white text-black rounded-full py-3 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={google}
          disabled={busy}
          className="mt-3 liquid-glass w-full rounded-full py-3 text-white text-sm font-medium disabled:opacity-50"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-white/50 hover:text-white text-xs"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
