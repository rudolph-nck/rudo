"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Phrases ────────────────────────────────────────────────────────────────
const PHRASES = ["AI creators", "AI personalities", "AI individuals"] as const;
type Phrase = (typeof PHRASES)[number];

const DEFAULT_HOME: Phrase = "AI individuals";

// ─── Timing constants (ms) — tweak these to taste ──────────────────────────
const BOOT_HEAVY_GLITCH_MS = 300;
const BOOT_SWAP_PHASE_MS = 900; // swaps happen within this window after heavy phase
const BOOT_SWAP_COUNT_FIRST = [3, 4]; // [min, max] swaps on first visit
const BOOT_SWAP_COUNT_RETURN = [2, 3]; // fewer on return visits

const STABLE_WAIT_MIN_MS = 6_000;
const STABLE_WAIT_MAX_MS = 22_000;

const MICRO_FLICKER_DURATION_MIN = 40;
const MICRO_FLICKER_DURATION_MAX = 90;

const QUICK_SWAP_DURATION_MIN = 80;
const QUICK_SWAP_DURATION_MAX = 150;

const HARD_GLITCH_DURATION_MIN = 120;
const HARD_GLITCH_DURATION_MAX = 220;
const HARD_GLITCH_COOLDOWN_MIN = 10_000;
const HARD_GLITCH_COOLDOWN_MAX = 40_000;

const IDENTITY_SHIFT_MIN_STABLE_MS = 20_000;

const STORAGE_KEY = "rudo_glitch_visits";

// ─── Helpers ────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick a phrase that isn't the current one, avoiding sequential cycling */
function pickOther(current: Phrase, lastSwappedTo: Phrase | null): Phrase {
  const others = PHRASES.filter((p) => p !== current);
  // If we swapped to one before, prefer the other to avoid A→B→A→B patterns
  if (lastSwappedTo && others.length > 1) {
    const preferred = others.filter((p) => p !== lastSwappedTo);
    if (preferred.length > 0 && Math.random() > 0.3) return pick(preferred);
  }
  return pick(others);
}

// ─── Event types with weights ───────────────────────────────────────────────
type EventType = "micro" | "quick_swap" | "hard_glitch" | "identity_shift";

function rollEvent(
  lastEvent: EventType | null,
  stableSinceMs: number,
): EventType {
  // Weighted random: micro 70%, quick 20%, hard 9%, identity 1%
  const r = Math.random();
  let chosen: EventType;

  if (r < 0.7) chosen = "micro";
  else if (r < 0.9) chosen = "quick_swap";
  else if (r < 0.99) chosen = "hard_glitch";
  else chosen = "identity_shift";

  // Identity shift only if stable long enough
  if (chosen === "identity_shift" && stableSinceMs < IDENTITY_SHIFT_MIN_STABLE_MS) {
    chosen = "micro";
  }

  // Never repeat the same non-micro event twice in a row
  if (chosen !== "micro" && chosen === lastEvent) {
    chosen = "micro";
  }

  return chosen;
}

// ─── CSS class names (defined in globals.css) ───────────────────────────────
export const GLITCH_CLASS_HEAVY = "glitch-heavy";
export const GLITCH_CLASS_MICRO = "glitch-micro";
export const GLITCH_CLASS_HARD = "glitch-hard";

// ─── Hook ───────────────────────────────────────────────────────────────────
export interface GlitchState {
  phrase: Phrase;
  glitchClass: string; // active CSS class or ""
  booting: boolean;
}

