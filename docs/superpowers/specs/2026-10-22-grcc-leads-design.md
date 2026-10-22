# GRCC — Leads sem Excel (página `/grcc`), pipeline gerado pelos leads e dashboard ao vivo

Data: 2026-10-22 · Branch: `debora` (a partir da `main`)

## Problema

A planilha Excel de leads da GRCC (gerência da Débora, gerente `grcc-debora`, role `GRCC`) alimenta o AIBertinho por
**dois caminhos**, e nenhum deles é bom:

1. **Aba Cidades — ao vivo via Power Automate.** `src/services/cidades.service.ts` (`fetchCidadesLeads`) faz `POST`
   numa URL de fluxo com `sig=` **hardcoded**; o arquivo não é `'use server'` e é chamado pelo `CidadesView`
   (`'use client'`), então a URL assinada vai para o bundle do navegador. Hoje são 131 linhas. Muito código só limpa
   sujeira do Excel: valor em vários formatos (`"R$ 4.239.525,60"`, `"1.259.218,14"`, vazio), data serial do Excel,
   linha-título "Propostas Perdidas", categorias com typo (`Em trataivas`, `Em tratatativas`, `validação`/`Validação`),
   e **`municipio = "#VALUE!"` em praticamente todas as linhas** (fórmula quebrada na planilha — o município é
   extraído por regex do nome do cliente).
2. **Pipeline da Débora — cópia manual.** Os 40 projetos de `grcc-debora` em `projects` são os mesmos leads,
   redigitados: 10 em `q3`/`quente` (os "No cliente", R$ 27,7 mi) e 30 em `q4`/`morno` com valor 0. A cópia já
   diverge (Palmas: planilha R$ 4.239.525,60, pipeline 4.329.525). Esse pipeline alimenta a visão geral da DRM
   (`DRMOverview`, `ForecastKpis`), card/cabeçalho/barras da Débora (`ManagerCard`, `ManagerHeader`,
   `PerformanceBars`, `PipelineBars`, `QuarterProjectsModal`), aba Projetos (`ProjectsTab`), o forecast pro-rata
   (`calc.ts` via `fetchManagersWithDetails`) e a API externa `/api/external/v1/data`.

Além disso, **nada no dashboard é ao vivo**: `DashboardShell` carrega gerentes uma vez no mount, `CidadesView`
carrega leads uma vez ao abrir a aba. Quem está com a tela aberta vê dado velho até dar F5.

## Objetivo

- **Visão da Débora (escrita)** — página `/grcc` protegida por `GRCC_KEY`: lista, cadastro, edição, exclusão,
  **importação de `.xlsx` com prévia** e **histórico** de cada lead.
- **Leads geram o pipeline da Débora** automaticamente — fim da cópia manual.
- **Tudo que consome esses dados atualiza ao vivo** (sem F5): aba Cidades, área da Débora, visão geral da DRM.

## Fases

- **Fase 1 — escrita + fonte única:** tabelas, `/grcc` completa, leads → pipeline, `fetchCidadesLeads()` lendo do
  banco, URL do Power Automate removida do código, troca (cutover) do pipeline manual.
- **Fase 2 — leitura ao vivo:** checagem de versão no dashboard (Cidades + gerentes), aviso "Atualizado agora",
  cabeçalho "Atualizado em … · último import" e botão "✎ Gerenciar leads" na aba Cidades, detalhe somente-leitura
  do lead com linha do tempo, bloco "Movimentações recentes" em leitura, estado vazio.

A Fase 1 já entrega números certos em todo lugar (ao recarregar); a Fase 2 os torna ao vivo.

## Onde cada mudança aparece

| Lugar | Fonte depois | Campos do lead que o mexem |
|---|---|---|
| Aba Cidades — KPIs, mapa UF/município, categorias, linha do tempo, perdas, tabela | `lead_grcc` | todos |
| Visão geral DRM — pipeline, forecast, novos negócios | `projects` gerados | categoria, valor, previsão, início/duração |
| Débora — card, cabeçalho, barras de desempenho e trimestre, modal do trimestre, aba Projetos | `projects` gerados | idem |
| API externa `/api/external/v1/data` | `projects` gerados | idem |
| `/grcc` — lista, painel, histórico, movimentações | `lead_grcc` + histórico | todos |

Não vêm da planilha e **não mudam**: propostas (11, `GRC-C`), contratos (3), CX, metas/`contratado`/clientes
atendidos da Débora, "Oportunidades em Risco" (`oportunidades-consolidado.json`).

