'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Plus, Loader2, ListChecks } from 'lucide-react';
import { proximoPendente } from '@/lib/grcc/organizar';
import { Button } from '@/components/ui/button';
import { carregarPainelGrcc } from '@/services/grcc.service';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import type { PainelGrcc } from '@/lib/grcc/tipos';
import { LeadsGrccTable } from './components/LeadsGrccTable';
import { MovimentacoesRecentes } from './components/MovimentacoesRecentes';
import { LeadPainel } from './components/LeadPainel';
import { ImportarExcelDialog } from './components/ImportarExcelDialog';
import { GuiaGrcc } from './components/GuiaGrcc';
import { brl } from './components/formato';
import { AppHeader } from '@/components/layout/AppHeader';
import { useTemaGrcc } from './tema';
import { useChaveGrcc } from './KeyGateGrcc';

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
    const { chave } = useChaveGrcc();
    const { claro, alternar } = useTemaGrcc();
    const [painel, setPainel] = useState<PainelGrcc | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [aberto, setAberto] = useState<number | 'novo' | null>(null);
    const [importando, setImportando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [completando, setCompletando] = useState(false);
    const [restantes, setRestantes] = useState(0);
    // Ref porque o "próximo pendente" é escolhido logo após a recarga, antes do novo render.
    const painelRef = useRef<PainelGrcc | null>(null);
    const vistos = useRef(new Set<number>());

    const recarregar = useCallback(async () => {
        try {
            const p = await carregarPainelGrcc(chave);
            painelRef.current = p;
            setPainel(p);
            setErro(null);
        } catch {
            setErro('Não foi possível carregar os leads. Tente de novo.');
        }
    }, []);

    useEffect(() => {
        let vivo = true;
        carregarPainelGrcc(chave)
            .then((p) => {
                if (!vivo) return;
                painelRef.current = p;
                setPainel(p);
            })
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

    const abrirProximoPendente = useCallback(() => {
        const id = proximoPendente(painelRef.current?.leads ?? [], vistos.current);
        if (id === null) {
            setCompletando(false);
            setAberto(null);
            setAviso('Fila de pendências concluída.');
            return;
        }
        vistos.current.add(id);
        const leads = painelRef.current?.leads ?? [];
        setRestantes(leads.filter((l) => !vistos.current.has(l.id) && pendenciasDoLead(l).length > 0).length);
        setAberto(id);
    }, []);

    const completarCadastro = () => {
        vistos.current = new Set();
        setCompletando(true);
        abrirProximoPendente();
    };

    const fechar = () => {
        setAberto(null);
        setCompletando(false);
    };

    const resumo = useMemo(() => {
        if (!painel) return null;
        const ativos = painel.leads.filter((l) => l.categoria !== 'Perda');
        const total = painel.leads.length;
        const pendencias = painel.leads.filter((l) => pendenciasDoLead(l).length > 0).length;
        return {
            total,
            pipeline: ativos.reduce((acc, l) => acc + l.valor, 0),
            pendencias,
            percentual: total ? Math.round(((total - pendencias) / total) * 100) : 100,
        };
    }, [painel]);

    if (!painel) {
        return (
            <div className={`min-h-screen ${claro ? 'bg-white' : 'bg-zinc-950'} flex flex-col`}>
                <AppHeader claro={claro} onAlternarTema={alternar} />
                <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${claro ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {erro ? (
                    <>
                        <p>{erro}</p>
                        <Button className={claro ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : undefined} onClick={recarregar}>Tentar de novo</Button>
                    </>
                ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                )}
                </div>
            </div>
        );
    }

    const leadAberto = typeof aberto === 'number' ? painel.leads.find((l) => l.id === aberto) ?? null : null;

    return (
        <div className={`min-h-screen ${claro ? 'bg-white' : 'bg-zinc-950'} ${claro ? 'text-zinc-900' : 'text-zinc-100'} transition-colors duration-200`}>
            <AppHeader claro={claro} onAlternarTema={alternar} />
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
                <section className={`flex flex-col gap-4 border ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'bg-zinc-50' : 'bg-zinc-900/40'} rounded-2xl p-5`}>
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Leads da GRCC</h1>
                            <p className={`text-sm ${claro ? 'text-zinc-600' : 'text-zinc-400'} mt-1`}>
                                {resumo!.total} leads · <span className={`${claro ? 'text-zinc-800' : 'text-zinc-200'} font-semibold`}>{brl(resumo!.pipeline)}</span> em aberto no pipeline da Débora
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button className={claro ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : undefined} onClick={() => setAberto('novo')}>
                                <Plus className="w-4 h-4" /> Novo lead
                            </Button>
                            <button type="button" onClick={() => setImportando(true)} className={`text-sm text-zinc-500 ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-200'} inline-flex items-center gap-1 px-2 h-9`}>
                                <Upload className="w-4 h-4" /> Importar planilha
                            </button>
                        </div>
                    </div>

                    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'bg-white' : 'bg-zinc-950/60'} p-3`}>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className={`${claro ? 'text-zinc-700' : 'text-zinc-300'}`}>
                                    Cadastros completos: <strong className={`${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{resumo!.total - resumo!.pendencias}</strong> de {resumo!.total}
                                </span>
                                <span className="text-xs text-zinc-500">{resumo!.percentual}%</span>
                            </div>
                            <div className={`mt-2 h-2 rounded-full ${claro ? 'bg-zinc-200' : 'bg-zinc-800'} overflow-hidden`} role="progressbar" aria-valuenow={resumo!.percentual} aria-valuemin={0} aria-valuemax={100} aria-label="Cadastros completos">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${resumo!.percentual}%` }} />
                            </div>
                        </div>
                        {resumo!.pendencias > 0 ? (
                            <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold" onClick={completarCadastro}>
                                <ListChecks className="w-4 h-4" /> Completar cadastro ({resumo!.pendencias})
                            </Button>
                        ) : (
                            <span className={`text-sm ${claro ? 'text-emerald-600' : 'text-emerald-400'}`}>Tudo completo</span>
                        )}
                    </div>
                </section>

                <GuiaGrcc />

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
                    <div className="min-w-0">
                        <LeadsGrccTable leads={painel.leads} onAbrir={(id) => setAberto(id)} />
                    </div>
                    <aside className={`border ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'bg-zinc-50' : 'bg-zinc-900/40'} rounded-2xl p-4 h-fit min-w-0`}>
                        <h2 className={`text-xs font-semibold uppercase tracking-wider ${claro ? 'text-zinc-600' : 'text-zinc-400'}`}>Últimas alterações</h2>
                        <p className="text-[11px] text-zinc-500 mb-3">Clique para abrir o lead.</p>
                        <MovimentacoesRecentes itens={painel.movimentacoes} onAbrir={(id) => setAberto(id)} claro={claro} />
                    </aside>
                </div>
            </div>

            <LeadPainel
                aberto={aberto !== null}
                lead={aberto === 'novo' ? null : leadAberto}
                listas={painel.listas}
                onFechar={fechar}
                onGravado={depoisDeGravar}
                onProximo={completando ? abrirProximoPendente : undefined}
                faixa={completando ? `Completando cadastro · ${restantes === 0 ? 'último da fila' : `faltam ${restantes}`}` : undefined}
            />

            <ImportarExcelDialog
                aberto={importando}
                leadsAtuais={painel.leads}
                projetosManuais={painel.projetosManuais}
                onFechar={() => setImportando(false)}
                onGravado={depoisDeGravar}
            />

            {aviso && (
                <div role="status" className={`fixed bottom-6 right-6 ${claro ? 'bg-white' : 'bg-zinc-900'} border border-emerald-500/40 ${claro ? 'text-emerald-700' : 'text-emerald-300'} text-sm px-4 py-3 rounded-xl shadow-xl`}>
                    {aviso}
                </div>
            )}
        </div>
    );
}
