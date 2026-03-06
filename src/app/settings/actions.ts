'use server';

import { db } from '@/db/index';
import { managers, projects } from '@/db/schema';
import { Manager } from '@/types/manager';
import { eq } from 'drizzle-orm';
import { calculateForecastFinal } from '@/lib/calc';

// Replace with a safer server-side check
export async function verifySettingsKey(key: string) {
    // Basic verification against environment variable
    const correctKey = process.env.SETTINGS_KEY || 'prodam2026';
    return key === correctKey;
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

        ['q1', 'q2', 'q3', 'q4'].forEach((qKey) => {
            const quarter = m.pipeline[qKey as keyof typeof m.pipeline];
            if (quarter && quarter.projects) {
                quarter.projects.forEach(proj => {
                    allProjectsToInsert.push({
                        managerId: m.id,
                        quarter: qKey as 'q1' | 'q2' | 'q3' | 'q4',
                        orgao: proj.orgao || null,
                        name: proj.name,
                        value: proj.value,
                        temperature: proj.temperature || null,
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
