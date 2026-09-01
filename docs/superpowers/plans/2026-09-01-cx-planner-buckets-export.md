# CX Planner — Buckets, Responsável, Subtítulo e Export Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o board `/settings/cx-planner` num Kanban estilo Planner com colunas = buckets livres, campo de responsável e subtítulo por card, e um botão que exporta o board inteiro num `.xlsx` no formato de 6 abas do Planner.

**Architecture:** Duas tabelas novas (`cx_buckets`, `cx_users`) e três colunas novas em `cx` (`bucket_id`, `responsavel_id`, `subtitulo`). O `status`/`criticidade` da tabela `cx` continuam existindo e sendo gravados, agora sempre derivados de `percent_complete`/`prioridade_texto` — a aba CX do gerente (`CXTab.tsx`) e `/settings` não mudam. O board passa a renderizar uma coluna por bucket (mais uma coluna fixa "Entrada" para `bucket_id = null`). O export é um route handler `GET` que monta o workbook com `exceljs` a partir do estado atual do banco.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM sobre Turso/LibSQL (SQLite), TailwindCSS 4, Shadcn/Radix, `exceljs` (nova dependência), `tsx` (já presente, para scripts).

## Global Constraints

- **Sem test runner.** Não existe `npm test` neste repo (CLAUDE.md). Verificação de cada task = `npx tsc --noEmit` limpo + `npm run lint` limpo + checagem manual descrita na task. Onde houver lógica pura (export), um script `tsx` de asserção serve de teste.
- **`src/db/index.ts` nunca recebe `dotenv`** (quebra na Vercel). Scripts standalone rodados via `tsx` carregam `.env` explicitamente.
- **Só `src/db/queries.ts` escreve Drizzle.** Server actions e componentes chamam funções de `queries.ts`, nunca `db` direto.
- **UI e copy em pt-BR**, consistente com o resto do app.
- **Migrations**: arquivos `.sql` numerados em `src/db/migrations/`, aplicados por `migrate.ts` (`npm run db:migrate`), que divide statements em `--> statement-breakpoint` e ignora erros de "duplicate column"/"already exists". Não usar `drizzle-kit generate` — as migrations aqui são escritas à mão.
- **Não tocar** em `src/components/dashboard/tabs/CXTab.tsx`, `src/app/settings/CXEditor.tsx`, `src/lib/planner-sync.ts`, `src/lib/planner-pull.ts`, `src/app/api/external/v1/**`.
- **Gate de acesso**: `CX_PLANNER_KEY` (default `prodam_cx_2026`), guardado no client em `localStorage.getItem('CX_PLANNER_KEY')`.
- **Branch**: `cx_planner` (já está nela). Um commit por task.
- Derivação de `status` a partir do `percent_complete`: `>= 100` → `resolvido`, `> 0` → `analise`, senão `pendente`. Derivação de `criticidade` a partir de `prioridade_texto`: via `mapCriticidade` de `src/lib/planner-sync.ts` (já exportada).

---

## File Structure

**Criar:**
- `src/db/migrations/0013_cx_planner_buckets.sql` — DDL das 2 tabelas + 3 colunas.
- `src/lib/cx-planner-export.ts` — `buildCXPlannerWorkbook(...)`, lógica pura de montagem do workbook.
- `scripts/verify-cx-export.ts` — script `tsx` de asserção do workbook (faz as vezes de teste).
- `src/app/settings/cx-planner/export/route.ts` — route handler `GET` do download.
- `src/app/settings/cx-planner/CXUsersModal.tsx` — CRUD de responsáveis.

**Modificar:**
- `src/db/schema.ts` — `cxBuckets`, `cxUsers`, colunas novas em `cx`.
- `src/types/manager.ts` — `CXItem` ganha `bucketId`, `responsavelId`, `subtitulo`.
- `src/db/queries.ts` — CRUD de buckets/users; `fetchAllCXItemsForBoard` com join de responsável; tipo `CXBoardItem`.
- `src/app/settings/cx-planner/actions.ts` — `CXPlannerFormValues` estendido; `moveCXPlannerItem` passa a receber `bucketId`; actions de bucket/user; `fetchCXPlannerBoardData`.
- `src/app/settings/cx-planner/board-config.ts` — remover `STATUS_COLUMNS` como fonte de colunas (manter labels p/ badge).
- `src/app/settings/cx-planner/CXPlannerCard.tsx` — layout estilo Planner + subtítulo + responsável.
- `src/app/settings/cx-planner/CXPlannerItemModal.tsx` — campos subtítulo/responsável/bucket; status read-only.
- `src/app/settings/cx-planner/CXPlannerBoard.tsx` — colunas dinâmicas, gestão de bucket, filtros, botões "Responsáveis" e "Baixar Excel".
- `package.json` — dependência `exceljs`.

---

## Task 1: Migration + schema das tabelas e colunas novas

**Files:**
- Create: `src/db/migrations/0013_cx_planner_buckets.sql`
- Modify: `src/db/schema.ts` (bloco `cx` nas linhas ~33-63; adicionar tabelas novas após `cx`)
- Modify: `src/types/manager.ts:42-66` (interface `CXItem`)

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - Tabela `cx_buckets(id INTEGER PK, name TEXT NOT NULL, position INTEGER NOT NULL)`
  - Tabela `cx_users(id INTEGER PK, name TEXT NOT NULL, email TEXT)`
  - Colunas `cx.bucket_id INTEGER NULL`, `cx.responsavel_id INTEGER NULL`, `cx.subtitulo TEXT NULL`
  - Drizzle: `export const cxBuckets`, `export const cxUsers` em `schema.ts`; `cx` com `bucketId`, `responsavelId`, `subtitulo`.
  - `CXItem` (types/manager.ts) com `bucketId?: number | null`, `responsavelId?: number | null`, `subtitulo?: string | null`.

- [ ] **Step 1: Escrever o arquivo de migration**

Create `src/db/migrations/0013_cx_planner_buckets.sql`:

```sql
CREATE TABLE IF NOT EXISTS cx_buckets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cx_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT
);
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN bucket_id INTEGER REFERENCES cx_buckets(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN responsavel_id INTEGER REFERENCES cx_users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN subtitulo TEXT;
```

Nota: `ON DELETE SET NULL` fica declarado para documentação, mas as FKs podem não estar habilitadas na conexão LibSQL — as queries de delete (Task 2) fazem o `NULL` explicitamente, sem depender disso.

- [ ] **Step 2: Aplicar a migration no banco local**

Run: `npm run db:migrate`
Expected: saída termina com `✓ applied 0013_cx_planner_buckets.sql` e `done.` (as migrations anteriores aparecem como `✓ skip`).

- [ ] **Step 3: Conferir o schema no banco**

Run: `node -e "const{createClient}=require('@libsql/client');const c=createClient({url:process.env.TURSO_DATABASE_URL||'file:temp/database.db'});c.execute('PRAGMA table_info(cx)').then(r=>{console.log(r.rows.map(x=>x.name));return c.execute('SELECT name FROM sqlite_master WHERE type=\"table\" AND name LIKE \"cx_%\"')}).then(r=>{console.log(r.rows);process.exit(0)})"`
Expected: a lista de colunas de `cx` inclui `bucket_id`, `responsavel_id`, `subtitulo`; as tabelas `cx_buckets` e `cx_users` aparecem.

- [ ] **Step 4: Adicionar as tabelas ao schema Drizzle**

In `src/db/schema.ts`, logo após o bloco `export const cx = sqliteTable(...)` (termina na linha ~63), adicionar:

```ts
export const cxBuckets = sqliteTable('cx_buckets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    // Ordem das colunas no board /settings/cx-planner (0-based). Itens com
    // cx.bucketId = null caem numa coluna virtual "Entrada", sempre a primeira.
    position: integer('position').notNull(),
});

export const cxUsers = sqliteTable('cx_users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email'),
});
```

- [ ] **Step 5: Adicionar as colunas novas ao `cx` no schema Drizzle**

In `src/db/schema.ts`, dentro do `sqliteTable('cx', { ... })`, logo antes de `createdAt:` (linha ~62), adicionar:

```ts
    // Board /settings/cx-planner: qual coluna (bucket) o item ocupa. null =
    // coluna virtual "Entrada". onDelete: set null declarado, mas o nul é
    // feito explicitamente em deleteCXBucket (FKs podem estar off no LibSQL).
    bucketId: integer('bucket_id').references(() => cxBuckets.id, { onDelete: 'set null' }),
    // "Atribuído a" do Planner — aponta para cx_users. null = sem responsável.
    responsavelId: integer('responsavel_id').references(() => cxUsers.id, { onDelete: 'set null' }),
    // Área/rótulo livre exibido como subtítulo do card (ex.: "Infraestrutura").
    subtitulo: text('subtitulo'),
```

Como `cxBuckets`/`cxUsers` são declaradas depois de `cx` no arquivo, as referências dentro de arrow functions (`() => cxBuckets.id`) resolvem lazy — ok. Se o `tsc` reclamar de uso antes da declaração, mover os blocos `cxBuckets`/`cxUsers` para **antes** do bloco `cx`.

- [ ] **Step 6: Estender a interface `CXItem`**

In `src/types/manager.ts`, dentro de `interface CXItem`, após `prioridadeTexto?: string | null;` (linha ~65):

```ts
  // Board /settings/cx-planner — ver 0013_cx_planner_buckets.sql
  bucketId?: number | null;
  responsavelId?: number | null;
  subtitulo?: string | null;
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/db/migrations/0013_cx_planner_buckets.sql src/db/schema.ts src/types/manager.ts
git commit -m "feat(cx-planner): schema e migration para buckets, responsável e subtítulo"
```

---

## Task 2: Queries de bucket/user e board fetch estendido

**Files:**
- Modify: `src/db/queries.ts` (seção `// ─── CX Queries ───`, linhas ~351-430)

**Interfaces:**
- Consumes: `cxBuckets`, `cxUsers`, `cx.bucketId/responsavelId/subtitulo` (Task 1).
- Produces (todas em `src/db/queries.ts`):
  - `type CXBucket = { id: number; name: string; position: number }`
  - `type CXUser = { id: number; name: string; email: string | null }`
  - `fetchCXBuckets(): Promise<CXBucket[]>` — ordenado por `position` asc
  - `createCXBucket(name: string): Promise<CXBucket>` — `position` = (max atual) + 1, ou 0
  - `renameCXBucket(id: number, name: string): Promise<void>`
  - `swapCXBucketPositions(idA: number, idB: number): Promise<void>` — troca os `position` das duas linhas
  - `deleteCXBucket(id: number): Promise<void>` — `UPDATE cx SET bucket_id = NULL WHERE bucket_id = id` e depois `DELETE`
  - `fetchCXUsers(): Promise<CXUser[]>` — ordenado por `name`
  - `createCXUser(name: string, email: string | null): Promise<CXUser>`
  - `updateCXUser(id: number, data: { name: string; email: string | null }): Promise<void>`
  - `deleteCXUser(id: number): Promise<void>` — `UPDATE cx SET responsavel_id = NULL WHERE responsavel_id = id` e depois `DELETE`
  - `CXBoardItem` passa a incluir `bucketId: number | null`, `responsavelId: number | null`, `responsavelName: string | null`, `subtitulo: string | null`
  - `createCXItem` / `updateCXItem` — inalteradas na assinatura (já aceitam `typeof cx.$inferInsert`)

