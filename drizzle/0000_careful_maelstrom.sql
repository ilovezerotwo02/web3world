CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`course_id` text,
	`data_blob` text,
	`earned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_achievement_idx` ON `achievements` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `challenge_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`attempt_number` integer NOT NULL,
	`answers_blob` text NOT NULL,
	`passed` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `challenge_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`type` text NOT NULL,
	`question_blob` text NOT NULL,
	`success_msg` text NOT NULL,
	`failure_msg` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`pace` text NOT NULL,
	`objective` text NOT NULL,
	`body` text NOT NULL,
	`terms` text DEFAULT '[]' NOT NULL,
	`example` text NOT NULL,
	`caution` text NOT NULL,
	`is_safety` integer DEFAULT 0 NOT NULL,
	`knowledge_card` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `course_progress` (
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`started` integer DEFAULT 0 NOT NULL,
	`seed_granted` integer DEFAULT 0 NOT NULL,
	`land_cleared` integer DEFAULT 0 NOT NULL,
	`planted` integer DEFAULT 0 NOT NULL,
	`chapters_read` text DEFAULT '[]' NOT NULL,
	`challenge_passed` text DEFAULT '[]' NOT NULL,
	`challenge_mistakes` text DEFAULT '[]' NOT NULL,
	`verification` text DEFAULT 'none' NOT NULL,
	`harvested` integer DEFAULT 0 NOT NULL,
	`recent_activity` text DEFAULT '[]' NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `course_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`seed_type` text NOT NULL,
	`crop_type` text NOT NULL,
	`description` text NOT NULL,
	`order` integer NOT NULL,
	`prerequisites` text DEFAULT '[]' NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_slug_unique` ON `courses` (`slug`);--> statement-breakpoint
CREATE TABLE `exp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`reference_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `final_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`answers_blob` text NOT NULL,
	`passed` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `final_quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`question_blob` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nft_minting` (
	`id` text PRIMARY KEY NOT NULL,
	`qualification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`tx_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`minted_at` text,
	FOREIGN KEY (`qualification_id`) REFERENCES `nft_qualifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nft_qualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`status` text DEFAULT 'eligible' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_nft_qualification_idx` ON `nft_qualifications` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`before_state` text,
	`after_state` text,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`avatar_url` text,
	`exp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `wallet_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`network` text DEFAULT 'monad-testnet' NOT NULL,
	`bound_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`unbound_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_bindings_address_unique` ON `wallet_bindings` (`address`);