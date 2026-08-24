# CX Planner — área admin dedicada para o time de CX

Data: 2026-08-24
Branch: `cx_planner`
Status: aprovado pelo usuário, pronto para plano de implementação

## Contexto

O time de CX (4 pessoas) hoje controla clientes e atualizações usando o Microsoft Planner,
totalmente fora do AIBertinho. O dashboard já consome esses dados de forma indireta: um JSON
exportado do Planner é sincronizado para a tabela `cx` via `syncPlannerTasks`
(`src/lib/planner-sync.ts`), usado por três caminhos hoje:

- `POST /api/external/v1/planner-sync` (push do Power Automate)
- `src/lib/planner-pull.ts` (`pullPlannerIfStale`, pull automático ao carregar `/`, throttlado)
- Upload manual em `/settings` (`PlannerUploadEditor.tsx` → `uploadPlannerTasks`)

O objetivo deste projeto é dar ao time de CX uma tela própria **dentro do dashboard** para
trabalhar diretamente (criar/editar/mover tarefas de CX), replicando o essencial do que o Planner
oferece hoje, e descontinuar o uso do Planner como fonte primária.

## Decisões de escopo (perguntas já resolvidas com o usuário)

- **Migração, não convivência permanente**: o time importa o último JSON do Planner uma vez e
  passa a trabalhar só no dashboard dali para frente. Não é sync bidirecional contínuo.
- **Board único para os 4 do time**: mostra CX de **todos** os gerentes/clientes juntos (como o
  board do Planner mostrava tudo), não filtrado por pessoa.
- **Fidelidade total aos campos do Planner**: além de status/criticidade (já existentes), o board
  precisa expor `data início`, `data fim` (hoje descartada), `% de conclusão` numérico e
  `prioridade` como texto livre (Urgente/Importante/Normal) — não só os enums simplificados atuais.
- **Aditivo, não substitutivo**: os enums `status`/`criticidade` que `CXTab.tsx` (visão final do
  gerente) e `CXEditor.tsx` (`/settings` atual) já usam continuam existindo e funcionando sem
  mudança de comportamento — passam a ser **derivados automaticamente** dos campos brutos novos.
- **Fica dentro do admin, em sub-rota própria**: `/settings/cx-planner`, com chave de acesso
  própria (`CX_PLANNER_KEY`), separada da `SETTINGS_KEY` — o time de CX nunca tem acesso a
  managers/contratos/propostas.
- **Estilo Planner**: board Kanban por status (Pendente / Em Análise / Resolvido), cards coloridos
  por prioridade, com formulário de criar/editar tarefa.
- **Edição concorrente sem lock**: 4 pessoas editam ao mesmo tempo; ações são granulares por item
  (create/update/delete/move), não "apaga tudo e reinsere" como o `saveCXData` atual — evita que
  uma pessoa sobrescreva o trabalho de outra ao salvar.
- **Migração via upload existente**: sem script novo — o botão "Upload Planner (CX)" já existente
  em `/settings` passa a gravar os campos novos também, e é isso que o usuário vai usar para
  popular o board pela primeira vez.
- **Pull/push antigos ficam dormentes, não são removidos**: continuam no código como estão hoje;
  como dependem de `PLANNER_FLOW_URL` (que não será mais configurada), simplesmente não disparam.
  Rede de segurança para reverter se necessário.

## Arquitetura

```
/settings/cx-planner  (nova sub-rota)
  ├─ CXPlannerGate.tsx        (client — mesmo padrão de KeyGate.tsx, chave própria)
  ├─ actions.ts                'use server': verifyCXPlannerKey (env CX_PLANNER_KEY)
  │                            + createCXPlannerItem / updateCXPlannerItem /
  │                              deleteCXPlannerItem / moveCXPlannerItem
  ├─ page.tsx                  Server Component: fetch inicial dos itens de CX (todos os gerentes)
  └─ CXPlannerBoard.tsx        Client Component: Kanban (Pendente/Análise/Resolvido),
                               cards por prioridade, modal de criar/editar
```

Nada muda em:
- `src/components/dashboard/tabs/CXTab.tsx` (visão final do gerente)
- `src/app/settings/CXEditor.tsx` e o restante de `/settings` (managers/contratos/propostas)
- `src/app/api/external/v1/planner-sync`, `src/lib/planner-pull.ts` (ficam como estão, dormentes)

## Modelo de dados

Migration nova em `src/db/migrations/`, adicionando à tabela `cx`:

