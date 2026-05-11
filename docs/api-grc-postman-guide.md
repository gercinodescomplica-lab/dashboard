# API GRC — Guia de Uso (Postman)

> Referência rápida para criar projetos, visitas e itens de CX via API.
> Base URL dev: `http://localhost:6000`

---

## Autenticação

Todos os endpoints exigem um Bearer Token no header `Authorization`.

| Operação | Chave (`env`) | Valor atual (dev) |
|---|---|---|
| Leitura (contratos, data) | `EXTERNAL_API_KEY` | `FZb/kfOX6gsUB2ED0FeVSyMOakm7BKtNt5xACkg+zX8=` |
| Escrita GRC (projetos, visitas, CX) | `GRC_API_KEY` | `dev-grc-key-change-in-prod` |

**Header obrigatório em todas as requisições de escrita:**
```
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json
```

---

## IDs dos Gerentes

| Nome | `managerId` | Gerência |
|---|---|---|
| Malde | `kam1-malde` | KAM1 |
| Bruno Ítalo | `grc1-bruno` | GRC1 |
| Paulo Rogério | `grc2-paulo` | GRC2 |
| Barone | `grc3-barone` | GRC3 |
| Beatriz | `grc4-beatriz` | GRC4 |
| Débora | `grcc-debora` | GRCC |
| Andrea | `kam3-andrea` | KAM3 |
| Betone | `kam2-betone` | KAM2 |
| Tomiatto | `kam4-tomiatto` | KAM4 |
| Tríade Digital | `projeto-triade` | Tríade Digital |

---

## 1. Criar CX (Problema / Risco)

**`POST /api/external/v1/grc/cx`**

### Campos

| Campo | Tipo | Obrigatório | Valores aceitos |
|---|---|---|---|
| `managerId` | string | ✅ | IDs da tabela acima |
| `cliente` | string | ✅ | Nome do cliente/órgão |
| `titulo` | string | ✅ | Título resumido |
| `problema` | string | ✅ | Descrição do problema |
| `solucaoProposta` | string | ✅ | Ação proposta |
| `criticidade` | string | — | `"baixa"` `"media"` `"alta"` (default: `"baixa"`) |
| `status` | string | — | `"pendente"` `"analise"` `"resolvido"` (default: `"pendente"`) |
| `isVisible` | boolean | — | `true` / `false` (default: `true`) |

### Exemplo — novo CX para Malde

```http
POST http://localhost:6000/api/external/v1/grc/cx
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "managerId": "kam1-malde",
  "cliente": "SMPED",
  "titulo": "Atraso na entrega de relatórios mensais",
  "problema": "Cliente não está recebendo os relatórios de execução dentro do prazo contratual de 5 dias úteis.",
  "solucaoProposta": "Mapear gargalo no processo de geração e agendar reunião de alinhamento com o time técnico.",
  "criticidade": "alta",
  "status": "pendente"
}
```

### Resposta de sucesso (`201 Created`)

```json
{
  "success": true,
  "data": {
    "id": 42,
    "managerId": "kam1-malde",
    "cliente": "SMPED",
    "titulo": "Atraso na entrega de relatórios mensais",
    "problema": "Cliente não está recebendo os relatórios...",
    "solucaoProposta": "Mapear gargalo no processo...",
    "criticidade": "alta",
    "status": "pendente",
    "isVisible": true,
    "createdAt": "2026-05-11T14:00:00.000Z"
  }
}
```

---

## 2. Atualizar CX existente

**`PATCH /api/external/v1/grc/cx/:id`**

Use o `id` retornado na criação (ou visível na tela do dashboard).
Envie apenas os campos que quer alterar — os demais permanecem iguais.

### Exemplo — marcar CX como resolvido

```http
PATCH http://localhost:6000/api/external/v1/grc/cx/42
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "status": "resolvido"
}
```

### Exemplo — alterar criticidade e solução

```http
PATCH http://localhost:6000/api/external/v1/grc/cx/42
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "criticidade": "media",
  "solucaoProposta": "Reunião realizada. Novo processo definido com prazo de entrega D+3."
}
```

---

## 3. Criar Visita

**`POST /api/external/v1/grc/visits`**

### Campos

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `managerId` | string | ✅ | ID do gerente |
| `titulo` | string | ✅ | Título da visita |
| `local` | string | ✅ | Endereço ou nome do local |
| `motivo` | string | ✅ | Motivo / pauta |
| `data` | string | ✅ | Formato `YYYY-MM-DD` |
| `dataFim` | string | — | Formato `YYYY-MM-DD`. Deve ser ≥ `data` |

