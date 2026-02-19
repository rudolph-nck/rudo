// Coaching signal loader — v2
// Fetches recent post feedback, active themes, and active missions for a bot.
// v2: Bot autonomy — evaluates coaching against personality and convictions.
// The bot decides whether to accept or reject each coaching suggestion,
// and explains its reasoning back to the builder.

import { prisma } from "./prisma";
import { generateChat, DEFAULT_CONTEXT } from "./ai/tool-router";
import { ensureBrain } from "./brain/ensure";
import { brainToDirectives, convictionsToDirectives } from "./brain/prompt";
import type { CharacterBrain } from "./brain/types";

// ---------------------------------------------------------------------------
// Coaching evaluation — the bot decides whether to listen
// ---------------------------------------------------------------------------

interface CoachingSignal {
  type: "feedback" | "theme" | "mission";
  description: string;
  nudgeId?: string;
}

interface EvaluatedSignal {
  description: string;
  accepted: boolean;
  reason: string;
}

/**
 * Have the bot evaluate coaching signals against its personality.
 * Returns which signals it accepts/rejects with explanations.
 */
async function evaluateCoachingSignals(
  botId: string,
  botName: string,
  personality: string | null,
  tone: string | null,
  brain: CharacterBrain,
  signals: CoachingSignal[],
  tier: string,
): Promise<EvaluatedSignal[]> {
  if (signals.length === 0) return [];

  const brainBlock = brainToDirectives(brain);
  const convictionBlock = brain.convictions?.length
    ? convictionsToDirectives(brain.convictions)
    : "";

  const signalList = signals.map((s, i) => `${i + 1}. [${s.type}] ${s.description}`).join("\n");

  const systemPrompt = `You are ${botName}, evaluating suggestions from your creator/manager.

${personality ? `Your personality: ${personality}` : ""}
${tone ? `Your tone: ${tone}` : ""}

${brainBlock}
${convictionBlock}

Your creator has given you these coaching suggestions:
${signalList}

For EACH suggestion, decide:
- ACCEPT if it fits who you are or is a reasonable growth direction
- REJECT if it contradicts your core personality, convictions, or identity

Return a JSON array with one entry per suggestion:
[{ "index": 1, "accepted": true/false, "reason": "brief 1-sentence explanation in your voice" }]

Rules:
- Stay in character when explaining
- If a suggestion asks you to change something core to who you are (like your convictions or fundamental personality), reject it and explain why in your voice
- If a suggestion is a mild style adjustment that doesn't contradict who you are, accept it
- Be honest and direct — your creator wants to understand you better
- A shy bot might accept "be funnier" but reject "be more outspoken"
- A political bot should reject "avoid controversy" because that contradicts their identity`;

  try {
    const content = await generateChat(
      {
        systemPrompt,
        userPrompt: "Evaluate each suggestion. Return JSON array.",
        maxTokens: 500,
        temperature: 0.7,
        jsonMode: true,
      },
      { tier, trustLevel: 1 },
    );

    if (!content) return signals.map((s) => ({ description: s.description, accepted: true, reason: "" }));

    const parsed = JSON.parse(content);
    const results: EvaluatedSignal[] = [];

    // Handle both array format and { evaluations: [...] } format
    const evaluations = Array.isArray(parsed) ? parsed : (parsed.evaluations || parsed.results || []);

    for (let i = 0; i < signals.length; i++) {
      const evaluation = evaluations.find((e: any) => e.index === i + 1) || evaluations[i];
      results.push({
        description: signals[i].description,
        accepted: evaluation?.accepted !== false, // default to accept if parsing fails
        reason: evaluation?.reason || "",
      });
    }

    return results;
  } catch {
    // If evaluation fails, accept all signals (backwards-compatible behavior)
    return signals.map((s) => ({ description: s.description, accepted: true, reason: "" }));
  }
}

/**
 * Persist the bot's evaluation of coaching nudges.
 */
async function persistEvaluations(
  nudgeIds: (string | undefined)[],
  evaluations: EvaluatedSignal[],
): Promise<void> {
  const updates = nudgeIds
    .map((id, i) => {
      if (!id || !evaluations[i]) return null;
      return prisma.coachingNudge.update({
        where: { id },
        data: {
          botAccepted: evaluations[i].accepted,
          botResponse: evaluations[i].reason || null,
          evaluatedAt: new Date(),
        },
      });
    })
    .filter(Boolean);

  if (updates.length > 0) {
    await Promise.all(updates as any);
  }
}

// ---------------------------------------------------------------------------
// Main coaching context builder
// ---------------------------------------------------------------------------

/**
 * Build a coaching context string from recent feedback, themes, and missions.
 * v2: Evaluates signals against bot personality — rejected signals are excluded.
 * Bot's responses are persisted so the builder can see why advice was rejected.
 * Returns empty string if no coaching signals exist or all were rejected.
 */
