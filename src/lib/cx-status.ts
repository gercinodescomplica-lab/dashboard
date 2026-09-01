import { CXStatus } from '@/types/manager';

// Deriva o status (enum de 3 valores usado pela aba CX do gerente) a partir
// do NOME do bucket em que o card está no board /settings/cx-planner. Ao
// arrastar um card pra outra coluna, o status passa a refletir o bucket de
// destino — ex.: soltar em "Concluído" marca como resolvido. Buckets criados
// pelo usuário são classificados pelo texto do nome; o que não bater
// "concluído" nem "pendente" cai em "Em Análise". bucket null (coluna
// "Entrada") = pendente (ainda não triado).
export function statusForBucketName(name: string | null | undefined): CXStatus {
    const n = (name ?? '').toLowerCase();
    if (!n) return 'pendente';
    if (/(conclu|resolv|finaliz|encerr|entreg|fech|feito|done|pronto)/.test(n)) return 'resolvido';
    if (/(pendente|aguard|backlog|a fazer|triagem|entrada|não iniciad|nao iniciad|novo|aberto)/.test(n)) return 'pendente';
    return 'analise';
}

// Ao herdar o status do bucket, só forçamos o % quando vira "resolvido"
// (barra cheia = 100). Nos outros casos o % de progresso é preservado —
// menos destrutivo e mais previsível.
export function percentForStatus(status: CXStatus, current: number): number {
    return status === 'resolvido' ? 100 : current;
}
