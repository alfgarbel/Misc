CREATE TABLE `experiment_assignments` (
	`experiment_id` text NOT NULL,
	`key` text NOT NULL,
	`variant_id` text NOT NULL,
	`exposures` integer DEFAULT 0 NOT NULL,
	`conversions` integer DEFAULT 0 NOT NULL,
	`assigned_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`experiment_id`, `key`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`variants` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiments_user_slug_unique` ON `experiments` (`user_id`,`slug`);