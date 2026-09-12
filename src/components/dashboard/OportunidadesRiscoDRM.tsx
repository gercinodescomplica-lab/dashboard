'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    PieChart,
    Pie,
} from 'recharts';
import { AlertTriangle, Layers, Loader2, TrendingDown, Wallet } from 'lucide-react';
import { getOportunidadesRiscoConsolidado } from '@/services/oportunidades.service';
import { OportunidadesRiscoLista } from './OportunidadesRiscoLista';
import type { OportunidadeStatus, OportunidadesRiscoConsolidado } from '@/types/oportunidades';
import { formatCurrency } from '@/lib/format';
import {
    contarPorStatus,
    formatarData,
    montarLinhasPorGerencia,
    ordenarPorCriticidade,
    resumoPorStatus,
    statusColor,
    statusMeta,
    STATUS_RISCO_PERDA,
} from '@/lib/oportunidades';

/**
 * Seção "Oportunidades em Risco (Visão DRM)" do dashboard principal — fica abaixo do
 * Pipeline por Trimestre.
 *
 * Traz o levantamento consolidado das gerências de forma visual: KPIs, barras empilhadas
 * por gerência/status, rosca por status e o detalhamento filtrável de cada oportunidade
 * com o motivo (causa raiz).
 *
 * Fonte: `getOportunidadesRiscoConsolidado()` — hoje o JSON estático, depois o banco.
 */

interface OportunidadesRiscoDRMProps {
    lightActive?: boolean;
}

type FiltroStatus = 'todos' | OportunidadeStatus;

function KpiTile({ label, value, hint, accent, accentLight, lightActive }: {
    label: string; value: string; hint?: string; accent: string; accentLight: string; lightActive?: boolean;
}) {
    return (
        <div className={`border rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-0 transition-colors ${lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/80'}`}>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider truncate" title={label}>{label}</p>
            <p className={`text-xl font-bold font-mono truncate ${lightActive ? accentLight : accent}`}>{value}</p>
            {hint && <p className="text-[10px] text-zinc-500 truncate" title={hint}>{hint}</p>}
        </div>
    );
}

