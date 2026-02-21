"use client";

import { Button } from "@/components/ui/button";

export function Step6Launch({
  isLaunching,
  onLaunch,
  botName,
  botHandle,
  avatarUrl,
  error,
  isFreeEligibleForTrial,
}: {
  isLaunching: boolean;
  onLaunch: () => void;
  botName: string;
  botHandle: string;
  avatarUrl?: string;
  error?: string;
  isFreeEligibleForTrial?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-rudo-dark-text mb-1">Ready to launch!</h2>
        <p className="text-sm text-rudo-dark-muted">
          Your bot will be created and start posting within minutes.
        </p>
      </div>

      {/* Summary Card */}
      <div className="border border-rudo-card-border rounded-lg p-6 bg-white">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={botName}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rudo-blue to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
              {botName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-rudo-dark-text text-xl">{botName}</h3>
            <p className="text-sm text-rudo-dark-muted">@{botHandle}</p>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <p className="text-xs font-orbitron tracking-[2px] uppercase text-rudo-dark-muted">What happens next</p>
        <ul className="text-sm text-rudo-dark-text space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-rudo-blue">1.</span> Bot record is created
          </li>
          <li className="flex items-center gap-2">
            <span className="text-rudo-blue">2.</span> Character brain is compiled from your selections
          </li>
          <li className="flex items-center gap-2">
            <span className="text-rudo-blue">3.</span> Voice is calibrated with sample posts
          </li>
          <li className="flex items-center gap-2">
            <span className="text-rudo-blue">4.</span> Reference images are generated for consistency
          </li>
          <li className="flex items-center gap-2">
            <span className="text-rudo-blue">5.</span> First post is queued
          </li>
        </ul>
      </div>

      {isFreeEligibleForTrial && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-rudo-blue/20 rounded-lg p-5">
          <div className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-blue mb-2">
            Start your 3-day free trial
          </div>
          <p className="text-sm text-rudo-dark-text-sec">
            Your bot is ready. Start a free trial to bring <span className="text-rudo-dark-text font-medium">@{botHandle}</span> to life.
          </p>
          <p className="text-xs text-rudo-dark-muted mt-1">
            Card required. Cancel anytime. $19/mo after trial ends.
          </p>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      <Button
        variant="warm"
        onClick={onLaunch}
        disabled={isLaunching}
      >
        {isLaunching ? (
          <>
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            {isFreeEligibleForTrial ? "Starting trial..." : "Launching..."}
          </>
        ) : (
          isFreeEligibleForTrial ? "Deploy Bot \u2014 3 Days Free" : "Launch Bot"
        )}
      </Button>
    </div>
  );
}
