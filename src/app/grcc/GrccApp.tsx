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
import { brl, haQuanto } from './components/formato';
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
            contratados: painel.leads.filter((l) => l.categoria === 'Contratado').length,
        };
    }, [painel]);

    const clientesConhecidos = useMemo(
        () => (painel ? Array.from(new Set(painel.leads.map((l) => l.cliente))).sort((a, b) => a.localeCompare(b, 'pt-BR')) : []),
        [painel]
    );

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

    const botaoSecundario = `inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        claro ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
    }`;

    const leadAberto = typeof aberto === 'number' ? painel.leads.find((l) => l.id === aberto) ?? null : null;

    return (
        <div className={`min-h-screen ${claro ? 'bg-white' : 'bg-zinc-950'} ${claro ? 'text-zinc-900' : 'text-zinc-100'} transition-colors duration-200`}>
            <AppHeader claro={claro} onAlternarTema={alternar} />
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">GRCC · Pipeline da Débora</p>
                            <h1 className="text-xl font-semibold tracking-tight mt-0.5">Leads</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {resumo!.pendencias > 0 && (
                                <button type="button" onClick={completarCadastro} title="Abre um lead por vez com o que falta destacado" className={botaoSecundario}>
                                    <ListChecks className="w-4 h-4" aria-hidden /> Completar cadastros
                                </button>
                            )}
                            <button type="button" onClick={() => setImportando(true)} className={botaoSecundario}>
                                <Upload className="w-4 h-4" aria-hidden /> Importar planilha
                            </button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 cursor-pointer" onClick={() => setAberto('novo')}>
                                <Plus className="w-4 h-4" aria-hidden /> Novo lead
                            </Button>
                        </div>
                    </div>

                    <dl className={`grid grid-cols-2 lg:grid-cols-4 rounded-lg border lg:divide-x ${claro ? 'border-zinc-200 divide-zinc-200 bg-white' : 'border-zinc-800 divide-zinc-800 bg-zinc-900/40'}`}>
                        {[
                            { rotulo: 'Leads', valor: String(resumo!.total), nota: `${resumo!.contratados} contratados` },
                            { rotulo: 'Pipeline em aberto', valor: brl(resumo!.pipeline), nota: 'exclui perdas' },
                            { rotulo: 'Cadastros completos', valor: `${resumo!.percentual}%`, nota: `${resumo!.total - resumo!.pendencias} de ${resumo!.total}` },
                            { rotulo: 'Última alteração', valor: painel.movimentacoes[0] ? haQuanto(painel.movimentacoes[0].quando) : '—', nota: painel.movimentacoes[0]?.cliente ?? '' },
                        ].map((k) => (
                            <div key={k.rotulo} className="px-4 py-3 min-w-0">
                                <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{k.rotulo}</dt>
                                <dd className={`text-lg font-semibold tabular-nums truncate ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{k.valor}</dd>
                                <dd className="text-xs text-zinc-500 truncate">{k.nota}</dd>
                            </div>
                        ))}
                    </dl>
                </header>

                <GuiaGrcc />

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
                    <div className="min-w-0">
                        <LeadsGrccTable leads={painel.leads} onAbrir={(id) => setAberto(id)} />
                    </div>
                    <aside aria-labelledby="titulo-alteracoes" className={`border rounded-lg h-fit min-w-0 ${claro ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/40'}`}>
                        <div className={`px-4 py-3 border-b ${claro ? 'border-zinc-200' : 'border-zinc-800'}`}>
                            <h2 id="titulo-alteracoes" className={`text-sm font-semibold ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>Últimas alterações</h2>
                            <p className="text-xs text-zinc-500">Clique para abrir o lead</p>
                        </div>
                        <div className="p-2">
                            <MovimentacoesRecentes itens={painel.movimentacoes} onAbrir={(id) => setAberto(id)} claro={claro} />
                        </div>
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
                clientesConhecidos={clientesConhecidos}
                todosLeads={painel.leads}
            />

            <ImportarExcelDialog
                aberto={importando}
                leadsAtuais={painel.leads}
                projetosManuais={painel.projetosManuais}
                onFechar={() => setImportando(false)}
                onGravado={depoisDeGravar}
            />

            {aviso && (
                <div role="status" className={`fixed bottom-6 right-6 ${claro ? 'bg-white' : 'bg-zinc-900'} border border-emerald-500/40 ${claro ? 'text-emerald-700' : 'text-emerald-300'} text-sm px-4 py-3 rounded-lg shadow-lg`}>
                    {aviso}
                </div>
            )}
        </div>
    );
}
