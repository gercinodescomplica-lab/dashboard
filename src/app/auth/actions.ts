'use server';

export async function verifyAccessKey(key: string) {
    if (!key || typeof key !== 'string') return false;
    const trimmed = key.trim();

    const validKeys = [
        process.env.FRONTEND_KEY,
        process.env.DIRETORIA_KEY,
        process.env.DIRECTORATE_KEY,
    ].filter(Boolean);

    return validKeys.includes(trimmed);
}

