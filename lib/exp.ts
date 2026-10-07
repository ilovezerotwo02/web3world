// ---------------------------------------------------------------------------
// EXP & Level System
// ---------------------------------------------------------------------------

/** EXP reward amounts for various actions. */
export const EXP_REWARDS = {
  /** Starting a course (seed granted) */
  START_COURSE: 10,
  /** Clearing the land */
  CLEAR_LAND: 5,
  /** Planting the seed */
  PLANT: 5,
  /** Per chapter read */
  CHAPTER_READ: 10,
  /** Per challenge passed */
  CHALLENGE_PASSED: 20,
  /** Perfect challenge (no mistakes) */
  CHALLENGE_PERFECT: 5,
  /** Final quiz passed */
  VERIFICATION_PASSED: 50,
  /** Course completed / harvest */
  HARVEST: 100,
  /** First wallet binding */
  BIND_WALLET: 15,
} as const;

/**
 * Level thresholds (cumulative EXP required to reach each level).
 * Level 1 → 0 EXP, Level 2 → 100 EXP, …
 */
export const LEVEL_THRESHOLDS: number[] = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  800,    // Level 5
  1200,   // Level 6
  1700,   // Level 7
  2300,   // Level 8
  3000,   // Level 9
  4000,   // Level 10
];

/**
 * Calculate the level for a given total EXP.
 * Returns a value between 1 and LEVEL_THRESHOLDS.length.
 */
export function calculateLevel(totalExp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalExp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Calculate EXP needed to reach the next level.
 * Returns 0 if already at max level.
 */
export function expToNextLevel(totalExp: number): number {
  const currentLevel = calculateLevel(totalExp);
  if (currentLevel >= LEVEL_THRESHOLDS.length) return 0;
  return LEVEL_THRESHOLDS[currentLevel] - totalExp;
}

/**
 * Get the EXP range for the current level.
 */
export function levelRange(currentLevel: number): { min: number; max: number } {
  const idx = Math.min(currentLevel - 1, LEVEL_THRESHOLDS.length - 1);
  const min = LEVEL_THRESHOLDS[idx];
  const max = idx + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[idx + 1] : min;
  return { min, max };
}

/**
 * Calculate EXP for a given course progress state.
 * Mirrors the frontend calculateExp() logic.
 */
export function calculateCourseExp(params: {
  chaptersRead: [boolean, boolean, boolean];
  challengePassed: [boolean, boolean, boolean];
  challengeMistakes: [boolean, boolean, boolean];
  verification: string;
  harvested: boolean;
}): number {
  const theory = params.chaptersRead.filter(Boolean).length * EXP_REWARDS.CHAPTER_READ;
  const challenges = params.challengePassed.filter(Boolean).length * EXP_REWARDS.CHALLENGE_PASSED;
  const perfect = params.challengePassed.reduce(
    (total, passed, i) => total + (passed && !params.challengeMistakes[i] ? EXP_REWARDS.CHALLENGE_PERFECT : 0),
    0,
  );
  const verification = params.verification === "passed" ? EXP_REWARDS.VERIFICATION_PASSED : 0;
  const harvest = params.harvested ? EXP_REWARDS.HARVEST : 0;
  return theory + challenges + perfect + verification + harvest;
}