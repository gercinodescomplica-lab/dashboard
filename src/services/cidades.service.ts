'use server';

/**
 * Leads da aba Cidades. Fonte: cadastro da GRCC (`lead_grcc`, editado em /grcc). Até
 * 2026-10 vinha de uma planilha Excel via Power Automate — essa URL foi removida do código.
 */

import { unstable_noStore as noStore } from 'next/cache';
import { listLeadsGrcc } from '@/db/queries';
import { leadParaCidade } from '@/lib/grcc/cidade';
import type { LeadCidade } from '@/types/cidades';

export async function fetchCidadesLeads(): Promise<LeadCidade[]> {
    noStore();
    try {
        const leads = await listLeadsGrcc();
        // Lead marcado como oculto na /grcc não sai para o dashboard.
        return leads.filter((l) => l.visivelDashboard).map(leadParaCidade);
    } catch (error) {
        console.error('Erro ao buscar leads da GRCC:', error);
        throw new Error('Não foi possível carregar os leads da GRCC.');
    }
}
