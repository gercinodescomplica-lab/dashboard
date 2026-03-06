'use client';

import { CXItem, CXStatus } from '@/types/manager';

interface CXTabProps {
    items: CXItem[];
}

const STATUS_CONFIG: Record<CXStatus, { label: string; style: string }> = {
    pendente: { label: 'Pendente', style: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    analise: { label: 'Em Análise', style: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    resolvido: { label: 'Resolvido', style: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
};

export function CXTab({ items }: CXTabProps) {
    if (items.length === 0) {
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
                        <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-28">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {items.map((item, i) => {
                        const status = STATUS_CONFIG[item.status];
                        return (
                            <tr key={i} className="hover:bg-zinc-800/30 transition-colors align-top">
                                <td className="py-3 pr-4 text-zinc-200 font-medium whitespace-nowrap">{item.cliente}</td>
                                <td className="py-3 pr-4 text-zinc-400 max-w-xs">{item.problema}</td>
                                <td className="py-3 pr-4 text-zinc-400 max-w-xs">{item.solucaoProposta}</td>
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
