'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import { fetchOrgChart } from '@/app/settings/orgChartActions';
import { DEFAULT_ORG_CHART } from '@/lib/orgChartDefault';
import {
    ORG_TAG_LABELS,
    ORG_TAG_CLASSES,
    type OrgChartData,
    type OrgColor,
    type OrgDepartment,
    type OrgPerson,
    type OrgSection,
} from '@/types/orgChart';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

const COLOR_MAP_DARK: Record<OrgColor, {
    header: string;
    headerBorder: string;
    headerText: string;
    body: string;
    bodyBg: string;
    nucleoHeader: string;
    nucleoText: string;
    nucleoBorder: string;
    nucleoBg: string;
}> = {
    indigo: {
        header: 'bg-indigo-600',
        headerBorder: 'border-indigo-500',
        headerText: 'text-indigo-100/90',
        body: 'border-indigo-900/50',
        bodyBg: 'bg-zinc-900/30',
        nucleoHeader: 'bg-indigo-900/30',
        nucleoText: 'text-indigo-400',
        nucleoBorder: 'border-indigo-900/40',
        nucleoBg: 'bg-zinc-950/50',
    },
    emerald: {
        header: 'bg-emerald-600',
        headerBorder: 'border-emerald-500',
        headerText: 'text-emerald-100/90',
        body: 'border-emerald-900/50',
        bodyBg: 'bg-zinc-900/30',
        nucleoHeader: 'bg-emerald-900/30',
        nucleoText: 'text-emerald-400',
        nucleoBorder: 'border-emerald-900/40',
        nucleoBg: 'bg-zinc-950/50',
    },
    amber: {
        header: 'bg-amber-600',
        headerBorder: 'border-amber-500',
        headerText: 'text-amber-100/90',
        body: 'border-amber-900/50',
        bodyBg: 'bg-zinc-900/30',
        nucleoHeader: 'bg-amber-900/30',
        nucleoText: 'text-amber-500',
        nucleoBorder: 'border-amber-900/40',
        nucleoBg: 'bg-zinc-950/50',
    },
    purple: {
        header: 'bg-purple-700',
        headerBorder: 'border-purple-600',
        headerText: 'text-purple-100/90',
        body: 'border-purple-900/50',
        bodyBg: 'bg-zinc-900/30',
        nucleoHeader: 'bg-purple-900/30',
        nucleoText: 'text-purple-400',
        nucleoBorder: 'border-purple-900/40',
        nucleoBg: 'bg-zinc-950/50',
    },
    pink: {
        header: 'bg-pink-700',
        headerBorder: 'border-pink-600',
        headerText: 'text-pink-100/90',
        body: 'border-pink-900/50',
        bodyBg: 'bg-zinc-900/30',
        nucleoHeader: 'bg-pink-900/20',
        nucleoText: 'text-pink-400',
        nucleoBorder: 'border-pink-900/40',
        nucleoBg: 'bg-zinc-950/50',
    },
};

const COLOR_MAP_LIGHT: Record<OrgColor, typeof COLOR_MAP_DARK[OrgColor]> = {
    indigo: {
        header: 'bg-indigo-600',
        headerBorder: 'border-indigo-500',
        headerText: 'text-indigo-100/90',
        body: 'border-indigo-200',
        bodyBg: 'bg-white',
        nucleoHeader: 'bg-indigo-50',
        nucleoText: 'text-indigo-600',
        nucleoBorder: 'border-indigo-200',
        nucleoBg: 'bg-zinc-50',
    },
    emerald: {
        header: 'bg-emerald-600',
        headerBorder: 'border-emerald-500',
        headerText: 'text-emerald-100/90',
        body: 'border-emerald-200',
        bodyBg: 'bg-white',
        nucleoHeader: 'bg-emerald-50',
        nucleoText: 'text-emerald-600',
        nucleoBorder: 'border-emerald-200',
        nucleoBg: 'bg-zinc-50',
    },
    amber: {
        header: 'bg-amber-600',
        headerBorder: 'border-amber-500',
        headerText: 'text-amber-100/90',
        body: 'border-amber-200',
        bodyBg: 'bg-white',
        nucleoHeader: 'bg-amber-50',
        nucleoText: 'text-amber-600',
        nucleoBorder: 'border-amber-200',
        nucleoBg: 'bg-zinc-50',
    },
    purple: {
        header: 'bg-purple-700',
        headerBorder: 'border-purple-600',
        headerText: 'text-purple-100/90',
        body: 'border-purple-200',
        bodyBg: 'bg-white',
        nucleoHeader: 'bg-purple-50',
        nucleoText: 'text-purple-600',
        nucleoBorder: 'border-purple-200',
        nucleoBg: 'bg-zinc-50',
    },
    pink: {
        header: 'bg-pink-700',
        headerBorder: 'border-pink-600',
        headerText: 'text-pink-100/90',
        body: 'border-pink-200',
        bodyBg: 'bg-white',
        nucleoHeader: 'bg-pink-50',
        nucleoText: 'text-pink-600',
        nucleoBorder: 'border-pink-200',
        nucleoBg: 'bg-zinc-50',
    },
};

