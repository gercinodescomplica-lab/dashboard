'use server';

import { db } from '@/db/index';
import { managers, projects, cx, visits } from '@/db/schema';
import { Manager, CXItem, Visit } from '@/types/manager';
import { eq } from 'drizzle-orm';
import { calculateForecastFinal } from '@/lib/calc';
import { fetchCXByManager, fetchVisitsByManager } from '@/db/queries';

// Replace with a safer server-side check-1
export async function verifySettingsKey(key: string) {
    const correctKey = process.env.SETTINGS_KEY || 'prodam2026';
    return key === correctKey;
}

export async function saveCXData(managerId: string, items: CXItem[]) {
    try {
        // Delete all existing CX for this manager, then reinsert
        await db.delete(cx).where(eq(cx.managerId, managerId));

        if (items.length > 0) {
            await db.insert(cx).values(
                items.map((item) => ({
                    managerId,
                    cliente: item.cliente,
                    titulo: item.titulo,
                    problema: item.problema,
                    solucaoProposta: item.solucaoProposta,
                    status: item.status,
                    criticidade: item.criticidade ?? 'baixa',
                    isVisible: item.isVisible ?? true,
                    createdAt: item.createdAt ?? new Date().toISOString(),
                }))
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

export async function saveManagerData(m: Manager) {
    try {
        const fv = calculateForecastFinal(m.contratado, m.pipeline);

        // Upsert Manager details
        await db.insert(managers).values({
            id: m.id,
            name: m.name,
            role: m.role,
            avatarUrl: m.avatarUrl,
            year: m.year,
            meta: m.meta,
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
                contratado: m.contratado,
                forecastFinal: fv,
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
