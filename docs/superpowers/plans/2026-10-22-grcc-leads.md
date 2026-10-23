# GRCC — Leads sem Excel: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a planilha Excel/Power Automate dos leads da GRCC por um cadastro na página `/grcc` (chave
`GRCC_KEY`), com importação de `.xlsx` com prévia, histórico por lead, geração automática do pipeline da Débora e
dashboard atualizando ao vivo.

**Architecture:** Duas tabelas novas (`lead_grcc`, `lead_grcc_historico`) + coluna `projects.lead_grcc_id`. Regras
puras em `src/lib/grcc/` (normalização, planilha, diff, validação, prévia, mapeamento lead→projeto). Toda escrita
passa por uma função de `queries.ts` que, numa única transação, grava lead + evento de histórico + projeto do
pipeline + `grcc_versao`. Server Actions em `src/app/grcc/actions.ts` checam a chave; leituras ficam em
`src/services/grcc.service.ts` (abertas, como o resto do dashboard). O dashboard consulta `grcc_versao` a cada 15 s
e recarrega sem remontar.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM + Turso/LibSQL, Tailwind 4, Shadcn/Radix,
zod 4, `read-excel-file@5.8.0`, Vitest 5 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-22-grcc-leads-design.md`

## Global Constraints

- Branch `debora` (sai da `main`). **A `main` não tem infraestrutura de testes** — a Task 1 a cria espelhando a da
  branch `login` (mesmos arquivos e versões), para não conflitar no merge.
- UI e textos em pt-BR. Nomes de domínio em português (`lead`, `categoria`, `previsao`), como o resto do projeto.
- Queries Drizzle cruas só em `src/db/queries.ts`. `src/db/index.ts` não carrega `dotenv`.
- Migrações SQL em `src/db/migrations/`, aplicadas por `migrate.ts`, que separa statements por
  `--> statement-breakpoint` **ou** `;` + quebra de linha. Próximo número livre: `0013`.
- Arquivos `'use server'` só podem exportar funções `async`.
- Testes co-localizados (`foo.ts` → `foo.test.ts`). `*.test.tsx` com DOM começa com `// @vitest-environment jsdom`.
- Testes que exercitam `db.transaction()` usam `createTransactionSafeTestDb()` (um `:memory:` anônimo perde os dados
  ao abrir transação) — chamado **antes** de qualquer import de `@/db/*`, e os módulos de produção importados com
  `await import(...)`.
- Gerente da GRCC: `role = 'GRCC'` com o maior `year` (hoje `grcc-debora`, 2026). Nunca usar o id fixo no código.
- Categorias (ordem de exibição): `Novo`, `Validação`, `Parceiro`, `Em tratativas`, `No cliente`, `Contratado`,
  `Perda`.
- Temperatura gerada: `No cliente`→`quente`; `Em tratativas`/`Validação`/`Parceiro`→`morno`; `Novo`→`frio`;
  `Contratado`→`contratado`; `Perda`→`perdido`.
- Autor de todo evento de histórico: `'GRCC'`.
- `system_settings`: `grcc_versao` (inteiro em texto), `grcc_ultimo_import` (JSON).
- Ao vivo: intervalo de checagem **15 000 ms**; `BroadcastChannel('grcc')`.
- Nunca usar `alert/confirm/prompt` do navegador — confirmação sempre inline.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

**Criar**

| Arquivo | Responsabilidade |
|---|---|
| `vitest.config.ts`, `vitest.setup.ts`, `src/db/test-utils.ts` | infraestrutura de testes (cópia da `login`) |
| `src/db/migrations/0013_lead_grcc.sql` | tabelas + coluna + seeds de listas |
| `src/lib/grcc/tipos.ts` | tipos e constantes do domínio (sem lógica) |
| `src/lib/grcc/normalizar.ts` | valor BRL, datas, município, categoria, chave de casamento, `extractLeadDate` |
| `src/lib/grcc/planilha.ts` | linhas cruas do `.xlsx` → leads normalizados + problemas |
| `src/lib/grcc/diff.ts` | antes/depois → `Mudanca[]` |
| `src/lib/grcc/validacao.ts` | schema zod do lead |
| `src/lib/grcc/previa.ts` | planilha × banco → novos/alterados/iguais/problemas |
| `src/lib/grcc/pipeline.ts` | lead → campos do projeto |
| `src/lib/grcc/municipios.ts` | índice UF → municípios (a partir de `municipios-geo.json`) |
| `src/services/grcc.service.ts` | leituras abertas: painel, histórico, movimentações, versão, último import |
| `src/app/grcc/page.tsx`, `KeyGateGrcc.tsx`, `actions.ts`, `GrccApp.tsx` | página da Débora |
| `src/app/grcc/components/*.tsx` | tabela, painel do lead, histórico, movimentações, importação |
| `src/components/ui/sheet.tsx` | Shadcn Sheet (gerado pelo CLI) |
| `src/hooks/useVersaoGrcc.ts` | checagem de versão + BroadcastChannel |
| `src/components/cidades/LeadDetalheLeitura.tsx` | detalhe somente-leitura (Fase 2) |

**Modificar**

| Arquivo | Mudança |
|---|---|
| `package.json` | scripts de teste, devDeps de teste, `zod`, `read-excel-file` |
| `src/db/schema.ts` | `leadGrcc`, `leadGrccHistorico`, `projects.leadGrccId` |
| `src/db/queries.ts` | seção GRCC; `fetchAllManagersFromDB` expõe `leadGrccId` |
| `src/types/manager.ts` | `Project.leadGrccId?: number` |
| `src/app/settings/actions.ts` | `saveManagerData`/`cloneManager` preservam projetos gerados |
| `src/app/api/external/v1/grc/sync/route.ts`, `.../grc/projects/[id]/route.ts` | não tocam projetos gerados |
| `src/app/settings/QuarterEditor.tsx` | selo "Gerenciado pela GRCC", campos travados |
| `src/services/cidades.service.ts` | lê `lead_grcc`; URL do Power Automate removida |
| `src/components/cidades/CidadesView.tsx` | import de `extractLeadDate`; recarga ao vivo; cabeçalho/botão/detalhe/vazio (Fase 2) |
| `src/components/dashboard/DashboardShell.tsx` | recarga ao vivo de gerentes |

---

## FASE 1 — escrita + fonte única

### Task 1: Infraestrutura de testes e dependências

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/db/test-utils.ts`, `src/lib/grcc/smoke.test.ts` (apagado no fim da task)
- Modify: `package.json`

**Interfaces:**
- Produces: `applyMigrations(): Promise<void>` e `createTransactionSafeTestDb(): Promise<{ db; applyMigrations }>` em
  `src/db/test-utils.ts`; scripts `npm test`, `npm run test:watch`.

- [ ] **Step 1: Instalar dependências (mesmas versões da branch `login`)**

```bash
npm install zod@^4.5.4 read-excel-file@5.8.0
npm install -D vitest@^5.0.0 vite@^8.2.2 @vitejs/plugin-react@^6.1.1 @vitest/coverage-v8@^5.0.0 jsdom@^30.0.1 @testing-library/dom@^10.4.1 @testing-library/jest-dom@^7.0.1 @testing-library/react@^16.3.3 @testing-library/user-event@^14.6.7 cross-env@^10.1.0
```

- [ ] **Step 2: Scripts em `package.json`** (dentro de `"scripts"`, depois de `"lint"`):

```json
    "test": "cross-env VITE_CONFIG_NATIVE_IGNORE_WARNING=true vitest run",
    "test:watch": "cross-env VITE_CONFIG_NATIVE_IGNORE_WARNING=true vitest",
    "test:coverage": "cross-env VITE_CONFIG_NATIVE_IGNORE_WARNING=true vitest run --coverage",
```

- [ ] **Step 3: Criar `vitest.config.ts`** — conteúdo idêntico ao da `login`:

```bash
git show login:vitest.config.ts > vitest.config.ts
```

- [ ] **Step 4: Criar `vitest.setup.ts`** — cópia da `login`:

```bash
git show login:vitest.setup.ts > vitest.setup.ts
```

(Ele seta `JWT_SECRET`/`COOKIE_NAME`, que a `main` não usa — inofensivo e evita conflito no merge.)

- [ ] **Step 5: Criar `src/db/test-utils.ts`** — cópia da `login` **com uma mudança**: a separação de statements
precisa aceitar `;` + quebra de linha, como o `migrate.ts` da `main` (a `0009` tem dois statements separados por `;`).

```bash
git show login:src/db/test-utils.ts > src/db/test-utils.ts
```

Depois, em `src/db/test-utils.ts`, troque a linha

```ts
        const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
```

por

```ts
        // Mesma regra do migrate.ts: separa por breakpoint do drizzle-kit OU por `;` no fim da linha.
        const statements = sql
            .split(/(?:--> statement-breakpoint|;\s*(?:\r?\n|$))/)
            .map((s) => s.trim())
            .filter(Boolean);
```

- [ ] **Step 6: Teste de fumaça** — `src/lib/grcc/smoke.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';

describe('infra de testes', () => {
    beforeAll(async () => {
        await applyMigrations();
    });

    it('aplica todas as migrações num banco em memória', async () => {
        const { db } = await import('@/db/index');
        const res = await db.$client.execute("select value from system_settings where key = 'faturamento_2025'");
        expect(res.rows[0]?.value).toBe('630386397.11');
    });
});
```

- [ ] **Step 7: Rodar**

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 8: Apagar o teste de fumaça e commitar**

```bash
rm src/lib/grcc/smoke.test.ts
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/db/test-utils.ts
git commit -m "chore: infraestrutura de testes (vitest) e dependencias zod/read-excel-file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema, migração e tipos do domínio

**Files:**
- Create: `src/db/migrations/0013_lead_grcc.sql`, `src/lib/grcc/tipos.ts`, `src/db/migrations/0013_lead_grcc.test.ts`
- Modify: `src/db/schema.ts`, `src/types/manager.ts:17-27`

**Interfaces:**
- Produces (schema): `leadGrcc`, `leadGrccHistorico`, `projects.leadGrccId`.
- Produces (`src/lib/grcc/tipos.ts`): `CATEGORIAS_GRCC`, `CategoriaGrcc`, `LeadGrccDados`, `LeadGrcc`, `CAMPOS_LEAD`,
  `CAMPOS_LISTA`, `CampoLista`, `Mudanca`, `OrigemEvento`, `EventoHistorico`, `Movimentacao`, `LinhaPlanilha`,
  `ProblemaLinha`, `ResultadoPlanilha`, `ItemAlterado`, `Previa`, `UltimoImport`, `ProjetoManual`, `LEAD_VAZIO`.
- Produces: `Project.leadGrccId?: number`.

- [ ] **Step 1: Teste da migração** — `src/db/migrations/0013_lead_grcc.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';

describe('0013_lead_grcc', () => {
    beforeAll(async () => {
        await applyMigrations();
    });

    it('cria lead_grcc, lead_grcc_historico e projects.lead_grcc_id', async () => {
        const { db } = await import('@/db/index');
        const cols = async (t: string) =>
            (await db.$client.execute(`pragma table_info(${t})`)).rows.map((r) => r.name);
        expect(await cols('lead_grcc')).toEqual(
            expect.arrayContaining(['cliente', 'categoria', 'valor', 'previsao_fechamento', 'inicio_faturamento', 'excluido_em'])
        );
        expect(await cols('lead_grcc_historico')).toEqual(
            expect.arrayContaining(['lead_id', 'quando', 'origem', 'arquivo', 'autor', 'mudancas'])
        );
        expect(await cols('projects')).toContain('lead_grcc_id');
    });

    it('semeia as categorias na dropdown_options e a versao em system_settings', async () => {
        const { db } = await import('@/db/index');
        const cats = await db.$client.execute("select value from dropdown_options where field = 'grcc_categoria'");
        expect(cats.rows.map((r) => r.value)).toEqual(
            ['Novo', 'Validação', 'Parceiro', 'Em tratativas', 'No cliente', 'Contratado', 'Perda']
        );
        const v = await db.$client.execute("select value from system_settings where key = 'grcc_versao'");
        expect(v.rows[0]?.value).toBe('0');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/migrations/0013_lead_grcc.test.ts`
Expected: FAIL (`lead_grcc` sem colunas / tabela inexistente).

- [ ] **Step 3: Criar `src/db/migrations/0013_lead_grcc.sql`**

```sql
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
INSERT INTO `dropdown_options` (`field`, `value`)
SELECT 'grcc_categoria', v FROM (
	SELECT 'Novo' AS v, 1 AS o UNION ALL SELECT 'Validação', 2 UNION ALL SELECT 'Parceiro', 3
	UNION ALL SELECT 'Em tratativas', 4 UNION ALL SELECT 'No cliente', 5 UNION ALL SELECT 'Contratado', 6
	UNION ALL SELECT 'Perda', 7
) ORDER BY o;
--> statement-breakpoint
INSERT OR IGNORE INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('grcc_versao', '0', CURRENT_TIMESTAMP);
```

- [ ] **Step 4: Schema Drizzle** — em `src/db/schema.ts`, dentro de `projects` (depois de `history`):

```ts
    // Projeto gerado a partir de um lead da GRCC (dono = /grcc). Nulo = projeto manual.
    leadGrccId: integer('lead_grcc_id').unique(),
```

e, no fim do arquivo:

```ts
export const leadGrcc = sqliteTable('lead_grcc', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cliente: text('cliente').notNull(),
    solicitacao: text('solicitacao').notNull().default(''),
    status: text('status'),
    categoria: text('categoria').notNull().default('Novo'),
    etapa: text('etapa'),
    situacao: text('situacao'),
    motivoPerda: text('motivo_perda'),
    familiaDemanda: text('familia_demanda'),
    valor: real('valor').notNull().default(0),
    uf: text('uf'),
    municipio: text('municipio'),
    regiao: text('regiao'),
    contatoNome: text('contato_nome'),
    contatoEmail: text('contato_email'),
    contatoTelefone: text('contato_telefone'),
    previsaoFechamento: text('previsao_fechamento'), // "YYYY-MM-DD"
    inicioFaturamento: text('inicio_faturamento'), // "YYYY-MM-DD", só Contratado
    duracaoMeses: integer('duracao_meses').notNull().default(12),
    criadoEm: text('criado_em').notNull(),
    atualizadoEm: text('atualizado_em').notNull(),
    excluidoEm: text('excluido_em'), // soft delete
});

// Somente acréscimo: nada atualiza nem apaga linhas daqui.
export const leadGrccHistorico = sqliteTable('lead_grcc_historico', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id').notNull().references(() => leadGrcc.id),
    quando: text('quando').notNull(),
    origem: text('origem', { enum: ['cadastro', 'edicao', 'importacao', 'exclusao'] }).notNull(),
    arquivo: text('arquivo'),
    autor: text('autor').notNull(),
    mudancas: text('mudancas').notNull(), // JSON: [{ campo, de, para }]
});
```

(`projects.leadGrccId` não leva `.references()` no Drizzle para evitar referência circular de declaração — a FK
existe no SQL.)

- [ ] **Step 5: `Project.leadGrccId`** — em `src/types/manager.ts`, dentro de `interface Project`, depois de
`history?`:

```ts
  /** Preenchido quando o projeto é gerado por um lead da GRCC (/grcc) — não editável no Settings. */
  leadGrccId?: number;
```

- [ ] **Step 6: Criar `src/lib/grcc/tipos.ts`**

```ts
/**
 * Tipos e constantes do cadastro de leads da GRCC (/grcc). Sem lógica — regras ficam nos
 * módulos vizinhos (normalizar, planilha, diff, validacao, previa, pipeline).
 */

export const CATEGORIAS_GRCC = [
    'Novo',
    'Validação',
    'Parceiro',
    'Em tratativas',
    'No cliente',
    'Contratado',
    'Perda',
] as const;

export type CategoriaGrcc = (typeof CATEGORIAS_GRCC)[number];

/** Campos editáveis de um lead (tudo menos id e carimbos de data). */
export interface LeadGrccDados {
    cliente: string;
    solicitacao: string;
    status: string | null;
    categoria: CategoriaGrcc;
    etapa: string | null;
    situacao: string | null;
    motivoPerda: string | null;
    familiaDemanda: string | null;
    valor: number;
    uf: string | null;
    municipio: string | null;
    regiao: string | null;
    contatoNome: string | null;
    contatoEmail: string | null;
    contatoTelefone: string | null;
    previsaoFechamento: string | null;
    inicioFaturamento: string | null;
    duracaoMeses: number;
}

export interface LeadGrcc extends LeadGrccDados {
    id: number;
    criadoEm: string;
    atualizadoEm: string;
}

/** Ordem canônica dos campos — usada pelo diff e pelos rótulos do histórico. */
export const CAMPOS_LEAD: (keyof LeadGrccDados)[] = [
    'cliente',
    'solicitacao',
    'status',
    'categoria',
    'etapa',
    'situacao',
    'motivoPerda',
    'familiaDemanda',
    'valor',
    'uf',
    'municipio',
    'regiao',
    'contatoNome',
    'contatoEmail',
    'contatoTelefone',
    'previsaoFechamento',
    'inicioFaturamento',
    'duracaoMeses',
];

export const ROTULO_CAMPO: Record<keyof LeadGrccDados, string> = {
    cliente: 'Cliente',
    solicitacao: 'Solicitação',
    status: 'Andamento',
    categoria: 'Categoria',
    etapa: 'Etapa',
    situacao: 'Situação',
    motivoPerda: 'Motivo da perda',
    familiaDemanda: 'Família da demanda',
    valor: 'Valor',
    uf: 'UF',
    municipio: 'Município',
    regiao: 'Região',
    contatoNome: 'Contato',
    contatoEmail: 'E-mail',
    contatoTelefone: 'Telefone',
    previsaoFechamento: 'Previsão de fechamento',
    inicioFaturamento: 'Início do faturamento',
    duracaoMeses: 'Duração (meses)',
};

/** Campos que têm lista suspensa em `dropdown_options` (field = `grcc_<campo>`). */
export const CAMPOS_LISTA = ['categoria', 'etapa', 'situacao', 'motivoPerda', 'familiaDemanda'] as const;
export type CampoLista = (typeof CAMPOS_LISTA)[number];
export const FIELD_DA_LISTA: Record<CampoLista, string> = {
    categoria: 'grcc_categoria',
    etapa: 'grcc_etapa',
    situacao: 'grcc_situacao',
    motivoPerda: 'grcc_motivo',
    familiaDemanda: 'grcc_familia',
};

/** Campos com destaque (chip "de → para") no histórico. */
export const CAMPOS_DESTAQUE: (keyof LeadGrccDados)[] = ['categoria', 'etapa', 'situacao', 'motivoPerda'];

export interface Mudanca {
    campo: keyof LeadGrccDados;
    de: string | number | null;
    para: string | number | null;
}

export type OrigemEvento = 'cadastro' | 'edicao' | 'importacao' | 'exclusao';

export interface EventoHistorico {
    id: number;
    leadId: number;
    quando: string;
    origem: OrigemEvento;
    arquivo: string | null;
    autor: string;
    mudancas: Mudanca[];
}

export interface Movimentacao extends EventoHistorico {
    cliente: string;
    solicitacao: string;
}

/** Uma linha da planilha já normalizada. `linha` = número da linha no Excel (1 = cabeçalho). */
export interface LinhaPlanilha {
    linha: number;
    dados: LeadGrccDados;
}

export interface ProblemaLinha {
    linha: number;
    cliente: string;
    motivo: string;
}

export interface ResultadoPlanilha {
    linhas: LinhaPlanilha[];
    problemas: ProblemaLinha[];
    /** Colunas obrigatórias ausentes do cabeçalho — se não vazio, a planilha é recusada. */
    colunasFaltando: string[];
}

export interface ItemAlterado {
    linha: number;
    leadId: number;
    dados: LeadGrccDados;
    mudancas: Mudanca[];
}

export interface Previa {
    novos: LinhaPlanilha[];
    alterados: ItemAlterado[];
    iguais: number;
    problemas: ProblemaLinha[];
}

export interface UltimoImport {
    arquivo: string;
    quando: string;
    novos: number;
    alterados: number;
}

export interface ProjetoManual {
    id: number;
    orgao: string | null;
    name: string;
    value: number;
    quarter: string;
}

export const LEAD_VAZIO: LeadGrccDados = {
    cliente: '',
    solicitacao: '',
    status: null,
    categoria: 'Novo',
    etapa: null,
    situacao: null,
    motivoPerda: null,
    familiaDemanda: null,
    valor: 0,
    uf: null,
    municipio: null,
    regiao: null,
    contatoNome: null,
    contatoEmail: null,
    contatoTelefone: null,
    previsaoFechamento: null,
    inicioFaturamento: null,
    duracaoMeses: 12,
};
```

- [ ] **Step 7: Rodar**

Run: `npx vitest run src/db/migrations/0013_lead_grcc.test.ts && npx tsc --noEmit`
Expected: 2 passed; tsc sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/db/migrations/0013_lead_grcc.sql src/db/migrations/0013_lead_grcc.test.ts src/db/schema.ts src/types/manager.ts src/lib/grcc/tipos.ts
git commit -m "feat(grcc): tabelas lead_grcc/historico, projects.lead_grcc_id e tipos do dominio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Normalização (valor, data, município, categoria, chave)

**Files:**
- Create: `src/lib/grcc/normalizar.ts`, `src/lib/grcc/normalizar.test.ts`, `src/lib/grcc/municipios.ts`

**Interfaces:**
- Consumes: `CategoriaGrcc`, `CATEGORIAS_GRCC` (Task 2).
- Produces (`normalizar.ts`): `parseValorBRL(v: unknown): number | null`, `parseDataIso(v: unknown): string | null`,
  `extractLeadDate(lead: { previsao_fechamento?: string }): Date | null` (mesmo comportamento de hoje),
  `normalizarCategoria(v: unknown): CategoriaGrcc`, `normalizarUf(v: unknown): string | null`,
  `municipioDoCliente(cliente: string): string`, `textoOuNull(v: unknown): string | null`,
  `chaveTexto(s: string): string`, `chaveLead(cliente: string, solicitacao: string): string`.
- Produces (`municipios.ts`): `UFS: string[]`, `municipiosDaUf(uf: string): string[]`,
  `acharMunicipio(uf: string, nome: string): string | null` (devolve a grafia oficial).

Nota: `parseValorBRL` muda de contrato — devolve `null` para texto ilegível (hoje devolve 0), para a prévia acusar
"valor ilegível". Vazio → `0`.

