import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type AuthView = "sign_in" | "sign_up" | "forgot";

function SpinnerIcon() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function ShieldLockIcon() {
  return (
    <svg className="w-10 h-10 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <rect x="9" y="11" width="6" height="5" rx="1" />
      <path d="M12 11V9a2 2 0 0 1 4 0" />
    </svg>
  );
}

/**
 * AuthGate — wraps the entire app.
 * If Supabase is not configured, renders children directly (dev mode).
 * If configured, requires Supabase Auth login before showing the dashboard.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    // No Supabase configured — show app without auth gate (dev/demo mode)
    return <>{children}</>;
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <SpinnerIcon />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

function AuthScreen() {
  const [view, setView] = useState<AuthView>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (view === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage({ text: error.message, ok: false });
      } else if (view === "sign_up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage({ text: error.message, ok: false });
        } else {
          setMessage({ text: "Account created! Check your email to confirm, then sign in.", ok: true });
          setView("sign_in");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) {
          setMessage({ text: error.message, ok: false });
        } else {
          setMessage({ text: "Password reset email sent — check your inbox.", ok: true });
        }
      }
    } catch {
      setMessage({ text: "An unexpected error occurred. Please try again.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-4">
            <ShieldLockIcon />
          </div>
          <h1 className="font-heading text-3xl italic text-white leading-none">Traffic Intelligence</h1>
          <p className="mt-2 text-xs font-mono text-white/50 uppercase tracking-widest">
            {view === "sign_in" ? "Sign in to continue" : view === "sign_up" ? "Create an account" : "Reset password"}
          </p>
        </div>

        {/* Auth Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/8 backdrop-blur-md border border-white/15 p-6 space-y-4 shadow-2xl"
        >
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-mono ${
                message.ok
                  ? "bg-emerald-900/40 border border-emerald-500/40 text-emerald-300"
                  : "bg-red-900/40 border border-red-500/40 text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-mono text-white/50 uppercase tracking-wider" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 transition"
            />
          </div>

          {view !== "forgot" && (
            <div className="space-y-1">
              <label className="text-xs font-mono text-white/50 uppercase tracking-wider" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={view === "sign_in" ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 transition"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <SpinnerIcon />}
            {view === "sign_in" ? "Sign In" : view === "sign_up" ? "Create Account" : "Send Reset Email"}
          </button>
        </form>

        {/* View Switcher */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-mono text-white/50">
          {view !== "sign_in" && (
            <button type="button" onClick={() => { setView("sign_in"); setMessage(null); }} className="hover:text-white transition">
              Sign In
            </button>
          )}
          {view !== "sign_up" && (
            <button type="button" onClick={() => { setView("sign_up"); setMessage(null); }} className="hover:text-white transition">
              Create Account
            </button>
          )}
          {view !== "forgot" && (
            <button type="button" onClick={() => { setView("forgot"); setMessage(null); }} className="hover:text-white transition">
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