| Coluna | Tipo | Nullable | Propósito |
|---|---|---|---|
| `data_inicio` | `text` (ISO) | sim | Espelha `datainicio` do Planner |
| `data_fim` | `text` (ISO) | sim | Prazo/conclusão — hoje descartado |
| `percent_complete` | `integer` (0–100) | sim | Espelha `percentComplete` bruto |
| `prioridade_texto` | `text` | sim | Espelha `prioridade` bruto (Urgente/Importante/Normal) |

`status` e `criticidade` continuam sendo gravados nas mesmas colunas/enums de hoje. A cada
create/update feito pelo board novo (e a cada sync do Planner, incluindo o upload), eles são
recalculados a partir de `percent_complete`/`prioridade_texto` reaproveitando `mapStatus` e
`mapCriticidade` (hoje internas a `planner-sync.ts` — vão ser exportadas/compartilhadas).

## Sincronização / migração

1. `syncPlannerTasks` (`src/lib/planner-sync.ts`) passa a gravar também `data_inicio`, `data_fim`,
   `percent_complete` e `prioridade_texto` no insert/update — hoje só grava as versões derivadas.
2. O usuário faz upload do JSON mais recente do Planner via `PlannerUploadEditor.tsx` (fluxo já
   existente, sem mudança de UX) — isso popula `cx` com todos os campos, casando cliente→gerente
   pelo `servedClients` do mesmo jeito que já funciona.
3. A partir daí, o time de CX trabalha direto em `/settings/cx-planner`. O mesmo botão de upload
   continua disponível para reimportar no futuro, se necessário.

## Interface do board

- **Colunas por status** (Pendente / Em Análise / Resolvido) — Kanban, com drag-and-drop ou
  seletor rápido no card para mover entre colunas (`moveCXPlannerItem`).
- **Cards** mostram: cliente/gerente, título, barra de % concluído, badge de prazo (`data_fim`,
  destacado se vencido), e uma faixa/borda colorida pela prioridade (vermelho = Urgente,
  laranja/amarelo = Importante, azul/cinza = Normal — reaproveitando a paleta que `CXEditor.tsx`
  já usa para criticidade).
- **"+ Nova tarefa"** por coluna (ou botão geral) abre formulário: Gerente/Cliente (dropdown
  ligado a `servedClients`, sem mais depender de parsear sigla do título), Título, Descrição,
  Data início, Data fim, Prioridade (texto livre com as 3 cores acima), % de conclusão (slider que
  sugere o status, mas pode ser sobrescrito manualmente).
- Clicar num card existente abre o mesmo formulário para edição + botão de excluir.
- O histórico (campo `problema`, já formatado como entradas datadas) continua sendo exibido dentro
  do card, no mesmo formato que a tela final do gerente já usa.

## Edição concorrente

Substitui o padrão "apaga tudo do gerente e reinsere" (`saveCXData`, usado hoje só por
`/settings`) por ações granulares, cada uma mexendo em uma linha específica por `id`:

- `createCXPlannerItem(dados)`
- `updateCXPlannerItem(id, patch)`
- `deleteCXPlannerItem(id)`
- `moveCXPlannerItem(id, novoStatus)`

Sem lock/trava de item — com 4 pessoas e itens tipicamente distintos por cliente, o risco de
colisão exata é baixo. Pode ser adicionado depois se necessário.

Como o board escreve na mesma tabela `cx` que `CXTab.tsx` já lê (por `managerId`), qualquer
atualização feita pelo time de CX aparece imediatamente na aba CX do gerente correto na visão
final — sem etapa intermediária.

## Acesso

Segue o padrão de "key gate" já documentado no `CLAUDE.md`: componente gate client-side +
server action de verificação + env var própria.

| Área | Gate | Verify action | Env var |
|---|---|---|---|
| `/settings/cx-planner` | `CXPlannerGate.tsx` | `verifyCXPlannerKey` | `CX_PLANNER_KEY` |

## Fora de escopo (YAGNI)

- Login individual por pessoa do time de CX (continua chave única compartilhada, como todo o
  resto do projeto).
- Lock/trava de edição concorrente.
- Sync bidirecional contínuo com o Planner (é migração única, não convivência).
- Mudar `CXTab.tsx`/`CXEditor.tsx` para usar os campos brutos em vez dos enums — ficam como estão.
- Remover o código de pull/push do Planner — fica dormente, não é apagado.

## Branch

Todo o trabalho acontece na branch `cx_planner` (criada a partir de `v2_ls`), isolada até revisão.
