'use client';

import { useState } from 'react';
import { Project, PipelineData, ProjectHistoryItem } from '@/types/manager';
import { formatCurrency } from '@/lib/format';
import { calculateProject2026Value } from '@/lib/calc';
import { ChevronDown, ChevronRight, History, Calendar, DollarSign, Clock, Sparkles, Tag, Info } from 'lucide-react';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectsTabProps {
    pipeline: PipelineData;
}

const QUARTER_LABELS: Record<string, string> = {
    q1: 'Q1 — 1º Trimestre',
    q2: 'Q2 — 2º Trimestre',
    q3: 'Q3 — 3º Trimestre',
    q4: 'Q4 — 4º Trimestre',
    nao_mapeado: 'Não Mapeado',
};

const TEMP_STYLES: Record<string, { emoji: string; color: string; label: string }> = {
    quente: { emoji: '🔥', color: 'text-orange-400', label: 'Quente' },
    morno: { emoji: '🟡', color: 'text-yellow-400', label: 'Morno' },
    frio: { emoji: '❄️', color: 'text-blue-400', label: 'Frio' },
    contratado: { emoji: '✅', color: 'text-emerald-400', label: 'Contratado' },
    historico: { emoji: '⏸️', color: 'text-orange-300', label: 'Histórico' },
    perdido: { emoji: '❌', color: 'text-red-500', label: 'Perdido' },
};

function getHistoryIcon(type: ProjectHistoryItem['tipo']) {
    switch (type) {
        case 'valor': return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
        case 'quarter': return <Calendar className="w-3.5 h-3.5 text-indigo-400" />;
        case 'status': return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
        default: return <Tag className="w-3.5 h-3.5 text-zinc-400" />;
    }
}

function buildTimeline(project: Project, quarterKey: string): ProjectHistoryItem[] {
    if (project.history && project.history.length > 0) {
        return project.history;
    }
    // Synthetic parser for existing descriptions
    if (project.description) {
        return [
            {
                date: 'Registro de Pipeline',
                tipo: project.description.toLowerCase().includes('adiado') ? 'quarter' : 'nota',
                justificativa: project.description,
            }
        ];
    }
    return [];
}

