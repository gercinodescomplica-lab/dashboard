CREATE TABLE `proposta` (
	`id` text PRIMARY KEY NOT NULL,
	`numero_proposta` text NOT NULL,
	`nome_oportunidade` text NOT NULL,
	`proprietario` text,
	`cliente` text NOT NULL,
	`fase` text,
	`valor` real,
	`receita_esperada` real,
	`probabilidade` real,
	`duracao` integer,
	`data_criacao` text,
	`data_fechamento` text,
	`gerencia` text,
	`manager_id` text REFERENCES `managers`(`id`) ON DELETE set null,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposta_numero_proposta_unique` ON `proposta` (`numero_proposta`);
