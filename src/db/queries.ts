import { db } from './index';
import { managers, projects, cx, visits } from './schema';
import { eq } from 'drizzle-orm';
import { Manager, CXItem, Visit } from '../types/manager';

/**
 * Fetches all managers from the database and constructs them exactly
 * like the JSON mock structure to ensure app compatibility.
 */
export async function fetchAllManagersFromDB(): Promise<Manager[]> {
    const allManagers = await db.select().from(managers);
    const allProjects = await db.select().from(projects);

    return allManagers.map((m) => {
        const mgrProjects = allProjects.filter((p) => p.managerId === m.id);

        const buildQuarter = (q: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado') => {
            const quarterProjects = mgrProjects.filter((p) => p.quarter === q);
            return {
                total: quarterProjects.reduce((acc, p) => acc + p.value, 0),
                projects: quarterProjects.map((p) => ({
                    orgao: p.orgao ?? undefined,
                    name: p.name,
                    value: p.value,
                    temperature: (p.temperature as any) ?? undefined,
                    description: p.description ?? undefined,
                })),
            };
        };

        const pipeline = {
            q1: buildQuarter('q1'),
            q2: buildQuarter('q2'),
            q3: buildQuarter('q3'),
            q4: buildQuarter('q4'),
            nao_mapeado: buildQuarter('nao_mapeado'),
        };

        const totalPipeline = pipeline.q1.total + pipeline.q2.total + pipeline.q3.total + pipeline.q4.total + pipeline.nao_mapeado.total;

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
            pipeline,
            // Try both property names to be absolutely safe
            servedClients: (() => {
                const raw = (m as any).servedClients || (m as any).served_clients;
                if (!raw) return [];
                try {
                    return typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch (e) {
                    console.error('Error parsing servedClients JSON:', e);
                    return [];
                }
            })(),
        };
    });
}

/**
 * Fetches CX records for a specific manager.
 */
export async function fetchCXByManager(managerId: string): Promise<CXItem[]> {
    const rows = await db.select().from(cx).where(eq(cx.managerId, managerId));
    return rows.map((r) => ({
        id: r.id,
        cliente: r.cliente,
        titulo: r.titulo,
        problema: r.problema,
        solucaoProposta: r.solucaoProposta,
        status: r.status as CXItem['status'],
        criticidade: (r.criticidade as CXItem['criticidade']) ?? 'baixa',
        isVisible: r.isVisible ?? true,
        createdAt: r.createdAt,
    }));
}

/**
 * Fetches visits for a specific manager, ordered by date descending.
 */
export async function fetchVisitsByManager(managerId: string): Promise<Visit[]> {
    const rows = await db.select().from(visits).where(eq(visits.managerId, managerId));
    return rows
        .map((r) => ({
            id: r.id,
            titulo: r.titulo,
            local: r.local,
            motivo: r.motivo,
            data: r.data,
            dataFim: r.dataFim ?? undefined,
            createdAt: r.createdAt,
        }))
        .sort((a, b) => b.data.localeCompare(a.data)); // newest first
}

/**
 * Fetches all managers and their associated data (projects, CX, visits) for the external API.
 */
export async function fetchFullDashboardData(): Promise<Manager[]> {
    const allManagers = await fetchAllManagersFromDB();
    
    // Supplement each manager with CX and Visits
    const fullData = await Promise.all(
        allManagers.map(async (manager) => {
            const cx = await fetchCXByManager(manager.id);
            const visits = await fetchVisitsByManager(manager.id);
            return {
                ...manager,
                cx,
                visits
            };
        })
    );

    return fullData;
}
