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
ALTER TABLE `users` ADD `trial_email_at` integer;--> statement-breakpoint
-- Accounts that already render are past onboarding: without this they would
-- see the first-card checklist, get the "you haven't rendered yet" email and
-- each log a fresh first_render. Their real dates are unknown, so signup
-- time stands in.
UPDATE `users` SET `first_render_at` = `created_at`, `live_at` = `created_at` WHERE `id` IN (SELECT `user_id` FROM `usage` WHERE `count` > 0);
