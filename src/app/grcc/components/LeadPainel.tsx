'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CAMPOS_LEAD, LEAD_VAZIO, ROTULO_CAMPO, ROTULO_TEMPERATURA, TEMPERATURAS_LEAD, type CampoLista, type EventoHistorico, type LeadGrcc, type LeadGrccDados } from '@/lib/grcc/tipos';
import { UFS, municipiosDaUf } from '@/lib/grcc/municipios';
import { temperaturaDaCategoria, temperaturaDoLead, trimestreDaPrevisao } from '@/lib/grcc/pipeline';
import { historicoDoLead } from '@/services/grcc.service';
import { corrigirAndamento, excluirLead, removerAndamento, salvarLead } from '../actions';
import { useChaveGrcc } from '../KeyGateGrcc';
import { linhaDoTempoAndamento } from '@/lib/grcc/organizar';
import { camposPendentes } from '@/lib/grcc/validacao';
import { LeadHistorico } from './LeadHistorico';
import { dataHoraBr } from './formato';
import { useClaro } from '../tema';

type Erros = Partial<Record<keyof LeadGrccDados, string>>;

function dadosDe(lead: LeadGrcc | null): LeadGrccDados {
    if (!lead) return { ...LEAD_VAZIO };
    return Object.fromEntries(CAMPOS_LEAD.map((c) => [c, lead[c]])) as unknown as LeadGrccDados;
}

function textoValor(d: LeadGrccDados): string {
    return d.valor ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
}

const ID_DO_CAMPO: Partial<Record<keyof LeadGrccDados, string>> = {
    previsaoFechamento: 'f-previsao',
    inicioFaturamento: 'f-inicio',
};

function numeroDoTexto(t: string): number {
    return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
}

function classeCampo(claro: boolean, falta?: boolean) {
    const tema = claro ? '[color-scheme:light] bg-white text-zinc-900' : '[color-scheme:dark] bg-zinc-950 text-zinc-100';
    const borda = falta ? 'border-amber-500/60' : claro ? 'border-zinc-200' : 'border-zinc-800';
    return `w-full h-9 rounded-md border px-3 text-sm outline-none focus:border-indigo-500 disabled:opacity-50 ${tema} ${borda}`;
}

function Campo({
    id,
    rotulo,
    erro,
    dica,
    falta,
    children,
    obrigatorio,
}: {
    id: string;
    rotulo: string;
    erro?: string;
    dica?: string;
    falta?: boolean;
    children: React.ReactNode;
    obrigatorio?: boolean;
}) {
    const claro = useClaro();
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className={`text-xs font-semibold ${falta ? `${claro ? 'text-amber-700' : 'text-amber-300'}` : `${claro ? 'text-zinc-600' : 'text-zinc-400'}`}`}>
                {rotulo}
                {obrigatorio && ' *'}
            </label>
            {children}
            {erro ? (
                <p className={`text-xs ${claro ? 'text-red-600' : 'text-red-400'}`}>{erro}</p>
            ) : falta ? (
                <p className={`text-[11px] ${claro ? 'text-amber-600' : 'text-amber-400'}`}>Falta preencher para contar certo no pipeline.</p>
            ) : (
                dica && <p className="text-[11px] text-zinc-500">{dica}</p>
            )}
        </div>
    );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{titulo}</h3>
            {children}
        </section>
    );
}

