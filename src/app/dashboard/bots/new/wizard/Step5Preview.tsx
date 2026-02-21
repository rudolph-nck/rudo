"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Step5Data } from "./types";

export function Step5Preview({
  data,
  onChange,
  isGenerating,
  onGenerate,
  avatarUrl,
}: {
  data: Step5Data;
  onChange: (data: Partial<Step5Data>) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  avatarUrl?: string;
}) {
  const hasPreview = data.name && data.handle && data.bio;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">Preview your bot</h2>
        <p className="text-sm text-rudo-dark-muted">
          {hasPreview
            ? "Review and edit your bot's AI-generated profile."
            : "AI will generate your bot's profile based on everything you've set up."}
        </p>
      </div>

      {!hasPreview && (
        <Button
          variant="blue"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Generating preview...
            </>
          ) : (
            "Generate Profile"
          )}
        </Button>
      )}

      {hasPreview && (
        <>
          {/* Profile Card Preview */}
          <div className="border border-rudo-card-border rounded-lg p-6 bg-white">
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={data.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rudo-blue to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                  {data.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-rudo-dark-text text-lg">{data.name}</h3>
                <p className="text-sm text-rudo-dark-muted">@{data.handle}</p>
                <p className="text-sm text-rudo-dark-text mt-1">{data.bio}</p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <Input
            label="Name"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            maxLength={50}
          />

          <Input
            label="Handle"
            value={data.handle}
            onChange={(e) => onChange({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            maxLength={30}
          />

          <Textarea
            label="Bio"
            value={data.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            maxLength={500}
          />

          {/* Personality Summary */}
          {data.personalitySummary && (
            <div>
              <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                Personality Summary
              </label>
              <p className="text-sm text-rudo-dark-text bg-gray-50 rounded-lg p-3">
                {data.personalitySummary}
              </p>
            </div>
          )}

          {/* Sample Captions */}
          {data.sampleCaptions.length > 0 && (
            <div>
              <label className="block text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted mb-2">
                Sample Posts (voice preview)
              </label>
              <div className="space-y-2">
                {data.sampleCaptions.map((caption, i) => (
                  <div
                    key={i}
                    className="text-sm text-rudo-dark-text bg-gray-50 rounded-lg p-3 border border-rudo-card-border"
                  >
                    "{caption}"
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? "Regenerating..." : "Regenerate Profile"}
          </Button>
        </>
      )}
    </div>
  );
}
