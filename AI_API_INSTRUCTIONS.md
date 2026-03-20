# Instruções para IAs: Integração com a API do Dashboard DRM

Este documento foi desenhado especificamente para **Agentes de Inteligência Artificial** que precisem consumir e interpretar os dados do Dashboard Comercial (DRM) provenientes da API.

## 1. Informações de Conexão

Sempre que o usuário pedir para você consultar "os dados do dashboard", "os gerentes", "a DRM" ou "a API externa", você deverá realizar uma requisição HTTP **GET** no seguinte endpoint:

*   **URL Base:** (Determine o host de acordo com o ambiente, ex: `http://localhost:6000` em dev, ou a URL de produção na Vercel). O endpoint é `/api/external/v1/data`.
*   **Método:** `GET`
*   **Autenticação:** O sistema requer um **Bearer Token**. No ambiente do usuário, procure pela variável `EXTERNAL_API_KEY` (no arquivo `.env`) e injete no cabeçalho:
    `Authorization: Bearer <VALOR_DO_TOKEN>`
*   **Headers:** `Content-Type: application/json`

---

## 2. Estrutura e Semântica do JSON

Quando a requisição for bem-sucedida (Status `200 OK`), a API responderá com um JSON estruturado em **3 partes principais**:

```json
{
  "success": true,
  "timestamp": "2026-03-20T10:00:00.000Z",
  "summary": { ... },
  "data": [ ... ]
}
```

### 2.1 O objeto `summary` (Visão Macro / DRM)
Se o usuário fizer perguntas gerais como _"Qual é o total contratado da DRM?"_ ou _"Qual o atingimento geral?"_, **NÃO itere** sobre a lista de gerentes. Leia os valores imediatamente dentro de `summary`:

*   `totalManagers`: Quantidade de gerentes cadastrados.
*   `totalMeta`: A soma de todas as metas individuais de venda do ano.
*   `totalContratado`: O valor financeiro já garantido/assinado por toda a diretoria.
*   `totalForecast`: A expectativa de fechamento total (Contratado + Todo o Pipeline).
*   `totalVisits` e `totalCXItems`: Totais consolidados de visitas realizadas e chamados de CX abertos na diretoria.

### 2.2 O array `data` (Visão Micro / Gerentes Individuais)
Se o usuário perguntar sobre um gerente específico ou pedir um ranking, itere sobre o array `data`. Cada objeto dentro de `data` representa um Gerente (ex: Bruno Ítalo, Ju Ferreira) e contém:

*   **Identificação:** `name` (Nome real do gerente), `role` (Cargo/Área, ex: 'GRC1', 'KAM1').
*   **KPIs Financeiros:**
    *   `meta`: Meta de vendas do gerente para o ano.
    *   `contratado`: Valor que o gerente já assinou/recebeu.
    *   `forecastFinal`: Projeção final do gerente (`contratado` + soma de todos os projetos em pipeline).
*   **Clientes Atendidos (`servedClients`):**
    *   Uma lista (`array` de `strings`) com o nome dos órgãos e secretarias que aquele gerente atende (Ex: `["PGM (Procuradoria...)", "SMCC (...)"]`).
    *   *Uso pela IA:* Se o usuário perguntar _"Quais clientes o Bruno atende?"_, procure o objeto onde `name == "Bruno Ítalo"` e liste os itens de `servedClients`.
*   **Pipeline (`pipeline`):**
    *   Contém os projetos que estão em fase de venda, divididos por trimestre temporal (`q1`, `q2`, `q3`, `q4`, `nao_mapeado`).
    *   Dentro de cada quarter há um `total` (soma monetária) e um array de `projects`.
    *   Cada projeto possui `name` (Nome do projeto), `value` (Valor potencial em Reais) e `temperature` (`quente`, `morno`, `frio`).
    *   *Uso pela IA:* Se o usuário perguntar _"Quais os projetos quentes do Paulo?"_, filtre `pipeline -> {quarters} -> projects -> temperature == quente`.
*   **Customer Experience (`cx`):**
    *   Array de chamados/feedbacks abertos por clientes da carteira daquele gerente.
    *   Possui os status `pendente`, `analise` ou `resolvido`, e criticidades `baixa`, `media` ou `alta`.
*   **Visitas Comerciais (`visits`):**
    *   Log das visitas/reuniões feitas pelo gerente (`titulo`, `local`, `motivo`, `data`, `dataFim`).

---

## 3. Diretrizes de Comportamento e Resposta da IA

Quando você, IA, for extrair dados deste endpoint para responder ao usuário:

1.  **Contextualize financeiramente:** Ao ler os campos como `meta`, `contratado`, `forecastFinal` ou `value` dos projetos, sempre os formate e os apresente como valores monetários em Reais (R$).
2.  **Calcule Gap e Percentual se necessário:**
    *   **GAP a contratar:** `Meta - Contratado`.
    *   **Atingimento (%):** `(Forecast Final / Meta) * 100`.
3.  **Use Dados Reais:** Confie nos dados estruturados dentro de `servedClients` para listar clientes e evite inventar ou deduzir quais órgãos pertencem a quem. O que está na API é a fonte da verdade.
4.  **Resuma listas densas:** Se o usuário pedir "a carteira do Barone" e o `servedClients` tiver 15 nomes, liste-os claramente em bullet points utilizando o markdown adequado.
5.  **Não exponha a Chave da API:** Ao mostrar exemplos ou explicar o que você consumiu, nunca mostre a variável do `.env` no texto em claro para o usuário final em um cenário de produção.
