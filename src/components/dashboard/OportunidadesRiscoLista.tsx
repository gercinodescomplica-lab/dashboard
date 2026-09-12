'use client';

import { ClipboardList, HelpCircle, PackageSearch, Users } from 'lucide-react';
import type { OportunidadeComGerencia } from '@/types/oportunidades';
import { formatCurrency } from '@/lib/format';
import { causaLabel, statusMeta } from '@/lib/oportunidades';

/**
 * Lista de oportunidades em risco com a gerência de origem — corpo do modal
 * "Oportunidades em Risco" do dashboard principal (DRMOverview).
 *
 * Apresentação pura: recebe os itens já ordenados por criticidade pelo service.
 */

interface OportunidadesRiscoListaProps {
    items: OportunidadeComGerencia[];
    lightActive?: boolean;
}

export function OportunidadesRiscoLista({ items, lightActive = false }: OportunidadesRiscoListaProps) {
    const T = {
        item: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800',
        divider: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        orgao: lightActive ? 'text-indigo-700' : 'text-indigo-400',
        titulo: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        muted: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        empresa: lightActive ? 'text-zinc-400' : 'text-zinc-700',
        descBox: lightActive ? 'bg-white border-zinc-200 text-zinc-700' : 'bg-zinc-950/60 border-zinc-800 text-zinc-300',
        pill: lightActive ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300',
        pillValor: lightActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300',
        pillArea: lightActive ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/30 border-red-900/40 text-red-300',
        emptyText: lightActive ? 'text-zinc-500' : 'text-zinc-500',
    };

    if (items.length === 0) {
        return <p className={`text-center py-12 ${T.emptyText}`}>Nenhuma oportunidade encontrada.</p>;
    }

    return (
        <div className="flex flex-col gap-3">
            {items.map((item, idx) => {
                const meta = statusMeta(item.status);
                return (
                    <div key={`${item.gerencia}-${item.orgao}-${item.produtoTema}-${idx}`} className={`border rounded-xl px-4 py-3 flex flex-col gap-2 ${T.item}`}>
                        {/* Órgão + status + valor */}
                        <div className={`flex items-center justify-between gap-2 border-b pb-2 ${T.divider}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <ClipboardList className={`w-4 h-4 shrink-0 ${T.orgao}`} />
                                <span className={`text-sm font-bold truncate ${T.orgao}`} title={item.orgao}>
                                    {item.orgao}
                                </span>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${lightActive ? meta.light : meta.dark}`}>
                                    {meta.label}
                                </span>
                            </div>
                            {item.valorIndicado !== null && item.valorIndicado > 0 && (
                                <span className={`shrink-0 text-sm font-bold font-mono ${lightActive ? 'text-emerald-700' : 'text-emerald-300'}`}>
                                    {formatCurrency(item.valorIndicado)}
                                </span>
                            )}
                        </div>

                        {/* Produto/tema */}
                        <div className="flex items-start gap-2">
                            <PackageSearch className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${T.muted}`} />
                            <p className={`text-sm font-semibold leading-snug ${T.titulo}`}>{item.produtoTema}</p>
                        </div>

                        {/* Gerente responsável */}
                        <p className={`text-xs ${T.muted}`}>
                            {item.gerenteNome || item.gerencia} <span className={T.empresa}>({item.gerencia})</span>
                        </p>

                        {/* Causa raiz + descrição */}
                        <div className={`text-xs p-2.5 rounded-lg border leading-relaxed ${T.descBox}`}>
                            <span className={`font-semibold flex items-center gap-1.5 ${T.muted}`}>
                                <HelpCircle className="w-3.5 h-3.5" /> Motivo (causa raiz)
                            </span>
                            <span className={`font-bold block mt-1 ${T.titulo}`}>{causaLabel(item.causaRaiz)}</span>
                            {item.descricao || 'Sem descrição registrada.'}
                        </div>

                        {/* Metadados */}
                        <div className="flex flex-wrap items-center gap-2">
                            {item.areaBloqueadora && (
                                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${T.pillArea}`}>
                                    Bloqueio: {item.areaBloqueadora}
                                </span>
                            )}
                            {item.tinhaPropostaFormal !== null && (
                                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${T.pill}`}>
                                    {item.tinhaPropostaFormal ? 'Com proposta formal' : 'Sem proposta formal'}
                                </span>
                            )}
                            {item.envolvidos.length > 0 && (
                                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 ${T.pill}`}>
                                    <Users className="w-3 h-3" /> {item.envolvidos.join(', ')}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
