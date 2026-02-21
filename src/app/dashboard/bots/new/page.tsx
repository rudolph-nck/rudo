"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { WizardContainer } from "./wizard/WizardContainer";

const PAID_TIERS = ["BYOB_FREE", "BYOB_PRO", "SPARK", "PULSE", "GRID", "ADMIN"];

const BOT_LIMITS: Record<string, number> = {
  FREE: 0,
  BYOB_FREE: 1,
  BYOB_PRO: 1,
  SPARK: 1,
  PULSE: 1,
  GRID: 3,
  ADMIN: 100,
};

export default function NewBotPage() {
  return (
    <Suspense>
      <NewBotContent />
    </Suspense>
  );
}

function NewBotContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();
  const autoDeployedRef = useRef(false);

  const tier = (session?.user as any)?.tier || "FREE";
  const hasUsedTrial = (session?.user as any)?.hasUsedTrial || false;
  const isPaid = PAID_TIERS.includes(tier);
  const isFreeEligibleForTrial = tier === "FREE" && !hasUsedTrial;
  const maxBots = BOT_LIMITS[tier] ?? 0;

  // Bot limit check
  const [botCount, setBotCount] = useState<number | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [error, setError] = useState("");

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
    if (isPaid || isFreeEligibleForTrial) checkBotCount();
    else setCheckingLimit(false);
  }, [isPaid, isFreeEligibleForTrial]);

  const atBotLimit = botCount !== null && botCount >= maxBots && !isFreeEligibleForTrial;

  // Auto-deploy: when returning from Stripe trial checkout with ?deploy=1,
  // refresh the session to pick up the new tier, restore the bot draft,
  // and deploy the bot automatically.
  const shouldAutoDeploy = searchParams.get("deploy") === "1";
  const [autoDeploying, setAutoDeploying] = useState(shouldAutoDeploy);

  useEffect(() => {
    if (!shouldAutoDeploy || autoDeployedRef.current) return;
    autoDeployedRef.current = true;

    async function restoreAndDeploy() {
      await updateSession();

      // Try v2 draft first (new 6-step wizard), then fall back to v1 (legacy)
      const savedV2 = sessionStorage.getItem("rudo_bot_draft_v2");
      const savedV1 = sessionStorage.getItem("rudo_bot_draft");

      if (savedV2) {
        try {
          const draft = JSON.parse(savedV2);
          sessionStorage.removeItem("rudo_bot_draft_v2");
          window.history.replaceState(null, "", "/dashboard/bots/new");

          const res = await fetch("/api/bots/wizard/launch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          });

          if (res.ok) {
            const data = await res.json();
            router.push(`/dashboard/bots/${data.bot.handle}`);
          } else {
            let msg = "Failed to deploy bot";
            try {
              const data = await res.json();
              msg = data.error || msg;
            } catch {}
            setError(msg);
            setAutoDeploying(false);
          }
        } catch {
          sessionStorage.removeItem("rudo_bot_draft_v2");
          setError("Failed to restore bot draft");
          setAutoDeploying(false);
        }
        return;
      }

      // Legacy v1 draft fallback
      if (savedV1) {
        try {
          const draft = JSON.parse(savedV1);
          if (!draft.form?.name || !draft.form?.handle) {
            sessionStorage.removeItem("rudo_bot_draft");
            setAutoDeploying(false);
            return;
          }

          sessionStorage.removeItem("rudo_bot_draft");
          window.history.replaceState(null, "", "/dashboard/bots/new");

          const res = await fetch("/api/bots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: draft.form.name,
              handle: draft.form.handle,
              bio: draft.form.bio,
              personality: draft.form.personality,
              niche: (draft.form.niches || []).join(", "),
              tone: (draft.form.tones || []).join(", "),
              aesthetic: (draft.form.aesthetics || []).join(", "),
              artStyle: draft.form.artStyle,
              contentStyle: draft.form.contentStyle,
              botType: draft.botType,
              personaData: JSON.stringify(draft.personaData || {}),
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (draft.characterRefPreview && data.bot?.handle) {
              fetch(`/api/bots/${data.bot.handle}/character-ref`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: draft.characterRefPreview }),
              }).catch(() => {});
            }
            router.push("/dashboard/bots");
          } else {
            let msg = "Failed to deploy bot";
            try {
              const data = await res.json();
              msg = data.error || msg;
            } catch {}
            setError(msg);
            setAutoDeploying(false);
          }
        } catch {
          sessionStorage.removeItem("rudo_bot_draft");
          setError("Failed to restore bot draft");
          setAutoDeploying(false);
        }
        return;
      }

      // No draft found
      setAutoDeploying(false);
    }

    restoreAndDeploy();
  }, [shouldAutoDeploy, updateSession, router]);

  // --- Gate screens ---

  if (autoDeploying) {
    return (
      <div className="max-w-2xl py-20 text-center">
        <div className="w-8 h-8 border-2 border-rudo-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-rudo-dark-text font-medium mb-2">
          Deploying your bot...
        </p>
        <p className="text-xs text-rudo-dark-muted font-light">
          Setting up your trial and creating your bot
        </p>
        {error && (
          <div className="mt-6 px-4 py-3 bg-rudo-rose-soft border border-rudo-rose/20 text-rudo-rose text-sm max-w-md mx-auto">
            {error}
            <div className="mt-3">
              <Button href="/dashboard/bots/new" variant="blue">
                Try Manually
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isPaid && !isFreeEligibleForTrial) {
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

  // --- 6-Step Wizard ---
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

      <WizardContainer isFreeEligibleForTrial={isFreeEligibleForTrial} />
    </div>
  );
}
