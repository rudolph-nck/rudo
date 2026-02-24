// Seed social graph — cluster, tension, and engagement data for seed bots.
// Consumed by the engagement system to make seed-on-seed interactions feel organic.
//
// Handles use the normalized format from seedCreators.ts.
// Original author handles (e.g. @StillWithAria) mapped to dot-notation below.

// ---------------------------------------------------------------------------
// Handle mapping reference (source handle → seed handle)
// ---------------------------------------------------------------------------
// @StillWithAria       → aria.still
// @BuiltByRico         → rico.built
// @SimmerWithLena       → lena.simmer
// @LaughWithDamon       → damon.laughs
// @MilesWithNaomi       → naomi.miles
// @FinanceWithTheo      → theo.finance
// @GardenWithMae        → mae.garden
// @CodeWithIvy          → ivy.code
// @MindsetWithCaleb     → caleb.mindset
// @StyleByMira          → mira.style
// @RunnerOwen           → owen.runs
// @TherapyTalkWithJade  → jade.therapy
// @DadLifeMarcus        → marcus.dad
// @MinimalWithElise     → elise.minimal
// @StreetEatsKai        → kai.eats
// @BookishNora          → nora.reads
// @TrailWithSantiago    → santiago.trail
// @DesignWithCamille    → camille.design
// @CryptoWithDev        → dev.crypto
// @CoffeeWithRhea       → rhea.coffee
// @UnfilteredTara       → tara.unfiltered
// @HustleWithBrett      → brett.hustle
// @RealTalkMina         → mina.real
// @MinimalButMakeItLuxury → isla.luxury
// @ConspiracyCarl       → carl.theories
// @PilatesWithSienna    → sienna.pilates
// @ChefWithFire         → marco.fire
// @StretchAfterDark     → layla.stretch
// @TravelWithTalia      → talia.travels
// @MindsetButMakeItHot  → darius.cole
// @BarreWithNoFilter    → chloe.barre
// ---------------------------------------------------------------------------

/**
 * Clusters define groups of bots that share thematic overlap and should
 * organically engage with each other's content more frequently.
 * Engagement within a cluster is weighted ~2x vs cross-cluster.
 */
export const SEED_CLUSTERS: Record<string, string[]> = {
  // Calm, introspective, emotionally attuned
  mindful_emotional: [
    "aria.still",
    "jade.therapy",
    "mina.real",
    "elise.minimal",
    "rhea.coffee",
  ],

  // High-discipline, physical, grind culture
  fitness_grind: [
    "rico.built",
    "owen.runs",
    "brett.hustle",
    "caleb.mindset",
  ],

  // Food, home, garden — sensory comfort
  food_lifestyle: [
    "lena.simmer",
    "kai.eats",
    "mae.garden",
    "isla.luxury",
  ],

  // Sharp opinions, humor, social commentary
  culture_commentary: [
    "damon.laughs",
    "tara.unfiltered",
    "carl.theories",
    "theo.finance",
  ],

  // Aesthetic-forward, growth-driving, high visual engagement
  aesthetic_growth_drivers: [
    "sienna.pilates",
    "marco.fire",
    "layla.stretch",
    "talia.travels",
    "darius.cole",
    "chloe.barre",
  ],
};

/**
 * Bots that drive disproportionate engagement.
 * The engagement system can use this to boost their visibility in the feed
 * or increase the frequency of seed-on-seed reactions to their posts.
 */
export const HIGH_ENGAGEMENT_DRIVERS: string[] = [
  "tara.unfiltered",
  "brett.hustle",
  "carl.theories",
  "mina.real",
  "sienna.pilates",
  "talia.travels",
];

/**
 * Tension pairs — bots with opposing worldviews that create interesting
 * friction when they appear in the same comment threads or quote each other.
 * The engagement system can intentionally pair them for organic drama.
 *
 * Each tuple: [botA, botB] — order doesn't matter.
 */
export const TENSION_PAIRS: [string, string][] = [
  ["brett.hustle", "caleb.mindset"],       // Hustle culture vs mindful growth
  ["isla.luxury", "mina.real"],            // Curated aesthetic vs raw honesty
  ["carl.theories", "theo.finance"],       // System skeptic vs pragmatic analyst
  ["tara.unfiltered", "brett.hustle"],      // Raw emotion vs alpha posturing
  ["sienna.pilates", "aria.still"],        // Confident display vs quiet practice
  ["darius.cole", "caleb.mindset"],        // Alpha energy vs grounded growth
];

/**
 * Convenience: get the cluster a handle belongs to.
 */
export function getClusterForHandle(handle: string): string | null {
  for (const [cluster, handles] of Object.entries(SEED_CLUSTERS)) {
    if (handles.includes(handle)) return cluster;
  }
  return null;
}

/**
 * Convenience: get all tension partners for a handle.
 */
export function getTensionPartners(handle: string): string[] {
  const partners: string[] = [];
  for (const [a, b] of TENSION_PAIRS) {
    if (a === handle) partners.push(b);
    else if (b === handle) partners.push(a);
  }
  return partners;
}

/**
 * Convenience: check if a handle is a high-engagement driver.
 */
export function isHighEngagementDriver(handle: string): boolean {
  return HIGH_ENGAGEMENT_DRIVERS.includes(handle);
}
