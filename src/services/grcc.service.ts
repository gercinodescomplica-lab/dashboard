'use server';

/** Leituras da GRCC — abertas, como o resto do dashboard (escritas ficam em app/grcc/actions.ts). */

import { unstable_noStore as noStore } from 'next/cache';
import {
    fetchHistoricoLead,
    fetchListasGrcc,
    fetchMovimentacoesRecentes,
    fetchProjetosManuaisGrcc,
    lerUltimoImportGrcc,
    lerVersaoGrcc,
    listLeadsGrcc,
} from '@/db/queries';
import type { EventoHistorico, Movimentacao, PainelGrcc, UltimoImport } from '@/lib/grcc/tipos';

export async function carregarPainelGrcc(): Promise<PainelGrcc> {
    noStore();
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

export async function historicoDoLead(id: number): Promise<EventoHistorico[]> {
    noStore();
    return fetchHistoricoLead(id);
}

export async function movimentacoesRecentes(limite = 15): Promise<Movimentacao[]> {
    noStore();
    return fetchMovimentacoesRecentes(limite);
}

/** Consulta mínima que o dashboard faz a cada 15 s para saber se precisa recarregar. */
export async function versaoGrcc(): Promise<number> {
    noStore();
    return lerVersaoGrcc();
}

export async function ultimoImportGrcc(): Promise<UltimoImport | null> {
    noStore();
    return lerUltimoImportGrcc();
}
