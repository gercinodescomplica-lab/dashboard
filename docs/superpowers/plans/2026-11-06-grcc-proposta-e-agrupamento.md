# GRCC — Data de envio da proposta e agrupar chamados por cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `propostaEnviadaEm` date to `lead_grcc` that auto-cools the lead's temperature from quente to morno after 2 months without an etapa/situação change, and group repeated-client rows (e.g. three "Limeira" chamados) under one visual header in the three places that list leads flat.

**Architecture:** Part 1 is a pure-function change (`temperaturaDoLead`, new `fecharEsperaDeProposta`) threaded through the existing GRCC validation/diff/import/export pipeline, plus one nullable column. Part 2 is display-only: a new `agruparPorCliente` grouping function (mirroring the existing `agruparPorCidade`) reused by three screens, plus a free-text autocomplete (native HTML `<datalist>`, no new dependency) on the Cliente field. No schema change, no new table, no cross-file renames.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Drizzle ORM (SQLite/Turso), Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-06-grcc-proposta-e-agrupamento-design.md` — read it before starting; every task below implements one of its sections.
- No existing field is removed, renamed, or reinterpreted. Every change is additive.
- No new DB table, no FK, no link to the central `cliente` (carteira) table. `lead_grcc.cliente` stays free text.
- "2 meses corridos" = calendar months added to the date (`Date.UTC(y, m - 1 + 2, d)`), not 60 fixed days.
- Manual `temperatura` always wins over the proposal-date automatic rule, which always wins over the categoria default. `Contratado`/`Perda` are always fixed, as today.
- UI copy is pt-BR, matching the rest of `/grcc`.
- Run `npx tsc --noEmit` and `npm run test` after each task; both must be clean before moving on.

---

### Task 1: Campo `propostaEnviadaEm` — tipos e validação

**Files:**
- Modify: `src/lib/grcc/tipos.ts`
- Modify: `src/lib/grcc/validacao.ts`
- Test: `src/lib/grcc/validacao.test.ts`

**Interfaces:**
- Produces: `LeadGrccDados.propostaEnviadaEm: string | null` (ISO `YYYY-MM-DD` or `null`), now part of `CAMPOS_LEAD`, `ROTULO_CAMPO`, `CAMPOS_COMERCIAIS`, `LEAD_VAZIO`. Every later task relies on this field existing and flowing automatically through `CAMPOS_LEAD`-driven code (diff, `dadosDoLead`, import/export column lists).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/grcc/validacao.test.ts`, inside `describe('validarLead — datas', ...)`:

```ts
it('aceita propostaEnviadaEm ausente/vazia/válida, recusa inválida', () => {
    expect(validarLead({ ...ok, propostaEnviadaEm: null }).ok).toBe(true);
    expect(validarLead({ ...ok, propostaEnviadaEm: '' } as never).ok).toBe(true);
    expect(validarLead({ ...ok, propostaEnviadaEm: '2026-09-15' }).ok).toBe(true);
    const r = validarLead({ ...ok, propostaEnviadaEm: '2026-02-31' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.propostaEnviadaEm).toBe('Data inválida.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/grcc/validacao.test.ts`
Expected: FAIL — `ok` is a const object without `propostaEnviadaEm`, and `schemaLead` doesn't know the field yet (TS error or the key is silently dropped and `validarLead` won't echo it back the way the test expects once compiled; at minimum the new assertion on `r.erros.propostaEnviadaEm` fails because the whole object is rejected for an unknown-but-ignored key, or passes vacuously — to be safe, run `npx tsc --noEmit` first and confirm it fails to compile because `ok` (built from `LEAD_VAZIO`) is missing the field once Step 3 adds it to the type but before Step 4 adds it to the schema. Treat "compile error" as the expected failure here.)

- [ ] **Step 3: Add the field to `LeadGrccDados`, `CAMPOS_LEAD`, `ROTULO_CAMPO`, `CAMPOS_COMERCIAIS`, `LEAD_VAZIO`**

In `src/lib/grcc/tipos.ts`:

```ts
// In LeadGrccDados, right after inicioFaturamento:
    inicioFaturamento: string | null;
    /** Data (YYYY-MM-DD) em que a proposta foi enviada ao cliente. Alimenta a temperatura automática (ver `temperaturaDoLead`). */
    propostaEnviadaEm: string | null;
    duracaoMeses: number;
```

```ts
// In CAMPOS_LEAD, right after 'inicioFaturamento':
    'inicioFaturamento',
    'propostaEnviadaEm',
    'duracaoMeses',
```

```ts
// In ROTULO_CAMPO, right after inicioFaturamento:
    inicioFaturamento: 'Início do faturamento',
    propostaEnviadaEm: 'Data de envio da proposta',
    duracaoMeses: 'Duração (meses)',
```

```ts
// CAMPOS_COMERCIAIS — add at the end:
export const CAMPOS_COMERCIAIS: (keyof LeadGrccDados)[] = ['status', 'categoria', 'temperatura', 'etapa', 'situacao', 'motivoPerda', 'valor', 'previsaoFechamento', 'propostaEnviadaEm'];
```

```ts
// LEAD_VAZIO, right after previsaoFechamento:
    previsaoFechamento: null,
    inicioFaturamento: null,
    propostaEnviadaEm: null,
    duracaoMeses: 12,
```

- [ ] **Step 4: Add the field to `schemaLead`**

In `src/lib/grcc/validacao.ts`, right after `inicioFaturamento: dataOpcional,`:

```ts
    previsaoFechamento: dataOpcional,
    inicioFaturamento: dataOpcional,
    propostaEnviadaEm: dataOpcional,
    duracaoMeses: z.number().int().min(1, 'Duração mínima de 1 mês.').max(120),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsc --noEmit && npx vitest run src/lib/grcc/validacao.test.ts`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grcc/tipos.ts src/lib/grcc/validacao.ts src/lib/grcc/validacao.test.ts
git commit -m "feat(grcc): campo data de envio da proposta (propostaEnviadaEm)"
```

---

### Task 2: Temperatura automática pela data de envio + fechar a espera

**Files:**
- Modify: `src/lib/grcc/pipeline.ts`
- Test: `src/lib/grcc/pipeline.test.ts`

**Interfaces:**
- Consumes: `LeadGrccDados` (Task 1), `LEAD_VAZIO`, `temperaturaDaCategoria` (existing).
- Produces:
  - `temperaturaDoLead(lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>, agora?: Date): OpportunityTemperature` — same name, same first behavior (manual/categoria), now also considers `propostaEnviadaEm`. Existing callers (`LeadsGrccTable.tsx`, `LeadPainel.tsx`, `projetoDoLead`) keep compiling unchanged since they already pass full `LeadGrcc`/`LeadGrccDados` objects.
  - `fecharEsperaDeProposta(atual: LeadGrccDados, dados: LeadGrccDados): LeadGrccDados` — used by Task 5 (`queries.ts`).
  - `origemTemperatura(lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>): 'fixa' | 'manual' | 'proposta' | 'categoria'` — used by Task 7 (tooltip).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/grcc/pipeline.test.ts` (new imports: `fecharEsperaDeProposta, origemTemperatura, temperaturaDoLead` alongside the existing `projetoDoLead, temperaturaDaCategoria, trimestreDaPrevisao`):

