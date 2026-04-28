'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ContratoRow } from '@/db/queries';
import { ContractsTable } from '@/app/contracts/components/ContractsTable';
import { searchContratosAction, getManagersListAction } from '@/app/contracts/actions';

export function ContractsEditor() {
    const [contratos, setContratos] = useState<ContratoRow[] | null>(null);
    const [managersList, setManagersList] = useState<{ id: string; name: string; role: string }[]>([]);

    useEffect(() => {
        Promise.all([
            searchContratosAction(''),
            getManagersListAction(),
        ]).then(([c, m]) => {
            setContratos(c);
            setManagersList(m);
        });
    }, []);

    if (contratos === null) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando contratos...
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
            <ContractsTable initialData={contratos} managersList={managersList} />
        </div>
    );
}
