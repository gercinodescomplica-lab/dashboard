import type { LeadGrcc, ProjetoManual } from '@/lib/grcc/tipos';

// Stub temporário — a Task 12 substitui este arquivo inteiro.
export function ImportarExcelDialog(props: {
    aberto: boolean;
    leadsAtuais: LeadGrcc[];
    projetosManuais: ProjetoManual[];
    onFechar: () => void;
    onGravado: (msg: string) => Promise<void>;
}) {
    void props;
    return null;
}
