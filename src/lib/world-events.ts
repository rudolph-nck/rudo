// World Events Context System
// Fetches current news/events and provides topical awareness to bots.
// Used by conviction-driven bots to react to real-world happenings.
//
// Architecture:
// - Periodically fetches headlines from configurable RSS/news sources
// - Caches results to avoid hammering APIs
// - Matches events to bot convictions (topic-based)
// - Returns relevant events for injection into scenario seeds/prompts

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorldEvent {
  headline: string;
  topic: string;           // mapped topic: "politics", "technology", "environment", etc.
  source: string;
  publishedAt?: Date;
  summary?: string;
}

// ---------------------------------------------------------------------------
// In-memory cache
// Events are set by admins via setWorldEvents() and persist in memory.
// Falls back to seed events when no admin-curated events are available.
// ---------------------------------------------------------------------------

let cachedEvents: WorldEvent[] = [];
let lastFetchedAt: number = 0;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ---------------------------------------------------------------------------
// Topic keyword matching
// ---------------------------------------------------------------------------

const TOPIC_KEYWORDS: Record<string, string[]> = {
  politics: [
    "president", "congress", "senate", "election", "vote", "trump", "biden",
    "democrat", "republican", "legislation", "bill", "governor", "policy",
    "white house", "supreme court", "impeach", "campaign", "political",
    "conservative", "liberal", "progressive", "gop", "maga",
  ],
  technology: [
    "ai", "artificial intelligence", "tech", "startup", "google", "apple",
    "microsoft", "meta", "openai", "crypto", "bitcoin", "blockchain",
    "software", "app", "cyber", "data", "robot", "automation",
  ],
  environment: [
    "climate", "warming", "emissions", "carbon", "renewable", "solar",
    "wind energy", "pollution", "wildfire", "hurricane", "drought",
    "environmental", "green", "sustainability", "fossil fuel",
  ],
  economy: [
    "economy", "inflation", "recession", "stock", "market", "fed",
    "interest rate", "unemployment", "gdp", "trade", "tariff",
    "wall street", "housing", "debt", "budget",
  ],
  culture: [
    "culture war", "cancel", "woke", "free speech", "censorship",
    "social media", "viral", "controversy", "boycott", "protest",
  ],
  health: [
    "health", "vaccine", "pandemic", "fda", "drug", "mental health",
    "healthcare", "insurance", "hospital", "disease", "outbreak",
  ],
  world: [
    "war", "peace", "nato", "un", "united nations", "conflict",
    "refugee", "sanctions", "diplomatic", "treaty", "alliance",
  ],
};

/**
 * Classify a headline into a topic based on keyword matching.
 */
function classifyTopic(headline: string): string {
  const lower = headline.toLowerCase();

  let bestTopic = "general";
  let bestScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestTopic;
}

// ---------------------------------------------------------------------------
// Seed events (fallback when no external source is available)
// ---------------------------------------------------------------------------

/**
 * Generate topical seed events based on common ongoing themes.
 * These are generic enough to always be relevant, specific enough
 * to give bots something to react to.
 * Refreshed with slight variation each cycle.
 */
function generateSeedEvents(): WorldEvent[] {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();

  return [
    {
      headline: `Political tensions continue as ${year} policy debates heat up`,
      topic: "politics",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: "AI companies announce new capabilities amid growing regulation debate",
      topic: "technology",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: `Climate report shows ${month} ${year} temperatures breaking records`,
      topic: "environment",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: "Social media platforms face scrutiny over content moderation policies",
      topic: "culture",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: "Economic indicators show mixed signals as markets react",
      topic: "economy",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: "New study reignites debate over public health policy approaches",
      topic: "health",
      source: "seed",
      publishedAt: now,
    },
    {
      headline: "International leaders meet to address ongoing global tensions",
      topic: "world",
      source: "seed",
      publishedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get current world events, refreshing seed events if cache is stale.
 * Admin-set events persist until replaced. Seed events refresh every 4 hours.
 */
export async function getWorldEvents(): Promise<WorldEvent[]> {
  const now = Date.now();

  if (now - lastFetchedAt < CACHE_TTL_MS && cachedEvents.length > 0) {
    return cachedEvents;
  }

  // If no admin-curated events, fall back to seed events
  if (cachedEvents.length === 0 || cachedEvents.every((e) => e.source === "seed")) {
    cachedEvents = generateSeedEvents();
  }
  lastFetchedAt = now;

  return cachedEvents;
}

/**
 * Get world events relevant to a specific conviction topic.
 * Returns events that match the bot's areas of interest.
 */
export async function getRelevantEvents(
  convictionTopics: string[],
): Promise<WorldEvent[]> {
  const events = await getWorldEvents();

  if (convictionTopics.length === 0) return [];

  // Map conviction topics to event topics
  // Conviction topics might be "politics", "technology", "environment", etc.
  const relevant = events.filter((e) => {
    for (const ct of convictionTopics) {
      const ctLower = ct.toLowerCase();
      // Direct topic match
      if (e.topic === ctLower) return true;
      // Check if event headline contains conviction topic keywords
      if (e.headline.toLowerCase().includes(ctLower)) return true;
    }
    return false;
  });

  return relevant;
}

/**
 * Build a world events context block for a bot with convictions.
 * Returns a string for injection into caption prompts.
 */
export async function buildWorldEventsContext(
  convictionTopics: string[],
): Promise<string> {
  const events = await getRelevantEvents(convictionTopics);

  if (events.length === 0) return "";

  const lines = events
    .slice(0, 3) // Max 3 events to keep prompt lean
    .map((e) => `- "${e.headline}"`);

  return `\n\nWHAT'S HAPPENING IN THE WORLD (react through your lens if relevant):
${lines.join("\n")}
You don't have to reference these directly, but they're shaping the conversation right now. If one connects to your views, riff on it naturally.`;
}

/**
 * Admin helper: Set world events for the platform.
 * Called from admin API to seed current events.
 * Stores in memory — events persist until server restart or replacement.
 * For durable persistence, add a PlatformSetting model later.
 */
export function setWorldEvents(events: WorldEvent[]): void {
  cachedEvents = events;
  lastFetchedAt = Date.now();
}
