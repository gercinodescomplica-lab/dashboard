'use server';

import { fetchCXByManager, fetchVisitsByManager, fetchChurnByManager } from '@/db/queries';
import { CXItem, Visit, ChurnItem } from '@/types/manager';

export async function getCXByManager(managerId: string): Promise<CXItem[]> {
    return fetchCXByManager(managerId);
}

export async function getVisitsByManager(managerId: string): Promise<Visit[]> {
    return fetchVisitsByManager(managerId);
}

export async function getChurnByManager(managerId: string): Promise<ChurnItem[]> {
    return fetchChurnByManager(managerId);
}

