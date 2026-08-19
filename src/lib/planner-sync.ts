import { z } from 'zod';
import { db } from '@/db/index';
import { cx } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchManagersForClientMatch, fetchCXByExternalIds } from '@/db/queries';

// ── Schema ───────────────────────────────────────────────────────────────
// Mirrors the raw shape that "Listar minhas tarefas" + "Obter uma tarefa"
// (dueDateTime) produce in the Planner → Power Automate flow, and what
// scripts/import-cx-planner.ts already parses for the manual import.
//
// Caps chosen from the real 132-task export (max title ~94 chars, max
// Description ~6.5k chars) with generous headroom — tight enough that a
// malformed or malicious payload (someone with the Bearer token, or a
// tampered Power Automate response) can't bloat the DB or the dashboard UI,
// loose enough that no legitimate Planner log ever gets rejected.
const PlannerTaskSchema = z.object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(1000),
    datainicio: z.string().max(50).optional(),
    datafim: z.string().max(50).optional(),
    prioridade: z.string().max(50).optional(),
    percentComplete: z.union([z.string().max(20), z.number()]).optional(),
    Description: z.string().max(50_000).optional(),
});

// Accepts either a bare array (what the flow's "Compor"/"Create json" action
// produces today) or a { tasks: [...] } wrapper.
// MAX_TASKS_PER_REQUEST bounds the whole batch (real usage is ~130-200
// tasks) so a single request/response can't force an oversized transaction.
const MAX_TASKS_PER_REQUEST = 2000;
export const BodySchema = z.union([
    z.array(PlannerTaskSchema).max(MAX_TASKS_PER_REQUEST),
    z.object({ tasks: z.array(PlannerTaskSchema).max(MAX_TASKS_PER_REQUEST) }),
]);

export type PlannerTask = z.infer<typeof PlannerTaskSchema>;

export type PlannerSyncSummary = {
    total: number;
    created: number;
    updated: number;
    unmatched: { id: string; title: string; acronym: string }[];
    byManager: Record<string, number>;
};

// ── Helpers (ported from scripts/import-cx-planner.ts) ─────────────────────

function normalizeAcronym(s: string): string {
    const m = s.trim().match(/^([A-Za-zÀ-ÿ0-9-]+)/);
    return (m ? m[1] : s.trim()).toUpperCase();
}

function splitTitle(title: string): { acronym: string; assunto: string } {
    const parts = title.split(/\s+[-–—]\s+/);
    if (parts.length === 1) {
        return { acronym: normalizeAcronym(title), assunto: title.trim() };
    }
    return { acronym: normalizeAcronym(parts[0]), assunto: parts.slice(1).join(' - ').trim() };
}

function mapStatus(percentComplete?: string | number): 'pendente' | 'analise' | 'resolvido' {
    const n = typeof percentComplete === 'number' ? percentComplete : parseInt(percentComplete ?? '0', 10);
    if (n >= 100) return 'resolvido';
    if (n > 0) return 'analise';
    return 'pendente';
}

function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta' {
    const p = (prio ?? '').toLowerCase();
    if (p.includes('urgente')) return 'alta';
    if (p.includes('importante')) return 'media';
    return 'baixa';
}

// Rótulos amigáveis (iguais aos exibidos na aba CX) só pra compor a nota de
// mudança no histórico — não precisam ficar em sync com STATUS_CONFIG/
// CRITICIDADE_CONFIG do CXTab.tsx, são só texto de log.
const STATUS_LABEL: Record<'pendente' | 'analise' | 'resolvido', string> = {
    pendente: 'Pendente',
    analise: 'Em Análise',
    resolvido: 'Resolvido',
};

const CRITICIDADE_LABEL: Record<'baixa' | 'media' | 'alta', string> = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
};

