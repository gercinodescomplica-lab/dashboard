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
    forecastFinal: number;
    meta: number;
}

export function ForecastKpis({ forecastFinal, meta }: ForecastKpisProps) {
    const achievementPercentage = calculateAchievementPercentage(forecastFinal, meta);
    const status = determinePerformanceStatus(achievementPercentage);
    const colorClasses = getStatusColor(status);

    return (
        <TooltipProvider>
            <div className="grid grid-cols-2 gap-4">
                {/* Forecast KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Forecast Final</span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                <p><strong>Forecast Final (Previsão Final de Vendas):</strong> Baseado no que já foi vendido e no que está no funil de negociação, com quanto o gerente vai fechar o ano. Ele é a principal métrica para definir o status de atingimento (Crítico, Atenção, etc).</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-zinc-100">
                        {formatCurrency(forecastFinal)}
                    </div>
                </div>

                {/* Achievement KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Atingimento</span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] text-zinc-300 bg-zinc-900 border-zinc-700">
                                <p>Calculado baseando-se <strong>apenas no Forecast Final</strong>. Se a projeção de vendas do Forecast for menor do que a sua Meta global, o atingimento ficará comprometido.</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-xl sm:text-2xl font-bold text-zinc-100">
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
