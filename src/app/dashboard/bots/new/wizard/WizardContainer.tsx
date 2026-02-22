"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Step1Identity } from "./Step1Identity";
import { Step2Vibe } from "./Step2Vibe";
import { Step3Voice } from "./Step3Voice";
import { Step4Appearance } from "./Step4Appearance";
import { Step5Preview } from "./Step5Preview";
import { Step6Launch } from "./Step6Launch";
import { DEFAULT_WIZARD_STATE, STEP_LABELS } from "./types";
import type { WizardStep, WizardState, Step1Data, Step2Data, Step3Data, Step4Data, Step5Data } from "./types";

export function WizardContainer({ isFreeEligibleForTrial = false }: { isFreeEligibleForTrial?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string>("");

  const updateStep1 = useCallback((data: Partial<Step1Data>) => {
    setState((s) => ({ ...s, step1: { ...s.step1, ...data } }));
  }, []);

  const updateStep2 = useCallback((data: Partial<Step2Data>) => {
    setState((s) => ({ ...s, step2: { ...s.step2, ...data } }));
  }, []);

  const updateStep3 = useCallback((data: Partial<Step3Data>) => {
    setState((s) => ({ ...s, step3: { ...s.step3, ...data } }));
  }, []);

  const updateStep4 = useCallback((data: Partial<Step4Data>) => {
    setState((s) => ({ ...s, step4: { ...s.step4, ...data } }));
  }, []);

  const updateStep5 = useCallback((data: Partial<Step5Data>) => {
    setState((s) => ({ ...s, step5: { ...s.step5, ...data } }));
  }, []);

  const canProceed = (): boolean => {
    switch (state.step) {
      case 1: return true; // All fields have defaults
      case 2: return state.step2.vibeTags.length >= 2 && state.step2.interests.length >= 2;
      case 3: return state.step3.languageStyles.length >= 2;
      case 4: {
        if (state.step4.appearancePath === "generate") return !!state.step4.selectedSeedUrl;
        if (state.step4.appearancePath === "upload") return !!state.step4.uploadedImageUrl;
        // "describe" path — require at least skin tone or hair
        return !!(state.step4.appearance?.skinTone || state.step4.appearance?.hairColor);
      }
      case 5: return !!state.step5.name && !!state.step5.handle;
      case 6: return true;
      default: return false;
    }
  };

  const next = () => {
    if (state.step < 6) {
      setState((s) => ({ ...s, step: (s.step + 1) as WizardStep }));
      setError("");
    }
  };

  const back = () => {
    if (state.step > 1) {
      setState((s) => ({ ...s, step: (s.step - 1) as WizardStep }));
      setError("");
    }
  };

  const handleGenerateSeeds = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/bots/wizard/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: state.step1,
          vibe: state.step2,
          appearance: state.step4.appearance,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate character images");
      if (data.seeds?.length > 0) {
        updateStep4({ seedUrls: data.seeds });
      } else {
        setError("No images were generated. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate character images");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/bots/wizard/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity: state.step1,
          vibe: state.step2,
          voice: state.step3,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateStep5({
        name: data.name || state.step1.name,
        handle: data.handle,
        bio: data.bio,
        personalitySummary: data.personalitySummary,
        sampleCaptions: data.sampleCaptions || [],
        artStyle: state.step1.botType === "realistic" ? "realistic" : "cartoon",
      });
    } catch (err: any) {
      setError(err.message || "Failed to generate preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    setError("");

    const wizardPayload = {
      identity: state.step1,
      vibe: state.step2,
      voice: state.step3,
      appearance: state.step4,
      profile: state.step5,
    };

    // FREE trial-eligible users: save state and redirect to Stripe
    if (isFreeEligibleForTrial) {
      try {
        sessionStorage.setItem("rudo_bot_draft_v2", JSON.stringify(wizardPayload));

        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: "SPARK", trial: true }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "Failed to start trial");
          setIsLaunching(false);
        }
      } catch {
        setError("Something went wrong — please try again");
        setIsLaunching(false);
      }
      return;
    }

    // Normal launch
    try {
      const res = await fetch("/api/bots/wizard/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wizardPayload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/dashboard/bots/${data.bot.handle}`);
    } catch (err: any) {
      setError(err.message || "Failed to launch bot");
      setIsLaunching(false);
    }
  };

  const stepIndex = state.step - 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-rudo-blue" : "bg-rudo-card-border"
              }`}
            />
            <p
              className={`text-[9px] font-orbitron tracking-[2px] uppercase mt-2 ${
                i <= stepIndex ? "text-rudo-blue" : "text-rudo-dark-muted"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white border border-rudo-card-border rounded-lg p-6">
        {state.step === 1 && <Step1Identity data={state.step1} onChange={updateStep1} />}
        {state.step === 2 && <Step2Vibe data={state.step2} onChange={updateStep2} />}
        {state.step === 3 && <Step3Voice data={state.step3} onChange={updateStep3} />}
        {state.step === 4 && (
          <Step4Appearance
            data={state.step4}
            onChange={updateStep4}
            isGenerating={isGenerating}
            onGenerateSeeds={handleGenerateSeeds}
          />
        )}
        {state.step === 5 && (
          <Step5Preview
            data={state.step5}
            onChange={updateStep5}
            isGenerating={isGenerating}
            onGenerate={handleGeneratePreview}
            avatarUrl={state.step4.selectedAvatarUrl || state.step4.selectedSeedUrl}
          />
        )}
        {state.step === 6 && (
          <Step6Launch
            isLaunching={isLaunching}
            onLaunch={handleLaunch}
            botName={state.step5.name}
            botHandle={state.step5.handle}
            avatarUrl={state.step4.selectedAvatarUrl || state.step4.selectedSeedUrl}
            error={error}
            isFreeEligibleForTrial={isFreeEligibleForTrial}
          />
        )}
      </div>

      {/* Error */}
      {error && state.step !== 6 && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          onClick={back}
          disabled={state.step === 1}
        >
          Back
        </Button>

        {state.step < 6 && (
          <Button
            variant="blue"
            onClick={next}
            disabled={!canProceed()}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
