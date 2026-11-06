-- Data de envio da proposta (YYYY-MM-DD). NULL = não enviada/não registrada. Depois de 2 meses
-- corridos sem mudar etapa/situação, a temperatura automática esfria de quente para morno
-- (ver temperaturaDoLead em src/lib/grcc/pipeline.ts).
ALTER TABLE `lead_grcc` ADD `proposta_enviada_em` text;
