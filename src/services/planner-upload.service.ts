'use server';

import { syncPlannerTasks, BodySchema, PlannerSyncSummary } from '@/lib/planner-sync';

export type UploadPlannerTasksResult =
    | { success: true; summary: PlannerSyncSummary }
    | { success: false; error: string };

/**
 * Server Action behind the manual "Upload Planner (.json)" button in
 * CXTab.tsx. Takes whatever JSON the admin selected on their machine
 * (already merged/parsed client-side into a single { tasks: [...] } shape —
 * see CXTab's extractTasksArray), validates it with the same zod schema as
 * the HTTP endpoints, and runs it through the same matching/upsert logic
 * (src/lib/planner-sync.ts) used by POST /planner-sync and the F5 pull.
 *
 * This is a manual, ad hoc trigger — no auth beyond already being inside the
 * dashboard (FRONTEND_KEY), same trust level as the rest of the internal
 * tooling here (see CLAUDE.md "Access control").
 */
export async function uploadPlannerTasks(rawBody: unknown): Promise<UploadPlannerTasksResult> {
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
        const details = parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
            .join('; ');
        return { success: false, error: `JSON inválido — ${details}` };
    }

    const tasks = Array.isArray(parsed.data) ? parsed.data : parsed.data.tasks;

    try {
        const summary = await syncPlannerTasks(tasks);
        return { success: true, summary };
    } catch (err) {
        console.error('[uploadPlannerTasks] Error:', err);
        return { success: false, error: 'Erro ao gravar as tarefas no banco. Veja o console do servidor para detalhes.' };
    }
}
