import { useEffect, useState } from "react";
import { cancelFrame, requestFrame } from "./animation-frame";

export type WorldPhase = "dawn" | "day" | "dusk" | "night";

export type WorldClock = {
  minutes: number;
  label: string;
  phase: WorldPhase;
  phaseLabel: string;
  isNight: boolean;
  daylight: number;
  twilight: number;
  celestialBody: "sun" | "moon";
  celestialX: number;
  celestialY: number;
  sunX: number;
  sunY: number;
  sunOpacity: number;
  moonX: number;
  moonY: number;
  moonOpacity: number;
};

// One real day maps to 24 seconds in the world. Daylight is continuous;
// the phase label is only a readable summary for the HUD.
export const WORLD_DAY_DURATION_MS = 24_000;
export const WORLD_CLOCK_START_MINUTES = 6 * 60;

// World pixels, anchored to the original map's sky above the mountain ridge.
export const WORLD_SKY_ORBIT = {
  left: 650,
  right: 1010,
  horizonY: 142,
  peakY: 108,
} as const;

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

export function daylightAt(minutes: number) {
  const normalized = normalizeMinutes(minutes);
  const sunrise = 5 * 60;
  const sunset = 19 * 60;
  if (normalized <= sunrise || normalized >= sunset) return 0;
  return Math.max(0, Math.sin(((normalized - sunrise) / (sunset - sunrise)) * Math.PI));
}

export function celestialPositionAt(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const isDay = normalized >= 5 * 60 && normalized < 19 * 60;
  const sunProgress = Math.max(0, Math.min(1, (normalized - 5 * 60) / (14 * 60)));
  const moonProgress = Math.max(
    0,
    Math.min(1, normalized >= 19 * 60
      ? (normalized - 19 * 60) / (10 * 60)
      : (normalized + 5 * 60) / (10 * 60)),
  );
  const sunArc = Math.sin(sunProgress * Math.PI);
  const moonArc = Math.sin(moonProgress * Math.PI);
  const smoothstep = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const orbitWidth = WORLD_SKY_ORBIT.right - WORLD_SKY_ORBIT.left;
  const orbitHeight = WORLD_SKY_ORBIT.horizonY - WORLD_SKY_ORBIT.peakY;
  const sunX = WORLD_SKY_ORBIT.left + sunProgress * orbitWidth;
  const moonX = WORLD_SKY_ORBIT.left + moonProgress * orbitWidth;
  const sunY = WORLD_SKY_ORBIT.horizonY - sunArc * orbitHeight;
  const moonY = WORLD_SKY_ORBIT.horizonY - moonArc * orbitHeight;
  const sunOpacity =
    smoothstep((normalized - 5 * 60) / (2 * 60)) *
    (1 - smoothstep((normalized - 18 * 60) / 60));
  const moonOpacity = normalized >= 18 * 60
    ? smoothstep((normalized - 18 * 60) / (2 * 60))
    : normalized <= 6 * 60
      ? smoothstep((6 * 60 - normalized) / (2 * 60))
      : 0;
  const showSun = isDay;
  return {
    body: showSun ? "sun" as const : "moon" as const,
    x: showSun ? sunX : moonX,
    y: showSun ? sunY : moonY,
    sunX,
    sunY,
    sunOpacity,
    moonX,
    moonY,
    moonOpacity,
  };
}

function twilightAt(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const distanceFromDawn = Math.abs(normalized - 6 * 60);
  const distanceFromDusk = Math.abs(normalized - 18 * 60);
  return Math.max(0, 1 - Math.min(distanceFromDawn, distanceFromDusk) / 120);
}

function clockVisuals(minutes: number) {
  const celestial = celestialPositionAt(minutes);
  return {
    daylight: daylightAt(minutes),
    twilight: twilightAt(minutes),
    celestialBody: celestial.body,
    celestialX: celestial.x,
    celestialY: celestial.y,
    sunX: celestial.sunX,
    sunY: celestial.sunY,
    sunOpacity: celestial.sunOpacity,
    moonX: celestial.moonX,
    moonY: celestial.moonY,
    moonOpacity: celestial.moonOpacity,
  };
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
    ...clockVisuals(minutes),
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
    ...clockVisuals(minutes),
  };
}

export function useWorldClock(forcedPhase?: WorldPhase | null): WorldClock {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (forcedPhase) return;
    const startedAt = Date.now();
    const frame = requestFrame(() => {
      setElapsedMs(Date.now() - startedAt);
    });
    const update = () => setElapsedMs(Date.now() - startedAt);
    const timer = window.setInterval(update, 100);
    return () => {
      cancelFrame(frame);
      window.clearInterval(timer);
    };
  }, [forcedPhase]);

  return forcedPhase ? worldClockForPhase(forcedPhase) : worldClockAt(elapsedMs);
}
