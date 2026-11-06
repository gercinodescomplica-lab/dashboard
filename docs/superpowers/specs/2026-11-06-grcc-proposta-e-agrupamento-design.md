# GRCC — data de envio da proposta (temperatura automática) e agrupar chamados por cliente

Data: 2026-11-06 · Branch: `debora` (ou a corrente, a partir da `main`) · módulo: `/grcc` e aba Cidades

## Problema

Dois ajustes pedidos no cadastro de leads da GRCC (`lead_grcc`, `/grcc`):

1. **Temperatura não acompanha o envio da proposta.** Hoje `temperatura` é escolhida à mão (quente/morno/frio) ou,
   se vazia, segue a `categoria` (`temperaturaDaCategoria`, `src/lib/grcc/pipeline.ts`). Não existe nenhum registro
   de "a proposta foi enviada em tal data" — então não há como o lead esfriar automaticamente quando o cliente não
   responde.
2. **Mesmo cliente cria várias linhas soltas.** `cliente` é texto livre. Vários chamados do mesmo município (ex.:
   "Limeira") entram como linhas separadas e repetidas nas listas (`/grcc`, aba Cidades), sem nenhum agrupamento
   visual — fica parecendo gente nova a cada chamado.

## Fora do escopo (confirmado com o usuário)

- Nenhum campo existente é removido, renomeado ou tem seu significado alterado.
- Não cria tabela nem FK para um "cliente pai" da GRCC: cada chamado continua com UF, município, contato,
  categoria, valor, temperatura e previsão **próprios**, editados separadamente. O agrupamento é só visual.
- Não liga ao cadastro central de `cliente` (carteira/organograma) — fica independente, só dentro da GRCC.
- `BrazilHeatMap` e `contarCidades` já agrupam por município, não por cliente — não mudam.

## Parte 1 — Data de envio da proposta → temperatura automática

**Campo novo:** `propostaEnviadaEm` (data `YYYY-MM-DD`, opcional) em `lead_grcc`. Igual aos outros campos de data do
lead (`previsaoFechamento`, `inicioFaturamento`): mesma validação (`dataOpcional` em `src/lib/grcc/validacao.ts`),
mesmo tratamento em diff/histórico/exportação/importação.

**Regra de temperatura** (`temperaturaDoLead`, `src/lib/grcc/pipeline.ts`), nessa ordem — nada do que já existe
muda de posição na prioridade, só entra um passo novo entre "manual" e "automático pela categoria":

1. `categoria` é `Contratado` ou `Perda` → temperatura fixa da categoria (**como hoje**, sem alteração).
2. `temperatura` preenchida à mão → vale ela (**como hoje**, sem alteração).
3. **Novo:** `temperatura` vazia (automático) e `propostaEnviadaEm` preenchida → `quente` se faz menos de 2 meses
   corridos da data; `morno` se faz 2 meses ou mais.
4. `temperatura` vazia e sem `propostaEnviadaEm` → cai no automático de sempre (`temperaturaDaCategoria`, **como
   hoje**).

"2 meses corridos" = `propostaEnviadaEm` + 2 meses de calendário (não 60 dias fixos), comparado à data de hoje.

**Fechar a espera:** ao salvar uma edição em que `etapa` ou `situação` mudou de valor, `propostaEnviadaEm` é
zerada (fica `null`) nesse mesmo salvamento — critério escolhido: só uma mudança real de etapa/situação conta como
"o cliente retornou". Isso entra junto com o cálculo de diff que `salvarLeadGrcc` já faz para o histórico
(`src/lib/grcc/diff.ts` / `src/db/queries.ts`); se o mesmo salvamento também trouxer uma nova `propostaEnviadaEm`
explícita (reenvio), essa data nova prevalece — só zera quando a edição não trouxe data nova.

**Onde mais entra o campo** (mesmo tratamento que qualquer outro campo do lead, nada especial):

