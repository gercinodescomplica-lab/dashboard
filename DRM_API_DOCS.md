# DRM Dashboard External API Documentation

Esta documentação descreve como acessar os dados dos gerentes e do dashboard DRM através da API externa, ideal para integrações com Bots de IA e outras aplicações.

## Autenticação

A API utiliza autenticação **Bearer Token**. Você deve incluir a chave API no cabeçalho `Authorization` de todas as requisições.

**Cabeçalho:**
`Authorization: Bearer <SUA_CHAVE_API>`

A chave API está configurada no arquivo `.env` do projeto como `EXTERNAL_API_KEY`.

---

## Endpoints

### 1. Obter Dados de Gerentes e Pipeline
Retorna a estrutura completa de dados de todos os gerentes, incluindo projetos, pipeline, feedback de clientes (CX) e visitas.

- **URL:** `/api/external/v1/data`
- **Método:** `GET`

#### Exemplo:
```bash
curl -X GET http://localhost:3000/api/external/v1/data \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 2. Listar e Buscar Contratos
Retorna a lista de contratos da diretoria com suporte a filtros e busca textual. Este endpoint é ideal para o Bot de IA buscar contratos por termos genéricos.

- **URL:** `/api/external/v1/contracts`
- **Método:** `GET`
- **Parâmetros de Query:**
    - `search`: Busca textual que atua nos campos: Número do Contrato, Cliente, Nome do Gerente, Gerência e Objeto.
    - `gerencia`: Filtra por código de gerência específico (ex: `GRC-1`, `KAM-4`).
    - `vigente`: Filtra por status de vigência (`true` ou `false`).
    - `tipo`: Filtra por tipo de contrato (`SUSTENTAÇÃO` ou `PROJETOS`).

#### Estrutura da Resposta:
```json
{
  "success": true,
  "timestamp": "2026-04-28T13:54:00.000Z",
  "summary": {
    "total": 100,
    "vigentes": 85,
    "vencidos": 15,
    "totalVlContratado": 15000000.00,
    "totalVlFaturado": 8000000.00,
    "totalVlSaldo": 7000000.00
  },
  "data": [
    {
      "id": "uuid-do-contrato",
      "numeroContrato": "TC 001/2024",
      "cliente": "Nome do Cliente",
      "vlContratado": 150000.00,
      "vlSaldo": 50000.00,
      "vigente": true,
      "gerencia": "GRC-1",
      "nomeGerente": "Nome do Gerente Responsável",
      "objeto": "Descrição do que trata o contrato...",
      "dtFimVigencia": "2025-12-31"
    }
  ]
}
```

---

### 3. Obter Detalhes de um Contrato Específico
Retorna todos os dados de um contrato único. O identificador pode ser o ID interno (UUID) ou o Número do Contrato.

- **URL:** `/api/external/v1/contracts/[identifier]`
- **Método:** `GET`

#### Exemplo com Número do Contrato (URL Encoded):
```bash
# Para buscar "TC 89/2024-ALESP"
curl -X GET "http://localhost:3000/api/external/v1/contracts/TC%2089%2F2024-ALESP" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Campos do Objeto Contrato:
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `numeroContrato` | string | Identificador oficial do contrato. |
| `protheus` | string | Código de referência no sistema Protheus. |
| `cliente` | string | Nome do órgão ou empresa cliente. |
| `vlContratado` | number | Valor total previsto no contrato. |
| `vlFaturado` | number | Valor que já foi emitido nota fiscal/faturado. |
| `vlSaldo` | number | Valor restante (pode ser negativo em alguns casos específicos). |
| `tipo` | string | Geralmente 'SUSTENTAÇÃO' ou 'PROJETOS'. |
| `situacao` | string | Status textual (ex: 'Vigente', 'Encerrado'). |
| `vigente` | boolean | Indicador simplificado se o contrato está ativo. |
| `gerencia` | string | Código da gerência responsável (ex: GRC-1). |
| `objeto` | string | Descrição detalhada do escopo do contrato. |
| `dtFimVigencia` | string | Data de término (formato YYYY-MM-DD). |

---

## Códigos de Erro

- **401 Unauthorized:** Cabeçalho de autorização ausente ou mal formatado.
- **403 Forbidden:** Token de API inválido.
- **404 Not Found:** Recurso (contrato) não encontrado para o identificador fornecido.
- **500 Internal Server Error:** Erro genérico no servidor.
