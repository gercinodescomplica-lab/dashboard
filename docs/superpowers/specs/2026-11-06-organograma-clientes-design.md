# Organograma de clientes no dashboard (porte do AIBertinho)

Data: 06/11/2026. Branch: `feat/organograma-clientes`, criada de `origin/main` (`6193fff`) — **a base é o que está em
produção**, não a branch `login` (361 commits fora de produção: login/`users`, CX Planner, API de plataforma).

Pedido do usuário: trazer para o dashboard o organograma de clientes do AIBertinho **igual** — como é montado, como o
admin cadastra, como aparece e como mover um cliente leva junto contratos, propostas, CX e oportunidades, em todos os
lugares. "Não inventar nada": cada peça aponta a origem no AIBertinho e onde liga no dashboard de produção.

Referências do AIBertinho (`C:\projeto\aibertinho`):
- `docs/superpowers/specs/2026-11-04-organograma-clientes-design.md` (a tela)
- `docs/superpowers/specs/2026-11-04-gerencia-sem-dono-varredura.md` (a troca leva tudo; decisões §6)
- `src/modulos/gerencias/regras/organograma-clientes.ts`, `servidor/organograma-clientes.ts`, `servidor/servico.ts`
  (`moverClientes`), `servidor/carteira.ts` (`alterarCarteira`), `servidor/levar-cliente.ts` (`levarDadosDoCliente`,
  `cardDaGerencia`, `gerenciaDoComercialPelaCarteira`), `servidor/acoes.ts`, `componentes/organograma-clientes*.tsx`.

O spec do AIBertinho dizia "o dashboard antigo fica de fora". Este porte é decisão nova do usuário (06/11/2026).

## 1. Decisões (todas do usuário, 06/11/2026, uma a uma)

| # | Decisão | Efeito |
|---|---|---|
| D1 | Copiar o organograma de clientes do AIBertinho, mesmo comportamento | Seções 4 a 8 |
| D2 | Ao mudar de carteira, **tudo** do cliente vai junto, em todos os lugares | Seção 5 |
| D3 | A gerência é a que o dashboard já tem: o card `managers`. Sem tabela de gerência nova | Seção 2 |
| D4 | Cliente vira entidade (`cliente`) e as linhas ganham `cliente_id`, como o `clienteId` do AIBertinho | Seções 3 e 4 |
| D5 | A carteira guarda a **sigla** da gerência (`GRC4`), não o id do card; trocar a sigla atualiza tudo junto | Seções 3 e 8.2 |
| D6 | **Só o admin** muda a carteira. O gerente não edita | Seções 5 e 6 |
| D7 | Construir sobre a `main` (produção), branch nova | Este spec |
| D8 | Mover **só em `/settings`** (atrás da `SETTINGS_KEY`); o organograma do dashboard público é só leitura | Seção 8 |
| D9 | Projeto gerado por lead da GRCC (`projects.lead_grcc_id`) **fica na GRCC** | Seção 5 |
| D10 | Gerência oculta não recebe cliente e só pode ser ocultada sem clientes; **o admin pode ocultar cliente** | Seções 2 e 8.2 |
| D11 | Cliente oculto some do organograma e das contagens, **mas continua na carteira** (os dados seguem a gerência); "Mostrar" faz voltar | Seções 3 e 8 |
| D12 | A carga inicial **não move dado nenhum**; o que hoje está fora da carteira é listado e o admin decide | Seção 4 |
| D13 | "Clientes atendidos" no editor do card (`ManagerEditor`) vira **leitura + link** para o organograma | Seção 6 |
| D14 | Corrigir nesta branch as actions do `/settings` que gravam sem conferir a `SETTINGS_KEY` no servidor | Seção 7 |

## 2. Gerência em produção (o que já existe)

Banco de produção (Turso, lido só com SELECT em 06/11/2026), todos os cards de 2026:

