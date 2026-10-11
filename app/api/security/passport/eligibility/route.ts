import { getDb } from "../../../../../db";
import { requireAuth } from "../../../../../lib/auth";
import {
  getProgress,
  getSecurityProgressSnapshot,
  getUser,
} from "../../../../../lib/repositories";
import {
  buildSecurityBadgeMetadata,
  isPassportEligible,
  SECURITY_BADGE_TYPE_ID,
} from "../../../../../lib/security/passport";
import { FINAL_AUDIT_SCENARIO } from "../../../../../lib/security/scenarios";
import { isResponse, readJsonBody } from "../../../../../lib/security/api-helpers";

const CONTRACT_COURSE_ID = "contract";

/**
 * POST /api/security/passport/eligibility
 * 全部条件都由服务端根据 D1 记录计算：
 *   1. 智能合约课程已收获（course_progress.harvested）
 *   2. 三个 Lab 全部通过（security_sessions.status = passed）
 *   3. Final Audit 通过（security_reports.passed = 1）
 *   4. 钱包已验证（users.wallet_address 由钱包签名后写入）
 * 请求体中的任何 passed / verified 标记都不会被信任。
 */
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  // 兼容性：接受请求体，但不使用其中的任何“通过”标记
  const body = await readJsonBody<Record<string, unknown>>(request);
  if (isResponse(body)) return body;

  const [courseProgressRow, user] = await Promise.all([
    getProgress(db, auth.userId, CONTRACT_COURSE_ID),
    getUser(db, auth.userId),
  ]);
  const contractHarvested = Boolean(courseProgressRow?.harvested);
  const walletVerified = Boolean(user?.walletAddress);

  const snapshot = await getSecurityProgressSnapshot(db, auth.userId);
  const passedScenarios = snapshot.passedScenarios;
  const labPassed: [boolean, boolean, boolean] = [
    passedScenarios.includes("reentrancy-bank-v1"),
    passedScenarios.includes("access-control-mint-v1") &&
      passedScenarios.includes("signature-replay-v1"),
    passedScenarios.includes("tx-origin-phish-v1"),
  ];
  const latest = snapshot.latestReport;
  const finalAuditPassed = Boolean(latest && latest.passed);

  const eligibility = isPassportEligible({
    contractHarvested,
    labsPassed: labPassed,
    finalAuditPassed,
    walletVerified,
  });

  if (!eligibility.eligible) {
    return Response.json(
      {
        eligible: false,
        missing: eligibility.missing,
        badgeTypeId: SECURITY_BADGE_TYPE_ID,
        labPassed,
        serverDerived: {
          contractHarvested,
          walletVerified,
          finalAuditPassed,
          passedScenarios,
        },
      },
      { status: 403 },
    );
  }

  const metadata = buildSecurityBadgeMetadata({
    score: latest?.score ?? 0,
    falsePositivePenalty: latest?.falsePositivePenalty ?? 0,
    labPassed,
    reportHash: latest?.reportHash ?? null,
  });

  return Response.json({
    eligible: true,
    badgeTypeId: SECURITY_BADGE_TYPE_ID,
    scenarioId: FINAL_AUDIT_SCENARIO.id,
    trackVersion: FINAL_AUDIT_SCENARIO.trackVersion,
    score: latest?.score ?? 0,
    reportId: latest?.id ?? null,
    reportHash: latest?.reportHash ?? null,
    labPassed,
    metadata,
    message:
      "资格由服务端根据 D1 中的课程进度、安全实验通过记录、审计报告与钱包绑定情况计算，不接受前端传入的通过标记。",
  });
}
