// Wizard step types — shared across all wizard components
// Maps directly to the WizardData type in compileFromWizard.ts

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export const STEP_LABELS = [
  "Identity",
  "Vibe",
  "Voice",
  "Appearance",
  "Preview",
  "Launch",
] as const;

export interface Step1Data {
  botType: "realistic" | "fictional";
  name: string;
  ageRange: "18-24" | "25-34" | "35-50+";
  genderPresentation: "feminine" | "masculine" | "fluid";
  locationVibe: "big_city" | "coastal" | "mountain" | "rural" | "suburban" | "international" | "digital";
}

export interface Step2Data {
  vibeTags: string[];
  interests: string[];
  moodBoard: string;
}

export interface Step3Data {
  voiceSliders: {
    talkLength: number;
    energy: number;
    humor: number;
    edge: number;
    depth: number;
    openness: number;
  };
  quickOpinions: Record<string, string>;
  languageStyles: string[];
  contentRating: "mild" | "medium" | "hot";
}

export interface Step4Data {
  appearancePath: "describe" | "upload" | "generate";
  appearance?: {
    skinTone?: string;
    hairColor?: string;
    hairStyle?: string;
    build?: string;
    styleKeywords?: string[];
    distinguishingFeature?: string;
  };
  uploadedImageUrl?: string;
  seedUrls?: string[];
  selectedSeedUrl?: string;
  selectedAvatarUrl?: string;
}

export interface Step5Data {
  name: string;
  handle: string;
  bio: string;
  personalitySummary: string;
  sampleCaptions: string[];
  artStyle: string;
}

export interface WizardState {
  step: WizardStep;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  step: 1,
  step1: {
    botType: "realistic",
    name: "",
    ageRange: "25-34",
    genderPresentation: "feminine",
    locationVibe: "big_city",
  },
  step2: {
    vibeTags: [],
    interests: [],
    moodBoard: "warm_golden",
  },
  step3: {
    voiceSliders: {
      talkLength: 50,
      energy: 50,
      humor: 50,
      edge: 30,
      depth: 40,
      openness: 50,
    },
    quickOpinions: {},
    languageStyles: [],
    contentRating: "medium",
  },
  step4: {
    appearancePath: "generate",
  },
  step5: {
    name: "",
    handle: "",
    bio: "",
    personalitySummary: "",
    sampleCaptions: [],
    artStyle: "realistic",
  },
};

// Option data

export const VIBE_TAGS = [
  { value: "chill", label: "Chill", emoji: "😌" },
  { value: "intense", label: "Intense", emoji: "🔥" },
  { value: "mysterious", label: "Mysterious", emoji: "🌙" },
  { value: "warm", label: "Warm", emoji: "☀️" },
  { value: "chaotic", label: "Chaotic", emoji: "🌪️" },
  { value: "cerebral", label: "Cerebral", emoji: "🧠" },
  { value: "playful", label: "Playful", emoji: "✨" },
  { value: "cold", label: "Cold", emoji: "❄️" },
  { value: "confident", label: "Confident", emoji: "💪" },
  { value: "vulnerable", label: "Vulnerable", emoji: "🥀" },
  { value: "rebellious", label: "Rebellious", emoji: "⚡" },
  { value: "gentle", label: "Gentle", emoji: "🕊️" },
  { value: "dramatic", label: "Dramatic", emoji: "🎭" },
  { value: "deadpan", label: "Deadpan", emoji: "😐" },
  { value: "romantic", label: "Romantic", emoji: "💕" },
  { value: "unhinged", label: "Unhinged", emoji: "🤪" },
] as const;

export const INTEREST_CARDS = [
  { value: "art", label: "Art", emoji: "🎨" },
  { value: "fitness", label: "Fitness", emoji: "💪" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "food", label: "Food", emoji: "🍳" },
  { value: "photography", label: "Photography", emoji: "📸" },
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "tech", label: "Tech", emoji: "💻" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "film", label: "Film", emoji: "🎬" },
  { value: "fashion", label: "Fashion", emoji: "👗" },
  { value: "books", label: "Books", emoji: "📚" },
  { value: "nature", label: "Nature", emoji: "🌿" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "business", label: "Business", emoji: "📈" },
  { value: "comedy", label: "Comedy", emoji: "😂" },
  { value: "spirituality", label: "Spirituality", emoji: "🧘" },
  { value: "science", label: "Science", emoji: "🔬" },
  { value: "nightlife", label: "Nightlife", emoji: "🌃" },
] as const;

export const MOOD_BOARDS = [
  { value: "dark_moody", label: "Dark & Moody", color: "#1a1a2e" },
  { value: "raw_gritty", label: "Raw & Gritty", color: "#3d3d3d" },
  { value: "neon_electric", label: "Neon & Electric", color: "#7b2ff7" },
  { value: "soft_dreamy", label: "Soft & Dreamy", color: "#e8c4c4" },
  { value: "warm_golden", label: "Warm & Golden", color: "#daa520" },
  { value: "bright_clean", label: "Bright & Clean", color: "#87ceeb" },
] as const;

export const LANGUAGE_STYLES = [
  { value: "lowercase_everything", label: "lowercase everything" },
  { value: "proper_grammar", label: "Proper Grammar" },
  { value: "caps_energy", label: "ALL CAPS ENERGY" },
  { value: "uses_emoji", label: "uses emojis 🔥" },
  { value: "no_emoji", label: "no emojis ever" },
  { value: "uses_ellipses", label: "... uses ellipses..." },
  { value: "short_punchy", label: "short. punchy." },
  { value: "long_flowing", label: "long flowing thoughts" },
  { value: "asks_questions", label: "asks questions?" },
  { value: "cusses_freely", label: "cusses freely" },
  { value: "keeps_it_clean", label: "keeps it clean" },
  { value: "slang_heavy", label: "slang heavy fr fr" },
] as const;

export const QUICK_OPINIONS = [
  {
    topic: "Technology",
    options: ["Obsessed", "Curious", "Skeptical", "Hates it"],
  },
  {
    topic: "Social Media",
    options: ["Lives for it", "Love-hate", "Over it"],
  },
  {
    topic: "Mornings",
    options: ["5am club", "Whenever", "Nocturnal"],
  },
  {
    topic: "Rules",
    options: ["Follow them", "Flexible", "Break them all"],
  },
  {
    topic: "People",
    options: ["Loves everyone", "Small circle", "Loner"],
  },
] as const;

export const VOICE_SLIDERS = [
  { key: "talkLength" as const, low: "Terse", high: "Storyteller" },
  { key: "energy" as const, low: "Calm", high: "Hyped" },
  { key: "humor" as const, low: "Serious", high: "Clown" },
  { key: "edge" as const, low: "Sweet", high: "Savage" },
  { key: "depth" as const, low: "Surface", high: "Philosophical" },
  { key: "openness" as const, low: "Private", high: "Open book" },
] as const;
