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

export function CidadesView({ lightActive = false }: { lightActive?: boolean } = {}) {
    const [leads, setLeads] = useState<LeadCidade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'mapa' | 'tabela'>('dashboard');

    // Tokens de cor do tema claro (clone do print). Escuro nunca muda — sempre o valor literal de sempre.
    const T = {
        panel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/80',
        panelSoft: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/80',
        panelBorderSoft: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        heading: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        subtext: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        mutedIcon: lightActive ? 'text-zinc-400' : 'text-zinc-500',
        tabsWrap: lightActive ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-950/80 border-zinc-800',
        tabInactive: lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60',
        refreshBtn: lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
        cardHover: lightActive ? 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-indigo-300' : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800/80 hover:border-indigo-500/50',
        pillMuted: lightActive ? 'bg-zinc-100 text-zinc-500' : 'bg-zinc-800 text-zinc-400',
        rowHover: lightActive ? 'hover:bg-zinc-50' : 'hover:bg-zinc-900/50',
        inputBg: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200',
        theadBg: lightActive ? 'bg-zinc-50 text-zinc-500 border-zinc-200' : 'bg-zinc-950 text-zinc-400 border-zinc-800',
        tableWrapBorder: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        tbodyDivide: lightActive ? 'divide-zinc-200' : 'divide-zinc-800/50',
        rowName: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        rowText: lightActive ? 'text-zinc-600' : 'text-zinc-300',
        modalBg: lightActive ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100',
        modalDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        modalItem: lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/90 border-zinc-800/80',
        chartGrid: lightActive ? '#e4e4e7' : '#27272a',
        chartAxis: lightActive ? '#71717a' : '#71717a',
        chartAxisStrong: lightActive ? '#52525b' : '#a1a1aa',
        chartTooltipBg: lightActive ? '#ffffff' : '#09090b',
        chartTooltipBorder: lightActive ? '#e4e4e7' : '#3f3f46',
        chartTooltipText: lightActive ? '#18181b' : '#f4f4f5',
        chartTooltipItem: lightActive ? '#3f3f46' : '#e4e4e7',
        chartTooltipLabel: lightActive ? '#71717a' : '#a1a1aa',
        chartTooltipShadow: lightActive ? '0 10px 25px -5px rgba(0, 0, 0, 0.15)' : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        avisoBox: lightActive ? 'bg-amber-50 border-amber-200' : 'bg-zinc-950/60 border-zinc-800/60',
        avisoText: lightActive ? 'text-amber-700' : 'text-zinc-400',
        avisoStrong: lightActive ? 'text-amber-900' : 'text-zinc-200',
        redPanel: lightActive ? 'bg-gradient-to-br from-red-50 via-white to-white border-red-200' : 'bg-gradient-to-br from-red-950/20 via-zinc-900/60 to-zinc-900/40 border-red-500/20',
        redHeaderBorder: lightActive ? 'border-red-200' : 'border-red-500/20',
        redIconBg: lightActive ? 'bg-red-100 text-red-600 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20',
        redSubtext: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        redLink: lightActive ? 'text-red-600' : 'text-red-400',
        redBadge: lightActive ? 'text-red-700 bg-red-100 border-red-300' : 'text-red-400 bg-red-500/10 border-red-500/30',
        motivoCard: lightActive ? 'bg-white hover:bg-red-50 border-red-200 hover:border-red-400' : 'bg-zinc-950/80 hover:bg-zinc-900 border-red-500/30 hover:border-red-500/60',
        motivoLabel: lightActive ? 'text-red-600' : 'text-red-400',
        motivoTitle: lightActive ? 'text-zinc-900 group-hover:text-red-600' : 'text-zinc-100 group-hover:text-red-300',
        motivoDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800/80',
        motivoFootBox: lightActive ? 'bg-red-100 border-red-200' : 'bg-red-500/10 border-red-500/20',
        motivoFootText: lightActive ? 'text-red-700' : 'text-red-300',
        motivoChartPanel: lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-950/60 border-zinc-800/80',
        motivoChartHeading: lightActive ? 'text-zinc-700' : 'text-zinc-300',
        motivoTooltipBg: lightActive ? 'bg-white border-red-300' : 'bg-zinc-950 border-red-500/40',
        motivoTooltipTitle: lightActive ? 'text-red-600' : 'text-red-400',
        motivoTooltipValue: lightActive ? 'text-zinc-900' : 'text-zinc-200',
        motivoTooltipMuted: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        motivoTooltipDivider: lightActive ? 'border-zinc-200' : 'border-zinc-800',
        motivoTooltipLead: lightActive ? 'text-zinc-600' : 'text-zinc-300',
        catHeading: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        catCard: lightActive ? 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-indigo-300' : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800/80 hover:border-indigo-500/50',
        catLabel: lightActive ? 'text-zinc-700 group-hover:text-indigo-600' : 'text-zinc-300 group-hover:text-indigo-300',
        catPill: lightActive ? 'bg-zinc-100 text-zinc-500 group-hover:bg-indigo-100 group-hover:text-indigo-600' : 'bg-zinc-800 text-zinc-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300',
    };

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
            <div className={`h-[600px] w-full flex flex-col items-center justify-center gap-4 border rounded-2xl ${lightActive ? 'bg-white text-zinc-500 border-zinc-200' : 'bg-zinc-950 text-zinc-400 border-zinc-900'}`}>
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-base font-medium">Carregando módulo de Cidades do Power Automate...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`h-[500px] w-full flex flex-col items-center justify-center gap-4 border rounded-2xl p-6 text-center ${lightActive ? 'bg-white text-red-600 border-zinc-200' : 'bg-zinc-950 text-red-400 border-zinc-900'}`}>
                <XCircle className="w-12 h-12 text-red-500" />
                <div>
                    <h3 className={`text-xl font-bold ${T.heading}`}>Falha ao carregar dados do módulo Cidades</h3>
                    <p className={`text-sm max-w-md mt-1 ${T.subtext}`}>{error}</p>
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
            <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 border rounded-2xl p-5 backdrop-blur-md transition-colors duration-200 ${T.panel}`}>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className={`text-xl sm:text-2xl font-bold flex items-center gap-2 ${T.heading}`}>
                            Inteligência Comercial — Módulo Cidades
                        </h2>
                        <p className={`text-xs ${T.subtext}`}>
                            Monitoramento de oportunidades e contratos públicos/privados por município e estado
                        </p>
                    </div>
                </div>

                {/* Tabs Switcher */}
                <div className={`flex items-center gap-1 p-1.5 rounded-xl border ${T.tabsWrap}`}>
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'dashboard'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : T.tabInactive
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
                                : T.tabInactive
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
                                : T.tabInactive
                        }`}
                    >
                        <TableIcon className="w-4 h-4" />
                        Leads ({leads.length})
                    </button>

                    <button
                        onClick={loadData}
                        title="Atualizar Dados do Power Automate"
                        className={`p-1.5 rounded-lg transition-colors ml-1 ${T.refreshBtn}`}
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
                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 transition-colors duration-200 ${T.panelSoft}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${T.subtext}`}>
                                <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Total Leads
                            </span>
                            <span className={`text-2xl font-bold font-mono mt-1 ${T.heading}`}>{summary.totalLeads}</span>
                            <span className={`text-[10px] ${T.subtext}`}>Registros mapeados</span>
                        </div>

                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 shadow-lg ${lightActive ? 'bg-gradient-to-br from-indigo-50 via-white to-white border-indigo-200' : 'bg-gradient-to-br from-indigo-900/40 via-zinc-900/60 to-zinc-900/40 border-indigo-500/30'}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${lightActive ? 'text-indigo-700' : 'text-indigo-300'}`}>
                                <Building2 className="w-4 h-4 text-indigo-400" /> Cidades Atendidas
                            </span>
                            <span className={`text-2xl font-bold font-mono mt-1 ${T.heading}`}>{summary.cidadesAtendidas}</span>
                            <span className={`text-[10px] ${T.subtext}`}>Municípios distintos atados</span>
                        </div>

                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 transition-colors duration-200 ${T.panelSoft}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${T.subtext}`}>
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Pipeline Total
                            </span>
                            <span className={`text-xl font-bold font-mono mt-1 truncate ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                {formatCurrency(summary.pipelineTotal)}
                            </span>
                            <span className={`text-[10px] ${T.subtext}`}>Soma de oportunidades</span>
                        </div>

                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 transition-colors duration-200 ${T.panelSoft}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${T.subtext}`}>
                                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Ticket Médio
                            </span>
                            <span className={`text-xl font-bold font-mono mt-1 truncate ${lightActive ? 'text-blue-600' : 'text-blue-400'}`}>
                                {formatCurrency(summary.ticketMedio)}
                            </span>
                            <span className={`text-[10px] ${T.subtext}`}>Valor médio / negócio</span>
                        </div>

                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 transition-colors duration-200 ${T.panelSoft}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${T.subtext}`}>
                                <Calendar className="w-3.5 h-3.5 text-violet-400" /> Mês Atual
                            </span>
                            <span className={`text-xl font-bold font-mono mt-1 truncate ${lightActive ? 'text-violet-600' : 'text-violet-400'}`}>
                                {formatCurrency(summary.previsaoMesAtual)}
                            </span>
                            <span className={`text-[10px] ${T.subtext}`}>Previsão mês vigente</span>
                        </div>

                        <div className={`flex flex-col gap-1 border rounded-2xl p-4 transition-colors duration-200 ${T.panelSoft}`}>
                            <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${T.subtext}`}>
                                <Clock className="w-3.5 h-3.5 text-amber-400" /> Próx. 90 Dias
                            </span>
                            <span className={`text-xl font-bold font-mono mt-1 truncate ${lightActive ? 'text-amber-600' : 'text-amber-400'}`}>
                                {formatCurrency(summary.proximos90Dias)}
                            </span>
                            <span className={`text-[10px] ${T.subtext}`}>Fechamento em 3 meses</span>
                        </div>
                    </div>

                    {/* ── SEÇÃO EXCLUSIVA: PRÓXIMAS DATAS DE FECHAMENTO ─────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Card Principal: Próximos Fechamentos Iminentes (2 cols) */}
                        <div className={`lg:col-span-2 border rounded-2xl p-5 shadow-xl flex flex-col justify-between ${lightActive ? 'bg-gradient-to-br from-indigo-50 via-white to-white border-indigo-200' : 'bg-gradient-to-br from-indigo-950/40 via-zinc-900/60 to-zinc-900/40 border-indigo-500/30'}`}>
                            <div>
                                <div className={`flex items-center justify-between border-b pb-3 mb-4 ${lightActive ? 'border-indigo-200' : 'border-indigo-500/20'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${lightActive ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                            <CalendarClock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${T.heading}`}>
                                                Linha do Tempo de Fechamentos Mapeados
                                            </h3>
                                            <p className={`text-xs ${T.subtext}`}>
                                                Datas de fechamento extraídas do Excel/Power Automate (ordenadas cronologicamente)
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold border px-3 py-1 rounded-full ${lightActive ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'}`}>
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
                                                        ? (lightActive ? 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100' : 'bg-zinc-950/40 border-zinc-800/60 opacity-70 hover:opacity-100')
                                                        : (lightActive ? 'bg-white border-indigo-300 shadow-md ring-1 ring-indigo-100 hover:border-indigo-400' : 'bg-zinc-950/90 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20 hover:border-indigo-400')
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        {isPast ? (
                                                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border ${lightActive ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                                                📁 Vencido: {dStr}
                                                            </span>
                                                        ) : (
                                                            <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-md border animate-pulse ${lightActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                                                                🔥 Fechamento: {dStr}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${T.pillMuted}`}>
                                                        {lead.uf || 'UF N/A'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h4 className={`text-xs font-bold transition-colors line-clamp-1 ${lightActive ? 'text-zinc-900 group-hover:text-indigo-600' : 'text-zinc-100 group-hover:text-indigo-300'}`}>
                                                        {lead.cliente || lead.municipio || 'Cliente Não Informado'}
                                                    </h4>
                                                    <p className={`text-[11px] line-clamp-1 mt-0.5 ${T.subtext}`}>
                                                        {lead.solicitacao || lead.status}
                                                    </p>
                                                </div>

                                                <div className={`flex items-center justify-between mt-3 pt-2 border-t ${T.panelBorderSoft}`}>
                                                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${T.subtext}`}>
                                                        {lead.categoria}
                                                    </span>
                                                    <span className={`text-sm font-bold font-mono ${lightActive ? 'text-emerald-600' : 'text-emerald-400'}`}>
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
                        <div className={`border rounded-2xl p-5 flex flex-col justify-between transition-colors duration-200 ${T.panel}`}>
                            <div>
                                <div className={`flex items-center justify-between border-b pb-3 mb-4 ${T.panelBorderSoft}`}>
                                    <h3 className={`text-base font-bold uppercase tracking-wider ${T.heading}`}>
                                        Volume por Mês de Fechamento
                                    </h3>
                                    <span className={`text-xs ${T.subtext}`}>Soma R$</span>
                                </div>

                                <div className="w-full h-[220px]">
                                    {monthlyClosingChart.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyClosingChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
                                                <XAxis dataKey="label" stroke={T.chartAxis} fontSize={10} />
                                                <YAxis stroke={T.chartAxis} fontSize={10} tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: T.chartTooltipBg,
                                                        borderColor: T.chartTooltipBorder,
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        color: T.chartTooltipText,
                                                        boxShadow: T.chartTooltipShadow,
                                                    }}
                                                    itemStyle={{ color: T.chartTooltipItem, fontWeight: 600 }}
                                                    labelStyle={{ color: T.chartTooltipLabel, fontWeight: 700, marginBottom: '4px' }}
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
                                        <div className={`h-full flex items-center justify-center text-xs ${T.mutedIcon}`}>
                                            Sem datas identificadas nos registros
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={`border rounded-xl p-3 mt-3 flex items-center gap-3 ${T.avisoBox}`}>
                                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                <p className={`text-[11px] leading-tight ${T.avisoText}`}>
                                    <strong className={T.avisoStrong}>Aviso Comercial:</strong> As datas foram sincronizadas e extraídas do Excel/Webhook do Power Automate.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* ── SEÇÃO EXCLUSIVA: ANÁLISE DE MOTIVOS DE PERDA ───────────────────────── */}
                    <div className={`border rounded-2xl p-5 shadow-xl transition-colors duration-200 ${T.redPanel}`}>
                        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 mb-4 gap-2 ${T.redHeaderBorder}`}>
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg border ${T.redIconBg}`}>
                                    <TrendingDown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${T.heading}`}>
                                        Diagnóstico de Motivos de Perda
                                    </h3>
                                    <p className={`text-xs ${T.redSubtext}`}>
                                        Análise detalhada de causa raiz das propostas não convertidas ({perdasData.totalPerdasCount} oportunidades) · <span className={`underline font-semibold ${T.redLink}`}>Clique para ver o detalhamento sucinto</span>
                                    </p>
                                </div>
                            </div>

                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${T.redBadge}`}>
                                Perda Total: {formatCurrency(perdasData.valorTotalPerdido)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Card Maior Motivo */}
                            <button
                                type="button"
                                onClick={() => perdasData.maiorMotivo && setSelectedMotivoModal(perdasData.maiorMotivo.motivo)}
                                className={`border rounded-xl p-4 flex flex-col justify-between shadow-inner text-left transition-all cursor-pointer group ${T.motivoCard}`}
                            >
                                <div>
                                    <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${T.motivoLabel}`}>
                                        <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /> Maior Causa de Perda
                                    </span>
                                    <h4 className={`text-lg font-bold mt-2 transition-colors ${T.motivoTitle}`}>
                                        {perdasData.maiorMotivo?.motivo || 'N/A'}
                                    </h4>
                                    <p className={`text-xs mt-1 ${T.redSubtext}`}>
                                        Responsável pela maior fatia financeira e volume de oportunidades perdidas.
                                    </p>

                                    <div className={`mt-4 pt-3 border-t flex items-center justify-between ${T.motivoDivider}`}>
                                        <span className={`text-xs ${T.redSubtext}`}>Oportunidades:</span>
                                        <span className={`text-sm font-bold ${T.heading}`}>{perdasData.maiorMotivo?.count || 0} Lead(s)</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span className={`text-xs ${T.redSubtext}`}>Impacto Financeiro:</span>
                                        <span className={`text-base font-bold font-mono ${T.motivoLabel}`}>
                                            {formatCurrency(perdasData.maiorMotivo?.valorTotal || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className={`mt-4 border rounded-lg p-2.5 flex items-center justify-between ${T.motivoFootBox}`}>
                                    <p className={`text-[11px] ${T.motivoFootText}`}>
                                        🔍 Clique para ver o detalhamento sucinto
                                    </p>
                                    <ArrowUpRight className={`w-4 h-4 shrink-0 ${T.motivoLabel}`} />
                                </div>
                            </button>

                            {/* Gráfico de Barras dos Motivos de Perda */}
                            <div className={`lg:col-span-2 border rounded-xl p-4 flex flex-col justify-between ${T.motivoChartPanel}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${T.motivoChartHeading}`}>
                                        Distribuição dos Motivos de Perda (Valor R$)
                                    </span>
                                    <span className={`text-[11px] ${T.subtext}`}>Clique na barra para detalhar</span>
                                </div>

                                <div className="w-full h-[180px]">
                                    {perdasData.list.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={perdasData.list} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} horizontal={false} />
                                                <XAxis type="number" stroke={T.chartAxis} fontSize={10} tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                                                <YAxis type="category" dataKey="motivo" stroke={T.chartAxisStrong} fontSize={10} width={130} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: T.chartTooltipBg,
                                                        borderColor: lightActive ? '#fca5a5' : '#ef4444',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        color: T.chartTooltipText,
                                                        boxShadow: lightActive ? '0 10px 25px -5px rgba(239, 68, 68, 0.1)' : '0 10px 25px -5px rgba(239, 68, 68, 0.2)',
                                                    }}
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload || !payload.length) return null;
                                                        const data = payload[0].payload as MotivoPerdaStat;
                                                        const matchingLeads = perdasData.perdasLeads.filter(
                                                            l => (l.motivo_padrao || 'Não informado').trim() === data.motivo
                                                        );

                                                        return (
                                                            <div className={`border p-3 rounded-xl shadow-2xl max-w-xs ${T.motivoTooltipBg}`}>
                                                                <p className={`text-xs font-bold mb-1 ${T.motivoTooltipTitle}`}>{data.motivo}</p>
                                                                <p className={`text-xs font-mono font-bold ${T.motivoTooltipValue}`}>
                                                                    {formatCurrency(data.valorTotal)} <span className={`font-normal ${T.motivoTooltipMuted}`}>({data.count} Lead(s))</span>
                                                                </p>
                                                                <div className={`mt-2 pt-2 border-t space-y-1 ${T.motivoTooltipDivider}`}>
                                                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${T.motivoTooltipMuted}`}>Motivos Sucintos / Status:</p>
                                                                    {matchingLeads.slice(0, 3).map((l, i) => (
                                                                        <p key={i} className={`text-[11px] truncate ${T.motivoTooltipLead}`}>
                                                                            • <strong>{l.cliente || 'Cliente'}:</strong> {l.status || 'Perdido'}
                                                                        </p>
                                                                    ))}
                                                                    {matchingLeads.length > 3 && (
                                                                        <p className="text-[10px] text-indigo-500 font-semibold pt-0.5">
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
                                        <div className={`h-full flex items-center justify-center text-xs ${T.mutedIcon}`}>
                                            Nenhuma perda registrada
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Categories Cards Breakdown */}
                    <div className={`border rounded-2xl p-5 transition-colors duration-200 ${T.panel}`}>
                        <div className={`flex items-center justify-between mb-4 border-b pb-3 ${T.panelBorderSoft}`}>
                            <h3 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${T.catHeading}`}>
                                Distribuição por Categoria do Funil
                            </h3>
                            <span className={`text-xs ${T.subtext}`}>Clique para filtrar a tabela</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {categoriaStats.map((c) => (
                                <button
                                    key={c.categoria}
                                    onClick={() => handleCategoryClick(c.categoria)}
                                    className={`border rounded-xl p-4 flex flex-col items-start transition-all cursor-pointer group text-left ${T.catCard}`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`text-xs font-semibold transition-colors ${T.catLabel}`}>
                                            {c.categoria}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${T.catPill}`}>
                                            {c.count} Lead(s)
                                        </span>
                                    </div>
                                    <span className={`text-lg font-bold font-mono mt-2 ${T.heading}`}>
                                        {formatCurrency(c.valor)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chart Timeline + Top 10 Opportunities */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Chart (2 cols) */}
                        <div className={`lg:col-span-2 border rounded-2xl p-5 flex flex-col transition-colors duration-200 ${T.panel}`}>
                            <div className={`flex items-center justify-between mb-4 border-b pb-3 ${T.panelBorderSoft}`}>
                                <div>
                                    <h3 className={`text-base font-bold uppercase tracking-wider ${T.heading}`}>
                                        Projeção Financeira Acumulada (Timeline)
                                    </h3>
                                    <p className={`text-xs ${T.subtext}`}>Evolução dos fechamentos previstos por mês</p>
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
                                            <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} />
                                            <XAxis dataKey="label" stroke={T.chartAxis} fontSize={11} />
                                            <YAxis stroke={T.chartAxis} fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: T.chartTooltipBg,
                                                    borderColor: T.chartTooltipBorder,
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    color: T.chartTooltipText,
                                                    boxShadow: T.chartTooltipShadow,
                                                }}
                                                itemStyle={{ color: lightActive ? '#4f46e5' : '#818cf8', fontWeight: 700 }}
                                                labelStyle={{ color: T.chartTooltipLabel, fontWeight: 700, marginBottom: '4px' }}
                                                formatter={(value: any) => [formatCurrency(Number(value)), 'Acumulado']}
                                                labelFormatter={(label) => `Mês: ${label}`}
                                            />
                                            <Area type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAcumulado)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className={`h-full flex items-center justify-center text-xs ${T.mutedIcon}`}>
                                        Nenhuma data de previsão disponível
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top 10 Deals (1 col) */}
                        <div className={`border rounded-2xl p-5 flex flex-col transition-colors duration-200 ${T.panel}`}>
                            <div className={`flex items-center justify-between mb-4 border-b pb-3 ${T.panelBorderSoft}`}>
                                <h3 className={`text-base font-bold uppercase tracking-wider ${T.heading}`}>
                                    Top 10 Oportunidades
                                </h3>
                                <span className={`text-xs ${T.subtext}`}>Por valor R$</span>
                            </div>

                            <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
                                {top10Deals.map((deal, idx) => (
                                    <div
                                        key={deal.id}
                                        className={`flex items-center justify-between border rounded-xl p-3 text-xs ${T.panelSoft}`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${T.pillMuted}`}>
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`font-semibold truncate ${T.rowName}`}>{deal.cliente}</p>
                                                <p className={`text-[10px] truncate ${T.subtext}`}>{deal.municipio} ({deal.uf || 'N/A'})</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-emerald-500 shrink-0 ml-2">
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
                        <BrazilHeatMap leads={leads} onSelectUf={handleUfClick} lightActive={lightActive} />
                    </div>

                    {/* State Ranking Sidebar (1 col) */}
                    <div className={`border rounded-2xl p-5 flex flex-col h-[520px] transition-colors duration-200 ${T.panel}`}>
                        <div className={`flex items-center justify-between mb-4 border-b pb-3 ${T.panelBorderSoft}`}>
                            <div>
                                <h3 className={`text-base font-bold uppercase tracking-wider ${T.heading}`}>
                                    Ranking de Estados
                                </h3>
                                <p className={`text-xs ${T.subtext}`}>Clique para filtrar na tabela</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1">
                            {ufStats.map((st, idx) => {
                                const stateFullName = st.uf === 'Sem UF' ? 'Não Informado' : (UF_NAMES[st.uf.trim().toUpperCase()] || st.uf);
                                return (
                                    <button
                                        key={st.uf}
                                        onClick={() => handleUfClick(st.uf)}
                                        className={`flex items-center justify-between border rounded-xl p-3 transition-all text-left cursor-pointer group ${T.cardHover}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-xs shrink-0">
                                                {st.uf}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`text-xs font-semibold transition-colors truncate ${T.catLabel}`}>
                                                    {stateFullName}
                                                </p>
                                                <p className={`text-[10px] ${T.subtext}`}>{st.count} Lead(s)</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold font-mono shrink-0 ml-2 ${T.heading}`}>
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
                <div className={`border rounded-2xl p-5 flex flex-col gap-4 transition-colors duration-200 ${T.panel}`}>

                    {/* Filters Bar */}
                    <div className={`flex flex-col md:flex-row items-center justify-between gap-3 border rounded-xl p-3 ${T.panelSoft}`}>
                        <div className="relative w-full md:w-80">
                            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${T.mutedIcon}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por cliente, status, contato..."
                                className={`w-full border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-all ${T.inputBg}`}
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                            {/* UF Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className={`text-xs ${T.subtext}`}>UF:</span>
                                <select
                                    value={selectedUf}
                                    onChange={(e) => setSelectedUf(e.target.value)}
                                    className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${T.inputBg}`}
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
                                <span className={`text-xs ${T.subtext}`}>Categoria:</span>
                                <select
                                    value={selectedCategoria}
                                    onChange={(e) => setSelectedCategoria(e.target.value)}
                                    className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${T.inputBg}`}
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
                                    className="text-xs text-indigo-500 hover:underline px-2 py-1"
                                >
                                    Limpar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className={`overflow-x-auto rounded-xl border ${T.tableWrapBorder}`}>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`text-[11px] uppercase tracking-wider border-b ${T.theadBg}`}>
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
                            <tbody className={`divide-y text-xs ${T.tbodyDivide}`}>
                                {filteredLeads.length > 0 ? (
                                    filteredLeads.map((lead) => (
                                        <tr key={lead.id} className={`transition-colors ${T.rowHover}`}>
                                            <td className="p-3 text-center">
                                                <span className="inline-block font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px]">
                                                    {lead.uf || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-3 max-w-[260px]">
                                                <p className={`font-bold truncate ${T.rowName}`}>{lead.cliente}</p>
                                                <p className={`text-[11px] line-clamp-1 mt-0.5 ${T.subtext}`}>{lead.solicitacao}</p>
                                            </td>
                                            <td className="p-3">
                                                {lead.contato_nome ? (
                                                    <div>
                                                        <p className={`font-semibold ${T.rowText}`}>{lead.contato_nome}</p>
                                                        <p className={`text-[10px] ${T.subtext}`}>{lead.contato_email || lead.contato_telefone || ''}</p>
                                                    </div>
                                                ) : (
                                                    <span className={T.mutedIcon}>-</span>
                                                )}
                                            </td>
                                            <td className={`p-3 font-medium ${T.rowText}`}>{lead.municipio || '-'}</td>
                                            <td className="p-3">
                                                <span className={`inline-block font-semibold px-2.5 py-1 rounded-full text-[10px] ${T.pillMuted}`}>
                                                    {lead.categoria}
                                                </span>
                                            </td>
                                            <td className="p-3 max-w-[200px]">
                                                <p className={`line-clamp-2 ${T.rowText}`}>{lead.status || '-'}</p>
                                            </td>
                                            <td className={`p-3 font-mono ${T.subtext}`}>
                                                {(() => {
                                                    const d = extractLeadDate(lead);
                                                    return d ? d.toLocaleDateString('pt-BR') : '-';
                                                })()}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                                {formatCurrency(lead.valor)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className={`p-8 text-center text-xs ${T.subtext}`}>
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
                <DialogContent className={`border max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl ${T.modalBg}`}>
                    <DialogHeader className={`px-6 pt-6 pb-4 border-b shrink-0 ${T.modalDivider} ${lightActive ? 'bg-red-50' : 'bg-red-950/20'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${T.motivoLabel}`}>
                            <TrendingDown className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Detalhamento Sucinto da Perda</span>
                        </div>
                        <DialogTitle className={`text-xl font-bold ${T.heading}`}>{selectedMotivoModal}</DialogTitle>
                        <p className={`text-xs mt-1 ${T.subtext}`}>
                            Lista de oportunidades não convertidas pertencentes a este motivo padronizado com o status/descrição original do Excel.
                        </p>
                    </DialogHeader>

                    <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
                        {(() => {
                            const matchingLeads = perdasData.perdasLeads.filter(
                                l => (l.motivo_padrao || 'Não informado').trim() === selectedMotivoModal
                            );
                            if (matchingLeads.length === 0) {
                                return <p className={`text-center py-8 text-sm ${T.subtext}`}>Nenhum registro encontrado para este motivo.</p>;
                            }

                            return matchingLeads.map((lead) => (
                                <div key={lead.id} className={`border rounded-xl p-4 flex flex-col gap-2 ${T.modalItem}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${T.pillMuted}`}>
                                                    {lead.uf || 'UF N/A'}
                                                </span>
                                                <h4 className={`text-sm font-bold ${T.heading}`}>
                                                    {lead.cliente || lead.municipio || 'Cliente Não Informado'}
                                                </h4>
                                            </div>
                                            <p className={`text-xs mt-0.5 ${T.subtext}`}>
                                                <strong>Solicitação:</strong> {lead.solicitacao || 'N/A'}
                                            </p>
                                        </div>

                                        <span className={`text-sm font-bold font-mono shrink-0 ${T.motivoLabel}`}>
                                            {lead.valor > 0 ? formatCurrency(lead.valor) : 'Valor N/A'}
                                        </span>
                                    </div>

                                    {/* Status sucinto original do Excel */}
                                    <div className={`border rounded-lg p-2.5 mt-1 ${T.motivoFootBox}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${T.motivoLabel}`}>
                                            Status Sucinto / Motivo Informado:
                                        </p>
                                        <p className={`text-xs font-semibold ${T.heading}`}>
                                            "{lead.status || 'Motivo de perda não detalhado'}"
                                        </p>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    <div className={`px-6 py-3 border-t shrink-0 flex justify-between items-center text-xs ${T.modalDivider} ${lightActive ? 'bg-zinc-50' : 'bg-zinc-950'}`}>
                        <span className={T.subtext}>Inteligência Comercial DRM</span>
                        <button
                            type="button"
                            onClick={() => setSelectedMotivoModal(null)}
                            className={`px-4 py-1.5 rounded-lg font-semibold transition-colors ${lightActive ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}
                        >
                            Fechar
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