```ts
describe('temperaturaDoLead', () => {
    const base = { categoria: 'Em tratativas' as const, temperatura: null, propostaEnviadaEm: null };

    it('sem data de envio e sem manual → automática pela categoria', () => {
        expect(temperaturaDoLead(base)).toBe('morno');
    });

    it('manual sempre vence, mesmo com data de envio', () => {
        expect(temperaturaDoLead({ ...base, temperatura: 'frio', propostaEnviadaEm: '2026-08-01' }, new Date('2026-08-15'))).toBe('frio');
    });

    it('antes de completar 2 meses corridos → quente', () => {
        expect(temperaturaDoLead({ ...base, propostaEnviadaEm: '2026-08-01' }, new Date('2026-09-30'))).toBe('quente');
    });

    it('ao completar 2 meses corridos → morno', () => {
        expect(temperaturaDoLead({ ...base, propostaEnviadaEm: '2026-08-01' }, new Date('2026-10-01'))).toBe('morno');
    });

    it('Contratado/Perda são fixos mesmo com data de envio', () => {
        expect(temperaturaDoLead({ categoria: 'Contratado', temperatura: null, propostaEnviadaEm: '2026-08-01' }, new Date('2026-08-05'))).toBe('contratado');
    });
});

describe('origemTemperatura', () => {
    it('classifica fixa, manual, proposta e categoria', () => {
        expect(origemTemperatura({ categoria: 'Contratado', temperatura: null, propostaEnviadaEm: null })).toBe('fixa');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: 'frio', propostaEnviadaEm: '2026-08-01' })).toBe('manual');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: null, propostaEnviadaEm: '2026-08-01' })).toBe('proposta');
        expect(origemTemperatura({ categoria: 'Novo', temperatura: null, propostaEnviadaEm: null })).toBe('categoria');
    });
});

describe('fecharEsperaDeProposta', () => {
    const base: LeadGrccDados = { ...LEAD_VAZIO, etapa: 'Proposta enviada', situacao: 'Aguardando', propostaEnviadaEm: '2026-08-01' };

    it('etapa mudou → zera a data de envio', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada' }).propostaEnviadaEm).toBeNull();
    });

    it('situação mudou → zera a data de envio', () => {
        expect(fecharEsperaDeProposta(base, { ...base, situacao: 'Parado' }).propostaEnviadaEm).toBeNull();
    });

    it('nada mudou → mantém a data', () => {
        expect(fecharEsperaDeProposta(base, { ...base }).propostaEnviadaEm).toBe('2026-08-01');
    });

    it('etapa mudou mas a edição já trouxe data nova (reenvio) → mantém a data nova', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada', propostaEnviadaEm: '2026-10-01' }).propostaEnviadaEm).toBe('2026-10-01');
    });

    it('etapa mudou e a edição já limpou a data manualmente → mantém limpa', () => {
        expect(fecharEsperaDeProposta(base, { ...base, etapa: 'Reunião agendada', propostaEnviadaEm: null }).propostaEnviadaEm).toBeNull();
    });
});
```