**Fora do escopo** (depois que a `login` entrar na `main`): assistente de IA (`src/lib/ai/tools.ts`) e API de
plataforma (`RECURSOS_DO_DASHBOARD`/`ENTIDADES_DA_TABELA`). Como os leads geram `projects`, o assistente e a API já
enxergarão o pipeline da Débora por lá; expor o lead em si é o próximo passo.

## Acesso

- Env `GRCC_KEY`; componente `KeyGateGrcc` no padrão do `KeyGateStore`/`KeyGate` (chave lembrada no `localStorage`).
- **Toda Server Action de escrita recebe a chave e a confere no servidor** (`verificarChaveGrcc`). Chave inválida →
  erro, nada gravado. O gate de tela sozinho não protege.
- Leitura (dashboard) segue como hoje (`FrontendGate`).
- Merge com a `login`: a porta vira papel (gerente da GRCC + admin, `requireRole`/`canEditManager`) — a `login`
  proíbe key-gates novos, então a troca é obrigatória no merge; o resto não muda.

## Dados

### `lead_grcc`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | integer PK autoincrement | |
| `cliente` | text not null | |
| `solicitacao` | text not null default `''` | |
| `status` | text | texto livre, o "andamento" ("Proposta no cliente 17/03/26") |
| `categoria` | text not null default `'Novo'` | lista `grcc_categoria`; dirige a temperatura do projeto |
| `etapa` | text | lista `grcc_etapa` |
| `situacao` | text | lista `grcc_situacao` |
| `motivo_perda` | text | lista `grcc_motivo`; obrigatório quando categoria = `Perda` |
| `familia_demanda` | text | lista `grcc_familia` |
| `valor` | real not null default 0 | |
| `uf` | text | 2 letras maiúsculas |
| `municipio` | text | deve existir em `src/data/municipios-geo.json` para a UF |
| `regiao` | text | |
| `contato_nome`, `contato_email`, `contato_telefone` | text | |
| `previsao_fechamento` | text | `YYYY-MM-DD`; dirige o trimestre do projeto |
| `inicio_faturamento` | text | `YYYY-MM-DD`; só para `Contratado` (pro-rata 2026) |
| `duracao_meses` | integer not null default 12 | só relevante para `Contratado` |
| `criado_em`, `atualizado_em` | text ISO not null | |
| `excluido_em` | text | soft delete |

Categorias (lista inicial, normalizando o que existe na planilha): `Novo`, `Validação`, `Parceiro`,
`Em tratativas`, `No cliente`, `Contratado` (nova — a planilha não tinha como registrar ganho), `Perda`.
Na importação, typos são normalizados (`Em trataivas`/`Em tratatativas` → `Em tratativas`, `validação` →
`Validação`); vazio ou "Sem classificação" → `Novo`. Etapa/situação/motivo/família: listas em `dropdown_options`
(`field` = `grcc_etapa` etc.) semeadas com os valores distintos da primeira importação; valor novo num import entra
na lista.

**Chave de casamento** (importação): `cliente` + `solicitacao` normalizados (trim, caixa, acentos, espaços). Duas
linhas da mesma planilha com a mesma chave → ambas em "com problema" (duplicada).

### `lead_grcc_historico` (somente acréscimo)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | integer PK autoincrement | |
| `lead_id` | integer not null → `lead_grcc.id` | |
| `quando` | text ISO not null | |
| `origem` | text not null | `cadastro` \| `edicao` \| `importacao` \| `exclusao` |
| `arquivo` | text | nome do `.xlsx` quando `importacao` |
| `autor` | text not null | sempre `'GRCC'` (chave compartilhada) |
| `mudancas` | text JSON not null | `[{campo, de, para}]`; vazio em `exclusao` |

- **Uma gravação = um evento** com todos os campos alterados; gravação sem mudança real não gera evento.
- Nada atualiza nem apaga histórico. Excluir lead = `excluido_em` + evento `exclusao`.
- Cadastro (tela ou import) gera evento com os campos preenchidos (`de: null`).

### `projects` — coluna nova `lead_grcc_id`

`integer`, nullable, unique, → `lead_grcc.id`. Projeto com `lead_grcc_id` é **gerado** (dono = `/grcc`).

### `system_settings` — chaves novas

- `grcc_versao` — inteiro, +1 a cada gravação na `/grcc` (base do ao vivo).
- `grcc_ultimo_import` — `{arquivo, quando, novos, alterados}`.

## Leads → pipeline da Débora

