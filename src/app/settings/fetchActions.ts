'use server';

import { fetchCXByManager, fetchVisitsByManager } from '@/db/queries';
import { CXItem, Visit } from '@/types/manager';

export async function getCXByManager(managerId: string): Promise<CXItem[]> {
    return fetchCXByManager(managerId);
}

export async function getVisitsByManager(managerId: string): Promise<Visit[]> {
    return fetchVisitsByManager(managerId);
}
