import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { syncPlannerTasks, BodySchema } from '@/lib/planner-sync';

// ── Handler ──────────────────────────────────────────────────────────────
// POST /api/external/v1/planner-sync
// Push endpoint: receives the full Planner task list from a Power Automate
// flow (Recurrence trigger → "Enviar uma solicitação HTTP" pushing here) and
// upserts it into `cx` via the shared matching/upsert logic in
// src/lib/planner-sync.ts.
//
// Kept alongside the pull-on-page-load path (src/lib/planner-pull.ts) as a
// manual/backup trigger — e.g. to force a sync from Postman/PowerShell
// without waiting for the throttle window on the dashboard to expire.

export async function POST(request: Request) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
            { status: 400 }
        );
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                error: 'VALIDATION_ERROR',
                details: parsed.error.issues.map((e: z.ZodIssue) => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            },
            { status: 400 }
        );
    }

    const tasks = Array.isArray(parsed.data) ? parsed.data : parsed.data.tasks;

    try {
        const summary = await syncPlannerTasks(tasks);
        return NextResponse.json({ success: true, summary });
    } catch (error) {
        console.error('[POST /planner-sync] Error:', error);
        return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
