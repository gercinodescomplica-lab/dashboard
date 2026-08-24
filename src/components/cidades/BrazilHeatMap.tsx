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
    lightActive?: boolean;
}

function colorForValue(val: number, maxVal: number, lightActive = false): string {
    if (!val || !maxVal) return lightActive ? '#f4f4f5' : '#27272a'; // zinc-100 / zinc-800
    const ratio = Math.sqrt(val / maxVal);
    // Dark mode gradient: from subtle indigo (rgb(49, 46, 129)) to vivid indigo (rgb(99, 102, 241))
    // Light mode gradient: from soft indigo (rgb(199, 210, 254)) to strong indigo (rgb(79, 70, 229))
    const start = lightActive ? [199, 210, 254] : [49, 46, 129];
    const end = lightActive ? [79, 70, 229] : [99, 102, 241];
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * ratio));
    return `rgb(${rgb.join(',')})`;
}

export function BrazilHeatMap({ leads, onSelectUf, lightActive = false }: BrazilHeatMapProps) {
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
        <div className={`relative w-full h-[520px] border rounded-2xl p-4 flex flex-col justify-between overflow-hidden transition-colors duration-200 ${lightActive ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/60 border-zinc-800/80'}`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-2 z-10 ${lightActive ? 'border-zinc-200' : 'border-zinc-800/60'}`}>
                <div>
                    <h3 className={`text-base font-bold uppercase tracking-wider ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                        Mapa de Calor de Oportunidades
                    </h3>
                    <p className={`text-xs ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Estados coloridos por volume financeiro · Marcadores (pins) nas cidades
                    </p>
                </div>
                {onSelectUf && (
                    <span className={`text-xs font-medium ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>
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
                                const fill = colorForValue(data?.valor || 0, ufStats.maxVal, lightActive);

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
                                                stroke: lightActive ? '#d4d4d8' : '#18181b', // zinc-300 / zinc-900
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
                    <div className={`pointer-events-none absolute top-4 right-4 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md min-w-[200px] z-20 transition-all ${lightActive ? 'border-zinc-200 bg-white/95' : 'border-zinc-700 bg-zinc-900/95'}`}>
                        {hoverPin ? (
                            <>
                                <div className={`text-sm font-bold flex items-center gap-1.5 ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                    <span>📍</span>
                                    <span>{hoverPin.municipio}</span>
                                    <span className={`font-normal ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>({hoverPin.uf})</span>
                                </div>
                                <div className={`text-xs mt-1 ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    {hoverPin.count} oportunidade(s)
                                </div>
                                <div className={`text-base font-bold font-mono mt-1 ${lightActive ? 'text-rose-600' : 'text-rose-400'}`}>
                                    {formatCurrency(hoverPin.valor)}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={`text-sm font-bold ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                    {hoverState?.name} <span className={`font-normal ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>({hoverState?.uf})</span>
                                </div>
                                <div className={`text-xs mt-1 ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    {hoverState?.count} oportunidade(s)
                                </div>
                                <div className={`text-base font-bold font-mono mt-1 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`}>
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
