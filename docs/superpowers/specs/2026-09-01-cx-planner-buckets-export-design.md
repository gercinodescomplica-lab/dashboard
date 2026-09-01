# CX Planner — buckets dinâmicos, responsável, subtítulo e export Excel

Data: 2026-09-01
Branch: `cx_planner`
Status: aprovado pelo usuário, pronto para plano de implementação

## Contexto

O board `/settings/cx-planner` já existe (ver `docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md`):
Kanban com **3 colunas fixas por status** (Pendente / Em Análise / Resolvido), cards coloridos por
prioridade, modal de criar/editar item, tudo gravando na tabela `cx`, que também alimenta a aba CX
do gerente (`CXTab.tsx`) e `/settings`.

O usuário comparou o board com o export real do Microsoft Planner (`Demandas CX.xlsx`, 156 tarefas)
e quer que o board fique mais fiel ao Planner:

- **Buckets livres** como colunas (criar/renomear/reordenar/excluir), no lugar das 3 colunas fixas
  de status.
- Campo **responsável** ("Atribuído a" no Planner — hoje Paulo Irie, Denis Sperate, Maria Jose da
  Silva, Antônio Santana).
- **Subtítulo** no card — a "área" que no Planner vem dos Rótulos (Infraestrutura, Desenvolvimento,
  Fornecedor, Outros, DRM).
- Card visualmente no estilo Planner.
- Botão **"Baixar Excel"** que gera um arquivo no mesmo modelo de 6 abas do `Demandas CX.xlsx`.

### Estrutura do `Demandas CX.xlsx` (referência do export)

6 abas:

| Aba | Colunas |
|---|---|
| Plano | `ID do plano`, `Nome do plano` (+ data numa 3ª coluna sem header) |
| Dados Consolidados | 19 colunas (abaixo), valores **legíveis** (nome do bucket, nome do responsável) |
| Tarefas | as mesmas 19 colunas, mas com **IDs** onde o Planner usa id (Categoria = id do bucket, Atribuído a = id do usuário, Concluída por = id) |
| Metas | `ID da Meta`, `Nome da meta`, `Status`, `Prioridade`, `Data de início`, `Data de término`, `Tarefas conectadas`, `Notas` — sem linhas no arquivo real |
| Buckets | `ID de Bucket`, `Nome do Bucket` |
| Usuários | `ID do Usuário`, `Nome do usuário`, `Email` |

As 19 colunas de Dados Consolidados / Tarefas:
`Identificação da tarefa`, `Nome da tarefa`, `Categoria`, `Meta`, `Status`, `Prioridade`,
`Atribuído a`, `Criado por`, `Criado em`, `Data de conclusão`, `Data de início`, `É Recorrente`,
`Atrasados`, `Concluído em`, `Concluída por`, `Itens concluídos da lista de verificação`,
`Itens da lista de verificação`, `Rótulos`, `Notas`.

Observações do arquivo real:
- Strings são inline (`inlineStr`), sem `sharedStrings.xml` — irrelevante para o gerador
  (`exceljs` cuida disso; Excel lê os dois formatos).
- O xlsx do Planner **não** carrega a Descrição/histórico do problema nem o `percentComplete`
  numérico — só o Status textual. O nosso export reproduz isso (é saída para relatório, não backup).
- `Status` textual assume `Concluída` / `Em andamento`.
- `Rótulos` combina a tag do gerente com a área, separadas por `;` — ex.: `KAM 3;Infraestrutura`.

## Decisões de escopo (resolvidas com o usuário)

- **Buckets** viram as colunas do board, com CRUD completo (criar/renomear/reordenar/excluir).
- **Status derivado**: as 3 colunas fixas de status somem do board. `cx.status` continua sendo
  gravado, **derivado de `percent_complete`** (`0` → pendente, `1–99` → analise, `100` → resolvido),
  reaproveitando a regra `statusForPercent` que já existe no modal. `cx.criticidade` segue derivado
  de `prioridade_texto` via `mapCriticidade` (já é assim hoje). `CXTab.tsx` e `/settings` **não
  mudam**.
