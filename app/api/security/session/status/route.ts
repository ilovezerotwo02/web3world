import { getDb } from "../../../../../db";
import { requireAuth } from "../../../../../lib/auth";
import {
  getProgress,
  getSecurityProgressSnapshot,
  getUser,
} from "../../../../../lib/repositories";
import { isPassportEligible } from "../../../../../lib/security/passport";

// GET /api/security/session/status
// 服务端聚合安全进度（Lab 通过情况 + 最新报告），并给出 Passport 资格判断。
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const [snapshot, contractProgressRow, user] = await Promise.all([
    getSecurityProgressSnapshot(db, auth.userId),
    getProgress(db, auth.userId, "contract"),
    getUser(db, auth.userId),
  ]);

  const passedScenarios = snapshot.passedScenarios;
  const labPassed: [boolean, boolean, boolean] = [
    passedScenarios.includes("reentrancy-bank-v1"),
    passedScenarios.includes("access-control-mint-v1") && passedScenarios.includes("signature-replay-v1"),
    passedScenarios.includes("tx-origin-phish-v1"),
  ];
  const latestReport = snapshot.latestReport;
  const finalAuditPassed = Boolean(latestReport && latestReport.passed);
  const contractHarvested = Boolean(contractProgressRow?.harvested);
  const walletVerified = Boolean(user?.walletAddress);

  const eligibility = isPassportEligible({
    contractHarvested,
    labsPassed: labPassed,
    finalAuditPassed,
    walletVerified,
  });

  return Response.json({
    sessions: snapshot.sessions,
    passedScenarios,
    labPassed,
    finalAuditPassed,
    contractHarvested,
    walletVerified,
    latestReport: latestReport
      ? {
          id: latestReport.id,
          score: latestReport.score,
          passed: Boolean(latestReport.passed),
          reportHash: latestReport.reportHash,
          createdAt: latestReport.createdAt,
        }
      : null,
    passportEligible: eligibility.eligible,
    passportMissing: eligibility.missing,
  });
}
