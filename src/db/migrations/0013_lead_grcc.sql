CREATE TABLE IF NOT EXISTS `lead_grcc` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente` text NOT NULL,
	`solicitacao` text DEFAULT '' NOT NULL,
	`status` text,
	`categoria` text DEFAULT 'Novo' NOT NULL,
	`etapa` text,
	`situacao` text,
	`motivo_perda` text,
	`familia_demanda` text,
	`valor` real DEFAULT 0 NOT NULL,
	`uf` text,
	`municipio` text,
	`regiao` text,
	`contato_nome` text,
	`contato_email` text,
	`contato_telefone` text,
	`previsao_fechamento` text,
	`inicio_faturamento` text,
	`duracao_meses` integer DEFAULT 12 NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	`excluido_em` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lead_grcc_historico` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL REFERENCES `lead_grcc`(`id`),
	`quando` text NOT NULL,
	`origem` text NOT NULL,
	`arquivo` text,
	`autor` text NOT NULL,
	`mudancas` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_grcc_historico_lead_idx` ON `lead_grcc_historico` (`lead_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lead_grcc_historico_quando_idx` ON `lead_grcc_historico` (`quando`);
--> statement-breakpoint
ALTER TABLE `projects` ADD `lead_grcc_id` integer REFERENCES `lead_grcc`(`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_lead_grcc_id_unique` ON `projects` (`lead_grcc_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `dropdown_options` (`field`, `value`)
SELECT 'grcc_categoria', v FROM (
	SELECT 'Novo' AS v, 1 AS o UNION ALL SELECT 'Validação', 2 UNION ALL SELECT 'Parceiro', 3
	UNION ALL SELECT 'Em tratativas', 4 UNION ALL SELECT 'No cliente', 5 UNION ALL SELECT 'Contratado', 6
	UNION ALL SELECT 'Perda', 7
) ORDER BY o;
--> statement-breakpoint
INSERT OR IGNORE INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('grcc_versao', '0', CURRENT_TIMESTAMP);