function todayBR(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── Core sync ────────────────────────────────────────────────────────────
// Matches each Planner task to a manager (via servedClients acronym) and
// upserts it into `cx`, keyed by external_id = Planner task id. Existing
// rows are UPDATED (not duplicated) so status/description changes made
// later in Planner keep syncing on the next run.
//
// Shared by both:
//   - POST /api/external/v1/planner-sync (Power Automate pushes to us)
//   - src/lib/planner-pull.ts (we pull from Power Automate on page load)
export async function syncPlannerTasks(tasks: PlannerTask[]): Promise<PlannerSyncSummary> {
    const summary: PlannerSyncSummary = {
        total: tasks.length,
        created: 0,
        updated: 0,
        unmatched: [],
        byManager: {},
    };

    if (tasks.length === 0) return summary;

    const managersList = await fetchManagersForClientMatch();
    const clientToManager = new Map<string, { id: string; name: string }>();
    for (const m of managersList) {
        for (const c of m.servedClients) {
            const key = normalizeAcronym(c);
            if (!clientToManager.has(key)) clientToManager.set(key, { id: m.id, name: m.name });
        }
    }

    const existing = await fetchCXByExternalIds(tasks.map((t) => t.id));
    const existingByExternalId = new Map(
        existing.filter((r) => r.externalId).map((r) => [r.externalId as string, r])
    );

    // Whole batch is one transaction: either the full sync from this run
    // lands, or none of it does. Avoids a partial write (e.g. task 80/132
    // fails) followed by an error that makes it look like nothing was saved
    // when some rows actually were.
    await db.transaction(async (tx) => {
        for (const t of tasks) {
            const { acronym, assunto } = splitTitle(t.title);
            const match = clientToManager.get(acronym);
            if (!match) {
                summary.unmatched.push({ id: t.id, title: t.title, acronym });
                continue;
            }

            const newStatus = mapStatus(t.percentComplete);
            const newCriticidade = mapCriticidade(t.prioridade);
            const newProblema = t.Description ?? '';

            const existingRow = existingByExternalId.get(t.id);
            if (existingRow) {
                // Se status e/ou criticidade mudaram desde o último sync,
                // registra isso como uma entrada nova no topo do histórico
                // (mesmo formato "DD/MM/AAAA - texto" que o resto do log já
                // usa, então a aba CX exibe igual a qualquer outra
                // atualização) — sem isso, um card virando "Resolvido" fica
                // invisível no histórico, só muda o badge de status.
                // Quando nada relevante mudou, problema = Description puro
                // (sem poluir o log com uma linha a cada sync).
                const changes: string[] = [];
                if (existingRow.status !== newStatus) {
                    changes.push(`Status: ${STATUS_LABEL[existingRow.status]} → ${STATUS_LABEL[newStatus]}`);
                }
                if (existingRow.criticidade !== newCriticidade) {
                    changes.push(`Criticidade: ${CRITICIDADE_LABEL[existingRow.criticidade]} → ${CRITICIDADE_LABEL[newCriticidade]}`);
                }
                const problema = changes.length > 0
                    ? `${todayBR()} - [Sincronização] ${changes.join('; ')}\r\n${newProblema}`
                    : newProblema;

                // Update só dos campos que vêm do Planner. Deliberadamente
                // NÃO toca em `isVisible` nem `solucaoProposta` — são
                // editados à mão no Settings (CXEditor), e re-sincronizar a
                // mesma tarefa a cada run não deve reverter alguém ocultando
                // um item ou apagar uma solução que já foi digitada.
                await tx.update(cx).set({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                }).where(eq(cx.id, existingRow.id));
                summary.updated++;
            } else {
                await tx.insert(cx).values({
                    managerId: match.id,
                    cliente: acronym,
                    titulo: assunto || t.title,
                    problema: newProblema,
                    status: newStatus,
                    criticidade: newCriticidade,
                    externalId: t.id,
                    solucaoProposta: '',
                    isVisible: true,
                    createdAt: t.datainicio || new Date().toISOString(),
                });
                summary.created++;
            }

            summary.byManager[match.name] = (summary.byManager[match.name] ?? 0) + 1;
        }
    });

    return summary;
}
