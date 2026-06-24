'use server';

import { db } from '@/db/index';
import { storeProducts, dropdownOptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
            cat: p.category,
            r: p.responsavel ?? ''
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
                directorate: product.directorate,
                status: product.status,
                phase: product.phase,
                marketplace: product.marketplace,
                category: product.category,
                responsavel: product.responsavel ?? null,
            }).where(eq(storeProducts.id, product.id));
        } else {
            await db.insert(storeProducts).values({
                name: product.name,
                directorate: product.directorate,
                status: product.status,
                phase: product.phase,
                marketplace: product.marketplace,
                category: product.category,
                responsavel: product.responsavel ?? null,
            });
        }
        revalidatePath('/'); // Força a atualização do dashboard
        return { success: true };
    } catch (err) {
        console.error('Failed to save product:', err);
        throw new Error('Erro ao salvar produto.');
    }
}

export async function getDropdownOptions() {
    try {
        const rows = await db.select().from(dropdownOptions);
        const grouped: Record<string, string[]> = {};
        for (const r of rows) {
            (grouped[r.field] ??= []).push(r.value);
        }
        return grouped;
    } catch (err) {
        console.error('Failed to get dropdown options:', err);
        return {};
    }
}

export async function addDropdownOption(field: string, value: string) {
    try {
        const v = value.trim();
        if (!v) return { success: false };
        const existing = await db
            .select()
            .from(dropdownOptions)
            .where(and(eq(dropdownOptions.field, field), eq(dropdownOptions.value, v)));
        if (existing.length === 0) {
            await db.insert(dropdownOptions).values({ field, value: v });
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to add dropdown option:', err);
        throw new Error('Erro ao adicionar opção.');
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
