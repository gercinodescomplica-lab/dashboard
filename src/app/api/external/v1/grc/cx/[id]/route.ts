import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { fetchCXItemById, updateCXItem } from '@/db/queries';

const UpdateCXSchema = z
    .object({
        cliente: z.string().min(1).max(255).optional(),
        titulo: z.string().min(1).max(255).optional(),
        problema: z.string().min(1).max(2000).optional(),
        solucaoProposta: z.string().min(1).max(2000).optional(),
        criticidade: z.enum(['baixa', 'media', 'alta']).optional(),
        status: z.enum(['pendente', 'analise', 'resolvido']).optional(),
        isVisible: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
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

    const existing = await fetchCXItemById(numericId);
    if (!existing) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Item CX com id ${numericId} não encontrado.` },
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

    const parsed = UpdateCXSchema.safeParse(body);
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

    try {
        const updated = await updateCXItem(numericId, parsed.data);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error(`[PATCH /grc/cx/${numericId}] Error:`, error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
