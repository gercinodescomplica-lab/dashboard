'use server';

import { revalidatePath } from 'next/cache';
import {
    createContrato,
    updateContrato,
    deleteContrato,
    fetchAllContratos,
    fetchManagersList,
    ContratoRow,
} from '@/db/queries';
import { contrato } from '@/db/schema';

export type ActionResult = { success: true } | { success: false; error: string };

export async function searchContratosAction(search: string): Promise<ContratoRow[]> {
    return fetchAllContratos(search || undefined);
}

export async function createContratoAction(
    data: typeof contrato.$inferInsert
): Promise<ActionResult> {
    try {
        await createContrato({
            ...data,
            id: data.id || crypto.randomUUID(),
        });
        revalidatePath('/contracts');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao criar contrato.' };
    }
}

export async function updateContratoAction(
    id: string,
    data: Partial<typeof contrato.$inferInsert>
): Promise<ActionResult> {
    try {
        await updateContrato(id, data);
        revalidatePath('/contracts');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao atualizar contrato.' };
    }
}

export async function deleteContratoAction(id: string): Promise<ActionResult> {
    try {
        await deleteContrato(id);
        revalidatePath('/contracts');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao excluir contrato.' };
    }
}

export async function getManagersListAction() {
    return fetchManagersList();
}