export function ProjectsTab({ pipeline }: ProjectsTabProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Flatten all projects with quarter info, sorted by quarter then by value desc
    const rows: Array<{ quarter: string; project: Project }> = [];
    (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).forEach((q) => {
        if (pipeline[q] && pipeline[q].projects) {
            pipeline[q].projects.forEach((p) => {
                rows.push({ quarter: q, project: p });
            });
        }
    });

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                Nenhum projeto cadastrado no pipeline.
            </div>
        );
    }

    const toggleRow = (index: number) => {
        setExpandedRow(expandedRow === index ? null : index);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-left">
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-36">Quarter</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projeto</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Órgão / Cliente</th>
                        <th className="pb-3 pr-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Valor Total</th>
                        <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center w-24">Temp.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {rows.map(({ quarter, project }, i) => {
                        const isPerdido = project.temperature === 'perdido';
                        const isHistorico = project.temperature === 'historico';
                        const isInactive = isPerdido || isHistorico;
                        const temp = project.temperature ? TEMP_STYLES[project.temperature] : null;
                        const isExpanded = expandedRow === i;
                        const timeline = buildTimeline(project, quarter);
                        const duration = project.durationMonths || 12;
                        const val2026 = calculateProject2026Value(project, quarter);

                        return (
                            <>
                                <tr
                                    key={i}
                                    onClick={() => toggleRow(i)}
                                    className={`hover:bg-zinc-800/40 transition-colors cursor-pointer select-none ${isInactive ? 'opacity-60 bg-zinc-950/40' : ''} ${isExpanded ? 'bg-zinc-800/30' : ''}`}
                                >
                                    <td className="py-3.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500 hover:text-zinc-300">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4" />}
                                            </span>
                                            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                                                {quarter === 'nao_mapeado' ? 'NÃO MAP' : quarter.toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 pr-4">
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${isInactive ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                                                {project.name}
                                            </span>
                                            {project.description && (
                                                <span className="text-zinc-500 text-xs mt-0.5 line-clamp-1 truncate block max-w-[280px]" title={project.description}>
                                                    {project.description}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3.5 pr-4 text-zinc-400">{project.orgao || <span className="text-zinc-600">—</span>}</td>
                                    <td className={`py-3.5 pr-2 text-right font-mono font-semibold ${isPerdido ? 'text-red-400/70 line-through' : isHistorico ? 'text-orange-300/70 line-through' : 'text-emerald-400'}`}>
                                        {formatCurrency(project.value)}
                                    </td>
                                    <td className="py-3.5 text-center text-base">
                                        {temp ? (
                                            <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-xs" title={temp.label}>
                                                <span>{temp.emoji}</span>
                                            </span>
                                        ) : (
                                            <span className="text-zinc-700">—</span>
                                        )}
                                    </td>
                                </tr>

                                {/* ── Accordion Expanded Details & Timeline ── */}
                                {isExpanded && (
                                    <tr key={`exp-${i}`} className="bg-zinc-950/80 border-b border-zinc-800/80">
                                        <td colSpan={5} className="p-4 sm:p-5">
                                            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-5">
                                                {/* Header Stats */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-zinc-800 pb-4">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-semibold text-zinc-500">Valor Total Contratado (TCV)</p>
                                                        <p className="text-sm font-bold font-mono text-zinc-100 mt-0.5">{formatCurrency(project.value)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-semibold text-zinc-500">Vigência (Parcelas)</p>
                                                        <p className="text-sm font-bold text-zinc-300 mt-0.5">{duration} meses</p>
                                                        {project.billingStartMonth ? (
                                                            <p className="text-[10px] text-indigo-400 mt-0.5">Início: {['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][project.billingStartMonth]}</p>
                                                        ) : null}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-semibold text-zinc-500">Mensalidade Estimada</p>
                                                        <p className="text-sm font-bold font-mono text-zinc-300 mt-0.5">{formatCurrency(project.value / duration)}/mês</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-1">
                                                            Reconhecido em 2026
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger type="button">
                                                                        <Info className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-[260px] text-zinc-200 leading-relaxed">
                                                                        Parcela financeira que efetivamente impacta a receita de 2026, calculada pro-rata a partir do mês de início do faturamento.
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </p>
                                                        <p className="text-sm font-bold font-mono text-blue-400 mt-0.5">{formatCurrency(val2026)}</p>
                                                    </div>
                                                </div>

                                                {/* Timeline Section */}
                                                <div>
                                                    <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                        <History className="w-3.5 h-3.5 text-indigo-400" />
                                                        Histórico de Alterações & Notas
                                                    </h5>

                                                    {timeline.length === 0 ? (
                                                        <div className="text-xs text-zinc-500 italic py-2">
                                                            Nenhuma alteração ou nota gravada para este projeto.
                                                        </div>
                                                    ) : (
                                                        <div className="relative pl-4 space-y-3 border-l-2 border-indigo-500/30">
                                                            {timeline.map((item, idx) => (
                                                                <div key={idx} className="relative flex flex-col gap-1 text-xs">
                                                                    <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-zinc-900" />
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-semibold text-zinc-300 flex items-center gap-1">
                                                                            {getHistoryIcon(item.tipo)}
                                                                            {item.date}
                                                                        </span>
                                                                        {item.autor && (
                                                                            <span className="text-zinc-500">• por {item.autor}</span>
                                                                        )}
                                                                    </div>
                                                                    {item.de && item.para && (
                                                                        <div className="text-zinc-400 flex items-center gap-1 text-[11px]">
                                                                            <span>De: <strong className="text-zinc-300">{item.de}</strong></span>
                                                                            <span>➔</span>
                                                                            <span>Para: <strong className="text-indigo-300">{item.para}</strong></span>
                                                                        </div>
                                                                    )}
                                                                    {item.justificativa && (
                                                                        <p className="text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800/60 mt-0.5">
                                                                            {item.justificativa}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t border-zinc-700">
                        <td colSpan={3} className="pt-3 text-xs text-zinc-600 uppercase tracking-wider">
                            <div className="flex items-center gap-1">
                                <span>Total Pipeline</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger type="button">
                                            <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-zinc-200 max-w-[280px] leading-relaxed">
                                            Soma em Reais de todas as oportunidades ativas (desconsidera projetos desativados/perdidos/históricos).
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </td>
                        <td className="pt-3 text-right font-mono font-bold text-zinc-100 pr-2">
                            {formatCurrency(
                                rows
                                    .filter(({ project }) => project.temperature !== 'perdido' && project.temperature !== 'historico')
                                    .reduce((acc, { project }) => acc + project.value, 0)
                            )}
                        </td>
                        <td />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
