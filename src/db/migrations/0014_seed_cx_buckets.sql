-- Semeia os buckets padrão (os mesmos do board real do Planner "Demandas CX")
-- pra tela /settings/cx-planner abrir já com as colunas lado a lado em vez de
-- uma única "Entrada". Idempotente: só insere se a tabela estiver vazia.
INSERT INTO cx_buckets (name, position)
SELECT 'CX - Em Análise', 0 WHERE NOT EXISTS (SELECT 1 FROM cx_buckets);
--> statement-breakpoint
INSERT INTO cx_buckets (name, position)
SELECT 'Área Técnica - Em andamento', 1 WHERE (SELECT COUNT(*) FROM cx_buckets) = 1;
--> statement-breakpoint
INSERT INTO cx_buckets (name, position)
SELECT 'Comercial / Cliente', 2 WHERE (SELECT COUNT(*) FROM cx_buckets) = 2;
--> statement-breakpoint
INSERT INTO cx_buckets (name, position)
SELECT 'Concluído', 3 WHERE (SELECT COUNT(*) FROM cx_buckets) = 3;
