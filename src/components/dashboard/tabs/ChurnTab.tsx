'use client';

import { ChurnItem } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
import { TrendingDown, FileText, AlertCircle, HelpCircle } from 'lucide-react';

interface ChurnTabProps {
    items: ChurnItem[];
    lightActive?: boolean;
}

export function ChurnTab({ items, lightActive = false }: ChurnTabProps) {
    const totalLost = items.reduce((acc, item) => acc + (item.valor || 0), 0);

    const T = {
        emptyText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        bannerBg: lightActive ? 'bg-red-50 border-red-200' : 'bg-red-950/20 border-red-900/40',
        bannerHeading: lightActive ? 'text-red-700' : 'text-red-400',
        bannerSub: lightActive ? 'text-red-600/80' : 'text-zinc-400',
        bannerValue: lightActive ? 'text-red-700' : 'text-red-400',
        cardBg: lightActive ? 'bg-white border-zinc-200 hover:border-red-300' : 'bg-zinc-900/60 border-zinc-800 hover:border-red-900/50',
        cardContract: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        cardValue: lightActive ? 'text-red-600' : 'text-red-400',
        label: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        descBox: lightActive ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950/60 border-zinc-800 text-zinc-200',
        motivoBox: lightActive ? 'bg-red-50/70 border-red-200 text-red-900' : 'bg-red-950/30 border-red-900/40 text-red-300',
    };

    if (items.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl gap-3 ${T.emptyText}`}>
                <AlertCircle className="w-8 h-8 opacity-40" />
                <p className="text-base font-medium">Nenhum contrato em churn registrado para este gerente.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header Banner */}
            <div className={`border rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${T.bannerBg}`}>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <TrendingDown className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h4 className={`text-lg font-bold ${T.bannerHeading}`}>Resumo de Churn do Gerente</h4>
                        <p className={`text-xs ${T.bannerSub}`}>
                            {items.length} {items.length === 1 ? 'contrato rescindido' : 'contratos rescindidos'} · Perda financeira total
                        </p>
                    </div>
                </div>
                <div className="text-left sm:text-right">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold block">Total Perdido</span>
                    <span className={`text-2xl font-bold font-mono ${T.bannerValue}`}>{formatCurrency(totalLost)}</span>
                </div>
            </div>

            {/* List of Churn Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className={`border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 shadow-sm ${T.cardBg}`}
                    >
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-zinc-800/40">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className={`font-bold text-base font-mono ${T.cardContract}`}>
                                        {item.numeroContrato}
                                    </span>
                                </div>
                                <span className={`font-mono font-bold text-base ${T.cardValue}`}>
                                    {formatCurrency(item.valor)}
                                </span>
                            </div>

                            <div className="space-y-3 text-xs">
                                {item.descricao && (
                                    <div className="space-y-1">
                                        <span className={`font-semibold flex items-center gap-1.5 ${T.label}`}>
                                            Descrição / Serviço Prestado:
                                        </span>
                                        <div className={`p-3 rounded-xl border leading-relaxed ${T.descBox}`}>
                                            {item.descricao}
                                        </div>
                                    </div>
                                )}

                                {item.motivo && (
                                    <div className="space-y-1">
                                        <span className={`font-semibold flex items-center gap-1.5 ${T.label}`}>
                                            <HelpCircle className="w-3.5 h-3.5 text-red-400" /> Motivo da Desistência:
                                        </span>
                                        <div className={`p-3 rounded-xl border leading-relaxed ${T.motivoBox}`}>
                                            {item.motivo}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
