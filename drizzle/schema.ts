import { sqliteTable, uniqueIndex, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

export const achievements = sqliteTable("achievements", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	type: text().notNull(),
	courseId: text("course_id").references(() => courses.id, { onDelete: "set null" } ),
	dataBlob: text("data_blob"),
	earnedAt: text("earned_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("unique_achievement_idx").on(table.userId, table.type),
]);

export const challengeAttempts = sqliteTable("challenge_attempts", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	chapterNumber: integer("chapter_number").notNull(),
	attemptNumber: integer("attempt_number").notNull(),
	answersBlob: text("answers_blob").notNull(),
	passed: integer().notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const challengeQuestions = sqliteTable("challenge_questions", {
	id: text().primaryKey().notNull(),
	chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" } ),
	type: text().notNull(),
	questionBlob: text("question_blob").notNull(),
	successMsg: text("success_msg").notNull(),
	failureMsg: text("failure_msg").notNull(),
});

export const chapters = sqliteTable("chapters", {
	id: text().primaryKey().notNull(),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	number: integer().notNull(),
	title: text().notNull(),
	pace: text().notNull(),
	objective: text().notNull(),
	body: text().notNull(),
	terms: text().default("[]").notNull(),
	example: text().notNull(),
	caution: text().notNull(),
	isSafety: integer("is_safety").default(0).notNull(),
	knowledgeCard: text("knowledge_card").notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const courseProgress = sqliteTable("course_progress", {
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	started: integer().default(0).notNull(),
	seedGranted: integer("seed_granted").default(0).notNull(),
	landCleared: integer("land_cleared").default(0).notNull(),
	planted: integer().default(0).notNull(),
	chaptersRead: text("chapters_read").default("[]").notNull(),
	challengePassed: text("challenge_passed").default("[]").notNull(),
	challengeMistakes: text("challenge_mistakes").default("[]").notNull(),
	verification: text().default("none").notNull(),
	harvested: integer().default(0).notNull(),
	recentActivity: text("recent_activity").default("[]").notNull(),
	completedAt: text("completed_at"),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text("updated_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	primaryKey({ columns: [table.userId, table.courseId], name: "course_progress_user_id_course_id_pk"})
]);

export const courses = sqliteTable("courses", {
	id: text().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	seedType: text("seed_type").notNull(),
	cropType: text("crop_type").notNull(),
	description: text().notNull(),
	order: integer().notNull(),
	prerequisites: text().default("[]").notNull(),
	version: text().default("1.0.0").notNull(),
	status: text().default("available").notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("courses_slug_unique").on(table.slug),
]);

export const expLedger = sqliteTable("exp_ledger", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	amount: integer().notNull(),
	source: text().notNull(),
	referenceId: text("reference_id").notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const finalQuizAttempts = sqliteTable("final_quiz_attempts", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	answersBlob: text("answers_blob").notNull(),
	passed: integer().notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const finalQuizQuestions = sqliteTable("final_quiz_questions", {
	id: text().primaryKey().notNull(),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	questionBlob: text("question_blob").notNull(),
});

export const nftMinting = sqliteTable("nft_minting", {
	id: text().primaryKey().notNull(),
	qualificationId: text("qualification_id").notNull().references(() => nftQualifications.id, { onDelete: "cascade" } ),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	walletAddress: text("wallet_address").notNull(),
	status: text().default("pending").notNull(),
	txHash: text("tx_hash"),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	mintedAt: text("minted_at"),
});

export const nftQualifications = sqliteTable("nft_qualifications", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" } ),
	status: text().default("eligible").notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("unique_nft_qualification_idx").on(table.userId, table.courseId),
]);

export const systemLogs = sqliteTable("system_logs", {
	id: text().primaryKey().notNull(),
	actorId: text("actor_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	beforeState: text("before_state"),
	afterState: text("after_state"),
	reason: text(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	username: text().notNull(),
	avatarUrl: text("avatar_url"),
	walletAddress: text("wallet_address"),
	exp: integer().default(0).notNull(),
	level: integer().default(1).notNull(),
	createdAt: text("created_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text("updated_at").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	status: text().default("active").notNull(),
},
(table) => [
	uniqueIndex("users_username_unique").on(table.username),
]);
