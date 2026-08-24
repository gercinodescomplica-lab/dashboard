'use client';

import { useState, useEffect } from 'react';
import { FileText, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { ContratoRow } from '@/db/queries';
import { ContractsTable } from './ContractsTable';
import { applyBodyTheme } from '@/lib/themeSync';

// Mesma chave usada pelo header do Dashboard e pelo Store — um único tema para todo o sistema.
const THEME_STORAGE_KEY = 'aibertinho-theme';

interface ContractsPageClientProps {
    contratos: ContratoRow[];
}

export function ContractsPageClient({ contratos }: ContractsPageClientProps) {
    // Botão próprio desta página (não há header compartilhado aqui), mas lê/grava o mesmo tema global do resto do sistema.
    // Sempre inicia no escuro por padrão (antes de ler o valor salvo), inalterado.
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const lightActive = theme === 'light';

    useEffect(() => {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') {
                setTheme(saved);
                applyBodyTheme(saved);
                return;
            }
        } catch {
            // localStorage indisponível — mantém o padrão escuro.
        }
        applyBodyTheme('dark');
    }, []);

    function toggleTheme() {
        setTheme((t) => {
            const next = t === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // localStorage indisponível — segue apenas em memória.
            }
            applyBodyTheme(next);
            return next;
        });
    }

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-200 ${lightActive ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-50'}`}>
            {/* Header */}
            <header className={`flex-none px-6 py-4 border-b flex items-center justify-between transition-colors duration-200 ${lightActive ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-900/70'}`}>
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className={`flex items-center gap-2 transition-colors text-sm ${lightActive ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-500 hover:text-zinc-200'}`}
                    >
                        ← Dashboard
                    </Link>
                    <div className={`w-px h-5 ${lightActive ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${lightActive ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                            <FileText className={`w-5 h-5 ${lightActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
                        </div>
                        <div>
                            <h1 className={`text-lg font-bold leading-tight ${lightActive ? 'text-zinc-900' : 'text-zinc-100'}`}>Contratos</h1>
                            <p className={`text-xs ${lightActive ? 'text-zinc-500' : 'text-zinc-500'}`}>Diretoria de Relacionamento e Mercado</p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                    aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                    className={`w-10 h-10 flex items-center justify-center rounded-md border transition-colors ${lightActive ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-200' : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 border-zinc-800'}`}
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col p-6 gap-0 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
                <ContractsTable initialData={contratos} managersList={[]} readOnly lightActive={lightActive} />
            </main>
        </div>
    );
}
