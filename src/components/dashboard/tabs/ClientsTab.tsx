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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clients.map((client, index) => {
                // Split acronym and full name if present (e.g., "PGM (Procuradoria...)")
                const match = client.match(/^([^(]+)\s*\(([^)]+)\)$/);
                const acronym = match ? match[1].trim() : client;
                const description = match ? match[2].trim() : null;

                return (
                    <div 
                        key={index}
                        className="group flex items-start gap-4 p-5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-300"
                    >
                        <div className="mt-1 flex-shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-colors">
                                <Building2 className="w-5 h-5 text-zinc-400 group-hover:text-indigo-400" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors uppercase tracking-wider">
                                    {acronym}
                                </h5>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                            </div>
                            {description && (
                                <p className="text-sm text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">
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
