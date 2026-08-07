'use client';

import { useState } from 'react';
import { Manager, Project } from '@/types/manager';
import { formatCurrency, formatPercentage } from '@/lib/format';
import {
    calculateGap,
    calculateAchievementPercentage,
    sumQuarterProjects,
    getStatusColor,
    determinePerformanceStatus,
    calcForecastProRata2026,
} from '@/lib/calc';
import { Building2, Flame, Snowflake, Circle, Info, X, Thermometer, Calendar } from 'lucide-react';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface DRMOverviewProps {
    managers: Manager[];
    year: string;
}

type Temp = 'quente' | 'morno' | 'frio' | 'contratado' | 'historico' | 'perdido';
type QKey = 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';

interface ProjectWithMeta extends Project {
    managerName: string;
    managerRole: string;
}

interface ModalState {
    open: boolean;
    title: string;
    subtitle: string;
    projects: ProjectWithMeta[];
    total: number;
    accentColor: string;
}

const CLOSED_MODAL: ModalState = { open: false, title: '', subtitle: '', projects: [], total: 0, accentColor: 'text-indigo-400' };

function InfoTip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="cursor-help text-zinc-600 hover:text-zinc-400 transition-colors ml-1.5 inline-flex items-center">
                    <Info className="w-3.5 h-3.5" />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs leading-relaxed bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl" side="top" sideOffset={6}>
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

