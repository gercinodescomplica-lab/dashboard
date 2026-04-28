-- =============================================================================
-- Queries de Exemplo — Contratos Ativos (SQLite / Turso / LibSQL)
-- Data de referência nas queries: date('now') = hoje
-- JOIN: contrato.manager_id → managers.id
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Visão geral: total de contratos e valor global
-- ---------------------------------------------------------------------------
SELECT
    COUNT(*)                                         AS total_contratos,
    ROUND(SUM(vl_contratado), 2)                    AS total_contratado,
    ROUND(SUM(vl_faturado), 2)                      AS total_faturado,
    ROUND(SUM(vl_saldo), 2)                         AS total_saldo
FROM contrato;


-- ---------------------------------------------------------------------------
-- 2. Contratos vigentes vs vencidos (campo boolean "vigente")
-- ---------------------------------------------------------------------------
SELECT
    CASE vigente WHEN 1 THEN 'Vigente' ELSE 'Vencido' END AS status_vigencia,
    COUNT(*)                                               AS quantidade,
    ROUND(SUM(vl_contratado), 2)                          AS valor_total
FROM contrato
GROUP BY vigente
ORDER BY vigente DESC;


-- ---------------------------------------------------------------------------
-- 3. Distribuição por Situação
-- ---------------------------------------------------------------------------
SELECT
    situacao,
    COUNT(*) AS quantidade
FROM contrato
GROUP BY situacao
ORDER BY quantidade DESC;


-- ---------------------------------------------------------------------------
-- 4. Distribuição por Tipo (SUSTENTAÇÃO vs PROJETOS)
-- ---------------------------------------------------------------------------
SELECT
    tipo,
    COUNT(*)                         AS quantidade,
    ROUND(SUM(vl_contratado), 2)    AS valor_contratado,
    ROUND(SUM(vl_faturado), 2)      AS valor_faturado
FROM contrato
GROUP BY tipo
ORDER BY valor_contratado DESC;


-- ---------------------------------------------------------------------------
-- 5. Contratos agrupados por Manager com soma de valores
-- ---------------------------------------------------------------------------
SELECT
    m.name                           AS manager,
    c.gerencia,
    COUNT(c.id)                      AS total_contratos,
    ROUND(SUM(c.vl_contratado), 2)  AS valor_contratado,
    ROUND(SUM(c.vl_faturado), 2)    AS valor_faturado,
    ROUND(SUM(c.vl_saldo), 2)       AS saldo_restante
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
GROUP BY c.manager_id
ORDER BY valor_contratado DESC;


-- ---------------------------------------------------------------------------
-- 6. Contratos vencendo nos próximos 30 dias
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    c.dt_fim_vigencia,
    CAST(julianday(c.dt_fim_vigencia) - julianday('now') AS INTEGER) AS dias_restantes,
    m.name                           AS manager,
    ROUND(c.vl_saldo, 2)            AS saldo_restante
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
WHERE c.dt_fim_vigencia BETWEEN date('now') AND date('now', '+30 days')
ORDER BY c.dt_fim_vigencia ASC;


-- ---------------------------------------------------------------------------
-- 7. Contratos vencendo nos próximos 90 dias
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    c.dt_fim_vigencia,
    CAST(julianday(c.dt_fim_vigencia) - julianday('now') AS INTEGER) AS dias_restantes,
    m.name                           AS manager,
    c.gerencia,
    ROUND(c.vl_contratado, 2)       AS valor_contratado,
    ROUND(c.vl_saldo, 2)            AS saldo_restante
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
WHERE c.dt_fim_vigencia BETWEEN date('now') AND date('now', '+90 days')
ORDER BY c.dt_fim_vigencia ASC;


-- ---------------------------------------------------------------------------
-- 8. Top 10 maiores contratos por Vl. Contratado
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    m.name                           AS manager,
    ROUND(c.vl_contratado, 2)       AS valor_contratado,
    ROUND(c.vl_faturado, 2)         AS valor_faturado,
    c.dt_fim_vigencia
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
ORDER BY c.vl_contratado DESC
LIMIT 10;


