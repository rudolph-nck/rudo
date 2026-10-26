import { NextRequest, NextResponse } from "next/server";
import {
  PB_COOKIE,
  PB_SESSION_DAYS,
  checkCredentials,
  createSessionToken,
  loginConfigProblem,
} from "@/lib/project-builder/session";

// In-memory limiter on failed attempts (per server instance). Deliberately not
// the database-backed limiter, so the guides keep working if the DB is down
// or slow to time out.
const failures = new Map<string, { count: number; start: number }>();
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isLocked(ip: string, now: number): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.start > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) failures.set(ip, { count: 1, start: now });
  else entry.count++;
}

export async function POST(req: NextRequest) {
  const problem = loginConfigProblem();
  if (problem) {
    console.error("Project Builder login misconfigured:", problem);
    return NextResponse.json({ error: `Login isn't set up on the server: ${problem}` }, { status: 500 });
  }

  const ip = clientIp(req);
  const now = Date.now();
  if (isLocked(ip, now)) {
    return NextResponse.json({ error: "Too many wrong tries. Wait 15 minutes and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    recordFailure(ip, now);
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }
  failures.delete(ip);

  const token = await createSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Login isn't set up on the server: no signing secret" }, { status: 500 });
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
