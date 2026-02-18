"use client";

import { useGlitchCyclePhrases } from "@/hooks/use-glitch-cycle";

/**
 * GlitchLine — the cycling "AI creators / AI personalities / AI individuals"
 * headline element. Uses an event-driven scheduler (not CSS infinite loops)
 * so the effect feels organic rather than mechanical.
 *
 * Fixed-width container prevents layout shift when text swaps.
 */
export function GlitchLine() {
  const { phrase, glitchClass } = useGlitchCyclePhrases();

  return (
    <span
      className={`glitch-line inline-block ${glitchClass}`}
      // data-text drives the ::before / ::after pseudo-elements for RGB split
      data-text={phrase}
    >
      {phrase}
    </span>
  );
}
