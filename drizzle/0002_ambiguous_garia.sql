CREATE TABLE `key_usage` (
	`key_id` text NOT NULL,
	`month` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key_id`, `month`),
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD `name` text DEFAULT 'Default' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `last_used_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `brand_template` text;--> statement-breakpoint
ALTER TABLE `users` ADD `brand_theme` text;--> statement-breakpoint
ALTER TABLE `users` ADD `brand_accent` text;--> statement-breakpoint
ALTER TABLE `users` ADD `brand_site` text;