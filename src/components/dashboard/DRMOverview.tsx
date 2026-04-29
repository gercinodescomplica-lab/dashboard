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

type Temp = 'quente' | 'morno' | 'frio';
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
    quente: { label: 'Quente', emoji: '🔥', accent: 'text-orange-400', bar: 'bg-orange-500' },
    morno: { label: 'Morno', emoji: '🟡', accent: 'text-yellow-400', bar: 'bg-yellow-500' },
    frio: { label: 'Frio', emoji: '❄️', accent: 'text-blue-400', bar: 'bg-blue-500' },
};

export function DRMOverview({ managers, year }: DRMOverviewProps) {
    const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);

    if (!managers || managers.length === 0) return null;

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalMeta = managers.reduce((acc, m) => acc + m.meta, 0);
    const totalContratado = managers.reduce((acc, m) => acc + m.contratado, 0);
    const totalForecast = managers.reduce((acc, m) => acc + m.forecastFinal, 0);
    const totalGap = calculateGap(totalMeta, totalContratado);
    const achievementPct = calculateAchievementPercentage(totalForecast, totalMeta);
    const overallStatus = determinePerformanceStatus(achievementPct);

    // ── Pipeline by quarter ──────────────────────────────────────────────────
    const qTotals = (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).map((q) => ({
        key: q,
        label: q === 'nao_mapeado' ? 'N/M' : q.toUpperCase(),
        total: managers.reduce((acc, m) => acc + sumQuarterProjects(
            (m.pipeline[q]?.projects || []).filter(p => p.temperature !== 'historico' && p.temperature !== 'perdido')
        ), 0),
    }));
    const maxQTotal = Math.max(...qTotals.map((q) => q.total), 1);

    // ── Temperature counts ───────────────────────────────────────────────────
    const tempCounts: Record<Temp, number> = { quente: 0, morno: 0, frio: 0 };
    const tempValues: Record<Temp, number> = { quente: 0, morno: 0, frio: 0 };
    managers.forEach((m) => {
        (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as QKey[]).forEach((q) => {
            (m.pipeline[q]?.projects || []).forEach((p) => {
                if (p.temperature === 'historico' || p.temperature === 'perdido' || p.temperature === 'contratado') return;
                const t = (p.temperature ?? 'morno') as Temp;
                tempCounts[t] = (tempCounts[t] ?? 0) + 1;
                tempValues[t] = (tempValues[t] ?? 0) + (p.value || 0);
            });
        });
    });
    const totalProjects = tempCounts.quente + tempCounts.morno + tempCounts.frio || 1;
    const maxTempValue = Math.max(tempValues.quente, tempValues.morno, tempValues.frio, 1);

    // ── Ranking ──────────────────────────────────────────────────────────────
    const ranked = [...managers]
        .map((m) => ({
            ...m,
            pct: calculateAchievementPercentage(m.contratado, m.meta),
            status: determinePerformanceStatus(calculateAchievementPercentage(m.contratado, m.meta)),
        }))
        .sort((a, b) => b.pct - a.pct);

    // ── Pyramid ──────────────────────────────────────────────────────────────
    const pyramidBlocks = managers
        .map((m) => ({ ...m, gap: calculateGap(m.meta, m.contratado) }))
        .filter((m) => m.gap > 0)
        .sort((a, b) => b.gap - a.gap);
    const BLOCK_HEIGHT = 52;

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

    function openTempModal(temp: Temp) {
        const meta = TEMP_META[temp];
        const projects: ProjectWithMeta[] = [];
        managers.forEach((m) => {
            (['q1', 'q2', 'q3', 'q4'] as QKey[]).forEach((q) => {
                m.pipeline[q].projects
                    .filter((p) => (p.temperature ?? 'morno') === temp)
                    .forEach((p) => {
                        projects.push({ ...p, managerName: m.name, managerRole: m.role });
                    });
            });
        });
        projects.sort((a, b) => b.value - a.value);
        const total = projects.reduce((acc, p) => acc + p.value, 0);
        setModal({
            open: true,
            title: `${meta.emoji} Oportunidades ${meta.label}`,
            subtitle: `${projects.length} oportunidade${projects.length !== 1 ? 's' : ''} · Total ${formatCurrency(total)}`,
            projects,
            total,
            accentColor: meta.accent,
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
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={`cursor-help px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider ${getStatusColor(overallStatus)}`}>
                                {overallStatus} · {formatPercentage(achievementPct)}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px] text-xs leading-relaxed bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xl" side="bottom" sideOffset={6}>
                            <strong>Atingimento Geral da DRM</strong><br />
                            Calculado como: <em>Forecast Total ÷ Meta Total × 100</em><br /><br />
                            Representa o quão próximo a equipe está de bater 100% da meta do ano.
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* ── KPI Row ─────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Meta Total" value={formatCurrency(totalMeta)} accent="text-zinc-100" tip="Soma das metas individuais de todos os gerentes da DRM para o ano selecionado." />
                    <KpiCard label="Contratado" value={formatCurrency(totalContratado)} accent="text-emerald-400" tip="Valor total já efetivamente contratado (assinado) por todos os gerentes." />
                    <KpiCard label="Forecast" value={formatCurrency(totalForecast)} accent="text-indigo-400" tip="Soma do Forecast Final de cada gerente. Calculado como: Contratado + Pipeline Q1+Q2+Q3+Q4." />
                    <KpiCard label="Gap" value={formatCurrency(totalGap)} sub={totalGap <= 0 ? '🎯 Meta atingida!' : 'Ainda a contratar'} accent={totalGap <= 0 ? 'text-emerald-400' : 'text-blue-400'} tip="Gap = Meta Total − Contratado. Quanto ainda precisa ser contratado." />
                </div>

                {/* ── Middle: Pyramid + Ranking ───────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

                    {/* Pyramid */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col backdrop-blur-md">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Composição de Meta</h4>
                        <div className="flex-1 flex flex-col items-center justify-end gap-0.5 min-h-[260px]">
                            {[...pyramidBlocks].reverse().map((m, i, arr) => {
                                const count = arr.length;
                                const step = count > 1 ? (95 - 30) / (count - 1) : 0;
                                const widthPct = 30 + i * step;
                                return (
                                    <Tooltip key={m.id}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center justify-center bg-blue-600/90 border border-blue-500/50 hover:bg-blue-600 transition-colors shrink-0 cursor-help" style={{ width: `${widthPct}%`, height: `${BLOCK_HEIGHT}px` }}>
                                                <span className="text-xs font-bold text-white/90 whitespace-nowrap truncate px-2">{m.role} · {formatCurrency(m.gap)}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs bg-zinc-900 text-zinc-200 border border-zinc-700" sideOffset={4}>
                                            <strong>{m.name}</strong> — A contratar<br />Meta: {formatCurrency(m.meta)} | Contratado: {formatCurrency(m.contratado)}<br />Gap: {formatCurrency(m.gap)}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="w-full flex items-center justify-center bg-emerald-500/90 border border-emerald-400/50 rounded-b-lg shrink-0 cursor-help" style={{ height: `${BLOCK_HEIGHT + 16}px` }}>
                                        <span className="text-sm font-bold text-black/80">CONTRATADO · {formatCurrency(totalContratado)}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs bg-zinc-900 text-zinc-200 border border-zinc-700" sideOffset={4}>
                                    Valor total já contratado por todos os gerentes da DRM.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex gap-5 mt-4 justify-center">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500/90 border border-emerald-400/50" /><span className="text-xs font-semibold text-zinc-400">Contratado</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-600/80 border border-blue-500/50" /><span className="text-xs font-semibold text-zinc-400">A Contratar (Gap)</span></div>
                        </div>
                    </div>

                    {/* Ranking */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col backdrop-blur-md">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center">
                            Ranking de Gerentes
                            <InfoTip text="Ordenado pelo percentual do valor já Contratado em relação à Meta individual do gerente. O percentual ao lado mostra o atingimento real sem contabilizar o pipeline." />
                        </h4>
                        <p className="text-xs text-zinc-600 mb-4">Ordenado por % de Contratado</p>
                        <div className="flex flex-col gap-3 flex-1">
                            {ranked.map((m, idx) => {
                                const barColor = m.pct >= 100 ? 'bg-emerald-500' : m.pct >= 90 ? 'bg-blue-500' : m.pct >= 70 ? 'bg-yellow-500' : 'bg-red-500';
                                const textColor = m.pct >= 100 ? 'text-emerald-400' : m.pct >= 90 ? 'text-blue-400' : m.pct >= 70 ? 'text-yellow-400' : 'text-red-400';
                                return (
                                    <Tooltip key={m.id}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-3 cursor-help group">
                                                <span className="text-xs font-bold text-zinc-600 w-4 text-right shrink-0">{idx + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-semibold text-zinc-200 truncate">{m.name}</span>
                                                        <span className={`text-xs font-bold ml-2 shrink-0 ${textColor}`}>{formatPercentage(m.pct)}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[11px] bg-zinc-950 text-zinc-200 border border-zinc-700/50 leading-relaxed p-3 shadow-2xl" sideOffset={8}>
                                            <p className="font-bold text-zinc-100 text-sm mb-1">{m.name}</p>
                                            <p className="text-zinc-500 mb-2">{m.role}</p>
                                            <div className="space-y-1 mb-2">
                                                <div className="flex justify-between gap-4"><span>Meta:</span> <span className="font-mono">{formatCurrency(m.meta)}</span></div>
                                                <div className="flex justify-between gap-4 pt-1 font-bold"><span>Contratado:</span> <span className="font-mono text-emerald-400">{formatCurrency(m.contratado)}</span></div>
                                                <div className="flex justify-between gap-4 border-b border-zinc-800 pb-1 pt-2 border-t mt-2"><span>Pipeline:</span> <span className="font-mono text-indigo-400">{formatCurrency(m.forecastFinal - m.contratado)}</span></div>
                                                <div className="flex justify-between gap-4 font-normal text-zinc-400"><span>Forecast Final:</span> <span className="font-mono text-indigo-300">{formatCurrency(m.forecastFinal)}</span></div>
                                            </div>
                                            <p className="text-zinc-500 border-t border-zinc-800 pt-2 italic">
                                                ( Contratado ÷ Meta = {formatPercentage(m.pct)} )
                                            </p>
                                            <p className="mt-1">Status: <span className={textColor}>{m.status}</span></p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Bottom: Pipeline por Quarter + Temperatura ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Pipeline por trimestre — clicável */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1">Pipeline por Trimestre (todos)</h4>
                        <p className="text-xs text-zinc-600 mb-4 flex items-center gap-1"><Calendar className="w-3 h-3" /> Clique em uma barra para ver os projetos</p>
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

                    {/* Temperatura — clicável */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
                        <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center">
                            Temperatura do Pipeline
                            <InfoTip text="🔥 Quente = alta probabilidade de fechar, 🟡 Morno = em negociação, ❄️ Frio = pouco provável ou inicial." />
                        </h4>
                        <p className="text-xs text-zinc-600 mb-4 flex items-center gap-1"><Thermometer className="w-3 h-3" /> Clique em uma barra para ver os projetos</p>
                        <div className="flex flex-col gap-4">
                            {(['quente', 'morno', 'frio'] as Temp[]).map((temp) => {
                                const meta = TEMP_META[temp];
                                return (
                                    <div key={temp} className="flex items-center gap-3">
                                        <span className="text-base w-5 shrink-0">{meta.emoji}</span>
                                        <span className="text-sm font-semibold text-zinc-300 w-14 shrink-0">{meta.label}</span>
                                        <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => openTempModal(temp)}
                                                className={`h-full ${meta.bar} hover:brightness-125 active:brightness-90 rounded-full transition-all cursor-pointer`}
                                                style={{ width: `${(tempValues[temp] / maxTempValue) * 100}%`, minWidth: tempCounts[temp] > 0 ? '8px' : '0' }}
                                                title={`Ver ${meta.label.toLowerCase()}s`}
                                            />
                                        </div>
                                        <div className="shrink-0 text-right w-40">
                                            <span className={`text-xs font-bold font-mono ${meta.accent}`}>{formatCurrency(tempValues[temp])}</span>
                                            <span className="text-xs text-zinc-600 ml-2">{tempCounts[temp]} proj.</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <p className="text-xs text-zinc-600 mt-1">{totalProjects} oportunidade{totalProjects !== 1 ? 's' : ''} no total</p>
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
                                    const tempMeta = TEMP_META[(p.temperature ?? 'morno') as Temp];
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
