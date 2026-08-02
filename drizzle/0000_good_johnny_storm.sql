CREATE TABLE `trading_states` (
	`user_email` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
