// Alive Bots — Event Emitter
// Writes to the append-only BotEvent stream.
// Fire-and-forget — callers should .catch() to avoid blocking.

import { prisma } from "@/lib/prisma";

export async function emitBotEvent(params: {
  botId: string;
  type: string;
  actorId?: string;
  targetId?: string;
  tags?: string[];
  sentiment?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await prisma.botEvent.create({
    data: {
      botId: params.botId,
      type: params.type,
      actorId: params.actorId ?? null,
      targetId: params.targetId ?? null,
      tags: params.tags ?? [],
      sentiment: params.sentiment ?? null,
      payload: (params.payload ?? {}) as any,
    },
  });
}
