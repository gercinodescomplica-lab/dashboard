// src/db/carteira.ts
// Carteira de clientes no banco (spec docs/superpowers/specs/2026-11-06-organograma-clientes-design.md).
// Porte de aibertinho/src/modulos/gerencias/servidor/{organograma-clientes,servico,carteira,levar-cliente}.ts.
// A gerência é a CHAVE da sigla do card ("GRC4"); o card que recebe os dados é `cardDaGerencia` (maior ano, visível).
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, managers, movimentoCarteira } from '@/db/schema';
import { cardDaGerencia, chaveDaCarteira, textoDaGerencia } from '@/lib/carteira/gerencia';
import type { ClienteParaCasar } from '@/lib/carteira/casar-cliente';
import { montarOrganograma, type ClienteDoOrganograma, type GerenciaDoOrganograma, type OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import type { CardGerencia } from '@/lib/carteira/tipos';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Tx;

export async function listarCards(ex: Executor = db): Promise<CardGerencia[]> {
    return ex.select({ id: managers.id, name: managers.name, role: managers.role, year: managers.year, showInDashboard: managers.showInDashboard }).from(managers);
}

export async function listarClientesComCarteira(ex: Executor = db): Promise<Array<ClienteParaCasar & { ativo: boolean }>> {
    const linhas = await ex
        .select({ id: cliente.id, nome: cliente.nome, sigla: cliente.sigla, ativo: cliente.ativo, gerencia: carteiraCliente.gerencia })
        .from(cliente)
        .leftJoin(carteiraCliente, eq(carteiraCliente.clienteId, cliente.id));
    return linhas.map((l) => ({ ...l, gerencia: l.gerencia ?? null }));
}

const comoTexto = (c: { nome: string; sigla: string | null }) => (c.sigla ? `${c.sigla} (${c.nome})` : c.nome);

/** Clientes atendidos de cada gerência, no formato do antigo `served_clients` (ClientsTab, Planner). */
export async function clientesAtendidosPorGerencia(ex: Executor = db): Promise<Map<string, string[]>> {
    const linhas = await ex
        .select({ gerencia: carteiraCliente.gerencia, nome: cliente.nome, sigla: cliente.sigla })
        .from(carteiraCliente)
        .innerJoin(cliente, eq(cliente.id, carteiraCliente.clienteId))
        .where(eq(cliente.ativo, true))
        .orderBy(cliente.nome);
    const m = new Map<string, string[]>();
    for (const l of linhas) m.set(l.gerencia, [...(m.get(l.gerencia) ?? []), comoTexto(l)]);
    return m;
}

/** = `gerenciaDoComercialPelaCarteira`: gerência e gerente que a linha do cliente deve ter. null = sem cliente ou sem carteira. */
export async function gerenciaPelaCarteira(clienteId: string | null | undefined, ex: Executor = db) {
    if (!clienteId) return null;
    const [c] = await ex.select({ gerencia: carteiraCliente.gerencia }).from(carteiraCliente).where(eq(carteiraCliente.clienteId, clienteId));
    if (!c) return null;
    const card = cardDaGerencia(await listarCards(ex), c.gerencia);
    if (!card) return null;
    return { chave: c.gerencia, managerId: card.id, gerencia: textoDaGerencia(c.gerencia), nomeGerente: card.name };
}

/** Card em que a linha deve ser gravada: o da carteira, quando a carteira é de outra gerência; senão o atual. */
export async function managerDaLinha(clienteId: string | null | undefined, managerIdAtual: string, ex: Executor = db): Promise<string> {
    const g = await gerenciaPelaCarteira(clienteId, ex);
    if (!g) return managerIdAtual;
    const cards = await listarCards(ex);
    const atual = cards.find((c) => c.id === managerIdAtual);
    return atual && chaveDaCarteira(atual) === g.chave ? managerIdAtual : g.managerId;
}

async function ultimosMovimentos(ex: Executor): Promise<Map<string, { em: string }>> {
    const movs = await ex.select({ clienteId: movimentoCarteira.clienteId, em: movimentoCarteira.em }).from(movimentoCarteira).orderBy(desc(movimentoCarteira.em));
    const m = new Map<string, { em: string }>();
    for (const mv of movs) if (!m.has(mv.clienteId)) m.set(mv.clienteId, { em: mv.em });
    return m;
}

export async function carregarOrganogramaClientes(ex: Executor = db): Promise<OrganogramaClientes> {
    const [cards, clientes, ultimos] = await Promise.all([listarCards(ex), listarClientesComCarteira(ex), ultimosMovimentos(ex)]);
    const comoCliente = (c: { id: string; nome: string; sigla: string | null }): ClienteDoOrganograma => ({
        id: c.id, nome: c.nome, sigla: c.sigla, ultimoMovimento: ultimos.get(c.id) ?? null,
    });
    const ativos = clientes.filter((c) => c.ativo);
    const chaves = [...new Set(cards.map(chaveDaCarteira))];
    const gerencias: GerenciaDoOrganograma[] = chaves.map((chave) => {
        const card = cardDaGerencia(cards, chave)!;
        return {
            id: chave,
            nome: chave,
            sigla: chave,
            ativa: card.showInDashboard,
            gerentes: [card.name],
            clientes: ativos.filter((c) => c.gerencia === chave).map(comoCliente),
        };
    });
    return montarOrganograma(gerencias, ativos.filter((c) => c.gerencia === null).map(comoCliente));
}
