# CX Planner Admin Area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the CX team (4 people) a dedicated Kanban board inside the admin area (`/settings/cx-planner`) to manage CX items directly in the dashboard, with full-fidelity Planner fields (dates, % complete, priority text), replacing the standalone Microsoft Planner as their working tool.

**Architecture:** Adds 4 nullable columns to the existing `cx` table (additive, no schema breakage). A new sub-route under `/settings` gets its own key gate (`CX_PLANNER_KEY`, independent of `SETTINGS_KEY`) and a client-managed Kanban board (columns = status) backed by granular per-item Server Actions (create/update/delete/move), avoiding the existing "delete-all-reinsert" pattern so 4 concurrent editors don't clobber each other. `status`/`criticidade` — already consumed by `CXTab.tsx` and `CXEditor.tsx` — keep working unchanged: `criticidade` is now always server-derived from the new `prioridadeTexto` field (reusing `mapCriticidade` from `planner-sync.ts`), and `status` is chosen directly by the CX team (button group / column) exactly like today, with the % slider only suggesting a default. The existing "Upload Planner (CX)" button becomes the migration path once `syncPlannerTasks` also persists the new fields.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (Turso/LibSQL), TailwindCSS 4, Shadcn/UI (Dialog, Select, Button, Input, Label), native HTML5 drag-and-drop (no new dependency).

## Global Constraints

- No test runner is configured in this repo (confirmed in `CLAUDE.md`) — every task's verification uses `npx tsc --noEmit`, `npm run lint`, and either a throwaway script under `temp/` (gitignored, matches the existing `cx-query.ts` debug-script convention) or a manual dev-server walkthrough. Do not add Jest/Vitest/etc.
- All UI copy is pt-BR, matching the rest of the dashboard.
- Raw Drizzle queries only live in `src/db/queries.ts` — no other file imports `@/db/schema` tables directly (`CLAUDE.md` architecture rule).
- Key-gate pattern: client gate component + `'use server'` verify action + own env var with a hardcoded fallback default, mirroring `SETTINGS_KEY`/`STORE_PUBLIC_KEY`/`PIPELINE_KEY` (`CLAUDE.md` access-control table).
- No new npm dependencies — everything needed (Dialog, Select, drag-and-drop) is already available.
- Work happens on the `cx_planner` branch (already created from `v2_ls` and checked out) — commit at the end of every task.
- Spec: `docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md` — this plan implements it in full; don't reintroduce scope it explicitly excluded (no per-person login, no edit locks, no bidirectional continuous sync, no changes to `CXTab.tsx`/`CXEditor.tsx` behavior).

---

## File Structure

```
src/db/schema.ts                              MODIFY — 4 new columns on `cx`
src/db/migrations/0012_cx_planner_fields.sql   CREATE — the migration
src/types/manager.ts                           MODIFY — CXItem gains 4 optional fields
src/lib/planner-sync.ts                        MODIFY — persist new fields, export mapStatus/mapCriticidade
src/db/queries.ts                              MODIFY — fetchCXByManager mapping, + fetchAllCXItemsForBoard, + deleteCXItem
CLAUDE.md                                      MODIFY — add CX Planner row to access-control table
src/app/settings/cx-planner/CXPlannerGate.tsx  CREATE — key gate (own key, modeled on KeyGate.tsx)
src/app/settings/cx-planner/actions.ts         CREATE — 'use server': verify + fetch + CRUD + move
src/app/settings/cx-planner/page.tsx           CREATE — gate + board wiring
src/app/settings/cx-planner/board-config.ts    CREATE — status columns + priority color config
src/app/settings/cx-planner/CXPlannerCard.tsx  CREATE — Kanban card
src/app/settings/cx-planner/CXPlannerItemModal.tsx CREATE — create/edit form
src/app/settings/cx-planner/CXPlannerBoard.tsx CREATE — Kanban board (fetch, DnD, wiring)
```

Nothing in `src/components/dashboard/tabs/CXTab.tsx`, `src/app/settings/CXEditor.tsx`, `src/app/settings/SettingsDashboard.tsx`, `src/app/api/external/v1/planner-sync/`, or `src/lib/planner-pull.ts` is modified.

---

### Task 1: Schema, migration, and types

**Files:**
- Modify: `src/db/schema.ts:33-53` (the `cx` table)
- Create: `src/db/migrations/0012_cx_planner_fields.sql`
- Modify: `src/types/manager.ts:42-60` (the `CXItem` interface)

**Interfaces:**
- Produces: 4 new nullable columns on `cx` — `data_inicio` (text), `data_fim` (text), `percent_complete` (integer), `prioridade_texto` (text). Drizzle field names: `dataInicio`, `dataFim`, `percentComplete`, `prioridadeTexto` on `typeof cx.$inferInsert`/`$inferSelect`. `CXItem` gains the same 4 optional fields (`string | null` / `number | null`).

- [ ] **Step 1: Add the 4 columns to the `cx` table in the schema**

In `src/db/schema.ts`, replace the `cx` table definition:

```typescript
export const cx = sqliteTable('cx', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    managerId: text('manager_id').notNull().references(() => managers.id, { onDelete: 'cascade' }),
    cliente: text('cliente').notNull(),
    titulo: text('titulo').notNull().default(''),
    problema: text('problema').notNull(),
    solucaoProposta: text('solucao_proposta').notNull(),
    status: text('status', { enum: ['pendente', 'analise', 'resolvido'] }).notNull().default('pendente'),
    criticidade: text('criticidade', { enum: ['baixa', 'media', 'alta'] }).notNull().default('baixa'),
    isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
    externalId: text('external_id'),
    // Marca (timestamp ISO) que um item vindo do Planner (tem externalId) foi
    // editado à mão no Settings desde o último sync — os campos que o Planner
    // controla (titulo/problema/status/criticidade) vão ser sobrescritos no
    // próximo sync, então isso avisa o admin disso. Nulo = em dia com o
    // Planner (ou item 100% manual, nunca veio de lá). Ver src/lib/planner-sync.ts
    // (limpa o campo a cada sync) e src/app/settings/actions.ts (seta o campo
    // quando detecta que um item sincronizado foi alterado antes de salvar).
    manualEditAt: text('manual_edit_at'),
    // Campos de fidelidade total ao Planner (ver
    // docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md). Vêm do
    // sync (src/lib/planner-sync.ts) e são editáveis direto no board
    // /settings/cx-planner. status/criticidade acima continuam sendo a fonte
    // usada pela tela final do gerente e por /settings — aqui é só o dado
    // bruto adicional, nada os substitui.
    dataInicio: text('data_inicio'),
    dataFim: text('data_fim'),
    percentComplete: integer('percent_complete'),
    prioridadeTexto: text('prioridade_texto'),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Write the migration**

Create `src/db/migrations/0012_cx_planner_fields.sql` (same plain-SQL + `--> statement-breakpoint` format as `src/db/migrations/0007_add_project_vigencia_and_history.sql`):

```sql
ALTER TABLE cx ADD COLUMN data_inicio TEXT;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN data_fim TEXT;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN percent_complete INTEGER;
--> statement-breakpoint
ALTER TABLE cx ADD COLUMN prioridade_texto TEXT;
```

- [ ] **Step 3: Extend the `CXItem` type**

In `src/types/manager.ts`, replace the `CXItem` interface:

```typescript
export interface CXItem {
  id?: number;
  cliente: string;
  titulo: string;
  problema: string;
  solucaoProposta: string;
  status: CXStatus;
  criticidade?: CXCriticidade;
  isVisible?: boolean;
  createdAt?: string;
  // Vínculo com a tarefa do Planner que originou este item (null/undefined
  // para itens criados manualmente no Settings). Preservado no round-trip
  // editar→salvar para não quebrar a sincronização — ver saveCXData.
  externalId?: string | null;
  // Timestamp (ISO) setado quando um item vindo do Planner é editado à mão
  // no Settings desde o último sync; limpo pelo próprio sync ao rodar de
  // novo. Só usado para exibir um aviso pro admin — não editável na UI.
  manualEditAt?: string | null;
  // Fidelidade total ao Planner (board /settings/cx-planner) — ver
  // docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md.
  dataInicio?: string | null;
  dataFim?: string | null;
  percentComplete?: number | null;
  prioridadeTexto?: string | null;
}
```

- [ ] **Step 4: Apply the migration and verify the columns exist**

Run: `npx tsc --noEmit` — expect no errors (schema/types still compile).

Run: `npm run db:migrate` — expect `✓ applied 0012_cx_planner_fields.sql` in the output.

Create a throwaway check script `temp/verify-0012-columns.ts`:

```typescript
import 'dotenv/config';
import { createClient } from '@libsql/client';

async function main() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const res = await client.execute('PRAGMA table_info(cx);');
    const names = res.rows.map((r: any) => r.name as string);
    const expected = ['data_inicio', 'data_fim', 'percent_complete', 'prioridade_texto'];
    const missing = expected.filter((c) => !names.includes(c));
    if (missing.length > 0) {
        console.error('FAIL — missing columns:', missing);
        process.exit(1);
    }
    console.log('PASS — all 4 columns present:', expected);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Run: `npx tsx temp/verify-0012-columns.ts`
Expected: `PASS — all 4 columns present: [ 'data_inicio', 'data_fim', 'percent_complete', 'prioridade_texto' ]`

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/0012_cx_planner_fields.sql src/types/manager.ts
git commit -m "feat: add Planner-fidelity fields (dates, percent, priority text) to cx table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `planner-sync.ts` — persist full-fidelity fields, export derivation helpers

**Files:**
- Modify: `src/lib/planner-sync.ts:62-74` (make `mapStatus`/`mapCriticidade` exported), `:174-207` (insert/update payloads)

**Interfaces:**
- Consumes: `PlannerTask` fields `datainicio?: string`, `datafim?: string`, `prioridade?: string`, `percentComplete?: string | number` (already defined in `PlannerTaskSchema`, unchanged).
- Produces: `export function mapStatus(percentComplete?: string | number): 'pendente' | 'analise' | 'resolvido'` and `export function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta'` — Task 5 imports both from `@/lib/planner-sync`.

- [ ] **Step 1: Export the two mapping helpers**

In `src/lib/planner-sync.ts`, change:

```typescript
function mapStatus(percentComplete?: string | number): 'pendente' | 'analise' | 'resolvido' {
```
to
```typescript
export function mapStatus(percentComplete?: string | number): 'pendente' | 'analise' | 'resolvido' {
```

and change:

```typescript
function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta' {
```
to
```typescript
export function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta' {
```

- [ ] **Step 2: Add a percent-complete parser for storage**

Directly below the existing `mapCriticidade` function in `src/lib/planner-sync.ts`, add:

```typescript
// Guarda o percentComplete bruto do Planner (0-100) para o board de CX ler —
// diferente de mapStatus, que só usa esse valor para decidir pendente/
// análise/resolvido. null quando o Planner não mandou o campo (em vez de
// assumir 0, que enganaria "0% preenchido" com "sem dado").
function parsePercentComplete(pc?: string | number): number | null {
    if (pc === undefined) return null;
    const n = typeof pc === 'number' ? pc : parseInt(pc, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
}
```

- [ ] **Step 3: Persist the new fields on both insert and update**

In `src/lib/planner-sync.ts`, inside `syncPlannerTasks`, the update branch currently reads:

```typescript
                await tx.update(cx).set({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                    // A linha volta a espelhar o Planner — qualquer edição
                    // manual feita no Settings antes deste sync deixa de
                    // divergir, então o aviso de "editado manualmente" some.
                    manualEditAt: null,
                }).where(eq(cx.id, existingRow.id));
```

Replace with:

```typescript
                await tx.update(cx).set({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                    // A linha volta a espelhar o Planner — qualquer edição
                    // manual feita no Settings antes deste sync deixa de
                    // divergir, então o aviso de "editado manualmente" some.
                    manualEditAt: null,
                    dataInicio: t.datainicio ?? null,
                    dataFim: t.datafim ?? null,
                    percentComplete: parsePercentComplete(t.percentComplete),
                    prioridadeTexto: t.prioridade ?? null,
                }).where(eq(cx.id, existingRow.id));
```

And the insert branch currently reads:

```typescript
                await tx.insert(cx).values({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema: newProblema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                    solucaoProposta: '',
                    isVisible: true,
                    createdAt: t.datainicio || new Date().toISOString(),
                });
```

Replace with:

