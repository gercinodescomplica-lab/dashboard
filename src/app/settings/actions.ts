'use server';

import { db } from '@/db/index';
import { managers, projects, cx, visits, churn } from '@/db/schema';
import { Manager, CXItem, Visit, ChurnItem } from '@/types/manager';
import { eq, and, isNull } from 'drizzle-orm';
import { calculateForecastFinal } from '@/lib/calc';
import { fetchCXByManager, fetchVisitsByManager } from '@/db/queries';
import { chaveSettingsValida } from '@/lib/settings/chave';
import { conferirEdicaoDoCard, listarCards, listarClientesComCarteira, roteadorDaCarteira } from '@/db/carteira';
import { casarCliente, type ClienteParaCasar } from '@/lib/carteira/casar-cliente';
import { chaveDaCarteira } from '@/lib/carteira/gerencia';
import { ErroCarteira } from '@/lib/carteira/tipos';

function exigirChave(chave: string) {
    if (!chaveSettingsValida(chave)) throw new Error('Chave de administrador inválida.');
}

/** Cliente da linha vinda do editor: sem cliente casa pelo texto; cliente apagado (juntado) nunca chega ao insert. */
function clienteDaLinha(clienteId: string | null | undefined, texto: string | null | undefined, clientes: ClienteParaCasar[], chaveDoCard: string | null): string | null {
    const vigente = clienteId && clientes.some((c) => c.id === clienteId) ? clienteId : null;
    return vigente ?? casarCliente(texto, clientes, chaveDoCard);
}

export async function verifySettingsKey(key: string) {
    return chaveSettingsValida(key);
}


export async function saveCXData(chave: string, managerId: string, items: CXItem[]) {
    exigirChave(chave);
    try {
        // Lê o estado atual ANTES de apagar, só para comparar e decidir quais
        // itens vindos do Planner (têm externalId) foram de fato alterados à
        // mão nos campos que o próximo sync do Planner vai sobrescrever
        // (titulo/problema/status/criticidade) — ver planner-sync.ts. Isso
        // alimenta o aviso "editado manualmente" no CXEditor; não afeta o que
        // é salvo além do próprio manualEditAt.
        const currentRows = await db.select().from(cx).where(eq(cx.managerId, managerId));
        const currentByExternalId = new Map(
            currentRows.filter((r) => r.externalId).map((r) => [r.externalId as string, r])
        );

        // Item de cliente que está na carteira de OUTRA gerência vai para o card dela.
        // Se lá já existe o mesmo item, é a cópia velha de um editor aberto: descarta.
        const [rotear, clientes, cards] = await Promise.all([roteadorDaCarteira(), listarClientesComCarteira(), listarCards()]);
        const card = cards.find((c) => c.id === managerId);
        const chaveDoCard = card ? chaveDaCarteira(card) : null;
        const linhas: { item: CXItem; destino: string }[] = [];
        for (const original of items) {
            const item = { ...original, clienteId: clienteDaLinha(original.clienteId, original.cliente, clientes, chaveDoCard) };
            const destino = rotear(item.clienteId, managerId);
            if (destino !== managerId) {
                const jaLa = await db.select({ id: cx.id }).from(cx).where(and(eq(cx.managerId, destino),
                    item.externalId ? eq(cx.externalId, item.externalId) : and(eq(cx.titulo, item.titulo), eq(cx.clienteId, item.clienteId!))));
                if (jaLa.length) continue; // cópia velha de editor aberto
            }
            linhas.push({ item, destino });
        }

        // Delete all existing CX for this manager, then reinsert. Na mesma transação: falhou, nada se perde.
        await db.transaction(async (tx) => {
            await tx.delete(cx).where(eq(cx.managerId, managerId));
            if (linhas.length === 0) return;
            await tx.insert(cx).values(
                linhas.map(({ item, destino }) => {
                    // Preserva o externalId como veio (nunca editável na UI) —
                    // é o que faz o próximo sync do Planner reconhecer esta
                    // linha em vez de duplicá-la.
                    let manualEditAt = item.manualEditAt ?? null;
                    if (item.externalId) {
                        const prev = currentByExternalId.get(item.externalId);
                        const divergedFromPlanner =
                            !prev ||
                            prev.titulo !== item.titulo ||
                            prev.problema !== item.problema ||
                            prev.status !== item.status ||
                            (prev.criticidade ?? 'baixa') !== (item.criticidade ?? 'baixa');
                        if (divergedFromPlanner) {
                            manualEditAt = new Date().toISOString();
                        }
                    }
                    return {
                        managerId: destino,
                        clienteId: item.clienteId ?? null,
                        cliente: item.cliente,
                        titulo: item.titulo,
                        problema: item.problema,
                        solucaoProposta: item.solucaoProposta,
                        status: item.status,
                        criticidade: item.criticidade ?? 'baixa',
                        isVisible: item.isVisible ?? true,
                        createdAt: item.createdAt ?? new Date().toISOString(),
                        externalId: item.externalId ?? null,
                        manualEditAt,
                    };
                })
            );
        });
        return { success: true };
    } catch (err) {
        console.error('Failed to save CX:', err);
        throw new Error('Erro ao salvar CX no Turso.');
    }
}

