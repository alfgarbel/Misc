CREATE TABLE `cards` (
	`user_id` text NOT NULL,
	`card_key` text NOT NULL,
	`page_url` text,
	`title` text,
	`request` text NOT NULL,
	`error` text,
	`renders` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`last_crawler` text,
	`last_crawled_at` integer,
	PRIMARY KEY(`user_id`, `card_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cards_user_last_seen_idx` ON `cards` (`user_id`,`last_seen_at`);