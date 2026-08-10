'use client';

import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { LeadCidade, MunicipioPin, UfStat } from '@/types/cidades';
import { formatCurrency } from '@/lib/format';
import municipiosGeo from '@/data/municipios-geo.json';

const GEO_URL = '/br-states.json';

interface BrazilHeatMapProps {
    leads: LeadCidade[];
    onSelectUf?: (uf: string) => void;
}

function colorForValue(val: number, maxVal: number): string {
    if (!val || !maxVal) return '#27272a'; // zinc-800
    const ratio = Math.sqrt(val / maxVal);
    // Dark mode gradient: from subtle indigo (rgb(49, 46, 129)) to vivid indigo (rgb(99, 102, 241))
    const start = [49, 46, 129];
    const end = [99, 102, 241];
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * ratio));
    return `rgb(${rgb.join(',')})`;
}

export function BrazilHeatMap({ leads, onSelectUf }: BrazilHeatMapProps) {
    const [hoverState, setHoverState] = useState<{ uf: string; name: string; count: number; valor: number } | null>(null);
    const [hoverPin, setHoverPin] = useState<MunicipioPin | null>(null);

    // Group by UF
    const ufStats = useMemo(() => {
        const map = new Map<string, { count: number; valor: number }>();
        let maxVal = 0;

        for (const lead of leads) {
            if (!lead.uf) continue;
            const current = map.get(lead.uf) || { count: 0, valor: 0 };
            current.count += 1;
            current.valor += lead.valor;
            map.set(lead.uf, current);

            if (current.valor > maxVal) {
                maxVal = current.valor;
            }
        }
        return { map, maxVal };
    }, [leads]);

    // Group by Municipio & cross-reference lat/lng from json
    const pins = useMemo(() => {
        const geoMap = new Map<string, { lat: number; lng: number }>();
        for (const m of municipiosGeo as any[]) {
            const key = `${m.uf}-${m.nome.toLowerCase()}`;
            geoMap.set(key, { lat: m.lat, lng: m.lng });
        }

        const pinMap = new Map<string, MunicipioPin>();
        let maxPinVal = 0;

        for (const lead of leads) {
            if (!lead.uf || !lead.municipio) continue;
            const key = `${lead.uf}-${lead.municipio}`;
            const geoKey = `${lead.uf}-${lead.municipio.toLowerCase()}`;
            const geoCoords = geoMap.get(geoKey);

            if (geoCoords) {
                const current = pinMap.get(key) || {
                    uf: lead.uf,
                    municipio: lead.municipio,
                    lat: geoCoords.lat,
                    lng: geoCoords.lng,
                    count: 0,
                    valor: 0,
                };
                current.count += 1;
                current.valor += lead.valor;
                pinMap.set(key, current);

                if (current.valor > maxPinVal) {
                    maxPinVal = current.valor;
                }
            }
        }

        return { list: Array.from(pinMap.values()), maxPinVal };
    }, [leads]);

    function getPinRadius(val: number) {
        if (!pins.maxPinVal) return 4;
        const t = Math.sqrt(val / pins.maxPinVal);
        return 4 + t * 10;
    }

    return (
        <div className="relative w-full h-[520px] bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-2 z-10">
                <div>
                    <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">
                        Mapa de Calor de Oportunidades
                    </h3>
                    <p className="text-xs text-zinc-400">
                        Estados coloridos por volume financeiro · Marcadores (pins) nas cidades
                    </p>
                </div>
                {onSelectUf && (
                    <span className="text-xs text-indigo-400 font-medium">
                        Clique em um estado ou cidade para filtrar
                    </span>
                )}
            </div>

            <div className="relative flex-1 w-full h-full flex items-center justify-center">
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ scale: 720, center: [-54, -15] }}
                    width={700}
                    height={540}
                    style={{ width: '100%', height: '100%', maxHeight: '460px' }}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }: { geographies: any[] }) =>
                            geographies.map((geo: any) => {
                                const uf = geo.properties.sigla;
                                const data = ufStats.map.get(uf);
                                const fill = colorForValue(data?.valor || 0, ufStats.maxVal);

                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        onMouseEnter={() =>
                                            setHoverState({
                                                uf,
                                                name: geo.properties.name,
                                                count: data?.count || 0,
                                                valor: data?.valor || 0,
                                            })
                                        }
                                        onMouseLeave={() => setHoverState(null)}
                                        onClick={() => onSelectUf?.(uf)}
                                        style={{
                                            default: {
                                                fill,
                                                stroke: '#18181b', // zinc-900
                                                strokeWidth: 0.8,
                                                outline: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            },
                                            hover: {
                                                fill: '#818cf8', // indigo-400
                                                stroke: '#ffffff',
                                                strokeWidth: 1.2,
                                                outline: 'none',
                                                cursor: 'pointer',
                                            },
                                            pressed: {
                                                fill: '#4338ca', // indigo-700
                                                outline: 'none',
                                            },
                                        }}
                                    />
                                );
                            })
                        }
                    </Geographies>

                    {pins.list.map((pin) => (
                        <Marker
                            key={`${pin.uf}-${pin.municipio}`}
                            coordinates={[pin.lng, pin.lat]}
                            onMouseEnter={() => setHoverPin(pin)}
                            onMouseLeave={() => setHoverPin(null)}
                            onClick={() => onSelectUf?.(pin.uf)}
                        >
                            <circle
                                r={getPinRadius(pin.valor)}
                                fill="#f43f5e" // rose-500
                                fillOpacity={0.8}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                style={{ cursor: 'pointer' }}
                            />
                        </Marker>
                    ))}
                </ComposableMap>

                {/* Tooltip Float */}
                {(hoverPin || hoverState) && (
                    <div className="pointer-events-none absolute top-4 right-4 rounded-xl border border-zinc-700 bg-zinc-900/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[200px] z-20 transition-all">
                        {hoverPin ? (
                            <>
                                <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                                    <span>📍</span>
                                    <span>{hoverPin.municipio}</span>
                                    <span className="text-zinc-400 font-normal">({hoverPin.uf})</span>
                                </div>
                                <div className="text-xs text-zinc-400 mt-1">
                                    {hoverPin.count} oportunidade(s)
                                </div>
                                <div className="text-base font-bold font-mono text-rose-400 mt-1">
                                    {formatCurrency(hoverPin.valor)}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-sm font-bold text-zinc-100">
                                    {hoverState?.name} <span className="text-zinc-400 font-normal">({hoverState?.uf})</span>
                                </div>
                                <div className="text-xs text-zinc-400 mt-1">
                                    {hoverState?.count} oportunidade(s)
                                </div>
                                <div className="text-base font-bold font-mono text-indigo-400 mt-1">
                                    {formatCurrency(hoverState?.valor || 0)}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
