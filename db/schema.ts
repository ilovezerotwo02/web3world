import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// 用户系统
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatar_url"),
  walletAddress: text("wallet_address").unique(),
  role: text("role").notNull().default("user"),
  exp: integer("exp").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  status: text("status")
    .notNull()
    .default("active"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at"),
});

export const walletChallenges = sqliteTable("wallet_challenges", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  message: text("message").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 课程系统
// ---------------------------------------------------------------------------

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  seedType: text("seed_type").notNull(),
  cropType: text("crop_type").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  prerequisites: text("prerequisites").notNull().default("[]"),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").notNull().default("available"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  pace: text("pace").notNull(),
  objective: text("objective").notNull(),
  body: text("body").notNull(),
  terms: text("terms").notNull().default("[]"),
  example: text("example").notNull(),
  caution: text("caution").notNull(),
  isSafety: integer("is_safety").notNull().default(0),
  knowledgeCard: text("knowledge_card").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const challengeQuestions = sqliteTable("challenge_questions", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  questionBlob: text("question_blob").notNull(),
  successMsg: text("success_msg").notNull(),
  failureMsg: text("failure_msg").notNull(),
});

export const finalQuizQuestions = sqliteTable("final_quiz_questions", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  questionBlob: text("question_blob").notNull(),
});

// ---------------------------------------------------------------------------
// 用户进度
// ---------------------------------------------------------------------------

export const courseProgress = sqliteTable("course_progress", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  started: integer("started").notNull().default(0),
  seedGranted: integer("seed_granted").notNull().default(0),
  landCleared: integer("land_cleared").notNull().default(0),
  planted: integer("planted").notNull().default(0),
  chaptersRead: text("chapters_read").notNull().default("[]"),
  challengePassed: text("challenge_passed").notNull().default("[]"),
  challengeMistakes: text("challenge_mistakes").notNull().default("[]"),
  verification: text("verification").notNull().default("none"),
  harvested: integer("harvested").notNull().default(0),
  recentActivity: text("recent_activity").notNull().default("[]"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueProgress: primaryKey({
    columns: [table.userId, table.courseId],
  }),
}));

// ---------------------------------------------------------------------------
// 挑战答题记录
// ---------------------------------------------------------------------------

export const challengeAttempts = sqliteTable("challenge_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  answersBlob: text("answers_blob").notNull(),
  passed: integer("passed").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 最终小测记录
// ---------------------------------------------------------------------------

export const finalQuizAttempts = sqliteTable("final_quiz_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  answersBlob: text("answers_blob").notNull(),
  passed: integer("passed").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// EXP 记录
// ---------------------------------------------------------------------------

export const expLedger = sqliteTable("exp_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  source: text("source").notNull(),
  referenceId: text("reference_id").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 成就
// ---------------------------------------------------------------------------

export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  courseId: text("course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  dataBlob: text("data_blob"),
  earnedAt: text("earned_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueAchievement: uniqueIndex("unique_achievement_idx").on(
    table.userId,
    table.type,
  ),
}));

// ---------------------------------------------------------------------------
// NFT 资格与铸造
// ---------------------------------------------------------------------------

export const nftQualifications = sqliteTable("nft_qualifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  status: text("status")
    .notNull()
    .default("eligible"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueNftQualification: uniqueIndex("unique_nft_qualification_idx").on(
    table.userId,
    table.courseId,
  ),
}));

export const nftMinting = sqliteTable("nft_minting", {
  id: text("id").primaryKey(),
  qualificationId: text("qualification_id")
    .notNull()
    .references(() => nftQualifications.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  status: text("status")
    .notNull()
    .default("pending"),
  txHash: text("tx_hash"),
  tokenId: text("token_id"),
  contractAddress: text("contract_address"),
  chainId: integer("chain_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  mintedAt: text("minted_at"),
});

// ---------------------------------------------------------------------------
// 系统日志
// ---------------------------------------------------------------------------

export const systemLogs = sqliteTable("system_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  beforeState: text("before_state"),
  afterState: text("after_state"),
  reason: text("reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 审核管理
// ---------------------------------------------------------------------------

export const auditSessions = sqliteTable("audit_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  auditType: text("audit_type").notNull().default("manual"),
  status: text("status").notNull().default("pending"),
  itemsJson: text("items_json").notNull().default("[]"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 系统配置（运行时动态配置）
// ---------------------------------------------------------------------------

export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 安全温室（Monad Guardian Farm）— 不复用 audit_sessions，语义完全不同
// ---------------------------------------------------------------------------

export const securitySessions = sqliteTable("security_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id").notNull(),
  scenarioVersion: text("scenario_version").notNull().default("1.0.0"),
  labId: text("lab_id").notNull().default("lab-1"),
  status: text("status").notNull().default("in_progress"),
  currentStep: integer("current_step").notNull().default(1),
  score: integer("score").notNull().default(0),
  stateJson: text("state_json").notNull().default("{}"),
  startedAt: text("started_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueSecuritySession: uniqueIndex("unique_security_session_idx").on(
    table.userId,
    table.scenarioId,
    table.scenarioVersion,
  ),
}));

export const securityFindings = sqliteTable("security_findings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => securitySessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  findingCode: text("finding_code"),
  vulnerabilityType: text("vulnerability_type").notNull().default("unknown"),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull().default(""),
  evidenceJson: text("evidence_json").notNull().default("[]"),
  rootCause: text("root_cause").notNull().default(""),
  impact: text("impact").notNull().default(""),
  fix: text("fix").notNull().default(""),
  regressionJson: text("regression_json").notNull().default("{}"),
  deterministicScore: integer("deterministic_score").notNull().default(0),
  isCorrect: integer("is_correct").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const securityReports = sqliteTable("security_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  scenarioId: text("scenario_id").notNull().default("greenhouse-vault-audit-v1"),
  trackVersion: text("track_version").notNull().default("2026.1"),
  score: integer("score").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  falsePositivePenalty: integer("false_positive_penalty").notNull().default(0),
  summaryJson: text("summary_json").notNull().default("{}"),
  reportJson: text("report_json").notNull().default("{}"),
  reportMarkdown: text("report_markdown").notNull().default(""),
  reportHash: text("report_hash").notNull().default(""),
  walletAddress: text("wallet_address"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueReportHash: uniqueIndex("unique_security_report_hash_idx").on(table.reportHash),
}));

export const txRiskChecks = sqliteTable("tx_risk_checks", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  chainId: integer("chain_id").notNull(),
  txHash: text("tx_hash"),
  toAddress: text("to_address"),
  selector: text("selector"),
  valueWei: text("value_wei").notNull().default("0"),
  riskDecision: text("risk_decision").notNull().default("ALLOW"),
  riskSeverity: text("risk_severity").notNull().default("INFO"),
  triggeredRulesJson: text("triggered_rules_json").notNull().default("[]"),
  calldataHash: text("calldata_hash").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const agentPolicies = sqliteTable("agent_policies", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address"),
  policyJson: text("policy_json").notNull().default("{}"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueAgentPolicy: uniqueIndex("unique_agent_policy_idx").on(table.userId),
}));