(`LEAD_VAZIO` and `LeadGrccDados` need importing from `./tipos` in the test file — the existing import line already has `CATEGORIAS_GRCC, LEAD_VAZIO, type LeadGrcc`; add `type LeadGrccDados`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/grcc/pipeline.test.ts`
Expected: FAIL — `fecharEsperaDeProposta` and `origemTemperatura` are not exported yet; `temperaturaDoLead` ignores `propostaEnviadaEm`.

- [ ] **Step 3: Implement**

In `src/lib/grcc/pipeline.ts`, replace the existing `temperaturaDoLead` and add the two new functions:

```ts
function dataLimiteProposta(dataEnvio: string): number {
    const [y, m, d] = dataEnvio.split('-').map(Number);
    return Date.UTC(y, m - 1 + 2, d);
}

function temperaturaPelaProposta(dataEnvio: string, agora: Date): OpportunityTemperature {
    return agora.getTime() >= dataLimiteProposta(dataEnvio) ? 'morno' : 'quente';
}

/**
 * Temperatura que o lead leva ao pipeline. Contratado/Perda mandam sempre; nos demais vale a
 * temperatura escolhida no cadastro; se vazia e houver data de envio da proposta, quente por 2
 * meses corridos e depois morno; sem nada disso, a automática pela categoria.
 */
export function temperaturaDoLead(
    lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>,
    agora: Date = new Date()
): OpportunityTemperature {
    if (lead.categoria === 'Contratado' || lead.categoria === 'Perda') return temperaturaDaCategoria(lead.categoria);
    if (lead.temperatura) return lead.temperatura;
    if (lead.propostaEnviadaEm) return temperaturaPelaProposta(lead.propostaEnviadaEm, agora);
    return temperaturaDaCategoria(lead.categoria);
}

/** De onde vem a temperatura mostrada — só para texto explicativo na UI (tooltip). */
export function origemTemperatura(
    lead: Pick<LeadGrccDados, 'categoria' | 'temperatura' | 'propostaEnviadaEm'>
): 'fixa' | 'manual' | 'proposta' | 'categoria' {
    if (lead.categoria === 'Contratado' || lead.categoria === 'Perda') return 'fixa';
    if (lead.temperatura) return 'manual';
    if (lead.propostaEnviadaEm) return 'proposta';
    return 'categoria';
}

/**
 * Mudar etapa ou situação conta como "o cliente retornou": fecha a espera da proposta (zera a
 * data), a menos que a própria edição já tenha trazido uma data de envio diferente (reenvio).
 */
export function fecharEsperaDeProposta(atual: LeadGrccDados, dados: LeadGrccDados): LeadGrccDados {
    if (dados.propostaEnviadaEm !== atual.propostaEnviadaEm) return dados;
    if (atual.etapa === dados.etapa && atual.situacao === dados.situacao) return dados;
    return { ...dados, propostaEnviadaEm: null };
}
```

Leave `temperaturaDaCategoria` and `trimestreDaPrevisao` untouched. `projetoDoLead` already calls `temperaturaDoLead(lead)` with one argument — no change needed there, it keeps defaulting to `new Date()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/grcc/pipeline.test.ts`
Expected: both PASS, including the pre-existing `projetoDoLead`/`temperaturaDaCategoria`/`trimestreDaPrevisao` tests (unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/grcc/pipeline.ts src/lib/grcc/pipeline.test.ts
git commit -m "feat(grcc): temperatura automatica esfria pela data de envio da proposta"
```

---

### Task 3: Importação não apaga a data de envio já registrada

**Files:**
- Modify: `src/lib/grcc/previa.ts`
- Test: `src/lib/grcc/previa.test.ts`

**Interfaces:**
- Consumes: `LeadGrcc`, `LeadGrccDados` (Task 1), `diffLead` (existing), `chaveLead` (existing).
- Produces: no new export; `montarPrevia` behavior extended.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/grcc/previa.test.ts`:

```ts
it('planilha sem data de envio não apaga a que foi registrada na tela', () => {
    const comData: LeadGrcc = { ...existente, propostaEnviadaEm: '2026-09-01' };
    const { propostaEnviadaEm: _p, ...semData } = existente;
    void _p;
    const p = montarPrevia([{ linha: 2, dados: { ...semData, propostaEnviadaEm: null, valor: 999 } }], [], [comData]);
    expect(p.alterados).toHaveLength(1);
    expect(p.alterados[0].dados.propostaEnviadaEm).toBe('2026-09-01');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/grcc/previa.test.ts`
Expected: FAIL — `p.alterados[0].dados.propostaEnviadaEm` is `null` (the spreadsheet value wins today).

- [ ] **Step 3: Implement**

In `src/lib/grcc/previa.ts`, replace:

```ts
        // Planilha sem temperatura não apaga a que foi escolhida na tela.
        const dados = l.dados.temperatura === null && atual.temperatura ? { ...l.dados, temperatura: atual.temperatura } : l.dados;
```

with:

```ts
        // Planilha sem temperatura ou sem data de envio não apaga o que foi escolhido na tela.
        let dados = l.dados;
        if (dados.temperatura === null && atual.temperatura) dados = { ...dados, temperatura: atual.temperatura };
        if (dados.propostaEnviadaEm === null && atual.propostaEnviadaEm) dados = { ...dados, propostaEnviadaEm: atual.propostaEnviadaEm };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/grcc/previa.test.ts`
Expected: PASS (including the 3 pre-existing tests in this file, unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/grcc/previa.ts src/lib/grcc/previa.test.ts
git commit -m "fix(grcc): importacao preserva data de envio da proposta ja registrada"
```

---

### Task 4: Coluna na importação (.xlsx) e na exportação

**Files:**
- Modify: `src/lib/grcc/planilha.ts`
- Modify: `src/lib/grcc/exportar.ts`
- Test: `src/lib/grcc/planilha.test.ts`
- Test: `src/lib/grcc/exportar.test.ts`

**Interfaces:**
- Consumes: `LeadGrccDados`/`LeadGrcc` (Task 1), `parseDataIso` (existing, from `./normalizar`), `ALIASES_COLUNA` (existing, now must cover every key of `LeadGrccDados` — TypeScript enforces this since it's typed `Record<keyof LeadGrccDados, string[]>`).
- Produces: no new exports; both modules now round-trip `propostaEnviadaEm`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/grcc/exportar.test.ts`, add `propostaEnviadaEm: '2026-09-15',` to the `LEAD` fixture (right after `inicioFaturamento: '2027-01-01',`):

```ts
    previsaoFechamento: '2026-11-30',
    inicioFaturamento: '2027-01-01',
    propostaEnviadaEm: '2026-09-15',
    duracaoMeses: 24,
```

The existing `'volta igual pela importação'` test already asserts `r.linhas` equals `dados` (everything but `id/visivelDashboard/criadoEm/atualizadoEm`) — it will now fail until the column exists on both sides, which is exactly the round-trip check this task needs. No new `it()` required here; this fixture edit is the test.

In `src/lib/grcc/planilha.test.ts`, add one targeted test:

```ts
it('lê a data de envio da proposta pelo cabeçalho', () => {
    const cab = [...CAB, 'Data de envio da proposta'];
    const l = [...linha(), '2026-09-15T00:00:00.000Z'];
    const r = lerLinhasPlanilha([cab, l]);
    expect(r.linhas[0].dados.propostaEnviadaEm).toBe('2026-09-15');
});
```

(`linha()` returns `unknown[]` already ordered by `CAB` — appending one more header/cell pair after it is safe because columns are matched by header name, not position, per `lerLinhasPlanilha`'s own doc comment.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/grcc/exportar.test.ts src/lib/grcc/planilha.test.ts`
Expected: FAIL — `exportar.test.ts` fails first at compile time (`LEAD` is missing a required field once Task 1 landed `propostaEnviadaEm` on `LeadGrcc`); after adding the fixture line it fails the round-trip assertion because neither module knows the column yet. `planilha.test.ts`'s new test fails because `dados.propostaEnviadaEm` is `undefined`/not read.

- [ ] **Step 3: Implement — `planilha.ts`**

Add to `ALIASES_COLUNA` (TypeScript will refuse to compile without this entry, since the type is `Record<keyof LeadGrccDados, string[]>`), right after `inicioFaturamento`:

```ts
    inicioFaturamento: ['inicio faturamento', 'inicio do faturamento'],
    propostaEnviadaEm: ['data envio proposta', 'data de envio da proposta', 'envio da proposta'],
    duracaoMeses: ['duracao meses', 'duracao', 'prazo meses'],
```

Add to the `dados` object construction inside `lerLinhasPlanilha`, right after `inicioFaturamento`:

```ts
            previsaoFechamento: parseDataIso(cel(row, 'previsaoFechamento')),
            inicioFaturamento: parseDataIso(cel(row, 'inicioFaturamento')),
            propostaEnviadaEm: parseDataIso(cel(row, 'propostaEnviadaEm')),
            duracaoMeses: Number.isInteger(duracao) && duracao > 0 ? duracao : 12,
```

- [ ] **Step 4: Implement — `exportar.ts`**

Add to `COLUNAS_EXPORTACAO`, right after the "Início do faturamento" entry:

```ts
    { cabecalho: 'Início do faturamento', largura: 14, celula: (l) => data(l.inicioFaturamento) },
    { cabecalho: 'Data de envio da proposta', largura: 16, celula: (l) => data(l.propostaEnviadaEm) },
    { cabecalho: 'Duração (meses)', largura: 10, celula: (l) => ({ value: l.duracaoMeses, type: Number }) },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/grcc/exportar.test.ts src/lib/grcc/planilha.test.ts`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grcc/planilha.ts src/lib/grcc/exportar.ts src/lib/grcc/planilha.test.ts src/lib/grcc/exportar.test.ts
git commit -m "feat(grcc): data de envio da proposta na importacao e exportacao de Excel"
```

---

### Task 5: Coluna no banco + fechar a espera ao salvar

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0019_lead_grcc_proposta_enviada.sql`
- Modify: `src/db/queries.ts`
- Test: `src/db/queries.grcc.test.ts`

**Interfaces:**
- Consumes: `fecharEsperaDeProposta` (Task 2, from `../lib/grcc/pipeline`), `dadosDoLead` (existing, from `../lib/grcc/previa`).
- Produces: `leadGrcc.propostaEnviadaEm` column; `salvarLeadGrcc`/`gravarLead` now apply `fecharEsperaDeProposta` on every edit.

- [ ] **Step 1: Write the failing tests**

Add to `src/db/queries.grcc.test.ts`, inside `describe('salvarLeadGrcc', ...)`:

```ts
it('mudar etapa fecha a espera: zera a data de envio da proposta automaticamente', async () => {
    const { lead: l } = await q.salvarLeadGrcc(null, lead({ propostaEnviadaEm: '2026-08-01' }));
    const r = await q.salvarLeadGrcc(l.id, lead({ propostaEnviadaEm: '2026-08-01', etapa: 'Reunião agendada' }));
    expect(r.lead.propostaEnviadaEm).toBeNull();
});

it('reenviar a proposta na mesma edição que muda a etapa mantém a data nova', async () => {
    const { lead: l } = await q.salvarLeadGrcc(null, lead({ propostaEnviadaEm: '2026-08-01' }));
    const r = await q.salvarLeadGrcc(l.id, lead({ propostaEnviadaEm: '2026-10-01', etapa: 'Reunião agendada' }));
    expect(r.lead.propostaEnviadaEm).toBe('2026-10-01');
});

it('editar sem mudar etapa/situação mantém a data de envio', async () => {
    const { lead: l } = await q.salvarLeadGrcc(null, lead({ propostaEnviadaEm: '2026-08-01' }));
    const r = await q.salvarLeadGrcc(l.id, lead({ propostaEnviadaEm: '2026-08-01', valor: 999 }));
    expect(r.lead.propostaEnviadaEm).toBe('2026-08-01');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db/queries.grcc.test.ts`
Expected: FAIL — compile error (`lead()` fixture tries to override a field that doesn't exist on the DB row type yet / the column doesn't exist), or once schema is added but migration/wiring isn't, the column exists but nothing zeroes it on etapa change.

- [ ] **Step 3: Add the column to the schema**

In `src/db/schema.ts`, inside the `leadGrcc` table definition, right after `inicioFaturamento`:

```ts
    inicioFaturamento: text('inicio_faturamento'), // "YYYY-MM-DD", só Contratado
    propostaEnviadaEm: text('proposta_enviada_em'), // "YYYY-MM-DD". Alimenta a temperatura automática — ver src/lib/grcc/pipeline.ts
    duracaoMeses: integer('duracao_meses').notNull().default(12),
```

- [ ] **Step 4: Write the migration**

Create `src/db/migrations/0019_lead_grcc_proposta_enviada.sql`:

```sql
-- Data de envio da proposta (YYYY-MM-DD). NULL = não enviada/não registrada. Depois de 2 meses
-- corridos sem mudar etapa/situação, a temperatura automática esfria de quente para morno
-- (ver temperaturaDoLead em src/lib/grcc/pipeline.ts).
ALTER TABLE `lead_grcc` ADD `proposta_enviada_em` text;
```

- [ ] **Step 5: Apply the migration locally**

Run: `npm run db:migrate`
Expected: output includes `✓ applied 0019_lead_grcc_proposta_enviada.sql` (or `⚠ ignored: duplicate column` if already applied in this environment — both are fine).

- [ ] **Step 6: Wire `fecharEsperaDeProposta` into `gravarLead`**

In `src/db/queries.ts`, add `fecharEsperaDeProposta` to the existing pipeline import (line ~661):

```ts
import { projetoDoLead, fecharEsperaDeProposta } from '../lib/grcc/pipeline';
```

Then in `gravarLead`'s update branch, replace:

```ts
    const atual = linhaParaLead(atualRow);
    const mudancas = diffLead(dadosDoLead(atual), dados);
    if (mudancas.length === 0) return { lead: atual, mudou: false };

    const [r] = await tx.update(leadGrcc).set({ ...dados, atualizadoEm: agora }).where(eq(leadGrcc.id, id)).returning();
```

with:

```ts
    const atual = linhaParaLead(atualRow);
    const dadosAjustados = fecharEsperaDeProposta(dadosDoLead(atual), dados);
    const mudancas = diffLead(dadosDoLead(atual), dadosAjustados);
    if (mudancas.length === 0) return { lead: atual, mudou: false };

    const [r] = await tx.update(leadGrcc).set({ ...dadosAjustados, atualizadoEm: agora }).where(eq(leadGrcc.id, id)).returning();
```

(The cadastro branch — `id === null` — is untouched: a brand-new lead has no "atual" to compare etapa/situação against, so whatever `propostaEnviadaEm` it's created with stands.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/db/queries.grcc.test.ts`
Expected: PASS, including every pre-existing test in that file.

- [ ] **Step 8: Run the full suite**

Run: `npm run test`
Expected: PASS (confirms nothing elsewhere broke from the schema/pipeline change).

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts src/db/migrations/0019_lead_grcc_proposta_enviada.sql src/db/queries.ts src/db/queries.grcc.test.ts
git commit -m "feat(grcc): coluna proposta_enviada_em e fechamento automatico da espera ao salvar"
```

---

### Task 6: Campo no formulário + autocomplete de Cliente

**Files:**
- Modify: `src/app/grcc/components/LeadPainel.tsx`
- Modify: `src/app/grcc/GrccApp.tsx`
- Test: `src/app/grcc/components/LeadPainel.test.tsx`

**Interfaces:**
- Consumes: `temperaturaDoLead` (Task 2, unchanged call sites), `dados.propostaEnviadaEm` (Task 1).
- Produces: `LeadPainel` gains an optional prop `clientesConhecidos?: string[]` (default `[]`) — existing renders in the test file that omit it keep working.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/grcc/components/LeadPainel.test.tsx`:

```ts
describe('data de envio da proposta', () => {
    it('mostra o campo e salva a data escolhida', async () => {
        const user = userEvent.setup();
        salvarLead.mockResolvedValue({ ok: true, valor: lead });
        render(<LeadPainel aberto lead={lead} listas={listas} onFechar={() => {}} onGravado={async () => {}} />);
        await user.type(screen.getByLabelText('Data de envio da proposta'), '2026-09-15');
        await user.click(screen.getByRole('button', { name: /Salvar/ }));
        await waitFor(() =>
            expect(salvarLead).toHaveBeenCalledWith('k', 5, expect.objectContaining({ propostaEnviadaEm: '2026-09-15' }), { visivelDashboard: true })
        );
    });
});

describe('autocomplete de cliente', () => {
    it('sugere nomes já usados sem impedir digitar um novo', () => {
        render(
            <LeadPainel aberto lead={null} listas={listas} onFechar={() => {}} onGravado={async () => {}} clientesConhecidos={['Prefeitura de Limeira', 'ALESP']} />
        );
        const campo = screen.getByLabelText('Cliente') as HTMLInputElement;
        expect(campo.getAttribute('list')).toBeTruthy();
        const lista = document.getElementById(campo.getAttribute('list')!) as HTMLDataListElement;
        expect(Array.from(lista.options).map((o) => o.value)).toEqual(['Prefeitura de Limeira', 'ALESP']);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/grcc/components/LeadPainel.test.tsx`
Expected: FAIL — `getByLabelText('Data de envio da proposta')` not found; `campo.getAttribute('list')` is `null`.

- [ ] **Step 3: Add the prop and the datalist**

In `src/app/grcc/components/LeadPainel.tsx`, add `clientesConhecidos = []` to the prop destructuring and its type:

```ts
export function LeadPainel({
    aberto,
    lead,
    listas,
    onFechar,
    onGravado,
    onProximo,
    faixa,
    clientesConhecidos = [],
}: {
    aberto: boolean;
    lead: LeadGrcc | null;
    listas: Record<CampoLista, string[]>;
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
    onProximo?: () => void;
    faixa?: string;
    /** Nomes de Cliente já usados em outros leads, para sugerir no autocomplete (evita variação/duplicata). */
    clientesConhecidos?: string[];
}) {
```

Replace the Cliente field:

```tsx
                                    <Campo id="f-cliente" rotulo="Cliente" erro={erros.cliente} obrigatorio dica="Órgão ou empresa (ex.: Prefeitura de Valinhos).">
                                        <input id="f-cliente" value={dados.cliente} onChange={(e) => set('cliente', e.target.value)} className={cls()} />
                                    </Campo>
```

with:

```tsx
                                    <Campo id="f-cliente" rotulo="Cliente" erro={erros.cliente} obrigatorio dica="Órgão ou empresa (ex.: Prefeitura de Valinhos). Comece a digitar: se já existe, escolha na lista em vez de redigitar.">
                                        <input id="f-cliente" value={dados.cliente} onChange={(e) => set('cliente', e.target.value)} list="lista-clientes-grcc" className={cls()} />
                                        <datalist id="lista-clientes-grcc">
                                            {clientesConhecidos.map((c) => (
                                                <option key={c} value={c} />
                                            ))}
                                        </datalist>
                                    </Campo>
```

- [ ] **Step 4: Add the date field**

Add `propostaEnviadaEm: 'f-proposta-enviada',` to `ID_DO_CAMPO`:

```ts
const ID_DO_CAMPO: Partial<Record<keyof LeadGrccDados, string>> = {
    previsaoFechamento: 'f-previsao',
    inicioFaturamento: 'f-inicio',
    propostaEnviadaEm: 'f-proposta-enviada',
};
```

Add the field right after "Previsão de fechamento" (before the `{dados.categoria === 'Contratado' && (...)}` block):

```tsx
                                    <Campo id="f-previsao" rotulo="Previsão de fechamento" erro={erros.previsaoFechamento} falta={falta.has('previsaoFechamento')} dica="Define o trimestre (Q1–Q4) em que o valor aparece.">
                                        <input
                                            id="f-previsao"
                                            type="date"
                                            value={dados.previsaoFechamento ?? ''}
                                            onChange={(e) => set('previsaoFechamento', e.target.value || null)}
                                            className={cls(falta.has('previsaoFechamento'))}
                                        />
                                    </Campo>
                                    <Campo id="f-proposta-enviada" rotulo="Data de envio da proposta" erro={erros.propostaEnviadaEm} dica="Depois de 2 meses sem mudar a etapa/situação, a temperatura automática vira morno.">
                                        <input
                                            id="f-proposta-enviada"
                                            type="date"
                                            value={dados.propostaEnviadaEm ?? ''}
                                            onChange={(e) => set('propostaEnviadaEm', e.target.value || null)}
                                            className={cls()}
                                        />
                                    </Campo>
```

- [ ] **Step 5: Wire `clientesConhecidos` from `GrccApp.tsx`**

In `src/app/grcc/GrccApp.tsx`, add a `useMemo` (near the other derived values, after `painel` is read) and pass it down:

```ts
    const clientesConhecidos = useMemo(
        () => (painel ? Array.from(new Set(painel.leads.map((l) => l.cliente))).sort((a, b) => a.localeCompare(b, 'pt-BR')) : []),
        [painel]
    );
```

```tsx
            <LeadPainel
                aberto={aberto !== null}
                lead={aberto === 'novo' ? null : leadAberto}
                listas={painel.listas}
                onFechar={fechar}
                onGravado={depoisDeGravar}
                onProximo={completando ? abrirProximoPendente : undefined}
                faixa={completando ? `Completando cadastro · ${restantes === 0 ? 'último da fila' : `faltam ${restantes}`}` : undefined}
                clientesConhecidos={clientesConhecidos}
            />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/app/grcc/components/LeadPainel.test.tsx`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 7: Commit**

```bash
git add src/app/grcc/components/LeadPainel.tsx src/app/grcc/GrccApp.tsx src/app/grcc/components/LeadPainel.test.tsx
git commit -m "feat(grcc): campo de data de envio da proposta e autocomplete de cliente no formulario"
```

---

### Task 7: Agrupar por cliente na tabela do `/grcc` + tooltip de temperatura

**Files:**
- Modify: `src/lib/grcc/organizar.ts`
- Modify: `src/app/grcc/components/LeadsGrccTable.tsx`
- Test: `src/lib/grcc/organizar.test.ts`
- Test: `src/app/grcc/components/LeadsGrccTable.test.tsx`

**Interfaces:**
- Consumes: `chaveTexto` (existing, from `./normalizar`), `origemTemperatura`/`temperaturaDoLead` (Task 2).
- Produces: `GrupoCliente` interface and `agruparPorCliente(leads: LeadGrcc[]): GrupoCliente[]`, same shape as the existing `GrupoCidade` minus `uf`/`municipio` — both are consumed interchangeably by `LeadsGrccTable`'s existing group-rendering block (it only reads `chave`, `rotulo`, `leads`, `valorAtivo`, `porCategoria`).

- [ ] **Step 1: Write the failing test — `organizar.test.ts`**

Add to `src/lib/grcc/organizar.test.ts`:

```ts
describe('agruparPorCliente', () => {
    const leads = [
        lead(1, { cliente: 'Prefeitura de Limeira', categoria: 'No cliente', valor: 100 }),
        lead(2, { cliente: 'ALESP', valor: 50 }),
        lead(3, { cliente: '  prefeitura de limeira  ', categoria: 'Perda', valor: 30 }),
    ];

    it('agrupa ignorando acento/caixa/espaço e ordena por nome', () => {
        const grupos = agruparPorCliente(leads);
        expect(grupos.map((g) => g.rotulo)).toEqual(['ALESP', 'Prefeitura de Limeira']);
        const limeira = grupos.find((g) => g.rotulo === 'Prefeitura de Limeira')!;
        expect(limeira.leads.map((l) => l.id)).toEqual([1, 3]);
    });

    it('soma o valor ativo (sem Perda) e conta por categoria', () => {
        const limeira = agruparPorCliente(leads).find((g) => g.rotulo === 'Prefeitura de Limeira')!;
        expect(limeira.valorAtivo).toBe(100);
        expect(limeira.porCategoria).toEqual({ 'No cliente': 1, Perda: 1 });
    });
});
```

Add `agruparPorCliente` to the existing import line at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/grcc/organizar.test.ts`
Expected: FAIL — `agruparPorCliente` is not exported yet.

- [ ] **Step 3: Implement `agruparPorCliente`**

In `src/lib/grcc/organizar.ts`, add the import and the new type/function (near `agruparPorCidade`):

```ts
import { chaveTexto } from './normalizar';
```

```ts
export interface GrupoCliente {
    chave: string;
    rotulo: string;
    leads: LeadGrcc[];
    valorAtivo: number;
    porCategoria: Partial<Record<CategoriaGrcc, number>>;
}

export function agruparPorCliente(leads: LeadGrcc[]): GrupoCliente[] {
    const grupos = new Map<string, GrupoCliente>();
    for (const l of leads) {
        const chave = chaveTexto(l.cliente);
        let g = grupos.get(chave);
        if (!g) {
            g = { chave, rotulo: l.cliente.trim(), leads: [], valorAtivo: 0, porCategoria: {} };
            grupos.set(chave, g);
        }
        g.leads.push(l);
        if (l.categoria !== 'Perda') g.valorAtivo += l.valor;
        g.porCategoria[l.categoria] = (g.porCategoria[l.categoria] ?? 0) + 1;
    }
    return [...grupos.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/grcc/organizar.test.ts`
Expected: PASS, including all pre-existing tests in the file.

- [ ] **Step 5: Write the failing test — `LeadsGrccTable.test.tsx`**

Add to `src/app/grcc/components/LeadsGrccTable.test.tsx`:

```tsx
it('"Por cliente" agrupa chamados repetidos do mesmo cliente', async () => {
    const user = userEvent.setup();
    const repetidos = [
        mk(10, { cliente: 'Prefeitura de Limeira', solicitacao: 'Consultoria' }),
        mk(11, { cliente: 'Prefeitura de Limeira', solicitacao: 'Nuvem' }),
        mk(12, { cliente: 'ALESP', solicitacao: 'Chatbot' }),
    ];
    render(<LeadsGrccTable leads={repetidos} onAbrir={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Por cliente' }));
    expect(screen.getAllByRole('rowheader').map((g) => g.textContent)).toEqual([
        expect.stringMatching(/^ALESP.*1 lead/),
        expect.stringMatching(/^Prefeitura de Limeira.*2 leads/),
    ]);
});

it('tooltip da temperatura distingue automática pela proposta da automática pela categoria', () => {
    render(
        <LeadsGrccTable
            leads={[
                mk(20, { cliente: 'A', categoria: 'Novo' }),
                mk(21, { cliente: 'B', categoria: 'Novo', propostaEnviadaEm: '2026-01-01' }),
            ]}
            onAbrir={() => {}}
        />
    );
    expect(screen.getByText('A').closest('tr')!.querySelector('[title]')!.getAttribute('title')).toMatch(/automática pela categoria/);
    expect(screen.getByText('B').closest('tr')!.querySelector('[title]')!.getAttribute('title')).toMatch(/automática pela data de envio da proposta/);
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/app/grcc/components/LeadsGrccTable.test.tsx`
Expected: FAIL — no "Por cliente" button exists yet; the tooltip text doesn't distinguish the proposal case.

- [ ] **Step 7: Implement in `LeadsGrccTable.tsx`**

Update imports:

```ts
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Building2, Download, EyeOff, List, Loader2, MapPin, Search } from 'lucide-react';
...
import { origemTemperatura, temperaturaDoLead } from '@/lib/grcc/pipeline';
import { agruparPorCliente, agruparPorCidade, alternarOrdem, COLUNAS_ORDEM, ORDEM_PADRAO, ordemValida, ordenarLeads, type ColunaOrdem, type Ordem } from '@/lib/grcc/organizar';
```

Widen the view-mode type and the groups computation:

```ts
type Visao = 'lista' | 'cidade' | 'cliente';
```

```ts
    const grupos = useMemo(
        () => (visao === 'cidade' ? agruparPorCidade(visiveis) : visao === 'cliente' ? agruparPorCliente(visiveis) : []),
        [visao, visiveis]
    );
```

Add the toggle button next to the existing two:

```tsx
                    {botaoVisao('lista', 'Lista', List)}
                    {botaoVisao('cidade', 'Por cidade', MapPin)}
                    {botaoVisao('cliente', 'Por cliente', Building2)}
```

Replace the tooltip in `linha`:

```tsx
const ROTULO_ORIGEM_TEMPERATURA: Record<ReturnType<typeof origemTemperatura>, string> = {
    fixa: 'fixa pela categoria',
    manual: 'escolhida no cadastro',
    proposta: 'automática pela data de envio da proposta',
    categoria: 'automática pela categoria',
};
```

```tsx
                        title={`No pipeline: ${temperaturaDoLead(l)} (${ROTULO_ORIGEM_TEMPERATURA[origemTemperatura(l)]})`}
```

(the two `temperaturaDoLead(l)`/`ICONE_TEMPERATURA[temperaturaDoLead(l)]` calls right below stay as they are.)

The existing `grupos.map((g) => ...)` render block (the `tbody` for `visao !== 'lista'`) needs no changes — it already reads only `g.chave`, `g.rotulo`, `g.leads`, `g.valorAtivo`, `g.porCategoria`, all present on `GrupoCliente` too. The `g.chave === 'Sem cidade'` amber-highlight check simply never matches for cliente groups (their `chave` is a normalized client name), which is correct — there is no "sem cliente" case since `cliente` is a required field.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/app/grcc/components/LeadsGrccTable.test.tsx`
Expected: PASS, including every pre-existing test in the file (the "Por cidade" test must still pass unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/lib/grcc/organizar.ts src/lib/grcc/organizar.test.ts src/app/grcc/components/LeadsGrccTable.tsx src/app/grcc/components/LeadsGrccTable.test.tsx
git commit -m "feat(grcc): agrupar leads por cliente na tabela e tooltip da origem da temperatura"
```

---

### Task 8: Agrupar por cliente no modal de indicador da aba Cidades

**Files:**
- Modify: `src/lib/cidades/indicadores.ts`
- Modify: `src/components/cidades/IndicadorModal.tsx`
- Modify: `src/components/cidades/CidadesView.tsx` (one line: the `DetalheIndicador` construction)
- Test: `src/lib/cidades/indicadores.test.ts`
- Create: `src/components/cidades/IndicadorModal.test.tsx`

**Interfaces:**
- Consumes: `chaveTexto` (existing, from `@/lib/grcc/normalizar`), `LeadCidade` (existing, from `@/types/cidades`).
- Produces: `agruparPorCliente(leads: LeadCidade[]): { chave: string; rotulo: string; leads: LeadCidade[] }[]` in `src/lib/cidades/indicadores.ts` (same name/shape idea as Task 7's, but for `LeadCidade` — kept separate since the two types are unrelated and this module already duplicates small grouping helpers like `chaveCidade` rather than sharing across `LeadGrcc`/`LeadCidade`). `DetalheIndicador.porCliente?: boolean`.

- [ ] **Step 1: Write the failing test — `indicadores.test.ts`**

Add to `src/lib/cidades/indicadores.test.ts`:

```ts
describe('agruparPorCliente', () => {
    it('agrupa por cliente normalizado, em ordem de chegada', () => {
        const ls = [l(1, { cliente: 'Prefeitura de Limeira' }), l(2, { cliente: 'ALESP' }), l(3, { cliente: 'PREFEITURA DE LIMEIRA' })];
        const grupos = agruparPorCliente(ls);
        expect(grupos.map((g) => g.rotulo)).toEqual(['Prefeitura de Limeira', 'ALESP']);
        expect(grupos[0].leads.map((x) => x.id)).toEqual([1, 3]);
    });
});
```

Add `agruparPorCliente` to the existing import line.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cidades/indicadores.test.ts`
Expected: FAIL — not exported yet.

- [ ] **Step 3: Implement in `indicadores.ts`**

Add `chaveTexto` to the existing import from `@/lib/grcc/normalizar` (currently only imports `extractLeadDate`):

```ts
import { chaveTexto, extractLeadDate } from '@/lib/grcc/normalizar';
```

Add, near `chaveCidade`:

```ts
export interface GrupoClienteCidade {
    chave: string;
    rotulo: string;
    leads: LeadCidade[];
}

export function agruparPorCliente(leads: LeadCidade[]): GrupoClienteCidade[] {
    const m = new Map<string, GrupoClienteCidade>();
    for (const l of leads) {
        const chave = chaveTexto(l.cliente);
        const g = m.get(chave) ?? { chave, rotulo: l.cliente.trim(), leads: [] };
        g.leads.push(l);
        m.set(chave, g);
    }
    return [...m.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cidades/indicadores.test.ts`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Write the failing test — `IndicadorModal.test.tsx`** (new file)

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicadorModal } from './IndicadorModal';
import type { LeadCidade } from '@/types/cidades';

const l = (id: number, p: Partial<LeadCidade>): LeadCidade => ({
    id, cliente: `C${id}`, solicitacao: '', status: '', categoria: 'Novo', valor: 0, uf: 'SP', municipio: 'Campinas', ...p,
});

describe('IndicadorModal', () => {
    it('sem porCidade/porCliente mostra a lista plana', () => {
        render(
            <IndicadorModal
                aberto
                claro={false}
                onFechar={() => {}}
                onAbrirLead={() => {}}
                detalhe={{ titulo: 'Total', descricao: '', leads: [l(1, { cliente: 'Limeira A' }), l(2, { cliente: 'Limeira A' })] }}
            />
        );
        expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0);
        expect(screen.getAllByText('Limeira A')).toHaveLength(2);
    });

    it('porCliente agrupa leads do mesmo cliente sob um cabeçalho', () => {
        render(
            <IndicadorModal
                aberto
                claro={false}
                onFechar={() => {}}
                onAbrirLead={() => {}}
                detalhe={{
                    titulo: 'Total',
                    descricao: '',
                    porCliente: true,
                    leads: [l(1, { cliente: 'Limeira A' }), l(2, { cliente: 'Limeira A' }), l(3, { cliente: 'ALESP' })],
                }}
            />
        );
        expect(screen.getByText(/Limeira A/).closest('h4')).toBeInTheDocument();
        expect(screen.getByText('2 · R$ 0,00')).toBeInTheDocument();
    });
});
```

(Adjust the `2 · R$ 0,00` assertion if `brl(0)` formats differently — check by running the test once and reading the actual rendered text before hardening the assertion; `brl`/`somaValor` are both already used elsewhere in this file with real currency values, so this is just confirming the exact zero-value string.)

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/cidades/IndicadorModal.test.tsx`
Expected: FAIL — `porCliente` is not a known field of `DetalheIndicador`, and grouping doesn't happen.

- [ ] **Step 7: Implement in `IndicadorModal.tsx`**

Add `porCliente?: boolean` to `DetalheIndicador`:

```ts
export interface DetalheIndicador {
    titulo: string;
    descricao: string;
    leads: LeadCidade[];
    /** Agrupa a lista por município (card "Cidades atendidas"). */
    porCidade?: boolean;
    /** Agrupa a lista por cliente (evita "Limeira" repetido quando há vários chamados). */
    porCliente?: boolean;
}
```

Add `agruparPorCliente` to the existing import from `@/lib/cidades/indicadores`:

```ts
import { agruparPorCliente, chaveCidade, somaValor } from '@/lib/cidades/indicadores';
```

Replace the `grupos` useMemo:

```ts
    const grupos = useMemo(() => {
        if (detalhe?.porCidade) {
            const m = new Map<string, { rotulo: string; leads: LeadCidade[] }>();
            for (const l of visiveis) {
                const k = chaveCidade(l);
                const g = m.get(k) ?? { rotulo: `${l.municipio.trim()} · ${l.uf || '—'}`, leads: [] };
                g.leads.push(l);
                m.set(k, g);
            }
            return [...m.values()];
        }
        if (detalhe?.porCliente) return agruparPorCliente(visiveis);
        return null;
    }, [detalhe, visiveis]);
```

- [ ] **Step 8: Wire `porCliente` in `CidadesView.tsx`**

Change the one existing line:

```ts
        return { titulo, descricao, leads: lista, porCidade: indicador === 'cidades' };
```

to:

```ts
        return { titulo, descricao, leads: lista, porCidade: indicador === 'cidades', porCliente: indicador !== 'cidades' };
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx tsc --noEmit && npx vitest run src/components/cidades/IndicadorModal.test.tsx src/lib/cidades/indicadores.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cidades/indicadores.ts src/lib/cidades/indicadores.test.ts src/components/cidades/IndicadorModal.tsx src/components/cidades/IndicadorModal.test.tsx src/components/cidades/CidadesView.tsx
git commit -m "feat(cidades): agrupar por cliente no modal de indicador"
```

---

### Task 9: Agrupar por cliente na aba Tabela da aba Cidades

**Files:**
- Modify: `src/components/cidades/CidadesView.tsx`

**Interfaces:**
- Consumes: `agruparPorCliente` (Task 8, from `@/lib/cidades/indicadores` — same function, already unit-tested there).

This is JSX-only wiring over an already unit-tested pure function, in a 1300+-line component with no existing automated-test coverage (`CidadesView.tsx` has no `.test.tsx` file, unlike `LeadsGrccTable`/`LeadPainel`/`IndicadorModal`). Rather than introducing a first component test for this one file, this task is verified manually against the running app, consistent with the file's current testing posture; the grouping logic itself is already covered by `indicadores.test.ts` (Task 8).

- [ ] **Step 1: Add `agruparPorCliente` to the existing import**

```ts
import { agruparPorCliente, contarCidades, ehPerda, leadsDoIndicador, somaValor, type Indicador } from '@/lib/cidades/indicadores';
```

- [ ] **Step 2: Compute the groups**

Right after the `filteredLeads` useMemo (around line 469), add:

```ts
    const gruposTabela = useMemo(() => agruparPorCliente(filteredLeads), [filteredLeads]);
```

- [ ] **Step 3: Render grouped rows**

Replace the `tbody` body (the `filteredLeads.length > 0 ? filteredLeads.map((lead) => (...)) : (...)` block, lines ~1211–1259) with:

```tsx
                                {filteredLeads.length > 0 ? (
                                    gruposTabela.map((g) => (
                                        <React.Fragment key={g.chave}>
                                            {g.leads.length > 1 && (
                                                <tr>
                                                    <td colSpan={8} className={`px-3 py-1.5 text-[11px] font-semibold ${claro ? 'bg-zinc-50 text-zinc-600' : 'bg-zinc-900/60 text-zinc-400'}`}>
                                                        {g.rotulo} · {g.leads.length} chamados
                                                    </td>
                                                </tr>
                                            )}
                                            {g.leads.map((lead) => (
                                                <tr key={lead.id} onClick={() => setLeadAbertoId(lead.id)} className={`cursor-pointer transition-colors ${T.rowHover} ${destacados.has(lead.id) ? 'bg-indigo-500/10' : ''}`}>
                                                    <td className="p-3 text-center">
                                                        <span className="inline-block font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px]">
                                                            {lead.uf || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 max-w-[260px]">
                                                        <p className={`font-bold truncate ${T.rowName}`}>{lead.cliente}</p>
                                                        <p className={`text-[11px] line-clamp-1 mt-0.5 ${T.subtext}`}>{lead.solicitacao}</p>
                                                    </td>
                                                    <td className="p-3">
                                                        {lead.contato_nome ? (
                                                            <div>
                                                                <p className={`font-semibold ${T.rowText}`}>{lead.contato_nome}</p>
                                                                <p className={`text-[10px] ${T.subtext}`}>{lead.contato_email || lead.contato_telefone || ''}</p>
                                                            </div>
                                                        ) : (
                                                            <span className={T.mutedIcon}>-</span>
                                                        )}
                                                    </td>
                                                    <td className={`p-3 font-medium ${T.rowText}`}>{lead.municipio || '-'}</td>
                                                    <td className="p-3">
                                                        <span className={`inline-block font-semibold px-2.5 py-1 rounded-full text-[10px] ${T.pillMuted}`}>
                                                            {lead.categoria}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 max-w-[200px]">
                                                        <p className={`line-clamp-2 ${T.rowText}`}>{lead.status || '-'}</p>
                                                    </td>
                                                    <td className={`p-3 font-mono ${T.subtext}`}>
                                                        {(() => {
                                                            const d = extractLeadDate(lead);
                                                            return d ? d.toLocaleDateString('pt-BR') : '-';
                                                        })()}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                                        {formatCurrency(lead.valor)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className={`p-8 text-center text-xs ${T.subtext}`}>
                                            Nenhum lead encontrado com os filtros aplicados.
                                        </td>
                                    </tr>
                                )}
```

Every `<td>` and its content is byte-for-byte the same as before — only the outer grouping (`gruposTabela.map` + the conditional header `<tr>`) is new. `React` is already imported as a default import at the top of this file (`import React, { useState, useEffect, useMemo } from 'react';`), so `React.Fragment` needs no new import.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npm run test`
Expected: both clean (this task touches no tested logic, only JSX wiring around an already-tested pure function).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/` → aba Cidades → aba Tabela (needs `GRCC_KEY`/dashboard data with at least two leads sharing a `cliente` value — e.g. via `/grcc` create two leads both named "Prefeitura de Limeira" first). Confirm:
- Clientes with 2+ chamados show one grouped header row ("Prefeitura de Limeira · 2 chamados") followed by their rows.
- Clients with exactly 1 chamado show no header row (unchanged from before).
- Filters (UF/categoria/busca) still narrow the table correctly, and grouping recalculates with the filtered set.
- Clicking a row still opens that lead's detail (`setLeadAbertoId`), unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/cidades/CidadesView.tsx
git commit -m "feat(cidades): agrupar por cliente na tabela da aba Cidades"
```
