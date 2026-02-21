"use client";

import type { Step3Data } from "./types";
import { VOICE_SLIDERS, LANGUAGE_STYLES, QUICK_OPINIONS } from "./types";

function Slider({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-rudo-dark-muted">{low}</span>
        <span className="text-xs font-medium text-rudo-dark-text">{label}</span>
        <span className="text-xs text-rudo-dark-muted">{high}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rudo-blue"
      />
    </div>
  );
}

export function Step3Voice({
  data,
  onChange,
}: {
  data: Step3Data;
  onChange: (data: Partial<Step3Data>) => void;
}) {
  const updateSlider = (key: keyof Step3Data["voiceSliders"], value: number) => {
    onChange({
      voiceSliders: { ...data.voiceSliders, [key]: value },
    });
  };

  const toggleLanguageStyle = (style: string) => {
    const current = data.languageStyles;
    if (current.includes(style)) {
      onChange({ languageStyles: current.filter((s) => s !== style) });
    } else if (current.length < 3) {
      onChange({ languageStyles: [...current, style] });
    }
  };

  const setOpinion = (topic: string, stance: string) => {
    const current = data.quickOpinions;
    if (current[topic] === stance) {
      // Toggle off
      const next = { ...current };
      delete next[topic];
      onChange({ quickOpinions: next });
    } else {
      onChange({ quickOpinions: { ...current, [topic]: stance } });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">How do they talk?</h2>
        <p className="text-sm text-rudo-dark-muted">Fine-tune your bot's voice and personality expression.</p>
      </div>

      {/* Voice Sliders */}
      <div className="space-y-4">
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">
          Voice Sliders
        </label>
        {VOICE_SLIDERS.map((slider) => (
          <Slider
            key={slider.key}
            label={slider.key.replace(/([A-Z])/g, " $1").trim()}
            low={slider.low}
            high={slider.high}
            value={data.voiceSliders[slider.key]}
            onChange={(v) => updateSlider(slider.key, v)}
          />
        ))}
      </div>

      {/* Quick Opinions */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Quick Opinions (tap a stance or skip)
        </label>
        <div className="space-y-3">
          {QUICK_OPINIONS.map((q) => (
            <div key={q.topic}>
              <p className="text-sm font-medium text-rudo-dark-text mb-1">{q.topic}</p>
              <div className="flex flex-wrap gap-1">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOpinion(q.topic, opt)}
                    className={`px-3 py-1 text-xs border rounded-full transition-all ${
                      data.quickOpinions[q.topic] === opt
                        ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                        : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language Styles */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Language Style (pick 2-3)
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_STYLES.map((ls) => (
            <button
              key={ls.value}
              onClick={() => toggleLanguageStyle(ls.value)}
              className={`px-3 py-1.5 text-xs border rounded-lg transition-all ${
                data.languageStyles.includes(ls.value)
                  ? "border-rudo-blue bg-blue-50 text-rudo-blue"
                  : "border-rudo-card-border text-rudo-dark-text hover:border-gray-300"
              } ${data.languageStyles.length >= 3 && !data.languageStyles.includes(ls.value) ? "opacity-40" : ""}`}
            >
              {ls.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-rudo-dark-muted mt-1">{data.languageStyles.length}/3 selected</p>
      </div>

      {/* Content Rating */}
      <div>
        <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
          Content Rating
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "mild" as const, label: "Mild", desc: "Wholesome, safe content" },
            { value: "medium" as const, label: "Medium", desc: "Pushes buttons sometimes" },
            { value: "hot" as const, label: "Hot", desc: "No filter, edgy humor" },
          ]).map((rating) => (
            <button
              key={rating.value}
              onClick={() => onChange({ contentRating: rating.value })}
              className={`p-3 text-left border rounded-lg transition-all ${
                data.contentRating === rating.value
                  ? "border-rudo-blue bg-blue-50"
                  : "border-rudo-card-border hover:border-gray-300"
              }`}
            >
              <p className="font-medium text-sm text-rudo-dark-text">{rating.label}</p>
              <p className="text-xs text-rudo-dark-muted">{rating.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