### Exemplo — nova visita para Malde

```http
POST http://localhost:6000/api/external/v1/grc/visits
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "managerId": "kam1-malde",
  "titulo": "Reunião de alinhamento contratual",
  "local": "SMPED — Rua Líbero Badaró, 119 — Centro, SP",
  "motivo": "Discussão sobre renovação do contrato e apresentação de resultados do Q1.",
  "data": "2026-05-20",
  "dataFim": "2026-05-20"
}
```

### Resposta de sucesso (`201 Created`)

```json
{
  "success": true,
  "data": {
    "id": 17,
    "managerId": "kam1-malde",
    "titulo": "Reunião de alinhamento contratual",
    "local": "SMPED — Rua Líbero Badaró, 119 — Centro, SP",
    "motivo": "Discussão sobre renovação do contrato...",
    "data": "2026-05-20",
    "dataFim": "2026-05-20",
    "createdAt": "2026-05-11T14:05:00.000Z"
  }
}
```

---

## 4. Atualizar Visita existente

**`PATCH /api/external/v1/grc/visits/:id`**

### Exemplo — corrigir data e local

```http
PATCH http://localhost:6000/api/external/v1/grc/visits/17
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "data": "2026-05-22",
  "dataFim": "2026-05-22",
  "local": "Teams (remoto)"
}
```

---

## 5. Criar Projeto (Pipeline)

**`POST /api/external/v1/grc/projects`**

### Campos

| Campo | Tipo | Obrigatório | Valores aceitos |
|---|---|---|---|
| `managerId` | string | ✅ | ID do gerente |
| `quarter` | string | ✅ | `"q1"` `"q2"` `"q3"` `"q4"` `"nao_mapeado"` |
| `name` | string | ✅ | Nome do projeto |
| `value` | number | ✅ | Valor em reais (número, sem formatação) |
| `orgao` | string | — | Órgão / cliente |
| `temperature` | string | — | `"quente"` `"morno"` `"frio"` `"contratado"` `"historico"` `"perdido"` |
| `description` | string | — | Descrição / observações |

### Exemplo — novo projeto para Malde no Q3

```http
POST http://localhost:6000/api/external/v1/grc/projects
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "managerId": "kam1-malde",
  "quarter": "q3",
  "orgao": "SMPED",
  "name": "Modernização do Sistema de Acessibilidade Digital",
  "value": 1200000,
  "temperature": "morno",
  "description": "Projeto em fase de levantamento de requisitos. Contratação prevista para Q3/2026."
}
```

### Resposta de sucesso (`201 Created`)

```json
{
  "success": true,
  "data": {
    "id": 88,
    "managerId": "kam1-malde",
    "quarter": "q3",
    "orgao": "SMPED",
    "name": "Modernização do Sistema de Acessibilidade Digital",
    "value": 1200000,
    "temperature": "morno",
    "description": "Projeto em fase de levantamento de requisitos..."
  }
}
```

---

## 6. Atualizar Projeto existente

**`PATCH /api/external/v1/grc/projects/:id`**

### Exemplo — projeto aqueceu, mover para Q2

```http
PATCH http://localhost:6000/api/external/v1/grc/projects/88
Authorization: Bearer dev-grc-key-change-in-prod
Content-Type: application/json

{
  "quarter": "q2",
  "temperature": "quente"
}
```

---

## Respostas de erro

### `400` — Campo inválido

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    { "field": "quarter", "message": "Invalid enum value. Expected 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado'" },
    { "field": "value", "message": "Number must be greater than or equal to 0" }
  ]
}
```

### `400` — Body sem nenhum campo (PATCH)

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [
    { "field": "", "message": "At least one field must be provided for update." }
  ]
}
```

### `401` — Sem header de autenticação

```json
{
  "success": false,
  "error": "Missing or invalid Authorization header"
}
```

### `403` — Chave incorreta

```json
{
  "success": false,
  "error": "Invalid Bearer Token"
}
```

### `404` — Gerente ou recurso não encontrado

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Gerente 'kam1-maldee' não encontrado."
}
```

---

## Checklist para configurar no Postman

1. Criar uma **Collection** chamada `Dashboard DRM — GRC API`
2. Na aba **Variables** da collection, adicionar:
   - `base_url` = `http://localhost:6000`
   - `grc_token` = `dev-grc-key-change-in-prod`
3. Na aba **Authorization** da collection, selecionar `Bearer Token` e usar `{{grc_token}}`
4. Todas as requests herdam o token automaticamente — só precisar configurar uma vez
