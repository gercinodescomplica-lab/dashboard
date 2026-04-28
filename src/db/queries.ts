import { db } from './index';
import { managers, projects, cx, visits, contrato } from './schema';
import { eq, like, desc, or } from 'drizzle-orm';
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
            const activeProjects = quarterProjects.filter(
                (p) => p.temperature !== 'historico' && p.temperature !== 'perdido'
            );
            return {
                total: activeProjects.reduce((acc, p) => acc + p.value, 0),
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

// ─── Contrato Queries ──────────────────────────────────────────────────────────

export type ContratoRow = {
    id: string;
    numeroContrato: string;
    protheus: string | null;
    cliente: string;
    desde: string | null;
    dtInicioVigencia: string | null;
    dtFimVigencia: string | null;
    vlContratado: number | null;
    vlFaturado: number | null;
    vlSaldo: number | null;
    tipo: string | null;
    situacao: string | null;
    vigente: boolean | null;
    diretoria: string | null;
    gerencia: string | null;
    nomeGerente: string | null;
    objeto: string | null;
    managerId: string | null;
    createdAt: string;
    updatedAt: string;
    managerName: string | null;
};

export async function fetchAllContratos(search?: string): Promise<ContratoRow[]> {
    const baseQuery = db
        .select({
            id: contrato.id,
            numeroContrato: contrato.numeroContrato,
            protheus: contrato.protheus,
            cliente: contrato.cliente,
            desde: contrato.desde,
            dtInicioVigencia: contrato.dtInicioVigencia,
            dtFimVigencia: contrato.dtFimVigencia,
            vlContratado: contrato.vlContratado,
            vlFaturado: contrato.vlFaturado,
            vlSaldo: contrato.vlSaldo,
            tipo: contrato.tipo,
            situacao: contrato.situacao,
            vigente: contrato.vigente,
            diretoria: contrato.diretoria,
            gerencia: contrato.gerencia,
            nomeGerente: contrato.nomeGerente,
            objeto: contrato.objeto,
            managerId: contrato.managerId,
            createdAt: contrato.createdAt,
            updatedAt: contrato.updatedAt,
            managerName: managers.name,
        })
        .from(contrato)
        .leftJoin(managers, eq(contrato.managerId, managers.id))
        .orderBy(desc(contrato.dtFimVigencia));

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        return baseQuery.where(
            or(
                like(contrato.numeroContrato, term),
                like(contrato.cliente, term),
                like(contrato.nomeGerente, term),
                like(contrato.gerencia, term),
                like(contrato.objeto, term),
            )
        );
    }

    return baseQuery;
}

export async function fetchContratoById(id: string): Promise<ContratoRow | undefined> {
    const rows = await db
        .select({
            id: contrato.id,
            numeroContrato: contrato.numeroContrato,
            protheus: contrato.protheus,
            cliente: contrato.cliente,
            desde: contrato.desde,
            dtInicioVigencia: contrato.dtInicioVigencia,
            dtFimVigencia: contrato.dtFimVigencia,
            vlContratado: contrato.vlContratado,
            vlFaturado: contrato.vlFaturado,
            vlSaldo: contrato.vlSaldo,
            tipo: contrato.tipo,
            situacao: contrato.situacao,
            vigente: contrato.vigente,
            diretoria: contrato.diretoria,
            gerencia: contrato.gerencia,
            nomeGerente: contrato.nomeGerente,
            objeto: contrato.objeto,
            managerId: contrato.managerId,
            createdAt: contrato.createdAt,
            updatedAt: contrato.updatedAt,
            managerName: managers.name,
        })
        .from(contrato)
        .leftJoin(managers, eq(contrato.managerId, managers.id))
        .where(eq(contrato.id, id));
    return rows[0];
}

export async function fetchContratoByNumero(numero: string): Promise<ContratoRow | undefined> {
    const rows = await db
        .select({
            id: contrato.id,
            numeroContrato: contrato.numeroContrato,
            protheus: contrato.protheus,
            cliente: contrato.cliente,
            desde: contrato.desde,
            dtInicioVigencia: contrato.dtInicioVigencia,
            dtFimVigencia: contrato.dtFimVigencia,
            vlContratado: contrato.vlContratado,
            vlFaturado: contrato.vlFaturado,
            vlSaldo: contrato.vlSaldo,
            tipo: contrato.tipo,
            situacao: contrato.situacao,
            vigente: contrato.vigente,
            diretoria: contrato.diretoria,
            gerencia: contrato.gerencia,
            nomeGerente: contrato.nomeGerente,
            objeto: contrato.objeto,
            managerId: contrato.managerId,
            createdAt: contrato.createdAt,
            updatedAt: contrato.updatedAt,
            managerName: managers.name,
        })
        .from(contrato)
        .leftJoin(managers, eq(contrato.managerId, managers.id))
        .where(eq(contrato.numeroContrato, numero));
    return rows[0];
}

export async function createContrato(data: typeof contrato.$inferInsert) {
    return db.insert(contrato).values(data);
}

export async function updateContrato(id: string, data: Partial<typeof contrato.$inferInsert>) {
    return db
        .update(contrato)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(contrato.id, id));
}

export async function deleteContrato(id: string) {
    return db.delete(contrato).where(eq(contrato.id, id));
}

export async function fetchManagersList() {
    return db.select({ id: managers.id, name: managers.name, role: managers.role }).from(managers);
}