Na **mesma transação** de toda gravação de lead (salvar, excluir, importar), `sincronizarProjetoDoLead` cria,
atualiza ou remove o projeto ligado. Função pura de mapeamento em `src/lib/grcc/pipeline.ts`:

| Campo do projeto | Origem |
|---|---|
| `manager_id` | gerente com `role = 'GRCC'` do ano corrente (hoje `grcc-debora`, 2026); sem gerente → erro claro, nada gravado |
| `orgao` | `cliente` |
| `name` | `solicitacao` (vazio → `"Lead GRCC"`) |
| `value` | `valor` |
| `description` | `status` (andamento) |
| `temperature` | `No cliente` → `quente` · `Em tratativas`/`Validação`/`Parceiro` → `morno` · `Novo` → `frio` · `Contratado` → `contratado` · `Perda` → `perdido` |
| `quarter` | trimestre de `previsao_fechamento` se o ano = ano do gerente; senão/sem data → `nao_mapeado` |
| `start_date` | `inicio_faturamento` (só `Contratado`) |
| `duration_months` | `duracao_meses` |

- Lead excluído → projeto ligado é apagado.
- Categoria desconhecida (não deveria ocorrer, validação barra) → `frio`.
- **Editor de pipeline** (`/settings`, `PipelineEditor`/`QuarterEditor`): projetos com `lead_grcc_id` aparecem com
  selo "Gerenciado pela GRCC" e link para `/grcc`, sem edição/exclusão ali. Hoje `saveManagerData`
  (`src/app/settings/actions.ts`) faz `delete(projects) where manager_id` e reinsere tudo, e o `PATCH`
  `/api/external/v1/grc/sync` também apaga projetos — os dois passam a **ignorar projetos com `lead_grcc_id`**
  (não apagam, não sobrescrevem; o que vier do editor/API para eles é descartado). `cloneManager` copia projetos
  **sem** `lead_grcc_id` (a coluna é unique; o clone vira projeto manual).
- Projetos manuais da Débora que não vêm de lead continuam editáveis normalmente.

### Troca do pipeline manual (cutover)

Na **primeira importação** (tabela `lead_grcc` vazia), a prévia mostra um bloco extra: "Pipeline da Débora: os
40 projetos digitados à mão serão substituídos por N projetos gerados dos leads", com a lista dos 40. Ao confirmar,
na mesma transação, os projetos de `grcc-debora` **sem** `lead_grcc_id` são apagados e os gerados entram. Sem
confirmação explícita desse bloco o botão "Gravar" fica desabilitado. Antes, o script `db:sync-prod`/backup é
recomendado no plano de implantação.

## Visão da Débora — `/grcc`

- **Cabeçalho:** "GRCC · Leads", botões **⇪ Importar Excel** e **+ Novo lead**, link "Ver como leitor →" (dashboard,
  aba Cidades). Resumo: nº de leads, pipeline (sem perdas), "⚠ N pendências".
- **Chips de filtro:** Todos · uma por categoria (com contagem) · **⚠ Pendências** (sem UF, sem município, valor 0,
  sem previsão — `Perda` não exige previsão; `Contratado` exige início do faturamento). Busca por
  cliente/solicitação/município.
- **Tabela:** Cliente + "Município · UF", Solicitação, Categoria (chip com a temperatura que gera no pipeline),
  Etapa, Valor, Previsão, "Atualizado há…". ⚠ na linha com pendência. Clique → painel lateral.
- **Painel lateral** (Shadcn `Sheet`), abas **Dados** e **Histórico (n)**:
  - Dados: Cliente*, Solicitação*, UF* (select), Município* (combobox filtrado pela UF, de `municipios-geo.json`),
    Categoria/Etapa/Situação/Família (selects), **Motivo da perda** (só se `Perda`, obrigatório), **Início do
    faturamento + Duração** (só se `Contratado`, início obrigatório), Valor (R$, máscara pt-BR), Previsão, Andamento
    (status, texto), Contato. Linha informativa: "No pipeline da Débora: Q4 · morno". Rodapé: **Excluir**
    (confirmação inline, sem `confirm()`) e **Salvar**.
  - Histórico: linha do tempo, mais recente primeiro: data/hora · autor · origem (tela / importação + arquivo).
    Categoria/etapa/situação/motivo em chip colorido "de → para"; valor e previsão em texto; demais recolhidos em
    "+N alterações".
- **Movimentações recentes:** últimos 15 eventos de todos os leads; clique abre o painel do lead.

## Importação de Excel (3 passos)