| card (`managers.id`) | `role` | `name` | visível | carteira hoje (`served_clients`) |
|---|---|---|---|---|
| grc1-bruno | GRC1 | Bruno Ítalo | sim | PGM, SMCC, SMIT, SMSUB, SPNegócios, SEME, SMDET |
| grc2-paulo | GRC2 | Paulo Rogério | sim | SEHAB, SMADS, SMUL, SMC |
| grc3-barone | GRC3 | Barone | sim | COHAB, EMASP, FPETC, IPREM, SMDHC, SMPED, SMRI, SMTUR, SPDA, SPOBRAS, SPURBANISMO, SMT |
| grc4-beatriz | GRC4 | Beatriz | sim | ADESAMPA, CGM, CMSP, FTM, HSPM, Ouvidoria Geral do Município, SERI, SMJ, SMSU, SPCINE, SPREGULA, SPTURIS, SIURB, TCM, SVMA |
| grcc-debora | GRCC | Débora | sim | SES PE |
| kam1-malde | KAM1 | Malde | sim | SME |
| kam2-betone | KAM2 | Betone | sim | SMS |
| kam3-andrea | KAM3 | Andrea | sim | SEGES |
| kam4-tomiatto | KAM4 | Tomiatto | sim | SF, SGM |
| kam3-gercino-teste | KAM10 | Gercino (teste) | não | SEGES (duplica a KAM3) |
| projeto-triade | Tríade Digital | Tríade Digital | não | — |

- `contrato` e `proposta` guardam a gerência em texto `GRC-1`/`GRC-C`/`KAM-4` (lista `GERENCIAS` em
  `ContractsTable.tsx`/`ProposalsTable.tsx`) **e** `manager_id`; hoje 100 contratos e 71 propostas, texto = card.
- `cx`, `projects`, `visits`, `churn` e `whatsapp_users` guardam só `manager_id`.
- O admin cria, edita e clona card em `/settings` (`saveManagerData`, `cloneManager`, `ManagerEditor`).
- Não há login: o admin é quem tem a `SETTINGS_KEY` (`KeyGate`, guardada no `localStorage` `SETTINGS_KEY`;
  `verifySettingsKey` aceita `SETTINGS_KEY`, `DIRETORIA_KEY` e `DIRECTORATE_KEY`).

**Regras desta feature:**

- **Chave da gerência** = `chaveDaGerencia(role) ?? chaveDaGerencia(id) ?? role.trim()`. `GRC1`, `GRCC`, `KAM10`,
  `Tríade Digital`. `chaveDaGerencia`, `siglaComparavel`, `mesmaSigla`, `clienteAtendido`, `citaSigla` vêm para
  `src/lib/integracao/chaves.ts` — **cópia idêntica** do arquivo de mesmo caminho da branch `login` (que já é cópia do
  VerAI/AIBertinho), com os mesmos testes, para a fusão futura não conflitar.
- **Card da gerência** (= `cardDaGerencia`): entre os cards daquela chave, os do maior `year`; desses, o primeiro com
  `show_in_dashboard`, senão o primeiro por `id`.
- **Texto da gerência** em `contrato.gerencia`/`proposta.gerencia`: `GRC1` → `GRC-1`, `GRCC` → `GRC-C`, `KAM4` → `KAM-4`;
  chave fora do padrão GRC/KAM vai como está. Mesmo formato dos dados de hoje.
- **Nome do cartão** = `name` do card da gerência (o AIBertinho junta os membros `manager`; aqui o card tem um nome só).
- **Gerência oculta** (D10) = card da gerência com `show_in_dashboard = 0`: não recebe cliente; só aparece no organograma
  se ainda tiver cliente; só pode ser ocultada sem clientes na carteira.

## 3. Banco — `src/db/migrations/0017_carteira_clientes.sql`

Produção aplica migração pelo nome do arquivo na tabela `_migrations` (`migrate.ts`); a última aplicada é
`0016_lead_grcc_temperatura.sql`.

```
cliente
  id          text PK            (crypto.randomUUID)
  nome        text not null
  sigla       text null          (como aparece: 'SPNegócios'); unicidade por siglaComparavel na gravação
  ativo       integer bool not null default 1   (D11: 0 = oculto no organograma)
  created_at  text not null

carteira_cliente                 (1 cliente = no máximo 1 gerência; sem linha = "Sem carteira")
  cliente_id     text PK -> cliente.id on delete cascade
  gerencia       text not null   (chave: 'GRC4')
  movido_em      text not null
  movido_por     text null       (rótulo de quem moveu; sem login em produção: 'Admin')
  index (gerencia)

movimento_carteira               (trilha; de/para são chaves, resolvidas para nome na leitura)
  id             integer PK autoincrement
  cliente_id     text not null -> cliente.id on delete cascade
  de_gerencia    text null
  para_gerencia  text null
  por            text null
  em             text not null
  index (cliente_id)

contrato.cliente_id, proposta.cliente_id, cx.cliente_id, projects.cliente_id
  text null -> cliente.id on delete set null, com índice
```

