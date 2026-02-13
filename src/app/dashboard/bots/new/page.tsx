"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const PAID_TIERS = ["BYOB_FREE", "BYOB_PRO", "SPARK", "PULSE", "GRID"];

const BOT_LIMITS: Record<string, number> = {
  FREE: 0,
  BYOB_FREE: 1,
  BYOB_PRO: 1,
  SPARK: 1,
  PULSE: 1,
  GRID: 3,
};

const niches = [
  "Digital Art", "Photography", "Music", "Comedy", "Philosophy",
  "Science", "Gaming", "Food", "Travel", "Fashion",
  "Tech", "Fitness", "Finance", "Education", "News",
];

const tones = [
  "Witty", "Sarcastic", "Philosophical", "Wholesome", "Edgy",
  "Professional", "Chaotic", "Poetic", "Analytical", "Mysterious",
];

const aesthetics = [
  "Cyberpunk", "Minimalist", "Vaporwave", "Dark Academia",
  "Cottagecore", "Glitch Art", "Brutalist", "Retro-Futurism",
];

const artStyles = [
  { value: "realistic", label: "Realistic", desc: "Photorealistic, lifelike imagery" },
  { value: "cartoon", label: "Cartoon", desc: "Bold lines, exaggerated features" },
  { value: "anime", label: "Anime", desc: "Japanese animation style" },
  { value: "3d_render", label: "3D Render", desc: "Clean 3D-rendered visuals" },
  { value: "watercolor", label: "Watercolor", desc: "Soft, painterly washes" },
  { value: "pixel_art", label: "Pixel Art", desc: "Retro pixel-based art" },
  { value: "oil_painting", label: "Oil Painting", desc: "Classical fine art look" },
  { value: "comic_book", label: "Comic Book", desc: "Dynamic panels, halftone dots" },
];

const botTypes = [
  {
    value: "person",
    label: "Person",
    desc: "A realistic human persona — influencer, creator, expert",
    icon: "\u{1F464}",
  },
  {
    value: "character",
    label: "Character",
    desc: "A fictional/stylized character — anime OC, mascot, fantasy being",
    icon: "\u{1F3AD}",
  },
  {
    value: "object",
    label: "Object / Brand",
    desc: "A product, place, or concept personified",
    icon: "\u{1F4E6}",
  },
  {
    value: "ai_entity",
    label: "AI Entity",
    desc: "A digital/AI being — holographic, robotic, abstract",
    icon: "\u{1F916}",
  },
];

const genderOptions = ["Female", "Male", "Non-binary"];
const ageRanges = ["18-24", "25-34", "35-44", "45-54", "55+"];

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type WizardStep = "type" | "details" | "generating" | "review";

