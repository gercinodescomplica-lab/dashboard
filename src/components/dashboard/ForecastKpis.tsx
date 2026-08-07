import { formatCurrency, formatPercentage } from '@/lib/format';
import { calculateAchievementPercentage, determinePerformanceStatus, getStatusColor, sumPipelineContratado2026, calcEffectiveContratado, calcForecastProRata2026 } from '@/lib/calc';
import { cn } from '@/lib/utils';
import { Target, Info, FileCheck2, Sparkles, CalendarCheck, TrendingUp, BarChart2 } from 'lucide-react';
import { Manager } from '@/types/manager';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ForecastKpisProps {
    manager: Manager;
}

function InfoTip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="cursor-help text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center ml-0.5">
                    <Info className="w-3 h-3" />
                </span>
            </TooltipTrigger>
            <TooltipContent
                className="max-w-[260px] text-xs leading-relaxed bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl"
                side="top"
                sideOffset={6}
            >
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

export function ForecastKpis({ manager }: ForecastKpisProps) {
    const contratado2026 = manager.contratado2026 ?? calcEffectiveContratado(manager.contratado, manager.pipeline);
    const novosNegocios = manager.novosNegocios ?? sumPipelineContratado2026(manager.pipeline);
    const contratosHerdados = manager.contratosHerdados ?? manager.contratado;
    const forecastTotal = manager.forecastFinal;
    const forecastProRata = manager.forecastProRata2026 ?? calcForecastProRata2026(manager.contratado, manager.pipeline);
    const targetMeta = (manager.metaNovosNegocios && manager.metaNovosNegocios > 0) ? manager.metaNovosNegocios : manager.meta;
    const achievementPercentage = calculateAchievementPercentage(novosNegocios, targetMeta);
    const status = determinePerformanceStatus(achievementPercentage);
    const colorClasses = getStatusColor(status);

    return (
        <TooltipProvider>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {/* Meta Total KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Meta Total
                                <InfoTip text="Meta Total global definida para este gerente no ano." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-zinc-100 mt-1 tracking-tighter truncate">
                        {formatCurrency(manager.meta)}
                    </div>
                </div>

                {/* Meta Novos Negócios KPI */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                                Meta Novos
                                <InfoTip text="Meta específica para captação de novos negócios estipulada para este gerente no ano." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-indigo-300 mt-1 tracking-tighter truncate">
                        {formatCurrency(manager.metaNovosNegocios || 0)}
                    </div>
                </div>

                {/* Contratos Herdados */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <FileCheck2 className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Herdados
                                <InfoTip text="Base de receita recorrente trazida de anos anteriores. São contratos já existentes sob responsabilidade deste gerente." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-zinc-300 mt-1 tracking-tighter truncate">
                        {formatCurrency(contratosHerdados)}
                    </div>
                </div>

                {/* Negócios Concluídos TCV */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                                Concluídos
                                <InfoTip text="Receita reconhecida em 2026 de todos os negócios marcados como 'Contratado' no pipeline, calculada pro-rata conforme o mês de início de faturamento e duração do contrato." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1 tracking-tighter truncate">
                        {formatCurrency(novosNegocios)}
                    </div>
                </div>

                {/* Contratado 2026 / Atingimento */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <CalendarCheck className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                                Contratado 2026
                                <InfoTip text={`Receita efetiva reconhecida em 2026 = Herdados + parcela pro-rata dos novos contratos.`} />
                            </span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help", colorClasses)}>
                                    {formatPercentage(achievementPercentage)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent
                                className="max-w-[240px] text-xs leading-relaxed bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl"
                                side="top"
                                sideOffset={6}
                            >
                                Atingimento = Negócios Concluídos (Pro-rata 2026) ÷ Meta Novos Negócios × 100.<br />
                                Aqui: {formatCurrency(novosNegocios)} ÷ {formatCurrency(targetMeta)} = {formatPercentage(achievementPercentage)}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-blue-400 mt-1 tracking-tighter truncate">
                        {formatCurrency(contratado2026)}
                    </div>
                </div>

                {/* Forecast Total (TCV bruto) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                                Forecast Total
                                <InfoTip text="Projeção total bruta = Contratos Herdados + TCV de todos os projetos ativos no pipeline (Quente, Morno, Frio e Contratado). Não aplica pro-rata." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-indigo-300 mt-1 tracking-tighter truncate">
                        {formatCurrency(forecastTotal)}
                    </div>
                </div>

                {/* Forecast Pro-rata 2026 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between min-w-0 ring-1 ring-violet-500/30">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
                                Forecast 2026
                                <InfoTip text="Projeção de receita reconhecida em 2026 aplicando pro-rata em todo o pipeline: Contratado 2026 + parcela pro-rata de 2026 dos projetos abertos (Quente, Morno, Frio)." />
                            </span>
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono text-violet-300 mt-1 tracking-tighter truncate">
                        {formatCurrency(forecastProRata)}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
