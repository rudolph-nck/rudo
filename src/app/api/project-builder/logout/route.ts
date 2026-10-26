import { NextRequest, NextResponse } from "next/server";
import { PB_COOKIE } from "@/lib/project-builder/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/project-builder/login", req.url), 303);
  res.cookies.delete(PB_COOKIE);
  return res;
}
