CREATE TABLE `url_cache` (
	`url_hash` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`site_name` text,
	`image_url` text,
	`domain` text NOT NULL,
	`fetched_at` integer NOT NULL
);
