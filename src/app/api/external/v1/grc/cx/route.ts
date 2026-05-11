import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/api-auth';
import { createCXItem, fetchManagerById } from '@/db/queries';

const CreateCXSchema = z.object({
    managerId: z.string().min(1),
    cliente: z.string().min(1).max(255),
    titulo: z.string().min(1).max(255),
    problema: z.string().min(1).max(2000),
    solucaoProposta: z.string().min(1).max(2000),
    criticidade: z.enum(['baixa', 'media', 'alta']).default('baixa'),
    status: z.enum(['pendente', 'analise', 'resolvido']).default('pendente'),
    isVisible: z.boolean().default(true),
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

    const parsed = CreateCXSchema.safeParse(body);
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

    const { managerId, cliente, titulo, problema, solucaoProposta, criticidade, status, isVisible } =
        parsed.data;

    const manager = await fetchManagerById(managerId);
    if (!manager) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Gerente '${managerId}' não encontrado.` },
            { status: 404 }
        );
    }

    try {
        const item = await createCXItem({
            managerId,
            cliente,
            titulo,
            problema,
            solucaoProposta,
            criticidade,
            status,
            isVisible,
        });

        return NextResponse.json({ success: true, data: item }, { status: 201 });
    } catch (error) {
        console.error('[POST /grc/cx] Error:', error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
