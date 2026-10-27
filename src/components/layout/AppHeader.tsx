'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Users, LayoutDashboard, MapPin, Network, Store, ChevronDown, BarChart2, PackageSearch, FileText, Sun, Moon } from 'lucide-react';

export type VisaoApp = 'dashboard' | 'cidades' | 'organograma' | 'store' | 'pipeline';
export const VISOES_APP: VisaoApp[] = ['dashboard', 'cidades', 'organograma', 'store', 'pipeline'];

/**
 * Header principal do AIBertinho (logo + navegação + tema). Usado no dashboard (`/`) e nas páginas
 * separadas (ex.: `/grcc`). Com `onNavegar`, a navegação troca de visão no próprio dashboard; sem ele,
 * cada item vira link para `/?view=<visão>`.
 */
export function AppHeader({
    claro,
    onAlternarTema,
    visaoAtual = null,
    onNavegar,
    onLogo,
    children,
}: {
    claro: boolean;
    onAlternarTema: () => void;
    visaoAtual?: VisaoApp | null;
    onNavegar?: (v: VisaoApp) => void;
    onLogo?: () => void;
    /** Controles à direita, depois do botão de tema. Sem eles (páginas fora do dashboard), mostra "Trocar Gerente" levando ao dashboard. */
    children?: ReactNode;
}) {
    const inativo = claro ? 'text-zinc-600 hover:text-zinc-900 hover:bg-white/70' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50';
    const ativo = claro ? 'bg-white text-zinc-900 shadow-sm' : 'bg-zinc-800 text-zinc-100 shadow-sm';
    const ativoCidades = claro ? 'bg-white text-indigo-600 shadow-sm border border-indigo-200' : 'bg-zinc-800 text-indigo-400 shadow-sm border border-indigo-500/30';
    const itemDrop = (sel: boolean) =>
        sel ? (claro ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-100 bg-zinc-800') : claro ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60';

    const Item = ({ v, className, children: conteudo }: { v: VisaoApp; className: string; children: ReactNode }) =>
        onNavegar ? (
            <button type="button" onClick={() => onNavegar(v)} className={className}>
                {conteudo}
            </button>
        ) : (
            <Link href={v === 'dashboard' ? '/' : `/?view=${v}`} className={className}>
                {conteudo}
            </Link>
        );

    const logo = (
        <>
            {/* Logotipo AIBertinho — não muda com o tema */}
            <Image src="/avatars/aibertinho.png" alt="AiBertinho v2 Logo" width={40} height={40} className="rounded-full object-cover shadow-sm group-hover:scale-105 transition-transform" priority />
            <div>
                <h1 className={`text-2xl font-bold tracking-tight transition-colors flex items-center gap-2 ${claro ? 'text-zinc-900 group-hover:text-indigo-600' : 'text-zinc-100 group-hover:text-indigo-400'}`}>
                    AiBertinho <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">v2.01</span>
                </h1>
                <p className={`text-sm font-medium ${claro ? 'text-zinc-500' : 'text-zinc-400'}`}>Visão Executiva de Gerentes</p>
            </div>
        </>
    );

    const storeAtivo = visaoAtual === 'store' || visaoAtual === 'pipeline';

    return (
        <header className={`relative flex-none p-4 sm:p-6 lg:px-8 border-b ${claro ? 'border-zinc-200 bg-white' : 'border-zinc-900/50 bg-zinc-950'} z-30 flex items-center justify-between transition-colors duration-200`}>
            <div className="flex items-center gap-4">
                {onLogo ? (
                    <button type="button" onClick={onLogo} className="text-left group transition-all cursor-pointer flex items-center gap-3">
                        {logo}
                    </button>
                ) : (
                    <Link href="/" className="text-left group transition-all cursor-pointer flex items-center gap-3">
                        {logo}
                    </Link>
                )}

                <nav className={`hidden sm:flex items-center gap-1 ml-6 p-1 rounded-lg border ${claro ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800/80'}`}>
                    <Item v="dashboard" className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${visaoAtual === 'dashboard' ? ativo : inativo}`}>
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Item>

                    <Item v="cidades" className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${visaoAtual === 'cidades' ? ativoCidades : inativo}`}>
                        <MapPin className={`w-4 h-4 ${claro ? 'text-indigo-600' : 'text-indigo-400'}`} />
                        Cidades
                    </Item>

                    <Item v="organograma" className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${visaoAtual === 'organograma' ? ativo : inativo}`}>
                        <Network className="w-4 h-4" />
                        Organograma
                    </Item>

                    {/* Store — hover dropdown */}
                    <div className="relative group">
                        <button type="button" className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${storeAtivo ? ativo : inativo}`}>
                            <Store className="w-4 h-4" />
                            Store
                            <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        <div className={`absolute top-full left-0 mt-1.5 w-52 rounded-xl shadow-2xl py-1.5 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 border ${claro ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
                            <Item v="store" className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${itemDrop(visaoAtual === 'store')}`}>
                                <BarChart2 className="w-4 h-4 shrink-0" />
                                Estatísticas Store
                            </Item>
                            <Item v="pipeline" className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${itemDrop(visaoAtual === 'pipeline')}`}>
                                <PackageSearch className="w-4 h-4 shrink-0" />
                                Pipeline Store
                            </Item>
                        </div>
                    </div>

                    <Link href="/contracts" className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${inativo}`}>
                        <FileText className="w-4 h-4" />
                        Contratos
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={onAlternarTema}
                    title={claro ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
                    aria-label={claro ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
                    className={`w-10 h-10 flex items-center justify-center rounded-md border transition-colors ${claro ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-200' : 'bg-zinc-900 text-amber-300 hover:bg-zinc-800 border-zinc-800'}`}
                >
                    {claro ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                {children ?? (
                    <Link href="/?trocarGerente=1" className="flex items-center gap-2 h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors text-sm">
                        <Users className="w-4 h-4" />
                        Trocar Gerente
                    </Link>
                )}
            </div>
        </header>
    );
}
