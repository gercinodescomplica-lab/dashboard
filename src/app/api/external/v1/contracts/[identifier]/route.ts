import { NextResponse } from 'next/server';
import { fetchContratoById, fetchContratoByNumero } from '@/db/queries';

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
 * GET /api/external/v1/contracts/[identifier]
 * 
 * Identifier can be either the UUID (id) or the Numero do Contrato.
 */
export async function GET(
    request: Request,
    { params }: { params: { identifier: string } }
) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    const { identifier } = params;

    try {
        // Decode identifier in case it has slashes or special chars (like TC 001/2024)
        const decodedIdentifier = decodeURIComponent(identifier);
        
        // Try to fetch by ID (UUID) first
        let contrato = await fetchContratoById(decodedIdentifier);
        
        // If not found, try to fetch by Numero do Contrato
        if (!contrato) {
            contrato = await fetchContratoByNumero(decodedIdentifier);
        }

        if (!contrato) {
            return NextResponse.json(
                { success: false, error: 'Contract not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: contrato,
        });
    } catch (error: any) {
        console.error(`[API /contracts/${identifier}] Error:`, error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
