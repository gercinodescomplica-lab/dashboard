'use server';

import { revalidatePath } from 'next/cache';
import {
    createProposta,
    updateProposta,
    deleteProposta,
    fetchAllPropostas,
    fetchPropostaById,
    fetchManagersList,
    PropostaRow,
} from '@/db/queries';
import { proposta } from '@/db/schema';
import { gerenciaPelaCarteira } from '@/db/carteira';
import { clienteDaLinha } from '@/lib/carteira/linha';

export type ActionResult = { success: true } | { success: false; error: string };

/** Com cliente em carteira, gerência e gerente vêm dela, por cima do formulário. */
async function comCarteira<T extends Partial<typeof proposta.$inferInsert>>(data: T, clienteId: string | null): Promise<T> {
    const g = await gerenciaPelaCarteira(clienteId);
    return g ? { ...data, clienteId, managerId: g.managerId, gerencia: g.gerencia } : { ...data, clienteId };
}

export async function searchPropostasAction(search: string): Promise<PropostaRow[]> {
    return fetchAllPropostas(search || undefined);
}

export async function createPropostaAction(
    data: typeof proposta.$inferInsert
): Promise<ActionResult> {
    try {
        const clienteId = data.clienteId ?? (await clienteDaLinha(data.cliente, data.managerId ?? null));
        await createProposta({
            ...(await comCarteira(data, clienteId)),
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
        const atual = await fetchPropostaById(id);
        const clienteId = data.clienteId !== undefined ? data.clienteId : atual?.clienteId ?? null;
        await updateProposta(id, await comCarteira(data, clienteId));
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
