# Handoff — Dashboard Comercial DRM

> Gerado em 2026-04-28. Use este documento para continuar o trabalho em nova sessão de IA.

---

## Stack do Projeto

- **Framework:** Next.js (App Router), React 19, TypeScript
- **Banco:** Turso (LibSQL/SQLite) via **Drizzle ORM**
- **UI:** TailwindCSS 4 + **Shadcn/UI** + Radix UI
- **Estado servidor:** TanStack React Query v5
- **Runner de scripts:** `npx tsx`
- **Variáveis de ambiente:** `.env` na raiz (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)

---

## O que foi feito nesta sessão

### 1. Schema do banco (`src/db/schema.ts`)
Adicionada a tabela `contrato` ao schema Drizzle existente:

```typescript
export const contrato = sqliteTable('contrato', {
    id: text('id').primaryKey(),
    numeroContrato: text('numero_contrato').notNull().unique(),
    protheus: text('protheus'),
    cliente: text('cliente').notNull(),
    desde: text('desde'),
    dtInicioVigencia: text('dt_inicio_vigencia'),
    dtFimVigencia: text('dt_fim_vigencia'),
    vlContratado: real('vl_contratado'),
    vlFaturado: real('vl_faturado'),
    vlSaldo: real('vl_saldo'),
    tipo: text('tipo'),
    situacao: text('situacao'),
    vigente: integer('vigente', { mode: 'boolean' }),
    diretoria: text('diretoria'),
    gerencia: text('gerencia'),           // ex: GRC-1, KAM-4
    nomeGerente: text('nome_gerente'),    // nome completo denormalizado do CSV
    objeto: text('objeto'),
    managerId: text('manager_id').references(() => managers.id, { onDelete: 'set null' }),
    createdAt: text('created_at')...,
    updatedAt: text('updated_at')...,
});
```

**Decisão importante:** A tabela `gerente` foi descartada. O FK usa a tabela `managers` já existente. O mapeamento é feito pelo campo `Ger.` do CSV:

| CSV `Ger.` | `managers.id` |
|-----------|--------------|
| GRC-1 | grc1-bruno |
| GRC-2 | grc2-paulo |
| GRC-3 | grc3-barone |
| GRC-4 | grc4-beatriz |
| GRC-C | grcc-debora |
| KAM-1 | kam1-malde |
| KAM-2 | kam2-betone |
| KAM-3 | kam3-andrea |
| KAM-4 | kam4-tomiatto |

### 2. Scripts criados em `scripts/contratos/`

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `criar_tabelas.sql` | ✅ Pronto | DDL standalone (sem tabela `gerente`) |
| `seed-contratos.ts` | ✅ Pronto, **não executado ainda** | ETL TypeScript/Drizzle lê o CSV e popula o banco |
| `queries_exemplo.sql` | ✅ Pronto | 15 queries SQLite comentadas |
| `README.md` | ✅ Pronto | Documentação de uso |

### 3. Dependência instalada
```bash
npm install --save-dev csv-parse  # já instalado
```

---

## O que FALTA fazer

### PASSO 1 — Rodar o seed (ainda não foi executado)
```bash
npx tsx scripts/contratos/seed-contratos.ts
```
**Esperado:** 100 contratos inseridos, 3 warnings de encoding (ALESP, ICI), nenhum erro.

---

### PASSO 2 — Criar queries Drizzle em `src/db/queries.ts`

Adicionar ao arquivo existente `src/db/queries.ts`:

```typescript
import { contrato, managers } from './schema';
import { eq, like, desc } from 'drizzle-orm';

// Listar todos os contratos com join no manager
export async function fetchAllContratos(search?: string) {
    const query = db
        .select({
            id: contrato.id,
            numeroContrato: contrato.numeroContrato,
            protheus: contrato.protheus,
            cliente: contrato.cliente,
            dtFimVigencia: contrato.dtFimVigencia,
            vlContratado: contrato.vlContratado,
            vlFaturado: contrato.vlFaturado,
            vlSaldo: contrato.vlSaldo,
            tipo: contrato.tipo,
            situacao: contrato.situacao,
            vigente: contrato.vigente,
            gerencia: contrato.gerencia,
            nomeGerente: contrato.nomeGerente,
            objeto: contrato.objeto,
            managerId: contrato.managerId,
            managerName: managers.name,
        })
        .from(contrato)
        .leftJoin(managers, eq(contrato.managerId, managers.id))
        .orderBy(desc(contrato.dtFimVigencia));

    if (search) {
        // filtrar por numeroContrato, cliente ou nomeGerente
        return query.where(like(contrato.numeroContrato, `%${search}%`));
    }
    return query;
}

// Buscar contrato por ID
export async function fetchContratoById(id: string) { ... }

// Criar contrato
export async function createContrato(data: typeof contrato.$inferInsert) { ... }

// Atualizar contrato
export async function updateContrato(id: string, data: Partial<typeof contrato.$inferInsert>) { ... }

// Deletar contrato
export async function deleteContrato(id: string) { ... }
```

---

### PASSO 3 — Criar Server Actions em `src/app/contracts/actions.ts`

```typescript
'use server';
import { revalidatePath } from 'next/cache';
// createContrato, updateContrato, deleteContrato wrappados como Server Actions
// revalidatePath('/contracts') após cada mutação
```

---

### PASSO 4 — Criar a rota `/contracts`

