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
