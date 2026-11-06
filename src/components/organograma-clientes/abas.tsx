'use client';
// Troca Pessoas | Clientes da aba Organograma (= abas-organograma.tsx do AIBertinho). Clientes é só leitura (D8).
import { useEffect, useState } from 'react';
import { Building2, Loader2, Network } from 'lucide-react';
import OrganizationChartView from '@/components/dashboard/OrganizationChartView';
import { carregarOrganogramaClientesAction } from '@/app/settings/carteiraActions';
import type { OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import { OrganogramaClientesView } from './quadro';

export function OrganogramaComAbas({ lightActive }: { lightActive: boolean }) {
    const [aba, setAba] = useState<'pessoas' | 'clientes'>('pessoas');
    const [dados, setDados] = useState<OrganogramaClientes | null>(null);

    useEffect(() => {
        if (aba === 'clientes' && !dados) void carregarOrganogramaClientesAction().then(setDados);
    }, [aba, dados]);

    const botao = (id: 'pessoas' | 'clientes', rotulo: string, Icone: typeof Network) => (
        <button
            type="button"
            aria-pressed={aba === id}
            onClick={() => setAba(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors ${aba === id
                ? (lightActive ? 'bg-white text-zinc-900 shadow-sm' : 'bg-zinc-800 text-zinc-100 shadow-sm')
                : (lightActive ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200')}`}
        >
            <Icone className="h-4 w-4" aria-hidden="true" /> {rotulo}
        </button>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <nav aria-label="Organograma" className={`inline-flex w-fit items-center gap-1 rounded-md border p-1 ${lightActive ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-800 bg-zinc-900'}`}>
                {botao('pessoas', 'Pessoas', Network)}
                {botao('clientes', 'Clientes', Building2)}
            </nav>
            {aba === 'pessoas' ? <OrganizationChartView lightActive={lightActive} />
                : dados ? <div className="min-h-[70dvh] flex-1"><OrganogramaClientesView dados={dados} podeMover={false} /></div>
                : <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />}
        </div>
    );
}