A carteira guarda a **chave** (D5): o card muda por ano (`cloneManager`), a gerência não. Schema em `src/db/schema.ts`.
`movido_por`/`por` são texto porque produção não tem `users`; quando a `login` entrar, viram o nome do usuário.

## 4. Carga inicial — `scripts/carteira/seed-carteira.ts`

Roda uma vez com `npx tsx` (lê `.env` como os outros scripts), idempotente. Ordem:

1. **Clientes das carteiras.** Cada item de `served_clients` de cada card passa por `clienteAtendido` (sigla + nome) e
   vira `cliente` (casado por `siglaComparavel`). A `carteira_cliente` aponta para a chave da gerência do card. Sigla em
   duas gerências: fica na gerência de card visível; empate entra no relatório. Hoje: SEGES fica com KAM3.
2. **`cliente_id` nas linhas.** Em `contrato.cliente`, `proposta.cliente`, `cx.cliente` e `projects.orgao`, a regra
   `clienteCitado` (cópia de `src/lib/integracao/feed.ts` da `login`, em `src/lib/carteira/casar-cliente.ts`): sigla
   igual, `citaSigla` (sigla em maiúsculas no texto, ex. "Procuradoria Geral do Município - PGM") ou nome por extenso
   igual; primeiro entre os clientes da carteira do card da linha, depois entre todos. Grava só quando o cliente é único.
   **Projetos com `lead_grcc_id` ficam de fora** (D9: o dono é a `/grcc`; hoje são os 103 da GRCC).
3. **Texto que não casou** vira `cliente` novo (nome = texto; `sigla` = o texto quando é uma palavra só em maiúsculas),
   sem carteira, e a linha recebe o `cliente_id`. Esses clientes aparecem em "Sem carteira" e o admin liga, junta ou oculta
   (seção 8.2, aba "A conferir").
4. **Relatório** no console. **A carga não move dado nenhum** (D12).

Produção hoje (casamento só por sigla exata; `citaSigla`/nome por extenso casam mais): contrato 92/100, proposta 27/71,
cx 263/270, projects manuais 61/79. Fora da carteira hoje — a carteira já mudou e os dados ficaram (D12):

| Cliente | Carteira (`served_clients`) | Onde estão os dados |
|---|---|---|
| SEME | GRC1 | 4 contratos + 1 CX na GRC4 |
| SMDET | GRC1 | 3 contratos + 2 CX + 1 projeto na GRC2 |
| SMC | GRC2 | 2 contratos na GRC4 |
| SVMA | GRC4 | 3 contratos na GRC1 |

## 5. Mover um cliente — "leva tudo"

Server Action `moverClienteNoOrganogramaAction(chave, clienteId, de, para)` em `src/app/settings/carteiraActions.ts`
(`de`/`para` = chave da gerência ou `null` = sem carteira). Igual ao AIBertinho:

1. Confere a `SETTINGS_KEY` no servidor (seção 7), senão `Só o administrador move clientes entre carteiras.`; entrada
   validada com `zod`.
2. `de === para` → `{ movidos: 0 }`.
3. `moverClientes([clienteId], para, 'Admin', { [clienteId]: de })` em `src/db/queries.ts`:
   - destino precisa existir (`Gerência não encontrada.`) e estar visível (`Gerência desativada não recebe clientes.`);
   - carteira atual ≠ `de` → `Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.`;
   - numa transação: upsert em `carteira_cliente` (ou delete se `para = null`), `levarDadosDoCliente` (só com destino),
     uma linha em `movimento_carteira`.
4. `revalidatePath('/')` e `revalidatePath('/settings')`.

`levarDadosDoCliente(tx, clienteIds, paraGerencia, por)` — card destino = `cardDaGerencia(paraGerencia)`:

| Tabela | O que muda (onde `cliente_id` ∈ clientes movidos) | No AIBertinho |
|---|---|---|
| `contrato` | `manager_id` = card, `gerencia` = texto da gerência, `nome_gerente` = `name` do card | `comercialContrato` |
| `proposta` | `manager_id` = card, `gerencia` = texto da gerência | `comercialProposta` |
| `cx` | `manager_id` = card | `comercialCx` |
| `projects` sem `lead_grcc_id` | `manager_id` = card; acrescenta em `history` `{ date, tipo: 'nota', de: <chave antiga>, para: <chave nova>, justificativa: 'O cliente mudou de carteira', autor: por }` | `Oportunidade` + histórico |
| `projects` com `lead_grcc_id` | nada (D9) | oportunidade de origem GRCC fica |
| `visits`, `churn`, `whatsapp_users` | nada: não têm cliente | `comercial_visits`/`comercial_churn` também não mudam |