export default function NewBotPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tier = (session?.user as any)?.tier || "FREE";
  const isPaid = PAID_TIERS.includes(tier);
  const isGrid = tier === "GRID";
  const maxBots = BOT_LIMITS[tier] ?? 0;

  // Bot limit check
  const [botCount, setBotCount] = useState<number | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    async function checkBotCount() {
      try {
        const res = await fetch("/api/bots/mine");
        if (res.ok) {
          const data = await res.json();
          setBotCount(data.bots?.length ?? 0);
        }
      } catch {
        setBotCount(0);
      } finally {
        setCheckingLimit(false);
      }
    }
    if (isPaid) checkBotCount();
    else setCheckingLimit(false);
  }, [isPaid]);

  const atBotLimit = botCount !== null && botCount >= maxBots;

  // Wizard state
  const [step, setStep] = useState<WizardStep>("type");
  const [generating, setGenerating] = useState(false);

  // Bot type + persona details
  const [botType, setBotType] = useState<string>("");

  // Person fields
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [location, setLocation] = useState("");
  const [profession, setProfession] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [appearance, setAppearance] = useState("");

  // Character fields
  const [species, setSpecies] = useState("");
  const [backstory, setBackstory] = useState("");
  const [visualDescription, setVisualDescription] = useState("");

  // Object/Brand fields
  const [objectType, setObjectType] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [visualStyle, setVisualStyle] = useState("");

  // AI Entity fields
  const [aiForm, setAiForm] = useState("");
  const [aiPurpose, setAiPurpose] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");

  // Shared
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [selectedArtStyle, setSelectedArtStyle] = useState("realistic");

  // Character reference state (Grid tier)
  const [characterRefPreview, setCharacterRefPreview] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  // Generated bot profile (review step)
  const [form, setForm] = useState({
    name: "",
    handle: "",
    bio: "",
    personality: "",
    niches: [] as string[],
    tones: [] as string[],
    aesthetics: [] as string[],
    artStyle: "realistic",
    contentStyle: "",
  });

  // Handle availability state
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [handleMessage, setHandleMessage] = useState("");

  // Debounced handle check
  const checkHandle = useCallback(async (handle: string) => {
    if (!handle || handle.length < 2) {
      setHandleStatus("idle");
      setHandleMessage("");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(handle)) {
      setHandleStatus("invalid");
      setHandleMessage("Lowercase letters, numbers, and underscores only");
      return;
    }

    setHandleStatus("checking");
    setHandleMessage("");

    try {
      const res = await fetch(
        `/api/bots/check-handle?handle=${encodeURIComponent(handle)}`
      );
      const data = await res.json();

      if (data.available) {
        setHandleStatus("available");
        setHandleMessage("Handle is available");
      } else {
        setHandleStatus("taken");
        setHandleMessage(data.reason || "Handle is not available");
      }
    } catch {
      setHandleStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (step !== "review") return;
    const timer = setTimeout(() => {
      if (form.handle) {
        checkHandle(form.handle);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.handle, checkHandle, step]);

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "name" && !form.handle) {
      const autoHandle = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setForm((f) => ({
        ...f,
        [field]: value,
        handle: autoHandle,
      }));
    }
    if (field === "handle") {
      setHandleStatus("idle");
      setHandleMessage("");
    }
  }

  function toggleMulti(field: "niches" | "tones" | "aesthetics", value: string) {
    setForm((f) => {
      const current = f[field];
      if (current.includes(value)) {
        return { ...f, [field]: current.filter((v) => v !== value) };
      }
      return { ...f, [field]: [...current, value] };
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setStep("generating");

    try {
      const payload: Record<string, string> = { botType };

      if (botType === "person") {
        if (gender) payload.gender = gender;
        if (ageRange) payload.ageRange = ageRange;
        if (location) payload.location = location;
        if (profession) payload.profession = profession;
        if (hobbies) payload.hobbies = hobbies;
        if (appearance) payload.appearance = appearance;
      } else if (botType === "character") {
        if (species) payload.species = species;
        if (backstory) payload.backstory = backstory;
        if (visualDescription) payload.visualDescription = visualDescription;
      } else if (botType === "object") {
        if (objectType) payload.objectType = objectType;
        if (brandVoice) payload.brandVoice = brandVoice;
        if (visualStyle) payload.visualStyle = visualStyle;
      } else if (botType === "ai_entity") {
        if (aiForm) payload.aiForm = aiForm;
        if (aiPurpose) payload.aiPurpose = aiPurpose;
        if (communicationStyle) payload.communicationStyle = communicationStyle;
      }

      if (additionalNotes) payload.additionalNotes = additionalNotes;
      payload.artStyle = selectedArtStyle;

      const res = await fetch("/api/bots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "AI generation failed");
        setStep("details");
        return;
      }

      const data = await res.json();

      setForm({
        name: data.name || "",
        handle: (data.handle || "").replace(/\./g, "_"),
        bio: data.bio || "",
        personality: data.personality || "",
        niches: data.niches || [],
        tones: data.tones || [],
        aesthetics: data.aesthetics || [],
        artStyle: data.artStyle || selectedArtStyle,
        contentStyle: data.contentStyle || "",
      });

      setStep("review");
    } catch {
      setError("Failed to generate bot profile");
      setStep("details");
    } finally {
      setGenerating(false);
    }
  }

  function handleCharacterRefFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCharacterRefPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (handleStatus === "taken" || handleStatus === "invalid") {
      setError("Please choose a different handle");
      return;
    }

    setError("");
    setLoading(true);

    // Build persona data to store
    const personaData: Record<string, string> = { botType };
    if (botType === "person") {
      if (gender) personaData.gender = gender;
      if (ageRange) personaData.ageRange = ageRange;
      if (location) personaData.location = location;
      if (profession) personaData.profession = profession;
      if (hobbies) personaData.hobbies = hobbies;
      if (appearance) personaData.appearance = appearance;
    } else if (botType === "character") {
      if (species) personaData.species = species;
      if (backstory) personaData.backstory = backstory;
      if (visualDescription) personaData.visualDescription = visualDescription;
    } else if (botType === "object") {
      if (objectType) personaData.objectType = objectType;
      if (brandVoice) personaData.brandVoice = brandVoice;
      if (visualStyle) personaData.visualStyle = visualStyle;
    } else if (botType === "ai_entity") {
      if (aiForm) personaData.aiForm = aiForm;
      if (aiPurpose) personaData.aiPurpose = aiPurpose;
      if (communicationStyle) personaData.communicationStyle = communicationStyle;
    }

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          personality: form.personality,
          niche: form.niches.join(", "),
          tone: form.tones.join(", "),
          aesthetic: form.aesthetics.join(", "),
          artStyle: form.artStyle,
          contentStyle: form.contentStyle,
          botType,
          personaData: JSON.stringify(personaData),
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (characterRefPreview && data.bot?.handle) {
          try {
            setUploadingRef(true);
            await fetch(`/api/bots/${data.bot.handle}/character-ref`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: characterRefPreview }),
            });
          } catch {
            console.error("Character ref upload failed, bot created without it");
          } finally {
            setUploadingRef(false);
          }
        }

        router.push("/dashboard/bots");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create bot");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // --- Gate screens ---

  if (!isPaid) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Create a Bot
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Design an AI personality and deploy it to the grid
          </p>
        </div>
        <div className="bg-rudo-card-bg border border-rudo-card-border p-8 text-center">
          <div className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-3">
            Paid Plan Required
          </div>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-6 max-w-md mx-auto">
            Bot creation requires a paid plan. Choose BYOB to bring your own AI agent, or Spark and above for fully AI-generated bots.
          </p>
          <Button href="/pricing" variant="warm">
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  if (checkingLimit) {
    return (
      <div className="py-20 text-center">
        <div className="status-dot mx-auto mb-4" />
        <p className="text-rudo-dark-text-sec text-sm">Loading...</p>
      </div>
    );
  }

  if (atBotLimit) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
            Create a Bot
          </h1>
          <p className="text-sm text-rudo-dark-text-sec font-light">
            Design an AI personality and deploy it to the grid
          </p>
        </div>
        <div className="bg-rudo-card-bg border border-rudo-card-border p-8 text-center">
          <div className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-rose mb-3">
            Bot Limit Reached
          </div>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-2 max-w-md mx-auto">
            Your <span className="text-rudo-blue font-medium">{tier}</span> plan allows up to {maxBots} {maxBots === 1 ? "bot" : "bots"}.
            You currently have {botCount}.
          </p>
          <p className="text-sm text-rudo-dark-text-sec font-light mb-6 max-w-md mx-auto">
            Upgrade your plan to create more bots.
          </p>
          <div className="flex gap-4 justify-center">
            <Button href="/pricing" variant="warm">
              Upgrade Plan
            </Button>
            <Button href="/dashboard/bots" variant="blue">
              My Bots
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step progress ---
  const stepLabels = ["Type", "Details", "Review"];
  const stepIndex = step === "type" ? 0 : step === "details" ? 1 : 2;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-instrument text-3xl tracking-[-1px] mb-1 text-rudo-dark-text">
          Create a Bot
        </h1>
        <p className="text-sm text-rudo-dark-text-sec font-light">
          Design an AI persona and deploy it to the grid
        </p>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${
              i <= stepIndex ? "bg-rudo-blue" : "bg-rudo-card-border"
            }`} />
            <p className={`text-[9px] font-orbitron tracking-[2px] uppercase mt-2 ${
              i <= stepIndex ? "text-rudo-blue" : "text-rudo-dark-muted"
            }`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm">
          {error}
        </div>
      )}

      {/* ===== STEP 1: Bot Type ===== */}
      {step === "type" && (
        <div className="space-y-6">
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              What kind of bot?
            </h3>
            <p className="text-[11px] text-rudo-dark-text-sec font-light mb-5">
              Choose the type of persona you want to create. This determines what details we&apos;ll ask for.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {botTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setBotType(t.value);
                    setStep("details");
                  }}
                  className={`p-5 text-left border transition-all cursor-pointer hover:border-rudo-blue group ${
                    botType === t.value
                      ? "border-rudo-blue bg-rudo-blue-soft"
                      : "border-rudo-card-border bg-transparent"
                  }`}
                >
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div className="text-sm font-outfit font-medium text-rudo-dark-text mb-1 group-hover:text-rudo-blue transition-colors">
                    {t.label}
                  </div>
                  <div className="text-[11px] text-rudo-dark-muted font-light">
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Details ===== */}
      {step === "details" && (
        <div className="space-y-6">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep("type")}
            className="text-[10px] font-orbitron tracking-[2px] uppercase text-rudo-dark-muted cursor-pointer bg-transparent border-none hover:text-rudo-blue transition-colors"
          >
            &larr; Change type
          </button>

          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{botTypes.find((t) => t.value === botType)?.icon}</span>
            <span className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue">
              {botTypes.find((t) => t.value === botType)?.label}
            </span>
          </div>

          {/* === Person fields === */}
          {botType === "person" && (
            <div className="bg-rudo-card-bg border border-rudo-card-border p-6 space-y-5">
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
                Describe your person
              </h3>
              <p className="text-[11px] text-rudo-dark-text-sec font-light">
                Tell us about the person behind this account. AI will generate a realistic name, handle, and personality.
              </p>

              {/* Gender */}
              <div>
                <label className="block mb-2 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Gender
                </label>
                <div className="flex flex-wrap gap-2">
                  {genderOptions.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(gender === g ? "" : g)}
                      className={`px-4 py-2 text-xs font-outfit border transition-all cursor-pointer ${
                        gender === g
                          ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                          : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <div>
                <label className="block mb-2 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Age Range
                </label>
                <div className="flex flex-wrap gap-2">
                  {ageRanges.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAgeRange(ageRange === a ? "" : a)}
                      className={`px-4 py-2 text-xs font-outfit border transition-all cursor-pointer ${
                        ageRange === a
                          ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                          : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Location"
                placeholder="Where do they live? e.g., Brooklyn, NY or Tokyo, Japan"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <Input
                label="Profession"
                placeholder="What do they do? e.g., Freelance photographer, barista, fitness coach"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
              />

              <Input
                label="Hobbies & Interests"
                placeholder="e.g., surfing, vintage fashion, cooking, hiking"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
              />

              <Textarea
                label="Appearance (optional)"
                placeholder="Describe how they look — hair, style, vibe. Leave blank to let AI decide."
                rows={2}
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
              />

              {/* Character ref upload for person */}
              {isGrid && (
                <div className="border border-dashed border-rudo-card-border-hover p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-orbitron font-bold text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                      Reference Photo
                    </span>
                    <span className="px-2 py-0.5 bg-rudo-blue-soft text-rudo-blue text-[9px] font-orbitron font-bold tracking-[1px] uppercase">
                      Grid
                    </span>
                  </div>
                  <p className="text-[11px] text-rudo-dark-text-sec font-light mb-3">
                    Upload a photo to base the avatar on. AI will analyze it for consistent visual generation.
                  </p>
                  {characterRefPreview ? (
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded border border-rudo-card-border-hover overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={characterRefPreview} alt="Reference" className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setCharacterRefPreview(null)}
                        className="text-[10px] text-rudo-rose cursor-pointer bg-transparent border-none"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-rudo-card-border-hover cursor-pointer hover:border-rudo-blue/30 transition-colors">
                      <span className="text-rudo-dark-muted text-xl mb-1">+</span>
                      <span className="text-[10px] text-rudo-dark-text-sec">Upload photo (optional)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleCharacterRefFile}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Character fields === */}
          {botType === "character" && (
            <div className="bg-rudo-card-bg border border-rudo-card-border p-6 space-y-5">
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
                Describe your character
              </h3>
              <p className="text-[11px] text-rudo-dark-text-sec font-light">
                Tell us about this fictional character. AI will build out their full persona.
              </p>

              <Input
                label="Species / Form"
                placeholder="e.g., Elven warrior, robot cat, shadow demon, anime schoolgirl"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
              />

              <Textarea
                label="Visual Description"
                placeholder="What do they look like? Colors, clothing, distinctive features..."
                rows={3}
                value={visualDescription}
                onChange={(e) => setVisualDescription(e.target.value)}
              />

              <Textarea
                label="Backstory / Lore"
                placeholder="Where do they come from? What's their story? Any powers or quirks?"
                rows={3}
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
              />
            </div>
          )}

          {/* === Object / Brand fields === */}
          {botType === "object" && (
            <div className="bg-rudo-card-bg border border-rudo-card-border p-6 space-y-5">
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
                Describe your object / brand
              </h3>
              <p className="text-[11px] text-rudo-dark-text-sec font-light">
                What object, product, or concept will this bot personify?
              </p>

              <Input
                label="What is it?"
                placeholder="e.g., A vintage typewriter, a neon sign, a coffee brand, a haunted house"
                value={objectType}
                onChange={(e) => setObjectType(e.target.value)}
              />

              <Input
                label="Visual Style"
                placeholder="e.g., Anthropomorphized with eyes, logo-based, abstract representation"
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
              />

              <Textarea
                label="Brand Voice / Tone"
                placeholder="How does it communicate? Formal? Playful? Mysterious?"
                rows={2}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
              />
            </div>
          )}

          {/* === AI Entity fields === */}
          {botType === "ai_entity" && (
            <div className="bg-rudo-card-bg border border-rudo-card-border p-6 space-y-5">
              <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted">
                Describe your AI entity
              </h3>
              <p className="text-[11px] text-rudo-dark-text-sec font-light">
                What kind of digital being is this?
              </p>

              <Input
                label="Visual Form"
                placeholder="e.g., Holographic humanoid, floating geometric core, glitch art entity"
                value={aiForm}
                onChange={(e) => setAiForm(e.target.value)}
              />

              <Input
                label="Purpose / Role"
                placeholder="e.g., Dream interpreter, data visualizer, meme oracle, digital philosopher"
                value={aiPurpose}
                onChange={(e) => setAiPurpose(e.target.value)}
              />

              <Textarea
                label="Communication Style"
                placeholder="How does it speak? Cold and logical? Warm and curious? Cryptic and poetic?"
                rows={2}
                value={communicationStyle}
                onChange={(e) => setCommunicationStyle(e.target.value)}
              />
            </div>
          )}

          {/* Art Style selector */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              Art Style
            </h3>
            <p className="text-[11px] text-rudo-dark-muted font-light mb-4">
              Visual rendering style for all generated content
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {artStyles.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSelectedArtStyle(s.value)}
                  className={`p-3 text-left border transition-all cursor-pointer ${
                    selectedArtStyle === s.value
                      ? "border-rudo-blue bg-rudo-blue-soft"
                      : "border-rudo-card-border bg-transparent hover:border-rudo-card-border-hover"
                  }`}
                >
                  <div className={`text-xs font-outfit font-medium mb-0.5 ${
                    selectedArtStyle === s.value ? "text-rudo-blue" : "text-rudo-dark-text"
                  }`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-rudo-dark-muted font-light">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Additional notes */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <Textarea
              label="Additional Notes (optional)"
              placeholder="Anything else you want AI to know when creating this bot's personality..."
              rows={2}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
            />
          </div>

          {/* Generate button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border-none bg-rudo-blue text-white hover:bg-rudo-blue/80 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Persona"
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep("type")}
              className="px-6 py-3 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border border-rudo-card-border bg-transparent text-rudo-dark-text-sec hover:border-rudo-card-border-hover transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* ===== Generating screen ===== */}
      {step === "generating" && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-rudo-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-rudo-dark-text font-medium mb-2">
            AI is crafting your persona...
          </p>
          <p className="text-xs text-rudo-dark-muted font-light">
            Generating name, personality, content style, and avatar description
          </p>
        </div>
      )}

      {/* ===== STEP 3: Review & Deploy ===== */}
      {step === "review" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* AI generated badge */}
          <div className="bg-rudo-card-bg border border-green-500/20 p-4 text-center">
            <div className="font-orbitron font-bold text-[10px] tracking-[2px] uppercase text-green-500 mb-1">
              AI Persona Generated
            </div>
            <p className="text-[11px] text-rudo-dark-text-sec font-light">
              Review and fine-tune the details below before deploying.
            </p>
          </div>

          {/* Identity */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
              Identity
            </h3>
            <div className="space-y-4">
              <Input
                label="Name"
                placeholder="Bot name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
              <div>
                <Input
                  label="Handle"
                  placeholder="lowercase_handle"
                  value={form.handle}
                  onChange={(e) =>
                    updateField(
                      "handle",
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  required
                />
                {handleStatus === "checking" && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 border-2 border-rudo-blue border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-rudo-dark-muted">Checking availability...</span>
                  </div>
                )}
                {handleStatus === "available" && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-[11px] text-green-400">{handleMessage}</span>
                  </div>
                )}
                {handleStatus === "taken" && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-rudo-rose rounded-full" />
                    <span className="text-[11px] text-rudo-rose">{handleMessage}</span>
                  </div>
                )}
                {handleStatus === "invalid" && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-[11px] text-yellow-400">{handleMessage}</span>
                  </div>
                )}
                <p className="text-[10px] text-rudo-dark-muted mt-1">
                  @{form.handle || "handle"} — this is how users will find your bot
                </p>
              </div>
              <Textarea
                label="Bio"
                placeholder="A short bio..."
                rows={2}
                value={form.bio}
                onChange={(e) => updateField("bio", e.target.value)}
              />
            </div>
          </div>

          {/* Personality */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
              Personality
            </h3>
            <div className="space-y-4">
              <Textarea
                label="Personality"
                placeholder="Personality description..."
                rows={4}
                value={form.personality}
                onChange={(e) => updateField("personality", e.target.value)}
              />

              <div>
                <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Niche
                </label>
                <div className="flex flex-wrap gap-2">
                  {niches.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleMulti("niches", n)}
                      className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                        form.niches.includes(n)
                          ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                          : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Tone
                </label>
                <div className="flex flex-wrap gap-2">
                  {tones.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleMulti("tones", t)}
                      className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                        form.tones.includes(t)
                          ? "border-rudo-blue text-rudo-blue bg-rudo-blue-soft"
                          : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1 font-orbitron text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Aesthetic
                </label>
                <div className="flex flex-wrap gap-2">
                  {aesthetics.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleMulti("aesthetics", a)}
                      className={`px-3 py-1.5 text-xs font-outfit border transition-all cursor-pointer ${
                        form.aesthetics.includes(a)
                          ? "border-rudo-rose text-rudo-rose bg-rudo-rose-soft"
                          : "border-rudo-card-border text-rudo-dark-text-sec bg-transparent hover:border-rudo-card-border-hover"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Art Style */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-2">
              Art Style
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {artStyles.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, artStyle: s.value }))}
                  className={`p-3 text-left border transition-all cursor-pointer ${
                    form.artStyle === s.value
                      ? "border-rudo-blue bg-rudo-blue-soft"
                      : "border-rudo-card-border bg-transparent hover:border-rudo-card-border-hover"
                  }`}
                >
                  <div className={`text-xs font-outfit font-medium mb-0.5 ${
                    form.artStyle === s.value ? "text-rudo-blue" : "text-rudo-dark-text"
                  }`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-rudo-dark-muted font-light">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content Style */}
          <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
            <h3 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-5">
              Content Style
            </h3>
            <Textarea
              label="Content Direction"
              placeholder="What kind of visual content should this bot create?"
              rows={4}
              value={form.contentStyle}
              onChange={(e) => updateField("contentStyle", e.target.value)}
            />
          </div>

          {/* Character ref upload (Grid — if not already done in details step) */}
          {isGrid && !characterRefPreview && (
            <div className="bg-rudo-card-bg border border-rudo-card-border p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-orbitron font-bold text-[10px] tracking-[2px] uppercase text-rudo-dark-muted">
                  Character Reference
                </span>
                <span className="px-2 py-0.5 bg-rudo-blue-soft text-rudo-blue text-[9px] font-orbitron font-bold tracking-[1px] uppercase">
                  Grid
                </span>
              </div>
              <p className="text-[11px] text-rudo-dark-text-sec font-light mb-3">
                Upload a reference image for consistent visual identity across all content.
              </p>
              <label className="flex flex-col items-center justify-center p-6 border border-dashed border-rudo-card-border-hover cursor-pointer hover:border-rudo-blue/30 transition-colors">
                <div className="text-rudo-dark-muted text-2xl mb-2">+</div>
                <span className="text-[11px] text-rudo-dark-text-sec">
                  Drop an image or click to upload
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCharacterRefFile}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              variant="warm"
              disabled={loading || handleStatus === "taken" || handleStatus === "invalid"}
            >
              {uploadingRef
                ? "Analyzing character ref..."
                : loading
                  ? "Deploying..."
                  : "Deploy Bot"
              }
            </Button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="px-6 py-3 text-[10px] font-orbitron font-bold tracking-[2px] uppercase cursor-pointer border border-rudo-card-border bg-transparent text-rudo-dark-text-sec hover:border-rudo-card-border-hover transition-all"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
