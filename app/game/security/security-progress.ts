import { LABS, SECURITY_SCENARIOS } from "../../../lib/security/scenarios";
import { isPassportEligible } from "../../../lib/security/passport";
import type {
  FinalAuditProgress,
  GreenhouseStage,
  ScenarioProgress,
  SecurityProgress,
} from "./types";

export const SECURITY_PROGRESS_STORAGE_KEY = "monad-pixel-farm:v1:security-progress";
export const SECURITY_TRACK_VERSION = "2026.1";

export const initialSecurityProgress: SecurityProgress = {
  version: 1,
  unlocked: false,
  scenarios: {},
  finalAudit: {
    status: "pending",
    score: 0,
    reportId: null,
    reportHash: null,
    completedAt: null,
    falsePositivePenalty: 0,
  },
  labsPassed: [false, false, false],
  badgeEligible: false,
  updatedAt: "",
};

export type SecurityAction =
  | { type: "reset" }
  | { type: "unlock" }
  | { type: "start-scenario"; scenarioId: string }
  | { type: "set-step"; scenarioId: string; step: string }
  | { type: "complete-scenario"; scenarioId: string; score: number; passed: boolean; synced?: boolean }
  | { type: "mark-synced"; scenarioId: string }
  | {
      type: "complete-audit";
      score: number;
      passed: boolean;
      reportId: string | null;
      reportHash: string | null;
      falsePositivePenalty: number;
    };

export function securityLabPassed(progress: SecurityProgress, labIndex: number): boolean {
  const lab = LABS[labIndex];
  if (!lab) return false;
  return lab.scenarioIds.every((scenarioId) => progress.scenarios[scenarioId]?.status === "passed");
}

export function securityLabStage(progress: SecurityProgress): GreenhouseStage {
  if (!progress.unlocked) return "locked";
  const allPassed = LABS.every((_, index) => securityLabPassed(progress, index));
  if (allPassed && progress.finalAudit.status === "passed") return "fully-powered";
  if (securityLabPassed(progress, 0) && !allPassed) return "frame-repaired";
  if (allPassed) return "secured";
  return "ruined";
}

export const GREENHOUSE_STAGE_COPY: Record<GreenhouseStage, { label: string; detail: string }> = {
  locked: { label: "锁定", detail: "完成智能合约课程并收获果实后解锁安全温室" },
  ruined: { label: "废弃", detail: "安全温室已解锁，先完成 Lab 1 建立第一层防线" },
  "frame-repaired": { label: "修复骨架", detail: "外部调用不再能重复闯入温室控制系统" },
  secured: { label: "玻璃与门锁已修复", detail: "权限与签名防线已建立，进入最终综合审计" },
  "fully-powered": { label: "完全点亮", detail: "安全能力凭证条件全部满足" },
};

export const GREENHOUSE_STAGE_FRAME: Record<GreenhouseStage, number> = {
  locked: 0,
  ruined: 0,
  "frame-repaired": 1,
  secured: 1,
  "fully-powered": 2,
};

function recomputeLabs(progress: SecurityProgress): [boolean, boolean, boolean] {
  return [0, 1, 2].map((index) => securityLabPassed(progress, index)) as [
    boolean,
    boolean,
    boolean,
  ];
}

function withLabs(progress: SecurityProgress): SecurityProgress {
  const labsPassed = recomputeLabs(progress);
  const eligibility = isPassportEligible({
    contractHarvested: true,
    labsPassed,
    finalAuditPassed: progress.finalAudit.status === "passed",
    walletVerified: true,
  });
  return {
    ...progress,
    labsPassed,
    badgeEligible: eligibility.eligible,
    updatedAt: new Date().toISOString(),
  };
}

