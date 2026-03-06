import { db } from './index';
import { managers, projects } from './schema';
import { Manager } from '../types/manager';

/**
 * Fetches all managers from the database and constructs them exactly
 * like the JSON mock structure to ensure app compatibility.
 */
export async function fetchAllManagersFromDB(): Promise<Manager[]> {
    const allManagers = await db.select().from(managers);
    const allProjects = await db.select().from(projects);

    return allManagers.map((m) => {
        // Filter projects for the specific manager
        const mgrProjects = allProjects.filter((p) => p.managerId === m.id);

        // Helper to construct exactly the Quarter structure expected by the interface
        const buildQuarter = (q: 'q1' | 'q2' | 'q3' | 'q4') => {
            const quarterProjects = mgrProjects.filter((p) => p.quarter === q);
            return {
                total: quarterProjects.reduce((acc, p) => acc + p.value, 0),
                projects: quarterProjects.map((p) => ({
                    orgao: p.orgao ?? undefined,
                    name: p.name,
                    value: p.value,
                    temperature: (p.temperature as any) ?? undefined,
                })),
            };
        };

        const pipeline = {
            q1: buildQuarter('q1'),
            q2: buildQuarter('q2'),
            q3: buildQuarter('q3'),
            q4: buildQuarter('q4'),
        };

        const totalPipeline = pipeline.q1.total + pipeline.q2.total + pipeline.q3.total + pipeline.q4.total;

        return {
            id: m.id,
            name: m.name,
            role: m.role,
            avatarUrl: m.avatarUrl,
            year: m.year,
            meta: m.meta,
            contratado: m.contratado,
            forecastFinal: (m.contratado || 0) + totalPipeline,
            notes: m.notes ?? undefined,
            pipeline
        };
    });
}