export function useGlitchCyclePhrases(): GlitchState {
  const [phrase, setPhrase] = useState<Phrase>(DEFAULT_HOME);
  const [glitchClass, setGlitchClass] = useState("");
  const [booting, setBooting] = useState(true);

  // Mutable refs to avoid stale closures in timers
  const homeRef = useRef<Phrase>(DEFAULT_HOME);
  const lastEventRef = useRef<EventType | null>(null);
  const lastSwappedToRef = useRef<Phrase | null>(null);
  const stableSinceRef = useRef(Date.now());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Stable → disturbance loop ──────────────────────────────────────────
  const scheduleNext = useCallback(() => {
    // Extra cooldown after hard glitch
    const extra =
      lastEventRef.current === "hard_glitch"
        ? rand(HARD_GLITCH_COOLDOWN_MIN, HARD_GLITCH_COOLDOWN_MAX)
        : 0;

    const wait = rand(STABLE_WAIT_MIN_MS, STABLE_WAIT_MAX_MS) + extra;

    schedule(() => {
      const stableFor = Date.now() - stableSinceRef.current;
      const event = rollEvent(lastEventRef.current, stableFor);
      lastEventRef.current = event;

      switch (event) {
        case "micro": {
          // Tiny RGB-split / opacity jitter — no text change
          const dur = rand(MICRO_FLICKER_DURATION_MIN, MICRO_FLICKER_DURATION_MAX);
          setGlitchClass(GLITCH_CLASS_MICRO);
          schedule(() => {
            setGlitchClass("");
            stableSinceRef.current = Date.now();
            scheduleNext();
          }, dur);
          break;
        }

        case "quick_swap": {
          // Flash a different phrase briefly, then revert
          const dur = rand(QUICK_SWAP_DURATION_MIN, QUICK_SWAP_DURATION_MAX);
          const other = pickOther(homeRef.current, lastSwappedToRef.current);
          lastSwappedToRef.current = other;
          setPhrase(other);
          setGlitchClass(GLITCH_CLASS_MICRO);
          schedule(() => {
            setPhrase(homeRef.current);
            setGlitchClass("");
            stableSinceRef.current = Date.now();
            scheduleNext();
          }, dur);
          break;
        }

        case "hard_glitch": {
          // Heavy distortion burst with text swap, then revert
          const dur = rand(HARD_GLITCH_DURATION_MIN, HARD_GLITCH_DURATION_MAX);
          const other = pickOther(homeRef.current, lastSwappedToRef.current);
          lastSwappedToRef.current = other;
          setPhrase(other);
          setGlitchClass(GLITCH_CLASS_HARD);
          schedule(() => {
            setPhrase(homeRef.current);
            setGlitchClass("");
            stableSinceRef.current = Date.now();
            scheduleNext();
          }, dur);
          break;
        }

        case "identity_shift": {
          // Permanently change the home phrase for this session
          const other = pickOther(homeRef.current, lastSwappedToRef.current);
          lastSwappedToRef.current = other;
          homeRef.current = other;
          // Brief hard glitch to mark the transition
          setGlitchClass(GLITCH_CLASS_HARD);
          schedule(() => {
            setPhrase(other);
            setGlitchClass("");
            stableSinceRef.current = Date.now();
            scheduleNext();
          }, rand(HARD_GLITCH_DURATION_MIN, HARD_GLITCH_DURATION_MAX));
          break;
        }
      }
    }, wait);
  }, [schedule]);

  // ── Boot sequence ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Session memory: check visit count
    let isFirstVisit = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const visits = raw ? parseInt(raw, 10) : 0;
      isFirstVisit = visits < 1;
      localStorage.setItem(STORAGE_KEY, String(visits + 1));
    } catch {
      // localStorage unavailable (private browsing, etc.) — treat as first
    }

    const swapRange = isFirstVisit ? BOOT_SWAP_COUNT_FIRST : BOOT_SWAP_COUNT_RETURN;
    const swapCount = rand(swapRange[0], swapRange[1]);

    // Phase 1: heavy glitch on whatever phrase
    setGlitchClass(GLITCH_CLASS_HEAVY);
    setPhrase(pick(PHRASES));

    // Phase 2: rapid swaps
    const swapStart = isFirstVisit ? BOOT_HEAVY_GLITCH_MS : 200;
    const swapWindow = isFirstVisit ? BOOT_SWAP_PHASE_MS : 600;
    const swapInterval = Math.floor(swapWindow / swapCount);

    for (let i = 0; i < swapCount; i++) {
      schedule(() => {
        setPhrase(pick(PHRASES));
        // Alternate between heavy and micro for visual texture
        setGlitchClass(i % 2 === 0 ? GLITCH_CLASS_HEAVY : GLITCH_CLASS_MICRO);
      }, swapStart + i * swapInterval);
    }

    // Phase 3: settle on home phrase
    const settleTime = swapStart + swapWindow + 100;
    schedule(() => {
      setPhrase(DEFAULT_HOME);
      setGlitchClass("");
      setBooting(false);
      stableSinceRef.current = Date.now();
      scheduleNext();
    }, settleTime);

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { phrase, glitchClass, booting };
}
