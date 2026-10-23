'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload, Plus, ArrowLeft, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { carregarPainelGrcc } from '@/services/grcc.service';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import type { PainelGrcc } from '@/lib/grcc/tipos';
import { useChaveGrcc } from './KeyGateGrcc';
import { LeadsGrccTable } from './components/LeadsGrccTable';
import { MovimentacoesRecentes } from './components/MovimentacoesRecentes';
import { LeadPainel } from './components/LeadPainel';
import { ImportarExcelDialog } from './components/ImportarExcelDialog';
import { brl, dataHoraBr } from './components/formato';

/** Avisa as abas do dashboard abertas neste navegador que os leads mudaram (atualização instantânea). */
export function avisarDashboard() {
    try {
        const canal = new BroadcastChannel('grcc');
        canal.postMessage({ tipo: 'leads-mudaram', quando: Date.now() });
        canal.close();
    } catch {
        // BroadcastChannel indisponível — o dashboard pega na próxima checagem (15 s).
    }
}

export function GrccApp() {
    const { sair } = useChaveGrcc();
    const [painel, setPainel] = useState<PainelGrcc | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aberto, setAberto] = useState<number | 'novo' | null>(null);
    const [importando, setImportando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const recarregar = useCallback(async () => {
        try {
            setPainel(await carregarPainelGrcc());
            setErro(null);
        } catch {
            setErro('Não foi possível carregar os leads. Tente de novo.');
        }
    }, []);

    useEffect(() => {
        let vivo = true;
        carregarPainelGrcc()
            .then((p) => vivo && setPainel(p))
            .catch(() => vivo && setErro('Não foi possível carregar os leads. Tente de novo.'));
        return () => {
            vivo = false;
        };
    }, []);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4000);
        return () => clearTimeout(t);
    }, [aviso]);

    const depoisDeGravar = useCallback(
        async (mensagem: string) => {
            await recarregar();
            avisarDashboard();
            setAviso(mensagem);
        },
        [recarregar]
    );

    const resumo = useMemo(() => {
        if (!painel) return null;
        const ativos = painel.leads.filter((l) => l.categoria !== 'Perda');
        return {
            total: painel.leads.length,
            pipeline: ativos.reduce((acc, l) => acc + l.valor, 0),
            pendencias: painel.leads.filter((l) => pendenciasDoLead(l).length > 0).length,
        };
    }, [painel]);

    if (!painel) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
                {erro ? (
                    <>
                        <p>{erro}</p>
                        <Button onClick={recarregar}>Tentar de novo</Button>
                    </>
                ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                )}
            </div>
        );
    }

    const leadAberto = typeof aberto === 'number' ? painel.leads.find((l) => l.id === aberto) ?? null : null;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
                <header className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div>
                        <h1 className="text-2xl font-bold">GRCC · Leads</h1>
                        <p className="text-sm text-zinc-400 mt-1">
                            {resumo!.total} leads · {brl(resumo!.pipeline)} em pipeline
                            {resumo!.pendencias > 0 && (
                                <span className="text-amber-400 inline-flex items-center gap-1 ml-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> {resumo!.pendencias} pendências de cadastro
                                </span>
                            )}
                        </p>
                        {painel.ultimoImport && (
                            <p className="text-xs text-zinc-500 mt-1">
                                Último import: {painel.ultimoImport.arquivo} · {dataHoraBr(painel.ultimoImport.quando)}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => setImportando(true)}>
                            <Upload className="w-4 h-4" /> Importar Excel
                        </Button>
                        <Button onClick={() => setAberto('novo')}>
                            <Plus className="w-4 h-4" /> Novo lead
                        </Button>
                        <Link href="/?view=cidades" className="text-sm text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 px-2">
                            <ArrowLeft className="w-4 h-4" /> Ver como leitor
                        </Link>
                        <button type="button" onClick={sair} title="Sair" className="p-2 text-zinc-500 hover:text-zinc-200">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                    <LeadsGrccTable leads={painel.leads} onAbrir={(id) => setAberto(id)} />
                    <aside className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4 h-fit">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Movimentações recentes</h2>
                        <MovimentacoesRecentes itens={painel.movimentacoes} onAbrir={(id) => setAberto(id)} />
                    </aside>
                </div>
            </div>

            <LeadPainel
                aberto={aberto !== null}
                lead={aberto === 'novo' ? null : leadAberto}
                listas={painel.listas}
                onFechar={() => setAberto(null)}
                onGravado={depoisDeGravar}
            />

            <ImportarExcelDialog
                aberto={importando}
                leadsAtuais={painel.leads}
                projetosManuais={painel.projetosManuais}
                onFechar={() => setImportando(false)}
                onGravado={depoisDeGravar}
            />

            {aviso && (
                <div role="status" className="fixed bottom-6 right-6 bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-xl shadow-xl">
                    {aviso}
                </div>
            )}
        </div>
    );
}
