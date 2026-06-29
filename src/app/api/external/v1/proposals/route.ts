import { NextResponse } from 'next/server';
import { fetchAllPropostas } from '@/db/queries';

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
 * GET /api/external/v1/proposals
 *
 * Query params:
 *   ?search=<term>       — filtra por numeroProposta, cliente, nomeOportunidade, proprietario, gerencia
 *   ?gerencia=<GRC>      — filtra por código de gerência (ex: GRC-1, KAM-2)
 *   ?fase=<fase>         — filtra por fase (match case-insensitive parcial)
 *   ?proprietario=<nome> — filtra por proprietário (match parcial)
 */
export async function GET(request: Request) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') ?? undefined;
        const gerenciaFilter = searchParams.get('gerencia')?.toUpperCase() ?? null;
        const faseFilter = searchParams.get('fase')?.toLowerCase() ?? null;
        const proprietarioFilter = searchParams.get('proprietario')?.toLowerCase() ?? null;

        let propostas = await fetchAllPropostas(search);

        if (gerenciaFilter) {
            propostas = propostas.filter(
                (p) => p.gerencia?.toUpperCase() === gerenciaFilter
            );
        }
        if (faseFilter) {
            propostas = propostas.filter((p) =>
                p.fase?.toLowerCase().includes(faseFilter)
            );
        }
        if (proprietarioFilter) {
            propostas = propostas.filter((p) =>
                p.proprietario?.toLowerCase().includes(proprietarioFilter)
            );
        }

        const breakdownByFase = propostas.reduce<Record<string, number>>((acc, p) => {
            const key = p.fase ?? 'Sem fase';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});

        const summary = {
            totalPropostas: propostas.length,
            breakdownByFase,
            totalValor: propostas.reduce((s, p) => s + (p.valor ?? 0), 0),
            totalReceitaEsperada: propostas.reduce((s, p) => s + (p.receitaEsperada ?? 0), 0),
        };

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            summary,
            data: propostas,
        });
    } catch (error: any) {
        console.error('[API /proposals] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