- [ ] **Step 1: Testes** — `src/lib/grcc/normalizar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    parseValorBRL,
    parseDataIso,
    extractLeadDate,
    normalizarCategoria,
    normalizarUf,
    municipioDoCliente,
    chaveLead,
    textoOuNull,
} from './normalizar';
import { acharMunicipio, municipiosDaUf } from './municipios';

describe('parseValorBRL', () => {
    it.each([
        ['R$ 4.239.525,60', 4239525.6],
        [' R$ 9.099.830,44', 9099830.44],
        ['1.259.218,14', 1259218.14],
        ['349,020,12', 349020.12],
        ['4239525,6', 4239525.6],
        ['1.047.060', 1047060],
        ['260.758,68', 260758.68],
        [1500, 1500],
        ['', 0],
        [null, 0],
        [undefined, 0],
    ])('%s → %s', (entrada, esperado) => {
        expect(parseValorBRL(entrada)).toBe(esperado);
    });

    it('texto sem número é ilegível (null)', () => {
        expect(parseValorBRL('a definir')).toBeNull();
    });
});

describe('parseDataIso', () => {
    it('serial do Excel', () => expect(parseDataIso(46336)).toBe('2026-11-10'));
    it('serial em texto', () => expect(parseDataIso('46336')).toBe('2026-11-10'));
    it('dd/mm/aaaa', () => expect(parseDataIso('05/03/2026')).toBe('2026-03-05'));
    it('dd/mm/aa', () => expect(parseDataIso('5/3/26')).toBe('2026-03-05'));
    it('ISO', () => expect(parseDataIso('2026-12-01T00:00:00Z')).toBe('2026-12-01'));
    it('Date (read-excel-file devolve Date em célula de data)', () =>
        expect(parseDataIso(new Date(Date.UTC(2026, 0, 31)))).toBe('2026-01-31'));
    it('vazio/lixo → null', () => {
        expect(parseDataIso('')).toBeNull();
        expect(parseDataIso('sem data')).toBeNull();
    });
});

describe('extractLeadDate (compatível com a aba Cidades)', () => {
    it('lê ISO como data local', () => {
        const d = extractLeadDate({ previsao_fechamento: '2026-11-10' });
        expect(d?.getFullYear()).toBe(2026);
        expect(d?.getMonth()).toBe(10);
        expect(d?.getDate()).toBe(10);
    });
    it('sem campo → null', () => expect(extractLeadDate({})).toBeNull());
});

describe('normalizarCategoria', () => {
    it.each([
        ['Em trataivas', 'Em tratativas'],
        ['Em tratatativas', 'Em tratativas'],
        ['em tratativas', 'Em tratativas'],
        ['validação', 'Validação'],
        ['Validacao', 'Validação'],
        ['No cliente', 'No cliente'],
        ['Parceiro', 'Parceiro'],
        ['Perda', 'Perda'],
        ['Contratado', 'Contratado'],
        ['Sem classificação', 'Novo'],
        ['', 'Novo'],
        [null, 'Novo'],
        ['Lead', 'Novo'],
    ])('%s → %s', (entrada, esperado) => {
        expect(normalizarCategoria(entrada)).toBe(esperado);
    });
});

describe('normalizarUf', () => {
    it('maiúscula e válida', () => expect(normalizarUf(' sp ')).toBe('SP'));
    it('inválida → null', () => expect(normalizarUf('XX')).toBeNull());
    it('vazia → null', () => expect(normalizarUf('')).toBeNull());
});

describe('municipioDoCliente', () => {
    it.each([
        ['Prefeitura de Indaiatuba', 'Indaiatuba'],
        ['Camara Municipal de Londrina', 'Londrina'],
        ['Assembleia Legislativa de Parauapebas(PA)', 'Parauapebas'],
        ['Prefeitura Campos do Jordão', 'Campos do Jordão'],
        ['ALESP', 'ALESP'],
    ])('%s → %s', (cliente, esperado) => {
        expect(municipioDoCliente(cliente)).toBe(esperado);
    });
});

describe('municípios', () => {
    it('acha grafia oficial ignorando acento e caixa', () => {
        expect(acharMunicipio('SP', 'campos do jordao')).toBe('Campos do Jordão');
    });
    it('não acha em outra UF', () => {
        expect(acharMunicipio('RJ', 'Indaiatuba')).toBeNull();
    });
    it('lista por UF em ordem alfabética', () => {
        const sp = municipiosDaUf('SP');
        expect(sp.length).toBeGreaterThan(600);
        expect(sp).toContain('Indaiatuba');
    });
});

describe('chaveLead / textoOuNull', () => {
    it('ignora caixa, acento e espaços', () => {
        expect(chaveLead(' Prefeitura  de Indaiatuba ', 'Consultoria')).toBe(chaveLead('prefeitura de indaiatuba', 'CONSULTORIA'));
        expect(chaveLead('São Paulo', 'x')).toBe(chaveLead('Sao Paulo', 'x'));
    });
    it('textoOuNull', () => {
        expect(textoOuNull('  a ')).toBe('a');
        expect(textoOuNull('   ')).toBeNull();
        expect(textoOuNull('#VALUE!')).toBeNull();
        expect(textoOuNull(12)).toBe('12');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/grcc/normalizar.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Criar `src/lib/grcc/municipios.ts`**

```ts
import municipiosGeo from '@/data/municipios-geo.json';
import { chaveTexto } from './normalizar';

interface MunicipioGeo {
    nome: string;
    uf: string;
}

const POR_UF = new Map<string, string[]>();
for (const m of municipiosGeo as MunicipioGeo[]) {
    const lista = POR_UF.get(m.uf) ?? [];
    lista.push(m.nome);
    POR_UF.set(m.uf, lista);
}
for (const lista of POR_UF.values()) lista.sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const UFS: string[] = [...POR_UF.keys()].sort();

export function municipiosDaUf(uf: string): string[] {
    return POR_UF.get(uf) ?? [];
}

/** Grafia oficial do município na UF, comparando sem acento/caixa; `null` se não existir. */
export function acharMunicipio(uf: string, nome: string): string | null {
    const alvo = chaveTexto(nome);
    if (!alvo) return null;
    return municipiosDaUf(uf).find((m) => chaveTexto(m) === alvo) ?? null;
}
```

- [ ] **Step 4: Criar `src/lib/grcc/normalizar.ts`**

```ts
/**
 * Normalização dos dados de lead da GRCC. A lógica de valor/data/município veio de
 * `src/services/cidades.service.ts` (quando a fonte era o Power Automate) e agora serve à
 * importação de planilha e à aba Cidades.
 */

import { CATEGORIAS_GRCC, type CategoriaGrcc } from './tipos';

const UFS_VALIDAS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

/** Minúsculo, sem acento, espaços colapsados — base de todas as comparações de texto. */
export function chaveTexto(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Chave de casamento planilha × banco. */
export function chaveLead(cliente: string, solicitacao: string): string {
    return `${chaveTexto(cliente)}|${chaveTexto(solicitacao)}`;
}

/** Texto aparado ou `null` (vazio e erros de fórmula do Excel viram `null`). */
export function textoOuNull(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s || s === '#VALUE!' || s === '#VALOR!' || s === '#N/A' || s === '#REF!') return null;
    return s;
}

/**
 * Valor em reais vindo do Excel: "R$ 9.099.830,44", "349,020,12", "1.047.060", "4239525,6", número.
 * Vazio → 0. Texto sem dígito → `null` (ilegível).
 */
export function parseValorBRL(valor: unknown): number | null {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (valor === null || valor === undefined) return 0;
    const s = String(valor).trim();
    if (!s) return 0;

    const clean = s.replace(/[^0-9.,]/g, '');
    if (!clean) return null;

    let formatted = clean;
    if (clean.includes(',')) {
        const parts = clean.split(',');
        const decimal = parts[parts.length - 1];
        const integer = parts.slice(0, parts.length - 1).join('').replace(/\./g, '');
        formatted = `${integer}.${decimal}`;
    } else if (clean.includes('.')) {
        const lastDotIndex = clean.lastIndexOf('.');
        const decimalPart = clean.substring(lastDotIndex + 1);
        if (decimalPart.length === 2) {
            const intPart = clean.substring(0, lastDotIndex).replace(/\./g, '');
            formatted = `${intPart}.${decimalPart}`;
        } else {
            formatted = clean.replace(/\./g, '');
        }
    }

    const num = Number(formatted);
    return Number.isFinite(num) ? num : null;
}

function iso(y: number, m: number, d: number): string | null {
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Data do Excel (serial, Date, dd/mm/aa(aa), ISO) → "YYYY-MM-DD" ou `null`. */
export function parseDataIso(valor: unknown): string | null {
    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return iso(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
    }
    if (valor === null || valor === undefined) return null;
    const raw = String(valor).trim();
    if (!raw) return null;

    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 20000 && serial < 70000) {
        const d = new Date((serial - 25569) * 86400 * 1000);
        return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }

    const mIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return iso(Number(mIso[1]), Number(mIso[2]), Number(mIso[3]));

    const mBarra = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mBarra) {
        let y = Number(mBarra[3]);
        if (y < 100) y += 2000;
        return iso(y, Number(mBarra[2]), Number(mBarra[1]));
    }
    return null;
}

/**
 * Data do lead para os cálculos da aba Cidades (previsão do mês / 90 dias / linha do tempo).
 * Mantém o contrato da função homônima que existia em `cidades.service.ts`.
 */
