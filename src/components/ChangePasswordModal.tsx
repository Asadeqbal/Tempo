import { useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { passwordChecks, passwordStrength } from "../lib/crypto";
import { useToasts } from "../store";
import { Field, Modal, ModalHeader, inputCls } from "./ui";

export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = useAuth();
  const { push } = useToasts();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  if (!open) return null;

  const strength = passwordStrength(next);
  const checks = passwordChecks(next);
  const confirmOk = confirm.length > 0 && confirm === next;

  const close = () => {
    setCurrent(""); setNext(""); setConfirm(""); setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!current) { setError("Enter your current password."); setShake((s) => s + 1); return; }
    if (!checks.every((c) => c.ok)) { setError("New password doesn't meet the requirements."); setShake((s) => s + 1); return; }
    if (!confirmOk) { setError("Passwords don't match."); setShake((s) => s + 1); return; }
    setBusy(true);
    setError(null);
    const result = await changePassword(current, next);
    setBusy(false);
    if (result.ok) {
      push("success", "Password changed", "Your vault was re-encrypted with the new key.");
      close();
    } else {
      setError(result.error);
      setShake((s) => s + 1);
    }
  };

  return (
    <Modal open={open} onClose={close} width="max-w-md">
      <div key={shake} className={shake ? "anim-shake" : ""}>
        <ModalHeader title="Change password" onClose={close} kicker="Security · re-encrypts your vault" />
        <form onSubmit={submit} className="p-5 pt-3">
          {error && (
            <p className="anim-pop mb-3 rounded-lg border border-ember/30 bg-embermist px-3 py-2 text-[12.5px] font-medium text-ember">{error}</p>
          )}
          <div className="space-y-3">
            <Field label="Current password">
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password" className={inputCls} autoFocus placeholder="••••••••" />
            </Field>
            <Field label="New password">
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password" className={inputCls} placeholder="••••••••" />
              <div className="mt-2 rounded-lg border border-linesoft bg-paper p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-inkfaint">Strength</span>
                  <span className="text-[10.5px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                </div>
                <div className="mb-2 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i <= strength.score ? strength.color : "var(--color-line)" }} />
                  ))}
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {checks.map((c) => (
                    <li key={c.label} className={`text-[10.5px] ${c.ok ? "text-doneg" : "text-inkfaint"}`}>
                      {c.ok ? "✓" : "○"} {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </Field>
            <Field label="Confirm new password">
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={`${inputCls} ${confirm.length > 0 && !confirmOk ? "!border-ember" : confirmOk ? "!border-doneg" : ""}`}
                placeholder="••••••••" />
            </Field>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-inkfaint">
            <ShieldCheck size={12} className="mt-0.5 shrink-0 text-pine" />
            Your data is re-encrypted with a key derived from the new password. If you forget it, the vault cannot be recovered.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-[12.5px] font-medium text-inksoft transition-colors hover:bg-mist">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-pinedeep disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              {busy ? "Re-encrypting…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
