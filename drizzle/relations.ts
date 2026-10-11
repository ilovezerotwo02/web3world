import { relations } from "drizzle-orm/relations";
import { courses, achievements, users, challengeAttempts, chapters, challengeQuestions, courseProgress, expLedger, finalQuizAttempts, finalQuizQuestions, nftMinting, nftQualifications } from "./schema";

export const achievementsRelations = relations(achievements, ({one}) => ({
	course: one(courses, {
		fields: [achievements.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [achievements.userId],
		references: [users.id]
	}),
}));

export const coursesRelations = relations(courses, ({many}) => ({
	achievements: many(achievements),
	challengeAttempts: many(challengeAttempts),
	chapters: many(chapters),
	courseProgresses: many(courseProgress),
	finalQuizAttempts: many(finalQuizAttempts),
	finalQuizQuestions: many(finalQuizQuestions),
	nftQualifications: many(nftQualifications),
}));

export const usersRelations = relations(users, ({many}) => ({
	achievements: many(achievements),
	challengeAttempts: many(challengeAttempts),
	courseProgresses: many(courseProgress),
	expLedgers: many(expLedger),
	finalQuizAttempts: many(finalQuizAttempts),
	nftMintings: many(nftMinting),
	nftQualifications: many(nftQualifications),
}));

export const challengeAttemptsRelations = relations(challengeAttempts, ({one}) => ({
	course: one(courses, {
		fields: [challengeAttempts.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [challengeAttempts.userId],
		references: [users.id]
	}),
}));

export const challengeQuestionsRelations = relations(challengeQuestions, ({one}) => ({
	chapter: one(chapters, {
		fields: [challengeQuestions.chapterId],
		references: [chapters.id]
	}),
}));

export const chaptersRelations = relations(chapters, ({one, many}) => ({
	challengeQuestions: many(challengeQuestions),
	course: one(courses, {
		fields: [chapters.courseId],
		references: [courses.id]
	}),
}));

export const courseProgressRelations = relations(courseProgress, ({one}) => ({
	course: one(courses, {
		fields: [courseProgress.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [courseProgress.userId],
		references: [users.id]
	}),
}));

export const expLedgerRelations = relations(expLedger, ({one}) => ({
	user: one(users, {
		fields: [expLedger.userId],
		references: [users.id]
	}),
}));

export const finalQuizAttemptsRelations = relations(finalQuizAttempts, ({one}) => ({
	course: one(courses, {
		fields: [finalQuizAttempts.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [finalQuizAttempts.userId],
		references: [users.id]
	}),
}));

export const finalQuizQuestionsRelations = relations(finalQuizQuestions, ({one}) => ({
	course: one(courses, {
		fields: [finalQuizQuestions.courseId],
		references: [courses.id]
	}),
}));

export const nftMintingRelations = relations(nftMinting, ({one}) => ({
	user: one(users, {
		fields: [nftMinting.userId],
		references: [users.id]
	}),
	nftQualification: one(nftQualifications, {
		fields: [nftMinting.qualificationId],
		references: [nftQualifications.id]
	}),
}));

export const nftQualificationsRelations = relations(nftQualifications, ({one, many}) => ({
	nftMintings: many(nftMinting),
	course: one(courses, {
		fields: [nftQualifications.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [nftQualifications.userId],
		references: [users.id]
	}),
}));