1. **Arquivo:** arrastar/escolher `.xlsx`; leitura **no navegador** com `read-excel-file`.
2. **Prévia** (nada gravado): "<arquivo> · N linhas lidas"; abas **Novos**, **Alterados** (diff campo a campo),
   **Iguais**, **⚠ Com problema** (linha + motivo: valor ilegível, UF inválida, município não achado na UF,
   duplicada, cliente vazio); bloco de cutover na primeira importação. Linhas-título e vazias são puladas sem aviso.
   Município `#VALUE!` → extraído do cliente; se ainda assim não achar, a linha entra com município vazio e
   aparece em Pendências (não bloqueia).
3. **Confirmar:** o navegador envia as linhas já mapeadas; o **servidor reclassifica** e grava tudo numa transação:
   leads novos/alterados, um evento `importacao` por lead tocado, projetos sincronizados, `grcc_versao` +1,
   `grcc_ultimo_import`. Toast "4 novos, 7 atualizados".

Import nunca exclui leads ausentes da planilha. Colunas obrigatórias ausentes → erro antes da prévia.

### Mapeamento de colunas

Por **nome de cabeçalho** normalizado (sem acento, minúsculo, sem pontuação) com aliases — não por posição. Ponto
de partida = colunas que o fluxo devolve hoje (`cliente, solicitacao, status, categoria, valor, uf, municipio,
regiao, contato_nome, contato_email, contato_telefone, previsao_fechamento, categoria_padrao, etapa_padrao,
situacao_padrao, motivo_padrao, familia_demanda, solicitacao_padrao`). **Os aliases são fechados contra o `.xlsx`
real no passo 1 do plano** (o fluxo renomeia colunas; os nomes de cabeçalho da planilha podem diferir).

| Campo | Aliases iniciais |
|---|---|
| cliente | cliente |
| solicitacao | solicitacao |
| status | status, andamento |
| categoria | categoria padrao, categoria |
| etapa | etapa padrao, etapa |
| situacao | situacao padrao, situacao |
| motivo_perda | motivo padrao, motivo, motivo da perda |
| familia_demanda | familia demanda, familia da demanda |
| valor | valor |
| uf / municipio / regiao | uf / municipio / regiao |
| contato_* | contato nome, contato email, contato telefone |
| previsao_fechamento | previsao fechamento, previsao de fechamento |

Obrigatórias no cabeçalho: `cliente`, `valor`, `uf`. Normalização de valor/data/município reaproveita a lógica de
`cidades.service.ts`, que se move para `src/lib/grcc/planilha.ts`.

## Ao vivo (Fase 2)

Vercel serverless + Turso sem feed de mudanças → sem WebSocket/SSE. **Checagem de versão:**

- Server Action `versaoGrcc()` lê só `grcc_versao` (consulta mínima).
- Hook `useVersaoGrcc` no `DashboardShell`: consulta a cada **15 s** com a aba visível, **na hora** ao voltar o foco
  (`visibilitychange`/`focus`), **pausa** com a aba escondida.
- Versão mudou → `DashboardShell` refaz `fetchDashboardManagers()` e o `CidadesView` refaz `fetchCidadesLeads()`
  **sem desmontar**: filtros, busca, gerente/ano selecionados, aba e scroll preservados (a troca de dados é um
  `setState`, não um remount). Aviso discreto "Atualizado agora · N leads alterados"; linhas alteradas destacadas
  por ~3 s.
- **Mesmo computador:** a `/grcc` publica no `BroadcastChannel('grcc')` após cada gravação → abas do dashboard
  abertas no mesmo navegador atualizam na hora, sem esperar os 15 s.
- Falha na checagem → silenciosa, tenta no próximo ciclo; nunca mostra erro por isso.

Resultado: mesmo computador = na hora; outras máquinas = até ~15 s.

## Visão de leitura — aba Cidades

- Fase 1: `fetchCidadesLeads()` vira `'use server'`, lê `lead_grcc` (sem excluídos) e devolve o mesmo `LeadCidade`
  (os `*_padrao` são preenchidos de `categoria`/`etapa`/`situacao`/`motivo_perda`/`familia_demanda`), então
  `CidadesView` e `BrazilHeatMap` não mudam. URL do Power Automate apagada.
- Fase 2: cabeçalho "Atualizado em … · último import: <arquivo>", botão "✎ Gerenciar leads" → `/grcc`, detalhe
  somente-leitura com linha do tempo ao clicar na linha, "Movimentações recentes" em leitura, estado vazio com link.

