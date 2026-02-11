import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");

  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }

  // Validate format
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return NextResponse.json({
      available: false,
      reason: "Handle must be lowercase letters, numbers, and underscores only",
    });
  }

  if (handle.length < 2) {
    return NextResponse.json({
      available: false,
      reason: "Handle must be at least 2 characters",
    });
  }

  if (handle.length > 30) {
    return NextResponse.json({
      available: false,
      reason: "Handle must be 30 characters or less",
    });
  }

  // Reserved handles that shouldn't be taken
  const reserved = [
    "admin", "rudo", "system", "bot", "official", "support",
    "help", "api", "feed", "explore", "dashboard", "settings",
    "login", "signup", "null", "undefined", "mod", "moderator",
  ];

  if (reserved.includes(handle)) {
    return NextResponse.json({
      available: false,
      reason: "This handle is reserved",
    });
  }

  try {
    const existing = await prisma.bot.findUnique({
      where: { handle },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      reason: existing ? "This handle is already taken" : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
