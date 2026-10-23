'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CAMPOS_LEAD, LEAD_VAZIO, type CampoLista, type EventoHistorico, type LeadGrcc, type LeadGrccDados } from '@/lib/grcc/tipos';
import { UFS, municipiosDaUf } from '@/lib/grcc/municipios';
import { temperaturaDaCategoria, trimestreDaPrevisao } from '@/lib/grcc/pipeline';
import { historicoDoLead } from '@/services/grcc.service';
import { excluirLead, salvarLead } from '../actions';
import { useChaveGrcc } from '../KeyGateGrcc';
import { LeadHistorico } from './LeadHistorico';

type Erros = Partial<Record<keyof LeadGrccDados, string>>;

function dadosDe(lead: LeadGrcc | null): LeadGrccDados {
    if (!lead) return { ...LEAD_VAZIO };
    return Object.fromEntries(CAMPOS_LEAD.map((c) => [c, lead[c]])) as unknown as LeadGrccDados;
}

function textoValor(d: LeadGrccDados): string {
    return d.valor ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
}

const campoCls = 'w-full h-9 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-100 outline-none focus:border-indigo-500';

function Campo({ id, rotulo, erro, children, obrigatorio }: { id: string; rotulo: string; erro?: string; children: React.ReactNode; obrigatorio?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-semibold text-zinc-400">
                {rotulo}
                {obrigatorio && ' *'}
            </label>
            {children}
            {erro && <p className="text-xs text-red-400">{erro}</p>}
        </div>
    );
}