export function extractLeadDate(lead: { previsao_fechamento?: string }): Date | null {
    const isoStr = parseDataIso(lead.previsao_fechamento);
    if (!isoStr) return null;
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

const CATEGORIA_POR_CHAVE = new Map<string, CategoriaGrcc>(CATEGORIAS_GRCC.map((c) => [chaveTexto(c), c]));
const ALIASES_CATEGORIA: Record<string, CategoriaGrcc> = {
    'em trataivas': 'Em tratativas',
    'em tratatativas': 'Em tratativas',
    tratativas: 'Em tratativas',
    validacao: 'Validação',
    'sem classificacao': 'Novo',
    lead: 'Novo',
    perdido: 'Perda',
    perdida: 'Perda',
    ganho: 'Contratado',
};

/** Categoria da planilha → categoria canônica. Desconhecida/vazia → `Novo`. */
export function normalizarCategoria(valor: unknown): CategoriaGrcc {
    const chave = chaveTexto(String(valor ?? ''));
    if (!chave) return 'Novo';
    return CATEGORIA_POR_CHAVE.get(chave) ?? ALIASES_CATEGORIA[chave] ?? 'Novo';
}

export function normalizarUf(valor: unknown): string | null {
    const uf = String(valor ?? '').trim().toUpperCase();
    return UFS_VALIDAS.has(uf) ? uf : null;
}

/** Quando a coluna município vem quebrada (#VALUE!), deduz pelo nome do cliente. */
export function municipioDoCliente(cliente: string): string {
    const s = cliente.trim();
    const matchDe = s.match(/\bde\s+([A-Za-zÀ-ÿ\s-]+?)\s*(?:\([A-Z]{2}\))?\s*$/i);
    if (matchDe) return matchDe[1].trim();
    return s
        .replace(/^(Prefeitura|Câmara Municipal|Camara Municipal|Assembleia Legislativa|Secretaria|Governo)\s+(do|da|de|dos|das)?\s*/i, '')
        .replace(/\s*\([A-Z]{2}\)\s*$/, '')
        .trim();
}
```

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/lib/grcc/normalizar.test.ts`
Expected: PASS. Se algum caso de `municipioDoCliente` falhar, ajuste a regex (não o teste) — os casos vêm da
planilha real.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grcc/normalizar.ts src/lib/grcc/normalizar.test.ts src/lib/grcc/municipios.ts
git commit -m "feat(grcc): normalizacao de valor, data, municipio, categoria e chave de casamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Leitura da planilha (cabeçalho por aliases → leads normalizados)

**Files:**
- Create: `src/lib/grcc/planilha.ts`, `src/lib/grcc/planilha.test.ts`

**Interfaces:**
- Consumes: Task 2 tipos; Task 3 `parseValorBRL`, `parseDataIso`, `normalizarCategoria`, `normalizarUf`,
  `municipioDoCliente`, `textoOuNull`, `chaveTexto`; `acharMunicipio`.
- Produces: `ALIASES_COLUNA: Record<keyof LeadGrccDados, string[]>`, `COLUNAS_OBRIGATORIAS`,
  `lerLinhasPlanilha(linhas: unknown[][]): ResultadoPlanilha` (linha 0 = cabeçalho).

- [x] **Step 1 (GATE): Fechar os aliases contra o `.xlsx` real**

> Cabeçalhos conferidos contra os campos do fluxo Power Automate (`cidades.service.ts`), sem o .xlsx: `cliente`, `solicitacao`, `solicitacao_padrao`, `status`, `categoria`, `categoria_padrao`, `etapa_padrao`, `situacao_padrao`, `motivo_padrao`, `familia_demanda`, `valor`, `uf`, `municipio`, `regiao`, `contato_nome`, `contato_email`, `contato_telefone`, `previsao_fechamento` — cada chave cai no campo certo de `ALIASES_COLUNA` (teste "mapeia cada campo do fluxo Power Automate"). Nenhum alias foi acrescentado. Aba lida: a primeira (`ABA_PADRAO` a definir na Task 12).

Peça ao usuário a planilha. Coloque-a **fora do repositório** (tem nome/e-mail/telefone de contatos), ex.:
`C:\Users\p017886\AppData\Local\Temp\claude\C--projeto-dashboard-dashboard\86ba7457-68cc-4f54-882c-1168fbd46d48\scratchpad\grcc.xlsx`,
e liste abas e cabeçalhos:

```bash
node -e "
const readXlsxFile = require('read-excel-file/node');
const { readSheetNames } = require('read-excel-file/node');
const f = process.argv[1];
readSheetNames(f).then(async (abas) => {
  for (const aba of abas) {
    const rows = await readXlsxFile(f, { sheet: aba });
    console.log('ABA', aba, 'linhas', rows.length);
    console.log(' cabecalho:', JSON.stringify(rows[0]));
    console.log(' ex:', JSON.stringify(rows[1]));
  }
});" "<caminho do xlsx>"
```

Para cada cabeçalho real, garanta que `chaveTexto(cabecalho)` (sem `_`/pontuação) esteja na lista de aliases do campo
certo na tabela do Step 3. Se a planilha tiver mais de uma aba de leads, registre qual aba é lida (constante
`ABA_PADRAO` no `ImportarExcelDialog`, Task 12). **Não prossiga sem esse passo** — ele é o que garante "ler tudo de
acordo com o Excel". Anote aqui no plano os cabeçalhos encontrados.

- [ ] **Step 2: Testes** — `src/lib/grcc/planilha.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lerLinhasPlanilha } from './planilha';

const CAB = [
    'Cliente', 'Solicitação', 'Status', 'Categoria', 'Valor', 'UF', 'Município', 'Região',
    'Contato Nome', 'Contato Email', 'Contato Telefone', 'Previsão de fechamento',
    'Etapa Padrão', 'Situação Padrão', 'Motivo Padrão', 'Família Demanda',
];

function linha(over: Partial<Record<string, unknown>> = {}): unknown[] {
    const base: Record<string, unknown> = {
        Cliente: 'Prefeitura de Indaiatuba',
        'Solicitação': 'Consultoria',
        Status: 'Proposta no cliente 12/06',
        Categoria: 'No cliente',
        Valor: 'R$ 260.758,68',
        UF: 'SP',
        'Município': '#VALUE!',
        'Região': 'Sudeste',
        'Contato Nome': 'Graziela',
        'Contato Email': 'g@indaiatuba.sp.gov.br',
        'Contato Telefone': '(19) 0000-0000',
        'Previsão de fechamento': 46336,
        'Etapa Padrão': 'Proposta no cliente',
        'Situação Padrão': 'Em andamento',
        'Motivo Padrão': null,
        'Família Demanda': 'Consultoria',
        ...over,
    };
    return CAB.map((c) => base[c] ?? null);
}

describe('lerLinhasPlanilha', () => {
    it('mapeia por nome de cabeçalho, sem depender da ordem', () => {
        const cabInvertido = [...CAB].reverse();
        const l = linha();
        const r = lerLinhasPlanilha([cabInvertido, [...l].reverse()]);
        expect(r.colunasFaltando).toEqual([]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas).toHaveLength(1);
        expect(r.linhas[0]).toEqual({
            linha: 2,
            dados: expect.objectContaining({
                cliente: 'Prefeitura de Indaiatuba',
                solicitacao: 'Consultoria',
                categoria: 'No cliente',
                valor: 260758.68,
                uf: 'SP',
                municipio: 'Indaiatuba', // #VALUE! → deduzido do cliente → grafia oficial
                previsaoFechamento: '2026-11-10',
                etapa: 'Proposta no cliente',
                situacao: 'Em andamento',
                familiaDemanda: 'Consultoria',
                motivoPerda: null,
                duracaoMeses: 12,
            }),
        });
    });

    it('aceita os nomes que o Power Automate usava (categoria_padrao etc.)', () => {
        const cab = ['cliente', 'solicitacao', 'valor', 'uf', 'categoria_padrao', 'motivo_padrao'];
        const r = lerLinhasPlanilha([cab, ['X de Y', 's', '10', 'SP', 'Perda', 'Prazo']]);
        expect(r.linhas[0].dados.categoria).toBe('Perda');
        expect(r.linhas[0].dados.motivoPerda).toBe('Prazo');
    });

    it('prefere "categoria padrão" a "categoria" quando as duas existem', () => {
        const cab = ['cliente', 'valor', 'uf', 'categoria', 'categoria padrao'];
        const r = lerLinhasPlanilha([cab, ['A', '1', 'SP', 'Em trataivas', 'Parceiro']]);
        expect(r.linhas[0].dados.categoria).toBe('Parceiro');
    });

    it('lista colunas obrigatórias ausentes e não lê nada', () => {
        const r = lerLinhasPlanilha([['cliente', 'status'], ['A', 'x']]);
        expect(r.colunasFaltando).toEqual(['Valor', 'UF']);
        expect(r.linhas).toEqual([]);
    });

    it('pula linha vazia e linha-título "Propostas Perdidas" sem acusar problema', () => {
        const vazia = CAB.map(() => null);
        const titulo = CAB.map((c) => (c === 'Cliente' ? 'Propostas Perdidas' : null));
        const r = lerLinhasPlanilha([CAB, vazia, titulo, linha()]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas.map((l) => l.linha)).toEqual([4]);
    });

    it('acusa valor ilegível, UF inválida e cliente vazio', () => {
        const r = lerLinhasPlanilha([
            CAB,
            linha({ Valor: 'a definir' }),
            linha({ UF: 'XX' }),
            linha({ Cliente: '', 'Solicitação': 'algo' }),
        ]);
        expect(r.linhas).toEqual([]);
        expect(r.problemas).toEqual([
            { linha: 2, cliente: 'Prefeitura de Indaiatuba', motivo: 'Valor ilegível: "a definir"' },
            { linha: 3, cliente: 'Prefeitura de Indaiatuba', motivo: 'UF inválida: "XX"' },
            { linha: 4, cliente: '', motivo: 'Cliente vazio' },
        ]);
    });

    it('município que não existe na UF fica vazio (vira pendência, não problema)', () => {
        const r = lerLinhasPlanilha([CAB, linha({ Cliente: 'ALESP', 'Município': '#VALUE!' })]);
        expect(r.problemas).toEqual([]);
        expect(r.linhas[0].dados.municipio).toBeNull();
    });

    it('UF vazia é aceita (pendência)', () => {
        const r = lerLinhasPlanilha([CAB, linha({ UF: '' })]);
        expect(r.linhas[0].dados.uf).toBeNull();
        expect(r.linhas[0].dados.municipio).toBeNull();
    });

    it('acusa duplicadas (mesmo cliente+solicitação) nas duas linhas', () => {
        const r = lerLinhasPlanilha([CAB, linha(), linha({ Cliente: 'prefeitura  de indaiatuba' })]);
        expect(r.linhas).toEqual([]);
        expect(r.problemas.map((p) => [p.linha, p.motivo])).toEqual([
            [2, 'Duplicada (mesmo cliente e solicitação da linha 3)'],
            [3, 'Duplicada (mesmo cliente e solicitação da linha 2)'],
        ]);
    });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/grcc/planilha.test.ts`
Expected: FAIL (`lerLinhasPlanilha` inexistente).

- [ ] **Step 4: Criar `src/lib/grcc/planilha.ts`**

```ts
/**
 * Planilha (.xlsx já lido como matriz) → leads normalizados. Puro: quem lê o arquivo é o
 * `ImportarExcelDialog` (read-excel-file, no navegador). Colunas são achadas pelo NOME do
 * cabeçalho (aliases), nunca pela posição.
 */

import { LEAD_VAZIO, type LeadGrccDados, type LinhaPlanilha, type ProblemaLinha, type ResultadoPlanilha } from './tipos';
import {
    chaveLead,
    chaveTexto,
    municipioDoCliente,
    normalizarCategoria,
    normalizarUf,
    parseDataIso,
    parseValorBRL,
    textoOuNull,
} from './normalizar';
import { acharMunicipio } from './municipios';

/** Aliases já normalizados por `chaveCabecalho`. A ordem importa: o primeiro achado vence. */
export const ALIASES_COLUNA: Partial<Record<keyof LeadGrccDados, string[]>> = {
    cliente: ['cliente', 'orgao', 'orgao cliente'],
    solicitacao: ['solicitacao', 'solicitacao padrao', 'demanda'],
    status: ['status', 'andamento'],
    categoria: ['categoria padrao', 'categoria'],
    etapa: ['etapa padrao', 'etapa'],
    situacao: ['situacao padrao', 'situacao'],
    motivoPerda: ['motivo padrao', 'motivo da perda', 'motivo'],
    familiaDemanda: ['familia demanda', 'familia da demanda', 'familia'],
    valor: ['valor', 'valor r', 'valor estimado'],
    uf: ['uf', 'estado'],
    municipio: ['municipio', 'cidade'],
    regiao: ['regiao'],
    contatoNome: ['contato nome', 'contato', 'nome do contato'],
    contatoEmail: ['contato email', 'email', 'e mail'],
    contatoTelefone: ['contato telefone', 'telefone'],
    previsaoFechamento: ['previsao fechamento', 'previsao de fechamento', 'previsao'],
    inicioFaturamento: ['inicio faturamento', 'inicio do faturamento'],
    duracaoMeses: ['duracao meses', 'duracao', 'prazo meses'],
};

export const COLUNAS_OBRIGATORIAS: { campo: keyof LeadGrccDados; rotulo: string }[] = [
    { campo: 'cliente', rotulo: 'Cliente' },
    { campo: 'valor', rotulo: 'Valor' },
    { campo: 'uf', rotulo: 'UF' },
];

/** "Previsão de Fechamento" / "previsao_fechamento" → "previsao de fechamento". */
function chaveCabecalho(v: unknown): string {
    return chaveTexto(String(v ?? '').replace(/[_\-.:/()$]/g, ' '));
}

function mapearCabecalho(cab: unknown[]): Partial<Record<keyof LeadGrccDados, number>> {
    const chaves = cab.map(chaveCabecalho);
    const mapa: Partial<Record<keyof LeadGrccDados, number>> = {};
    for (const [campo, aliases] of Object.entries(ALIASES_COLUNA) as [keyof LeadGrccDados, string[]][]) {
        for (const alias of aliases) {
            const idx = chaves.indexOf(alias);
            if (idx >= 0) {
                mapa[campo] = idx;
                break;
            }
        }
    }
    return mapa;
}

function linhaVazia(row: unknown[]): boolean {
    return row.every((c) => textoOuNull(c) === null);
}

export function lerLinhasPlanilha(matriz: unknown[][]): ResultadoPlanilha {
    const [cab = [], ...corpo] = matriz;
    const mapa = mapearCabecalho(cab);

    const colunasFaltando = COLUNAS_OBRIGATORIAS.filter((c) => mapa[c.campo] === undefined).map((c) => c.rotulo);
    if (colunasFaltando.length > 0) return { linhas: [], problemas: [], colunasFaltando };

    const cel = (row: unknown[], campo: keyof LeadGrccDados): unknown => {
        const idx = mapa[campo];
        return idx === undefined ? null : row[idx];
    };

    const linhas: LinhaPlanilha[] = [];
    const problemas: ProblemaLinha[] = [];

    corpo.forEach((row, i) => {
        const numero = i + 2; // linha 1 do Excel é o cabeçalho
        if (!row || linhaVazia(row)) return;

        const cliente = textoOuNull(cel(row, 'cliente')) ?? '';
        const solicitacao = textoOuNull(cel(row, 'solicitacao')) ?? '';
        const status = textoOuNull(cel(row, 'status'));
        const ufBruta = textoOuNull(cel(row, 'uf'));

        // Linha-título de seção ("Propostas Perdidas") — sem mais nada preenchido.
        if (chaveTexto(cliente) === 'propostas perdidas' && !solicitacao && !status && !ufBruta) return;

        if (!cliente) {
            problemas.push({ linha: numero, cliente: '', motivo: 'Cliente vazio' });
            return;
        }

        const valorBruto = cel(row, 'valor');
        const valor = parseValorBRL(valorBruto);
        if (valor === null) {
            problemas.push({ linha: numero, cliente, motivo: `Valor ilegível: "${String(valorBruto)}"` });
            return;
        }

        const uf = ufBruta ? normalizarUf(ufBruta) : null;
        if (ufBruta && !uf) {
            problemas.push({ linha: numero, cliente, motivo: `UF inválida: "${ufBruta}"` });
            return;
        }

        const municipioBruto = textoOuNull(cel(row, 'municipio')) ?? municipioDoCliente(cliente);
        const municipio = uf ? acharMunicipio(uf, municipioBruto) : null;

        const duracao = Number(textoOuNull(cel(row, 'duracaoMeses')));

        const dados: LeadGrccDados = {
            ...LEAD_VAZIO,
            cliente,
            solicitacao,
            status,
            categoria: normalizarCategoria(cel(row, 'categoria')),
            etapa: textoOuNull(cel(row, 'etapa')),
            situacao: textoOuNull(cel(row, 'situacao')),
            motivoPerda: textoOuNull(cel(row, 'motivoPerda')),
            familiaDemanda: textoOuNull(cel(row, 'familiaDemanda')),
            valor,
            uf,
            municipio,
            regiao: textoOuNull(cel(row, 'regiao')),
            contatoNome: textoOuNull(cel(row, 'contatoNome')),
            contatoEmail: textoOuNull(cel(row, 'contatoEmail')),
            contatoTelefone: textoOuNull(cel(row, 'contatoTelefone')),
            previsaoFechamento: parseDataIso(cel(row, 'previsaoFechamento')),
            inicioFaturamento: parseDataIso(cel(row, 'inicioFaturamento')),
            duracaoMeses: Number.isInteger(duracao) && duracao > 0 ? duracao : 12,
        };
        linhas.push({ linha: numero, dados });
    });

    // Duplicadas dentro da própria planilha: as duas saem para "com problema".
    const porChave = new Map<string, LinhaPlanilha[]>();
    for (const l of linhas) {
        const k = chaveLead(l.dados.cliente, l.dados.solicitacao);
        porChave.set(k, [...(porChave.get(k) ?? []), l]);
    }
    const duplicadas = new Set<number>();
    for (const grupo of porChave.values()) {
        if (grupo.length < 2) continue;
        for (const l of grupo) {
            duplicadas.add(l.linha);
            const outras = grupo.filter((o) => o !== l).map((o) => o.linha).join(', ');
            problemas.push({
                linha: l.linha,
                cliente: l.dados.cliente,
                motivo: `Duplicada (mesmo cliente e solicitação da linha ${outras})`,
            });
        }
    }

    problemas.sort((a, b) => a.linha - b.linha);
    return {
        linhas: linhas.filter((l) => !duplicadas.has(l.linha)),
        problemas,
        colunasFaltando: [],
    };
}
```

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/lib/grcc/planilha.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grcc/planilha.ts src/lib/grcc/planilha.test.ts docs/superpowers/plans/2026-10-22-grcc-leads.md
git commit -m "feat(grcc): leitura da planilha por cabecalho com aliases e problemas por linha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Diff, validação, prévia e mapeamento lead → projeto

**Files:**
- Create: `src/lib/grcc/diff.ts`, `diff.test.ts`, `validacao.ts`, `validacao.test.ts`, `previa.ts`, `previa.test.ts`,
  `pipeline.ts`, `pipeline.test.ts` (todos em `src/lib/grcc/`)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `diffLead(antes: LeadGrccDados | null, depois: LeadGrccDados): Mudanca[]`
  - `schemaLead` (zod), `validarLead(dados: unknown, opts?: { exigirLocal?: boolean }): { ok: true; dados: LeadGrccDados } | { ok: false; erros: Partial<Record<keyof LeadGrccDados, string>> }`
  - `montarPrevia(linhas: LinhaPlanilha[], problemas: ProblemaLinha[], existentes: LeadGrcc[]): Previa`
  - `temperaturaDaCategoria(c: CategoriaGrcc): OpportunityTemperature`, `trimestreDaPrevisao(previsao: string | null, anoGerente: number): 'q1'|'q2'|'q3'|'q4'|'nao_mapeado'`,
    `projetoDoLead(lead: LeadGrcc, gerente: { id: string; year: number }): ProjetoGerado` onde
    `ProjetoGerado = { managerId; quarter; orgao; name; value; temperature; description; durationMonths; startDate; leadGrccId }`
  - `pendenciasDoLead(l: LeadGrccDados): string[]` (em `validacao.ts`)

- [ ] **Step 1: Testes** — quatro arquivos:

`src/lib/grcc/diff.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { diffLead } from './diff';
import { LEAD_VAZIO } from './tipos';

const base = { ...LEAD_VAZIO, cliente: 'A', valor: 10, categoria: 'Novo' as const };

describe('diffLead', () => {
    it('sem mudança → vazio', () => expect(diffLead(base, { ...base })).toEqual([]));

    it('lista campos alterados na ordem canônica', () => {
        expect(diffLead(base, { ...base, valor: 20, categoria: 'No cliente', etapa: 'Proposta' })).toEqual([
            { campo: 'categoria', de: 'Novo', para: 'No cliente' },
            { campo: 'etapa', de: null, para: 'Proposta' },
            { campo: 'valor', de: 10, para: 20 },
        ]);
    });

    it('cadastro (antes null) → só campos preenchidos, de = null', () => {
        const m = diffLead(null, base);
        expect(m).toContainEqual({ campo: 'cliente', de: null, para: 'A' });
        expect(m).toContainEqual({ campo: 'valor', de: null, para: 10 });
        expect(m.find((x) => x.campo === 'etapa')).toBeUndefined();
        expect(m.find((x) => x.campo === 'solicitacao')).toBeUndefined(); // '' não conta como preenchido
    });

    it('trata "" e null como iguais', () => {
        expect(diffLead({ ...base, regiao: null }, { ...base, regiao: '' as unknown as null })).toEqual([]);
    });
});
```

`src/lib/grcc/validacao.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { validarLead, pendenciasDoLead } from './validacao';
import { LEAD_VAZIO } from './tipos';

const ok = { ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', uf: 'SP', municipio: 'Indaiatuba', valor: 100 };

describe('validarLead', () => {
    it('aceita lead válido', () => expect(validarLead(ok)).toEqual({ ok: true, dados: ok }));

    it('exige motivo quando Perda', () => {
        const r = validarLead({ ...ok, categoria: 'Perda' });
        expect(r).toEqual({ ok: false, erros: { motivoPerda: 'Informe o motivo da perda.' } });
    });

    it('exige início do faturamento quando Contratado', () => {
        const r = validarLead({ ...ok, categoria: 'Contratado' });
        expect(r).toEqual({ ok: false, erros: { inicioFaturamento: 'Informe o início do faturamento.' } });
    });

    it('município precisa existir na UF', () => {
        const r = validarLead({ ...ok, uf: 'RJ' });
        expect(r).toEqual({ ok: false, erros: { municipio: 'Município não encontrado em RJ.' } });
    });

    it('na tela (exigirLocal) UF, município e solicitação são obrigatórios', () => {
        const r = validarLead({ ...ok, uf: null, municipio: null, solicitacao: '' }, { exigirLocal: true });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['municipio', 'solicitacao', 'uf']);
    });

    it('rejeita e-mail inválido, valor negativo e categoria desconhecida', () => {
        const r = validarLead({ ...ok, contatoEmail: 'x', valor: -1, categoria: 'Foo' });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['categoria', 'contatoEmail', 'valor']);
    });
});

describe('pendenciasDoLead', () => {
    it('lista o que falta', () => {
        expect(pendenciasDoLead({ ...LEAD_VAZIO, cliente: 'A' })).toEqual(['Sem UF', 'Sem município', 'Sem valor', 'Sem previsão']);
    });
    it('Perda não exige previsão; Contratado exige início', () => {
        expect(pendenciasDoLead({ ...ok, categoria: 'Perda', motivoPerda: 'Prazo' })).toEqual([]);
        expect(pendenciasDoLead({ ...ok, previsaoFechamento: '2026-11-01', categoria: 'Contratado' })).toEqual(['Sem início do faturamento']);
    });
});
```

`src/lib/grcc/previa.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { montarPrevia } from './previa';
import { LEAD_VAZIO, type LeadGrcc } from './tipos';

const existente: LeadGrcc = {
    ...LEAD_VAZIO, id: 7, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', valor: 100,
    criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z',
};

describe('montarPrevia', () => {
    it('classifica novo, alterado e igual (casando cliente+solicitação normalizados)', () => {
        const p = montarPrevia(
            [
                { linha: 2, dados: { ...existente, cliente: 'PREFEITURA DE INDAIATUBA', valor: 150 } },
                { linha: 3, dados: { ...LEAD_VAZIO, cliente: 'Novo cliente', valor: 5 } },
            ],
            [{ linha: 9, cliente: 'X', motivo: 'Cliente vazio' }],
            [existente]
        );
        expect(p.novos.map((n) => n.linha)).toEqual([3]);
        expect(p.alterados).toHaveLength(1);
        expect(p.alterados[0].leadId).toBe(7);
        expect(p.alterados[0].mudancas.map((m) => m.campo)).toEqual(['cliente', 'valor']);
        expect(p.iguais).toBe(0);
        expect(p.problemas).toEqual([{ linha: 9, cliente: 'X', motivo: 'Cliente vazio' }]);
    });

    it('linha idêntica conta como igual', () => {
        const { id: _i, criadoEm: _c, atualizadoEm: _a, ...dados } = existente;
        const p = montarPrevia([{ linha: 2, dados }], [], [existente]);
        expect(p).toEqual({ novos: [], alterados: [], iguais: 1, problemas: [] });
    });

    it('nunca marca exclusão: leads ausentes da planilha não aparecem', () => {
        const p = montarPrevia([], [], [existente]);
        expect(p).toEqual({ novos: [], alterados: [], iguais: 0, problemas: [] });
    });
});
```

`src/lib/grcc/pipeline.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { projetoDoLead, temperaturaDaCategoria, trimestreDaPrevisao } from './pipeline';
import { CATEGORIAS_GRCC, LEAD_VAZIO, type LeadGrcc } from './tipos';

describe('temperaturaDaCategoria', () => {
    it('mapeia todas as categorias', () => {
        expect(Object.fromEntries(CATEGORIAS_GRCC.map((c) => [c, temperaturaDaCategoria(c)]))).toEqual({
            Novo: 'frio',
            'Validação': 'morno',
            Parceiro: 'morno',
            'Em tratativas': 'morno',
            'No cliente': 'quente',
            Contratado: 'contratado',
            Perda: 'perdido',
        });
    });
});

describe('trimestreDaPrevisao', () => {
    it.each([
        ['2026-01-15', 'q1'], ['2026-03-31', 'q1'], ['2026-04-01', 'q2'],
        ['2026-09-30', 'q3'], ['2026-12-01', 'q4'],
        ['2027-02-01', 'nao_mapeado'], [null, 'nao_mapeado'],
    ])('%s → %s', (previsao, q) => expect(trimestreDaPrevisao(previsao, 2026)).toBe(q));
});

describe('projetoDoLead', () => {
    const lead: LeadGrcc = {
        ...LEAD_VAZIO, id: 3, cliente: 'ALESP', solicitacao: 'Mensageria', status: 'Proposta no cliente',
        categoria: 'No cliente', valor: 10542439.43, previsaoFechamento: '2026-11-20',
        criadoEm: 'x', atualizadoEm: 'x',
    };
    it('gera o projeto da Débora', () => {
        expect(projetoDoLead(lead, { id: 'grcc-debora', year: 2026 })).toEqual({
            managerId: 'grcc-debora', quarter: 'q4', orgao: 'ALESP', name: 'Mensageria', value: 10542439.43,
            temperature: 'quente', description: 'Proposta no cliente', durationMonths: 12, startDate: null,
            leadGrccId: 3,
        });
    });
    it('solicitação vazia vira "Lead GRCC"; startDate só em Contratado', () => {
        const p = projetoDoLead({ ...lead, solicitacao: '', inicioFaturamento: '2026-11-01' }, { id: 'g', year: 2026 });
        expect(p.name).toBe('Lead GRCC');
        expect(p.startDate).toBeNull();
        const c = projetoDoLead({ ...lead, categoria: 'Contratado', inicioFaturamento: '2026-11-01', duracaoMeses: 24 }, { id: 'g', year: 2026 });
        expect(c).toMatchObject({ temperature: 'contratado', startDate: '2026-11-01', durationMonths: 24 });
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/grcc`
Expected: FAIL nos 4 arquivos novos (módulos inexistentes).

- [ ] **Step 3: Implementar** — quatro arquivos:

`src/lib/grcc/diff.ts`
```ts
import { CAMPOS_LEAD, type LeadGrccDados, type Mudanca } from './tipos';

function valorDiff(v: unknown): string | number | null {
    if (v === undefined || v === null || v === '') return null;
    return typeof v === 'number' ? v : String(v);
}

/** Campos que mudaram de `antes` para `depois`. `antes = null` = cadastro (só campos preenchidos). */
export function diffLead(antes: LeadGrccDados | null, depois: LeadGrccDados): Mudanca[] {
    const mudancas: Mudanca[] = [];
    for (const campo of CAMPOS_LEAD) {
        const de = antes ? valorDiff(antes[campo]) : null;
        const para = valorDiff(depois[campo]);
        if (de !== para) mudancas.push({ campo, de, para });
    }
    return mudancas;
}
```

`src/lib/grcc/validacao.ts`
```ts
import { z } from 'zod';
import { CATEGORIAS_GRCC, type LeadGrccDados } from './tipos';
import { acharMunicipio } from './municipios';

const textoOpcional = z.string().trim().transform((s) => (s === '' ? null : s)).nullable();
const dataOpcional = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .nullable()
    .or(z.literal('').transform(() => null));

export const schemaLead = z.object({
    cliente: z.string().trim().min(1, 'Informe o cliente.'),
    solicitacao: z.string().trim(),
    status: textoOpcional,
    categoria: z.enum(CATEGORIAS_GRCC, { message: 'Categoria inválida.' }),
    etapa: textoOpcional,
    situacao: textoOpcional,
    motivoPerda: textoOpcional,
    familiaDemanda: textoOpcional,
    valor: z.number({ message: 'Valor inválido.' }).finite('Valor inválido.').min(0, 'Valor não pode ser negativo.'),
    uf: textoOpcional,
    municipio: textoOpcional,
    regiao: textoOpcional,
    contatoNome: textoOpcional,
    contatoEmail: z.string().trim().email('E-mail inválido.').nullable().or(z.literal('').transform(() => null)),
    contatoTelefone: textoOpcional,
    previsaoFechamento: dataOpcional,
    inicioFaturamento: dataOpcional,
    duracaoMeses: z.number().int().min(1, 'Duração mínima de 1 mês.').max(120),
});

type Erros = Partial<Record<keyof LeadGrccDados, string>>;

export function validarLead(
    entrada: unknown,
    opts: { exigirLocal?: boolean } = {}
): { ok: true; dados: LeadGrccDados } | { ok: false; erros: Erros } {
    const r = schemaLead.safeParse(entrada);
    const erros: Erros = {};
    if (!r.success) {
        for (const issue of r.error.issues) {
            const campo = issue.path[0] as keyof LeadGrccDados;
            erros[campo] ??= issue.message;
        }
        return { ok: false, erros };
    }
    const d = r.data as LeadGrccDados;

    if (d.categoria === 'Perda' && !d.motivoPerda) erros.motivoPerda = 'Informe o motivo da perda.';
    if (d.categoria === 'Contratado' && !d.inicioFaturamento) erros.inicioFaturamento = 'Informe o início do faturamento.';
    if (d.uf && d.municipio && !acharMunicipio(d.uf, d.municipio)) erros.municipio = `Município não encontrado em ${d.uf}.`;
    if (opts.exigirLocal) {
        if (!d.solicitacao) erros.solicitacao = 'Informe a solicitação.';
        if (!d.uf) erros.uf = 'Informe a UF.';
        if (!d.municipio) erros.municipio ??= 'Informe o município.';
    }

    if (Object.keys(erros).length > 0) return { ok: false, erros };
    return { ok: true, dados: { ...d, municipio: d.uf && d.municipio ? acharMunicipio(d.uf, d.municipio) : d.municipio } };
}

/** O que falta para o lead "contar certo" nos números (filtro ⚠ Pendências). */
export function pendenciasDoLead(l: LeadGrccDados): string[] {
    const p: string[] = [];
    if (!l.uf) p.push('Sem UF');
    if (!l.municipio) p.push('Sem município');
    if (!l.valor) p.push('Sem valor');
    if (l.categoria !== 'Perda' && !l.previsaoFechamento) p.push('Sem previsão');
    if (l.categoria === 'Contratado' && !l.inicioFaturamento) p.push('Sem início do faturamento');
    return p;
}
```

`src/lib/grcc/previa.ts`
```ts
import { diffLead } from './diff';
import { chaveLead } from './normalizar';
import { CAMPOS_LEAD, type LeadGrcc, type LeadGrccDados, type LinhaPlanilha, type Previa, type ProblemaLinha } from './tipos';

export function dadosDoLead(l: LeadGrcc): LeadGrccDados {
    return Object.fromEntries(CAMPOS_LEAD.map((c) => [c, l[c]])) as unknown as LeadGrccDados;
}

/**
 * Planilha × banco. Import nunca exclui: leads que não estão na planilha simplesmente não
 * aparecem aqui. Usado no navegador (prévia) e de novo no servidor (confirmação).
 */
export function montarPrevia(linhas: LinhaPlanilha[], problemas: ProblemaLinha[], existentes: LeadGrcc[]): Previa {
    const porChave = new Map(existentes.map((l) => [chaveLead(l.cliente, l.solicitacao), l]));
    const previa: Previa = { novos: [], alterados: [], iguais: 0, problemas };

    for (const l of linhas) {
        const atual = porChave.get(chaveLead(l.dados.cliente, l.dados.solicitacao));
        if (!atual) {
            previa.novos.push(l);
            continue;
        }
        const mudancas = diffLead(dadosDoLead(atual), l.dados);
        if (mudancas.length === 0) previa.iguais++;
        else previa.alterados.push({ linha: l.linha, leadId: atual.id, dados: l.dados, mudancas });
    }
    return previa;
}
```

`src/lib/grcc/pipeline.ts`
```ts
import type { OpportunityTemperature } from '@/types/manager';
import type { CategoriaGrcc, LeadGrcc } from './tipos';

type Trimestre = 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';

const TEMPERATURA: Record<CategoriaGrcc, OpportunityTemperature> = {
    Novo: 'frio',
    'Validação': 'morno',
    Parceiro: 'morno',
    'Em tratativas': 'morno',
    'No cliente': 'quente',
    Contratado: 'contratado',
    Perda: 'perdido',
};

export function temperaturaDaCategoria(c: CategoriaGrcc): OpportunityTemperature {
    return TEMPERATURA[c] ?? 'frio';
}

export function trimestreDaPrevisao(previsao: string | null, anoGerente: number): Trimestre {
    if (!previsao) return 'nao_mapeado';
    const [ano, mes] = previsao.split('-').map(Number);
    if (ano !== anoGerente || !mes) return 'nao_mapeado';
    return (['q1', 'q2', 'q3', 'q4'] as const)[Math.floor((mes - 1) / 3)];
}

export interface ProjetoGerado {
    managerId: string;
    quarter: Trimestre;
    orgao: string;
    name: string;
    value: number;
    temperature: OpportunityTemperature;
    description: string | null;
    durationMonths: number;
    startDate: string | null;
    leadGrccId: number;
}

/** Projeto do pipeline da Débora gerado a partir de um lead (dono = /grcc). */
export function projetoDoLead(lead: LeadGrcc, gerente: { id: string; year: number }): ProjetoGerado {
    return {
        managerId: gerente.id,
        quarter: trimestreDaPrevisao(lead.previsaoFechamento, gerente.year),
        orgao: lead.cliente,
        name: lead.solicitacao || 'Lead GRCC',
        value: lead.valor,
        temperature: temperaturaDaCategoria(lead.categoria),
        description: lead.status,
        durationMonths: lead.duracaoMeses,
        startDate: lead.categoria === 'Contratado' ? lead.inicioFaturamento : null,
        leadGrccId: lead.id,
    };
}
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/grcc && npx tsc --noEmit`
Expected: todos PASS; tsc limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/grcc
git commit -m "feat(grcc): diff, validacao, previa de importacao e mapeamento lead->projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Queries GRCC (transação lead + histórico + projeto + versão)

**Files:**
- Modify: `src/db/queries.ts` (nova seção no fim; imports no topo)
- Create: `src/db/queries.grcc.test.ts`

**Interfaces:**
- Consumes: schema (Task 2); `diffLead`, `montarPrevia`, `dadosDoLead`, `projetoDoLead` (Task 5); `lerLinhasPlanilha` não.
- Produces (todas em `src/db/queries.ts`):
  - `listLeadsGrcc(): Promise<LeadGrcc[]>` (sem excluídos, `atualizadoEm` desc)
  - `getLeadGrcc(id: number): Promise<LeadGrcc | null>`
  - `fetchGerenteGrcc(): Promise<{ id: string; year: number } | null>`
  - `salvarLeadGrcc(id: number | null, dados: LeadGrccDados): Promise<{ lead: LeadGrcc; mudou: boolean }>`
  - `excluirLeadGrcc(id: number): Promise<void>`
  - `aplicarImportGrcc(input: { arquivo: string; linhas: LinhaPlanilha[]; problemas: ProblemaLinha[]; substituirPipelineManual: boolean }): Promise<{ novos: number; alterados: number }>`
  - `fetchHistoricoLead(leadId: number): Promise<EventoHistorico[]>`
  - `fetchMovimentacoesRecentes(limite?: number): Promise<Movimentacao[]>`
  - `lerVersaoGrcc(): Promise<number>`
  - `lerUltimoImportGrcc(): Promise<UltimoImport | null>`
  - `fetchListasGrcc(): Promise<Record<CampoLista, string[]>>`
  - `fetchProjetosManuaisGrcc(): Promise<ProjetoManual[]>`
  - Erro `ErroGrcc` (classe exportada) com mensagens em pt-BR.

- [ ] **Step 1: Testes** — `src/db/queries.grcc.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO, type LeadGrccDados } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const q = await import('@/db/queries');
const s = await import('@/db/schema');
const { eq, isNull } = await import('drizzle-orm');

const lead = (over: Partial<LeadGrccDados> = {}): LeadGrccDados => ({
    ...LEAD_VAZIO,
    cliente: 'Prefeitura de Indaiatuba',
    solicitacao: 'Consultoria',
    categoria: 'No cliente',
    valor: 260758.68,
    uf: 'SP',
    municipio: 'Indaiatuba',
    previsaoFechamento: '2026-11-10',
    ...over,
});

beforeAll(async () => {
    await applyMigrations();
});

beforeEach(async () => {
    await db.delete(s.projects);
    await db.delete(s.leadGrccHistorico);
    await db.delete(s.leadGrcc);
    await db.delete(s.managers);
    await db.$client.execute("update system_settings set value = '0' where key = 'grcc_versao'");
    await db.$client.execute("delete from system_settings where key = 'grcc_ultimo_import'");
    await db.$client.execute("delete from dropdown_options where field like 'grcc_%' and field <> 'grcc_categoria'");
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 };
    await db.insert(s.managers).values([
        { ...base, id: 'grcc-velha', name: 'Débora', role: 'GRCC', year: 2025 },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 },
        { ...base, id: 'grc1-x', name: 'X', role: 'GRC1', year: 2026 },
    ]);
});

describe('salvarLeadGrcc', () => {
    it('cadastro: grava lead, evento "cadastro", projeto da Débora (maior ano) e versão +1', async () => {
        const { lead: l, mudou } = await q.salvarLeadGrcc(null, lead());
        expect(mudou).toBe(true);
        expect(l.id).toBeGreaterThan(0);

        const hist = await q.fetchHistoricoLead(l.id);
        expect(hist).toHaveLength(1);
        expect(hist[0]).toMatchObject({ origem: 'cadastro', autor: 'GRCC', arquivo: null });
        expect(hist[0].mudancas).toContainEqual({ campo: 'valor', de: null, para: 260758.68 });

        const [proj] = await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id));
        expect(proj).toMatchObject({ managerId: 'grcc-debora', quarter: 'q4', temperature: 'quente', value: 260758.68, orgao: 'Prefeitura de Indaiatuba' });

        expect(await q.lerVersaoGrcc()).toBe(1);
    });

    it('edição: um evento com as mudanças e projeto atualizado; sem mudança não gera evento nem versão', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        const r = await q.salvarLeadGrcc(l.id, lead({ categoria: 'Perda', motivoPerda: 'Prazo', valor: 300000 }));
        expect(r.mudou).toBe(true);
        const hist = await q.fetchHistoricoLead(l.id);
        expect(hist[0].origem).toBe('edicao');
        expect(hist[0].mudancas.map((m) => m.campo)).toEqual(['categoria', 'motivoPerda', 'valor']);
        const [proj] = await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id));
        expect(proj).toMatchObject({ temperature: 'perdido', value: 300000 });
        expect(await q.lerVersaoGrcc()).toBe(2);

        const igual = await q.salvarLeadGrcc(l.id, lead({ categoria: 'Perda', motivoPerda: 'Prazo', valor: 300000 }));
        expect(igual.mudou).toBe(false);
        expect(await q.fetchHistoricoLead(l.id)).toHaveLength(2);
        expect(await q.lerVersaoGrcc()).toBe(2);
    });

    it('sem gerente GRCC → ErroGrcc e nada gravado', async () => {
        await db.delete(s.managers);
        await expect(q.salvarLeadGrcc(null, lead())).rejects.toThrow('Gerente da GRCC não encontrado');
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
        expect(await q.lerVersaoGrcc()).toBe(0);
    });

    it('acrescenta à lista valores novos de etapa/situação/motivo/família', async () => {
        await q.salvarLeadGrcc(null, lead({ etapa: 'Proposta no cliente', familiaDemanda: 'Consultoria' }));
        const listas = await q.fetchListasGrcc();
        expect(listas.etapa).toEqual(['Proposta no cliente']);
        expect(listas.familiaDemanda).toEqual(['Consultoria']);
        expect(listas.categoria).toHaveLength(7);
    });
});

describe('excluirLeadGrcc', () => {
    it('soft delete + evento "exclusao" + projeto apagado + some da lista', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        await q.excluirLeadGrcc(l.id);
        expect(await q.listLeadsGrcc()).toEqual([]);
        expect((await q.fetchHistoricoLead(l.id))[0]).toMatchObject({ origem: 'exclusao', mudancas: [] });
        expect(await db.select().from(s.projects).where(eq(s.projects.leadGrccId, l.id))).toEqual([]);
        const [row] = await db.select().from(s.leadGrcc).where(eq(s.leadGrcc.id, l.id));
        expect(row.excluidoEm).not.toBeNull();
    });
});

describe('aplicarImportGrcc', () => {
    it('reclassifica no servidor, grava novos e alterados, mantém ausentes e registra o arquivo', async () => {
        const { lead: existente } = await q.salvarLeadGrcc(null, lead());
        const { lead: ausente } = await q.salvarLeadGrcc(null, lead({ cliente: 'ALESP', solicitacao: 'Chatbot', uf: 'SP', municipio: 'São Paulo' }));

        const r = await q.aplicarImportGrcc({
            arquivo: 'leads-out.xlsx',
            linhas: [
                { linha: 2, dados: lead({ valor: 999 }) },
                { linha: 3, dados: lead({ cliente: 'Câmara de Osasco', solicitacao: 'Nuvem', municipio: 'Osasco' }) },
            ],
            problemas: [],
            substituirPipelineManual: false,
        });
        expect(r).toEqual({ novos: 1, alterados: 1 });

        expect((await q.fetchHistoricoLead(existente.id))[0]).toMatchObject({ origem: 'importacao', arquivo: 'leads-out.xlsx' });
        expect(await q.getLeadGrcc(ausente.id)).not.toBeNull();
        expect((await q.listLeadsGrcc()).map((l) => l.cliente).sort()).toEqual(['ALESP', 'Câmara de Osasco', 'Prefeitura de Indaiatuba']);
        expect(await q.lerUltimoImportGrcc()).toMatchObject({ arquivo: 'leads-out.xlsx', novos: 1, alterados: 1 });
        expect(await q.lerVersaoGrcc()).toBe(3);
    });

    it('primeira importação exige confirmar a troca do pipeline manual', async () => {
        await db.insert(s.projects).values({ managerId: 'grcc-debora', quarter: 'q3', name: 'Nuvem', value: 1, temperature: 'quente' });
        expect(await q.fetchProjetosManuaisGrcc()).toHaveLength(1);
        await expect(
            q.aplicarImportGrcc({ arquivo: 'a.xlsx', linhas: [{ linha: 2, dados: lead() }], problemas: [], substituirPipelineManual: false })
        ).rejects.toThrow('Confirme a substituição do pipeline manual');
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
    });

    it('com confirmação apaga só os projetos manuais da Débora', async () => {
        await db.insert(s.projects).values([
            { managerId: 'grcc-debora', quarter: 'q3', name: 'Nuvem', value: 1, temperature: 'quente' },
            { managerId: 'grc1-x', quarter: 'q3', name: 'Outro gerente', value: 1, temperature: 'quente' },
        ]);
        await q.aplicarImportGrcc({ arquivo: 'a.xlsx', linhas: [{ linha: 2, dados: lead() }], problemas: [], substituirPipelineManual: true });
        const deb = await db.select().from(s.projects).where(eq(s.projects.managerId, 'grcc-debora'));
        expect(deb).toHaveLength(1);
        expect(deb[0].leadGrccId).not.toBeNull();
        expect(await db.select().from(s.projects).where(eq(s.projects.managerId, 'grc1-x'))).toHaveLength(1);
        expect(await db.select().from(s.projects).where(isNull(s.projects.leadGrccId))).toHaveLength(1);
    });
});

describe('fetchMovimentacoesRecentes', () => {
    it('últimos eventos com cliente, mais recente primeiro', async () => {
        const { lead: l } = await q.salvarLeadGrcc(null, lead());
        await q.salvarLeadGrcc(l.id, lead({ valor: 1 }));
        const mov = await q.fetchMovimentacoesRecentes(15);
        expect(mov.map((m) => m.origem)).toEqual(['edicao', 'cadastro']);
        expect(mov[0].cliente).toBe('Prefeitura de Indaiatuba');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/queries.grcc.test.ts`
Expected: FAIL (`q.salvarLeadGrcc is not a function`).

- [ ] **Step 3: Implementar** — em `src/db/queries.ts`, troque a linha de import do schema por

```ts
import { managers, projects, cx, visits, contrato, proposta, systemSettings, churn, leadGrcc, leadGrccHistorico, dropdownOptions } from './schema';
```

e a de `drizzle-orm` por

```ts
import { eq, like, desc, or, inArray, and, isNull, sql } from 'drizzle-orm';
```

Depois, no fim do arquivo:

```ts
// ─── GRCC — leads (/grcc) ────────────────────────────────────────────────────
//
// Toda escrita roda numa transação que grava, juntos: o lead, o evento de histórico, o
// projeto gerado no pipeline da Débora e o +1 em `grcc_versao` (que o dashboard consulta
// para atualizar ao vivo). Nunca existe mudança sem histórico nem lead sem projeto.

import { diffLead } from '../lib/grcc/diff';
import { dadosDoLead, montarPrevia } from '../lib/grcc/previa';
import { projetoDoLead } from '../lib/grcc/pipeline';
import {
    CAMPOS_LISTA,
    FIELD_DA_LISTA,
    type CampoLista,
    type CategoriaGrcc,
    type EventoHistorico,
    type LeadGrcc,
    type LeadGrccDados,
    type LinhaPlanilha,
    type Movimentacao,
    type Mudanca,
    type OrigemEvento,
    type ProblemaLinha,
    type ProjetoManual,
    type UltimoImport,
} from '../lib/grcc/tipos';

export class ErroGrcc extends Error {}

const AUTOR_GRCC = 'GRCC';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

function linhaParaLead(r: typeof leadGrcc.$inferSelect): LeadGrcc {
    return {
        id: r.id,
        cliente: r.cliente,
        solicitacao: r.solicitacao,
        status: r.status,
        categoria: r.categoria as CategoriaGrcc,
        etapa: r.etapa,
        situacao: r.situacao,
        motivoPerda: r.motivoPerda,
        familiaDemanda: r.familiaDemanda,
        valor: r.valor,
        uf: r.uf,
        municipio: r.municipio,
        regiao: r.regiao,
        contatoNome: r.contatoNome,
        contatoEmail: r.contatoEmail,
        contatoTelefone: r.contatoTelefone,
        previsaoFechamento: r.previsaoFechamento,
        inicioFaturamento: r.inicioFaturamento,
        duracaoMeses: r.duracaoMeses,
        criadoEm: r.criadoEm,
        atualizadoEm: r.atualizadoEm,
    };
}

function linhaParaEvento(r: typeof leadGrccHistorico.$inferSelect): EventoHistorico {
    let mudancas: Mudanca[] = [];
    try {
        mudancas = JSON.parse(r.mudancas);
    } catch {
        mudancas = [];
    }
    return { id: r.id, leadId: r.leadId, quando: r.quando, origem: r.origem, arquivo: r.arquivo, autor: r.autor, mudancas };
}

export async function listLeadsGrcc(): Promise<LeadGrcc[]> {
    const rows = await db.select().from(leadGrcc).where(isNull(leadGrcc.excluidoEm)).orderBy(desc(leadGrcc.atualizadoEm));
    return rows.map(linhaParaLead);
}

export async function getLeadGrcc(id: number): Promise<LeadGrcc | null> {
    const [r] = await db.select().from(leadGrcc).where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)));
    return r ? linhaParaLead(r) : null;
}

/** Gerente dono do pipeline gerado: role GRCC com o maior ano. */
export async function fetchGerenteGrcc(ex: Executor = db): Promise<{ id: string; year: number } | null> {
    const [m] = await ex
        .select({ id: managers.id, year: managers.year })
        .from(managers)
        .where(eq(managers.role, 'GRCC'))
        .orderBy(desc(managers.year))
        .limit(1);
    return m ?? null;
}

async function exigirGerente(tx: Tx) {
    const g = await fetchGerenteGrcc(tx);
    if (!g) throw new ErroGrcc('Gerente da GRCC não encontrado (nenhum gerente com papel "GRCC").');
    return g;
}

async function registrarEvento(tx: Tx, leadId: number, origem: OrigemEvento, mudancas: Mudanca[], arquivo: string | null, quando: string) {
    await tx.insert(leadGrccHistorico).values({ leadId, quando, origem, arquivo, autor: AUTOR_GRCC, mudancas: JSON.stringify(mudancas) });
}

async function sincronizarProjeto(tx: Tx, lead: LeadGrcc, gerente: { id: string; year: number }) {
    const p = projetoDoLead(lead, gerente);
    await tx
        .insert(projects)
        .values(p)
        .onConflictDoUpdate({
            target: projects.leadGrccId,
            set: {
                managerId: p.managerId,
                quarter: p.quarter,
                orgao: p.orgao,
                name: p.name,
                value: p.value,
                temperature: p.temperature,
                description: p.description,
                durationMonths: p.durationMonths,
                startDate: p.startDate,
            },
        });
}

async function incrementarVersao(tx: Tx) {
    await tx.run(sql`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('grcc_versao', '1', ${new Date().toISOString()})
        ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = excluded.updated_at
    `);
}

/** Valores novos de etapa/situação/motivo/família entram na lista suspensa (a planilha manda). */
async function acrescentarAsListas(tx: Tx, dados: LeadGrccDados[]) {
    const existentes = await tx.select().from(dropdownOptions).where(like(dropdownOptions.field, 'grcc_%'));
    const conhecidos = new Set(existentes.map((o) => `${o.field}|${o.value}`));
    const novos: { field: string; value: string }[] = [];
    for (const d of dados) {
        for (const campo of CAMPOS_LISTA) {
            if (campo === 'categoria') continue;
            const valor = d[campo];
            if (!valor) continue;
            const field = FIELD_DA_LISTA[campo];
            const k = `${field}|${valor}`;
            if (conhecidos.has(k)) continue;
            conhecidos.add(k);
            novos.push({ field, value: valor });
        }
    }
    if (novos.length > 0) await tx.insert(dropdownOptions).values(novos);
}

async function gravarLead(
    tx: Tx,
    id: number | null,
    dados: LeadGrccDados,
    origem: 'cadastro' | 'edicao' | 'importacao',
    arquivo: string | null,
    gerente: { id: string; year: number },
    agora: string
): Promise<{ lead: LeadGrcc; mudou: boolean }> {
    if (id === null) {
        const [r] = await tx.insert(leadGrcc).values({ ...dados, criadoEm: agora, atualizadoEm: agora }).returning();
        const lead = linhaParaLead(r);
        await registrarEvento(tx, lead.id, origem === 'importacao' ? 'importacao' : 'cadastro', diffLead(null, dados), arquivo, agora);
        await sincronizarProjeto(tx, lead, gerente);
        return { lead, mudou: true };
    }

    const [atualRow] = await tx.select().from(leadGrcc).where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)));
    if (!atualRow) throw new ErroGrcc('Lead não encontrado (pode ter sido excluído).');
    const atual = linhaParaLead(atualRow);
    const mudancas = diffLead(dadosDoLead(atual), dados);
    if (mudancas.length === 0) return { lead: atual, mudou: false };

    const [r] = await tx.update(leadGrcc).set({ ...dados, atualizadoEm: agora }).where(eq(leadGrcc.id, id)).returning();
    const lead = linhaParaLead(r);
    await registrarEvento(tx, id, origem, mudancas, arquivo, agora);
    await sincronizarProjeto(tx, lead, gerente);
    return { lead, mudou: true };
}

export async function salvarLeadGrcc(id: number | null, dados: LeadGrccDados): Promise<{ lead: LeadGrcc; mudou: boolean }> {
    return db.transaction(async (tx) => {
        const gerente = await exigirGerente(tx);
        const r = await gravarLead(tx, id, dados, id === null ? 'cadastro' : 'edicao', null, gerente, new Date().toISOString());
        if (r.mudou) {
            await acrescentarAsListas(tx, [dados]);
            await incrementarVersao(tx);
        }
        return r;
    });
}

export async function excluirLeadGrcc(id: number): Promise<void> {
    await db.transaction(async (tx) => {
        const agora = new Date().toISOString();
        const atualizados = await tx
            .update(leadGrcc)
            .set({ excluidoEm: agora, atualizadoEm: agora })
            .where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)))
            .returning({ id: leadGrcc.id });
        if (atualizados.length === 0) throw new ErroGrcc('Lead não encontrado (pode ter sido excluído).');
        await registrarEvento(tx, id, 'exclusao', [], null, agora);
        await tx.delete(projects).where(eq(projects.leadGrccId, id));
        await incrementarVersao(tx);
    });
}

export async function fetchProjetosManuaisGrcc(): Promise<ProjetoManual[]> {
    const g = await fetchGerenteGrcc();
    if (!g) return [];
    const rows = await db
        .select({ id: projects.id, orgao: projects.orgao, name: projects.name, value: projects.value, quarter: projects.quarter })
        .from(projects)
        .where(and(eq(projects.managerId, g.id), isNull(projects.leadGrccId)));
    return rows;
}

/**
 * Confirma uma importação. O servidor NÃO confia na prévia do navegador: reclassifica as
 * linhas contra o banco atual. Import nunca exclui leads ausentes da planilha.
 * Primeira importação (tabela vazia) com projetos manuais da Débora exige
 * `substituirPipelineManual = true` — eles são apagados na mesma transação.
 */
export async function aplicarImportGrcc(input: {
    arquivo: string;
    linhas: LinhaPlanilha[];
    problemas: ProblemaLinha[];
    substituirPipelineManual: boolean;
}): Promise<{ novos: number; alterados: number }> {
    return db.transaction(async (tx) => {
        const gerente = await exigirGerente(tx);
        const existentesRows = await tx.select().from(leadGrcc).where(isNull(leadGrcc.excluidoEm));
        const existentes = existentesRows.map(linhaParaLead);

        if (existentes.length === 0) {
            const manuais = await tx
                .select({ id: projects.id })
                .from(projects)
                .where(and(eq(projects.managerId, gerente.id), isNull(projects.leadGrccId)));
            if (manuais.length > 0) {
                if (!input.substituirPipelineManual) {
                    throw new ErroGrcc('Confirme a substituição do pipeline manual da Débora antes de gravar.');
                }
                await tx.delete(projects).where(and(eq(projects.managerId, gerente.id), isNull(projects.leadGrccId)));
            }
        }

        const previa = montarPrevia(input.linhas, input.problemas, existentes);
        const agora = new Date().toISOString();
        for (const n of previa.novos) await gravarLead(tx, null, n.dados, 'importacao', input.arquivo, gerente, agora);
        for (const a of previa.alterados) await gravarLead(tx, a.leadId, a.dados, 'importacao', input.arquivo, gerente, agora);

        await acrescentarAsListas(tx, [...previa.novos.map((n) => n.dados), ...previa.alterados.map((a) => a.dados)]);

        const resumo: UltimoImport = { arquivo: input.arquivo, quando: agora, novos: previa.novos.length, alterados: previa.alterados.length };
        await tx
            .insert(systemSettings)
            .values({ key: 'grcc_ultimo_import', value: JSON.stringify(resumo), updatedAt: agora })
            .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(resumo), updatedAt: agora } });
        if (resumo.novos + resumo.alterados > 0) await incrementarVersao(tx);

        return { novos: resumo.novos, alterados: resumo.alterados };
    });
}

export async function fetchHistoricoLead(leadId: number): Promise<EventoHistorico[]> {
    const rows = await db
        .select()
        .from(leadGrccHistorico)
        .where(eq(leadGrccHistorico.leadId, leadId))
        .orderBy(desc(leadGrccHistorico.quando), desc(leadGrccHistorico.id));
    return rows.map(linhaParaEvento);
}

export async function fetchMovimentacoesRecentes(limite = 15): Promise<Movimentacao[]> {
    const rows = await db
        .select({ ev: leadGrccHistorico, cliente: leadGrcc.cliente, solicitacao: leadGrcc.solicitacao })
        .from(leadGrccHistorico)
        .innerJoin(leadGrcc, eq(leadGrcc.id, leadGrccHistorico.leadId))
        .orderBy(desc(leadGrccHistorico.quando), desc(leadGrccHistorico.id))
        .limit(limite);
    return rows.map((r) => ({ ...linhaParaEvento(r.ev), cliente: r.cliente, solicitacao: r.solicitacao }));
}

export async function lerVersaoGrcc(): Promise<number> {
    const [r] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'grcc_versao'));
    return r ? Number(r.value) || 0 : 0;
}

export async function lerUltimoImportGrcc(): Promise<UltimoImport | null> {
    const [r] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'grcc_ultimo_import'));
    if (!r) return null;
    try {
        return JSON.parse(r.value) as UltimoImport;
    } catch {
        return null;
    }
}

export async function fetchListasGrcc(): Promise<Record<CampoLista, string[]>> {
    const rows = await db.select().from(dropdownOptions).where(like(dropdownOptions.field, 'grcc_%')).orderBy(dropdownOptions.id);
    const listas = Object.fromEntries(CAMPOS_LISTA.map((c) => [c, [] as string[]])) as Record<CampoLista, string[]>;
    for (const campo of CAMPOS_LISTA) {
        listas[campo] = rows.filter((r) => r.field === FIELD_DA_LISTA[campo]).map((r) => r.value);
    }
    return listas;
}
```

Notas para o implementador:
- Os `import` acima ficam no meio do arquivo por legibilidade da seção; se o ESLint reclamar (`import/first`), mova-os
  para o topo junto dos outros.
- `tx.run(sql\`...\`)` é a API do Drizzle para LibSQL (SQLite) executar SQL cru sem retorno de linhas.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/db/queries.grcc.test.ts && npx tsc --noEmit`
Expected: todos PASS; tsc limpo.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.ts src/db/queries.grcc.test.ts
git commit -m "feat(grcc): queries transacionais de lead com historico, pipeline gerado e versao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Proteger os projetos gerados (Settings, clone, API externa)

**Files:**
- Modify: `src/db/queries.ts:12-102` (`fetchAllManagersFromDB`), `src/app/settings/actions.ts:126-245`,
  `src/app/api/external/v1/grc/sync/route.ts:220-256`, `src/app/api/external/v1/grc/projects/[id]/route.ts`
- Create: `src/app/settings/actions.grcc.test.ts`

**Interfaces:**
- Consumes: `projects.leadGrccId` (Task 2), `salvarLeadGrcc` (Task 6).
- Produces: `Project.leadGrccId` preenchido no `Manager.pipeline` que o dashboard recebe.

- [ ] **Step 1: Teste** — `src/app/settings/actions.grcc.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const q = await import('@/db/queries');
const { saveManagerData, cloneManager } = await import('./actions');
const { eq, isNull, isNotNull } = await import('drizzle-orm');

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
    await q.salvarLeadGrcc(null, { ...LEAD_VAZIO, cliente: 'ALESP', solicitacao: 'Chatbot', categoria: 'No cliente', valor: 10, previsaoFechamento: '2026-08-01' });
    await db.insert(s.projects).values({ managerId: 'grcc-debora', quarter: 'q1', name: 'Manual', value: 5, temperature: 'morno' });
});