export function LeadPainel({
    aberto,
    lead,
    listas,
    onFechar,
    onGravado,
    onProximo,
    faixa,
}: {
    aberto: boolean;
    lead: LeadGrcc | null;
    listas: Record<CampoLista, string[]>;
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
    /** Modo fila ("Completar cadastro"): depois de salvar — ou ao pular — vai para o próximo lead. */
    onProximo?: () => void;
    faixa?: string;
}) {
    const { chave } = useChaveGrcc();
    const claro = useClaro();
    const cls = (falta?: boolean) => classeCampo(claro, falta);
    const [aba, setAba] = useState<'dados' | 'historico'>('dados');
    const [dados, setDados] = useState<LeadGrccDados>(() => dadosDe(lead));
    const [valorTexto, setValorTexto] = useState(() => textoValor(dadosDe(lead)));
    const [erros, setErros] = useState<Erros>({});
    const [erroGeral, setErroGeral] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
    const [historico, setHistorico] = useState<EventoHistorico[]>([]);
    const [novoAndamento, setNovoAndamento] = useState('');
    const [visivel, setVisivel] = useState(lead?.visivelDashboard ?? true);
    // Correção de andamento já gravado (vira evento novo no histórico; o original fica guardado).
    const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null);
    const [removendo, setRemovendo] = useState<number | null>(null);
    const [ajustando, setAjustando] = useState(false);
    const [erroAndamento, setErroAndamento] = useState<string | null>(null);
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
        setNovoAndamento('');
        setVisivel(lead?.visivelDashboard ?? true);
        setEditando(null);
        setRemovendo(null);
        setErroAndamento(null);
    }

    const andamentos = useMemo(() => linhaDoTempoAndamento(historico), [historico]);

    useEffect(() => {
        if (idAberto === null || !aberto) return;
        let cancelado = false;
        historicoDoLead(chave, idAberto)
            .then((h) => !cancelado && setHistorico(h))
            .catch(() => !cancelado && setHistorico([]));
        return () => {
            cancelado = true;
        };
    }, [idAberto, aberto, chave]);

    const ajustarAndamento = async (acao: 'corrigir' | 'remover', eventoId: number, texto = '') => {
        if (!lead) return;
        setAjustando(true);
        setErroAndamento(null);
        try {
            const r = acao === 'corrigir' ? await corrigirAndamento(chave, lead.id, eventoId, texto) : await removerAndamento(chave, lead.id, eventoId);
            if (!r.ok) {
                setErroAndamento(r.erro);
                return;
            }
            setHistorico(r.valor.historico);
            // Mantém o formulário em dia: se o andamento atual mudou, salvar depois não pode desfazer a correção.
            setDados((d) => ({ ...d, status: r.valor.lead.status }));
            setEditando(null);
            setRemovendo(null);
            await onGravado(acao === 'corrigir' ? 'Andamento corrigido.' : 'Andamento removido.').catch(() => {});
        } catch {
            setErroAndamento('Não foi possível salvar agora. Tente novamente.');
        } finally {
            setAjustando(false);
        }
    };

    const editarDoHistorico = (eventoId: number) => {
        const a = andamentos.find((x) => x.id === eventoId);
        if (!a) return;
        setAba('dados');
        setRemovendo(null);
        setEditando({ id: a.id, texto: a.texto });
    };

    const set = <K extends keyof LeadGrccDados>(campo: K, valor: LeadGrccDados[K]) =>
        setDados((d) => ({ ...d, [campo]: valor }));

    const municipios = useMemo(() => (dados.uf ? municipiosDaUf(dados.uf) : []), [dados.uf]);
    const listaId = `municipios-${dados.uf ?? 'x'}`;

    // Recalcula ao digitar: o aviso some assim que o campo é preenchido.
    const falta = useMemo(
        () => (lead ? new Set(camposPendentes({ ...dados, valor: numeroDoTexto(valorTexto) })) : new Set<keyof LeadGrccDados>()),
        [lead, dados, valorTexto]
    );

    const irParaCampo = (campo: keyof LeadGrccDados) => {
        const el = document.getElementById(ID_DO_CAMPO[campo] ?? `f-${campo}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
    };

    const salvar = async () => {
        setSalvando(true);
        setErroGeral(null);
        const status = novoAndamento.trim() || dados.status;
        let r: Awaited<ReturnType<typeof salvarLead>>;
        try {
            r = await salvarLead(chave, lead?.id ?? null, { ...dados, valor: numeroDoTexto(valorTexto), status }, { visivelDashboard: visivel });
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
        (onProximo ?? onFechar)();
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

    const select = (campo: CampoLista, rotulo: string, dica: string, obrigatorio = false) => (
        <Campo id={`f-${campo}`} rotulo={rotulo} erro={erros[campo]} dica={dica} falta={falta.has(campo)} obrigatorio={obrigatorio}>
            <select
                id={`f-${campo}`}
                aria-label={rotulo}
                value={dados[campo] ?? ''}
                onChange={(e) => set(campo, (e.target.value || null) as never)}
                className={cls(falta.has(campo))}
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
    const temperatura = temperaturaDoLead(dados);
    const temperaturaFixa = dados.categoria === 'Contratado' || dados.categoria === 'Perda';
    const temperaturaAuto = temperaturaDaCategoria(dados.categoria);

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className={`sm:max-w-3xl max-h-[92vh] flex flex-col ${claro ? 'bg-white' : 'bg-zinc-950'} ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'text-zinc-900' : 'text-zinc-100'} p-0 gap-0`}>
                <DialogHeader className={`px-6 pt-6 pb-3 text-left border-b ${claro ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    {faixa && <p className={`text-[11px] font-semibold uppercase tracking-wider ${claro ? 'text-indigo-600' : 'text-indigo-400'}`}>{faixa}</p>}
                    <DialogTitle className={`${claro ? 'text-zinc-900' : 'text-zinc-100'} pr-6`}>{lead ? lead.cliente : 'Novo lead'}</DialogTitle>
                    <DialogDescription className={`${claro ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        Entra no pipeline da Débora como <strong className={`${claro ? 'text-zinc-800' : 'text-zinc-200'}`}>{temperatura}</strong> em{' '}
                        <strong className={`${claro ? 'text-zinc-800' : 'text-zinc-200'}`}>{trimestre === 'nao_mapeado' ? 'não mapeado' : trimestre.toUpperCase()}</strong>
                        {trimestre === 'nao_mapeado' && ' (preencha a previsão de fechamento para cair num trimestre)'}
                    </DialogDescription>
                    {falta.size > 0 && aba === 'dados' && (
                        <p className={`text-xs ${claro ? 'text-amber-600' : 'text-amber-400'} flex flex-wrap items-center gap-1.5`}>
                            <AlertTriangle className="w-3.5 h-3.5" /> {falta.size === 1 ? 'Falta 1 campo:' : `Faltam ${falta.size} campos:`}
                            {[...falta].map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => irParaCampo(c)}
                                    className={`px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 ${claro ? 'text-amber-700' : 'text-amber-300'}`}
                                >
                                    {ROTULO_CAMPO[c]}
                                </button>
                            ))}
                        </p>
                    )}
                    {lead && (
                        <div className="flex gap-1 pt-2" role="tablist">
                            {(['dados', 'historico'] as const).map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    role="tab"
                                    aria-selected={aba === a}
                                    onClick={() => setAba(a)}
                                    className={`px-3 py-1.5 rounded-md text-sm ${aba === a ? `${claro ? 'bg-zinc-200' : 'bg-zinc-800'} ${claro ? 'text-zinc-900' : 'text-zinc-100'}` : `${claro ? 'text-zinc-600' : 'text-zinc-400'} ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-100'}`}`}
                                >
                                    {a === 'dados' ? 'Dados' : `Histórico completo (${historico.length})`}
                                </button>
                            ))}
                        </div>
                    )}
                </DialogHeader>

                {aba === 'historico' && lead ? (
                    <div className="px-6 py-4 overflow-y-auto">
                        <LeadHistorico eventos={historico} claro={claro} andamentosAtivos={new Set(andamentos.map((a) => a.id))} onEditarAndamento={editarDoHistorico} />
                    </div>
                ) : (
                    <form
                        className="flex flex-col min-h-0 flex-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            salvar();
                        }}
                    >
                        <div className="px-6 py-4 flex flex-col gap-6 overflow-y-auto">
                            <Secao titulo="1 · Andamento">
                                <div className={`flex flex-col gap-2 rounded-xl border ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'bg-zinc-50' : 'bg-zinc-900/40'} p-3`}>
                                    <Campo id="f-andamento" rotulo="Registrar andamento" erro={erros.status} dica="Escreva o que aconteceu desde o último contato. O andamento anterior fica guardado — nada é apagado.">
                                        <textarea
                                            id="f-andamento"
                                            rows={2}
                                            value={novoAndamento}
                                            onChange={(e) => setNovoAndamento(e.target.value)}
                                            placeholder="Ex.: Reunião com o secretário em 02/11, proposta em revisão"
                                            className={`${cls()} h-auto py-2`}
                                        />
                                    </Campo>
                                    {andamentos.length > 0 ? (
                                        <ol className={`flex flex-col gap-3 border-l ${claro ? 'border-zinc-200' : 'border-zinc-800'} ml-1 mt-1 max-h-72 overflow-y-auto pr-1`}>
                                            {andamentos.map((a, i) => {
                                                const botao = `inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${claro ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`;
                                                return (
                                                    <li key={a.id} className="relative pl-4 group">
                                                        <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-indigo-500' : claro ? 'bg-zinc-300' : 'bg-zinc-600'}`} />
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-[11px] text-zinc-500">
                                                                {dataHoraBr(a.quando)}
                                                                {i === 0 && ' · atual'}
                                                                {a.editadoEm && ` · editado em ${dataHoraBr(a.editadoEm)}`}
                                                            </p>
                                                            {editando?.id !== a.id && removendo !== a.id && (
                                                                <span className="flex items-center gap-0.5">
                                                                    <button type="button" className={botao} disabled={ajustando} onClick={() => { setRemovendo(null); setEditando({ id: a.id, texto: a.texto }); }} aria-label="Editar andamento">
                                                                        <Pencil className="w-3 h-3" /> Editar
                                                                    </button>
                                                                    <button type="button" className={botao} disabled={ajustando} onClick={() => { setEditando(null); setRemovendo(a.id); }} aria-label="Remover andamento">
                                                                        <Trash2 className="w-3 h-3" /> Remover
                                                                    </button>
                                                                </span>
                                                            )}
                                                        </div>
                                                        {editando?.id === a.id ? (
                                                            <div className="flex flex-col gap-2 mt-1">
                                                                <textarea
                                                                    autoFocus
                                                                    rows={2}
                                                                    aria-label="Corrigir andamento"
                                                                    value={editando.texto}
                                                                    onChange={(e) => setEditando({ id: a.id, texto: e.target.value })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Escape') { e.stopPropagation(); setEditando(null); }
                                                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ajustarAndamento('corrigir', a.id, editando.texto);
                                                                    }}
                                                                    className={`${cls()} h-auto py-2`}
                                                                />
                                                                <div className="flex items-center gap-2">
                                                                    <Button type="button" size="sm" className={claro ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : undefined} disabled={ajustando || !editando.texto.trim()} onClick={() => ajustarAndamento('corrigir', a.id, editando.texto)}>
                                                                        <Check className="w-3.5 h-3.5" /> {ajustando ? 'Salvando…' : 'Salvar correção'}
                                                                    </Button>
                                                                    <Button type="button" size="sm" variant="ghost" className={claro ? 'hover:bg-zinc-100 hover:text-zinc-900' : undefined} disabled={ajustando} onClick={() => setEditando(null)}>
                                                                        <X className="w-3.5 h-3.5" /> Cancelar
                                                                    </Button>
                                                                    <span className="text-[11px] text-zinc-500 hidden sm:inline">Ctrl+Enter salva · o texto anterior fica no histórico completo</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className={`text-sm ${i === 0 ? (claro ? 'text-zinc-900' : 'text-zinc-100') : claro ? 'text-zinc-600' : 'text-zinc-400'}`}>{a.texto}</p>
                                                        )}
                                                        {removendo === a.id && (
                                                            <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs rounded-lg border px-2 py-1.5 ${claro ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                                                                Tirar este andamento da linha do tempo?{i === 0 && ' O anterior volta a ser o atual.'}
                                                                <Button type="button" size="sm" variant="destructive" disabled={ajustando} onClick={() => ajustarAndamento('remover', a.id)}>
                                                                    {ajustando ? 'Removendo…' : 'Sim, remover'}
                                                                </Button>
                                                                <Button type="button" size="sm" variant="ghost" className={claro ? 'hover:bg-red-100' : undefined} disabled={ajustando} onClick={() => setRemovendo(null)}>
                                                                    Cancelar
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    ) : (
                                        dados.status && <p className={`text-sm ${claro ? 'text-zinc-600' : 'text-zinc-400'}`}>Atual: {dados.status}</p>
                                    )}
                                    {erroAndamento && <p className={`text-xs ${claro ? 'text-red-600' : 'text-red-400'}`}>{erroAndamento}</p>}
                                </div>
                            </Secao>

                            <Secao titulo="2 · Cliente e local">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Campo id="f-cliente" rotulo="Cliente" erro={erros.cliente} obrigatorio dica="Órgão ou empresa (ex.: Prefeitura de Valinhos).">
                                        <input id="f-cliente" value={dados.cliente} onChange={(e) => set('cliente', e.target.value)} className={cls()} />
                                    </Campo>
                                    <Campo id="f-solicitacao" rotulo="Solicitação" erro={erros.solicitacao} obrigatorio dica="O que o cliente pediu. Dois pedidos diferentes do mesmo cliente = dois leads.">
                                        <input id="f-solicitacao" value={dados.solicitacao} onChange={(e) => set('solicitacao', e.target.value)} className={cls()} />
                                    </Campo>
                                    <Campo id="f-uf" rotulo="UF" erro={erros.uf} obrigatorio falta={falta.has('uf')}>
                                        <select
                                            id="f-uf"
                                            value={dados.uf ?? ''}
                                            onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value || null, municipio: null }))}
                                            className={cls(falta.has('uf'))}
                                        >
                                            <option value="">—</option>
                                            {UFS.map((u) => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </Campo>
                                    <Campo id="f-municipio" rotulo="Município" erro={erros.municipio} obrigatorio falta={falta.has('municipio')} dica="Comece a digitar e escolha na lista. Órgão estadual: use a capital.">
                                        <input
                                            id="f-municipio"
                                            list={listaId}
                                            disabled={!dados.uf}
                                            value={dados.municipio ?? ''}
                                            onChange={(e) => set('municipio', e.target.value || null)}
                                            placeholder={dados.uf ? 'Digite para buscar' : 'Escolha a UF primeiro'}
                                            className={cls(falta.has('municipio'))}
                                        />
                                        <datalist id={listaId}>
                                            {municipios.map((m) => (
                                                <option key={m} value={m} />
                                            ))}
                                        </datalist>
                                    </Campo>
                                </div>
                            </Secao>

                            <Secao titulo="3 · Classificação">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {select('categoria', 'Categoria', 'Fase do funil (Contratado e Perda definem a temperatura sozinhos).', true)}
                                    <Campo
                                        id="f-temperatura"
                                        rotulo="Temperatura"
                                        erro={erros.temperatura}
                                        dica={
                                            temperaturaFixa
                                                ? `Em ${dados.categoria} a temperatura é sempre ${temperaturaAuto}.`
                                                : 'Quão perto o lead está de fechar. Automática = segue a categoria.'
                                        }
                                    >
                                        <select
                                            id="f-temperatura"
                                            aria-label="Temperatura"
                                            disabled={temperaturaFixa}
                                            value={temperaturaFixa ? '' : (dados.temperatura ?? '')}
                                            onChange={(e) => set('temperatura', (e.target.value || null) as never)}
                                            className={cls()}
                                        >
                                            <option value="">{temperaturaFixa ? temperaturaAuto : `Automática (${temperaturaAuto})`}</option>
                                            {!temperaturaFixa &&
                                                TEMPERATURAS_LEAD.map((t) => (
                                                    <option key={t} value={t}>
                                                        {ROTULO_TEMPERATURA[t]}
                                                    </option>
                                                ))}
                                        </select>
                                    </Campo>
                                    {select('etapa', 'Etapa', 'Em que passo do processo comercial o lead está.')}
                                    {select('situacao', 'Situação', 'Se está andando, parado ou dependendo de alguém.')}
                                    {select('familiaDemanda', 'Família da demanda', 'Tipo de solução (nuvem, consultoria, licenças…).')}
                                    {dados.categoria === 'Perda' && select('motivoPerda', 'Motivo da perda', 'Por que perdemos — ajuda a entender as perdas.', true)}
                                </div>
                            </Secao>

                            <Secao titulo="4 · Valor e prazos">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Campo id="f-valor" rotulo="Valor (R$)" erro={erros.valor} falta={falta.has('valor')} dica="Valor total estimado da proposta.">
                                        <input
                                            id="f-valor"
                                            inputMode="decimal"
                                            value={valorTexto}
                                            onChange={(e) => setValorTexto(e.target.value)}
                                            placeholder="0,00"
                                            className={`${cls(falta.has('valor'))} font-mono`}
                                        />
                                    </Campo>
                                    <Campo id="f-previsao" rotulo="Previsão de fechamento" erro={erros.previsaoFechamento} falta={falta.has('previsaoFechamento')} dica="Define o trimestre (Q1–Q4) em que o valor aparece.">
                                        <input
                                            id="f-previsao"
                                            type="date"
                                            value={dados.previsaoFechamento ?? ''}
                                            onChange={(e) => set('previsaoFechamento', e.target.value || null)}
                                            className={cls(falta.has('previsaoFechamento'))}
                                        />
                                    </Campo>
                                    {dados.categoria === 'Contratado' && (
                                        <>
                                            <Campo id="f-inicio" rotulo="Início do faturamento" erro={erros.inicioFaturamento} obrigatorio falta={falta.has('inicioFaturamento')}>
                                                <input
                                                    id="f-inicio"
                                                    type="date"
                                                    value={dados.inicioFaturamento ?? ''}
                                                    onChange={(e) => set('inicioFaturamento', e.target.value || null)}
                                                    className={cls(falta.has('inicioFaturamento'))}
                                                />
                                            </Campo>
                                            <Campo id="f-duracao" rotulo="Duração (meses)" erro={erros.duracaoMeses}>
                                                <input
                                                    id="f-duracao"
                                                    type="number"
                                                    min={1}
                                                    value={dados.duracaoMeses}
                                                    onChange={(e) => set('duracaoMeses', Number(e.target.value) || 12)}
                                                    className={cls()}
                                                />
                                            </Campo>
                                        </>
                                    )}
                                </div>
                            </Secao>

                            <Secao titulo="5 · Contato no cliente">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <input aria-label="Nome do contato" placeholder="Nome" value={dados.contatoNome ?? ''} onChange={(e) => set('contatoNome', e.target.value || null)} className={cls()} />
                                    <div>
                                        <input aria-label="E-mail do contato" placeholder="E-mail" value={dados.contatoEmail ?? ''} onChange={(e) => set('contatoEmail', e.target.value || null)} className={cls()} />
                                        {erros.contatoEmail && <p className={`text-xs ${claro ? 'text-red-600' : 'text-red-400'}`}>{erros.contatoEmail}</p>}
                                    </div>
                                    <input aria-label="Telefone do contato" placeholder="Telefone" value={dados.contatoTelefone ?? ''} onChange={(e) => set('contatoTelefone', e.target.value || null)} className={cls()} />
                                </div>
                            </Secao>

                            <Secao titulo="6 · Dashboard">
                                <label
                                    htmlFor="f-visivel"
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                                        visivel
                                            ? claro ? 'border-indigo-200 bg-indigo-50/60' : 'border-indigo-500/30 bg-indigo-500/5'
                                            : claro ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/40'
                                    }`}
                                >
                                    <input
                                        id="f-visivel"
                                        type="checkbox"
                                        checked={visivel}
                                        onChange={(e) => setVisivel(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer"
                                    />
                                    <span className="flex flex-col gap-0.5">
                                        <span className={`text-sm font-semibold flex items-center gap-1.5 ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                            {visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} Mostrar no dashboard
                                        </span>
                                        <span className="text-[11px] text-zinc-500">
                                            {visivel
                                                ? 'O lead aparece na aba Cidades (cards, mapa, tabela e detalhe).'
                                                : 'O lead não aparece na aba Cidades. Continua aqui na GRCC e no pipeline da Débora.'}
                                        </span>
                                    </span>
                                </label>
                            </Secao>
                        </div>

                        <div className={`flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-t ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'bg-white' : 'bg-zinc-950'}`}>
                            {erroGeral && <p className={`w-full text-sm ${claro ? 'text-red-600' : 'text-red-400'}`}>{erroGeral}</p>}
                            {lead ? (
                                confirmandoExclusao ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className={`${claro ? 'text-zinc-700' : 'text-zinc-300'}`}>Excluir este lead?</span>
                                        <Button type="button" variant="destructive" size="sm" disabled={salvando} onClick={excluir}>
                                            Sim, excluir
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className={`${claro ? 'hover:bg-zinc-100' : ''} ${claro ? 'hover:text-zinc-900' : ''}`} onClick={() => setConfirmandoExclusao(false)}>
                                            Cancelar
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="ghost" className={`${claro ? 'text-red-600' : 'text-red-400'} ${claro ? 'hover:bg-red-50' : ''}`} onClick={() => setConfirmandoExclusao(true)}>
                                        Excluir
                                    </Button>
                                )
                            ) : (
                                <span />
                            )}
                            <div className="flex items-center gap-2 ml-auto">
                                {onProximo ? (
                                    <Button type="button" variant="ghost" className={`${claro ? 'hover:bg-zinc-100' : ''} ${claro ? 'hover:text-zinc-900' : ''}`} onClick={onProximo} disabled={salvando}>
                                        Pular
                                    </Button>
                                ) : (
                                    <Button type="button" variant="ghost" className={`${claro ? 'hover:bg-zinc-100' : ''} ${claro ? 'hover:text-zinc-900' : ''}`} onClick={onFechar} disabled={salvando}>
                                        Cancelar
                                    </Button>
                                )}
                                <Button type="submit" className={claro ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : undefined} disabled={salvando}>
                                    {salvando ? 'Salvando…' : onProximo ? 'Salvar e próximo' : 'Salvar'}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
