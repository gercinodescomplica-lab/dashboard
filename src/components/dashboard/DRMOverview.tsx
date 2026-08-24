'use client';

import { useState } from 'react';
import { Manager, Project } from '@/types/manager';
import { formatCurrency, formatPercentage } from '@/lib/format';
import {
    calculateGap,
    calculateAchievementPercentage,
    sumQuarterProjects,
    sumNovosNegocios,
    getStatusColor,
    determinePerformanceStatus,
    calcForecastProRata2026,
} from '@/lib/calc';
import { Building2, Info, Calendar, Layers, ArrowUp, BarChart3, ChevronRight, FileCheck } from 'lucide-react';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface DRMOverviewProps {
    managers: Manager[];
    year: string;
    faturamento2025?: number;
    /** Tema claro do painel (clone dos prints, mesmo layout de hoje). Padrão false = escuro, estado atual intocado. */
    lightActive?: boolean;
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

const Q_DESCRIPTIONS: Record<QKey, { name: string; period: string }> = {
    q1: { name: '1º Trimestre', period: 'Jan – Mar' },
    q2: { name: '2º Trimestre', period: 'Abr – Jun' },
    q3: { name: '3º Trimestre', period: 'Jul – Set' },
    q4: { name: '4º Trimestre', period: 'Out – Dez' },
    nao_mapeado: { name: 'Sem Data', period: 'Não Mapeado' },
};

function InfoTip({ text, lightActive }: { text: string; lightActive?: boolean }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`cursor-help transition-colors ml-1 inline-flex items-center ${lightActive ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <Info className="w-3.5 h-3.5" />
                </span>
            </TooltipTrigger>
            <TooltipContent className={`max-w-[260px] text-xs leading-relaxed shadow-xl border ${lightActive ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-zinc-900 text-zinc-200 border-zinc-700'}`} side="top" sideOffset={4}>
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

function KpiCardSide({ label, value, accent, accentLight, tip, lightActive }: {
    label: string; value: string; accent?: string; accentLight?: string; tip?: string; lightActive?: boolean;
}) {
    const resolvedAccent = lightActive ? (accentLight ?? accent ?? 'text-zinc-900') : (accent ?? 'text-zinc-100');
    return (
        <div className={`flex flex-col gap-0.5 rounded-xl px-4 py-2 min-w-0 transition-colors border ${lightActive ? 'bg-zinc-50 border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80'}`}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                <span>{label}</span>
                {tip && <InfoTip text={tip} lightActive={lightActive} />}
            </p>
            <p className={`text-base sm:text-lg font-bold font-mono truncate ${resolvedAccent}`}>{value}</p>
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

export function DRMOverview({ managers, year, faturamento2025 = 630386397.11, lightActive = false }: DRMOverviewProps) {
    const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);

    // Tokens de cor do tema claro (clone dos prints). Escuro nunca muda — é só o valor literal de sempre.
    const T = {
        panel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/80',
        panelBorderSoft: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        heading: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        subtext: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        toggleActiveNeutral: lightActive ? 'bg-zinc-200 text-zinc-900 border-zinc-300 shadow-sm' : 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm',
        toggleInactive: lightActive ? 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:border-zinc-300 opacity-60' : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60',
        toggleDotInactive: lightActive ? 'bg-zinc-300' : 'bg-zinc-700',
        toggleActiveNovos: lightActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm',
        toggleActivePipeline: lightActive ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm',
        tierBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800/80',
        tierTop: lightActive ? 'bg-white border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.15)] z-10' : 'bg-zinc-900 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.2)] z-10',
        tierNormal: lightActive ? 'bg-zinc-50 hover:bg-white' : 'bg-zinc-900/80 hover:bg-zinc-900',
        rankBadgeNormal: lightActive ? 'bg-zinc-100 text-zinc-700 border-zinc-300' : 'bg-zinc-800/90 text-zinc-200 border-zinc-700',
        managerName: lightActive ? 'text-zinc-900 group-hover:text-black' : 'text-zinc-100 group-hover:text-white',
        managerRole: lightActive ? 'text-zinc-500/90' : 'text-zinc-300/80',
        tierValue: lightActive ? 'text-zinc-900' : 'text-zinc-50',
        baseIndicator: lightActive ? 'text-emerald-600' : 'text-emerald-400',
        kpiHeading: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        pipelineBadge: lightActive ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
        qCard: lightActive ? 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-indigo-300' : 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800 hover:border-indigo-500/60',
        qLabel: lightActive ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        qPeriod: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        qName: lightActive ? 'text-zinc-600 group-hover:text-zinc-900' : 'text-zinc-300 group-hover:text-white',
        qValue: lightActive ? 'text-zinc-900 group-hover:text-indigo-600' : 'text-zinc-100 group-hover:text-indigo-300',
        qTrack: lightActive ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-950 border-zinc-800',
        qFooter: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        qFooterAccent: lightActive ? 'text-indigo-700' : 'text-indigo-400',
        modalBg: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        modalDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        modalItem: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800',
        modalItemTitle: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        modalItemSub: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        modalItemOrg: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        modalItemRole: lightActive ? 'text-zinc-400' : 'text-zinc-700',
        modalAccent: lightActive ? 'text-indigo-700' : 'text-indigo-400',
        tooltipBg: lightActive ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-zinc-950 text-zinc-200 border-zinc-700/80',
        tooltipTitle: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        tooltipMuted: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        tooltipDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800',
    };

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

    const activeManagers = (managers || []).filter(m => m.id !== 'projeto-triade' && m.name !== 'Tríade Digital');
    if (!activeManagers || activeManagers.length === 0) return null;

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalHerdados = activeManagers.reduce((acc, m) => acc + (m.contratosHerdados ?? m.contratado), 0);
    const totalNovosNegociosProRata = activeManagers.reduce((acc, m) => acc + (m.novosNegocios ?? 0), 0);
    const totalNovosNegociosTCV = activeManagers.reduce((acc, m) => acc + sumNovosNegocios(m.pipeline), 0);
    const totalContratado2026 = activeManagers.reduce((acc, m) => acc + (m.contratado2026 ?? m.contratado), 0);
    const totalForecastProRata2026 = activeManagers.reduce((acc, m) => acc + (m.forecastProRata2026 ?? calcForecastProRata2026(m.contratado, m.pipeline)), 0);

    // ── Pipeline by quarter ──────────────────────────────────────────────────
    const qTotals = (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).map((q) => {
        const projects = activeManagers.flatMap(m => (m.pipeline[q]?.projects || []))
            .filter(p => p.temperature !== 'historico' && p.temperature !== 'perdido');
        const total = projects.reduce((sum, p) => sum + (p.value || 0), 0);
        return {
            key: q,
            label: q === 'nao_mapeado' ? 'N/M' : q.toUpperCase(),
            name: Q_DESCRIPTIONS[q].name,
            period: Q_DESCRIPTIONS[q].period,
            total,
            count: projects.length,
        };
    });

    const sumAllPipelineQuarters = qTotals.reduce((acc, q) => acc + q.total, 0);
    const maxQTotal = Math.max(...qTotals.map((q) => q.total), 1);

    // ── Manager Metrics Prep ─────────────────────────────────────────────────
    const processedManagers = [...activeManagers].map((m) => {
        const herdados = m.contratosHerdados ?? m.contratado;
        const novos = m.novosNegocios ?? 0;
        const effContratado = m.contratado2026 ?? m.contratado;
        const pipelineVal = Math.max(0, m.forecastFinal - effContratado);
        const achievementPct = calculateAchievementPercentage(novos, m.meta);
        const perfStatus = determinePerformanceStatus(achievementPct);
        const statusColor = getStatusColor(perfStatus);

        // Dynamically compute selected metrics total for each manager
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
            achievementPct,
            perfStatus,
            statusColor,
            totalSelected,
        };
    });

    // ── Dynamic Pyramid Sorting & Base ───────────────────────────────────────
    // Sort managers descending by totalSelected (highest totalSelected = Rank #1)
    const rankedManagers = [...processedManagers].sort((a, b) => b.totalSelected - a.totalSelected);
    const managersWithRank = rankedManagers.map((m, i) => ({ ...m, rank: i + 1 }));

    // Pyramid structure: Top of pyramid (lowest totalSelected) at index 0 -> Base of pyramid (highest totalSelected) at bottom row!
    const pyramidRows = [...managersWithRank].sort((a, b) => a.totalSelected - b.totalSelected);
    const totalCount = pyramidRows.length;

    // Active metric label for subtitle & base indicator
    const activeMetricLabel = (() => {
        const parts = [];
        if (activeMetrics.novos) parts.push('Novos Negócios');
        if (activeMetrics.pipeline) parts.push('Pipeline');
        if (activeMetrics.herdados) parts.push('Herdados');
        return parts.join(' + ') || 'Valor Selecionado';
    })();

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
            <div className="flex flex-col gap-3.5 h-full overflow-y-auto">

                {/* ── Main Split View (Left: Dynamic Seamless Pyramid, Right: Consolidated Data & Pipeline) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 w-full">

                    {/* ── LEFT COLUMN (7 Cols): Pirâmide Dinâmica Ajustável ── */}
                    <div className={`lg:col-span-7 border rounded-2xl p-4 flex flex-col backdrop-blur-md justify-between overflow-hidden transition-colors duration-200 ${T.panel}`}>
                        <div className={`flex items-center justify-between mb-2.5 border-b pb-2.5 flex-wrap gap-2 shrink-0 ${T.panelBorderSoft}`}>
                            <div>
                                <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 ${T.heading}`}>
                                    <Layers className="w-4 h-4 text-emerald-400" />
                                    Pirâmide Comercial Dinâmica
                                    <InfoTip lightActive={lightActive} text="A base da pirâmide recalcula dinamicamente conforme os filtros selecionados à direita. Quem possui o maior valor selecionado fica na base da pirâmide." />
                                </h4>
                                <p className={`text-[11px] mt-0.5 ${T.subtext}`}>
                                    Base da pirâmide ordenada por: <strong className={T.baseIndicator}>{activeMetricLabel}</strong>
                                </p>
                            </div>

                            {/* Metric Toggles (Herdados, Concluídos and Pipeline) */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => toggleMetric('herdados')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.herdados ? T.toggleActiveNeutral : T.toggleInactive
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.herdados ? (lightActive ? 'bg-zinc-500' : 'bg-zinc-300') : T.toggleDotInactive}`} />
                                    Herdados
                                </button>

                                <button
                                    type="button"
                                    onClick={() => toggleMetric('novos')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.novos ? T.toggleActiveNovos : T.toggleInactive
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.novos ? 'bg-emerald-500' : T.toggleDotInactive}`} />
                                    Concluídos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => toggleMetric('pipeline')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.pipeline ? T.toggleActivePipeline : T.toggleInactive
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.pipeline ? 'bg-indigo-500' : T.toggleDotInactive}`} />
                                    Pipeline
                                </button>
                            </div>
                        </div>

                        {/* Seamless Connected Pyramid Tiers (No vertical gap/margins) */}
                        <div className="w-full flex flex-col items-center space-y-0.5 py-1 overflow-y-auto flex-1 justify-center">
                            {pyramidRows.map((m, idx) => {
                                const isBase = idx === totalCount - 1; // Base of pyramid (highest value)
                                const isTopRank = m.rank === 1; // Highest selected value overall (#1)

                                // Calculate width percentage tapering from top tier (42%) to base tier (100%)
                                const minWidthPct = 42;
                                const widthPct = Math.round(minWidthPct + ((idx / Math.max(1, totalCount - 1)) * (100 - minWidthPct)));

                                // Segment percentages within totalSelected
                                const herdadosPct = m.totalSelected > 0 && activeMetrics.herdados ? (m.herdados / m.totalSelected) * 100 : 0;
                                const novosPct = m.totalSelected > 0 && activeMetrics.novos ? (m.novos / m.totalSelected) * 100 : 0;
                                const pipelinePct = m.totalSelected > 0 && activeMetrics.pipeline ? (m.pipelineVal / m.totalSelected) * 100 : 0;

                                return (
                                    <Tooltip key={m.id}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="transition-all duration-300 flex items-center justify-center cursor-help group py-0 my-0"
                                                style={{ width: `${widthPct}%` }}
                                            >
                                                {/* Seamless tier bar without extra padding */}
                                                <div className={`w-full h-8 relative flex items-center justify-between px-3 transition-all duration-200 border-x border-t overflow-hidden ${T.tierBorder} ${
                                                    idx === 0 ? 'rounded-t-xl border-t' : ''
                                                } ${
                                                    isBase ? 'rounded-b-xl border-b shadow-lg' : ''
                                                } ${
                                                    isTopRank ? T.tierTop : T.tierNormal
                                                }`}>
                                                    
                                                    {/* Color fill layer across the tier band */}
                                                    <div className="absolute inset-0 flex opacity-85 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        {activeMetrics.herdados && m.herdados > 0 && (
                                                            <div
                                                                className="h-full bg-zinc-600/60 group-hover:bg-zinc-500/70 border-r border-zinc-500/30 transition-colors shrink-0"
                                                                style={{ width: `${herdadosPct}%` }}
                                                            />
                                                        )}
                                                        {activeMetrics.novos && m.novos > 0 && (
                                                            <div
                                                                className="h-full bg-emerald-600/75 group-hover:bg-emerald-500/85 border-r border-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-colors shrink-0 z-10"
                                                                style={{ width: `${novosPct}%` }}
                                                            />
                                                        )}
                                                        {activeMetrics.pipeline && m.pipelineVal > 0 && (
                                                            <div
                                                                className="h-full bg-indigo-600/65 group-hover:bg-indigo-500/75 border-r border-indigo-400/30 transition-colors shrink-0"
                                                                style={{ width: `${pipelinePct}%` }}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Tier Content Overlay (No photos, clean text) */}
                                                    <div className="relative z-20 flex items-center justify-between w-full min-w-0">
                                                        {/* Left: Rank Badge & Manager Name */}
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border font-mono shrink-0 ${
                                                                isTopRank ? 'bg-amber-400 text-zinc-950 border-amber-300' : T.rankBadgeNormal
                                                            }`}>
                                                                #{m.rank}
                                                            </span>

                                                            <p className={`font-bold text-xs transition-colors truncate max-w-[150px] drop-shadow-sm ${T.managerName}`}>
                                                                {m.name} <span className={`text-[11px] font-normal ${T.managerRole}`}>({m.role})</span>
                                                            </p>
                                                        </div>

                                                        {/* Right: Selected Total R$ */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={`text-xs font-bold font-mono drop-shadow-sm min-w-[80px] text-right ${T.tierValue}`}>
                                                                {formatCurrency(m.totalSelected)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className={`text-xs border leading-relaxed p-2.5 shadow-2xl ${T.tooltipBg}`} sideOffset={6}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-bold font-mono text-xs ${lightActive ? 'text-amber-600' : 'text-amber-400'}`}>#{m.rank} no Ranking de {activeMetricLabel}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.statusColor}`}>{m.perfStatus}</span>
                                            </div>
                                            <p className={`font-bold text-sm ${T.tooltipTitle}`}>{m.name} ({m.role})</p>
                                            <div className="space-y-1 text-xs mt-1">
                                                <div className="flex justify-between gap-4"><span>Total Selecionado:</span> <strong className={`font-mono ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>{formatCurrency(m.totalSelected)}</strong></div>
                                                {activeMetrics.novos && (
                                                    <div className="flex justify-between gap-4"><span>Novos Concluídos (TCV):</span> <span className={`font-mono ${lightActive ? 'text-emerald-600' : 'text-emerald-300'}`}>{formatCurrency(m.novos)}</span></div>
                                                )}
                                                {activeMetrics.herdados && (
                                                    <div className="flex justify-between gap-4"><span>Contratos Herdados:</span> <span className={`font-mono ${T.tooltipMuted}`}>{formatCurrency(m.herdados)}</span></div>
                                                )}
                                                {activeMetrics.pipeline && (
                                                    <div className="flex justify-between gap-4"><span>Pipeline em Aberto:</span> <span className={`font-mono ${T.qFooterAccent}`}>{formatCurrency(m.pipelineVal)}</span></div>
                                                )}
                                                <div className="flex justify-between gap-4"><span>Meta 2026:</span> <span className={`font-mono ${T.tooltipMuted}`}>{formatCurrency(m.meta)}</span></div>
                                                <div className={`flex justify-between gap-4 pt-1 font-bold border-t ${T.tooltipDivider}`}><span>% Atingimento da Meta:</span> <span className={`font-mono ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>{formatPercentage(m.achievementPct)}</span></div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Base Indicator */}
                        <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider justify-center pt-2 border-t shrink-0 ${T.baseIndicator} ${T.panelBorderSoft}`}>
                            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
                            Base da Pirâmide — Maior Volume: <span className="underline ml-1">{activeMetricLabel}</span>
                            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN (5 Cols): Informações Consolidadas & Pipeline ── */}
                    <div className="lg:col-span-5 flex flex-col gap-3.5">

                        {/* Consolidated KPI Cards Column (6 Cards Total) */}
                        <div className={`border rounded-2xl p-4 flex flex-col gap-2 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${T.kpiHeading}`}>
                                <BarChart3 className="w-4 h-4 text-cyan-400" />
                                Informações Consolidadas
                            </h4>

                            <KpiCardSide
                                lightActive={lightActive}
                                label="1. Faturamento 2025"
                                value={formatCurrency(faturamento2025)}
                                accent="text-cyan-400"
                                accentLight="text-cyan-600"
                                tip="Faturamento total realizado no ano de 2025. Editável nas Configurações."
                            />
                            <KpiCardSide
                                lightActive={lightActive}
                                label="2. Contratos Herdados"
                                value={formatCurrency(totalHerdados)}
                                accent="text-zinc-300"
                                accentLight="text-zinc-700"
                                tip="Base de contratos legados trazida de anos anteriores."
                            />
                            <KpiCardSide
                                lightActive={lightActive}
                                label="3. Novos Negócios Concluídos (Valor Total)"
                                value={formatCurrency(totalNovosNegociosTCV)}
                                accent="text-emerald-400"
                                accentLight="text-emerald-600"
                                tip="Valor total acumulado de novos contratos fechados (TCV total sem pro-rata)."
                            />
                            <KpiCardSide
                                lightActive={lightActive}
                                label="4. Novos Negócios Concluídos (Pro-rata 2026)"
                                value={formatCurrency(totalNovosNegociosProRata)}
                                accent="text-emerald-300"
                                accentLight="text-emerald-500"
                                tip="Receita pro-rata 2026 reconhecida dos novos contratos fechados no pipeline."
                            />
                            <KpiCardSide
                                lightActive={lightActive}
                                label="5. Contratado 2026"
                                value={formatCurrency(totalContratado2026)}
                                accent="text-blue-400"
                                accentLight="text-blue-600"
                                tip="Herdados + parcela pro-rata 2026 dos novos negócios."
                            />
                            <KpiCardSide
                                lightActive={lightActive}
                                label="6. Forecast Pro-rata 2026"
                                value={formatCurrency(totalForecastProRata2026)}
                                accent="text-violet-400"
                                accentLight="text-violet-600"
                                tip="Projeção total de receita reconhecida em 2026 considerando todo o pipeline."
                            />
                        </div>

                    </div>

                </div>

                {/* ── EXPANDED PIPELINE POR TRIMESTRE (Visão Ampla Destaque Executivo) ── */}
                <div className={`border rounded-2xl p-4 sm:p-5 backdrop-blur-md shrink-0 mt-1 transition-colors duration-200 ${T.panel}`}>
                    <div className={`flex items-center justify-between mb-3 border-b pb-3 flex-wrap gap-2 ${T.panelBorderSoft}`}>
                        <div>
                            <h4 className={`text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2 ${T.heading}`}>
                                <Calendar className="w-5 h-5 text-indigo-400" />
                                Pipeline por Trimestre (Visão Ampla 2026)
                            </h4>
                            <p className={`text-xs mt-0.5 ${T.subtext}`}>Distribuição do volume comercial mapeado por período de fechamento · Clique para detalhamento</p>
                        </div>
                        <span className={`text-xs font-semibold border px-3 py-1 rounded-full flex items-center gap-1.5 ${T.pipelineBadge}`}>
                            Total Pipeline: {formatCurrency(sumAllPipelineQuarters)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {qTotals.map((q) => {
                            const pctOfTotal = sumAllPipelineQuarters > 0 ? (q.total / sumAllPipelineQuarters) * 100 : 0;
                            const barWidthPct = maxQTotal > 0 ? (q.total / maxQTotal) * 100 : 0;

                            return (
                                <button
                                    key={q.label}
                                    type="button"
                                    onClick={() => openQuarterModal(q.key, `${q.label} (${q.name})`, q.total)}
                                    className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] relative overflow-hidden ${T.qCard}`}
                                >
                                    {/* Accent Top Border Highlight */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div>
                                        <div className="flex items-center justify-between w-full mb-1">
                                            <span className={`text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${T.qLabel}`}>
                                                {q.label}
                                            </span>
                                            <span className={`text-[11px] font-semibold ${T.qPeriod}`}>
                                                {q.period}
                                            </span>
                                        </div>

                                        <p className={`text-xs font-bold mt-1 line-clamp-1 transition-colors ${T.qName}`}>
                                            {q.name}
                                        </p>
                                    </div>

                                    <div className="mt-3">
                                        <div className="flex items-baseline justify-between gap-1 mb-1.5">
                                            <span className={`text-base sm:text-lg font-bold font-mono transition-colors ${T.qValue}`}>
                                                {formatCurrency(q.total)}
                                            </span>
                                        </div>

                                        {/* Progress bar relative to max quarter */}
                                        <div className={`w-full h-1.5 rounded-full overflow-hidden border ${T.qTrack}`}>
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.max(5, barWidthPct)}%` }}
                                            />
                                        </div>

                                        <div className={`flex items-center justify-between mt-2 text-[10px] ${T.qFooter}`}>
                                            <span>{q.count} oport.</span>
                                            <span className={`font-mono font-semibold ${T.qFooterAccent}`}>{pctOfTotal.toFixed(1)}% do total</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* ── Drill-down Modal ─────────────────────────── */}
            <Dialog open={modal.open} onOpenChange={(v) => !v && setModal(CLOSED_MODAL)}>
                <DialogContent className={`border max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden ${T.modalBg}`}>
                    <DialogHeader className={`px-6 pt-6 pb-4 border-b shrink-0 ${T.modalDivider}`}>
                        <DialogTitle className="text-xl font-bold">{modal.title}</DialogTitle>
                        <p className={`text-sm mt-0.5 ${T.subtext}`}>{modal.subtitle}</p>
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
                                        <div key={i} className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${T.modalItem}`}>
                                            <span className="text-lg shrink-0">{tempMeta.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold truncate ${T.modalItemTitle}`}>{p.name}</p>
                                                <p className={`text-xs mt-0.5 ${T.modalItemSub}`}>
                                                    {p.orgao ? <span className={T.modalItemOrg}>{p.orgao} · </span> : null}
                                                    {p.managerName} <span className={T.modalItemRole}>({p.managerRole})</span>
                                                </p>
                                            </div>
                                            <p className={`text-sm font-bold font-mono shrink-0 ${lightActive ? T.modalAccent : modal.accentColor}`}>
                                                {formatCurrency(p.value)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer total */}
                    <div className={`px-6 py-4 border-t shrink-0 flex justify-between items-center ${T.modalDivider}`}>
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Total</span>
                        <span className={`text-lg font-bold font-mono ${lightActive ? T.modalAccent : modal.accentColor}`}>{formatCurrency(modal.total)}</span>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
