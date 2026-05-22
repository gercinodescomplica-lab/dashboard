'use server';

import { unstable_noStore as noStore } from 'next/cache';
import { Manager } from '../types/manager';
import { fetchAllManagersFromDB, fetchVisibleManagersFromDB } from '@/db/queries';

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
    try {
        return await fetchVisibleManagersFromDB() as Manager[];
    } catch (error) {
        console.error("Erro ao buscar gerentes visíveis no Turso:", error);
        throw new Error("Failed to fetch dashboard managers");
    }
}
