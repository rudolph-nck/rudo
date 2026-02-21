"use client";

import type { Step2Data } from "./types";
import { VIBE_TAGS, INTEREST_CARDS, MOOD_BOARDS } from "./types";

export function Step2Vibe({
  data,
  onChange,
}: {
  data: Step2Data;
  onChange: (data: Partial<Step2Data>) => void;
}) {
  const toggleVibe = (tag: string) => {
    const current = data.vibeTags;
    if (current.includes(tag)) {
      onChange({ vibeTags: current.filter((t) => t !== tag) });
    } else if (current.length < 3) {
      onChange({ vibeTags: [...current, tag] });
    }
  };

  const toggleInterest = (interest: string) => {
    const current = data.interests;
    if (current.includes(interest)) {
      onChange({ interests: current.filter((i) => i !== interest) });
    } else if (current.length < 4) {
      onChange({ interests: [...current, interest] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">What's their vibe?</h2>
        <p className="text-sm text-rudo-dark-muted">Pick personality tags and interests that define who they are.</p>
      </div>

      {/* Vibe Tags */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Personality Tags (pick 2-3)
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {VIBE_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => toggleVibe(tag.value)}
              className={`py-2 px-2 text-xs border rounded-lg transition-all text-center ${
                data.vibeTags.includes(tag.value)
                  ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                  : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
              } ${data.vibeTags.length >= 3 && !data.vibeTags.includes(tag.value) ? "opacity-40" : ""}`}
            >
              <span className="text-base block">{tag.emoji}</span>
              {tag.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-rudo-dark-muted mt-1">{data.vibeTags.length}/3 selected</p>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-1">
          Interests (pick 2-4)
        </label>
        <p className="text-xs text-rudo-dark-muted mb-2">
          These shape how they see the world — not every post will be about these topics.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {INTEREST_CARDS.map((card) => (
            <button
              key={card.value}
              onClick={() => toggleInterest(card.value)}
              className={`py-2 px-2 text-xs border rounded-lg transition-all text-center ${
                data.interests.includes(card.value)
                  ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                  : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
              } ${data.interests.length >= 4 && !data.interests.includes(card.value) ? "opacity-40" : ""}`}
            >
              <span className="text-base block">{card.emoji}</span>
              {card.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-rudo-dark-muted mt-1">{data.interests.length}/4 selected</p>
      </div>

      {/* Mood Board */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Visual Mood (pick 1)
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {MOOD_BOARDS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => onChange({ moodBoard: mood.value })}
              className={`py-3 px-2 text-xs border rounded-lg transition-all text-center ${
                data.moodBoard === mood.value
                  ? "border-rudo-blue ring-2 ring-rudo-blue/20"
                  : "border-rudo-card-border hover:border-gray-300"
              }`}
            >
              <div
                className="w-8 h-8 rounded-full mx-auto mb-1"
                style={{ backgroundColor: mood.color }}
              />
              <span className="text-rudo-dark-text">{mood.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