- **Responsável**: lista gerenciável — nova tabela `cx_users` (nome + email), editável num modal
  no próprio board. O item aponta para um `cx_user` (ou nenhum).
- **Subtítulo/área**: campo de **texto livre** (`cx.subtitulo`) com autocomplete (`<datalist>`) das
  áreas já usadas. Exibido como pill/subtítulo no card.
- **Item sem bucket** (`bucket_id = null`): renderizado numa coluna fixa **"Entrada"** sempre à
  esquerda, não renomeável / não excluível. É onde caem os itens vindos do import de JSON e para
  onde voltam os cards quando um bucket é excluído. Com isso o `planner-sync.ts` e o import **não
  são tocados**.
- **Export Excel**: botão que baixa **sempre o board inteiro** (ignora filtros ativos), no modelo
  de 6 abas acima. Route handler `GET`, gerado com `exceljs` (dependência nova).
- **Sem import de Excel** — o import de dados continua sendo só pelo JSON no fluxo atual de
  `/settings`.
- **Migração dos ~150 itens existentes**: o usuário vai reimportar o JSON do Planner; os itens
  entram sem bucket (coluna "Entrada"), sem responsável e sem subtítulo, e o time organiza no board.
  Nenhum backfill automático.

## Modelo de dados

Migration nova em `src/db/migrations/` (aplicada com `npm run db:migrate`): 2 `CREATE TABLE` +
3 `ALTER TABLE`.

### Tabela `cx_buckets`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | `integer` PK autoincrement | |
| `name` | `text` notNull | nome da coluna |
| `position` | `integer` notNull | ordem das colunas (0-based) |

### Tabela `cx_users`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | `integer` PK autoincrement | |
| `name` | `text` notNull | ex.: "Paulo Yassuharu Irie" |
| `email` | `text` | opcional |

### Colunas novas em `cx`

| Coluna | Tipo | Nullable | Propósito |
|---|---|---|---|
| `bucket_id` | `integer` FK → `cx_buckets.id`, `onDelete: set null` | sim | coluna do board; null = "Entrada" |
| `responsavel_id` | `integer` FK → `cx_users.id`, `onDelete: set null` | sim | "Atribuído a" |
| `subtitulo` | `text` | sim | área/rótulo livre, subtítulo do card |

`status` e `criticidade` continuam nas mesmas colunas/enums, sempre derivados no
create/update do board (e a cada sync do Planner, que já faz isso).

Nota SQLite/Drizzle: adicionar FK via `ALTER TABLE ADD COLUMN` é suportado pelo LibSQL/Turso desde
que a coluna seja nullable e sem default que viole a constraint — as três são nullable. A migration
cria as tabelas referenciadas antes de adicionar as colunas.

## Arquitetura / arquivos

