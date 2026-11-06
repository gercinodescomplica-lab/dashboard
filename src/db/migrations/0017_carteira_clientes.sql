-- Carteira de clientes por gerência (spec docs/superpowers/specs/2026-11-06-organograma-clientes-design.md §3).
CREATE TABLE IF NOT EXISTS `cliente` (
    `id` text PRIMARY KEY NOT NULL,
    `nome` text NOT NULL,
    `sigla` text,
    `ativo` integer DEFAULT 1 NOT NULL,
    `created_at` text NOT NULL
);
CREATE TABLE IF NOT EXISTS `carteira_cliente` (
    `cliente_id` text PRIMARY KEY NOT NULL REFERENCES `cliente`(`id`) ON DELETE CASCADE,
    `gerencia` text NOT NULL,
    `movido_em` text NOT NULL,
    `movido_por` text
);
CREATE INDEX IF NOT EXISTS `carteira_cliente_gerencia_idx` ON `carteira_cliente` (`gerencia`);
CREATE TABLE IF NOT EXISTS `movimento_carteira` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `cliente_id` text NOT NULL REFERENCES `cliente`(`id`) ON DELETE CASCADE,
    `de_gerencia` text,
    `para_gerencia` text,
    `por` text,
    `em` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `movimento_carteira_cliente_idx` ON `movimento_carteira` (`cliente_id`);
ALTER TABLE `contrato` ADD COLUMN `cliente_id` text REFERENCES `cliente`(`id`) ON DELETE SET NULL;
ALTER TABLE `proposta` ADD COLUMN `cliente_id` text REFERENCES `cliente`(`id`) ON DELETE SET NULL;
ALTER TABLE `cx` ADD COLUMN `cliente_id` text REFERENCES `cliente`(`id`) ON DELETE SET NULL;
ALTER TABLE `projects` ADD COLUMN `cliente_id` text REFERENCES `cliente`(`id`) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS `contrato_cliente_idx` ON `contrato` (`cliente_id`);
CREATE INDEX IF NOT EXISTS `proposta_cliente_idx` ON `proposta` (`cliente_id`);
CREATE INDEX IF NOT EXISTS `cx_cliente_idx` ON `cx` (`cliente_id`);
CREATE INDEX IF NOT EXISTS `projects_cliente_idx` ON `projects` (`cliente_id`);
