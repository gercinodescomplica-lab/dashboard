// src/db/carteira.ts
// Carteira de clientes no banco (spec docs/superpowers/specs/2026-11-06-organograma-clientes-design.md).
// Porte de aibertinho/src/modulos/gerencias/servidor/{organograma-clientes,servico,carteira,levar-cliente}.ts.
// A gerência é a CHAVE da sigla do card ("GRC4"); o card que recebe os dados é `cardDaGerencia` (maior ano, visível).
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, contrato, cx, managers, movimentoCarteira, projects, proposta } from '@/db/schema';
import { cardDaGerencia, chaveDaCarteira, textoDaGerencia } from '@/lib/carteira/gerencia';
import type { ClienteParaCasar } from '@/lib/carteira/casar-cliente';
import { montarOrganograma, type ClienteDoOrganograma, type GerenciaDoOrganograma, type OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import { ErroCarteira, JUSTIFICATIVA_TROCA, MUDOU_ENQUANTO_OLHAVA, type CardGerencia } from '@/lib/carteira/tipos';
import type { ProjectHistoryItem } from '@/types/manager';

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

const agora = () => new Date().toISOString();

/** Destino válido: existe card e o card da gerência está visível. Devolve o card. */
async function destino(chave: string, ex: Executor) {
    const card = cardDaGerencia(await listarCards(ex), chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (!card.showInDashboard) throw new ErroCarteira('Gerência desativada não recebe clientes.');
    return card;
}

/** = `levarDadosDoCliente` do AIBertinho. Visitas e churn não têm cliente; projeto de lead da GRCC fica na GRCC. */
export async function levarDadosDoCliente(tx: Tx, clienteIds: string[], paraGerencia: string, por: string): Promise<void> {
    if (clienteIds.length === 0) return;
    const cards = await listarCards(tx);
    const card = cardDaGerencia(cards, paraGerencia);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    const doCliente = inArray(contrato.clienteId, clienteIds);
    await tx.update(contrato).set({ managerId: card.id, gerencia: textoDaGerencia(paraGerencia), nomeGerente: card.name, updatedAt: agora() }).where(doCliente);
    await tx.update(proposta).set({ managerId: card.id, gerencia: textoDaGerencia(paraGerencia), updatedAt: agora() }).where(inArray(proposta.clienteId, clienteIds));
    await tx.update(cx).set({ managerId: card.id }).where(inArray(cx.clienteId, clienteIds));

    const chaveDoCard = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    const projs = await tx
        .select({ id: projects.id, managerId: projects.managerId, history: projects.history })
        .from(projects)
        .where(and(inArray(projects.clienteId, clienteIds), isNull(projects.leadGrccId)));
    for (const p of projs) {
        if (p.managerId === card.id) continue;
        let historico: ProjectHistoryItem[] = [];
        try {
            historico = p.history ? JSON.parse(p.history) : [];
        } catch {
            historico = [];
        }
        historico.push({ date: agora(), tipo: 'nota', de: chaveDoCard.get(p.managerId) ?? p.managerId, para: paraGerencia, justificativa: JUSTIFICATIVA_TROCA, autor: por });
        await tx.update(projects).set({ managerId: card.id, history: JSON.stringify(historico) }).where(eq(projects.id, p.id));
    }
}

async function carteiraAtual(clienteIds: string[], ex: Executor): Promise<Map<string, string>> {
    if (clienteIds.length === 0) return new Map();
    const linhas = await ex.select({ clienteId: carteiraCliente.clienteId, gerencia: carteiraCliente.gerencia }).from(carteiraCliente).where(inArray(carteiraCliente.clienteId, clienteIds));
    return new Map(linhas.map((l) => [l.clienteId, l.gerencia]));
}

/** = `moverClientes` do AIBertinho, com `esperado` (de onde a tela acha que cada cliente sai; null = sem carteira). */
export async function moverClientes(clienteIds: string[], para: string | null, por: string, esperado?: Record<string, string | null>): Promise<{ movidos: number }> {
    if (para) await destino(para, db);
    const deOnde = await carteiraAtual(clienteIds, db);
    if (esperado && clienteIds.some((id) => id in esperado && (deOnde.get(id) ?? null) !== esperado[id])) {
        throw new ErroCarteira(MUDOU_ENQUANTO_OLHAVA);
    }
    const mudam = clienteIds.filter((id) => (deOnde.get(id) ?? null) !== para);
    if (mudam.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        if (para) {
            for (const clienteId of mudam) {
                await tx.insert(carteiraCliente).values({ clienteId, gerencia: para, movidoEm: agora(), movidoPor: por })
                    .onConflictDoUpdate({ target: carteiraCliente.clienteId, set: { gerencia: para, movidoEm: agora(), movidoPor: por } });
            }
            await levarDadosDoCliente(tx, mudam, para, por);
        } else {
            await tx.delete(carteiraCliente).where(inArray(carteiraCliente.clienteId, mudam));
        }
        await tx.insert(movimentoCarteira).values(mudam.map((clienteId) => ({ clienteId, deGerencia: deOnde.get(clienteId) ?? null, paraGerencia: para, por, em: agora() })));
    });
    return { movidos: mudam.length };
}

/** = `alterarCarteira` do AIBertinho: entra só cliente sem carteira, sai só cliente desta gerência. */
export async function alterarCarteira(gerencia: string, mudanca: { adicionar: string[]; remover: string[] }, por: string): Promise<{ movidos: number }> {
    const deOnde = await carteiraAtual([...mudanca.adicionar, ...mudanca.remover], db);
    if ([...mudanca.adicionar, ...mudanca.remover].some((id) => deOnde.has(id) && deOnde.get(id) !== gerencia)) {
        throw new ErroCarteira('Cliente de outra gerência: mova pela aba Organograma.');
    }
    const entram = [...new Set(mudanca.adicionar)].filter((id) => !deOnde.has(id));
    const saem = [...new Set(mudanca.remover)].filter((id) => deOnde.has(id));
    if (entram.length > 0) await destino(gerencia, db);
    if (entram.length + saem.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        if (entram.length) {
            await tx.insert(carteiraCliente).values(entram.map((clienteId) => ({ clienteId, gerencia, movidoEm: agora(), movidoPor: por })));
            await levarDadosDoCliente(tx, entram, gerencia, por);
        }
        if (saem.length) await tx.delete(carteiraCliente).where(and(inArray(carteiraCliente.clienteId, saem), eq(carteiraCliente.gerencia, gerencia)));
        await tx.insert(movimentoCarteira).values([
            ...entram.map((clienteId) => ({ clienteId, deGerencia: null, paraGerencia: gerencia, por, em: agora() })),
            ...saem.map((clienteId) => ({ clienteId, deGerencia: gerencia, paraGerencia: null, por, em: agora() })),
        ]);
    });
    return { movidos: entram.length + saem.length };
}

