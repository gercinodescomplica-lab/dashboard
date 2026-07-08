ALTER TABLE `cx` ADD COLUMN `external_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `cx_external_id_unique` ON `cx` (`external_id`) WHERE `external_id` IS NOT NULL;
