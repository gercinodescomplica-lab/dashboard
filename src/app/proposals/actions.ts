'use server';

import { revalidatePath } from 'next/cache';
import {
    createProposta,
    updateProposta,
    deleteProposta,
    fetchAllPropostas,
    fetchManagersList,
    PropostaRow,
} from '@/db/queries';
import { proposta } from '@/db/schema';

export type ActionResult = { success: true } | { success: false; error: string };

export async function searchPropostasAction(search: string): Promise<PropostaRow[]> {
    return fetchAllPropostas(search || undefined);
}

export async function createPropostaAction(
    data: typeof proposta.$inferInsert
): Promise<ActionResult> {
    try {
        await createProposta({
            ...data,
            id: data.id || crypto.randomUUID(),
        });
        revalidatePath('/proposals');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao criar proposta.' };
    }
}

export async function updatePropostaAction(
    id: string,
    data: Partial<typeof proposta.$inferInsert>
): Promise<ActionResult> {
    try {
        await updateProposta(id, data);
        revalidatePath('/proposals');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao atualizar proposta.' };
    }
}

export async function deletePropostaAction(id: string): Promise<ActionResult> {
    try {
        await deleteProposta(id);
        revalidatePath('/proposals');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Erro ao excluir proposta.' };
    }
}

export async function getManagersListAction() {
    return fetchManagersList();
}
