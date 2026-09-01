'use server';

import {
    fetchAllCXItemsForBoard,
    fetchCXItemById,
    deleteCXItem,
    fetchManagersList,
    fetchManagerById,
    createCXItem,
    updateCXItem,
    fetchCXBuckets,
    createCXBucket,
    renameCXBucket,
    swapCXBucketPositions,
    setCXBucketPositions,
    deleteCXBucket,
    fetchCXUsers,
    createCXUser,
    updateCXUser,
    deleteCXUser,
    CXBoardItem,
    CXBucket,
    CXUser,
} from '@/db/queries';
import { mapCriticidade } from '@/lib/planner-sync';
import { CXStatus } from '@/types/manager';
import { statusForBucketName, percentForStatus } from './board-config';

export type CXPlannerFormValues = {
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    subtitulo: string;
    dataInicio: string;
    dataFim: string;
    percentComplete: number;
    prioridadeTexto: string;
    responsavelId: number | null;
    bucketId: number | null;
    isVisible: boolean;
};

type CXItemPatch = Partial<{
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    subtitulo: string | null;
    status: CXStatus;
    criticidade: 'baixa' | 'media' | 'alta';
    dataInicio: string | null;
    dataFim: string | null;
    percentComplete: number | null;
    prioridadeTexto: string | null;
    responsavelId: number | null;
    bucketId: number | null;
    isVisible: boolean;
}>;

function normalizeDate(v: string): string | null {
    return v.trim() === '' ? null : v;
}

// status é herdado do bucket em que o card está (nome do bucket -> enum).
// bucket null (coluna "Entrada") => pendente. Ver statusForBucketName.
async function statusForBucketId(bucketId: number | null): Promise<CXStatus> {
    if (bucketId == null) return 'pendente';
    const buckets = await fetchCXBuckets();
    return statusForBucketName(buckets.find((b) => b.id === bucketId)?.name);
}

export async function verifyCXPlannerKey(key: string) {
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    return key === correctKey;
}

export async function fetchCXPlannerBoardData(): Promise<{
    items: CXBoardItem[];
    managers: { id: string; name: string }[];
    buckets: CXBucket[];
    users: CXUser[];
}> {
    const [items, managerRows, buckets, users] = await Promise.all([
        fetchAllCXItemsForBoard(),
        fetchManagersList(),
        fetchCXBuckets(),
        fetchCXUsers(),
    ]);
    return {
        items,
        managers: managerRows.map((m) => ({ id: m.id, name: m.name })),
        buckets,
        users,
    };
}

export async function createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null> {
    const manager = await fetchManagerById(input.managerId);
    if (!manager) return null;

    const status = await statusForBucketId(input.bucketId);

    const created = await createCXItem({
        managerId: input.managerId,
        cliente: input.cliente,
        titulo: input.titulo,
        problema: input.problema,
        solucaoProposta: input.solucaoProposta,
        subtitulo: input.subtitulo.trim() || null,
        status,
        criticidade: mapCriticidade(input.prioridadeTexto),
        dataInicio: normalizeDate(input.dataInicio),
        dataFim: normalizeDate(input.dataFim),
        percentComplete: percentForStatus(status, input.percentComplete),
        prioridadeTexto: input.prioridadeTexto || null,
        responsavelId: input.responsavelId,
        bucketId: input.bucketId,
        isVisible: input.isVisible ?? true,
        externalId: null,
        manualEditAt: null,
        createdAt: new Date().toISOString(),
    });

    return hydrate(created.id!);
}

export async function updateCXPlannerItem(
    id: number,
    patch: Partial<CXPlannerFormValues>
): Promise<CXBoardItem | null> {
    const payload: CXItemPatch = {};
    if (patch.managerId !== undefined) payload.managerId = patch.managerId;
    if (patch.cliente !== undefined) payload.cliente = patch.cliente;
    if (patch.titulo !== undefined) payload.titulo = patch.titulo;
    if (patch.problema !== undefined) payload.problema = patch.problema;
    if (patch.solucaoProposta !== undefined) payload.solucaoProposta = patch.solucaoProposta;
    if (patch.subtitulo !== undefined) payload.subtitulo = patch.subtitulo.trim() || null;
    if (patch.dataInicio !== undefined) payload.dataInicio = normalizeDate(patch.dataInicio);
    if (patch.dataFim !== undefined) payload.dataFim = normalizeDate(patch.dataFim);
    if (patch.responsavelId !== undefined) payload.responsavelId = patch.responsavelId;
    if (patch.isVisible !== undefined) payload.isVisible = patch.isVisible;
    if (patch.prioridadeTexto !== undefined) {
        payload.prioridadeTexto = patch.prioridadeTexto || null;
        payload.criticidade = mapCriticidade(patch.prioridadeTexto);
    }

    // O status é herdado do bucket. Se o bucket veio no patch (drag entre
    // colunas ou troca no modal), recalcula status + % coerente. Se só o %
    // mudou, respeita o valor mas não mexe no status.
    if (patch.bucketId !== undefined) {
        payload.bucketId = patch.bucketId;
        const status = await statusForBucketId(patch.bucketId);
        payload.status = status;
        const basePct = patch.percentComplete ?? (await fetchCXItemById(id))?.percentComplete ?? 0;
        payload.percentComplete = percentForStatus(status, basePct);
    } else if (patch.percentComplete !== undefined) {
        payload.percentComplete = patch.percentComplete;
    }

    const updated = await updateCXItem(id, payload);
    if (!updated) return null;
    return hydrate(id);
}

export async function deleteCXPlannerItem(id: number): Promise<void> {
    await deleteCXItem(id);
}

// Arrastar um card pra outra coluna: além do bucket, o status (e o % quando
// vira "resolvido") passam a refletir o bucket de destino — ver
// updateCXPlannerItem.
export async function moveCXPlannerItem(id: number, bucketId: number | null): Promise<CXBoardItem | null> {
    return updateCXPlannerItem(id, { bucketId });
}

// Recarrega o item já no formato do board (com managerName / responsavelName /
// bucketId) — mais simples e sem drift do que remontar o objeto à mão.
async function hydrate(id: number): Promise<CXBoardItem | null> {
    const all = await fetchAllCXItemsForBoard();
    return all.find((i) => i.id === id) ?? null;
}

// ── Buckets ──────────────────────────────────────────────────────────────
export async function createBucketAction(name: string): Promise<CXBucket> {
    return createCXBucket(name.trim() || 'Novo bucket');
}

export async function renameBucketAction(id: number, name: string): Promise<void> {
    await renameCXBucket(id, name.trim() || 'Bucket');
}

export async function moveBucketAction(id: number, direction: 'left' | 'right'): Promise<void> {
    const buckets = await fetchCXBuckets();
    const idx = buckets.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= buckets.length) return;
    await swapCXBucketPositions(id, buckets[targetIdx].id);
}

// Reordenação por drag-and-drop de coluna: recebe todos os ids de bucket na
// nova ordem e grava position = índice.
export async function reorderBucketsAction(orderedIds: number[]): Promise<void> {
    await setCXBucketPositions(orderedIds);
}

export async function deleteBucketAction(id: number): Promise<void> {
    await deleteCXBucket(id);
}

// ── Responsáveis ─────────────────────────────────────────────────────────
export async function createUserAction(name: string, email: string): Promise<CXUser> {
    return createCXUser(name.trim(), email.trim() || null);
}

export async function updateUserAction(id: number, name: string, email: string): Promise<void> {
    await updateCXUser(id, { name: name.trim(), email: email.trim() || null });
}

export async function deleteUserAction(id: number): Promise<void> {
    await deleteCXUser(id);
}
