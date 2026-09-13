import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/lib/auth/auth";
import { cn } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, register, loading, error, clearError, session } = useAuthStore();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("clinician@healthguard.io");
  const [password, setPassword] = useState("healthguard");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const ok =
      mode === "signin"
        ? await signIn(email, password)
        : await register(email, password, fullName);
    if (ok) navigate("/dashboard", { replace: true });
  };

  const quickLogin = async (demoEmail: string) => {
    clearError();
    setEmail(demoEmail);
    setPassword("healthguard");
    const ok = await signIn(demoEmail, "healthguard");
    if (ok) navigate("/dashboard", { replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / hero */}
      <div className="relative hidden overflow-hidden border-r border-white/5 lg:block">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-violet-500/10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30">
              <Activity className="h-6 w-6 text-brand-300" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">HealthGuard</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-300/80">
                AIoT Platform
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight">
              Real-time patient telemetry, guarded by AI.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-300">
              An end-to-end AIoT platform: ESP32 vital-sign nodes streaming over MQTT,
              an online ML ensemble catching anomalies the instant they emerge, and a
              retrieval-augmented clinical assistant grounded in your protocols.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { k: "MQTT / WebSocket", v: "Live telemetry bus" },
                { k: "ML Ensemble", v: "z-score · EWMA · iForest" },
                { k: "RAG Assistant", v: "Grounded answers" },
                { k: "RLS + Roles", v: "Secure by design" },
              ].map((f) => (
                <div key={f.k} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="text-xs font-semibold text-ink-100">{f.k}</div>
                  <div className="text-[11px] text-ink-400">{f.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-ink-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            HIPAA / GDPR-aware · PHI encrypted in transit &amp; at rest
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-400/30">
                <Activity className="h-5 w-5 text-brand-300" />
              </div>
              <div className="text-lg font-bold">HealthGuard</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            {mode === "signin"
              ? "Sign in to access the monitoring console."
              : "Register a clinician account to get started."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-300">Full name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                  <input
                    className="input pl-9"
                    placeholder="Dr. Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-300">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="you@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-300">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-ink-400">
            {mode === "signin" ? "No account? " : "Already registered? "}
            <button
              onClick={() => {
                clearError();
                setMode(mode === "signin" ? "register" : "signin");
              }}
              className="font-semibold text-brand-300 hover:text-brand-200"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>

          <div className="mt-8">
            <div className="mb-2 text-center text-[11px] uppercase tracking-wide text-ink-500">
              Demo accounts (password: healthguard)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {authService.demoCredentials.map((c) => (
                <button
                  key={c.email}
                  onClick={() => quickLogin(c.email)}
                  disabled={loading}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-left text-xs hover:border-brand-400/30 hover:bg-white/[0.06]",
                  )}
                >
                  <span className="text-ink-200">{c.email}</span>
                  <span className="chip border-brand-400/30 bg-brand-400/10 capitalize text-brand-200">
                    {c.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
