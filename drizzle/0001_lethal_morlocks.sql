CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 600000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);
--> statement-breakpoint
CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_sessions_account_idx` ON `account_sessions` (`account_id`);
--> statement-breakpoint
CREATE INDEX `account_sessions_expires_idx` ON `account_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `account_states` (
	`account_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
