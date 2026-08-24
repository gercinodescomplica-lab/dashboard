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
    lightActive?: boolean;
}

function InfoTip({ text, lightActive = false }: { text: string; lightActive?: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`cursor-help transition-colors inline-flex items-center ml-0.5 ${lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <Info className="w-3 h-3" />
                </span>
            </TooltipTrigger>
            <TooltipContent
                className={`max-w-[260px] text-xs leading-relaxed shadow-xl border ${lightActive ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-zinc-900 text-zinc-200 border-zinc-700'}`}
                side="top"
                sideOffset={6}
            >
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

export function ForecastKpis({ manager, lightActive = false }: ForecastKpisProps) {
    const kpiCard = lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800';
    const kpiValueBase = lightActive ? 'text-zinc-900' : 'text-zinc-100';
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
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Target className={`w-3.5 h-3.5 ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Meta Total
                                <InfoTip text="Meta Total global definida para este gerente no ano." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${kpiValueBase}`}>
                        {formatCurrency(manager.meta)}
                    </div>
                </div>

                {/* Meta Novos Negócios KPI */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Target className={`w-3.5 h-3.5 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                Meta Novos
                                <InfoTip text="Meta específica para captação de novos negócios estipulada para este gerente no ano." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-indigo-600' : 'text-indigo-300'}`}>
                        {formatCurrency(manager.metaNovosNegocios || 0)}
                    </div>
                </div>

                {/* Contratos Herdados */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <FileCheck2 className={`w-3.5 h-3.5 ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                Herdados
                                <InfoTip text="Base de receita recorrente trazida de anos anteriores. São contratos já existentes sob responsabilidade deste gerente." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-zinc-600' : 'text-zinc-300'}`}>
                        {formatCurrency(contratosHerdados)}
                    </div>
                </div>

                {/* Negócios Concluídos TCV */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className={`w-3.5 h-3.5 ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                Concluídos
                                <InfoTip text="Receita reconhecida em 2026 de todos os negócios marcados como 'Contratado' no pipeline, calculada pro-rata conforme o mês de início de faturamento e duração do contrato." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>
                        {formatCurrency(novosNegocios)}
                    </div>
                </div>

                {/* Contratado 2026 / Atingimento */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <CalendarCheck className={`w-3.5 h-3.5 ${lightActive ? 'text-blue-600' : 'text-blue-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-blue-600' : 'text-blue-400'}`}>
                                Contratado 2026
                                <InfoTip text={`Receita efetiva reconhecida em 2026 = Herdados + parcela pro-rata dos novos contratos.`} lightActive={lightActive} />
                            </span>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help", colorClasses)}>
                                    {formatPercentage(achievementPercentage)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent
                                className={`max-w-[240px] text-xs leading-relaxed shadow-xl border ${lightActive ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-zinc-900 text-zinc-200 border-zinc-700'}`}
                                side="top"
                                sideOffset={6}
                            >
                                Atingimento = Negócios Concluídos (Pro-rata 2026) ÷ Meta Novos Negócios × 100.<br />
                                Aqui: {formatCurrency(novosNegocios)} ÷ {formatCurrency(targetMeta)} = {formatPercentage(achievementPercentage)}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-blue-600' : 'text-blue-400'}`}>
                        {formatCurrency(contratado2026)}
                    </div>
                </div>

                {/* Forecast Total (TCV bruto) */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <BarChart2 className={`w-3.5 h-3.5 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                Forecast Total
                                <InfoTip text="Projeção total bruta = Contratos Herdados + TCV de todos os projetos ativos no pipeline (Quente, Morno, Frio e Contratado). Não aplica pro-rata." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-indigo-600' : 'text-indigo-300'}`}>
                        {formatCurrency(forecastTotal)}
                    </div>
                </div>

                {/* Forecast Pro-rata 2026 */}
                <div className={`border rounded-xl p-3.5 flex flex-col justify-between min-w-0 ring-1 ring-violet-500/30 transition-colors duration-200 ${kpiCard}`}>
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className={`w-3.5 h-3.5 ${lightActive ? 'text-violet-600' : 'text-violet-400'}`} />
                            <span className={`text-[11px] font-semibold uppercase tracking-wider ${lightActive ? 'text-violet-600' : 'text-violet-400'}`}>
                                Forecast 2026
                                <InfoTip text="Projeção de receita reconhecida em 2026 aplicando pro-rata em todo o pipeline: Contratado 2026 + parcela pro-rata de 2026 dos projetos abertos (Quente, Morno, Frio)." lightActive={lightActive} />
                            </span>
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-bold font-mono mt-1 tracking-tighter truncate ${lightActive ? 'text-violet-600' : 'text-violet-300'}`}>
                        {formatCurrency(forecastProRata)}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
