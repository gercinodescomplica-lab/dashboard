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
    contratado: number;
}

export function PerformanceBars({ meta, contratado }: PerformanceBarsProps) {
    const gap = calculateGap(meta, contratado);

    // Treat negative gap (above target) as 0 for the bar visualization, although we still display the actual value or "Acima"
    const gapValue = gap < 0 ? 0 : gap;

    // Calculate percentages based on meta being 100%
    const contratadoPercent = Math.min((contratado / meta) * 100, 100);
    const gapPercent = Math.min((gapValue / meta) * 100, 100);

    return (
        <TooltipProvider>
            <div className="space-y-4">
                {/* Meta Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">Meta</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                    <p><strong>Meta:</strong> Objetivo total de vendas/contratos estipulado para o ano vigente.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-semibold text-blue-400">{formatCurrency(meta)}</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full w-full" />
                    </div>
                </div>

                {/* Contratado Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">Contratado</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                    <p><strong>Contratado:</strong> Dinheiro que já está "no bolso". Representa contratos definitivamente assinados/fechados.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-semibold text-emerald-400">{formatCurrency(contratado)}</span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${contratadoPercent}%` }}
                        />
                    </div>
                </div>

                {/* Gap Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">Gap</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                    <p><strong>Gap:</strong> A diferença entre a Meta e o que já está Contratado. Ou seja, mostra de forma exata quanto falta contratar (vender) neste ano para o objetivo ser batido.</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-semibold text-amber-500">
                            {gap < 0 ? 'Acima da meta' : formatCurrency(gap)}
                        </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex justify-end">
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
