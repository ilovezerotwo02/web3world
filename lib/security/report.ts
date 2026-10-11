// =============================================================================
// Audit Report 生成：canonical JSON → SHA-256 → reportHash → Markdown
// 链上只证明“这个地址在这个版本完成了这份报告对应的挑战”，不上链全文。
// =============================================================================

import { FINAL_AUDIT_SCENARIO } from "./scenarios";
import type { FindingDraft } from "./scoring";
import type { AuditEvaluation } from "./scoring";

export type ReportFinding = {
  code: string | null;
  title: string;
  vulnType: string;
  severity: string;
  status: "Fixed" | "Reported";
  evidenceLines: number[];
  rootCause: string;
  impact: string;
  remediation: string;
  regression: "Passed" | "Failed";
  matchedRule: string | null;
  feedback: string;
};

export type AuditReport = {
  version: 1;
  scenario: string;
  scenarioVersion: string;
  trackVersion: string;
  contract: string;
  contractAddress: string;
  auditor: string;
  walletAddress: string | null;
  chain: string;
  completedAt: string;
  score: number;
  passes: boolean;
  summary: { critical: number; high: number; medium: number; low: number };
  breakdown: AuditEvaluation["breakdown"];
  findings: ReportFinding[];
  disclaimer: string;
  reportHash: string | null;
};

export const AUDIT_DISCLAIMER =
  "本报告由 Monad Guardian Farm 教学型确定性规则引擎生成，用于安全教育与自我评估，不替代专业智能合约审计，也不构成任何安全保证。";

const CHAIN_LABEL = "Monad Learning Sandbox（Monad Testnet 10143）";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    entries.forEach(([key, entry]) => {
      result[key] = sortValue(entry);
    });
    return result;
  }
  return value;
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type BuildReportInput = {
  auditor: string;
  walletAddress?: string | null;
  findings: FindingDraft[];
  evaluation: AuditEvaluation;
  replayPassed: boolean;
  completedAt?: string;
  reportId?: string;
};

export function buildAuditReport(input: BuildReportInput): AuditReport {
  const regression = input.replayPassed ? "Passed" : "Failed";
  const findings: ReportFinding[] = input.findings.map((finding, index) => {
    const evaluation = input.evaluation.evaluations[index];
    return {
      code: evaluation?.matchedCode ?? null,
      title: finding.title,
      vulnType: finding.vulnType,
      severity: finding.severity,
      status: evaluation?.remediationMatched ? "Fixed" : "Reported",
      evidenceLines: finding.evidenceLines,
      rootCause: finding.rootCause,
      impact: finding.impact,
      remediation: finding.remediation,
      regression,
      matchedRule: evaluation?.matchedCode
        ? FINAL_AUDIT_SCENARIO.targets.find((target) => target.code === evaluation.matchedCode)?.ruleId ?? null
        : null,
      feedback: evaluation?.message ?? "",
    };
  });

  return {
    version: 1,
    scenario: FINAL_AUDIT_SCENARIO.title,
    scenarioVersion: FINAL_AUDIT_SCENARIO.scenarioVersion,
    trackVersion: FINAL_AUDIT_SCENARIO.trackVersion,
    contract: FINAL_AUDIT_SCENARIO.contractName,
    contractAddress: FINAL_AUDIT_SCENARIO.contractAddress,
    auditor: input.auditor,
    walletAddress: input.walletAddress ?? null,
    chain: CHAIN_LABEL,
    completedAt: input.completedAt ?? new Date().toISOString(),
    score: input.evaluation.score,
    passes: input.evaluation.passed,
    summary: input.evaluation.summary,
    breakdown: input.evaluation.breakdown,
    findings,
    disclaimer: AUDIT_DISCLAIMER,
    reportHash: null,
  };
}

export async function withReportHash(report: AuditReport): Promise<AuditReport> {
  const hash = await sha256Hex(canonicalJson({ ...report, reportHash: null }));
  return { ...report, reportHash: hash };
}

export function reportIdFromHash(hash: string): string {
  return `#${hash.slice(0, 6).toUpperCase()}`;
}

export function reportToMarkdown(report: AuditReport): string {
  const reportId = report.reportHash ? reportIdFromHash(report.reportHash) : "#PENDING";
  const lines: string[] = [];
  lines.push("# Web3 Security Audit Report");
  lines.push("");
  lines.push("## Overview");
  lines.push(`- Scenario: ${report.scenario}`);
  lines.push(`- Scenario Version: ${report.scenarioVersion}`);
  lines.push(`- Track Version: ${report.trackVersion}`);
  lines.push(`- Contract: ${report.contract} (${report.contractAddress})`);
  lines.push(`- Auditor: ${report.auditor}`);
  if (report.walletAddress) lines.push(`- Wallet: ${report.walletAddress}`);
  lines.push(`- Chain: ${report.chain}`);
  lines.push(`- Completed At: ${report.completedAt}`);
  lines.push(`- Security Score: ${report.score}/100`);
  lines.push(`- Report ID: ${reportId}`);
  if (report.reportHash) lines.push(`- Report Hash (sha256): ${report.reportHash}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Critical: ${report.summary.critical}`);
  lines.push(`- High: ${report.summary.high}`);
  lines.push(`- Medium: ${report.summary.medium}`);
  lines.push(`- Low: ${report.summary.low}`);
  lines.push("");
  lines.push("### Score Breakdown");
  lines.push("| Area | Points |");
  lines.push("| --- | ---: |");
  lines.push(`| 漏洞识别 | ${report.breakdown.identification} / 30 |`);
  lines.push(`| 根因理解 | ${report.breakdown.rootCause} / 25 |`);
  lines.push(`| 修复方案 | ${report.breakdown.remediation} / 20 |`);
  lines.push(`| 回归验证 | ${report.breakdown.regression} / 15 |`);
  lines.push(`| 风险表达 | ${report.breakdown.expression} / 10 |`);
  lines.push(`| 误报扣分 | -${report.breakdown.penalty} |`);
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  report.findings.forEach((finding, index) => {
    lines.push(`### ${finding.code ?? `F-${String(index + 1).padStart(2, "0")}`} ${finding.title}`);
    lines.push(`Severity: ${finding.severity}`);
    lines.push(`Status: ${finding.status}`);
    if (finding.matchedRule) lines.push(`Matched Rule: ${finding.matchedRule}`);
    lines.push(`Evidence Lines: ${finding.evidenceLines.join(", ") || "-"}`);
    lines.push("");
    lines.push("Root Cause:");
    lines.push(finding.rootCause || "-");
    lines.push("");
    lines.push("Impact:");
    lines.push(finding.impact || "-");
    lines.push("");
    lines.push("Recommendation:");
    lines.push(finding.remediation || "-");
    lines.push("");
    lines.push(`Regression Result: ${finding.regression}`);
    if (finding.feedback) lines.push(`Rule Feedback: ${finding.feedback}`);
    lines.push("");
  });
  lines.push("---");
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");
  return lines.join("\n");
}