- [ ] **Step 1: Imports**

In `src/db/queries.ts`, garantir que o import do topo inclui `cxBuckets` e `cxUsers` (junto de `cx`, `managers`, etc.). Conferir também que `asc` está importado de `drizzle-orm` (junto de `eq`, `desc`, `inArray`); se não estiver, adicionar.

- [ ] **Step 2: Adicionar tipos e CRUD de bucket**

In `src/db/queries.ts`, no início da seção `// ─── CX Queries ───` (antes de `createCXItem`, linha ~353):

```ts
export type CXBucket = { id: number; name: string; position: number };
export type CXUser = { id: number; name: string; email: string | null };

export async function fetchCXBuckets(): Promise<CXBucket[]> {
    return db.select().from(cxBuckets).orderBy(asc(cxBuckets.position));
}

export async function createCXBucket(name: string): Promise<CXBucket> {
    const existing = await db.select({ position: cxBuckets.position }).from(cxBuckets);
    const nextPos = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;
    const rows = await db.insert(cxBuckets).values({ name, position: nextPos }).returning();
    return rows[0];
}

export async function renameCXBucket(id: number, name: string): Promise<void> {
    await db.update(cxBuckets).set({ name }).where(eq(cxBuckets.id, id));
}

// Troca a posição de dois buckets — usado pelos botões "mover ⬅ / ➡" do
// cabeçalho da coluna. Duas linhas só, sem transação (LibSQL embedded).
export async function swapCXBucketPositions(idA: number, idB: number): Promise<void> {
    const rows = await db
        .select({ id: cxBuckets.id, position: cxBuckets.position })
        .from(cxBuckets)
        .where(inArray(cxBuckets.id, [idA, idB]));
    const a = rows.find((r) => r.id === idA);
    const b = rows.find((r) => r.id === idB);
    if (!a || !b) return;
    await db.update(cxBuckets).set({ position: b.position }).where(eq(cxBuckets.id, idA));
    await db.update(cxBuckets).set({ position: a.position }).where(eq(cxBuckets.id, idB));
}

// Excluir bucket: primeiro solta os cards (bucket_id -> null, caem na coluna
// "Entrada"), depois apaga a linha. O null é explícito porque as FKs podem
// não estar habilitadas na conexão LibSQL.
export async function deleteCXBucket(id: number): Promise<void> {
    await db.update(cx).set({ bucketId: null }).where(eq(cx.bucketId, id));
    await db.delete(cxBuckets).where(eq(cxBuckets.id, id));
}
```

- [ ] **Step 3: Adicionar CRUD de user**

Logo abaixo do CRUD de bucket:

```ts
export async function fetchCXUsers(): Promise<CXUser[]> {
    return db.select().from(cxUsers).orderBy(asc(cxUsers.name));
}

export async function createCXUser(name: string, email: string | null): Promise<CXUser> {
    const rows = await db.insert(cxUsers).values({ name, email }).returning();
    return rows[0];
}

export async function updateCXUser(id: number, data: { name: string; email: string | null }): Promise<void> {
    await db.update(cxUsers).set(data).where(eq(cxUsers.id, id));
}

export async function deleteCXUser(id: number): Promise<void> {
    await db.update(cx).set({ responsavelId: null }).where(eq(cx.responsavelId, id));
    await db.delete(cxUsers).where(eq(cxUsers.id, id));
}
```

- [ ] **Step 4: Estender `CXBoardItem` e `fetchAllCXItemsForBoard`**

In `src/db/queries.ts`, substituir a definição do tipo `CXBoardItem` (linha ~390) e a query `fetchAllCXItemsForBoard`:

```ts
export type CXBoardItem = CXItem & {
    managerId: string;
    managerName: string;
    bucketId: number | null;
    responsavelId: number | null;
    responsavelName: string | null;
    subtitulo: string | null;
};

export async function fetchAllCXItemsForBoard(): Promise<CXBoardItem[]> {
    const rows = await db
        .select({
            id: cx.id,
            managerId: cx.managerId,
            managerName: managers.name,
            cliente: cx.cliente,
            titulo: cx.titulo,
            problema: cx.problema,
            solucaoProposta: cx.solucaoProposta,
            status: cx.status,
            criticidade: cx.criticidade,
            isVisible: cx.isVisible,
            createdAt: cx.createdAt,
            externalId: cx.externalId,
            manualEditAt: cx.manualEditAt,
            dataInicio: cx.dataInicio,
            dataFim: cx.dataFim,
            percentComplete: cx.percentComplete,
            prioridadeTexto: cx.prioridadeTexto,
            bucketId: cx.bucketId,
            responsavelId: cx.responsavelId,
            responsavelName: cxUsers.name,
            subtitulo: cx.subtitulo,
        })
        .from(cx)
        .innerJoin(managers, eq(cx.managerId, managers.id))
        .leftJoin(cxUsers, eq(cx.responsavelId, cxUsers.id))
        .orderBy(desc(cx.createdAt));

    return rows.map((r) => ({
        ...r,
        status: r.status as CXItem['status'],
        criticidade: (r.criticidade as CXItem['criticidade']) ?? 'baixa',
        isVisible: r.isVisible ?? true,
    }));
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se `actions.ts` acusar erro em `CXBoardItem` faltando propriedades, é esperado — resolvido na Task 3; mas o objetivo aqui é `queries.ts` compilar. Se o erro estiver só em `actions.ts`, seguir.)

- [ ] **Step 6: Smoke test das queries**

Run: `npx tsx -e "import('./src/db/queries.ts').then(async q => { const b = await q.createCXBucket('Teste'); console.log('created', b); await q.renameCXBucket(b.id, 'Teste 2'); console.log('buckets', await q.fetchCXBuckets()); await q.deleteCXBucket(b.id); console.log('after delete', await q.fetchCXBuckets()); process.exit(0); })"`
Expected: cria, renomeia, lista e apaga sem erro; lista final não contém "Teste 2".
Nota: se `tsx -e` com import de `.ts` falhar no ambiente, criar `scripts/smoke-cx-buckets.ts` com o mesmo conteúdo e rodar `npx tsx scripts/smoke-cx-buckets.ts`, depois apagar o arquivo antes do commit.

- [ ] **Step 7: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat(cx-planner): queries de CRUD de buckets/responsáveis e board fetch com join"
```

---

## Task 3: Server actions — buckets, users, form estendido, status derivado

**Files:**
- Modify: `src/app/settings/cx-planner/actions.ts` (arquivo inteiro, 116 linhas)

**Interfaces:**
- Consumes: tudo de Task 2 (`fetchCXBuckets`, `createCXBucket`, `renameCXBucket`, `swapCXBucketPositions`, `deleteCXBucket`, `fetchCXUsers`, `createCXUser`, `updateCXUser`, `deleteCXUser`, `CXBucket`, `CXUser`, `CXBoardItem`).
- Produces (em `src/app/settings/cx-planner/actions.ts`):
  - `CXPlannerFormValues` com campos extra: `subtitulo: string`, `responsavelId: number | null`, `bucketId: number | null` (e **sem** `status` — status deixa de ser entrada do form)
  - `fetchCXPlannerBoardData(): Promise<{ items: CXBoardItem[]; managers: {id;name}[]; buckets: CXBucket[]; users: CXUser[] }>`
  - `createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null>`
  - `updateCXPlannerItem(id: number, patch: Partial<CXPlannerFormValues>): Promise<CXBoardItem | null>`
  - `moveCXPlannerItem(id: number, bucketId: number | null): Promise<CXBoardItem | null>` — **assinatura muda** (era `status: CXStatus`)
  - `createBucketAction(name: string): Promise<CXBucket>`
  - `renameBucketAction(id: number, name: string): Promise<void>`
  - `moveBucketAction(id: number, direction: 'left' | 'right'): Promise<void>`
  - `deleteBucketAction(id: number): Promise<void>`
  - `createUserAction(name: string, email: string): Promise<CXUser>`
  - `updateUserAction(id: number, name: string, email: string): Promise<void>`
  - `deleteUserAction(id: number): Promise<void>`
  - `verifyCXPlannerKey` — inalterada

- [ ] **Step 1: Reescrever `actions.ts`**

Substituir o conteúdo inteiro de `src/app/settings/cx-planner/actions.ts` por:

