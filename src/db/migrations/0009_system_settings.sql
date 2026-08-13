CREATE TABLE IF NOT EXISTS `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
INSERT OR IGNORE INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('faturamento_2025', '630386397.11', CURRENT_TIMESTAMP);
