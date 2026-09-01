import type { CXBoardItem } from '@/db/queries';

// Sentinela da coluna virtual "Entrada" (itens com bucket_id = null). Usada
// como valor de filtro tanto no board quanto na query string do export.
export const ENTRADA_KEY = 'entrada';

export interface CXFilterParams {
    q?: string;
    manager?: string;
    cliente?: string;
    bucket?: string; // '' | ENTRADA_KEY | String(bucketId)
    responsavel?: string; // '' | 'none' | String(userId)
    prioridade?: string;
}

// Predicado único de filtragem do board de CX — compartilhado entre a
// renderização das colunas (CXPlannerBoard) e o export Excel (route.ts), pra
// a planilha baixada sempre bater com o que está visível no board. Param
// vazio/ausente = não filtra por aquele campo (board inteiro).
export function filterCXBoardItems(items: CXBoardItem[], f: CXFilterParams): CXBoardItem[] {
    const q = (f.q ?? '').trim().toLowerCase();

    return items.filter((item) => {
        if (f.manager && item.managerId !== f.manager) return false;
        if (f.cliente && item.cliente !== f.cliente) return false;
        if (f.bucket === ENTRADA_KEY && item.bucketId != null) return false;
        if (f.bucket && f.bucket !== ENTRADA_KEY && String(item.bucketId) !== f.bucket) return false;
        if (f.responsavel === 'none' && item.responsavelId != null) return false;
        if (f.responsavel && f.responsavel !== 'none' && String(item.responsavelId) !== f.responsavel) return false;
        if (f.prioridade && item.prioridadeTexto !== f.prioridade) return false;

        if (!q) return true;
        const haystack = [
            item.managerName,
            item.cliente,
            item.titulo,
            item.problema,
            item.solucaoProposta,
            item.subtitulo,
            item.responsavelName,
            item.prioridadeTexto,
            item.dataInicio,
            item.dataFim,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });
}

export function cxFilterParamsFromSearch(sp: URLSearchParams): CXFilterParams {
    return {
        q: sp.get('q') ?? undefined,
        manager: sp.get('manager') ?? undefined,
        cliente: sp.get('cliente') ?? undefined,
        bucket: sp.get('bucket') ?? undefined,
        responsavel: sp.get('responsavel') ?? undefined,
        prioridade: sp.get('prioridade') ?? undefined,
    };
}