```
src/db/schema.ts                         + cxBuckets, cxUsers; + cx.bucketId / responsavelId / subtitulo
src/db/migrations/0013_cx_planner_buckets.sql   novo (drizzle-kit gera; ajustar nome se preciso)

src/db/queries.ts
  + CX bucket CRUD: fetchCXBuckets / createCXBucket / renameCXBucket / reorderCXBucket / deleteCXBucket
  + CX user CRUD:   fetchCXUsers / createCXUser / updateCXUser / deleteCXUser
  ~ fetchAllCXItemsForBoard: join cx_users (nome do responsável), incluir bucketId, responsavelId, subtitulo
  ~ createCXItem / updateCXItem: já aceitam typeof cx.$inferInsert — cobrem os campos novos

src/app/settings/cx-planner/actions.ts
  ~ CXPlannerFormValues: + subtitulo, responsavelId (number|null), bucketId (number|null)
  ~ create/updateCXPlannerItem: repassar campos novos; status sempre = statusForPercent(percentComplete)
  + server actions de bucket: createBucket / renameBucket / moveBucket(id, dir) / deleteBucket
  + server actions de user:   createCXUser / updateCXUser / deleteCXUser
  ~ fetch inicial passa a devolver { items, managers, buckets, users }

src/app/settings/cx-planner/board-config.ts
  ~ remove STATUS_COLUMNS como fonte das colunas (mantém labels de status p/ o badge read-only)
  = PRIORIDADE_CONFIG / prioridadeStyle continuam

src/app/settings/cx-planner/CXPlannerBoard.tsx
  ~ colunas dinâmicas a partir de `buckets` (+ coluna fixa "Entrada" p/ bucketId null)
  + cabeçalho de coluna com menu ⋯ (renomear / mover ⬅➡ / excluir) e botão +
  + botão "+ Adicionar bucket" no fim da faixa
  + botão "Responsáveis" (abre CXUsersModal)
  + botão "Baixar Excel" (link para /settings/cx-planner/export)
  ~ filtros: busca cobre subtitulo/responsável; select de status → select de bucket; + select de responsável
  ~ drag-and-drop grava bucket_id (inclui "Entrada")

src/app/settings/cx-planner/CXPlannerCard.tsx
  ~ layout estilo Planner: faixa de prioridade, gerente·cliente, título, subtítulo (pill),
    barra %, rodapé com prazo + responsável (iniciais) + última atualização

src/app/settings/cx-planner/CXPlannerItemModal.tsx
  + campo Subtítulo (<input> + <datalist> de áreas usadas)
  + select Responsável (cx_users + "— nenhum —")
  + select Bucket (cx_buckets + "Entrada (sem bucket)")
  - chips de Status manuais → badge read-only "Status: X (derivado do %)"

src/app/settings/cx-planner/CXUsersModal.tsx        novo — CRUD de cx_users

src/lib/cx-planner-export.ts                        novo — monta o ExcelJS.Workbook a partir de
                                                    (items, buckets, users, managers); pura, testável
src/app/settings/cx-planner/export/route.ts         novo — GET: auth via CX_PLANNER_KEY (cookie/localStorage
                                                    não chega no route — ver "Acesso ao export"),
                                                    chama fetch + cx-planner-export, devolve o .xlsx

package.json                                        + exceljs
```

Nada muda em `CXTab.tsx`, `CXEditor.tsx`, `planner-sync.ts`, `planner-pull.ts`, rotas da API externa.

## Board e card

### Colunas

- Uma coluna por `cx_bucket`, ordenadas por `position`.
- Coluna **"Entrada"** fixa à esquerda — só aparece se houver item com `bucket_id = null`; sem menu
  `⋯`, sem `+` (itens chegam nela por import ou por exclusão de bucket; saem por drag).
- Cabeçalho de bucket: nome + `(contador)`, botão `+` (cria item já nesse bucket), menu `⋯`:
  - **Renomear** — input inline
  - **Mover ⬅ / Mover ➡** — troca `position` com a coluna vizinha; desabilitado nas pontas
  - **Excluir** — confirmação de 2 cliques; cards do bucket vão para `bucket_id = null` ("Entrada")
- No fim da faixa: **"+ Adicionar bucket"** — input inline, salva no Enter, `position` = último + 1.

### Card (estilo Planner, de cima pra baixo)

1. borda esquerda `border-l-4` colorida pela prioridade (Urgente vermelho / Importante amarelo /
   Média verde) — regra `prioridadeStyle` atual
2. linha topo: `{gerente} · {cliente}` (10.5px, cinza) · badge de prioridade · ícone 👁 se
   `isVisible === false`
3. **título** (13px, medium, 1 linha) — fallback para `problema` se sem título
4. **subtítulo** (`subtitulo`) — pill cinza pequena, só se preenchido
5. barra de `%` + número
6. rodapé: chip de **prazo** (`data_fim`, formato BR, vermelho se vencido e não resolvido) ·
   **responsável** (círculo com iniciais + primeiro nome, se houver) · **última atualização**
   (data da entrada mais recente do log em `problema`, fallback `createdAt`) — lógica atual

### Drag-and-drop

- Arrastar card entre colunas (inclui "Entrada") → `moveCXPlannerItem(id, bucketId | null)` grava
  só `bucket_id`. `percent_complete` / `status` **não** mudam (bucket é organização, status vem
  do %).
- Optimistic update com rollback em falha, como já é hoje.

### Filtros (barra existente, adaptada)

