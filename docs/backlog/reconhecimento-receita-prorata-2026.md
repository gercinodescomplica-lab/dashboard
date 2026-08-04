# Feature Backlog: Reconhecimento de Receita Pro-Rata 2026 ("Dinheiro Novo")

> **Status:** Backlog / Planejado  
> **Prioridade:** Média / Alta  
> **Área:** Dashboard Comercial (Ranking de Gerentes e Atingimento de Meta)  
> **Data de Criação:** 2026-07-29  

---

## 1. Visão Geral e Motivação

Atualmente, quando um gerente fecha um contrato ou oportunidade (ex: R$ 1.000.000 com duração de 12 meses em Setembro/2026), o dashboard contabiliza o **valor total bruto** do contrato no ano corrente.

No entanto, para fins de meta e faturamento real de 2026, apenas os meses vigentes dentro do ano de 2026 (Outubro, Novembro e Dezembro = 3 meses) representam "dinheiro novo" para 2026 (`R$ 250.000`). Os 9 meses restantes (`R$ 750.000`) pertencem ao exercício de 2027.

Esta funcionalidade visa calcular e exibir a **receita reconhecida pro-rata** para o ano de 2026 no Ranking de Gerentes e nos KPIs executivos.

---

## 2. Regra de Negócio

Para qualquer contrato ou oportunidade fechada com vigência determinada:

$$ \text{Valor Mensal} = \frac{\text{Valor Total do Contrato}}{\text{Duração em Meses}} $$

$$ \text{Receita Reconhecida 2026} = \text{Valor Mensal} \times \text{Nº de Meses em 2026} $$

### Exemplo Prático:
* **Valor Total:** R$ 1.000.000 (12 meses)
* **Início da Vigência:** 01/10/2026
* **Meses em 2026:** 3 meses (Out, Nov, Dez)
* **Receita 2026:** $(1.000.000 / 12) \times 3 = \mathbf{R\$\ 250.000}$
* **Receita 2027:** $(1.000.000 / 12) \times 9 = \mathbf{R\$\ 750.000}$

---

## 3. Abordagens de Arquitetura

### Opção A: Cálculo Dinâmico por Datas (Recomendada)
Adicionar campos de data (`dtInicioVigencia` e `dtFimVigencia` / `duracaoMeses`) na entidade do projeto/contrato e calcular dinamicamente a parcela do ano selecionado via helper.

**Vantagens:**
* Flexível quando o usuário altera o filtro de ano no topo do dashboard (`2026`, `2027`, etc.).
* Automatizado a partir da data de início.

### Opção B: Campo Explícito `valorAnoCorrente`
Armazenar diretamente o valor rateado para o ano corrente no banco de dados.

---

## 4. Plano de Implementação Técnica

### 4.1. Helper Utilitário (`src/lib/calc.ts`)
Criar função para cálculo pro-rata de receita:

```typescript
export function calculateYearlyRecognizedRevenue(
    totalValue: number,
    startDateStr: string,
    durationMonths: number,
    targetYear: number = 2026
): number {
    if (!totalValue || !startDateStr || !durationMonths) return totalValue;
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59);

    if (startDate > yearEnd || endDate < yearStart) return 0;

    const overlapStart = startDate > yearStart ? startDate : yearStart;
    const overlapEnd = endDate < yearEnd ? endDate : yearEnd;

    const monthsInYear = Math.max(0, 
        (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 + 
        (overlapEnd.getMonth() - overlapStart.getMonth()) + 1
    );

    const monthlyValue = totalValue / durationMonths;
    return Math.min(totalValue, monthlyValue * monthsInYear);
}
```

### 4.2. Alterações nos Arquivos

| Arquivo | Mudança Necessária |
| :--- | :--- |
| `src/types/manager.ts` | Inserir campos `startDate` e `durationMonths` no tipo `Project` / `Contrato`. |
| `src/db/schema.ts` | Adicionar colunas correspondentes na tabela SQLite `projects`. |
| `src/lib/calc.ts` | Integrar a função pro-rata em `sumPipelineContratado` e `calcEffectiveContratado`. |
| `src/components/dashboard/DRMOverview.tsx` | Atualizar os cards de KPI (Contratado, Forecast, Gap) e o Ranking de Gerentes para utilizar o valor apurado pro-rata. |

---

## 5. Critérios de Aceite

- [ ] Contratos iniciados no meio do ano dividem o valor proporcionalmente pelos meses restantes do ano corrente.
- [ ] O Ranking de Gerentes reflete o percentual de atingimento com base apenas no "dinheiro novo" de 2026.
- [ ] O valor total do contrato continua visível em detalhes/detalhamento do projeto, mas não distorce o total anual.
- [ ] Troca de ano no cabeçalho recalcula automaticamente a receita reconhecida para o ano selecionado.
