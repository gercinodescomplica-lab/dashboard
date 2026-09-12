'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, HelpCircle, PackageSearch, Users, FileCheck2, Layers } from 'lucide-react';
import type { OportunidadeStatus, OportunidadesRiscoData } from '@/types/oportunidades';
import { formatCurrency } from '@/lib/format';
import { causaLabel, contarPorStatus, formatarData, ordenarPorCriticidade, statusMeta } from '@/lib/oportunidades';

/**
 * Bloco "Oportunidades em Risco" (apresentação pura) do fim da tela inicial do gerente.
 *
 * Recebe os dados prontos por prop — quem busca é `OportunidadesRisco.tsx`, que hoje lê o
 * levantamento estático (`src/data/oportunidades-consolidado.json`) via server action e,
 * quando a origem virar tabela no banco, continua igual.
 */

interface OportunidadesRiscoPainelProps {
    /** `null` = gerente sem levantamento consolidado. */
    data: OportunidadesRiscoData | null;
    lightActive?: boolean;
}

type FiltroStatus = 'todos' | OportunidadeStatus;

export function OportunidadesRiscoPainel({ data, lightActive = false }: OportunidadesRiscoPainelProps) {
    const [filtro, setFiltro] = useState<FiltroStatus>('todos');

    const T = {
        bannerBg: lightActive ? 'bg-amber-50 border-amber-200' : 'bg-amber-950/20 border-amber-900/40',
        bannerHeading: lightActive ? 'text-amber-800' : 'text-amber-300',
        bannerSub: lightActive ? 'text-amber-700/80' : 'text-zinc-400',
        bannerValue: lightActive ? 'text-amber-800' : 'text-amber-300',
        bannerValueLabel: lightActive ? 'text-amber-700/70' : 'text-zinc-500',
        iconBox: lightActive ? 'bg-amber-100 border-amber-200' : 'bg-amber-500/10 border-amber-500/20',
        iconColor: lightActive ? 'text-amber-600' : 'text-amber-400',
        cardBg: lightActive
            ? 'bg-white border-zinc-200 hover:border-amber-300'
            : 'bg-zinc-900/60 border-zinc-800 hover:border-amber-900/50',
        orgao: lightActive ? 'text-indigo-600' : 'text-indigo-400',
        titulo: lightActive ? 'text-zinc-900' : 'text-zinc-100',
        label: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        causaBox: lightActive ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-900/40 text-amber-200',
        divider: lightActive ? 'border-zinc-200' : 'border-zinc-800/60',
        chipOff: lightActive
            ? 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700',
        chipOn: 'bg-indigo-600 border-indigo-500 text-white',
        pill: lightActive ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300',
        pillValor: lightActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300',
        pillArea: lightActive ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/30 border-red-900/40 text-red-300',
        pillProposta: lightActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-950/30 border-indigo-900/40 text-indigo-300',
        emptyText: lightActive ? 'text-zinc-500' : 'text-zinc-400',
        emptyBorder: lightActive ? 'border-zinc-300' : 'border-zinc-800',
        metaText: lightActive ? 'text-zinc-400' : 'text-zinc-500',
    };

    const ordenadas = useMemo(() => (data ? ordenarPorCriticidade(data.oportunidades) : []), [data]);

    const contagemPorStatus = useMemo(() => contarPorStatus(ordenadas), [ordenadas]);

    const visiveis = filtro === 'todos' ? ordenadas : ordenadas.filter((o) => o.status === filtro);

    const valorTotalIndicado = useMemo(
        () => ordenadas.reduce((acc, o) => acc + (o.valorIndicado ?? 0), 0),
        [ordenadas]
    );

    if (!data) {
        return (
            <div className={`flex flex-col items-center justify-center py-16 border border-dashed rounded-2xl gap-3 ${T.emptyText} ${T.emptyBorder}`}>
                <AlertTriangle className="w-8 h-8 opacity-40" />
                <p className="text-base font-medium">Nenhum levantamento de oportunidades em risco para esta gerência.</p>
            </div>
        );
    }

    const dataColeta = formatarData(data.dataColeta);
    const dataConsolidacao = formatarData(data.dataConsolidacao);

    return (
        <div className="flex flex-col gap-6">
            {/* Cabeçalho do levantamento */}
            <div className={`border rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${T.bannerBg}`}>
                <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-3 rounded-xl border ${T.iconBox}`}>
                        <AlertTriangle className={`w-6 h-6 ${T.iconColor}`} />
                    </div>
                    <div>
                        <h4 className={`text-lg font-bold ${T.bannerHeading}`}>Oportunidades em Risco</h4>
                        <p className={`text-xs ${T.bannerSub}`}>
                            {ordenadas.length} {ordenadas.length === 1 ? 'oportunidade' : 'oportunidades'} · {data.levantamento}
                            {dataColeta ? ` · coleta em ${dataColeta}` : ''}
                        </p>
                    </div>
                </div>
                {valorTotalIndicado > 0 && (
                    <div className="text-left sm:text-right">
                        <span className={`text-xs uppercase tracking-wider font-semibold block ${T.bannerValueLabel}`}>
                            Valor indicado
                        </span>
                        <span className={`text-2xl font-bold font-mono ${T.bannerValue}`}>
                            {formatCurrency(valorTotalIndicado)}
                        </span>
                    </div>
                )}
            </div>

            {ordenadas.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 border border-dashed rounded-2xl gap-3 ${T.emptyText} ${T.emptyBorder}`}>
                    <AlertTriangle className="w-8 h-8 opacity-40" />
                    <p className="text-base font-medium">Nenhuma oportunidade em risco registrada neste levantamento.</p>
                </div>
            ) : (
                <>
                    {/* Filtro por status */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltro('todos')}
                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors duration-200 ${
                                filtro === 'todos' ? T.chipOn : T.chipOff
                            }`}
                        >
                            Todas ({ordenadas.length})
                        </button>
                        {contagemPorStatus.map(([status, total]) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFiltro(status)}
                                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors duration-200 ${
                                    filtro === status ? T.chipOn : T.chipOff
                                }`}
                            >
                                {statusMeta(status).label} ({total})
                            </button>
                        ))}
                    </div>

                    {/* Cards */}
                    {visiveis.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-12 border border-dashed rounded-2xl gap-3 ${T.emptyText} ${T.emptyBorder}`}>
                            <p className="text-sm font-medium">Nenhuma oportunidade com este status.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {visiveis.map((item, idx) => {
                                const meta = statusMeta(item.status);
                                return (
                                    <div
                                        key={`${item.orgao}-${item.produtoTema}-${idx}`}
                                        className={`border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 shadow-sm ${T.cardBg}`}
                                    >
                                        <div>
                                            {/* Órgão + status */}
                                            <div className={`flex items-center justify-between gap-3 pb-3 mb-3 border-b ${T.divider}`}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Building2 className={`w-4 h-4 shrink-0 ${T.orgao}`} />
                                                    <span className={`font-bold text-base truncate ${T.orgao}`} title={item.orgao}>
                                                        {item.orgao}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${
                                                        lightActive ? meta.light : meta.dark
                                                    }`}
                                                >
                                                    {meta.label}
                                                </span>
                                            </div>

                                            {/* Produto / tema */}
                                            <div className="flex items-start gap-2">
                                                <PackageSearch className={`w-4 h-4 mt-0.5 shrink-0 ${T.label}`} />
                                                <p className={`font-semibold text-sm leading-snug ${T.titulo}`}>{item.produtoTema}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 text-xs">
                                            {/* Motivo (causa raiz) */}
                                            <div className="space-y-1">
                                                <span className={`font-semibold flex items-center gap-1.5 ${T.label}`}>
                                                    <HelpCircle className="w-3.5 h-3.5" /> Motivo (causa raiz)
                                                </span>
                                                <div className={`p-3 rounded-xl border leading-relaxed ${T.causaBox}`}>
                                                    <span className="font-bold block mb-1">{causaLabel(item.causaRaiz)}</span>
                                                    {item.descricao || 'Sem descrição registrada.'}
                                                </div>
                                            </div>

                                            {/* Metadados */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                {item.valorIndicado !== null && item.valorIndicado > 0 && (
                                                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold font-mono ${T.pillValor}`}>
                                                        {formatCurrency(item.valorIndicado)}
                                                    </span>
                                                )}
                                                {item.areaBloqueadora && (
                                                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${T.pillArea}`}>
                                                        Bloqueio: {item.areaBloqueadora}
                                                    </span>
                                                )}
                                                {item.tinhaPropostaFormal !== null && (
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 ${
                                                            item.tinhaPropostaFormal ? T.pillProposta : T.pill
                                                        }`}
                                                    >
                                                        <FileCheck2 className="w-3 h-3" />
                                                        {item.tinhaPropostaFormal ? 'Com proposta formal' : 'Sem proposta formal'}
                                                    </span>
                                                )}
                                                {item.envolvidos.length > 0 && (
                                                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 ${T.pill}`}>
                                                        <Users className="w-3 h-3" /> {item.envolvidos.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Rodapé de origem dos dados */}
            <p className={`text-[11px] flex items-center gap-1.5 ${T.metaText}`}>
                <Layers className="w-3.5 h-3.5" />
                Levantamento: “{data.levantamento}”
                {dataConsolidacao ? ` · consolidado em ${dataConsolidacao}` : ''} · gerência {data.gerencia}
            </p>
        </div>
    );
}