/** Chaves das gerências onde estão as linhas manuais do cliente (contrato, proposta, cx, projeto sem lead). */
export async function gerenciasDosDados(clienteId: string, ex: Executor = db): Promise<string[]> {
    const cards = await listarCards(ex);
    const chave = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    const ids = [
        ...(await ex.select({ m: contrato.managerId }).from(contrato).where(eq(contrato.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: proposta.managerId }).from(proposta).where(eq(proposta.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: cx.managerId }).from(cx).where(eq(cx.clienteId, clienteId))).map((r) => r.m),
        ...(await ex.select({ m: projects.managerId }).from(projects).where(and(eq(projects.clienteId, clienteId), isNull(projects.leadGrccId)))).map((r) => r.m),
    ];
    return [...new Set(ids.filter((id): id is string => !!id).map((id) => chave.get(id) ?? id))].sort();
}

/** Fora da carteira (D12): leva os dados do cliente para a gerência da carteira atual. */
export async function alinharCliente(clienteId: string, por: string): Promise<{ movidos: number }> {
    const atual = (await carteiraAtual([clienteId], db)).get(clienteId);
    if (!atual) throw new ErroCarteira('Cliente sem carteira: ponha numa gerência antes.');
    const de = (await gerenciasDosDados(clienteId)).filter((g) => g !== atual);
    if (de.length === 0) return { movidos: 0 };
    await db.transaction(async (tx) => {
        await levarDadosDoCliente(tx, [clienteId], atual, por);
        await tx.insert(movimentoCarteira).values({ clienteId, deGerencia: de[0], paraGerencia: atual, por, em: agora() });
    });
    return { movidos: 1 };
}
