CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_name_created_idx` ON `events` (`name`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `first_render_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `live_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nudge_email_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `trial_email_at` integer;