- Busca livre: passa a incluir `subtitulo` e nome do responsável no haystack.
- Select **bucket** (substitui o select de status) — opções: todos os buckets + "Entrada".
- Select **responsável** (novo) — `cx_users` + "sem responsável".
- Mantém: gerente, cliente, prioridade, contador "Mostrando X de N", "Limpar filtros".
- Filtros **não** afetam o export (que é sempre o board inteiro).

## Modal de item

Campos, na ordem:

| Campo | Controle | Nota |
|---|---|---|
| Gerente | select | como hoje (obrigatório) |
| Cliente / Órgão | input | como hoje (obrigatório) |
| Título | input | |
| Subtítulo / área | `<input>` + `<datalist>` | autocomplete das áreas já usadas; aceita texto novo |
| Descrição do problema | textarea + histórico datado | como hoje (obrigatório) |
| Solução proposta | input | como hoje |
| Data início · Prazo | inputs date | como hoje |
| Prioridade | chips Urgente/Importante/Média | como hoje |
| Responsável | select | `cx_users` + "— nenhum —" |
| Bucket | select | `cx_buckets` + "Entrada (sem bucket)" |
| % de conclusão | slider | como hoje |
| Status | **badge read-only** | "Status: Em Análise", tooltip "derivado do % de conclusão" — substitui os chips manuais |
| Mostrar no painel do gerente | checkbox | como hoje |
| Excluir | botão (confirmação 2 cliques) | como hoje |

Ao salvar: `createCXPlannerItem` / `updateCXPlannerItem` gravam os campos novos e **sempre**
recalculam `status = statusForPercent(percentComplete)` e `criticidade = mapCriticidade(prioridadeTexto)`.

## Gestão de responsáveis (`CXUsersModal`)

Botão "Responsáveis" no topo do board abre um modal:
- lista de `cx_users`: nome + email, com editar / remover por linha
- form de adicionar (nome obrigatório, email opcional)
- remover um responsável em uso → cards ficam sem responsável (FK `set null`); avisar no confirm
  quantos itens serão afetados (contagem simples no client a partir de `items`)

Gestão de buckets é inline no board (sem modal próprio).

## Exportação Excel

### Fluxo