- `src/lib/grcc/tipos.ts`: `LeadGrccDados.propostaEnviadaEm`; `CAMPOS_LEAD`; `ROTULO_CAMPO` ("Data de envio da
  proposta"); `CAMPOS_COMERCIAIS` (entra na timeline comercial do histórico); `LEAD_VAZIO`.
- `src/lib/grcc/planilha.ts`: coluna opcional na importação (aliases tipo "data de envio", "envio da proposta").
- `src/lib/grcc/exportar.ts`: coluna no Excel exportado.
- `src/app/grcc/components/LeadPainel.tsx`: campo de data no formulário, perto de "Previsão de fechamento".
- Badge de temperatura em `LeadsGrccTable`/`LeadPainel`/Cidades já lê de `temperaturaDoLead` — não precisa de UI
  nova além do campo de data; o resultado (quente/morno) já aparece onde já aparece hoje.

Sem cron: a "idade" da data é calculada no momento da leitura (igual todo o resto do app — ver `pullPlannerIfStale`/
espelho no `CLAUDE.md`), então não precisa de job nenhum rodando sozinho.

## Parte 2 — Agrupar chamados do mesmo cliente (ex.: "Limeira")

Sem mudança de schema, sem tabela nova. Dois ajustes, os dois só de exibição:

**2.1 — Autocomplete no campo Cliente.** Em `LeadPainel.tsx`, o campo "Cliente" passa a sugerir nomes já usados,
calculados a partir dos leads já carregados na tela (`Array.from(new Set(leads.map(l => l.cliente)))`, sem query
nova), via `Combobox` (`src/components/ui/`, já existe no projeto). Reduz o risco de digitar "Limeira" com variação
e criar duplicata por acidente; não impede digitar um nome novo.

**2.2 — Agrupar por Cliente nas listas**, nos três lugares que hoje listam leads soltos repetindo o nome do
cliente:

1. `src/app/grcc/components/LeadsGrccTable.tsx` — lista principal do `/grcc`. Agrupa as linhas por `cliente`:
   cabeçalho "Limeira (3)" e os chamados daquele cliente embaixo, em vez de 3 linhas soltas repetindo "Limeira".
2. `src/components/cidades/CidadesView.tsx` — aba Tabela (`filteredLeads.map`, por volta da linha 1212). Mesmo
   agrupamento por `cliente`, mantendo os filtros (UF/categoria/busca) e a ordenação que já existem.
3. `src/components/cidades/IndicadorModal.tsx` — modal de indicador (drill-down ao clicar num número/stat). Esse
   componente já tem um agrupamento (`grupos`, ex. por UF) vindo de fora; o agrupamento por cliente entra **dentro**
   de cada grupo existente, como um sub-nível — não substitui o agrupamento atual.

Cada grupo mostra contagem e soma de valor (padrão já usado no `IndicadorModal`: "N · R$ soma"). Dentro do grupo,
cada chamado aparece como hoje aparece (mesmas colunas/linha), só reorganizado visualmente.

**O que não muda:** `cliente` continua texto livre e único campo (não vira FK, não ganha "cliente pai"); valor,
categoria, temperatura, previsão continuam por chamado; pipeline, Cidades (mapa/KPIs/indicadores),
histórico, exportação e importação continuam lendo cada chamado individualmente, exatamente como hoje — o
agrupamento é só a camada de exibição dessas três listas.

## Testes

- `src/lib/grcc/pipeline.test.ts`: casos novos de `temperaturaDoLead` com `propostaEnviadaEm` — antes de 2 meses
  (quente), depois de 2 meses (morno), sem a data (comportamento atual preservado), `Contratado`/`Perda` ainda
  fixos, `temperatura` manual ainda prevalecendo.
- `src/lib/grcc/validacao.test.ts` (se existir validação de datas centralizada) ou teste direto do schema: aceita
  `propostaEnviadaEm` ausente/vazia/válida, recusa data impossível (mesmo padrão de `previsaoFechamento`).
- `src/lib/grcc/diff.test.ts`: edição que muda `etapa`/`situação` zera `propostaEnviadaEm` no diff resultante;
  edição que não muda etapa/situação preserva a data.
- Agrupamento (2.2): se houver teste de unidade para a função de agrupar (extraída como helper puro, testável sem
  DOM), cobre: leads do mesmo cliente caem no mesmo grupo; grupo único quando não há repetição; ordem estável.

## Migração

Uma migração nova em `src/db/migrations/`: `ALTER TABLE lead_grcc ADD COLUMN proposta_enviada_em text;` (nullable,
sem default) — gerada via `drizzle-kit` a partir da mudança em `src/db/schema.ts`. Sem backfill: leads existentes
ficam com a coluna vazia e continuam no comportamento automático de hoje até alguém preencher a data.
