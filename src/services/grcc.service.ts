'use server';

/**
 * Leituras da GRCC. Painel e histórico são internos da GRCC: exigem a chave, conferida aqui no servidor.
 * Abertas ao dashboard: a versão (checagem de recarga) e a linha do tempo comercial, já filtrada aqui no servidor. Escritas ficam em app/grcc/actions.ts.
 */

import { unstable_noStore as noStore } from 'next/cache';
import {
    fetchHistoricoLead,
    fetchListasGrcc,
    fetchMovimentacoesRecentes,
    fetchProjetosManuaisGrcc,
    getLeadGrcc,
    lerUltimoImportGrcc,
    lerVersaoGrcc,
    listLeadsGrcc,
} from '@/db/queries';
import type { EventoComercial, EventoHistorico, PainelGrcc } from '@/lib/grcc/tipos';
import { eventosComerciais } from '@/lib/grcc/organizar';
import { chaveGrccValida } from '@/lib/grcc/chave';

function exigirChave(chave: string) {
    if (!chaveGrccValida(chave)) throw new Error('Chave GRCC inválida.');
}

export async function carregarPainelGrcc(chave: string): Promise<PainelGrcc> {
    noStore();
    exigirChave(chave);
    const [leads, listas, movimentacoes, ultimoImport, projetosManuais, versao] = await Promise.all([
        listLeadsGrcc(),
        fetchListasGrcc(),
        fetchMovimentacoesRecentes(15),
        lerUltimoImportGrcc(),
        fetchProjetosManuaisGrcc(),
        lerVersaoGrcc(),
    ]);
    return { leads, listas, movimentacoes, ultimoImport, projetosManuais, versao };
}

export async function historicoDoLead(chave: string, id: number): Promise<EventoHistorico[]> {
    noStore();
    exigirChave(chave);
    return fetchHistoricoLead(id);
}

/** Histórico comercial do lead para o dashboard. O filtro roda aqui: autor, arquivo e campos internos nunca saem do servidor. */
export async function linhaDoTempoComercial(id: number): Promise<EventoComercial[]> {
    noStore();
    const lead = await getLeadGrcc(id);
    if (!lead || !lead.visivelDashboard) return [];
    return eventosComerciais(await fetchHistoricoLead(id));
}

/** Consulta mínima que o dashboard faz a cada 15 s para saber se precisa recarregar. */
export async function versaoGrcc(): Promise<number> {
    noStore();
    return lerVersaoGrcc();
}