- Botão "Baixar Excel" → navega para `GET /settings/cx-planner/export`.
- Route handler: valida acesso (ver abaixo), busca `items` + `buckets` + `users` + `managers`,
  chama `buildCXPlannerWorkbook(...)` de `src/lib/cx-planner-export.ts`, responde com
  `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e
  `Content-Disposition: attachment; filename="Demandas CX.xlsx"`.
- Sempre o board inteiro — ignora qualquer filtro ativo.

### Acesso ao export

O gate do board é client-side (`CXPlannerGate` + `localStorage` + `verifyCXPlannerKey`). Um `GET`
de download não carrega esse estado. Solução: o botão adiciona a chave como query param
(`/settings/cx-planner/export?key=...`) a partir do que o gate já tem em memória, e o route handler
compara com `CX_PLANNER_KEY` (mesmo default `prodam_cx_2026`) — mesmo nível de proteção "shared
secret" do resto do app, coerente com o `CLAUDE.md`. Sem chave válida → `401`.

### `buildCXPlannerWorkbook(items, buckets, users, managers)` → `ExcelJS.Workbook`

Monta as 6 abas:

**Plano** — 1 linha: `["cx-planner", "Demandas CX", <hoje YYYY-MM-DD>]` sob os headers
`ID do plano`, `Nome do plano`, `""`.

**Dados Consolidados** — headers = as 19 colunas; 1 linha por item, valores legíveis.
**Tarefas** — mesmas 19 colunas; 1 linha por item, valores com id onde aplicável.

Mapeamento por item (L = versão legível / I = versão com id):

| Coluna | Valor |
|---|---|
| Identificação da tarefa | `external_id ?? "cx-" + id` |
| Nome da tarefa | `cliente ? cliente + " - " + titulo : titulo` (fallback `problema` 1ª linha se sem título) |
| Categoria | L: nome do bucket · I: `String(bucket_id)` · vazio se null ("Entrada") |
| Meta | `""` |
| Status | `status === "resolvido" ? "Concluída" : "Em andamento"` |
| Prioridade | `prioridade_texto ?? ""` |
| Atribuído a | L: nome do responsável · I: `String(responsavel_id)` · vazio se null |
| Criado por | `""` |
| Criado em | `toDateOnly(created_at)` |
| Data de conclusão | `toDateOnly(data_fim)` |
| Data de início | `toDateOnly(data_inicio)` |
| É Recorrente | `"false"` |
| Atrasados | `isOverdue(data_fim, status) ? "true" : "false"` |
| Concluído em | `status === "resolvido" ? toDateOnly(data_fim) : ""` |
| Concluída por | `status === "resolvido" ? (L: nome / I: id do responsável) : ""` |
| Itens concluídos da lista de verificação | `""` |
| Itens da lista de verificação | `""` |
| Rótulos | `[managerTag(managerId), subtitulo].filter(Boolean).join(";")` |
| Notas | `solucao_proposta ?? ""` |

`managerTag(managerId)`: `managerId` tem forma `grc1-bruno` / `kam3-...` → regex
`/^(grc|kam)(\d+)/i` → `"GRC 1"` / `"KAM 3"`. Sem match → usa `manager.role` cru. Sem manager → `""`.

**Metas** — só os 8 headers, sem linhas.

**Buckets** — headers `ID de Bucket`, `Nome do Bucket`; 1 linha por bucket (`String(id)`, `name`).

**Usuários** — headers `ID do Usuário`, `Nome do usuário`, `Email`; 1 linha por user
(`String(id)`, `name`, `email ?? ""`).

### Não exportado (igual ao xlsx real do Planner)

Descrição/histórico do problema, `percent_complete` numérico, checklists, metas. É saída para
relatório.

## Casos de borda / erros

- Excluir bucket com cards → cards para `bucket_id = null` ("Entrada"), nunca somem. Confirmação
  de 2 cliques.
- Excluir responsável em uso → `set null`; cards seguem no board. Confirm mostra a contagem.
- Pode-se excluir todos os buckets → tudo cai em "Entrada"; board nunca quebra.
- Botões "mover bucket" desabilitados nas pontas.
- Edição concorrente (4 pessoas): mantém o padrão atual — ações granulares por `id`, sem lock,
  botão "Atualizar" para puxar o estado novo. Vale para buckets e users também.
- Export com board vazio → arquivo com as 6 abas e só cabeçalhos.
- Ids órfãos no export (bucket/user referenciado que sumiu por corrida) → célula em branco.
- `datalist` de áreas: derivado de `items` no client; vazio no primeiro uso, sem quebrar.

## Verificação

Não há test runner configurado (CLAUDE.md).

- `npx tsc --noEmit` e `npm run lint` limpos.
- `npm run db:migrate` aplica a migration sem erro (checar em banco local).
- Walkthrough manual em `localhost:6001/settings/cx-planner`:
  - criar / renomear / reordenar / excluir bucket; ver cards indo para "Entrada" ao excluir
  - criar item com responsável, subtítulo e bucket; arrastar entre colunas (inclusive "Entrada")
  - mexer no `%` e ver o badge de status derivado mudar
  - abrir "Responsáveis", adicionar / editar / remover; remover um em uso e ver os cards
  - filtros: bucket, responsável, busca por subtítulo
  - "Baixar Excel" → abrir o arquivo e conferir as 6 abas e as 19 colunas contra `Demandas CX.xlsx`
- Conferir a aba CX de um gerente em `/` — itens seguem com status/criticidade coerentes.
- `npm run build` conclui.

## Fora de escopo (YAGNI)

- Botão de importar Excel (import segue só por JSON em `/settings`).
- Exportar histórico/descrição/% no Excel.
- Export por bucket ou respeitando filtros.
- Aba "Metas" com conteúdo.
- Checklists de tarefa.
- Lock de edição concorrente / real-time sync.
- Mudar `CXTab.tsx` / `CXEditor.tsx` para usar os campos brutos em vez dos enums derivados.
- Login individual por pessoa do CX (segue chave compartilhada `CX_PLANNER_KEY`).
- Tocar em `planner-sync.ts` / `planner-pull.ts` / rotas da API externa.

## Branch

Trabalho continua na branch `cx_planner`.
