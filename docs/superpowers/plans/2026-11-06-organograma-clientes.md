# Organograma de clientes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar para o dashboard de produção o organograma de clientes do AIBertinho: carteira de clientes por gerência, mover cliente levando contratos/propostas/CX/projetos, admin em `/settings`, leitura no dashboard.

**Architecture:** Tabelas novas `cliente`, `carteira_cliente`, `movimento_carteira` e coluna `cliente_id` em `contrato`/`proposta`/`cx`/`projects`. Gerência = card `managers` agrupado pela chave da sigla (`GRC4`). Regras puras em `src/lib/carteira/`, banco em `src/db/carteira.ts`, actions com `SETTINGS_KEY` conferida no servidor em `src/app/settings/carteiraActions.ts`, telas em `src/components/organograma-clientes/`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Drizzle ORM + LibSQL/Turso, zod 4, Tailwind 4, Radix (`radix-ui`), vitest 5 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-organograma-clientes-design.md` (decisões D1–D14).

## Global Constraints

- Repositório `C:\projeto\dashboard\dashboard-organograma` (worktree), branch `feat/organograma-clientes`, base `origin/main` `6193fff`. Nunca mexer na branch `login`.
- Nada roda contra o Turso de produção sem pedido explícito do usuário (migração e carga incluídas). Testes usam SQLite em memória/arquivo temporário.
- Migração nova: `src/db/migrations/0017_carteira_clientes.sql`. Cada comando termina em `;` + quebra de linha (é o separador de `migrate.ts` e `test-utils.ts`).
- Textos de tela em pt-BR, copiados do AIBertinho quando existem.
- Só o admin muda a carteira; toda action que grava confere a `SETTINGS_KEY` no servidor (`chaveSettingsValida`).
- Projeto com `lead_grcc_id` nunca muda de gerente nem ganha `cliente_id`.
- `served_clients` não é mais gravado nem lido (coluna fica no banco).
- Teste que exercita `db.transaction()` usa `createTransactionSafeTestDb()` (uma vez por arquivo, imports dinâmicos depois dela). Teste de componente começa com `// @vitest-environment jsdom`.
- Comandos: `npx vitest run <arquivo>`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/integracao/chaves.ts` (+test) | cópia idêntica da branch `login`: `siglaComparavel`, `mesmaSigla`, `chaveDaGerencia`, `clienteAtendido`, `citaSigla` |
| `src/lib/carteira/tipos.ts` | `ErroCarteira`, `Resultado`, `AVISO_LEVA_TUDO`, `MUDOU_ENQUANTO_OLHAVA`, tipos compartilhados |
| `src/lib/carteira/gerencia.ts` (+test) | `chaveDaCarteira`, `textoDaGerencia`, `cardDaGerencia`, `chavesDosCards` |
| `src/lib/carteira/casar-cliente.ts` (+test) | `casarCliente`, `clienteDoServedClient` |
| `src/lib/carteira/organograma-clientes.ts` (+test) | `grupoDaGerencia`, `montarOrganograma`, `nomeDoCartao`, `rotuloDoDestino` (cópia do AIBertinho) |
| `src/lib/settings/chave.ts` (+test) | `chaveSettingsValida` |
| `src/db/migrations/0017_carteira_clientes.sql` | tabelas e colunas |
| `src/db/schema.ts` | `cliente`, `carteiraCliente`, `movimentoCarteira`, `clienteId` ×4 |
| `src/db/carteira.ts` (+tests) | leitura, mover, levar dados, admin de gerência/cliente, a conferir, `managerDaLinha` |
| `src/db/carteira-seed.ts` (+test) + `scripts/carteira/seed-carteira.ts` | carga inicial |
| `src/app/settings/carteiraActions.ts` (+test) | Server Actions do organograma |
| `src/app/settings/chaveLocal.ts` | lê a chave do `localStorage` no cliente |
| `src/components/ui/{dropdown-menu,popover,combobox,confirm-dialog,notice}.tsx` | peças de UI |
| `src/components/organograma-clientes/*.tsx` (+test) | quadro, cartão, item, admin, editor, a conferir, abas |
| modificados | `settings/actions.ts`, `orgChartActions.ts`, `SettingsDashboard.tsx`, `ManagerEditor.tsx`, `OrgChartEditor.tsx`, `FaturamentoEditor.tsx`, `db/queries.ts`, `types/manager.ts`, `lib/planner-sync.ts`, `contracts/actions.ts`, `proposals/actions.ts`, `ContractModal.tsx`, `ProposalModal.tsx`, API `grc/{cx,projects,sync}`, `DashboardShell.tsx` |

O spec cita "`src/db/queries.ts` (seção Carteira)"; o plano usa `src/db/carteira.ts` para não crescer o `queries.ts` (1017 linhas). Mesma camada, mesmo papel.

---

### Task 1: Instalar dependências e conferir a base

**Files:** nenhum

- [ ] **Step 1:** `cd C:\projeto\dashboard\dashboard-organograma && npm ci --no-audit --no-fund`
- [ ] **Step 2:** `npx vitest run` — Expected: todos passam (base verde). Anote a contagem; se algo falhar já na base, pare e reporte.
- [ ] **Step 3:** `npx tsc --noEmit` — Expected: sem erro.

---

### Task 2: Chaves de casamento (cópia da `login`)

**Files:**
- Create: `src/lib/integracao/chaves.ts`, `src/lib/integracao/chaves.test.ts`

**Interfaces — Produces:** `siglaComparavel(texto: string): string`, `mesmaSigla(a?: string|null, b?: string|null): boolean`, `chaveDaGerencia(texto?: string|null): string|null`, `clienteAtendido(texto: string): { sigla: string; nome: string|null }`, `citaSigla(texto: string|null|undefined, sigla: string): boolean`.

- [ ] **Step 1: Copiar teste e código da branch `login`, sem alterar**

```bash
git show login:src/lib/integracao/chaves.test.ts > src/lib/integracao/chaves.test.ts
git show login:src/lib/integracao/chaves.ts > src/lib/integracao/chaves.ts
```

- [ ] **Step 2:** `npx vitest run src/lib/integracao/chaves.test.ts` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/lib/integracao/chaves.ts src/lib/integracao/chaves.test.ts
git commit -m "feat(carteira): chaves de casamento de cliente e gerencia (copia da branch login)"
```

---

### Task 3: Banco — migração 0017 e schema

**Files:**
- Create: `src/db/migrations/0017_carteira_clientes.sql`, `src/db/carteira.schema.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces — Produces:** tabelas Drizzle `cliente`, `carteiraCliente`, `movimentoCarteira`; colunas `clienteId` em `contrato`, `proposta`, `cx`, `projects`.

- [ ] **Step 1: Teste que falha**

```ts
// src/db/carteira.schema.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';

beforeAll(applyMigrations);

const colunas = async (t: string) => (await db.$client.execute(`pragma table_info(${t})`)).rows.map((r) => String(r.name));

describe('migração 0017_carteira_clientes', () => {
    it('cria cliente, carteira_cliente e movimento_carteira', async () => {
        expect(await colunas('cliente')).toEqual(['id', 'nome', 'sigla', 'ativo', 'created_at']);
        expect(await colunas('carteira_cliente')).toEqual(['cliente_id', 'gerencia', 'movido_em', 'movido_por']);
        expect(await colunas('movimento_carteira')).toEqual(['id', 'cliente_id', 'de_gerencia', 'para_gerencia', 'por', 'em']);
    });
    it.each(['contrato', 'proposta', 'cx', 'projects'])('%s ganha cliente_id', async (t) => {
        expect(await colunas(t)).toContain('cliente_id');
    });
});
```

- [ ] **Step 2:** `npx vitest run src/db/carteira.schema.test.ts` — Expected: FAIL (`no such table: cliente` / lista vazia).

- [ ] **Step 3: Migração**

```sql
-- src/db/migrations/0017_carteira_clientes.sql
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
```

- [ ] **Step 4: Schema** — em `src/db/schema.ts`, depois de `managers`, acrescente:

```ts
// Carteira de clientes (spec 2026-11-06-organograma-clientes-design.md §3). A gerência é a CHAVE da sigla
// do card (`GRC4`), não o id do card, que muda a cada ano.
export const cliente = sqliteTable('cliente', {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    sigla: text('sigla'),
    // false = oculto no organograma (continua na carteira; os dados seguem a gerência).
    ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const carteiraCliente = sqliteTable('carteira_cliente', {
    clienteId: text('cliente_id').primaryKey().references(() => cliente.id, { onDelete: 'cascade' }),
    gerencia: text('gerencia').notNull(),
    movidoEm: text('movido_em').notNull(),
    movidoPor: text('movido_por'),
});

export const movimentoCarteira = sqliteTable('movimento_carteira', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: text('cliente_id').notNull().references(() => cliente.id, { onDelete: 'cascade' }),
    deGerencia: text('de_gerencia'),
    paraGerencia: text('para_gerencia'),
    por: text('por'),
    em: text('em').notNull(),
});
```

E em `projects`, `cx`, `contrato` e `proposta`, como última coluna de cada um:

```ts
    clienteId: text('cliente_id').references(() => cliente.id, { onDelete: 'set null' }),
```

- [ ] **Step 5:** `npx vitest run src/db/carteira.schema.test.ts` — Expected: PASS. Depois `npx vitest run` — Expected: tudo verde (nenhum teste antigo quebra com colunas novas nulas).
- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0017_carteira_clientes.sql src/db/schema.ts src/db/carteira.schema.test.ts
git commit -m "feat(carteira): migracao 0017 com cliente, carteira_cliente, movimento_carteira e cliente_id"
```

---

### Task 4: Regras puras — tipos, gerência e casamento de cliente

**Files:**
- Create: `src/lib/carteira/tipos.ts`, `src/lib/carteira/gerencia.ts`, `src/lib/carteira/gerencia.test.ts`, `src/lib/carteira/casar-cliente.ts`, `src/lib/carteira/casar-cliente.test.ts`

**Interfaces — Consumes:** Task 2. **Produces:**
- `tipos.ts`: `class ErroCarteira extends Error`, `type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }`, `AVISO_LEVA_TUDO: string`, `MUDOU_ENQUANTO_OLHAVA: string`, `JUSTIFICATIVA_TROCA: string`, `interface CardGerencia { id: string; name: string; role: string; year: number; showInDashboard: boolean }`.
- `gerencia.ts`: `chaveDaCarteira(card: {id: string; role: string}): string`, `textoDaGerencia(chave: string): string`, `cardDaGerencia<T extends CardGerencia>(cards: T[], chave: string): T | null`, `chavesDosCards(cards: CardGerencia[]): string[]`.
- `casar-cliente.ts`: `interface ClienteParaCasar { id: string; nome: string; sigla: string | null; gerencia: string | null }`, `casarCliente(texto: string|null|undefined, clientes: ClienteParaCasar[], gerencia?: string|null): string | null`, `clienteDoServedClient(texto: string): { nome: string; sigla: string | null }`.

- [ ] **Step 1: Testes que falham**

```ts
// src/lib/carteira/gerencia.test.ts
import { describe, it, expect } from 'vitest';
import { cardDaGerencia, chaveDaCarteira, chavesDosCards, textoDaGerencia } from './gerencia';

const card = (id: string, role: string, year = 2026, showInDashboard = true) => ({ id, name: id, role, year, showInDashboard });

describe('chaveDaCarteira', () => {
    it.each([
        [card('grc1-bruno', 'GRC1'), 'GRC1'],
        [card('grcc-debora', 'GRCC'), 'GRCC'],
        [card('kam3-gercino-teste', 'KAM10'), 'KAM10'],
        [card('x', 'GRC-4'), 'GRC4'],
        [card('projeto-triade', 'Tríade Digital'), 'Tríade Digital'],
    ])('%o → %s', (c, chave) => expect(chaveDaCarteira(c)).toBe(chave));
});

describe('textoDaGerencia', () => {
    it.each([['GRC1', 'GRC-1'], ['GRCC', 'GRC-C'], ['KAM4', 'KAM-4'], ['KAM10', 'KAM-10'], ['Tríade Digital', 'Tríade Digital']])(
        '%s → %s', (chave, texto) => expect(textoDaGerencia(chave)).toBe(texto));
});

describe('cardDaGerencia', () => {
    it('maior ano; no ano, o visível; senão o primeiro por id', () => {
        const cards = [card('grc4-velha', 'GRC4', 2025), card('grc4-b', 'GRC4', 2026, false), card('grc4-a', 'GRC4', 2026, false), card('grc4-beatriz', 'GRC4', 2026)];
        expect(cardDaGerencia(cards, 'GRC4')?.id).toBe('grc4-beatriz');
        expect(cardDaGerencia(cards.slice(0, 3), 'GRC4')?.id).toBe('grc4-a');
        expect(cardDaGerencia(cards, 'GRC9')).toBeNull();
    });
    it('chavesDosCards: uma por gerência, sem repetir', () => {
        expect(chavesDosCards([card('a', 'GRC1'), card('b', 'GRC1', 2025), card('c', 'KAM2')])).toEqual(['GRC1', 'KAM2']);
    });
});
```

```ts
// src/lib/carteira/casar-cliente.test.ts
import { describe, it, expect } from 'vitest';
import { casarCliente, clienteDoServedClient } from './casar-cliente';

const clientes = [
    { id: 'pgm', nome: 'Procuradoria Geral do Município', sigla: 'PGM', gerencia: 'GRC1' },
    { id: 'seges', nome: 'Secretaria de Gestão', sigla: 'SEGES', gerencia: 'KAM3' },
    { id: 'ouv', nome: 'Ouvidoria Geral do Município', sigla: null, gerencia: 'GRC4' },
    { id: 'sme', nome: 'Secretaria Municipal da Educação', sigla: 'SME', gerencia: 'KAM1' },
];

describe('casarCliente', () => {
    it('casa sigla igual, sigla citada em maiúsculas e nome por extenso', () => {
        expect(casarCliente('pgm', clientes)).toBe('pgm');
        expect(casarCliente('Procuradoria Geral do Município - PGM', clientes)).toBe('pgm');
        expect(casarCliente('Ouvidoria Geral do Municipio', clientes)).toBe('ouv');
    });
    it('não casa o que não é único nem texto vazio', () => {
        expect(casarCliente('SEGES e SME', clientes)).toBeNull();
        expect(casarCliente('', clientes)).toBeNull();
        expect(casarCliente(null, clientes)).toBeNull();
        expect(casarCliente('Prefeitura de Valinhos', clientes)).toBeNull();
    });
    it('primeiro procura na carteira da gerência da linha', () => {
        expect(casarCliente('SEGES e SME', clientes, 'KAM1')).toBe('sme');
    });
});

describe('clienteDoServedClient', () => {
    it('lê o formato do served_clients', () => {
        expect(clienteDoServedClient('SMIT (Secretaria Municipal de Inovação e Tecnologia)')).toEqual({ sigla: 'SMIT', nome: 'Secretaria Municipal de Inovação e Tecnologia' });
        expect(clienteDoServedClient('SGM - Secretaria do Governo Municipal')).toEqual({ sigla: 'SGM', nome: 'Secretaria do Governo Municipal' });
        expect(clienteDoServedClient('Ouvidoria Geral do Município')).toEqual({ sigla: null, nome: 'Ouvidoria Geral do Município' });
        expect(clienteDoServedClient('ALESP')).toEqual({ sigla: 'ALESP', nome: 'ALESP' });
    });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/carteira` — Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementação**

```ts
// src/lib/carteira/tipos.ts
// Tipos e textos da carteira de clientes (spec 2026-11-06-organograma-clientes-design.md). Textos copiados do AIBertinho.
export class ErroCarteira extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroCarteira';
    }
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export const AVISO_LEVA_TUDO =
    'Tudo do cliente vai junto para a nova gerência: contratos, propostas, oportunidades do pipeline e cards do CX. A troca fica registrada no histórico.';
export const MUDOU_ENQUANTO_OLHAVA = 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.';
export const JUSTIFICATIVA_TROCA = 'O cliente mudou de carteira';
export const SO_ADMIN = 'Só o administrador move clientes entre carteiras.';

/** O card `managers` visto como gerência. */
export interface CardGerencia {
    id: string;
    name: string;
    role: string;
    year: number;
    showInDashboard: boolean;
}
```

```ts
// src/lib/carteira/gerencia.ts
import { chaveDaGerencia } from '@/lib/integracao/chaves';
import type { CardGerencia } from './tipos';

/** A gerência do card: "GRC1", "GRCC", "KAM10"; fora do padrão GRC/KAM, o próprio role ("Tríade Digital"). */
export function chaveDaCarteira(card: { id: string; role: string }): string {
    return chaveDaGerencia(card.role) ?? chaveDaGerencia(card.id) ?? card.role.trim();
}

/** Formato de `contrato.gerencia`/`proposta.gerencia`: "GRC-1", "GRC-C", "KAM-4". */
export function textoDaGerencia(chave: string): string {
    const m = /^(GRC|KAM)([A-Z0-9]{1,2})$/.exec(chave);
    return m ? `${m[1]}-${m[2]}` : chave;
}

/** = `cardDaGerencia` do AIBertinho: os cards do maior ano; desses, o visível; senão o primeiro por id. */
export function cardDaGerencia<T extends CardGerencia>(cards: T[], chave: string): T | null {
    const daChave = cards.filter((c) => chaveDaCarteira(c) === chave);
    if (daChave.length === 0) return null;
    const ano = Math.max(...daChave.map((c) => c.year));
    const doAno = daChave.filter((c) => c.year === ano).sort((a, b) => a.id.localeCompare(b.id));
    return doAno.find((c) => c.showInDashboard) ?? doAno[0];
}

export function chavesDosCards(cards: CardGerencia[]): string[] {
    return [...new Set(cards.map(chaveDaCarteira))];
}
```

```ts
// src/lib/carteira/casar-cliente.ts
// Regra `clienteCitado` (src/lib/integracao/feed.ts da branch login): sigla igual, sigla citada em maiúsculas ou nome
// por extenso igual. Só vale quando o cliente achado é ÚNICO; primeiro entre os da gerência da linha.
import { citaSigla, clienteAtendido, mesmaSigla } from '@/lib/integracao/chaves';

export interface ClienteParaCasar {
    id: string;
    nome: string;
    sigla: string | null;
    gerencia: string | null;
}

function casa(texto: string, c: ClienteParaCasar): boolean {
    if (c.sigla && (mesmaSigla(texto, c.sigla) || citaSigla(texto, c.sigla))) return true;
    return mesmaSigla(texto, c.nome);
}

function unico(texto: string, lista: ClienteParaCasar[]): string | null {
    const ids = new Set(lista.filter((c) => casa(texto, c)).map((c) => c.id));
    return ids.size === 1 ? [...ids][0] : null;
}

export function casarCliente(texto: string | null | undefined, clientes: ClienteParaCasar[], gerencia?: string | null): string | null {
    const t = texto?.trim();
    if (!t) return null;
    if (gerencia) {
        const daGerencia = unico(t, clientes.filter((c) => c.gerencia === gerencia));
        if (daGerencia) return daGerencia;
    }
    return unico(t, clientes);
}

/** Item do `served_clients` → cliente. Sem nome ("Ouvidoria Geral do Município") a sigla só fica se for uma palavra em maiúsculas. */
export function clienteDoServedClient(texto: string): { nome: string; sigla: string | null } {
    const { sigla, nome } = clienteAtendido(texto);
    if (nome) return { sigla, nome };
    const pareceSigla = /^\S+$/.test(sigla) && sigla === sigla.toUpperCase();
    return { sigla: pareceSigla ? sigla : null, nome: sigla };
}
```

- [ ] **Step 4:** `npx vitest run src/lib/carteira` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/carteira
git commit -m "feat(carteira): regras puras de gerencia (chave, texto, card do ano) e casamento de cliente"
```

---

### Task 5: Montagem do organograma (cópia do AIBertinho)

**Files:**
- Create: `src/lib/carteira/organograma-clientes.ts`, `src/lib/carteira/organograma-clientes.test.ts`

