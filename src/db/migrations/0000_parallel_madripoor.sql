CREATE TABLE `contrato` (
	`id` text PRIMARY KEY NOT NULL,
	`numero_contrato` text NOT NULL,
	`protheus` text,
	`cliente` text NOT NULL,
	`desde` text,
	`dt_inicio_vigencia` text,
	`dt_fim_vigencia` text,
	`vl_contratado` real,
	`vl_faturado` real,
	`vl_saldo` real,
	`tipo` text,
	`situacao` text,
	`vigente` integer,
	`diretoria` text,
	`gerencia` text,
	`nome_gerente` text,
	`objeto` text,
	`manager_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contrato_numero_contrato_unique` ON `contrato` (`numero_contrato`);--> statement-breakpoint
CREATE TABLE `cx` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` text NOT NULL,
	`cliente` text NOT NULL,
	`titulo` text DEFAULT '' NOT NULL,
	`problema` text NOT NULL,
	`solucao_proposta` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`criticidade` text DEFAULT 'baixa' NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `managers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`avatarUrl` text NOT NULL,
	`year` integer NOT NULL,
	`meta` real NOT NULL,
	`contratado` real NOT NULL,
	`forecastFinal` real NOT NULL,
	`notes` text,
	`served_clients` text,
	`show_in_dashboard` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` text NOT NULL,
	`quarter` text NOT NULL,
	`orgao` text,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`temperature` text,
	`description` text,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`directorate` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`marketplace` integer DEFAULT false NOT NULL,
	`category` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` text NOT NULL,
	`titulo` text NOT NULL,
	`local` text NOT NULL,
	`motivo` text NOT NULL,
	`data` text NOT NULL,
	`data_fim` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE cascade
);
