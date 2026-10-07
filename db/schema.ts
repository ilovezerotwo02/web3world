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