export function LeadPainel({
    aberto,
    lead,
    listas,
    onFechar,
    onGravado,
}: {
    aberto: boolean;
    lead: LeadGrcc | null;
    listas: Record<CampoLista, string[]>;
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
}) {
    const { chave } = useChaveGrcc();
    const [aba, setAba] = useState<'dados' | 'historico'>('dados');
    const [dados, setDados] = useState<LeadGrccDados>(() => dadosDe(lead));
    const [valorTexto, setValorTexto] = useState(() => textoValor(dadosDe(lead)));
    const [erros, setErros] = useState<Erros>({});
    const [erroGeral, setErroGeral] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
    const [historico, setHistorico] = useState<EventoHistorico[]>([]);
    const idAberto = lead?.id ?? null;
    const [origem, setOrigem] = useState({ id: idAberto, aberto });

    // Reinicia o formulário quando muda o lead aberto (ajuste de estado durante a renderização).
    if (origem.id !== idAberto || origem.aberto !== aberto) {
        const d = dadosDe(lead);
        setOrigem({ id: idAberto, aberto });
        setDados(d);
        setValorTexto(textoValor(d));
        setErros({});
        setErroGeral(null);
        setConfirmandoExclusao(false);
        setAba('dados');
        setHistorico([]);
    }

    useEffect(() => {
        if (idAberto === null || !aberto) return;
        let cancelado = false;
        historicoDoLead(idAberto)
            .then((h) => !cancelado && setHistorico(h))
            .catch(() => !cancelado && setHistorico([]));
        return () => {
            cancelado = true;
        };
    }, [idAberto, aberto]);

    const set = <K extends keyof LeadGrccDados>(campo: K, valor: LeadGrccDados[K]) =>
        setDados((d) => ({ ...d, [campo]: valor }));

    const municipios = useMemo(() => (dados.uf ? municipiosDaUf(dados.uf) : []), [dados.uf]);
    const listaId = `municipios-${dados.uf ?? 'x'}`;

    const salvar = async () => {
        setSalvando(true);
        setErroGeral(null);
        const valor = Number(valorTexto.replace(/\./g, '').replace(',', '.')) || 0;
        let r: Awaited<ReturnType<typeof salvarLead>>;
        try {
            r = await salvarLead(chave, lead?.id ?? null, { ...dados, valor });
        } catch {
            setErroGeral('Não foi possível salvar agora. Tente novamente.');
            setSalvando(false);
            return;
        }
        setSalvando(false);
        if (!r.ok) {
            setErros(r.erros ?? {});
            setErroGeral(r.erro);
            return;
        }
        // Já salvou: se a recarga da tela falhar, o pai mostra o próprio erro — não é falha ao salvar.
        await onGravado(lead ? 'Lead atualizado.' : 'Lead cadastrado.').catch(() => {});
        onFechar();
    };

    const excluir = async () => {
        if (!lead) return;
        setSalvando(true);
        try {
            const r = await excluirLead(chave, lead.id);
            if (!r.ok) {
                setErroGeral(r.erro);
                return;
            }
            await onGravado('Lead excluído.');
            onFechar();
        } catch {
            setErroGeral('Não foi possível excluir agora. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    const opcoes = (campo: CampoLista) => {
        const atual = dados[campo];
        const lista = listas[campo];
        return atual && !lista.includes(atual) ? [...lista, atual] : lista;
    };

    const select = (campo: CampoLista, rotulo: string, obrigatorio = false) => (
        <Campo id={`f-${campo}`} rotulo={rotulo} erro={erros[campo]} obrigatorio={obrigatorio}>
            <select
                id={`f-${campo}`}
                aria-label={rotulo}
                value={dados[campo] ?? ''}
                onChange={(e) => set(campo, (e.target.value || null) as never)}
                className={campoCls}
            >
                {campo !== 'categoria' && <option value="">—</option>}
                {opcoes(campo).map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
        </Campo>
    );

    const trimestre = trimestreDaPrevisao(dados.previsaoFechamento, new Date().getFullYear());

    return (
        <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-zinc-100">{lead ? lead.cliente : 'Novo lead'}</SheetTitle>
                    <SheetDescription className="text-zinc-400">
                        No pipeline da Débora: {trimestre === 'nao_mapeado' ? 'não mapeado' : trimestre.toUpperCase()} ·{' '}
                        {temperaturaDaCategoria(dados.categoria)}
                    </SheetDescription>
                </SheetHeader>

                {lead && (
                    <div className="flex gap-1 px-4">
                        {(['dados', 'historico'] as const).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => setAba(a)}
                                className={`px-3 py-1.5 rounded-md text-sm ${aba === a ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`}
                            >
                                {a === 'dados' ? 'Dados' : `Histórico (${historico.length})`}
                            </button>
                        ))}
                    </div>
                )}

                {aba === 'historico' && lead ? (
                    <div className="p-4">
                        <LeadHistorico eventos={historico} />
                    </div>
                ) : (
                    <form
                        className="p-4 flex flex-col gap-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            salvar();
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Campo id="f-cliente" rotulo="Cliente" erro={erros.cliente} obrigatorio>
                                <input id="f-cliente" value={dados.cliente} onChange={(e) => set('cliente', e.target.value)} className={campoCls} />
                            </Campo>
                            <Campo id="f-solicitacao" rotulo="Solicitação" erro={erros.solicitacao} obrigatorio>
                                <input id="f-solicitacao" value={dados.solicitacao} onChange={(e) => set('solicitacao', e.target.value)} className={campoCls} />
                            </Campo>
                            <Campo id="f-uf" rotulo="UF" erro={erros.uf} obrigatorio>
                                <select
                                    id="f-uf"
                                    value={dados.uf ?? ''}
                                    onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value || null, municipio: null }))}
                                    className={campoCls}
                                >
                                    <option value="">—</option>
                                    {UFS.map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </Campo>
                            <Campo id="f-municipio" rotulo="Município" erro={erros.municipio} obrigatorio>
                                <input
                                    id="f-municipio"
                                    list={listaId}
                                    disabled={!dados.uf}
                                    value={dados.municipio ?? ''}
                                    onChange={(e) => set('municipio', e.target.value || null)}
                                    placeholder={dados.uf ? 'Digite para buscar' : 'Escolha a UF primeiro'}
                                    className={campoCls}
                                />
                                <datalist id={listaId}>
                                    {municipios.map((m) => (
                                        <option key={m} value={m} />
                                    ))}
                                </datalist>
                            </Campo>
                            {select('categoria', 'Categoria', true)}
                            {select('etapa', 'Etapa')}
                            {select('situacao', 'Situação')}
                            {select('familiaDemanda', 'Família da demanda')}
                            {dados.categoria === 'Perda' && select('motivoPerda', 'Motivo da perda', true)}
                            {dados.categoria === 'Contratado' && (
                                <>
                                    <Campo id="f-inicio" rotulo="Início do faturamento" erro={erros.inicioFaturamento} obrigatorio>
                                        <input id="f-inicio" type="date" value={dados.inicioFaturamento ?? ''} onChange={(e) => set('inicioFaturamento', e.target.value || null)} className={campoCls} />
                                    </Campo>
                                    <Campo id="f-duracao" rotulo="Duração (meses)" erro={erros.duracaoMeses}>
                                        <input id="f-duracao" type="number" min={1} value={dados.duracaoMeses} onChange={(e) => set('duracaoMeses', Number(e.target.value) || 12)} className={campoCls} />
                                    </Campo>
                                </>
                            )}
                            <Campo id="f-valor" rotulo="Valor (R$)" erro={erros.valor}>
                                <input id="f-valor" inputMode="decimal" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} placeholder="0,00" className={`${campoCls} font-mono`} />
                            </Campo>
                            <Campo id="f-previsao" rotulo="Previsão de fechamento" erro={erros.previsaoFechamento}>
                                <input id="f-previsao" type="date" value={dados.previsaoFechamento ?? ''} onChange={(e) => set('previsaoFechamento', e.target.value || null)} className={campoCls} />
                            </Campo>
                        </div>

                        <Campo id="f-status" rotulo="Andamento" erro={erros.status}>
                            <textarea id="f-status" rows={2} value={dados.status ?? ''} onChange={(e) => set('status', e.target.value || null)} className={`${campoCls} h-auto py-2`} />
                        </Campo>

                        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <legend className="text-xs font-semibold text-zinc-400 mb-1">Contato</legend>
                            <input aria-label="Nome do contato" placeholder="Nome" value={dados.contatoNome ?? ''} onChange={(e) => set('contatoNome', e.target.value || null)} className={campoCls} />
                            <div>
                                <input aria-label="E-mail do contato" placeholder="E-mail" value={dados.contatoEmail ?? ''} onChange={(e) => set('contatoEmail', e.target.value || null)} className={campoCls} />
                                {erros.contatoEmail && <p className="text-xs text-red-400">{erros.contatoEmail}</p>}
                            </div>
                            <input aria-label="Telefone do contato" placeholder="Telefone" value={dados.contatoTelefone ?? ''} onChange={(e) => set('contatoTelefone', e.target.value || null)} className={campoCls} />
                        </fieldset>

                        {erroGeral && <p className="text-sm text-red-400">{erroGeral}</p>}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                            {lead ? (
                                confirmandoExclusao ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-zinc-300">Excluir este lead?</span>
                                        <Button type="button" variant="destructive" size="sm" disabled={salvando} onClick={excluir}>
                                            Sim, excluir
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmandoExclusao(false)}>
                                            Cancelar
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="ghost" className="text-red-400" onClick={() => setConfirmandoExclusao(true)}>
                                        Excluir
                                    </Button>
                                )
                            ) : (
                                <span />
                            )}
                            <Button type="submit" disabled={salvando}>
                                Salvar
                            </Button>
                        </div>
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
}