```typescript
                await tx.insert(cx).values({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema: newProblema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                    solucaoProposta: '',
                    isVisible: true,
                    createdAt: t.datainicio || new Date().toISOString(),
                    dataInicio: t.datainicio ?? null,
                    dataFim: t.datafim ?? null,
                    percentComplete: parsePercentComplete(t.percentComplete),
                    prioridadeTexto: t.prioridade ?? null,
                });
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expect no errors.

Create `temp/verify-parse-percent.ts`:

```typescript
// Standalone check of parsePercentComplete's boundary behavior — no DB
// needed since it's a pure function. mapStatus/mapCriticidade already have
// implicit coverage via the existing sync flow; this only checks the new
// helper introduced in this task.
function parsePercentComplete(pc?: string | number): number | null {
    if (pc === undefined) return null;
    const n = typeof pc === 'number' ? pc : parseInt(pc, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
}

const cases: [string | number | undefined, number | null][] = [
    [undefined, null],
    [50, 50],
    ['75', 75],
    [150, 100],
    [-10, 0],
    ['not-a-number', null],
];

let failed = false;
for (const [input, expected] of cases) {
    const got = parsePercentComplete(input);
    if (got !== expected) {
        failed = true;
        console.error(`FAIL — parsePercentComplete(${JSON.stringify(input)}) = ${got}, expected ${expected}`);
    }
}
if (failed) process.exit(1);
console.log('PASS — parsePercentComplete boundary cases');
```

Run: `npx tsx temp/verify-parse-percent.ts`
Expected: `PASS — parsePercentComplete boundary cases`

- [ ] **Step 5: Commit**

```bash
git add src/lib/planner-sync.ts
git commit -m "feat: persist Planner dates/percent/priority fields on sync, export mapStatus/mapCriticidade

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `queries.ts` — extend CX read/write helpers

**Files:**
- Modify: `src/db/queries.ts:113-128` (`fetchCXByManager` mapping)
- Modify: `src/db/queries.ts:347-381` (CX Queries section — add `CXBoardItem`, `fetchAllCXItemsForBoard`, `deleteCXItem`)

**Interfaces:**
- Consumes: `cx` and `managers` tables from `./schema` (already imported), `desc`/`eq` from `drizzle-orm` (already imported).
- Produces: `export type CXBoardItem = CXItem & { managerId: string; managerName: string }`, `export async function fetchAllCXItemsForBoard(): Promise<CXBoardItem[]>`, `export async function deleteCXItem(id: number): Promise<void>` — all three consumed by Task 5 (`actions.ts`).

- [ ] **Step 1: Include the new fields in `fetchCXByManager`'s mapping**

In `src/db/queries.ts`, replace:

```typescript
export async function fetchCXByManager(managerId: string): Promise<CXItem[]> {
    const rows = await db.select().from(cx).where(eq(cx.managerId, managerId));
    return rows.map((r) => ({
        id: r.id,
        cliente: r.cliente,
        titulo: r.titulo,
        problema: r.problema,
        solucaoProposta: r.solucaoProposta,
        status: r.status as CXItem['status'],
        criticidade: (r.criticidade as CXItem['criticidade']) ?? 'baixa',
        isVisible: r.isVisible ?? true,
        createdAt: r.createdAt,
        externalId: r.externalId,
        manualEditAt: r.manualEditAt,
    }));
}
```

with:

```typescript
export async function fetchCXByManager(managerId: string): Promise<CXItem[]> {
    const rows = await db.select().from(cx).where(eq(cx.managerId, managerId));
    return rows.map((r) => ({
        id: r.id,
        cliente: r.cliente,
        titulo: r.titulo,
        problema: r.problema,
        solucaoProposta: r.solucaoProposta,
        status: r.status as CXItem['status'],
        criticidade: (r.criticidade as CXItem['criticidade']) ?? 'baixa',
        isVisible: r.isVisible ?? true,
        createdAt: r.createdAt,
        externalId: r.externalId,
        manualEditAt: r.manualEditAt,
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        percentComplete: r.percentComplete,
        prioridadeTexto: r.prioridadeTexto,
    }));
}
```

- [ ] **Step 2: Add `CXBoardItem`, `fetchAllCXItemsForBoard`, and `deleteCXItem`**

In `src/db/queries.ts`, in the `// ─── CX Queries ──` section (right after the existing `fetchCXByExternalIds` function, before `// ─── Project Queries ──`), add:

```typescript
// Board de CX (/settings/cx-planner) — mostra os itens de TODOS os
// gerentes juntos (diferente de fetchCXByManager, que é por gerente), com
// o nome do gerente já resolvido para exibir no card sem N+1 lookups.
export type CXBoardItem = CXItem & {
    managerId: string;
    managerName: string;
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
        })
        .from(cx)
        .innerJoin(managers, eq(cx.managerId, managers.id))
        .orderBy(desc(cx.createdAt));

    return rows.map((r) => ({
        ...r,
        status: r.status as CXItem['status'],
        criticidade: (r.criticidade as CXItem['criticidade']) ?? 'baixa',
        isVisible: r.isVisible ?? true,
    }));
}

export async function deleteCXItem(id: number): Promise<void> {
    await db.delete(cx).where(eq(cx.id, id));
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expect no errors.

Create `temp/verify-cx-board-query.ts`:

```typescript
import 'dotenv/config';
import { fetchAllCXItemsForBoard } from './src/db/queries';

async function main() {
    const items = await fetchAllCXItemsForBoard();
    console.log(`PASS — fetchAllCXItemsForBoard returned ${items.length} item(s)`);
    if (items.length > 0) {
        const sample = items[0];
        const requiredKeys = ['id', 'managerId', 'managerName', 'cliente', 'status', 'dataInicio', 'dataFim', 'percentComplete', 'prioridadeTexto'];
        const missing = requiredKeys.filter((k) => !(k in sample));
        if (missing.length > 0) {
            console.error('FAIL — sample item missing keys:', missing);
            process.exit(1);
        }
        console.log('PASS — sample item shape OK:', Object.keys(sample));
    }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Run: `npx tsx temp/verify-cx-board-query.ts`
Expected: `PASS — fetchAllCXItemsForBoard returned N item(s)` (N can be 0 on a fresh DB — that's fine, the shape check only runs when N > 0).

- [ ] **Step 4: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat: add fetchAllCXItemsForBoard and deleteCXItem query helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Access gate and route skeleton

**Files:**
- Create: `src/app/settings/cx-planner/CXPlannerGate.tsx`
- Create: `src/app/settings/cx-planner/actions.ts` (verify function only in this task — Task 5 appends the rest)
- Create: `src/app/settings/cx-planner/page.tsx`
- Modify: `CLAUDE.md` (access-control table)

**Interfaces:**
- Produces: `export async function verifyCXPlannerKey(key: string): Promise<boolean>` in `actions.ts` (Task 5 adds more exports to this same file). `CXPlannerGate` component wraps children behind the key check, same contract as `KeyGate`.
- Env var: `CX_PLANNER_KEY` (fallback default `'prodam_cx_2026'` if unset).

- [ ] **Step 1: Create the verify action**

Create `src/app/settings/cx-planner/actions.ts`:

```typescript
'use server';

export async function verifyCXPlannerKey(key: string) {
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    return key === correctKey;
}
```

- [ ] **Step 2: Create the gate component**

Create `src/app/settings/cx-planner/CXPlannerGate.tsx` (modeled on `src/app/settings/KeyGate.tsx`, own storage key so it doesn't collide with `SETTINGS_KEY`):

```typescript
'use client';

import { useState, useEffect } from 'react';
import { verifyCXPlannerKey } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export function CXPlannerGate({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        const storedKey = localStorage.getItem('CX_PLANNER_KEY');
        if (storedKey) {
            verifyCXPlannerKey(storedKey).then((isValid) => {
                if (isValid) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem('CX_PLANNER_KEY');
                }
                setIsChecking(false);
            });
        } else {
            setIsChecking(false);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setIsChecking(true);
        const isValid = await verifyCXPlannerKey(password);
        if (isValid) {
            localStorage.setItem('CX_PLANNER_KEY', password);
            setIsAuthenticated(true);
        } else {
            setError(true);
        }
        setIsChecking(false);
    };

    if (isChecking && !isAuthenticated) {
        return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" /></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">CX Planner</h1>
                    <p className="text-zinc-400 text-center mb-8">Área restrita ao time de CX. Insira a chave de acesso.</p>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <Input
                            type="password"
                            placeholder="Insira a chave..."
                            className="bg-zinc-950 border-zinc-800 focus-visible:ring-indigo-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm font-medium">Chave incorreta. Tente novamente.</p>}
                        <Button type="submit" disabled={isChecking} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                            Liberar Acesso
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
```

- [ ] **Step 3: Create the page (placeholder body — Task 8 wires in the real board)**

Create `src/app/settings/cx-planner/page.tsx`:

```typescript
import { CXPlannerGate } from './CXPlannerGate';

export default function CXPlannerPage() {
    return (
        <CXPlannerGate>
            <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
                <p className="text-zinc-400">Board de CX em construção.</p>
            </div>
        </CXPlannerGate>
    );
}
```

- [ ] **Step 4: Document the new gate in `CLAUDE.md`**

In `CLAUDE.md`, the access-control table currently ends with:

```
| `/store` public view | `src/app/store/KeyGateStore.tsx` | in `src/app/store/actions.ts` | `STORE_PUBLIC_KEY` |
```

Add a row right after it:

```
| `/settings/cx-planner` (CX team board) | `CXPlannerGate.tsx` | `verifyCXPlannerKey` (`src/app/settings/cx-planner/actions.ts`) | `CX_PLANNER_KEY` (default `prodam_cx_2026`) |
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no new errors.

Manual check: run `npm run dev` (background), open `http://localhost:6000/settings/cx-planner` in a browser.
Expected: "CX Planner" lock screen appears. Typing a wrong key shows "Chave incorreta." Typing `prodam_cx_2026` (the fallback default, since no `CX_PLANNER_KEY` env var is set locally) shows "Board de CX em construção."

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/cx-planner/CXPlannerGate.tsx src/app/settings/cx-planner/actions.ts src/app/settings/cx-planner/page.tsx CLAUDE.md
git commit -m "feat: add /settings/cx-planner route skeleton with its own key gate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: CX Planner CRUD and fetch server actions

**Files:**
- Modify: `src/app/settings/cx-planner/actions.ts` (append to the file from Task 4)

**Interfaces:**
- Consumes: `fetchAllCXItemsForBoard`, `deleteCXItem`, `CXBoardItem`, `fetchManagersList`, `fetchManagerById`, `createCXItem`, `updateCXItem` (all from `@/db/queries`, Task 3); `mapCriticidade` (from `@/lib/planner-sync`, Task 2); `CXStatus` (from `@/types/manager`).
- Produces (all consumed by Task 8's `CXPlannerBoard.tsx` and Task 7's `CXPlannerItemModal.tsx`):
  - `export type CXPlannerFormValues = { managerId: string; cliente: string; titulo: string; problema: string; solucaoProposta: string; status: CXStatus; dataInicio: string; dataFim: string; percentComplete: number; prioridadeTexto: string }`
  - `export async function fetchCXPlannerBoardItems(): Promise<CXBoardItem[]>`
  - `export async function fetchManagersForDropdown(): Promise<{ id: string; name: string }[]>`
  - `export async function createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null>`
  - `export async function updateCXPlannerItem(id: number, patch: Partial<CXPlannerFormValues>): Promise<CXBoardItem | null>`
  - `export async function deleteCXPlannerItem(id: number): Promise<void>`
  - `export async function moveCXPlannerItem(id: number, status: CXStatus): Promise<CXBoardItem | null>`

- [ ] **Step 1: Add imports and the form-values type**

At the top of `src/app/settings/cx-planner/actions.ts`, replace:

```typescript
'use server';

export async function verifyCXPlannerKey(key: string) {
```

with:

```typescript
'use server';

import {
    fetchAllCXItemsForBoard,
    deleteCXItem,
    fetchManagersList,
    fetchManagerById,
    createCXItem,
    updateCXItem,
    CXBoardItem,
} from '@/db/queries';
import { mapCriticidade } from '@/lib/planner-sync';
import { CXStatus } from '@/types/manager';

export type CXPlannerFormValues = {
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    status: CXStatus;
    dataInicio: string;
    dataFim: string;
    percentComplete: number;
    prioridadeTexto: string;
};

// Objeto de patch aceito por updateCXItem (src/db/queries.ts) — definido
// aqui em vez de importar `cx` de @/db/schema porque server actions não
// devem tocar em Drizzle diretamente (CLAUDE.md: só queries.ts faz isso).
// A checagem estrutural do TypeScript garante compatibilidade no call site.
type CXItemPatch = Partial<{
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    status: CXStatus;
    criticidade: 'baixa' | 'media' | 'alta';
    dataInicio: string | null;
    dataFim: string | null;
    percentComplete: number | null;
    prioridadeTexto: string | null;
    isVisible: boolean;
}>;

function normalizeDate(v: string): string | null {
    return v.trim() === '' ? null : v;
}

export async function verifyCXPlannerKey(key: string) {
```

(the existing `verifyCXPlannerKey` body from Task 4 stays unchanged below this)

- [ ] **Step 2: Add the fetch actions**

At the end of `src/app/settings/cx-planner/actions.ts`, add:

```typescript

export async function fetchCXPlannerBoardItems(): Promise<CXBoardItem[]> {
    return fetchAllCXItemsForBoard();
}

export async function fetchManagersForDropdown(): Promise<{ id: string; name: string }[]> {
    const rows = await fetchManagersList();
    return rows.map((m) => ({ id: m.id, name: m.name }));
}
```

- [ ] **Step 3: Add `createCXPlannerItem`**

Append:

```typescript

export async function createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null> {
    const manager = await fetchManagerById(input.managerId);
    if (!manager) return null;

    const created = await createCXItem({
        managerId: input.managerId,
        cliente: input.cliente,
        titulo: input.titulo,
        problema: input.problema,
        solucaoProposta: input.solucaoProposta,
        status: input.status,
        // criticidade é sempre derivada da prioridade — nunca escolhida
        // direto na UI (ver docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md).
        criticidade: mapCriticidade(input.prioridadeTexto),
        dataInicio: normalizeDate(input.dataInicio),
        dataFim: normalizeDate(input.dataFim),
        percentComplete: input.percentComplete,
        prioridadeTexto: input.prioridadeTexto || null,
        isVisible: true,
        externalId: null,
        manualEditAt: null,
        createdAt: new Date().toISOString(),
    });

    return { ...created, managerName: manager.name } as CXBoardItem;
}
```

- [ ] **Step 4: Add `updateCXPlannerItem`**

Append:

```typescript

export async function updateCXPlannerItem(id: number, patch: Partial<CXPlannerFormValues>): Promise<CXBoardItem | null> {
    const payload: CXItemPatch = { ...patch };
    if (patch.dataInicio !== undefined) payload.dataInicio = normalizeDate(patch.dataInicio);
    if (patch.dataFim !== undefined) payload.dataFim = normalizeDate(patch.dataFim);
    if (patch.prioridadeTexto !== undefined) {
        payload.prioridadeTexto = patch.prioridadeTexto || null;
        payload.criticidade = mapCriticidade(patch.prioridadeTexto);
    }

    const updated = await updateCXItem(id, payload);
    if (!updated) return null;

    const manager = await fetchManagerById(updated.managerId);
    return { ...updated, managerName: manager?.name ?? '' } as CXBoardItem;
}
```

- [ ] **Step 5: Add `deleteCXPlannerItem` and `moveCXPlannerItem`**

Append:

```typescript

export async function deleteCXPlannerItem(id: number): Promise<void> {
    await deleteCXItem(id);
}

export async function moveCXPlannerItem(id: number, status: CXStatus): Promise<CXBoardItem | null> {
    return updateCXPlannerItem(id, { status });
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no new errors.

Create `temp/verify-cx-planner-actions.ts`:

```typescript
import 'dotenv/config';
import { fetchManagersForDropdown, createCXPlannerItem, updateCXPlannerItem, deleteCXPlannerItem } from './src/app/settings/cx-planner/actions';

async function main() {
    const managers = await fetchManagersForDropdown();
    if (managers.length === 0) {
        console.error('FAIL — no managers in DB to test against. Seed at least one manager first.');
        process.exit(1);
    }
    const managerId = managers[0].id;

    const created = await createCXPlannerItem({
        managerId,
        cliente: 'TESTE-VERIFY',
        titulo: 'Item de verificação',
        problema: 'Criado pelo script de verificação da Task 5.',
        solucaoProposta: '',
        status: 'pendente',
        dataInicio: '2026-01-01',
        dataFim: '2026-02-01',
        percentComplete: 0,
        prioridadeTexto: 'Urgente',
    });
    if (!created || created.criticidade !== 'alta') {
        console.error('FAIL — create did not derive criticidade=alta from prioridadeTexto=Urgente:', created);
        process.exit(1);
    }
    console.log('PASS — createCXPlannerItem derived criticidade correctly:', created.id, created.criticidade);

    const updated = await updateCXPlannerItem(created.id!, { prioridadeTexto: 'Normal', status: 'analise' });
    if (!updated || updated.criticidade !== 'baixa' || updated.status !== 'analise') {
        console.error('FAIL — update did not re-derive criticidade / apply status:', updated);
        process.exit(1);
    }
    console.log('PASS — updateCXPlannerItem re-derived criticidade and applied status:', updated.criticidade, updated.status);

    await deleteCXPlannerItem(created.id!);
    console.log('PASS — deleteCXPlannerItem ran without throwing. Cleanup done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Run: `npx tsx temp/verify-cx-planner-actions.ts`
Expected: three `PASS` lines, no `FAIL`, exit code 0. This test creates and deletes its own row (`cliente: 'TESTE-VERIFY'`) so it leaves no residue.

- [ ] **Step 7: Commit**

```bash
git add src/app/settings/cx-planner/actions.ts
git commit -m "feat: add CX Planner CRUD server actions (create/update/delete/move)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Board config and Kanban card

**Files:**
- Create: `src/app/settings/cx-planner/board-config.ts`
- Create: `src/app/settings/cx-planner/CXPlannerCard.tsx`

**Interfaces:**
- Consumes: `CXStatus` (from `@/types/manager`), `CXBoardItem` (from `@/db/queries`, Task 3).
- Produces: `STATUS_COLUMNS: { key: CXStatus; label: string }[]`, `PRIORIDADE_OPTIONS: readonly ['Urgente', 'Importante', 'Normal']`, `PRIORIDADE_CONFIG`, `prioridadeStyle(p): { badge: string; border: string }` (all from `board-config.ts`, consumed by Task 7 and Task 8). `CXPlannerCard` component: `{ item: CXBoardItem; onClick: () => void }`.

- [ ] **Step 1: Create the shared board config**

Create `src/app/settings/cx-planner/board-config.ts`:

```typescript
import { CXStatus } from '@/types/manager';

export const STATUS_COLUMNS: { key: CXStatus; label: string }[] = [
    { key: 'pendente', label: 'Pendente' },
    { key: 'analise', label: 'Em Análise' },
    { key: 'resolvido', label: 'Resolvido' },
];

// Mesmas 3 opções que o Planner oferece (Urgente/Importante/Normal) — o
// campo prioridade_texto é texto livre no banco, mas a UI só permite
// escolher entre essas 3 pra manter consistência com mapCriticidade
// (src/lib/planner-sync.ts).
export const PRIORIDADE_OPTIONS = ['Urgente', 'Importante', 'Normal'] as const;
export type PrioridadeTexto = (typeof PRIORIDADE_OPTIONS)[number];

export const PRIORIDADE_CONFIG: Record<PrioridadeTexto, { badge: string; border: string }> = {
    Urgente: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', border: 'border-l-red-500' },
    Importante: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-l-yellow-500' },
    Normal: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', border: 'border-l-blue-500' },
};

export function prioridadeStyle(p: string | null | undefined) {
    if (p && (PRIORIDADE_OPTIONS as readonly string[]).includes(p)) {
        return PRIORIDADE_CONFIG[p as PrioridadeTexto];
    }
    return PRIORIDADE_CONFIG.Normal;
}
```

- [ ] **Step 2: Create the card component**

Create `src/app/settings/cx-planner/CXPlannerCard.tsx`:

```typescript
'use client';

import { CXBoardItem } from '@/db/queries';
import { prioridadeStyle } from './board-config';

interface CXPlannerCardProps {
    item: CXBoardItem;
    onClick: () => void;
}

function isOverdue(dataFim: string | null | undefined, status: string): boolean {
    if (!dataFim || status === 'resolvido') return false;
    const deadline = new Date(dataFim);
    if (Number.isNaN(deadline.getTime())) return false;
    return deadline < new Date(new Date().toDateString());
}

export function CXPlannerCard({ item, onClick }: CXPlannerCardProps) {
    const style = prioridadeStyle(item.prioridadeTexto);
    const overdue = isOverdue(item.dataFim, item.status);
    const percent = Math.max(0, Math.min(100, item.percentComplete ?? 0));

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left bg-zinc-900 border border-zinc-800 border-l-4 ${style.border} rounded-lg p-3 flex flex-col gap-2 hover:border-zinc-700 transition-colors`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-400 truncate">{item.managerName} · {item.cliente}</span>
                {item.prioridadeTexto && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.badge}`}>
                        {item.prioridadeTexto}
                    </span>
                )}
            </div>
            <p className="text-sm font-medium text-zinc-200 line-clamp-2">{item.titulo || item.problema}</p>
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">{percent}%</span>
            </div>
            {item.dataFim && (
                <span className={`text-[10px] font-mono ${overdue ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                    Prazo: {item.dataFim}{overdue ? ' · ATRASADO' : ''}
                </span>
            )}
        </button>
    );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no new errors.

(No dev-server check yet — `CXPlannerCard` isn't rendered anywhere until Task 8. Type-check + lint is the meaningful verification for this task.)

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/cx-planner/board-config.ts src/app/settings/cx-planner/CXPlannerCard.tsx
git commit -m "feat: add CX Planner board config and Kanban card component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Create/edit item modal

**Files:**
- Create: `src/app/settings/cx-planner/CXPlannerItemModal.tsx`

**Interfaces:**
- Consumes: `CXPlannerFormValues` (from `./actions`, Task 5), `CXBoardItem` (from `@/db/queries`), `CXStatus` (from `@/types/manager`), `STATUS_COLUMNS`/`PRIORIDADE_OPTIONS`/`PRIORIDADE_CONFIG` (from `./board-config`, Task 6), Shadcn `Dialog`/`Button`/`Input`/`Label`/`Select` components.
- Produces: `CXPlannerItemModal` component, props `{ open: boolean; onOpenChange: (open: boolean) => void; item: CXBoardItem | null; managerOptions: { id: string; name: string }[]; defaultManagerId?: string; defaultStatus?: CXStatus; onSave: (values: CXPlannerFormValues) => Promise<void>; onDelete?: () => Promise<void> }` — consumed by Task 8's `CXPlannerBoard.tsx`.

- [ ] **Step 1: Create the modal**

Create `src/app/settings/cx-planner/CXPlannerItemModal.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { CXStatus } from '@/types/manager';
import { CXPlannerFormValues } from './actions';
import { PRIORIDADE_OPTIONS, PRIORIDADE_CONFIG, STATUS_COLUMNS } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

interface CXPlannerItemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: CXBoardItem | null;
    managerOptions: ManagerOption[];
    defaultManagerId?: string;
    defaultStatus?: CXStatus;
    onSave: (values: CXPlannerFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
}

function emptyValues(defaultManagerId = '', defaultStatus: CXStatus = 'pendente'): CXPlannerFormValues {
    return {
        managerId: defaultManagerId,
        cliente: '',
        titulo: '',
        problema: '',
        solucaoProposta: '',
        status: defaultStatus,
        dataInicio: '',
        dataFim: '',
        percentComplete: 0,
        prioridadeTexto: 'Normal',
    };
}

function statusForPercent(percent: number): CXStatus {
    if (percent >= 100) return 'resolvido';
    if (percent > 0) return 'analise';
    return 'pendente';
}

export function CXPlannerItemModal({
    open,
    onOpenChange,
    item,
    managerOptions,
    defaultManagerId,
    defaultStatus,
    onSave,
    onDelete,
}: CXPlannerItemModalProps) {
    const [values, setValues] = useState<CXPlannerFormValues>(emptyValues(defaultManagerId, defaultStatus));
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (item) {
            setValues({
                managerId: item.managerId,
                cliente: item.cliente,
                titulo: item.titulo,
                problema: item.problema,
                solucaoProposta: item.solucaoProposta,
                status: item.status,
                dataInicio: item.dataInicio ?? '',
                dataFim: item.dataFim ?? '',
                percentComplete: item.percentComplete ?? 0,
                prioridadeTexto: item.prioridadeTexto ?? 'Normal',
            });
        } else {
            setValues(emptyValues(defaultManagerId, defaultStatus));
        }
    }, [open, item, defaultManagerId, defaultStatus]);

    const update = <K extends keyof CXPlannerFormValues>(field: K, value: CXPlannerFormValues[K]) => {
        setValues((prev) => ({ ...prev, [field]: value }));
    };

    const handlePercentChange = (percent: number) => {
        setValues((prev) => ({ ...prev, percentComplete: percent, status: statusForPercent(percent) }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(values);
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        if (!window.confirm('Excluir este item de CX? Essa ação não pode ser desfeita.')) return;
        setIsDeleting(true);
        try {
            await onDelete();
            onOpenChange(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const canSave = values.managerId.trim().length > 0 && values.cliente.trim().length > 0 && values.problema.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>{item ? 'Editar item de CX' : 'Nova tarefa de CX'}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Gerente</Label>
                            <Select value={values.managerId} onValueChange={(v) => update('managerId', v)}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                    <SelectValue placeholder="Selecione o gerente" />
                                </SelectTrigger>
                                <SelectContent>
                                    {managerOptions.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Cliente / Órgão</Label>
                            <Input
                                value={values.cliente}
                                onChange={(e) => update('cliente', e.target.value)}
                                placeholder="Ex: SEFAZ"
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Título</Label>
                        <Input
                            value={values.titulo}
                            onChange={(e) => update('titulo', e.target.value)}
                            placeholder="Resumo do problema"
                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Descrição do problema</Label>
                        <Input
                            value={values.problema}
                            onChange={(e) => update('problema', e.target.value)}
                            placeholder="Descreva o problema relatado em detalhes"
                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Solução proposta</Label>
                        <Input
                            value={values.solucaoProposta}
                            onChange={(e) => update('solucaoProposta', e.target.value)}
                            placeholder="Descreva a solução ou encaminhamento"
                            className="bg-zinc-900 border-zinc-800 text-zinc-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Data início</Label>
                            <Input
                                type="date"
                                value={values.dataInicio}
                                onChange={(e) => update('dataInicio', e.target.value)}
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-zinc-400">Prazo (data fim)</Label>
                            <Input
                                type="date"
                                value={values.dataFim}
                                onChange={(e) => update('dataFim', e.target.value)}
                                className="bg-zinc-900 border-zinc-800 text-zinc-200"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Prioridade</Label>
                        <div className="flex gap-2 flex-wrap">
                            {PRIORIDADE_OPTIONS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => update('prioridadeTexto', p)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${values.prioridadeTexto === p
                                        ? PRIORIDADE_CONFIG[p].badge + ' ring-2 ring-offset-1 ring-offset-zinc-950 ring-current'
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">% de conclusão — {values.percentComplete}%</Label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={values.percentComplete}
                            onChange={(e) => handlePercentChange(Number(e.target.value))}
                            className="w-full accent-indigo-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-zinc-400">Status</Label>
                        <div className="flex gap-2 flex-wrap">
                            {STATUS_COLUMNS.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => update('status', s.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${values.status === s.key
                                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 ring-2 ring-offset-1 ring-offset-zinc-950 ring-current'
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-zinc-600">Sugerido automaticamente pelo % de conclusão, mas pode ser mudado aqui.</p>
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    {item && onDelete ? (
                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={isDeleting || isSaving}
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
                        </Button>
                    ) : <span />}
                    <Button
                        onClick={handleSave}
                        disabled={!canSave || isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no new errors.

(Not rendered anywhere yet — full interaction check happens in Task 8/9.)

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/cx-planner/CXPlannerItemModal.tsx
git commit -m "feat: add CX Planner create/edit item modal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Kanban board — wire it all together

**Files:**
- Create: `src/app/settings/cx-planner/CXPlannerBoard.tsx`
- Modify: `src/app/settings/cx-planner/page.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 5, 6, 7 (`fetchCXPlannerBoardItems`, `fetchManagersForDropdown`, `createCXPlannerItem`, `updateCXPlannerItem`, `deleteCXPlannerItem`, `moveCXPlannerItem`, `CXPlannerFormValues` from `./actions`; `STATUS_COLUMNS` from `./board-config`; `CXPlannerCard` from `./CXPlannerCard`; `CXPlannerItemModal` from `./CXPlannerItemModal`; `CXBoardItem` from `@/db/queries`).
- Produces: `CXPlannerBoard` component (no props — self-contained, fetches its own data), rendered by `page.tsx`.

- [ ] **Step 1: Create the board**

Create `src/app/settings/cx-planner/CXPlannerBoard.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { CXBoardItem } from '@/db/queries';
import { CXStatus } from '@/types/manager';
import {
    fetchCXPlannerBoardItems,
    fetchManagersForDropdown,
    createCXPlannerItem,
    updateCXPlannerItem,
    deleteCXPlannerItem,
    moveCXPlannerItem,
    CXPlannerFormValues,
} from './actions';
import { CXPlannerCard } from './CXPlannerCard';
import { CXPlannerItemModal } from './CXPlannerItemModal';
import { STATUS_COLUMNS } from './board-config';

interface ManagerOption {
    id: string;
    name: string;
}

export function CXPlannerBoard() {
    const [items, setItems] = useState<CXBoardItem[]>([]);
    const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CXBoardItem | null>(null);
    const [defaultStatusForNew, setDefaultStatusForNew] = useState<CXStatus>('pendente');
    const [dragOverStatus, setDragOverStatus] = useState<CXStatus | null>(null);

    useEffect(() => {
        (async () => {
            const [boardItems, managers] = await Promise.all([
                fetchCXPlannerBoardItems(),
                fetchManagersForDropdown(),
            ]);
            setItems(boardItems);
            setManagerOptions(managers);
            setIsLoading(false);
        })();
    }, []);

    const openCreate = (status: CXStatus) => {
        setEditingItem(null);
        setDefaultStatusForNew(status);
        setModalOpen(true);
    };

    const openEdit = (item: CXBoardItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleSave = async (values: CXPlannerFormValues) => {
        if (editingItem) {
            const updated = await updateCXPlannerItem(editingItem.id!, values);
            if (updated) {
                setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
            }
        } else {
            const created = await createCXPlannerItem(values);
            if (created) {
                setItems((prev) => [...prev, created]);
            }
        }
    };

    const handleDelete = async () => {
        if (!editingItem) return;
        await deleteCXPlannerItem(editingItem.id!);
        setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
    };

    const handleDrop = async (status: CXStatus, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverStatus(null);
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        const previous = items.find((i) => i.id === id);
        if (!previous || previous.status === status) return;

        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
        const result = await moveCXPlannerItem(id, status);
        if (!result) {
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: previous.status } : i)));
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">CX Planner</h1>
                <p className="text-zinc-500 text-sm">Board de CX do time — arraste os cards entre as colunas ou clique para editar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STATUS_COLUMNS.map((col) => {
                    const colItems = items.filter((i) => i.status === col.key);
                    return (
                        <div
                            key={col.key}
                            onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.key); }}
                            onDragLeave={() => setDragOverStatus((s) => (s === col.key ? null : s))}
                            onDrop={(e) => handleDrop(col.key, e)}
                            className={`rounded-xl border p-3 flex flex-col gap-3 min-h-[200px] transition-colors ${dragOverStatus === col.key ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/30'}`}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">{col.label} ({colItems.length})</h2>
                                <button
                                    type="button"
                                    onClick={() => openCreate(col.key)}
                                    className="text-zinc-500 hover:text-indigo-400 transition-colors"
                                    title="Nova tarefa"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {colItems.map((item) => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(item.id))}
                                    >
                                        <CXPlannerCard item={item} onClick={() => openEdit(item)} />
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <p className="text-xs text-zinc-700 text-center py-6">Nenhum item.</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <CXPlannerItemModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                item={editingItem}
                managerOptions={managerOptions}
                defaultManagerId={managerOptions[0]?.id}
                defaultStatus={defaultStatusForNew}
                onSave={handleSave}
                onDelete={editingItem ? handleDelete : undefined}
            />
        </div>
    );
}
```

- [ ] **Step 2: Wire the board into the page**

In `src/app/settings/cx-planner/page.tsx`, replace:

```typescript
import { CXPlannerGate } from './CXPlannerGate';

export default function CXPlannerPage() {
    return (
        <CXPlannerGate>
            <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
                <p className="text-zinc-400">Board de CX em construção.</p>
            </div>
        </CXPlannerGate>
    );
}
```

with:

```typescript
import { CXPlannerGate } from './CXPlannerGate';
import { CXPlannerBoard } from './CXPlannerBoard';

export default function CXPlannerPage() {
    return (
        <CXPlannerGate>
            <CXPlannerBoard />
        </CXPlannerGate>
    );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no new errors.

Manual check: `npm run dev` (background), open `http://localhost:6000/settings/cx-planner`, enter the key.
Expected:
1. Three columns render: Pendente / Em Análise / Resolvido, each with a `+` button.
2. Clicking `+` on "Pendente" opens the modal with "Nova tarefa de CX", status pre-set to Pendente.
3. Pick a gerente, fill Cliente + Descrição do problema, pick a Prioridade, move the % slider (status buttons update to match), click Salvar.
4. Expected: modal closes, a new card appears in the correct column with the right priority color border and % bar.
5. Click the new card → modal reopens with the same values pre-filled, plus a "Excluir" button.
6. Drag the card to "Em Análise" → it moves columns immediately; refresh the page → it's still in "Em Análise" (persisted).
7. Click the card, click Excluir, confirm → card disappears.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/cx-planner/CXPlannerBoard.tsx src/app/settings/cx-planner/page.tsx
git commit -m "feat: wire CX Planner Kanban board into /settings/cx-planner

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end verification and regression check

**Files:** none (verification only — fixes go back into the task that owns the broken file, if any are found).

**Interfaces:** none.

- [ ] **Step 1: Full type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors (pre-existing warnings elsewhere in the repo, if any, are not this plan's concern).

- [ ] **Step 2: Regression check — existing `/settings` still works**

With `npm run dev` running, open `http://localhost:6000/settings`, enter `SETTINGS_KEY` (or the fallback `prodam2026`).
Expected: Managers/Contratos/Propostas/CX-per-manager editor all load and behave exactly as before — the new columns on `cx` are additive and nullable, so no existing query breaks.

- [ ] **Step 3: Regression check — dashboard CX tab still works**

Open `http://localhost:6000/`, enter `FRONTEND_KEY` if prompted, pick the manager used in Task 8's manual test, open their CX tab.
Expected: the item created in Task 8 appears there too, with the same status/criticidade badge — proving the board writes to the same `cx` rows the public dashboard reads.

- [ ] **Step 4: Migration path check — Planner JSON upload still works and now saves full fidelity**

In `/settings`, use "Upload Planner (CX)" to upload a small test JSON, e.g. create `temp/test-planner-upload.json`:

```json
[
  {
    "id": "verify-task-1",
    "title": "TESTE-VERIFY - Item de teste do upload",
    "datainicio": "2026-01-10",
    "datafim": "2026-02-10",
    "prioridade": "Urgente",
    "percentComplete": 40,
    "Description": "Descrição de teste para verificar upload."
  }
]
```

Upload this file via the "Selecionar JSON" button.
Expected: `"Nenhuma tarefa encontrada"` or `"X sem gerente"` message is fine if no manager's `servedClients` includes `TESTE-VERIFY` — that's expected (it proves matching still works, just with no match). Then run `temp/verify-cx-board-query.ts` from Task 3 again, or check via the CX Planner board that any successfully-matched item shows the correct dates/%/priority.

To confirm the field-persistence itself (independent of manager matching), a more direct check: add `TESTE-VERIFY` to some manager's `servedClients` in `/settings` → Managers first, then re-upload and confirm the item lands in the CX Planner board with `data_inicio=2026-01-10`, `data_fim=2026-02-10`, `percentComplete=40`, `prioridadeTexto=Urgente`. Delete the test item afterward via the board's Excluir button, and remove the manager's temporary `servedClients` entry.

- [ ] **Step 5: Clean up throwaway verification scripts**

`temp/` is gitignored, so nothing to commit here — but confirm none of the `temp/verify-*.ts` scripts or `temp/test-planner-upload.json` created during this plan ended up tracked by git:

Run: `git status --short`
Expected: clean (or only showing files intentionally part of a task's commit — none of the `temp/` files should appear, since `temp/` is gitignored).

- [ ] **Step 6: Final commit (if anything was left uncommitted)**

```bash
git status --short
git add -A
git commit -m "chore: final verification pass for CX Planner admin area

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" --allow-empty
```

At this point the `cx_planner` branch has the full feature, ready for the user to review and merge into `v2_ls` when satisfied.
