'use client';

import { Visit } from '@/types/manager';
import { MapPin, Calendar } from 'lucide-react';

interface VisitsTabProps {
    items: Visit[];
}

export function VisitsTab({ items }: VisitsTabProps) {
    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-zinc-500">
                Nenhuma visita registrada para este gerente.
            </div>
        );
    }

    const sorted = [...items].sort((a, b) => b.data.localeCompare(a.data));

    return (
        <div className="flex flex-col gap-3">
            {sorted.map((visit, i) => {
                const dateDisplay = visit.data
                    ? new Date(visit.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—';

                return (
                    <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Date bubble */}
                        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold shrink-0 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1.5 w-fit">
                            <Calendar className="w-3.5 h-3.5" />
                            {dateDisplay}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{visit.titulo}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-zinc-400">
                                    <MapPin className="w-3 h-3 text-zinc-600" />
                                    {visit.local}
                                </span>
                                <span className="text-zinc-700">·</span>
                                <span className="text-xs text-zinc-400">{visit.motivo}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
