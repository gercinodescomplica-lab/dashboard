import { useState } from 'react';
import { PipelineData } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
import { sumQuarterProjects } from '@/lib/calc';
import { QuarterProjectsModal } from './QuarterProjectsModal';
import { Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PipelineBarsProps {
    pipeline: PipelineData;
    managerName: string;
}

export function PipelineBars({ pipeline, managerName }: PipelineBarsProps) {
    const [selectedQuarter, setSelectedQuarter] = useState<{ label: string; projects: PipelineData['q1']['projects']; calculatedTotal: number } | null>(null);

    const quarters = [
        { label: 'Q1', projects: pipeline.q1?.projects || [] },
        { label: 'Q2', projects: pipeline.q2?.projects || [] },
        { label: 'Q3', projects: pipeline.q3?.projects || [] },
        { label: 'Q4', projects: pipeline.q4?.projects || [] },
        { label: 'N/M', projects: pipeline.nao_mapeado?.projects || [] },
    ].map(q => ({
        ...q,
        calculatedTotal: sumQuarterProjects(q.projects),
        contractedTotal: sumQuarterProjects(q.projects.filter(p => p.temperature === 'contratado')),
        perdidoTotal: sumQuarterProjects(q.projects.filter(p => p.temperature === 'perdido')),
    }));

    // Find the maximum quarter value to scale the bars proportionally
    const maxValue = Math.max(...quarters.map(q => q.calculatedTotal));

    return (
        <TooltipProvider>
            <div className="space-y-3">
                <div className="flex items-center gap-1.5 mb-2">
                    <h4 className="text-sm font-medium text-zinc-400">Oportunidades / Pipeline</h4>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px] text-zinc-300 bg-zinc-900 border-zinc-700">
                            <p><strong>Pipeline (Oportunidades):</strong> Dinheiro que está "na mesa". Representa o total em Reais (R$) de todas as negociações em andamento por trimestre fiscal.</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="space-y-2.5">
                    {quarters.map((q) => {
                        const contractedWidth = maxValue > 0 ? (q.contractedTotal / maxValue) * 100 : 0;
                        const perdidoWidth = maxValue > 0 ? (q.perdidoTotal / maxValue) * 100 : 0;
                        const activeTotal = q.calculatedTotal - q.contractedTotal - q.perdidoTotal;
                        const activeWidth = maxValue > 0 ? (activeTotal / maxValue) * 100 : 0;
                        return (
                            <div key={q.label} className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-zinc-500 w-5">{q.label}</span>
                                <div className="flex-1 flex items-center h-5">
                                    <button
                                        onClick={() => setSelectedQuarter(q)}
                                        className="w-full bg-zinc-800/50 hover:bg-zinc-800/80 rounded-r-sm h-full flex relative focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer overflow-hidden transition-colors"
                                        type="button"
                                    >
                                        {q.contractedTotal > 0 && (
                                            <div
                                                className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.max(contractedWidth, 2)}%` }}
                                            />
                                        )}
                                        {activeTotal > 0 && (
                                            <div
                                                className="h-full bg-indigo-500/20 transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.max(activeWidth, 2)}%` }}
                                            />
                                        )}
                                        {q.perdidoTotal > 0 && (
                                            <div
                                                className="h-full bg-red-900/40 border-r border-red-700/40 transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.max(perdidoWidth, 2)}%` }}
                                            />
                                        )}
                                        {q.calculatedTotal === 0 && (
                                            <span className="absolute left-2 text-xs text-zinc-600 top-1/2 -translate-y-1/2">R$ 0</span>
                                        )}
                                    </button>
                                </div>
                                {/* Value labels — fixed width so all bars stay aligned */}
                                <div className="w-[220px] shrink-0 flex flex-col items-end gap-0.5 text-[10px] leading-tight">
                                    <div className="flex items-center gap-1.5">
                                        {q.contractedTotal > 0 && (
                                            <span className="text-indigo-200 font-bold whitespace-nowrap">
                                                ✅ {formatCurrency(q.contractedTotal)}
                                            </span>
                                        )}
                                        {q.contractedTotal > 0 && activeTotal > 0 && (
                                            <span className="text-zinc-700">|</span>
                                        )}
                                        {activeTotal > 0 && (
                                            <span className="text-indigo-400/70 whitespace-nowrap">
                                                {formatCurrency(activeTotal)}
                                            </span>
                                        )}
                                        {q.calculatedTotal === 0 && (
                                            <span className="text-zinc-600">R$ 0</span>
                                        )}
                                    </div>
                                    {q.perdidoTotal > 0 && (
                                        <span className="text-red-500/70 whitespace-nowrap">
                                            ❌ {formatCurrency(q.perdidoTotal)} perdido
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {selectedQuarter && (
                    <QuarterProjectsModal
                        isOpen={!!selectedQuarter}
                        onClose={() => setSelectedQuarter(null)}
                        quarterLabel={selectedQuarter.label}
                        projects={selectedQuarter.projects}
                        totalValue={selectedQuarter.calculatedTotal}
                        managerName={managerName}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}
