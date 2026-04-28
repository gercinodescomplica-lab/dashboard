import { NextResponse } from 'next/server';
import { fetchAllContratos } from '@/db/queries';

function authenticate(request: Request): { ok: true } | { ok: false; response: NextResponse } {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Missing or invalid Authorization header' },
                { status: 401 }
            ),
        };
    }
    const token = authHeader.split(' ')[1];
    const apiKey = process.env.EXTERNAL_API_KEY;
    if (!apiKey || token !== apiKey) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Invalid Bearer Token' }, { status: 403 }),
        };
    }
    return { ok: true };
}

/**
 * GET /api/external/v1/contracts
 *
 * Query params:
 *   ?search=<term>   — filtra por numeroContrato, cliente, nomeGerente, gerencia, objeto
 *   ?gerencia=<GRC>  — filtra por código de gerência (ex: GRC-1, KAM-2)
 *   ?vigente=true|false — filtra somente vigentes ou não-vigentes
 *   ?tipo=SUSTENTAÇÃO|PROJETOS
 */
export async function GET(request: Request) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') ?? undefined;
        const gerenciaFilter = searchParams.get('gerencia')?.toUpperCase() ?? null;
        const vigenteFilter = searchParams.get('vigente');
        const tipoFilter = searchParams.get('tipo')?.toUpperCase() ?? null;

        let contratos = await fetchAllContratos(search);

        // Apply optional in-memory filters (lightweight, ~100 rows)
        if (gerenciaFilter) {
            contratos = contratos.filter(
                (c) => c.gerencia?.toUpperCase() === gerenciaFilter
            );
        }
        if (vigenteFilter !== null) {
            const isVigente = vigenteFilter === 'true';
            contratos = contratos.filter((c) => (c.vigente ?? false) === isVigente);
        }
        if (tipoFilter) {
            contratos = contratos.filter((c) =>
                c.tipo?.toUpperCase().includes(tipoFilter)
            );
        }

        // Summary
        const summary = {
            total: contratos.length,
            vigentes: contratos.filter((c) => c.vigente).length,
            vencidos: contratos.filter((c) => !c.vigente).length,
            totalVlContratado: contratos.reduce((s, c) => s + (c.vlContratado ?? 0), 0),
            totalVlFaturado: contratos.reduce((s, c) => s + (c.vlFaturado ?? 0), 0),
            totalVlSaldo: contratos.reduce((s, c) => s + (c.vlSaldo ?? 0), 0),
        };

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            summary,
            data: contratos,
        });
    } catch (error: any) {
        console.error('[API /contracts] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
