import { NextResponse } from 'next/server';

type AuthResult = { ok: true } | { ok: false; response: NextResponse };

export function authenticate(request: Request, envKey = 'EXTERNAL_API_KEY'): AuthResult {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: 'Missing or invalid Authorization header' },
                { status: 401 }
            ),
        };
    }
    const token = authHeader.split(' ')[1];
    const apiKey = process.env[envKey];
    if (!apiKey || token !== apiKey) {
        return {
            ok: false,
            response: NextResponse.json(
                { success: false, error: 'Invalid Bearer Token' },
                { status: 403 }
            ),
        };
    }
    return { ok: true };
}
