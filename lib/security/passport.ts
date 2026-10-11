// =============================================================================
// Security Passport（可验证安全能力档案）
// Type ID 3 = Web3 Security Guardian（Soulbound）
// =============================================================================

export const SECURITY_BADGE_TYPE_ID = 3;
export const SECURITY_TRACK_VERSION = "2026.1";

export type PassportConditions = {
  /** 三门原课程中的智能合约课程是否已收获 */
  contractHarvested: boolean;
  /** 三个 Lab 是否全部通过 */
  labsPassed: boolean[];
  /** Final Audit 是否通过 */
  finalAuditPassed: boolean;
  /** 是否已经在服务端验证过钱包 */
  walletVerified: boolean;
};

export type PassportEligibility = {
  eligible: boolean;
  missing: string[];
  reportHash: string | null;
};

export function isPassportEligible(conditions: PassportConditions): PassportEligibility {
  const missing: string[] = [];
  if (!conditions.contractHarvested) missing.push("智能合约课程尚未收获");
  if (!conditions.labsPassed.every(Boolean)) missing.push("三个安全 Lab 尚未全部通过");
  if (!conditions.finalAuditPassed) missing.push("最终综合审计尚未通过");
  if (!conditions.walletVerified) missing.push("尚未连接并验证钱包");
  return { eligible: missing.length === 0, missing, reportHash: null };
}

export type SecurityBadgeAttribute = {
  trait_type: string;
  value: string | number;
};

export function buildSecurityBadgeMetadata(input: {
  score: number;
  falsePositivePenalty: number;
  labPassed: [boolean, boolean, boolean];
  reportHash?: string | null;
}): {
  name: string;
  description: string;
  attributes: SecurityBadgeAttribute[];
} {
  const attributes: SecurityBadgeAttribute[] = [
    { trait_type: "Reentrancy Lab", value: input.labPassed[0] ? "Passed" : "Pending" },
    { trait_type: "Access Control", value: input.labPassed[1] ? "Passed" : "Pending" },
    { trait_type: "Transaction Guard", value: input.labPassed[2] ? "Passed" : "Pending" },
    { trait_type: "Audit Score", value: input.score },
    { trait_type: "False Positive Penalty", value: input.falsePositivePenalty },
    { trait_type: "Version", value: SECURITY_TRACK_VERSION },
  ];
  if (input.reportHash) {
    attributes.push({ trait_type: "Report Hash", value: input.reportHash });
  }
  return {
    name: "Monad Web3 Security Guardian",
    description:
      "Soulbound credential for completing the Monad Guardian Farm security track（漏洞复现 · 修复回归 · 交易风险实验）. Educational credential only.",
    attributes,
  };
}

export const SECURITY_BADGE_NAME = "Web3 Security Guardian";
export const SECURITY_BADGE_NAME_ZH = "Web3 安全守护者";
