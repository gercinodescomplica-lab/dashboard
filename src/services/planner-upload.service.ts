'use server';

import { syncPlannerTasks, BodySchema, PlannerSyncSummary } from '@/lib/planner-sync';
import { chaveSettingsValida } from '@/lib/settings/chave';

export type UploadPlannerTasksResult =
    | { success: true; summary: PlannerSyncSummary }
    | { success: false; error: string };

/**
 * Server Action behind the manual "Upload Planner (.json)" panel in
 * PlannerUploadEditor.tsx (/settings). Takes whatever JSON the admin selected
 * on their machine (already merged/parsed client-side into a single
 * { tasks: [...] } shape — see extractTasksArray there), validates it with the same zod schema as
 * the HTTP endpoints, and runs it through the same matching/upsert logic
 * (src/lib/planner-sync.ts) used by POST /planner-sync and the F5 pull.
 *
 * Grava em cx, então confere a SETTINGS_KEY aqui, como as outras actions do
 * /settings (D14): o KeyGate só esconde a tela.
 */
export async function uploadPlannerTasks(chave: string, rawBody: unknown): Promise<UploadPlannerTasksResult> {
    if (!chaveSettingsValida(chave)) throw new Error('Chave de administrador inválida.');

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
