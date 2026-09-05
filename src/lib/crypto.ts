/**
 * Web Crypto helpers — all native browser APIs, zero dependencies, zero cost.
 *
 * Password verification: PBKDF2-SHA-256 (150k iterations, 32-byte random salt).
 * Data at rest:          AES-256-GCM with a key derived from the user's password.
 *
 * Plaintext passwords are never stored, never logged, never leave the device.
 */

const te = new TextEncoder();
const td = new TextDecoder();

export const PBKDF2_ITERATIONS = 150_000;
const AES_KEY_SALT_NOTE = "tempo-aes-v1";

export function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function randomB64(byteLen: number): string {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return bufToB64(a);
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison to avoid timing side-channels. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** PBKDF2-SHA-256 → 256-bit digest as hex. Used for password verification. */
export async function pbkdf2Hex(password: string, saltB64: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

/** Derive an AES-256-GCM key from the password (separate salt from the auth hash). */
export async function deriveAesKey(password: string, saltB64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable: raw bytes live only in sessionStorage for the tab's lifetime
    ["encrypt", "decrypt"]
  );
}

/** Re-import a previously exported AES key (session restore after a page refresh). */
export async function importAesKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    b64ToBytes(keyB64),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function exportAesKey(key: CryptoKey): Promise<string> {
  return bufToB64(await crypto.subtle.exportKey("raw", key));
}

/** AES-256-GCM encrypt a JSON value. Fresh random IV on every call. */
export async function encryptJSON(value: unknown, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(value)));
  return { iv: bufToB64(iv), data: bufToB64(cipher) };
}

export async function decryptJSON<T>(payload: { iv: string; data: string }, key: CryptoKey): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.data)
  );
  return JSON.parse(td.decode(plain)) as T;
}

/* ----------------------------- Password policy ---------------------------- */

export interface PasswordCheck {
  ok: boolean;
  label: string;
}

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-zA-Z]/.test(pw), label: "Contains a letter" },
    { ok: /\d/.test(pw), label: "Contains a number" },
  ];
}

export function passwordStrongEnough(pw: string): boolean {
  return passwordChecks(pw).every((c) => c.ok);
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: "—", color: "var(--color-line)" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  if (pw.length < 8) s = Math.min(s, 1);
  const map = [
    { label: "Too short", color: "var(--color-ember)" },
    { label: "Weak", color: "var(--color-ember)" },
    { label: "Fair", color: "var(--color-tang)" },
    { label: "Good", color: "var(--color-amber)" },
    { label: "Strong", color: "var(--color-doneg)" },
  ] as const;
  return { score: s as 0 | 1 | 2 | 3 | 4, label: map[s].label, color: map[s].color };
}

export const CRYPTO_NOTE = AES_KEY_SALT_NOTE;
