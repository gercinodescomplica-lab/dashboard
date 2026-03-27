import { formatCurrency, formatPercentage } from '@/lib/format';
import { calculateAchievementPercentage, determinePerformanceStatus, getStatusColor } from '@/lib/calc';
import { cn } from '@/lib/utils';
import { TrendingUp, Target, Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ForecastKpisProps {
    contratado: number;
    meta: number;
}

export function ForecastKpis({ contratado, meta }: ForecastKpisProps) {
    const achievementPercentage = calculateAchievementPercentage(contratado, meta);
    const status = determinePerformanceStatus(achievementPercentage);
    const colorClasses = getStatusColor(status);

    return (
        <TooltipProvider>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Meta KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Meta</span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                <p><strong>Meta:</strong> Objetivo global de vendas estabelecido para o gerente no ano atual.</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="text-[clamp(1.1rem,2vw,1.5rem)] xl:text-2xl font-bold text-zinc-100 mt-2 tracking-tighter whitespace-nowrap">
                        {formatCurrency(meta)}
                    </div>
                </div>

                {/* Achievement KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Atingimento</span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                <p>Porcentagem do valor que já foi efetivamente <strong>contratado</strong> comercialmente em relação à Meta, sem contar os valores do pipeline.</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                        <div className="text-[clamp(1.1rem,2vw,1.5rem)] xl:text-2xl font-bold text-zinc-100 tracking-tighter whitespace-nowrap">
                            {formatPercentage(achievementPercentage)}
                        </div>
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", colorClasses)}>
                            vs Meta
                        </span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
