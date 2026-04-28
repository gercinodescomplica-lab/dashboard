-- =============================================================================
-- Contratos Ativos - DDL Standalone (SQLite / Turso / LibSQL)
-- =============================================================================
-- Referência independente de ORM. Pode ser executado diretamente no
-- Turso Studio, CLI turso shell ou qualquer cliente SQLite.
-- O script seed-contratos.ts usa Drizzle e cria a mesma tabela via ORM.
--
-- Pré-requisito: tabela "managers" já deve existir no banco.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: contrato
-- Campos mapeados 1:1 do CSV Contratos_Ativos_Receita.csv
-- FK manager_id → managers.id (resolvido pelo código "Ger." do CSV)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contrato (
    id                   TEXT    NOT NULL PRIMARY KEY,
    numero_contrato      TEXT    NOT NULL UNIQUE,          -- coluna "Contrato"
    protheus             TEXT,                             -- coluna "Protheus"
    cliente              TEXT    NOT NULL,                 -- coluna "Cliente"
    desde                TEXT,                             -- coluna "Desde" (ISO: YYYY-MM-DD)
    dt_inicio_vigencia   TEXT,                             -- coluna "Dt. Iní. Vigência"
    dt_fim_vigencia      TEXT,                             -- coluna "Dt. Fim Vigência"
    vl_contratado        REAL,                             -- coluna "Vl. Contratado (R$)"
    vl_faturado          REAL,                             -- coluna "Vl. Faturado (R$)"
    vl_saldo             REAL,                             -- coluna "Vl. Saldo (R$)" (pode ser negativo)
    tipo                 TEXT,                             -- "SUSTENTAÇÃO" | "PROJETOS"
    situacao             TEXT,                             -- coluna "Situação"
    vigente              INTEGER,                          -- coluna "Vigente": 1=Vigente, 0=Vencido
    diretoria            TEXT,                             -- coluna "Dir." (sempre "DRM" neste dataset)
    gerencia             TEXT,                             -- coluna "Ger." (ex: GRC-1, KAM-4)
    nome_gerente         TEXT,                             -- coluna "Gerente" (nome completo, denormalizado)
    objeto               TEXT,                             -- coluna "Objeto" (descrição longa)
    manager_id           TEXT    REFERENCES managers(id) ON DELETE SET NULL,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contrato_manager_id       ON contrato (manager_id);
CREATE INDEX IF NOT EXISTS idx_contrato_situacao          ON contrato (situacao);
CREATE INDEX IF NOT EXISTS idx_contrato_vigente           ON contrato (vigente);
CREATE INDEX IF NOT EXISTS idx_contrato_dt_fim_vigencia   ON contrato (dt_fim_vigencia);
CREATE INDEX IF NOT EXISTS idx_contrato_cliente           ON contrato (cliente);
