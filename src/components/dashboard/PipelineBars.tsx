import { useState } from 'react';
import { PipelineData } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
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
}

export function PipelineBars({ pipeline }: PipelineBarsProps) {
    const [selectedQuarter, setSelectedQuarter] = useState<{ label: string; data: PipelineData['q1'] } | null>(null);

    // Find the maximum quarter value to scale the bars proportionally
    const maxValue = Math.max(pipeline.q1.total, pipeline.q2.total, pipeline.q3.total, pipeline.q4.total);

    const quarters = [
        { label: 'Q1', data: pipeline.q1 },
        { label: 'Q2', data: pipeline.q2 },
        { label: 'Q3', data: pipeline.q3 },
        { label: 'Q4', data: pipeline.q4 },
    ];

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
                        const widthPercent = maxValue > 0 ? (q.data.total / maxValue) * 100 : 0;
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
                                            style={{ width: `${q.data.total === 0 ? 0 : Math.max(widthPercent, 2)}%`, opacity: q.data.total === 0 ? 0 : 1 }}
                                        >
                                            {q.data.total > 0 ? (
                                                <span className="absolute right-2 opacity-80">{formatCurrency(q.data.total)}</span>
                                            ) : null}
                                        </div>
                                        {q.data.total === 0 && (
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
                        projects={selectedQuarter.data.projects}
                        totalValue={selectedQuarter.data.total}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}