**Interfaces — Consumes:** `chaveDaGerencia`. **Produces:** `type GrupoDaGerencia = 'kam'|'grc'|'grcc'|'gerente'`, `ROTULO_DO_GRUPO`, `ORDEM_DOS_GRUPOS`, `COR_DO_GRUPO`, `CABECALHO_DO_GRUPO`, `interface ClienteDoOrganograma { id; nome; sigla: string|null; ultimoMovimento: { em: string } | null }`, `interface GerenciaDoOrganograma { id; nome; sigla: string|null; ativa: boolean; gerentes: string[]; clientes: ClienteDoOrganograma[] }`, `interface CartaoDoOrganograma extends GerenciaDoOrganograma { grupo; rotuloCargo }`, `interface OrganogramaClientes { colunas; cartoes; semCarteira; totais }`, `grupoDaGerencia`, `montarOrganograma(gerencias, semCarteira)`, `nomeDoCartao`, `rotuloDoDestino`.

No dashboard: `id` = chave da gerência, `nome` = chave, `sigla` = chave, `gerentes` = `[card.name]`.

- [ ] **Step 1: Teste (cópia de `aibertinho/src/modulos/gerencias/regras/organograma-clientes.test.ts`, ajustado)**

```ts
// src/lib/carteira/organograma-clientes.test.ts
import { describe, expect, it } from 'vitest';
import { grupoDaGerencia, montarOrganograma, nomeDoCartao, rotuloDoDestino, type GerenciaDoOrganograma } from './organograma-clientes';

const cli = (id: string, sigla: string | null = id) => ({ id, nome: `Órgão ${id}`, sigla, ultimoMovimento: null });
const ger = (id: string, sigla: string | null, gerentes: string[], clientes: string[], ativa = true): GerenciaDoOrganograma => ({
    id, nome: `Gerência ${id}`, sigla, ativa, gerentes, clientes: clientes.map((c) => cli(c)),
});

describe('grupoDaGerencia', () => {
    it.each([
        [{ sigla: 'KAM2', nome: 'x' }, 'kam', 2],
        [{ sigla: 'GRC 4', nome: 'x' }, 'grc', 4],
        [{ sigla: 'GRC-C', nome: 'x' }, 'grcc', null],
        [{ sigla: 'GRCC', nome: 'x' }, 'grcc', null],
        [{ sigla: null, nome: 'KAM 3 Saúde' }, 'kam', 3],
        [{ sigla: 'DIR', nome: 'Diretoria' }, 'gerente', null],
        [{ sigla: null, nome: 'Tríade' }, 'gerente', null],
    ])('%o → %s %s', (g, grupo, numero) => expect(grupoDaGerencia(g)).toEqual({ grupo, numero }));
});

describe('montarOrganograma', () => {
    const gerencias = [
        ger('ac', null, ['Alberto Campos'], ['SMCC', 'SGM']),
        ger('grc3', 'GRC3', ['Barone'], ['SMT', 'COHAB']),
        ger('kam2', 'KAM2', ['Betone'], ['SMS']),
        ger('grcc', 'GRCC', ['Débora'], ['ICI', 'ALESP']),
        ger('grc1', 'GRC1', ['Bruno Ítalo'], ['PGM']),
        ger('kam1', 'KAM1', ['Malde'], ['SME']),
        ger('velha', 'GRC9', ['Ninguém'], [], false),
        ger('velha2', 'GRC8', [], ['SEHAB'], false),
    ];

    it('colunas: KAM empilhados, uma por GRC, GRCC + gerente no fim', () => {
        const o = montarOrganograma(gerencias, []);
        expect(o.colunas.map((col) => col.map((c) => c.id))).toEqual([['kam1', 'kam2'], ['grc1'], ['grc3'], ['velha2'], ['grcc', 'ac']]);
    });
    it('tira a oculta vazia, mantém a oculta com cliente e ordena clientes pela sigla', () => {
        const o = montarOrganograma(gerencias, []);
        expect(o.cartoes.map((c) => c.id)).not.toContain('velha');
        expect(o.cartoes.find((c) => c.id === 'grc3')!.clientes.map((c) => c.sigla)).toEqual(['COHAB', 'SMT']);
        expect(o.cartoes.find((c) => c.id === 'ac')!.rotuloCargo).toBe('Gerente');
    });
    it('totais contam só quem tem cliente', () => {
        const o = montarOrganograma([...gerencias, ger('vazia', 'KAM4', ['Tomiatto'], [])], [cli('SMC')]);
        expect(o.totais).toEqual({ gerencias: 7, orgaosAtendidos: 10, maiorCarteira: { nome: 'Barone', clientes: 2 } });
        expect(o.semCarteira.map((c) => c.sigla)).toEqual(['SMC']);
    });
    it('sem nada', () => {
        expect(montarOrganograma([], [])).toMatchObject({ colunas: [], totais: { gerencias: 0, orgaosAtendidos: 0, maiorCarteira: null } });
    });
});

describe('rótulos', () => {
    it('nomeDoCartao', () => {
        expect(nomeDoCartao({ gerentes: [], nome: 'GRC 5' })).toBe('GRC 5');
        expect(nomeDoCartao({ gerentes: ['Ana', 'Beto', 'Caio'], nome: 'x' })).toBe('Ana, Beto e Caio');
    });
    it('rotuloDoDestino', () => {
        expect(rotuloDoDestino({ sigla: 'GRC4', nome: 'x' })).toBe('GRC4');
        expect(rotuloDoDestino({ sigla: null, nome: 'Gerência' })).toBe('Gerência');
        expect(rotuloDoDestino(null)).toBe('Sem carteira');
    });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/carteira/organograma-clientes.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação** — copie `C:\projeto\aibertinho\src\modulos\gerencias\regras\organograma-clientes.ts` para `src/lib/carteira/organograma-clientes.ts` e faça só estas trocas:
  1. `import { chaveDaGerencia } from '@/nucleo/formato/chaves'` → `import { chaveDaGerencia } from '@/lib/integracao/chaves'`.
  2. `ClienteDoOrganograma.ultimoMovimento` vira `{ em: string } | null` (sem `por`: produção não tem usuário).
  3. `COR_DO_GRUPO` com as cores do organograma de pessoas do dashboard:

```ts
export const COR_DO_GRUPO: Record<GrupoDaGerencia, { faixa: string; texto: string; cabecalho: string; corpo: string }> = {
    kam: { faixa: 'bg-indigo-500', texto: 'text-indigo-400', cabecalho: 'bg-indigo-600 border-indigo-500', corpo: 'border-indigo-900/50' },
    grc: { faixa: 'bg-emerald-500', texto: 'text-emerald-400', cabecalho: 'bg-emerald-600 border-emerald-500', corpo: 'border-emerald-900/50' },
    grcc: { faixa: 'bg-zinc-500', texto: 'text-zinc-400', cabecalho: 'bg-zinc-600 border-zinc-500', corpo: 'border-zinc-700' },
    gerente: { faixa: 'bg-amber-500', texto: 'text-amber-500', cabecalho: 'bg-amber-600 border-amber-500', corpo: 'border-amber-900/50' },
};
```

  Todo o resto (tipos, `ROTULO_DO_GRUPO`, `ORDEM_DOS_GRUPOS`, `CABECALHO_DO_GRUPO`, `grupoDaGerencia`, `comparar`, `porSiglaDoCliente`, `montarOrganograma`, `nomeDoCartao`, `rotuloDoDestino`) fica igual ao original.

- [ ] **Step 4:** `npx vitest run src/lib/carteira/organograma-clientes.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/carteira/organograma-clientes.ts src/lib/carteira/organograma-clientes.test.ts
git commit -m "feat(carteira): montagem do organograma de clientes (copia do AIBertinho)"
```

---

### Task 6: Chave do admin no servidor

**Files:**
- Create: `src/lib/settings/chave.ts`, `src/lib/settings/chave.test.ts`, `src/app/settings/chaveLocal.ts`
- Modify: `src/app/settings/actions.ts:10-18` (`verifySettingsKey`)

**Interfaces — Produces:** `chaveSettingsValida(chave: unknown): boolean`; `lerChaveSettings(): string` (cliente, lê `localStorage['SETTINGS_KEY']`, `''` se não houver).

- [ ] **Step 1: Teste**

```ts
// src/lib/settings/chave.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { chaveSettingsValida } from './chave';

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('chaveSettingsValida', () => {
    it('aceita SETTINGS_KEY, DIRETORIA_KEY e DIRECTORATE_KEY, com trim', () => {
        process.env.SETTINGS_KEY = 'adm';
        process.env.DIRETORIA_KEY = 'dir';
        process.env.DIRECTORATE_KEY = 'dte';
        expect(chaveSettingsValida(' adm ')).toBe(true);
        expect(chaveSettingsValida('dir')).toBe(true);
        expect(chaveSettingsValida('dte')).toBe(true);
        expect(chaveSettingsValida('outra')).toBe(false);
    });
    it('sem SETTINGS_KEY vale o padrão de hoje (prodam2026); não-texto e vazio recusam', () => {
        delete process.env.SETTINGS_KEY;
        delete process.env.DIRETORIA_KEY;
        delete process.env.DIRECTORATE_KEY;
        expect(chaveSettingsValida('prodam2026')).toBe(true);
        expect(chaveSettingsValida('')).toBe(false);
        expect(chaveSettingsValida(undefined)).toBe(false);
        expect(chaveSettingsValida(123)).toBe(false);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/settings/chave.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação**

```ts
// src/lib/settings/chave.ts
/** Confere a chave do admin no servidor (mesma regra do `verifySettingsKey`). O KeyGate só esconde a tela. */
export function chaveSettingsValida(chave: unknown): boolean {
    if (typeof chave !== 'string' || !chave.trim()) return false;
    const t = chave.trim();
    const correta = process.env.SETTINGS_KEY || 'prodam2026';
    const diretoria = process.env.DIRETORIA_KEY;
    const directorate = process.env.DIRECTORATE_KEY;
    return t === correta || (!!diretoria && t === diretoria) || (!!directorate && t === directorate);
}
```

```ts
// src/app/settings/chaveLocal.ts
'use client';
/** A chave que o KeyGate guardou. As actions do /settings conferem no servidor. */
export function lerChaveSettings(): string {
    try {
        return localStorage.getItem('SETTINGS_KEY') ?? '';
    } catch {
        return '';
    }
}
```

Em `src/app/settings/actions.ts`, troque o corpo de `verifySettingsKey` por:

```ts
export async function verifySettingsKey(key: string) {
    return chaveSettingsValida(key);
}
```

com `import { chaveSettingsValida } from '@/lib/settings/chave';` no topo (remova o comentário `// Replace with a safer server-side check-1`).

- [ ] **Step 4:** `npx vitest run src/lib/settings` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/settings src/app/settings/chaveLocal.ts src/app/settings/actions.ts
git commit -m "feat(settings): chaveSettingsValida no servidor"
```

---

### Task 7: Banco da carteira — leitura

**Files:**
- Create: `src/db/carteira.ts`, `src/db/carteira.leitura.test.ts`, `src/db/carteira.test-dados.ts`

**Interfaces — Consumes:** Tasks 3–5. **Produces (em `src/db/carteira.ts`):**
- `type Executor = typeof db | Tx`
- `listarCards(ex?): Promise<CardGerencia[]>`
- `listarClientesComCarteira(ex?): Promise<Array<ClienteParaCasar & { ativo: boolean }>>`
- `clientesAtendidosPorGerencia(ex?): Promise<Map<string, string[]>>` — por chave, `"SIGLA (Nome)"` ou nome, só `ativo`, ordem por nome
- `gerenciaPelaCarteira(clienteId: string|null|undefined, ex?): Promise<{ chave: string; managerId: string; gerencia: string; nomeGerente: string } | null>`
- `managerDaLinha(clienteId: string|null|undefined, managerIdAtual: string, ex?): Promise<string>` — card da carteira quando a gerência da carteira difere da gerência do card atual; senão o atual
- `carregarOrganogramaClientes(ex?): Promise<OrganogramaClientes>`

- [ ] **Step 1: Dados de teste reutilizáveis**

```ts
// src/db/carteira.test-dados.ts
// Cenário comum dos testes da carteira (espelha produção de 06/11/2026, reduzido).
import type { db as Db } from '@/db/index';
import * as s from '@/db/schema';

export const AGORA = '2026-11-06T12:00:00.000Z';

export async function limpar(db: typeof Db) {
    for (const t of [s.movimentoCarteira, s.carteiraCliente, s.contrato, s.proposta, s.cx, s.projects, s.cliente, s.managers]) await db.delete(t);
}

export async function cenario(db: typeof Db) {
    await limpar(db);
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0 };
    await db.insert(s.managers).values([
        { ...base, id: 'grc1-bruno', name: 'Bruno Ítalo', role: 'GRC1', year: 2026 },
        { ...base, id: 'grc3-barone', name: 'Barone', role: 'GRC3', year: 2026 },
        { ...base, id: 'grc4-velha', name: 'Antiga', role: 'GRC4', year: 2025 },
        { ...base, id: 'grc4-beatriz', name: 'Beatriz', role: 'GRC4', year: 2026 },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', year: 2026 },
        { ...base, id: 'kam1-malde', name: 'Malde', role: 'KAM1', year: 2026 },
        { ...base, id: 'kam3-gercino-teste', name: 'Gercino (teste)', role: 'KAM10', year: 2026, showInDashboard: false },
    ]);
    await db.insert(s.cliente).values([
        { id: 'c-smt', nome: 'Secretaria Municipal de Transportes', sigla: 'SMT', createdAt: AGORA },
        { id: 'c-sme', nome: 'Secretaria Municipal da Educação', sigla: 'SME', createdAt: AGORA },
        { id: 'c-smc', nome: 'Secretaria Municipal de Cultura', sigla: 'SMC', createdAt: AGORA },
        { id: 'c-oculto', nome: 'Órgão Oculto', sigla: 'OCU', ativo: false, createdAt: AGORA },
    ]);
    await db.insert(s.carteiraCliente).values([
        { clienteId: 'c-smt', gerencia: 'GRC3', movidoEm: AGORA },
        { clienteId: 'c-sme', gerencia: 'KAM1', movidoEm: AGORA },
        { clienteId: 'c-oculto', gerencia: 'GRC3', movidoEm: AGORA },
    ]);
    await db.insert(s.contrato).values([
        { id: 'ct-smt', numeroContrato: '1/2025', cliente: 'SMT', clienteId: 'c-smt', gerencia: 'GRC-3', nomeGerente: 'Barone', managerId: 'grc3-barone' },
    ]);
    await db.insert(s.proposta).values([
        { id: 'pr-smt', numeroProposta: 'P1', nomeOportunidade: 'Op', cliente: 'SMT', clienteId: 'c-smt', gerencia: 'GRC-3', managerId: 'grc3-barone' },
    ]);
    await db.insert(s.cx).values([
        { managerId: 'grc3-barone', cliente: 'SMT', clienteId: 'c-smt', problema: 'p', solucaoProposta: 's', externalId: 'planner-1' },
    ]);
    await db.insert(s.projects).values([
        { managerId: 'grc3-barone', quarter: 'q1', orgao: 'SMT', clienteId: 'c-smt', name: 'Projeto SMT', value: 100 },
        { managerId: 'grcc-debora', quarter: 'q2', orgao: 'SMT', clienteId: null, name: 'Lead SMT', value: 50, leadGrccId: 1 },
    ]);
}
```

- [ ] **Step 2: Teste de leitura que falha**

```ts
// src/db/carteira.leitura.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { cenario } from './carteira.test-dados';
import { carregarOrganogramaClientes, clientesAtendidosPorGerencia, gerenciaPelaCarteira, managerDaLinha } from './carteira';

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('leitura da carteira', () => {
    it('clientesAtendidosPorGerencia: "SIGLA (Nome)" por chave, sem oculto', async () => {
        const m = await clientesAtendidosPorGerencia();
        expect(m.get('GRC3')).toEqual(['SMT (Secretaria Municipal de Transportes)']);
        expect(m.get('KAM1')).toEqual(['SME (Secretaria Municipal da Educação)']);
        expect(m.get('GRC1')).toBeUndefined();
    });

    it('gerenciaPelaCarteira: card do maior ano, texto GRC-n e nome do gerente', async () => {
        await db.$client.execute("update carteira_cliente set gerencia = 'GRC4' where cliente_id = 'c-smt'");
        expect(await gerenciaPelaCarteira('c-smt')).toEqual({ chave: 'GRC4', managerId: 'grc4-beatriz', gerencia: 'GRC-4', nomeGerente: 'Beatriz' });
        expect(await gerenciaPelaCarteira('c-smc')).toBeNull();
        expect(await gerenciaPelaCarteira(null)).toBeNull();
    });

    it('managerDaLinha: troca só quando a carteira é de outra gerência', async () => {
        expect(await managerDaLinha('c-smt', 'grc1-bruno')).toBe('grc3-barone');
        expect(await managerDaLinha('c-smt', 'grc3-barone')).toBe('grc3-barone');
        expect(await managerDaLinha('c-smc', 'grc1-bruno')).toBe('grc1-bruno');
        expect(await managerDaLinha(null, 'grc1-bruno')).toBe('grc1-bruno');
    });

    it('carregarOrganogramaClientes: cartões por chave, gerente = nome do card, oculto fora, sem carteira ativos', async () => {
        const o = await carregarOrganogramaClientes();
        const grc3 = o.cartoes.find((c) => c.id === 'GRC3')!;
        expect(grc3).toMatchObject({ nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'] });
        expect(grc3.clientes.map((c) => c.id)).toEqual(['c-smt']);
        expect(o.cartoes.find((c) => c.id === 'GRC4')!.gerentes).toEqual(['Beatriz']);
        expect(o.cartoes.map((c) => c.id)).not.toContain('KAM10'); // oculta e vazia
        expect(o.semCarteira.map((c) => c.id)).toEqual(['c-smc']);
        expect(o.totais.orgaosAtendidos).toBe(2);
    });
});
```

- [ ] **Step 3:** `npx vitest run src/db/carteira.leitura.test.ts` — Expected: FAIL (`./carteira` não existe).

- [ ] **Step 4: Implementação (início de `src/db/carteira.ts`)**

```ts
// src/db/carteira.ts
// Carteira de clientes no banco (spec docs/superpowers/specs/2026-11-06-organograma-clientes-design.md).
// Porte de aibertinho/src/modulos/gerencias/servidor/{organograma-clientes,servico,carteira,levar-cliente}.ts.
// A gerência é a CHAVE da sigla do card ("GRC4"); o card que recebe os dados é `cardDaGerencia` (maior ano, visível).
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, contrato, cx, managers, movimentoCarteira, projects, proposta } from '@/db/schema';
import { cardDaGerencia, chaveDaCarteira, textoDaGerencia } from '@/lib/carteira/gerencia';
import type { ClienteParaCasar } from '@/lib/carteira/casar-cliente';
import { montarOrganograma, type ClienteDoOrganograma, type GerenciaDoOrganograma, type OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import type { CardGerencia } from '@/lib/carteira/tipos';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;

export async function listarCards(ex: Executor = db): Promise<CardGerencia[]> {
    return ex.select({ id: managers.id, name: managers.name, role: managers.role, year: managers.year, showInDashboard: managers.showInDashboard }).from(managers);
}

export async function listarClientesComCarteira(ex: Executor = db): Promise<Array<ClienteParaCasar & { ativo: boolean }>> {
    const linhas = await ex
        .select({ id: cliente.id, nome: cliente.nome, sigla: cliente.sigla, ativo: cliente.ativo, gerencia: carteiraCliente.gerencia })
        .from(cliente)
        .leftJoin(carteiraCliente, eq(carteiraCliente.clienteId, cliente.id));
    return linhas.map((l) => ({ ...l, gerencia: l.gerencia ?? null }));
}

const comoTexto = (c: { nome: string; sigla: string | null }) => (c.sigla ? `${c.sigla} (${c.nome})` : c.nome);

/** Clientes atendidos de cada gerência, no formato do antigo `served_clients` (ClientsTab, Planner). */
export async function clientesAtendidosPorGerencia(ex: Executor = db): Promise<Map<string, string[]>> {
    const linhas = await ex
        .select({ gerencia: carteiraCliente.gerencia, nome: cliente.nome, sigla: cliente.sigla })
        .from(carteiraCliente)
        .innerJoin(cliente, eq(cliente.id, carteiraCliente.clienteId))
        .where(eq(cliente.ativo, true))
        .orderBy(cliente.nome);
    const m = new Map<string, string[]>();
    for (const l of linhas) m.set(l.gerencia, [...(m.get(l.gerencia) ?? []), comoTexto(l)]);
    return m;
}

/** = `gerenciaDoComercialPelaCarteira`: gerência e gerente que a linha do cliente deve ter. null = sem cliente ou sem carteira. */
export async function gerenciaPelaCarteira(clienteId: string | null | undefined, ex: Executor = db) {
    if (!clienteId) return null;
    const [c] = await ex.select({ gerencia: carteiraCliente.gerencia }).from(carteiraCliente).where(eq(carteiraCliente.clienteId, clienteId));
    if (!c) return null;
    const card = cardDaGerencia(await listarCards(ex), c.gerencia);
    if (!card) return null;
    return { chave: c.gerencia, managerId: card.id, gerencia: textoDaGerencia(c.gerencia), nomeGerente: card.name };
}

/** Card em que a linha deve ser gravada: o da carteira, quando a carteira é de outra gerência; senão o atual. */
export async function managerDaLinha(clienteId: string | null | undefined, managerIdAtual: string, ex: Executor = db): Promise<string> {
    const g = await gerenciaPelaCarteira(clienteId, ex);
    if (!g) return managerIdAtual;
    const cards = await listarCards(ex);
    const atual = cards.find((c) => c.id === managerIdAtual);
    return atual && chaveDaCarteira(atual) === g.chave ? managerIdAtual : g.managerId;
}

async function ultimosMovimentos(ex: Executor): Promise<Map<string, { em: string }>> {
    const movs = await ex.select({ clienteId: movimentoCarteira.clienteId, em: movimentoCarteira.em }).from(movimentoCarteira).orderBy(desc(movimentoCarteira.em));
    const m = new Map<string, { em: string }>();
    for (const mv of movs) if (!m.has(mv.clienteId)) m.set(mv.clienteId, { em: mv.em });
    return m;
}

export async function carregarOrganogramaClientes(ex: Executor = db): Promise<OrganogramaClientes> {
    const [cards, clientes, ultimos] = await Promise.all([listarCards(ex), listarClientesComCarteira(ex), ultimosMovimentos(ex)]);
    const comoCliente = (c: { id: string; nome: string; sigla: string | null }): ClienteDoOrganograma => ({
        id: c.id, nome: c.nome, sigla: c.sigla, ultimoMovimento: ultimos.get(c.id) ?? null,
    });
    const ativos = clientes.filter((c) => c.ativo);
    const chaves = [...new Set(cards.map(chaveDaCarteira))];
    const gerencias: GerenciaDoOrganograma[] = chaves.map((chave) => {
        const card = cardDaGerencia(cards, chave)!;
        return {
            id: chave,
            nome: chave,
            sigla: chave,
            ativa: card.showInDashboard,
            gerentes: [card.name],
            clientes: ativos.filter((c) => c.gerencia === chave).map(comoCliente),
        };
    });
    return montarOrganograma(gerencias, ativos.filter((c) => c.gerencia === null).map(comoCliente));
}
```

(`and`, `inArray`, `isNotNull`, `isNull`, `contrato`, `cx`, `projects`, `proposta` são usados nas Tasks 8–9; se o lint reclamar de import não usado nesta task, deixe só os usados e acrescente depois.)

- [ ] **Step 5:** `npx vitest run src/db/carteira.leitura.test.ts` — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/db/carteira.ts src/db/carteira.leitura.test.ts src/db/carteira.test-dados.ts
git commit -m "feat(carteira): leitura da carteira e do organograma de clientes"
```

---

### Task 8: Banco da carteira — mover e "leva tudo"

**Files:**
- Modify: `src/db/carteira.ts`
- Create: `src/db/carteira.mover.test.ts`

**Interfaces — Consumes:** Task 7. **Produces:**
- `levarDadosDoCliente(tx: Tx, clienteIds: string[], paraGerencia: string, por: string): Promise<void>`
- `moverClientes(clienteIds: string[], para: string | null, por: string, esperado?: Record<string, string | null>): Promise<{ movidos: number }>`
- `alterarCarteira(gerencia: string, mudanca: { adicionar: string[]; remover: string[] }, por: string): Promise<{ movidos: number }>`
- `alinharCliente(clienteId: string, por: string): Promise<{ movidos: number }>`
- `gerenciasDosDados(clienteId: string, ex?): Promise<string[]>` — chaves dos cards onde estão as linhas manuais do cliente

Erros lançados como `ErroCarteira` com os textos exatos do spec §5.

- [ ] **Step 1: Teste que falha**

```ts
// src/db/carteira.mover.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('./carteira.test-dados');
const c = await import('./carteira');
const { MUDOU_ENQUANTO_OLHAVA, JUSTIFICATIVA_TROCA } = await import('@/lib/carteira/tipos');

const carteiraDe = async (id: string) => (await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, id)))[0]?.gerencia ?? null;

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('moverClientes leva tudo', () => {
    it('contrato, proposta, cx e projeto manual vão para o card da gerência nova; lead GRCC fica', async () => {
        expect(await c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC3' })).toEqual({ movidos: 1 });
        expect(await carteiraDe('c-smt')).toBe('GRC4');
        expect((await db.select().from(s.contrato))[0]).toMatchObject({ managerId: 'grc4-beatriz', gerencia: 'GRC-4', nomeGerente: 'Beatriz' });
        expect((await db.select().from(s.proposta))[0]).toMatchObject({ managerId: 'grc4-beatriz', gerencia: 'GRC-4' });
        expect((await db.select().from(s.cx))[0].managerId).toBe('grc4-beatriz');
        const projs = await db.select().from(s.projects);
        const manual = projs.find((p) => p.name === 'Projeto SMT')!;
        expect(manual.managerId).toBe('grc4-beatriz');
        expect(JSON.parse(manual.history!)).toEqual([expect.objectContaining({ tipo: 'nota', de: 'GRC3', para: 'GRC4', justificativa: JUSTIFICATIVA_TROCA, autor: 'Admin' })]);
        expect(projs.find((p) => p.name === 'Lead SMT')!.managerId).toBe('grcc-debora');
        const trilha = await db.select().from(s.movimentoCarteira);
        expect(trilha.map((m) => [m.clienteId, m.deGerencia, m.paraGerencia, m.por])).toEqual([['c-smt', 'GRC3', 'GRC4', 'Admin']]);
    });

    it('desfazer é o movimento de volta', async () => {
        await c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC3' });
        await c.moverClientes(['c-smt'], 'GRC3', 'Admin', { 'c-smt': 'GRC4' });
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc3-barone');
        expect(await db.select().from(s.movimentoCarteira)).toHaveLength(2);
    });

    it('tirar da carteira não mexe nos dados', async () => {
        await c.moverClientes(['c-smt'], null, 'Admin', { 'c-smt': 'GRC3' });
        expect(await carteiraDe('c-smt')).toBeNull();
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc3-barone');
    });

    it('recusa: mudou enquanto olhava, gerência oculta, gerência inexistente — sem gravar', async () => {
        await expect(c.moverClientes(['c-smt'], 'GRC4', 'Admin', { 'c-smt': 'GRC1' })).rejects.toThrow(MUDOU_ENQUANTO_OLHAVA);
        await expect(c.moverClientes(['c-smt'], 'KAM10', 'Admin')).rejects.toThrow('Gerência desativada não recebe clientes.');
        await expect(c.moverClientes(['c-smt'], 'GRC9', 'Admin')).rejects.toThrow('Gerência não encontrada.');
        expect(await carteiraDe('c-smt')).toBe('GRC3');
        expect(await db.select().from(s.movimentoCarteira)).toHaveLength(0);
    });

    it('mesmo lugar: movidos 0', async () => {
        expect(await c.moverClientes(['c-smt'], 'GRC3', 'Admin')).toEqual({ movidos: 0 });
    });
});

describe('alterarCarteira (editor do admin)', () => {
    it('põe cliente sem carteira (levando os dados) e tira cliente da própria', async () => {
        await db.update(s.contrato).set({ clienteId: 'c-smc' });
        await c.alterarCarteira('GRC1', { adicionar: ['c-smc'], remover: [] }, 'Admin');
        expect(await carteiraDe('c-smc')).toBe('GRC1');
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc1-bruno');
        await c.alterarCarteira('GRC1', { adicionar: [], remover: ['c-smc'] }, 'Admin');
        expect(await carteiraDe('c-smc')).toBeNull();
    });
    it('cliente de outra gerência recusa tudo', async () => {
        await expect(c.alterarCarteira('GRC1', { adicionar: ['c-smt', 'c-smc'], remover: [] }, 'Admin')).rejects.toThrow('Cliente de outra gerência: mova pela aba Organograma.');
        expect(await carteiraDe('c-smc')).toBeNull();
    });
});

describe('alinharCliente (fora da carteira)', () => {
    it('traz os dados para a gerência da carteira e registra de onde vieram', async () => {
        await db.update(s.carteiraCliente).set({ gerencia: 'GRC1' }).where(eq(s.carteiraCliente.clienteId, 'c-smt'));
        expect(await c.gerenciasDosDados('c-smt')).toEqual(['GRC3']);
        await c.alinharCliente('c-smt', 'Admin');
        expect((await db.select().from(s.contrato))[0].managerId).toBe('grc1-bruno');
        expect(await c.gerenciasDosDados('c-smt')).toEqual(['GRC1']);
        const [mv] = await db.select().from(s.movimentoCarteira);
        expect([mv.deGerencia, mv.paraGerencia]).toEqual(['GRC3', 'GRC1']);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/db/carteira.mover.test.ts` — Expected: FAIL (funções não existem).

- [ ] **Step 3: Implementação (acrescente a `src/db/carteira.ts`)**

```ts
import { ErroCarteira, JUSTIFICATIVA_TROCA, MUDOU_ENQUANTO_OLHAVA } from '@/lib/carteira/tipos';
import type { ProjectHistoryItem } from '@/types/manager';

const agora = () => new Date().toISOString();

/** Destino válido: existe card e o card da gerência está visível. Devolve o card. */
async function destino(chave: string, ex: Executor) {
    const card = cardDaGerencia(await listarCards(ex), chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (!card.showInDashboard) throw new ErroCarteira('Gerência desativada não recebe clientes.');
    return card;
}

/** = `levarDadosDoCliente` do AIBertinho. Visitas e churn não têm cliente; projeto de lead da GRCC fica na GRCC. */
export async function levarDadosDoCliente(tx: Tx, clienteIds: string[], paraGerencia: string, por: string): Promise<void> {
    if (clienteIds.length === 0) return;
    const cards = await listarCards(tx);
    const card = cardDaGerencia(cards, paraGerencia);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    const doCliente = inArray(contrato.clienteId, clienteIds);
    await tx.update(contrato).set({ managerId: card.id, gerencia: textoDaGerencia(paraGerencia), nomeGerente: card.name, updatedAt: agora() }).where(doCliente);
    await tx.update(proposta).set({ managerId: card.id, gerencia: textoDaGerencia(paraGerencia), updatedAt: agora() }).where(inArray(proposta.clienteId, clienteIds));
    await tx.update(cx).set({ managerId: card.id }).where(inArray(cx.clienteId, clienteIds));

    const chaveDoCard = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    const projs = await tx
        .select({ id: projects.id, managerId: projects.managerId, history: projects.history })
        .from(projects)
        .where(and(inArray(projects.clienteId, clienteIds), isNull(projects.leadGrccId)));
    for (const p of projs) {
        if (p.managerId === card.id) continue;
        let historico: ProjectHistoryItem[] = [];
        try {
            historico = p.history ? JSON.parse(p.history) : [];
        } catch {
            historico = [];
        }
        historico.push({ date: agora(), tipo: 'nota', de: chaveDoCard.get(p.managerId) ?? p.managerId, para: paraGerencia, justificativa: JUSTIFICATIVA_TROCA, autor: por });
        await tx.update(projects).set({ managerId: card.id, history: JSON.stringify(historico) }).where(eq(projects.id, p.id));
    }
}

async function carteiraAtual(clienteIds: string[], ex: Executor): Promise<Map<string, string>> {
    if (clienteIds.length === 0) return new Map();
    const linhas = await ex.select({ clienteId: carteiraCliente.clienteId, gerencia: carteiraCliente.gerencia }).from(carteiraCliente).where(inArray(carteiraCliente.clienteId, clienteIds));
    return new Map(linhas.map((l) => [l.clienteId, l.gerencia]));
}

/** = `moverClientes` do AIBertinho, com `esperado` (de onde a tela acha que cada cliente sai; null = sem carteira). */
export async function moverClientes(clienteIds: string[], para: string | null, por: string, esperado?: Record<string, string | null>): Promise<{ movidos: number }> {
    if (para) await destino(para, db);
    const deOnde = await carteiraAtual(clienteIds, db);
    if (esperado && clienteIds.some((id) => id in esperado && (deOnde.get(id) ?? null) !== esperado[id])) {
        throw new ErroCarteira(MUDOU_ENQUANTO_OLHAVA);
    }
    const mudam = clienteIds.filter((id) => (deOnde.get(id) ?? null) !== para);
    if (mudam.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        if (para) {
            for (const clienteId of mudam) {
                await tx.insert(carteiraCliente).values({ clienteId, gerencia: para, movidoEm: agora(), movidoPor: por })
                    .onConflictDoUpdate({ target: carteiraCliente.clienteId, set: { gerencia: para, movidoEm: agora(), movidoPor: por } });
            }
            await levarDadosDoCliente(tx, mudam, para, por);
        } else {
            await tx.delete(carteiraCliente).where(inArray(carteiraCliente.clienteId, mudam));
        }
        await tx.insert(movimentoCarteira).values(mudam.map((clienteId) => ({ clienteId, deGerencia: deOnde.get(clienteId) ?? null, paraGerencia: para, por, em: agora() })));
    });
    return { movidos: mudam.length };
}

/** = `alterarCarteira` do AIBertinho: entra só cliente sem carteira, sai só cliente desta gerência. */
export async function alterarCarteira(gerencia: string, mudanca: { adicionar: string[]; remover: string[] }, por: string): Promise<{ movidos: number }> {
    const deOnde = await carteiraAtual([...mudanca.adicionar, ...mudanca.remover], db);
    if ([...mudanca.adicionar, ...mudanca.remover].some((id) => deOnde.has(id) && deOnde.get(id) !== gerencia)) {
        throw new ErroCarteira('Cliente de outra gerência: mova pela aba Organograma.');
    }
    const entram = [...new Set(mudanca.adicionar)].filter((id) => !deOnde.has(id));
    const saem = [...new Set(mudanca.remover)].filter((id) => deOnde.has(id));
    if (entram.length > 0) await destino(gerencia, db);
    if (entram.length + saem.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        if (entram.length) {
            await tx.insert(carteiraCliente).values(entram.map((clienteId) => ({ clienteId, gerencia, movidoEm: agora(), movidoPor: por })));
            await levarDadosDoCliente(tx, entram, gerencia, por);
        }
        if (saem.length) await tx.delete(carteiraCliente).where(and(inArray(carteiraCliente.clienteId, saem), eq(carteiraCliente.gerencia, gerencia)));
        await tx.insert(movimentoCarteira).values([
            ...entram.map((clienteId) => ({ clienteId, deGerencia: null, paraGerencia: gerencia, por, em: agora() })),
            ...saem.map((clienteId) => ({ clienteId, deGerencia: gerencia, paraGerencia: null, por, em: agora() })),
        ]);
    });
    return { movidos: entram.length + saem.length };
}

/** Chaves das gerências onde estão as linhas manuais do cliente (contrato, proposta, cx, projeto sem lead). */
export async function gerenciasDosDados(clienteId: string, ex: Executor = db): Promise<string[]> {
    const cards = await listarCards(ex);
    const chave = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    const ids = [
        ...(await ex.select({ m: contrato.managerId }).from(contrato).where(eq(contrato.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: proposta.managerId }).from(proposta).where(eq(proposta.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: cx.managerId }).from(cx).where(eq(cx.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: projects.managerId }).from(projects).where(and(eq(projects.clienteId, clienteId), isNull(projects.leadGrccId)))).map((r) => r.m),
    ];
    return [...new Set(ids.filter((id): id is string => !!id).map((id) => chave.get(id) ?? id))].sort();
}

/** Fora da carteira (D12): leva os dados do cliente para a gerência da carteira atual. */
export async function alinharCliente(clienteId: string, por: string): Promise<{ movidos: number }> {
    const atual = (await carteiraAtual([clienteId], db)).get(clienteId);
    if (!atual) throw new ErroCarteira('Cliente sem carteira: ponha numa gerência antes.');
    const de = (await gerenciasDosDados(clienteId)).filter((g) => g !== atual);
    if (de.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        await levarDadosDoCliente(tx, [clienteId], atual, por);
        await tx.insert(movimentoCarteira).values({ clienteId, deGerencia: de[0], paraGerencia: atual, por, em: agora() });
    });
    return { movidos: 1 };
}
```

- [ ] **Step 4:** `npx vitest run src/db/carteira.mover.test.ts src/db/carteira.leitura.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/db/carteira.ts src/db/carteira.mover.test.ts
git commit -m "feat(carteira): mover cliente leva contratos, propostas, CX e projetos (lead GRCC fica)"
```

---

### Task 9: Banco da carteira — admin de gerência, cliente e "a conferir"

**Files:**
- Modify: `src/db/carteira.ts`
- Create: `src/db/carteira.admin.test.ts`

**Interfaces — Produces:**
- `criarGerencia(d: { sigla: string; nome: string }): Promise<{ chave: string; id: string }>`
- `editarGerencia(chave: string, d: { sigla: string; nome: string }): Promise<{ chave: string }>`
- `definirGerenciaVisivel(chave: string, visivel: boolean): Promise<void>`
- `definirClienteAtivo(clienteId: string, ativo: boolean): Promise<void>`
- `criarCliente(d: { nome: string; sigla: string | null }): Promise<{ id: string }>`
- `interface ForaDaCarteira { clienteId: string; sigla: string|null; nome: string; carteira: string; gerenciasDosDados: string[] }`, `foraDaCarteira(): Promise<ForaDaCarteira[]>`
- `type TabelaComCliente = 'contrato'|'proposta'|'cx'|'projects'`, `interface LinhaSemCliente { tabela: TabelaComCliente; id: string; texto: string; gerencia: string }`, `linhasSemCliente(): Promise<LinhaSemCliente[]>`
- `ligarCliente(tabela: TabelaComCliente, id: string, clienteId: string): Promise<void>`
- `interface GerenciaParaEditar { chave: string; cardId: string; nome: string; visivel: boolean; clientes: Array<{ id: string; nome: string; sigla: string|null; ativo: boolean }> }`, `gerenciasParaEditar(): Promise<GerenciaParaEditar[]>`

- [ ] **Step 1: Teste que falha**

```ts
// src/db/carteira.admin.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('./carteira.test-dados');
const c = await import('./carteira');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('gerência', () => {
    it('criarGerencia: card novo com a chave como role, maior ano e visível; sigla repetida recusa', async () => {
        expect(await c.criarGerencia({ sigla: 'grc-5', nome: 'Ana Souza' })).toEqual({ chave: 'GRC5', id: 'grc5-ana-souza' });
        const [card] = await db.select().from(s.managers).where(eq(s.managers.id, 'grc5-ana-souza'));
        expect(card).toMatchObject({ name: 'Ana Souza', role: 'GRC5', year: 2026, showInDashboard: true, meta: 0 });
        await expect(c.criarGerencia({ sigla: 'GRC3', nome: 'X' })).rejects.toThrow('Já existe uma gerência com a sigla GRC3.');
    });

    it('editarGerencia: troca a sigla em todos os cards, na carteira, na trilha e no texto de contrato/proposta', async () => {
        expect(await c.editarGerencia('GRC3', { sigla: 'GRC7', nome: 'Barone Filho' })).toEqual({ chave: 'GRC7' });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc3-barone')))[0]).toMatchObject({ role: 'GRC7', name: 'Barone Filho' });
        expect((await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, 'c-smt')))[0].gerencia).toBe('GRC7');
        expect((await db.select().from(s.contrato))[0].gerencia).toBe('GRC-7');
        expect((await db.select().from(s.proposta))[0].gerencia).toBe('GRC-7');
        await expect(c.editarGerencia('GRC7', { sigla: 'GRC1', nome: 'x' })).rejects.toThrow('Já existe uma gerência com a sigla GRC1.');
    });

    it('ocultar com cliente recusa; sem cliente oculta; oculta volta', async () => {
        await expect(c.definirGerenciaVisivel('GRC3', false)).rejects.toThrow('Tire os 2 clientes da carteira antes de desativar.');
        await c.definirGerenciaVisivel('GRC1', false);
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc1-bruno')))[0].showInDashboard).toBe(false);
        await c.definirGerenciaVisivel('GRC1', true);
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc1-bruno')))[0].showInDashboard).toBe(true);
    });
});

describe('cliente', () => {
    it('ocultar mantém a carteira', async () => {
        await c.definirClienteAtivo('c-smt', false);
        expect((await db.select().from(s.cliente).where(eq(s.cliente.id, 'c-smt')))[0].ativo).toBe(false);
        expect((await db.select().from(s.carteiraCliente).where(eq(s.carteiraCliente.clienteId, 'c-smt')))[0].gerencia).toBe('GRC3');
    });
    it('criarCliente recusa sigla repetida', async () => {
        const { id } = await c.criarCliente({ nome: 'Câmara de Osasco', sigla: null });
        expect(id).toBeTruthy();
        await expect(c.criarCliente({ nome: 'Outra', sigla: 'smt' })).rejects.toThrow('Já existe um cliente com a sigla smt.');
    });
});

describe('a conferir', () => {
    it('foraDaCarteira lista cliente cujos dados estão em outra gerência', async () => {
        await db.update(s.carteiraCliente).set({ gerencia: 'GRC1' }).where(eq(s.carteiraCliente.clienteId, 'c-smt'));
        expect(await c.foraDaCarteira()).toEqual([{ clienteId: 'c-smt', sigla: 'SMT', nome: 'Secretaria Municipal de Transportes', carteira: 'GRC1', gerenciasDosDados: ['GRC3'] }]);
    });
    it('linhasSemCliente e ligarCliente; projeto de lead GRCC fica de fora', async () => {
        await db.insert(s.contrato).values({ id: 'ct-x', numeroContrato: '9/2025', cliente: 'Câmara X', managerId: 'grc1-bruno' });
        const linhas = await c.linhasSemCliente();
        expect(linhas).toEqual([{ tabela: 'contrato', id: 'ct-x', texto: 'Câmara X', gerencia: 'GRC1' }]);
        await c.ligarCliente('contrato', 'ct-x', 'c-smc');
        expect(await c.linhasSemCliente()).toEqual([]);
    });
    it('gerenciasParaEditar: uma por chave, com clientes (inclusive ocultos)', async () => {
        const g = (await c.gerenciasParaEditar()).find((x) => x.chave === 'GRC3')!;
        expect(g).toMatchObject({ cardId: 'grc3-barone', nome: 'Barone', visivel: true });
        expect(g.clientes.map((x) => [x.id, x.ativo])).toEqual([['c-oculto', false], ['c-smt', true]]);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/db/carteira.admin.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação (acrescente a `src/db/carteira.ts`)**

```ts
import { siglaComparavel, chaveDaGerencia } from '@/lib/integracao/chaves';
import { sql } from 'drizzle-orm';

function slug(t: string): string {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const chaveDaSigla = (sigla: string) => chaveDaGerencia(sigla) ?? sigla.trim();

export async function criarGerencia(d: { sigla: string; nome: string }): Promise<{ chave: string; id: string }> {
    const chave = chaveDaSigla(d.sigla);
    const nome = d.nome.trim();
    if (!chave) throw new ErroCarteira('Informe a sigla.');
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const cards = await listarCards();
    if (cards.some((c) => chaveDaCarteira(c) === chave)) throw new ErroCarteira(`Já existe uma gerência com a sigla ${chave}.`);
    const id = `${slug(chave)}-${slug(nome)}`;
    if (cards.some((c) => c.id === id)) throw new ErroCarteira(`Já existe um gerente com o ID "${id}".`);
    const year = cards.length ? Math.max(...cards.map((c) => c.year)) : new Date().getFullYear();
    await db.insert(managers).values({ id, name: nome, role: chave, avatarUrl: '', year, meta: 0, contratado: 0, forecastFinal: 0, showInDashboard: true });
    return { chave, id };
}

export async function editarGerencia(chave: string, d: { sigla: string; nome: string }): Promise<{ chave: string }> {
    const nova = chaveDaSigla(d.sigla);
    const nome = d.nome.trim();
    if (!nova) throw new ErroCarteira('Informe a sigla.');
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const cards = await listarCards();
    const daGerencia = cards.filter((c) => chaveDaCarteira(c) === chave);
    const card = cardDaGerencia(cards, chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (nova !== chave && cards.some((c) => chaveDaCarteira(c) === nova)) throw new ErroCarteira(`Já existe uma gerência com a sigla ${nova}.`);
    const ids = daGerencia.map((c) => c.id);
    await db.transaction(async (tx) => {
        await tx.update(managers).set({ name: nome }).where(eq(managers.id, card.id));
        if (nova === chave) return;
        await tx.update(managers).set({ role: nova }).where(inArray(managers.id, ids));
        await tx.update(carteiraCliente).set({ gerencia: nova }).where(eq(carteiraCliente.gerencia, chave));
        await tx.update(movimentoCarteira).set({ deGerencia: nova }).where(eq(movimentoCarteira.deGerencia, chave));
        await tx.update(movimentoCarteira).set({ paraGerencia: nova }).where(eq(movimentoCarteira.paraGerencia, chave));
        await tx.update(contrato).set({ gerencia: textoDaGerencia(nova) }).where(inArray(contrato.managerId, ids));
        await tx.update(proposta).set({ gerencia: textoDaGerencia(nova) }).where(inArray(proposta.managerId, ids));
    });
    return { chave: nova };
}

export async function definirGerenciaVisivel(chave: string, visivel: boolean): Promise<void> {
    const card = cardDaGerencia(await listarCards(), chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (!visivel) {
        const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(carteiraCliente).where(eq(carteiraCliente.gerencia, chave));
        if (n > 0) throw new ErroCarteira(`Tire os ${n} clientes da carteira antes de desativar.`);
    }
    await db.update(managers).set({ showInDashboard: visivel }).where(eq(managers.id, card.id));
}

export async function definirClienteAtivo(clienteId: string, ativo: boolean): Promise<void> {
    await db.update(cliente).set({ ativo }).where(eq(cliente.id, clienteId));
}

export async function criarCliente(d: { nome: string; sigla: string | null }): Promise<{ id: string }> {
    const nome = d.nome.trim();
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const sigla = d.sigla?.trim() || null;
    if (sigla) {
        const existentes = await db.select({ sigla: cliente.sigla }).from(cliente).where(isNotNull(cliente.sigla));
        if (existentes.some((e) => siglaComparavel(e.sigla!) === siglaComparavel(sigla))) throw new ErroCarteira(`Já existe um cliente com a sigla ${sigla}.`);
    }
    const id = crypto.randomUUID();
    await db.insert(cliente).values({ id, nome, sigla, createdAt: agora() });
    return { id };
}

export interface ForaDaCarteira { clienteId: string; sigla: string | null; nome: string; carteira: string; gerenciasDosDados: string[] }

export async function foraDaCarteira(): Promise<ForaDaCarteira[]> {
    const comCarteira = (await listarClientesComCarteira()).filter((c) => c.gerencia !== null);
    const fora: ForaDaCarteira[] = [];
    for (const c of comCarteira) {
        const dados = await gerenciasDosDados(c.id);
        if (dados.some((g) => g !== c.gerencia)) fora.push({ clienteId: c.id, sigla: c.sigla, nome: c.nome, carteira: c.gerencia!, gerenciasDosDados: dados });
    }
    return fora.sort((a, b) => (a.sigla ?? a.nome).localeCompare(b.sigla ?? b.nome, 'pt-BR'));
}

export type TabelaComCliente = 'contrato' | 'proposta' | 'cx' | 'projects';
export interface LinhaSemCliente { tabela: TabelaComCliente; id: string; texto: string; gerencia: string }

export async function linhasSemCliente(): Promise<LinhaSemCliente[]> {
    const chave = new Map((await listarCards()).map((c) => [c.id, chaveDaCarteira(c)]));
    const g = (m: string | null) => (m ? chave.get(m) ?? m : '');
    const ct = await db.select({ id: contrato.id, texto: contrato.cliente, m: contrato.managerId }).from(contrato).where(isNull(contrato.clienteId));
    const pr = await db.select({ id: proposta.id, texto: proposta.cliente, m: proposta.managerId }).from(proposta).where(isNull(proposta.clienteId));
    const c = await db.select({ id: cx.id, texto: cx.cliente, m: cx.managerId }).from(cx).where(isNull(cx.clienteId));
    const pj = await db.select({ id: projects.id, texto: projects.orgao, m: projects.managerId }).from(projects).where(and(isNull(projects.clienteId), isNull(projects.leadGrccId)));
    return [
        ...ct.map((r) => ({ tabela: 'contrato' as const, id: r.id, texto: r.texto, gerencia: g(r.m) })),
        ...pr.map((r) => ({ tabela: 'proposta' as const, id: r.id, texto: r.texto, gerencia: g(r.m) })),
        ...c.map((r) => ({ tabela: 'cx' as const, id: String(r.id), texto: r.texto, gerencia: g(r.m) })),
        ...pj.map((r) => ({ tabela: 'projects' as const, id: String(r.id), texto: r.texto ?? '', gerencia: g(r.m) })),
    ];
}

export async function ligarCliente(tabela: TabelaComCliente, id: string, clienteId: string): Promise<void> {
    if (tabela === 'contrato') await db.update(contrato).set({ clienteId }).where(eq(contrato.id, id));
    else if (tabela === 'proposta') await db.update(proposta).set({ clienteId }).where(eq(proposta.id, id));
    else if (tabela === 'cx') await db.update(cx).set({ clienteId }).where(eq(cx.id, Number(id)));
    else await db.update(projects).set({ clienteId }).where(and(eq(projects.id, Number(id)), isNull(projects.leadGrccId)));
}

export interface GerenciaParaEditar {
    chave: string;
    cardId: string;
    nome: string;
    visivel: boolean;
    clientes: Array<{ id: string; nome: string; sigla: string | null; ativo: boolean }>;
}

export async function gerenciasParaEditar(): Promise<GerenciaParaEditar[]> {
    const [cards, clientes] = await Promise.all([listarCards(), listarClientesComCarteira()]);
    return [...new Set(cards.map(chaveDaCarteira))].sort().map((chave) => {
        const card = cardDaGerencia(cards, chave)!;
        return {
            chave,
            cardId: card.id,
            nome: card.name,
            visivel: card.showInDashboard,
            clientes: clientes
                .filter((c) => c.gerencia === chave)
                .map(({ id, nome, sigla, ativo }) => ({ id, nome, sigla, ativo }))
                .sort((a, b) => (a.sigla ?? a.nome).localeCompare(b.sigla ?? b.nome, 'pt-BR')),
        };
    });
}
```

(Junte os imports novos ao bloco de imports do topo do arquivo.)

- [ ] **Step 4:** `npx vitest run src/db/carteira` — Expected: PASS (leitura, mover, admin).
- [ ] **Step 5: Commit**

```bash
git add src/db/carteira.ts src/db/carteira.admin.test.ts
git commit -m "feat(carteira): admin de gerencia e cliente, fora da carteira e linhas sem cliente"
```

---

### Task 10: Server Actions do organograma

**Files:**
- Create: `src/app/settings/carteiraActions.ts`, `src/app/settings/carteiraActions.test.ts`

**Interfaces — Consumes:** Tasks 6–9. **Produces** (todas `'use server'`; as de escrita recebem `chave` primeiro e devolvem `Resultado<T>`):
- `carregarOrganogramaClientesAction(): Promise<OrganogramaClientes>` (aberta, leitura)
- `interface PainelCarteira { organograma: OrganogramaClientes; gerencias: GerenciaParaEditar[]; semCarteira: Array<{ id; nome; sigla }>; todosClientes: Array<{ id; nome; sigla; gerencia: string|null; ativo: boolean }>; fora: ForaDaCarteira[]; semCliente: LinhaSemCliente[] }`
- `carregarPainelCarteiraAction(chave): Promise<Resultado<PainelCarteira>>`
- `moverClienteNoOrganogramaAction(chave, clienteId, de, para): Promise<Resultado<{ movidos: number }>>`
- `alterarCarteiraAction(chave, gerencia, { adicionar, remover })`, `criarGerenciaAction(chave, { sigla, nome })`, `editarGerenciaAction(chave, gerencia, { sigla, nome })`, `definirGerenciaVisivelAction(chave, gerencia, visivel)`, `definirClienteAtivoAction(chave, clienteId, ativo)`, `alinharClienteAction(chave, clienteId)`, `ligarClienteAction(chave, tabela, id, clienteId)`, `criarClienteAction(chave, { nome, sigla })`

- [ ] **Step 1: Teste que falha**

```ts
// src/app/settings/carteiraActions.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const { db, applyMigrations } = await createTransactionSafeTestDb();
const { cenario } = await import('@/db/carteira.test-dados');
const a = await import('./carteiraActions');

beforeAll(() => { process.env.SETTINGS_KEY = 'adm'; return applyMigrations(); });
beforeEach(() => cenario(db));

describe('carteiraActions', () => {
    it('sem chave: recusa e não grava', async () => {
        expect(await a.moverClienteNoOrganogramaAction('errada', 'c-smt', 'GRC3', 'GRC4')).toEqual({ ok: false, erro: 'Só o administrador move clientes entre carteiras.' });
        expect(await a.criarGerenciaAction('', { sigla: 'GRC5', nome: 'X' })).toMatchObject({ ok: false });
    });
    it('move, devolve o resultado e traduz o erro de regra', async () => {
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC3', 'GRC4')).toEqual({ ok: true, valor: { movidos: 1 } });
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC3', 'GRC1')).toEqual({ ok: false, erro: 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.' });
        expect(await a.moverClienteNoOrganogramaAction('adm', 'c-smt', 'GRC4', 'GRC4')).toEqual({ ok: true, valor: { movidos: 0 } });
    });
    it('entrada inválida', async () => {
        expect(await a.moverClienteNoOrganogramaAction('adm', '', 'GRC3', 'GRC4')).toEqual({ ok: false, erro: 'Dados inválidos.' });
    });
    it('painel do admin e leitura aberta', async () => {
        const p = await a.carregarPainelCarteiraAction('adm');
        expect(p.ok && p.valor.semCarteira.map((c) => c.id)).toEqual(['c-smc']);
        expect((await a.carregarOrganogramaClientesAction()).totais.orgaosAtendidos).toBe(2);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/app/settings/carteiraActions.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação**

```ts
// src/app/settings/carteiraActions.ts
'use server';
// Actions do organograma de clientes (spec 2026-11-06 §5 e §8). Só o admin grava: a SETTINGS_KEY é conferida AQUI.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as carteira from '@/db/carteira';
import { chaveSettingsValida } from '@/lib/settings/chave';
import { ErroCarteira, SO_ADMIN, type Resultado } from '@/lib/carteira/tipos';
import type { OrganogramaClientes } from '@/lib/carteira/organograma-clientes';

const POR = 'Admin';
const id = z.string().trim().min(1).max(64);
const gerencia = z.string().trim().min(1).max(40);

async function rodar<T>(chave: string, fn: () => Promise<T>): Promise<Resultado<T>> {
    if (!chaveSettingsValida(chave)) return { ok: false, erro: SO_ADMIN };
    try {
        const valor = await fn();
        revalidatePath('/');
        revalidatePath('/settings');
        return { ok: true, valor };
    } catch (e) {
        if (e instanceof ErroCarteira) return { ok: false, erro: e.message };
        if (e instanceof z.ZodError) return { ok: false, erro: 'Dados inválidos.' };
        console.error('[carteira]', e);
        return { ok: false, erro: 'Não foi possível gravar. Tente de novo.' };
    }
}

export async function carregarOrganogramaClientesAction(): Promise<OrganogramaClientes> {
    return carteira.carregarOrganogramaClientes();
}

export interface PainelCarteira {
    organograma: OrganogramaClientes;
    gerencias: carteira.GerenciaParaEditar[];
    semCarteira: Array<{ id: string; nome: string; sigla: string | null }>;
    todosClientes: Array<{ id: string; nome: string; sigla: string | null; gerencia: string | null; ativo: boolean }>;
    fora: carteira.ForaDaCarteira[];
    semCliente: carteira.LinhaSemCliente[];
}

export async function carregarPainelCarteiraAction(chave: string): Promise<Resultado<PainelCarteira>> {
    if (!chaveSettingsValida(chave)) return { ok: false, erro: SO_ADMIN };
    const [organograma, gerencias, todos, fora, semCliente] = await Promise.all([
        carteira.carregarOrganogramaClientes(), carteira.gerenciasParaEditar(), carteira.listarClientesComCarteira(), carteira.foraDaCarteira(), carteira.linhasSemCliente(),
    ]);
    const todosClientes = todos.map(({ id, nome, sigla, gerencia, ativo }) => ({ id, nome, sigla, gerencia, ativo }));
    return {
        ok: true,
        valor: { organograma, gerencias, todosClientes, fora, semCliente, semCarteira: todosClientes.filter((c) => c.gerencia === null && c.ativo) },
    };
}

export async function moverClienteNoOrganogramaAction(chave: string, clienteId: string, de: string | null, para: string | null) {
    return rodar(chave, async () => {
        const d = z.object({ clienteId: id, de: gerencia.nullable(), para: gerencia.nullable() }).parse({ clienteId, de, para });
        if (d.de === d.para) return { movidos: 0 };
        return carteira.moverClientes([d.clienteId], d.para, POR, { [d.clienteId]: d.de });
    });
}

export async function alterarCarteiraAction(chave: string, g: string, mudanca: { adicionar: string[]; remover: string[] }) {
    return rodar(chave, async () => {
        const d = z.object({ g: gerencia, adicionar: z.array(id).max(5000), remover: z.array(id).max(5000) }).parse({ g, ...mudanca });
        return carteira.alterarCarteira(d.g, d, POR);
    });
}

export async function criarGerenciaAction(chave: string, dados: { sigla: string; nome: string }) {
    return rodar(chave, async () => carteira.criarGerencia(z.object({ sigla: z.string().max(20), nome: z.string().max(120) }).parse(dados)));
}

export async function editarGerenciaAction(chave: string, g: string, dados: { sigla: string; nome: string }) {
    return rodar(chave, async () => carteira.editarGerencia(gerencia.parse(g), z.object({ sigla: z.string().max(20), nome: z.string().max(120) }).parse(dados)));
}

export async function definirGerenciaVisivelAction(chave: string, g: string, visivel: boolean) {
    return rodar(chave, async () => carteira.definirGerenciaVisivel(gerencia.parse(g), z.boolean().parse(visivel)));
}

export async function definirClienteAtivoAction(chave: string, clienteId: string, ativo: boolean) {
    return rodar(chave, async () => carteira.definirClienteAtivo(id.parse(clienteId), z.boolean().parse(ativo)));
}

export async function alinharClienteAction(chave: string, clienteId: string) {
    return rodar(chave, async () => carteira.alinharCliente(id.parse(clienteId), POR));
}

export async function ligarClienteAction(chave: string, tabela: carteira.TabelaComCliente, linhaId: string, clienteId: string) {
    return rodar(chave, async () => {
        const d = z.object({ tabela: z.enum(['contrato', 'proposta', 'cx', 'projects']), linhaId: id, clienteId: id }).parse({ tabela, linhaId, clienteId });
        return carteira.ligarCliente(d.tabela, d.linhaId, d.clienteId);
    });
}

export async function criarClienteAction(chave: string, dados: { nome: string; sigla: string | null }) {
    return rodar(chave, async () => carteira.criarCliente(z.object({ nome: z.string().max(200), sigla: z.string().max(40).nullable() }).parse(dados)));
}
```

- [ ] **Step 4:** `npx vitest run src/app/settings/carteiraActions.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/app/settings/carteiraActions.ts src/app/settings/carteiraActions.test.ts
git commit -m "feat(carteira): server actions do organograma com SETTINGS_KEY no servidor"
```

---

### Task 11: Actions antigas do /settings conferem a chave (D14)

**Files:**
- Modify: `src/app/settings/actions.ts`, `src/app/settings/orgChartActions.ts`, `src/app/settings/SettingsDashboard.tsx`, `src/app/settings/OrgChartEditor.tsx:329`, `src/app/settings/FaturamentoEditor.tsx:53`, `src/app/settings/actions.grcc.test.ts`
- Create: `src/app/settings/actions.chave.test.ts`

**Interfaces — Produces (assinaturas novas):** `saveCXData(chave, managerId, items)`, `saveVisitsData(chave, managerId, items)`, `saveChurnData(chave, managerId, items)`, `saveManagerData(chave, m)`, `cloneManager(chave, sourceId, newName)`, `saveFaturamento2025Action(chave, value)`, `saveOrgChart(chave, data)`. Sem chave válida: `throw new Error('Chave de administrador inválida.')` (os editores já tratam `throw` como erro de gravação).

- [ ] **Step 1: Inventário** — `grep -nE "^export async function" src/app/settings/actions.ts src/app/settings/orgChartActions.ts`. Toda função que **grava** entra na lista acima; as de leitura (`verifySettingsKey`, `getFaturamento2025Action`, `fetchOrgChart`) ficam como estão. Se o grep mostrar outra que grava, inclua-a igual.

- [ ] **Step 2: Teste que falha**

```ts
// src/app/settings/actions.chave.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import * as s from '@/db/schema';
import { saveCXData, saveVisitsData, saveChurnData, saveManagerData, cloneManager, saveFaturamento2025Action } from './actions';
import { saveOrgChart } from './orgChartActions';

beforeAll(async () => {
    process.env.SETTINGS_KEY = 'adm';
    await applyMigrations();
    await db.insert(s.managers).values({ id: 'g1', name: 'G', role: 'GRC1', avatarUrl: '', year: 2026, meta: 0, contratado: 0, forecastFinal: 0 });
});

const manager = { id: 'g1', name: 'Hack', role: 'GRC1', avatarUrl: '', year: 2026, meta: 0, contratado: 0, forecastFinal: 0, pipeline: { q1: { total: 0, projects: [] }, q2: { total: 0, projects: [] }, q3: { total: 0, projects: [] }, q4: { total: 0, projects: [] }, nao_mapeado: { total: 0, projects: [] } } };

describe('actions do /settings sem chave', () => {
    it.each([
        ['saveCXData', () => saveCXData('x', 'g1', [])],
        ['saveVisitsData', () => saveVisitsData('x', 'g1', [])],
        ['saveChurnData', () => saveChurnData('x', 'g1', [])],
        ['saveManagerData', () => saveManagerData('x', manager)],
        ['cloneManager', () => cloneManager('x', 'g1', 'Clone')],
        ['saveFaturamento2025Action', () => saveFaturamento2025Action('x', 1)],
        ['saveOrgChart', () => saveOrgChart('x', { director: { name: 'X' }, subdirectors: [], departments: [], version: '1' })],
    ])('%s recusa', async (_n, chamar) => {
        await expect(chamar()).rejects.toThrow('Chave de administrador inválida.');
    });
    it('nada foi gravado', async () => {
        expect((await db.select().from(s.managers))[0].name).toBe('G');
    });
});
```

- [ ] **Step 3:** `npx vitest run src/app/settings/actions.chave.test.ts` — Expected: FAIL (as actions gravam).

- [ ] **Step 4: Implementação** — em `actions.ts` e `orgChartActions.ts`:

```ts
import { chaveSettingsValida } from '@/lib/settings/chave';

function exigirChave(chave: string) {
    if (!chaveSettingsValida(chave)) throw new Error('Chave de administrador inválida.');
}
```

(Em `orgChartActions.ts` declare a mesma função local.) Acrescente `chave: string` como **primeiro** parâmetro de cada action da lista e chame `exigirChave(chave);` como **primeira linha**, antes do `try`. Exemplo:

```ts
export async function saveCXData(chave: string, managerId: string, items: CXItem[]) {
    exigirChave(chave);
    try {
        // ...corpo atual sem mudança...
```

Callers:
- `SettingsDashboard.tsx`: `import { lerChaveSettings } from './chaveLocal';` e
  - `cloneManager(lerChaveSettings(), sourceId, newName.trim())`
  - `saveManagerData(lerChaveSettings(), selectedManager)`, `saveCXData(lerChaveSettings(), selectedManager.id, …)`, `saveVisitsData(lerChaveSettings(), …)`, `saveChurnData(lerChaveSettings(), …)`
- `OrgChartEditor.tsx:329`: `await saveOrgChart(lerChaveSettings(), data);` (import de `./chaveLocal`).
- `FaturamentoEditor.tsx:53`: `await saveFaturamento2025Action(lerChaveSettings(), valToSave);` (import de `./chaveLocal`).
- `actions.grcc.test.ts`: `beforeAll` define `process.env.SETTINGS_KEY = 'adm'` e as chamadas viram `saveManagerData('adm', deb)` e `cloneManager('adm', 'grcc-debora', 'Clone')`.

- [ ] **Step 5:** `npx vitest run src/app/settings` — Expected: PASS. `npx tsc --noEmit` — Expected: sem erro (o compilador acha qualquer caller esquecido).
- [ ] **Step 6: Commit**

```bash
git add src/app/settings
git commit -m "fix(settings): actions de gravacao conferem a SETTINGS_KEY no servidor"
```

---

### Task 12: Gravações existentes respeitam a carteira

**Files:**
- Modify: `src/types/manager.ts`, `src/db/queries.ts` (mapeamento de projeto ~linha 30, `fetchCXByManager` ~114, `servedClients` ~87, `fetchManagersForClientMatch` ~379), `src/app/settings/actions.ts` (`saveManagerData`, `saveCXData`, `cloneManager`), `src/lib/planner-sync.ts:118-125,170-200`
- Create: `src/app/settings/actions.carteira.test.ts`, `src/lib/planner-sync.carteira.test.ts`

**Interfaces — Consumes:** `managerDaLinha`, `clientesAtendidosPorGerencia`, `listarClientesComCarteira`, `listarCards`, `casarCliente`, `cardDaGerencia`, `chaveDaCarteira`.

- [ ] **Step 1: Testes que falham**

```ts
// src/app/settings/actions.carteira.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { cenario } = await import('@/db/carteira.test-dados');
const { moverClientes } = await import('@/db/carteira');
const { saveManagerData, saveCXData, cloneManager } = await import('./actions');
const { fetchAllManagersFromDB, fetchCXByManager } = await import('@/db/queries');

beforeAll(() => { process.env.SETTINGS_KEY = 'adm'; return applyMigrations(); });
beforeEach(() => cenario(db));

describe('editor aberto com dado velho não desfaz a troca', () => {
    it('saveManagerData do card antigo não devolve nem duplica o projeto movido', async () => {
        const velho = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc3-barone')!;
        expect(velho.pipeline.q1.projects[0]).toMatchObject({ name: 'Projeto SMT', clienteId: 'c-smt' });
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        await saveManagerData('adm', velho);
        const projs = await db.select().from(s.projects).where(eq(s.projects.name, 'Projeto SMT'));
        expect(projs.map((p) => p.managerId)).toEqual(['grc4-beatriz']);
    });
    it('saveCXData do card antigo não devolve nem duplica o CX movido', async () => {
        const velhos = await fetchCXByManager('grc3-barone');
        expect(velhos[0].clienteId).toBe('c-smt');
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        await saveCXData('adm', 'grc3-barone', velhos);
        expect((await db.select().from(s.cx)).map((r) => r.managerId)).toEqual(['grc4-beatriz']);
    });
    it('projeto novo de cliente de outra carteira vai para o card da carteira', async () => {
        const bruno = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc1-bruno')!;
        bruno.pipeline.q2.projects.push({ name: 'Novo SME', value: 10, orgao: 'SME', clienteId: 'c-sme' });
        await saveManagerData('adm', bruno);
        expect((await db.select().from(s.projects).where(eq(s.projects.name, 'Novo SME')))[0].managerId).toBe('kam1-malde');
    });
});

describe('servedClients vem da carteira', () => {
    it('fetchAllManagersFromDB monta servedClients pela gerência; saveManagerData não grava served_clients', async () => {
        const barone = (await fetchAllManagersFromDB()).find((m) => m.id === 'grc3-barone')!;
        expect(barone.servedClients).toEqual(['SMT (Secretaria Municipal de Transportes)']);
        await saveManagerData('adm', { ...barone, servedClients: ['HACK'] });
        expect((await db.select().from(s.managers).where(eq(s.managers.id, 'grc3-barone')))[0].servedClients).toBeNull();
    });
    it('cloneManager não copia served_clients e mantém cliente_id', async () => {
        const { newId } = await cloneManager('adm', 'grc3-barone', 'Clone');
        const [card] = await db.select().from(s.managers).where(eq(s.managers.id, newId));
        expect(card.servedClients).toBeNull();
        expect((await db.select().from(s.projects).where(eq(s.projects.managerId, newId)))[0].clienteId).toBe('c-smt');
    });
});
```

```ts
// src/lib/planner-sync.carteira.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { cenario } = await import('@/db/carteira.test-dados');
const { moverClientes } = await import('@/db/carteira');
const { syncPlannerTasks } = await import('./planner-sync');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('Planner casa pela carteira', () => {
    it('tarefa existente de cliente movido vai para o card da carteira nova e grava cliente_id', async () => {
        await moverClientes(['c-smt'], 'GRC4', 'Admin');
        const r = await syncPlannerTasks([{ id: 'planner-1', title: 'SMT - Sistema', percentComplete: '0' } as never]);
        expect(r.updated).toBe(1);
        const [linha] = await db.select().from(s.cx);
        expect([linha.managerId, linha.clienteId]).toEqual(['grc4-beatriz', 'c-smt']);
    });
    it('sigla sem carteira fica em unmatched', async () => {
        const r = await syncPlannerTasks([{ id: 'p-2', title: 'SMC - Algo', percentComplete: '0' } as never]);
        expect(r.unmatched.map((u) => u.acronym)).toEqual(['SMC']);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/app/settings/actions.carteira.test.ts src/lib/planner-sync.carteira.test.ts` — Expected: FAIL.

- [ ] **Step 3: Tipos** — em `src/types/manager.ts`, acrescente a `Project` e a `CXItem`:

```ts
  /** Cliente da carteira (cliente.id). A gerência que grava é a da carteira dele. */
  clienteId?: string | null;
```

- [ ] **Step 4: Leitura (`src/db/queries.ts`)**
  - No mapeamento de projeto (`projects: quarterProjects.map((p) => ({`): acrescente `clienteId: p.clienteId ?? null,`.
  - Em `fetchCXByManager`: acrescente `clienteId: r.clienteId ?? null,`.
  - Em `fetchAllManagersFromDB`: antes do `return allManagers.map(`, `const atendidos = await clientesAtendidosPorGerencia();` e troque o bloco `servedClients: (() => { … })(),` por `servedClients: atendidos.get(chaveDaCarteira(m)) ?? [],`. Imports: `import { clientesAtendidosPorGerencia } from '@/db/carteira';` e `import { chaveDaCarteira } from '@/lib/carteira/gerencia';`.
  - **Remova** `fetchManagersForClientMatch` (o Planner deixa de usá-lo no Step 6; `grep -rn fetchManagersForClientMatch src` deve ficar vazio).

  Se aparecer import circular (`carteira.ts` importa `db/index`, não `queries.ts`; não deve haver), mova `clientesAtendidosPorGerencia` para chamada dinâmica `await import('@/db/carteira')`.

- [ ] **Step 5: Gravações (`src/app/settings/actions.ts`)** — imports: `import { managerDaLinha } from '@/db/carteira';`.
  - `saveManagerData`: remova `servedClientsJson` e o campo `servedClients` do insert e do `set`. No laço que monta `allProjectsToInsert`, troque o `push` direto por uma lista temporária e, depois do laço:

```ts
        // Projeto de cliente que está na carteira de OUTRA gerência vai para o card dela (= gerenciaDoComercialPelaCarteira).
        // Se lá já existe o mesmo projeto (mesmo nome e cliente), é a cópia velha de um editor aberto: descarta.
        for (const p of allProjectsToInsert) {
            const destino = await managerDaLinha(p.clienteId, m.id);
            if (destino === m.id) continue;
            const [igual] = await db.select({ id: projects.id }).from(projects)
                .where(and(eq(projects.managerId, destino), eq(projects.name, p.name), eq(projects.clienteId, p.clienteId)));
            p.managerId = igual ? null : destino;
        }
        const aGravar = allProjectsToInsert.filter((p) => p.managerId !== null);
        if (aGravar.length > 0) {
            await db.insert(projects).values(aGravar);
        }
```

    e no objeto do `push` acrescente `clienteId: proj.clienteId ?? null,` (remova o `if (allProjectsToInsert.length > 0) { insert }` antigo).
  - `saveCXData`: no `items.map(...)`, acrescente `clienteId: item.clienteId ?? null,` e troque `managerId,` pelo destino. Como o `map` é síncrono, monte antes:

```ts
        const linhas = [];
        for (const item of items) {
            const destino = await managerDaLinha(item.clienteId, managerId);
            if (destino !== managerId) {
                const jaLa = await db.select({ id: cx.id }).from(cx).where(and(eq(cx.managerId, destino),
                    item.externalId ? eq(cx.externalId, item.externalId) : and(eq(cx.titulo, item.titulo), eq(cx.clienteId, item.clienteId!))));
                if (jaLa.length) continue; // cópia velha de editor aberto
            }
            linhas.push({ item, destino });
        }
```

    e insira `linhas.map(({ item, destino }) => ({ managerId: destino, clienteId: item.clienteId ?? null, …demais campos atuais… }))`.
  - `cloneManager`: `servedClients: null,` no insert; no CX copiado acrescente `clienteId: rest.clienteId ?? null,` (os projetos já levam `clienteId` pelo `...rest`).

- [ ] **Step 6: Planner (`src/lib/planner-sync.ts`)** — troque o bloco que monta `clientToManager` por:

```ts
    // A carteira de clientes é a fonte (spec 2026-11-06 §6): sigla do título → cliente → gerência → card do ano.
    const [clientes, cards] = await Promise.all([listarClientesComCarteira(), listarCards()]);
    const clientToManager = new Map<string, { id: string; name: string; clienteId: string }>();
    for (const c of clientes) {
        if (!c.sigla || !c.gerencia) continue;
        const card = cardDaGerencia(cards, c.gerencia);
        const key = normalizeAcronym(c.sigla);
        if (card && !clientToManager.has(key)) clientToManager.set(key, { id: card.id, name: card.name, clienteId: c.id });
    }
```

  Imports: `import { listarCards, listarClientesComCarteira } from '@/db/carteira';`, `import { cardDaGerencia } from '@/lib/carteira/gerencia';`; remova o import de `fetchManagersForClientMatch`. No `tx.update(cx).set({` e no `tx.insert(cx).values({` acrescente `clienteId: match.clienteId,`. Atualize o comentário do topo da função: "via carteira de clientes" no lugar de "via servedClients acronym".

- [ ] **Step 7:** `npx vitest run src/app/settings src/lib/planner-sync.carteira.test.ts src/db` — Expected: PASS. `npx tsc --noEmit` — Expected: sem erro.
- [ ] **Step 8: Commit**

```bash
git add src/types/manager.ts src/db/queries.ts src/app/settings/actions.ts src/lib/planner-sync.ts src/app/settings/actions.carteira.test.ts src/lib/planner-sync.carteira.test.ts
git commit -m "feat(carteira): pipeline, CX, clone e Planner gravam pela carteira; served_clients congelado"
```

---

### Task 13: Contratos, propostas e API externa pela carteira

**Files:**
- Modify: `src/app/contracts/actions.ts`, `src/app/proposals/actions.ts`, `src/app/contracts/components/ContractModal.tsx`, `src/app/proposals/components/ProposalModal.tsx`, `src/app/api/external/v1/grc/cx/route.ts`, `src/app/api/external/v1/grc/projects/route.ts`, `src/app/api/external/v1/grc/sync/route.ts`
- Create: `src/app/contracts/actions.carteira.test.ts`, `src/lib/carteira/linha.ts`, `src/lib/carteira/linha.test.ts`

**Interfaces — Produces:** `src/lib/carteira/linha.ts`: `clienteDaLinha(texto: string|null|undefined, managerId: string|null): Promise<string|null>` (casa o texto pela regra da Task 4 entre os clientes do banco, preferindo a gerência do card). `clientesParaEscolha(): Promise<Array<{ id; nome; sigla }>>` em `src/db/carteira.ts` (ativos, por nome).

- [ ] **Step 1: Testes que falham**

```ts
// src/lib/carteira/linha.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { cenario } from '@/db/carteira.test-dados';
import { clienteDaLinha } from './linha';

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('clienteDaLinha', () => {
    it('casa pela sigla, pela sigla citada e pelo nome; nada casa → null', async () => {
        expect(await clienteDaLinha('SMT', 'grc3-barone')).toBe('c-smt');
        expect(await clienteDaLinha('Secretaria Municipal de Cultura', null)).toBe('c-smc');
        expect(await clienteDaLinha('Prefeitura de Valinhos', null)).toBeNull();
    });
});
```

```ts
// src/app/contracts/actions.carteira.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cenario } from '@/db/carteira.test-dados';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const { createContratoAction, updateContratoAction } = await import('./actions');
const { createPropostaAction } = await import('@/app/proposals/actions');

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('contrato e proposta com cliente em carteira', () => {
    it('update: gerência e gerente da carteira por cima do formulário', async () => {
        await updateContratoAction('ct-smt', { managerId: 'grc1-bruno', gerencia: 'GRC-1', nomeGerente: 'Bruno', objeto: 'editado' });
        expect((await db.select().from(s.contrato).where(eq(s.contrato.id, 'ct-smt')))[0]).toMatchObject({ managerId: 'grc3-barone', gerencia: 'GRC-3', nomeGerente: 'Barone', objeto: 'editado' });
    });
    it('create: casa o cliente pelo texto e usa a carteira; sem carteira vale o formulário', async () => {
        await createContratoAction({ id: 'ct-novo', numeroContrato: '2/2026', cliente: 'SME', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
        expect((await db.select().from(s.contrato).where(eq(s.contrato.id, 'ct-novo')))[0]).toMatchObject({ clienteId: 'c-sme', managerId: 'kam1-malde', gerencia: 'KAM-1' });
        await createPropostaAction({ id: 'pr-novo', numeroProposta: 'P9', nomeOportunidade: 'X', cliente: 'SMC', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
        expect((await db.select().from(s.proposta).where(eq(s.proposta.id, 'pr-novo')))[0]).toMatchObject({ clienteId: 'c-smc', managerId: 'grc1-bruno', gerencia: 'GRC-1' });
    });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/carteira/linha.test.ts src/app/contracts/actions.carteira.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação**

```ts
// src/lib/carteira/linha.ts
// Cliente de uma linha nova/editada (contrato, proposta, CX, projeto) pelo texto, com a regra do casamento.
import { listarCards, listarClientesComCarteira } from '@/db/carteira';
import { casarCliente } from './casar-cliente';
import { chaveDaCarteira } from './gerencia';

export async function clienteDaLinha(texto: string | null | undefined, managerId: string | null): Promise<string | null> {
    const [clientes, cards] = await Promise.all([listarClientesComCarteira(), listarCards()]);
    const card = managerId ? cards.find((c) => c.id === managerId) : undefined;
    return casarCliente(texto, clientes, card ? chaveDaCarteira(card) : null);
}
```

Em `src/db/carteira.ts`:

```ts
export async function clientesParaEscolha(): Promise<Array<{ id: string; nome: string; sigla: string | null }>> {
    return db.select({ id: cliente.id, nome: cliente.nome, sigla: cliente.sigla }).from(cliente).where(eq(cliente.ativo, true)).orderBy(cliente.nome);
}
```

`src/app/contracts/actions.ts` — imports `gerenciaPelaCarteira`, `clientesParaEscolha` de `@/db/carteira`, `clienteDaLinha` de `@/lib/carteira/linha`, `fetchContratoById` de `@/db/queries`. Função local e uso:

```ts
/** = gerenciaDoComercialPelaCarteira: com cliente em carteira, gerência e gerente vêm dela, por cima do formulário. */
async function comCarteira<T extends Partial<typeof contrato.$inferInsert>>(data: T, clienteId: string | null): Promise<T> {
    const g = await gerenciaPelaCarteira(clienteId);
    return g ? { ...data, clienteId, managerId: g.managerId, gerencia: g.gerencia, nomeGerente: g.nomeGerente } : { ...data, clienteId };
}

export async function listarClientesAction() {
    return clientesParaEscolha();
}
```

  - `createContratoAction`: `const clienteId = data.clienteId ?? (await clienteDaLinha(data.cliente, data.managerId ?? null));` e grave `await createContrato({ ...(await comCarteira(data, clienteId)), id: data.id || crypto.randomUUID() });`.
  - `updateContratoAction`: `const atual = await fetchContratoById(id); const clienteId = data.clienteId !== undefined ? data.clienteId : (atual as { clienteId?: string | null } | undefined)?.clienteId ?? null;` e `await updateContrato(id, await comCarteira(data, clienteId));`. Se `fetchContratoById` não devolver `clienteId`, acrescente `clienteId: contrato.clienteId` ao `select` dela e ao tipo `ContratoRow` (`clienteId: string | null`); faça o mesmo em `fetchAllContratos` e `fetchContratoByNumero`.

`src/app/proposals/actions.ts` — igual, sem `nomeGerente`:

```ts
async function comCarteira<T extends Partial<typeof proposta.$inferInsert>>(data: T, clienteId: string | null): Promise<T> {
    const g = await gerenciaPelaCarteira(clienteId);
    return g ? { ...data, clienteId, managerId: g.managerId, gerencia: g.gerencia } : { ...data, clienteId };
}
```

  com `fetchPropostaById` — se não existir em `queries.ts`, crie seguindo `fetchContratoById` (`select … from proposta where id = ?`), e acrescente `clienteId` ao tipo `PropostaRow` e aos selects de propostas.

Modais (`ContractModal.tsx`, `ProposalModal.tsx`): carregue a lista com `listarClientesAction()` num `useEffect`, e acima do campo de texto do cliente acrescente um `<select>` "Cliente da carteira" (`value={form.clienteId ?? ''}`; opção vazia "— casar pelo texto —"; opções `sigla ? \`${sigla} · ${nome}\` : nome`). Ao escolher, `set('clienteId', valor || null)` e, se o campo de texto estiver vazio, preencha com a sigla. Envie `clienteId` no payload. Abaixo do campo gerência mostre `<p className="text-xs text-zinc-500">Com cliente na carteira, a gerência e o gerente são os da carteira.</p>`. Mesmo estilo dos `<select>` já existentes no modal.

API:
- `grc/cx/route.ts` POST: antes do `createCXItem`, `const clienteId = await clienteDaLinha(cliente, managerId); const destino = await managerDaLinha(clienteId, managerId);` e grave `managerId: destino, clienteId`.
- `grc/projects/route.ts` POST: idem com `orgao`.
- `grc/sync/route.ts`: no `insert` de `cx` e de `projects` (só projetos, nunca `leadGrccId`), calcule `clienteId` com `clienteDaLinha(item.cliente | item.orgao, managerId)` e `managerId: await managerDaLinha(clienteId, managerId)`; no `update` acrescente só `clienteId` (o `where … managerId` continua).

- [ ] **Step 4:** `npx vitest run src/lib/carteira src/app/contracts src/app/proposals src/app/api` — Expected: PASS (inclui os testes antigos da API, se existirem). `npx tsc --noEmit` — Expected: sem erro.
- [ ] **Step 5: Commit**

```bash
git add src/lib/carteira/linha.ts src/lib/carteira/linha.test.ts src/db/carteira.ts src/db/queries.ts src/app/contracts src/app/proposals src/app/api/external/v1/grc
git commit -m "feat(carteira): contratos, propostas e API externa gravam cliente_id e a gerencia da carteira"
```

---

### Task 14: Carga inicial

**Files:**
- Create: `src/db/carteira-seed.ts`, `src/db/carteira-seed.test.ts`, `scripts/carteira/seed-carteira.ts`

**Interfaces — Produces:** `interface RelatorioCarga { clientesCriados: number; naCarteira: number; duplicados: Array<{ sigla: string; ficou: string; perdeu: string }>; ligados: Record<'contrato'|'proposta'|'cx'|'projects', number>; criadosSemCarteira: string[]; fora: ForaDaCarteira[] }`, `semearCarteira(): Promise<RelatorioCarga>`.

- [ ] **Step 1: Teste que falha**

```ts
// src/db/carteira-seed.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTransactionSafeTestDb } from '@/db/test-utils';

const { db, applyMigrations } = await createTransactionSafeTestDb();
const s = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { semearCarteira } = await import('./carteira-seed');

beforeAll(applyMigrations);
beforeEach(async () => {
    for (const t of [s.movimentoCarteira, s.carteiraCliente, s.contrato, s.proposta, s.cx, s.projects, s.cliente, s.managers]) await db.delete(t);
    const base = { avatarUrl: '', meta: 0, contratado: 0, forecastFinal: 0, year: 2026 };
    await db.insert(s.managers).values([
        { ...base, id: 'grc1-bruno', name: 'Bruno', role: 'GRC1', servedClients: JSON.stringify(['PGM (Procuradoria Geral do Município)', 'SEME (Secretaria Municipal de Esportes e Lazer)']) },
        { ...base, id: 'grc4-beatriz', name: 'Beatriz', role: 'GRC4', servedClients: JSON.stringify(['Ouvidoria Geral do Município']) },
        { ...base, id: 'kam3-andrea', name: 'Andrea', role: 'KAM3', servedClients: JSON.stringify(['SEGES (Secretaria de Gestão)']) },
        { ...base, id: 'kam3-gercino-teste', name: 'Teste', role: 'KAM10', showInDashboard: false, servedClients: JSON.stringify(['SEGES (Secretaria de Gestão)']) },
        { ...base, id: 'grcc-debora', name: 'Débora', role: 'GRCC', servedClients: JSON.stringify(['SES PE (Secretaria de Saúde de Pernambuco)']) },
    ]);
    await db.insert(s.contrato).values([
        { id: 'c1', numeroContrato: '1', cliente: 'PGM', managerId: 'grc1-bruno', gerencia: 'GRC-1' },
        { id: 'c2', numeroContrato: '2', cliente: 'SEME', managerId: 'grc4-beatriz', gerencia: 'GRC-4' },
        { id: 'c3', numeroContrato: '3', cliente: 'ALESP', managerId: 'grc4-beatriz', gerencia: 'GRC-4' },
    ]);
    await db.insert(s.proposta).values([{ id: 'p1', numeroProposta: 'P1', nomeOportunidade: 'X', cliente: 'Procuradoria Geral do Município - PGM', managerId: 'grc1-bruno' }]);
    await db.insert(s.projects).values([
        { managerId: 'grcc-debora', quarter: 'q1', orgao: 'Prefeitura de Betim', name: 'Lead', value: 1, leadGrccId: 7 },
        { managerId: 'grc1-bruno', quarter: 'q1', orgao: 'Câmara de Osasco', name: 'Manual', value: 1 },
    ]);
});

describe('semearCarteira', () => {
    it('clientes e carteira do served_clients; duplicata fica no card visível', async () => {
        const r = await semearCarteira();
        expect(r.naCarteira).toBe(5);
        expect(r.duplicados).toEqual([{ sigla: 'SEGES', ficou: 'KAM3', perdeu: 'KAM10' }]);
        const ouv = (await db.select().from(s.cliente).where(eq(s.cliente.nome, 'Ouvidoria Geral do Município')))[0];
        expect(ouv.sigla).toBeNull();
    });
    it('liga as linhas, cria cliente sem carteira para o que não casou, ignora lead GRCC e não move nada', async () => {
        const r = await semearCarteira();
        const contratos = await db.select().from(s.contrato);
        expect(contratos.every((c) => c.clienteId)).toBe(true);
        expect(contratos.find((c) => c.id === 'c2')!.managerId).toBe('grc4-beatriz'); // não move
        expect((await db.select().from(s.proposta))[0].clienteId).toBe(contratos.find((c) => c.id === 'c1')!.clienteId);
        const projs = await db.select().from(s.projects);
        expect(projs.find((p) => p.name === 'Lead')!.clienteId).toBeNull();
        expect(projs.find((p) => p.name === 'Manual')!.clienteId).toBeTruthy();
        expect(r.criadosSemCarteira.sort()).toEqual(['ALESP', 'Câmara de Osasco']);
        expect(r.fora.map((f) => f.sigla)).toEqual(['SEME']);
        expect(r.ligados).toEqual({ contrato: 3, proposta: 1, cx: 0, projects: 1 });
    });
    it('idempotente', async () => {
        await semearCarteira();
        const segunda = await semearCarteira();
        expect(segunda.clientesCriados).toBe(0);
        expect(await db.select().from(s.cliente)).toHaveLength(7);
    });
});
```

- [ ] **Step 2:** `npx vitest run src/db/carteira-seed.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementação**

```ts
// src/db/carteira-seed.ts
// Carga inicial da carteira (spec 2026-11-06 §4). Idempotente. NÃO move dado nenhum (D12).
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, contrato, cx, managers, projects, proposta } from '@/db/schema';
import { siglaComparavel } from '@/lib/integracao/chaves';
import { casarCliente, clienteDoServedClient } from '@/lib/carteira/casar-cliente';
import { chaveDaCarteira } from '@/lib/carteira/gerencia';
import { foraDaCarteira, listarClientesComCarteira, type ForaDaCarteira } from './carteira';

export interface RelatorioCarga {
    clientesCriados: number;
    naCarteira: number;
    duplicados: Array<{ sigla: string; ficou: string; perdeu: string }>;
    ligados: Record<'contrato' | 'proposta' | 'cx' | 'projects', number>;
    criadosSemCarteira: string[];
    fora: ForaDaCarteira[];
}

const agora = () => new Date().toISOString();
const chaveDoCliente = (c: { nome: string; sigla: string | null }) => siglaComparavel(c.sigla ?? c.nome);

export async function semearCarteira(): Promise<RelatorioCarga> {
    const r: RelatorioCarga = { clientesCriados: 0, naCarteira: 0, duplicados: [], ligados: { contrato: 0, proposta: 0, cx: 0, projects: 0 }, criadosSemCarteira: [], fora: [] };
    const cards = (await db.select().from(managers)).sort((a, b) => Number(b.showInDashboard) - Number(a.showInDashboard) || b.year - a.year || a.id.localeCompare(b.id));
    const existentes = new Map((await db.select().from(cliente)).map((c) => [chaveDoCliente(c), c.id]));
    const naCarteira = new Map((await db.select().from(carteiraCliente)).map((c) => [c.clienteId, c.gerencia]));

    async function garantirCliente(nome: string, sigla: string | null): Promise<string> {
        const k = chaveDoCliente({ nome, sigla });
        const ja = existentes.get(k);
        if (ja) return ja;
        const id = crypto.randomUUID();
        await db.insert(cliente).values({ id, nome, sigla, createdAt: agora() });
        existentes.set(k, id);
        r.clientesCriados++;
        return id;
    }

    // 1. served_clients → cliente + carteira (card visível primeiro: ele ganha a duplicata).
    for (const card of cards) {
        let itens: string[] = [];
        try { itens = card.servedClients ? JSON.parse(card.servedClients) : []; } catch { itens = []; }
        const chave = chaveDaCarteira(card);
        for (const item of itens) {
            const { nome, sigla } = clienteDoServedClient(item);
            const id = await garantirCliente(nome, sigla);
            const atual = naCarteira.get(id);
            if (atual && atual !== chave) {
                if (!r.duplicados.some((d) => d.sigla === (sigla ?? nome))) r.duplicados.push({ sigla: sigla ?? nome, ficou: atual, perdeu: chave });
                continue;
            }
            if (!atual) {
                await db.insert(carteiraCliente).values({ clienteId: id, gerencia: chave, movidoEm: agora(), movidoPor: 'Carga inicial' });
                naCarteira.set(id, chave);
            }
        }
    }
    r.naCarteira = naCarteira.size;

    // 2–3. cliente_id nas linhas manuais sem cliente; o que não casa vira cliente sem carteira.
    const chaveDoCard = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    async function ligar(texto: string | null, managerId: string | null): Promise<string | null> {
        if (!texto?.trim()) return null;
        const clientes = await listarClientesComCarteira();
        const achado = casarCliente(texto, clientes, managerId ? chaveDoCard.get(managerId) : null);
        if (achado) return achado;
        const t = texto.trim();
        const pareceSigla = /^\S+$/.test(t) && t === t.toUpperCase();
        const id = await garantirCliente(t, pareceSigla ? t : null);
        if (!r.criadosSemCarteira.includes(t)) r.criadosSemCarteira.push(t);
        return id;
    }

    for (const l of await db.select().from(contrato).where(isNull(contrato.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(contrato).set({ clienteId: id }).where(eq(contrato.id, l.id)); r.ligados.contrato++; }
    }
    for (const l of await db.select().from(proposta).where(isNull(proposta.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(proposta).set({ clienteId: id }).where(eq(proposta.id, l.id)); r.ligados.proposta++; }
    }
    for (const l of await db.select().from(cx).where(isNull(cx.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(cx).set({ clienteId: id }).where(eq(cx.id, l.id)); r.ligados.cx++; }
    }
    for (const l of await db.select().from(projects).where(and(isNull(projects.clienteId), isNull(projects.leadGrccId)))) {
        const id = await ligar(l.orgao, l.managerId);
        if (id) { await db.update(projects).set({ clienteId: id }).where(eq(projects.id, l.id)); r.ligados.projects++; }
    }

    // 4. Relatório: quem já está fora da carteira (não move — D12).
    r.fora = await foraDaCarteira();
    return r;
}
```

```ts
// scripts/carteira/seed-carteira.ts
// Uso: npx tsx scripts/carteira/seed-carteira.ts   (usa TURSO_DATABASE_URL do .env/.env.development)
// Rode primeiro numa CÓPIA local; produção só com ordem explícita do usuário.
import { config } from 'dotenv';
import { existsSync } from 'fs';

config({ path: '.env' });
if ((process.env.NODE_ENV ?? 'development') !== 'production' && existsSync('.env.development')) config({ path: '.env.development', override: true });

async function main() {
    console.log(`→ carga da carteira em ${process.env.TURSO_DATABASE_URL}`);
    const { semearCarteira } = await import('../../src/db/carteira-seed');
    const r = await semearCarteira();
    console.log(JSON.stringify({ ...r, fora: r.fora.map((f) => `${f.sigla ?? f.nome}: carteira ${f.carteira}, dados em ${f.gerenciasDosDados.join(', ')}`) }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
```

  (Se `tsx` não resolver o alias `@/` do `src/db/carteira-seed.ts`, confira `tsconfig.json` `paths` — `tsx` lê o `tsconfig`. Os scripts existentes em `scripts/` mostram o padrão; siga-o.)

- [ ] **Step 4:** `npx vitest run src/db/carteira-seed.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/db/carteira-seed.ts src/db/carteira-seed.test.ts scripts/carteira/seed-carteira.ts
git commit -m "feat(carteira): carga inicial idempotente a partir do served_clients (nao move dados)"
```

---

### Task 15: Peças de UI

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`, `src/components/ui/popover.tsx` (cópia da `login`), `src/components/ui/confirm-dialog.tsx`, `src/components/ui/notice.tsx`, `src/components/ui/combobox.tsx`, `src/components/ui/combobox.test.tsx`

**Interfaces — Produces:**
- `ConfirmDialog({ aberto, titulo, descricao, rotuloConfirmar, tom?: 'principal'|'perigo', aoConfirmar, aoCancelar })`
- `Notice({ tom: 'sucesso'|'perigo', children })` com `role="alert"` no tom perigo e `role="status"` no sucesso
- `Combobox<T>({ rotulo, placeholder, valor, aoMudarTexto, opcoes: T[], chave: (t) => string, rotuloDe: (t) => string, aoEscolher: (t) => void, vazio: string, desabilitado?: boolean })`

- [ ] **Step 1: Copiar da `login`**

```bash
git show login:src/components/ui/dropdown-menu.tsx > src/components/ui/dropdown-menu.tsx
git show login:src/components/ui/popover.tsx > src/components/ui/popover.tsx
```

  Confira que os imports deles (`radix-ui`, `@/lib/utils`) existem na `main` (`grep -n "from" src/components/ui/dropdown-menu.tsx`); `radix-ui` está no `package.json`.

- [ ] **Step 2: Teste do combobox que falha**

```tsx
// src/components/ui/combobox.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from './combobox';

function Teste({ aoEscolher }: { aoEscolher: (s: string) => void }) {
    const [t, setT] = useState('');
    const opcoes = ['SME', 'SMS', 'SMT'].filter((o) => o.toLowerCase().includes(t.toLowerCase()));
    return <Combobox rotulo="Cliente" placeholder="Buscar" valor={t} aoMudarTexto={setT} opcoes={opcoes} chave={(o) => o} rotuloDe={(o) => o} aoEscolher={aoEscolher} vazio="Nada" />;
}

describe('Combobox', () => {
    it('filtra, escolhe com clique e mostra vazio', async () => {
        const escolher = vi.fn();
        const user = userEvent.setup();
        render(<Teste aoEscolher={escolher} />);
        await user.type(screen.getByRole('combobox', { name: 'Cliente' }), 'smt');
        await user.click(screen.getByRole('option', { name: 'SMT' }));
        expect(escolher).toHaveBeenCalledWith('SMT');
        await user.clear(screen.getByRole('combobox', { name: 'Cliente' }));
        await user.type(screen.getByRole('combobox', { name: 'Cliente' }), 'zzz');
        expect(screen.getByText('Nada')).toBeInTheDocument();
    });
});
```

- [ ] **Step 3:** `npx vitest run src/components/ui/combobox.test.tsx` — Expected: FAIL.

- [ ] **Step 4: Implementação**

```tsx
// src/components/ui/combobox.tsx
'use client';
import { useId, useState } from 'react';
import { Input } from './input';

interface Props<T> {
    rotulo: string;
    placeholder: string;
    valor: string;
    aoMudarTexto: (t: string) => void;
    opcoes: T[];
    chave: (t: T) => string;
    rotuloDe: (t: T) => string;
    aoEscolher: (t: T) => void;
    vazio: string;
    desabilitado?: boolean;
}

export function Combobox<T>({ rotulo, placeholder, valor, aoMudarTexto, opcoes, chave, rotuloDe, aoEscolher, vazio, desabilitado }: Props<T>) {
    const id = useId();
    const [aberto, setAberto] = useState(false);
    return (
        <div className="relative">
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">{rotulo}</label>
            <Input
                id={id}
                role="combobox"
                aria-expanded={aberto}
                aria-controls={`${id}-lista`}
                value={valor}
                placeholder={placeholder}
                disabled={desabilitado}
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
                onChange={(e) => { aoMudarTexto(e.target.value); setAberto(true); }}
            />
            {aberto && (
                <ul id={`${id}-lista`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                    {opcoes.length === 0 && <li className="px-3 py-1.5 text-sm text-zinc-500">{vazio}</li>}
                    {opcoes.map((o) => (
                        <li
                            key={chave(o)}
                            role="option"
                            aria-selected={false}
                            className="cursor-pointer px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { aoEscolher(o); setAberto(false); }}
                        >
                            {rotuloDe(o)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

```tsx
// src/components/ui/confirm-dialog.tsx
'use client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

interface Props {
    aberto: boolean;
    titulo: string;
    descricao: string;
    rotuloConfirmar: string;
    tom?: 'principal' | 'perigo';
    aoConfirmar: () => void | Promise<void>;
    aoCancelar: () => void;
}

export function ConfirmDialog({ aberto, titulo, descricao, rotuloConfirmar, tom = 'perigo', aoConfirmar, aoCancelar }: Props) {
    return (
        <Dialog open={aberto} onOpenChange={(a) => { if (!a) aoCancelar(); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                    <DialogDescription className="text-zinc-400">{descricao}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={aoCancelar}>Cancelar</Button>
                    <Button variant={tom === 'perigo' ? 'destructive' : 'default'} onClick={() => void aoConfirmar()}>{rotuloConfirmar}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

```tsx
// src/components/ui/notice.tsx
import type { ReactNode } from 'react';

export function Notice({ tom, children }: { tom: 'sucesso' | 'perigo'; children: ReactNode }) {
    const cor = tom === 'sucesso' ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-red-500/50 bg-red-500/10 text-red-400';
    return <div role={tom === 'perigo' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-2 text-sm ${cor}`}>{children}</div>;
}
```

  Confira os nomes das variantes em `src/components/ui/button.tsx` (`outline`, `destructive`, `default`); se diferirem, use os que existem.

- [ ] **Step 5:** `npx vitest run src/components/ui` — Expected: PASS. `npx tsc --noEmit` — Expected: sem erro.
- [ ] **Step 6: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): combobox, dialogo de confirmacao, aviso, dropdown-menu e popover"
```

---

### Task 16: Quadro do organograma de clientes

**Files:**
- Create: `src/components/organograma-clientes/cartao.tsx`, `src/components/organograma-clientes/quadro.tsx`, `src/components/organograma-clientes/quadro.test.tsx`

**Interfaces — Consumes:** Task 5, Task 15. **Produces:**
- `cartao.tsx`: `interface Mover { pedir(cliente, de, para): void; comecarArraste(cliente, de): void; terminarArraste(): void; destinos: CartaoDoOrganograma[] }`, `interface Alvo`, `propsDoAlvo(alvo)`, `ItemDoCliente`, `CartaoDaGerencia`, `ListaDeClientes` — porte de `aibertinho/src/modulos/gerencias/componentes/organograma-clientes-cartao.tsx`.
- `quadro.tsx`: `OrganogramaClientesView({ dados: OrganogramaClientes; podeMover: boolean; moverAction?: (clienteId: string, de: string|null, para: string|null) => Promise<Resultado<{ movidos: number }>>; aoMudar?: () => void })`.

- [ ] **Step 1: Teste que falha (porte de `aibertinho/.../organograma-clientes.test.tsx`)**

```tsx
// src/components/organograma-clientes/quadro.test.tsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganogramaClientesView } from './quadro';
import { montarOrganograma, type GerenciaDoOrganograma } from '@/lib/carteira/organograma-clientes';

const cli = (id: string, sigla: string, nome: string) => ({ id, sigla, nome, ultimoMovimento: null });
const gerencias: GerenciaDoOrganograma[] = [
    { id: 'KAM1', nome: 'KAM1', sigla: 'KAM1', ativa: true, gerentes: ['Malde'], clientes: [cli('c-sme', 'SME', 'Secretaria Municipal da Educação')] },
    { id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [cli('c-smt', 'SMT', 'Secretaria Municipal de Transportes')] },
    { id: 'GRC4', nome: 'GRC4', sigla: 'GRC4', ativa: true, gerentes: ['Beatriz'], clientes: [] },
];
const dados = montarOrganograma(gerencias, [cli('c-smc', 'SMC', 'Secretaria Municipal de Cultura')]);
const cartao = (nome: RegExp) => screen.getByRole('region', { name: nome });
const mover = vi.fn();
const aoMudar = vi.fn();

beforeEach(() => mover.mockResolvedValue({ ok: true, valor: { movidos: 1 } }));

describe('OrganogramaClientesView', () => {
    it('cartões, clientes, total e legenda', () => {
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        expect(within(cartao(/^Barone/)).getByText('SMT')).toBeInTheDocument();
        expect(screen.getByText('órgãos atendidos').parentElement).toHaveTextContent('2');
        expect(screen.getByText('KAM, contas-chave')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Sem carteira' })).toHaveTextContent('SMC');
    });
    it('busca sem acento no quadro todo', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        await user.type(screen.getByRole('searchbox', { name: 'Buscar cliente' }), 'educacao');
        expect(within(cartao(/^Malde/)).getByText('SME')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /^Barone/ })).not.toBeInTheDocument();
        expect(screen.getByText('1 cliente(s) encontrado(s).')).toBeInTheDocument();
    });
    it('só leitura: sem menu nem arraste', () => {
        render(<OrganogramaClientesView dados={dados} podeMover={false} />);
        expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
        expect(within(cartao(/^Barone/)).getByText('SMT').closest('li')).toHaveAttribute('draggable', 'false');
    });
    it('admin: menu → confirma → grava → Desfazer', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: /GRC4 · Beatriz/ }));
        expect(screen.getByRole('dialog')).toHaveTextContent('Mover SMT de GRC3 para GRC4?');
        await user.click(screen.getByRole('button', { name: 'Mover' }));
        await waitFor(() => expect(mover).toHaveBeenCalledWith('c-smt', 'GRC3', 'GRC4'));
        expect(aoMudar).toHaveBeenCalled();
        expect(await screen.findByText(/SMT foi de GRC3 para GRC4/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Desfazer' }));
        await waitFor(() => expect(mover).toHaveBeenLastCalledWith('c-smt', 'GRC4', 'GRC3'));
    });
    it('cancelar não grava; erro aparece', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Tirar da carteira' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(mover).not.toHaveBeenCalled();
        mover.mockResolvedValue({ ok: false, erro: 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.' });
        await user.click(screen.getByRole('button', { name: 'Mover SMT' }));
        await user.click(await screen.findByRole('menuitem', { name: /GRC4/ }));
        await user.click(screen.getByRole('button', { name: 'Mover' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('mudou de carteira');
        expect(aoMudar).toHaveBeenCalled();
    });
    it('arrastar de "Sem carteira" para um cartão pede a confirmação', () => {
        render(<OrganogramaClientesView dados={dados} podeMover moverAction={mover} aoMudar={aoMudar} />);
        const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
        fireEvent.dragStart(within(screen.getByRole('region', { name: 'Sem carteira' })).getByText('SMC').closest('li')!, { dataTransfer });
        fireEvent.dragOver(cartao(/^Beatriz/), { dataTransfer });
        fireEvent.drop(cartao(/^Beatriz/), { dataTransfer });
        expect(screen.getByRole('dialog')).toHaveTextContent('Mover SMC de Sem carteira para GRC4?');
    });
});
```

- [ ] **Step 2:** `npx vitest run src/components/organograma-clientes/quadro.test.tsx` — Expected: FAIL.

- [ ] **Step 3: `cartao.tsx`** — copie `C:\projeto\aibertinho\src\modulos\gerencias\componentes\organograma-clientes-cartao.tsx` e troque só:
  - imports: `Button` → `@/components/ui/button`; `DropdownMenu*` → `@/components/ui/dropdown-menu`; `cn` → `@/lib/utils`; regras → `@/lib/carteira/organograma-clientes`; remova `Selo` e `formatarData`.
  - `TIPO_DO_ARRASTE = 'application/x-dashboard-cliente'`.
  - `dicaDoCliente`: `return \`${base}\nÚltima mudança de carteira em ${new Date(c.ultimoMovimento.em).toLocaleDateString('pt-BR')}\`;`
  - Botão "…": `variant="ghost" size="icon"`.
  - Selo "Desativada": `<span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[11px] text-amber-400">Desativada</span>`.
  - Classes de token do AIBertinho → zinc: `text-grafico` → `text-xs`, `text-foreground` → `text-zinc-100`, `text-muted-foreground` → `text-zinc-400`, `bg-muted` → `bg-zinc-800`, `hover:bg-muted/60` → `hover:bg-zinc-800/60`, `bg-destaque-suave ring-2 ring-destaque` → `bg-indigo-500/10 ring-2 ring-indigo-500`, `border` → `border border-zinc-700`.

- [ ] **Step 4: `quadro.tsx`** — copie `C:\projeto\aibertinho\src\modulos\gerencias\componentes\organograma-clientes.tsx` com estas trocas:
  - Props: `{ dados, podeMover, moverAction, aoMudar }` (sem `useRouter`; sem import da action).
  - `gravar`:

```tsx
    async function gravar(m: Movimento, depois: (ok: boolean) => void) {
        if (!moverAction) return;
        setErro(null);
        setOcupado(true);
        const r = await moverAction(m.cliente.id, m.de, m.para);
        if (!r.ok) setErro(r.erro);
        depois(r.ok);
        setOcupado(false);
        aoMudar?.();
    }
```

    com `const [ocupado, setOcupado] = useState(false);` no lugar do `useTransition` (`atualizando` → `ocupado`).
  - `const mover: Mover | undefined = podeMover && moverAction ? { … } : undefined;`
  - `Aviso` → `Notice` (`tom="perigo"`/`"sucesso"`); `DialogoConfirmar` → `ConfirmDialog` (`aberto`, `titulo="Mudar de carteira"`, `rotuloConfirmar="Mover"`, `tom="principal"`); `CampoBusca` → `<Input type="search" aria-label="Buscar cliente" placeholder="Buscar cliente por sigla ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />`; `chaveDeBusca` → função local `const chaveDeBusca = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();`.
  - Texto do modo leitura: `'Só leitura: quem muda clientes de carteira é o admin, em Configurações.'`.
  - Mesmas trocas de classe da Step 3; título `text-titulo-pagina` → `text-2xl font-bold`, caixa "órgãos atendidos" com `border-indigo-500/40 bg-indigo-500/10` e `text-indigo-400`; cabeçalho da coluna usa `COR_DO_GRUPO[g].cabecalho` (já zinc/indigo/emerald/amber da Task 5).
  - `AVISO_LEVA_TUDO` de `@/lib/carteira/tipos`.

- [ ] **Step 5:** `npx vitest run src/components/organograma-clientes` — Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add src/components/organograma-clientes
git commit -m "feat(carteira): quadro do organograma de clientes com mover, desfazer e arrastar"
```

---

### Task 17: Seção "Organograma de clientes" no /settings

**Files:**
- Create: `src/components/organograma-clientes/admin.tsx`, `src/components/organograma-clientes/editor-gerencia.tsx`, `src/components/organograma-clientes/a-conferir.tsx`, `src/components/organograma-clientes/admin.test.tsx`
- Modify: `src/app/settings/SettingsDashboard.tsx`, `src/app/settings/ManagerEditor.tsx:287-295`

**Interfaces — Consumes:** Task 10 (actions), Task 15, Task 16. **Produces:** `OrganogramaClientesAdmin()` (sem props; lê a chave com `lerChaveSettings`).

- [ ] **Step 1: Teste que falha**

```tsx
// src/components/organograma-clientes/admin.test.tsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { montarOrganograma } from '@/lib/carteira/organograma-clientes';

const a = vi.hoisted(() => ({
    carregarPainelCarteiraAction: vi.fn(), moverClienteNoOrganogramaAction: vi.fn(), alterarCarteiraAction: vi.fn(), criarGerenciaAction: vi.fn(),
    editarGerenciaAction: vi.fn(), definirGerenciaVisivelAction: vi.fn(), definirClienteAtivoAction: vi.fn(), alinharClienteAction: vi.fn(),
    ligarClienteAction: vi.fn(), criarClienteAction: vi.fn(),
}));
vi.mock('@/app/settings/carteiraActions', () => a);
vi.mock('@/app/settings/chaveLocal', () => ({ lerChaveSettings: () => 'adm' }));

import { OrganogramaClientesAdmin } from './admin';

const painel = {
    organograma: montarOrganograma([{ id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [{ id: 'c-smt', nome: 'Transportes', sigla: 'SMT', ultimoMovimento: null }] }], []),
    gerencias: [{ chave: 'GRC3', cardId: 'grc3-barone', nome: 'Barone', visivel: true, clientes: [{ id: 'c-smt', nome: 'Transportes', sigla: 'SMT', ativo: true }] }],
    semCarteira: [{ id: 'c-smc', nome: 'Cultura', sigla: 'SMC' }],
    todosClientes: [],
    fora: [{ clienteId: 'c-seme', sigla: 'SEME', nome: 'Esportes', carteira: 'GRC1', gerenciasDosDados: ['GRC4'] }],
    semCliente: [{ tabela: 'contrato', id: 'ct-x', texto: 'ALESP', gerencia: 'GRC4' }],
};

beforeEach(() => {
    a.carregarPainelCarteiraAction.mockResolvedValue({ ok: true, valor: painel });
    for (const f of Object.values(a)) if (f !== a.carregarPainelCarteiraAction) f.mockResolvedValue({ ok: true, valor: null });
});

describe('OrganogramaClientesAdmin', () => {
    it('Editar: põe cliente sem carteira com a chave e recarrega', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        await user.click(within(cartao).getByRole('combobox', { name: 'Adicionar cliente sem carteira' }));
        await user.click(await within(cartao).findByRole('option', { name: 'SMC · Cultura' }));
        expect(a.alterarCarteiraAction).toHaveBeenCalledWith('adm', 'GRC3', { adicionar: ['c-smc'], remover: [] });
        expect(a.carregarPainelCarteiraAction).toHaveBeenCalledTimes(2);
    });
    it('A conferir: trazer dados para a carteira', async () => {
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        await user.click(await screen.findByRole('tab', { name: 'A conferir' }));
        await user.click(screen.getByRole('button', { name: 'Trazer os dados de SEME para a carteira' }));
        await user.click(screen.getByRole('button', { name: 'Trazer' }));
        expect(a.alinharClienteAction).toHaveBeenCalledWith('adm', 'c-seme');
        expect(screen.getByText('ALESP')).toBeInTheDocument();
    });
    it('Ocultar gerência com erro mostra a mensagem', async () => {
        a.definirGerenciaVisivelAction.mockResolvedValue({ ok: false, erro: 'Tire os 1 clientes da carteira antes de desativar.' });
        const user = userEvent.setup();
        render(<OrganogramaClientesAdmin />);
        const cartao = await screen.findByRole('region', { name: 'Gerência GRC3' });
        await user.click(within(cartao).getByRole('button', { name: 'Ocultar' }));
        await user.click(screen.getByRole('button', { name: 'Ocultar gerência' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Tire os 1 clientes');
    });
});
```

- [ ] **Step 2:** `npx vitest run src/components/organograma-clientes/admin.test.tsx` — Expected: FAIL.

- [ ] **Step 3: `admin.tsx`**

```tsx
// src/components/organograma-clientes/admin.tsx
'use client';
// Organograma de clientes no admin (spec 2026-11-06 §8.2): abas Editar | Organograma | A conferir.
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { PainelCarteira } from '@/app/settings/carteiraActions';
import { lerChaveSettings } from '@/app/settings/chaveLocal';
import { ROTULO_DO_GRUPO, grupoDaGerencia } from '@/lib/carteira/organograma-clientes';
import type { Resultado } from '@/lib/carteira/tipos';
import { OrganogramaClientesView } from './quadro';
import { EditorGerencia } from './editor-gerencia';
import { AConferir } from './a-conferir';

export type Rodar = <T>(acao: (chave: string) => Promise<Resultado<T>>, sucesso: string) => Promise<boolean>;

export function OrganogramaClientesAdmin() {
    const [painel, setPainel] = useState<PainelCarteira | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [busca, setBusca] = useState('');
    const [criando, setCriando] = useState(false);

    const carregar = useCallback(async () => {
        const r = await acoes.carregarPainelCarteiraAction(lerChaveSettings());
        if (r.ok) setPainel(r.valor);
        else setErro(r.erro);
    }, []);

    useEffect(() => { void carregar(); }, [carregar]);

    const rodar: Rodar = async (acao, sucesso) => {
        setErro(null);
        setAviso(null);
        const r = await acao(lerChaveSettings());
        if (r.ok) setAviso(sucesso);
        else setErro(r.erro);
        await carregar();
        return r.ok;
    };

    if (!painel) return erro ? <Notice tom="perigo">{erro}</Notice> : <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />;

    const termo = busca.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const visiveis = painel.gerencias.filter((g) =>
        !termo || [g.chave, g.nome, ...g.clientes.map((c) => `${c.sigla ?? ''} ${c.nome}`)].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(termo));

    return (
        <div className="space-y-4">
            <header>
                <h1 className="text-2xl font-bold text-zinc-50">Organograma de clientes</h1>
                <p className="text-sm text-zinc-400">Cada coluna é uma gerência e cada cartão, a carteira dela. O que muda aqui muda no organograma do dashboard.</p>
            </header>
            {erro && <Notice tom="perigo">{erro}</Notice>}
            {aviso && <Notice tom="sucesso">{aviso}</Notice>}
            <Tabs defaultValue="editar" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="editar">Editar</TabsTrigger>
                        <TabsTrigger value="organograma">Organograma</TabsTrigger>
                        <TabsTrigger value="conferir">A conferir</TabsTrigger>
                    </TabsList>
                    <Button onClick={() => setCriando(true)}><Plus className="mr-1 h-4 w-4" /> Nova gerência</Button>
                </div>
                <TabsContent value="editar" className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input type="search" aria-label="Buscar no organograma" placeholder="Buscar gerência, gerente ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
                        <p className="text-sm text-zinc-400" aria-live="polite">{visiveis.length} de {painel.gerencias.length} gerência(s) · {painel.semCarteira.length} cliente(s) sem carteira</p>
                    </div>
                    {visiveis.map((g) => <EditorGerencia key={`${g.chave}:${g.nome}:${g.visivel}`} g={g} semCarteira={painel.semCarteira} rodar={rodar} />)}
                </TabsContent>
                <TabsContent value="organograma">
                    <div className="h-[75dvh] min-h-96">
                        <OrganogramaClientesView dados={painel.organograma} podeMover moverAction={(id, de, para) => acoes.moverClienteNoOrganogramaAction(lerChaveSettings(), id, de, para)} aoMudar={carregar} />
                    </div>
                </TabsContent>
                <TabsContent value="conferir">
                    <AConferir painel={painel} rodar={rodar} />
                </TabsContent>
            </Tabs>
            <NovaGerencia aberto={criando} aoFechar={() => setCriando(false)} rodar={rodar} />
        </div>
    );
}

function NovaGerencia({ aberto, aoFechar, rodar }: { aberto: boolean; aoFechar: () => void; rodar: Rodar }) {
    const [sigla, setSigla] = useState('');
    const [nome, setNome] = useState('');
    const fechar = () => { setSigla(''); setNome(''); aoFechar(); };
    const { grupo } = grupoDaGerencia({ sigla: sigla || null, nome });
    return (
        <Dialog open={aberto} onOpenChange={(a) => { if (!a) fechar(); }}>
            <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-50">
                <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await rodar((k) => acoes.criarGerenciaAction(k, { sigla, nome }), 'Gerência criada. Agora ponha os clientes.')) fechar(); }}>
                    <DialogHeader><DialogTitle>Nova gerência</DialogTitle></DialogHeader>
                    <label className="block text-sm">Sigla<Input value={sigla} onChange={(e) => setSigla(e.target.value)} required autoFocus /></label>
                    <label className="block text-sm">Nome do gerente<Input value={nome} onChange={(e) => setNome(e.target.value)} required /></label>
                    <p className="text-xs text-zinc-400">Coluna no organograma: {ROTULO_DO_GRUPO[grupo]} (vem da sigla: KAM1, GRC2, GRCC…).</p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
                        <Button type="submit">Criar gerência</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: `editor-gerencia.tsx`** (porte de `organograma-clientes-editor-cartao.tsx`)

```tsx
// src/components/organograma-clientes/editor-gerencia.tsx
'use client';
import { useState } from 'react';
import { Eye, EyeOff, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { GerenciaParaEditar } from '@/db/carteira';
import { ROTULO_DO_GRUPO, grupoDaGerencia } from '@/lib/carteira/organograma-clientes';
import type { Rodar } from './admin';

type Cliente = { id: string; nome: string; sigla: string | null };
const rotulo = (c: Cliente) => (c.sigla ? `${c.sigla} · ${c.nome}` : c.nome);
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Pedido = { tipo: 'visivel' } | { tipo: 'tirar'; cliente: Cliente } | { tipo: 'ativo'; cliente: Cliente & { ativo: boolean } };

export function EditorGerencia({ g, semCarteira, rodar }: { g: GerenciaParaEditar; semCarteira: Cliente[]; rodar: Rodar }) {
    const [editando, setEditando] = useState(false);
    const [sigla, setSigla] = useState(g.chave);
    const [nome, setNome] = useState(g.nome);
    const [texto, setTexto] = useState('');
    const [pedido, setPedido] = useState<Pedido | null>(null);
    const { grupo } = grupoDaGerencia({ sigla, nome: g.chave });
    const opcoes = semCarteira.filter((c) => !texto || semAcento(rotulo(c)).includes(semAcento(texto))).slice(0, 30);

    const confirmar = async () => {
        const p = pedido;
        setPedido(null);
        if (!p) return;
        if (p.tipo === 'visivel') await rodar((k) => acoes.definirGerenciaVisivelAction(k, g.chave, !g.visivel), g.visivel ? 'Gerência oculta.' : 'Gerência visível.');
        if (p.tipo === 'tirar') await rodar((k) => acoes.alterarCarteiraAction(k, g.chave, { adicionar: [], remover: [p.cliente.id] }), `${rotulo(p.cliente)} foi para "Sem carteira".`);
        if (p.tipo === 'ativo') await rodar((k) => acoes.definirClienteAtivoAction(k, p.cliente.id, !p.cliente.ativo), p.cliente.ativo ? 'Cliente oculto no organograma.' : 'Cliente visível no organograma.');
    };

    const textoDoPedido = !pedido ? null
        : pedido.tipo === 'visivel'
            ? (g.visivel
                ? { titulo: `Ocultar ${g.chave}?`, descricao: 'A gerência some do dashboard e não recebe clientes. Só dá para ocultar sem clientes na carteira.', botao: 'Ocultar gerência' }
                : { titulo: `Mostrar ${g.chave}?`, descricao: 'A gerência volta ao dashboard e pode receber clientes.', botao: 'Mostrar gerência' })
            : pedido.tipo === 'tirar'
                ? { titulo: `Tirar ${rotulo(pedido.cliente)} da carteira?`, descricao: 'O cliente vai para "Sem carteira". Os dados dele ficam com o gerente atual até ele entrar em outra carteira.', botao: 'Tirar' }
                : pedido.cliente.ativo
                    ? { titulo: `Ocultar ${rotulo(pedido.cliente)}?`, descricao: 'Some do organograma e das contagens, mas continua nesta carteira.', botao: 'Ocultar cliente' }
                    : { titulo: `Mostrar ${rotulo(pedido.cliente)}?`, descricao: 'Volta a aparecer no organograma.', botao: 'Mostrar cliente' };

    return (
        <section aria-label={`Gerência ${g.chave}`} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                {editando ? (
                    <form className="flex flex-1 flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); if (await rodar((k) => acoes.editarGerenciaAction(k, g.chave, { sigla, nome }), 'Gerência atualizada.')) setEditando(false); }}>
                        <label className="w-32 text-sm">Sigla<Input value={sigla} onChange={(e) => setSigla(e.target.value)} autoFocus /></label>
                        <label className="min-w-48 flex-1 text-sm">Gerente<Input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
                        <Button type="submit">Gravar</Button>
                        <Button type="button" variant="outline" onClick={() => { setEditando(false); setSigla(g.chave); setNome(g.nome); }}>Cancelar</Button>
                        <p className="w-full text-xs text-zinc-400">Coluna no organograma: {ROTULO_DO_GRUPO[grupo]}. Mudar a sigla atualiza carteira, contratos e propostas da gerência.</p>
                    </form>
                ) : (
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
                            <span className="font-mono">{g.chave}</span> <span>{g.nome}</span>
                            {!g.visivel && <span className="rounded border border-zinc-600 px-1.5 text-xs text-zinc-400">oculta</span>}
                        </h2>
                        <p className="text-xs text-zinc-400">Coluna: {ROTULO_DO_GRUPO[grupo]} · {g.clientes.length} cliente(s)</p>
                    </div>
                )}
                {!editando && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setPedido({ tipo: 'visivel' })}>{g.visivel ? 'Ocultar' : 'Mostrar'}</Button>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <h3 className="text-sm text-zinc-400">Clientes da carteira</h3>
                {g.clientes.length === 0 ? <p className="text-sm text-zinc-500">Nenhum cliente ainda. Adicione abaixo.</p> : (
                    <ul className="max-h-60 divide-y divide-zinc-800 overflow-y-auto rounded-md border border-zinc-800">
                        {g.clientes.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1">
                                <span className={`truncate text-sm ${c.ativo ? 'text-zinc-200' : 'text-zinc-500 line-through'}`} title={c.nome}>{rotulo(c)}</span>
                                <span className="flex shrink-0">
                                    <Button variant="ghost" size="icon" aria-label={`${c.ativo ? 'Ocultar' : 'Mostrar'} ${rotulo(c)}`} onClick={() => setPedido({ tipo: 'ativo', cliente: c })}>
                                        {c.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={`Tirar ${rotulo(c)} da carteira`} onClick={() => setPedido({ tipo: 'tirar', cliente: c })}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <Combobox
                    rotulo="Adicionar cliente sem carteira"
                    placeholder="Buscar por sigla ou nome"
                    valor={texto}
                    aoMudarTexto={setTexto}
                    opcoes={opcoes}
                    chave={(c) => c.id}
                    rotuloDe={rotulo}
                    aoEscolher={(c) => { setTexto(''); void rodar((k) => acoes.alterarCarteiraAction(k, g.chave, { adicionar: [c.id], remover: [] }), `${rotulo(c)} entrou na carteira.`); }}
                    vazio="Nenhum cliente sem carteira com esse texto"
                />
                <p className="text-xs text-zinc-500">Cliente de outra carteira: mova pela aba Organograma.</p>
            </div>
            <ConfirmDialog aberto={!!pedido} titulo={textoDoPedido?.titulo ?? ''} descricao={textoDoPedido?.descricao ?? ''} rotuloConfirmar={textoDoPedido?.botao ?? 'Confirmar'} aoConfirmar={confirmar} aoCancelar={() => setPedido(null)} />
        </section>
    );
}
```

- [ ] **Step 5: `a-conferir.tsx`**

```tsx
// src/components/organograma-clientes/a-conferir.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { PainelCarteira } from '@/app/settings/carteiraActions';
import type { ForaDaCarteira, LinhaSemCliente } from '@/db/carteira';
import type { Rodar } from './admin';

const ROTULO_TABELA: Record<LinhaSemCliente['tabela'], string> = { contrato: 'Contrato', proposta: 'Proposta', cx: 'CX', projects: 'Projeto' };
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function AConferir({ painel, rodar }: { painel: PainelCarteira; rodar: Rodar }) {
    const [trazer, setTrazer] = useState<ForaDaCarteira | null>(null);
    return (
        <div className="space-y-8">
            <section aria-label="Fora da carteira" className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-50">Fora da carteira</h2>
                <p className="text-sm text-zinc-400">A carteira do cliente é uma gerência, mas contratos, propostas, CX ou projetos dele estão em outra.</p>
                {painel.fora.length === 0 ? <p className="text-sm text-zinc-500">Nenhum cliente fora da carteira.</p> : (
                    <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
                        {painel.fora.map((f) => {
                            const nome = f.sigla ?? f.nome;
                            return (
                                <li key={f.clienteId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                    <span className="text-zinc-200">{nome} — carteira {f.carteira}; dados em {f.gerenciasDosDados.join(', ')}</span>
                                    <Button size="sm" aria-label={`Trazer os dados de ${nome} para a carteira`} onClick={() => setTrazer(f)}>Trazer os dados para a carteira</Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-xs text-zinc-500">Para mudar a carteira em vez dos dados, use a aba Organograma.</p>
            </section>
            <section aria-label="Sem cliente" className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-50">Sem cliente</h2>
                <p className="text-sm text-zinc-400">Linhas cujo texto não casou com nenhum cliente. Ligue a um cliente para que acompanhem a carteira.</p>
                {painel.semCliente.length === 0 ? <p className="text-sm text-zinc-500">Todas as linhas têm cliente.</p> : (
                    <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
                        {painel.semCliente.map((l) => <LinhaParaLigar key={`${l.tabela}:${l.id}`} linha={l} clientes={painel.todosClientes} rodar={rodar} />)}
                    </ul>
                )}
            </section>
            <ConfirmDialog
                aberto={!!trazer}
                titulo="Trazer os dados para a carteira"
                descricao={trazer ? `Contratos, propostas, CX e projetos de ${trazer.sigla ?? trazer.nome} vão para ${trazer.carteira}. A troca fica registrada no histórico.` : ''}
                rotuloConfirmar="Trazer"
                tom="principal"
                aoCancelar={() => setTrazer(null)}
                aoConfirmar={async () => { const f = trazer!; setTrazer(null); await rodar((k) => acoes.alinharClienteAction(k, f.clienteId), `Dados de ${f.sigla ?? f.nome} trazidos para ${f.carteira}.`); }}
            />
        </div>
    );
}

function LinhaParaLigar({ linha, clientes, rodar }: { linha: LinhaSemCliente; clientes: PainelCarteira['todosClientes']; rodar: Rodar }) {
    const [texto, setTexto] = useState('');
    const opcoes = clientes.filter((c) => !texto || semAcento(`${c.sigla ?? ''} ${c.nome}`).includes(semAcento(texto))).slice(0, 30);
    return (
        <li className="grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_20rem] md:items-end">
            <span className="text-zinc-200">{ROTULO_TABELA[linha.tabela]} · {linha.gerencia} · <strong>{linha.texto}</strong></span>
            <Combobox
                rotulo={`Ligar "${linha.texto}" a um cliente`}
                placeholder="Buscar cliente"
                valor={texto}
                aoMudarTexto={setTexto}
                opcoes={opcoes}
                chave={(c) => c.id}
                rotuloDe={(c) => (c.sigla ? `${c.sigla} · ${c.nome}` : c.nome)}
                aoEscolher={(c) => void rodar((k) => acoes.ligarClienteAction(k, linha.tabela, linha.id, c.id), `${linha.texto} ligado a ${c.sigla ?? c.nome}.`)}
                vazio="Nenhum cliente. Crie em 'Novo cliente' abaixo."
            />
            <Button size="sm" variant="outline" className="md:col-start-2" onClick={() => void (async () => {
                let novoId: string | null = null;
                const ok = await rodar(async (k) => {
                    const r = await acoes.criarClienteAction(k, { nome: linha.texto, sigla: null });
                    if (r.ok) novoId = r.valor.id;
                    return r;
                }, `Cliente ${linha.texto} criado.`);
                if (ok && novoId) await rodar((k) => acoes.ligarClienteAction(k, linha.tabela, linha.id, novoId!), `${linha.texto} ligado ao cliente novo.`);
            })()}>Criar cliente "{linha.texto}" e ligar</Button>
        </li>
    );
}
```

- [ ] **Step 6: SettingsDashboard e ManagerEditor**
  - `SettingsDashboard.tsx`: acrescente `'organograma-clientes'` ao tipo de `section`; na lateral, logo depois do botão "Organograma" (`setSection('orgchart')`), um botão idêntico com `onClick={() => setSection('organograma-clientes')}`, ícone `Building2` (lucide), título "Organograma de clientes", subtítulo "Carteira de cada gerência" e cor `purple` igual ao do organograma; no `main`, `section === 'organograma-clientes' ? <OrganogramaClientesAdmin /> :` antes de `section === 'orgchart'`. Passe `onAbrirOrganogramaClientes={() => setSection('organograma-clientes')}` ao `ManagerEditor`.
  - `ManagerEditor.tsx`: nova prop opcional `onAbrirOrganogramaClientes?: () => void`; troque o `<ClientsEditor … />` da aba Clientes por:

```tsx
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-400">A carteira é editada no organograma de clientes. Aqui ela só aparece.</p>
                            {(manager.servedClients ?? []).length === 0
                                ? <p className="text-sm text-zinc-500">Nenhum cliente na carteira.</p>
                                : <ul className="space-y-1">{(manager.servedClients ?? []).map((c) => <li key={c} className="text-sm text-zinc-200">{c}</li>)}</ul>}
                            {onAbrirOrganogramaClientes && <Button variant="outline" onClick={onAbrirOrganogramaClientes}>Mudar no organograma de clientes</Button>}
                        </div>
```

    e remova o import de `ClientsEditor` se ficar sem uso (`grep -rn ClientsEditor src` — se nada mais usar, apague `src/app/settings/ClientsEditor.tsx`).

- [ ] **Step 7:** `npx vitest run src/components/organograma-clientes src/app/settings` — Expected: PASS. `npx tsc --noEmit` — Expected: sem erro.
- [ ] **Step 8: Commit**

```bash
git add src/components/organograma-clientes src/app/settings
git commit -m "feat(carteira): secao Organograma de clientes no /settings (editar, organograma, a conferir)"
```

---

### Task 18: Troca Pessoas | Clientes no dashboard (só leitura)

**Files:**
- Create: `src/components/organograma-clientes/abas.tsx`, `src/components/organograma-clientes/abas.test.tsx`
- Modify: `src/components/dashboard/DashboardShell.tsx:292-293`

**Interfaces — Produces:** `OrganogramaComAbas({ lightActive }: { lightActive: boolean })`.

- [ ] **Step 1: Teste que falha**

```tsx
// src/components/organograma-clientes/abas.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { montarOrganograma } from '@/lib/carteira/organograma-clientes';

vi.mock('@/components/dashboard/OrganizationChartView', () => ({ default: () => <div>organograma de pessoas</div> }));
vi.mock('@/app/settings/carteiraActions', () => ({
    carregarOrganogramaClientesAction: vi.fn().mockResolvedValue(montarOrganograma([{ id: 'GRC3', nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'], clientes: [{ id: 'c', nome: 'Transportes', sigla: 'SMT', ultimoMovimento: null }] }], [])),
}));
import { OrganogramaComAbas } from './abas';

describe('OrganogramaComAbas', () => {
    it('abre em Pessoas e troca para Clientes só leitura', async () => {
        const user = userEvent.setup();
        render(<OrganogramaComAbas lightActive={false} />);
        expect(screen.getByText('organograma de pessoas')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Clientes' }));
        expect(await screen.findByText('SMT')).toBeInTheDocument();
        expect(screen.getByText(/Só leitura/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2:** `npx vitest run src/components/organograma-clientes/abas.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implementação**

```tsx
// src/components/organograma-clientes/abas.tsx
'use client';
// Troca Pessoas | Clientes da aba Organograma (= abas-organograma.tsx do AIBertinho). Clientes é só leitura (D8).
import { useEffect, useState } from 'react';
import { Building2, Loader2, Network } from 'lucide-react';
import OrganizationChartView from '@/components/dashboard/OrganizationChartView';
import { carregarOrganogramaClientesAction } from '@/app/settings/carteiraActions';
import type { OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import { OrganogramaClientesView } from './quadro';

export function OrganogramaComAbas({ lightActive }: { lightActive: boolean }) {
    const [aba, setAba] = useState<'pessoas' | 'clientes'>('pessoas');
    const [dados, setDados] = useState<OrganogramaClientes | null>(null);

    useEffect(() => {
        if (aba === 'clientes' && !dados) void carregarOrganogramaClientesAction().then(setDados);
    }, [aba, dados]);

    const botao = (id: 'pessoas' | 'clientes', rotulo: string, Icone: typeof Network) => (
        <button
            type="button"
            aria-pressed={aba === id}
            onClick={() => setAba(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors ${aba === id
                ? (lightActive ? 'bg-white text-zinc-900 shadow-sm' : 'bg-zinc-800 text-zinc-100 shadow-sm')
                : (lightActive ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200')}`}
        >
            <Icone className="h-4 w-4" aria-hidden="true" /> {rotulo}
        </button>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <nav aria-label="Organograma" className={`inline-flex w-fit items-center gap-1 rounded-md border p-1 ${lightActive ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-800 bg-zinc-900'}`}>
                {botao('pessoas', 'Pessoas', Network)}
                {botao('clientes', 'Clientes', Building2)}
            </nav>
            {aba === 'pessoas' ? <OrganizationChartView lightActive={lightActive} />
                : dados ? <div className="min-h-[70dvh] flex-1"><OrganogramaClientesView dados={dados} podeMover={false} /></div>
                : <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />}
        </div>
    );
}
```

  Em `DashboardShell.tsx`, troque `<OrganizationChartView lightActive={storeLightActive} />` por `<OrganogramaComAbas lightActive={storeLightActive} />` e o import correspondente (remova o de `OrganizationChartView` se ficar sem uso).

- [ ] **Step 4:** `npx vitest run src/components` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/organograma-clientes/abas.tsx src/components/organograma-clientes/abas.test.tsx src/components/dashboard/DashboardShell.tsx
git commit -m "feat(carteira): troca Pessoas | Clientes no organograma do dashboard (so leitura)"
```

---

### Task 19: Verificação final e ensaio da carga

**Files:** nenhum novo (só correções que aparecerem)

- [ ] **Step 1:** `npx vitest run` — Expected: tudo verde (contagem da Task 1 + novos).
- [ ] **Step 2:** `npx tsc --noEmit` e `npm run lint` — Expected: sem erro novo.
- [ ] **Step 3:** `npm run build` — Expected: build ok.
- [ ] **Step 4: Ensaio em cópia local de produção** (só leitura em produção):
  1. Peça ao usuário para rodar `npm run db:sync-prod` (copia produção para `./temp/database.db`) **ou** confirme que ele autoriza esse comando — ele lê produção e grava só local.
  2. `TURSO_DATABASE_URL=file:./temp/database.db npx tsx migrate.ts` — Expected: `→ applying 0017_carteira_clientes.sql`.
  3. `TURSO_DATABASE_URL=file:./temp/database.db npx tsx scripts/carteira/seed-carteira.ts` — confira no relatório: duplicado SEGES (KAM3 fica, KAM10 perde); `fora` com SEME, SMDET, SMC, SVMA; lista `criadosSemCarteira`.
  4. Rode de novo o passo 3 — Expected: `clientesCriados: 0` (idempotente).
  5. `npm run dev`, abra `/settings` (chave), seção "Organograma de clientes": mover um cliente, Desfazer, aba A conferir; `/` → Organograma → Clientes em leitura. Confira em `/contracts` que o contrato do cliente movido mudou de GRC.
- [ ] **Step 5:** Reporte ao usuário: resultado dos testes, build, relatório da carga na cópia. **Não** rodar migração nem carga no Turso de produção, nem `git push`, sem ordem explícita.
