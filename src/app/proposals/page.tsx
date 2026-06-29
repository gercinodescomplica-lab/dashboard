import { fetchAllPropostas, fetchManagersList } from '@/db/queries';
import { ProposalsTable } from './components/ProposalsTable';
import { Handshake } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Propostas — DRM',
    description: 'Pipeline comercial de propostas da Diretoria de Relacionamento e Mercado',
};

export default async function ProposalsPage() {
    const [propostas, managersList] = await Promise.all([
        fetchAllPropostas(),
        fetchManagersList(),
    ]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
            <header className="flex-none px-6 py-4 border-b border-zinc-900/70 bg-zinc-950 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors text-sm"
                    >
                        ← Dashboard
                    </Link>
                    <div className="w-px h-5 bg-zinc-800" />
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <Handshake className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-zinc-100 leading-tight">Propostas</h1>
                            <p className="text-xs text-zinc-500">Pipeline comercial — Oportunidades abertas</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-6 gap-0 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
                <ProposalsTable initialData={propostas} managersList={managersList} readOnly />
            </main>
        </div>
    );
}
