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
import { Building2, Info, Calendar, Layers, ArrowUp, BarChart3 } from 'lucide-react';
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
                <span className="cursor-help text-zinc-600 hover:text-zinc-400 transition-colors ml-1 inline-flex items-center">
                    <Info className="w-3.5 h-3.5" />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs leading-relaxed bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl" side="top" sideOffset={4}>
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

function KpiCardSide({ label, value, accent, tip }: {
    label: string; value: string; accent?: string; tip?: string;
}) {
    return (
        <div className="flex flex-col gap-0.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 min-w-0 hover:border-zinc-700/80 transition-colors">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                <span>{label}</span>
                {tip && <InfoTip text={tip} />}
            </p>
            <p className={`text-lg sm:text-xl font-bold font-mono truncate ${accent ?? 'text-zinc-100'}`}>{value}</p>
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

export function DRMOverview({ managers, year, faturamento2025 = 630386397.11 }: DRMOverviewProps) {
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

    const activeManagers = (managers || []).filter(m => m.id !== 'projeto-triade' && m.name !== 'Tríade Digital');
    if (!activeManagers || activeManagers.length === 0) return null;

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalHerdados = activeManagers.reduce((acc, m) => acc + (m.contratosHerdados ?? m.contratado), 0);
    const totalNovosNegocios = activeManagers.reduce((acc, m) => acc + (m.novosNegocios ?? 0), 0);
    const totalContratado2026 = activeManagers.reduce((acc, m) => acc + (m.contratado2026 ?? m.contratado), 0);
    const totalForecastProRata2026 = activeManagers.reduce((acc, m) => acc + (m.forecastProRata2026 ?? calcForecastProRata2026(m.contratado, m.pipeline)), 0);

    // ── Pipeline by quarter ──────────────────────────────────────────────────
    const qTotals = (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).map((q) => ({
        key: q,
        label: q === 'nao_mapeado' ? 'N/M' : q.toUpperCase(),
        total: activeManagers.reduce((acc, m) => acc + sumQuarterProjects(
            (m.pipeline[q]?.projects || []).filter(p => p.temperature !== 'historico' && p.temperature !== 'perdido')
        ), 0),
    }));
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
            <div className="flex flex-col gap-3 h-full">

                {/* ── Header ──────────────────────────────────── */}
                <div className="flex flex-row items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-4 py-2.5 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-100 leading-tight">DRM — Visão Geral</h3>
                            <p className="text-xs text-zinc-400">Diretoria de Relacionamento e Mercado · {year}</p>
                        </div>
                    </div>
                </div>

                {/* ── Main Split View (Left: Dynamic Seamless Pyramid, Right: Consolidated Data & Pipeline) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">

                    {/* ── LEFT COLUMN (7 Cols): Pirâmide Dinâmica Ajustável ── */}
                    <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col backdrop-blur-md h-full justify-between overflow-hidden">
                        <div className="flex items-center justify-between mb-2.5 border-b border-zinc-800/60 pb-2.5 flex-wrap gap-2 shrink-0">
                            <div>
                                <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-emerald-400" />
                                    Pirâmide Comercial Dinâmica
                                    <InfoTip text="A base da pirâmide recalcula dinamicamente conforme os filtros selecionados à direita. Quem possui o maior valor selecionado fica na base da pirâmide." />
                                </h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                    Base da pirâmide ordenada por: <strong className="text-emerald-400">{activeMetricLabel}</strong>
                                </p>
                            </div>

                            {/* Metric Toggles (Herdados, Concluídos and Pipeline) */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => toggleMetric('herdados')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.herdados
                                            ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm'
                                            : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.herdados ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
                                    Herdados
                                </button>

                                <button
                                    type="button"
                                    onClick={() => toggleMetric('novos')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.novos
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm'
                                            : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.novos ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                                    Concluídos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => toggleMetric('pipeline')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                        activeMetrics.pipeline
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm'
                                            : 'bg-zinc-950/40 text-zinc-500 border-zinc-800 hover:border-zinc-700 opacity-60'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activeMetrics.pipeline ? 'bg-indigo-500' : 'bg-zinc-700'}`} />
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
                                                <div className={`w-full h-8 relative flex items-center justify-between px-3 transition-all duration-200 border-x border-t border-zinc-800/80 overflow-hidden ${
                                                    idx === 0 ? 'rounded-t-xl border-t' : ''
                                                } ${
                                                    isBase ? 'rounded-b-xl border-b shadow-lg' : ''
                                                } ${
                                                    isTopRank ? 'bg-zinc-900 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.2)] z-10' : 'bg-zinc-900/80 hover:bg-zinc-900'
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
                                                                isTopRank ? 'bg-amber-400 text-zinc-950 border-amber-300' : 'bg-zinc-800/90 text-zinc-200 border-zinc-700'
                                                            }`}>
                                                                #{m.rank}
                                                            </span>

                                                            <p className="font-bold text-xs text-zinc-100 group-hover:text-white transition-colors truncate max-w-[150px] drop-shadow-sm">
                                                                {m.name} <span className="text-[11px] font-normal text-zinc-300/80">({m.role})</span>
                                                            </p>
                                                        </div>

                                                        {/* Right: Selected Total R$ */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-xs font-bold font-mono text-zinc-50 drop-shadow-sm min-w-[80px] text-right">
                                                                {formatCurrency(m.totalSelected)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs bg-zinc-950 text-zinc-200 border border-zinc-700/80 leading-relaxed p-2.5 shadow-2xl" sideOffset={6}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-amber-400 font-mono text-xs">#{m.rank} no Ranking de {activeMetricLabel}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.statusColor}`}>{m.perfStatus}</span>
                                            </div>
                                            <p className="font-bold text-zinc-100 text-sm">{m.name} ({m.role})</p>
                                            <div className="space-y-1 text-xs mt-1">
                                                <div className="flex justify-between gap-4"><span>Total Selecionado:</span> <strong className="font-mono text-emerald-400">{formatCurrency(m.totalSelected)}</strong></div>
                                                {activeMetrics.novos && (
                                                    <div className="flex justify-between gap-4"><span>Novos Concluídos (TCV):</span> <span className="font-mono text-emerald-300">{formatCurrency(m.novos)}</span></div>
                                                )}
                                                {activeMetrics.herdados && (
                                                    <div className="flex justify-between gap-4"><span>Contratos Herdados:</span> <span className="font-mono text-zinc-300">{formatCurrency(m.herdados)}</span></div>
                                                )}
                                                {activeMetrics.pipeline && (
                                                    <div className="flex justify-between gap-4"><span>Pipeline em Aberto:</span> <span className="font-mono text-indigo-400">{formatCurrency(m.pipelineVal)}</span></div>
                                                )}
                                                <div className="flex justify-between gap-4"><span>Meta 2026:</span> <span className="font-mono text-zinc-400">{formatCurrency(m.meta)}</span></div>
                                                <div className="flex justify-between gap-4 pt-1 font-bold border-t border-zinc-800"><span>% Atingimento da Meta:</span> <span className="font-mono text-emerald-400">{formatPercentage(m.achievementPct)}</span></div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Base Indicator */}
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider justify-center pt-2 border-t border-zinc-800/60 shrink-0">
                            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
                            Base da Pirâmide — Maior Volume: <span className="underline ml-1">{activeMetricLabel}</span>
                            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN (5 Cols): Informações Consolidadas & Pipeline ── */}
                    <div className="lg:col-span-5 flex flex-col gap-3 h-full">

                        {/* Consolidated KPI Cards Column (Contratos Herdados Card Removed, 4 Cards Total) */}
                        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-2.5 backdrop-blur-md flex-1 justify-around">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <BarChart3 className="w-4 h-4 text-cyan-400" />
                                Informações Consolidadas
                            </h4>

                            <KpiCardSide
                                label="1. Faturamento 2025"
                                value={formatCurrency(faturamento2025)}
                                accent="text-cyan-400"
                                tip="Faturamento total realizado no ano de 2025. Editável nas Configurações."
                            />
                            <KpiCardSide
                                label="2. Novos Negócios Concluídos"
                                value={formatCurrency(totalNovosNegocios)}
                                accent="text-emerald-400"
                                tip="Receita pro-rata 2026 de novos contratos fechados no pipeline (Status = Contratado)."
                            />
                            <KpiCardSide
                                label="3. Contratado 2026"
                                value={formatCurrency(totalContratado2026)}
                                accent="text-blue-400"
                                tip="Herdados + parcela pro-rata 2026 dos novos negócios."
                            />
                            <KpiCardSide
                                label="4. Forecast Pro-rata 2026"
                                value={formatCurrency(totalForecastProRata2026)}
                                accent="text-violet-400"
                                tip="Projeção total de receita reconhecida em 2026 considerando todo o pipeline."
                            />
                        </div>

                        {/* Pipeline por Trimestre (Quarterly Pipeline Column) */}
                        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-md shrink-0">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                <span>Pipeline por Trimestre</span>
                                <span className="text-[10px] text-zinc-600 font-normal flex items-center gap-1"><Calendar className="w-3 h-3" /> Clique para ver</span>
                            </h4>
                            <div className="grid grid-cols-5 gap-1.5">
                                {qTotals.map((q) => (
                                    <button
                                        key={q.label}
                                        type="button"
                                        onClick={() => openQuarterModal(q.key, q.label, q.total)}
                                        className="bg-zinc-800/80 hover:bg-zinc-800 rounded-lg p-2 border border-zinc-800 hover:border-indigo-500/50 transition-all text-left group cursor-pointer"
                                    >
                                        <span className="text-[10px] font-bold text-zinc-400 block uppercase">{q.label}</span>
                                        <span className="text-xs font-bold font-mono text-indigo-400 group-hover:text-indigo-300 truncate block mt-0.5">
                                            {formatCurrency(q.total)}
                                        </span>
                                    </button>
                                ))}
                            </div>
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
