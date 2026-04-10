'use server';

import { db } from '@/db/index';
import { storeProducts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function verifyPipelineKey(key: string) {
    const correctKey = process.env.PIPELINE_KEY || 'prodam_pipeline_2026';
    return key === correctKey;
}

export async function getStoreProducts() {
    try {
        const products = await db.select().from(storeProducts);
        // Mapear para o formato que a UI usa
        return products.map(p => ({
            id: p.id,
            n: p.name,
            d: p.directorate,
            s: p.status,
            f: p.phase,
            mkt: p.marketplace,
            cat: p.category
        }));
    } catch (err) {
        console.error('Failed to get store products:', err);
        return [];
    }
}

export async function saveStoreProduct(product: any) {
    try {
        if (product.id) {
            await db.update(storeProducts).set({
                name: product.name,
                directorate: product.directorate as 'DDS' | 'DIT' | 'DRM' | 'PRE',
                status: product.status as 'store' | 'breve' | 'backlog',
                phase: product.phase,
                marketplace: product.marketplace,
                category: product.category,
            }).where(eq(storeProducts.id, product.id));
        } else {
            await db.insert(storeProducts).values({
                name: product.name,
                directorate: product.directorate as 'DDS' | 'DIT' | 'DRM' | 'PRE',
                status: product.status as 'store' | 'breve' | 'backlog',
                phase: product.phase,
                marketplace: product.marketplace,
                category: product.category,
            });
        }
        revalidatePath('/'); // Força a atualização do dashboard
        return { success: true };
    } catch (err) {
        console.error('Failed to save product:', err);
        throw new Error('Erro ao salvar produto.');
    }
}

export async function deleteStoreProduct(id: number) {
    try {
        await db.delete(storeProducts).where(eq(storeProducts.id, id));
        revalidatePath('/'); // Força a atualização do dashboard
        return { success: true };
    } catch (err) {
        console.error('Failed to delete product:', err);
        throw new Error('Erro ao deletar produto.');
    }
}
