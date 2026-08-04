'use client';

import { Building2, CheckCircle2 } from 'lucide-react';

interface ClientsTabProps {
    clients?: string[];
}

export function ClientsTab({ clients = [] }: ClientsTabProps) {
    if (!clients || clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
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
                        className="group flex items-center gap-3 p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-300"
                    >
                        <div className="flex-shrink-0">
                            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                                <Building2 className="w-3 h-3 text-zinc-400 group-hover:text-indigo-400" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h5 className="font-semibold text-xs text-zinc-100 group-hover:text-indigo-300 transition-colors uppercase tracking-wider truncate">
                                    {acronym}
                                </h5>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500/50 flex-shrink-0" />
                            </div>
                            {description && (
                                <p className="text-xs text-zinc-500 leading-tight group-hover:text-zinc-400 transition-colors truncate">
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