Tirar da carteira (`para = null`) não mexe nos dados, como no AIBertinho.

`AVISO_LEVA_TUDO`: "Tudo do cliente vai junto para a nova gerência: contratos, propostas, oportunidades do pipeline e
cards do CX. A troca fica registrada no histórico."

Também do AIBertinho, usado pelo editor do admin (seção 8.2): `alterarCarteira(gerencia, { adicionar, remover }, por)` —
entra só cliente sem carteira, sai só cliente desta gerência; cliente de outra gerência recusa a alteração inteira
(`Cliente de outra gerência: mova pela aba Organograma.`); gerência oculta não recebe; quem entra leva os dados.

`alinharClienteAction(chave, clienteId)` (D12): aplica `levarDadosDoCliente` do cliente para a gerência da carteira
atual e grava `movimento_carteira` com `de` = gerência onde os dados estavam. Serve para os clientes "fora da carteira".

## 6. Ligar o que já existe (senão a troca é desfeita ou fica para trás)

| Ponto (produção) | Hoje | Passa a |
|---|---|---|
| `src/lib/planner-sync.ts:121` | casa a sigla do título com `served_clients` e regrava `cx.manager_id` a cada sync | casa com `cliente` → `carteira_cliente` → `cardDaGerencia`; grava `cliente_id`. Sem isso o sync desfaz a troca |
| `fetchManagersForClientMatch` (`queries.ts:376`) | lê `served_clients` | lê `clientesAtendidosPorGerencia` |
| `saveManagerData` (apaga e regrava `projects` manuais) | perde coluna fora do `Project` | `Project` ganha `clienteId`; projeto manual com cliente na carteira de **outra** gerência é gravado no card dela (editor aberto com dado velho não desfaz a troca) |
| `saveCXData` (apaga e regrava `cx`) | idem | `CXItem` ganha `clienteId`; mesma regra |
| `cloneManager` | copia `served_clients`, projetos e CX | não copia mais `served_clients`; projetos e CX levam `cliente_id` |
| `createContratoAction`/`updateContratoAction`, `createPropostaAction`/`updatePropostaAction` | gerência e gerente vêm do formulário | com `cliente_id`: gerência/gerente/`nome_gerente` vêm da carteira, por cima do formulário (`gerenciaPelaCarteira` = `gerenciaDoComercialPelaCarteira`); sem cliente ou sem carteira, vale o formulário. `ContractModal`/`ProposalModal` ganham o campo cliente ligado a `cliente`. **Sem mudar quem pode editar** (`/contracts` e `/proposals` são públicas hoje) |
| API `/api/external/v1/grc/{sync,cx,projects}`, `/planner-sync` | gravam pelo `managerId` do corpo | gravam `cliente_id` pela regra da seção 4 e, com cliente em carteira, o card da carteira. Formato da API não muda |
| `ClientsTab` (`SingleManagerView.tsx:141`) | `manager.servedClients` | `servedClients` montado de `clientesAtendidosPorGerencia` (mesmo formato `"SIGLA (Nome)"`, sem os ocultos) — a aba não muda |
| `ManagerEditor` "Clientes atendidos" (D13) | edita o JSON | só leitura (sigla + nome da carteira) + botão "Mudar no organograma de clientes" que abre a seção nova |
| `managers.served_clients` | carteira | congelado: não é mais gravado nem lido |

## 7. Chave do admin no servidor (D14)

- `src/lib/settings/chave.ts`: `chaveSettingsValida(chave)` com a regra de `verifySettingsKey` (mesmas três variáveis,
  `trim`). `verifySettingsKey` passa a usá-la.
- Toda action nova (seção 5 e 8.2) recebe a chave como primeiro argumento e confere no servidor — padrão da `/grcc`
  (`src/lib/grcc/chave.ts`).
- **Actions existentes do `/settings`** que gravam passam a receber e conferir a chave: `saveCXData`, `saveVisitsData`,
  `saveChurnData`, `saveManagerData`, `cloneManager`, `saveFaturamento2025Action` (`src/app/settings/actions.ts`) e
  `saveOrgChart` (`orgChartActions.ts`); a lista completa sai de um grep no plano. Os editores já estão atrás do
  `KeyGate`, então leem a chave do `localStorage` e passam adiante; a tela não muda.
