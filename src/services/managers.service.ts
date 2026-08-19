'use server';

import { after } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { Manager } from '../types/manager';
import { fetchAllManagersFromDB, fetchVisibleManagersFromDB } from '@/db/queries';
import { pullPlannerIfStale } from '@/lib/planner-pull';

/** Retorna todos os gerentes (incluindo ocultos). Usado pelo admin/settings. */
export async function fetchManagers(): Promise<Manager[]> {
    noStore();
    try {
        return await fetchAllManagersFromDB() as Manager[];
    } catch (error) {
        console.error("Erro ao buscar gerentes no Turso:", error);
        throw new Error("Failed to fetch managers");
    }
}

/** Retorna apenas gerentes com showInDashboard = true. Usado pelo dashboard público. */
export async function fetchDashboardManagers(): Promise<Manager[]> {
    noStore();

    // Dispara a sincronização com o Planner (via Power Automate) em segundo
    // plano, DEPOIS da resposta ser enviada — não atrasa o carregamento da
    // página. Internamente é limitada por throttle (PLANNER_SYNC_THROTTLE_MINUTES,
    // padrão 15min) e não faz nada se PLANNER_FLOW_URL não estiver configurado.
    // Ver src/lib/planner-pull.ts.
    after(() => pullPlannerIfStale());

    try {
        return await fetchVisibleManagersFromDB() as Manager[];
    } catch (error) {
        console.error("Erro ao buscar gerentes visíveis no Turso:", error);
        throw new Error("Failed to fetch dashboard managers");
    }
}
