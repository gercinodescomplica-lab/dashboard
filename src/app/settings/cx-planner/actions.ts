'use server';

import {
    fetchAllCXItemsForBoard,
    deleteCXItem,
    fetchManagersList,
    fetchManagerById,
    createCXItem,
    updateCXItem,
    CXBoardItem,
} from '@/db/queries';
import { mapCriticidade } from '@/lib/planner-sync';
import { CXStatus } from '@/types/manager';

export type CXPlannerFormValues = {
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    status: CXStatus;
    dataInicio: string;
    dataFim: string;
    percentComplete: number;
    prioridadeTexto: string;
};

// Objeto de patch aceito por updateCXItem (src/db/queries.ts) — definido
// aqui em vez de importar `cx` de @/db/schema porque server actions não
// devem tocar em Drizzle diretamente (CLAUDE.md: só queries.ts faz isso).
// A checagem estrutural do TypeScript garante compatibilidade no call site.
type CXItemPatch = Partial<{
    managerId: string;
    cliente: string;
    titulo: string;
    problema: string;
    solucaoProposta: string;
    status: CXStatus;
    criticidade: 'baixa' | 'media' | 'alta';
    dataInicio: string | null;
    dataFim: string | null;
    percentComplete: number | null;
    prioridadeTexto: string | null;
    isVisible: boolean;
}>;

function normalizeDate(v: string): string | null {
    return v.trim() === '' ? null : v;
}

export async function verifyCXPlannerKey(key: string) {
    const correctKey = process.env.CX_PLANNER_KEY || 'prodam_cx_2026';
    return key === correctKey;
}

export async function fetchCXPlannerBoardItems(): Promise<CXBoardItem[]> {
    return fetchAllCXItemsForBoard();
}

export async function fetchManagersForDropdown(): Promise<{ id: string; name: string }[]> {
    const rows = await fetchManagersList();
    return rows.map((m) => ({ id: m.id, name: m.name }));
}

export async function createCXPlannerItem(input: CXPlannerFormValues): Promise<CXBoardItem | null> {
    const manager = await fetchManagerById(input.managerId);
    if (!manager) return null;

    const created = await createCXItem({
        managerId: input.managerId,
        cliente: input.cliente,
        titulo: input.titulo,
        problema: input.problema,
        solucaoProposta: input.solucaoProposta,
        status: input.status,
        // criticidade é sempre derivada da prioridade — nunca escolhida
        // direto na UI (ver docs/superpowers/specs/2026-08-24-cx-planner-admin-design.md).
        criticidade: mapCriticidade(input.prioridadeTexto),
        dataInicio: normalizeDate(input.dataInicio),
        dataFim: normalizeDate(input.dataFim),
        percentComplete: input.percentComplete,
        prioridadeTexto: input.prioridadeTexto || null,
        isVisible: true,
        externalId: null,
        manualEditAt: null,
        createdAt: new Date().toISOString(),
    });

    return { ...created, managerName: manager.name } as CXBoardItem;
}

export async function updateCXPlannerItem(id: number, patch: Partial<CXPlannerFormValues>): Promise<CXBoardItem | null> {
    const payload: CXItemPatch = { ...patch };
    if (patch.dataInicio !== undefined) payload.dataInicio = normalizeDate(patch.dataInicio);
    if (patch.dataFim !== undefined) payload.dataFim = normalizeDate(patch.dataFim);
    if (patch.prioridadeTexto !== undefined) {
        payload.prioridadeTexto = patch.prioridadeTexto || null;
        payload.criticidade = mapCriticidade(patch.prioridadeTexto);
    }

    const updated = await updateCXItem(id, payload);
    if (!updated) return null;

    const manager = await fetchManagerById(updated.managerId);
    return { ...updated, managerName: manager?.name ?? '' } as CXBoardItem;
}

export async function deleteCXPlannerItem(id: number): Promise<void> {
    await deleteCXItem(id);
}

export async function moveCXPlannerItem(id: number, status: CXStatus): Promise<CXBoardItem | null> {
    return updateCXPlannerItem(id, { status });
}
