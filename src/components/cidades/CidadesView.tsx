'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCidadesLeads, extractLeadDate } from '@/services/cidades.service';
import { LeadCidade, CidadesSummary, CategoriaStat, UfStat, TimelineStat, MotivoPerdaStat } from '@/types/cidades';
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
    AlertCircle,
    CalendarClock,
    ArrowUpRight,
    TrendingDown,
    AlertTriangle,
    FileSpreadsheet,
    Layers,
    Tag,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    Cell,
    PieChart as RechartsPieChart,
    Pie,
} from 'recharts';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const UF_NAMES: Record<string, string> = {
    'AC': 'Acre',
    'AL': 'Alagoas',
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins',
};

export function CidadesView() {
    const [leads, setLeads] = useState<LeadCidade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'mapa' | 'tabela'>('dashboard');

    // Modal state for Perdas
    const [selectedMotivoModal, setSelectedMotivoModal] = useState<string | null>(null);

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
        const activeLeads = leads.filter(l => (l.categoria || '').trim().toLowerCase() !== 'perda');
        const pipelineTotal = activeLeads.reduce((acc, l) => acc + l.valor, 0);
        const ticketMedio = activeLeads.length > 0 ? pipelineTotal / activeLeads.length : 0;

        // Unique Cities calculation
        const cidadesSet = new Set<string>();
        leads.forEach(l => {
            if (l.municipio && l.municipio.trim() && l.municipio !== '#VALUE!' && l.municipio !== '#VALOR!') {
                cidadesSet.add(`${l.municipio.trim().toLowerCase()}_${(l.uf || '').toLowerCase()}`);
            }
        });
        const cidadesAtendidas = cidadesSet.size;

        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const next90DaysLimit = new Date();
        next90DaysLimit.setDate(next90DaysLimit.getDate() + 90);

        let previsaoMesAtual = 0;
        let proximos90Dias = 0;
        let leadsSemUf = 0;

        for (const lead of leads) {
            if (!lead.uf) leadsSemUf++;

            const leadDate = extractLeadDate(lead);
            if (leadDate) {
                const leadYm = `${leadDate.getFullYear()}-${String(leadDate.getMonth() + 1).padStart(2, '0')}`;

                if (leadYm === currentYearMonth) {
                    previsaoMesAtual += lead.valor;
                }

                // Check if date is current or future within 90 days
                if (leadDate >= startOfCurrentMonth && leadDate <= next90DaysLimit) {
                    proximos90Dias += lead.valor;
                }
            }
        }

        return {
            totalLeads,
            cidadesAtendidas,
            pipelineTotal,
            ticketMedio,
            previsaoMesAtual,
            proximos90Dias,
            leadsSemUf,
        };
    }, [leads]);

    // ─── Motivos de Perda Breakdown ─────────────────────────────────────────
    const perdasData = useMemo(() => {
        const perdasLeads = leads.filter(l => {
            const cat = (l.categoria_padrao || l.categoria || '').toLowerCase();
            const sit = (l.situacao_padrao || '').toLowerCase();
            return cat.includes('perda') || sit.includes('perdid');
        });

        const map = new Map<string, { count: number; valorTotal: number }>();
        let valorTotalPerdido = 0;

        for (const lead of perdasLeads) {
            const motivo = (lead.motivo_padrao || 'Não informado').trim();
            const cur = map.get(motivo) || { count: 0, valorTotal: 0 };
            cur.count += 1;
            cur.valorTotal += lead.valor;
            valorTotalPerdido += lead.valor;
            map.set(motivo, cur);
        }

        const list: MotivoPerdaStat[] = Array.from(map.entries())
            .map(([motivo, data]) => ({
                motivo,
                count: data.count,
                valorTotal: data.valorTotal,
            }))
            .sort((a, b) => b.valorTotal - a.valorTotal || b.count - a.count);

        const maiorMotivo = list.length > 0 ? list[0] : null;

        return {
            perdasLeads,
            totalPerdasCount: perdasLeads.length,
            valorTotalPerdido,
            list,
            maiorMotivo,
        };
    }, [leads]);

    // ─── Upcoming Closing Dates (Datas de Fechamento Ordenadas) ────────────
    const upcomingClosingLeads = useMemo(() => {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return leads
            .map((lead) => {
                const date = extractLeadDate(lead);
                return { ...lead, dateObj: date };
            })
            .filter((lead) => lead.dateObj !== null)
            .sort((a, b) => {
                const isPastA = a.dateObj! < startOfCurrentMonth;
                const isPastB = b.dateObj! < startOfCurrentMonth;

                // Active/Future dates come first, past dates come last
                if (!isPastA && isPastB) return -1;
                if (isPastA && !isPastB) return 1;

                // Within future: nearest date first
                if (!isPastA && !isPastB) {
                    return a.dateObj!.getTime() - b.dateObj!.getTime();
                }

                // Within past: most recent past date first (descending)
                return b.dateObj!.getTime() - a.dateObj!.getTime();
            });
    }, [leads]);

    // ─── Monthly Closing Volume (Próximos Fechamentos por Mês) ─────────────
    const monthlyClosingChart = useMemo(() => {
        const map = new Map<string, { label: string; count: number; valor: number }>();

        for (const lead of upcomingClosingLeads) {
            if (!lead.dateObj) continue;
            const y = lead.dateObj.getFullYear();
            const m = lead.dateObj.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2, '0')}`;

            const monthName = lead.dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${String(y).substring(2)}`;

            const cur = map.get(key) || { label, count: 0, valor: 0 };
            cur.count += 1;
            cur.valor += lead.valor;
            map.set(key, cur);
        }

        return Array.from(map.entries())
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, data]) => ({
                key,
                label: data.label,
                count: data.count,
                valor: data.valor,
            }));
    }, [upcomingClosingLeads]);

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
            if (!l.uf || l.uf === 'Sem UF') continue; // Skip entries without valid UF
            const uf = l.uf.trim().toUpperCase();
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
            const dateObj = extractLeadDate(l);
            if (!dateObj) continue;
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const ym = `${y}-${m}`;
            map.set(ym, (map.get(ym) || 0) + l.valor);
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

                        <div className="flex flex-col gap-1 bg-gradient-to-br from-indigo-900/40 via-zinc-900/60 to-zinc-900/40 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
                            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-indigo-400" /> Cidades Atendidas
                            </span>
                            <span className="text-2xl font-bold font-mono text-zinc-100 mt-1">{summary.cidadesAtendidas}</span>
                            <span className="text-[10px] text-zinc-400">Municípios distintos atados</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Pipeline Total
                            </span>
                            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 truncate">
                                {formatCurrency(summary.pipelineTotal)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Soma de oportunidades</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Ticket Médio
                            </span>
                            <span className="text-xl font-bold font-mono text-blue-400 mt-1 truncate">
                                {formatCurrency(summary.ticketMedio)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Valor médio / negócio</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-violet-400" /> Mês Atual
                            </span>
                            <span className="text-xl font-bold font-mono text-violet-400 mt-1 truncate">
                                {formatCurrency(summary.previsaoMesAtual)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Previsão mês vigente</span>
                        </div>

                        <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" /> Próx. 90 Dias
                            </span>
                            <span className="text-xl font-bold font-mono text-amber-400 mt-1 truncate">
                                {formatCurrency(summary.proximos90Dias)}
                            </span>
                            <span className="text-[10px] text-zinc-400">Fechamento em 3 meses</span>
                        </div>
                    </div>

                    {/* ── SEÇÃO EXCLUSIVA: PRÓXIMAS DATAS DE FECHAMENTO ─────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Card Principal: Próximos Fechamentos Iminentes (2 cols) */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-950/40 via-zinc-900/60 to-zinc-900/40 border border-indigo-500/30 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                            <CalendarClock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                                Linha do Tempo de Fechamentos Mapeados
                                            </h3>
                                            <p className="text-xs text-zinc-400">
                                                Datas de fechamento extraídas do Excel/Power Automate (ordenadas cronologicamente)
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full">
                                        {upcomingClosingLeads.length} Oportunidades com Data
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                                    {upcomingClosingLeads.map((lead) => {
                                        const dStr = lead.dateObj ? lead.dateObj.toLocaleDateString('pt-BR') : 'N/A';
                                        const now = new Date();
                                        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                                        const isPast = lead.dateObj ? lead.dateObj < startOfCurrentMonth : false;

                                        return (
                                            <div
                                                key={lead.id}
                                                className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all group ${
                                                    isPast
                                                        ? 'bg-zinc-950/40 border-zinc-800/60 opacity-70 hover:opacity-100'
                                                        : 'bg-zinc-950/90 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20 hover:border-indigo-400'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        {isPast ? (
                                                            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                                📁 Vencido: {dStr}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                                                                🔥 Fechamento: {dStr}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                                        {lead.uf || 'UF N/A'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h4 className="text-xs font-bold text-zinc-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                                                        {lead.cliente || lead.municipio || 'Cliente Não Informado'}
                                                    </h4>
                                                    <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                                                        {lead.solicitacao || lead.status}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/60">
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                                                        {lead.categoria}
                                                    </span>
                                                    <span className="text-sm font-bold font-mono text-emerald-400">
                                                        {formatCurrency(lead.valor)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Gráfico de Barras: Distribuição por Mês de Fechamento (1 col) */}
                        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-4">
                                    <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">
                                        Volume por Mês de Fechamento
                                    </h3>
                                    <span className="text-xs text-zinc-400">Soma R$</span>
                                </div>

                                <div className="w-full h-[220px]">
                                    {monthlyClosingChart.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyClosingChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
                                                <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#09090b',
                                                        borderColor: '#3f3f46',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        color: '#f4f4f5',
                                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                                    }}
                                                    itemStyle={{ color: '#e4e4e7', fontWeight: 600 }}
                                                    labelStyle={{ color: '#a1a1aa', fontWeight: 700, marginBottom: '4px' }}
                                                    formatter={(value: any, name: any, item: any) => [
                                                        `${formatCurrency(Number(value))} (${item.payload.count} propostas)`,
                                                        'Volume Total',
                                                    ]}
                                                />
                                                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                                                    {monthlyClosingChart.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#818cf8' : '#4f46e5'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                                            Sem datas identificadas nos registros
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-3 mt-3 flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                <p className="text-[11px] text-zinc-400 leading-tight">
                                    <strong className="text-zinc-200">Aviso Comercial:</strong> As datas foram sincronizadas e extraídas do Excel/Webhook do Power Automate.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* ── SEÇÃO EXCLUSIVA: ANÁLISE DE MOTIVOS DE PERDA ───────────────────────── */}
                    <div className="bg-gradient-to-br from-red-950/20 via-zinc-900/60 to-zinc-900/40 border border-red-500/20 rounded-2xl p-5 shadow-xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-red-500/20 pb-3 mb-4 gap-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                                    <TrendingDown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                        Diagnóstico de Motivos de Perda
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Análise detalhada de causa raiz das propostas não convertidas ({perdasData.totalPerdasCount} oportunidades) · <span className="text-red-400 underline font-semibold">Clique para ver o detalhamento sucinto</span>
                                    </p>
                                </div>
                            </div>

                            <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
                                Perda Total: {formatCurrency(perdasData.valorTotalPerdido)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Card Maior Motivo */}
                            <button
                                type="button"
                                onClick={() => perdasData.maiorMotivo && setSelectedMotivoModal(perdasData.maiorMotivo.motivo)}
                                className="bg-zinc-950/80 hover:bg-zinc-900 border border-red-500/30 hover:border-red-500/60 rounded-xl p-4 flex flex-col justify-between shadow-inner text-left transition-all cursor-pointer group"
                            >
                                <div>
                                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /> Maior Causa de Perda
                                    </span>
                                    <h4 className="text-lg font-bold text-zinc-100 mt-2 group-hover:text-red-300 transition-colors">
                                        {perdasData.maiorMotivo?.motivo || 'N/A'}
                                    </h4>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Responsável pela maior fatia financeira e volume de oportunidades perdidas.
                                    </p>

                                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                                        <span className="text-xs text-zinc-400">Oportunidades:</span>
                                        <span className="text-sm font-bold text-zinc-100">{perdasData.maiorMotivo?.count || 0} Lead(s)</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span className="text-xs text-zinc-400">Impacto Financeiro:</span>
                                        <span className="text-base font-bold font-mono text-red-400">
                                            {formatCurrency(perdasData.maiorMotivo?.valorTotal || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-center justify-between">
                                    <p className="text-[11px] text-red-300">
                                        🔍 Clique para ver o detalhamento sucinto
                                    </p>
                                    <ArrowUpRight className="w-4 h-4 text-red-400 shrink-0" />
                                </div>
                            </button>

                            {/* Gráfico de Barras dos Motivos de Perda */}
                            <div className="lg:col-span-2 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                        Distribuição dos Motivos de Perda (Valor R$)
                                    </span>
                                    <span className="text-[11px] text-zinc-500">Clique na barra para detalhar</span>
                                </div>

                                <div className="w-full h-[180px]">
                                    {perdasData.list.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={perdasData.list} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                                <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                                                <YAxis type="category" dataKey="motivo" stroke="#a1a1aa" fontSize={10} width={130} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#09090b',
                                                        borderColor: '#ef4444',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        color: '#f4f4f5',
                                                        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.2)',
                                                    }}
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload || !payload.length) return null;
                                                        const data = payload[0].payload as MotivoPerdaStat;
                                                        const matchingLeads = perdasData.perdasLeads.filter(
                                                            l => (l.motivo_padrao || 'Não informado').trim() === data.motivo
                                                        );

                                                        return (
                                                            <div className="bg-zinc-950 border border-red-500/40 p-3 rounded-xl shadow-2xl max-w-xs">
                                                                <p className="text-xs font-bold text-red-400 mb-1">{data.motivo}</p>
                                                                <p className="text-xs text-zinc-200 font-mono font-bold">
                                                                    {formatCurrency(data.valorTotal)} <span className="text-zinc-400 font-normal">({data.count} Lead(s))</span>
                                                                </p>
                                                                <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1">
                                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Motivos Sucintos / Status:</p>
                                                                    {matchingLeads.slice(0, 3).map((l, i) => (
                                                                        <p key={i} className="text-[11px] text-zinc-300 truncate">
                                                                            • <strong>{l.cliente || 'Cliente'}:</strong> {l.status || 'Perdido'}
                                                                        </p>
                                                                    ))}
                                                                    {matchingLeads.length > 3 && (
                                                                        <p className="text-[10px] text-indigo-400 font-semibold pt-0.5">
                                                                            + {matchingLeads.length - 3} mais... (Clique para ver todos)
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Bar
                                                    dataKey="valorTotal"
                                                    fill="#ef4444"
                                                    radius={[0, 6, 6, 0]}
                                                    onClick={(entry: any) => entry && entry.motivo && setSelectedMotivoModal(entry.motivo)}
                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                                            Nenhuma perda registrada
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                            {c.count} Lead(s)
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
                                                contentStyle={{
                                                    backgroundColor: '#09090b',
                                                    borderColor: '#3f3f46',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    color: '#f4f4f5',
                                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                                }}
                                                itemStyle={{ color: '#818cf8', fontWeight: 700 }}
                                                labelStyle={{ color: '#a1a1aa', fontWeight: 700, marginBottom: '4px' }}
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
                                    Ranking de Estados
                                </h3>
                                <p className="text-xs text-zinc-400">Clique para filtrar na tabela</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1">
                            {ufStats.map((st, idx) => {
                                const stateFullName = st.uf === 'Sem UF' ? 'Não Informado' : (UF_NAMES[st.uf.trim().toUpperCase()] || st.uf);
                                return (
                                    <button
                                        key={st.uf}
                                        onClick={() => handleUfClick(st.uf)}
                                        className="flex items-center justify-between bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 hover:border-indigo-500/50 rounded-xl p-3 transition-all text-left cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                                                {st.uf}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors truncate">
                                                    {stateFullName}
                                                </p>
                                                <p className="text-[10px] text-zinc-400">{st.count} Lead(s)</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold font-mono text-zinc-100 shrink-0 ml-2">
                                            {formatCurrency(st.valor)}
                                        </span>
                                    </button>
                                );
                            })}
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
                                    className="text-xs text-indigo-400 hover:underline px-2 py-1"
                                >
                                    Limpar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-zinc-400 text-[11px] uppercase tracking-wider border-b border-zinc-800">
                                    <th className="p-3 text-center">UF</th>
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
                                                {(() => {
                                                    const d = extractLeadDate(lead);
                                                    return d ? d.toLocaleDateString('pt-BR') : '-';
                                                })()}
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

            {/* ── MODAL DETALHAMENTO DE MOTIVO DE PERDA ────────────────────────── */}
            <Dialog open={selectedMotivoModal !== null} onOpenChange={(v) => !v && setSelectedMotivoModal(null)}>
                <DialogContent className="bg-zinc-950 border border-red-500/30 text-zinc-100 max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 bg-red-950/20 shrink-0">
                        <div className="flex items-center gap-2 text-red-400 mb-1">
                            <TrendingDown className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Detalhamento Sucinto da Perda</span>
                        </div>
                        <DialogTitle className="text-xl font-bold text-zinc-100">{selectedMotivoModal}</DialogTitle>
                        <p className="text-xs text-zinc-400 mt-1">
                            Lista de oportunidades não convertidas pertencentes a este motivo padronizado com o status/descrição original do Excel.
                        </p>
                    </DialogHeader>

                    <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
                        {(() => {
                            const matchingLeads = perdasData.perdasLeads.filter(
                                l => (l.motivo_padrao || 'Não informado').trim() === selectedMotivoModal
                            );
                            if (matchingLeads.length === 0) {
                                return <p className="text-center text-zinc-500 py-8 text-sm">Nenhum registro encontrado para este motivo.</p>;
                            }

                            return matchingLeads.map((lead) => (
                                <div key={lead.id} className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                                    {lead.uf || 'UF N/A'}
                                                </span>
                                                <h4 className="text-sm font-bold text-zinc-100">
                                                    {lead.cliente || lead.municipio || 'Cliente Não Informado'}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-0.5">
                                                <strong>Solicitação:</strong> {lead.solicitacao || 'N/A'}
                                            </p>
                                        </div>

                                        <span className="text-sm font-bold font-mono text-red-400 shrink-0">
                                            {lead.valor > 0 ? formatCurrency(lead.valor) : 'Valor N/A'}
                                        </span>
                                    </div>

                                    {/* Status sucinto original do Excel */}
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mt-1">
                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">
                                            Status Sucinto / Motivo Informado:
                                        </p>
                                        <p className="text-xs font-semibold text-zinc-200">
                                            "{lead.status || 'Motivo de perda não detalhado'}"
                                        </p>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950 shrink-0 flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Inteligência Comercial DRM</span>
                        <button
                            type="button"
                            onClick={() => setSelectedMotivoModal(null)}
                            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-semibold transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
