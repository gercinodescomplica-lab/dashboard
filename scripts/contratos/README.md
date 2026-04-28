# Scripts de Contratos Ativos

Kit de importação do CSV `Contratos_Ativos_Receita.csv` para o banco Turso (LibSQL/SQLite) do dashboard comercial da DRM/Prodam.

## Pré-requisitos

- Node.js 18+
- `tsx` (já presente no projeto como devDependency)
- `csv-parse` (já instalado: `npm install --save-dev csv-parse`)
- Arquivo `.env` na raiz com as variáveis do Turso

## Variáveis de Ambiente

```env
TURSO_DATABASE_URL=libsql://seu-banco.turso.io
TURSO_AUTH_TOKEN=seu-token
```

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `criar_tabelas.sql` | DDL standalone — cria tabelas `gerente` e `contrato` diretamente no SQLite/Turso Studio |
| `seed-contratos.ts` | Script TypeScript (Drizzle ORM) que lê o CSV e popula o banco |
| `queries_exemplo.sql` | 15 queries comentadas para análise dos dados |

O schema Drizzle das duas tabelas foi adicionado em `src/db/schema.ts` e pode ser usado normalmente na aplicação.

## Fluxo de Execução

```bash
# Na raiz do projeto
npx tsx scripts/contratos/seed-contratos.ts
```

O script executa automaticamente em ordem:

1. Lê `temp/Contratos_Ativos_Receita.csv`
2. Extrai e normaliza os nomes de gerentes únicos
3. Insere gerentes na tabela `gerente` (`.onConflictDoNothing()`)
4. Insere todos os contratos na tabela `contrato` com upsert por `numero_contrato`
5. Exibe log de progresso e resumo final

## Mapeamento CSV → Banco

| Coluna CSV | Campo no banco | Tabela | Observação |
|------------|---------------|--------|------------|
| Contrato | `numero_contrato` | contrato | UNIQUE |
| Protheus | `protheus` | contrato | |
| Cliente | `cliente` | contrato | |
| Desde | `desde` | contrato | ISO date (TEXT) |
| Dt. Iní. Vigência | `dt_inicio_vigencia` | contrato | ISO date (TEXT) |
| Dt. Fim Vigência | `dt_fim_vigencia` | contrato | ISO date (TEXT) |
| Vl. Contratado (R$) | `vl_contratado` | contrato | REAL |
| Vl. Faturado (R$) | `vl_faturado` | contrato | REAL |
| Vl. Saldo (R$) | `vl_saldo` | contrato | REAL (pode ser negativo) |
| Tipo | `tipo` | contrato | |
| Situação | `situacao` | contrato | |
| Vigente | `vigente` | contrato | "Vigente"→1, "Vencido"→0 |
| Dir. | `diretoria` | contrato | Sempre "DRM" neste dataset |
| Ger. | `gerencia` | contrato | Código: GRC-1, KAM-4, etc. |
| Gerente | `nome` | **gerente** | Normalizado (trim + dedup) |
| Objeto | `objeto` | contrato | Descrição longa |

## Decisões de Design

**IDs como UUID** — `randomUUID()` nativo do Node.js, sem dependência extra.

**Normalização de gerentes** — Gerentes são extraídos com `.trim()` e deduplicados antes da inserção. Nomes com espaços extras (ex: `"MALDE MARIA VILAS BOAS        "`) são normalizados automaticamente.

**`vigente` como boolean (INTEGER 0/1)** — O campo no CSV usa strings `"Vigente"` e `"Vencido"`, convertidas para `true`/`false`. Valores inesperados geram warning e são armazenados como `null`.

**Valores monetários como REAL** — SQLite não tem tipo `DECIMAL` nativo. `REAL` (float 64-bit) é suficiente para os valores presentes. Em cenários de contabilidade crítica, armazene em centavos como INTEGER.

**Datas como TEXT (ISO 8601)** — Padrão `YYYY-MM-DD`. Permite ordenação lexicográfica e é consistente com o restante do schema do projeto (`cx.created_at`, `visits.data`).

**Upsert idempotente** — `.onConflictDoUpdate()` por `numero_contrato` garante que rodar o script múltiplas vezes atualiza os dados sem duplicar registros.

**FK `gerente_id` opcional** — `ON DELETE SET NULL` preserva contratos se um gerente for removido.

## Inconsistências Conhecidas no CSV

| # | Inconsistência | Tratamento |
|---|----------------|------------|
| 1 | Encoding garbled em alguns campos (`SUSTENTA??O` em ALESP/ICI) | Script avisa via warning; dados inseridos como estão |
| 2 | Campo "Vigente" usa strings, não boolean | Mapeamento explícito no script |
| 3 | Trailing spaces em nomes de gerentes | `.trim()` no script |
| 4 | Saldo negativo em SPOBRAS e COHAB | Válido (contratos sobreexecutados), nenhum tratamento |
| 5 | Vl. Faturado = 0 em contratos novos | Válido, nenhum tratamento |
| 6 | Dir. sempre "DRM" | Coluna mantida para futuros datasets |

## Troubleshooting

**Erro: `TURSO_DATABASE_URL não definido`**
Verifique que o arquivo `.env` existe na raiz do projeto e contém `TURSO_DATABASE_URL`.

**Tabelas não existem no banco**
Execute o DDL standalone antes de rodar o seed:
```bash
# Via Turso CLI
turso db shell <nome-do-banco> < scripts/contratos/criar_tabelas.sql
```
Ou cole o conteúdo de `criar_tabelas.sql` diretamente no Turso Studio.

**Warning de encoding**
Se vir `⚠️ Possível problema de encoding no campo "Tipo"`, o CSV pode ter sido salvo em Latin-1. Converta para UTF-8:
```bash
iconv -f iso-8859-1 -t utf-8 temp/Contratos_Ativos_Receita.csv > temp/Contratos_Ativos_Receita_utf8.csv
```
E ajuste o caminho no script.

**Gerente não encontrado no banco**
Indica que o nome do gerente na linha do contrato não bate com nenhum gerente inserido (possível variação de grafia). O contrato é inserido com `gerente_id = null`.

## Usando as Queries

As queries em `queries_exemplo.sql` são SQLite puro e podem ser executadas:

- No **Turso Studio** (interface web)
- Via **Turso CLI**: `turso db shell <nome-do-banco>`
- Via **sqlite3**: `sqlite3 arquivo.db < scripts/contratos/queries_exemplo.sql`
- Dentro da aplicação usando Drizzle e os tipos exportados de `src/db/schema.ts`
