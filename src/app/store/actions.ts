'use server';

export async function verifyStoreKey(key: string) {
    const correctKey = process.env.STORE_PUBLIC_KEY;
    if (!correctKey) return false;
    return key === correctKey;
}
