import { db } from './index';
import { managers, projects, cx, visits, contrato, proposta } from './schema';
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
            showInDashboard: m.showInDashboard ?? true,
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
 * Same as fetchAllManagersFromDB but filters out managers with showInDashboard = false.
 * Used by the public dashboard so hidden managers don't appear.
 */
export async function fetchVisibleManagersFromDB(): Promise<Manager[]> {
    const all = await fetchAllManagersFromDB();
    return all.filter(m => m.showInDashboard !== false);
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

export async function fetchManagerById(id: string) {
    const rows = await db.select().from(managers).where(eq(managers.id, id));
    return rows[0] ?? null;
}

// ─── CX Queries ────────────────────────────────────────────────────────────────

export async function createCXItem(data: typeof cx.$inferInsert) {
    const rows = await db.insert(cx).values(data).returning();
    return rows[0];
}

export async function fetchCXItemById(id: number) {
    const rows = await db.select().from(cx).where(eq(cx.id, id));
    return rows[0] ?? null;
}

export async function updateCXItem(id: number, data: Partial<typeof cx.$inferInsert>) {
    const rows = await db.update(cx).set(data).where(eq(cx.id, id)).returning();
    return rows[0];
}

// ─── Project Queries ───────────────────────────────────────────────────────────

export async function createProject(data: typeof projects.$inferInsert) {
    const rows = await db.insert(projects).values(data).returning();
    return rows[0];
}

export async function fetchProjectById(id: number) {
    const rows = await db.select().from(projects).where(eq(projects.id, id));
    return rows[0] ?? null;
}

export async function updateProject(id: number, data: Partial<typeof projects.$inferInsert>) {
    const rows = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return rows[0];
}

// ─── Visit Queries ─────────────────────────────────────────────────────────────

export async function createVisit(data: typeof visits.$inferInsert) {
    const rows = await db.insert(visits).values(data).returning();
    return rows[0];
}

export async function fetchVisitById(id: number) {
    const rows = await db.select().from(visits).where(eq(visits.id, id));
    return rows[0] ?? null;
}

export async function updateVisit(id: number, data: Partial<typeof visits.$inferInsert>) {
    const rows = await db.update(visits).set(data).where(eq(visits.id, id)).returning();
    return rows[0];
}

// ─── Proposta Queries ──────────────────────────────────────────────────────────

export type PropostaRow = {
    id: string;
    numeroProposta: string;
    nomeOportunidade: string;
    proprietario: string | null;
    cliente: string;
    fase: string | null;
    valor: number | null;
    receitaEsperada: number | null;
    probabilidade: number | null;
    duracao: number | null;
    dataCriacao: string | null;
    dataFechamento: string | null;
    gerencia: string | null;
    managerId: string | null;
    status: string | null;
    observacao: string | null;
    createdAt: string;
    updatedAt: string;
    managerName: string | null;
};

export async function fetchAllPropostas(search?: string): Promise<PropostaRow[]> {
    const baseQuery = db
        .select({
            id: proposta.id,
            numeroProposta: proposta.numeroProposta,
            nomeOportunidade: proposta.nomeOportunidade,
            proprietario: proposta.proprietario,
            cliente: proposta.cliente,
            fase: proposta.fase,
            valor: proposta.valor,
            receitaEsperada: proposta.receitaEsperada,
            probabilidade: proposta.probabilidade,
            duracao: proposta.duracao,
            dataCriacao: proposta.dataCriacao,
            dataFechamento: proposta.dataFechamento,
            gerencia: proposta.gerencia,
            managerId: proposta.managerId,
            status: proposta.status,
            observacao: proposta.observacao,
            createdAt: proposta.createdAt,
            updatedAt: proposta.updatedAt,
            managerName: managers.name,
        })
        .from(proposta)
        .leftJoin(managers, eq(proposta.managerId, managers.id))
        .orderBy(desc(proposta.dataFechamento));

    if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        return baseQuery.where(
            or(
                like(proposta.numeroProposta, term),
                like(proposta.cliente, term),
                like(proposta.nomeOportunidade, term),
                like(proposta.proprietario, term),
                like(proposta.gerencia, term),
            )
        );
    }

    return baseQuery;
}

export async function fetchPropostaByNumero(numero: string): Promise<PropostaRow | undefined> {
    const rows = await db
        .select({
            id: proposta.id,
            numeroProposta: proposta.numeroProposta,
            nomeOportunidade: proposta.nomeOportunidade,
            proprietario: proposta.proprietario,
            cliente: proposta.cliente,
            fase: proposta.fase,
            valor: proposta.valor,
            receitaEsperada: proposta.receitaEsperada,
            probabilidade: proposta.probabilidade,
            duracao: proposta.duracao,
            dataCriacao: proposta.dataCriacao,
            dataFechamento: proposta.dataFechamento,
            gerencia: proposta.gerencia,
            managerId: proposta.managerId,
            status: proposta.status,
            observacao: proposta.observacao,
            createdAt: proposta.createdAt,
            updatedAt: proposta.updatedAt,
            managerName: managers.name,
        })
        .from(proposta)
        .leftJoin(managers, eq(proposta.managerId, managers.id))
        .where(eq(proposta.numeroProposta, numero));
    return rows[0];
}

export async function createProposta(data: typeof proposta.$inferInsert) {
    return db.insert(proposta).values(data);
}

export async function updateProposta(id: string, data: Partial<typeof proposta.$inferInsert>) {
    return db
        .update(proposta)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(proposta.id, id));
}

export async function deleteProposta(id: string) {
    return db.delete(proposta).where(eq(proposta.id, id));
}
