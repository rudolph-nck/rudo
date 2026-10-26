import { NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import {
  PB_COOKIE,
  PB_SESSION_DAYS,
  checkCredentials,
  createSessionToken,
} from "@/lib/project-builder/session";

// Fallback limiter for when the database-backed one is unavailable, so the
// guides stay reachable during a DB outage. Per server instance only.
const memoryAttempts = new Map<string, { count: number; start: number }>();
const MEMORY_MAX = 5;
const MEMORY_WINDOW_MS = 15 * 60 * 1000;

function memoryLimited(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = memoryAttempts.get(ip);
  if (!entry || now - entry.start > MEMORY_WINDOW_MS) {
    memoryAttempts.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  return entry.count > MEMORY_MAX;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitMiddleware(req, "login");
    if (limited) return limited;
  } catch (err) {
    console.error("Project Builder rate limit unavailable, using memory limiter:", err);
    if (memoryLimited(req)) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }

  const token = await createSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Login is not configured on the server" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PB_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PB_SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
