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
    lightActive?: boolean;
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

export function ProjectsTab({ pipeline, lightActive = false }: ProjectsTabProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const T = {
        headBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        headText: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        rowDivide: lightActive ? 'divide-zinc-200' : 'divide-zinc-800/50',
        rowHover: lightActive ? 'hover:bg-zinc-50' : 'hover:bg-zinc-800/40',
        rowInactive: lightActive ? 'bg-zinc-50' : 'bg-zinc-950/40',
        rowExpandedBg: lightActive ? 'bg-zinc-50' : 'bg-zinc-800/30',
        chevronMuted: lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300',
        quarterBadge: lightActive ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        projectName: lightActive ? 'text-zinc-800' : 'text-zinc-200',
        projectNameInactive: lightActive ? 'text-zinc-400' : 'text-zinc-400',
        projectDesc: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        orgao: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        orgaoEmpty: lightActive ? 'text-zinc-300' : 'text-zinc-600',
        tempBadge: lightActive ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800',
        tempEmpty: lightActive ? 'text-zinc-300' : 'text-zinc-700',
        expRowBg: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/80 border-zinc-800/80',
        expPanel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/80',
        statLabel: lightActive ? 'text-zinc-500' : 'text-zinc-500',
        statValue: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        statValueMuted: lightActive ? 'text-zinc-600' : 'text-zinc-300',
        timelineHeading: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        timelineEmpty: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        timelineBorder: lightActive ? 'border-indigo-300' : 'border-indigo-500/30',
        timelineDot: lightActive ? 'border-white' : 'border-zinc-900',
        timelineDate: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        timelineAutor: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        timelineDe: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        timelineDeStrong: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        timelineNote: lightActive ? 'text-zinc-700 bg-zinc-50 border-zinc-200' : 'text-zinc-300 bg-zinc-950 border-zinc-800/60',
        tooltipCls: lightActive ? 'text-zinc-700 bg-white border border-zinc-200' : 'text-zinc-200',
        footerBorder: lightActive ? 'border-zinc-200' : 'border-zinc-700',
        footerLabel: lightActive ? 'text-zinc-400' : 'text-zinc-600',
        footerValue: lightActive ? 'text-zinc-900' : 'text-zinc-100',
    };

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
            <div className={`flex items-center justify-center py-20 ${lightActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
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
                    <tr className={`border-b text-left ${T.headBorder}`}>
                        <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider w-36 ${T.headText}`}>Quarter</th>
                        <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider ${T.headText}`}>Projeto</th>
                        <th className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-wider ${T.headText}`}>Órgão / Cliente</th>
                        <th className={`pb-3 pr-2 text-xs font-semibold uppercase tracking-wider text-right ${T.headText}`}>Valor Total</th>
                        <th className={`pb-3 text-xs font-semibold uppercase tracking-wider text-center w-24 ${T.headText}`}>Temp.</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${T.rowDivide}`}>
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
                                    className={`transition-colors cursor-pointer select-none ${T.rowHover} ${isInactive ? `opacity-60 ${T.rowInactive}` : ''} ${isExpanded ? T.rowExpandedBg : ''}`}
                                >
                                    <td className="py-3.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className={T.chevronMuted}>
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4" />}
                                            </span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${T.quarterBadge}`}>
                                                {quarter === 'nao_mapeado' ? 'NÃO MAP' : quarter.toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 pr-4">
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${isInactive ? `${T.projectNameInactive} line-through` : T.projectName}`}>
                                                {project.name}
                                            </span>
                                            {project.description && (
                                                <span className={`text-xs mt-0.5 line-clamp-1 truncate block max-w-[280px] ${T.projectDesc}`} title={project.description}>
                                                    {project.description}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`py-3.5 pr-4 ${T.orgao}`}>{project.orgao || <span className={T.orgaoEmpty}>—</span>}</td>
                                    <td className={`py-3.5 pr-2 text-right font-mono font-semibold ${isPerdido ? 'text-red-400/70 line-through' : isHistorico ? 'text-orange-300/70 line-through' : lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                        {formatCurrency(project.value)}
                                    </td>
                                    <td className="py-3.5 text-center text-base">
                                        {temp ? (
                                            <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-xs ${T.tempBadge}`} title={temp.label}>
                                                <span>{temp.emoji}</span>
                                            </span>
                                        ) : (
                                            <span className={T.tempEmpty}>—</span>
                                        )}
                                    </td>
                                </tr>

                                {/* ── Accordion Expanded Details & Timeline ── */}
                                {isExpanded && (
                                    <tr key={`exp-${i}`} className={`border-b ${T.expRowBg}`}>
                                        <td colSpan={5} className="p-4 sm:p-5">
                                            <div className={`border rounded-xl p-4 sm:p-5 flex flex-col gap-5 transition-colors duration-200 ${T.expPanel}`}>
                                                {/* Header Stats */}
                                                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 border-b pb-4 ${T.headBorder}`}>
                                                    <div>
                                                        <p className={`text-[10px] uppercase font-semibold ${T.statLabel}`}>Valor Total Contratado (TCV)</p>
                                                        <p className={`text-sm font-bold font-mono mt-0.5 ${T.statValue}`}>{formatCurrency(project.value)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] uppercase font-semibold ${T.statLabel}`}>Vigência (Parcelas)</p>
                                                        <p className={`text-sm font-bold mt-0.5 ${T.statValueMuted}`}>{duration} meses</p>
                                                        {project.billingStartMonth ? (
                                                            <p className={`text-[10px] mt-0.5 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>Início: {['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][project.billingStartMonth]}</p>
                                                        ) : null}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] uppercase font-semibold ${T.statLabel}`}>Mensalidade Estimada</p>
                                                        <p className={`text-sm font-bold font-mono mt-0.5 ${T.statValueMuted}`}>{formatCurrency(project.value / duration)}/mês</p>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[10px] uppercase font-semibold flex items-center gap-1 ${T.statLabel}`}>
                                                            Reconhecido em 2026
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger type="button">
                                                                        <Info className={`w-3 h-3 ${lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`} />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className={`max-w-[260px] leading-relaxed ${T.tooltipCls}`}>
                                                                        Parcela financeira que efetivamente impacta a receita de 2026, calculada pro-rata a partir do mês de início do faturamento.
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </p>
                                                        <p className={`text-sm font-bold font-mono mt-0.5 ${lightActive ? 'text-blue-600' : 'text-blue-400'}`}>{formatCurrency(val2026)}</p>
                                                    </div>
                                                </div>

                                                {/* Timeline Section */}
                                                <div>
                                                    <h5 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${T.timelineHeading}`}>
                                                        <History className={`w-3.5 h-3.5 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                                        Histórico de Alterações & Notas
                                                    </h5>

                                                    {timeline.length === 0 ? (
                                                        <div className={`text-xs italic py-2 ${T.timelineEmpty}`}>
                                                            Nenhuma alteração ou nota gravada para este projeto.
                                                        </div>
                                                    ) : (
                                                        <div className={`relative pl-4 space-y-3 border-l-2 ${T.timelineBorder}`}>
                                                            {timeline.map((item, idx) => (
                                                                <div key={idx} className="relative flex flex-col gap-1 text-xs">
                                                                    <div className={`absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border ${T.timelineDot}`} />
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={`font-semibold flex items-center gap-1 ${T.timelineDate}`}>
                                                                            {getHistoryIcon(item.tipo)}
                                                                            {item.date}
                                                                        </span>
                                                                        {item.autor && (
                                                                            <span className={T.timelineAutor}>• por {item.autor}</span>
                                                                        )}
                                                                    </div>
                                                                    {item.de && item.para && (
                                                                        <div className={`flex items-center gap-1 text-[11px] ${T.timelineDe}`}>
                                                                            <span>De: <strong className={T.timelineDeStrong}>{item.de}</strong></span>
                                                                            <span>➔</span>
                                                                            <span>Para: <strong className={lightActive ? 'text-indigo-600' : 'text-indigo-300'}>{item.para}</strong></span>
                                                                        </div>
                                                                    )}
                                                                    {item.justificativa && (
                                                                        <p className={`p-2 rounded border mt-0.5 ${T.timelineNote}`}>
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
                    <tr className={`border-t ${T.footerBorder}`}>
                        <td colSpan={3} className={`pt-3 text-xs uppercase tracking-wider ${T.footerLabel}`}>
                            <div className="flex items-center gap-1">
                                <span>Total Pipeline</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger type="button">
                                            <Info className={`w-3.5 h-3.5 ${lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`} />
                                        </TooltipTrigger>
                                        <TooltipContent className={`max-w-[280px] leading-relaxed ${T.tooltipCls}`}>
                                            Soma em Reais de todas as oportunidades ativas (desconsidera projetos desativados/perdidos/históricos).
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </td>
                        <td className={`pt-3 text-right font-mono font-bold pr-2 ${T.footerValue}`}>
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
