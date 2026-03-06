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
        { label: 'Q1', projects: pipeline.q1?.projects || [], calculatedTotal: sumQuarterProjects(pipeline.q1?.projects || []) },
        { label: 'Q2', projects: pipeline.q2?.projects || [], calculatedTotal: sumQuarterProjects(pipeline.q2?.projects || []) },
        { label: 'Q3', projects: pipeline.q3?.projects || [], calculatedTotal: sumQuarterProjects(pipeline.q3?.projects || []) },
        { label: 'Q4', projects: pipeline.q4?.projects || [], calculatedTotal: sumQuarterProjects(pipeline.q4?.projects || []) },
        { label: 'N/M', projects: pipeline.nao_mapeado?.projects || [], calculatedTotal: sumQuarterProjects(pipeline.nao_mapeado?.projects || []) },
    ];

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
                        const widthPercent = maxValue > 0 ? (q.calculatedTotal / maxValue) * 100 : 0;
                        return (
                            <div key={q.label} className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-zinc-500 w-5">{q.label}</span>
                                <div className="flex-1 flex items-center h-5">
                                    <button
                                        onClick={() => setSelectedQuarter(q)}
                                        className="w-full bg-zinc-800/50 hover:bg-zinc-800/80 rounded-r-sm h-full flex relative focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer overflow-hidden transition-colors"
                                        type="button"
                                    >
                                        <div
                                            className="h-full bg-indigo-500/20 rounded-r-sm border-r border-indigo-500 text-indigo-400 flex items-center justify-end px-2 text-xs font-medium transition-all duration-1000 ease-out whitespace-nowrap min-w-[2px]"
                                            style={{ width: `${q.calculatedTotal === 0 ? 0 : Math.max(widthPercent, 2)}%`, opacity: q.calculatedTotal === 0 ? 0 : 1 }}
                                        >
                                            {q.calculatedTotal > 0 ? (
                                                <span className="absolute right-2 opacity-80">{formatCurrency(q.calculatedTotal)}</span>
                                            ) : null}
                                        </div>
                                        {q.calculatedTotal === 0 && (
                                            <span className="absolute left-2 text-xs text-zinc-600 top-1/2 -translate-y-1/2">R$ 0</span>
                                        )}
                                    </button>
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