export async function saveVisitsData(chave: string, managerId: string, items: Visit[]) {
    exigirChave(chave);
    try {
        await db.delete(visits).where(eq(visits.managerId, managerId));

        if (items.length > 0) {
            await db.insert(visits).values(
                items.map((item) => ({
                    managerId,
                    titulo: item.titulo,
                    local: item.local,
                    motivo: item.motivo,
                    data: item.data,
                    dataFim: item.dataFim || null,
                    createdAt: item.createdAt ?? new Date().toISOString(),
                }))
            );
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to save visits:', err);
        throw new Error('Erro ao salvar visitas no Turso.');
    }
}

export async function saveChurnData(chave: string, managerId: string, items: ChurnItem[]) {
    exigirChave(chave);
    try {
        await db.delete(churn).where(eq(churn.managerId, managerId));

        if (items.length > 0) {
            await db.insert(churn).values(
                items.map((item) => ({
                    managerId,
                    numeroContrato: item.numeroContrato,
                    valor: item.valor,
                    descricao: item.descricao,
                    motivo: item.motivo,
                    createdAt: item.createdAt ?? new Date().toISOString(),
                }))
            );
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to save churn data:', err);
        throw new Error('Erro ao salvar dados de churn no Turso.');
    }
}

// A recusa volta como valor: em produção o Next esconde a mensagem de erro lançado por action.
export async function saveManagerData(chave: string, m: Manager): Promise<{ success: true } | { success: false; erro: string }> {
    exigirChave(chave);
    try {
        await conferirEdicaoDoCard(m);
        const fv = calculateForecastFinal(m.contratado, m.pipeline);

        // Upsert Manager details
        await db.insert(managers).values({
            id: m.id,
            name: m.name,
            role: m.role,
            avatarUrl: m.avatarUrl,
            year: m.year,
            meta: m.meta,
            metaNovosNegocios: m.metaNovosNegocios ?? null,
            contratado: m.contratado,
            forecastFinal: fv,
            notes: null,
            showInDashboard: m.showInDashboard ?? true,
        }).onConflictDoUpdate({
            target: managers.id,
            set: {
                name: m.name,
                role: m.role,
                avatarUrl: m.avatarUrl,
                year: m.year,
                meta: m.meta,
                metaNovosNegocios: m.metaNovosNegocios ?? null,
                contratado: m.contratado,
                forecastFinal: fv,
                showInDashboard: m.showInDashboard ?? true,
            }
        });

        // 2. Assemble new projects (antes do delete: nada de consulta entre apagar e regravar)
        const allProjectsToInsert: any[] = [];

        ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'].forEach((qKey) => {
            const quarter = m.pipeline[qKey as keyof typeof m.pipeline];
            if (quarter && quarter.projects) {
                quarter.projects.forEach(proj => {
                    if (proj.leadGrccId) return; // gerado pela /grcc — o que vier do editor é descartado
                    allProjectsToInsert.push({
                        managerId: m.id,
                        quarter: qKey as 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado',
                        orgao: proj.orgao || null,
                        name: proj.name,
                        value: proj.value,
                        temperature: proj.temperature || null,
                        description: proj.description || null,
                        durationMonths: proj.durationMonths ?? 12,
                        startDate: proj.startDate || null,
                        billingStartMonth: proj.billingStartMonth || null,
                        history: proj.history ? JSON.stringify(proj.history) : null,
                        clienteId: proj.clienteId ?? null,
                    });
                });
            }
        });

        // Projeto de cliente que está na carteira de OUTRA gerência vai para o card dela (= gerenciaDoComercialPelaCarteira).
        // Se lá já existe o mesmo projeto (mesmo nome e cliente), é a cópia velha de um editor aberto: descarta.
        // Roda depois do upsert (card novo já está na lista de cards) e antes do delete.
        const [rotear, clientes] = await Promise.all([roteadorDaCarteira(), listarClientesComCarteira()]);
        const chaveDoCard = chaveDaCarteira(m);
        for (const p of allProjectsToInsert) {
            p.clienteId = clienteDaLinha(p.clienteId, p.orgao, clientes, chaveDoCard);
            const destino = rotear(p.clienteId, m.id);
            if (destino === m.id) continue;
            const [igual] = await db.select({ id: projects.id }).from(projects)
                .where(and(eq(projects.managerId, destino), eq(projects.name, p.name), eq(projects.clienteId, p.clienteId)));
            p.managerId = igual ? null : destino;
        }
        const aGravar = allProjectsToInsert.filter((p) => p.managerId !== null);

        // 3. Delete existing MANUAL projects to replace them. Projetos com leadGrccId são
        //    gerados pela /grcc (dono = cadastro de leads) e nunca são apagados/regravados aqui.
        //    Na mesma transação: falhou, nada se perde.
        await db.transaction(async (tx) => {
            await tx.delete(projects).where(and(eq(projects.managerId, m.id), isNull(projects.leadGrccId)));
            if (aGravar.length > 0) await tx.insert(projects).values(aGravar);
        });

        return { success: true };
    } catch (err) {
        if (err instanceof ErroCarteira) return { success: false, erro: err.message };
        console.error("Failed to save manager:", err);
        throw new Error("Erro ao salvar gerente no Turso.");
    }
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

export async function cloneManager(chave: string, sourceId: string, newName: string): Promise<{ success: true; newId: string }> {
    exigirChave(chave);
    try {
        const [source] = await db.select().from(managers).where(eq(managers.id, sourceId));
        if (!source) throw new Error('Gerente de origem não encontrado.');

        const roleSlug = slugify(source.role);
        const nameSlug = slugify(newName);
        const newId = `${roleSlug}-${nameSlug}`;

        const [existing] = await db.select().from(managers).where(eq(managers.id, newId));
        if (existing) throw new Error(`Já existe um gerente com o ID "${newId}".`);

        await db.insert(managers).values({
            id: newId,
            name: newName,
            role: source.role,
            avatarUrl: source.avatarUrl,
            year: source.year,
            meta: source.meta,
            contratado: source.contratado,
            forecastFinal: source.forecastFinal,
            notes: source.notes,
            servedClients: null, // congelado: clientes atendidos vêm da carteira
            showInDashboard: true,
        });

        const sourceProjects = await db.select().from(projects).where(eq(projects.managerId, sourceId));
        if (sourceProjects.length > 0) {
            await db.insert(projects).values(
                // leadGrccId é unique: o clone vira projeto manual.
                sourceProjects.map(({ id: _id, managerId: _mid, leadGrccId: _lead, ...rest }) => ({ ...rest, managerId: newId }))
            );
        }

        const sourceCX = await fetchCXByManager(sourceId);
        if (sourceCX.length > 0) {
            await db.insert(cx).values(
                sourceCX.map(({ id: _id, ...rest }) => ({
                    managerId: newId,
                    clienteId: rest.clienteId ?? null,
                    cliente: rest.cliente,
                    titulo: rest.titulo,
                    problema: rest.problema,
                    solucaoProposta: rest.solucaoProposta,
                    status: rest.status,
                    criticidade: rest.criticidade ?? 'baixa',
                    isVisible: rest.isVisible ?? true,
                    createdAt: rest.createdAt ?? new Date().toISOString(),
                }))
            );
        }

        const sourceVisits = await fetchVisitsByManager(sourceId);
        if (sourceVisits.length > 0) {
            await db.insert(visits).values(
                sourceVisits.map(({ id: _id, ...rest }) => ({
                    managerId: newId,
                    titulo: rest.titulo,
                    local: rest.local,
                    motivo: rest.motivo,
                    data: rest.data,
                    dataFim: rest.dataFim ?? null,
                    createdAt: rest.createdAt ?? new Date().toISOString(),
                }))
            );
        }

        return { success: true, newId };
    } catch (err) {
        console.error('Failed to clone manager:', err);
        throw err instanceof Error ? err : new Error('Erro ao clonar gerente.');
    }
}

export async function getFaturamento2025Action() {
    const { getFaturamento2025 } = await import('@/db/queries');
    return getFaturamento2025();
}

export async function saveFaturamento2025Action(chave: string, value: number) {
    exigirChave(chave);
    const { saveFaturamento2025 } = await import('@/db/queries');
    await saveFaturamento2025(value);
    return { success: true };
}

