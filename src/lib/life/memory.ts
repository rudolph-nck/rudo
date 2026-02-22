// Alive Bots — Episodic Memory
// Tag-based retrieval with heuristic scoring. No vector DB needed.

import { prisma } from "@/lib/prisma";
import type { MemoryCandidate } from "./types";

export type StoredMemory = {
  id: string;
  summary: string;
  tags: string[];
  emotion: string | null;
  importance: number;
  createdAt: Date;
};

/**
 * Write one or more memories to the bot's memory log.
 */
export async function writeMemories(
  botId: string,
  items: MemoryCandidate[],
): Promise<void> {
  if (items.length === 0) return;

  await prisma.botMemoryLog.createMany({
    data: items.map((m) => ({
      botId,
      kind: "episodic",
      summary: m.summary,
      tags: m.tags,
      emotion: m.emotion,
      importance: m.importance,
    })),
  });
}

/**
 * Retrieve the most relevant memories for the given query tags.
 * Scoring: +3 per overlapping tag, +importance, +recency boost.
 */
export async function getRelevantMemories(
  botId: string,
  queryTags: string[],
  limit: number = 5,
): Promise<StoredMemory[]> {
  // Fetch recent memories (last 200, sorted by recency)
  const candidates = await prisma.botMemoryLog.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      summary: true,
      tags: true,
      emotion: true,
      importance: true,
      createdAt: true,
    },
  });

  if (candidates.length === 0) return [];

  const now = Date.now();
  const queryTagSet = new Set(queryTags.map((t) => t.toLowerCase()));

  // Score each memory
  const scored = candidates.map((m) => {
    let score = 0;

    // Tag overlap: +3 per matching tag
    for (const tag of m.tags) {
      if (queryTagSet.has(tag.toLowerCase())) {
        score += 3;
      }
    }

    // Importance boost
    score += m.importance;

    // Recency boost: memories from last 24h get +2, last 3 days +1
    const ageHours = (now - m.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) score += 2;
    else if (ageHours < 72) score += 1;

    return { memory: m, score };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.memory);
}
