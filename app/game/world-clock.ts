import { useEffect, useState } from "react";

export type WorldPhase = "dawn" | "day" | "dusk" | "night";

export type WorldClock = {
  minutes: number;
  label: string;
  phase: WorldPhase;
  phaseLabel: string;
  isNight: boolean;
};

// A complete in-game day lasts one minute: roughly 25 seconds of daytime,
// a short dusk/dawn transition, and roughly 25 seconds of night.
export const WORLD_DAY_DURATION_MS = 60_000;
export const WORLD_CLOCK_START_MINUTES = 6 * 60;

function normalizeMinutes(value: number) {
  return ((Math.floor(value) % 1440) + 1440) % 1440;
}

export function worldPhaseAt(minutes: number): WorldPhase {
  const normalized = normalizeMinutes(minutes);
  if (normalized >= 5 * 60 && normalized < 7 * 60) return "dawn";
  if (normalized >= 7 * 60 && normalized < 17 * 60) return "day";
  if (normalized >= 17 * 60 && normalized < 19 * 60) return "dusk";
  return "night";
}

export function worldPhaseLabel(phase: WorldPhase) {
  return {
    dawn: "黎明",
    day: "白天",
    dusk: "黄昏",
    night: "黑夜",
  }[phase];
}

export function worldClockAt(
  elapsedMs: number,
  cycleMs = WORLD_DAY_DURATION_MS,
): WorldClock {
  const safeCycle = Number.isFinite(cycleMs) && cycleMs > 0 ? cycleMs : WORLD_DAY_DURATION_MS;
  const progress = ((elapsedMs % safeCycle) + safeCycle) % safeCycle;
  const minutes = normalizeMinutes(
    WORLD_CLOCK_START_MINUTES + (progress / safeCycle) * 1440,
  );
  const phase = worldPhaseAt(minutes);
  const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return {
    minutes,
    label: `${hour}:${minute}`,
    phase,
    phaseLabel: worldPhaseLabel(phase),
    isNight: phase === "night",
  };
}

export function worldClockForPhase(phase: WorldPhase): WorldClock {
  const minutes = phase === "night"
    ? 23 * 60
    : phase === "dusk"
      ? 18 * 60
      : phase === "dawn"
        ? 6 * 60
        : 12 * 60;
  return {
    minutes,
    label: `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`,
    phase,
    phaseLabel: worldPhaseLabel(phase),
    isNight: phase === "night",
  };
}

export function useWorldClock(forcedPhase?: WorldPhase | null): WorldClock {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (forcedPhase) return;
    const startedAt = Date.now();
    const frame = window.requestAnimationFrame(() => {
      setElapsedMs(Date.now() - startedAt);
    });
    const update = () => setElapsedMs(Date.now() - startedAt);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [forcedPhase]);

  return forcedPhase ? worldClockForPhase(forcedPhase) : worldClockAt(elapsedMs);
}
