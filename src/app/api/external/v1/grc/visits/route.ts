import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { createVisit, fetchManagerById } from '@/db/queries';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

const CreateVisitSchema = z
    .object({
        managerId: z.string().min(1),
        titulo: z.string().min(1).max(255),
        local: z.string().min(1).max(500),
        motivo: z.string().min(1).max(1000),
        data: isoDate,
        dataFim: isoDate.optional(),
    })
    .refine(
        (d) => !d.dataFim || d.dataFim >= d.data,
        { message: 'dataFim must be on or after data.', path: ['dataFim'] }
    );

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

    const parsed = CreateVisitSchema.safeParse(body);
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

    const { managerId, titulo, local, motivo, data, dataFim } = parsed.data;

    const manager = await fetchManagerById(managerId);
    if (!manager) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Gerente '${managerId}' não encontrado.` },
            { status: 404 }
        );
    }

    try {
        const visit = await createVisit({
            managerId,
            titulo,
            local,
            motivo,
            data,
            dataFim: dataFim ?? null,
        });

        return NextResponse.json({ success: true, data: visit }, { status: 201 });
    } catch (error) {
        console.error('[POST /grc/visits] Error:', error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
