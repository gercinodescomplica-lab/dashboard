-- Correção/remoção de andamento: evento novo que aponta para o evento original (que continua intacto).
ALTER TABLE `lead_grcc_historico` ADD `corrige_id` integer;
