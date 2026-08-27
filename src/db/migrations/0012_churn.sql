CREATE TABLE IF NOT EXISTS `churn` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` text NOT NULL REFERENCES `managers`(`id`) ON DELETE cascade,
	`numero_contrato` text NOT NULL,
	`valor` real NOT NULL,
	`descricao` text NOT NULL,
	`motivo` text NOT NULL,
	`created_at` text NOT NULL
);
