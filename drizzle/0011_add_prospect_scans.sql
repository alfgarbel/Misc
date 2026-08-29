CREATE TABLE `prospect_rows` (
	`scan_id` text NOT NULL,
	`idx` integer NOT NULL,
	`input` text NOT NULL,
	`url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`verdict` text,
	`qualified` integer DEFAULT false NOT NULL,
	`finding_id` text,
	`reason` text,
	`claim` text,
	`page_url` text,
	`domain` text,
	`title` text,
	`description` text,
	`site_name` text,
	`findings` text,
	`checked_at` integer,
	PRIMARY KEY(`scan_id`, `idx`),
	FOREIGN KEY (`scan_id`) REFERENCES `prospect_scans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prospect_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'Scan' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`tier` text DEFAULT 'strict' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`qualified` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prospect_scans_user_id_idx` ON `prospect_scans` (`user_id`);