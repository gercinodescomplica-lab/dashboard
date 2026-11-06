// src/db/carteira.ts
// Carteira de clientes no banco (spec docs/superpowers/specs/2026-11-06-organograma-clientes-design.md).
// Porte de aibertinho/src/modulos/gerencias/servidor/{organograma-clientes,servico,carteira,levar-cliente}.ts.
// A gerência é a CHAVE da sigla do card ("GRC4"); o card que recebe os dados é `cardDaGerencia` (maior ano, visível).
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, contrato, cx, managers, movimentoCarteira, projects, proposta } from '@/db/schema';
import { siglaComparavel, chaveDaGerencia } from '@/lib/integracao/chaves';
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

/** Versão em lote de `managerDaLinha`: lê cards e carteira uma vez e devolve a regra como função pura (gravações com muitas linhas). */
export async function roteadorDaCarteira(ex: Executor = db): Promise<(clienteId: string | null | undefined, managerIdAtual: string) => string> {
    const [cards, carteira] = await Promise.all([
        listarCards(ex),
        ex.select({ clienteId: carteiraCliente.clienteId, gerencia: carteiraCliente.gerencia }).from(carteiraCliente),
    ]);
    const gerenciaDe = new Map(carteira.map((c) => [c.clienteId, c.gerencia]));
    return (clienteId, managerIdAtual) => {
        const chave = clienteId ? gerenciaDe.get(clienteId) : undefined;
        const card = chave ? cardDaGerencia(cards, chave) : null;
        if (!card) return managerIdAtual;
        const atual = cards.find((c) => c.id === managerIdAtual);
        return atual && chaveDaCarteira(atual) === chave ? managerIdAtual : card.id;
    };
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
            const h = p.history ? JSON.parse(p.history) : [];
            historico = Array.isArray(h) ? h : [];
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

function slug(t: string): string {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const chaveDaSigla = (sigla: string) => chaveDaGerencia(sigla) ?? sigla.trim();

export async function criarGerencia(d: { sigla: string; nome: string }): Promise<{ chave: string; id: string }> {
    const chave = chaveDaSigla(d.sigla);
    const nome = d.nome.trim();
    if (!chave) throw new ErroCarteira('Informe a sigla.');
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const cards = await listarCards();
    if (cards.some((c) => chaveDaCarteira(c) === chave)) throw new ErroCarteira(`Já existe uma gerência com a sigla ${chave}.`);
    const id = `${slug(chave)}-${slug(nome)}`;
    if (cards.some((c) => c.id === id)) throw new ErroCarteira(`Já existe um gerente com o ID "${id}".`);
    const year = cards.length ? Math.max(...cards.map((c) => c.year)) : new Date().getFullYear();
    await db.insert(managers).values({ id, name: nome, role: chave, avatarUrl: '', year, meta: 0, contratado: 0, forecastFinal: 0, showInDashboard: true });
    return { chave, id };
}

export async function editarGerencia(chave: string, d: { sigla: string; nome: string }): Promise<{ chave: string }> {
    const nova = chaveDaSigla(d.sigla);
    const nome = d.nome.trim();
    if (!nova) throw new ErroCarteira('Informe a sigla.');
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const cards = await listarCards();
    const daGerencia = cards.filter((c) => chaveDaCarteira(c) === chave);
    const card = cardDaGerencia(cards, chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (nova !== chave) {
        if (chave === 'GRCC') throw new ErroCarteira('A sigla da GRCC não pode mudar: a página /grcc depende dela.');
        if (cards.some((c) => chaveDaCarteira(c) === nova)) throw new ErroCarteira(`Já existe uma gerência com a sigla ${nova}.`);
        // O id do card ganha do role fora de GRC/KAM: a carteira ficaria numa chave sem card.
        if (daGerencia.some((c) => chaveDaCarteira({ id: c.id, role: nova }) !== nova)) throw new ErroCarteira('Essa sigla não pode ser usada nesta gerência: o id do card já indica outra.');
    }
    const ids = daGerencia.map((c) => c.id);
    await db.transaction(async (tx) => {
        await tx.update(managers).set({ name: nome }).where(eq(managers.id, card.id));
        if (nome !== card.name) await tx.update(contrato).set({ nomeGerente: nome }).where(inArray(contrato.managerId, ids));
        if (nova === chave) return;
        await tx.update(managers).set({ role: nova }).where(inArray(managers.id, ids));
        await tx.update(carteiraCliente).set({ gerencia: nova }).where(eq(carteiraCliente.gerencia, chave));
        await tx.update(movimentoCarteira).set({ deGerencia: nova }).where(eq(movimentoCarteira.deGerencia, chave));
        await tx.update(movimentoCarteira).set({ paraGerencia: nova }).where(eq(movimentoCarteira.paraGerencia, chave));
        await tx.update(contrato).set({ gerencia: textoDaGerencia(nova) }).where(inArray(contrato.managerId, ids));
        await tx.update(proposta).set({ gerencia: textoDaGerencia(nova) }).where(inArray(proposta.managerId, ids));
    });
    return { chave: nova };
}

async function exigirCarteiraVazia(chave: string): Promise<void> {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(carteiraCliente).where(eq(carteiraCliente.gerencia, chave));
    if (Number(n) > 0) throw new ErroCarteira(`Tire os ${Number(n)} clientes da carteira antes de desativar.`);
}

/** Editor de gerente (D5, D10): card existente não muda de chave nem oculta gerência com clientes. Card novo passa. */
export async function conferirEdicaoDoCard(m: { id: string; role: string; showInDashboard?: boolean }): Promise<void> {
    const cards = await listarCards();
    const atual = cards.find((c) => c.id === m.id);
    if (!atual) return;
    const chave = chaveDaCarteira(atual);
    // fetchGerenteGrcc compara role = 'GRCC' exato: outra grafia mantém a chave, mas quebra a /grcc.
    if (chave === 'GRCC' && m.role !== atual.role) throw new ErroCarteira('A sigla da GRCC não pode mudar: a página /grcc depende dela.');
    if (chaveDaCarteira(m) !== chave) throw new ErroCarteira('Para mudar a sigla, use Organograma de clientes.');
    if (atual.showInDashboard && m.showInDashboard === false && cardDaGerencia(cards, chave)?.id === m.id) await exigirCarteiraVazia(chave);
}

export async function definirGerenciaVisivel(chave: string, visivel: boolean): Promise<void> {
    const card = cardDaGerencia(await listarCards(), chave);
    if (!card) throw new ErroCarteira('Gerência não encontrada.');
    if (!visivel) await exigirCarteiraVazia(chave);
    await db.update(managers).set({ showInDashboard: visivel }).where(eq(managers.id, card.id));
}

export async function definirClienteAtivo(clienteId: string, ativo: boolean): Promise<void> {
    await db.update(cliente).set({ ativo }).where(eq(cliente.id, clienteId));
}

export async function criarCliente(d: { nome: string; sigla: string | null }): Promise<{ id: string }> {
    const nome = d.nome.trim();
    if (!nome) throw new ErroCarteira('Informe o nome.');
    const sigla = d.sigla?.trim() || null;
    if (sigla) {
        const existentes = await db.select({ sigla: cliente.sigla }).from(cliente).where(isNotNull(cliente.sigla));
        if (existentes.some((e) => siglaComparavel(e.sigla!) === siglaComparavel(sigla))) throw new ErroCarteira(`Já existe um cliente com a sigla ${sigla}.`);
    }
    const id = crypto.randomUUID();
    await db.insert(cliente).values({ id, nome, sigla, createdAt: agora() });
    return { id };
}

export interface ForaDaCarteira { clienteId: string; sigla: string | null; nome: string; carteira: string; gerenciasDosDados: string[] }

export async function foraDaCarteira(): Promise<ForaDaCarteira[]> {
    const [cards, clientes] = await Promise.all([listarCards(), listarClientesComCarteira()]);
    const chave = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    const dados = new Map<string, Set<string>>();
    const juntar = (linhas: Array<{ c: string | null; m: string | null }>) => {
        for (const l of linhas) {
            if (!l.c || !l.m) continue;
            const set = dados.get(l.c) ?? new Set<string>();
            set.add(chave.get(l.m) ?? l.m);
            dados.set(l.c, set);
        }
    };
    // Uma consulta por tabela (em vez de uma por cliente); mesma regra de gerenciasDosDados.
    juntar(await db.select({ c: contrato.clienteId, m: contrato.managerId }).from(contrato).where(isNotNull(contrato.clienteId)));
    juntar(await db.select({ c: proposta.clienteId, m: proposta.managerId }).from(proposta).where(isNotNull(proposta.clienteId)));
    juntar(await db.select({ c: cx.clienteId, m: cx.managerId }).from(cx).where(isNotNull(cx.clienteId)));
    juntar(await db.select({ c: projects.clienteId, m: projects.managerId }).from(projects).where(and(isNotNull(projects.clienteId), isNull(projects.leadGrccId))));
    const fora: ForaDaCarteira[] = [];
    for (const c of clientes) {
        if (c.gerencia === null) continue;
        const gs = [...(dados.get(c.id) ?? [])].sort();
        if (gs.some((g) => g !== c.gerencia)) fora.push({ clienteId: c.id, sigla: c.sigla, nome: c.nome, carteira: c.gerencia, gerenciasDosDados: gs });
    }
    return fora.sort((a, b) => (a.sigla ?? a.nome).localeCompare(b.sigla ?? b.nome, 'pt-BR'));
}

export type TabelaComCliente = 'contrato' | 'proposta' | 'cx' | 'projects';
export interface LinhaSemCliente { tabela: TabelaComCliente; id: string; texto: string; gerencia: string }

export async function linhasSemCliente(): Promise<LinhaSemCliente[]> {
    const chave = new Map((await listarCards()).map((c) => [c.id, chaveDaCarteira(c)]));
    const g = (m: string | null) => (m ? chave.get(m) ?? m : '');
    const ct = await db.select({ id: contrato.id, texto: contrato.cliente, m: contrato.managerId }).from(contrato).where(isNull(contrato.clienteId));
    const pr = await db.select({ id: proposta.id, texto: proposta.cliente, m: proposta.managerId }).from(proposta).where(isNull(proposta.clienteId));
    const c = await db.select({ id: cx.id, texto: cx.cliente, m: cx.managerId }).from(cx).where(isNull(cx.clienteId));
    const pj = await db.select({ id: projects.id, texto: projects.orgao, m: projects.managerId }).from(projects).where(and(isNull(projects.clienteId), isNull(projects.leadGrccId)));
    return [
        ...ct.map((r) => ({ tabela: 'contrato' as const, id: r.id, texto: r.texto, gerencia: g(r.m) })),
        ...pr.map((r) => ({ tabela: 'proposta' as const, id: r.id, texto: r.texto, gerencia: g(r.m) })),
        ...c.map((r) => ({ tabela: 'cx' as const, id: String(r.id), texto: r.texto, gerencia: g(r.m) })),
        ...pj.map((r) => ({ tabela: 'projects' as const, id: String(r.id), texto: r.texto ?? '', gerencia: g(r.m) })),
    ];
}

export async function ligarCliente(tabela: TabelaComCliente, id: string, clienteId: string): Promise<void> {
    const feitas =
        tabela === 'contrato' ? await db.update(contrato).set({ clienteId }).where(eq(contrato.id, id)).returning({ id: contrato.id })
        : tabela === 'proposta' ? await db.update(proposta).set({ clienteId }).where(eq(proposta.id, id)).returning({ id: proposta.id })
        : tabela === 'cx' ? await db.update(cx).set({ clienteId }).where(eq(cx.id, Number(id))).returning({ id: cx.id })
        : await db.update(projects).set({ clienteId }).where(and(eq(projects.id, Number(id)), isNull(projects.leadGrccId))).returning({ id: projects.id });
    if (feitas.length === 0) throw new ErroCarteira('Linha não encontrada.');
}

export interface GerenciaParaEditar {
    chave: string;
    cardId: string;
    nome: string;
    visivel: boolean;
    clientes: Array<{ id: string; nome: string; sigla: string | null; ativo: boolean }>;
}

export async function gerenciasParaEditar(): Promise<GerenciaParaEditar[]> {
    const [cards, clientes] = await Promise.all([listarCards(), listarClientesComCarteira()]);
    return [...new Set(cards.map(chaveDaCarteira))].sort().map((chave) => {
        const card = cardDaGerencia(cards, chave)!;
        return {
            chave,
            cardId: card.id,
            nome: card.name,
            visivel: card.showInDashboard,
            clientes: clientes
                .filter((c) => c.gerencia === chave)
                .map(({ id, nome, sigla, ativo }) => ({ id, nome, sigla, ativo }))
                .sort((a, b) => (a.sigla ?? a.nome).localeCompare(b.sigla ?? b.nome, 'pt-BR')),
        };
    });
}

/** Clientes ativos para o seletor dos formulários de contrato e proposta. */
export async function clientesParaEscolha(): Promise<Array<{ id: string; nome: string; sigla: string | null }>> {
    return db.select({ id: cliente.id, nome: cliente.nome, sigla: cliente.sigla }).from(cliente).where(eq(cliente.ativo, true)).orderBy(cliente.nome);
}

/** = `mesclarClientes` do AIBertinho: leva contrato, proposta, cx, projeto e histórico da origem para o destino e apaga a origem.
 *  Não mexe no manager_id das linhas: as que ficarem em outra gerência aparecem em "Fora da carteira". */
export async function juntarClientes(origemId: string, destinoId: string, por: string): Promise<void> {
    if (origemId === destinoId) throw new ErroCarteira('Escolha dois clientes diferentes.');
    const [origem] = await db.select().from(cliente).where(eq(cliente.id, origemId));
    const [alvo] = await db.select().from(cliente).where(eq(cliente.id, destinoId));
    if (!origem || !alvo) throw new ErroCarteira('Cliente não encontrado.');
    await db.transaction(async (tx) => {
        const doDestino = { clienteId: destinoId };
        await tx.update(contrato).set(doDestino).where(eq(contrato.clienteId, origemId));
        await tx.update(proposta).set(doDestino).where(eq(proposta.clienteId, origemId));
        await tx.update(cx).set(doDestino).where(eq(cx.clienteId, origemId));
        await tx.update(projects).set(doDestino).where(eq(projects.clienteId, origemId));
        await tx.update(movimentoCarteira).set(doDestino).where(eq(movimentoCarteira.clienteId, origemId));
        const carteiras = await carteiraAtual([origemId, destinoId], tx);
        const herdada = carteiras.get(origemId);
        if (herdada && !carteiras.has(destinoId)) {
            await tx.insert(carteiraCliente).values({ clienteId: destinoId, gerencia: herdada, movidoEm: agora(), movidoPor: por });
            await tx.insert(movimentoCarteira).values({ clienteId: destinoId, deGerencia: null, paraGerencia: herdada, por, em: agora() });
        }
        await tx.delete(cliente).where(eq(cliente.id, origemId)); // a carteira da origem some no cascade
        if (origem.sigla && !alvo.sigla) await tx.update(cliente).set({ sigla: origem.sigla }).where(eq(cliente.id, destinoId));
    });
}
