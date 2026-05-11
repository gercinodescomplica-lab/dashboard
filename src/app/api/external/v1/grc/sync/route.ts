import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { authenticate } from '@/lib/api-auth';
import { db } from '@/db/index';
import { managers, cx, visits, projects } from '@/db/schema';

// ── Schemas ────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.');

const CXUpsertItem = z
    .object({
        id: z.number().int().positive().optional(),
        cliente: z.string().min(1).max(255).optional(),
        titulo: z.string().min(1).max(255).optional(),
        problema: z.string().min(1).max(2000).optional(),
        solucaoProposta: z.string().min(1).max(2000).optional(),
        criticidade: z.enum(['baixa', 'media', 'alta']).optional(),
        status: z.enum(['pendente', 'analise', 'resolvido']).optional(),
        isVisible: z.boolean().optional(),
    })
    .refine(
        (item) => item.id || (item.cliente && item.titulo && item.problema && item.solucaoProposta),
        { message: 'New CX items require: cliente, titulo, problema, solucaoProposta.' }
    );

const VisitUpsertItem = z
    .object({
        id: z.number().int().positive().optional(),
        titulo: z.string().min(1).max(255).optional(),
        local: z.string().min(1).max(500).optional(),
        motivo: z.string().min(1).max(1000).optional(),
        data: isoDate.optional(),
        dataFim: isoDate.nullable().optional(),
    })
    .refine(
        (item) => item.id || (item.titulo && item.local && item.motivo && item.data),
        { message: 'New visit items require: titulo, local, motivo, data.' }
    );

const ProjectUpsertItem = z
    .object({
        id: z.number().int().positive().optional(),
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
    .refine(
        (item) => item.id || (item.name && item.quarter !== undefined && item.value !== undefined),
        { message: 'New project items require: name, quarter, value.' }
    );

const EntityGroup = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        upsert: z.array(itemSchema).optional(),
        delete: z.array(z.number().int().positive()).optional(),
    });

const SyncSchema = z.object({
    managerId: z.string().min(1),
    cx: EntityGroup(CXUpsertItem).optional(),
    visits: EntityGroup(VisitUpsertItem).optional(),
    projects: EntityGroup(ProjectUpsertItem).optional(),
});

// ── Helper ─────────────────────────────────────────────────────────────────

function strip<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
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

    const parsed = SyncSchema.safeParse(body);
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

    const data = parsed.data;

    // Verify manager exists
    const managerRows = await db
        .select({ id: managers.id })
        .from(managers)
        .where(eq(managers.id, data.managerId));

    if (managerRows.length === 0) {
        return NextResponse.json(
            { success: false, error: 'NOT_FOUND', message: `Gerente '${data.managerId}' não encontrado.` },
            { status: 404 }
        );
    }

    const managerId = data.managerId;

    const summary = {
        cx:       { created: 0, updated: 0, deleted: 0 },
        visits:   { created: 0, updated: 0, deleted: 0 },
        projects: { created: 0, updated: 0, deleted: 0 },
    };

    try {
        await db.transaction(async (tx) => {

            // ── CX ──────────────────────────────────────────────────────────

            const cxDeleteIds = data.cx?.delete ?? [];
            if (cxDeleteIds.length > 0) {
                const deleted = await tx
                    .delete(cx)
                    .where(and(inArray(cx.id, cxDeleteIds), eq(cx.managerId, managerId)))
                    .returning({ id: cx.id });
                summary.cx.deleted = deleted.length;
            }

            for (const item of data.cx?.upsert ?? []) {
                if (item.id) {
                    const updated = await tx
                        .update(cx)
                        .set(strip({
                            cliente: item.cliente,
                            titulo: item.titulo,
                            problema: item.problema,
                            solucaoProposta: item.solucaoProposta,
                            criticidade: item.criticidade,
                            status: item.status,
                            isVisible: item.isVisible,
                        }))
                        .where(and(eq(cx.id, item.id), eq(cx.managerId, managerId)))
                        .returning({ id: cx.id });
                    if (updated.length) summary.cx.updated++;
                } else {
                    await tx.insert(cx).values({
                        managerId,
                        cliente: item.cliente!,
                        titulo: item.titulo!,
                        problema: item.problema!,
                        solucaoProposta: item.solucaoProposta!,
                        criticidade: item.criticidade ?? 'baixa',
                        status: item.status ?? 'pendente',
                        isVisible: item.isVisible ?? true,
                    });
                    summary.cx.created++;
                }
            }

            // ── Visits ──────────────────────────────────────────────────────

            const visitDeleteIds = data.visits?.delete ?? [];
            if (visitDeleteIds.length > 0) {
                const deleted = await tx
                    .delete(visits)
                    .where(and(inArray(visits.id, visitDeleteIds), eq(visits.managerId, managerId)))
                    .returning({ id: visits.id });
                summary.visits.deleted = deleted.length;
            }

            for (const item of data.visits?.upsert ?? []) {
                if (item.id) {
                    const updated = await tx
                        .update(visits)
                        .set(strip({
                            titulo: item.titulo,
                            local: item.local,
                            motivo: item.motivo,
                            data: item.data,
                            dataFim: item.dataFim,
                        }))
                        .where(and(eq(visits.id, item.id), eq(visits.managerId, managerId)))
                        .returning({ id: visits.id });
                    if (updated.length) summary.visits.updated++;
                } else {
                    await tx.insert(visits).values({
                        managerId,
                        titulo: item.titulo!,
                        local: item.local!,
                        motivo: item.motivo!,
                        data: item.data!,
                        dataFim: item.dataFim ?? null,
                    });
                    summary.visits.created++;
                }
            }

            // ── Projects ────────────────────────────────────────────────────

            const projectDeleteIds = data.projects?.delete ?? [];
            if (projectDeleteIds.length > 0) {
                const deleted = await tx
                    .delete(projects)
                    .where(and(inArray(projects.id, projectDeleteIds), eq(projects.managerId, managerId)))
                    .returning({ id: projects.id });
                summary.projects.deleted = deleted.length;
            }

            for (const item of data.projects?.upsert ?? []) {
                if (item.id) {
                    const updated = await tx
                        .update(projects)
                        .set(strip({
                            quarter: item.quarter,
                            orgao: item.orgao,
                            name: item.name,
                            value: item.value,
                            temperature: item.temperature,
                            description: item.description,
                        }))
                        .where(and(eq(projects.id, item.id), eq(projects.managerId, managerId)))
                        .returning({ id: projects.id });
                    if (updated.length) summary.projects.updated++;
                } else {
                    await tx.insert(projects).values({
                        managerId,
                        quarter: item.quarter!,
                        orgao: item.orgao ?? null,
                        name: item.name!,
                        value: item.value!,
                        temperature: item.temperature ?? null,
                        description: item.description ?? null,
                    });
                    summary.projects.created++;
                }
            }
        });

        return NextResponse.json({ success: true, summary });

    } catch (error) {
        console.error('[PATCH /grc/sync] Error:', error);
        return NextResponse.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
