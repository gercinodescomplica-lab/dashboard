'use server';

export async function verifyAccessKey(key: string) {
    const correctKey = process.env.FRONTEND_KEY;
    if (!correctKey) return false;
    return key === correctKey;
}
