import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { createProject, fetchManagerById } from '@/db/queries';

const CreateProjectSchema = z.object({
    managerId: z.string().min(1),
    quarter: z.enum(['q1', 'q2', 'q3', 'q4', 'nao_mapeado']),
    orgao: z.string().max(255).optional(),
    name: z.string().min(1).max(255),
    value: z.number().nonnegative(),
    temperature: z
        .enum(['quente', 'morno', 'frio', 'contratado', 'historico', 'perdido'])
        .optional(),
    description: z.string().max(1000).optional(),
});

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

    const parsed = CreateProjectSchema.safeParse(body);
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

    const { managerId, quarter, orgao, name, value, temperature, description } = parsed.data;

    const manager = await fetchManagerById(managerId);
    if (!manager) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Gerente '${managerId}' não encontrado.` },
            { status: 404 }
        );
    }

    try {
        const project = await createProject({
            managerId,
            quarter,
            orgao: orgao ?? null,
            name,
            value,
            temperature: temperature ?? null,
            description: description ?? null,
        });

        return NextResponse.json({ success: true, data: project }, { status: 201 });
    } catch (error) {
        console.error('[POST /grc/projects] Error:', error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
