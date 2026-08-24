'use client';

import { Visit } from '@/types/manager';
import { MapPin, Calendar } from 'lucide-react';

interface VisitsTabProps {
    items: Visit[];
    lightActive?: boolean;
}

export function VisitsTab({ items, lightActive = false }: VisitsTabProps) {
    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center py-20 ${lightActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Nenhuma visita registrada para este gerente.
            </div>
        );
    }

    const sorted = [...items].sort((a, b) => {
        const timeA = a.data ? new Date(a.data + 'T00:00:00').getTime() : 0;
        const timeB = b.data ? new Date(b.data + 'T00:00:00').getTime() : 0;
        return timeB - timeA;
    });

    return (
        <div className="flex flex-col gap-3">
            {sorted.map((visit, i) => {
                const formattedDate = visit.data ? new Date(visit.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
                const dateDisplay = formattedDate ? `Semana do dia ${formattedDate}` : '—';

                return (
                    <div key={i} className={`border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors duration-200 ${lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/60 border-zinc-800'}`}>
                        {/* Date bubble */}
                        <div className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 border rounded-lg px-3 py-1.5 w-fit ${lightActive ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {dateDisplay}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>{visit.titulo}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className={`flex items-center gap-1 text-xs ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    <MapPin className={`w-3 h-3 ${lightActive ? 'text-zinc-400' : 'text-zinc-600'}`} />
                                    {visit.local}
                                </span>
                                <span className={lightActive ? 'text-zinc-300' : 'text-zinc-700'}>·</span>
                                <span className={`text-xs ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`}>{visit.motivo}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