export function securityProgressReducer(
  state: SecurityProgress,
  action: SecurityAction,
): SecurityProgress {
  switch (action.type) {
    case "reset":
      return { ...initialSecurityProgress, scenarios: {}, labsPassed: [false, false, false] };
    case "unlock":
      return state.unlocked ? state : { ...state, unlocked: true, updatedAt: new Date().toISOString() };
    case "start-scenario": {
      const existing = state.scenarios[action.scenarioId];
      if (existing && existing.status === "passed") return state;
      const next: ScenarioProgress = existing ?? {
        status: "in_progress",
        score: 0,
        currentStep: "identify",
        completedAt: null,
        syncedToServer: false,
      };
      return withLabs({
        ...state,
        scenarios: { ...state.scenarios, [action.scenarioId]: { ...next, status: "in_progress" } },
      });
    }
    case "set-step": {
      const existing = state.scenarios[action.scenarioId];
      if (!existing) return state;
      return withLabs({
        ...state,
        scenarios: {
          ...state.scenarios,
          [action.scenarioId]: { ...existing, currentStep: action.step },
        },
      });
    }
    case "complete-scenario": {
      const existing = state.scenarios[action.scenarioId];
      const next: ScenarioProgress = {
        status: action.passed ? "passed" : "failed",
        score: action.score,
        currentStep: null,
        completedAt: new Date().toISOString(),
        syncedToServer: action.synced ?? existing?.syncedToServer ?? false,
      };
      return withLabs({
        ...state,
        scenarios: { ...state.scenarios, [action.scenarioId]: next },
      });
    }
    case "mark-synced": {
      const existing = state.scenarios[action.scenarioId];
      if (!existing) return state;
      return {
        ...state,
        scenarios: {
          ...state.scenarios,
          [action.scenarioId]: { ...existing, syncedToServer: true },
        },
      };
    }
    case "complete-audit": {
      const next: FinalAuditProgress = {
        status: action.passed ? "passed" : "failed",
        score: action.score,
        reportId: action.reportId,
        reportHash: action.reportHash,
        completedAt: new Date().toISOString(),
        falsePositivePenalty: action.falsePositivePenalty,
      };
      return withLabs({ ...state, finalAudit: next });
    }
    default:
      return state;
  }
}

export function readStoredSecurityProgress(value: string | null): SecurityProgress {
  if (!value) return initialSecurityProgress;
  try {
    const parsed = JSON.parse(value) as Partial<SecurityProgress>;
    if (parsed.version !== 1) return initialSecurityProgress;
    const scenarios: Record<string, ScenarioProgress> = {};
    const knownIds = new Set(SECURITY_SCENARIOS.map((scenario) => scenario.id));
    for (const [key, entry] of Object.entries(parsed.scenarios ?? {})) {
      if (!knownIds.has(key)) continue;
      const scenario = entry as ScenarioProgress;
      scenarios[key] = {
        status: ["pending", "in_progress", "passed", "failed"].includes(scenario.status)
          ? scenario.status
          : "pending",
        score: Number.isFinite(scenario.score) ? Number(scenario.score) : 0,
        currentStep: typeof scenario.currentStep === "string" ? scenario.currentStep : null,
        completedAt: typeof scenario.completedAt === "string" ? scenario.completedAt : null,
        syncedToServer: Boolean(scenario.syncedToServer),
      };
    }
    return withLabs({
      version: 1,
      unlocked: Boolean(parsed.unlocked),
      scenarios,
      finalAudit: {
        status: ["pending", "in_progress", "passed", "failed"].includes(
          (parsed.finalAudit?.status ?? "pending") as string,
        )
          ? (parsed.finalAudit?.status as FinalAuditProgress["status"])
          : "pending",
        score: Number(parsed.finalAudit?.score ?? 0),
        reportId: parsed.finalAudit?.reportId ?? null,
        reportHash: parsed.finalAudit?.reportHash ?? null,
        completedAt: parsed.finalAudit?.completedAt ?? null,
        falsePositivePenalty: Number(parsed.finalAudit?.falsePositivePenalty ?? 0),
      },
      labsPassed: [false, false, false],
      badgeEligible: false,
      updatedAt: parsed.updatedAt ?? "",
    });
  } catch {
    return initialSecurityProgress;
  }
}

export function securityCompletion(progress: SecurityProgress) {
  const total = SECURITY_SCENARIOS.length;
  const done = SECURITY_SCENARIOS.filter(
    (scenario) => progress.scenarios[scenario.id]?.status === "passed",
  ).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    finalAuditPassed: progress.finalAudit.status === "passed",
  };
}

export function scenarioUnlocked(progress: SecurityProgress, scenarioId: string): boolean {
  if (!progress.unlocked) return false;
  const scenario = SECURITY_SCENARIOS.find((entry) => entry.id === scenarioId);
  if (!scenario) return false;
  if (scenario.order === 1) return true;
  return SECURITY_SCENARIOS.filter((entry) => entry.order < scenario.order).every(
    (entry) => progress.scenarios[entry.id]?.status === "passed",
  );
}
