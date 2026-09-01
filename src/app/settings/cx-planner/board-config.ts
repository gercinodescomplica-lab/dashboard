import { CXStatus } from '@/types/manager';

// statusForBucketName / percentForStatus vivem em src/lib/cx-status.ts (também
// usados pelo import do Planner) — re-exportados aqui pra quem já importa de
// board-config.
export { statusForBucketName, percentForStatus } from '@/lib/cx-status';

// Rótulos de status para o badge read-only do modal. O status não é editável
// direto — é herdado do bucket em que o card está (ver statusForBucketName).
// A aba CX do gerente (CXTab.tsx) continua lendo esse enum.
export const STATUS_LABELS: Record<CXStatus, string> = {
    pendente: 'Pendente',
    analise: 'Em Análise',
    resolvido: 'Resolvido',
};

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
// badgeLight usa as mesmas classes de CRITICIDADE_CONFIG.chipStyleLight em
// CXTab.tsx (bg-*-100/text-*-800/border-*-400) — o badge translúcido do tema
// escuro (bg-*-500/20 text-*-400) fica com contraste ruim em fundo branco.
export const PRIORIDADE_CONFIG: Record<PrioridadeTexto, { badge: string; badgeLight: string; border: string }> = {
    Urgente: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', badgeLight: 'bg-red-100 text-red-800 border-red-400', border: 'border-l-red-500' },
    Importante: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', badgeLight: 'bg-yellow-100 text-yellow-800 border-yellow-400', border: 'border-l-yellow-500' },
    Média: { badge: 'bg-green-500/20 text-green-400 border-green-500/30', badgeLight: 'bg-green-100 text-green-800 border-green-400', border: 'border-l-green-500' },
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
