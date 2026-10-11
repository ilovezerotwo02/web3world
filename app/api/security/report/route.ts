import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import {
  createSecurityReport,
  getSecuritySessionById,
  getSecuritySession,
} from "../../../../lib/repositories";
import { FINAL_AUDIT_SCENARIO } from "../../../../lib/security/scenarios";
import { evaluateFinalAudit, type FindingDraft } from "../../../../lib/security/scoring";
import { buildAuditReport, reportIdFromHash, reportToMarkdown, withReportHash } from "../../../../lib/security/report";
import {
  clampText,
  isResponse,
  jsonError,
  readJsonBody,
} from "../../../../lib/security/api-helpers";

type ReportRequest = {
  sessionId?: string;
  auditor?: string;
  walletAddress?: string;
  findings?: FinderInput[];
};

type FinderInput = {
  title?: string;
  type?: string;
  severity?: string;
  evidenceLines?: unknown;
  rootCause?: string;
  impact?: string;
  fix?: string;
};

const ALLOWED_SEVERITY = new Set(["critical", "high", "medium", "low"]);
const MAX_FINDINGS = 10;

function parseFindings(input: unknown): FindingDraft[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_FINDINGS).map((entry) => {
    const value = (entry ?? {}) as FinderInput;
    return {
      title: clampText(value.title, 120),
      vulnType: clampText(value.type, 64).toLowerCase(),
      severity: ALLOWED_SEVERITY.has(clampText(value.severity, 16).toLowerCase())
        ? clampText(value.severity, 16).toLowerCase()
        : "medium",
      evidenceLines: Array.isArray(value.evidenceLines)
        ? value.evidenceLines
            .map((line) => Number(line))
            .filter((line) => Number.isInteger(line) && line > 0 && line < 500)
        : [],
      rootCause: clampText(value.rootCause, 600),
      impact: clampText(value.impact, 600),
      remediation: clampText(value.fix, 600),
    } satisfies FindingDraft;
  });
}

// POST /api/security/report — 生成审计报告（服务端权威：Lab 通过情况来自 D1）
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = await readJsonBody<ReportRequest>(request);
  if (isResponse(body)) return body;

  if (!body.sessionId) return jsonError("sessionId 不能为空", 400);
  const session = await getSecuritySessionById(db, body.sessionId, auth.userId);
  if (!session) return jsonError("审计记录不存在", 404);
  if (session.scenarioId !== FINAL_AUDIT_SCENARIO.id) {
    return jsonError("请先开始最终综合审计", 409);
  }

  const findings = parseFindings(body.findings);
  if (findings.length === 0) return jsonError("至少需要提交 1 条 Finding", 400);

  // 服务端自行读取 Lab 通过情况，不信任前端传入的 passed 标记
  const lab1 = await getSecuritySession(db, auth.userId, "reentrancy-bank-v1", "1.0.0");
  const lab2a = await getSecuritySession(db, auth.userId, "access-control-mint-v1", "1.0.0");
  const lab2b = await getSecuritySession(db, auth.userId, "signature-replay-v1", "1.0.0");
  const lab3 = await getSecuritySession(db, auth.userId, "tx-origin-phish-v1", "1.0.0");
  const labsPassed = Boolean(
    lab1?.status === "passed" &&
      lab2a?.status === "passed" &&
      lab2b?.status === "passed" &&
      lab3?.status === "passed",
  );
  const replayPassed = lab1?.status === "passed";

  const evaluation = evaluateFinalAudit(findings, { labsPassed, replayPassed });

  const rawWallet = clampText(body.walletAddress, 64);
  const walletAddress = /^0x[a-fA-F0-9]{40}$/.test(rawWallet) ? rawWallet : null;

  const report = await withReportHash(
    buildAuditReport({
      auditor: clampText(body.auditor, 64) || "Monad Farm Auditor",
      walletAddress,
      findings,
      evaluation,
      replayPassed,
      reportId: session.id,
    }),
  );

  const saved = await createSecurityReport(db, {
    userId: auth.userId,
    sessionId: session.id,
    scenarioId: FINAL_AUDIT_SCENARIO.id,
    trackVersion: FINAL_AUDIT_SCENARIO.trackVersion,
    score: report.score,
    passed: report.passes,
    falsePositivePenalty: evaluation.breakdown.penalty,
    summaryJson: JSON.stringify(report.summary),
    reportJson: JSON.stringify(report),
    reportMarkdown: reportToMarkdown(report),
    reportHash: report.reportHash ?? "",
    walletAddress,
  });

  return Response.json({
    reportId: saved.id,
    reportLabel: report.reportHash ? reportIdFromHash(report.reportHash) : null,
    score: report.score,
    passed: report.passes,
    reportHash: report.reportHash,
    summary: report.summary,
    breakdown: report.breakdown,
    identifiedCodes: evaluation.identifiedCodes,
    missingRequired: evaluation.missingRequired,
    labsPassed,
    replayPassed,
    findings: evaluation.evaluations,
    report,
    download: `/api/security/report/${saved.id}?format=md`,
  });
}
