'use server';

import { db } from '@/db/index';
import { managers, projects, cx, visits } from '@/db/schema';
import { Manager, CXItem, Visit } from '@/types/manager';
import { eq } from 'drizzle-orm';
import { calculateForecastFinal } from '@/lib/calc';

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
            notes: null
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
