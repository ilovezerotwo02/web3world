import { and, eq, desc, asc, sql } from "drizzle-orm";
import { getDb, type DB } from "../db";
import * as schema from "../db/schema";
import type { FarmProgress, VerificationMethod } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateCourseProgressInput = {
  userId: string;
  courseId: string;
};

export type UpdateCourseProgressInput = Partial<{
  started: number;
  seedGranted: number;
  landCleared: number;
  planted: number;
  chaptersRead: string;
  challengePassed: string;
  challengeMistakes: string;
  verification: VerificationMethod;
  harvested: number;
  recentActivity: string;
  completedAt: string | null;
}>;

export type ExpEntry = {
  id: string;
  userId: string;
  amount: number;
  source: string;
  referenceId: string;
  createdAt: string;
};

export type AchievementEntry = {
  id: string;
  userId: string;
  type: string;
  courseId: string | null;
  dataBlob: string | null;
  earnedAt: string;
};

export type NftQualificationEntry = {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  createdAt: string;
};

export type NftMintingEntry = {
  id: string;
  qualificationId: string;
  userId: string;
  walletAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
  mintedAt: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function toFarmProgress(row: typeof schema.courseProgress.$inferSelect): FarmProgress {
  const chaptersRead = parseJsonArray<boolean>(row.chaptersRead);
  const challengePassed = parseJsonArray<boolean>(row.challengePassed);
  const challengeMistakes = parseJsonArray<boolean>(row.challengeMistakes);

  // Ensure tuples always have exactly 3 elements
  function padTuple(arr: boolean[], size: number): [boolean, boolean, boolean] {
    const result: [boolean, boolean, boolean] = [false, false, false];
    for (let i = 0; i < size && i < arr.length; i++) {
      result[i] = arr[i];
    }
    return result;
  }

  return {
    version: 1,
    started: Boolean(row.started),
    seedGranted: Boolean(row.seedGranted),
    landCleared: Boolean(row.landCleared),
    planted: Boolean(row.planted),
    chaptersRead: padTuple(chaptersRead, 3),
    challengePassed: padTuple(challengePassed, 3),
    challengeMistakes: padTuple(challengeMistakes, 3),
    verification: (row.verification as VerificationMethod) ?? "none",
    harvested: Boolean(row.harvested),
    recentActivity: parseJsonArray<string>(row.recentActivity),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function createUser(
  db: DB,
  id: string,
  username: string,
  avatarUrl?: string,
) {
  const [user] = await db
    .insert(schema.users)
    .values({ id, username, avatarUrl })
    .returning();
  return user;
}

export async function getUser(db: DB, id: string) {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getUserByWallet(db: DB, address: string) {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.walletAddress, address))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function updateUserExp(db: DB, userId: string, amount: number) {
  const now = new Date().toISOString();
  return db
    .update(schema.users)
    .set({
      exp: sql`${schema.users.exp} + ${amount}`,
      updatedAt: now,
    })
    .where(eq(schema.users.id, userId));
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getCourses(db: DB) {
  return db
    .select()
    .from(schema.courses)
    .orderBy(asc(schema.courses.order));
}

export async function getCourse(db: DB, slug: string) {
  const [course] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  return course ?? null;
}

/**
 * Check if a user has completed all prerequisite courses for a given course.
 * @returns null if all prerequisites are met, or an error message string if not.
 */
export async function checkPrerequisites(db: DB, userId: string, courseId: string): Promise<string | null> {
  const [course] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .limit(1);

  if (!course) return "Course not found";

  const prerequisites = JSON.parse(course.prerequisites || "[]") as string[];
  if (prerequisites.length === 0) return null;

  for (const preId of prerequisites) {
    const [pre] = await db
      .select()
      .from(schema.courseProgress)
      .where(
        and(
          eq(schema.courseProgress.userId, userId),
          eq(schema.courseProgress.courseId, preId),
        ),
      )
      .limit(1);

    if (!pre || !pre.harvested) {
      return `请先完成前置课程: ${preId}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export async function getChaptersByCourse(db: DB, courseId: string) {
  return db
    .select()
    .from(schema.chapters)
    .where(eq(schema.chapters.courseId, courseId))
    .orderBy(asc(schema.chapters.number));
}

// ---------------------------------------------------------------------------
// Course Progress — core
// ---------------------------------------------------------------------------

export async function getOrCreateProgress(
  db: DB,
  userId: string,
  courseId: string,
) {
  const [existing] = await db
    .select()
    .from(schema.courseProgress)
    .where(
      and(
        eq(schema.courseProgress.userId, userId),
        eq(schema.courseProgress.courseId, courseId),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(schema.courseProgress)
    .values({ userId, courseId })
    .returning();
  return created;
}

export async function getProgress(
  db: DB,
  userId: string,
  courseId: string,
): Promise<FarmProgress | null> {
  const [row] = await db
    .select()
    .from(schema.courseProgress)
    .where(
      and(
        eq(schema.courseProgress.userId, userId),
        eq(schema.courseProgress.courseId, courseId),
      ),
    )
    .limit(1);
  return row ? toFarmProgress(row) : null;
}

export async function updateProgress(
  db: DB,
  userId: string,
  courseId: string,
  updates: UpdateCourseProgressInput,
) {
  const now = new Date().toISOString();
  const setFields: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setFields[key] = value;
    }
  }
  const [updated] = await db
    .update(schema.courseProgress)
    .set(setFields)
    .where(
      and(
        eq(schema.courseProgress.userId, userId),
        eq(schema.courseProgress.courseId, courseId),
      ),
    )
    .returning();
  return updated ? toFarmProgress(updated) : null;
}

export async function getUserAllProgresses(
  db: DB,
  userId: string,
) {
  const rows = await db
    .select()
    .from(schema.courseProgress)
    .where(eq(schema.courseProgress.userId, userId))
    .orderBy(desc(schema.courseProgress.updatedAt));
  return rows.map(toFarmProgress);
}

// ---------------------------------------------------------------------------
// EXP Ledger (idempotent)
// ---------------------------------------------------------------------------

export async function addExp(
  db: DB,
  userId: string,
  amount: number,
  source: string,
  referenceId: string,
) {
  // Idempotency: check if already recorded
  const [existing] = await db
    .select()
    .from(schema.expLedger)
    .where(
      and(
        eq(schema.expLedger.userId, userId),
        eq(schema.expLedger.referenceId, referenceId),
      ),
    )
    .limit(1);

  if (existing) return null; // already recorded

  const [record] = await db
    .insert(schema.expLedger)
    .values({ id: generateId(), userId, amount, source, referenceId })
    .returning();

  // Update user total exp
  await updateUserExp(db, userId, amount);

  return record;
}

export async function getExpLedger(db: DB, userId: string) {
  return db
    .select()
    .from(schema.expLedger)
    .where(eq(schema.expLedger.userId, userId))
    .orderBy(desc(schema.expLedger.createdAt));
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export async function addAchievement(
  db: DB,
  userId: string,
  type: string,
  courseId?: string,
  data?: Record<string, unknown>,
) {
  // Idempotency
  const [existing] = await db
    .select()
    .from(schema.achievements)
    .where(
      and(
        eq(schema.achievements.userId, userId),
        eq(schema.achievements.type, type),
      ),
    )
    .limit(1);
  if (existing) return null;

  const [achievement] = await db
    .insert(schema.achievements)
    .values({
      id: generateId(),
      userId,
      type,
      courseId: courseId ?? null,
      dataBlob: data ? JSON.stringify(data) : null,
    })
    .returning();
  return achievement;
}

export async function getUserAchievements(
  db: DB,
  userId: string,
): Promise<AchievementEntry[]> {
  return db
    .select()
    .from(schema.achievements)
    .where(eq(schema.achievements.userId, userId))
    .orderBy(desc(schema.achievements.earnedAt));
}

// ---------------------------------------------------------------------------
// Challenge attempts
// ---------------------------------------------------------------------------

export async function recordChallengeAttempt(
  db: DB,
  userId: string,
  courseId: string,
  chapterNumber: number,
  attemptNumber: number,
  answers: unknown,
  passed: boolean,
) {
  const [record] = await db
    .insert(schema.challengeAttempts)
    .values({
      id: generateId(),
      userId,
      courseId,
      chapterNumber,
      attemptNumber,
      answersBlob: JSON.stringify(answers),
      passed: passed ? 1 : 0,
    })
    .returning();
  return record;
}

// ---------------------------------------------------------------------------
// Final quiz attempts
// ---------------------------------------------------------------------------

export async function recordFinalQuizAttempt(
  db: DB,
  userId: string,
  courseId: string,
  answers: unknown,
  passed: boolean,
) {
  const [record] = await db
    .insert(schema.finalQuizAttempts)
    .values({
      id: generateId(),
      userId,
      courseId,
      answersBlob: JSON.stringify(answers),
      passed: passed ? 1 : 0,
    })
    .returning();
  return record;
}

// ---------------------------------------------------------------------------
// NFT Qualifications
// ---------------------------------------------------------------------------

export async function createNftQualification(
  db: DB,
  userId: string,
  courseId: string,
) {
  const [existing] = await db
    .select()
    .from(schema.nftQualifications)
    .where(
      and(
        eq(schema.nftQualifications.userId, userId),
        eq(schema.nftQualifications.courseId, courseId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [qualification] = await db
    .insert(schema.nftQualifications)
    .values({ id: generateId(), userId, courseId })
    .returning();
  return qualification;
}

export async function getNftQualification(
  db: DB,
  userId: string,
  courseId: string,
): Promise<NftQualificationEntry | null> {
  const [row] = await db
    .select()
    .from(schema.nftQualifications)
    .where(
      and(
        eq(schema.nftQualifications.userId, userId),
        eq(schema.nftQualifications.courseId, courseId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getUserNftQualifications(
  db: DB,
  userId: string,
): Promise<NftQualificationEntry[]> {
  return db
    .select()
    .from(schema.nftQualifications)
    .where(eq(schema.nftQualifications.userId, userId))
    .orderBy(desc(schema.nftQualifications.createdAt));
}

// ---------------------------------------------------------------------------
// NFT Minting
// ---------------------------------------------------------------------------

export async function createNftMinting(
  db: DB,
  qualificationId: string,
  userId: string,
  walletAddress: string,
) {
  const [record] = await db
    .insert(schema.nftMinting)
    .values({ id: generateId(), qualificationId, userId, walletAddress, status: "pending" })
    .returning();
  return record;
}

export async function updateNftMinting(
  db: DB,
  id: string,
  updates: { status: string; txHash?: string; mintedAt?: string | null },
) {
  const [updated] = await db
    .update(schema.nftMinting)
    .set(updates)
    .where(eq(schema.nftMinting.id, id))
    .returning();
  return updated;
}

export async function getUserNftMintingHistory(
  db: DB,
  userId: string,
): Promise<NftMintingEntry[]> {
  return db
    .select()
    .from(schema.nftMinting)
    .where(eq(schema.nftMinting.userId, userId))
    .orderBy(desc(schema.nftMinting.createdAt));
}

// ---------------------------------------------------------------------------
// System Logs (admin audit)
// ---------------------------------------------------------------------------

export async function logAdminAction(
  db: DB,
  action: string,
  actorId: string,
  targetType?: string,
  targetId?: string,
  beforeState?: Record<string, unknown>,
  afterState?: Record<string, unknown>,
  reason?: string,
) {
  const [record] = await db
    .insert(schema.systemLogs)
    .values({
      id: generateId(),
      actorId,
      action,
      targetType,
      targetId,
      beforeState: beforeState ? JSON.stringify(beforeState) : null,
      afterState: afterState ? JSON.stringify(afterState) : null,
      reason,
    })
    .returning();
  return record;
}

// ---------------------------------------------------------------------------
// 系统配置（运行时动态配置）
// ---------------------------------------------------------------------------

export async function getConfig(db: DB, key: string, defaultValue = ""): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.systemConfig)
    .where(eq(schema.systemConfig.key, key))
    .limit(1);
  return row ? row.value : defaultValue;
}

export async function setConfig(db: DB, key: string, value: string) {
  const now = new Date().toISOString();
  await db
    .insert(schema.systemConfig)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.systemConfig.key,
      set: { value, updatedAt: now },
    });
}

// ---------------------------------------------------------------------------
// 安全温室（Monad Guardian Farm）
// ---------------------------------------------------------------------------

export type SecuritySessionEntry = typeof schema.securitySessions.$inferSelect;
export type SecurityFindingEntry = typeof schema.securityFindings.$inferSelect;
export type SecurityReportEntry = typeof schema.securityReports.$inferSelect;

export type CreateSecuritySessionInput = {
  userId: string;
  scenarioId: string;
  scenarioVersion: string;
  labId: string;
  stateJson?: string;
};

export async function createSecuritySession(
  db: DB,
  input: CreateSecuritySessionInput,
): Promise<SecuritySessionEntry> {
  const [existing] = await db
    .select()
    .from(schema.securitySessions)
    .where(
      and(
        eq(schema.securitySessions.userId, input.userId),
        eq(schema.securitySessions.scenarioId, input.scenarioId),
        eq(schema.securitySessions.scenarioVersion, input.scenarioVersion),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.securitySessions)
    .values({
      id: generateId(),
      userId: input.userId,
      scenarioId: input.scenarioId,
      scenarioVersion: input.scenarioVersion,
      labId: input.labId,
      stateJson: input.stateJson ?? "{}",
    })
    .returning();
  return created;
}

export async function getSecuritySession(
  db: DB,
  userId: string,
  scenarioId: string,
  scenarioVersion: string,
): Promise<SecuritySessionEntry | null> {
  const [row] = await db
    .select()
    .from(schema.securitySessions)
    .where(
      and(
        eq(schema.securitySessions.userId, userId),
        eq(schema.securitySessions.scenarioId, scenarioId),
        eq(schema.securitySessions.scenarioVersion, scenarioVersion),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getSecuritySessionById(
  db: DB,
  id: string,
  userId: string,
): Promise<SecuritySessionEntry | null> {
  const [row] = await db
    .select()
    .from(schema.securitySessions)
    .where(
      and(eq(schema.securitySessions.id, id), eq(schema.securitySessions.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function listSecuritySessions(db: DB, userId: string) {
  return db
    .select()
    .from(schema.securitySessions)
    .where(eq(schema.securitySessions.userId, userId))
    .orderBy(asc(schema.securitySessions.scenarioId));
}

export type UpdateSecuritySessionInput = Partial<{
  status: string;
  currentStep: number;
  score: number;
  stateJson: string;
  completedAt: string | null;
}>;

export async function updateSecuritySession(
  db: DB,
  id: string,
  updates: UpdateSecuritySessionInput,
): Promise<SecuritySessionEntry | null> {
  const setFields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) setFields[key] = value;
  }
  const [updated] = await db
    .update(schema.securitySessions)
    .set(setFields)
    .where(eq(schema.securitySessions.id, id))
    .returning();
  return updated ?? null;
}

export type SubmitSecurityFindingInput = {
  sessionId: string;
  userId: string;
  findingCode: string | null;
  vulnerabilityType: string;
  severity: string;
  title: string;
  evidenceLines: number[];
  rootCause: string;
  impact: string;
  fix: string;
  regression: Record<string, unknown>;
  deterministicScore: number;
  isCorrect: boolean;
};

export async function submitSecurityFinding(db: DB, input: SubmitSecurityFindingInput) {
  const [record] = await db
    .insert(schema.securityFindings)
    .values({
      id: generateId(),
      sessionId: input.sessionId,
      userId: input.userId,
      findingCode: input.findingCode,
      vulnerabilityType: input.vulnerabilityType,
      severity: input.severity,
      title: input.title,
      evidenceJson: JSON.stringify(input.evidenceLines),
      rootCause: input.rootCause,
      impact: input.impact,
      fix: input.fix,
      regressionJson: JSON.stringify(input.regression),
      deterministicScore: input.deterministicScore,
      isCorrect: input.isCorrect ? 1 : 0,
    })
    .returning();
  return record;
}

export async function listSecurityFindings(db: DB, sessionId: string) {
  return db
    .select()
    .from(schema.securityFindings)
    .where(eq(schema.securityFindings.sessionId, sessionId))
    .orderBy(asc(schema.securityFindings.createdAt));
}

export type CreateSecurityReportInput = {
  userId: string;
  sessionId: string | null;
  scenarioId: string;
  trackVersion: string;
  score: number;
  passed: boolean;
  falsePositivePenalty: number;
  summaryJson: string;
  reportJson: string;
  reportMarkdown: string;
  reportHash: string;
  walletAddress: string | null;
};

export async function createSecurityReport(db: DB, input: CreateSecurityReportInput) {
  const [existing] = await db
    .select()
    .from(schema.securityReports)
    .where(
      and(
        eq(schema.securityReports.userId, input.userId),
        eq(schema.securityReports.reportHash, input.reportHash),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [record] = await db
    .insert(schema.securityReports)
    .values({ id: generateId(), ...input, passed: input.passed ? 1 : 0 })
    .returning();
  return record;
}

export async function getSecurityReport(
  db: DB,
  id: string,
  userId: string,
): Promise<SecurityReportEntry | null> {
  const [row] = await db
    .select()
    .from(schema.securityReports)
    .where(
      and(eq(schema.securityReports.id, id), eq(schema.securityReports.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function listSecurityReports(db: DB, userId: string) {
  return db
    .select()
    .from(schema.securityReports)
    .where(eq(schema.securityReports.userId, userId))
    .orderBy(desc(schema.securityReports.createdAt));
}

export type SaveTxRiskCheckInput = {
  userId: string | null;
  chainId: number;
  txHash: string | null;
  toAddress: string | null;
  selector: string | null;
  valueWei: string;
  riskDecision: string;
  riskSeverity: string;
  triggeredRules: unknown;
  calldataHash: string;
};

export async function saveTxRiskCheck(db: DB, input: SaveTxRiskCheckInput) {
  const [record] = await db
    .insert(schema.txRiskChecks)
    .values({
      id: generateId(),
      userId: input.userId,
      chainId: input.chainId,
      txHash: input.txHash,
      toAddress: input.toAddress,
      selector: input.selector,
      valueWei: input.valueWei,
      riskDecision: input.riskDecision,
      riskSeverity: input.riskSeverity,
      triggeredRulesJson: JSON.stringify(input.triggeredRules),
      calldataHash: input.calldataHash,
    })
    .returning();
  return record;
}

/** 服务端聚合安全进度：Lab 通过情况 + 最新报告 */
export async function getSecurityProgressSnapshot(db: DB, userId: string) {
  const sessions = await listSecuritySessions(db, userId);
  const reports = await listSecurityReports(db, userId);
  const latestReport = reports[0] ?? null;
  return {
    sessions: sessions.map((session) => ({
      scenarioId: session.scenarioId,
      scenarioVersion: session.scenarioVersion,
      labId: session.labId,
      status: session.status,
      score: session.score,
      completedAt: session.completedAt,
    })),
    passedScenarios: sessions
      .filter((session) => session.status === "passed")
      .map((session) => session.scenarioId),
    latestReport,
  };
}

export type AgentPolicyEntry = typeof schema.agentPolicies.$inferSelect;

export async function upsertAgentPolicy(
  db: DB,
  userId: string,
  policyJson: string,
  walletAddress?: string | null,
) {
  const now = new Date().toISOString();
  const [record] = await db
    .insert(schema.agentPolicies)
    .values({
      id: generateId(),
      userId,
      walletAddress: walletAddress ?? null,
      policyJson,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.agentPolicies.userId,
      set: { policyJson, walletAddress: walletAddress ?? null, updatedAt: now },
    })
    .returning();
  return record;
}

export async function getAgentPolicy(db: DB, userId: string): Promise<AgentPolicyEntry | null> {
  const [row] = await db
    .select()
    .from(schema.agentPolicies)
    .where(eq(schema.agentPolicies.userId, userId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Convenience wrapper — auto-creates DB if not provided
// ---------------------------------------------------------------------------

export { getDb, type DB };
export type { FarmProgress };
