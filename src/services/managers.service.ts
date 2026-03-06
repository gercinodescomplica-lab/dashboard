'use server';

import { Manager } from '../types/manager';
import { fetchAllManagersFromDB } from '@/db/queries';

export async function fetchManagers(): Promise<Manager[]> {
    try {
        const managers = await fetchAllManagersFromDB();
        return managers as Manager[];
    } catch (error) {
        console.error("Erro ao buscar gerentes no Turso:", error);
        throw new Error("Failed to fetch managers");
    }
}