-- ---------------------------------------------------------------------------
-- 9. Contratos com saldo negativo (sobreexecutados)
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    ROUND(c.vl_contratado, 2)       AS valor_contratado,
    ROUND(c.vl_faturado, 2)         AS valor_faturado,
    ROUND(c.vl_saldo, 2)            AS saldo_negativo,
    m.name                           AS manager
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
WHERE c.vl_saldo < 0
ORDER BY c.vl_saldo ASC;


-- ---------------------------------------------------------------------------
-- 10. Percentual executado por manager (faturado / contratado)
-- ---------------------------------------------------------------------------
SELECT
    m.name                                                           AS manager,
    c.gerencia,
    ROUND(SUM(c.vl_contratado), 2)                                  AS contratado,
    ROUND(SUM(c.vl_faturado), 2)                                    AS faturado,
    ROUND(100.0 * SUM(c.vl_faturado) / NULLIF(SUM(c.vl_contratado), 0), 1) AS pct_executado
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
GROUP BY c.manager_id
ORDER BY pct_executado DESC;


-- ---------------------------------------------------------------------------
-- 11. Contratos agrupados por cliente
-- ---------------------------------------------------------------------------
SELECT
    cliente,
    COUNT(*)                         AS total_contratos,
    ROUND(SUM(vl_contratado), 2)    AS valor_total,
    MIN(dt_fim_vigencia)            AS proximo_vencimento
FROM contrato
GROUP BY cliente
ORDER BY valor_total DESC;


-- ---------------------------------------------------------------------------
-- 12. Contratos com Situação "Vigente" mas data de fim já passou (anomalia)
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    c.situacao,
    c.dt_fim_vigencia,
    CAST(julianday('now') - julianday(c.dt_fim_vigencia) AS INTEGER) AS dias_vencido,
    m.name AS manager
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
WHERE c.situacao = 'Vigente'
  AND c.dt_fim_vigencia < date('now')
ORDER BY c.dt_fim_vigencia ASC;


-- ---------------------------------------------------------------------------
-- 13. Resumo financeiro total
-- ---------------------------------------------------------------------------
SELECT
    COUNT(*)                                                         AS total_contratos,
    COUNT(CASE WHEN vigente = 1 THEN 1 END)                        AS contratos_vigentes,
    COUNT(CASE WHEN vigente = 0 THEN 1 END)                        AS contratos_vencidos,
    ROUND(SUM(vl_contratado), 2)                                   AS total_contratado,
    ROUND(SUM(vl_faturado), 2)                                     AS total_faturado,
    ROUND(SUM(vl_saldo), 2)                                        AS total_saldo,
    ROUND(100.0 * SUM(vl_faturado) / NULLIF(SUM(vl_contratado), 0), 1) AS pct_global_executado
FROM contrato;


-- ---------------------------------------------------------------------------
-- 14. Busca por substring no objeto/descrição
-- (substitua %WIFI% pelo termo desejado)
-- ---------------------------------------------------------------------------
SELECT
    c.numero_contrato,
    c.cliente,
    c.objeto,
    m.name        AS manager,
    c.dt_fim_vigencia
FROM contrato c
LEFT JOIN managers m ON m.id = c.manager_id
WHERE c.objeto LIKE '%WIFI%'
ORDER BY c.dt_fim_vigencia;


-- ---------------------------------------------------------------------------
-- 15. Contratos por código de gerência (GRC-x / KAM-x)
-- ---------------------------------------------------------------------------
SELECT
    gerencia,
    COUNT(*)                         AS total_contratos,
    ROUND(SUM(vl_contratado), 2)    AS valor_contratado,
    ROUND(SUM(vl_saldo), 2)         AS saldo_total
FROM contrato
GROUP BY gerencia
ORDER BY valor_contratado DESC;
