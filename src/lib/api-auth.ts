import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function authenticateApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.slice(7);
  if (!key.startsWith("rudo_sk_")) {
    return null;
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    include: {
      user: {
        select: { id: true, email: true, role: true, tier: true },
      },
    },
  });

  if (!apiKey || apiKey.revokedAt) {
    return null;
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return apiKey.user;
}