export function OportunidadesRiscoDRM({ lightActive = false }: OportunidadesRiscoDRMProps) {
    const [data, setData] = useState<OportunidadesRiscoConsolidado | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtro, setFiltro] = useState<FiltroStatus>('todos');

    const T = {
        panel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/80',
        panelBorderSoft: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        heading: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        subtext: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        muted: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        badge: lightActive ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        chartBox: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-800/70',
        chartTitle: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        chipOff: lightActive ? 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700',
        chipOn: 'bg-indigo-600 border-indigo-500 text-white',
        listBox: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-800/70',
        item: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800',
        itemDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        orgao: lightActive ? 'text-indigo-700' : 'text-indigo-400',
        itemTitle: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        itemMuted: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        itemRole: lightActive ? 'text-zinc-400' : 'text-zinc-700',
        descBox: lightActive ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950/60 border-zinc-800 text-zinc-300',
        pill: lightActive ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300',
        pillArea: lightActive ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/30 border-red-900/40 text-red-300',
        emptyBorder: lightActive ? 'border-zinc-300' : 'border-zinc-800',
        chartGrid: lightActive ? '#e4e4e7' : '#27272a',
        chartAxis: '#71717a',
        chartAxisStrong: lightActive ? '#52525b' : '#a1a1aa',
        chartLegend: lightActive ? 'text-zinc-600' : 'text-zinc-300',
        chartTooltipBg: lightActive ? '#ffffff' : '#09090b',
        chartTooltipBorder: lightActive ? '#e4e4e7' : '#3f3f46',
        chartTooltipText: lightActive ? '#18181b' : '#f4f4f5',
        chartTooltipItem: lightActive ? '#3f3f46' : '#e4e4e7',
        chartTooltipLabel: lightActive ? '#71717a' : '#a1a1aa',
        chartTooltipShadow: lightActive ? '0 10px 25px -5px rgba(0, 0, 0, 0.15)' : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    };

    useEffect(() => {
        let cancelado = false;
        setIsLoading(true);
        setError(null);

        getOportunidadesRiscoConsolidado()
            .then((resultado) => {
                if (!cancelado) setData(resultado);
            })
            .catch((err) => {
                console.error('[OportunidadesRiscoDRM] Falha ao carregar levantamento:', err);
                if (!cancelado) setError('Não foi possível carregar as oportunidades em risco.');
            })
            .finally(() => {
                if (!cancelado) setIsLoading(false);
            });

        return () => {
            cancelado = true;
        };
    }, []);

    const ordenadas = useMemo(() => (data ? ordenarPorCriticidade(data.oportunidades) : []), [data]);
    const contagemPorStatus = useMemo(() => contarPorStatus(ordenadas), [ordenadas]);
    const visiveis = filtro === 'todos' ? ordenadas : ordenadas.filter((o) => o.status === filtro);

    const totalRiscoPerda = useMemo(
        () => ordenadas.filter((o) => STATUS_RISCO_PERDA.includes(o.status)).length,
        [ordenadas]
    );
    const resumoRiscoPerda = useMemo(
        () => resumoPorStatus((data?.porStatus ?? []).filter((s) => STATUS_RISCO_PERDA.includes(s.status))),
        [data]
    );

    /** Status presentes no levantamento, na ordem de criticidade (colunas do gráfico e rosca). */
    const statusPresentes = useMemo(() => contagemPorStatus.map(([status]) => status), [contagemPorStatus]);

    /** Linhas do gráfico por gerência: o total entra no rótulo do eixo e cada status é uma camada. */
    const porGerenciaChart = useMemo(
        () => (data ? montarLinhasPorGerencia(data.porGerencia, data.oportunidades) : []),
        [data]
    );

    const maiorGerencia = useMemo(
        () => (data ? [...data.porGerencia].sort((a, b) => b.total - a.total)[0] ?? null : null),
        [data]
    );

    const rosca = useMemo(
        () => contagemPorStatus.map(([status, total]) => ({
            name: statusMeta(status).label,
            value: total,
            fill: statusColor(status),
        })),
        [contagemPorStatus]
    );

    const dataConsolidacao = formatarData(data?.dataConsolidacao);

    const tooltipStyle = {
        backgroundColor: T.chartTooltipBg,
        borderColor: T.chartTooltipBorder,
        borderRadius: '12px',
        fontSize: '12px',
        color: T.chartTooltipText,
        boxShadow: T.chartTooltipShadow,
    };

    return (
        <div className={`border rounded-2xl p-4 sm:p-5 backdrop-blur-md shrink-0 mt-1 transition-colors duration-200 ${T.panel}`}>
            {/* Cabeçalho da seção */}
            <div className={`flex items-center justify-between mb-3 border-b pb-3 flex-wrap gap-2 ${T.panelBorderSoft}`}>
                <div>
                    <h4 className={`text-sm sm:text-base font-bold uppercase tracking-wider flex items-center gap-2 ${T.heading}`}>
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Oportunidades em Risco (Visão DRM)
                    </h4>
                    <p className={`text-xs mt-0.5 ${T.subtext}`}>
                        {data
                            ? `${data.levantamento} · ${data.totalGerentes} gerência(s) com levantamento${dataConsolidacao ? ` · consolidado em ${dataConsolidacao}` : ''}`
                            : 'Levantamento consolidado das oportunidades não avançadas ou pendentes por falha interna'}
                    </p>
                </div>
                {data && (
                    <span className={`text-xs font-semibold border px-3 py-1 rounded-full flex items-center gap-1.5 ${T.badge}`}>
                        Total: {data.total} {data.total === 1 ? 'oportunidade' : 'oportunidades'}
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className={`flex items-center justify-center py-16 ${T.muted}`}>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando oportunidades em risco...
                </div>
            ) : error || !data ? (
                <div className={`flex flex-col items-center justify-center py-14 border border-dashed rounded-2xl gap-3 ${T.muted} ${T.emptyBorder}`}>
                    <AlertTriangle className="w-8 h-8 opacity-40" />
                    <p className="text-base font-medium">{error ?? 'Nenhum levantamento de oportunidades em risco disponível.'}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3.5">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiTile
                            lightActive={lightActive}
                            label="Oportunidades no levantamento"
                            value={`${data.total}`}
                            hint={`${data.totalGerentes} gerências`}
                            accent="text-amber-400"
                            accentLight="text-amber-600"
                        />
                        <KpiTile
                            lightActive={lightActive}
                            label="Em risco + perdidas"
                            value={`${totalRiscoPerda}`}
                            hint={resumoRiscoPerda || 'nenhuma'}
                            accent="text-red-400"
                            accentLight="text-red-600"
                        />
                        <KpiTile
                            lightActive={lightActive}
                            label="Valor indicado somado"
                            value={formatCurrency(data.valorIndicadoTotal)}
                            hint="só parte dos itens traz valor"
                            accent="text-emerald-400"
                            accentLight="text-emerald-600"
                        />
                        <KpiTile
                            lightActive={lightActive}
                            label="Maior concentração"
                            value={maiorGerencia ? maiorGerencia.gerencia : '—'}
                            hint={maiorGerencia ? `${maiorGerencia.total} oportunidade(s) · ${maiorGerencia.gerenteNome || maiorGerencia.gerencia}` : ''}
                            accent="text-indigo-400"
                            accentLight="text-indigo-600"
                        />
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                        {/* Por gerência — barras empilhadas por status */}
                        <div className={`lg:col-span-7 border rounded-xl p-3.5 ${T.chartBox}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${T.chartTitle}`}>
                                <Layers className="w-4 h-4 text-amber-400" /> Por gerência (empilhado por status)
                            </p>
                            <div className="w-full h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={porGerenciaChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} horizontal={false} />
                                        <XAxis type="number" stroke={T.chartAxis} fontSize={10} allowDecimals={false} />
                                        <YAxis type="category" dataKey="label" stroke={T.chartAxisStrong} fontSize={10} width={172} />
                                        <Tooltip
                                            cursor={{ fill: lightActive ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}
                                            contentStyle={tooltipStyle}
                                            itemStyle={{ color: T.chartTooltipItem, fontWeight: 600 }}
                                            labelStyle={{ color: T.chartTooltipLabel, fontWeight: 700, marginBottom: '4px' }}
                                            formatter={(value: any, name: any) => [`${value} oportunidade(s)`, statusMeta(String(name)).label]}
                                        />
                                        {statusPresentes.map((status) => (
                                            <Bar key={status} dataKey={status} stackId="a" fill={statusColor(status)} name={status} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Por status — rosca + legenda */}
                        <div className={`lg:col-span-5 border rounded-xl p-3.5 ${T.chartBox}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${T.chartTitle}`}>
                                <TrendingDown className="w-4 h-4 text-amber-400" /> Por status
                            </p>
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <div className="relative w-full sm:w-[180px] h-[180px] shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={rosca} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                                                {contagemPorStatus.map(([status]) => (
                                                    <Cell key={status} fill={statusColor(status)} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={tooltipStyle}
                                                itemStyle={{ color: T.chartTooltipItem, fontWeight: 600 }}
                                                formatter={(value: any, name: any) => [`${value} oportunidade(s)`, name]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className={`text-2xl font-bold font-mono ${T.heading}`}>{data.total}</span>
                                        <span className={`text-[10px] uppercase tracking-wider ${T.muted}`}>oportunidades</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5 w-full">
                                    {contagemPorStatus.map(([status, total]) => (
                                        <div key={status} className="flex items-center justify-between gap-2 text-xs">
                                            <span className={`flex items-center gap-2 min-w-0 ${T.chartLegend}`}>
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor(status) }} />
                                                <span className="truncate">{statusMeta(status).label}</span>
                                            </span>
                                            <span className={`font-mono font-bold shrink-0 ${T.chartLegend}`}>{total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalhamento */}
                    <div className={`border rounded-xl ${T.listBox}`}>
                        <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b flex-wrap ${T.panelBorderSoft}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${T.chartTitle}`}>
                                <Wallet className="w-4 h-4 text-amber-400" /> Detalhamento ({visiveis.length}
                                {filtro !== 'todos' ? ` de ${ordenadas.length}` : ''})
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFiltro('todos')}
                                    className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors ${filtro === 'todos' ? T.chipOn : T.chipOff}`}
                                >
                                    Todas ({ordenadas.length})
                                </button>
                                {contagemPorStatus.map(([status, total]) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setFiltro(filtro === status ? 'todos' : status)}
                                        className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors ${filtro === status ? T.chipOn : T.chipOff}`}
                                    >
                                        {statusMeta(status).label} ({total})
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="max-h-[460px] overflow-y-auto px-3.5 py-3">
                            {visiveis.length === 0 ? (
                                <p className={`text-center py-10 text-sm ${T.muted}`}>Nenhuma oportunidade com este status.</p>
                            ) : (
                                <OportunidadesRiscoLista items={visiveis} lightActive={lightActive} />
                            )}
                        </div>
                    </div>

                    <p className={`text-[11px] flex items-center gap-1.5 ${T.muted}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Oportunidades não avançadas ou pendentes por falha interna, apontadas pelas gerências no levantamento.
                    </p>
                </div>
            )}
        </div>
    );
}
