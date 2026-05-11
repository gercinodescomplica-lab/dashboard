import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { fetchVisitById, updateVisit } from '@/db/queries';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const UpdateVisitSchema = z
    .object({
        titulo: z.string().min(1).max(255).optional(),
        local: z.string().min(1).max(500).optional(),
        motivo: z.string().min(1).max(1000).optional(),
        data: isoDate.optional(),
        dataFim: isoDate.nullable().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
        message: 'At least one field must be provided for update.',
    });

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
        return NextResponse.json(
            { success: false, error: 'INVALID_ID', message: 'ID must be a positive integer.' },
            { status: 400 }
        );
    }

    const existing = await fetchVisitById(numericId);
    if (!existing) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Visita com id ${numericId} não encontrada.` },
            { status: 404 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
            { status: 400 }
        );
    }

    const parsed = UpdateVisitSchema.safeParse(body);
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

    // If updating data/dataFim, validate coherence against merged state
    const mergedData = parsed.data.data ?? existing.data;
    const mergedDataFim = 'dataFim' in parsed.data ? parsed.data.dataFim : existing.dataFim;
    if (mergedDataFim && mergedDataFim < mergedData) {
        return NextResponse.json(
            {
                success: false,
                error: 'VALIDATION_ERROR',
                details: [{ field: 'dataFim', message: 'dataFim must be on or after data.' }],
            },
            { status: 400 }
        );
    }

    try {
        const updated = await updateVisit(numericId, parsed.data);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error(`[PATCH /grc/visits/${numericId}] Error:`, error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
