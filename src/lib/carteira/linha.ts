// Cliente de uma linha nova/editada (contrato, proposta, CX, projeto) pelo texto, com a regra do casamento.
import { listarCards, listarClientesComCarteira } from '@/db/carteira';
import { casarCliente } from './casar-cliente';
import { chaveDaCarteira } from './gerencia';

export async function clienteDaLinha(texto: string | null | undefined, managerId: string | null): Promise<string | null> {
    const [clientes, cards] = await Promise.all([listarClientesComCarteira(), listarCards()]);
    const card = managerId ? cards.find((c) => c.id === managerId) : undefined;
    return casarCliente(texto, clientes, card ? chaveDaCarteira(card) : null);
}
