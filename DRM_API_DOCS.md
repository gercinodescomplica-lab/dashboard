# DRM Dashboard External API Documentation

Esta documentação descreve como acessar os dados dos gerentes e do dashboard DRM através da API externa.

## Autenticação

A API utiliza autenticação **Bearer Token**. Você deve incluir a chave API no cabeçalho `Authorization` de todas as requisições.

**Cabeçalho:**
`Authorization: Bearer <SUA_CHAVE_API>`

A chave API está configurada no arquivo `.env` do projeto como `EXTERNAL_API_KEY`.

---

## Endpoints

### 1. Obter Dados Completos (Gerentes, Pipeline, CX e Visitas)

Retorna a estrutura completa de dados de todos os gerentes, incluindo projetos, pipeline, feedback de clientes (CX) e visitas.

- **URL:** `/api/external/v1/data`
- **Método:** `GET`
- **Formato:** `JSON`

#### Exemplo de Requisição (cURL):

```bash
curl -X GET http://localhost:3000/api/external/v1/data \
  -H "Authorization: Bearer FZb/kfOX6gsUB2ED0FeVSyMOakm7BKtNt5xACkg+zX8="
```

#### Estrutura da Resposta:

```json
{
  "success": true,
  "timestamp": "2026-03-19T20:10:50.000Z",
  "summary": {
    "totalManagers": 10,
    "totalMeta": 5000000,
    "totalContratado": 2500000,
    "totalForecast": 4000000,
    "totalVisits": 150,
    "totalCXItems": 45
  },
  "data": [
    {
      "id": "uuid",
      "name": "Nome do Gerente",
      "role": "Cargo",
      "meta": 1000000,
      "contratado": 500000,
      "forecastFinal": 1500000,
      "pipeline": {
        "q1": { "total": 0, "projects": [] },
        "q2": { "total": 0, "projects": [] },
        "q3": { "total": 0, "projects": [] },
        "q4": { "total": 0, "projects": [] },
        "nao_mapeado": { "total": 0, "projects": [] }
      },
      "cx": [
        {
          "cliente": "Cliente A",
          "titulo": "Feedback",
          "status": "pendente",
          "criticidade": "alta"
        }
      ],
      "visits": [
        {
          "titulo": "Visita Técnica",
          "local": "Sede Cliente",
          "data": "2026-03-20"
        }
      ]
    }
  ]
}
```

---

### 2. Listar Contratos

Retorna a lista de contratos da diretoria com suporte a filtros e busca.

- **URL:** `/api/external/v1/contracts`
- **Método:** `GET`
- **Query Params:**
  - `search`: Busca por número, cliente, gerente ou objeto.
  - `gerencia`: Filtra por código de gerência (ex: `GRC-1`).
  - `vigente`: `true` ou `false`.
  - `tipo`: `SUSTENTAÇÃO` ou `PROJETOS`.

#### Exemplo:
```bash
curl -X GET "http://localhost:3000/api/external/v1/contracts?search=ALESP&vigente=true" \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 3. Obter Detalhes de um Contrato

Retorna os detalhes de um contrato específico através do seu ID (UUID) ou Número do Contrato.

- **URL:** `/api/external/v1/contracts/[identifier]`
- **Método:** `GET`

#### Exemplo:
```bash
# Busca por número (URL encoded)
curl -X GET "http://localhost:3000/api/external/v1/contracts/TC%2089%2F2024-ALESP" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Códigos de Erro

- **401 Unauthorized:** Cabeçalho de autorização ausente ou mal formatado.
- **403 Forbidden:** Token de API inválido.
- **500 Internal Server Error:** Ocorreu um erro ao processar a requisição no servidor.
