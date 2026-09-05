import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppState } from "../types";
import {
  PBKDF2_ITERATIONS, decryptJSON, deriveAesKey, encryptJSON, exportAesKey,
  importAesKey, passwordStrongEnough, pbkdf2Hex, randomB64, timingSafeEqual,
} from "./crypto";

const USERS_KEY = "tempo.users.v1";
const VAULT_PREFIX = "tempo.vault.v1.";
const SESSION_KEY = "tempo.session.v1";
const GUARD_KEY = "tempo.guard.v1";

export const MAX_ATTEMPTS = 5;
export const BASE_LOCK_SECONDS = 30;

/* ------------------------------ Storage shapes ---------------------------- */

interface StoredUser {
  uid: string;
  name: string;
  nameLower: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: string;
}

interface VaultBlob {
  v: 1;
  salt: string;
  iv: string;
  data: string;
  updatedAt: string;
}

interface SessionBlob {
  uid: string;
  keyB64: string;
}

interface GuardEntry {
  fails: number;
  lockedUntil: number; // epoch ms
}

export interface PublicUser {
  uid: string;
  name: string;
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  name: string;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; lockedUntil?: number };

interface AuthValue {
  phase: "booting" | "auth" | "ready";
  bootError: string | null;
  user: AuthUser | null;
  users: PublicUser[];
  appState: AppState | null;
  login: (name: string, password: string) => Promise<AuthResult>;
  signup: (name: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  persist: (state: AppState) => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}

/* ------------------------------ Low-level IO ------------------------------ */

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full */ }
}

function loadUsers(): StoredUser[] {
  return readJSON<StoredUser[]>(USERS_KEY) ?? [];
}

function saveUsers(users: StoredUser[]): void {
  writeJSON(USERS_KEY, users);
}

function loadGuard(): Record<string, GuardEntry> {
  return readJSON<Record<string, GuardEntry>>(GUARD_KEY) ?? {};
}

export function lockInfo(name: string): { lockedUntil: number; fails: number } | null {
  const g = loadGuard()[name.toLowerCase()];
  if (!g || g.fails === 0) return null;
  return { lockedUntil: g.lockedUntil, fails: g.fails };
}

function registerFail(nameLower: string): number {
  const guard = loadGuard();
  const entry = guard[nameLower] ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  let until = 0;
  if (entry.fails >= MAX_ATTEMPTS) {
    const exponent = Math.min(entry.fails - MAX_ATTEMPTS, 4);
    until = Date.now() + BASE_LOCK_SECONDS * Math.pow(2, exponent) * 1000;
    entry.lockedUntil = until;
  }
  guard[nameLower] = entry;
  writeJSON(GUARD_KEY, guard);
  return until;
}

function clearFails(nameLower: string): void {
  const guard = loadGuard();
  delete guard[nameLower];
  writeJSON(GUARD_KEY, guard);
}

const GENERIC_ERROR = "Invalid username or password.";

/* ------------------------------- Provider --------------------------------- */

