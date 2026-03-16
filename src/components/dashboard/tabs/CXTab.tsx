'use client';

import { useState } from 'react';
import { CXItem, CXStatus, CXCriticidade } from '@/types/manager';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface CXTabProps {
    items: CXItem[];
}

const STATUS_CONFIG: Record<CXStatus, { label: string; style: string }> = {
    pendente: { label: 'Pendente', style: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    analise: { label: 'Em Análise', style: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    resolvido: { label: 'Resolvido', style: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
};

const CRITICIDADE_CONFIG: Record<CXCriticidade, { label: string; style: string }> = {
    baixa: { label: 'Baixa', style: 'bg-green-500/10 text-green-400 border border-green-500/20' },
    media: { label: 'Média', style: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
    alta: { label: 'Alta', style: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

const CRITICIDADE_WEIGHT: Record<CXCriticidade, number> = {
    baixa: 1,
    media: 2,
    alta: 3,
};

const STATUS_WEIGHT: Record<CXStatus, number> = {
    pendente: 1,
    analise: 2,
    resolvido: 3,
};

type SortKey = 'criticidade' | 'status' | null;
type SortDirection = 'asc' | 'desc';

export function CXTab({ items }: CXTabProps) {
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc'); // Default new sort to descending (Highest first)
        }
    };

    const visibleItems = items.filter(item => item.isVisible !== false);

    const getSortedItems = () => {
        if (!sortKey) return visibleItems;

        return [...visibleItems].sort((a, b) => {
            let weightA = 0;
            let weightB = 0;

            if (sortKey === 'criticidade') {
                weightA = CRITICIDADE_WEIGHT[a.criticidade || 'baixa'];
                weightB = CRITICIDADE_WEIGHT[b.criticidade || 'baixa'];
            } else if (sortKey === 'status') {
                weightA = STATUS_WEIGHT[a.status];
                weightB = STATUS_WEIGHT[b.status];
            }

            if (weightA === weightB) return 0;
            
            if (sortDirection === 'asc') {
                return weightA > weightB ? 1 : -1;
            } else {
                return weightA < weightB ? 1 : -1;
            }
        });
    };

    if (visibleItems.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                Nenhum registro de CX para este gerente.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-left">
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cliente / Órgão</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Problema</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Solução Proposta</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-28">
                            <button 
                                onClick={() => handleSort('criticidade')}
                                className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none"
                            >
                                CRITICIDADE
                                {sortKey === 'criticidade' ? (
                                    sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                                )}
                            </button>
                        </th>
                        <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-32">
                            <button 
                                onClick={() => handleSort('status')}
                                className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors focus:outline-none"
                            >
                                STATUS
                                {sortKey === 'status' ? (
                                    sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                                )}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {getSortedItems().map((item, i) => {
                        const status = STATUS_CONFIG[item.status];
                        return (
                            <tr key={i} className="hover:bg-zinc-800/30 transition-colors align-top">
                                <td className="py-3 pr-4 text-zinc-200 font-medium whitespace-nowrap">{item.cliente}</td>
                                <td className="py-3 pr-4 max-w-xs">
                                    {item.titulo && <div className="text-zinc-300 font-semibold mb-1 text-sm">{item.titulo}</div>}
                                    <div className="text-zinc-400 text-xs">{item.problema}</div>
                                </td>
                                <td className="py-3 pr-4 text-zinc-400 max-w-xs">{item.solucaoProposta}</td>
                                <td className="py-3 pr-4 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${CRITICIDADE_CONFIG[item.criticidade || 'baixa'].style}`}>
                                        {CRITICIDADE_CONFIG[item.criticidade || 'baixa'].label}
                                    </span>
                                </td>
                                <td className="py-3 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${status.style}`}>
                                        {status.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
