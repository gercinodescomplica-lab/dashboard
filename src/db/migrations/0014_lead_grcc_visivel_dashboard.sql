-- Lead aparece no dashboard (aba Cidades)? Padrão: sim. Fica fora dos dados da planilha: reimportar não muda.
ALTER TABLE `lead_grcc` ADD `visivel_dashboard` integer DEFAULT 1 NOT NULL;
