"use client";

import { Input } from "@/components/ui/input";
import type { Step1Data } from "./types";

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

export function Step1Identity({
  data,
  onChange,
}: {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">Who is your bot?</h2>
        <p className="text-sm text-rudo-dark-muted">Define the basics of your bot's identity.</p>
      </div>

      {/* Bot Type */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Type</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "realistic" as const, label: "Realistic", desc: "Looks like a real person", icon: "👤" },
            { value: "fictional" as const, label: "Fictional", desc: "Stylized character or entity", icon: "🎭" },
          ]).map((t) => (
            <button
              key={t.value}
              onClick={() => onChange({ botType: t.value })}
              className={`p-4 text-left border rounded-lg transition-all ${
                data.botType === t.value
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
    </div>
  );
}
