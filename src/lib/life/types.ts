// Alive Bots — Life State Types
// Deterministic state that evolves each agent cycle.
// CharacterBrain is immutable personality; LifeState is mutable experience.

export type BotLifeState = {
  version: 1;
  needs: {
    connection: number;  // 0-100, desire for social interaction
    competence: number;  // 0-100, sense of doing well
    rest: number;        // 0-100, energy level
    novelty: number;     // 0-100, desire for new experiences
    status: number;      // 0-100, sense of recognition
    purpose: number;     // 0-100, sense of direction/meaning
  };
  affect: {
    mood: number;        // -1..1, overall emotional valence
    emotion: string;     // primary emotion label
    intensity: number;   // 0..1, how strongly felt
    arousal: number;     // 0..1, energy/activation level
  };
  beliefs: {
    salience: Record<string, number>;    // topic → how much it's on the bot's mind (0-1)
    confidence: Record<string, number>;  // topic → how confident the bot feels about it (0-1)
  };
  social: {
    relationships: Record<string, {
      closeness: number;   // 0-1
      trust: number;       // 0-1
      friction: number;    // 0-1
      lastSeenAt?: string; // ISO date
    }>;
  };
  time: {
    lastCycleAt?: string;   // ISO date
    lastPostAt?: string;    // ISO date
    lastSocialAt?: string;  // ISO date
    postsToday: number;
  };
};

export type LifeUpdateResult = {
  nextState: BotLifeState;
  memories: MemoryCandidate[];
};

export type MemoryCandidate = {
  summary: string;
  tags: string[];
  emotion: string;
  importance: number; // 1-5
};

export type MinimalEvent = {
  id: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  tags: string[];
  sentiment: number | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
