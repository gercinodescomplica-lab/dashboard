'use client';
// Troca Pessoas | Clientes da aba Organograma (= abas-organograma.tsx do AIBertinho). Clientes é só leitura (D8).
import { useEffect, useState } from 'react';
import { Building2, Loader2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrganizationChartView from '@/components/dashboard/OrganizationChartView';
import { carregarOrganogramaClientesAction } from '@/app/settings/carteiraActions';
import type { OrganogramaClientes } from '@/lib/carteira/organograma-clientes';
import { OrganogramaClientesView } from './quadro';

export function OrganogramaComAbas({ lightActive }: { lightActive: boolean }) {
    const [aba, setAba] = useState<'pessoas' | 'clientes'>('pessoas');
    const [dados, setDados] = useState<OrganogramaClientes | null>(null);
    const [erro, setErro] = useState(false);
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => {
        if (aba !== 'clientes' || dados) return;
        let vivo = true;
        carregarOrganogramaClientesAction()
            .then((d) => { if (vivo) setDados(d); })
            .catch(() => { if (vivo) setErro(true); });
        return () => { vivo = false; };
    }, [aba, dados, tentativa]);

    const tentarDeNovo = () => {
        setErro(false);
        setTentativa((t) => t + 1);
    };

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
                : erro ? (
                    <div role="alert" className={`flex flex-col items-start gap-3 rounded-md border p-4 text-sm ${lightActive ? 'border-zinc-200 text-zinc-700' : 'border-zinc-800 text-zinc-300'}`}>
                        <p>Não foi possível carregar o organograma de clientes.</p>
                        <Button variant="outline" size="sm" onClick={tentarDeNovo}>Tentar de novo</Button>
                    </div>
                )
                : dados ? <div className="flex min-h-[70dvh] flex-1 flex-col"><OrganogramaClientesView dados={dados} podeMover={false} lightActive={lightActive} /></div>
                : <Loader2 role="status" aria-label="Carregando organograma de clientes" className="h-6 w-6 animate-spin text-zinc-400" />}
        </div>
    );
}
