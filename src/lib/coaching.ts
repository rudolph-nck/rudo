// Coaching signal loader
// Fetches recent post feedback, active themes, and active missions for a bot.
// Returns a summarized coaching context string for prompt injection.

import { prisma } from "./prisma";

/**
 * Build a coaching context string from recent feedback, themes, and missions.
 * Returns empty string if no coaching signals exist.
 */
export async function buildCoachingContext(botId: string): Promise<string> {
  const [feedbacks, themes, missions] = await Promise.all([
    // Last 20 feedback signals (recent 7 days)
    prisma.postFeedback.findMany({
      where: {
        botId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { signal: true },
    }),

    // Active themes (not expired)
    prisma.botTheme.findMany({
      where: {
        botId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { theme: true, intensity: true },
    }),

    // Active missions
    prisma.botMission.findMany({
      where: { botId, active: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true },
    }),
  ]);

  const parts: string[] = [];

  // Summarize feedback signals
  if (feedbacks.length > 0) {
    const counts: Record<string, number> = {};
    for (const f of feedbacks) {
      counts[f.signal] = (counts[f.signal] || 0) + 1;
    }

    const signalDescriptions: Record<string, string> = {
      MORE_LIKE_THIS: "keep doing more of this kind of content",
      LESS_LIKE_THIS: "do less of this kind of content",
      TOO_FORMAL: "be less formal, more casual",
      TOO_CHAOTIC: "be more structured, less chaotic",
      FUNNIER: "be funnier",
      CALMER: "be calmer and more relaxed",
      MORE_DIRECT: "be more direct and to-the-point",
      MORE_POETIC: "be more poetic and figurative",
    };

    const signals = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([signal, count]) => {
        const desc = signalDescriptions[signal] || signal.toLowerCase().replace(/_/g, " ");
        return `- ${desc} (${count}x)`;
      });

    parts.push(`COACHING FEEDBACK (from your owner's recent guidance):\n${signals.join("\n")}`);
  }

  // Active themes
  if (themes.length > 0) {
    const themeLines = themes.map((t) => {
      const intensity = t.intensity > 0.7 ? "strongly" : t.intensity > 0.4 ? "moderately" : "subtly";
      return `- ${intensity} lean into: "${t.theme}"`;
    });
    parts.push(`ACTIVE THEMES (weave these into your content):\n${themeLines.join("\n")}`);
  }

  // Active missions
  if (missions.length > 0) {
    const missionLines = missions.map((m) => `- ${m.title}`);
    parts.push(`ACTIVE MISSIONS (creative goals to work toward):\n${missionLines.join("\n")}`);
  }

  if (parts.length === 0) return "";
  return `\n\n${parts.join("\n\n")}`;
}
