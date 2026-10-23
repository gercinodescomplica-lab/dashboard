import type { CampoLista, LeadGrcc } from '@/lib/grcc/tipos';

// Stub temporário — a Task 11 substitui este arquivo inteiro.
export function LeadPainel(props: {
    aberto: boolean;
    lead: LeadGrcc | null;
    listas: Record<CampoLista, string[]>;
    onFechar: () => void;
    onGravado: (msg: string) => Promise<void>;
}) {
    void props;
    return null;
}
