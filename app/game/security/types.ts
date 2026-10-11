"use client";

export type { SignGuardResult, SignGuardDecision, SignGuardSeverity } from "../../../lib/security/types";
export type { AuditReport } from "../../../lib/security/report";

export type ScenarioStatus = "pending" | "in_progress" | "passed" | "failed";

export type ScenarioProgress = {
  status: ScenarioStatus;
  score: number;
  currentStep: string | null;
  completedAt: string | null;
  syncedToServer: boolean;
};

export type FinalAuditProgress = {
  status: ScenarioStatus;
  score: number;
  reportId: string | null;
  reportHash: string | null;
  completedAt: string | null;
  falsePositivePenalty: number;
};

export type SecurityProgress = {
  version: 1;
  unlocked: boolean;
  scenarios: Record<string, ScenarioProgress>;
  finalAudit: FinalAuditProgress;
  labsPassed: [boolean, boolean, boolean];
  badgeEligible: boolean;
  updatedAt: string;
};

export type GreenhouseStage =
  | "locked"
  | "ruined"
  | "frame-repaired"
  | "secured"
  | "fully-powered";

export type SecurityLabStepAnswer = {
  lines: number[];
  question: string;
  followUp: string;
  patchId: string;
};