#### Estrutura de arquivos a criar:
```
src/app/contracts/
├── page.tsx              ← Server Component (busca inicial dos dados)
├── actions.ts            ← Server Actions (create, update, delete)
└── components/
    ├── ContractsTable.tsx    ← Client Component ("use client")
    ├── ContractEditModal.tsx ← Modal de edição (Shadcn Dialog)
    └── ContractAddModal.tsx  ← Modal de adição (Shadcn Dialog)
```

#### `page.tsx` (Server Component):
```tsx
import { fetchAllContratos } from '@/db/queries';
import { ContractsTable } from './components/ContractsTable';

export default async function ContractsPage() {
    const contratos = await fetchAllContratos();
    return (
        <main className="p-6">
            <h1>Contratos Ativos</h1>
            <ContractsTable initialData={contratos} />
        </main>
    );
}
```

#### `ContractsTable.tsx` (Client Component — `"use client"`):

Funcionalidades:
- Recebe `initialData` como prop
- `useState` para `search` (string)
- `useEffect` com debounce (300ms) que filtra localmente ou chama a query
- Tabela com colunas: Contrato, Cliente, Gerência, Gerente, Valor Contratado, Valor Faturado, Saldo, Tipo, Situação, Vencimento, Ações
- Linha de ações: ícone de lápis (editar) → abre `ContractEditModal`
- Botão "Adicionar Contrato" → abre `ContractAddModal`
- Filtro de busca: filtra por `numeroContrato`, `cliente`, `nomeGerente` enquanto digita

#### `ContractEditModal.tsx`:
- Shadcn `<Dialog>` com `<DialogContent>`
- Form com todos os campos editáveis do contrato
- Select para `managerId` (lista os managers do banco)
- Select para `gerencia` (GRC-1 a KAM-4)
- Toggle/Switch para `vigente`
- Submit chama Server Action `updateContrato`
- Após sucesso: fecha modal, mostra toast

#### `ContractAddModal.tsx`:
- Mesmo padrão do Edit, mas com campos em branco
- Submit chama Server Action `createContrato`

---

### PASSO 5 — Adicionar link `/contracts` na navegação

Verificar onde ficam os links de navegação do projeto (provavelmente em `src/components/` ou `src/app/layout.tsx`) e adicionar o item "Contratos".

---

## Campos da tabela `contrato` (referência completa)

| Campo DB | Tipo | Descrição | Editável no modal |
|----------|------|-----------|------------------|
| `id` | TEXT (UUID) | PK | Não |
| `numero_contrato` | TEXT UNIQUE | Identificador do contrato | Sim (add), Não (edit) |
| `protheus` | TEXT | Código Protheus | Sim |
| `cliente` | TEXT | Nome do órgão cliente | Sim |
| `desde` | TEXT (ISO date) | Data de início do contrato | Sim |
| `dt_inicio_vigencia` | TEXT (ISO date) | Início da vigência atual | Sim |
| `dt_fim_vigencia` | TEXT (ISO date) | Fim da vigência | Sim |
| `vl_contratado` | REAL | Valor total contratado | Sim |
| `vl_faturado` | REAL | Valor já faturado | Sim |
| `vl_saldo` | REAL | Saldo restante (pode ser negativo) | Sim |
| `tipo` | TEXT | SUSTENTAÇÃO ou PROJETOS | Sim (select) |
| `situacao` | TEXT | Situação (ex: "Vigente") | Sim |
| `vigente` | INTEGER (boolean) | 1=vigente, 0=vencido | Sim (toggle) |
| `diretoria` | TEXT | Sempre "DRM" neste dataset | Sim |
| `gerencia` | TEXT | Código GRC-1..KAM-4 | Sim (select) |
| `nome_gerente` | TEXT | Nome completo (denormalizado) | Sim |
| `objeto` | TEXT | Descrição do contrato | Sim (textarea) |
| `manager_id` | TEXT (FK) | FK → managers.id | Sim (select) |
| `created_at` | TEXT (ISO) | Timestamp criação | Não |
| `updated_at` | TEXT (ISO) | Timestamp atualização | Não |

---

## Padrões do projeto (importante para nova IA)

- **Server Components** buscam dados diretamente via Drizzle (`src/db/queries.ts`)
- **Client Components** recebem dados como props e usam `useState`/`useEffect` para interatividade
- **Mutações** via Server Actions (`'use server'`) com `revalidatePath`
- **Modais** usam Shadcn `<Dialog>` (já instalado)
- **Toasts** — verificar se o projeto já usa `sonner` ou `react-hot-toast`
- **IDs** gerados com `crypto.randomUUID()` (Node.js nativo)
- Arquivos de queries: `src/db/queries.ts`
- Schema Drizzle: `src/db/schema.ts`
- Serviços (server-side wrappers): `src/services/`

---

## Comandos úteis

```bash
# Rodar seed de contratos (FAZER PRIMEIRO)
npx tsx scripts/contratos/seed-contratos.ts

# Rodar dev server
npm run dev

# Verificar tipos TypeScript
npx tsc --noEmit
```

---

## Observações / Cuidados

1. **Saldo negativo:** SPOBRAS e COHAB têm `vl_saldo < 0` — válido, não tratar como erro na UI
2. **Encoding:** 3 contratos (ALESP, ICI) têm `tipo = "SUSTENTA??O"` — exibir como está, não é bug do código
3. **`managers` do banco:** têm nomes curtos (`"Beatriz"`, `"Barone"`) — usar `nomeGerente` para exibir o nome completo na tabela, e `managers.name` como label no select do modal
4. **Search box:** filtrar ao menos por `numeroContrato`, `cliente` e `nomeGerente`; debounce de 300ms
5. **Paginação:** com 100 contratos não é obrigatório agora, mas pode ser necessário futuramente