function getColorMap(lightActive: boolean) {
    return lightActive ? COLOR_MAP_LIGHT : COLOR_MAP_DARK;
}

function PersonRow({ person, lightActive }: { person: OrgPerson; lightActive: boolean }) {
    const subtext = lightActive ? 'text-zinc-500' : 'text-zinc-400';
    if (person.tag) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5">
                <span className={`text-[10px] ${subtext}`}>{person.name}</span>
                <span className={`text-[8px] font-medium px-1.5 rounded-full border truncate whitespace-nowrap ${ORG_TAG_CLASSES[person.tag]}`}>
                    {ORG_TAG_LABELS[person.tag]}
                </span>
            </div>
        );
    }
    return <div className={`text-[10px] px-2 ${subtext}`}>{person.name}</div>;
}

function SectionBlock({ section, colors, lightActive }: { section: OrgSection; colors: typeof COLOR_MAP_DARK[OrgColor]; lightActive: boolean }) {
    if (section.isNucleo) {
        return (
            <div className={`border ${colors.nucleoBorder} rounded ${colors.nucleoBg} overflow-hidden`}>
                <div className={`${colors.nucleoHeader} ${colors.nucleoText} p-1 flex flex-col px-2`}>
                    <span className="text-[10px] font-bold">{section.name}</span>
                    {section.nucleoSubtitle && <span className="text-[8px] opacity-80">{section.nucleoSubtitle}</span>}
                </div>
                <div className="p-1 px-2 pb-2">
                    {section.leader && (
                        <div className={`text-[11px] font-bold py-0.5 ${lightActive ? 'text-zinc-800' : 'text-zinc-200'}`}>{section.leader.name}</div>
                    )}
                    {section.people.map((p, i) => (
                        <PersonRow key={i} person={p} lightActive={lightActive} />
                    ))}
                </div>
            </div>
        );
    }
    return (
        <div>
            <div className={`text-[11px] font-bold px-2 py-0.5 rounded border mb-1 ${lightActive ? 'bg-zinc-100 border-zinc-200 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}>
                {section.name}
            </div>
            {section.people.map((p, i) => (
                <PersonRow key={i} person={p} lightActive={lightActive} />
            ))}
        </div>
    );
}

function DepartmentColumn({ dept, lightActive }: { dept: OrgDepartment; lightActive: boolean }) {
    const colors = getColorMap(lightActive)[dept.color];
    return (
        <div className="flex flex-col">
            <div className={`mx-auto w-[1.5px] h-3 -mt-6 ${lightActive ? 'bg-zinc-300' : 'bg-zinc-800'}`} />
            <div className={`${colors.header} p-2 text-center rounded-t-lg border ${colors.headerBorder} shadow-sm`}>
                <span className="block text-sm font-bold text-white leading-tight">{dept.name}</span>
                <span className={`block text-[9px] mt-0.5 ${colors.headerText}`}>{dept.subtitle}</span>
            </div>
            <div className={`border border-t-0 ${colors.body} ${colors.bodyBg} rounded-b-lg p-2 flex-1 space-y-3 shadow-inner`}>
                {dept.sections.map((s) => (
                    <SectionBlock key={s.id} section={s} colors={colors} lightActive={lightActive} />
                ))}
            </div>
        </div>
    );
}

interface Props {
    initialData?: OrgChartData;
    lightActive?: boolean;
}

export default function OrganizationChartView({ initialData, lightActive = false }: Props) {
    const [data, setData] = useState<OrgChartData | null>(initialData ?? null);
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    useEffect(() => {
        if (initialData) return;
        let cancelled = false;
        fetchOrgChart().then((d) => {
            if (!cancelled) setData(d);
        }).catch(() => {
            if (!cancelled) setData(DEFAULT_ORG_CHART);
        });
        return () => { cancelled = true; };
    }, [initialData]);

    const zoomIn = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
    const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
    const zoomReset = () => setZoom(1);

    const handleWheel = (e: React.WheelEvent) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        setZoom(z => {
            const next = z - Math.sign(e.deltaY) * ZOOM_STEP;
            return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +next.toFixed(2)));
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        // Não iniciar pan se clicou em botão / input / link
        if (target.closest('button, input, select, a, [role="button"]')) return;
        const el = containerRef.current;
        if (!el) return;
        panStart.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop,
        };
        setIsPanning(true);
    };

    useEffect(() => {
        if (!isPanning) return;
        const onMove = (e: MouseEvent) => {
            const el = containerRef.current;
            if (!el) return;
            el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
            el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
        };
        const onUp = () => setIsPanning(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isPanning]);

    if (!data) {
        return (
            <div className={`w-full h-full flex items-center justify-center rounded-2xl ${lightActive ? 'bg-white text-zinc-500' : 'bg-zinc-950/40 text-zinc-500'}`}>
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando organograma...
            </div>
        );
    }

    const subCount = data.subdirectors.length;
    const lineColor = lightActive ? 'bg-zinc-300' : 'bg-zinc-800';

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full rounded-2xl overflow-auto scrollbar-thin select-none ${lightActive ? 'bg-white scrollbar-thumb-zinc-300 scrollbar-track-transparent' : 'bg-zinc-950/40 scrollbar-thumb-zinc-800 scrollbar-track-transparent'} ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
        >
            <div className={`absolute top-3 right-3 z-20 flex items-center gap-1 p-1 rounded-lg border backdrop-blur-sm ${lightActive ? 'bg-white/90 border-zinc-200' : 'bg-zinc-900/80 border-zinc-800'}`}>
                <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}
                    className={`p-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Diminuir zoom">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <span className={`text-[11px] font-mono min-w-[42px] text-center tabular-nums ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}
                    className={`p-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Aumentar zoom">
                    <ZoomIn className="w-4 h-4" />
                </button>
                <div className={`w-px h-4 mx-0.5 ${lightActive ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                <button type="button" onClick={zoomReset} disabled={zoom === 1}
                    className={`p-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${lightActive ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Resetar zoom (100%)">
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-col p-6" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, minHeight: `${100 / zoom}%` }}>
                <div className="flex flex-col items-center mb-8">
                    <h2 className={`text-xl font-bold tracking-[0.2em] mb-6 ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>D R M</h2>

                    <div className="flex flex-col items-center">
                        <div className={`border rounded-xl px-10 py-3 text-center min-w-[200px] shadow-lg shadow-indigo-500/10 ${lightActive ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-950/80 border-indigo-800/50'}`}>
                            <div className={`text-[10px] font-medium tracking-[0.12em] uppercase mb-1 ${lightActive ? 'text-indigo-600' : 'text-indigo-300'}`}>{data.director.subtitle || 'Diretor'}</div>
                            <div className={`text-lg font-bold tracking-[0.08em] ${lightActive ? 'text-zinc-900' : 'text-white'}`}>{data.director.name}</div>
                        </div>
                    </div>

                    <div className={`w-[1.5px] h-6 my-0 relative ${lineColor}`}>
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1.5px] ${lineColor}`} style={{ width: '400px' }} />
                    </div>

                    <div className="flex justify-center gap-24 relative w-full mb-10">
                        {subCount === 2 && (
                            <>
                                <div className={`w-[1.5px] h-6 absolute -top-6 left-1/2 -ml-[200px] ${lineColor}`} />
                                <div className={`w-[1.5px] h-6 absolute -top-6 left-1/2 ml-[200px] ${lineColor}`} />
                            </>
                        )}
                        {data.subdirectors.map((s) => (
                            <div key={s.id} className={`border rounded-lg px-6 py-2 text-center min-w-[160px] ${lightActive ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-900/60 border-indigo-700/50'}`}>
                                <div className={`text-[13px] font-bold ${lightActive ? 'text-zinc-900' : 'text-white'}`}>{s.name}</div>
                                {s.subtitle && <div className={`text-[11px] mt-0.5 ${lightActive ? 'text-indigo-600' : 'text-indigo-300'}`}>{s.subtitle}</div>}
                                {s.people.map((p, i) => (
                                    <div key={i} className={`text-[11px] mt-0.5 ${lightActive ? 'text-indigo-500/90' : 'text-indigo-300/80'}`}>{p.name}</div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`w-full h-[1.5px] mb-6 ${lineColor}`} />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 flex-1">
                    {data.departments.map((d) => (
                        <DepartmentColumn key={d.id} dept={d} lightActive={lightActive} />
                    ))}
                </div>

                <div className={`flex flex-wrap gap-4 mt-8 p-3 rounded-lg border items-center justify-between ${lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800/80'}`}>
                    <div className="flex gap-4 items-center">
                        <span className={`text-[10px] font-medium ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>Legenda:</span>
                        <div className={`flex items-center gap-1.5 text-[10px] ${lightActive ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            Em contratação
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] ${lightActive ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                            A contratar
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] ${lightActive ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            A confirmar
                        </div>
                    </div>
                    <span className={`text-[10px] ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>Versão {data.version}</span>
                </div>
            </div>
        </div>
    );
}
