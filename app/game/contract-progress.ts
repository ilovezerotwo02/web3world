import type { FarmProgress, ProgressAction } from "./progress";

export const CONTRACT_PROGRESS_STORAGE_KEY = "monad-pixel-farm:v35:contract-progress";

export const initialContractProgress: FarmProgress = {
  version: 1,
  started: false,
  seedGranted: false,
  landCleared: false,
  planted: false,
  chaptersRead: [false, false, false],
  challengePassed: [false, false, false],
  challengeMistakes: [false, false, false],
  verification: "none",
  harvested: false,
  recentActivity: [],
};

function addActivity(progress: FarmProgress, message: string): string[] {
  if (progress.recentActivity[0] === message) return progress.recentActivity;
  return [message, ...progress.recentActivity].slice(0, 4);
}

function setTupleValue(
  values: [boolean, boolean, boolean],
  index: number,
  value: boolean,
): [boolean, boolean, boolean] {
  if (index < 0 || index > 2 || values[index] === value) return values;
  const next: [boolean, boolean, boolean] = [...values];
  next[index] = value;
  return next;
}

export function contractProgressReducer(progress: FarmProgress, action: ProgressAction): FarmProgress {
  switch (action.type) {
    case "start-course":
      if (progress.started) return progress;
      return {
        ...progress,
        started: true,
        seedGranted: true,
        recentActivity: addActivity(progress, "获得智能合约课程种子"),
      };
    case "clear-land":
      if (!progress.seedGranted || progress.landCleared) return progress;
      return {
        ...progress,
        landCleared: true,
        recentActivity: addActivity(progress, "开垦第 3 格智能合约课程田"),
      };
    case "plant":
      if (!progress.landCleared || progress.planted) return progress;
      return {
        ...progress,
        planted: true,
        recentActivity: addActivity(progress, "播下合约卷轴种"),
      };
    case "complete-theory": {
      if (!progress.planted || progress.chaptersRead[action.chapter]) return progress;
      const chaptersRead = setTupleValue(progress.chaptersRead, action.chapter, true);
      return {
        ...progress,
        chaptersRead,
        recentActivity: addActivity(
          progress,
          chaptersRead.every(Boolean)
            ? "完成智能合约全部理论，合约卷轴种已经发芽"
            : `完成智能合约第 ${action.chapter + 1} 章理论`,
        ),
      };
    }
    case "challenge-mistake":
      return {
        ...progress,
        challengeMistakes: setTupleValue(progress.challengeMistakes, action.chapter, true),
      };
    case "complete-challenge": {
      if (!progress.chaptersRead.every(Boolean) || progress.challengePassed[action.chapter]) return progress;
      const challengePassed = setTupleValue(progress.challengePassed, action.chapter, true);
      return {
        ...progress,
        challengePassed,
        recentActivity: addActivity(
          progress,
          challengePassed.every(Boolean)
            ? "完成智能合约全部挑战，合约晶花已经开放"
            : `通过智能合约第 ${action.chapter + 1} 章挑战`,
        ),
      };
    }
    case "start-quiz":
      if (!progress.challengePassed.every(Boolean) || progress.verification !== "none") return progress;
      return { ...progress, verification: "quiz" };
    case "pass-verification":
      if (!progress.challengePassed.every(Boolean) || progress.verification === "passed") return progress;
      return {
        ...progress,
        verification: "passed",
        recentActivity: addActivity(progress, "智能合约结课验证通过，合约卷轴种已经结果"),
      };
    case "harvest":
      if (progress.verification !== "passed" || progress.harvested) return progress;
      return {
        ...progress,
        harvested: true,
        recentActivity: addActivity(progress, "收获合约晶果并完成三门首发课程"),
      };
    case "reset":
      return initialContractProgress;
  }
}

export function calculateContractExp(progress: FarmProgress): number {
  const theory = progress.chaptersRead.filter(Boolean).length * 10;
  const challenges = progress.challengePassed.filter(Boolean).length * 20;
  const perfect = progress.challengePassed.reduce(
    (total, passed, index) => total + (passed && !progress.challengeMistakes[index] ? 5 : 0),
    0,
  );
  const verification = progress.verification === "passed" ? 50 : 0;
  const harvest = progress.harvested ? 100 : 0;
  return theory + challenges + perfect + verification + harvest;
}

function isBooleanTuple(value: unknown): value is [boolean, boolean, boolean] {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "boolean");
}

function isContractProgress(value: unknown): value is FarmProgress {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.started === "boolean" &&
    typeof record.seedGranted === "boolean" &&
    typeof record.landCleared === "boolean" &&
    typeof record.planted === "boolean" &&
    isBooleanTuple(record.chaptersRead) &&
    isBooleanTuple(record.challengePassed) &&
    isBooleanTuple(record.challengeMistakes) &&
    (record.verification === "none" || record.verification === "quiz" || record.verification === "passed") &&
    typeof record.harvested === "boolean" &&
    Array.isArray(record.recentActivity) &&
    record.recentActivity.every((item) => typeof item === "string")
  );
}

export function readStoredContractProgress(value: string | null): FarmProgress {
  if (!value) return initialContractProgress;
  try {
    const parsed: unknown = JSON.parse(value);
    return isContractProgress(parsed) ? parsed : initialContractProgress;
  } catch {
    return initialContractProgress;
  }
}
