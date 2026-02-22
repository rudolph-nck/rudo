"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Step4Data } from "./types";

const SKIN_TONES = ["fair", "light", "medium", "olive", "tan", "brown", "dark"];
const HAIR_COLORS = ["black", "brown", "blonde", "red", "auburn", "gray", "white", "colored"];
const HAIR_STYLES = ["straight", "wavy", "curly", "coily", "short crop", "buzz cut", "long", "braids", "locs"];
const BUILDS = ["slim", "athletic", "average", "curvy", "muscular", "plus-size"];

export function Step4Appearance({
  data,
  onChange,
  isGenerating,
  onGenerateSeeds,
}: {
  data: Step4Data;
  onChange: (data: Partial<Step4Data>) => void;
  isGenerating: boolean;
  onGenerateSeeds: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">What do they look like?</h2>
        <p className="text-sm text-rudo-dark-muted">Define your bot's visual appearance.</p>
      </div>

      {/* Appearance Path Selection */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { value: "describe" as const, label: "Describe", desc: "I'll specify details", icon: "✍️" },
          { value: "upload" as const, label: "Upload", desc: "Use a reference photo", icon: "📷" },
          { value: "generate" as const, label: "AI Generate", desc: "Generate from personality", icon: "🤖" },
        ]).map((path) => (
          <button
            key={path.value}
            onClick={() => onChange({ appearancePath: path.value })}
            className={`p-3 text-center border rounded-lg transition-all ${
              data.appearancePath === path.value
                ? "border-rudo-blue bg-blue-50"
                : "border-rudo-card-border hover:border-gray-300"
            }`}
          >
            <span className="text-xl block">{path.icon}</span>
            <p className="font-medium text-sm text-rudo-dark-text">{path.label}</p>
            <p className="text-[10px] text-rudo-dark-muted">{path.desc}</p>
          </button>
        ))}
      </div>

      {/* Path A: Describe */}
      {data.appearancePath === "describe" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Skin Tone</label>
            <div className="flex flex-wrap gap-1">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone}
                  onClick={() => onChange({ appearance: { ...data.appearance, skinTone: tone } })}
                  className={`px-3 py-1 text-xs border rounded-full transition-all ${
                    data.appearance?.skinTone === tone
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Hair Color</label>
            <div className="flex flex-wrap gap-1">
              {HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onChange({ appearance: { ...data.appearance, hairColor: color } })}
                  className={`px-3 py-1 text-xs border rounded-full transition-all ${
                    data.appearance?.hairColor === color
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Hair Style</label>
            <div className="flex flex-wrap gap-1">
              {HAIR_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => onChange({ appearance: { ...data.appearance, hairStyle: style } })}
                  className={`px-3 py-1 text-xs border rounded-full transition-all ${
                    data.appearance?.hairStyle === style
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">Build</label>
            <div className="flex flex-wrap gap-1">
              {BUILDS.map((build) => (
                <button
                  key={build}
                  onClick={() => onChange({ appearance: { ...data.appearance, build } })}
                  className={`px-3 py-1 text-xs border rounded-full transition-all ${
                    data.appearance?.build === build
                      ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                      : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                  }`}
                >
                  {build}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Distinguishing Feature (optional)"
            value={data.appearance?.distinguishingFeature || ""}
            onChange={(e) => onChange({ appearance: { ...data.appearance, distinguishingFeature: e.target.value } })}
            maxLength={100}
          />
        </div>
      )}

      {/* Path B: Upload */}
      {data.appearancePath === "upload" && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-rudo-card-border rounded-lg p-8 text-center">
            <p className="text-sm text-rudo-dark-muted mb-2">
              Upload a reference photo or AI-generated image
            </p>
            <input
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  onChange({ uploadedImageUrl: url });
                }
              }}
            />
            {data.uploadedImageUrl && (
              <div className="mt-4">
                <img
                  src={data.uploadedImageUrl}
                  alt="Reference"
                  className="w-32 h-32 object-cover rounded-lg mx-auto"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Path C: Generate from personality */}
      {data.appearancePath === "generate" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-rudo-blue/20 rounded-lg p-4">
            <p className="text-sm text-rudo-dark-text">
              AI will generate your bot's appearance based on their identity, vibe, and voice settings from the previous steps.
            </p>
          </div>

          {!data.seedUrls?.length && (
            <Button
              variant="blue"
              onClick={onGenerateSeeds}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Character Options"
              )}
            </Button>
          )}

          {/* Seed selection grid */}
          {data.seedUrls && data.seedUrls.length > 0 && (
            <div>
              <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                {data.selectedSeedUrl ? "Selected Character" : "Choose Your Character"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {data.seedUrls.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => onChange({ selectedSeedUrl: url })}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                      data.selectedSeedUrl === url
                        ? "border-rudo-blue ring-2 ring-rudo-blue/30"
                        : "border-rudo-card-border hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Character option ${i + 1}`}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    {data.selectedSeedUrl === url && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-rudo-blue rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">&#10003;</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  onChange({ seedUrls: undefined, selectedSeedUrl: undefined });
                }}
                className="text-xs text-rudo-blue mt-3 hover:underline"
              >
                Regenerate options
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
