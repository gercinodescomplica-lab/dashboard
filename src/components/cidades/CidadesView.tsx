'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCidadesLeads } from '@/services/cidades.service';
import { LeadCidade, CidadesSummary, CategoriaStat, UfStat, TimelineStat } from '@/types/cidades';
import { formatCurrency } from '@/lib/format';
import { BrazilHeatMap } from './BrazilHeatMap';
import {
    Building2,
    DollarSign,
    TrendingUp,
    Calendar,
    MapPin,
    Search,
    Filter,
    Loader2,
    RefreshCw,
    ExternalLink,
    Briefcase,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    Mail,
    Phone,
    PieChart,
    Map as MapIcon,
    Table as TableIcon,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';

export function CidadesView() {
    const [leads, setLeads] = useState<LeadCidade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'mapa' | 'tabela'>('dashboard');

    // Filters for Table & Navigation
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUf, setSelectedUf] = useState<string>('TODAS');
    const [selectedCategoria, setSelectedCategoria] = useState<string>('TODAS');

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await fetchCidadesLeads();
            setLeads(data);
        } catch (err: any) {
            setError(err?.message || 'Falha ao conectar com a fonte de dados do Power Automate.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // ─── KPI Calculations ───────────────────────────────────────────────────
    const summary: CidadesSummary = useMemo(() => {
        const totalLeads = leads.length;
        const pipelineTotal = leads.reduce((acc, l) => acc + l.valor, 0);
        const ticketMedio = totalLeads > 0 ? pipelineTotal / totalLeads : 0;

        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const next90DaysLimit = new Date();
        next90DaysLimit.setDate(next90DaysLimit.getDate() + 90);

        let previsaoMesAtual = 0;
        let proximos90Dias = 0;
        let leadsSemUf = 0;

        for (const lead of leads) {
            if (!lead.uf) leadsSemUf++;

            if (lead.previsao_fechamento) {
                if (lead.previsao_fechamento.startsWith(currentYearMonth)) {
                    previsaoMesAtual += lead.valor;
                }

                const prevDate = new Date(lead.previsao_fechamento);
                if (!isNaN(prevDate.getTime()) && prevDate >= now && prevDate <= next90DaysLimit) {
                    proximos90Dias += lead.valor;
                }
            }
        }

        return {
            totalLeads,
            pipelineTotal,
            ticketMedio,
            previsaoMesAtual,
            proximos90Dias,
            leadsSemUf,
        };
    }, [leads]);

    // ─── Categories Breakdown ───────────────────────────────────────────────
    const categoriaStats: CategoriaStat[] = useMemo(() => {
        const map = new Map<string, { count: number; valor: number }>();
        for (const l of leads) {
            const cat = l.categoria || 'Lead';
            const cur = map.get(cat) || { count: 0, valor: 0 };
            cur.count += 1;
            cur.valor += l.valor;
            map.set(cat, cur);
        }
        return Array.from(map.entries()).map(([categoria, stat]) => ({
            categoria,
            count: stat.count,
            valor: stat.valor,
        })).sort((a, b) => b.valor - a.valor);
    }, [leads]);

    // ─── UFs Ranking ────────────────────────────────────────────────────────
    const ufStats: UfStat[] = useMemo(() => {
        const map = new Map<string, { count: number; valor: number }>();
        for (const l of leads) {
            const uf = l.uf || 'Sem UF';
            const cur = map.get(uf) || { count: 0, valor: 0 };
            cur.count += 1;
            cur.valor += l.valor;
            map.set(uf, cur);
        }
        return Array.from(map.entries()).map(([uf, stat]) => ({
            uf,
            count: stat.count,
            valor: stat.valor,
        })).sort((a, b) => b.valor - a.valor);
    }, [leads]);

    // ─── Timeline 12 Months Projection ─────────────────────────────────────
    const timelineData: TimelineStat[] = useMemo(() => {
        const map = new Map<string, number>();
        for (const l of leads) {
            if (!l.previsao_fechamento) continue;
            const ym = l.previsao_fechamento.substring(0, 7);
            if (ym.length === 7) {
                map.set(ym, (map.get(ym) || 0) + l.valor);
            }
        }

        const sortedMonths = Array.from(map.keys()).sort();
        let runningTotal = 0;

        return sortedMonths.map((ym) => {
            const [y, m] = ym.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y.substring(2)}`;
            const valor = map.get(ym) || 0;
            runningTotal += valor;

            return {
                mes: ym,
                label,
                valor,
                acumulado: runningTotal,
            };
        });
    }, [leads]);

    // ─── Top 10 Deals ───────────────────────────────────────────────────────
    const top10Deals = useMemo(() => {
        return [...leads].sort((a, b) => b.valor - a.valor).slice(0, 10);
    }, [leads]);

    // ─── Filtered Table Leads ───────────────────────────────────────────────
    const filteredLeads = useMemo(() => {
        return leads.filter((l) => {
            if (selectedUf !== 'TODAS' && l.uf !== selectedUf) return false;
            if (selectedCategoria !== 'TODAS' && l.categoria !== selectedCategoria) return false;

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const matchCliente = l.cliente.toLowerCase().includes(query);
                const matchSolicitacao = l.solicitacao.toLowerCase().includes(query);
                const matchStatus = l.status.toLowerCase().includes(query);
                const matchContato = l.contato_nome?.toLowerCase().includes(query);
                const matchEmail = l.contato_email?.toLowerCase().includes(query);
                const matchMunicipio = l.municipio.toLowerCase().includes(query);

                return matchCliente || matchSolicitacao || matchStatus || matchContato || matchEmail || matchMunicipio;
            }
            return true;
        });
    }, [leads, selectedUf, selectedCategoria, searchQuery]);

    const availableUfs = useMemo(() => {
        const ufs = new Set(leads.map((l) => l.uf).filter(Boolean));
        return Array.from(ufs).sort();
    }, [leads]);

    const availableCategorias = useMemo(() => {
        const cats = new Set(leads.map((l) => l.categoria).filter(Boolean));
        return Array.from(cats).sort();
    }, [leads]);

    // Handler to jump to Table Tab with preset filter
    const handleCategoryClick = (catName: string) => {
        setSelectedCategoria(catName);
        setActiveTab('tabela');
    };

    const handleUfClick = (ufName: string) => {
        setSelectedUf(ufName);
        setActiveTab('tabela');
    };

    if (isLoading) {
        return (
            <div className="h-[600px] w-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 gap-4 border border-zinc-900 rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-base font-medium">Carregando módulo de Cidades do Power Automate...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[500px] w-full flex flex-col items-center justify-center bg-zinc-950 text-red-400 gap-4 border border-zinc-900 rounded-2xl p-6 text-center">
                <XCircle className="w-12 h-12 text-red-500" />
                <div>
                    <h3 className="text-xl font-bold text-zinc-100">Falha ao carregar dados do módulo Cidades</h3>
                    <p className="text-sm text-zinc-400 max-w-md mt-1">{error}</p>
                </div>
                <button
                    onClick={loadData}
                    className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full pb-10">

            {/* ── Sub-header / Controls ───────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
                            Inteligência Comercial — Módulo Cidades
                        </h2>
                        <p className="text-xs text-zinc-400">
                            Monitoramento de oportunidades e contratos públicos/privados por município e estado
                        </p>
                    </div>
                </div>

                {/* Tabs Switcher */}
                <div className="flex items-center gap-1 bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'dashboard'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                        }`}
                    >
                        <PieChart className="w-4 h-4" />
                        Dashboard
                    </button>

                    <button
                        onClick={() => setActiveTab('mapa')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'mapa'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                        }`}
                    >
                        <MapIcon className="w-4 h-4" />
                        Mapa de Calor
                    </button>

                    <button
                        onClick={() => setActiveTab('tabela')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'tabela'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                        }`}
                    >
                        <TableIcon className="w-4 h-4" />
                        Leads ({leads.length})
                    </button>

                    <button
                        onClick={loadData}
                        title="Atualizar Dados do Power Automate"
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors ml-1"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── ABA 1: DASHBOARD ────────────────────────────────────────────── */}
            {activeTab === 'dashboard' && (
                <div className="flex flex-col gap-6">

                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Total Leads
                            </span>
                            <span className="text-2xl font-bold font-mono text-zinc-100 mt-1">{summary.totalLeads}</span>
                            <span className="text-[10px] text-zinc-400">Registros mapeados</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Pipeline Total
                            </span>
                            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 truncate">
                                {formatCurrency(summary.pipelineTotal)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Soma de todas oportunidades</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Ticket Médio
                            </span>
                            <span className="text-xl font-bold font-mono text-blue-400 mt-1 truncate">
                                {formatCurrency(summary.ticketMedio)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Valor médio por negócio</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-violet-400" /> Mês Atual
                            </span>
                            <span className="text-xl font-bold font-mono text-violet-400 mt-1 truncate">
                                {formatCurrency(summary.previsaoMesAtual)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Previsão no mês vigente</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" /> Próx. 90 Dias
                            </span>
                            <span className="text-xl font-bold font-mono text-amber-400 mt-1 truncate">
                                {formatCurrency(summary.proximos90Dias)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Fechamento até 3 meses</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Leads sem UF
                            </span>
                            <span className="text-2xl font-bold font-mono text-rose-400 mt-1">{summary.leadsSemUf}</span>
                            <span className="text-[10px] text-zinc-400">Estado não definido</span>
                        </div>
                    </div>

                    {/* Categories Cards Breakdown */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
                            <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                Distribuição por Categoria do Funil
                            </h3>
                            <span className="text-xs text-zinc-500">Clique para filtrar a tabela</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {categoriaStats.map((c) => (
                                <button
                                    key={c.categoria}
                                    onClick={() => handleCategoryClick(c.categoria)}
                                    className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-indigo-500/50 rounded-xl p-4 flex flex-col items-start transition-all cursor-pointer group text-left"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-semibold text-zinc-300 group-hover:text-indigo-300 transition-colors">
                                            {c.categoria}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300">
                                            {c.count} lead(s)
                                        </span>
                                    </div>
                                    <span className="text-lg font-bold font-mono text-zinc-100 mt-2">
                                        {formatCurrency(c.valor)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chart Timeline + Top 10 Opportunities */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Chart (2 cols) */}
                        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">
                                        Projeção Financeira Acumulada (Timeline)
                                    </h3>
                                    <p className="text-xs text-zinc-400">Evolução dos fechamentos previstos por mês</p>
                                </div>
                            </div>

                            <div className="w-full h-[280px] mt-2">
                                {timelineData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                            <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
                                            <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px' }}
                                                formatter={(value: any) => [formatCurrency(Number(value)), 'Acumulado']}
                                                labelFormatter={(label) => `Mês: ${label}`}
                                            />
                                            <Area type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAcumulado)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                                        Nenhuma data de previsão disponível
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top 10 Deals (1 col) */}
                        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
                                <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">
                                    Top 10 Oportunidades
                                </h3>
                                <span className="text-xs text-zinc-400">Por valor R$</span>
                            </div>

                            <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
                                {top10Deals.map((deal, idx) => (
                                    <div
                                        key={deal.id}
                                        className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-3 text-xs"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-zinc-200 truncate">{deal.cliente}</p>
                                                <p className="text-[10px] text-zinc-400 truncate">{deal.municipio} ({deal.uf || 'N/A'})</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-emerald-400 shrink-0 ml-2">
                                            {formatCurrency(deal.valor)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ── ABA 2: MAPA DE CALOR ────────────────────────────────────────── */}
            {activeTab === 'mapa' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Interactive Map (2 cols) */}
                    <div className="lg:col-span-2">
                        <BrazilHeatMap leads={leads} onSelectUf={handleUfClick} />
                    </div>

                    {/* State Ranking Sidebar (1 col) */}
                    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-[520px]">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">
                                    Ranking por Estado (UF)
                                </h3>
                                <p className="text-xs text-zinc-400">Clique para filtrar na tabela</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1">
                            {ufStats.map((st, idx) => (
                                <button
                                    key={st.uf}
                                    onClick={() => handleUfClick(st.uf)}
                                    className="flex items-center justify-between bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 hover:border-indigo-500/50 rounded-xl p-3 transition-all text-left cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                            {st.uf}
                                        </span>
                                        <div>
                                            <p className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">
                                                {st.uf === 'Sem UF' ? 'Não Informado' : `Estado (${st.uf})`}
                                            </p>
                                            <p className="text-[10px] text-zinc-400">{st.count} lead(s)</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold font-mono text-zinc-100">
                                        {formatCurrency(st.valor)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            )}

            {/* ── ABA 3: TABELA DE LEADS ──────────────────────────────────────── */}
            {activeTab === 'tabela' && (
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-4">

                    {/* Filters Bar */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-3">
                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por cliente, status, contato..."
                                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                            {/* UF Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-zinc-400">UF:</span>
                                <select
                                    value={selectedUf}
                                    onChange={(e) => setSelectedUf(e.target.value)}
                                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="TODAS">Todas as UFs</option>
                                    {availableUfs.map((uf) => (
                                        <option key={uf} value={uf}>
                                            {uf}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Categoria Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-zinc-400">Categoria:</span>
                                <select
                                    value={selectedCategoria}
                                    onChange={(e) => setSelectedCategoria(e.target.value)}
                                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="TODAS">Todas Categorias</option>
                                    {availableCategorias.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Clear Filters Button */}
                            {(selectedUf !== 'TODAS' || selectedCategoria !== 'TODAS' || searchQuery !== '') && (
                                <button
                                    onClick={() => {
                                        setSelectedUf('TODAS');
                                        setSelectedCategoria('TODAS');
                                        setSearchQuery('');
                                    }}
                                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors"
                                >
                                    Limpar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] uppercase tracking-wider border-b border-zinc-800">
                                    <th className="p-3 w-12 text-center">UF</th>
                                    <th className="p-3">Cliente / Solicitação</th>
                                    <th className="p-3">Contato</th>
                                    <th className="p-3">Município</th>
                                    <th className="p-3">Categoria</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Previsão</th>
                                    <th className="p-3 text-right">Valor R$</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50 text-xs">
                                {filteredLeads.length > 0 ? (
                                    filteredLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-zinc-900/50 transition-colors">
                                            <td className="p-3 text-center">
                                                <span className="inline-block font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                                                    {lead.uf || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-3 max-w-[260px]">
                                                <p className="font-bold text-zinc-100 truncate">{lead.cliente}</p>
                                                <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{lead.solicitacao}</p>
                                            </td>
                                            <td className="p-3">
                                                {lead.contato_nome ? (
                                                    <div>
                                                        <p className="font-semibold text-zinc-200">{lead.contato_nome}</p>
                                                        <p className="text-[10px] text-zinc-500">{lead.contato_email || lead.contato_telefone || ''}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-600">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-medium text-zinc-300">{lead.municipio || '-'}</td>
                                            <td className="p-3">
                                                <span className="inline-block font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
                                                    {lead.categoria}
                                                </span>
                                            </td>
                                            <td className="p-3 max-w-[200px]">
                                                <p className="text-zinc-300 line-clamp-2">{lead.status || '-'}</p>
                                            </td>
                                            <td className="p-3 font-mono text-zinc-400">
                                                {lead.previsao_fechamento ? (
                                                    new Date(lead.previsao_fechamento).toLocaleDateString('pt-BR')
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                                {formatCurrency(lead.valor)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-zinc-500 text-xs">
                                            Nenhum lead encontrado com os filtros aplicados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