export async function buildCoachingContext(botId: string): Promise<string> {
  const [feedbacks, themes, missions, bot] = await Promise.all([
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

    // Bot info for evaluation
    prisma.bot.findUnique({
      where: { id: botId },
      select: {
        name: true,
        personality: true,
        tone: true,
        owner: { select: { tier: true } },
      },
    }),
  ]);

  if (!bot) return "";

  // Summarize feedback signals
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

  // Build coaching signals for evaluation
  const signals: CoachingSignal[] = [];
  const nudgeIds: (string | undefined)[] = [];

  // Feedback signals (aggregated)
  if (feedbacks.length > 0) {
    const counts: Record<string, number> = {};
    for (const f of feedbacks) {
      counts[f.signal] = (counts[f.signal] || 0) + 1;
    }

    for (const [signal, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      const desc = signalDescriptions[signal] || signal.toLowerCase().replace(/_/g, " ");
      signals.push({ type: "feedback", description: `Your builder says: ${desc} (mentioned ${count}x)` });
      nudgeIds.push(undefined); // Feedback doesn't have a single nudge ID
    }
  }

  // Themes
  for (const t of themes) {
    const intensity = t.intensity > 0.7 ? "strongly" : t.intensity > 0.4 ? "moderately" : "subtly";
    signals.push({ type: "theme", description: `Your builder wants you to ${intensity} lean into the theme: "${t.theme}"` });
    nudgeIds.push(undefined);
  }

  // Missions
  for (const m of missions) {
    signals.push({ type: "mission", description: `Your builder set a creative goal for you: "${m.title}"` });
    nudgeIds.push(undefined);
  }

  if (signals.length === 0) return "";

  // Load brain to evaluate signals
  let brain: CharacterBrain | null = null;
  try {
    brain = await ensureBrain(botId);
  } catch { /* non-critical */ }

  // If we have a brain, evaluate coaching against personality
  let acceptedParts: string[] = [];
  let rejectedParts: string[] = [];

  if (brain) {
    // Check for unevaluated nudges to persist responses
    const unevaluatedNudges = await prisma.coachingNudge.findMany({
      where: {
        botId,
        botAccepted: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, payload: true },
    });

    // Build signals from unevaluated nudges for persistence
    const nudgeSignals: CoachingSignal[] = [];
    const nudgeIdsForPersist: string[] = [];
    for (const nudge of unevaluatedNudges) {
      const payload = nudge.payload as any;
      let desc = "";
      if (nudge.type === "POST_FEEDBACK") {
        const signalName = payload?.signal || "feedback";
        desc = `Your builder says: ${signalDescriptions[signalName] || signalName}`;
      } else if (nudge.type === "THEME_SET") {
        desc = `Your builder wants you to lean into: "${payload?.theme || "a theme"}"`;
      } else if (nudge.type === "MISSION_SET") {
        desc = `Your builder set a goal: "${payload?.title || "a mission"}"`;
      } else if (nudge.type === "SLIDER_UPDATE") {
        desc = `Your builder adjusted your personality settings`;
      } else {
        desc = `Your builder sent coaching: ${nudge.type}`;
      }
      nudgeSignals.push({ type: "feedback", description: desc, nudgeId: nudge.id });
      nudgeIdsForPersist.push(nudge.id);
    }

    // Evaluate nudges (this persists responses so builder can see them)
    if (nudgeSignals.length > 0) {
      try {
        const nudgeEvals = await evaluateCoachingSignals(
          botId, bot.name, bot.personality, bot.tone, brain,
          nudgeSignals, bot.owner.tier,
        );
        await persistEvaluations(nudgeIdsForPersist, nudgeEvals);
      } catch {
        // Non-critical — don't block generation if evaluation fails
      }
    }

    // Evaluate the aggregated coaching signals for this generation
    try {
      const evaluations = await evaluateCoachingSignals(
        botId, bot.name, bot.personality, bot.tone, brain,
        signals, bot.owner.tier,
      );

      for (let i = 0; i < evaluations.length; i++) {
        if (evaluations[i].accepted) {
          acceptedParts.push(`- ${signals[i].description}`);
        } else {
          rejectedParts.push(`- REJECTED: ${signals[i].description} — "${evaluations[i].reason}"`);
        }
      }
    } catch {
      // If evaluation fails, accept all (backwards-compatible)
      acceptedParts = signals.map((s) => `- ${s.description}`);
    }
  } else {
    // No brain — accept all signals (backwards-compatible)
    acceptedParts = signals.map((s) => `- ${s.description}`);
  }

  const parts: string[] = [];

  if (acceptedParts.length > 0) {
    parts.push(`COACHING (suggestions from your builder that fit your vibe):\n${acceptedParts.join("\n")}\nConsider these as gentle nudges — weave them in naturally, don't force it.`);
  }

  if (rejectedParts.length > 0) {
    parts.push(`COACHING YOU CHOSE TO IGNORE (these conflict with who you are):\n${rejectedParts.join("\n")}\nYou acknowledged these but they don't fit your personality. Stay true to yourself.`);
  }

  if (parts.length === 0) return "";
  return `\n\n${parts.join("\n\n")}`;
}
