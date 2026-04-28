import { fetchAllContratos } from '@/db/queries';
import { ContractsTable } from './components/ContractsTable';
import { FileText } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Contratos — DRM',
    description: 'Gestão de contratos da Diretoria de Relacionamento e Mercado',
};

export default async function ContractsPage() {
    const contratos = await fetchAllContratos();

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
            {/* Header */}
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
                        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-zinc-100 leading-tight">Contratos</h1>
                            <p className="text-xs text-zinc-500">Diretoria de Relacionamento e Mercado</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col p-6 gap-0 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
                <ContractsTable initialData={contratos} managersList={[]} readOnly />
            </main>
        </div>
    );
}
