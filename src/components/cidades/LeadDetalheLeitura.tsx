'use client';

import { useEffect, useState } from 'react';
import { Building2, CalendarDays, CircleDollarSign, Clock, Mail, MapPin, MessageSquareText, Phone, User, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { linhaDoTempoComercial } from '@/services/grcc.service';
import { brl, corCategoria, dataBr, dataHoraBr, deParaMudanca } from '@/app/grcc/components/formato';
import { temperaturaDaCategoria, trimestreDaPrevisao } from '@/lib/grcc/pipeline';
import { extractLeadDate } from '@/lib/grcc/normalizar';
import { CATEGORIAS_GRCC, type CategoriaGrcc, type EventoComercial } from '@/lib/grcc/tipos';
import type { LeadCidade } from '@/types/cidades';

type Carga = { chave: string; eventos: EventoComercial[]; erro: boolean };

const TEMPERATURA: Record<string, { rotulo: string; escuro: string; claro: string }> = {
    quente: { rotulo: 'Quente', escuro: 'bg-red-500/15 text-red-300 border-red-500/30', claro: 'bg-red-50 text-red-700 border-red-200' },
    morno: { rotulo: 'Morno', escuro: 'bg-amber-500/15 text-amber-300 border-amber-500/30', claro: 'bg-amber-50 text-amber-700 border-amber-200' },
    frio: { rotulo: 'Frio', escuro: 'bg-sky-500/15 text-sky-300 border-sky-500/30', claro: 'bg-sky-50 text-sky-700 border-sky-200' },
    contratado: { rotulo: 'Contratado', escuro: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', claro: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    perdido: { rotulo: 'Perdido', escuro: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', claro: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

function categoriaGrcc(c: string): CategoriaGrcc | null {
    return (CATEGORIAS_GRCC as readonly string[]).includes(c) ? (c as CategoriaGrcc) : null;
}

/** "faltam 5 dias", "hoje", "venceu há 14 dias" — prazo relativo da previsão de fechamento. */
function prazo(lead: LeadCidade): { texto: string; vencido: boolean } | null {
    const d = extractLeadDate(lead);
    if (!d) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
    if (dias === 0) return { texto: 'fecha hoje', vencido: false };
    if (dias > 0) return { texto: `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`, vencido: false };
    return { texto: `venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vencido: true };
}

/** Detalhe do lead no dashboard (só leitura): estado atual + linha do tempo COMERCIAL. A auditoria fica na /grcc. */
export function LeadDetalheLeitura({ lead, onFechar, claro }: { lead: LeadCidade | null; onFechar: () => void; claro: boolean }) {
    const [carga, setCarga] = useState<Carga | null>(null);
    const leadId = lead?.id ?? null;
    // Muda quando o lead é trocado ou editado (recarga ao vivo) -> recarrega a linha do tempo.
    const chave = lead ? JSON.stringify(lead) : null;

    useEffect(() => {
        if (leadId === null || chave === null) return;
        let cancelado = false;
        linhaDoTempoComercial(leadId)
            .then((eventos) => !cancelado && setCarga({ chave, eventos, erro: false }))
            .catch(() => !cancelado && setCarga({ chave, eventos: [], erro: true }));
        return () => {
            cancelado = true;
        };
    }, [leadId, chave]);

    // Só vale a carga do lead aberto agora (evita mostrar a linha do tempo de outro lead).
    const atual = carga && carga.chave === chave ? carga : null;

    const t = {
        forte: claro ? 'text-zinc-900' : 'text-zinc-100',
        medio: claro ? 'text-zinc-700' : 'text-zinc-300',
        fraco: claro ? 'text-zinc-500' : 'text-zinc-400',
        cartao: claro ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800',
        suave: claro ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-800',
        divisor: claro ? 'divide-zinc-100' : 'divide-zinc-800/70',
        trilho: claro ? 'border-zinc-200' : 'border-zinc-800',
        chipNovo: claro ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
        chipVelho: claro ? 'bg-zinc-100 border-zinc-200 text-zinc-500' : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
        icone: claro ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/15 text-indigo-300',
    };

    const titulo = (texto: string) => <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${t.fraco}`}>{texto}</h3>;

    if (!lead) return <Dialog open={false} />;

    const cat = categoriaGrcc(lead.categoria);
    const temp = cat ? TEMPERATURA[temperaturaDaCategoria(cat)] : null;
    const trimestre = trimestreDaPrevisao(lead.previsao_fechamento ?? null, new Date().getFullYear());
    const p = prazo(lead);
    const ehPerda = cat === 'Perda';
    const classificacao = [
        ['Etapa', lead.etapa_padrao],
        ['Situação', lead.situacao_padrao],
        ['Família da demanda', lead.familia_demanda],
        ...(ehPerda ? [['Motivo da perda', lead.motivo_padrao]] : []),
    ].filter(([, v]) => !!v) as [string, string][];
    const temContato = !!(lead.contato_nome || lead.contato_email || lead.contato_telefone);

    return (
        <Dialog
            open
            onOpenChange={(o) => {
                if (!o) {
                    setCarga(null);
                    onFechar();
                }
            }}
        >
            <DialogContent
                showCloseButton={false}
                className={`sm:max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl shadow-2xl ${claro ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'}`}
            >
                {/* Cabeçalho */}
                <div className={`relative px-6 pt-6 pb-5 border-b ${claro ? 'bg-gradient-to-br from-indigo-50 via-white to-white border-zinc-200' : 'bg-gradient-to-br from-indigo-950/60 via-zinc-950 to-zinc-950 border-zinc-800'}`}>
                    <DialogClose
                        className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${claro ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                        aria-label="Fechar"
                    >
                        <X className="w-4 h-4" />
                    </DialogClose>
                    <div className="flex items-start gap-4 pr-8">
                        <div className={`p-3 rounded-xl shrink-0 ${t.icone}`}>
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className={`text-xl font-bold leading-tight ${t.forte}`}>{lead.cliente}</DialogTitle>
                            <DialogDescription className={`mt-1 ${t.medio}`}>{lead.solicitacao || 'Sem solicitação descrita'}</DialogDescription>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${cat ? corCategoria(claro)[cat] : t.chipVelho}`}>{lead.categoria || 'Sem categoria'}</span>
                                {temp && (
                                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${claro ? temp.claro : temp.escuro}`}>
                                        {temp.rotulo} · {trimestre === 'nao_mapeado' ? 'sem trimestre' : trimestre.toUpperCase()}
                                    </span>
                                )}
                                {(lead.municipio || lead.uf) && (
                                    <span className={`text-xs inline-flex items-center gap-1 ${t.fraco}`}>
                                        <MapPin className="w-3.5 h-3.5" /> {[lead.municipio, lead.uf].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Corpo */}
                <div className="overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6">
                        <div className="md:col-span-3 flex flex-col gap-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`rounded-xl border p-4 ${t.cartao}`}>
                                    <p className={`text-xs flex items-center gap-1.5 ${t.fraco}`}>
                                        <CircleDollarSign className="w-4 h-4" /> Valor
                                    </p>
                                    {lead.valor ? (
                                        <p className={`text-2xl font-bold font-mono mt-1 ${claro ? 'text-emerald-600' : 'text-emerald-400'}`}>{brl(lead.valor)}</p>
                                    ) : (
                                        <p className={`text-base font-semibold mt-2 ${t.fraco}`}>A definir</p>
                                    )}
                                </div>
                                <div className={`rounded-xl border p-4 ${t.cartao}`}>
                                    <p className={`text-xs flex items-center gap-1.5 ${t.fraco}`}>
                                        <CalendarDays className="w-4 h-4" /> Previsão de fechamento
                                    </p>
                                    <p className={`text-2xl font-bold mt-1 ${lead.previsao_fechamento ? t.forte : t.fraco}`}>
                                        {lead.previsao_fechamento ? dataBr(lead.previsao_fechamento) : '—'}
                                    </p>
                                    {p && (
                                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${p.vencido ? (claro ? 'text-red-600' : 'text-red-400') : t.fraco}`}>
                                            <Clock className="w-3 h-3" /> {p.texto}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {lead.status && (
                                <section>
                                    {titulo('Andamento atual')}
                                    <div className={`rounded-xl border p-4 flex gap-3 ${t.suave}`}>
                                        <MessageSquareText className={`w-4 h-4 shrink-0 mt-0.5 ${claro ? 'text-indigo-500' : 'text-indigo-400'}`} />
                                        <p className={`text-sm leading-relaxed ${t.forte}`}>{lead.status}</p>
                                    </div>
                                </section>
                            )}

                            {classificacao.length > 0 && (
                                <section>
                                    {titulo('Classificação')}
                                    <dl className={`rounded-xl border divide-y ${t.cartao} ${t.divisor}`}>
                                        {classificacao.map(([rotulo, valor]) => (
                                            <div key={rotulo} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                                                <dt className={t.fraco}>{rotulo}</dt>
                                                <dd className={`text-right font-medium ${t.forte}`}>{valor}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </section>
                            )}

                            {temContato && (
                                <section>
                                    {titulo('Contato no cliente')}
                                    <div className={`rounded-xl border p-4 flex flex-col gap-2 text-sm ${t.cartao} ${t.forte}`}>
                                        {lead.contato_nome && (
                                            <span className="flex items-center gap-2 font-medium">
                                                <User className={`w-4 h-4 ${t.fraco}`} /> {lead.contato_nome}
                                            </span>
                                        )}
                                        {lead.contato_email && (
                                            <a href={`mailto:${lead.contato_email}`} className={`flex items-center gap-2 hover:underline ${claro ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                                <Mail className={`w-4 h-4 ${t.fraco}`} /> {lead.contato_email}
                                            </a>
                                        )}
                                        {lead.contato_telefone && (
                                            <a href={`tel:${lead.contato_telefone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:underline">
                                                <Phone className={`w-4 h-4 ${t.fraco}`} /> {lead.contato_telefone}
                                            </a>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>

                        <section className="md:col-span-2">
                            {titulo('Linha do tempo')}
                            <div className={`rounded-xl border p-4 ${t.suave}`}>
                                {!atual ? (
                                    <p className={`text-sm ${t.fraco}`}>Carregando…</p>
                                ) : atual.erro ? (
                                    <p className="text-sm text-red-500">Não foi possível carregar a linha do tempo.</p>
                                ) : atual.eventos.length === 0 ? (
                                    <p className={`text-sm ${t.fraco}`}>Sem movimentações registradas.</p>
                                ) : (
                                    <ol className={`flex flex-col gap-4 border-l ml-1 ${t.trilho}`}>
                                        {atual.eventos.map((ev, i) => (
                                            <li key={ev.id} className="relative pl-4">
                                                <span
                                                    className={`absolute -left-[6px] top-1 w-3 h-3 rounded-full ring-4 ${claro ? 'ring-zinc-50' : 'ring-zinc-950'} ${i === 0 ? 'bg-indigo-500' : claro ? 'bg-zinc-300' : 'bg-zinc-600'}`}
                                                />
                                                <p className={`text-[11px] ${t.fraco}`}>{dataHoraBr(ev.quando)}</p>
                                                {ev.inicio ? (
                                                    <p className={`text-sm font-medium ${t.forte}`}>Entrou no cadastro da GRCC</p>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5 mt-0.5">
                                                        {ev.mudancas.map((m) => {
                                                            if (m.campo === 'status') {
                                                                return (
                                                                    <p key={m.campo} className={`text-sm ${t.forte}`}>
                                                                        {m.para ?? '—'}
                                                                    </p>
                                                                );
                                                            }
                                                            const d = deParaMudanca(m);
                                                            return (
                                                                <p key={m.campo} className="text-sm flex flex-wrap items-center gap-1.5">
                                                                    <span className={t.fraco}>{d.rotulo}:</span>
                                                                    {m.de !== null && <span className={`px-1.5 py-0.5 rounded border text-xs line-through ${t.chipVelho}`}>{d.de}</span>}
                                                                    {m.de !== null && <span className={t.fraco}>→</span>}
                                                                    <span className={`px-1.5 py-0.5 rounded border text-xs font-semibold ${t.chipNovo}`}>{d.para}</span>
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
