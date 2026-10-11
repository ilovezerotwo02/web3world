-- =============================================================================
-- 0003_security_lab.sql
-- Monad Guardian Farm：安全温室（安全实验 / finding / 报告 / 交易风险检查 / Agent 策略）
-- 仅新增表，不改动原有课程、进度、NFT 表结构。
-- =============================================================================

CREATE TABLE IF NOT EXISTS `security_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `scenario_id` text NOT NULL,
  `scenario_version` text DEFAULT '1.0.0' NOT NULL,
  `lab_id` text DEFAULT 'lab-1' NOT NULL,
  `status` text DEFAULT 'in_progress' NOT NULL,
  `current_step` integer DEFAULT 1 NOT NULL,
  `score` integer DEFAULT 0 NOT NULL,
  `state_json` text DEFAULT '{}' NOT NULL,
  `started_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  `completed_at` text,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_security_session_idx`
  ON `security_sessions` (`user_id`,`scenario_id`,`scenario_version`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `security_findings` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `user_id` text NOT NULL,
  `finding_code` text,
  `vulnerability_type` text DEFAULT 'unknown' NOT NULL,
  `severity` text DEFAULT 'medium' NOT NULL,
  `title` text DEFAULT '' NOT NULL,
  `evidence_json` text DEFAULT '[]' NOT NULL,
  `root_cause` text DEFAULT '' NOT NULL,
  `impact` text DEFAULT '' NOT NULL,
  `fix` text DEFAULT '' NOT NULL,
  `regression_json` text DEFAULT '{}' NOT NULL,
  `deterministic_score` integer DEFAULT 0 NOT NULL,
  `is_correct` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `security_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `security_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `session_id` text,
  `scenario_id` text DEFAULT 'greenhouse-vault-audit-v1' NOT NULL,
  `track_version` text DEFAULT '2026.1' NOT NULL,
  `score` integer DEFAULT 0 NOT NULL,
  `passed` integer DEFAULT 0 NOT NULL,
  `false_positive_penalty` integer DEFAULT 0 NOT NULL,
  `summary_json` text DEFAULT '{}' NOT NULL,
  `report_json` text DEFAULT '{}' NOT NULL,
  `report_markdown` text DEFAULT '' NOT NULL,
  `report_hash` text DEFAULT '' NOT NULL,
  `wallet_address` text,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_security_report_hash_idx`
  ON `security_reports` (`report_hash`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `tx_risk_checks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `chain_id` integer NOT NULL,
  `tx_hash` text,
  `to_address` text,
  `selector` text,
  `value_wei` text DEFAULT '0' NOT NULL,
  `risk_decision` text DEFAULT 'ALLOW' NOT NULL,
  `risk_severity` text DEFAULT 'INFO' NOT NULL,
  `triggered_rules_json` text DEFAULT '[]' NOT NULL,
  `calldata_hash` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `agent_policies` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `wallet_address` text,
  `policy_json` text DEFAULT '{}' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_agent_policy_idx` ON `agent_policies` (`user_id`);
