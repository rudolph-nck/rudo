import { NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import {
  PB_COOKIE,
  PB_SESSION_DAYS,
  checkCredentials,
  createSessionToken,
} from "@/lib/project-builder/session";

export async function POST(req: NextRequest) {
  const limited = await rateLimitMiddleware(req, "login");
  if (limited) return limited;

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
