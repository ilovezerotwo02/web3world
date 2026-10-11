"use client";

import { clearSessionToken, readSessionToken } from "../session";
import type { SecurityLabStepAnswer } from "./types";

export type SyncStatus = "synced" | "skipped" | "failed";

type ApiError = { error?: string };

async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const { token, headers, ...rest } = init;
  try {
    const response = await fetch(path, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T & ApiError) : null;
    if (!response.ok) {
      if (response.status === 401) clearSessionToken();
      return {
        ok: false,
        status: response.status,
        data: null,
        error: (data?.error as string) ?? `请求失败（${response.status}）`,
      };
    }
    return { ok: true, status: response.status, data: data as T, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "网络不可用",
      data: null,
    };
  }
}

/**
 * 把本地完成的 Lab 结果同步到 D1（幂等）。
 * 没有会话 token 时直接跳过，不影响本地学习流程（低摩擦路径）。
 */
export async function syncLabToServer(
  scenarioId: string,
  answers: SecurityLabStepAnswer,
): Promise<SyncStatus> {
  const token = readSessionToken();
  if (!token) return "skipped";

  const started = await apiFetch<{ sessionId: string; status: string }>(
    "/api/security/session/start",
    { method: "POST", token, body: JSON.stringify({ scenarioId }) },
  );
  if (!started.ok || !started.data?.sessionId) return "failed";
  const sessionId = started.data.sessionId;

  const steps: Array<{ step: string; answer: Record<string, unknown> }> = [
    { step: "identify", answer: { lines: answers.lines } },
    { step: "question", answer: { answer: answers.question } },
    { step: "followup", answer: { answer: answers.followUp } },
    { step: "patch", answer: { patchId: answers.patchId } },
    { step: "verify", answer: {} },
  ];

  for (const entry of steps) {
    const result = await apiFetch<{ status: string }>("/api/security/session/step", {
      method: "POST",
      token,
      body: JSON.stringify({ sessionId, step: entry.step, answer: entry.answer }),
    });
    if (!result.ok) return "failed";
  }
  return "synced";
}

export async function submitFindingToServer(
  sessionId: string,
  finding: {
    title: string;
    type: string;
    severity: string;
    evidenceLines: number[];
    rootCause: string;
    impact: string;
    fix: string;
  },
) {
  const token = readSessionToken();
  if (!token) return null;
  return apiFetch<{
    findingCode: string | null;
    deterministicScore: number;
    feedback: string;
    severityMatched: boolean;
    rootCauseMatched: boolean;
    remediationMatched: boolean;
    falsePositive: boolean;
  }>("/api/security/finding", {
    method: "POST",
    token,
    body: JSON.stringify({ sessionId, finding }),
  });
}

export async function startServerSession(scenarioId: string) {
  const token = readSessionToken();
  if (!token) return null;
  return apiFetch<{ sessionId: string; status: string }>("/api/security/session/start", {
    method: "POST",
    token,
    body: JSON.stringify({ scenarioId }),
  });
}

export async function generateServerReport(payload: {
  sessionId: string;
  auditor: string;
  walletAddress?: string | null;
  findings: Array<Record<string, unknown>>;
}) {
  const token = readSessionToken();
  if (!token) return null;
  return apiFetch<{
    reportId: string;
    reportLabel: string | null;
    score: number;
    passed: boolean;
    reportHash: string | null;
    summary: { critical: number; high: number; medium: number; low: number };
    breakdown: Record<string, number>;
    missingRequired: string[];
    download: string;
    report: unknown;
  }>("/api/security/report", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function requestPassportEligibility(input: {
  contractHarvested: boolean;
  walletVerified: boolean;
}) {
  const token = readSessionToken();
  if (!token) return null;
  return apiFetch<{ eligible: boolean; missing?: string[]; badgeTypeId: number }>(
    "/api/security/passport/eligibility",
    { method: "POST", token, body: JSON.stringify(input) },
  );
}

export async function analyzeTx(payload: Record<string, unknown>) {
  return apiFetch<{
    mode: string;
    chainId: number;
    txHash: string | null;
    result: import("../../../lib/security/types").SignGuardResult;
    disclaimer: string;
    boundary: string;
  }>("/api/security/tx-analyze", { method: "POST", body: JSON.stringify(payload) });
}

export async function runAgentPolicy(payload: Record<string, unknown>) {
  return apiFetch<{ decision: unknown }>("/api/security/agent/check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestAgentReview(finding: Record<string, unknown>) {
  return apiFetch<{
    mode: string;
    understood: boolean;
    missingPoints: string[];
    feedback: string;
    followUp: string;
    riskLevelSuggestion: string;
    notice: string;
  }>("/api/agent/security-review", { method: "POST", body: JSON.stringify({ finding }) });
}
