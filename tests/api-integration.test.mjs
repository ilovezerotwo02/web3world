// =============================================================================
// API 集成测试 — 覆盖注册、登录、获取课程核心流程
// 运行方式: node --test test/api-integration.test.mjs
// =============================================================================

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";
import {
  createUser,
  getUser,
  getCourses,
  getCourse,
  getChaptersByCourse,
  getOrCreateProgress,
  getProgress,
  updateProgress,
  addExp,
  getExpLedger,
  addAchievement,
  getUserAchievements,
  recordChallengeAttempt,
  recordFinalQuizAttempt,
  createNftQualification,
  getNftQualification,
  createNftMinting,
  updateNftMinting,
  getUserNftMintingHistory,
  getConfig,
  setConfig,
  logAdminAction,
  checkPrerequisites,
} from "../lib/repositories.ts";
import {
  createSession,
  getSessionByToken,
  deleteSession,
} from "../lib/auth.ts";
import {
  calculateLevel,
  expToNextLevel,
  levelRange,
  EXP_REWARDS,
} from "../lib/exp.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a fresh in-memory database and apply schema */
function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Enable WAL mode and foreign keys
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return { sqlite, db };
}

/** Run raw SQL to create tables from the Drizzle schema */
function createTables(sqlite) {
  // The schema is applied via drizzle-kit push.
  // For in-memory testing, we create tables manually from the SQL migration.
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      wallet_address TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      exp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_challenges (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      seed_type TEXT NOT NULL,
      crop_type TEXT NOT NULL,
      description TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      prerequisites TEXT NOT NULL DEFAULT '[]',
      version TEXT NOT NULL DEFAULT '1.0.0',
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      pace TEXT NOT NULL,
      objective TEXT NOT NULL,
      body TEXT NOT NULL,
      terms TEXT NOT NULL DEFAULT '[]',
      example TEXT NOT NULL,
      caution TEXT NOT NULL,
      is_safety INTEGER NOT NULL DEFAULT 0,
      knowledge_card TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS challenge_questions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      question_blob TEXT NOT NULL,
      success_msg TEXT NOT NULL,
      failure_msg TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS final_quiz_questions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      question_blob TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS course_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      started INTEGER NOT NULL DEFAULT 0,
      seed_granted INTEGER NOT NULL DEFAULT 0,
      land_cleared INTEGER NOT NULL DEFAULT 0,
      planted INTEGER NOT NULL DEFAULT 0,
      chapters_read TEXT NOT NULL DEFAULT '[]',
      challenge_passed TEXT NOT NULL DEFAULT '[]',
      challenge_mistakes TEXT NOT NULL DEFAULT '[]',
      verification TEXT NOT NULL DEFAULT 'none',
      harvested INTEGER NOT NULL DEFAULT 0,
      recent_activity TEXT NOT NULL DEFAULT '[]',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS challenge_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      chapter_number INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL,
      answers_blob TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS final_quiz_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      answers_blob TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS exp_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      course_id TEXT,
      data_blob TEXT,
      earned_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS nft_qualifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'eligible',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS nft_minting (
      id TEXT PRIMARY KEY,
      qualification_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      token_id TEXT,
      contract_address TEXT,
      chain_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      minted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      before_state TEXT,
      after_state TEXT,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `;

  // Execute each statement separately
  for (const stmt of sql.split(";")) {
    const trimmed = stmt.trim();
    if (trimmed) {
      sqlite.exec(trimmed + ";");
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("API 集成测试", () => {
  let sqlite;
  let db;

  before(() => {
    const testDb = createTestDb();
    sqlite = testDb.sqlite;
    db = testDb.db;
    createTables(sqlite);
  });

  after(() => {
    sqlite.close();
  });

  // ==========================================================
  // 1. 用户注册
  // ==========================================================
  describe("注册 (createUser)", () => {
    it("创建新用户，返回完整用户对象", async () => {
      const user = await createUser(db, "test-user-1", "test_user");
      assert.ok(user, "应返回用户对象");
      assert.equal(user.username, "test_user");
      assert.equal(user.role, "user");
      assert.equal(user.exp, 0);
      assert.equal(user.level, 1);
      assert.ok(user.id, "应有 id");
    });

    it("可创建带头像的用户", async () => {
      const user = await createUser(db, "test-user-2", "avatar_user", "https://example.com/avatar.png");
      assert.equal(user.avatarUrl, "https://example.com/avatar.png");
    });

    it("可通过 id 查询用户", async () => {
      const user = await getUser(db, "test-user-1");
      assert.ok(user);
      assert.equal(user.username, "test_user");
    });

    it("查询不存在的用户返回 null", async () => {
      const user = await getUser(db, "non-existent");
      assert.equal(user, null);
    });
  });

  // ==========================================================
  // 2. 登录（会话管理）
  // ==========================================================
  describe("登录 (createSession / getSessionByToken)", () => {
    it("创建会话返回 token", async () => {
      const session = await createSession(db, "test-user-1");
      assert.ok(session, "应返回会话对象");
      assert.ok(session.token, "应有 token");
      assert.equal(session.userId, "test-user-1");
    });

    it("通过 token 查询会话", async () => {
      const session = await createSession(db, "test-user-1");
      const found = await getSessionByToken(db, session.token);
      assert.ok(found);
      assert.equal(found.userId, "test-user-1");
    });

    it("无效 token 查询返回 null", async () => {
      const found = await getSessionByToken(db, "invalid-token");
      assert.equal(found, null);
    });

    it("删除会话", async () => {
      const session = await createSession(db, "test-user-1");
      await deleteSession(db, session.token);
      const found = await getSessionByToken(db, session.token);
      assert.equal(found, null);
    });
  });

  // ==========================================================
  // 3. 课程与种子数据
  // ==========================================================
  describe("课程 (getCourses / getCourse / getChaptersByCourse)", () => {
    before(() => {
      // Seed course data
      sqlite.exec(`
        INSERT INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
        VALUES ('web3', 'web3', 'Web3 通识', '账本星种', '守护浆果', '理解账户、钱包、交易和基础安全。', 1, '[]', '1.0.0', 'available');
        INSERT INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
        VALUES ('monad', 'monad', 'Monad 基础', '并行紫藤种', 'Monad 紫藤果', '认识 Monad、RPC、区块浏览器与测试环境。', 2, '["web3"]', '1.0.0', 'available');
        INSERT INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
        VALUES ('contract', 'contract', '智能合约', '合约卷轴种', '合约晶果', '理解合约状态、函数、ABI、事件与权限风险。', 3, '["monad"]', '1.0.0', 'locked');

        INSERT INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
        VALUES ('account', 'web3', 1, '区块链、账户与地址', '认识 / 破冰', '学完你会知道...', '区块链可以理解成...', '["区块链","钱包地址","不可篡改"]', '你可以把钱包地址...', '地址公开不等于...', 0, '{"definition":"区块链是一本公开、不可篡改的账本。","reason":"理解公开可查和资产安全是两回事..."}');
        INSERT INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
        VALUES ('transaction', 'web3', 2, '读取、签名与交易', '熟练 / 巩固', '学完你会分辨...', '链上操作分为读取和写入。', '["读取操作","写入操作","签名","Gas"]', '查看钱包里的 USDC...', '签名意味着授权...', 0, '{"definition":"读取是查看链上数据，写入是改变链上数据并需要签名授权。","reason":"分清两者，才能判断当前步骤是否应该请求你的确认。"}');
        INSERT INTO chapters (id, course_id, number, title, pace, objective, body, terms, example, caution, is_safety, knowledge_card)
        VALUES ('security', 'web3', 3, '私钥、助记词与签名风险', '认真收尾 / 风险判断', '学完你会知道...', '钱包地址是公开的门牌号...', '["私钥","助记词","盲签"]', '银行不会询问银行卡密码...', '交出助记词等于交出全部控制权。', 1, '{"definition":"私钥和助记词代表完全控制权，签名代表对单次操作的授权。","reason":"泄露密钥和盲签是链上资产被盗的主要原因。"}');

        INSERT INTO challenge_questions (id, chapter_id, type, question_blob, success_msg, failure_msg)
        VALUES ('cq-account-1', 'account', 'choice', '{"scene":"test","prompt":"区块链上的交易记录一旦被网络确认，任何单方都无法私自修改。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}', '没错', '再想想');

        INSERT INTO final_quiz_questions (id, course_id, question_blob)
        VALUES ('fq-web3-1', 'web3', '{"prompt":"区块链上的交易一旦确认，无法被单方面修改。","options":[{"id":"true","label":"正确"},{"id":"false","label":"错误"}],"answer":"true"}');
      `);
    });

    it("获取所有课程列表", async () => {
      const allCourses = await getCourses(db);
      assert.equal(allCourses.length, 3);
      assert.equal(allCourses[0].title, "Web3 通识");
      assert.equal(allCourses[1].title, "Monad 基础");
      assert.equal(allCourses[2].title, "智能合约");
    });

    it("获取课程按 order 排序", async () => {
      const allCourses = await getCourses(db);
      assert.equal(allCourses[0].order, 1);
      assert.equal(allCourses[1].order, 2);
      assert.equal(allCourses[2].order, 3);
    });

    it("通过 slug 获取单个课程", async () => {
      const course = await getCourse(db, "web3");
      assert.ok(course);
      assert.equal(course.title, "Web3 通识");
    });

    it("获取不存在的课程返回 null", async () => {
      const course = await getCourse(db, "non-existent");
      assert.equal(course, null);
    });

    it("获取课程的章节列表", async () => {
      const chapters = await getChaptersByCourse(db, "web3");
      assert.equal(chapters.length, 3);
      assert.equal(chapters[0].title, "区块链、账户与地址");
      assert.equal(chapters[1].title, "读取、签名与交易");
      assert.equal(chapters[2].title, "私钥、助记词与签名风险");
    });

    it("章节按 number 排序", async () => {
      const chapters = await getChaptersByCourse(db, "web3");
      assert.equal(chapters[0].number, 1);
      assert.equal(chapters[1].number, 2);
      assert.equal(chapters[2].number, 3);
    });

    it("挑战题包含正确的 question_blob 结构", async () => {
      const [q] = db
        .select()
        .from(schema.challengeQuestions)
        .where(eq(schema.challengeQuestions.id, "cq-account-1"))
        .all();
      assert.ok(q);
      const blob = JSON.parse(q.questionBlob);
      assert.ok(blob.scene);
      assert.ok(blob.prompt);
      assert.ok(Array.isArray(blob.options));
      assert.ok(blob.answer);
    });
  });

  // ==========================================================
  // 3b. 课程前置条件校验
  // ==========================================================
  describe("课程前置条件 (checkPrerequisites)", () => {
    const userId = "prereq-test-user";
    const username = "prereq_user";

    before(async () => {
      // 确保课程种子数据已存在
      // 注册用户
      await createUser(db, userId, username);
    });

    it("无前置条件的课程返回 null", async () => {
      const err = await checkPrerequisites(db, userId, "web3");
      assert.equal(err, null);
    });

    it("有前置条件但未完成时返回错误信息", async () => {
      const err = await checkPrerequisites(db, userId, "monad");
      assert.equal(err, "请先完成前置课程: web3");
    });

    it("有前置条件且已完成时返回 null", async () => {
      // 创建并完成 web3 课程的进度
      await getOrCreateProgress(db, userId, "web3");
      const now = new Date().toISOString();
      await updateProgress(db, userId, "web3", {
        started: 1,
        seedGranted: 1,
        landCleared: 1,
        planted: 1,
        chaptersRead: JSON.stringify([true, true, true]),
        challengePassed: JSON.stringify([true, true, true]),
        verification: "passed",
        harvested: 1,
        completedAt: now,
      });

      const err = await checkPrerequisites(db, userId, "monad");
      assert.equal(err, null);
    });

    it("不存在的课程返回错误信息", async () => {
      const err = await checkPrerequisites(db, userId, "non-existent");
      assert.equal(err, "Course not found");
    });
  });

  // ==========================================================
  // 4. 完整流程：注册 → 创建进度 → 更新进度 → 查询 EXP
  // ==========================================================
  describe("完整流程 (注册 → 进度 → EXP)", () => {
    const userId = "flow-test-user";
    const username = "flow_user";

    it("创建用户", async () => {
      const user = await createUser(db, userId, username);
      assert.equal(user.username, username);
    });

    it("获取或创建课程进度", async () => {
      const progress = await getOrCreateProgress(db, userId, "web3");
      assert.ok(progress);
      assert.equal(progress.userId, userId);
      assert.equal(progress.courseId, "web3");
      assert.equal(progress.started, 0);
    });

    it("getOrCreateProgress 幂等：再次调用返回已有记录", async () => {
      const p1 = await getOrCreateProgress(db, userId, "web3");
      const p2 = await getOrCreateProgress(db, userId, "web3");
      assert.equal(p1.id, p2.id);
    });

    it("更新进度并查询", async () => {
      await updateProgress(db, userId, "web3", { started: 1, seedGranted: 1 });
      const progress = await getProgress(db, userId, "web3");
      assert.ok(progress);
      assert.equal(progress.started, true);
      assert.equal(progress.seedGranted, true);
    });

    it("添加 EXP 奖励", async () => {
      const record = await addExp(db, userId, 10, "start_course", "web3-start");
      assert.ok(record);
      assert.equal(record.amount, 10);
      assert.equal(record.source, "start_course");
    });

    it("addExp 幂等：相同 referenceId 不重复发放", async () => {
      const record = await addExp(db, userId, 10, "start_course", "web3-start");
      assert.equal(record, null);
    });

    it("查询 EXP 流水", async () => {
      const ledger = await getExpLedger(db, userId);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].amount, 10);
    });

    it("更新进度的 completedAt", async () => {
      const now = new Date().toISOString();
      await updateProgress(db, userId, "web3", {
        harvested: 1,
        completedAt: now,
      });
      const progress = await getProgress(db, userId, "web3");
      assert.equal(progress.harvested, true);
    });

    it("toFarmProgress 正确处理空数组", async () => {
      const progress = await getProgress(db, userId, "web3");
      assert.ok(Array.isArray(progress.chaptersRead));
      assert.equal(progress.chaptersRead.length, 3);
      assert.equal(progress.chaptersRead[0], false);
      assert.equal(progress.chaptersRead[1], false);
      assert.equal(progress.chaptersRead[2], false);
      assert.equal(progress.verification, "none");
    });
  });

  // ==========================================================
  // 5. 成就系统
  // ==========================================================
  describe("成就系统", () => {
    it("添加成就", async () => {
      const achievement = await addAchievement(db, "test-user-1", "first_course", "web3");
      assert.ok(achievement);
      assert.equal(achievement.type, "first_course");
    });

    it("addAchievement 幂等", async () => {
      const achievement = await addAchievement(db, "test-user-1", "first_course", "web3");
      assert.equal(achievement, null);
    });

    it("查询用户成就", async () => {
      const achievements = await getUserAchievements(db, "test-user-1");
      assert.equal(achievements.length, 1);
      assert.equal(achievements[0].type, "first_course");
    });

    it("不同用户成就隔离", async () => {
      const achievements = await getUserAchievements(db, "test-user-2");
      assert.equal(achievements.length, 0);
    });
  });

  // ==========================================================
  // 6. 挑战记录
  // ==========================================================
  describe("挑战记录", () => {
    it("记录挑战答题", async () => {
      const attempt = await recordChallengeAttempt(db, "test-user-1", "web3", 0, 1, { answer: "true" }, true);
      assert.ok(attempt);
      assert.equal(attempt.passed, 1);
    });

    it("记录结课小测", async () => {
      const attempt = await recordFinalQuizAttempt(db, "test-user-1", "web3", { q1: "true" }, true);
      assert.ok(attempt);
      assert.equal(attempt.passed, 1);
    });
  });

  // ==========================================================
  // 7. NFT 资格
  // ==========================================================
  describe("NFT 资格", () => {
    it("创建 NFT 资格", async () => {
      const qual = await createNftQualification(db, "test-user-1", "web3");
      assert.ok(qual);
      assert.equal(qual.status, "eligible");
    });

    it("createNftQualification 幂等", async () => {
      const qual = await createNftQualification(db, "test-user-1", "web3");
      assert.ok(qual); // returns existing, not null
    });

    it("查询 NFT 资格", async () => {
      const qual = await getNftQualification(db, "test-user-1", "web3");
      assert.ok(qual);
      assert.equal(qual.courseId, "web3");
    });

    it("查询不存在的 NFT 资格返回 null", async () => {
      const qual = await getNftQualification(db, "test-user-1", "non-existent");
      assert.equal(qual, null);
    });
  });

  // ==========================================================
  // 8. 完整 E2E 流程：课程完成 → NFT 铸造 → 链上确认
  // ==========================================================
  describe("完整 E2E 流程 (课程完成 → 申请铸币 → 铸币分发)", () => {
    const userId = "e2e-test-user";
    const username = "e2e_flow_user";
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";
    let confirmedMintingId; // 存储已确认的铸造记录 ID

    it("1. 注册用户", async () => {
      const user = await createUser(db, userId, username);
      assert.equal(user.username, username);
      assert.equal(user.exp, 0);
      assert.equal(user.level, 1);
    });

    it("2. 完成课程全部流程 (start → clear → plant → read → challenge → verify → harvest)", async () => {
      // 先创建进度记录
      await getOrCreateProgress(db, userId, "web3");

      // 2a. 开始课程
      await updateProgress(db, userId, "web3", { started: 1, seedGranted: 1 });
      let p = await getProgress(db, userId, "web3");
      assert.equal(p.started, true);
      assert.equal(p.seedGranted, true);

      // 2b. 开垦
      await updateProgress(db, userId, "web3", { landCleared: 1 });
      p = await getProgress(db, userId, "web3");
      assert.equal(p.landCleared, true);

      // 2c. 播种
      await updateProgress(db, userId, "web3", { planted: 1 });
      p = await getProgress(db, userId, "web3");
      assert.equal(p.planted, true);

      // 2d. 阅读全部 3 个章节
      await updateProgress(db, userId, "web3", { chaptersRead: JSON.stringify([true, true, true]) });
      p = await getProgress(db, userId, "web3");
      assert.deepEqual(p.chaptersRead, [true, true, true]);

      // 2e. 通过全部 3 个挑战
      await updateProgress(db, userId, "web3", { challengePassed: JSON.stringify([true, true, true]) });
      p = await getProgress(db, userId, "web3");
      assert.deepEqual(p.challengePassed, [true, true, true]);

      // 2f. 验证通过
      await updateProgress(db, userId, "web3", { verification: "passed" });
      p = await getProgress(db, userId, "web3");
      assert.equal(p.verification, "passed");

      // 2g. 收获
      const now = new Date().toISOString();
      await updateProgress(db, userId, "web3", { harvested: 1, completedAt: now });
      p = await getProgress(db, userId, "web3");
      assert.equal(p.harvested, true);
    });

    it("3. 添加课程 EXP 奖励（模拟 real 流程中的 EXP 发放）", async () => {
      // 模拟各阶段 EXP 奖励
      await addExp(db, userId, EXP_REWARDS.START_COURSE, "start_course", "web3-start");
      await addExp(db, userId, EXP_REWARDS.CLEAR_LAND, "clear_land", "web3-clear");
      await addExp(db, userId, EXP_REWARDS.PLANT, "plant", "web3-plant");
      for (let i = 0; i < 3; i++) {
        await addExp(db, userId, EXP_REWARDS.CHAPTER_READ, "chapter_read", `web3-ch${i}`);
        await addExp(db, userId, EXP_REWARDS.CHALLENGE_PASSED, "challenge_passed", `web3-ch${i}-pass`);
      }
      await addExp(db, userId, EXP_REWARDS.VERIFICATION_PASSED, "verification", "web3-verify");

      // 验证 EXP 累计
      const ledger = await getExpLedger(db, userId);
      const totalExp = ledger.reduce((sum, r) => sum + r.amount, 0);
      const expected = EXP_REWARDS.START_COURSE +
        EXP_REWARDS.CLEAR_LAND +
        EXP_REWARDS.PLANT +
        3 * EXP_REWARDS.CHAPTER_READ +
        3 * EXP_REWARDS.CHALLENGE_PASSED +
        EXP_REWARDS.VERIFICATION_PASSED;
      assert.equal(totalExp, expected);
      assert.equal(ledger.length, 1 + 1 + 1 + 3 + 3 + 1); // 10 条记录
    });

    it("4. 创建 NFT 铸造资格", async () => {
      const qual = await createNftQualification(db, userId, "web3");
      assert.ok(qual);
      assert.equal(qual.userId, userId);
      assert.equal(qual.courseId, "web3");
      assert.equal(qual.status, "eligible");
    });

    it("5. 创建铸造申请记录 (pending)", async () => {
      const qual = await getNftQualification(db, userId, "web3");
      assert.ok(qual);

      const minting = await createNftMinting(db, qual.id, userId, walletAddress);
      assert.ok(minting);
      assert.equal(minting.status, "pending");
      assert.equal(minting.walletAddress, walletAddress);
      assert.equal(minting.qualificationId, qual.id);
    });

    it("6. 模拟链上铸造成功 → 更新状态为 confirmed", async () => {
      const history = await getUserNftMintingHistory(db, userId);
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "pending");

      // 模拟链上铸造成功
      const txHash = "0x" + "a".repeat(64);
      const now = new Date().toISOString();
      const updated = await updateNftMinting(db, history[0].id, {
        status: "confirmed",
        txHash,
        mintedAt: now,
      });
      assert.ok(updated);
      assert.equal(updated.status, "confirmed");
      assert.equal(updated.txHash, txHash);
      assert.ok(updated.mintedAt);
      confirmedMintingId = updated.id; // 保存已确认的铸造记录 ID
    });

    it("7. 验证铸造历史和资格状态", async () => {
      const history = await getUserNftMintingHistory(db, userId);
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "confirmed");
      assert.ok(history[0].txHash);
      assert.ok(history[0].mintedAt);

      // 资格仍然是 eligible（仅在链上确认后由 nft 路由更新为 minted）
      const qual = await getNftQualification(db, userId, "web3");
      assert.equal(qual.status, "eligible");
    });

    it("8. 铸造失败场景：更新状态为 failed", async () => {
      // 创建一个新的资格和铸造记录来测试失败场景
      const qual2 = await createNftQualification(db, userId, "monad");
      assert.ok(qual2);

      const minting2 = await createNftMinting(db, qual2.id, userId, walletAddress);
      assert.equal(minting2.status, "pending");

      const failed = await updateNftMinting(db, minting2.id, { status: "failed" });
      assert.equal(failed.status, "failed");

      // 按 ID 验证两条记录的状态
      assert.ok(confirmedMintingId, "confirmedMintingId should be set from step 6");
      const confirmedRecord = await db
        .select()
        .from(schema.nftMinting)
        .where(eq(schema.nftMinting.id, confirmedMintingId))
        .limit(1)
        .then(rows => rows[0]);
      assert.equal(confirmedRecord.status, "confirmed");

      const failedRecord = await db
        .select()
        .from(schema.nftMinting)
        .where(eq(schema.nftMinting.id, minting2.id))
        .limit(1)
        .then(rows => rows[0]);
      assert.equal(failedRecord.status, "failed");
    });
  });

  // ==========================================================
  // 8b. 完整全流程：前置课程 → 二级课程 → 铸币 → 分发
  // ==========================================================
  describe("完整全流程 (web3 → monad → 铸币 → 分发)", () => {
    const userId = "full-flow-user";
    const username = "full_flow_user";
    const walletAddress = "0xabcdef1234567890abcdef1234567890abcdef12";

    before(() => {
      // Ensure course data is seeded (courses table may be empty if the "课程" section
      // was not executed or the database was reset)
      const existing = db.select().from(schema.courses).where(eq(schema.courses.id, "web3")).all();
      if (existing.length === 0) {
        sqlite.exec(`
          INSERT INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
          VALUES ('web3', 'web3', 'Web3 通识', '账本星种', '守护浆果', 'test', 1, '[]', '1.0.0', 'available');
          INSERT INTO courses (id, slug, title, seed_type, crop_type, description, "order", prerequisites, version, status)
          VALUES ('monad', 'monad', 'Monad 基础', '并行紫藤种', 'Monad 紫藤果', 'test', 2, '["web3"]', '1.0.0', 'available');
        `);
      }
    });

    it("1. 注册用户", async () => {
      const user = await createUser(db, userId, username);
      assert.equal(user.walletAddress, null);
      assert.equal(user.exp, 0);
      assert.equal(user.level, 1);
    });

    it("2. 完成前置课程 web3 全部流程", async () => {
      await getOrCreateProgress(db, userId, "web3");

      // 开始课程
      await updateProgress(db, userId, "web3", { started: 1, seedGranted: 1 });
      let p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.started, true);
      assert.equal(p.seedGranted, true);

      // 开垦
      await updateProgress(db, userId, "web3", { landCleared: 1 });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.landCleared, true);

      // 播种
      await updateProgress(db, userId, "web3", { planted: 1 });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.planted, true);

      // 阅读 3 个章节
      await updateProgress(db, userId, "web3", { chaptersRead: JSON.stringify([true, true, true]) });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.deepEqual(p.chaptersRead, [true, true, true]);

      // 通过 3 个挑战（无错题 → 完美）
      await updateProgress(db, userId, "web3", { challengePassed: JSON.stringify([true, true, true]) });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.deepEqual(p.challengePassed, [true, true, true]);

      // 验证通过
      await updateProgress(db, userId, "web3", { verification: "passed" });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.verification, "passed");

      // 收获
      const now = new Date().toISOString();
      await updateProgress(db, userId, "web3", { harvested: 1, completedAt: now });
      p = await getProgress(db, userId, "web3");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.harvested, true);
    });

    it("3. 前置课程 web3 结束后 checkPrerequisites(monad) 通过", async () => {
      const err = await checkPrerequisites(db, userId, "monad");
      assert.equal(err, null);
    });

    it("4. 完成二级课程 monad 全部流程", async () => {
      await getOrCreateProgress(db, userId, "monad");
      const now = new Date().toISOString();

      await updateProgress(db, userId, "monad", { started: 1, seedGranted: 1, landCleared: 1, planted: 1 });
      let p = await getProgress(db, userId, "monad");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.planted, true);

      await updateProgress(db, userId, "monad", { chaptersRead: JSON.stringify([true, true, true]) });
      await updateProgress(db, userId, "monad", { challengePassed: JSON.stringify([true, true, true]) });
      await updateProgress(db, userId, "monad", { verification: "passed" });
      await updateProgress(db, userId, "monad", { harvested: 1, completedAt: now });
      p = await getProgress(db, userId, "monad");
      assert.ok(p, "getProgress should not return null");
      assert.equal(p.harvested, true);
    });

    it("5. 颁发 EXP 奖励并验证等级", async () => {
      // web3 课程 EXP
      await addExp(db, userId, EXP_REWARDS.START_COURSE, "start_course", "web3-start");
      await addExp(db, userId, EXP_REWARDS.CLEAR_LAND, "clear_land", "web3-clear");
      await addExp(db, userId, EXP_REWARDS.PLANT, "plant", "web3-plant");
      for (let i = 0; i < 3; i++) {
        await addExp(db, userId, EXP_REWARDS.CHAPTER_READ, "chapter_read", `web3-ch${i}`);
        await addExp(db, userId, EXP_REWARDS.CHALLENGE_PASSED, "challenge_passed", `web3-ch${i}-pass`);
        await addExp(db, userId, EXP_REWARDS.CHALLENGE_PERFECT, "challenge_perfect", `web3-ch${i}-perfect`);
      }
      await addExp(db, userId, EXP_REWARDS.VERIFICATION_PASSED, "verification", "web3-verify");

      // monad 课程 EXP（简化版，只发关键奖励）
      await addExp(db, userId, EXP_REWARDS.START_COURSE, "start_course", "monad-start");
      await addExp(db, userId, EXP_REWARDS.CLEAR_LAND, "clear_land", "monad-clear");
      await addExp(db, userId, EXP_REWARDS.PLANT, "plant", "monad-plant");
      for (let i = 0; i < 3; i++) {
        await addExp(db, userId, EXP_REWARDS.CHAPTER_READ, "chapter_read", `monad-ch${i}`);
        await addExp(db, userId, EXP_REWARDS.CHALLENGE_PASSED, "challenge_passed", `monad-ch${i}-pass`);
      }
      await addExp(db, userId, EXP_REWARDS.VERIFICATION_PASSED, "verification", "monad-verify");

      // 验证 EXP 流水
      const ledger = await getExpLedger(db, userId);
      assert.equal(ledger.length, 2 * (1 + 1 + 1 + 3 + 3 + 1) + 3); // web3 + monad + 3 perfect
      const totalExp = ledger.reduce((sum, r) => sum + r.amount, 0);
      const expectedPerCourse = EXP_REWARDS.START_COURSE + EXP_REWARDS.CLEAR_LAND + EXP_REWARDS.PLANT +
        3 * (EXP_REWARDS.CHAPTER_READ + EXP_REWARDS.CHALLENGE_PASSED) +
        EXP_REWARDS.VERIFICATION_PASSED;
      const expectedTotal = 2 * expectedPerCourse + 3 * EXP_REWARDS.CHALLENGE_PERFECT;
      assert.equal(totalExp, expectedTotal);
    });

    it("6. 为 monad 课程创建 NFT 铸造资格", async () => {
      const qual = await createNftQualification(db, userId, "monad");
      assert.ok(qual);
      assert.equal(qual.userId, userId);
      assert.equal(qual.courseId, "monad");
      assert.equal(qual.status, "eligible");
    });

    it("7. 创建 pending 铸造申请", async () => {
      const qual = await getNftQualification(db, userId, "monad");
      assert.ok(qual);

      const minting = await createNftMinting(db, qual.id, userId, walletAddress);
      assert.ok(minting);
      assert.equal(minting.status, "pending");
      assert.equal(minting.walletAddress, walletAddress);
      assert.equal(minting.qualificationId, qual.id);
    });

    it("8. 模拟链上铸造成功 → 状态更新为 confirmed", async () => {
      const history = await getUserNftMintingHistory(db, userId);
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "pending");

      const txHash = "0x" + "c".repeat(64);
      const now = new Date().toISOString();
      const updated = await updateNftMinting(db, history[0].id, {
        status: "confirmed",
        txHash,
        mintedAt: now,
      });
      assert.equal(updated.status, "confirmed");
      assert.equal(updated.txHash, txHash);
      assert.ok(updated.mintedAt);
    });

    it("9. 验证最终数据一致性", async () => {
      // 用户等级
      const user = await getUser(db, userId);
      assert.ok(user.level >= 1);

      // 两门课程均已收获
      const w = await getProgress(db, userId, "web3");
      assert.equal(w.harvested, true);
      const m = await getProgress(db, userId, "monad");
      assert.equal(m.harvested, true);

      // NFT 铸造历史
      const history = await getUserNftMintingHistory(db, userId);
      assert.equal(history.length, 1);
      assert.equal(history[0].status, "confirmed");
      assert.equal(history[0].walletAddress, walletAddress);

      // 铸造资格
      const qual = await getNftQualification(db, userId, "monad");
      assert.equal(qual.status, "eligible");

      // 验证 EXP 层次
      const ledger = await getExpLedger(db, userId);
      const sources = [...new Set(ledger.map(r => r.source))].sort();
      assert.ok(sources.includes("start_course"));
      assert.ok(sources.includes("clear_land"));
      assert.ok(sources.includes("plant"));
      assert.ok(sources.includes("chapter_read"));
      assert.ok(sources.includes("challenge_passed"));
      assert.ok(sources.includes("challenge_perfect"));
      assert.ok(sources.includes("verification"));
    });
  });

  // ==========================================================
  // 9. 系统配置
  // ==========================================================
  describe("系统配置", () => {
    it("获取不存在的配置返回默认值", async () => {
      const value = await getConfig(db, "non_existent_key", "default");
      assert.equal(value, "default");
    });

    it("设置并获取配置", async () => {
      await setConfig(db, "agent_review_enabled", "true");
      const value = await getConfig(db, "agent_review_enabled", "false");
      assert.equal(value, "true");
    });

    it("setConfig 幂等：重复设置覆盖值", async () => {
      await setConfig(db, "agent_review_enabled", "false");
      const value = await getConfig(db, "agent_review_enabled", "true");
      assert.equal(value, "false");
    });
  });

  // ==========================================================
  // 9. 审计日志
  // ==========================================================
  describe("审计日志", () => {
    it("记录管理员操作", async () => {
      const log = await logAdminAction(db, "test_action", "test-user-1", "user", "test-user-2", { old: "a" }, { new: "b" }, "测试操作");
      assert.ok(log);
      assert.equal(log.action, "test_action");
      assert.equal(log.actorId, "test-user-1");
      assert.equal(log.targetId, "test-user-2");
    });
  });

  // ==========================================================
  // 10. 等级计算
  // ==========================================================
  describe("等级计算", () => {
    it("等级 1 需要 0 EXP", () => {
      const level = calculateLevel(0);
      assert.equal(level, 1);
    });

    it("等级 2 需要 100 EXP", () => {
      const level = calculateLevel(100);
      assert.equal(level, 2);
    });

    it("等级 3 需要 250 EXP", () => {
      const level = calculateLevel(250);
      assert.equal(level, 3);
    });

    it("200 EXP 距离等级 3 还需 50 EXP", () => {
      const needed = expToNextLevel(200);
      assert.equal(needed, 50);
    });

    it("最大等级时不返回 0 EXP 需求", () => {
      const needed = expToNextLevel(5000);
      assert.equal(needed, 0);
    });

    it("levelRange 返回正确阈值", () => {
      const range = levelRange(2);
      assert.equal(range.min, 100);
      assert.equal(range.max, 250);
    });

    it("EXP_REWARDS 常量正确", () => {
      assert.equal(EXP_REWARDS.START_COURSE, 10);
      assert.equal(EXP_REWARDS.CHALLENGE_PASSED, 20);
      assert.equal(EXP_REWARDS.VERIFICATION_PASSED, 50);
      assert.equal(EXP_REWARDS.HARVEST, 100);
    });
  });
});
