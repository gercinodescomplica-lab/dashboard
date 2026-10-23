'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { historicoDoLead } from '@/services/grcc.service';
import { LeadHistorico } from '@/app/grcc/components/LeadHistorico';
import { brl, dataBr } from '@/app/grcc/components/formato';
import type { EventoHistorico } from '@/lib/grcc/tipos';
import type { LeadCidade } from '@/types/cidades';

type Carga = { chave: string; eventos: EventoHistorico[]; erro: boolean };

export function LeadDetalheLeitura({ lead, onFechar, claro }: { lead: LeadCidade | null; onFechar: () => void; claro: boolean }) {
    const [carga, setCarga] = useState<Carga | null>(null);
    const leadId = lead?.id ?? null;
    // Muda quando o lead é trocado ou editado (reload ao vivo) -> recarrega a linha do tempo.
    const chave = lead ? JSON.stringify(lead) : null;

    useEffect(() => {
        if (leadId === null || chave === null) return;
        let cancelado = false;
        historicoDoLead(leadId)
            .then((eventos) => !cancelado && setCarga({ chave, eventos, erro: false }))
            .catch(() => !cancelado && setCarga({ chave, eventos: [], erro: true }));
        return () => {
            cancelado = true;
        };
    }, [leadId, chave]);

    // Só vale a carga do lead atualmente aberto (evita histórico de outro lead).
    const atual = carga && carga.chave === chave ? carga : null;

    const linha = (rotulo: string, valor?: string | null) =>
        valor ? (
            <div className="flex justify-between gap-4 text-sm py-1">
                <span className={claro ? 'text-zinc-500' : 'text-zinc-400'}>{rotulo}</span>
                <span className={`text-right ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{valor}</span>
            </div>
        ) : null;

    return (
        <Sheet open={!!lead} onOpenChange={(o) => {
                if (!o) {
                    setCarga(null);
                    onFechar();
                }
            }}>
            <SheetContent side="right" className={`w-full sm:max-w-lg overflow-y-auto ${claro ? 'bg-white text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'}`}>
                {lead && (
                    <>
                        <SheetHeader>
                            <SheetTitle className={claro ? 'text-zinc-900' : 'text-zinc-100'}>{lead.cliente}</SheetTitle>
                            <SheetDescription>{lead.solicitacao}</SheetDescription>
                        </SheetHeader>
                        <div className="px-4 flex flex-col divide-y divide-zinc-800/40">
                            {linha('Categoria', lead.categoria)}
                            {linha('Etapa', lead.etapa_padrao)}
                            {linha('Andamento', lead.status)}
                            {linha('Valor', lead.valor ? brl(lead.valor) : null)}
                            {linha('Previsão', lead.previsao_fechamento ? dataBr(lead.previsao_fechamento) : null)}
                            {linha('Local', [lead.municipio, lead.uf].filter(Boolean).join(' · '))}
                            {linha('Motivo da perda', lead.motivo_padrao)}
                            {linha('Contato', lead.contato_nome)}
                            {linha('E-mail', lead.contato_email)}
                            {linha('Telefone', lead.contato_telefone)}
                        </div>
                        <div className="p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Histórico</h3>
                            {!atual ? (
                                <p className="text-sm text-zinc-500">Carregando histórico...</p>
                            ) : atual.erro ? (
                                <p className="text-sm text-red-500">Não foi possível carregar o histórico.</p>
                            ) : (
                                <LeadHistorico eventos={atual.eventos} claro={claro} />
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
