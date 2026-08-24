'use client';

import { Building2, CheckCircle2 } from 'lucide-react';

interface ClientsTabProps {
    clients?: string[];
    lightActive?: boolean;
}

export function ClientsTab({ clients = [], lightActive = false }: ClientsTabProps) {
    if (!clients || clients.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed transition-colors duration-200 ${lightActive ? 'text-zinc-400 bg-zinc-50 border-zinc-200' : 'text-zinc-500 bg-zinc-900/20 border-zinc-800'}`}>
                <Building2 className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg">Nenhum cliente mapeado para este gerente.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {clients.map((client, index) => {
                // Split acronym and full name if present (e.g., "PGM (Procuradoria...)")
                const match = client.match(/^([^(]+)\s*\(([^)]+)\)$/);
                const acronym = match ? match[1].trim() : client;
                const description = match ? match[2].trim() : null;

                return (
                    <div
                        key={index}
                        className={`group flex items-center gap-3 p-3 border rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-300 ${lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/50'}`}
                    >
                        <div className="flex-shrink-0">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors ${lightActive ? 'bg-zinc-100' : 'bg-zinc-800'}`}>
                                <Building2 className={`w-3 h-3 group-hover:text-indigo-400 ${lightActive ? 'text-zinc-500' : 'text-zinc-400'}`} />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h5 className={`font-semibold text-xs group-hover:text-indigo-300 transition-colors uppercase tracking-wider truncate ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                    {acronym}
                                </h5>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500/50 flex-shrink-0" />
                            </div>
                            {description && (
                                <p className={`text-xs leading-tight group-hover:text-zinc-400 transition-colors truncate ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
