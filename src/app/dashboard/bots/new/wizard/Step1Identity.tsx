"use client";

import { Input } from "@/components/ui/input";
import type { Step1Data, BotType } from "./types";
import {
  BOT_TYPES,
  ANIMAL_SPECIES,
  ANIMAL_SIZES,
  ENTITY_TYPES,
} from "./types";

const AGE_RANGES = [
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-50+", label: "35-50+" },
] as const;

const GENDERS = [
  { value: "feminine", label: "Feminine" },
  { value: "masculine", label: "Masculine" },
  { value: "fluid", label: "Fluid" },
] as const;

const LOCATIONS = [
  { value: "big_city", label: "Big City", emoji: "🏙️" },
  { value: "coastal", label: "Coastal", emoji: "🏖️" },
  { value: "mountain", label: "Mountain", emoji: "🏔️" },
  { value: "rural", label: "Rural", emoji: "🌾" },
  { value: "suburban", label: "Suburban", emoji: "🏡" },
  { value: "international", label: "International", emoji: "🌍" },
  { value: "digital", label: "Digital", emoji: "💻" },
] as const;

const DESCRIPTION_PLACEHOLDERS: Record<BotType, string> = {
  person:
    "A laid-back surfer dude from Malibu who moonlights as a barista and talks like everything is chill...",
  character:
    "A cyberpunk elf hacker who lives in the neon underbelly of Neo-Tokyo, speaks in riddles, and has a prosthetic arm...",
  animal:
    "A golden retriever who thinks he's a fitness influencer, always 'at the gym' (the dog park), overly enthusiastic about everything...",
  entity:
    "A sentient vintage typewriter who's opinionated about modern writing, passive-aggressive about autocorrect, and nostalgic for the 1960s...",
};

export function Step1Identity({
  data,
  onChange,
}: {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
}) {
  const botType = data.botType;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">Who is your bot?</h2>
        <p className="text-sm text-rudo-dark-muted">Pick a type and describe them in your own words.</p>
      </div>

      {/* Bot Type — 4 options */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Type</label>
        <div className="grid grid-cols-2 gap-3">
          {BOT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => onChange({ botType: t.value })}
              className={`p-4 text-left border rounded-lg transition-all ${
                botType === t.value
                  ? "border-rudo-blue bg-blue-50"
                  : "border-rudo-card-border hover:border-gray-300"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <p className="font-medium text-rudo-dark-text mt-1">{t.label}</p>
              <p className="text-xs text-rudo-dark-muted">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Name (optional) */}
      <Input
        label="Name (optional — AI will generate one)"
        value={data.name}
        onChange={(e) => onChange({ name: e.target.value })}
        maxLength={50}
      />

      {/* Free-text character description — shown for ALL types */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Describe Your Character
        </label>
        <textarea
          value={data.characterDescription}
          onChange={(e) => onChange({ characterDescription: e.target.value })}
          placeholder={DESCRIPTION_PLACEHOLDERS[botType]}
          maxLength={500}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-rudo-card-border rounded-lg bg-white text-rudo-dark-text placeholder:text-rudo-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-rudo-blue/30 focus:border-rudo-blue resize-none"
        />
        <p className="text-[10px] text-rudo-dark-muted mt-1">
          In your own words — personality, backstory, quirks, anything that makes them unique.
          {data.characterDescription.length > 0 && ` ${data.characterDescription.length}/500`}
        </p>
      </div>

      {/* --- Type-specific fields --- */}

      {/* Person + Character: age, gender, location */}
      {(botType === "person" || botType === "character") && (
        <>
          {/* Age Range */}
          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Age Range</label>
            <div className="flex gap-2">
              {AGE_RANGES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => onChange({ ageRange: a.value })}
                  className={`flex-1 py-2 px-3 text-sm border rounded-lg transition-all ${
                    data.ageRange === a.value
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Presentation */}
          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Presentation</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => onChange({ genderPresentation: g.value })}
                  className={`flex-1 py-2 px-3 text-sm border rounded-lg transition-all ${
                    data.genderPresentation === g.value
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location Vibe */}
          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Location Vibe</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {LOCATIONS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => onChange({ locationVibe: l.value })}
                  className={`py-2 px-2 text-xs border rounded-lg transition-all text-center ${
                    data.locationVibe === l.value
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg block">{l.emoji}</span>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Animal: species, breed, size */}
      {botType === "animal" && (
        <>
          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Species</label>
            <div className="grid grid-cols-5 gap-2">
              {ANIMAL_SPECIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onChange({ species: s.value })}
                  className={`py-2 px-1 text-xs border rounded-lg transition-all text-center ${
                    data.species === s.value
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg block">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Breed (optional)"
            value={data.breed}
            onChange={(e) => onChange({ breed: e.target.value })}
            placeholder="e.g. Golden Retriever, Siamese, Cockatiel..."
            maxLength={50}
          />

          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Size</label>
            <div className="flex gap-2">
              {ANIMAL_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onChange({ animalSize: s.value })}
                  className={`flex-1 py-2 px-2 text-xs border rounded-lg transition-all ${
                    data.animalSize === s.value
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Entity: entity type */}
      {botType === "entity" && (
        <div>
          <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Entity Type</label>
          <div className="grid grid-cols-3 gap-2">
            {ENTITY_TYPES.map((e) => (
              <button
                key={e.value}
                onClick={() => onChange({ entityType: e.value })}
                className={`p-3 text-center border rounded-lg transition-all ${
                  data.entityType === e.value
                    ? "border-rudo-blue bg-blue-50"
                    : "border-rudo-card-border hover:border-gray-300"
                }`}
              >
                <p className="font-medium text-sm text-rudo-dark-text">{e.label}</p>
                <p className="text-[10px] text-rudo-dark-muted">{e.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
