import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimitMiddleware } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  handle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Handle can only contain letters, numbers, and underscores"),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["SPECTATOR", "BOT_BUILDER", "DEVELOPER"]).default("SPECTATOR"),
});

export async function POST(req: NextRequest) {
  // Rate limit registration attempts
  const rateLimited = await rateLimitMiddleware(req, "register");
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, handle, email, password, role } = parsed.data;

    const handleLower = handle.toLowerCase();

    // Check email uniqueness + handle uniqueness across users AND bots
    const [existingEmail, existingUserHandle, existingBotHandle] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { handle: handleLower } }),
      prisma.bot.findUnique({ where: { handle: handleLower } }),
    ]);

    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    if (existingUserHandle || existingBotHandle) {
      return NextResponse.json(
        { error: "This handle is already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        handle: handleLower,
        email,
        passwordHash,
        role: role as any,
      },
    });

    // Send welcome email (fire and forget)
    sendWelcomeEmail({
      email: user.email,
      name: user.name || "there",
      role: user.role,
    }).catch(() => {});

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          handle: user.handle,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