```ts
'use server';

import {
    fetchAllCXItemsForBoard,
    deleteCXItem,
    fetchManagersList,
    fetchManagerById,
    createCXItem,
    updateCXItem,
    fetchCXBuckets,
    createCXBucket,
    renameCXBucket,
    swapCXBucketPositions,
    deleteCXBucket,
    fetchCXUsers,
    createCXUser,
    updateCXUser,
    deleteCXUser,
    CXBoardItem,
    CXBucket,
    CXUser,
} from '@/db/queries';
import { mapCriticidade } from '@/lib/planner-sync';
import { CXStatus } from '@/types/manager';

export type CXPlannerFormValues = {
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    subtitulo: string;
    dataInicio: string;
    dataFim: string;
    percentComplete: number;
    prioridadeTexto: string;
    responsavelId: number | null;
    bucketId: number | null;
    isVisible: boolean;
};

type CXItemPatch = Partial<{
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    subtitulo: string | null;
    status: CXStatus;
    criticidade: 'baixa' | 'media' | 'alta';
    dataInicio: string | null;
    dataFim: string | null;
    percentComplete: number | null;
    prioridadeTexto: string | null;
    responsavelId: number | null;
    bucketId: number | null;
    isVisible: boolean;
}>;

function normalizeDate(v: string): string | null {
    return v.trim() === '' ? null : v;
}

// status é sempre derivado do % de conclusão — nunca escolhido na UI.
// Mesma regra de mapStatus (planner-sync.ts) e statusForPercent (modal antigo).
function statusFromPercent(percent: number): CXStatus {
    if (percent >= 100) return 'resolvido';
    if (percent > 0) return 'analise';
    return 'pendente';
}

export async function verifyCXPlannerKey(key: string) {
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    return key === correctKey;
}

export async function fetchCXPlannerBoardData(): Promise<{
    items: CXBoardItem[];
    managers: { id: string; name: string }[];
    buckets: CXBucket[];
    users: CXUser[];
}> {
    const [items, managerRows, buckets, users] = await Promise.all([
        fetchAllCXItemsForBoard(),
        fetchManagersList(),
        fetchCXBuckets(),
        fetchCXUsers(),
    ]);
    return {
        items,
        managers: managerRows.map((m) => ({ id: m.id, name: m.name })),
        buckets,
        users,
    };
}

export async function createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null> {
    const manager = await fetchManagerById(input.managerId);
    if (!manager) return null;

    const created = await createCXItem({
        managerId: input.managerId,
        cliente: input.cliente,
        titulo: input.titulo,
        problema: input.problema,
        solucaoProposta: input.solucaoProposta,
        subtitulo: input.subtitulo.trim() || null,
        status: statusFromPercent(input.percentComplete),
        criticidade: mapCriticidade(input.prioridadeTexto),
        dataInicio: normalizeDate(input.dataInicio),
        dataFim: normalizeDate(input.dataFim),
        percentComplete: input.percentComplete,
        prioridadeTexto: input.prioridadeTexto || null,
        responsavelId: input.responsavelId,
        bucketId: input.bucketId,
        isVisible: input.isVisible ?? true,
        externalId: null,
        manualEditAt: null,
        createdAt: new Date().toISOString(),
    });

    return hydrate(created.id!);
}

export async function updateCXPlannerItem(
    id: number,
    patch: Partial<CXPlannerFormValues>
): Promise<CXBoardItem | null> {
    const payload: CXItemPatch = {};
    if (patch.managerId !== undefined) payload.managerId = patch.managerId;
    if (patch.cliente !== undefined) payload.cliente = patch.cliente;
    if (patch.titulo !== undefined) payload.titulo = patch.titulo;
    if (patch.problema !== undefined) payload.problema = patch.problema;
    if (patch.solucaoProposta !== undefined) payload.solucaoProposta = patch.solucaoProposta;
    if (patch.subtitulo !== undefined) payload.subtitulo = patch.subtitulo.trim() || null;
    if (patch.dataInicio !== undefined) payload.dataInicio = normalizeDate(patch.dataInicio);
    if (patch.dataFim !== undefined) payload.dataFim = normalizeDate(patch.dataFim);
    if (patch.responsavelId !== undefined) payload.responsavelId = patch.responsavelId;
    if (patch.bucketId !== undefined) payload.bucketId = patch.bucketId;
    if (patch.isVisible !== undefined) payload.isVisible = patch.isVisible;
    if (patch.prioridadeTexto !== undefined) {
        payload.prioridadeTexto = patch.prioridadeTexto || null;
        payload.criticidade = mapCriticidade(patch.prioridadeTexto);
    }
    if (patch.percentComplete !== undefined) {
        payload.percentComplete = patch.percentComplete;
        payload.status = statusFromPercent(patch.percentComplete);
    }

    const updated = await updateCXItem(id, payload);
    if (!updated) return null;
    return hydrate(id);
}

export async function deleteCXPlannerItem(id: number): Promise<void> {
    await deleteCXItem(id);
}

export async function moveCXPlannerItem(id: number, bucketId: number | null): Promise<CXBoardItem | null> {
    const updated = await updateCXItem(id, { bucketId });
    if (!updated) return null;
    return hydrate(id);
}

// Recarrega o item já no formato do board (com managerName / responsavelName /
// bucketId) — mais simples e sem drift do que remontar o objeto à mão.
async function hydrate(id: number): Promise<CXBoardItem | null> {
    const all = await fetchAllCXItemsForBoard();
    return all.find((i) => i.id === id) ?? null;
}

// ── Buckets ──────────────────────────────────────────────────────────────
export async function createBucketAction(name: string): Promise<CXBucket> {
    return createCXBucket(name.trim() || 'Novo bucket');
}

export async function renameBucketAction(id: number, name: string): Promise<void> {
    await renameCXBucket(id, name.trim() || 'Bucket');
}

export async function moveBucketAction(id: number, direction: 'left' | 'right'): Promise<void> {
    const buckets = await fetchCXBuckets();
    const idx = buckets.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= buckets.length) return;
    await swapCXBucketPositions(id, buckets[targetIdx].id);
}

export async function deleteBucketAction(id: number): Promise<void> {
    await deleteCXBucket(id);
}

// ── Responsáveis ─────────────────────────────────────────────────────────
export async function createUserAction(name: string, email: string): Promise<CXUser> {
    return createCXUser(name.trim(), email.trim() || null);
}

export async function updateUserAction(id: number, name: string, email: string): Promise<void> {
    await updateCXUser(id, { name: name.trim(), email: email.trim() || null });
}

export async function deleteUserAction(id: number): Promise<void> {
    await deleteCXUser(id);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: erros **apenas** em `CXPlannerBoard.tsx` / `CXPlannerItemModal.tsx` / `CXPlannerCard.tsx` (consumidores antigos de `fetchCXPlannerBoardItems`, `fetchManagersForDropdown`, `moveCXPlannerItem(id, status)`, `STATUS_COLUMNS`). Esses são resolvidos nas Tasks 6-9. `actions.ts` e `queries.ts` compilam.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/cx-planner/actions.ts
git commit -m "feat(cx-planner): server actions de bucket/responsável e status derivado do %"
```

---

## Task 4: Lib de export do workbook + script de verificação

**Files:**
- Create: `src/lib/cx-planner-export.ts`
- Create: `scripts/verify-cx-export.ts`
- Modify: `package.json` (dependência `exceljs`)

**Interfaces:**
- Consumes: `CXBoardItem` (Task 2), `CXBucket`/`CXUser` (Task 2), `isOverdueDate`/`formatDateOnlyBR` de `src/lib/cx-log.ts` (já existem).
- Produces (em `src/lib/cx-planner-export.ts`):
  - `interface CXExportManager { id: string; name: string; role: string }`
  - `buildCXPlannerWorkbook(input: { items: CXBoardItem[]; buckets: CXBucket[]; users: CXUser[]; managers: CXExportManager[] }): import('exceljs').Workbook` — síncrono, monta as 6 abas.
  - `EXPORT_FILENAME = 'Demandas CX.xlsx'`
  - `CONSOLIDATED_HEADERS: string[]` (as 19 colunas) — exportado para o script de verificação.

- [ ] **Step 1: Instalar `exceljs`**

Run: `npm install exceljs`
Expected: `package.json` ganha `"exceljs": "^4.x"` em `dependencies`.

- [ ] **Step 2: Escrever `src/lib/cx-planner-export.ts`**

```ts
import ExcelJS from 'exceljs';
import type { CXBoardItem, CXBucket, CXUser } from '@/db/queries';
import { formatDateOnlyBR, isOverdueDate } from '@/lib/cx-log';

export const EXPORT_FILENAME = 'Demandas CX.xlsx';

export interface CXExportManager {
    id: string;
    name: string;
    role: string;
}

export const CONSOLIDATED_HEADERS = [
    'Identificação da tarefa',
    'Nome da tarefa',
    'Categoria',
    'Meta',
    'Status',
    'Prioridade',
    'Atribuído a',
    'Criado por',
    'Criado em',
    'Data de conclusão',
    'Data de início',
    'É Recorrente',
    'Atrasados',
    'Concluído em',
    'Concluída por',
    'Itens concluídos da lista de verificação',
    'Itens da lista de verificação',
    'Rótulos',
    'Notas',
];

const METAS_HEADERS = [
    'ID da Meta',
    'Nome da meta',
    'Status',
    'Prioridade',
    'Data de início',
    'Data de término',
    'Tarefas conectadas',
    'Notas',
];

// role vem como "GRC1" / "KAM3" / "GRCC" — a coluna Rótulos do Planner usa
// "GRC 1" / "KAM 3". GRCC (sem número) fica como está.
function managerTag(role: string | undefined): string {
    if (!role) return '';
    const m = role.match(/^([A-Za-z]+?)(\d+)$/);
    return m ? `${m[1].toUpperCase()} ${m[2]}` : role.toUpperCase();
}

function dateOnly(v: string | null | undefined): string {
    return (v ?? '').slice(0, 10);
}

function taskName(item: CXBoardItem): string {
    const titulo = item.titulo?.trim() || (item.problema?.split(/\r?\n/)[0] ?? '').trim();
    return item.cliente?.trim() ? `${item.cliente.trim()} - ${titulo}` : titulo;
}

type RowMode = 'legivel' | 'id';

function itemRow(
    item: CXBoardItem,
    mode: RowMode,
    bucketById: Map<number, CXBucket>,
    userById: Map<number, CXUser>,
    managerById: Map<string, CXExportManager>
): (string | number)[] {
    const resolved = item.status === 'resolvido';
    const overdue = isOverdueDate(item.dataFim, item.status);
    const bucket = item.bucketId != null ? bucketById.get(item.bucketId) : undefined;
    const user = item.responsavelId != null ? userById.get(item.responsavelId) : undefined;
    const categoria = mode === 'id' ? (item.bucketId != null ? String(item.bucketId) : '') : (bucket?.name ?? '');
    const atribuido = mode === 'id' ? (item.responsavelId != null ? String(item.responsavelId) : '') : (user?.name ?? '');
    const rotuloArea = item.subtitulo?.trim() ?? '';
    const tag = managerTag(managerById.get(item.managerId)?.role);
    const rotulos = [tag, rotuloArea].filter(Boolean).join(';');

    return [
        item.externalId || `cx-${item.id}`,
        taskName(item),
        categoria,
        '',
        resolved ? 'Concluída' : 'Em andamento',
        item.prioridadeTexto ?? '',
        atribuido,
        '',
        dateOnly(item.createdAt),
        dateOnly(item.dataFim),
        dateOnly(item.dataInicio),
        'false',
        overdue ? 'true' : 'false',
        resolved ? dateOnly(item.dataFim) : '',
        resolved ? atribuido : '',
        '',
        '',
        rotulos,
        item.solucaoProposta ?? '',
    ];
}

export function buildCXPlannerWorkbook(input: {
    items: CXBoardItem[];
    buckets: CXBucket[];
    users: CXUser[];
    managers: CXExportManager[];
}): ExcelJS.Workbook {
    const { items, buckets, users, managers } = input;
    const bucketById = new Map(buckets.map((b) => [b.id, b]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const managerById = new Map(managers.map((m) => [m.id, m]));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'AIBertinho';
    wb.created = new Date();

    const plano = wb.addWorksheet('Plano');
    plano.addRow(['ID do plano', 'Nome do plano', '']);
    plano.addRow(['cx-planner', 'Demandas CX', new Date().toISOString().slice(0, 10)]);

    const consolidado = wb.addWorksheet('Dados Consolidados');
    consolidado.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        consolidado.addRow(itemRow(item, 'legivel', bucketById, userById, managerById));
    }

    const tarefas = wb.addWorksheet('Tarefas');
    tarefas.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        tarefas.addRow(itemRow(item, 'id', bucketById, userById, managerById));
    }

    const metas = wb.addWorksheet('Metas');
    metas.addRow(METAS_HEADERS);

    const bucketsSheet = wb.addWorksheet('Buckets');
    bucketsSheet.addRow(['ID de Bucket', 'Nome do Bucket']);
    for (const b of buckets) bucketsSheet.addRow([String(b.id), b.name]);

    const usuarios = wb.addWorksheet('Usuários');
    usuarios.addRow(['ID do Usuário', 'Nome do usuário', 'Email']);
    for (const u of users) usuarios.addRow([String(u.id), u.name, u.email ?? '']);

    return wb;
}
```