- Fora: `/contracts` e `/proposals` continuam abertas como hoje (não são do `/settings`).

## 8. Telas

Visual do dashboard (zinc, prop `lightActive`), estrutura e textos do AIBertinho.

### 8.1 Organograma de clientes no dashboard (só leitura, D8)

- Na view `organograma` do `DashboardShell` entra a troca **Pessoas | Clientes** (`AbasOrganograma` do AIBertinho, como
  botões de estado). Pessoas = `OrganizationChartView` de hoje, intacto.
- Clientes = `OrganogramaClientesView` com `podeMover = false`; dados de uma action de leitura
  `carregarOrganogramaClientesAction()` (aberta, como `fetchOrgChart`).
- Montagem (`montarOrganograma`, pura, cópia em `src/lib/carteira/organograma-clientes.ts`): grupo pela chave (`KAMn` →
  kam, `GRCC` → grcc, `GRCn` → grc, resto → gerente); colunas `[todos KAM]`, uma por GRC, `[GRCC + gerentes]`; ordem por
  grupo, número e nome; clientes por sigla; gerência oculta só com cliente; totais (gerências com cliente, órgãos
  atendidos, maior carteira). **Clientes ocultos (D11) não entram** nem nas contagens.
- Tela: "C L I E N T E S", "Quem atende cada órgão.", caixa "órgãos atendidos"; colunas com cabeçalho na cor do grupo
  (KAM indigo, GRC emerald, GRCC zinc, Gerentes amber — as do organograma de pessoas); cartão com nome, selo
  "Desativada" e contagem; item = sigla + nome, dica com o último movimento ("Última mudança de carteira em
  dd/mm/aaaa"); busca sem acento no quadro todo; "Sem carteira" (ativos sem carteira); legenda; texto "Só leitura: quem
  muda clientes de carteira é o admin, em Configurações."

### 8.2 `/settings` → seção "Organograma de clientes" (admin, atrás do `KeyGate`)

Nova seção no `SettingsDashboard` (botão na lateral, como "Organograma"), abas **Editar | Organograma | A conferir**:

- **Editar** — um cartão por gerência (chave), busca "Buscar gerência, gerente ou cliente":
  - sigla e nome: grava `role` e `name` no card da gerência. Mudar a sigla (D5) regrava, numa transação, a chave em
    `carteira_cliente` e `movimento_carteira`, o `role` dos outros cards da mesma chave e o texto `gerencia` de
    `contrato`/`proposta` da gerência; sigla já usada por outra gerência é recusada;
  - Ocultar/Mostrar gerência (`show_in_dashboard` do card) com confirmação; com cliente na carteira é recusado:
    "Tire os N clientes da carteira antes de desativar." (D10);
  - carteira: lista com X (vai para "Sem carteira", confirmação), Ocultar/Mostrar cliente (D11, confirmação), e combobox
    só com clientes sem carteira (`alterarCarteira`); "Cliente de outra carteira: mova pela aba Organograma.";
  - **Nova gerência**: sigla + nome → cria card (`id` = `<sigla>-<nome>` em slug, como `cloneManager`; `year` = maior ano
    existente; `meta`/`contratado`/`forecastFinal` 0; `avatarUrl` vazio; visível). Mostra em qual coluna cai.
- **Organograma** — a mesma `OrganogramaClientesView` com `podeMover`: arrastar (HTML5) para outro cartão ou para "Sem
  carteira", ou menu "…" ("Mover X para", gerências ocultas desabilitadas, "Tirar da carteira"); confirmação "Mover SMT
  de GRC3 para GRC4?" + `AVISO_LEVA_TUDO`; faixa "SMT foi de GRC3 para GRC4." com **Desfazer** (movimento de volta, mesma
  conferência); erro aparece e a tela recarrega.
- **A conferir** — duas listas:
  - *Fora da carteira* (D12): clientes com linhas em gerência diferente da carteira (hoje SEME, SMDET, SMC, SVMA), com
    as contagens por tabela e os botões "Trazer os dados para a carteira" (`alinharClienteAction`) ou "Mudar a carteira"
    (abre o menu de mover);
  - *Sem cliente*: linhas de `contrato`/`proposta`/`cx`/`projects` manuais sem `cliente_id` (texto, tabela, gerência),
    com combobox para ligar a um cliente existente ou criar um. Ligar grava `cliente_id`; se o cliente tem carteira e os
    dados estão em outra gerência, o cliente passa a aparecer em *Fora da carteira*.

