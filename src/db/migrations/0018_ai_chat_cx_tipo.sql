ALTER TABLE `cx` ADD COLUMN `tipo` text NOT NULL DEFAULT 'tarefa';
ALTER TABLE `cx` ADD COLUMN `categoria` text;
ALTER TABLE `cx` ADD COLUMN `prazo_limite` text;
ALTER TABLE `cx` ADD COLUMN `external_blocker_label` text;
