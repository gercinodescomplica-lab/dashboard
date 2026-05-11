# API Evolution Roadmap — Dashboard Comercial DRM

> Documento técnico de análise, backlog de melhorias e plano de evolução da API.
> Gerado em: 2026-05-11 | Versão: 1.0

---

## Sumário

1. [Estado Atual da API](#1-estado-atual-da-api)
2. [Análise de Segurança](#2-análise-de-segurança)
3. [Análise de Arquitetura](#3-análise-de-arquitetura)
4. [Padronização e Boas Práticas REST](#4-padronização-e-boas-práticas-rest)
5. [Performance](#5-performance)
6. [Riscos de Exposição de Dados](#6-riscos-de-exposição-de-dados)
7. [Plano de Evolução — Camada de Escrita (GRC)](#7-plano-de-evolução--camada-de-escrita-grc)
8. [Infraestrutura para a Evolução](#8-infraestrutura-para-a-evolução)
9. [Backlog Priorizado](#9-backlog-priorizado)
10. [Roadmap de Execução](#10-roadmap-de-execução)

---

## 1. Estado Atual da API

### Stack

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js |
| Banco de dados | Turso (SQLite distribuído, cloud) |
| ORM | Drizzle ORM v0.45 |
| Autenticação atual | Bearer Token (API key estática) |
| Deploy | (não documentado) |

### Endpoints externos existentes

| Método | Rota | Descrição | Cache |
|---|---|---|---|
| GET | `/api/external/v1/contracts` | Lista contratos com filtros | Nenhum |
| GET | `/api/external/v1/contracts/:identifier` | Contrato por UUID ou número | Nenhum |
| GET | `/api/external/v1/contracts/analytics` | Analytics pré-computado de contratos | 15 min (ISR) |
| GET | `/api/external/v1/data` | Dashboard completo (gerentes, pipeline, CX, visitas) | Nenhum |

### Operações de escrita existentes (apenas internas)

Atualmente as mutações são feitas exclusivamente via **Next.js Server Actions** (não expostas como API REST):

- `saveManagerData()` — upsert de gerente + projetos do pipeline
- `saveCXData()` — substituição total de itens CX por gerente
- `saveVisitsData()` — substituição total de visitas por gerente
- `createContrato()`, `updateContrato()`, `deleteContrato()` — CRUD de contratos

Essas actions protegem acesso com chaves simples verificadas no servidor, mas não são endpoints REST auditáveis.

---

## 2. Análise de Segurança

### 🔴 Crítico

#### SEC-01 — Chaves de acesso fracas e hardcodadas no código-fonte

**Problema:** O arquivo `settings/actions.ts` contém um fallback hardcodado:

```typescript
const correctKey = process.env.SETTINGS_KEY || 'prodam2026';
```

Se a variável de ambiente não estiver configurada, qualquer usuário que descubra o código-fonte (vazamento, repo público acidental, ex-colaborador) consegue acesso total às operações de escrita. Adicionalmente, as chaves configuradas no `.env` são extremamente fracas:

```
SETTINGS_KEY=dani_2026
PIPELINE_KEY=rhay_pipeline
STORE_PUBLIC_KEY=prodam_store_2026
```

**Chaves baseadas em nomes de pessoas e ano corrente são facilmente adivinhadas por força bruta direcionada.**

**Resolução:**
- Remover todos os fallbacks hardcodados do código-fonte
- Substituir todas as chaves por tokens com no mínimo 32 bytes de entropia (ex: `openssl rand -base64 32`)
- Rotacionar imediatamente as chaves existentes
- Nunca versionar chaves no repositório; usar `.env.local` + secrets do CI/CD

---

#### SEC-02 — Lógica de autenticação duplicada e sem middleware centralizado

**Problema:** A função `authenticate()` está copiada literalmente em três arquivos de rota diferentes:

- `contracts/route.ts`
- `contracts/[identifier]/route.ts`
- `contracts/analytics/route.ts`

O endpoint `/data/route.ts` nem usa a função extraída — tem a validação inline.

Código duplicado significa que qualquer mudança futura (ex: rotação de chave, adição de rate limiting, logging) precisa ser aplicada manualmente em cada arquivo, com alto risco de esquecer algum.

**Resolução:**
- Criar `src/lib/api-auth.ts` com a função `authenticate()` centralizada
- Refatorar todos os routes para importar desse módulo
- No médio prazo, migrar para Next.js Middleware (`middleware.ts`) para proteção declarativa por prefixo de rota

---

#### SEC-03 — Ausência de rate limiting

**Problema:** Nenhuma proteção contra abuso de volume de requisições. Os endpoints `/contracts/analytics` e `/data` executam queries que carregam toda a base em memória. Um atacante ou consumidor mal configurado pode derrubar o serviço com requisições em loop.

**Resolução (curto prazo):**
- Implementar rate limiting por IP usando `@upstash/ratelimit` + Upstash Redis (ou Vercel KV)
- Limites sugeridos: 60 req/min para endpoints de leitura, 10 req/min para escrita

**Resolução (longo prazo):**
- Por-API-key rate limiting quando múltiplos consumidores existirem

---

### 🟡 Alto

#### SEC-04 — Chave da API Turso (JWT) sem política de rotação

**Problema:** O `TURSO_AUTH_TOKEN` é um JWT de longa duração armazenado no `.env`. Não existe documentação de quando foi gerado nem política de rotação. Se o token vazar (logs, deploys, etc.), qualquer pessoa tem acesso direto ao banco de dados.

**Resolução:**
- Definir política de rotação semestral para o auth token do Turso
- Usar variáveis de ambiente do ambiente de deploy (Vercel/Railway secrets), nunca commitar o valor real
- Habilitar audit logging no painel do Turso se disponível

---

#### SEC-05 — `error.message` interno exposto em respostas 500

**Problema:** Em todos os endpoints:

```typescript
return NextResponse.json(
  { error: 'Internal Server Error', message: error.message },
  { status: 500 }
);
```

O `error.message` pode vazar nomes de tabelas, queries SQL, stack traces ou informações da infraestrutura.

**Resolução:**
- Em produção, retornar apenas `{ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }`
- Logar o erro detalhado no servidor, nunca no response
- Usar variável de ambiente `NODE_ENV` para controlar verbosidade: detalhe em `development`, genérico em `production`

---

#### SEC-06 — CORS não configurado explicitamente

**Problema:** Sem política CORS definida, o Next.js usa o comportamento padrão, que pode ser permissivo dependendo da versão. Não está documentado quais origens são permitidas para consumir esta API.

**Resolução:**
- Definir política CORS explícita no `next.config.ts` ou via cabeçalhos no middleware
- Para API pública: especificar origens permitidas
- Para API interna: `Access-Control-Allow-Origin` restrito ao domínio do dashboard

---

#### SEC-07 — Única chave para todos os consumidores externos

**Problema:** `EXTERNAL_API_KEY` é compartilhada por todos os consumidores da API (assistentes de IA, integrações futuras, etc.). Se uma integração for comprometida, todas as demais precisam rodar uma rotação de chave imediata ao mesmo tempo.

**Resolução:**
- Criar uma tabela `api_keys` no banco ou armazenar em variáveis de ambiente nomeadas por consumidor
- Cada consumidor recebe sua própria chave com identificador (ex: `key_claude_xxx`, `key_powerbi_xxx`)
- Permitir revogação individual sem afetar os demais

---

### 🟢 Médio

#### SEC-08 — Ausência de logs de auditoria para operações de escrita

As Server Actions que modificam dados (salvar gerente, CX, visitas, contratos) não geram nenhum log de auditoria. Não existe rastreabilidade de quem alterou o quê e quando.

---

## 3. Análise de Arquitetura

### ARQ-01 — Server Actions para mutações em vez de endpoints REST

**Problema:** Toda a camada de escrita usa Next.js Server Actions chamadas diretamente do frontend. Isso é adequado para um dashboard interno, mas:

- Não é auditável externamente (sem URL, sem método HTTP explícito)
- Não é consumível por integrações externas (o objetivo da evolução descrita neste documento)
- Mistura lógica de UI com lógica de negócio
- Dificulta testes automatizados isolados

**Resolução:** Criar endpoints REST para todas as operações de escrita que precisam de acesso externo, mantendo as Server Actions apenas como adaptadores de UI que chamam os mesmos endpoints internamente (ou diretamente as queries do DB).

---

### ARQ-02 — Filtros aplicados em memória em vez de no banco

**Problema:** Em `GET /contracts`, os filtros de `gerencia`, `vigente` e `tipo` carregam todos os contratos do banco e filtram em JavaScript:

```typescript
let contratos = await fetchAllContratos(search);
if (gerenciaFilter) {
  contratos = contratos.filter(c => c.gerencia?.toUpperCase() === gerenciaFilter);
}
```

Com ~100 contratos isso é aceitável, mas é um anti-padrão que não escala e desperdiça I/O desnecessariamente.

**Resolução:** Passar os filtros para a query Drizzle com cláusulas `where` compostas.

---

### ARQ-03 — Estratégia de substituição total em vez de CRUD granular

**Problema:** `saveCXData()` e `saveVisitsData()` fazem `DELETE` de todos os registros do gerente e `INSERT` dos novos. Isso:

- Não preserva histórico
- Destrói IDs existentes (quebra referências externas)
- É perigoso em cenários de falha parcial (sem transação explícita, um `INSERT` falho após o `DELETE` zera os dados)

**Resolução:**
- Migrar para operações granulares: `POST` para criar, `PATCH` para atualizar, `DELETE` para remover individualmente
- Usar transações Drizzle (`db.transaction()`) onde múltiplas operações precisam ser atômicas

---

### ARQ-04 — Inconsistência no tipo de chave primária

**Problema:** As tabelas usam estratégias diferentes de PK sem justificativa aparente:

| Tabela | PK |
|---|---|
| `managers` | `text` (ex: `"grc1-bruno"`) — identificador semântico manual |
| `contrato` | `text` (UUID manual) |
| `projects` | `integer` autoincrement |
| `cx` | `integer` autoincrement |
| `visits` | `integer` autoincrement |
| `storeProducts` | `integer` autoincrement |

PKs semânticas em `managers` (ex: `grc1-bruno`) criam acoplamento entre identificadores de negócio e chaves técnicas. Uma mudança de nome ou estrutura de gerência exige migração de chave.

**Resolução:** Definir e documentar a estratégia oficial de PKs. Considerar UUIDs gerados pelo banco (`ULID` ou `UUID v7`) para todos os recursos expostos por API.

---

### ARQ-05 — Analytics calculado na requisição HTTP

**Problema:** `GET /contracts/analytics` executa cálculos complexos síncronos dentro do handler de requisição. Embora tenha ISR de 15 minutos, na revalidação, uma requisição fica bloqueada enquanto o cálculo acontece.

**Resolução:** Mover o cálculo de analytics para um job agendado (Trigger.dev, Vercel Cron) que persiste o resultado no banco ou em cache externo. O endpoint apenas lê o resultado pré-computado.

---

## 4. Padronização e Boas Práticas REST

### PAD-01 — Sem documentação OpenAPI/Swagger

Nenhum dos endpoints possui especificação OpenAPI. Consumidores externos (equipes, assistentes de IA, integrações) dependem de documentação informal.

**Resolução:** Adotar `zod-openapi` ou `@asteasolutions/zod-to-openapi` para gerar spec OpenAPI 3.1 a partir dos schemas Zod de validação. Servir via `/api/docs` (Swagger UI) ou `/api/openapi.json`.

---

### PAD-02 — Sem validação formal de input nos endpoints GET

Query parameters são lidos diretamente sem schema de validação. Um valor inválido como `?vigente=maybe` resulta em comportamento silencioso (tratado como `false`), não em erro informativo.

**Resolução:** Adotar **Zod** para validar todos os inputs de requisição (query params, body, path params). Retornar `400 Bad Request` com detalhes dos campos inválidos.

---

### PAD-03 — Status codes inconsistentes

- 401 usado para "header ausente" e 403 para "token inválido" — correto conceitualmente, mas sem documentação
- Sem uso de 404 nos endpoints que buscam por identificador (retorna 500 se não encontrado dependendo do caminho de erro)
- Sem uso de 422 para erros de validação semântica

**Resolução:** Definir e documentar o mapa de status codes padrão da API:

| Situação | Status |
|---|---|
| Sucesso com dados | 200 |
| Criado com sucesso | 201 |
| Sem conteúdo | 204 |
| Input inválido (schema) | 400 |
| Não autenticado | 401 |
| Sem permissão | 403 |
| Recurso não encontrado | 404 |
| Validação semântica | 422 |
| Erro interno | 500 |

---

### PAD-04 — Sem paginação nos endpoints de lista

`GET /contracts` retorna todos os contratos sem paginação, limit ou cursor. Escalabilidade zero para volumes maiores.

**Resolução:** Adicionar paginação offset (`?page=1&limit=50`) ou cursor-based (`?after=<id>&limit=50`) nos endpoints de lista. Incluir `meta.total`, `meta.page`, `meta.limit` na resposta.

---

### PAD-05 — Sem endpoint de health check

Nenhum endpoint para verificar saúde da API e conectividade com o banco.

**Resolução:** Implementar `GET /api/health` que retorna:
```json
{ "status": "ok", "db": "connected", "version": "1.0.0", "timestamp": "..." }
```

---

### PAD-06 — Sem versionamento declarado em cabeçalhos de resposta

A URL contém `/v1/` mas a versão não é comunicada nos cabeçalhos de resposta. Sem header `API-Version` ou `Deprecation`, consumidores não sabem quando uma versão está sendo depreciada.

---

## 5. Performance

### PERF-01 — `fetchFullDashboardData` carrega tudo sem otimização

O endpoint `/data` carrega todos os gerentes com todos os projetos, CX e visitas em uma única operação. Com crescimento dos dados, isso se torna um gargalo.

**Resolução de curto prazo:** Adicionar ISR (`export const revalidate = 300`) no endpoint `/data`.

**Resolução de longo prazo:** Implementar endpoints granulares (`/managers`, `/managers/:id/projects`, etc.) para que consumidores solicitem apenas os dados que precisam.

---

### PERF-02 — Sem cabeçalhos de cache HTTP nos endpoints sem ISR

Os endpoints `/contracts` e `/data` não retornam `Cache-Control` headers. Proxies e CDNs não podem fazer cache inteligente.

---

## 6. Riscos de Exposição de Dados

### EXP-01 — Dados financeiros sensíveis sem mascaramento

Os endpoints retornam valores financeiros completos (`vlContratado`, `vlFaturado`, `vlSaldo`) para qualquer portador da `EXTERNAL_API_KEY`. Não existe granularidade de permissão (ex: acesso apenas a analytics agregados vs. dados por contrato).

---

### EXP-02 — `avatarUrl` e dados pessoais de gerentes expostos na API externa

O endpoint `/data` retorna `avatarUrl`, `name`, `role` de todos os gerentes. Dependendo da política de privacidade da organização, isso pode ser sensível.

---

### EXP-03 — Dados de CX expostos sem filtro de visibilidade na API externa

A tabela `cx` possui campo `isVisible`. O endpoint `/data` aparentemente não filtra por esse campo ao retornar dados externamente, potencialmente expondo itens que deveriam estar ocultos.

**Resolução:** Garantir que `isVisible = false` filtre os registros na resposta da API externa.

---

## 7. Plano de Evolução — Camada de Escrita (GRC)

### 7.1 Novos endpoints propostos

Todos os endpoints de escrita devem estar sob `/api/external/v1/grc/` e protegidos por uma **chave dedicada** (`GRC_API_KEY`), separada da chave de leitura.

#### Projetos (Pipeline)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/external/v1/grc/projects` | Cria novo projeto no pipeline |
| PATCH | `/api/external/v1/grc/projects/:id` | Atualiza projeto existente |
| DELETE | `/api/external/v1/grc/projects/:id` | Remove projeto |

**Body POST:**
```json
{
  "managerId": "grc1-bruno",
  "quarter": "q2",
  "orgao": "SEFAZ",
  "name": "Modernização do Sistema X",
  "value": 850000,
  "temperature": "quente",
  "description": "Contratação prevista para Q2/2026"
}
```

**Validações:**
- `managerId` deve existir na tabela `managers`
- `quarter` deve ser um dos valores do enum: `q1 | q2 | q3 | q4 | nao_mapeado`
- `temperature` deve ser um dos valores do enum: `quente | morno | frio | contratado | historico | perdido`
- `value` deve ser número positivo
- `name` obrigatório, máximo 255 caracteres

---

#### Visitas

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/external/v1/grc/visits` | Registra nova visita |
| PATCH | `/api/external/v1/grc/visits/:id` | Atualiza visita existente |
| DELETE | `/api/external/v1/grc/visits/:id` | Remove visita |

**Body POST:**
```json
{
  "managerId": "grc1-bruno",
  "titulo": "Reunião de alinhamento contratual",
  "local": "SEFAZ — Av. Paulista, 1000",
  "motivo": "Renovação de contrato vigente",
  "data": "2026-05-20",
  "dataFim": "2026-05-20"
}
```

**Validações:**
- `data` e `dataFim` devem estar no formato ISO `YYYY-MM-DD`
- `dataFim`, se informado, deve ser >= `data`

---

#### Problemas/Riscos (CX)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/external/v1/grc/cx` | Registra novo problema/risco |
| PATCH | `/api/external/v1/grc/cx/:id` | Atualiza item existente |
| DELETE | `/api/external/v1/grc/cx/:id` | Remove item |

**Body POST:**
```json
{
  "managerId": "grc1-bruno",
  "cliente": "SEFAZ",
  "titulo": "Atraso na entrega de requisitos",
  "problema": "Cliente não forneceu especificações técnicas no prazo acordado.",
  "solucaoProposta": "Agendar reunião urgente com gerente do cliente.",
  "criticidade": "alta",
  "status": "pendente"
}
```

**Validações:**
- `criticidade`: `baixa | media | alta`
- `status`: `pendente | analise | resolvido`

---

### 7.2 Padrão de resposta para operações de escrita

**Criação (201):**
```json
{
  "success": true,
  "data": { "id": 42, ...campos do recurso criado }
}
```

**Atualização (200):**
```json
{
  "success": true,
  "data": { "id": 42, ...campos atualizados }
}
```

**Remoção (200):**
```json
{
  "success": true,
  "message": "Recurso removido com sucesso."
}
```

**Erro de validação (400):**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    { "field": "quarter", "message": "Valor inválido. Esperado: q1 | q2 | q3 | q4 | nao_mapeado" }
  ]
}
```

**Recurso não encontrado (404):**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Projeto com id 99 não encontrado."
}
```

---

## 8. Infraestrutura para a Evolução

### 8.1 Modelo de Autenticação

**Recomendação: API Keys por escopo com header padronizado**

Manter Bearer Token como mecanismo (simples e amplamente suportado), mas estruturar múltiplas chaves por escopo:

| Chave | Escopo | Quem usa |
|---|---|---|
| `EXTERNAL_API_KEY` | Leitura geral | Assistentes de IA, Power BI |
| `GRC_API_KEY` | Escrita GRC (projetos, visitas, cx) | Integrações aprovadas do GRC |
| `SETTINGS_KEY` | Configurações do dashboard | Frontend interno |
| `PIPELINE_KEY` | Pipeline/store | Frontend interno |

No médio prazo, migrar para autenticação por JWT com claims de escopo (`read:contracts`, `write:grc`, etc.), permitindo controle fino por consumidor.

---

### 8.2 Controle de Permissões

**Curto prazo:** Verificação de escopo por chave (qual chave permite quais rotas)

**Longo prazo:** Tabela `api_consumers` no banco:

```sql
CREATE TABLE api_consumers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,           -- "Claude AI", "Power BI DRM"
  key_hash TEXT NOT NULL,       -- bcrypt/SHA256 da chave real
  scopes TEXT NOT NULL,         -- "read:contracts,write:grc"
  active INTEGER DEFAULT 1,
  created_at TEXT,
  last_used_at TEXT
);
```

---

### 8.3 Versionamento da API

**Estratégia atual:** Versionamento por URL (`/v1/`)

**Manter esta estratégia.** Adicionar:

- Cabeçalho `API-Version: 1` em todas as respostas
- Cabeçalho `Deprecation: true` + `Sunset: <data>` quando uma versão for descontinuada
- Documentar ciclo de vida: versão suportada por mínimo 12 meses após anúncio de deprecação

Novos endpoints de escrita entram como `/api/external/v1/grc/` — extensão da v1, não quebra de contrato.

---

### 8.4 Estratégia de Logs e Auditoria

**Mínimo viável (curto prazo):**

Criar uma tabela de audit log:

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumer_id TEXT,              -- qual chave executou
  method TEXT NOT NULL,          -- GET, POST, PATCH, DELETE
  route TEXT NOT NULL,           -- /api/external/v1/grc/projects
  resource_type TEXT,            -- projects, visits, cx
  resource_id TEXT,              -- id do recurso afetado
  payload_hash TEXT,             -- hash SHA256 do body (não o body em si)
  status_code INTEGER,
  duration_ms INTEGER,
  ip_address TEXT,
  created_at TEXT
);
```

**Não logar o body completo** — logar apenas um hash do payload para auditoria sem expor dados sensíveis.

---

### 8.5 Ambiente de Homologação

**Recomendação:** Usar **branches do Turso** (recurso nativo da plataforma) para criar um banco de homologação separado do produção.

```bash
turso db branch create dshboarddrm --name homolog
```

Configurar variável de ambiente `TURSO_DATABASE_URL_HOMOLOG` e usar diferentes URLs por ambiente no deploy.

**Configuração de ambientes:**

| Ambiente | Branch Git | Banco Turso | URL |
|---|---|---|---|
| Development | `feature/*` | local SQLite ou branch `dev` | `localhost:3000` |
| Homologação | `staging` | branch `homolog` | `homolog.dashboard.prodam.br` |
| Produção | `main` | branch `main` (produção) | `dashboard.prodam.br` |

---

### 8.6 Pipeline de Deploy

**Recomendado com Vercel (stack atual Next.js):**

```
Push → CI (GitHub Actions):
  ├─ lint + typecheck (tsc --noEmit)
  ├─ testes unitários (Vitest)
  ├─ build de produção
  └─ deploy preview automático (Vercel Preview URL)

Merge em staging:
  └─ deploy automático para ambiente de homologação

Merge em main:
  └─ deploy automático para produção
  └─ smoke tests pós-deploy
```

**Secrets:** Nunca commitar chaves. Usar Vercel Environment Variables com escopo por ambiente.

---

### 8.7 Documentação (OpenAPI/Swagger)

**Abordagem recomendada: Schema-first com Zod**

1. Definir schemas Zod para cada endpoint (input e output)
2. Usar `zod-openapi` para gerar spec OpenAPI 3.1
3. Servir documentação interativa em `/api/docs` (Swagger UI via `swagger-ui-react`)
4. Exportar `/api/openapi.json` para consumo por ferramentas externas

**Estrutura de arquivos:**

```
src/
  app/
    api/
      external/
        v1/
          grc/
            projects/
              route.ts          ← handler
              schema.ts         ← schemas Zod (validação + OpenAPI)
            visits/
              route.ts
              schema.ts
            cx/
              route.ts
              schema.ts
      docs/
        route.ts                ← serve Swagger UI
      openapi.json/
        route.ts                ← serve spec JSON
  lib/
    api-auth.ts                 ← authenticate() centralizado
    api-response.ts             ← helpers de resposta padronizados
    openapi.ts                  ← montagem do spec global
```

---

## 9. Backlog Priorizado

### Sprint 1 — Segurança e Foundation (urgente)

| ID | Tarefa | Tipo | Esforço |
|---|---|---|---|
| S1-01 | Rotacionar todas as chaves fracas (SETTINGS_KEY, PIPELINE_KEY, STORE_PUBLIC_KEY) | Segurança | P |
| S1-02 | Remover fallback hardcodado `'prodam2026'` do código-fonte | Segurança | P |
| S1-03 | Centralizar `authenticate()` em `src/lib/api-auth.ts` | Arquitetura | M |
| S1-04 | Remover `error.message` das respostas 500 em produção | Segurança | P |
| S1-05 | Configurar CORS explicitamente no `next.config.ts` | Segurança | P |

### Sprint 2 — Endpoints GRC (escrita)

| ID | Tarefa | Tipo | Esforço |
|---|---|---|---|
| S2-01 | Criar `GRC_API_KEY` dedicada para operações de escrita | Segurança | P |
| S2-02 | Implementar `POST /grc/projects` com validação Zod | Feature | G |
| S2-03 | Implementar `PATCH /grc/projects/:id` | Feature | M |
| S2-04 | Implementar `POST /grc/visits` com validação Zod | Feature | G |
| S2-05 | Implementar `PATCH /grc/visits/:id` | Feature | M |
| S2-06 | Implementar `POST /grc/cx` com validação Zod | Feature | G |
| S2-07 | Implementar `PATCH /grc/cx/:id` | Feature | M |
| S2-08 | Implementar `DELETE` para projects, visits e cx | Feature | M |

### Sprint 3 — Qualidade e Padronização

| ID | Tarefa | Tipo | Esforço |
|---|---|---|---|
| S3-01 | Adicionar paginação em `GET /contracts` | Melhoria | M |
| S3-02 | Mover filtros de contracts para queries Drizzle | Performance | M |
| S3-03 | Implementar `GET /api/health` | Operacional | P |
| S3-04 | Criar tabela `audit_log` e logar operações de escrita | Segurança | G |
| S3-05 | Filtrar `isVisible = false` no endpoint `/data` | Correção | P |

### Sprint 4 — Documentação e Infraestrutura

| ID | Tarefa | Tipo | Esforço |
|---|---|---|---|
| S4-01 | Implementar spec OpenAPI com Zod schemas | Documentação | GG |
| S4-02 | Servir Swagger UI em `/api/docs` | Documentação | M |
| S4-03 | Configurar ambiente de homologação (Turso branch) | Infra | G |
| S4-04 | Configurar pipeline CI/CD com GitHub Actions + Vercel | Infra | G |
| S4-05 | Implementar rate limiting com Upstash | Segurança | G |

### Sprint 5 — Evolução do Modelo de Autenticação

| ID | Tarefa | Tipo | Esforço |
|---|---|---|---|
| S5-01 | Criar tabela `api_consumers` com escopos | Segurança | GG |
| S5-02 | Migrar validação de chave para lookup no banco | Segurança | G |
| S5-03 | Implementar revogação individual de chaves | Segurança | M |

> **Legenda de esforço:** P = Pequeno (<2h) | M = Médio (2-4h) | G = Grande (4-8h) | GG = Extra Grande (>1 dia)

---

## 10. Roadmap de Execução

```
Mai/2026
  ├─ Sprint 1: Segurança imediata (S1-01 a S1-05)
  └─ Sprint 2 início: Endpoints GRC (S2-01 a S2-04)

Jun/2026
  ├─ Sprint 2 conclusão: Endpoints GRC (S2-05 a S2-08)
  └─ Sprint 3 início: Qualidade (S3-01 a S3-03)

Jul/2026
  ├─ Sprint 3 conclusão (S3-04, S3-05)
  └─ Sprint 4: Documentação + Infra (S4-01 a S4-05)

Ago/2026
  └─ Sprint 5: Modelo de autenticação evoluído (S5-01 a S5-03)
```

---

*Documento gerado com análise do código-fonte em 2026-05-11. Revisar e atualizar a cada ciclo de sprint.*
