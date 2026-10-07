// ---------------------------------------------------------------------------
// 进度状态机 - 共享类型和 Reducer
// 注：用于前端和后端共享，确保状态流转一致
// ---------------------------------------------------------------------------

export type VerificationMethod = "none" | "audit" | "quiz" | "passed";

export type FarmProgress = {
  version: 1;
  started: boolean;
  seedGranted: boolean;
  landCleared: boolean;
  planted: boolean;
  chaptersRead: [boolean, boolean, boolean];
  challengePassed: [boolean, boolean, boolean];
  challengeMistakes: [boolean, boolean, boolean];
  verification: VerificationMethod;
  harvested: boolean;
  recentActivity: string[];
};

export type ProgressAction =
  | { type: "start-course" }
  | { type: "clear-land" }
  | { type: "plant" }
  | { type: "complete-theory"; chapter: number }
  | { type: "challenge-mistake"; chapter: number }
  | { type: "complete-challenge"; chapter: number }
  | { type: "start-quiz" }
  | { type: "pass-verification" }
  | { type: "harvest" }
  | { type: "reset" };

export const initialProgress: FarmProgress = {
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

export function progressReducer(
  progress: FarmProgress,
  action: ProgressAction,
): FarmProgress {
  switch (action.type) {
    case "start-course":
      if (progress.started) return progress;
      return {
        ...progress,
        started: true,
        seedGranted: true,
        recentActivity: addActivity(progress, "获得 Web3 通识课程种子"),
      };
    case "clear-land":
      if (!progress.seedGranted || progress.landCleared) return progress;
      return {
        ...progress,
        landCleared: true,
        recentActivity: addActivity(progress, "开垦第 1 格 Web3 通识课程田"),
      };
    case "plant":
      if (!progress.landCleared || progress.planted) return progress;
      return {
        ...progress,
        planted: true,
        recentActivity: addActivity(progress, "播下账本星种"),
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
            ? "完成全部理论，知识种子已经发芽"
            : `完成第 ${action.chapter + 1} 章理论`,
        ),
      };
    }
    case "challenge-mistake":
      return {
        ...progress,
        challengeMistakes: setTupleValue(
          progress.challengeMistakes,
          action.chapter,
          true,
        ),
      };
    case "complete-challenge": {
      if (
        !progress.chaptersRead.every(Boolean) ||
        progress.challengePassed[action.chapter]
      ) {
        return progress;
      }
      const challengePassed = setTupleValue(
        progress.challengePassed,
        action.chapter,
        true,
      );
      return {
        ...progress,
        challengePassed,
        recentActivity: addActivity(
          progress,
          challengePassed.every(Boolean)
            ? "完成全部章节挑战，知识作物已经开花"
            : `通过第 ${action.chapter + 1} 章挑战`,
        ),
      };
    }
    case "start-quiz":
      if (!progress.challengePassed.every(Boolean) || progress.verification !== "none") {
        return progress;
      }
      return { ...progress, verification: "quiz" };
    case "pass-verification":
      if (!progress.challengePassed.every(Boolean) || progress.verification === "passed") {
        return progress;
      }
      return {
        ...progress,
        verification: "passed",
        recentActivity: addActivity(progress, "结课验证通过，知识作物已经结果"),
      };
    case "harvest":
      if (progress.verification !== "passed" || progress.harvested) return progress;
      return {
        ...progress,
        harvested: true,
        recentActivity: addActivity(progress, "收获守护浆果并解锁 Monad 基础"),
      };
    case "reset":
      return initialProgress;
  }
}

export function calculateExp(progress: FarmProgress): number {
  const theory = progress.chaptersRead.filter(Boolean).length * 10;
  const challenges = progress.challengePassed.filter(Boolean).length * 20;
  const perfect = progress.challengePassed.reduce(
    (total, passed, index) =>
      total + (passed && !progress.challengeMistakes[index] ? 5 : 0),
    0,
  );
  const verification = progress.verification === "passed" ? 50 : 0;
  const harvest = progress.harvested ? 100 : 0;
  return theory + challenges + perfect + verification + harvest;
}

export type GrowthStage =
  | "等待开启"
  | "种子入袋"
  | "等待播种"
  | "已播种"
  | "已经发芽"
  | "已经开花"
  | "已经结果"
  | "已经收获";

export type FieldVisualStage =
  | "wild"
  | "tilled"
  | "seeded"
  | "sprout"
  | "bloom"
  | "fruit"
  | "harvested";

export const FIELD_STAGE_ORDER: FieldVisualStage[] = [
  "wild",
  "tilled",
  "seeded",
  "sprout",
  "bloom",
  "fruit",
  "harvested",
];

export const FIELD_STAGE_LABELS: Record<FieldVisualStage, string> = {
  wild: "未开荒",
  tilled: "已开荒",
  seeded: "已播种",
  sprout: "已发芽",
  bloom: "已开花",
  fruit: "已结果",
  harvested: "已收获",
};

export function growthStage(progress: FarmProgress): GrowthStage {
  if (progress.harvested) return "已经收获";
  if (progress.verification === "passed") return "已经结果";
  if (progress.challengePassed.every(Boolean)) return "已经开花";
  if (progress.chaptersRead.every(Boolean)) return "已经发芽";
  if (progress.planted) return "已播种";
  if (progress.landCleared) return "等待播种";
  if (progress.seedGranted) return "种子入袋";
  return "等待开启";
}

export function fieldVisualStage(progress: FarmProgress): FieldVisualStage {
  if (progress.harvested) return "harvested";
  if (progress.verification === "passed") return "fruit";
  if (progress.challengePassed.every(Boolean)) return "bloom";
  if (progress.chaptersRead.every(Boolean)) return "sprout";
  if (progress.planted) return "seeded";
  if (progress.landCleared) return "tilled";
  return "wild";
}

export function readStoredProgress(value: string | null): FarmProgress {
  if (!value) return initialProgress;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isFarmProgress(parsed)) return initialProgress;
    return parsed;
  } catch {
    return initialProgress;
  }
}

function isBooleanTuple(value: unknown): value is [boolean, boolean, boolean] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "boolean")
  );
}

export function isFarmProgress(value: unknown): value is FarmProgress {
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
    (record.verification === "none" ||
      record.verification === "audit" ||
      record.verification === "quiz" ||
      record.verification === "passed") &&
    typeof record.harvested === "boolean" &&
    Array.isArray(record.recentActivity) &&
    record.recentActivity.every((item) => typeof item === "string")
  );
}

export function isCompletedFarmProgress(progress: FarmProgress): boolean {
  return Boolean(
    progress.started &&
      progress.seedGranted &&
      progress.landCleared &&
      progress.planted &&
      progress.chaptersRead.every(Boolean) &&
      progress.challengePassed.every(Boolean) &&
      progress.verification === "passed" &&
      progress.harvested,
  );
}
