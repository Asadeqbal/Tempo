import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Fingerprint, Loader2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { MAX_ATTEMPTS, lockInfo, useAuth } from "../lib/auth";
import { passwordChecks, passwordStrength } from "../lib/crypto";
import { TempoLogo } from "./Logo";
import { inputCls } from "./ui";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const pwRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, Math.ceil((lockedUntil - nowTick) / 1000));

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 400);
    return () => window.clearInterval(t);
  }, [lockedUntil]);

  // Pre-check for an active lockout on the typed username
  const typedLock = useMemo(() => {
    if (name.trim().length < 2) return null;
    const l = lockInfo(name);
    return l && l.lockedUntil > Date.now() ? l : null;
  }, [name, nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const strength = passwordStrength(password);
  const checks = passwordChecks(password);
  const confirmOk = confirm.length > 0 && confirm === password;

  const fail = (msg: string, until?: number) => {
    setError(msg);
    setShake((s) => s + 1);
    if (until) setLockedUntil(until);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const lock = lockInfo(name);
    if (lock && lock.lockedUntil > Date.now()) {
      fail("Too many failed attempts.", lock.lockedUntil);
      return;
    }
    if (mode === "signup") {
      if (name.trim().length < 2) return fail("Name must be at least 2 characters.");
      if (!checks.every((c) => c.ok)) return fail("Password doesn't meet the requirements below.");
      if (!confirmOk) return fail("Passwords don't match.");
    }
    setBusy(true);
    setError(null);
    const result = mode === "login" ? await auth.login(name, password) : await auth.signup(name, password);
    setBusy(false);
    if (!result.ok) fail(result.error, result.lockedUntil);
  };

  const pickProfile = (n: string) => {
    setMode("login");
    setName(n);
    setError(null);
    window.setTimeout(() => pwRef.current?.focus(), 30);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const disabled = busy || remaining > 0 || (typedLock !== null && remaining > 0);

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="relative hidden w-[46%] overflow-hidden lg:block">
        <div className="night-texture absolute inset-0" />
        <div className="dotfield absolute inset-0 opacity-30" />
        <div className="anim-breathe pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-pine/20 blur-3xl" />
        <div className="anim-breathe pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-mint/10 blur-3xl" style={{ animationDelay: "1.4s" }} />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="anim-rise flex items-center gap-3">
            <TempoLogo size={38} light />
            <div>
              <p className="font-display text-[19px] font-bold leading-none text-white">Tempo</p>
              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-mint/80">Personal work cockpit</p>
            </div>
          </div>

          <div className="anim-rise" style={{ animationDelay: "0.08s" }}>
            <h1 className="font-display text-[42px] font-bold leading-[1.05] text-white xl:text-[50px]">
              Your day,<br />
              <span className="text-mint">orchestrated.</span>
            </h1>
            <div className="mt-9 space-y-4">
              {[
                ["01", "Capture everything in seconds — plain language, ⌘K and done."],
                ["02", "The engine scores urgency, effort and blockers, then tells you what's next."],
                ["03", "Close the tab and your workspace locks itself behind your key."],
              ].map(([n, t]) => (
                <div key={n} className="flex items-start gap-4">
                  <span className="mt-0.5 font-mono text-[11px] font-semibold text-mint">{n}</span>
                  <p className="max-w-sm text-[13.5px] leading-relaxed text-nighttext">{t}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="anim-rise flex items-start gap-2.5 border-t border-nightline pt-6" style={{ animationDelay: "0.16s" }}>
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-mint" />
            <p className="max-w-md text-[11.5px] leading-relaxed text-nighttext/80">
              Free forever — runs entirely in your browser. Passwords are hashed with
              <span className="text-nighttext"> PBKDF2-SHA-256 (150k rounds)</span>, and every profile's data is
              <span className="text-nighttext"> encrypted at rest with AES-256-GCM</span>. Nothing is sent to any server.
            </p>
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="app-wash relative flex flex-1 items-center justify-center bg-mist p-5">
        <div className="pointer-events-none absolute inset-0 dotfield opacity-60" />
        <div className="relative w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <TempoLogo size={32} />
            <div>
              <p className="font-display text-lg font-bold leading-none text-ink">Tempo</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-pine">Personal work cockpit</p>
            </div>
          </div>

          <div key={shake} className={`anim-pop rounded-xl border border-line bg-card p-6 shadow-xl shadow-ink/10 sm:p-7 ${shake ? "anim-shake" : ""}`}>
            {/* Mode tabs */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-mist p-1">
              {(["login", "signup"] as Mode[]).map((m) => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`rounded-md py-2 text-[12.5px] font-semibold transition-all duration-200 ${
                    mode === m ? "bg-card text-ink shadow-sm" : "text-inksoft hover:text-ink"
                  }`}>
                  {m === "login" ? "Sign in" : "New profile"}
                </button>
              ))}
            </div>

            <h2 className="font-display text-[21px] font-bold text-ink">
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p className="mt-1 text-[12.5px] text-inksoft">
              {mode === "login"
                ? "Unlock your tasks, plans and history."
                : "A private, encrypted workspace on this device — free, no email needed."}
            </p>

            {/* Profile picker */}
            {auth.users.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">
                  <Users size={11} /> Profiles on this device
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {auth.users.map((u) => (
                    <button key={u.uid} onClick={() => pickProfile(u.name)}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[12px] font-medium transition-all active:scale-95
                        ${name.toLowerCase() === u.name.toLowerCase()
                          ? "border-pine bg-pinemist text-pinedeep"
                          : "border-line bg-paper text-inksoft hover:border-pine/50"}`}>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pine font-mono text-[9px] font-bold text-white">
                        {initials(u.name)}
                      </span>
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(auth.bootError || error) && (
              <div className="anim-pop mt-4 rounded-lg border border-ember/30 bg-embermist px-3 py-2.5 text-[12.5px] font-medium text-ember">
                {error ?? auth.bootError}
                {remaining > 0 && <span className="ml-1 font-mono">Try again in {remaining}s.</span>}
              </div>
            )}

            <form onSubmit={submit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-inksoft">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asha"
                  autoComplete="username"
                  maxLength={24}
                  className={inputCls}
                  autoFocus={auth.users.length === 0}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-inksoft">Password</label>
                <div className="relative">
                  <input
                    ref={pwRef}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-inkfaint transition-colors hover:text-ink">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div>
                    <label className="mb-1 block text-[11.5px] font-semibold text-inksoft">Confirm password</label>
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`${inputCls} ${confirm.length > 0 && !confirmOk ? "!border-ember" : confirmOk ? "!border-doneg" : ""}`}
                    />
                  </div>

                  {/* Strength meter + checklist */}
                  <div className="rounded-lg border border-linesoft bg-paper p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Strength</span>
                      <span className="text-[11px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                    <div className="mb-2.5 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength.score ? strength.color : "var(--color-line)" }} />
                      ))}
                    </div>
                    <ul className="grid grid-cols-1 gap-1">
                      {checks.map((c) => (
                        <li key={c.label} className={`flex items-center gap-1.5 text-[11.5px] transition-colors ${c.ok ? "text-doneg" : "text-inkfaint"}`}>
                          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold transition-all ${c.ok ? "border-doneg bg-doneg text-white" : "border-line"}`}>
                            {c.ok ? "✓" : ""}
                          </span>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={disabled}
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-pine py-2.5 text-[13.5px] font-bold text-white transition-all duration-200 hover:bg-pinedeep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                ) : remaining > 0 ? (
                  <>Locked · {remaining}s</>
                ) : mode === "login" ? (
                  <><Fingerprint size={15} /> Unlock workspace</>
                ) : (
                  <><UserPlus size={15} /> Create profile</>
                )}
                {!busy && remaining === 0 && <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-inkfaint">
              {mode === "login"
                ? `After ${MAX_ATTEMPTS} failed attempts the profile locks for 30 seconds, doubling each time.`
                : "Pick a password you'll remember — it's also the key that encrypts your data, and it can't be recovered if lost."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
