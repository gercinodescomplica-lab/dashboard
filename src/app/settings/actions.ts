'use server';

import { db } from '@/db/index';
import { managers, projects, cx, visits, churn } from '@/db/schema';
import { Manager, CXItem, Visit, ChurnItem } from '@/types/manager';
import { eq } from 'drizzle-orm';
import { calculateForecastFinal } from '@/lib/calc';
import { fetchCXByManager, fetchVisitsByManager } from '@/db/queries';

// Replace with a safer server-side check-1
export async function verifySettingsKey(key: string) {
    if (!key || typeof key !== 'string') return false;
    const trimmed = key.trim();
    const correctKey = process.env.SETTINGS_KEY || 'prodam2026';
    const diretoriaKey = process.env.DIRETORIA_KEY;
    const directorateKey = process.env.DIRECTORATE_KEY;
    return trimmed === correctKey || (!!diretoriaKey && trimmed === diretoriaKey) || (!!directorateKey && trimmed === directorateKey);
}


export async function saveCXData(managerId: string, items: CXItem[]) {
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

        // Delete all existing CX for this manager, then reinsert
        await db.delete(cx).where(eq(cx.managerId, managerId));

        if (items.length > 0) {
            await db.insert(cx).values(
                items.map((item) => {
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
                        managerId,
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
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to save CX:', err);
        throw new Error('Erro ao salvar CX no Turso.');
    }
}

export async function saveVisitsData(managerId: string, items: Visit[]) {
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

export async function saveChurnData(managerId: string, items: ChurnItem[]) {
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

export async function saveManagerData(m: Manager) {
    try {
        const fv = calculateForecastFinal(m.contratado, m.pipeline);

        const servedClientsJson = JSON.stringify(m.servedClients ?? []);

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
            servedClients: servedClientsJson,
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
                servedClients: servedClientsJson,
                showInDashboard: m.showInDashboard ?? true,
            }
        });

        // 2. Delete existing projects to replace them
        await db.delete(projects).where(eq(projects.managerId, m.id));

        // 3. Assemble and inserts new projects if any
        const allProjectsToInsert: any[] = [];

        ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'].forEach((qKey) => {
            const quarter = m.pipeline[qKey as keyof typeof m.pipeline];
            if (quarter && quarter.projects) {
                quarter.projects.forEach(proj => {
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
                    });
                });
            }
        });

        if (allProjectsToInsert.length > 0) {
            await db.insert(projects).values(allProjectsToInsert);
        }

        return { success: true };
    } catch (err) {
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

export async function cloneManager(sourceId: string, newName: string): Promise<{ success: true; newId: string }> {
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
            servedClients: source.servedClients,
            showInDashboard: true,
        });

        const sourceProjects = await db.select().from(projects).where(eq(projects.managerId, sourceId));
        if (sourceProjects.length > 0) {
            await db.insert(projects).values(
                sourceProjects.map(({ id: _id, managerId: _mid, ...rest }) => ({ ...rest, managerId: newId }))
            );
        }

        const sourceCX = await fetchCXByManager(sourceId);
        if (sourceCX.length > 0) {
            await db.insert(cx).values(
                sourceCX.map(({ id: _id, ...rest }) => ({
                    managerId: newId,
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

export async function saveFaturamento2025Action(value: number) {
    const { saveFaturamento2025 } = await import('@/db/queries');
    await saveFaturamento2025(value);
    return { success: true };
}