- [ ] **Step 3: Escrever o script de verificação**

Create `scripts/verify-cx-export.ts`:

```ts
// Faz as vezes de teste (não há test runner). Roda: npx tsx scripts/verify-cx-export.ts
import { buildCXPlannerWorkbook, CONSOLIDATED_HEADERS } from '../src/lib/cx-planner-export';
import type { CXBoardItem, CXBucket, CXUser } from '../src/db/queries';

function assert(cond: unknown, msg: string) {
    if (!cond) {
        console.error(`✗ ${msg}`);
        process.exit(1);
    }
    console.log(`✓ ${msg}`);
}

const buckets: CXBucket[] = [
    { id: 1, name: 'CX - Em Análise', position: 0 },
    { id: 2, name: 'Concluído', position: 1 },
];
const users: CXUser[] = [{ id: 10, name: 'Maria Jose da Silva', email: 'mariajsilva@prodam.sp.gov.br' }];
const managers = [{ id: 'kam3-andrea', name: 'Andrea', role: 'KAM3' }];

const items = [
    {
        id: 100,
        managerId: 'kam3-andrea',
        managerName: 'Andrea',
        cliente: 'SEGES',
        titulo: 'Wi-Fi Intermitente',
        problema: '01/08/2026 - relato inicial',
        solucaoProposta: 'Encaminhado à rede',
        status: 'analise',
        criticidade: 'media',
        isVisible: true,
        createdAt: '2026-08-01T00:00:00.000Z',
        externalId: null,
        manualEditAt: null,
        dataInicio: '2026-08-01',
        dataFim: '2026-08-10',
        percentComplete: 50,
        prioridadeTexto: 'Importante',
        bucketId: 1,
        responsavelId: 10,
        responsavelName: 'Maria Jose da Silva',
        subtitulo: 'Infraestrutura',
    },
    {
        id: 101,
        managerId: 'kam3-andrea',
        managerName: 'Andrea',
        cliente: 'SME',
        titulo: 'Erro SIGPEC',
        problema: 'texto',
        solucaoProposta: '',
        status: 'resolvido',
        criticidade: 'baixa',
        isVisible: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        externalId: 'abc-123',
        manualEditAt: null,
        dataInicio: '2026-07-01',
        dataFim: '2026-07-20',
        percentComplete: 100,
        prioridadeTexto: 'Média',
        bucketId: null,
        responsavelId: null,
        responsavelName: null,
        subtitulo: null,
    },
] as unknown as CXBoardItem[];

const wb = buildCXPlannerWorkbook({ items, buckets, users, managers });

const names = wb.worksheets.map((w) => w.name);
assert(
    JSON.stringify(names) ===
        JSON.stringify(['Plano', 'Dados Consolidados', 'Tarefas', 'Metas', 'Buckets', 'Usuários']),
    `6 abas na ordem certa (got ${names.join(', ')})`
);

const cons = wb.getWorksheet('Dados Consolidados')!;
const header = (cons.getRow(1).values as unknown[]).slice(1);
assert(JSON.stringify(header) === JSON.stringify(CONSOLIDATED_HEADERS), '19 colunas no cabeçalho de Dados Consolidados');
assert(cons.rowCount === 3, `Dados Consolidados: 1 header + 2 itens (got ${cons.rowCount})`);

const row2 = (cons.getRow(2).values as unknown[]).slice(1);
assert(row2[0] === 'cx-100', 'item sem externalId => "cx-100"');
assert(row2[1] === 'SEGES - Wi-Fi Intermitente', 'Nome da tarefa = "cliente - titulo"');
assert(row2[2] === 'CX - Em Análise', 'Categoria (legível) = nome do bucket');
assert(row2[4] === 'Em andamento', 'Status textual "Em andamento" p/ não-resolvido');
assert(row2[6] === 'Maria Jose da Silva', 'Atribuído a (legível) = nome do responsável');
assert(row2[17] === 'KAM 3;Infraestrutura', 'Rótulos = "TAG;area"');
assert(row2[18] === 'Encaminhado à rede', 'Notas = solução proposta');

const row3 = (cons.getRow(3).values as unknown[]).slice(1);
assert(row3[0] === 'abc-123', 'item com externalId usa o externalId');
assert(row3[2] === '', 'Categoria vazia quando bucketId = null');
assert(row3[4] === 'Concluída', 'Status textual "Concluída" p/ resolvido');
assert(row3[13] === '2026-07-20', 'Concluído em = data fim p/ resolvido');
assert(row3[17] === 'KAM 3', 'Rótulos só com a tag quando não há subtítulo');

const tarefas = wb.getWorksheet('Tarefas')!;
const trow2 = (tarefas.getRow(2).values as unknown[]).slice(1);
assert(trow2[2] === '1', 'Tarefas: Categoria = id do bucket');
assert(trow2[6] === '10', 'Tarefas: Atribuído a = id do usuário');

const bk = wb.getWorksheet('Buckets')!;
assert(bk.rowCount === 3, 'Buckets: header + 2 linhas');
const us = wb.getWorksheet('Usuários')!;
assert(us.rowCount === 2, 'Usuários: header + 1 linha');
const metas = wb.getWorksheet('Metas')!;
assert(metas.rowCount === 1, 'Metas: só o cabeçalho');

console.log('\n✓ todos os asserts passaram');
```

- [ ] **Step 4: Rodar a verificação**

Run: `npx tsx scripts/verify-cx-export.ts`
Expected: todas as linhas `✓` e no fim `✓ todos os asserts passaram`. Se algum `✗`, corrigir `cx-planner-export.ts` e rodar de novo.

- [ ] **Step 5: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros novos em `cx-planner-export.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/cx-planner-export.ts scripts/verify-cx-export.ts
git commit -m "feat(cx-planner): lib de montagem do workbook Excel (6 abas do Planner) + verificação"
```

---

## Task 5: Route handler do download

**Files:**
- Create: `src/app/settings/cx-planner/export/route.ts`

**Interfaces:**
- Consumes: `fetchCXPlannerBoardData` (Task 3) — mas precisa também do `role` do manager, que `fetchManagersList` já traz; ver Step 1. `buildCXPlannerWorkbook`, `EXPORT_FILENAME`, `CXExportManager` (Task 4). `fetchManagersList` de `@/db/queries`.
- Produces: `GET /settings/cx-planner/export?key=<CX_PLANNER_KEY>` → `200` com o `.xlsx` como attachment, ou `401` texto puro se a chave não bater.

- [ ] **Step 1: Escrever o route handler**

`fetchCXPlannerBoardData` devolve `managers` sem `role`. O route usa `fetchManagersList` direto (traz `id`, `name`, `role`) para montar os `CXExportManager`.

Create `src/app/settings/cx-planner/export/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { fetchAllCXItemsForBoard, fetchCXBuckets, fetchCXUsers, fetchManagersList } from '@/db/queries';
import { buildCXPlannerWorkbook, EXPORT_FILENAME } from '@/lib/cx-planner-export';

export async function GET(request: NextRequest) {
    const key = request.nextUrl.searchParams.get('key');
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    if (key !== correctKey) {
        return new Response('Não autorizado.', { status: 401 });
    }

    const [items, buckets, users, managers] = await Promise.all([
        fetchAllCXItemsForBoard(),
        fetchCXBuckets(),
        fetchCXUsers(),
        fetchManagersList(),
    ]);

    const wb = buildCXPlannerWorkbook({
        items,
        buckets,
        users,
        managers: managers.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    });

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer as ArrayBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${EXPORT_FILENAME}"`,
            'Cache-Control': 'no-store',
        },
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros em `route.ts`. Se `writeBuffer()` retornar tipo incompatível com `Response`, envolver com `Buffer.from(buffer)` — ajustar e re-typecheck.

- [ ] **Step 3: Teste manual do endpoint**

Com `npm run dev` rodando (porta 6001):

Run: `curl -s -o /tmp/cx.xlsx -w "%{http_code}\n" "http://localhost:6001/settings/cx-planner/export?key=prodam_cx_2026" && node -e "const E=require('exceljs');new E.Workbook().xlsx.readFile('/tmp/cx.xlsx').then(w=>{console.log(w.worksheets.map(s=>s.name));process.exit(0)})"`
Expected: `200` e a lista `[ 'Plano', 'Dados Consolidados', 'Tarefas', 'Metas', 'Buckets', 'Usuários' ]`.

Run: `curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:6001/settings/cx-planner/export?key=errada"`
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/cx-planner/export/route.ts
git commit -m "feat(cx-planner): route GET /export que baixa o board como .xlsx"
```

---

## Task 6: board-config + card estilo Planner

**Files:**
- Modify: `src/app/settings/cx-planner/board-config.ts`
- Modify: `src/app/settings/cx-planner/CXPlannerCard.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `CXBoardItem` com `subtitulo`/`responsavelName` (Task 2); `prioridadeStyle` (board-config, inalterado); `parseCXLogEntries`, `formatDateOnlyBR` (cx-log).
- Produces:
  - `board-config.ts`: `STATUS_LABELS: Record<CXStatus, string>` (novo, p/ o badge read-only do modal). `STATUS_COLUMNS` **removido**. `PRIORIDADE_OPTIONS`, `PRIORIDADE_CONFIG`, `PRIORIDADE_FALLBACK`, `prioridadeStyle` mantidos.
  - `CXPlannerCard.tsx`: mesma prop `{ item: CXBoardItem; onClick: () => void; lightActive?: boolean }`. Sem novos exports.

- [ ] **Step 1: Ajustar `board-config.ts`**

Substituir o topo do arquivo (linhas 1-7, o bloco `import` + `STATUS_COLUMNS`) por:

```ts
import { CXStatus } from '@/types/manager';

// Rótulos de status para o badge read-only do modal. O status não é mais
// coluna do board (as colunas agora são buckets) nem editável — é derivado
// do % de conclusão (ver statusFromPercent em actions.ts).
export const STATUS_LABELS: Record<CXStatus, string> = {
    pendente: 'Pendente',
    analise: 'Em Análise',
    resolvido: 'Resolvido',
};
```

O resto do arquivo (a partir do comentário `// Mesmas 3 opções...`) fica igual.

- [ ] **Step 2: Reescrever `CXPlannerCard.tsx`**

Substituir o conteúdo inteiro por:

```tsx
'use client';

import { EyeOff, History, CalendarClock } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { prioridadeStyle } from './board-config';
import { parseCXLogEntries, formatDateOnlyBR } from '@/lib/cx-log';

interface CXPlannerCardProps {
    item: CXBoardItem;
    onClick: () => void;
    lightActive?: boolean;
}

function toDateOnly(v: string | null | undefined): string {
    return (v ?? '').slice(0, 10);
}

function isOverdue(dataFim: string | null | undefined, status: string): boolean {
    const dateOnly = toDateOnly(dataFim);
    if (!dateOnly || status === 'resolvido') return false;
    const deadline = new Date(dateOnly + 'T00:00:00');
    if (Number.isNaN(deadline.getTime())) return false;
    return deadline < new Date(new Date().toDateString());
}

// Iniciais do responsável p/ o "avatar" redondo estilo Planner.
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

export function CXPlannerCard({ item, onClick, lightActive = false }: CXPlannerCardProps) {
    const style = prioridadeStyle(item.prioridadeTexto);
    const overdue = isOverdue(item.dataFim, item.status);
    const percent = Math.max(0, Math.min(100, item.percentComplete ?? 0));
    const fimBR = formatDateOnlyBR(item.dataFim);

    const logEntries = parseCXLogEntries(item.problema);
    const firstDatedEntry = logEntries.find((e) => e.date);
    const lastEditedDisplay = firstDatedEntry
        ? firstDatedEntry.date!.split(/\s+/)[0]
        : formatDateOnlyBR(item.createdAt);

    const T = {
        card: lightActive ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
        header: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        eyeOff: lightActive ? 'text-zinc-400' : 'text-zinc-600',
        title: lightActive ? 'text-zinc-800' : 'text-zinc-200',
        subtitle: lightActive ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-300',
        barBg: lightActive ? 'bg-zinc-200' : 'bg-zinc-800',
        percentText: lightActive ? 'text-zinc-500' : 'text-zinc-600',
        prazoChip: overdue
            ? (lightActive ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
            : (lightActive ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-800 text-zinc-200'),
        editedText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        avatar: lightActive ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300',
        responsavelText: lightActive ? 'text-zinc-600' : 'text-zinc-300',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left border border-l-4 ${style.border} rounded-lg p-2 flex flex-col gap-1 transition-colors duration-200 ${T.card}`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-[10.5px] font-semibold truncate ${T.header}`}>{item.managerName} · {item.cliente}</span>
                <div className="flex items-center gap-1 shrink-0">
                    {item.isVisible === false && (
                        <span title="Oculto do painel do gerente" className={T.eyeOff}>
                            <EyeOff className="w-3 h-3" />
                        </span>
                    )}
                    {item.prioridadeTexto && (
                        <span className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wider border ${lightActive ? style.badgeLight : style.badge}`}>
                            {item.prioridadeTexto}
                        </span>
                    )}
                </div>
            </div>

            <p className={`text-[13px] font-medium line-clamp-1 leading-snug ${T.title}`}>{item.titulo || item.problema}</p>

            {item.subtitulo && (
                <span className={`self-start px-1.5 py-px rounded text-[10px] font-medium ${T.subtitle}`}>
                    {item.subtitulo}
                </span>
            )}

            <div className="flex items-center gap-2">
                <div className={`flex-1 h-1 rounded-full overflow-hidden min-w-6 ${T.barBg}`}>
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <span className={`text-[9px] shrink-0 tabular-nums ${T.percentText}`}>{percent}%</span>
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {fimBR && (
                        <span
                            title={overdue ? `Prazo vencido em ${fimBR}` : `Prazo: ${fimBR}`}
                            className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${T.prazoChip}`}
                        >
                            <CalendarClock className="w-3.5 h-3.5" /> {fimBR}
                        </span>
                    )}
                    {item.responsavelName && (
                        <span className={`flex items-center gap-1 min-w-0 ${T.responsavelText}`} title={`Responsável: ${item.responsavelName}`}>
                            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold shrink-0 ${T.avatar}`}>
                                {initials(item.responsavelName)}
                            </span>
                            <span className="text-[10.5px] truncate">{firstName(item.responsavelName)}</span>
                        </span>
                    )}
                </div>
                {lastEditedDisplay && (
                    <span title={`Última atualização: ${lastEditedDisplay}`} className={`flex items-center gap-1 shrink-0 text-[10.5px] font-mono ${T.editedText}`}>
                        <History className="w-3 h-3" /> {lastEditedDisplay}
                    </span>
                )}
            </div>
        </button>
    );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: erros restantes apenas em `CXPlannerItemModal.tsx` (usa `STATUS_COLUMNS`) e `CXPlannerBoard.tsx` — resolvidos nas Tasks 7 e 9.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/cx-planner/board-config.ts src/app/settings/cx-planner/CXPlannerCard.tsx
git commit -m "feat(cx-planner): card estilo Planner com subtítulo e responsável"
```

---

## Task 7: Modal — subtítulo, responsável, bucket; status read-only

**Files:**
- Modify: `src/app/settings/cx-planner/CXPlannerItemModal.tsx`

**Interfaces:**
- Consumes: `CXPlannerFormValues` estendido (Task 3, sem `status`, com `subtitulo`/`responsavelId`/`bucketId`); `STATUS_LABELS` (Task 6); `PRIORIDADE_*` (board-config); `CXBucket`/`CXUser` (queries via re-export? não — importar de `@/db/queries`).
- Produces: `CXPlannerItemModal` com props novas:
  - `bucketOptions: { id: number; name: string }[]`
  - `userOptions: { id: number; name: string }[]`
  - `subtituloSuggestions: string[]`
  - `defaultBucketId: number | null`
  - remove a prop `defaultStatus`
  - mantém `open`, `onOpenChange`, `item`, `managerOptions`, `defaultManagerId`, `onSave`, `onDelete`, `lightActive`

- [ ] **Step 1: Ajustar imports e tipos**

No topo de `CXPlannerItemModal.tsx`:
- Trocar o import `import { PRIORIDADE_OPTIONS, PRIORIDADE_CONFIG, PRIORIDADE_FALLBACK, STATUS_COLUMNS, PrioridadeTexto } from './board-config';`
  por `import { PRIORIDADE_OPTIONS, PRIORIDADE_CONFIG, PRIORIDADE_FALLBACK, STATUS_LABELS, PrioridadeTexto } from './board-config';`
- Adicionar `import { CXStatus } from '@/types/manager';` (se não houver).

Substituir a `interface CXPlannerItemModalProps` e `emptyValues`:

```tsx
interface ManagerOption {
    id: string;
    name: string;
}

interface CXPlannerItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: CXBoardItem | null;
    managerOptions: ManagerOption[];
    bucketOptions: { id: number; name: string }[];
    userOptions: { id: number; name: string }[];
    subtituloSuggestions: string[];
    defaultManagerId?: string;
    defaultBucketId?: number | null;
    onSave: (values: CXPlannerFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
    lightActive?: boolean;
}

function emptyValues(defaultManagerId = '', defaultBucketId: number | null = null): CXPlannerFormValues {
    return {
        managerId: defaultManagerId,
        cliente: '',
        titulo: '',
        problema: '',
        solucaoProposta: '',
        subtitulo: '',
        dataInicio: '',
        dataFim: '',
        percentComplete: 0,
        prioridadeTexto: PRIORIDADE_FALLBACK,
        responsavelId: null,
        bucketId: defaultBucketId,
        isVisible: true,
    };
}
```

- [ ] **Step 2: Ajustar `statusForPercent` local e o estado inicial**

Manter a função `priorityFromCriticidade` como está. Substituir `statusForPercent` (que devolvia `CXStatus` p/ setar no form) por uma versão só de **exibição** (não altera o form):

```tsx
function derivedStatus(percent: number): CXStatus {
    if (percent >= 100) return 'resolvido';
    if (percent > 0) return 'analise';
    return 'pendente';
}
```

Na assinatura do componente, trocar `defaultStatus` por `bucketOptions, userOptions, subtituloSuggestions, defaultBucketId`.

No `useEffect` que popula `values` quando abre:

```tsx
        if (item) {
            setValues({
                managerId: item.managerId,
                cliente: item.cliente,
                titulo: item.titulo,
                problema: item.problema,
                solucaoProposta: item.solucaoProposta,
                subtitulo: item.subtitulo ?? '',
                dataInicio: (item.dataInicio ?? '').slice(0, 10),
                dataFim: (item.dataFim ?? '').slice(0, 10),
                percentComplete: item.percentComplete ?? 0,
                prioridadeTexto: item.prioridadeTexto ?? priorityFromCriticidade(item.criticidade),
                responsavelId: item.responsavelId ?? null,
                bucketId: item.bucketId ?? null,
                isVisible: item.isVisible ?? true,
            });
        } else {
            setValues(emptyValues(defaultManagerId, defaultBucketId ?? null));
        }
```

Atualizar o array de deps do `useEffect` de `[open, item, defaultManagerId, defaultStatus]` para `[open, item, defaultManagerId, defaultBucketId]`.

Substituir `handlePercentChange` (que setava status) por:

```tsx
    const handlePercentChange = (percent: number) => {
        setValues((prev) => ({ ...prev, percentComplete: percent }));
    };
