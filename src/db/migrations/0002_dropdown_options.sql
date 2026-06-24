CREATE TABLE `dropdown_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dropdown_options_field_value_unique` ON `dropdown_options` (`field`, `value`);
