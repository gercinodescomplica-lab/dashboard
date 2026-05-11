import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { fetchProjectById, updateProject } from '@/db/queries';

const UpdateProjectSchema = z
    .object({
        quarter: z.enum(['q1', 'q2', 'q3', 'q4', 'nao_mapeado']).optional(),
        orgao: z.string().max(255).nullable().optional(),
        name: z.string().min(1).max(255).optional(),
        value: z.number().nonnegative().optional(),
        temperature: z
            .enum(['quente', 'morno', 'frio', 'contratado', 'historico', 'perdido'])
            .nullable()
            .optional(),
        description: z.string().max(1000).nullable().optional(),
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

    const existing = await fetchProjectById(numericId);
    if (!existing) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Projeto com id ${numericId} não encontrado.` },
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

    const parsed = UpdateProjectSchema.safeParse(body);
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
        const updated = await updateProject(numericId, parsed.data);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error(`[PATCH /grc/projects/${numericId}] Error:`, error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
