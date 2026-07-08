'use server';

import { db } from '@/db/index';
import { orgChart } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_ORG_CHART } from '@/lib/orgChartDefault';
import type { OrgChartData } from '@/types/orgChart';

const ROW_ID = 1;

export async function fetchOrgChart(): Promise<OrgChartData> {
    try {
        const [row] = await db.select().from(orgChart).where(eq(orgChart.id, ROW_ID));
        if (!row) return DEFAULT_ORG_CHART;
        return JSON.parse(row.data) as OrgChartData;
    } catch (err) {
        console.error('Failed to fetch org chart, falling back to default:', err);
        return DEFAULT_ORG_CHART;
    }
}

export async function saveOrgChart(data: OrgChartData): Promise<{ success: true }> {
    try {
        const json = JSON.stringify(data);
        const updatedAt = new Date().toISOString();
        await db.insert(orgChart).values({ id: ROW_ID, data: json, updatedAt })
            .onConflictDoUpdate({
                target: orgChart.id,
                set: { data: json, updatedAt },
            });
        return { success: true };
    } catch (err) {
        console.error('Failed to save org chart:', err);
        throw new Error('Erro ao salvar organograma no Turso.');
    }
}
