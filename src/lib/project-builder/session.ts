// Project Builder guides use their own single-account login, separate from
// NextAuth users. The session is an HMAC-signed expiry timestamp stored in a
// cookie. Uses Web Crypto only so it runs in middleware (edge) and in routes.

export const PB_COOKIE = "pb_session";
export const PB_SESSION_DAYS = 30;

const encoder = new TextEncoder();

function getSecret(): string | null {
  return process.env.PROJECT_BUILDER_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Compare two strings without short-circuiting on the first mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function createSessionToken(
  now: number = Date.now(),
  secret: string | null = getSecret()
): Promise<string | null> {
  if (!secret) return null;
  const exp = String(now + PB_SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${exp}.${await hmac(secret, `pb:${exp}`)}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
  secret: string | null = getSecret()
): Promise<boolean> {
  if (!token || !secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, await hmac(secret, `pb:${exp}`));
}

/** Username is case-insensitive (phones auto-capitalize); password is exact. */
export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.PROJECT_BUILDER_USERNAME;
  const expectedPass = process.env.PROJECT_BUILDER_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  const userOk = safeEqual(username.trim().toLowerCase(), expectedUser.trim().toLowerCase());
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}
