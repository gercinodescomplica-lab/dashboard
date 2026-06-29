'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { PropostaRow } from '@/db/queries';
import { ProposalsTable } from '@/app/proposals/components/ProposalsTable';
import { searchPropostasAction, getManagersListAction } from '@/app/proposals/actions';

export function ProposalsEditor() {
    const [propostas, setPropostas] = useState<PropostaRow[] | null>(null);
    const [managersList, setManagersList] = useState<{ id: string; name: string; role: string }[]>([]);

    useEffect(() => {
        Promise.all([
            searchPropostasAction(''),
            getManagersListAction(),
        ]).then(([p, m]) => {
            setPropostas(p);
            setManagersList(m);
        });
    }, []);

    if (propostas === null) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando propostas...
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
            <ProposalsTable initialData={propostas} managersList={managersList} />
        </div>
    );
}
