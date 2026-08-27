-- OGsmith database setup
-- Paste this whole file into the Turso dashboard SQL editor and run it once.
-- It creates every table the app needs, and records the migrations exactly
-- as the command-line migrator would, so future migrations stay in sync.

-- ---------- 0000_serious_crystal ----------
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_period_end` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `usage` (
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `month`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

-- ---------- 0001_spotty_kang ----------
CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `auth_tokens_token_hash_unique` ON `auth_tokens` (`token_hash`);
ALTER TABLE `users` ADD `signing_secret` text;
ALTER TABLE `users` ADD `email_verified_at` integer;

-- ---------- 0002_ambiguous_garia ----------
CREATE TABLE `key_usage` (
	`key_id` text NOT NULL,
	`month` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key_id`, `month`),
	FOREIGN KEY (`key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
ALTER TABLE `api_keys` ADD `name` text DEFAULT 'Default' NOT NULL;
ALTER TABLE `api_keys` ADD `last_used_at` integer;
ALTER TABLE `users` ADD `brand_template` text;
ALTER TABLE `users` ADD `brand_theme` text;
ALTER TABLE `users` ADD `brand_accent` text;
ALTER TABLE `users` ADD `brand_site` text;

-- ---------- 0003_shocking_human_torch ----------
ALTER TABLE `usage` ADD `alert80_at` integer;
ALTER TABLE `usage` ADD `alert100_at` integer;
ALTER TABLE `users` ADD `brand_logo` text;

-- ---------- 0004_optimal_warbound ----------
DROP INDEX "api_keys_key_hash_unique";
DROP INDEX "auth_tokens_token_hash_unique";
DROP INDEX "users_email_unique";
ALTER TABLE `users` ALTER COLUMN "password_hash" TO "password_hash" text;
ALTER TABLE `users` ADD `google_id` text;
ALTER TABLE `users` ADD `name` text;
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
CREATE UNIQUE INDEX `auth_tokens_token_hash_unique` ON `auth_tokens` (`token_hash`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);

-- ---------- 0005_add_cache_version ----------
ALTER TABLE `users` ADD `cache_version` integer DEFAULT 1 NOT NULL;
ALTER TABLE `users` ADD `brand_updated_at` integer;

-- ---------- 0006_add_templates_and_assets ----------
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`data` text NOT NULL,
	`font_family` text,
	`font_weight` integer,
	`font_style` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `assets_user_id_idx` ON `assets` (`user_id`);
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`spec` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `templates_user_slug_unique` ON `templates` (`user_id`,`slug`);

-- ---------- 0007_add_url_cache ----------
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

-- ---------- 0008_add_experiments ----------
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
CREATE UNIQUE INDEX `experiments_user_slug_unique` ON `experiments` (`user_id`,`slug`);

-- ---------- 0009_add_batches_and_webhooks ----------
CREATE TABLE `batch_rows` (
	`batch_id` text NOT NULL,
	`idx` integer NOT NULL,
	`key` text,
	`params` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`filename` text,
	`data` text,
	`byte_size` integer,
	`rendered_at` integer,
	PRIMARY KEY(`batch_id`, `idx`),
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'Batch' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`store_images` integer DEFAULT true NOT NULL,
	`retain_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `batches_user_id_idx` ON `batches` (`user_id`);
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`response_status` integer,
	`error` text,
	`next_attempt_at` integer,
	`created_at` integer NOT NULL,
	`delivered_at` integer,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_status` text,
	`last_delivered_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `webhooks_user_id_idx` ON `webhooks` (`user_id`);

-- ---------- migration bookkeeping ----------
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('57afcf772c2d1292221ce0809c61d1e4cf02c2f3daec3f182ba6d64749630694', 1787496793896);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('3a869c15272863ebe6e10b99278eff4ec62f20dd040e36661bd6e02f23093ef1', 1787497358662);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('410b9d112bf6f488442a4a74e5f5dd13d43ed3d33a18786b5abe539bdc4be2a8', 1787500187556);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('9eb462ee4510c7bc739edd27af8399109f25631d904322695be7b8c12b61e04c', 1787506065273);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('f9837ce82da1990a8d3c6505f49ccb3b1ac802dd1533e06745c491158459cd79', 1787754917007);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('d74e9d38e0dc433c486a49567b6d5fb39e55b220e04d440d1776668e5a7bc536', 1787761634209);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('54f0517fedc4c04f7ac2c841828184d70988c94fcee953abdbedd904ea4719ba', 1787824103514);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('d8a30cf4a41abfefde773e6d3b9a1714b0dd56270ed323be6bde7a8d8e8d341a', 1787826700054);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('7bc5a3806a067a227abf9138b30e7800442d8a3db1c7f0c0676a9f2f6b75b66e', 1787838555238);
INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES('196288e33bcf1992db79f6aa44234e86f455a67b7acfb19c0e006bfdca1101c1', 1787845461443);
