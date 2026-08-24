import { formatCurrency } from '@/lib/format';
import { calculateGap } from '@/lib/calc';
import { Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PerformanceBarsProps {
    meta: number;
    metaNovosNegocios?: number;
    novosNegocios: number;
    lightActive?: boolean;
}

export function PerformanceBars({ meta, metaNovosNegocios, novosNegocios, lightActive = false }: PerformanceBarsProps) {
    const targetMeta = (metaNovosNegocios && metaNovosNegocios > 0) ? metaNovosNegocios : meta;
    const gap = calculateGap(targetMeta, novosNegocios);
    const labelText = lightActive ? 'text-zinc-500' : 'text-zinc-400';
    const infoIcon = lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300';
    const tooltipCls = lightActive ? 'text-zinc-700 bg-white border-zinc-200' : 'text-zinc-300 bg-zinc-900 border-zinc-700';
    const trackBg = lightActive ? 'bg-zinc-100' : 'bg-zinc-800';

    // Treat negative gap (above target) as 0 for the bar visualization
    const gapValue = gap < 0 ? 0 : gap;

    // Calculate percentages based on targetMeta being 100%
    const novosPercent = targetMeta > 0 ? Math.min((novosNegocios / targetMeta) * 100, 100) : 0;
    const gapPercent = targetMeta > 0 ? Math.min((gapValue / targetMeta) * 100, 100) : 0;

    return (
        <TooltipProvider>
            <div className="space-y-4">
                {/* Meta Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className={labelText}>{metaNovosNegocios && metaNovosNegocios > 0 ? 'Meta Novos Negócios' : 'Meta Total'}</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className={`w-3.5 h-3.5 transition-colors ${infoIcon}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`max-w-[250px] ${tooltipCls}`}>
                                    <p><strong>Meta:</strong> Objetivo de captação de novos negócios estipulado para o gerente no ano.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className={`font-semibold ${lightActive ? 'text-blue-600' : 'text-blue-400'}`}>{formatCurrency(targetMeta)}</span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full overflow-hidden transition-colors duration-200 ${trackBg}`}>
                        <div className="h-full bg-blue-500 rounded-full w-full" />
                    </div>
                </div>

                {/* Negócios Concluídos Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className={labelText}>Negócios Concluídos (TCV)</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className={`w-3.5 h-3.5 transition-colors ${infoIcon}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`max-w-[250px] ${tooltipCls}`}>
                                    <p><strong>Negócios Concluídos (TCV):</strong> Soma do Valor Total de todos os novos contratos fechados no pipeline.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className={`font-semibold ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>{formatCurrency(novosNegocios)}</span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full overflow-hidden transition-colors duration-200 ${trackBg}`}>
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${novosPercent}%` }}
                        />
                    </div>
                </div>

                {/* Gap Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className={labelText}>Gap</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className={`w-3.5 h-3.5 transition-colors ${infoIcon}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`max-w-[250px] ${tooltipCls}`}>
                                    <p><strong>Gap:</strong> A diferença entre a Meta e o que já está Contratado. Ou seja, mostra de forma exata quanto falta contratar (vender) neste ano para o objetivo ser batido.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className={`font-semibold ${lightActive ? 'text-amber-600' : 'text-amber-500'}`}>
                            {gap < 0 ? 'Acima da meta' : formatCurrency(gap)}
                        </span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full overflow-hidden flex justify-end transition-colors duration-200 ${trackBg}`}>
                        {/* Gap usually comes from the remaining part to 100%, so we can align it to the right visually or keep left. We'll keep left for consistency. */}
                        <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${gapPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
