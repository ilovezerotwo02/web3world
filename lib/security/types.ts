// =============================================================================
// Monad Guardian Farm — 安全核心类型定义
// 纯类型与常量，不访问 DOM / D1 / RPC / LLM，便于单元测试复用。
// =============================================================================

export type SignGuardDecision = "ALLOW" | "REVIEW" | "BLOCK";

export type SignGuardSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SignGuardConfidence = "LOW" | "MEDIUM" | "HIGH";

export type PermissionKind =
  | "ERC20_APPROVAL"
  | "NFT_ALL"
  | "NATIVE_TRANSFER"
  | "UNKNOWN";

export type SignGuardPermission = {
  kind: PermissionKind;
  target?: string;
  amount?: string;
};

export type SignGuardTriggeredRule = {
  id: string;
  severity: SignGuardSeverity;
  title: string;
  evidence: string;
};

export type DecodedCall = {
  functionName?: string;
  signature?: string;
  selector?: string;
  args?: Record<string, string>;
  valueWei?: string;
  valueMon?: string;
  /** 无法识别 selector 时为 true */
  unknown?: boolean;
};

export type TxContext = {
  chainId: number;
  /** 用户期望的网络，通常为 Monad Testnet (10143) */
  expectedChainId: number;
  /** 目标合约或收款地址，lowercase 或 null（部署交易） */
  to: string | null;
  /** calldata，0x 前缀十六进制 */
  data: string;
  /** 原生资产数量（wei 十进制字符串） */
  value: string;
  selector: string | null;
  decoded: DecodedCall | null;
  from?: string | null;
  txHash?: string | null;
  /** lowercase 地址 -> 人类可读名称 */
  knownContracts: Record<string, string>;
};

export type SignGuardResult = {
  decision: SignGuardDecision;
  severity: SignGuardSeverity;
  confidence: SignGuardConfidence;
  summary: string;
  decoded?: DecodedCall;
  permissions: SignGuardPermission[];
  triggeredRules: SignGuardTriggeredRule[];
  recommendedAction: string;
  /** 命中已知合约时为该合约名称 */
  knownContract?: string | null;
  /** 没有命中任何规则时的免责声明标记 */
  unknownDisclaimer: boolean;
};

// ---------------------------------------------------------------------------
// 规则定义
// ---------------------------------------------------------------------------

export type SecurityRuleCategory = "TX" | "SOL";

export type SecurityRule = {
  id: string;
  title: string;
  category: SecurityRuleCategory;
  severity: SignGuardSeverity;
  /** 该规则命中时的建议结论；未设置则由严重级别推导 */
  decision?: SignGuardDecision;
  explanation: string;
  remediation: string;
  match(ctx: TxContext): boolean;
  evidence(ctx: TxContext): string;
};

/** 源码静态检查命中的一条 finding */
export type SourceFinding = {
  ruleId: string;
  severity: SignGuardSeverity;
  title: string;
  evidence: string;
  /** 1-based 行号 */
  lines: number[];
};

/** 基于 Solidity 源码的确定性静态规则 */
export type SourceRule = {
  id: string;
  title: string;
  category: "SOL";
  severity: SignGuardSeverity;
  explanation: string;
  remediation: string;
  detect(source: string): SourceFinding | null;
};

// ---------------------------------------------------------------------------
// SignGuard 输入
// ---------------------------------------------------------------------------

export type SignGuardTxHashInput = {
  mode: "txHash";
  chainId: number;
  txHash: string;
};

export type SignGuardRequestInput = {
  mode: "request";
  chainId: number;
  to: string;
  data?: string;
  value?: string;
};

export type SignGuardInput =
  | SignGuardTxHashInput
  | SignGuardRequestInput;

export const MONAD_TESTNET_CHAIN_ID = 10143;

export const SEVERITY_RANK: Record<SignGuardSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const UNLIMITED_APPROVAL_THRESHOLD = 1n << 255n;