Componentes que a `main` não tem, criados em `src/components/ui/` sobre o que existe (`dialog`, `input`, `alert`, `sheet`):
`combobox.tsx`, `confirm-dialog.tsx`, `notice.tsx`, `dropdown-menu.tsx` (shadcn, Radix já instalado).

## 9. Arquivos

```
src/db/migrations/0017_carteira_clientes.sql
src/db/schema.ts                                   cliente, carteira_cliente, movimento_carteira, cliente_id x4
src/db/queries.ts (seção Carteira)                 carregarOrganogramaClientes, moverClientes, alterarCarteira,
                                                   levarDadosDoCliente, cardDaGerencia, gerenciaPelaCarteira,
                                                   clientesAtendidosPorGerencia, foraDaCarteira, linhasSemCliente,
                                                   gravarGerencia, ocultarCliente
src/lib/integracao/chaves.ts (+ test)              cópia idêntica da branch login
src/lib/carteira/organograma-clientes.ts (+ test)  montagem pura (cópia do AIBertinho)
src/lib/carteira/gerencia.ts (+ test)              chaveDaCarteira, textoDaGerencia
src/lib/carteira/casar-cliente.ts (+ test)         regra clienteCitado
src/lib/carteira/tipos.ts                          ErroCarteira, AVISO_LEVA_TUDO, MUDOU_ENQUANTO_OLHAVA
src/lib/settings/chave.ts (+ test)                 chaveSettingsValida
src/app/settings/carteiraActions.ts (+ test)       moverClienteNoOrganogramaAction, alterarCarteiraAction,
                                                   salvarGerenciaAction, ocultarClienteAction, alinharClienteAction,
                                                   ligarClienteAction, carregarOrganogramaClientesAction
src/components/organograma-clientes/*.tsx (+ test) view, cartão, item, editor, cartão editável, a conferir
src/app/settings/SettingsDashboard.tsx             seção nova
src/components/dashboard/DashboardShell.tsx        troca Pessoas | Clientes
scripts/carteira/seed-carteira.ts (+ test)
+ pontos das seções 6 e 7
```

## 10. Testes (padrão da `main`: vitest; integração em SQLite em memória com as migrações reais)

Cópia dos testes do AIBertinho, adaptados:
- `organograma-clientes.test.ts`: grupos, colunas, oculta, totais, rótulos; cliente oculto fora das contagens.
- carteira: leitura (gerência, gerente, sem carteira, último movimento); mover sem chave recusa; move + trilha + desfaz;
  sem carteira ida e volta; conflito sem gravar; `de = para`.
- cascata: contrato, proposta, cx e projeto manual (com linha no `history`) vão para o card da gerência nova; projeto com
  `lead_grcc_id` fica; tirar da carteira não mexe; `alterarCarteira` com cliente que entra leva os dados.
- componente (`// @vitest-environment jsdom`): cartões e legenda, busca sem acento, só leitura sem menu, menu → confirma
  → grava → Desfazer, cancelar não grava, erro + refresh, arrastar de "Sem carteira".

Novos:
- seed: casa por sigla/`citaSigla`/nome, duplicata fica no card visível, idempotente, projeto GRCC sem `cliente_id`,
  relatório lista os fora da carteira, nada é movido.
- `planner-sync`: tarefa de cliente movido vai para o card da carteira nova.
- `saveManagerData`/`saveCXData` com lista velha não devolvem o cliente movido; sem chave recusam.
- `updateContratoAction` com cliente em carteira grava a gerência da carteira.
- mudar sigla da gerência atualiza carteira, cards e texto dos contratos/propostas.
- ocultar gerência com cliente é recusado; ocultar cliente mantém a carteira e tira do organograma.

## 11. Fora do escopo

- Login/usuários (estão na branch `login`); vários gerentes por gerência (`MembroGerencia`); tipos de gerência.
- `visits`, `churn` e `whatsapp_users` seguirem o cliente (não têm cliente).
- Leads da GRCC (`lead_grcc.cliente`) ligados a `cliente`.
- Fechar `/contracts` e `/proposals` para quem não é admin.
- Fusão da `login` com a `main`: `chaves.ts` vem idêntico para facilitar; a numeração de migrações das duas branches já
  conflita a partir da 0013 e fica para essa fusão.
