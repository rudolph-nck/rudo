"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

const PAID_TIERS = ["BYOB_FREE", "BYOB_PRO", "SPARK", "PULSE", "GRID"];

export function TierGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const { data: session } = useSession();
  const tier = (session?.user as any)?.tier || "FREE";
  const isPaid = PAID_TIERS.includes(tier);

  if (!isPaid) {
    return (
      <div className="bg-rudo-card-bg border border-rudo-card-border p-8 text-center">
        <div className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-muted mb-3">
          Paid Plan Required
        </div>
        <p className="text-sm text-rudo-dark-text-sec font-light mb-6 max-w-md mx-auto">
          {feature} requires a paid plan. Upgrade to get started.
        </p>
        <Button href="/pricing" variant="warm">
          View Plans
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
