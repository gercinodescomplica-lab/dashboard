'use server';

import { revalidatePath } from 'next/cache';
import {
    createContrato,
    updateContrato,
    deleteContrato,
    fetchAllContratos,
    fetchContratoById,
    fetchManagersList,
    ContratoRow,
} from '@/db/queries';
import { contrato } from '@/db/schema';
import { clientesParaEscolha, gerenciaPelaCarteira } from '@/db/carteira';
import { clienteDaLinha } from '@/lib/carteira/linha';

export type ActionResult = { success: true } | { success: false; error: string };

/** Com cliente em carteira, gerência e gerente vêm dela, por cima do formulário. */
async function comCarteira<T extends Partial<typeof contrato.$inferInsert>>(data: T, clienteId: string | null): Promise<T> {
    const g = await gerenciaPelaCarteira(clienteId);
    return g ? { ...data, clienteId, managerId: g.managerId, gerencia: g.gerencia, nomeGerente: g.nomeGerente } : { ...data, clienteId };
}

export async function listarClientesAction() {
    return clientesParaEscolha();
}

export async function searchContratosAction(search: string): Promise<ContratoRow[]> {
    return fetchAllContratos(search || undefined);
}

export async function createContratoAction(
    data: typeof contrato.$inferInsert
): Promise<ActionResult> {
    try {
        const clienteId = data.clienteId ?? (await clienteDaLinha(data.cliente, data.managerId ?? null));
        await createContrato({
            ...(await comCarteira(data, clienteId)),
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
        const atual = await fetchContratoById(id);
        const clienteId = data.clienteId !== undefined ? data.clienteId : atual?.clienteId ?? null;
        await updateContrato(id, await comCarteira(data, clienteId));
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
