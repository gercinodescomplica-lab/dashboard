import { getPlannerLastSyncedAt, savePlannerLastSyncedAt } from '@/db/queries';
import { syncPlannerTasks, BodySchema } from './planner-sync';

const DEFAULT_THROTTLE_MINUTES = 15;

/**
 * Pulls the latest Planner tasks from the Power Automate "When an HTTP
 * request is received" flow (set PLANNER_FLOW_URL) and syncs them into
 * `cx`, via the same matching/upsert logic used by the push endpoint.
 *
 * Throttled via systemSettings so it never fires the flow — which does
 * ~260 sequential Graph API calls (2 per task × ~130 tasks) and can take a
 * while — more than once per PLANNER_SYNC_THROTTLE_MINUTES window, no
 * matter how many times someone hits F5 on the dashboard in that window.
 *
 * Meant to be called via Next.js `after()` from a Server Action (see
 * src/services/managers.service.ts) so it runs AFTER the page response is
 * sent and never blocks/slows down the page load. Because of that, this
 * function never throws — every failure is logged and swallowed, since
 * nothing is awaiting its result.
 */
export async function pullPlannerIfStale(): Promise<void> {
    const flowUrl = process.env.PLANNER_FLOW_URL;
    if (!flowUrl) return; // not configured yet — no-op, doesn't break the dashboard

    try {
        const lastSyncedAt = await getPlannerLastSyncedAt();
        const now = Date.now();
        const throttleMinutes = Number(process.env.PLANNER_SYNC_THROTTLE_MINUTES) || DEFAULT_THROTTLE_MINUTES;
        const throttleMs = throttleMinutes * 60 * 1000;
        if (lastSyncedAt && now - lastSyncedAt < throttleMs) return;

        // Reserve the slot immediately (before the fetch/sync even starts)
        // so two page loads racing within the same second don't both pass
        // the throttle check and fire the flow twice.
        await savePlannerLastSyncedAt(now);

        const res = await fetch(flowUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
            console.error(`[planner-pull] Flow respondeu ${res.status} ${res.statusText}`);
            return;
        }

        const body: unknown = await res.json();
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            console.error('[planner-pull] Resposta do flow não bateu com o schema esperado:', parsed.error.issues);
            return;
        }
        const tasks = Array.isArray(parsed.data) ? parsed.data : parsed.data.tasks;

        const summary = await syncPlannerTasks(tasks);
        console.log(
            `[planner-pull] sincronizado: ${summary.total} tarefas (${summary.created} criadas, ${summary.updated} atualizadas, ${summary.unmatched.length} sem gerente)`
        );
    } catch (error) {
        console.error('[planner-pull] Erro:', error);
    }
}
