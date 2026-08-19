"use client";

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Package, BarChart3, Building2, Sun, Moon } from 'lucide-react';
import { applyBodyTheme } from '@/lib/themeSync';

export interface StoreProduct {
    id: number;
    n: string;
    d: string;
    s: string;
    f: string;
    mkt: boolean;
    cat: string;
    r?: string;
}

const MONTH_MAP: Record<string, number> = {
    'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
    'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
};

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];


// Tema escuro (estado atual — não alterado)
const DIR_COLORS_DARK: Record<string, string> = {
    DDS: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    DIT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    DRM: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PRE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

// Tema claro — clonado dos prints (Painel geral / Roadmap / Listagem de produtos)
const DIR_COLORS_LIGHT: Record<string, string> = {
    DDS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    DIT: 'bg-amber-50 text-amber-700 border-amber-200',
    DRM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PRE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const DIR_DOT_COLORS: Record<string, string> = {
    DDS: 'bg-cyan-500', DIT: 'bg-amber-500', DRM: 'bg-emerald-500', PRE: 'bg-yellow-500'
};

const DIR_NAMES: Record<string, string> = {
    DDS: 'Desenvolvimento de Soluções Digitais',
    DIT: 'Infraestrutura e Tecnologia',
    DRM: 'Relacionamento de Mercado',
    PRE: 'Produtos e Resultados Estratégicos'
};

const STAT_COLORS_DARK = {
    store: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    breve: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    backlog: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50',
};

const STAT_COLORS_LIGHT = {
    store: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    breve: 'bg-amber-50 text-amber-700 border-amber-200',
    backlog: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

const STAT_LABELS = { store: 'Na Store', breve: 'Em breve', backlog: 'Backlog' };

// Tags/pontos das fases do roadmap (done/in/next/backlog)
const PHASE_TAG_COLORS_DARK: Record<string, string> = {
    done: 'bg-emerald-500/10 text-emerald-400',
    in: 'bg-amber-500/10 text-amber-400',
    next: 'bg-blue-500/10 text-blue-400',
    backlog: 'bg-zinc-500/10 text-zinc-400',
};
const PHASE_TAG_COLORS_LIGHT: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-700',
    in: 'bg-amber-50 text-amber-700',
    next: 'bg-blue-50 text-blue-700',
    backlog: 'bg-zinc-100 text-zinc-600',
};
const PHASE_DOT_COLORS_DARK: Record<string, string> = {
    done: 'bg-emerald-500',
    in: 'bg-amber-500 border-2 border-amber-300',
    next: 'bg-blue-500',
    backlog: 'bg-zinc-600',
};
const PHASE_DOT_COLORS_LIGHT: Record<string, string> = {
    done: 'bg-emerald-500',
    in: 'bg-amber-500 border-2 border-amber-200',
    next: 'bg-blue-500',
    backlog: 'bg-zinc-300',
};

export default function PipelineStoreView({
    PRODUCTS = [],
    EXTRA_OPTIONS = {},
    theme: themeProp,
    onThemeChange,
}: {
    PRODUCTS?: StoreProduct[];
    EXTRA_OPTIONS?: Record<string, string[]>;
    /** Tema controlado externamente (ex.: pelo DashboardShell, pra sincronizar com o cabeçalho). Se omitido, o componente controla o próprio estado (uso standalone em /store). */
    theme?: 'dark' | 'light';
    onThemeChange?: (theme: 'dark' | 'light') => void;
}) {
    const [view, setView] = useState<'overview' | 'roadmap' | 'produtos'>('overview');
    const [roadmapFilter, setRoadmapFilter] = useState('all');
    const [prodFilter, setProdFilter] = useState('all');
    const [selectedProdId, setSelectedProdId] = useState<number | null>(null);
    // Tema visual do painel Store (escuro = estado atual/padrão, claro = clone dos prints). Não afeta nenhuma regra/lógica.
    const [internalTheme, setInternalTheme] = useState<'dark' | 'light'>('dark');
    // Persistência apenas para o uso standalone (página pública /store, sem controle externo do DashboardShell).
    // Usa a mesma chave global do resto do sistema, então reflete o tema escolhido em qualquer outra área.
    useEffect(() => {
        if (themeProp !== undefined) return;
        try {
            const saved = localStorage.getItem('aibertinho-theme');
            if (saved === 'light' || saved === 'dark') {
                setInternalTheme(saved);
                applyBodyTheme(saved);
                return;
            }
        } catch {
            // localStorage indisponível — mantém o padrão escuro.
        }
        applyBodyTheme('dark');
    }, [themeProp]);
    const theme = themeProp ?? internalTheme;
    const isDark = theme === 'dark';
    const toggleTheme = () => {
        const next: 'dark' | 'light' = isDark ? 'light' : 'dark';
        if (onThemeChange) {
            onThemeChange(next);
        } else {
            setInternalTheme(next);
            try {
                localStorage.setItem('aibertinho-theme', next);
            } catch {
                // localStorage indisponível — segue apenas em memória.
            }
            applyBodyTheme(next);
        }
    };

    const DIR_COLORS = isDark ? DIR_COLORS_DARK : DIR_COLORS_LIGHT;
    const STAT_COLORS = isDark ? STAT_COLORS_DARK : STAT_COLORS_LIGHT;
    const PHASE_TAG_COLORS = isDark ? PHASE_TAG_COLORS_DARK : PHASE_TAG_COLORS_LIGHT;
    const PHASE_DOT_COLORS = isDark ? PHASE_DOT_COLORS_DARK : PHASE_DOT_COLORS_LIGHT;

    const T = {
        rootBg: isDark ? 'bg-zinc-950' : 'bg-white',
        rootText: isDark ? 'text-zinc-100' : 'text-zinc-900',
        rootBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',

        sidebarBg: isDark ? 'bg-zinc-900' : 'bg-white',
        sidebarBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        navActive: isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900',
        navInactive: isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
        accentText: isDark ? 'text-indigo-400' : 'text-indigo-600',

        headerBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        headerBg: isDark ? 'bg-zinc-950/80' : 'bg-white/80',
        headerTitle: isDark ? 'text-zinc-100' : 'text-zinc-900',
        mobileNavActive: isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-white',
        mobileNavInactive: isDark ? 'text-zinc-400 border border-zinc-800' : 'text-zinc-500 border border-zinc-200',
        toggleBtn: isDark ? 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 border-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-200',

        cardBg: isDark ? 'bg-zinc-900' : 'bg-white',
        cardBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        subtext: isDark ? 'text-zinc-400' : 'text-zinc-500',
        panelHeading: isDark ? 'text-zinc-300' : 'text-zinc-700',
        track: isDark ? 'bg-zinc-800' : 'bg-zinc-100',

        numTotal: isDark ? 'text-white' : 'text-zinc-900',
        numStore: isDark ? 'text-emerald-400' : 'text-emerald-600',
        numBreve: isDark ? 'text-amber-400' : 'text-amber-600',
        numBacklog: isDark ? 'text-zinc-400' : 'text-zinc-700',

        pillActive: isDark ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-orange-500 text-white border-orange-500',
        pillInactive: isDark ? 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400',

        phaseLabel: isDark ? 'text-zinc-200' : 'text-zinc-800',
        timelineLine: isDark ? 'bg-zinc-800' : 'bg-zinc-200',
        chipBubbleBg: isDark ? 'bg-zinc-900' : 'bg-white',
        chipBubbleBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        emptyPhase: isDark ? 'text-zinc-600' : 'text-zinc-400',
        tooltipBg: isDark ? 'bg-zinc-950' : 'bg-white',
        tooltipBorder: isDark ? 'border-zinc-700' : 'border-zinc-200',
        tooltipText: isDark ? 'text-zinc-200' : 'text-zinc-700',
        tooltipLabel: isDark ? 'text-zinc-500' : 'text-zinc-400',

        tableWrapBg: isDark ? 'bg-zinc-900' : 'bg-white',
        tableWrapBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        theadBg: isDark ? 'bg-zinc-950' : 'bg-zinc-50',
        theadBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        tbodyDivide: isDark ? 'divide-zinc-800/50' : 'divide-zinc-200',
        rowHover: isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50',
        rowIndex: isDark ? 'text-zinc-500' : 'text-zinc-400',
        rowName: isDark ? 'text-zinc-200' : 'text-zinc-900',
        rowNameHover: isDark ? 'group-hover:text-indigo-400' : 'group-hover:text-indigo-600',
        rowFase: isDark ? 'text-zinc-400' : 'text-zinc-500',

        modalBg: isDark ? 'bg-zinc-950' : 'bg-white',
        modalBorder: isDark ? 'border-zinc-800' : 'border-zinc-200',
        modalClose: isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200',
        modalTitle: isDark ? 'text-white' : 'text-zinc-900',
        modalDivider: isDark ? 'border-zinc-800' : 'border-zinc-200',
        modalLabel: isDark ? 'text-zinc-500' : 'text-zinc-400',
        modalValue: isDark ? 'text-zinc-200' : 'text-zinc-800',
        marketplaceBadge: isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200',

        scrollbarThumb: isDark ? '#3f3f46' : '#d4d4d8',
    };

    const PHASES = React.useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayDate = new Date(currentYear, currentMonth, 1);

        const phaseLabels: string[] = [];
        for (const p of PRODUCTS) {
            if (!p.f || p.s === 'backlog') continue;
            const [monthStr, yearStr] = p.f.split(' ');
            if (!monthStr || !yearStr || !(monthStr in MONTH_MAP)) continue;
            if (!phaseLabels.includes(p.f)) phaseLabels.push(p.f);
        }

        const currentLabel = `${MONTH_NAMES_SHORT[currentMonth]} ${currentYear}`;
        if (!phaseLabels.includes(currentLabel)) {
            phaseLabels.push(currentLabel);
        }

        phaseLabels.sort((a, b) => {
            const [mA, yA] = a.split(' ');
            const [mB, yB] = b.split(' ');
            const valA = parseInt(yA) * 12 + MONTH_MAP[mA];
            const valB = parseInt(yB) * 12 + MONTH_MAP[mB];
            return valA - valB;
        });

        const phases = phaseLabels.map(f => {
            const [monthStr, yearStr] = f.split(' ');
            const year = parseInt(yearStr);
            const month = MONTH_MAP[monthStr];
            const phaseDate = new Date(year, month, 1);

            if (phaseDate.getTime() === todayDate.getTime()) {
                return { f, t: 'in', lb: 'produtos em andamento', now: true };
            } else if (phaseDate.getTime() < todayDate.getTime()) {
                return { f, t: 'done', lb: 'produtos disponíveis', now: false };
            } else {
                return { f, t: 'next', lb: 'próximos produtos', now: false };
            }
        });

        phases.push({ f: '—', t: 'backlog', lb: 'backlog', now: false } as any);
        return phases;
    }, [PRODUCTS]);


    const directorateFilters = React.useMemo(() => {
        const set = new Set<string>(['DDS', 'DIT', 'DRM', 'PRE']);
        (EXTRA_OPTIONS.diretoria ?? []).forEach(v => set.add(v));
        PRODUCTS.forEach(p => p.d && set.add(p.d));
        return ['all', ...Array.from(set)];
    }, [PRODUCTS, EXTRA_OPTIONS]);

    const { tableFilters, statusValues, dirValues } = React.useMemo(() => {
        const statusSet = new Set<string>(['store', 'breve', 'backlog']);
        const dirSet = new Set<string>(['DDS', 'DIT', 'DRM', 'PRE']);
        (EXTRA_OPTIONS.diretoria ?? []).forEach(v => dirSet.add(v));
        (EXTRA_OPTIONS.status ?? []).forEach(v => statusSet.add(v));
        PRODUCTS.forEach(p => {
            if (p.s) statusSet.add(p.s);
            if (p.d) dirSet.add(p.d);
        });
        return {
            statusValues: statusSet,
            dirValues: dirSet,
            tableFilters: ['all', ...Array.from(statusSet), ...Array.from(dirSet)],
        };
    }, [PRODUCTS, EXTRA_OPTIONS]);

    const storeProds = PRODUCTS.filter(p => p.s === 'store').length;
    const breveProds = PRODUCTS.filter(p => p.s === 'breve').length;
    const backProds = PRODUCTS.filter(p => p.s === 'backlog').length;

    const filteredRoadmapProds = roadmapFilter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.d === roadmapFilter);
    const filteredTableProds = prodFilter === 'all'
        ? PRODUCTS
        : dirValues.has(prodFilter)
            ? PRODUCTS.filter(p => p.d === prodFilter)
            : PRODUCTS.filter(p => p.s === prodFilter);

    const activeProd = PRODUCTS.find(p => p.id === selectedProdId);

    return (
        <div className={`w-full h-full flex ${T.rootBg} ${T.rootText} rounded-2xl overflow-hidden border ${T.rootBorder} transition-colors duration-200`}>
            {/* Sidebar */}
            <div className={`w-64 ${T.sidebarBg} border-r ${T.sidebarBorder} flex flex-col overflow-y-auto hidden md:flex transition-colors duration-200`}>
                <div className={`p-6 border-b ${T.sidebarBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg text-lg">P</div>
                        <div>
                            <div className="font-bold text-base leading-tight">Prodam Store</div>
                            <div className={`text-[10px] ${T.accentText} tracking-wider uppercase mt-1`}>Gestão de Produto</div>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1 space-y-6">
                    <div>
                        <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-3 mb-2">Visão Geral</div>
                        <div className="space-y-1">
                            <button
                                onClick={() => setView('overview')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'overview' ? T.navActive : T.navInactive}`}
                            >
                                <BarChart3 className="w-4 h-4" />
                                Painel Geral
                            </button>
                            <button
                                onClick={() => setView('roadmap')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'roadmap' ? T.navActive : T.navInactive}`}
                            >
                                <Calendar className="w-4 h-4" />
                                Roadmap
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-3 mb-2">Produtos</div>
                        <button
                            onClick={() => setView('produtos')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${view === 'produtos' ? T.navActive : T.navInactive}`}
                        >
                            <Package className="w-4 h-4" />
                            Todos os Produtos
                        </button>
                    </div>
                </div>

                <div className={`p-4 border-t ${T.sidebarBorder} text-xs text-zinc-500`}>
                    Novembro 2025 - {new Date().getFullYear()}
                </div>

            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <div className={`h-16 border-b ${T.headerBorder} ${T.headerBg} backdrop-blur flex items-center px-6 justify-between flex-shrink-0 transition-colors duration-200`}>
                    <div className={`font-bold text-lg ${T.headerTitle}`}>
                        {view === 'overview' && 'Painel Geral'}
                        {view === 'roadmap' && 'Roadmap de Lançamentos'}
                        {view === 'produtos' && 'Listagem de Produtos'}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Mobile nav quick toggles */}
                        <div className="md:hidden flex gap-2">
                             <button onClick={() => setView('overview')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'overview' ? T.mobileNavActive : T.mobileNavInactive}`}>Geral</button>
                             <button onClick={() => setView('roadmap')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'roadmap' ? T.mobileNavActive : T.mobileNavInactive}`}>Roadmap</button>
                             <button onClick={() => setView('produtos')} className={`px-3 py-1.5 text-xs rounded-md ${view === 'produtos' ? T.mobileNavActive : T.mobileNavInactive}`}>Produtos</button>
                        </div>
                        {/* Alternância de tema — só renderizada aqui quando não há um cabeçalho externo controlando o tema (uso standalone em /store). Dentro do DashboardShell, o botão vive no header principal. */}
                        {themeProp === undefined && (
                            <button
                                type="button"
                                onClick={toggleTheme}
                                title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                                aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${T.toggleBtn}`}
                            >
                                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
                    {/* OVERVIEW */}
                    {view === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className={`${T.cardBg} border ${T.cardBorder} p-5 rounded-xl border-l-4 border-l-indigo-500 transition-colors duration-200`}>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total no portfólio</div>
                                    <div className={`text-3xl font-black ${T.numTotal}`}>{PRODUCTS.length}</div>
                                    <div className={`text-sm ${T.subtext} mt-1`}>produtos mapeados</div>
                                </div>
                                <div className={`${T.cardBg} border ${T.cardBorder} p-5 rounded-xl border-l-4 border-l-emerald-500 transition-colors duration-200`}>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Na Store</div>
                                    <div className={`text-3xl font-black ${T.numStore}`}>{storeProds}</div>
                                    <div className={`text-sm ${T.subtext} mt-1`}>disponíveis hoje</div>
                                </div>
                                <div className={`${T.cardBg} border ${T.cardBorder} p-5 rounded-xl border-l-4 border-l-amber-500 transition-colors duration-200`}>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Em breve</div>
                                    <div className={`text-3xl font-black ${T.numBreve}`}>{breveProds}</div>
                                    <div className={`text-sm ${T.subtext} mt-1`}>com previsão</div>
                                </div>
                                <div className={`${T.cardBg} border ${T.cardBorder} p-5 rounded-xl border-l-4 border-l-zinc-500 transition-colors duration-200`}>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Backlog</div>
                                    <div className={`text-3xl font-black ${T.numBacklog}`}>{backProds}</div>
                                    <div className={`text-sm ${T.subtext} mt-1`}>sem data definida</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className={`${T.cardBg} border ${T.cardBorder} rounded-xl p-6 transition-colors duration-200`}>
                                    <h3 className={`text-sm font-bold ${T.panelHeading} mb-6 uppercase tracking-wider`}>Por Diretoria</h3>
                                    <div className="space-y-4">
                                        {['DDS', 'DIT', 'DRM', 'PRE'].map(dir => {
                                            const count = PRODUCTS.filter(p => p.d === dir).length;
                                            const pct = Math.round((count / PRODUCTS.length) * 100);
                                            return (
                                                <div key={dir}>
                                                    <div className="flex justify-between mb-1 text-sm">
                                                        <span className="font-bold flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[dir]}`}></div>
                                                            {dir}
                                                        </span>
                                                        <span className={T.subtext}>{count} ({pct}%)</span>
                                                    </div>
                                                    <div className={`w-full ${T.track} rounded-full h-2`}>
                                                        <div className={`h-2 rounded-full ${DIR_DOT_COLORS[dir]} opacity-80`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={`${T.cardBg} border ${T.cardBorder} rounded-xl p-6 transition-colors duration-200`}>
                                    <h3 className={`text-sm font-bold ${T.panelHeading} mb-6 uppercase tracking-wider`}>Status</h3>
                                    <div className="space-y-4">
                                        {[
                                            { s: 'store', label: 'Na Store', color: 'bg-emerald-500', count: storeProds },
                                            { s: 'breve', label: 'Em breve', color: 'bg-amber-500', count: breveProds },
                                            { s: 'backlog', label: 'Backlog', count: backProds, color: 'bg-zinc-500' }
                                        ].map(stat => {
                                            const pct = Math.round((stat.count / PRODUCTS.length) * 100);
                                            return (
                                                <div key={stat.s}>
                                                    <div className="flex justify-between mb-1 text-sm">
                                                        <span className="font-bold flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${stat.color}`}></div>
                                                            {stat.label}
                                                        </span>
                                                        <span className={T.subtext}>{stat.count} ({pct}%)</span>
                                                    </div>
                                                    <div className={`w-full ${T.track} rounded-full h-2`}>
                                                        <div className={`h-2 rounded-full ${stat.color} opacity-80`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ROADMAP */}
                    {view === 'roadmap' && (
                        <div>
                            <div className="flex flex-wrap gap-2 mb-8">
                                <span className="text-sm font-bold text-zinc-500 py-1.5 mr-2 uppercase">Filtrar:</span>
                                {directorateFilters.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setRoadmapFilter(f)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${roadmapFilter === f ? T.pillActive : T.pillInactive}`}
                                    >
                                        {f !== 'all' && <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[f] ?? 'bg-zinc-500'}`}></div>}
                                        {f === 'all' ? 'Todas' : f}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                {PHASES.map((ph, idx) => {
                                    const items = filteredRoadmapProds.filter(p => ph.t === 'backlog' ? p.s === 'backlog' : p.f === ph.f);

                                    return (
                                        <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                            {/* Phase Info */}
                                            <div className={`sm:w-36 flex-shrink-0 flex items-center sm:items-end justify-between sm:justify-start sm:flex-col pt-3 border-b-2 sm:border-b-0 ${T.headerBorder} pb-2 sm:pb-0`}>
                                                <div className={`font-bold ${T.phaseLabel} text-sm sm:text-right flex items-center gap-2 sm:block sm:mb-1`}>
                                                    {ph.f} {ph.now ? ' - ' : ''}
                                                    {ph.now && <span className="px-2 py-0.5 rounded-full bg-amber-500 text-[9px] text-white uppercase sm:ml-0 inline-block align-middle animate-pulse">Agora</span>}
                                                </div>
                                                <div className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${PHASE_TAG_COLORS[ph.t] ?? PHASE_TAG_COLORS.backlog}`}>
                                                    {ph.lb}
                                                </div>
                                            </div>

                                            {/* Timeline Visual (Desktop only) */}
                                            <div className="hidden sm:flex flex-col items-center flex-shrink-0 pt-4">
                                                <div className={`w-3 h-3 rounded-full flex-shrink-0 relative ${PHASE_DOT_COLORS[ph.t] ?? PHASE_DOT_COLORS.backlog}`}></div>
                                                {idx < PHASES.length - 1 && <div className={`w-[2px] ${T.timelineLine} flex-1 mt-2 mb-[-1rem] relative z-0`}></div>}
                                            </div>

                                            {/* Chips Bubble */}
                                            <div className={`flex-1 ${T.chipBubbleBg} border ${T.chipBubbleBorder} rounded-xl p-4 sm:mt-1 transition-colors duration-200`}>
                                                {items.length === 0 ? (
                                                    <div className={`text-xs ${T.emptyPhase} italic`}>Nenhum produto listado nesta fase.</div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {items.map(p => (
                                                            <div key={p.id} className="relative group/chip">
                                                                <button
                                                                    onClick={() => setSelectedProdId(p.id)}
                                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-transform hover:scale-105 flex items-center gap-2 ${STAT_COLORS[p.s as keyof typeof STAT_COLORS] ?? STAT_COLORS.backlog}`}
                                                                >
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[p.d] ?? 'bg-zinc-500'}`}></div>
                                                                    {p.n}
                                                                </button>
                                                                <div className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md ${T.tooltipBg} border ${T.tooltipBorder} text-[11px] font-medium ${T.tooltipText} whitespace-nowrap opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150 z-20 shadow-lg`}>
                                                                    <span className={`text-[9px] uppercase tracking-wider ${T.tooltipLabel} mr-1.5`}>Responsável:</span>
                                                                    {p.r && p.r.trim() ? p.r : 'Não definido'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* PRODUTOS (Table) */}
                    {view === 'produtos' && (
                        <div className="flex flex-col">
                            <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
                                <span className="text-sm font-bold text-zinc-500 py-1.5 mr-2 uppercase">Filtrar:</span>
                                {tableFilters.map(f => {
                                    const isDir = dirValues.has(f);
                                    const isStatus = statusValues.has(f);
                                    const label =
                                        f === 'all' ? 'Todos'
                                        : f === 'store' ? '✅ Na Store'
                                        : f === 'breve' ? '🔜 Em breve'
                                        : f === 'backlog' ? '📋 Backlog'
                                        : isStatus ? STAT_LABELS[f as keyof typeof STAT_LABELS] ?? f
                                        : f;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => setProdFilter(f)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${prodFilter === f ? T.pillActive : T.pillInactive}`}
                                        >
                                            {isDir && <div className={`w-2 h-2 rounded-full ${DIR_DOT_COLORS[f] ?? 'bg-zinc-500'}`}></div>}
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className={`${T.tableWrapBg} border ${T.tableWrapBorder} rounded-xl overflow-x-auto custom-scrollbar transition-colors duration-200`}>
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className={`${T.theadBg} text-xs font-bold text-zinc-500 uppercase tracking-wider`}>
                                            <th className={`px-4 py-3 border-b ${T.theadBorder} w-12 text-center`}>#</th>
                                            <th className={`px-4 py-3 border-b ${T.theadBorder}`}>Produto</th>
                                            <th className={`px-4 py-3 border-b ${T.theadBorder}`}>Diretoria</th>
                                            <th className={`px-4 py-3 border-b ${T.theadBorder}`}>Status</th>
                                            <th className={`px-4 py-3 border-b ${T.theadBorder}`}>Fase</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${T.tbodyDivide}`}>
                                        {filteredTableProds.map((p, i) => (
                                            <tr key={p.id} onClick={() => setSelectedProdId(p.id)} className={`${T.rowHover} cursor-pointer transition-colors group`}>
                                                <td className={`px-4 py-3 text-sm ${T.rowIndex} text-center`}>{i + 1}</td>
                                                <td className={`px-4 py-3 text-sm font-bold ${T.rowName} ${T.rowNameHover}`}>{p.n}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${DIR_COLORS[p.d]}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[p.d]}`}></span>
                                                        {p.d}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${STAT_COLORS[p.s as keyof typeof STAT_COLORS]}`}>
                                                        {STAT_LABELS[p.s as keyof typeof STAT_LABELS]}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-sm font-medium ${T.rowFase}`}>{p.f}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {activeProd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProdId(null)}>
                    <div className={`${T.modalBg} border ${T.modalBorder} rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedProdId(null)} className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg ${T.modalClose} transition-colors`}>×</button>

                        <h2 className={`text-xl font-black ${T.modalTitle} pr-8 mb-4`}>{activeProd.n}</h2>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md border ${DIR_COLORS[activeProd.d]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${DIR_DOT_COLORS[activeProd.d]}`}></span>
                                {activeProd.d}
                            </span>
                            <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${STAT_COLORS[activeProd.s as keyof typeof STAT_COLORS]}`}>
                                {STAT_LABELS[activeProd.s as keyof typeof STAT_LABELS]}
                            </span>
                            {activeProd.mkt && (
                                <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${T.marketplaceBadge}`}>
                                    🏪 Marketplace
                                </span>
                            )}
                        </div>

                        <div className={`space-y-4 pt-4 border-t ${T.modalDivider}`}>
                            <div>
                                <div className={`text-[10px] font-bold ${T.modalLabel} uppercase tracking-wider mb-1`}>Categoria</div>
                                <div className={`text-sm font-medium ${T.modalValue}`}>{activeProd.cat}</div>
                            </div>
                            <div>
                                <div className={`text-[10px] font-bold ${T.modalLabel} uppercase tracking-wider mb-1`}>Diretoria</div>
                                <div className={`text-sm font-medium ${T.modalValue}`}>{DIR_NAMES[activeProd.d]}</div>
                            </div>
                            <div>
                                <div className={`text-[10px] font-bold ${T.modalLabel} uppercase tracking-wider mb-1`}>Fase de entrega</div>
                                <div className={`text-sm font-medium ${T.modalValue}`}>{activeProd.f}</div>
                            </div>
                            <div>
                                <div className={`text-[10px] font-bold ${T.modalLabel} uppercase tracking-wider mb-1`}>Pessoa responsável</div>
                                <div className={`text-sm font-medium ${T.modalValue}`}>{activeProd.r && activeProd.r.trim() ? activeProd.r : '—'}</div>
                            </div>
                            <div>
                                <div className={`text-[10px] font-bold ${T.modalLabel} uppercase tracking-wider mb-1`}>Disponível no Marketplace</div>
                                <div className={`text-sm font-medium ${T.modalValue}`}>{activeProd.mkt ? 'Sim' : 'Não'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: ${T.scrollbarThumb};
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
