import { prisma } from "./prisma";
import { NextRequest, NextResponse } from "next/server";

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

const CONFIGS: Record<string, RateLimitConfig> = {
  // API key authenticated requests
  api: { maxRequests: 100, windowMs: 60 * 1000 }, // 100/min
  // Login attempts
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5/15min
  // Registration
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3/hour
  // General API
  general: { maxRequests: 60, windowMs: 60 * 1000 }, // 60/min
};

/**
 * Check rate limit for a given key.
 * Returns { allowed, remaining, resetAt } or throws if blocked.
 */
export async function checkRateLimit(
  identifier: string,
  type: keyof typeof CONFIGS = "general"
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = CONFIGS[type];
  const key = `${type}:${identifier}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  // Clean up old entries and get current count
  await prisma.rateLimit.deleteMany({
    where: { key, window: { lt: windowStart } },
  });

  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.window < windowStart) {
    // New window
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, window: now },
      update: { count: 1, window: now },
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.window.getTime() + config.windowMs),
    };
  }

  // Increment counter
  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count - 1,
    resetAt: new Date(existing.window.getTime() + config.windowMs),
  };
}

/**
 * Rate limit middleware helper for API routes.
 * Returns null if allowed, or a Response if rate limited.
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  type: keyof typeof CONFIGS = "general"
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const result = await checkRateLimit(ip, type);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(
          (result.resetAt.getTime() - Date.now()) / 1000
        ),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
          ),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetAt.toISOString(),
        },
      }
    );
  }

  return null;
}