export function AuthProvider({ children, freshState }: { children: ReactNode; freshState: (name: string) => AppState }) {
  const [phase, setPhase] = useState<"booting" | "auth" | "ready">("booting");
  const [bootError, setBootError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [appState, setAppState] = useState<AppState | null>(null);
  // The AES key lives only in memory; its export sits in sessionStorage (tab lifetime only).
  const keyRef = useRef<CryptoKey | null>(null);

  const refreshUsers = useCallback(() => {
    setUsers(loadUsers().map(({ uid, name, createdAt }) => ({ uid, name, createdAt })));
  }, []);

  /* Restore session on load */
  useEffect(() => {
    refreshUsers();
    let cancelled = false;
    (async () => {
      try {
        const sess = readJSON<SessionBlob>(SESSION_KEY);
        if (!sess) { if (!cancelled) setPhase("auth"); return; }
        const stored = loadUsers().find((u) => u.uid === sess.uid);
        const vault = readJSON<VaultBlob>(VAULT_PREFIX + sess.uid);
        if (!stored || !vault) {
          sessionStorage.removeItem(SESSION_KEY);
          if (!cancelled) setPhase("auth");
          return;
        }
        const key = await importAesKey(sess.keyB64);
        const state = await decryptJSON<AppState>(vault, key);
        if (!state || !Array.isArray(state.tasks) || !state.settings) throw new Error("corrupt");
        if (cancelled) return;
        keyRef.current = key;
        setUser({ uid: stored.uid, name: stored.name });
        setAppState(state);
        setPhase("ready");
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        if (!cancelled) {
          setBootError("Session expired or data unreadable — please sign in again.");
          setPhase("auth");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [refreshUsers]);

  const establishSession = useCallback(async (stored: StoredUser, password: string) => {
    const vaultKey = VAULT_PREFIX + stored.uid;
    const existing = readJSON<VaultBlob>(vaultKey);
    const salt = existing?.salt ?? randomB64(32);
    const key = await deriveAesKey(password, salt);

    let state: AppState;
    if (existing) {
      state = await decryptJSON<AppState>(existing, key);
      if (!state || !Array.isArray(state.tasks) || !state.settings) throw new Error("corrupt");
    } else {
      state = freshState(stored.name);
      const enc = await encryptJSON(state, key);
      writeJSON(vaultKey, { v: 1, salt, iv: enc.iv, data: enc.data, updatedAt: new Date().toISOString() } satisfies VaultBlob);
    }

    const keyB64 = await exportAesKey(key);
    writeJSON(SESSION_KEY, { uid: stored.uid, keyB64 } satisfies SessionBlob);
    keyRef.current = key;
    setUser({ uid: stored.uid, name: stored.name });
    setAppState(state);
    setPhase("ready");
  }, [freshState]);

  const login = useCallback(async (name: string, password: string): Promise<AuthResult> => {
    const nameLower = name.trim().toLowerCase();
    if (!nameLower || !password) return { ok: false, error: "Enter both username and password." };

    const locked = lockInfo(nameLower);
    if (locked && locked.lockedUntil > Date.now()) {
      return { ok: false, error: "Too many failed attempts.", lockedUntil: locked.lockedUntil };
    }

    const stored = loadUsers().find((u) => u.nameLower === nameLower);
    // Burn a full hash cycle even for unknown names — response timing reveals nothing.
    const dummySalt = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const hash = await pbkdf2Hex(password, stored?.salt ?? dummySalt, stored?.iterations ?? PBKDF2_ITERATIONS);

    if (!stored || !timingSafeEqual(hash, stored.hash)) {
      const until = registerFail(nameLower);
      if (until > Date.now()) return { ok: false, error: "Too many failed attempts.", lockedUntil: until };
      return { ok: false, error: GENERIC_ERROR };
    }

    clearFails(nameLower);
    try {
      await establishSession(stored, password);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not unlock this profile's data. Check the password." };
    }
  }, [establishSession]);

  const signup = useCallback(async (name: string, password: string): Promise<AuthResult> => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24) return { ok: false, error: "Name must be 2–24 characters." };
    if (!passwordStrongEnough(password)) return { ok: false, error: "Password doesn't meet the requirements below." };

    const all = loadUsers();
    const nameLower = trimmed.toLowerCase();
    if (all.some((u) => u.nameLower === nameLower)) return { ok: false, error: "That name is already taken on this device." };

    const salt = randomB64(32);
    const hash = await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS);
    const stored: StoredUser = {
      uid: crypto.randomUUID(),
      name: trimmed,
      nameLower,
      salt,
      hash,
      iterations: PBKDF2_ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    saveUsers([...all, stored]);
    refreshUsers();
    await establishSession(stored, password);
    return { ok: true };
  }, [establishSession, refreshUsers]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    keyRef.current = null;
    setUser(null);
    setAppState(null);
    setBootError(null);
    setPhase("auth");
  }, []);

  const changePassword = useCallback(async (current: string, next: string): Promise<AuthResult> => {
    if (!user) return { ok: false, error: "Not signed in." };
    const stored = loadUsers().find((u) => u.uid === user.uid);
    if (!stored) return { ok: false, error: "Profile not found." };
    const hash = await pbkdf2Hex(current, stored.salt, stored.iterations);
    if (!timingSafeEqual(hash, stored.hash)) return { ok: false, error: "Current password is incorrect." };
    if (!passwordStrongEnough(next)) return { ok: false, error: "New password doesn't meet the requirements." };

    const vaultKey = VAULT_PREFIX + user.uid;
    const vault = readJSON<VaultBlob>(vaultKey);
    if (!vault || !keyRef.current) return { ok: false, error: "Vault unavailable — sign in again." };
    const state = await decryptJSON<AppState>(vault, keyRef.current);

    const newSalt = randomB64(32);
    const newHash = await pbkdf2Hex(next, newSalt, PBKDF2_ITERATIONS);
    saveUsers(loadUsers().map((u) => (u.uid === user.uid ? { ...u, salt: newSalt, hash: newHash } : u)));

    const newKey = await deriveAesKey(next, vault.salt);
    const enc = await encryptJSON(state, newKey);
    writeJSON(vaultKey, { ...vault, iv: enc.iv, data: enc.data, updatedAt: new Date().toISOString() });
    const keyB64 = await exportAesKey(newKey);
    writeJSON(SESSION_KEY, { uid: user.uid, keyB64 } satisfies SessionBlob);
    keyRef.current = newKey;
    return { ok: true };
  }, [user]);

  const persist = useCallback((state: AppState) => {
    const key = keyRef.current;
    if (!key || !user) return;
    void (async () => {
      try {
        const vaultKey = VAULT_PREFIX + user.uid;
        const prev = readJSON<VaultBlob>(vaultKey);
        const salt = prev?.salt ?? randomB64(32);
        const enc = await encryptJSON(state, key);
        writeJSON(vaultKey, { v: 1, salt, iv: enc.iv, data: enc.data, updatedAt: new Date().toISOString() } satisfies VaultBlob);
      } catch { /* non-fatal */ }
    })();
  }, [user]);

  const value = useMemo<AuthValue>(
    () => ({ phase, bootError, user, users, appState, login, signup, logout, changePassword, persist }),
    [phase, bootError, user, users, appState, login, signup, logout, changePassword, persist]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
