import { z } from 'zod';
import { db } from '@/db/index';
import { cx } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchManagersForClientMatch, fetchCXByExternalIds, fetchCXBuckets } from '@/db/queries';
import { statusForBucketName } from '@/lib/cx-status';

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

export function mapStatus(percentComplete?: string | number): 'pendente' | 'analise' | 'resolvido' {
    const n = typeof percentComplete === 'number' ? percentComplete : parseInt(percentComplete ?? '0', 10);
    if (n >= 100) return 'resolvido';
    if (n > 0) return 'analise';
    return 'pendente';
}

export function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta' {
    const p = (prio ?? '').toLowerCase();
    if (p.includes('urgente')) return 'alta';
    if (p.includes('importante') || p.includes('media') || p.includes('média')) return 'media';
    return 'baixa';
}

// Guarda o percentComplete bruto do Planner (0-100) para o board de CX ler —
// diferente de mapStatus, que só usa esse valor para decidir pendente/
// análise/resolvido. null quando o Planner não mandou o campo (em vez de
// assumir 0, que enganaria "0% preenchido" com "sem dado").
function parsePercentComplete(pc?: string | number): number | null {
    if (pc === undefined) return null;
    const n = typeof pc === 'number' ? pc : parseInt(pc, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
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

// Board /settings/cx-planner: a coluna (bucket) para onde cada tarefa
// importada do Planner vai, decidida pelo status derivado. Os nomes batem
// com os buckets semeados em 0014_seed_cx_buckets.sql; se algum foi
// renomeado/apagado, cai no primeiro bucket por posição (ou null se não
// houver bucket nenhum). Só se aplica a itens NOVOS ou a itens ainda sem
// bucket — nunca move um card que o time já organizou.
const BUCKET_NAME_FOR_STATUS: Record<'pendente' | 'analise' | 'resolvido', string> = {
    pendente: 'CX - Em Análise',
    analise: 'CX - Em Análise',
    resolvido: 'Concluído',
};

// Real Planner exports send full ISO datetimes ("2026-08-05T10:00:00Z") for
// datainicio/datafim, not bare "YYYY-MM-DD" — but dataInicio/dataFim are
// stored and consumed downstream (CXPlannerCard, the date <Input>) as plain
// dates. Slicing to the first 10 chars is safe for both shapes: an ISO
// datetime's date portion is always chars 0-9, and a bare "YYYY-MM-DD"
// string sliced to 10 chars is unchanged.
function toDateOnly(v?: string): string | null {
    if (!v) return null;
    return v.slice(0, 10);
}

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

    const buckets = await fetchCXBuckets();
    const bucketIdByName = new Map(buckets.map((b) => [b.name.trim().toLowerCase(), b.id]));
    const bucketNameById = new Map(buckets.map((b) => [b.id, b.name]));
    const firstBucketId = buckets[0]?.id ?? null;
    const bucketForStatus = (status: 'pendente' | 'analise' | 'resolvido'): number | null =>
        bucketIdByName.get(BUCKET_NAME_FOR_STATUS[status].toLowerCase()) ?? firstBucketId;

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

            // O bucket é escolhido pelo status derivado do %; o status
            // gravado então passa a refletir o bucket (mesma regra do board:
            // arrastar pra "Concluído" = resolvido). Se não há bucket nenhum,
            // cai no status derivado puro.
            const derivedStatus = mapStatus(t.percentComplete);
            const newBucketId = bucketForStatus(derivedStatus);
            const newStatus =
                newBucketId == null
                    ? derivedStatus
                    : statusForBucketName(bucketNameById.get(newBucketId));
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
                    // Só preenche o bucket se a linha ainda não tem um — não
                    // desfaz a organização que o time já fez no board.
                    ...(existingRow.bucketId == null ? { bucketId: newBucketId } : {}),
                    // A linha volta a espelhar o Planner — qualquer edição
                    // manual feita no Settings antes deste sync deixa de
                    // divergir, então o aviso de "editado manualmente" some.
                    manualEditAt: null,
                    dataInicio: toDateOnly(t.datainicio),
                    dataFim: toDateOnly(t.datafim),
                    percentComplete: parsePercentComplete(t.percentComplete),
                    prioridadeTexto: t.prioridade ?? null,
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
                    bucketId: newBucketId,
                    solucaoProposta: '',
                    isVisible: true,
                    createdAt: t.datainicio || new Date().toISOString(),
                    dataInicio: toDateOnly(t.datainicio),
                    dataFim: toDateOnly(t.datafim),
                    percentComplete: parsePercentComplete(t.percentComplete),
                    prioridadeTexto: t.prioridade ?? null,
                });
                summary.created++;
            }

            summary.byManager[match.name] = (summary.byManager[match.name] ?? 0) + 1;
        }
    });

    return summary;
}
