import { CXStatus } from '@/types/manager';

export const STATUS_COLUMNS: { key: CXStatus; label: string }[] = [
    { key: 'pendente', label: 'Pendente' },
    { key: 'analise', label: 'Em Análise' },
    { key: 'resolvido', label: 'Resolvido' },
];

// Mesmas 3 opções que o Planner realmente usa (Urgente/Importante/Média —
// confirmado contra o export real de 132 tarefas; "Normal" quase não
// aparece nos dados reais, era suposição de uma amostra sintética menor) —
// o campo prioridade_texto é texto livre no banco, mas a UI só permite
// escolher entre essas 3 pra manter consistência com mapCriticidade
// (src/lib/planner-sync.ts).
export const PRIORIDADE_OPTIONS = ['Urgente', 'Importante', 'Média'] as const;
export type PrioridadeTexto = (typeof PRIORIDADE_OPTIONS)[number];

// Mesma paleta baixa/média/alta já usada em CXEditor.tsx (CRITICIDADE_OPTIONS)
// e CXTab.tsx (CRITICIDADE_CONFIG) — vermelho/amarelo/verde, sem inventar cor
// nova. Urgente é o único que mapeia pra 'alta'; Importante e Média mapeiam
// os dois pra criticidade 'media' (ver mapCriticidade em planner-sync.ts),
// mas continuam com cores distintas aqui pra dar pra diferenciar as duas
// visualmente no board — Importante fica no amarelo (mesma cor de 'media'),
// Média fica no verde (o tom mais "de baixa urgência" das 3, coerente com
// ser a opção mais comum e menos crítica dos dados reais).
export const PRIORIDADE_CONFIG: Record<PrioridadeTexto, { badge: string; border: string }> = {
    Urgente: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', border: 'border-l-red-500' },
    Importante: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-l-yellow-500' },
    Média: { badge: 'bg-green-500/20 text-green-400 border-green-500/30', border: 'border-l-green-500' },
};

// Fallback neutro pra item null/não-reconhecido — "Média" é o meio-termo das
// 3 opções reais (nem alarmante como Urgente, nem "sem prioridade").
export const PRIORIDADE_FALLBACK: PrioridadeTexto = 'Média';

export function prioridadeStyle(p: string | null | undefined) {
    if (p && (PRIORIDADE_OPTIONS as readonly string[]).includes(p)) {
        return PRIORIDADE_CONFIG[p as PrioridadeTexto];
    }
    return PRIORIDADE_CONFIG[PRIORIDADE_FALLBACK];
}
