import { db } from './index';
import { managers, projects, cx, visits, contrato, proposta, systemSettings, churn, leadGrcc, leadGrccHistorico, dropdownOptions } from './schema';
import { eq, like, desc, or, inArray, and, isNull, sql } from 'drizzle-orm';
import { Manager, CXItem, Visit, ChurnItem } from '../types/manager';

/**
 * Fetches all managers from the database and constructs them exactly
 * like the JSON mock structure to ensure app compatibility.
 */
import { calcEffectiveContratado, sumNovosNegocios, sumPipelineAberto, sumPipelineContratado2026, calcForecastProRata2026 } from '../lib/calc';

export async function fetchAllManagersFromDB(): Promise<Manager[]> {
    const allManagers = await db.select().from(managers);
    const allProjects = await db.select().from(projects);

    return allManagers.map((m) => {
        const mgrProjects = allProjects.filter((p) => p.managerId === m.id);

        const OPEN_TEMPS = ['quente', 'morno', 'frio'];
        const ALL_ACTIVE_TEMPS = ['quente', 'morno', 'frio', 'contratado'];
        const buildQuarter = (q: 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado') => {
            const quarterProjects = mgrProjects.filter((p) => p.quarter === q);
            // All active projects (non-historico, non-perdido) count toward the quarter total
            const activeProjects = quarterProjects.filter(
                (p) => ALL_ACTIVE_TEMPS.includes(p.temperature ?? '')
            );
            return {
                total: activeProjects.reduce((acc, p) => acc + p.value, 0),
                projects: quarterProjects.map((p) => ({
                    orgao: p.orgao ?? undefined,
                    name: p.name,
                    value: p.value,
                    temperature: (p.temperature as any) ?? undefined,
                    description: p.description ?? undefined,
                    durationMonths: p.durationMonths ?? 12,
                    startDate: p.startDate ?? undefined,
                    billingStartMonth: p.billingStartMonth ?? undefined,
                    leadGrccId: p.leadGrccId ?? undefined,
                    history: (() => {
                        if (!p.history) return undefined;
                        try {
                            return typeof p.history === 'string' ? JSON.parse(p.history) : p.history;
                        } catch (e) {
                            return undefined;
                        }
                    })(),
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

        // allActiveTCV = TCV de todos os projetos ativos (quente/morno/frio/contratado)
        // Exclui apenas historico e perdido
        // Mover frio→contratado NÃO altera o forecastFinal (mesmo valor, só muda o label)
        const allActiveTCV = pipeline.q1.total + pipeline.q2.total + pipeline.q3.total + pipeline.q4.total + pipeline.nao_mapeado.total;
        const pipelineAberto = sumPipelineAberto(pipeline); // TCV só de quente/morno/frio (para outros usos)
        const novosNegocios = sumPipelineContratado2026(pipeline); // Receita pro-rata reconhecida em 2026 (só contratado)
        const contratado2026 = calcEffectiveContratado(m.contratado, pipeline); // Herdados + pro-rata contratados
        const forecastProRata2026 = calcForecastProRata2026(m.contratado, pipeline); // Forecast completo pro-rata 2026

        return {
            id: m.id,
            name: m.name,
            role: m.role,
            avatarUrl: m.avatarUrl,
            year: m.year,
            meta: m.meta,
            metaNovosNegocios: m.metaNovosNegocios ?? undefined,
            contratado: m.contratado,
            contratosHerdados: m.contratado,
            novosNegocios,
            contratado2026,
            // Forecast Final = Herdados + TCV bruto de todos os projetos ativos
            // Mover um projeto de frio→contratado NÃO muda o Forecast Final
            forecastFinal: m.contratado + allActiveTCV,
            forecastProRata2026,
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
    return all.filter(m => m.showInDashboard !== false && m.id !== 'projeto-triade');
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
        externalId: r.externalId,
        manualEditAt: r.manualEditAt,
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
 * Fetches churn records for a specific manager.
 */
export async function fetchChurnByManager(managerId: string): Promise<ChurnItem[]> {
    const rows = await db.select().from(churn).where(eq(churn.managerId, managerId));
    return rows.map((r) => ({
        id: r.id,
        managerId: r.managerId,
        numeroContrato: r.numeroContrato,
        valor: r.valor,
        descricao: r.descricao,
        motivo: r.motivo,
        createdAt: r.createdAt,
    }));
}

/**
 * Fetches all churn records across all managers.
 */
export async function fetchAllChurns(): Promise<ChurnItem[]> {
    const rows = await db.select().from(churn);
    return rows.map((r) => ({
        id: r.id,
        managerId: r.managerId,
        numeroContrato: r.numeroContrato,
        valor: r.valor,
        descricao: r.descricao,
        motivo: r.motivo,
        createdAt: r.createdAt,
    }));
}

export async function createChurnItem(data: typeof churn.$inferInsert) {
    const rows = await db.insert(churn).values(data).returning();
    return rows[0];
}

export async function updateChurnItem(id: number, data: Partial<typeof churn.$inferInsert>) {
    const rows = await db.update(churn).set(data).where(eq(churn.id, id)).returning();
    return rows[0];
}

export async function deleteChurnItem(id: number) {
    return db.delete(churn).where(eq(churn.id, id));
}

/**
 * Fetches all managers and their associated data (projects, CX, visits, churn) for the external API.
 */
export async function fetchFullDashboardData(): Promise<Manager[]> {
    const allManagers = await fetchVisibleManagersFromDB();
    
    // Supplement each manager with CX, Visits, and Churn
    const fullData = await Promise.all(
        allManagers.map(async (manager) => {
            const cxData = await fetchCXByManager(manager.id);
            const visitsData = await fetchVisitsByManager(manager.id);
            const churnData = await fetchChurnByManager(manager.id);
            return {
                ...manager,
                cx: cxData,
                visits: visitsData,
                churn: churnData,
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

// Used to match Planner task titles ("SEGES - ...") to a manager via servedClients.
// Kept separate from fetchManagerById since it needs the parsed servedClients list,
// not the full Manager shape.
export async function fetchManagersForClientMatch() {
    const rows = await db
        .select({ id: managers.id, name: managers.name, servedClients: managers.servedClients })
        .from(managers);
    return rows.map((m) => {
        let servedClients: string[] = [];
        if (m.servedClients) {
            try {
                servedClients = JSON.parse(m.servedClients);
            } catch {
                servedClients = [];
            }
        }
        return { id: m.id, name: m.name, servedClients };
    });
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

// Looks up existing CX rows by Planner task id (external_id) so a sync can
// decide insert vs. update. external_id is not scoped per manager (a task
// could in theory be reassigned), so this checks across all managers.
export async function fetchCXByExternalIds(externalIds: string[]) {
    if (externalIds.length === 0) return [];
    // status/criticidade vêm junto (além de id/externalId) para o
    // planner-sync poder comparar valor antigo x novo e registrar o que
    // mudou no histórico (ver src/lib/planner-sync.ts).
    return db
        .select({
            id: cx.id,
            externalId: cx.externalId,
            status: cx.status,
            criticidade: cx.criticidade,
        })
        .from(cx)
        .where(inArray(cx.externalId, externalIds));
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

export async function getFaturamento2025(): Promise<number> {
    try {
        const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'faturamento_2025'));
        if (rows.length > 0 && rows[0].value) {
            const val = parseFloat(rows[0].value);
            if (!isNaN(val)) return val;
        }
    } catch (err) {
        console.error('Error fetching faturamento_2025:', err);
    }
    return 630386397.11;
}

export async function saveFaturamento2025(value: number): Promise<void> {
    const valStr = value.toString();
    await db
        .insert(systemSettings)
        .values({
            key: 'faturamento_2025',
            value: valStr,
            updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
                value: valStr,
                updatedAt: new Date().toISOString(),
            },
        });
}

const PLANNER_LAST_SYNCED_KEY = 'planner_last_synced_at';

/** Epoch ms of the last successful (or attempted) Planner pull-sync, or null if it never ran. */
export async function getPlannerLastSyncedAt(): Promise<number | null> {
    const rows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, PLANNER_LAST_SYNCED_KEY));
    if (rows.length === 0) return null;
    const ts = Number(rows[0].value);
    return Number.isFinite(ts) ? ts : null;
}

/** Records when the Planner pull-sync last ran, used to throttle src/lib/planner-pull.ts. */
export async function savePlannerLastSyncedAt(epochMs: number): Promise<void> {
    const valStr = epochMs.toString();
    await db
        .insert(systemSettings)
        .values({
            key: PLANNER_LAST_SYNCED_KEY,
            value: valStr,
            updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
                value: valStr,
                updatedAt: new Date().toISOString(),
            },
        });
}

// ─── GRCC — leads (/grcc) ────────────────────────────────────────────────────
//
// Toda escrita roda numa transação que grava, juntos: o lead, o evento de histórico, o
// projeto gerado no pipeline da Débora e o +1 em `grcc_versao` (que o dashboard consulta
// para atualizar ao vivo). Nunca existe mudança sem histórico nem lead sem projeto.

import { diffLead } from '../lib/grcc/diff';
import { dadosDoLead, montarPrevia } from '../lib/grcc/previa';
import { projetoDoLead } from '../lib/grcc/pipeline';
import { linhaDoTempoAndamento } from '../lib/grcc/organizar';
import {
    CAMPOS_LISTA,
    FIELD_DA_LISTA,
    type CampoLista,
    type CategoriaGrcc,
    type EventoHistorico,
    type LeadGrcc,
    type LeadGrccDados,
    type TemperaturaLead,
    type LinhaPlanilha,
    type Movimentacao,
    type Mudanca,
    type OrigemEvento,
    type ProblemaLinha,
    type ProjetoManual,
    type UltimoImport,
} from '../lib/grcc/tipos';

export class ErroGrcc extends Error {}

const AUTOR_GRCC = 'GRCC';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

function linhaParaLead(r: typeof leadGrcc.$inferSelect): LeadGrcc {
    return {
        id: r.id,
        cliente: r.cliente,
        solicitacao: r.solicitacao,
        status: r.status,
        categoria: r.categoria as CategoriaGrcc,
        temperatura: (r.temperatura as TemperaturaLead | null) ?? null,
        etapa: r.etapa,
        situacao: r.situacao,
        motivoPerda: r.motivoPerda,
        familiaDemanda: r.familiaDemanda,
        valor: r.valor,
        uf: r.uf,
        municipio: r.municipio,
        regiao: r.regiao,
        contatoNome: r.contatoNome,
        contatoEmail: r.contatoEmail,
        contatoTelefone: r.contatoTelefone,
        previsaoFechamento: r.previsaoFechamento,
        inicioFaturamento: r.inicioFaturamento,
        duracaoMeses: r.duracaoMeses,
        visivelDashboard: r.visivelDashboard,
        criadoEm: r.criadoEm,
        atualizadoEm: r.atualizadoEm,
    };
}

function linhaParaEvento(r: typeof leadGrccHistorico.$inferSelect): EventoHistorico {
    let mudancas: Mudanca[] = [];
    try {
        mudancas = JSON.parse(r.mudancas);
    } catch {
        mudancas = [];
    }
    return { id: r.id, leadId: r.leadId, quando: r.quando, origem: r.origem, arquivo: r.arquivo, autor: r.autor, mudancas, corrige: r.corrigeId ?? null };
}

export async function listLeadsGrcc(): Promise<LeadGrcc[]> {
    const rows = await db.select().from(leadGrcc).where(isNull(leadGrcc.excluidoEm)).orderBy(desc(leadGrcc.atualizadoEm));
    return rows.map(linhaParaLead);
}

export async function getLeadGrcc(id: number): Promise<LeadGrcc | null> {
    const [r] = await db.select().from(leadGrcc).where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)));
    return r ? linhaParaLead(r) : null;
}

/** Gerente dono do pipeline gerado: role GRCC com o maior ano. */
export async function fetchGerenteGrcc(ex: Executor = db): Promise<{ id: string; year: number } | null> {
    const [m] = await ex
        .select({ id: managers.id, year: managers.year })
        .from(managers)
        .where(eq(managers.role, 'GRCC'))
        .orderBy(desc(managers.year))
        .limit(1);
    return m ?? null;
}

async function exigirGerente(tx: Tx) {
    const g = await fetchGerenteGrcc(tx);
    if (!g) throw new ErroGrcc('Gerente da GRCC não encontrado (nenhum gerente com papel "GRCC").');
    return g;
}

async function registrarEvento(
    tx: Tx,
    leadId: number,
    origem: OrigemEvento,
    mudancas: Mudanca[],
    arquivo: string | null,
    quando: string,
    corrigeId: number | null = null
) {
    await tx.insert(leadGrccHistorico).values({ leadId, quando, origem, arquivo, autor: AUTOR_GRCC, mudancas: JSON.stringify(mudancas), corrigeId });
}

async function sincronizarProjeto(tx: Tx, lead: LeadGrcc, gerente: { id: string; year: number }) {
    const p = projetoDoLead(lead, gerente);
    await tx
        .insert(projects)
        .values(p)
        .onConflictDoUpdate({
            target: projects.leadGrccId,
            set: {
                managerId: p.managerId,
                quarter: p.quarter,
                orgao: p.orgao,
                name: p.name,
                value: p.value,
                temperature: p.temperature,
                description: p.description,
                durationMonths: p.durationMonths,
                startDate: p.startDate,
            },
        });
}

async function incrementarVersao(tx: Tx) {
    await tx.run(sql`
        INSERT INTO system_settings (key, value, updated_at) VALUES ('grcc_versao', '1', ${new Date().toISOString()})
        ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = excluded.updated_at
    `);
}

/** Valores novos de etapa/situação/motivo/família entram na lista suspensa (a planilha manda). */
async function acrescentarAsListas(tx: Tx, dados: LeadGrccDados[]) {
    const existentes = await tx.select().from(dropdownOptions).where(like(dropdownOptions.field, 'grcc_%'));
    const conhecidos = new Set(existentes.map((o) => `${o.field}|${o.value}`));
    const novos: { field: string; value: string }[] = [];
    for (const d of dados) {
        for (const campo of CAMPOS_LISTA) {
            if (campo === 'categoria') continue;
            const valor = d[campo];
            if (!valor) continue;
            const field = FIELD_DA_LISTA[campo];
            const k = `${field}|${valor}`;
            if (conhecidos.has(k)) continue;
            conhecidos.add(k);
            novos.push({ field, value: valor });
        }
    }
    if (novos.length > 0) await tx.insert(dropdownOptions).values(novos);
}

async function gravarLead(
    tx: Tx,
    id: number | null,
    dados: LeadGrccDados,
    origem: 'cadastro' | 'edicao' | 'importacao',
    arquivo: string | null,
    gerente: { id: string; year: number },
    agora: string
): Promise<{ lead: LeadGrcc; mudou: boolean }> {
    if (id === null) {
        const [r] = await tx.insert(leadGrcc).values({ ...dados, criadoEm: agora, atualizadoEm: agora }).returning();
        const lead = linhaParaLead(r);
        await registrarEvento(tx, lead.id, origem === 'importacao' ? 'importacao' : 'cadastro', diffLead(null, dados), arquivo, agora);
        await sincronizarProjeto(tx, lead, gerente);
        return { lead, mudou: true };
    }

    const [atualRow] = await tx.select().from(leadGrcc).where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)));
    if (!atualRow) throw new ErroGrcc('Lead não encontrado (pode ter sido excluído).');
    const atual = linhaParaLead(atualRow);
    const mudancas = diffLead(dadosDoLead(atual), dados);
    if (mudancas.length === 0) return { lead: atual, mudou: false };

    const [r] = await tx.update(leadGrcc).set({ ...dados, atualizadoEm: agora }).where(eq(leadGrcc.id, id)).returning();
    const lead = linhaParaLead(r);
    await registrarEvento(tx, id, origem, mudancas, arquivo, agora);
    await sincronizarProjeto(tx, lead, gerente);
    return { lead, mudou: true };
}

export async function salvarLeadGrcc(
    id: number | null,
    dados: LeadGrccDados,
    opcoes: { visivelDashboard?: boolean } = {}
): Promise<{ lead: LeadGrcc; mudou: boolean }> {
    return db.transaction(async (tx) => {
        const gerente = await exigirGerente(tx);
        const r = await gravarLead(tx, id, dados, id === null ? 'cadastro' : 'edicao', null, gerente, new Date().toISOString());
        if (r.mudou) await acrescentarAsListas(tx, [dados]);
        let visibilidadeMudou = false;
        if (opcoes.visivelDashboard !== undefined && opcoes.visivelDashboard !== r.lead.visivelDashboard) {
            await tx.update(leadGrcc).set({ visivelDashboard: opcoes.visivelDashboard }).where(eq(leadGrcc.id, r.lead.id));
            r.lead = { ...r.lead, visivelDashboard: opcoes.visivelDashboard };
            visibilidadeMudou = true;
        }
        // A versão avisa o dashboard para recarregar — vale também quando só a visibilidade mudou.
        if (r.mudou || visibilidadeMudou) await incrementarVersao(tx);
        return { lead: r.lead, mudou: r.mudou || visibilidadeMudou };
    });
}

/**
 * Corrige (`texto`) ou remove (`texto = null`) um andamento já gravado. Nunca altera o evento original:
 * grava um evento `correcao`/`remocao` que aponta para ele. Se o andamento ajustado era o ATUAL, o
 * andamento do lead (e a descrição do projeto no pipeline) passa a refletir a linha do tempo corrigida.
 */
export async function corrigirAndamentoGrcc(
    leadId: number,
    eventoId: number,
    texto: string | null
): Promise<{ lead: LeadGrcc; historico: EventoHistorico[]; mudou: boolean }> {
    return db.transaction(async (tx) => {
        const gerente = await exigirGerente(tx);
        const [row] = await tx.select().from(leadGrcc).where(and(eq(leadGrcc.id, leadId), isNull(leadGrcc.excluidoEm)));
        if (!row) throw new ErroGrcc('Lead não encontrado (pode ter sido excluído).');
        let lead = linhaParaLead(row);

        const lerHistorico = async () =>
            (
                await tx
                    .select()
                    .from(leadGrccHistorico)
                    .where(eq(leadGrccHistorico.leadId, leadId))
                    .orderBy(desc(leadGrccHistorico.quando), desc(leadGrccHistorico.id))
            ).map(linhaParaEvento);

        const antes = await lerHistorico();
        const alvo = linhaDoTempoAndamento(antes).find((a) => a.id === eventoId);
        if (!alvo) throw new ErroGrcc('Andamento não encontrado (pode ter sido removido).');
        const novo = texto === null ? null : texto.trim();
        if (novo === '') throw new ErroGrcc('O andamento não pode ficar vazio. Para tirar da linha do tempo, use "Remover".');
        if (novo === alvo.texto) return { lead, historico: antes, mudou: false };

        const agora = new Date().toISOString();
        await registrarEvento(tx, leadId, novo === null ? 'remocao' : 'correcao', [{ campo: 'status', de: alvo.texto, para: novo }], null, agora, eventoId);

        const historico = await lerHistorico();
        const atual = linhaDoTempoAndamento(historico)[0]?.texto ?? null;
        if (atual !== lead.status) {
            const [r] = await tx.update(leadGrcc).set({ status: atual, atualizadoEm: agora }).where(eq(leadGrcc.id, leadId)).returning();
            lead = linhaParaLead(r);
            await sincronizarProjeto(tx, lead, gerente);
        }
        await incrementarVersao(tx);
        return { lead, historico, mudou: true };
    });
}

export async function excluirLeadGrcc(id: number): Promise<void> {
    await db.transaction(async (tx) => {
        const agora = new Date().toISOString();
        const atualizados = await tx
            .update(leadGrcc)
            .set({ excluidoEm: agora, atualizadoEm: agora })
            .where(and(eq(leadGrcc.id, id), isNull(leadGrcc.excluidoEm)))
            .returning({ id: leadGrcc.id });
        if (atualizados.length === 0) throw new ErroGrcc('Lead não encontrado (pode ter sido excluído).');
        await registrarEvento(tx, id, 'exclusao', [], null, agora);
        await tx.delete(projects).where(eq(projects.leadGrccId, id));
        await incrementarVersao(tx);
    });
}

export async function fetchProjetosManuaisGrcc(): Promise<ProjetoManual[]> {
    const g = await fetchGerenteGrcc();
    if (!g) return [];
    const rows = await db
        .select({ id: projects.id, orgao: projects.orgao, name: projects.name, value: projects.value, quarter: projects.quarter })
        .from(projects)
        .where(and(eq(projects.managerId, g.id), isNull(projects.leadGrccId)));
    return rows;
}

/**
 * Confirma uma importação. O servidor NÃO confia na prévia do navegador: reclassifica as
 * linhas contra o banco atual. Import nunca exclui leads ausentes da planilha.
 * Primeira importação (tabela vazia) com projetos manuais da Débora exige
 * `substituirPipelineManual = true` — eles são apagados na mesma transação.
 */
export async function aplicarImportGrcc(input: {
    arquivo: string;
    linhas: LinhaPlanilha[];
    problemas: ProblemaLinha[];
    substituirPipelineManual: boolean;
}): Promise<{ novos: number; alterados: number }> {
    return db.transaction(async (tx) => {
        const gerente = await exigirGerente(tx);
        const existentesRows = await tx.select().from(leadGrcc).where(isNull(leadGrcc.excluidoEm));
        const existentes = existentesRows.map(linhaParaLead);

        // A prévia vem ANTES de qualquer escrita: o cutover só apaga o pipeline manual se houver
        // leads para pôr no lugar.
        const previa = montarPrevia(input.linhas, input.problemas, existentes);

        let apagouManuais = false;
        if (existentes.length === 0) {
            const manuais = await tx
                .select({ id: projects.id })
                .from(projects)
                .where(and(eq(projects.managerId, gerente.id), isNull(projects.leadGrccId)));
            if (manuais.length > 0) {
                if (!input.substituirPipelineManual) {
                    throw new ErroGrcc('Confirme a substituição do pipeline manual da Débora antes de gravar.');
                }
                if (previa.novos.length === 0) throw new ErroGrcc('Nenhum lead válido para substituir o pipeline manual.');
                await tx.delete(projects).where(and(eq(projects.managerId, gerente.id), isNull(projects.leadGrccId)));
                apagouManuais = true;
            }
        }

        const agora = new Date().toISOString();
        for (const n of previa.novos) await gravarLead(tx, null, n.dados, 'importacao', input.arquivo, gerente, agora);
        for (const a of previa.alterados) await gravarLead(tx, a.leadId, a.dados, 'importacao', input.arquivo, gerente, agora);

        await acrescentarAsListas(tx, [...previa.novos.map((n) => n.dados), ...previa.alterados.map((a) => a.dados)]);

        const resumo: UltimoImport = { arquivo: input.arquivo, quando: agora, novos: previa.novos.length, alterados: previa.alterados.length };
        await tx
            .insert(systemSettings)
            .values({ key: 'grcc_ultimo_import', value: JSON.stringify(resumo), updatedAt: agora })
            .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(resumo), updatedAt: agora } });
        if (apagouManuais || resumo.novos + resumo.alterados > 0) await incrementarVersao(tx);

        return { novos: resumo.novos, alterados: resumo.alterados };
    });
}

export async function fetchHistoricoLead(leadId: number): Promise<EventoHistorico[]> {
    const rows = await db
        .select()
        .from(leadGrccHistorico)
        .where(eq(leadGrccHistorico.leadId, leadId))
        .orderBy(desc(leadGrccHistorico.quando), desc(leadGrccHistorico.id));
    return rows.map(linhaParaEvento);
}

export async function fetchMovimentacoesRecentes(limite = 15): Promise<Movimentacao[]> {
    const rows = await db
        .select({ ev: leadGrccHistorico, cliente: leadGrcc.cliente, solicitacao: leadGrcc.solicitacao })
        .from(leadGrccHistorico)
        .innerJoin(leadGrcc, eq(leadGrcc.id, leadGrccHistorico.leadId))
        .orderBy(desc(leadGrccHistorico.quando), desc(leadGrccHistorico.id))
        .limit(limite);
    return rows.map((r) => ({ ...linhaParaEvento(r.ev), cliente: r.cliente, solicitacao: r.solicitacao }));
}

export async function lerVersaoGrcc(): Promise<number> {
    const [r] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'grcc_versao'));
    return r ? Number(r.value) || 0 : 0;
}

export async function lerUltimoImportGrcc(): Promise<UltimoImport | null> {
    const [r] = await db.select().from(systemSettings).where(eq(systemSettings.key, 'grcc_ultimo_import'));
    if (!r) return null;
    try {
        return JSON.parse(r.value) as UltimoImport;
    } catch {
        return null;
    }
}

export async function fetchListasGrcc(): Promise<Record<CampoLista, string[]>> {
    const rows = await db.select().from(dropdownOptions).where(like(dropdownOptions.field, 'grcc_%')).orderBy(dropdownOptions.id);
    const listas = Object.fromEntries(CAMPOS_LISTA.map((c) => [c, [] as string[]])) as Record<CampoLista, string[]>;
    for (const campo of CAMPOS_LISTA) {
        listas[campo] = rows.filter((r) => r.field === FIELD_DA_LISTA[campo]).map((r) => r.value);
    }
    return listas;
}