## Arquitetura

- `src/db/schema.ts` — `leadGrcc`, `leadGrccHistorico`, `projects.leadGrccId`; migração
  `src/db/migrations/0013_lead_grcc.sql`.
- `src/db/queries.ts` — `listLeadsGrcc`, `getLeadGrcc`, `salvarLeadGrcc`, `excluirLeadGrcc`, `aplicarImportGrcc`,
  `fetchHistoricoLead`, `fetchMovimentacoesRecentes`, `lerVersaoGrcc`. Toda escrita = uma transação: lead +
  histórico + projeto + `grcc_versao`.
- `src/lib/grcc/` (puro, sem banco):
  - `diff.ts` — antes/depois → `mudancas`.
  - `planilha.ts` — linhas cruas → leads normalizados + problemas por linha; aliases de cabeçalho.
  - `previa.ts` — planilha × banco → novos/alterados/iguais/problemas.
  - `validacao.ts` — `zod` (motivo em `Perda`, início em `Contratado`, UF, município na UF, e-mail).
  - `pipeline.ts` — lead → campos do projeto (tabela de mapeamento acima).
- `src/app/grcc/` — `page.tsx`, `KeyGateGrcc.tsx`, `actions.ts` (`verificarChaveGrcc`, `salvarLead`,
  `excluirLead`, `confirmarImportacao`, `buscarHistorico`; todas checam a chave; `revalidatePath('/grcc')` e `'/'`),
  `components/` (`LeadsGrccTable`, `LeadPainel`, `LeadHistorico`, `ImportarExcelDialog`, `MovimentacoesRecentes`).
- `src/services/cidades.service.ts` — lê do banco; `src/services/grcc.service.ts` — `versaoGrcc()`.
- `src/hooks/useVersaoGrcc.ts` — checagem + `BroadcastChannel`.
- `src/components/dashboard/DashboardShell.tsx`, `src/components/cidades/CidadesView.tsx` — recarga sem remount.
- `src/app/settings/` (editor de pipeline, `saveManagerData`, `cloneManager`) e
  `src/app/api/external/v1/grc/sync/route.ts` — selo "Gerenciado pela GRCC" e preservação dos gerados.
- Dependência nova: `read-excel-file`.

## Erros

- Chave inválida → ação recusa, nada gravado; o gate volta a pedir a chave.
- Validação falha → mensagens por campo no painel, nada gravado.
- Gerente `GRCC` do ano corrente não encontrado → erro claro na gravação, nada gravado.
- Planilha sem colunas obrigatórias → erro antes da prévia, listando quais.
- Linha com problema → só na prévia; as demais seguem.
- Falha no meio de qualquer gravação → transação desfeita, nada parcial.
- Banco indisponível na aba Cidades → estado de erro atual com texto novo (sem citar Power Automate).
- Checagem de versão falha → silenciosa.

## Testes (vitest, co-localizados)

- `diff.test.ts` — sem mudança = vazio; campos alterados; null ↔ valor.
- `planilha.test.ts` — aliases, coluna obrigatória ausente, valores BRL (`"R$ 4.239.525,60"`, `"1.259.218,14"`,
  vazio), datas (serial/barra/ISO), linha-título, typos de categoria, `#VALUE!`.
- `previa.test.ts` — novo/alterado/igual/duplicado/problema; chave normalizada.
- `validacao.test.ts` — motivo em `Perda`, início em `Contratado`, UF/município.
- `pipeline.test.ts` — cada categoria → temperatura; previsão → trimestre (mesmo ano, outro ano, sem data).
- `src/app/grcc/actions.test.ts` (banco em memória, migrações reais) — recusa sem chave; salvar gera um evento,
  sincroniza o projeto e incrementa `grcc_versao`; salvar sem mudança não gera evento; excluir = soft delete +
  evento + projeto removido; importação reclassifica no servidor, mantém leads ausentes, grava histórico com o
  arquivo; cutover só apaga projetos sem `lead_grcc_id` da Débora e só com confirmação.
- `src/app/settings/actions` — `saveManagerData` da Débora preserva projetos gerados; `cloneManager` não copia
  `lead_grcc_id`. `grc/sync` — `PATCH` não apaga projetos gerados.
- `cidades.service` — leitura do banco devolve `LeadCidade` com `*_padrao` preenchidos, sem excluídos.
- `useVersaoGrcc` (`// @vitest-environment jsdom`) — chama recarga só quando a versão muda; pausa com aba oculta;
  reage ao `BroadcastChannel`.