function KpiCard({ label, value, sub, accent, tip }: {
    label: string; value: string; sub?: string; accent?: string; tip?: string;
}) {
    return (
        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl px-5 py-4 min-w-0">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center">
                {label}
                {tip && <InfoTip text={tip} />}
            </p>
            <p className={`text-xl sm:text-2xl font-bold font-mono truncate ${accent ?? 'text-zinc-100'}`}>{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
    );
}

const TEMP_META: Record<Temp, { label: string; emoji: string; accent: string; bar: string }> = {
    quente:    { label: 'Quente',     emoji: '🔥', accent: 'text-orange-400', bar: 'bg-orange-500' },
    morno:     { label: 'Morno',      emoji: '🟡', accent: 'text-yellow-400', bar: 'bg-yellow-500' },
    frio:      { label: 'Frio',       emoji: '❄️', accent: 'text-blue-400',  bar: 'bg-blue-500'   },
    contratado:{ label: 'Contratado', emoji: '✅', accent: 'text-emerald-400', bar: 'bg-emerald-500' },
    historico: { label: 'Histórico',  emoji: '📁', accent: 'text-zinc-500',   bar: 'bg-zinc-600'   },
    perdido:   { label: 'Perdido',    emoji: '❌', accent: 'text-red-400',    bar: 'bg-red-600'    },
};

export function DRMOverview({ managers, year }: DRMOverviewProps) {
    const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);

    // ── Metric Filters State ──────────────────────────────────────────────────
    const [activeMetrics, setActiveMetrics] = useState<{
        herdados: boolean;
        novos: boolean;
        pipeline: boolean;
    }>({
        herdados: false,
        novos: true,
        pipeline: false,
    });

    const toggleMetric = (key: 'herdados' | 'novos' | 'pipeline') => {
        setActiveMetrics((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            if (!next.herdados && !next.novos && !next.pipeline) {
                return prev; // keep at least 1 active
            }
            return next;
        });
    };

    if (!managers || managers.length === 0) return null;

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalMeta = managers.reduce((acc, m) => acc + m.meta, 0);
    const totalHerdados = managers.reduce((acc, m) => acc + (m.contratosHerdados ?? m.contratado), 0);
    const totalNovosNegocios = managers.reduce((acc, m) => acc + (m.novosNegocios ?? 0), 0);
    const totalContratado2026 = managers.reduce((acc, m) => acc + (m.contratado2026 ?? m.contratado), 0);
    const totalForecast = managers.reduce((acc, m) => acc + m.forecastFinal, 0);
    const totalForecastProRata2026 = managers.reduce((acc, m) => acc + (m.forecastProRata2026 ?? calcForecastProRata2026(m.contratado, m.pipeline)), 0);
    const totalPipelineAberto = managers.reduce((acc, m) => acc + Math.max(0, m.forecastFinal - (m.contratado2026 ?? m.contratado)), 0);
    const totalGap = calculateGap(totalMeta, totalNovosNegocios);
    const achievementPct = calculateAchievementPercentage(totalNovosNegocios, totalMeta);
    const overallStatus = determinePerformanceStatus(achievementPct);

    // Total DRM of selected metrics
    const totalSelectedDrm =
        (activeMetrics.herdados ? totalHerdados : 0) +
        (activeMetrics.novos ? totalNovosNegocios : 0) +
        (activeMetrics.pipeline ? totalPipelineAberto : 0);

    // ── Pipeline by quarter ──────────────────────────────────────────────────
    const qTotals = (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).map((q) => ({
        key: q,
        label: q === 'nao_mapeado' ? 'N/M' : q.toUpperCase(),
        total: managers.reduce((acc, m) => acc + sumQuarterProjects(
            (m.pipeline[q]?.projects || []).filter(p => p.temperature !== 'historico' && p.temperature !== 'perdido')
        ), 0),
    }));
    const maxQTotal = Math.max(...qTotals.map((q) => q.total), 1);

    // ── Stacked Bar Calculation ─────────────────────────────────────────────
    const rankedStacked = [...managers]
        .map((m) => {
            const herdados = m.contratosHerdados ?? m.contratado;
            const novos = m.novosNegocios ?? 0;
            const effContratado = m.contratado2026 ?? m.contratado;
            const pipelineVal = Math.max(0, m.forecastFinal - effContratado);

            const totalSelected =
                (activeMetrics.herdados ? herdados : 0) +
                (activeMetrics.novos ? novos : 0) +
                (activeMetrics.pipeline ? pipelineVal : 0);

            return {
                ...m,
                herdados,
                novos,
                pipelineVal,
                effContratado,
                totalSelected,
            };
        })
        .sort((a, b) => b.totalSelected - a.totalSelected);

    const maxSelectedVal = Math.max(...rankedStacked.map((m) => m.totalSelected), 1);

    // ── Modal Openers ─────────────────────────────────────────────────────────
    function openQuarterModal(qKey: QKey, label: string, total: number) {
        const projects: ProjectWithMeta[] = [];
        managers.forEach((m) => {
            m.pipeline[qKey].projects.forEach((p) => {
                projects.push({ ...p, managerName: m.name, managerRole: m.role });
            });
        });
        projects.sort((a, b) => b.value - a.value);
        const activeCount = projects.filter(p => p.temperature !== 'historico' && p.temperature !== 'perdido').length;
        setModal({
            open: true,
            title: `Pipeline ${label}`,
            subtitle: `${activeCount} oportunidades · Total ${formatCurrency(total)}`,
            projects,
            total,
            accentColor: 'text-indigo-400',
        });
    }

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-6 h-full">

                {/* ── Header ──────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-8 h-8 text-zinc-400" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-2xl sm:text-3xl font-bold text-zinc-100">DRM — Visão Geral</h3>
                        <p className="text-sm font-medium text-zinc-400">Diretoria de Relacionamento e Mercado · {year}</p>
                    </div>
                </div>

                {/* ── KPI Row (3 Cards) ───────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard label="Contratos Herdados" value={formatCurrency(totalHerdados)} accent="text-zinc-300" tip="Base de contratos legados existentes sob responsabilidade dos gerentes trazida de anos anteriores." />
                    <KpiCard label="Negócios Concluídos" value={formatCurrency(totalNovosNegocios)} accent="text-emerald-400" tip="Receita reconhecida em 2026 dos novos contratos fechados no pipeline (Status = Contratado), calculada pro-rata conforme o mês de início de faturamento e duração de cada contrato." />
                    <KpiCard label="Contratado 2026" value={formatCurrency(totalContratado2026)} accent="text-blue-400" tip="Receita efetiva reconhecida em 2026 = Contratos Herdados + parcela pro-rata de 2026 dos novos negócios." />
                    <KpiCard
                        label="Forecast Pro-rata 2026"
                        value={formatCurrency(totalForecastProRata2026)}
                        accent="text-violet-400"
                        tip="Projeção de receita reconhecida em 2026 considerando todo o pipeline com pro-rata: Contratado 2026 + parcela 2026 dos projetos em andamento (Quente, Morno, Frio)."
                    />
                </div>

                {/* ── Middle: Composição por Gerência (Stacked Bar Chart) ── */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col backdrop-blur-md">
                    <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-4 flex-wrap gap-3">
                        <div>
                            <h4 className="text-base font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                Composição por Gerência
                                <InfoTip text="Selecione as grandezas desejadas nos botões ao lado para comparar a composição de Contratos Herdados, Negócios Concluídos e Pipeline em Aberto por cada gerente." />
                            </h4>
                            <p className="text-xs text-zinc-500 mt-0.5">Clique nas métricas abaixo para ativar/desativar o empilhamento das barras</p>
                        </div>

                        {/* Metric Toggles (Checkboxes) */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => toggleMetric('herdados')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer select-none ${
                                    activeMetrics.herdados
                                        ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm'
                                        : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${activeMetrics.herdados ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
                                Contratos Herdados
                            </button>

                            <button
                                type="button"
                                onClick={() => toggleMetric('novos')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer select-none ${
                                    activeMetrics.novos
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm'
                                        : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${activeMetrics.novos ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                                Negócios Concluídos
                            </button>

                            <button
                                type="button"
                                onClick={() => toggleMetric('pipeline')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer select-none ${
                                    activeMetrics.pipeline
                                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm'
                                        : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${activeMetrics.pipeline ? 'bg-indigo-500' : 'bg-zinc-700'}`} />
                                Pipeline em Aberto
                            </button>
                        </div>
                    </div>

                    {/* Stacked Bars List */}
                    <div className="flex flex-col gap-4 flex-1 mt-1">
                        {rankedStacked.map((m, idx) => {
                            const pctOfTotal = totalSelectedDrm > 0 ? (m.totalSelected / totalSelectedDrm) * 100 : 0;
                            const overallBarPct = maxSelectedVal > 0 ? (m.totalSelected / maxSelectedVal) * 100 : 0;

                            // Component percentages within m.totalSelected
                            const herdadosPct = m.totalSelected > 0 && activeMetrics.herdados ? (m.herdados / m.totalSelected) * 100 : 0;
                            const novosPct = m.totalSelected > 0 && activeMetrics.novos ? (m.novos / m.totalSelected) * 100 : 0;
                            const pipelinePct = m.totalSelected > 0 && activeMetrics.pipeline ? (m.pipelineVal / m.totalSelected) * 100 : 0;

                            return (
                                <Tooltip key={m.id}>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-3 cursor-help group">
                                            <span className="text-xs font-bold text-zinc-500 w-5 text-right shrink-0">{idx + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">{m.name}</span>
                                                        <span className="text-xs text-zinc-500">({m.role})</span>
                                                        {activeMetrics.novos && m.novos > 0 && (
                                                            <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                Concluídos: {formatCurrency(m.novos)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-bold text-zinc-400 font-mono">{formatPercentage(pctOfTotal)} do total</span>
                                                        <span className="text-sm font-bold font-mono text-zinc-100">{formatCurrency(m.totalSelected)}</span>
                                                    </div>
                                                </div>

                                                {/* Stacked Bar Container */}
                                                <div className="w-full h-3.5 bg-zinc-800/80 rounded-full overflow-hidden p-0.5 border border-zinc-800 flex">
                                                    <div className="w-full h-full flex rounded-full overflow-hidden transition-all duration-500">
                                                        {activeMetrics.herdados && m.herdados > 0 && (
                                                            <div
                                                                className="h-full bg-zinc-400 hover:bg-zinc-300 transition-colors shrink-0"
                                                                style={{ width: `${herdadosPct}%`, minWidth: '8px' }}
                                                                title={`Herdados: ${formatCurrency(m.herdados)}`}
                                                            />
                                                        )}
                                                        {activeMetrics.novos && m.novos > 0 && (
                                                            <div
                                                                className="h-full bg-emerald-400 hover:bg-emerald-300 transition-colors shrink-0 shadow-[0_0_16px_rgba(52,211,153,1)] z-10 border-x-2 border-white/80"
                                                                style={{ width: `${novosPct}%`, minWidth: '40px' }}
                                                                title={`Negócios Concluídos: ${formatCurrency(m.novos)}`}
                                                            />
                                                        )}
                                                        {activeMetrics.pipeline && m.pipelineVal > 0 && (
                                                            <div
                                                                className="h-full bg-indigo-500 hover:bg-indigo-400 transition-colors shrink-0"
                                                                style={{ width: `${pipelinePct}%`, minWidth: '8px' }}
                                                                title={`Pipeline: ${formatCurrency(m.pipelineVal)}`}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs bg-zinc-950 text-zinc-200 border border-zinc-700/80 leading-relaxed p-3 shadow-2xl" sideOffset={8}>
                                        <p className="font-bold text-zinc-100 text-sm mb-1">{m.name}</p>
                                        <p className="text-zinc-500 mb-2">{m.role}</p>
                                        <div className="space-y-1 text-xs">
                                            {activeMetrics.herdados && (
                                                <div className="flex justify-between gap-4"><span>Contratos Herdados:</span> <span className="font-mono text-zinc-300">{formatCurrency(m.herdados)}</span></div>
                                            )}
                                            {activeMetrics.novos && (
                                                <div className="flex justify-between gap-4"><span>Negócios Concluídos (TCV):</span> <strong className="font-mono text-emerald-400">{formatCurrency(m.novos)}</strong></div>
                                            )}
                                            {activeMetrics.pipeline && (
                                                <div className="flex justify-between gap-4"><span>Pipeline em Aberto:</span> <span className="font-mono text-indigo-400">{formatCurrency(m.pipelineVal)}</span></div>
                                            )}
                                            <div className="flex justify-between gap-4 pt-1 font-bold border-t border-zinc-800"><span>Total Selecionado:</span> <span className="font-mono text-zinc-100">{formatCurrency(m.totalSelected)}</span></div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>

                {/* ── Bottom: Pipeline por Trimestre ───────────── */}
                <div className="w-full">
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1">Pipeline por Trimestre (todos os gerentes)</h4>
                        <p className="text-xs text-zinc-600 mb-4 flex items-center gap-1"><Calendar className="w-3 h-3" /> Clique em uma barra para ver os projetos do período</p>
                        <div className="flex flex-col gap-3">
                            {qTotals.map((q) => (
                                <div key={q.label} className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-zinc-500 w-8 shrink-0">{q.label}</span>
                                    <div className="flex-1 h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => openQuarterModal(q.key, q.label, q.total)}
                                            className="h-full bg-indigo-600/80 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-all flex items-center px-3 cursor-pointer group"
                                            style={{ width: `${(q.total / maxQTotal) * 100}%`, minWidth: '64px' }}
                                        >
                                            <span className="text-xs font-bold text-white/90 whitespace-nowrap group-hover:text-white">
                                                {formatCurrency(q.total)}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Drill-down Modal ─────────────────────────── */}
            <Dialog open={modal.open} onOpenChange={(v) => !v && setModal(CLOSED_MODAL)}>
                <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 shrink-0">
                        <DialogTitle className="text-xl font-bold">{modal.title}</DialogTitle>
                        <p className="text-sm text-zinc-400 mt-0.5">{modal.subtitle}</p>
                    </DialogHeader>

                    {/* Project list */}
                    <div className="overflow-y-auto flex-1 px-4 py-3">
                        {modal.projects.length === 0 ? (
                            <p className="text-center text-zinc-500 py-12">Nenhuma oportunidade encontrada.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {modal.projects.map((p, i) => {
                                    const tempMeta = TEMP_META[(p.temperature as Temp) ?? 'morno'] ?? TEMP_META['morno'];
                                    return (
                                        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                                            <span className="text-lg shrink-0">{tempMeta.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-100 truncate">{p.name}</p>
                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                    {p.orgao ? <span className="text-zinc-400">{p.orgao} · </span> : null}
                                                    {p.managerName} <span className="text-zinc-700">({p.managerRole})</span>
                                                </p>
                                            </div>
                                            <p className={`text-sm font-bold font-mono shrink-0 ${modal.accentColor}`}>
                                                {formatCurrency(p.value)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer total */}
                    <div className="px-6 py-4 border-t border-zinc-800 shrink-0 flex justify-between items-center">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Total</span>
                        <span className={`text-lg font-bold font-mono ${modal.accentColor}`}>{formatCurrency(modal.total)}</span>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