describe('projetos gerados pela GRCC', () => {
    it('aparecem no pipeline com leadGrccId', async () => {
        const [deb] = (await q.fetchAllManagersFromDB()).filter((m) => m.id === 'grcc-debora');
        expect(deb.pipeline.q3.projects[0]).toMatchObject({ name: 'Chatbot', leadGrccId: expect.any(Number) });
        expect(deb.pipeline.q1.projects[0].leadGrccId).toBeUndefined();
    });

    it('saveManagerData não apaga nem duplica os gerados; regrava só os manuais', async () => {
        const [deb] = (await q.fetchAllManagersFromDB()).filter((m) => m.id === 'grcc-debora');
        deb.pipeline.q3.projects[0] = { ...deb.pipeline.q3.projects[0], value: 999999 }; // tentativa de editar gerado
        deb.pipeline.q1.projects[0] = { ...deb.pipeline.q1.projects[0], value: 7 };
        await saveManagerData(deb);

        const gerados = await db.select().from(s.projects).where(isNotNull(s.projects.leadGrccId));
        expect(gerados).toHaveLength(1);
        expect(gerados[0].value).toBe(10);
        const manuais = await db.select().from(s.projects).where(isNull(s.projects.leadGrccId));
        expect(manuais.map((p) => p.value)).toEqual([7]);
    });

    it('cloneManager copia gerados como manuais (sem leadGrccId)', async () => {
        const { newId } = await cloneManager('grcc-debora', 'Clone');
        const doClone = await db.select().from(s.projects).where(eq(s.projects.managerId, newId));
        expect(doClone).toHaveLength(2);
        expect(doClone.every((p) => p.leadGrccId === null)).toBe(true);
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/settings/actions.grcc.test.ts`
Expected: FAIL (`leadGrccId` ausente; `saveManagerData` apaga o gerado; clone viola unique).

- [ ] **Step 3: Implementar**

Em `src/db/queries.ts` (`fetchAllManagersFromDB`, dentro de `quarterProjects.map((p) => ({ ...`), depois de
`billingStartMonth`:

```ts
                    leadGrccId: p.leadGrccId ?? undefined,
```

Em `src/app/settings/actions.ts`, ajuste o import do drizzle para `import { eq, and, isNull } from 'drizzle-orm';` e,
em `saveManagerData`, troque

```ts
        // 2. Delete existing projects to replace them
        await db.delete(projects).where(eq(projects.managerId, m.id));
```

por

```ts
        // 2. Delete existing MANUAL projects to replace them. Projetos com leadGrccId são
        //    gerados pela /grcc (dono = cadastro de leads) e nunca são apagados/regravados aqui.
        await db.delete(projects).where(and(eq(projects.managerId, m.id), isNull(projects.leadGrccId)));
```

e, no `quarter.projects.forEach(proj => {`, logo no início:

```ts
                    if (proj.leadGrccId) return; // gerado pela /grcc — o que vier do editor é descartado
```

Em `cloneManager`, troque

```ts
                sourceProjects.map(({ id: _id, managerId: _mid, ...rest }) => ({ ...rest, managerId: newId }))
```

por

```ts
                // leadGrccId é unique: o clone vira projeto manual.
                sourceProjects.map(({ id: _id, managerId: _mid, leadGrccId: _lead, ...rest }) => ({ ...rest, managerId: newId }))
```

Em `src/app/api/external/v1/grc/sync/route.ts`, importe `isNull` (`import { and, eq, inArray, isNull } from
'drizzle-orm';`) e adicione `isNull(projects.leadGrccId)` aos dois `where` de projetos:

```ts
                    .where(and(inArray(projects.id, projectDeleteIds), eq(projects.managerId, managerId), isNull(projects.leadGrccId)))
```

```ts
                        .where(and(eq(projects.id, item.id), eq(projects.managerId, managerId), isNull(projects.leadGrccId)))
```

Em `src/app/api/external/v1/grc/projects/[id]/route.ts`, logo depois de buscar o projeto existente
(`fetchProjectById`), antes de `updateProject`:

```ts
        if (existing.leadGrccId) {
            return NextResponse.json(
                { error: 'Projeto gerado pela GRCC (/grcc) — edite o lead, não o projeto.' },
                { status: 409 }
            );
        }
```

(use o nome da variável que o arquivo já dá ao projeto buscado.) Documente o 409 na seção do endpoint em
`DRM_API_DOCS.md` e `AI_API_INSTRUCTIONS.md` com uma linha: "Projetos com `leadGrccId` são gerados pela GRCC e não
aceitam PATCH (409) nem são apagados/alterados pelo `/grc/sync`."

- [ ] **Step 4: Rodar**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.ts src/app/settings/actions.ts src/app/settings/actions.grcc.test.ts src/app/api/external/v1/grc DRM_API_DOCS.md AI_API_INSTRUCTIONS.md
git commit -m "feat(grcc): projetos gerados pelos leads ficam protegidos no settings, clone e API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Server Actions (chave) e leituras abertas

**Files:**
- Create: `src/app/grcc/actions.ts`, `src/app/grcc/actions.test.ts`, `src/services/grcc.service.ts`
- Modify: `.env.development` (só a chave `GRCC_KEY=` — **não commitar valores**; o arquivo já é local)

**Interfaces:**
- Consumes: Task 5 `validarLead`; Task 6 queries; Task 4 `lerLinhasPlanilha` não.
- Produces (`src/app/grcc/actions.ts`, `'use server'`):
  - `verificarChaveGrcc(chave: string): Promise<boolean>`
  - `salvarLead(chave: string, id: number | null, dados: LeadGrccDados): Promise<ResultadoAcao<LeadGrcc>>`
  - `excluirLead(chave: string, id: number): Promise<ResultadoAcao<null>>`
  - `confirmarImportacao(chave: string, input: { arquivo: string; linhas: LinhaPlanilha[]; problemas: ProblemaLinha[]; substituirPipelineManual: boolean }): Promise<ResultadoAcao<{ novos: number; alterados: number }>>`
  - `type ResultadoAcao<T> = { ok: true; valor: T } | { ok: false; erro: string; erros?: Partial<Record<keyof LeadGrccDados, string>> }`
- Produces (`src/services/grcc.service.ts`, `'use server'`):
  - `carregarPainelGrcc(): Promise<PainelGrcc>` onde
    `PainelGrcc = { leads: LeadGrcc[]; listas: Record<CampoLista, string[]>; movimentacoes: Movimentacao[]; ultimoImport: UltimoImport | null; projetosManuais: ProjetoManual[]; versao: number }`
  - `historicoDoLead(id: number): Promise<EventoHistorico[]>`
  - `movimentacoesRecentes(limite?: number): Promise<Movimentacao[]>`
  - `versaoGrcc(): Promise<number>`
  - `ultimoImportGrcc(): Promise<UltimoImport | null>`

Os tipos `ResultadoAcao` e `PainelGrcc` ficam em `src/lib/grcc/tipos.ts` (arquivos `'use server'` não exportam tipos
de forma confiável para o cliente — exportar `type` é permitido, mas manter em `tipos.ts` evita dúvida).

- [ ] **Step 1: Teste** — `src/app/grcc/actions.test.ts`:

```ts
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));
process.env.GRCC_KEY = 'chave-certa';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const a = await import('./actions');
const svc = await import('@/services/grcc.service');

const dados = { ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', uf: 'SP', municipio: 'Indaiatuba', valor: 10, previsaoFechamento: '2026-11-01' };

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
});

describe('actions /grcc', () => {
    it('verificarChaveGrcc', async () => {
        expect(await a.verificarChaveGrcc('chave-certa')).toBe(true);
        expect(await a.verificarChaveGrcc(' chave-certa ')).toBe(true);
        expect(await a.verificarChaveGrcc('errada')).toBe(false);
        expect(await a.verificarChaveGrcc('')).toBe(false);
    });

    it('sem GRCC_KEY configurada nada passa', async () => {
        const antes = process.env.GRCC_KEY;
        delete process.env.GRCC_KEY;
        expect(await a.verificarChaveGrcc('')).toBe(false);
        expect(await a.verificarChaveGrcc('qualquer')).toBe(false);
        process.env.GRCC_KEY = antes;
    });

    it('recusa escrita com chave inválida e não grava', async () => {
        expect(await a.salvarLead('errada', null, dados)).toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await a.excluirLead('errada', 1)).toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await a.confirmarImportacao('errada', { arquivo: 'a.xlsx', linhas: [], problemas: [], substituirPipelineManual: false }))
            .toEqual({ ok: false, erro: 'Chave GRCC inválida.' });
        expect(await db.select().from(s.leadGrcc)).toEqual([]);
    });

    it('salvarLead valida (exige local na tela) e devolve erros por campo', async () => {
        const r = await a.salvarLead('chave-certa', null, { ...dados, municipio: null });
        expect(r).toEqual({ ok: false, erro: 'Corrija os campos destacados.', erros: { municipio: 'Informe o município.' } });
    });

    it('salvar → excluir, e o painel/histórico refletem', async () => {
        const r = await a.salvarLead('chave-certa', null, dados);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const painel = await svc.carregarPainelGrcc();
        expect(painel.leads).toHaveLength(1);
        expect(painel.versao).toBe(1);
        expect(await svc.versaoGrcc()).toBe(1);

        expect(await a.excluirLead('chave-certa', r.valor.id)).toEqual({ ok: true, valor: null });
        expect((await svc.historicoDoLead(r.valor.id)).map((e) => e.origem)).toEqual(['exclusao', 'cadastro']);
    });

    it('confirmarImportacao valida cada linha no servidor (payload adulterado vira problema, não grava)', async () => {
        const r = await a.confirmarImportacao('chave-certa', {
            arquivo: 'a.xlsx',
            linhas: [{ linha: 2, dados: { ...dados, cliente: 'Outro', valor: -5 } }],
            problemas: [],
            substituirPipelineManual: false,
        });
        expect(r).toEqual({ ok: true, valor: { novos: 0, alterados: 0 } });
        expect((await svc.carregarPainelGrcc()).leads.find((l) => l.cliente === 'Outro')).toBeUndefined();
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/grcc/actions.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Tipos compartilhados** — no fim de `src/lib/grcc/tipos.ts`:

```ts
export type ResultadoAcao<T> =
    | { ok: true; valor: T }
    | { ok: false; erro: string; erros?: Partial<Record<keyof LeadGrccDados, string>> };

export interface PainelGrcc {
    leads: LeadGrcc[];
    listas: Record<CampoLista, string[]>;
    movimentacoes: Movimentacao[];
    ultimoImport: UltimoImport | null;
    projetosManuais: ProjetoManual[];
    versao: number;
}
```

- [ ] **Step 4: Criar `src/app/grcc/actions.ts`**

```ts
'use server';

/**
 * Escritas da página /grcc. Toda action recebe a chave GRCC e a confere AQUI, no servidor —
 * o KeyGateGrcc só esconde a tela, não protege nada sozinho.
 */

import { revalidatePath } from 'next/cache';
import { aplicarImportGrcc, ErroGrcc, excluirLeadGrcc, salvarLeadGrcc } from '@/db/queries';
import { validarLead } from '@/lib/grcc/validacao';
import type { LeadGrcc, LeadGrccDados, LinhaPlanilha, ProblemaLinha, ResultadoAcao } from '@/lib/grcc/tipos';

const CHAVE_INVALIDA = { ok: false as const, erro: 'Chave GRCC inválida.' };

function chaveValida(chave: string): boolean {
    const correta = process.env.GRCC_KEY;
    if (!correta || typeof chave !== 'string') return false;
    return chave.trim() === correta;
}

function falha(err: unknown): { ok: false; erro: string } {
    if (err instanceof ErroGrcc) return { ok: false, erro: err.message };
    console.error('[grcc] falha ao gravar:', err);
    return { ok: false, erro: 'Não foi possível gravar. Tente de novo.' };
}

function revalidar() {
    revalidatePath('/grcc');
    revalidatePath('/');
}

export async function verificarChaveGrcc(chave: string): Promise<boolean> {
    return chaveValida(chave);
}

export async function salvarLead(chave: string, id: number | null, dados: LeadGrccDados): Promise<ResultadoAcao<LeadGrcc>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;
    const v = validarLead(dados, { exigirLocal: true });
    if (!v.ok) return { ok: false, erro: 'Corrija os campos destacados.', erros: v.erros };
    try {
        const { lead } = await salvarLeadGrcc(id, v.dados);
        revalidar();
        return { ok: true, valor: lead };
    } catch (err) {
        return falha(err);
    }
}

export async function excluirLead(chave: string, id: number): Promise<ResultadoAcao<null>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;
    try {
        await excluirLeadGrcc(id);
        revalidar();
        return { ok: true, valor: null };
    } catch (err) {
        return falha(err);
    }
}

export async function confirmarImportacao(
    chave: string,
    input: { arquivo: string; linhas: LinhaPlanilha[]; problemas: ProblemaLinha[]; substituirPipelineManual: boolean }
): Promise<ResultadoAcao<{ novos: number; alterados: number }>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;

    // Não confia no navegador: cada linha é revalidada aqui; as inválidas são descartadas.
    const linhas: LinhaPlanilha[] = [];
    for (const l of input.linhas) {
        const v = validarLead(l.dados);
        if (v.ok) linhas.push({ linha: l.linha, dados: v.dados });
    }

    try {
        const r = await aplicarImportGrcc({
            arquivo: String(input.arquivo).slice(0, 200),
            linhas,
            problemas: input.problemas,
            substituirPipelineManual: input.substituirPipelineManual === true,
        });
        revalidar();
        return { ok: true, valor: r };
    } catch (err) {
        return falha(err);
    }
}
```

- [ ] **Step 5: Criar `src/services/grcc.service.ts`**

```ts
'use server';

/** Leituras da GRCC — abertas, como o resto do dashboard (escritas ficam em app/grcc/actions.ts). */

import { unstable_noStore as noStore } from 'next/cache';
import {
    fetchHistoricoLead,
    fetchListasGrcc,
    fetchMovimentacoesRecentes,
    fetchProjetosManuaisGrcc,
    lerUltimoImportGrcc,
    lerVersaoGrcc,
    listLeadsGrcc,
} from '@/db/queries';
import type { EventoHistorico, Movimentacao, PainelGrcc, UltimoImport } from '@/lib/grcc/tipos';

export async function carregarPainelGrcc(): Promise<PainelGrcc> {
    noStore();
    const [leads, listas, movimentacoes, ultimoImport, projetosManuais, versao] = await Promise.all([
        listLeadsGrcc(),
        fetchListasGrcc(),
        fetchMovimentacoesRecentes(15),
        lerUltimoImportGrcc(),
        fetchProjetosManuaisGrcc(),
        lerVersaoGrcc(),
    ]);
    return { leads, listas, movimentacoes, ultimoImport, projetosManuais, versao };
}

export async function historicoDoLead(id: number): Promise<EventoHistorico[]> {
    noStore();
    return fetchHistoricoLead(id);
}

export async function movimentacoesRecentes(limite = 15): Promise<Movimentacao[]> {
    noStore();
    return fetchMovimentacoesRecentes(limite);
}

/** Consulta mínima que o dashboard faz a cada 15 s para saber se precisa recarregar. */
export async function versaoGrcc(): Promise<number> {
    noStore();
    return lerVersaoGrcc();
}

export async function ultimoImportGrcc(): Promise<UltimoImport | null> {
    noStore();
    return lerUltimoImportGrcc();
}
```

- [ ] **Step 6: Rodar**

Run: `npx vitest run src/app/grcc/actions.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Env local** — acrescente `GRCC_KEY=<valor combinado com a Débora>` em `.env.development` (arquivo
local, já fora do git — confira com `git check-ignore .env.development`; se **não** estiver ignorado, não edite e
avise o usuário). Na Vercel, a variável é configurada pelo usuário (Task 17).

- [ ] **Step 8: Commit**

```bash
git add src/app/grcc/actions.ts src/app/grcc/actions.test.ts src/services/grcc.service.ts src/lib/grcc/tipos.ts
git commit -m "feat(grcc): server actions com chave GRCC e leituras abertas do painel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Aba Cidades lendo do banco (remove o Power Automate)

**Files:**
- Modify: `src/services/cidades.service.ts` (reescrito), `src/components/cidades/CidadesView.tsx:4,459,535`
- Create: `src/services/cidades.service.test.ts`

**Interfaces:**
- Consumes: `listLeadsGrcc` (Task 6), `extractLeadDate` (Task 3).
- Produces: `fetchCidadesLeads(): Promise<LeadCidade[]>` (mesmo contrato), `leadParaCidade(l: LeadGrcc): LeadCidade`
  em `src/lib/grcc/cidade.ts` (puro, testável).

- [ ] **Step 1: Teste** — `src/services/cidades.service.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';
import { LEAD_VAZIO } from '@/lib/grcc/tipos';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const q = await import('@/db/queries');
const { fetchCidadesLeads } = await import('./cidades.service');

beforeAll(async () => {
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026, avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 });
    await q.salvarLeadGrcc(null, {
        ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'Perda', motivoPerda: 'Prazo',
        etapa: 'Encerrado — perdido', familiaDemanda: 'Consultoria', valor: 10, uf: 'SP', municipio: 'Indaiatuba',
        previsaoFechamento: '2026-11-10', contatoNome: 'Graziela',
    });
    const { lead } = await q.salvarLeadGrcc(null, { ...LEAD_VAZIO, cliente: 'Excluído', valor: 1 });
    await q.excluirLeadGrcc(lead.id);
});

describe('fetchCidadesLeads (banco)', () => {
    it('devolve LeadCidade com os campos *_padrao preenchidos e sem excluídos', async () => {
        const leads = await fetchCidadesLeads();
        expect(leads).toHaveLength(1);
        expect(leads[0]).toMatchObject({
            cliente: 'Prefeitura de Indaiatuba',
            solicitacao: 'Consultoria',
            categoria: 'Perda',
            valor: 10,
            uf: 'SP',
            municipio: 'Indaiatuba',
            previsao_fechamento: '2026-11-10',
            contato_nome: 'Graziela',
            categoria_padrao: 'Perda',
            etapa_padrao: 'Encerrado — perdido',
            situacao_padrao: 'Perdido',
            motivo_padrao: 'Prazo',
            familia_demanda: 'Consultoria',
            solicitacao_padrao: 'Consultoria',
        });
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/services/cidades.service.test.ts`
Expected: FAIL (ainda chama o Power Automate / campos diferentes).

- [ ] **Step 3: Criar `src/lib/grcc/cidade.ts`**

```ts
import type { LeadCidade } from '@/types/cidades';
import type { LeadGrcc } from './tipos';

/** Lead do banco → formato que a aba Cidades (CidadesView/BrazilHeatMap) já consome. */
export function leadParaCidade(l: LeadGrcc): LeadCidade {
    const situacao = l.situacao ?? (l.categoria === 'Perda' ? 'Perdido' : undefined);
    return {
        id: l.id,
        cliente: l.cliente,
        solicitacao: l.solicitacao,
        status: l.status ?? '',
        categoria: l.categoria,
        valor: l.valor,
        uf: l.uf ?? '',
        municipio: l.municipio ?? '',
        regiao: l.regiao ?? undefined,
        contato_nome: l.contatoNome ?? undefined,
        contato_email: l.contatoEmail ?? undefined,
        contato_telefone: l.contatoTelefone ?? undefined,
        previsao_fechamento: l.previsaoFechamento ?? undefined,
        categoria_padrao: l.categoria,
        etapa_padrao: l.etapa ?? undefined,
        situacao_padrao: situacao,
        motivo_padrao: l.motivoPerda ?? undefined,
        familia_demanda: l.familiaDemanda ?? undefined,
        solicitacao_padrao: l.solicitacao || undefined,
    };
}
```

- [ ] **Step 4: Reescrever `src/services/cidades.service.ts`** (o arquivo inteiro passa a ser):

```ts
'use server';

/**
 * Leads da aba Cidades. Fonte: cadastro da GRCC (`lead_grcc`, editado em /grcc). Até
 * 2026-10 vinha de uma planilha Excel via Power Automate — essa URL foi removida do código.
 */

import { unstable_noStore as noStore } from 'next/cache';
import { listLeadsGrcc } from '@/db/queries';
import { leadParaCidade } from '@/lib/grcc/cidade';
import type { LeadCidade } from '@/types/cidades';

export async function fetchCidadesLeads(): Promise<LeadCidade[]> {
    noStore();
    try {
        const leads = await listLeadsGrcc();
        return leads.map(leadParaCidade);
    } catch (error) {
        console.error('Erro ao buscar leads da GRCC:', error);
        throw new Error('Não foi possível carregar os leads da GRCC.');
    }
}
```

- [ ] **Step 5: Ajustar `CidadesView.tsx`**
  - Linha 4: `import { fetchCidadesLeads } from '@/services/cidades.service';` e acrescente
    `import { extractLeadDate } from '@/lib/grcc/normalizar';`
  - Texto de carregamento (linha ~459): `Carregando módulo de Cidades do Power Automate...` →
    `Carregando leads da GRCC...`
  - `title="Atualizar Dados do Power Automate"` → `title="Atualizar leads"`
  - Mensagem de erro padrão em `loadData`: `'Falha ao conectar com a fonte de dados do Power Automate.'` →
    `'Falha ao carregar os leads da GRCC.'`

- [ ] **Step 6: Confirmar que a URL sumiu**

Run: `git grep -n "powerautomate\|powerplatform" -- src` 
Expected: nenhuma ocorrência fora de `planner-pull.ts`/docs (o Planner usa env `PLANNER_FLOW_URL`, não URL fixa).

- [ ] **Step 7: Rodar tudo**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS; sem erros novos de lint.

- [ ] **Step 8: Commit**

```bash
git add src/services/cidades.service.ts src/services/cidades.service.test.ts src/lib/grcc/cidade.ts src/components/cidades/CidadesView.tsx
git commit -m "feat(grcc): aba Cidades le do cadastro da GRCC; remove URL do Power Automate do codigo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Página `/grcc` — porta, carregamento e lista

**Files:**
- Create: `src/components/ui/sheet.tsx` (via CLI), `src/app/grcc/page.tsx`, `src/app/grcc/KeyGateGrcc.tsx`,
  `src/app/grcc/GrccApp.tsx`, `src/app/grcc/components/LeadsGrccTable.tsx`,
  `src/app/grcc/components/MovimentacoesRecentes.tsx`, `src/app/grcc/components/formato.ts`,
  `src/app/grcc/components/LeadsGrccTable.test.tsx`

**Interfaces:**
- Consumes: `verificarChaveGrcc` (Task 8), `carregarPainelGrcc` (Task 8), `pendenciasDoLead` (Task 5),
  `temperaturaDaCategoria` (Task 5).
- Produces:
  - `useChaveGrcc(): string` (contexto do `KeyGateGrcc`)
  - `LeadsGrccTable({ leads, onAbrir }: { leads: LeadGrcc[]; onAbrir: (id: number) => void })`
  - `MovimentacoesRecentes({ itens, onAbrir })`
  - `formato.ts`: `brl(n: number): string`, `dataBr(iso: string | null): string`, `haQuanto(iso: string): string`,
    `rotuloMudanca(m: Mudanca): string`, `COR_CATEGORIA: Record<CategoriaGrcc, string>`
  - `avisarDashboard()` (publica no `BroadcastChannel('grcc')`) — em `GrccApp.tsx`, exportado.

- [ ] **Step 1: Gerar o Sheet do Shadcn**

Run: `npx shadcn@latest add sheet`
Expected: cria `src/components/ui/sheet.tsx` (aceite sobrescrever nada; se perguntar sobre dependências, aceite).

- [ ] **Step 2: Teste da tabela** — `src/app/grcc/components/LeadsGrccTable.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadsGrccTable } from './LeadsGrccTable';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

const mk = (id: number, over: Partial<LeadGrcc>): LeadGrcc => ({
    ...LEAD_VAZIO, id, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-20T00:00:00Z', ...over,
});

const leads = [
    mk(1, { cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente', valor: 260758.68, uf: 'SP', municipio: 'Indaiatuba', previsaoFechamento: '2026-11-10' }),
    mk(2, { cliente: 'ALESP', solicitacao: 'Chatbot', categoria: 'Em tratativas', valor: 0 }),
    mk(3, { cliente: 'Câmara de Osasco', solicitacao: 'Nuvem', categoria: 'Perda', motivoPerda: 'Prazo', valor: 5, uf: 'SP', municipio: 'Osasco' }),
];

describe('LeadsGrccTable', () => {
    it('mostra chips com contagem e filtra por categoria e por pendências', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        expect(screen.getAllByRole('row')).toHaveLength(4); // cabeçalho + 3

        await user.click(screen.getByRole('button', { name: /Perda 1/ }));
        expect(screen.getAllByRole('row')).toHaveLength(2);

        await user.click(screen.getByRole('button', { name: /Pendências 1/ }));
        const linhas = screen.getAllByRole('row').slice(1);
        expect(linhas).toHaveLength(1);
        expect(within(linhas[0]).getByText('ALESP')).toBeInTheDocument();
    });

    it('busca por cliente/solicitação/município sem acento', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        await user.type(screen.getByPlaceholderText(/Buscar/), 'camara')
        expect(screen.getAllByRole('row')).toHaveLength(2);
    });

    it('clique na linha abre o lead', async () => {
        const user = userEvent.setup();
        const onAbrir = vi.fn();
        render(<LeadsGrccTable leads={leads} onAbrir={onAbrir} />);
        await user.click(screen.getByText('Prefeitura de Indaiatuba'));
        expect(onAbrir).toHaveBeenCalledWith(1);
    });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/app/grcc/components/LeadsGrccTable.test.tsx`
Expected: FAIL (componente inexistente).

- [ ] **Step 4: Criar `src/app/grcc/components/formato.ts`**

```ts
import { ROTULO_CAMPO, type CategoriaGrcc, type Mudanca } from '@/lib/grcc/tipos';
import { formatCurrency } from '@/lib/format';

export function brl(n: number): string {
    return formatCurrency(n);
}

export function dataBr(iso: string | null): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function dataHoraBr(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function haQuanto(iso: string, agora = Date.now()): string {
    const min = Math.round((agora - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ontem' : `há ${d} dias`;
}

function valorLegivel(campo: Mudanca['campo'], v: Mudanca['de']): string {
    if (v === null) return '—';
    if (campo === 'valor') return brl(Number(v));
    if (campo === 'previsaoFechamento' || campo === 'inicioFaturamento') return dataBr(String(v));
    return String(v);
}

export function rotuloMudanca(m: Mudanca): string {
    return `${ROTULO_CAMPO[m.campo]}: ${valorLegivel(m.campo, m.de)} → ${valorLegivel(m.campo, m.para)}`;
}

export function deParaMudanca(m: Mudanca): { rotulo: string; de: string; para: string } {
    return { rotulo: ROTULO_CAMPO[m.campo], de: valorLegivel(m.campo, m.de), para: valorLegivel(m.campo, m.para) };
}

/** Cor do chip de categoria (alinhada à temperatura que gera no pipeline). */
export const COR_CATEGORIA: Record<CategoriaGrcc, string> = {
    Novo: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    'Validação': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    Parceiro: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    'Em tratativas': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    'No cliente': 'bg-red-500/10 text-red-300 border-red-500/30',
    Contratado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    Perda: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};
```

- [ ] **Step 5: Criar `src/app/grcc/components/LeadsGrccTable.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { CATEGORIAS_GRCC, type CategoriaGrcc, type LeadGrcc } from '@/lib/grcc/tipos';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import { temperaturaDaCategoria } from '@/lib/grcc/pipeline';
import { chaveTexto } from '@/lib/grcc/normalizar';
import { brl, COR_CATEGORIA, dataBr, haQuanto } from './formato';

type Filtro = 'todos' | 'pendencias' | CategoriaGrcc;

export function LeadsGrccTable({
    leads,
    onAbrir,
    destacados = new Set<number>(),
}: {
    leads: LeadGrcc[];
    onAbrir: (id: number) => void;
    destacados?: Set<number>;
}) {
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [busca, setBusca] = useState('');

    const pend = useMemo(() => new Map(leads.map((l) => [l.id, pendenciasDoLead(l)])), [leads]);
    const contagem = useMemo(() => {
        const c = new Map<Filtro, number>([['todos', leads.length], ['pendencias', 0]]);
        for (const l of leads) {
            c.set(l.categoria, (c.get(l.categoria) ?? 0) + 1);
            if ((pend.get(l.id) ?? []).length > 0) c.set('pendencias', (c.get('pendencias') ?? 0) + 1);
        }
        return c;
    }, [leads, pend]);

    const visiveis = useMemo(() => {
        const alvo = chaveTexto(busca);
        return leads.filter((l) => {
            if (filtro === 'pendencias' && (pend.get(l.id) ?? []).length === 0) return false;
            if (filtro !== 'todos' && filtro !== 'pendencias' && l.categoria !== filtro) return false;
            if (!alvo) return true;
            return chaveTexto(`${l.cliente} ${l.solicitacao} ${l.municipio ?? ''}`).includes(alvo);
        });
    }, [leads, filtro, busca, pend]);

    const chip = (f: Filtro, rotulo: string) => {
        const n = contagem.get(f) ?? 0;
        if (f !== 'todos' && f !== 'pendencias' && n === 0) return null;
        const ativo = filtro === f;
        return (
            <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    ativo ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100'
                }`}
            >
                {f === 'pendencias' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                {rotulo} {n}
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {chip('todos', 'Todos')}
                {CATEGORIAS_GRCC.map((c) => chip(c, c))}
                {chip('pendencias', 'Pendências')}
                <label className="ml-auto flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 h-9 w-full sm:w-72">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar cliente, solicitação ou município"
                        className="bg-transparent outline-none text-sm text-zinc-200 w-full"
                    />
                </label>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-950 text-zinc-400 text-[11px] uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-4 py-3">Cliente</th>
                            <th className="text-left px-4 py-3">Solicitação</th>
                            <th className="text-left px-4 py-3">Categoria</th>
                            <th className="text-left px-4 py-3">Etapa</th>
                            <th className="text-right px-4 py-3">Valor</th>
                            <th className="text-left px-4 py-3">Previsão</th>
                            <th className="text-left px-4 py-3">Atualizado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                        {visiveis.map((l) => {
                            const p = pend.get(l.id) ?? [];
                            return (
                                <tr
                                    key={l.id}
                                    onClick={() => onAbrir(l.id)}
                                    className={`cursor-pointer hover:bg-zinc-900/60 transition-colors ${destacados.has(l.id) ? 'bg-indigo-500/10' : ''}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                                            {p.length > 0 && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label={p.join(', ')} />
                                            )}
                                            {l.cliente}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {l.municipio ?? 'Sem município'} · {l.uf ?? '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 max-w-[260px] truncate">{l.solicitacao || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${COR_CATEGORIA[l.categoria]}`} title={`No pipeline: ${temperaturaDaCategoria(l.categoria)}`}>
                                            {l.categoria}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400">{l.etapa ?? '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-zinc-200">{l.valor ? brl(l.valor) : '—'}</td>
                                    <td className="px-4 py-3 text-zinc-400">{dataBr(l.previsaoFechamento)}</td>
                                    <td className="px-4 py-3 text-zinc-500 text-xs">{haQuanto(l.atualizadoEm)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {visiveis.length === 0 && <p className="text-center text-sm text-zinc-500 py-10">Nenhum lead neste filtro.</p>}
            </div>
        </div>
    );
}
```

- [ ] **Step 6: Criar `src/app/grcc/components/MovimentacoesRecentes.tsx`**

```tsx
'use client';

import type { Movimentacao } from '@/lib/grcc/tipos';
import { CAMPOS_DESTAQUE } from '@/lib/grcc/tipos';
import { deParaMudanca, haQuanto } from './formato';

const ORIGEM: Record<Movimentacao['origem'], string> = {
    cadastro: 'cadastrado',
    edicao: 'editado',
    importacao: 'importado',
    exclusao: 'excluído',
};

function resumo(m: Movimentacao): string {
    const destaque = m.mudancas.find((x) => CAMPOS_DESTAQUE.includes(x.campo));
    if (m.origem === 'edicao' || (m.origem === 'importacao' && destaque && destaque.de !== null)) {
        if (destaque) return `${deParaMudanca(destaque).rotulo} → ${deParaMudanca(destaque).para}`;
        return `${m.mudancas.length} alteração(ões)`;
    }
    return ORIGEM[m.origem];
}

export function MovimentacoesRecentes({
    itens,
    onAbrir,
    claro = false,
}: {
    itens: Movimentacao[];
    onAbrir?: (leadId: number) => void;
    claro?: boolean;
}) {
    if (itens.length === 0) return <p className="text-sm text-zinc-500">Nenhuma movimentação ainda.</p>;
    return (
        <ul className="flex flex-col gap-1">
            {itens.map((m) => (
                <li key={m.id}>
                    <button
                        type="button"
                        disabled={!onAbrir || m.origem === 'exclusao'}
                        onClick={() => onAbrir?.(m.leadId)}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-baseline gap-2 ${
                            claro ? 'hover:bg-zinc-100' : 'hover:bg-zinc-900'
                        } disabled:cursor-default`}
                    >
                        <span className={`font-semibold truncate ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{m.cliente}</span>
                        <span className={claro ? 'text-zinc-600' : 'text-zinc-400'}>{resumo(m)}</span>
                        <span className="ml-auto text-xs text-zinc-500 shrink-0">{haQuanto(m.quando)}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
```

- [ ] **Step 7: Criar `src/app/grcc/KeyGateGrcc.tsx`**

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { verificarChaveGrcc } from './actions';

const STORAGE_KEY = 'GRCC_ACCESS';
const ChaveContext = createContext<{ chave: string; sair: () => void } | null>(null);

export function useChaveGrcc() {
    const ctx = useContext(ChaveContext);
    if (!ctx) throw new Error('useChaveGrcc fora do KeyGateGrcc');
    return ctx;
}

export function KeyGateGrcc({ children }: { children: React.ReactNode }) {
    const [chave, setChave] = useState<string | null>(null);
    const [verificando, setVerificando] = useState(true);
    const [digitada, setDigitada] = useState('');
    const [erro, setErro] = useState(false);

    useEffect(() => {
        let salva: string | null = null;
        try {
            salva = localStorage.getItem(STORAGE_KEY);
        } catch {
            salva = null;
        }
        if (!salva) {
            setVerificando(false);
            return;
        }
        verificarChaveGrcc(salva).then((ok) => {
            if (ok) setChave(salva);
            else {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch {}
            }
            setVerificando(false);
        });
    }, []);

    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setErro(false);
        setVerificando(true);
        const ok = await verificarChaveGrcc(digitada);
        if (ok) {
            try {
                localStorage.setItem(STORAGE_KEY, digitada.trim());
            } catch {}
            setChave(digitada.trim());
        } else setErro(true);
        setVerificando(false);
    };

    const sair = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setChave(null);
        setDigitada('');
    };

    if (chave) return <ChaveContext.Provider value={{ chave, sair }}>{children}</ChaveContext.Provider>;

    if (verificando) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <form onSubmit={entrar} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-zinc-100">GRCC · Leads</h1>
                        <p className="text-xs text-zinc-500">Área de edição da GRCC. Informe a chave de acesso.</p>
                    </div>
                </div>
                <Input
                    type="password"
                    value={digitada}
                    onChange={(e) => setDigitada(e.target.value)}
                    placeholder="Chave GRCC"
                    autoFocus
                    className="bg-zinc-950 border-zinc-800"
                />
                {erro && <p className="text-sm text-red-400">Chave incorreta.</p>}
                <Button type="submit" disabled={!digitada.trim()}>Entrar</Button>
                <a href="/" className="text-xs text-center text-zinc-500 hover:text-zinc-300">Voltar ao dashboard</a>
            </form>
        </div>
    );
}
```

- [ ] **Step 8: Criar `src/app/grcc/GrccApp.tsx`** (o painel e a importação entram nas Tasks 11 e 12; aqui os
botões já existem e abrem estados que essas tasks preenchem)

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Plus, ArrowLeft, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { carregarPainelGrcc } from '@/services/grcc.service';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import type { PainelGrcc } from '@/lib/grcc/tipos';
import { useChaveGrcc } from './KeyGateGrcc';
import { LeadsGrccTable } from './components/LeadsGrccTable';
import { MovimentacoesRecentes } from './components/MovimentacoesRecentes';
import { LeadPainel } from './components/LeadPainel';
import { ImportarExcelDialog } from './components/ImportarExcelDialog';
import { brl, dataHoraBr } from './components/formato';

/** Avisa as abas do dashboard abertas neste navegador que os leads mudaram (atualização instantânea). */
export function avisarDashboard() {
    try {
        const canal = new BroadcastChannel('grcc');
        canal.postMessage({ tipo: 'leads-mudaram', quando: Date.now() });
        canal.close();
    } catch {
        // BroadcastChannel indisponível — o dashboard pega na próxima checagem (15 s).
    }
}

export function GrccApp() {
    const { sair } = useChaveGrcc();
    const [painel, setPainel] = useState<PainelGrcc | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aberto, setAberto] = useState<number | 'novo' | null>(null);
    const [importando, setImportando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const recarregar = useCallback(async () => {
        try {
            setPainel(await carregarPainelGrcc());
            setErro(null);
        } catch {
            setErro('Não foi possível carregar os leads. Tente de novo.');
        }
    }, []);

    useEffect(() => {
        recarregar();
    }, [recarregar]);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4000);
        return () => clearTimeout(t);
    }, [aviso]);

    const depoisDeGravar = useCallback(
        async (mensagem: string) => {
            await recarregar();
            avisarDashboard();
            setAviso(mensagem);
        },
        [recarregar]
    );

    const resumo = useMemo(() => {
        if (!painel) return null;
        const ativos = painel.leads.filter((l) => l.categoria !== 'Perda');
        return {
            total: painel.leads.length,
            pipeline: ativos.reduce((acc, l) => acc + l.valor, 0),
            pendencias: painel.leads.filter((l) => pendenciasDoLead(l).length > 0).length,
        };
    }, [painel]);

    if (!painel) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
                {erro ? (
                    <>
                        <p>{erro}</p>
                        <Button onClick={recarregar}>Tentar de novo</Button>
                    </>
                ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                )}
            </div>
        );
    }

    const leadAberto = typeof aberto === 'number' ? painel.leads.find((l) => l.id === aberto) ?? null : null;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
                <header className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div>
                        <h1 className="text-2xl font-bold">GRCC · Leads</h1>
                        <p className="text-sm text-zinc-400 mt-1">
                            {resumo!.total} leads · {brl(resumo!.pipeline)} em pipeline
                            {resumo!.pendencias > 0 && (
                                <span className="text-amber-400 inline-flex items-center gap-1 ml-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> {resumo!.pendencias} pendências de cadastro
                                </span>
                            )}
                        </p>
                        {painel.ultimoImport && (
                            <p className="text-xs text-zinc-500 mt-1">
                                Último import: {painel.ultimoImport.arquivo} · {dataHoraBr(painel.ultimoImport.quando)}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => setImportando(true)}>
                            <Upload className="w-4 h-4" /> Importar Excel
                        </Button>
                        <Button onClick={() => setAberto('novo')}>
                            <Plus className="w-4 h-4" /> Novo lead
                        </Button>
                        <Link href="/?view=cidades" className="text-sm text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 px-2">
                            <ArrowLeft className="w-4 h-4" /> Ver como leitor
                        </Link>
                        <button type="button" onClick={sair} title="Sair" className="p-2 text-zinc-500 hover:text-zinc-200">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                    <LeadsGrccTable leads={painel.leads} onAbrir={(id) => setAberto(id)} />
                    <aside className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4 h-fit">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Movimentações recentes</h2>
                        <MovimentacoesRecentes itens={painel.movimentacoes} onAbrir={(id) => setAberto(id)} />
                    </aside>
                </div>
            </div>

            <LeadPainel
                aberto={aberto !== null}
                lead={aberto === 'novo' ? null : leadAberto}
                listas={painel.listas}
                onFechar={() => setAberto(null)}
                onGravado={depoisDeGravar}
            />

            <ImportarExcelDialog
                aberto={importando}
                leadsAtuais={painel.leads}
                projetosManuais={painel.projetosManuais}
                onFechar={() => setImportando(false)}
                onGravado={depoisDeGravar}
            />

            {aviso && (
                <div role="status" className="fixed bottom-6 right-6 bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-xl shadow-xl">
                    {aviso}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 9: Criar `src/app/grcc/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { KeyGateGrcc } from './KeyGateGrcc';
import { GrccApp } from './GrccApp';

export const metadata: Metadata = { title: 'GRCC · Leads — AIBertinho' };

export default function GrccPage() {
    return (
        <KeyGateGrcc>
            <GrccApp />
        </KeyGateGrcc>
    );
}
```

- [ ] **Step 10: Stubs temporários para compilar** — crie `src/app/grcc/components/LeadPainel.tsx` e
`ImportarExcelDialog.tsx` exportando componentes que retornam `null` com as props tipadas como acima
(`LeadPainel(props: { aberto: boolean; lead: LeadGrcc | null; listas: Record<CampoLista, string[]>; onFechar: () => void; onGravado: (msg: string) => Promise<void> })`,
`ImportarExcelDialog(props: { aberto: boolean; leadsAtuais: LeadGrcc[]; projetosManuais: ProjetoManual[]; onFechar: () => void; onGravado: (msg: string) => Promise<void> })`).
As Tasks 11 e 12 substituem esses arquivos inteiros.

- [ ] **Step 11: Rodar**

Run: `npx vitest run src/app/grcc && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 12: Verificação manual** — `npm run dev`, abrir `http://localhost:6000/grcc`: pede chave; chave errada
mostra "Chave incorreta."; chave certa mostra cabeçalho, chips, tabela vazia e "Nenhuma movimentação ainda.".

- [ ] **Step 13: Commit**

```bash
git add src/components/ui/sheet.tsx src/app/grcc
git commit -m "feat(grcc): pagina /grcc com chave, lista filtravel e movimentacoes recentes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Painel lateral do lead (dados + histórico)

**Files:**
- Create (substitui stub): `src/app/grcc/components/LeadPainel.tsx`, `src/app/grcc/components/LeadHistorico.tsx`,
  `src/app/grcc/components/LeadPainel.test.tsx`

**Interfaces:**
- Consumes: `salvarLead`, `excluirLead` (Task 8), `historicoDoLead` (Task 8), `useChaveGrcc` (Task 10),
  `municipiosDaUf`, `UFS` (Task 3), `trimestreDaPrevisao`, `temperaturaDaCategoria` (Task 5).
- Produces: `LeadHistorico({ eventos: EventoHistorico[]; claro?: boolean })` — reutilizado na Fase 2.

- [ ] **Step 1: Teste** — `src/app/grcc/components/LeadPainel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

const salvarLead = vi.fn();
const excluirLead = vi.fn();
vi.mock('../actions', () => ({ salvarLead: (...a: unknown[]) => salvarLead(...a), excluirLead: (...a: unknown[]) => excluirLead(...a) }));
vi.mock('@/services/grcc.service', () => ({ historicoDoLead: vi.fn().mockResolvedValue([]) }));
vi.mock('../KeyGateGrcc', () => ({ useChaveGrcc: () => ({ chave: 'k', sair: () => {} }) }));

const { LeadPainel } = await import('./LeadPainel');

const listas = { categoria: ['Novo', 'Validação', 'Parceiro', 'Em tratativas', 'No cliente', 'Contratado', 'Perda'], etapa: [], situacao: [], motivoPerda: ['Prazo'], familiaDemanda: [] };
const lead: LeadGrcc = {
    ...LEAD_VAZIO, id: 5, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente',
    uf: 'SP', municipio: 'Indaiatuba', valor: 10, previsaoFechamento: '2026-11-10', criadoEm: 'x', atualizadoEm: '2026-10-20T00:00:00Z',
};

beforeEach(() => {
    salvarLead.mockReset();
    excluirLead.mockReset();
});

describe('LeadPainel', () => {
    it('mostra onde o lead cai no pipeline da Débora', () => {
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        expect(screen.getByText(/No pipeline da Débora: Q4 · quente/)).toBeInTheDocument();
    });

    it('motivo da perda só aparece em Perda e os erros do servidor aparecem no campo', async () => {
        const user = userEvent.setup();
        salvarLead.mockResolvedValue({ ok: false, erro: 'Corrija os campos destacados.', erros: { motivoPerda: 'Informe o motivo da perda.' } });
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        expect(screen.queryByLabelText(/Motivo da perda/)).not.toBeInTheDocument();
        await user.selectOptions(screen.getByLabelText('Categoria'), 'Perda');
        expect(screen.getByLabelText(/Motivo da perda/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Informe o motivo da perda.')).toBeInTheDocument();
        expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ categoria: 'Perda' }));
    });

    it('excluir pede confirmação inline antes de chamar a action', async () => {
        const user = userEvent.setup();
        excluirLead.mockResolvedValue({ ok: true, valor: null });
        const onGravado = vi.fn().mockResolvedValue(undefined);
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={onGravado} />);
        await user.click(screen.getByRole('button', { name: 'Excluir' }));
        expect(excluirLead).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Sim, excluir' }));
        await waitFor(() => expect(excluirLead).toHaveBeenCalledWith('k', 5));
        expect(onGravado).toHaveBeenCalledWith('Lead excluído.');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/grcc/components/LeadPainel.test.tsx`
Expected: FAIL (stub não renderiza nada).

- [ ] **Step 3: Criar `src/app/grcc/components/LeadHistorico.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { CAMPOS_DESTAQUE, type EventoHistorico } from '@/lib/grcc/tipos';
import { dataHoraBr, deParaMudanca, rotuloMudanca } from './formato';

const ORIGEM: Record<EventoHistorico['origem'], string> = {
    cadastro: 'Cadastrado',
    edicao: 'Editado na tela',
    importacao: 'Importação',
    exclusao: 'Excluído',
};

function Evento({ ev, claro }: { ev: EventoHistorico; claro: boolean }) {
    const [verTudo, setVerTudo] = useState(false);
    const destaque = ev.mudancas.filter((m) => CAMPOS_DESTAQUE.includes(m.campo));
    const texto = ev.mudancas.filter((m) => m.campo === 'valor' || m.campo === 'previsaoFechamento');
    const resto = ev.mudancas.filter((m) => !destaque.includes(m) && !texto.includes(m));
    const fraco = claro ? 'text-zinc-500' : 'text-zinc-500';
    const forte = claro ? 'text-zinc-900' : 'text-zinc-100';

    return (
        <li className="relative pl-5">
            <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <p className={`text-xs ${fraco}`}>
                {dataHoraBr(ev.quando)} · {ev.autor} · {ORIGEM[ev.origem]}
                {ev.arquivo && ` (${ev.arquivo})`}
            </p>
            {ev.origem === 'cadastro' || (ev.origem === 'importacao' && ev.mudancas.every((m) => m.de === null)) ? (
                <p className={`text-sm ${forte}`}>Lead cadastrado</p>
            ) : (
                <div className="flex flex-col gap-1 mt-1">
                    {destaque.map((m) => {
                        const d = deParaMudanca(m);
                        return (
                            <p key={m.campo} className="text-sm flex flex-wrap items-center gap-1.5">
                                <span className={fraco}>{d.rotulo}:</span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/30 line-through opacity-70">{d.de}</span>
                                <span className={fraco}>→</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-semibold">{d.para}</span>
                            </p>
                        );
                    })}
                    {texto.map((m) => (
                        <p key={m.campo} className={`text-sm ${forte}`}>{rotuloMudanca(m)}</p>
                    ))}
                    {resto.length > 0 &&
                        (verTudo ? (
                            resto.map((m) => (
                                <p key={m.campo} className={`text-xs ${fraco}`}>{rotuloMudanca(m)}</p>
                            ))
                        ) : (
                            <button type="button" onClick={() => setVerTudo(true)} className="text-xs text-indigo-400 text-left">
                                +{resto.length} alteração(ões)
                            </button>
                        ))}
                </div>
            )}
        </li>
    );
}

export function LeadHistorico({ eventos, claro = false }: { eventos: EventoHistorico[]; claro?: boolean }) {
    if (eventos.length === 0) return <p className="text-sm text-zinc-500">Sem histórico ainda.</p>;
    return (
        <ol className="flex flex-col gap-4 border-l border-zinc-800 ml-1">
            {eventos.map((ev) => (
                <Evento key={ev.id} ev={ev} claro={claro} />
            ))}
        </ol>
    );
}
```

- [ ] **Step 4: Criar `src/app/grcc/components/LeadPainel.tsx`** (substitui o stub)

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LEAD_VAZIO, type CampoLista, type EventoHistorico, type LeadGrcc, type LeadGrccDados } from '@/lib/grcc/tipos';
import { UFS, municipiosDaUf } from '@/lib/grcc/municipios';
import { temperaturaDaCategoria, trimestreDaPrevisao } from '@/lib/grcc/pipeline';
import { CAMPOS_LEAD } from '@/lib/grcc/tipos';
import { historicoDoLead } from '@/services/grcc.service';
import { excluirLead, salvarLead } from '../actions';
import { useChaveGrcc } from '../KeyGateGrcc';
import { LeadHistorico } from './LeadHistorico';

type Erros = Partial<Record<keyof LeadGrccDados, string>>;

function dadosDe(lead: LeadGrcc | null): LeadGrccDados {
    if (!lead) return { ...LEAD_VAZIO };
    return Object.fromEntries(CAMPOS_LEAD.map((c) => [c, lead[c]])) as unknown as LeadGrccDados;
}

const campoCls = 'w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-100 outline-none focus:border-indigo-500';

function Campo({ id, rotulo, erro, children, obrigatorio }: { id: string; rotulo: string; erro?: string; children: React.ReactNode; obrigatorio?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-semibold text-zinc-400">
                {rotulo}
                {obrigatorio && ' *'}
            </label>
            {children}
            {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>
    );
}

export function LeadPainel({
    aberto,
    lead,
    listas,
    onFechar,
    onGravado,
}: {
    aberto: boolean;
    lead: LeadGrcc | null;
    listas: Record<CampoLista, string[]>;
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
}) {
    const { chave } = useChaveGrcc();
    const [aba, setAba] = useState<'dados' | 'historico'>('dados');
    const [dados, setDados] = useState<LeadGrccDados>(dadosDe(lead));
    const [valorTexto, setValorTexto] = useState('');
    const [erros, setErros] = useState<Erros>({});
    const [erroGeral, setErroGeral] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
    const [historico, setHistorico] = useState<EventoHistorico[]>([]);

    useEffect(() => {
        const d = dadosDe(lead);
        setDados(d);
        setValorTexto(d.valor ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
        setErros({});
        setErroGeral(null);
        setConfirmandoExclusao(false);
        setAba('dados');
        setHistorico([]);
        if (lead) historicoDoLead(lead.id).then(setHistorico).catch(() => setHistorico([]));
    }, [lead, aberto]);

    const set = <K extends keyof LeadGrccDados>(campo: K, valor: LeadGrccDados[K]) =>
        setDados((d) => ({ ...d, [campo]: valor }));

    const municipios = useMemo(() => (dados.uf ? municipiosDaUf(dados.uf) : []), [dados.uf]);
    const listaId = `municipios-${dados.uf ?? 'x'}`;

    const salvar = async () => {
        setSalvando(true);
        setErroGeral(null);
        const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.')) || 0;
        const r = await salvarLead(chave, lead?.id ?? null, { ...dados, valor });
        setSalvando(false);
        if (!r.ok) {
            setErros(r.erros ?? {});
            setErroGeral(r.erro);
            return;
        }
        await onGravado(lead ? 'Lead atualizado.' : 'Lead cadastrado.');
        onFechar();
    };

    const excluir = async () => {
        if (!lead) return;
        setSalvando(true);
        const r = await excluirLead(chave, lead.id);
        setSalvando(false);
        if (!r.ok) {
            setErroGeral(r.erro);
            return;
        }
        await onGravado('Lead excluído.');
        onFechar();
    };

    const opcoes = (campo: CampoLista) => {
        const atual = dados[campo];
        const lista = listas[campo];
        return atual && !lista.includes(atual) ? [...lista, atual] : lista;
    };

    const select = (campo: CampoLista, rotulo: string, obrigatorio = false) => (
        <Campo id={`f-${campo}`} rotulo={rotulo} erro={erros[campo]} obrigatorio={obrigatorio}>
            <select
                id={`f-${campo}`}
                aria-label={rotulo}
                value={dados[campo] ?? ''}
                onChange={(e) => set(campo, (e.target.value || null) as never)}
                className={campoCls}
            >
                {campo !== 'categoria' && <option value="">—</option>}
                {opcoes(campo).map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
        </Campo>
    );

    const trimestre = trimestreDaPrevisao(dados.previsaoFechamento, new Date().getFullYear());

    return (
        <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-zinc-100">{lead ? lead.cliente : 'Novo lead'}</SheetTitle>
                    <SheetDescription className="text-zinc-400">
                        No pipeline da Débora: {trimestre === 'nao_mapeado' ? 'não mapeado' : trimestre.toUpperCase()} ·{' '}
                        {temperaturaDaCategoria(dados.categoria)}
                    </SheetDescription>
                </SheetHeader>

                {lead && (
                    <div className="flex gap-1 px-4">
                        {(['dados', 'historico'] as const).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => setAba(a)}
                                className={`px-3 py-1.5 rounded-md text-sm ${aba === a ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`}
                            >
                                {a === 'dados' ? 'Dados' : `Histórico (${historico.length})`}
                            </button>
                        ))}
                    </div>
                )}

                {aba === 'historico' && lead ? (
                    <div className="p-4">
                        <LeadHistorico eventos={historico} />
                    </div>
                ) : (
                    <form
                        className="p-4 flex flex-col gap-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            salvar();
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Campo id="f-cliente" rotulo="Cliente" erro={erros.cliente} obrigatorio>
                                <input id="f-cliente" value={dados.cliente} onChange={(e) => set('cliente', e.target.value)} className={campoCls} />
                            </Campo>
                            <Campo id="f-solicitacao" rotulo="Solicitação" erro={erros.solicitacao} obrigatorio>
                                <input id="f-solicitacao" value={dados.solicitacao} onChange={(e) => set('solicitacao', e.target.value)} className={campoCls} />
                            </Campo>
                            <Campo id="f-uf" rotulo="UF" erro={erros.uf} obrigatorio>
                                <select
                                    id="f-uf"
                                    value={dados.uf ?? ''}
                                    onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value || null, municipio: null }))}
                                    className={campoCls}
                                >
                                    <option value="">—</option>
                                    {UFS.map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo id="f-municipio" rotulo="Município" erro={erros.municipio} obrigatorio>
                                <input
                                    id="f-municipio"
                                    list={listaId}
                                    disabled={!dados.uf}
                                    value={dados.municipio ?? ''}
                                    onChange={(e) => set('municipio', e.target.value || null)}
                                    placeholder={dados.uf ? 'Digite para buscar' : 'Escolha a UF primeiro'}
                                    className={campoCls}
                                />
                                <datalist id={listaId}>
                                    {municipios.map((m) => (
                                        <option key={m} value={m} />
                                    ))}
                                </datalist>
                            </Campo>
                            {select('categoria', 'Categoria', true)}
                            {select('etapa', 'Etapa')}
                            {select('situacao', 'Situação')}
                            {select('familiaDemanda', 'Família da demanda')}
                            {dados.categoria === 'Perda' && select('motivoPerda', 'Motivo da perda', true)}
                            {dados.categoria === 'Contratado' && (
                                <>
                                    <Campo id="f-inicio" rotulo="Início do faturamento" erro={erros.inicioFaturamento} obrigatorio>
                                        <input id="f-inicio" type="date" value={dados.inicioFaturamento ?? ''} onChange={(e) => set('inicioFaturamento', e.target.value || null)} className={campoCls} />
                                    </Campo>
                                    <Campo id="f-duracao" rotulo="Duração (meses)" erro={erros.duracaoMeses}>
                                        <input id="f-duracao" type="number" min={1} value={dados.duracaoMeses} onChange={(e) => set('duracaoMeses', Number(e.target.value) || 12)} className={campoCls} />
                                    </Campo>
                                </>
                            )}
                            <Campo id="f-valor" rotulo="Valor (R$)" erro={erros.valor}>
                                <input id="f-valor" inputMode="decimal" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} placeholder="0,00" className={`${campoCls} font-mono`} />
                            </Campo>
                            <Campo id="f-previsao" rotulo="Previsão de fechamento" erro={erros.previsaoFechamento}>
                                <input id="f-previsao" type="date" value={dados.previsaoFechamento ?? ''} onChange={(e) => set('previsaoFechamento', e.target.value || null)} className={campoCls} />
                            </Campo>
                        </div>

                        <Campo id="f-status" rotulo="Andamento" erro={erros.status}>
                            <textarea id="f-status" rows={2} value={dados.status ?? ''} onChange={(e) => set('status', e.target.value || null)} className={`${campoCls} h-auto py-2`} />
                        </Campo>

                        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <legend className="text-xs font-semibold text-zinc-400 mb-1">Contato</legend>
                            <input aria-label="Nome do contato" placeholder="Nome" value={dados.contatoNome ?? ''} onChange={(e) => set('contatoNome', e.target.value || null)} className={campoCls} />
                            <div>
                                <input aria-label="E-mail do contato" placeholder="E-mail" value={dados.contatoEmail ?? ''} onChange={(e) => set('contatoEmail', e.target.value || null)} className={campoCls} />
                                {erros.contatoEmail && <p className="text-xs text-red-400">{erros.contatoEmail}</p>}
                            </div>
                            <input aria-label="Telefone do contato" placeholder="Telefone" value={dados.contatoTelefone ?? ''} onChange={(e) => set('contatoTelefone', e.target.value || null)} className={campoCls} />
                        </fieldset>

                        {erroGeral && <p className="text-sm text-red-400">{erroGeral}</p>}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                            {lead ? (
                                confirmandoExclusao ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-zinc-300">Excluir este lead?</span>
                                        <Button type="button" variant="destructive" size="sm" disabled={salvando} onClick={excluir}>
                                            Sim, excluir
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmandoExclusao(false)}>
                                            Cancelar
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="ghost" className="text-red-400" onClick={() => setConfirmandoExclusao(true)}>
                                        Excluir
                                    </Button>
                                )
                            ) : (
                                <span />
                            )}
                            <Button type="submit" disabled={salvando}>
                                Salvar
                            </Button>
                        </div>
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
}
```

Nota: o `Sheet` do Shadcn renderiza num portal; no jsdom ele funciona com o stub de pointer capture do
`vitest.setup.ts`. Se o teste não achar o conteúdo, verifique se `SheetContent` monta com `open` controlado.

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/app/grcc && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Verificação manual** — em `/grcc`: "Novo lead" → salvar vazio mostra erros por campo; preencher e
salvar → toast "Lead cadastrado.", lead na tabela, "Movimentações recentes" com "cadastrado"; reabrir → aba
"Histórico (1)"; mudar categoria para Perda sem motivo → erro no campo; excluir → confirmação inline.

- [ ] **Step 7: Commit**

```bash
git add src/app/grcc/components/LeadPainel.tsx src/app/grcc/components/LeadHistorico.tsx src/app/grcc/components/LeadPainel.test.tsx
git commit -m "feat(grcc): painel lateral do lead com edicao, exclusao inline e linha do tempo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Importar Excel (arquivo → prévia → confirmar)

**Files:**
- Create (substitui stub): `src/app/grcc/components/ImportarExcelDialog.tsx`,
  `src/app/grcc/components/ImportarExcelDialog.test.tsx`

**Interfaces:**
- Consumes: `lerLinhasPlanilha` (Task 4), `montarPrevia` (Task 5), `confirmarImportacao` (Task 8),
  `useChaveGrcc` (Task 10), `rotuloMudanca` (Task 10), `read-excel-file` (`readXlsxFile`, `readSheetNames`).
- Produces: componente final da importação; constante `ABA_PADRAO` (definida a partir do Step 1 da Task 4).

- [ ] **Step 1: Teste** — `src/app/grcc/components/ImportarExcelDialog.test.tsx` (o leitor de `.xlsx` é mockado; o
teste cobre prévia, cutover e envio):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('read-excel-file', () => ({
    default: vi.fn().mockResolvedValue([
        ['Cliente', 'Solicitação', 'Valor', 'UF', 'Categoria'],
        ['Prefeitura de Indaiatuba', 'Consultoria', 'R$ 10,00', 'SP', 'No cliente'],
        ['', 'sem cliente', '1', 'SP', 'Novo'],
    ]),
    readSheetNames: vi.fn().mockResolvedValue(['Leads']),
}));
const confirmarImportacao = vi.fn().mockResolvedValue({ ok: true, valor: { novos: 1, alterados: 0 } });
vi.mock('../actions', () => ({ confirmarImportacao: (...a: unknown[]) => confirmarImportacao(...a) }));
vi.mock('../KeyGateGrcc', () => ({ useChaveGrcc: () => ({ chave: 'k', sair: () => {} }) }));

const { ImportarExcelDialog } = await import('./ImportarExcelDialog');

describe('ImportarExcelDialog', () => {
    it('lê, mostra prévia com problemas, exige confirmar o cutover e envia', async () => {
        const user = userEvent.setup();
        const onGravado = vi.fn().mockResolvedValue(undefined);
        render(
            <ImportarExcelDialog
                aberto
                leadsAtuais={[]}
                projetosManuais={[{ id: 1, orgao: 'ALESP', name: 'Chatbot', value: 10, quarter: 'q3' }]}
                onFechar={() => {}}
                onGravado={onGravado}
            />
        );
        const arquivo = new File(['x'], 'leads.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await user.upload(screen.getByLabelText(/Arquivo \.xlsx/), arquivo);

        expect(await screen.findByText(/leads\.xlsx · 2 linhas lidas/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Novos 1/ })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Com problema 1/ }));
        expect(screen.getByText(/Linha 3: Cliente vazio/)).toBeInTheDocument();

        const gravar = screen.getByRole('button', { name: /Gravar 1 lead/ });
        expect(gravar).toBeDisabled();
        await user.click(screen.getByLabelText(/Substituir os 1 projetos digitados à mão/));
        expect(gravar).toBeEnabled();
        await user.click(gravar);

        await waitFor(() =>
            expect(confirmarImportacao).toHaveBeenCalledWith('k', expect.objectContaining({ arquivo: 'leads.xlsx', substituirPipelineManual: true }))
        );
        expect(onGravado).toHaveBeenCalledWith('1 novo, 0 atualizados.');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/grcc/components/ImportarExcelDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Criar `src/app/grcc/components/ImportarExcelDialog.tsx`**

```tsx
'use client';

import { useState } from 'react';
import readXlsxFile, { readSheetNames } from 'read-excel-file';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { lerLinhasPlanilha } from '@/lib/grcc/planilha';
import { montarPrevia } from '@/lib/grcc/previa';
import type { LeadGrcc, Previa, ProjetoManual, ResultadoPlanilha } from '@/lib/grcc/tipos';
import { confirmarImportacao } from '../actions';
import { useChaveGrcc } from '../KeyGateGrcc';
import { brl, rotuloMudanca } from './formato';

/** Aba da planilha com os leads (fechada no Step 1 da Task 4). Se não existir, usa a primeira. */
const ABA_PADRAO = 'Leads';

type AbaPrevia = 'novos' | 'alterados' | 'iguais' | 'problemas';

export function ImportarExcelDialog({
    aberto,
    leadsAtuais,
    projetosManuais,
    onFechar,
    onGravado,
}: {
    aberto: boolean;
    leadsAtuais: LeadGrcc[];
    projetosManuais: ProjetoManual[];
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
}) {
    const { chave } = useChaveGrcc();
    const [arquivo, setArquivo] = useState<string | null>(null);
    const [lido, setLido] = useState<ResultadoPlanilha | null>(null);
    const [previa, setPrevia] = useState<Previa | null>(null);
    const [aba, setAba] = useState<AbaPrevia>('novos');
    const [lendo, setLendo] = useState(false);
    const [gravando, setGravando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [cutoverOk, setCutoverOk] = useState(false);

    const primeiraImportacao = leadsAtuais.length === 0 && projetosManuais.length > 0;

    const limpar = () => {
        setArquivo(null);
        setLido(null);
        setPrevia(null);
        setErro(null);
        setCutoverOk(false);
        setAba('novos');
    };

    const fechar = () => {
        limpar();
        onFechar();
    };

    const ler = async (file: File) => {
        limpar();
        setLendo(true);
        try {
            const abas = await readSheetNames(file);
            const sheet = abas.includes(ABA_PADRAO) ? ABA_PADRAO : abas[0];
            const matriz = (await readXlsxFile(file, { sheet })) as unknown[][];
            const r = lerLinhasPlanilha(matriz);
            setArquivo(file.name);
            if (r.colunasFaltando.length > 0) {
                setErro(`A planilha não tem as colunas obrigatórias: ${r.colunasFaltando.join(', ')}.`);
                return;
            }
            setLido(r);
            setPrevia(montarPrevia(r.linhas, r.problemas, leadsAtuais));
        } catch {
            setErro('Não foi possível ler o arquivo. Confirme que é um .xlsx válido.');
        } finally {
            setLendo(false);
        }
    };

    const total = previa ? previa.novos.length + previa.alterados.length : 0;
    const podeGravar = !!previa && total > 0 && (!primeiraImportacao || cutoverOk) && !gravando;

    const gravar = async () => {
        if (!previa || !lido || !arquivo) return;
        setGravando(true);
        setErro(null);
        const r = await confirmarImportacao(chave, {
            arquivo,
            linhas: lido.linhas,
            problemas: lido.problemas,
            substituirPipelineManual: primeiraImportacao && cutoverOk,
        });
        setGravando(false);
        if (!r.ok) {
            setErro(r.erro);
            return;
        }
        await onGravado(`${r.valor.novos} ${r.valor.novos === 1 ? 'novo' : 'novos'}, ${r.valor.alterados} atualizados.`);
        fechar();
    };

    const linhasLidas = lido ? lido.linhas.length + lido.problemas.length : 0;
    const chipAba = (a: AbaPrevia, rotulo: string, n: number) => (
        <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${aba === a ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
        >
            {rotulo} {n}
        </button>
    );

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="sm:max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar Excel</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Nada é gravado até você confirmar. Leads que não estão na planilha são mantidos.
                    </DialogDescription>
                </DialogHeader>

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-800 rounded-xl p-6 cursor-pointer hover:border-indigo-500/60">
                    {lendo ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : <FileSpreadsheet className="w-6 h-6 text-indigo-400" />}
                    <span className="text-sm text-zinc-300">{arquivo ?? 'Escolha ou arraste o arquivo .xlsx'}</span>
                    <input
                        type="file"
                        aria-label="Arquivo .xlsx"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) ler(f);
                            e.target.value = '';
                        }}
                    />
                </label>

                {erro && <p className="text-sm text-red-400">{erro}</p>}

                {previa && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-zinc-300">
                            {arquivo} · {linhasLidas} linhas lidas
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {chipAba('novos', 'Novos', previa.novos.length)}
                            {chipAba('alterados', 'Alterados', previa.alterados.length)}
                            {chipAba('iguais', 'Iguais', previa.iguais)}
                            {chipAba('problemas', '⚠ Com problema', previa.problemas.length)}
                        </div>

                        <div className="border border-zinc-800 rounded-xl p-3 max-h-72 overflow-y-auto text-sm flex flex-col gap-2">
                            {aba === 'novos' &&
                                previa.novos.map((n) => (
                                    <p key={n.linha}>
                                        <span className="text-zinc-500">Linha {n.linha}:</span> {n.dados.cliente} · {n.dados.solicitacao || '—'} ·{' '}
                                        {brl(n.dados.valor)} · {n.dados.categoria}
                                    </p>
                                ))}
                            {aba === 'alterados' &&
                                previa.alterados.map((a) => (
                                    <div key={a.linha}>
                                        <p className="font-semibold">{a.dados.cliente}</p>
                                        {a.mudancas.map((m) => (
                                            <p key={m.campo} className="text-zinc-400 pl-3">
                                                {rotuloMudanca(m)}
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            {aba === 'iguais' && <p className="text-zinc-400">{previa.iguais} linhas sem nenhuma mudança.</p>}
                            {aba === 'problemas' &&
                                previa.problemas.map((p) => (
                                    <p key={`${p.linha}-${p.motivo}`} className="text-amber-300">
                                        Linha {p.linha}: {p.motivo} {p.cliente && <span className="text-zinc-500">({p.cliente})</span>} — será ignorada
                                    </p>
                                ))}
                        </div>

                        {primeiraImportacao && (
                            <div className="border border-amber-500/40 bg-amber-500/5 rounded-xl p-3 flex flex-col gap-2">
                                <p className="text-sm text-amber-200 font-semibold">Pipeline da Débora</p>
                                <p className="text-sm text-zinc-300">
                                    Esta é a primeira importação. Os {projetosManuais.length} projetos digitados à mão no pipeline da Débora serão
                                    substituídos pelos {previa.novos.length} projetos gerados a partir dos leads.
                                </p>
                                <ul className="text-xs text-zinc-400 max-h-32 overflow-y-auto">
                                    {projetosManuais.map((p) => (
                                        <li key={p.id}>
                                            {p.orgao ?? '—'} · {p.name} · {brl(p.value)} · {p.quarter.toUpperCase()}
                                        </li>
                                    ))}
                                </ul>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={cutoverOk} onChange={(e) => setCutoverOk(e.target.checked)} />
                                    Substituir os {projetosManuais.length} projetos digitados à mão
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={fechar}>
                                Cancelar
                            </Button>
                            <Button disabled={!podeGravar} onClick={gravar}>
                                {gravando ? 'Gravando…' : `Gravar ${total} ${total === 1 ? 'lead' : 'leads'}`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

Atualize `ABA_PADRAO` com o nome real da aba anotado no Step 1 da Task 4.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/app/grcc && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Verificação manual com a planilha real** (banco local/dev, nunca produção nesta etapa): importar o
`.xlsx` → conferir contagem de linhas (~131), problemas listados fazem sentido, bloco de cutover aparece com os 40
projetos; gravar; reimportar o mesmo arquivo → "Iguais N", "Gravar 0 leads" desabilitado.

- [ ] **Step 6: Commit**

```bash
git add src/app/grcc/components/ImportarExcelDialog.tsx src/app/grcc/components/ImportarExcelDialog.test.tsx
git commit -m "feat(grcc): importacao de xlsx com previa, problemas por linha e troca do pipeline manual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Selo "Gerenciado pela GRCC" no editor de pipeline

**Files:**
- Modify: `src/app/settings/QuarterEditor.tsx:68-...` (render de cada projeto)
- Create: `src/app/settings/QuarterEditor.test.tsx`

**Interfaces:**
- Consumes: `Project.leadGrccId` (Tasks 2/7).

- [ ] **Step 1: Teste** — `src/app/settings/QuarterEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuarterEditor } from './QuarterEditor';
import type { Manager } from '@/types/manager';

const manager = { id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 } as unknown as Manager;

describe('QuarterEditor', () => {
    it('projeto gerado pela GRCC aparece travado com selo e link', () => {
        render(
            <QuarterEditor
                qKey="q3"
                manager={manager}
                onChange={() => {}}
                quarterData={{ total: 10, projects: [{ name: 'Chatbot', orgao: 'ALESP', value: 10, temperature: 'quente', leadGrccId: 4 }, { name: 'Manual', value: 1 }] }}
            />
        );
        expect(screen.getByText('Gerenciado pela GRCC')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Editar em \/grcc/ })).toHaveAttribute('href', '/grcc');
        expect(screen.getByDisplayValue('Chatbot')).toBeDisabled();
        expect(screen.getByDisplayValue('Manual')).toBeEnabled();
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/settings/QuarterEditor.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar** — em `QuarterEditor.tsx`:
  1. Dentro de `quarterData.projects.map((p, idx) => (`, troque o `<div key={idx} ...>` externo por um fragmento que
     calcula `const gerado = !!p.leadGrccId;` — como é uma arrow com `(` implícito, converta para bloco:
     `quarterData.projects.map((p, idx) => { const gerado = !!p.leadGrccId; return ( ... ); })`.
  2. Logo após abrir o `<div key={idx} className="bg-zinc-950 ...">`, insira:

```tsx
                            {gerado && (
                                <div className="absolute -top-2.5 left-4 flex items-center gap-2 text-[11px]">
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-semibold">
                                        Gerenciado pela GRCC
                                    </span>
                                    <a href="/grcc" className="text-indigo-400 hover:underline">Editar em /grcc</a>
                                </div>
                            )}
                            <fieldset disabled={gerado} className="contents">
```

     e feche `</fieldset>` imediatamente antes do `</div>` que fecha esse card (envolvendo o grid de campos e os
     botões de mover/histórico/excluir — `fieldset disabled` desabilita todos os `input`/`button` dentro).
  3. Adicione `className` extra ao card quando `gerado`: `${gerado ? 'opacity-80 mt-3' : ''}`.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/app/settings && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/QuarterEditor.tsx src/app/settings/QuarterEditor.test.tsx
git commit -m "feat(grcc): editor de pipeline mostra projetos gerados pela GRCC travados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## FASE 2 — leitura ao vivo

### Task 14: Hook de versão (`useVersaoGrcc`)

**Files:**
- Create: `src/hooks/useVersaoGrcc.ts`, `src/hooks/useVersaoGrcc.test.tsx`

**Interfaces:**
- Consumes: `versaoGrcc` (Task 8).
- Produces: `useVersaoGrcc(onMudou: () => void, intervaloMs = 15000): void` — chama `onMudou` quando a versão muda
  (não na primeira leitura), ao voltar o foco, e ao receber mensagem no `BroadcastChannel('grcc')`; pausa com
  `document.hidden`; falhas silenciosas.

- [ ] **Step 1: Teste** — `src/hooks/useVersaoGrcc.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const versaoGrcc = vi.fn();
vi.mock('@/services/grcc.service', () => ({ versaoGrcc: () => versaoGrcc() }));
const { useVersaoGrcc } = await import('./useVersaoGrcc');

async function tick(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    versaoGrcc.mockReset();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => vi.useRealTimers());

describe('useVersaoGrcc', () => {
    it('só chama onMudou quando a versão muda (não na primeira leitura)', async () => {
        versaoGrcc.mockResolvedValueOnce(3).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        expect(onMudou).not.toHaveBeenCalled();
        await tick(15000);
        expect(onMudou).not.toHaveBeenCalled();
        await tick(15000);
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('pausa com a aba escondida e checa na hora ao voltar', async () => {
        versaoGrcc.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        await tick(45000);
        expect(versaoGrcc).toHaveBeenCalledTimes(1);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('mensagem no BroadcastChannel dispara onMudou na hora', async () => {
        versaoGrcc.mockResolvedValue(1);
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(0);
        await act(async () => {
            const c = new BroadcastChannel('grcc');
            c.postMessage({ tipo: 'leads-mudaram' });
            c.close();
            await vi.advanceTimersByTimeAsync(10);
        });
        expect(onMudou).toHaveBeenCalledTimes(1);
    });

    it('falha na checagem é silenciosa', async () => {
        versaoGrcc.mockRejectedValue(new Error('rede'));
        const onMudou = vi.fn();
        renderHook(() => useVersaoGrcc(onMudou, 15000));
        await tick(30000);
        expect(onMudou).not.toHaveBeenCalled();
    });
});
```

(Se o jsdom não tiver `BroadcastChannel`, o Node 18+ tem global — o teste usa o do Node. Se não entregar mensagens
no mesmo processo com timers falsos, troque `vi.useFakeTimers()` por `vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/hooks/useVersaoGrcc.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Criar `src/hooks/useVersaoGrcc.ts`**

```ts
'use client';

import { useEffect, useRef } from 'react';
import { versaoGrcc } from '@/services/grcc.service';

/**
 * "Ao vivo" sem WebSocket: consulta `grcc_versao` (consulta mínima) a cada `intervaloMs`
 * com a aba visível, na hora ao voltar o foco, e instantaneamente quando a /grcc avisa pelo
 * BroadcastChannel('grcc') neste mesmo navegador. Chama `onMudou` só quando a versão muda.
 */
export function useVersaoGrcc(onMudou: () => void, intervaloMs = 15000): void {
    const callback = useRef(onMudou);
    callback.current = onMudou;

    useEffect(() => {
        let ultima: number | null = null;
        let vivo = true;
        let emCurso = false;

        const checar = async () => {
            if (emCurso || document.hidden) return;
            emCurso = true;
            try {
                const v = await versaoGrcc();
                if (!vivo) return;
                if (ultima !== null && v !== ultima) callback.current();
                ultima = v;
            } catch {
                // silencioso: tenta no próximo ciclo
            } finally {
                emCurso = false;
            }
        };

        checar();
        const timer = setInterval(checar, intervaloMs);
        const aoVoltar = () => {
            if (!document.hidden) checar();
        };
        document.addEventListener('visibilitychange', aoVoltar);
        window.addEventListener('focus', aoVoltar);

        let canal: BroadcastChannel | null = null;
        try {
            canal = new BroadcastChannel('grcc');
            canal.onmessage = () => {
                ultima = null; // a próxima leitura vira referência nova
                callback.current();
                checar();
            };
        } catch {
            canal = null;
        }

        return () => {
            vivo = false;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', aoVoltar);
            window.removeEventListener('focus', aoVoltar);
            canal?.close();
        };
    }, [intervaloMs]);
}
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/hooks && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks
git commit -m "feat(grcc): hook de checagem de versao para atualizar o dashboard ao vivo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Dashboard e aba Cidades atualizando sem F5

**Files:**
- Modify: `src/components/dashboard/DashboardShell.tsx:76-103`, `src/components/cidades/CidadesView.tsx:91-180,1141-1142`

**Interfaces:**
- Consumes: `useVersaoGrcc` (Task 14).
- Produces: comportamento — gerentes e leads recarregam sem remontar; aviso "Atualizado agora"; linhas alteradas
  destacadas 3 s.

- [ ] **Step 1: `DashboardShell`** — extraia a busca de gerentes para recarga silenciosa. Logo depois do
`useEffect` de "Fetch Data", adicione:

```tsx
    // Ao vivo: quando a GRCC grava leads, o pipeline da Débora muda — recarrega só os gerentes,
    // sem spinner e sem perder ano/gerente/visão selecionados.
    useVersaoGrcc(async () => {
        try {
            setManagers(await fetchDashboardManagers());
        } catch {
            // silencioso: o dado atual continua na tela
        }
    });
```

e o import `import { useVersaoGrcc } from '@/hooks/useVersaoGrcc';`. Também leia `?view=cidades` (link "Ver como
leitor" da /grcc) — no `useEffect` de tema (que já roda no mount), acrescente:

```tsx
        try {
            const view = new URLSearchParams(window.location.search).get('view');
            if (view === 'cidades') setCurrentView('cidades');
        } catch {}
```

- [ ] **Step 2: `CidadesView`** — recarga silenciosa + destaque. Depois de `const loadData = async () => {...}`:

```tsx
    // Ao vivo: troca os dados sem spinner (filtros, busca, aba e scroll preservados).
    const [avisoAoVivo, setAvisoAoVivo] = useState<string | null>(null);
    const [destacados, setDestacados] = useState<Set<number>>(new Set());
    useVersaoGrcc(async () => {
        try {
            const novos = await fetchCidadesLeads();
            setLeads((antigos) => {
                const porId = new Map(antigos.map((l) => [l.id, JSON.stringify(l)]));
                const mudaram = new Set(novos.filter((l) => porId.get(l.id) !== JSON.stringify(l)).map((l) => l.id));
                setDestacados(mudaram);
                setAvisoAoVivo(mudaram.size > 0 ? `Atualizado agora · ${mudaram.size} lead(s) alterado(s)` : 'Atualizado agora');
                return novos;
            });
        } catch {
            // silencioso
        }
    });
    useEffect(() => {
        if (!avisoAoVivo) return;
        const t = setTimeout(() => {
            setAvisoAoVivo(null);
            setDestacados(new Set());
        }, 3000);
        return () => clearTimeout(t);
    }, [avisoAoVivo]);
```

Import: `import { useVersaoGrcc } from '@/hooks/useVersaoGrcc';`.

Na linha da tabela (`<tr key={lead.id} className={\`transition-colors ${T.rowHover}\`}>`), acrescente o destaque:

```tsx
<tr key={lead.id} className={`transition-colors ${T.rowHover} ${destacados.has(lead.id) ? 'bg-indigo-500/10' : ''}`}>
```

E, como último filho do `<div className="flex flex-col gap-6 h-full pb-10">` principal:

```tsx
            {avisoAoVivo && (
                <div role="status" className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-indigo-500/40 text-indigo-200 text-sm px-4 py-2.5 rounded-xl shadow-xl">
                    {avisoAoVivo}
                </div>
            )}
```

- [ ] **Step 3: Rodar**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Verificação manual (duas janelas)** — `npm run dev`; janela A no dashboard na aba Cidades com um
filtro de UF aplicado; janela B em `/grcc`. Mudar o valor de um lead em B → A atualiza na hora (mesmo navegador),
mantém o filtro, mostra "Atualizado agora · 1 lead(s) alterado(s)" e a linha destacada. Repetir com A num navegador
anônimo → atualiza em até ~15 s. Trocar A para a Débora (visão do gerente) → barras/projetos refletem a categoria
nova.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardShell.tsx src/components/cidades/CidadesView.tsx
git commit -m "feat(grcc): dashboard e aba Cidades atualizam ao vivo sem perder filtros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Aba Cidades — origem dos dados, botão, detalhe do lead e estado vazio

**Files:**
- Create: `src/components/cidades/LeadDetalheLeitura.tsx`, `src/components/cidades/LeadDetalheLeitura.test.tsx`
- Modify: `src/components/cidades/CidadesView.tsx` (cabeçalho ~linha 486, tabela ~1141, estado vazio)

**Interfaces:**
- Consumes: `historicoDoLead`, `ultimoImportGrcc`, `movimentacoesRecentes` (Task 8), `LeadHistorico` (Task 11),
  `MovimentacoesRecentes` (Task 10), `dataHoraBr` (Task 10).
- Produces: `LeadDetalheLeitura({ lead: LeadCidade | null; onFechar: () => void; claro: boolean })`.

- [ ] **Step 1: Teste** — `src/components/cidades/LeadDetalheLeitura.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/services/grcc.service', () => ({
    historicoDoLead: vi.fn().mockResolvedValue([
        { id: 1, leadId: 9, quando: '2026-10-20T10:00:00Z', origem: 'edicao', arquivo: null, autor: 'GRCC', mudancas: [{ campo: 'categoria', de: 'Validação', para: 'No cliente' }] },
    ]),
}));
const { LeadDetalheLeitura } = await import('./LeadDetalheLeitura');

describe('LeadDetalheLeitura', () => {
    it('mostra dados e linha do tempo, sem botões de edição', async () => {
        render(
            <LeadDetalheLeitura
                claro={false}
                onFechar={() => {}}
                lead={{ id: 9, cliente: 'ALESP', solicitacao: 'Chatbot', status: 'Proposta', categoria: 'No cliente', valor: 10, uf: 'SP', municipio: 'São Paulo', contato_nome: 'Fabio' }}
            />
        );
        expect(screen.getByText('ALESP')).toBeInTheDocument();
        expect(screen.getByText('Fabio')).toBeInTheDocument();
        expect(await screen.findByText('No cliente', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Salvar|Excluir/ })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/cidades/LeadDetalheLeitura.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Criar `src/components/cidades/LeadDetalheLeitura.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { historicoDoLead } from '@/services/grcc.service';
import { LeadHistorico } from '@/app/grcc/components/LeadHistorico';
import { brl, dataBr } from '@/app/grcc/components/formato';
import type { EventoHistorico } from '@/lib/grcc/tipos';
import type { LeadCidade } from '@/types/cidades';

export function LeadDetalheLeitura({ lead, onFechar, claro }: { lead: LeadCidade | null; onFechar: () => void; claro: boolean }) {
    const [eventos, setEventos] = useState<EventoHistorico[]>([]);

    useEffect(() => {
        setEventos([]);
        if (lead) historicoDoLead(lead.id).then(setEventos).catch(() => setEventos([]));
    }, [lead]);

    const linha = (rotulo: string, valor?: string | null) =>
        valor ? (
            <div className="flex justify-between gap-4 text-sm py-1">
                <span className={claro ? 'text-zinc-500' : 'text-zinc-400'}>{rotulo}</span>
                <span className={`text-right ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{valor}</span>
            </div>
        ) : null;

    return (
        <Sheet open={!!lead} onOpenChange={(o) => !o && onFechar()}>
            <SheetContent side="right" className={`w-full sm:max-w-lg overflow-y-auto ${claro ? 'bg-white text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'}`}>
                {lead && (
                    <>
                        <SheetHeader>
                            <SheetTitle className={claro ? 'text-zinc-900' : 'text-zinc-100'}>{lead.cliente}</SheetTitle>
                            <SheetDescription>{lead.solicitacao}</SheetDescription>
                        </SheetHeader>
                        <div className="px-4 flex flex-col divide-y divide-zinc-800/40">
                            {linha('Categoria', lead.categoria)}
                            {linha('Etapa', lead.etapa_padrao)}
                            {linha('Andamento', lead.status)}
                            {linha('Valor', lead.valor ? brl(lead.valor) : null)}
                            {linha('Previsão', lead.previsao_fechamento ? dataBr(lead.previsao_fechamento) : null)}
                            {linha('Local', [lead.municipio, lead.uf].filter(Boolean).join(' · '))}
                            {linha('Motivo da perda', lead.motivo_padrao)}
                            {linha('Contato', lead.contato_nome)}
                            {linha('E-mail', lead.contato_email)}
                            {linha('Telefone', lead.contato_telefone)}
                        </div>
                        <div className="p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Histórico</h3>
                            <LeadHistorico eventos={eventos} claro={claro} />
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
```

- [ ] **Step 4: Ligar na `CidadesView`**
  1. Estado e carga do último import (junto dos outros `useState`):

```tsx
    const [leadAberto, setLeadAberto] = useState<LeadCidade | null>(null);
    const [ultimoImport, setUltimoImport] = useState<UltimoImport | null>(null);
    const [movimentos, setMovimentos] = useState<Movimentacao[]>([]);
    const carregarOrigem = async () => {
        try {
            const [u, m] = await Promise.all([ultimoImportGrcc(), movimentacoesRecentes(8)]);
            setUltimoImport(u);
            setMovimentos(m);
        } catch {}
    };
    useEffect(() => {
        carregarOrigem();
    }, []);
```

     Imports: `import { ultimoImportGrcc, movimentacoesRecentes } from '@/services/grcc.service';`,
     `import type { Movimentacao, UltimoImport } from '@/lib/grcc/tipos';`,
     `import { LeadDetalheLeitura } from './LeadDetalheLeitura';`,
     `import { MovimentacoesRecentes } from '@/app/grcc/components/MovimentacoesRecentes';`,
     `import { dataHoraBr } from '@/app/grcc/components/formato';`, `Pencil` em `lucide-react`.
     Dentro do callback de `useVersaoGrcc` (Task 15), chame `carregarOrigem();` depois de `setLeads`.
  2. Hora da última carga: adicione `const [carregadoEm, setCarregadoEm] = useState<string | null>(null);` e chame
     `setCarregadoEm(new Date().toISOString())` logo após `setLeads(data)` em `loadData` e após `setLeads(...)` no
     callback ao vivo da Task 15. No cabeçalho, abaixo do subtítulo "Monitoramento de oportunidades…":

```tsx
                        <p className={`text-[11px] mt-1 ${T.subtext}`}>
                            Fonte: cadastro da GRCC
                            {ultimoImport && ` · último import: ${ultimoImport.arquivo} (${dataHoraBr(ultimoImport.quando)})`}
                            {carregadoEm && ` · atualizado em ${dataHoraBr(carregadoEm)}`}
                        </p>
```
  3. Antes do botão de atualizar (ícone `RefreshCw`), o botão discreto:

```tsx
                    <a
                        href="/grcc"
                        title="Gerenciar leads (GRCC)"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${T.tabInactive}`}
                    >
                        <Pencil className="w-3.5 h-3.5" /> Gerenciar leads
                    </a>
```

  4. Linha da tabela abre o detalhe: no `<tr key={lead.id} ...>` acrescente `onClick={() => setLeadAberto(lead)}` e
     `cursor-pointer` na classe.
  5. Movimentações recentes em leitura — no topo da aba "Dashboard", antes da linha de KPIs, só quando há
     movimentos:

```tsx
                    {movimentos.length > 0 && (
                        <div className={`border rounded-2xl p-4 ${T.panelSoft}`}>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${T.subtext}`}>Movimentações recentes</h3>
                            <MovimentacoesRecentes
                                itens={movimentos}
                                claro={lightActive}
                                onAbrir={(id) => setLeadAberto(leads.find((l) => l.id === id) ?? null)}
                            />
                        </div>
                    )}
```

  6. Estado vazio — antes do `return (` principal, depois do bloco `if (error)`:

```tsx
    if (leads.length === 0) {
        return (
            <div className={`h-[400px] w-full flex flex-col items-center justify-center gap-3 border rounded-2xl p-6 text-center ${T.panel}`}>
                <Building2 className="w-10 h-10 text-indigo-400" />
                <h3 className={`text-lg font-bold ${T.heading}`}>Nenhum lead cadastrado ainda</h3>
                <p className={`text-sm ${T.subtext}`}>Os leads da GRCC são cadastrados e importados na página da GRCC.</p>
                <a href="/grcc" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold">
                    Ir para /grcc
                </a>
            </div>
        );
    }
```

     **Atenção às regras de hooks:** este `if` precisa vir depois de **todos** os `useState`/`useMemo`/`useEffect` do
     componente (os `if (isLoading)`/`if (error)` existentes já estão nessa posição — coloque o novo logo abaixo
     deles).
  7. Antes do fechamento do `<div>` principal: `<LeadDetalheLeitura lead={leadAberto} onFechar={() => setLeadAberto(null)} claro={lightActive} />`

- [ ] **Step 5: Rodar**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo PASS; build sem erros (o build pega exportações síncronas indevidas em arquivos `'use server'`).

- [ ] **Step 6: Verificação manual** — aba Cidades: cabeçalho com "Fonte: cadastro da GRCC · último import… ·
atualizado em…"; botão "Gerenciar leads" leva a `/grcc`; clicar numa linha abre o detalhe com histórico; com banco
sem leads, aparece o estado vazio; tema claro legível.

- [ ] **Step 7: Commit**

```bash
git add src/components/cidades
git commit -m "feat(grcc): aba Cidades mostra origem, botao de gestao, detalhe com historico e estado vazio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Implantação (dev → produção) e documentação

**Files:**
- Modify: `CLAUDE.md` (seção nova curta), `DRM_API_DOCS.md` (já tocado na Task 7)

Esta task é **operacional** e mexe em bancos compartilhados — cada passo marcado com ⚠ exige confirmação explícita do
usuário antes de rodar.

- [ ] **Step 1: Documentar no `CLAUDE.md`** — acrescente, depois da seção de "UI structure":

```markdown
### Leads da GRCC (`/grcc`)

Spec `docs/superpowers/specs/2026-10-22-grcc-leads-design.md`. Os leads da GRCC (gerência da Débora) vivem em
`lead_grcc` (+ `lead_grcc_historico`, somente acréscimo) e são editados em `/grcc` (chave `GRCC_KEY`, conferida no
servidor em toda action de `src/app/grcc/actions.ts`). Toda escrita passa por `salvarLeadGrcc`/`excluirLeadGrcc`/
`aplicarImportGrcc` em `queries.ts`, que numa transação gravam lead + histórico + **projeto gerado no pipeline da
Débora** (`projects.lead_grcc_id`) + `grcc_versao`. Projetos com `leadGrccId` não são editáveis no Settings nem pela
API externa. A aba Cidades lê `lead_grcc` (`fetchCidadesLeads`); dashboard e Cidades atualizam ao vivo via
`useVersaoGrcc` (checagem de `grcc_versao` a cada 15 s + `BroadcastChannel('grcc')`). Regras puras em
`src/lib/grcc/`. Não há mais Power Automate na aba Cidades.
```

- [ ] **Step 2: Suíte completa e build**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo verde. Cole a saída no resumo para o usuário.

- [ ] **Step 3: ⚠ Migração no banco de dev** — confirme com o usuário qual banco `.env.development` aponta (é
compartilhado). Depois:

Run: `npm run db:migrate`
Expected: `✓ applied 0013_lead_grcc.sql`.

- [ ] **Step 4: ⚠ Ensaio da primeira importação no dev** — `npm run dev`, `/grcc`, importar a planilha real,
confirmar o cutover. Conferir: aba Cidades com ~131 leads; visão da Débora com o pipeline gerado; números da DRM
mudaram de forma explicável (antes: 10 quentes R$ 27,7 mi + 30 mornos R$ 0). Registrar antes/depois do forecast da
Débora para o usuário.

- [ ] **Step 5: ⚠ Produção (só com aprovação do usuário)**
  1. Usuário configura `GRCC_KEY` na Vercel (Production + Preview).
  2. Backup: `npm run db:sync-prod` (puxa prod para local) ou snapshot no painel do Turso.
  3. `NODE_ENV=production npm run db:migrate` com o `.env.production.local` apontando para prod.
  4. Merge/deploy da branch.
  5. Débora faz a primeira importação em produção (com o cutover) e confere.
  6. Desligar o fluxo antigo do Power Automate (o da aba Cidades) — a URL saiu do código, mas o fluxo e a assinatura
     continuam válidos até serem desativados; recomende ao usuário revogar/regenerar a assinatura `sig`, já que ela
     esteve exposta no bundle do navegador.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta o cadastro de leads da GRCC no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