```

- [ ] **Step 3: Trocar os campos do formulário**

**3a.** Depois do campo "Título", adicionar o campo Subtítulo (com `<datalist>`):

```tsx
                    <div className="space-y-1.5">
                        <Label className={T.label}>Subtítulo / área</Label>
                        <Input
                            value={values.subtitulo}
                            onChange={(e) => update('subtitulo', e.target.value)}
                            placeholder="Ex: Infraestrutura"
                            list="cx-subtitulo-suggestions"
                            className={T.field}
                        />
                        <datalist id="cx-subtitulo-suggestions">
                            {subtituloSuggestions.map((s) => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>
```

**3b.** Depois do bloco de "Prioridade", adicionar Responsável + Bucket lado a lado:

```tsx
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={T.label}>Responsável</Label>
                            <Select
                                value={values.responsavelId == null ? 'none' : String(values.responsavelId)}
                                onValueChange={(v) => update('responsavelId', v === 'none' ? null : Number(v))}
                            >
                                <SelectTrigger className={T.field}>
                                    <SelectValue placeholder="— nenhum —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— nenhum —</SelectItem>
                                    {userOptions.map((u) => (
                                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={T.label}>Bucket</Label>
                            <Select
                                value={values.bucketId == null ? 'none' : String(values.bucketId)}
                                onValueChange={(v) => update('bucketId', v === 'none' ? null : Number(v))}
                            >
                                <SelectTrigger className={T.field}>
                                    <SelectValue placeholder="Entrada (sem bucket)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Entrada (sem bucket)</SelectItem>
                                    {bucketOptions.map((b) => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
```

**3c.** Substituir o bloco inteiro de "Status" (os chips `STATUS_COLUMNS.map(...)` + o `<p>` helper) por um badge read-only:

```tsx
                    <div className="space-y-1.5">
                        <Label className={T.label}>Status</Label>
                        <div className="flex items-center gap-2">
                            <span
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${T.statusActive}`}
                                title="Derivado automaticamente do % de conclusão"
                            >
                                {STATUS_LABELS[derivedStatus(values.percentComplete)]}
                            </span>
                            <span className={`text-[11px] ${T.helperText}`}>derivado do % de conclusão</span>
                        </div>
                    </div>
```

- [ ] **Step 4: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: erros restantes só em `CXPlannerBoard.tsx` (Task 9). `CXPlannerItemModal.tsx` compila.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/cx-planner/CXPlannerItemModal.tsx
git commit -m "feat(cx-planner): modal com subtítulo, responsável e bucket; status read-only"
```

---

## Task 8: CXUsersModal — CRUD de responsáveis

**Files:**
- Create: `src/app/settings/cx-planner/CXUsersModal.tsx`

**Interfaces:**
- Consumes: `Dialog*` de `@/components/ui/dialog`, `Button`, `Input`, `Label`; actions `createUserAction`, `updateUserAction`, `deleteUserAction` (Task 3); `CXUser` de `@/db/queries`.
- Produces: `CXUsersModal` com props:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `users: CXUser[]`
  - `usageCount: Record<number, number>` — quantos cards usam cada responsável (p/ o aviso de exclusão)
  - `onChanged: () => Promise<void>` — chamado após qualquer create/update/delete p/ o board recarregar
  - `lightActive?: boolean`

- [ ] **Step 1: Escrever o componente**

Create `src/app/settings/cx-planner/CXUsersModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Pencil, Plus, X, Check } from 'lucide-react';
import { CXUser } from '@/db/queries';
import { createUserAction, updateUserAction, deleteUserAction } from './actions';

interface CXUsersModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    users: CXUser[];
    usageCount: Record<number, number>;
    onChanged: () => Promise<void>;
    lightActive?: boolean;
}

export function CXUsersModal({ open, onOpenChange, users, usageCount, onChanged, lightActive = false }: CXUsersModalProps) {
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setNewName('');
            setNewEmail('');
            setEditingId(null);
            setConfirmDeleteId(null);
        }
    }, [open]);

    const T = {
        dialog: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        label: lightActive ? 'text-zinc-600' : 'text-zinc-400',
        field: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-200',
        row: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        muted: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        warn: lightActive ? 'text-amber-700' : 'text-amber-400',
        iconBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-400 hover:text-white',
        danger: lightActive ? 'text-red-600 hover:text-red-500' : 'text-red-500 hover:text-red-400',
    };

    const handleAdd = async () => {
        if (!newName.trim() || busy) return;
        setBusy(true);
        try {
            await createUserAction(newName, newEmail);
            setNewName('');
            setNewEmail('');
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const startEdit = (u: CXUser) => {
        setEditingId(u.id);
        setEditName(u.name);
        setEditEmail(u.email ?? '');
        setConfirmDeleteId(null);
    };

    const handleSaveEdit = async () => {
        if (editingId == null || !editName.trim() || busy) return;
        setBusy(true);
        try {
            await updateUserAction(editingId, editName, editEmail);
            setEditingId(null);
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (busy) return;
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            return;
        }
        setBusy(true);
        try {
            await deleteUserAction(id);
            setConfirmDeleteId(null);
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`max-w-lg transition-colors duration-200 ${T.dialog}`}>
                <DialogHeader>
                    <DialogTitle>Responsáveis do CX</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <div className={`flex flex-col divide-y rounded-lg border ${T.row}`}>
                        {users.length === 0 && (
                            <p className={`text-xs text-center py-4 ${T.muted}`}>Nenhum responsável cadastrado.</p>
                        )}
                        {users.map((u) => {
                            const inUse = usageCount[u.id] ?? 0;
                            const isEditing = editingId === u.id;
                            return (
                                <div key={u.id} className={`flex items-center gap-2 px-3 py-2 ${T.row}`}>
                                    {isEditing ? (
                                        <>
                                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" className={`h-8 text-xs ${T.field}`} />
                                            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" className={`h-8 text-xs ${T.field}`} />
                                            <button type="button" onClick={handleSaveEdit} disabled={busy} className={T.iconBtn} title="Salvar"><Check className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setEditingId(null)} className={T.iconBtn} title="Cancelar"><X className="w-4 h-4" /></button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{u.name}</p>
                                                {u.email && <p className={`text-[10px] truncate ${T.muted}`}>{u.email}</p>}
                                            </div>
                                            {confirmDeleteId === u.id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] ${T.warn}`}>
                                                        {inUse > 0 ? `${inUse} card(s) ficam sem responsável.` : 'Confirmar?'}
                                                    </span>
                                                    <button type="button" onClick={() => handleDelete(u.id)} disabled={busy} className={T.danger} title="Confirmar exclusão"><Check className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => setConfirmDeleteId(null)} className={T.iconBtn} title="Cancelar"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button type="button" onClick={() => startEdit(u)} className={T.iconBtn} title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button type="button" onClick={() => handleDelete(u.id)} className={T.danger} title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                            <Label className={T.label}>Novo responsável</Label>
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className={`h-8 text-xs ${T.field}`} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label className={T.label}>Email (opcional)</Label>
                            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@prodam.sp.gov.br" className={`h-8 text-xs ${T.field}`} />
                        </div>
                        <Button type="button" onClick={handleAdd} disabled={busy || !newName.trim()} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `CXUsersModal.tsx` compila (erros restantes só em `CXPlannerBoard.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/cx-planner/CXUsersModal.tsx
git commit -m "feat(cx-planner): modal de gestão de responsáveis"
```

---

## Task 9: Board — colunas por bucket, gestão de bucket, filtros, botões

**Files:**
- Modify: `src/app/settings/cx-planner/CXPlannerBoard.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `fetchCXPlannerBoardData`, `createCXPlannerItem`, `updateCXPlannerItem`, `deleteCXPlannerItem`, `moveCXPlannerItem(id, bucketId)`, `createBucketAction`, `renameBucketAction`, `moveBucketAction`, `deleteBucketAction` (Task 3); `CXBoardItem`, `CXBucket`, `CXUser` (Task 2); `CXPlannerCard` (Task 6); `CXPlannerItemModal` com props novas (Task 7); `CXUsersModal` (Task 8); `PRIORIDADE_OPTIONS` (board-config); `applyBodyTheme`, `THEME_STORAGE_KEY` (themeSync).
- Produces: board funcional. Sem novos exports.

- [ ] **Step 1: Reescrever `CXPlannerBoard.tsx`**

Substituir o conteúdo inteiro por:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Search, X, Sun, Moon, Users, Download, MoreVertical, ChevronLeft, ChevronRight, Pencil, Trash2, Check } from 'lucide-react';
import { CXBoardItem, CXBucket, CXUser } from '@/db/queries';
import { applyBodyTheme, THEME_STORAGE_KEY } from '@/lib/themeSync';
import {
    fetchCXPlannerBoardData,
    createCXPlannerItem,
    updateCXPlannerItem,
    deleteCXPlannerItem,
    moveCXPlannerItem,
    createBucketAction,
    renameBucketAction,
    moveBucketAction,
    deleteBucketAction,
    CXPlannerFormValues,
} from './actions';
import { CXPlannerCard } from './CXPlannerCard';
import { CXPlannerItemModal } from './CXPlannerItemModal';
import { CXUsersModal } from './CXUsersModal';
import { PRIORIDADE_OPTIONS } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

// bucketId null => coluna virtual "Entrada". Usamos essa sentinela como chave
// de coluna no board (nunca vai pro banco).
const ENTRADA = 'entrada';
type ColumnKey = number | typeof ENTRADA;

export function CXPlannerBoard() {
    const [items, setItems] = useState<CXBoardItem[]>([]);
    const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
    const [buckets, setBuckets] = useState<CXBucket[]>([]);
    const [users, setUsers] = useState<CXUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CXBoardItem | null>(null);
    const [defaultBucketForNew, setDefaultBucketForNew] = useState<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [usersModalOpen, setUsersModalOpen] = useState(false);

    const [query, setQuery] = useState('');
    const [managerFilter, setManagerFilter] = useState('');
    const [clienteFilter, setClienteFilter] = useState('');
    const [bucketFilter, setBucketFilter] = useState<string>('');
    const [responsavelFilter, setResponsavelFilter] = useState('');
    const [prioridadeFilter, setPrioridadeFilter] = useState('');

    const [newBucketMode, setNewBucketMode] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [renamingBucketId, setRenamingBucketId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [menuBucketId, setMenuBucketId] = useState<number | null>(null);
    const [confirmDeleteBucketId, setConfirmDeleteBucketId] = useState<number | null>(null);

    const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
    const lightActive = theme === 'light';

    const loadBoard = useCallback(async () => {
        const data = await fetchCXPlannerBoardData();
        setItems(data.items);
        setManagerOptions(data.managers);
        setBuckets(data.buckets);
        setUsers(data.users);
    }, []);

    useEffect(() => {
        (async () => {
            await loadBoard();
            setIsLoading(false);
        })();
    }, [loadBoard]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') {
                setThemeState(saved);
                applyBodyTheme(saved);
            }
        } catch {
            // localStorage indisponível — segue no padrão escuro.
        }
    }, []);

    const toggleTheme = () => {
        setThemeState((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // idem — só não persiste.
            }
            applyBodyTheme(next);
            return next;
        });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadBoard();
        } finally {
            setIsRefreshing(false);
        }
    };

    const openCreate = (bucketId: number | null) => {
        setEditingItem(null);
        setDefaultBucketForNew(bucketId);
        setModalOpen(true);
    };

    const openEdit = (item: CXBoardItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleSave = async (values: CXPlannerFormValues) => {
        if (editingItem) {
            const updated = await updateCXPlannerItem(editingItem.id!, values);
            if (!updated) throw new Error('Não foi possível salvar: gerente ou item não encontrado.');
            setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
        } else {
            const created = await createCXPlannerItem(values);
            if (!created) throw new Error('Não foi possível criar o item: gerente não encontrado.');
            setItems((prev) => [created, ...prev]);
        }
    };

    const handleDelete = async () => {
        if (!editingItem) return;
        await deleteCXPlannerItem(editingItem.id!);
        setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
    };

    const handleDrop = async (col: ColumnKey, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverCol(null);
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        const previous = items.find((i) => i.id === id);
        if (!previous) return;
        const newBucketId = col === ENTRADA ? null : col;
        if ((previous.bucketId ?? null) === newBucketId) return;

        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, bucketId: newBucketId } : i)));
        const result = await moveCXPlannerItem(id, newBucketId);
        if (!result) {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, bucketId: previous.bucketId ?? null } : i)));
        } else {
            setItems((prev) => prev.map((i) => (i.id === id ? result : i)));
        }
    };

    // ── Bucket management ────────────────────────────────────────────────
    const submitNewBucket = async () => {
        const name = newBucketName.trim();
        setNewBucketMode(false);
        setNewBucketName('');
        if (!name) return;
        const created = await createBucketAction(name);
        setBuckets((prev) => [...prev, created]);
    };

    const submitRename = async (id: number) => {
        const name = renameValue.trim();
        setRenamingBucketId(null);
        if (!name) return;
        setBuckets((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
        await renameBucketAction(id, name);
    };

    const handleMoveBucket = async (id: number, direction: 'left' | 'right') => {
        setMenuBucketId(null);
        await moveBucketAction(id, direction);
        await loadBoard();
    };

    const handleDeleteBucket = async (id: number) => {
        setMenuBucketId(null);
        setConfirmDeleteBucketId(null);
        await deleteBucketAction(id);
        // itens do bucket voltam pra "Entrada" (bucketId null)
        setItems((prev) => prev.map((i) => (i.bucketId === id ? { ...i, bucketId: null } : i)));
        setBuckets((prev) => prev.filter((b) => b.id !== id));
    };

    // ── Filtros ─────────────────────────────────────────────────────────
    const clienteOptions = useMemo(
        () => Array.from(new Set(items.map((i) => i.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [items]
    );

    const subtituloSuggestions = useMemo(
        () => Array.from(new Set(items.map((i) => i.subtitulo).filter((s): s is string => !!s && s.trim() !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [items]
    );

    const filteredItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            if (managerFilter && item.managerId !== managerFilter) return false;
            if (clienteFilter && item.cliente !== clienteFilter) return false;
            if (bucketFilter === ENTRADA && item.bucketId != null) return false;
            if (bucketFilter && bucketFilter !== ENTRADA && String(item.bucketId) !== bucketFilter) return false;
            if (responsavelFilter === 'none' && item.responsavelId != null) return false;
            if (responsavelFilter && responsavelFilter !== 'none' && String(item.responsavelId) !== responsavelFilter) return false;
            if (prioridadeFilter && item.prioridadeTexto !== prioridadeFilter) return false;

            if (!q) return true;
            const haystack = [
                item.managerName, item.cliente, item.titulo, item.problema, item.solucaoProposta,
                item.subtitulo, item.responsavelName, item.prioridadeTexto, item.dataInicio, item.dataFim,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [items, query, managerFilter, clienteFilter, bucketFilter, responsavelFilter, prioridadeFilter]);

    const hasActiveFilter = Boolean(query || managerFilter || clienteFilter || bucketFilter || responsavelFilter || prioridadeFilter);
    const clearFilters = () => {
        setQuery('');
        setManagerFilter('');
        setClienteFilter('');
        setBucketFilter('');
        setResponsavelFilter('');
        setPrioridadeFilter('');
    };

    const userUsageCount = useMemo(() => {
        const counts: Record<number, number> = {};
        for (const i of items) {
            if (i.responsavelId != null) counts[i.responsavelId] = (counts[i.responsavelId] ?? 0) + 1;
        }
        return counts;
    }, [items]);

    // Colunas: "Entrada" só aparece se houver item sem bucket; depois os buckets por position.
    const hasEntrada = items.some((i) => i.bucketId == null);
    const columns: { key: ColumnKey; label: string; bucket?: CXBucket }[] = [
        ...(hasEntrada ? [{ key: ENTRADA as ColumnKey, label: 'Entrada' }] : []),
        ...buckets.map((b) => ({ key: b.id as ColumnKey, label: b.name, bucket: b })),
    ];

    const downloadExcel = () => {
        let key = '';
        try {
            key = localStorage.getItem('CX_PLANNER_KEY') ?? '';
        } catch {
            key = '';
        }
        window.open(`/settings/cx-planner/export?key=${encodeURIComponent(key)}`, '_blank');
    };

    const T = {
        page: lightActive ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-50',
        subtitle: 'text-zinc-500',
        toolBtn: lightActive
            ? 'text-zinc-600 border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900'
            : 'text-zinc-300 border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:text-zinc-100',
        filterPanel: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800',
        searchIcon: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        searchInput: lightActive
            ? 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            : 'bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600',
        countText: 'text-zinc-500',
        countStrong: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        clearBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
        select: lightActive ? 'bg-white border-zinc-200 text-zinc-700' : 'bg-zinc-950 border-zinc-800 text-zinc-300',
        columnBg: lightActive ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/30',
        columnDragOver: lightActive ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-500/60 bg-indigo-500/5',
        columnHeadText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        addBtn: lightActive ? 'text-zinc-400 hover:text-indigo-600' : 'text-zinc-500 hover:text-indigo-400',
        emptyState: lightActive ? 'text-zinc-400' : 'text-zinc-700',
        menu: lightActive ? 'bg-white border-zinc-200 text-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-200',
        menuItem: lightActive ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800',
        renameInput: lightActive ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-100',
        newBucketCol: lightActive ? 'border-zinc-300 text-zinc-500 hover:border-indigo-400 hover:text-indigo-600' : 'border-zinc-800 text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400',
    };

    const selectClassName = `border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors ${T.select}`;

    if (isLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${T.page}`}>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen p-6 transition-colors duration-200 ${T.page}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">CX Planner</h1>
                    <p className={`text-sm ${T.subtitle}`}>Board de CX do time — arraste os cards entre os buckets ou clique para editar.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={toggleTheme} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${T.toolBtn}`}>
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setUsersModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${T.toolBtn}`}>
                        <Users className="w-3.5 h-3.5" /> Responsáveis
                    </button>
                    <button type="button" onClick={downloadExcel} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${T.toolBtn}`}>
                        <Download className="w-3.5 h-3.5" /> Baixar Excel
                    </button>
                    <button type="button" onClick={handleRefresh} disabled={isRefreshing} title="Buscar estado mais recente" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${T.toolBtn}`}>
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                </div>
            </div>

            <div className={`mb-4 flex flex-col gap-3 p-3 rounded-xl border transition-colors duration-200 ${T.filterPanel}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${T.searchIcon}`} />
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, descrição, subtítulo, responsável ou data..." className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors ${T.searchInput}`} />
                    </div>
                    <div className={`text-xs whitespace-nowrap ${T.countText}`}>
                        Mostrando <span className={`font-semibold ${T.countStrong}`}>{filteredItems.length}</span> de {items.length}
                    </div>
                    {hasActiveFilter && (
                        <button type="button" onClick={clearFilters} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${T.clearBtn}`}>
                            <X className="w-3 h-3" /> Limpar filtros
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os gerentes</option>
                        {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os clientes</option>
                        {clienteOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os buckets</option>
                        <option value={ENTRADA}>Entrada (sem bucket)</option>
                        {buckets.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                    </select>
                    <select value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todos os responsáveis</option>
                        <option value="none">Sem responsável</option>
                        {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                    </select>
                    <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)} className={selectClassName}>
                        <option value="">Todas as prioridades</option>
                        {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                {columns.map((col) => {
                    const colItems = filteredItems.filter((i) => (col.key === ENTRADA ? i.bucketId == null : i.bucketId === col.key));
                    const isRenaming = col.bucket && renamingBucketId === col.bucket.id;
                    const idx = col.bucket ? buckets.findIndex((b) => b.id === col.bucket!.id) : -1;
                    return (
                        <div
                            key={String(col.key)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                            onDragLeave={() => setDragOverCol((s) => (s === col.key ? null : s))}
                            onDrop={(e) => handleDrop(col.key, e)}
                            className={`rounded-xl border p-3 flex flex-col gap-3 min-h-[200px] w-[300px] shrink-0 transition-colors ${dragOverCol === col.key ? T.columnDragOver : T.columnBg}`}
                        >
                            <div className="flex items-center justify-between gap-2 relative">
                                {isRenaming ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => submitRename(col.bucket!.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename(col.bucket!.id); if (e.key === 'Escape') setRenamingBucketId(null); }}
                                        className={`flex-1 text-xs font-bold rounded px-2 py-1 border focus:outline-none ${T.renameInput}`}
                                    />
                                ) : (
                                    <h2 className={`text-xs font-bold uppercase tracking-wider truncate ${T.columnHeadText}`}>{col.label} ({colItems.length})</h2>
                                )}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => openCreate(col.key === ENTRADA ? null : (col.key as number))} className={`transition-colors ${T.addBtn}`} title="Nova tarefa">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    {col.bucket && (
                                        <button type="button" onClick={() => setMenuBucketId((v) => (v === col.bucket!.id ? null : col.bucket!.id))} className={`transition-colors ${T.addBtn}`} title="Opções do bucket">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {col.bucket && menuBucketId === col.bucket.id && (
                                    <div className={`absolute right-0 top-7 z-10 w-40 rounded-lg border shadow-lg text-xs overflow-hidden ${T.menu}`}>
                                        {confirmDeleteBucketId === col.bucket.id ? (
                                            <button type="button" onClick={() => handleDeleteBucket(col.bucket!.id)} className={`w-full text-left px-3 py-2 text-red-500 flex items-center gap-2 ${T.menuItem}`}>
                                                <Check className="w-3.5 h-3.5" /> Confirmar exclusão
                                            </button>
                                        ) : (
                                            <>
                                                <button type="button" onClick={() => { setRenamingBucketId(col.bucket!.id); setRenameValue(col.bucket!.name); setMenuBucketId(null); }} className={`w-full text-left px-3 py-2 flex items-center gap-2 ${T.menuItem}`}>
                                                    <Pencil className="w-3.5 h-3.5" /> Renomear
                                                </button>
                                                <button type="button" disabled={idx <= 0} onClick={() => handleMoveBucket(col.bucket!.id, 'left')} className={`w-full text-left px-3 py-2 flex items-center gap-2 disabled:opacity-40 ${T.menuItem}`}>
                                                    <ChevronLeft className="w-3.5 h-3.5" /> Mover para esquerda
                                                </button>
                                                <button type="button" disabled={idx >= buckets.length - 1} onClick={() => handleMoveBucket(col.bucket!.id, 'right')} className={`w-full text-left px-3 py-2 flex items-center gap-2 disabled:opacity-40 ${T.menuItem}`}>
                                                    <ChevronRight className="w-3.5 h-3.5" /> Mover para direita
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteBucketId(col.bucket!.id)} className={`w-full text-left px-3 py-2 text-red-500 flex items-center gap-2 ${T.menuItem}`}>
                                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                {colItems.map((item) => (
                                    <div key={item.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}>
                                        <CXPlannerCard item={item} onClick={() => openEdit(item)} lightActive={lightActive} />
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <p className={`text-xs text-center py-6 ${T.emptyState}`}>
                                        {hasActiveFilter ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="w-[220px] shrink-0">
                    {newBucketMode ? (
                        <input
                            autoFocus
                            value={newBucketName}
                            onChange={(e) => setNewBucketName(e.target.value)}
                            onBlur={submitNewBucket}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitNewBucket(); if (e.key === 'Escape') { setNewBucketMode(false); setNewBucketName(''); } }}
                            placeholder="Nome do bucket"
                            className={`w-full text-xs font-bold rounded-lg px-3 py-2 border focus:outline-none ${T.renameInput}`}
                        />
                    ) : (
                        <button type="button" onClick={() => setNewBucketMode(true)} className={`w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-xs font-semibold transition-colors ${T.newBucketCol}`}>
                            <Plus className="w-4 h-4" /> Adicionar bucket
                        </button>
                    )}
                </div>
            </div>

            <CXPlannerItemModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                item={editingItem}
                managerOptions={managerOptions}
                bucketOptions={buckets.map((b) => ({ id: b.id, name: b.name }))}
                userOptions={users.map((u) => ({ id: u.id, name: u.name }))}
                subtituloSuggestions={subtituloSuggestions}
                defaultManagerId={managerOptions[0]?.id}
                defaultBucketId={defaultBucketForNew}
                onSave={handleSave}
                onDelete={editingItem ? handleDelete : undefined}
                lightActive={lightActive}
            />

            <CXUsersModal
                open={usersModalOpen}
                onOpenChange={setUsersModalOpen}
                users={users}
                usageCount={userUsageCount}
                onChanged={loadBoard}
                lightActive={lightActive}
            />
        </div>
    );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: **sem erros** em todo o projeto.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erro; a rota `/settings/cx-planner/export` aparece na listagem de rotas.

- [ ] **Step 4: Walkthrough manual**

Com `npm run dev` (porta 6001), abrir `http://localhost:6001/settings/cx-planner` (chave `prodam_cx_2026`):

1. Board carrega. Se houver itens legados sem bucket, a coluna "Entrada" aparece à esquerda.
2. "Adicionar bucket" → digitar nome → Enter. Coluna nova aparece.
3. No menu `⋯` da coluna: Renomear (muda o título); Mover esquerda/direita (reordena, desabilitado nas pontas); Excluir (2 cliques — cards voltam pra "Entrada").
4. `+` no cabeçalho de um bucket → modal abre já com aquele bucket selecionado. Preencher gerente, cliente, título, **subtítulo** (autocomplete sugere áreas já usadas), **responsável**, prioridade, %. Salvar → card aparece na coluna, com subtítulo (pill) e responsável (iniciais + nome).
5. Mexer o slider de % → o badge "Status" no modal muda (Pendente/Em Análise/Resolvido) sozinho, sem controle manual.
6. Arrastar card entre colunas (incluindo "Entrada"). Recarregar a página → posição persiste.
7. Filtros: bucket, responsável, "Sem responsável", busca por subtítulo. Contador "Mostrando X de N" acompanha.
8. Botão "Responsáveis" → adicionar/editar/remover. Remover um responsável em uso → aviso "N card(s) ficam sem responsável"; confirmar → cards perdem o responsável.
9. Botão "Baixar Excel" → baixa `Demandas CX.xlsx`. Abrir: 6 abas; "Dados Consolidados" com 1 linha por card e as 19 colunas; "Buckets"/"Usuários" com o que está na tela; "Categoria" = nome do bucket (ou vazio p/ "Entrada").
10. Abrir `http://localhost:6001/` → aba CX de um gerente que tem itens no board → itens seguem aparecendo com status/criticidade coerentes com o % e a prioridade definidos no board.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/cx-planner/CXPlannerBoard.tsx
git commit -m "feat(cx-planner): board Kanban por bucket, gestão de buckets, filtros e botão de export"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito do spec | Task |
|---|---|
| Tabelas `cx_buckets` / `cx_users`; colunas `bucket_id` / `responsavel_id` / `subtitulo` | Task 1 |
| Migration à mão em `src/db/migrations/` | Task 1 |
| `status`/`criticidade` derivados; `CXTab`/`/settings` intactos | Task 3 (`statusFromPercent`), nada toca `CXTab`/`CXEditor` |
| CRUD de bucket (criar/renomear/reordenar/excluir) | Task 2 (queries) + Task 3 (actions) + Task 9 (UI) |
| Item sem bucket → coluna "Entrada" fixa; import/planner-sync não tocados | Task 9 (`ENTRADA`/`hasEntrada`); Task 1 mantém `bucket_id` nullable |
| Responsável = lista gerenciável (`cx_users`) | Task 2 + Task 3 + Task 8 (modal) + Task 7 (select no item) |
| Subtítulo = texto livre com autocomplete | Task 7 (`<datalist>`) + Task 9 (`subtituloSuggestions`) |
| Card estilo Planner (subtítulo pill, responsável com iniciais, prazo, %) | Task 6 |
| Modal: + subtítulo/responsável/bucket, − status manual (badge read-only) | Task 7 |
| Filtros: busca cobre subtítulo/responsável; select bucket substitui status; + select responsável | Task 9 |
| Drag-and-drop grava só `bucket_id`, não mexe em `%`/status | Task 9 (`handleDrop` + `moveCXPlannerItem`) |
| Export: `GET /settings/cx-planner/export`, board inteiro, ignora filtros | Task 5 (route usa `fetchAllCXItemsForBoard`, sem filtro) |
| Export: 6 abas, 19 colunas, mapeamento por item, `managerTag`, Metas vazia | Task 4 |
| Export: acesso via `?key=` comparado a `CX_PLANNER_KEY` | Task 5 |
| `exceljs` nova dependência | Task 4 Step 1 |
| Sem import de Excel | não há task de import — correto |
| Excluir responsável em uso → `set null` + aviso de contagem | Task 2 (`deleteCXUser`) + Task 8 (`usageCount`) |
| Excluir bucket → cards pra "Entrada" (null explícito) | Task 2 (`deleteCXBucket`) + Task 9 |
| Board vazio → export só com cabeçalhos | Task 4 (loops sobre arrays vazios) + Task 4 Step: coberto implicitamente; `verify` cobre Metas-só-header |
| Verificação = tsc + lint + build + walkthrough (sem test runner) | todas as tasks |

**2. Placeholder scan:** Sem "TBD"/"TODO"/"handle edge cases" genéricos. Todo passo de código tem bloco de código real. O único ponto aberto declarado é o fallback do Step 6 da Task 2 (rodar via arquivo se `tsx -e` falhar) — com instrução concreta.

**3. Type consistency:**
- `moveCXPlannerItem(id, bucketId: number | null)` — assinatura nova usada consistentemente em Task 3 (define) e Task 9 (`handleDrop`).
- `fetchCXPlannerBoardData` retorna `{ items, managers, buckets, users }` — Task 3 define, Task 9 consome com os mesmos nomes.
- `CXBoardItem` ganha `bucketId`/`responsavelId`/`responsavelName`/`subtitulo` em Task 2; consumido em Tasks 4, 6, 7, 9 com esses nomes.
- `buildCXPlannerWorkbook({ items, buckets, users, managers })` — Task 4 define objeto único; Task 5 chama com as 4 chaves.
- `CXExportManager { id, name, role }` — Task 4 define; Task 5 monta via `managers.map(m => ({ id, name, role }))` a partir de `fetchManagersList` (que traz `role`).
- `STATUS_LABELS` (Task 6) — consumido em Task 7; `STATUS_COLUMNS` removido e não referenciado em nenhuma task posterior (Task 7 troca o import, Task 9 não usa).
- `CXUsersModal` props (`users`, `usageCount`, `onChanged`, `lightActive`, `open`, `onOpenChange`) — Task 8 define, Task 9 passa exatamente essas.
- `CXPlannerItemModal` props novas (`bucketOptions`, `userOptions`, `subtituloSuggestions`, `defaultBucketId`; sem `defaultStatus`) — Task 7 define, Task 9 passa exatamente essas.

Nenhuma inconsistência encontrada.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-01-cx-planner-buckets-export.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

---

## Addendum (2026-09-01, durante execução)

Pedido do usuário no meio da execução: colunas lado a lado como antes / como o Planner, e
reordenar bucket por **drag-and-drop** (não só o menu ⋯).

- **`0014_seed_cx_buckets.sql`** (novo) — semeia os 4 buckets do board real do Planner
  (`CX - Em Análise`, `Área Técnica - Em andamento`, `Comercial / Cliente`, `Concluído`),
  idempotente, só se `cx_buckets` estiver vazia. Assim o board abre com as colunas lado a lado
  em vez de só a "Entrada" (todos os ~148 itens legados entram sem bucket).
- **`setCXBucketPositions(orderedIds)`** (queries.ts) + **`reorderBucketsAction(orderedIds)`**
  (actions.ts) — grava `position = índice`.
- **CXPlannerBoard.tsx** — cabeçalho da coluna (só buckets reais, não "Entrada") vira `draggable`
  com um ícone `GripVertical`; `onDragStart` seta `application/x-bucket-id`; `handleDrop` ganha um
  branch no topo que, se o drag for de bucket, reordena a lista e persiste. O menu ⋯
  (mover ⬅/➡) continua funcionando.
- Layout já era `flex gap-4 overflow-x-auto` com colunas `w-[300px] shrink-0` — lado a lado com
  scroll horizontal, estilo Planner. Sem mudança.

Também: `scripts/clear-cx.ts:31` (erro de tipo pré-existente, fora do plano) recebeu um
`as unknown as` pra desbloquear o `tsc`/build — commit à parte.

### Addendum 2 (2026-09-01)

Pedido do usuário: no import do JSON os itens já devem cair nas colunas certas (não numa pilha
"Entrada"), e ter um lugar visível pra criar bucket.

- **`syncPlannerTasks`** (`src/lib/planner-sync.ts`) — agora resolve um bucket por status derivado
  (`resolvido` → "Concluído"; `pendente`/`analise` → "CX - Em Análise"; fallback = 1º bucket por
  posição; null se não houver bucket). Aplica no INSERT sempre e no UPDATE só quando `bucket_id`
  ainda é null (não desfaz organização manual). `fetchCXByExternalIds` (queries.ts) passou a
  devolver `bucketId`.
- **`scripts/import-cx-planner.ts`** — mesma lógica no path ad-hoc.
- **`scripts/backfill-cx-buckets.ts`** (novo) — distribui os itens já existentes sem bucket pela
  mesma regra. `--apply` pra gravar. Rodado uma vez no banco local (148 itens: 15 → "CX - Em
  Análise", 133 → "Concluído").
- **CXPlannerBoard.tsx** — botão "Novo bucket" na barra de filtros (à direita), além do
  "+ Adicionar bucket" no fim das colunas.

Isso desvia do "não tocar em planner-sync.ts" do plano original — feito a pedido explícito do
usuário durante a execução.

### Addendum 3 (2026-09-01)

Pedido do usuário: o "Baixar Excel" deve respeitar os filtros ativos (sem filtro = planilha
completa), e a planilha precisa ser legível (nada de célula "null"/vazia crua).

- **`src/app/settings/cx-planner/cx-filter.ts`** (novo) — `filterCXBoardItems(items, params)`,
  predicado único compartilhado entre `CXPlannerBoard` (colunas) e o route do export. Reverte a
  decisão original "export sempre o board inteiro".
- **`export/route.ts`** — lê `q/manager/cliente/bucket/responsavel/prioridade` da query string e
  aplica antes de montar o workbook. Sem params => planilha completa. Abas Buckets/Usuários
  seguem completas (dado de referência).
- **`CXPlannerBoard.tsx`** — `filteredItems` passa a usar `filterCXBoardItems`; `downloadExcel`
  monta a query string com os filtros ativos.
- **`cx-planner-export.ts`** — legibilidade: `É Recorrente`/`Atrasados` viram "Sim"/"Não" na aba
  "Dados Consolidados" (a "Tarefas" continua "true"/"false" pra reimport); categoria/responsável/
  prioridade vazios viram "Entrada (sem bucket)" / "Sem responsável" / "Sem prioridade"; área do
  Rótulo ganha inicial maiúscula; cabeçalho em negrito + congelado + autofiltro + larguras de
  coluna.
- `scripts/verify-cx-export.ts` — +14 asserts (legibilidade + filtro).
