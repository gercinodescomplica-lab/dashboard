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
    "totalContratos": 100,
    "breakdown": {
      "vigentes": 85,
      "vencidos": 15
    },
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

### 4. Analytics de Contratos (pré-computado para IA)
Retorna um resumo analítico completo, com todos os cálculos já feitos no servidor. Ideal para o Bot de IA responder perguntas sem precisar fazer matemática.

- **URL:** `/api/external/v1/contracts/analytics`
- **Método:** `GET`
- **Cache:** 15 minutos

#### Exemplo:
```bash
curl -X GET https://seu-dominio.com/api/external/v1/contracts/analytics \
  -H "Authorization: Bearer <TOKEN>"
```

#### Estrutura da Resposta:
```json
{
  "success": true,
  "timestamp": "2026-04-28T14:30:00.000Z",
  "geradoEm": "28/04/2026 às 14:30",

  "visaoGeral": {
    "total": 100,
    "vigentes": 99,
    "vencidos": 1,
    "totalVlContratado": 1027226970.79,
    "totalVlFaturado": 353108730.37,
    "totalVlSaldo": 674118240.42,
    "totalVlContratadoFormatted": "R$ 1.027.226.970,79",
    "totalVlFaturadoFormatted": "R$ 353.108.730,37",
    "totalVlSaldoFormatted": "R$ 674.118.240,42"
  },

  "porGerencia": [
    {
      "gerencia": "GRC-4",
      "totalContratos": 32,
      "vigentes": 32,
      "vencidos": 0,
      "vlContratadoTotal": 45842239.04,
      "vlContratadoTotalFormatted": "R$ 45.842.239,04",
      "vlSaldoTotal": 38000000.00,
      "vlSaldoTotalFormatted": "R$ 38.000.000,00"
    }
  ],

  "porTipo": [
    { "tipo": "SUSTENTAÇÃO", "total": 98, "vlContratadoTotal": 1024317221.83, "vlContratadoTotalFormatted": "R$ 1.024.317.221,83" },
    { "tipo": "PROJETOS", "total": 2, "vlContratadoTotal": 2909748.96, "vlContratadoTotalFormatted": "R$ 2.909.748,96" }
  ],

  "vencimentos": {
    "vencidosAtualmente": [],
    "vencendoHoje": [],
    "vencendoEm7Dias": [],
    "vencendoEsteMes": [
      {
        "numeroContrato": "24/SEGES/2025",
        "cliente": "SEGES",
        "gerencia": "KAM-3",
        "nomeGerente": "...",
        "dtFimVigencia": "2026-04-30",
        "diasRestantes": 2,
        "vlContratado": 45144753.06,
        "vlContratadoFormatted": "R$ 45.144.753,06",
        "vlSaldo": 45144753.06,
        "vlSaldoFormatted": "R$ 45.144.753,06",
        "objeto": "..."
      }
    ],
    "vencendoProximoMes": [],
    "vencendoEm90Dias": [],
    "vencendoEm180Dias": [],
    "vencendoEsteAno": [],
    "totalVencendoEm90Dias": 22,
    "vlTotalVencendoEm90Dias": 95000000.00,
    "vlTotalVencendoEm90DiasFormatted": "R$ 95.000.000,00"
  },

  "destaques": {
    "proximoAVencer": { "numeroContrato": "...", "diasRestantes": 2, "vlContratadoFormatted": "R$ 45.144.753,06" },
    "maiorValorContratado": { "numeroContrato": "105/2025-SMS-1/CONTRATOS", "cliente": "FMS", "vlContratadoFormatted": "R$ 212.974.949,70" },
    "menorValorContratado": { "numeroContrato": "082/2024-ADESAMPA", "vlContratadoFormatted": "R$ 15.058,68" },
    "maiorSaldoAReceber": { "numeroContrato": "105/2025-SMS-1/CONTRATOS", "vlSaldoFormatted": "R$ 198.776.619,70" },
    "clientesComMaisContratos": [
      { "cliente": "SF", "totalContratos": 6 },
      { "cliente": "HSPM", "totalContratos": 5 }
    ]
  }
}
```

> **Nota para o Bot de IA:** Use `visaoGeral.total` para o total de contratos. Os campos `vigentes` e `vencidos` são subdivisões — não os some ao total.

---

## Códigos de Erro

- **401 Unauthorized:** Cabeçalho de autorização ausente ou mal formatado.
- **403 Forbidden:** Token de API inválido.
- **404 Not Found:** Recurso (contrato) não encontrado para o identificador fornecido.
- **500 Internal Server Error:** Erro genérico no servidor.
