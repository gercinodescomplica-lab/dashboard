# Feature Backlog: Acordeão de Histórico e Auditoria de Mudanças em Projetos

> **Status:** Backlog / Planejado  
> **Prioridade:** Média  
> **Área:** Dashboard Comercial (Aba Projetos / Pipeline)  
> **Data de Criação:** 2026-07-29  

---

## 1. Visão Geral

Na tela de listagem do **Pipeline de Projetos** ([ProjectsTab.tsx](file:///Users/User/Documents/Development/prodam/DRM/dashboard%20comercial/src/components/dashboard/tabs/ProjectsTab.tsx)), implementar uma funcionalidade de **linha expandida (acordeão)** em cada linha da tabela.

Ao expandir um projeto, o usuário poderá visualizar o **histórico cronológico completo de mudanças** que ocorreram naquela oportunidade, incluindo:
* Mudanças de temperatura/status (ex: `❄️ Frio` ➔ `🟡 Morno` ➔ `🔥 Quente`).
* Alterações no valor do projeto (ex: `R$ 3.000.000` ➔ `R$ 4.000.000`).
* Reagendamentos de trimestre (ex: `Q1` ➔ `Q3`).
* Justificativas, notas e observações inseridas pelo gerente.

---

## 2. Experiência de Usuário (UX) & Design

1. **Indicador Visual na Tabela**:
   * Adicionar um botão de expansão (`ChevronRight` / `ChevronDown`) na primeira coluna de cada projeto.
   * Exibir uma badge sutil se o projeto possuir histórico gravado (ex: `3 histórico(s)`).

2. **Painel do Acordeão (Expanded Row)**:
   * Container escuro (`zinc-900/80` com borda `zinc-800`) que surge abaixo da linha selecionada sem quebrar o layout da tabela.
   * **Linha do Tempo Vertical (Timeline)**:
     * Ícones coloridos por categoria de alteração.
     * Exibição clara de valores antigos vs. novos (`De: X` ➔ `Para: Y`).
     * Data e autor da mudança.
   * **Fallback Inteligente**: Se o projeto não possuir histórico formal cadastrado no banco, mas possuir descrições como *"Adiado do Q1 para Q3"*, o acordeão parseará esse texto para exibir como um evento inicial na timeline.

---

## 3. Modelo de Dados Propôs (`ProjectHistoryItem`)

### Atualização em `src/types/manager.ts`:

```typescript
export type HistoryChangeType = 'status' | 'valor' | 'quarter' | 'nota';

export interface ProjectHistoryItem {
  id?: string;
  date: string;           // Ex: "2026-06-15"
  tipo: HistoryChangeType;
  de?: string;            // Ex: "Q1" ou "R$ 3.000.000"
  para?: string;          // Ex: "Q3" ou "R$ 4.000.000"
  justificativa?: string; // Ex: "Cliente solicitou adiamento por revisão orçamentária"
  autor?: string;         // Ex: "Bruno Ítalo"
}

export interface Project {
  orgao?: string;
  name: string;
  value: number;
  temperature?: OpportunityTemperature;
  description?: string;
  history?: ProjectHistoryItem[]; // Nova propriedade opcional
}
```

---

## 4. Plano de Implementação Técnica

| Arquivo | Descrição das Alterações |
| :--- | :--- |
| `src/types/manager.ts` | Adicionar interface `ProjectHistoryItem` e atributo `history` em `Project`. |
| `src/db/schema.ts` | Adicionar coluna `history` (JSON string) na tabela SQLite `projects`. |
| `src/db/queries.ts` | Fazer o parse/stringification de `history` no retorno do banco de dados. |
| `src/components/dashboard/tabs/ProjectsTab.tsx` | Adicionar estado `expandedRowId`, botão de toggle e o componente visual de timeline dentro da `<tr>` expandida. |

---

## 5. Critérios de Aceite

- [ ] Clicar na linha do projeto (ou no ícone de seta) abre e fecha o acordeão suavemente.
- [ ] A timeline do acordeão exibe cronologicamente todas as alterações de status, valor, quarter e texto.
- [ ] O visual do acordeão mantém o padrão Dark Mode do dashboard (tons `zinc-900`, `indigo-400`, `emerald-400`).
- [ ] O rodapé do totalizador do pipeline continua funcionando perfeitamente.
