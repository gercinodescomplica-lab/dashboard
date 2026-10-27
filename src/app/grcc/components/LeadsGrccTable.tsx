'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Download, EyeOff, List, Loader2, MapPin, Search } from 'lucide-react';
import { CATEGORIAS_GRCC, ROTULO_TEMPERATURA, TEMPERATURAS_LEAD, type CategoriaGrcc, type LeadGrcc, type TemperaturaLead } from '@/lib/grcc/tipos';
import { pendenciasDoLead } from '@/lib/grcc/validacao';
import { temperaturaDoLead } from '@/lib/grcc/pipeline';
import { agruparPorCidade, alternarOrdem, COLUNAS_ORDEM, ORDEM_PADRAO, ordemValida, ordenarLeads, type ColunaOrdem, type Ordem } from '@/lib/grcc/organizar';
import { chaveTexto } from '@/lib/grcc/normalizar';
import { LARGURAS_EXPORTACAO, nomeArquivoExportacao, planilhaDosLeads } from '@/lib/grcc/exportar';
import { brl, corCategoria, dataBr, haQuanto, ICONE_TEMPERATURA } from './formato';
import { useClaro } from '../tema';

type Filtro = 'todos' | 'pendencias' | CategoriaGrcc;
type Visao = 'lista' | 'cidade';

const COLUNAS = 6;
const CHAVE_ORDEM = 'grcc-ordem-tabela';

const ROTULO_ORDEM: Record<ColunaOrdem, string> = {
    cliente: 'Cliente',
    solicitacao: 'Solicitação',
    categoria: 'Categoria (funil)',
    valor: 'Valor',
    previsao: 'Previsão',
    atualizado: 'Atualizado',
};

function lerOrdemSalva(): Ordem {
    try {
        const v = JSON.parse(localStorage.getItem(CHAVE_ORDEM) ?? 'null');
        return ordemValida(v) ? v : ORDEM_PADRAO;
    } catch {
        return ORDEM_PADRAO;
    }
}

function falta(pendencias: string[]): string {
    return `Falta: ${pendencias.map((p) => p.replace(/^Sem /, '')).join(', ')}`;
}

export function LeadsGrccTable({
    leads,
    onAbrir,
    destacados = new Set<number>(),
}: {
    leads: LeadGrcc[];
    onAbrir: (id: number) => void;
    destacados?: Set<number>;
}) {
    const claro = useClaro();
    const cores = corCategoria(claro);
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [busca, setBusca] = useState('');
    // Soma com o filtro de categoria (ex.: Em tratativas + Quente). null = todas.
    const [temp, setTemp] = useState<TemperaturaLead | null>(null);
    const [visao, setVisao] = useState<Visao>('lista');
    // Começa no padrão (igual no servidor e no cliente) e só depois lê a preferência salva — evita erro de hidratação.
    const [ordem, setOrdem] = useState<Ordem>(ORDEM_PADRAO);
    useEffect(() => setOrdem(lerOrdemSalva()), []);
    const mudarOrdem = (nova: Ordem) => {
        setOrdem(nova);
        try {
            localStorage.setItem(CHAVE_ORDEM, JSON.stringify(nova));
        } catch {
            // sem armazenamento (aba anônima): a ordem vale só nesta visita
        }
    };

    const pend = useMemo(() => new Map(leads.map((l) => [l.id, pendenciasDoLead(l)])), [leads]);
    const contagem = useMemo(() => {
        const c = new Map<Filtro, number>([['todos', leads.length], ['pendencias', 0]]);
        for (const l of leads) {
            c.set(l.categoria, (c.get(l.categoria) ?? 0) + 1);
            if ((pend.get(l.id) ?? []).length > 0) c.set('pendencias', (c.get('pendencias') ?? 0) + 1);
        }
        return c;
    }, [leads, pend]);

    const passaCategoria = (l: LeadGrcc) => {
        if (filtro === 'pendencias') return (pend.get(l.id) ?? []).length > 0;
        return filtro === 'todos' || l.categoria === filtro;
    };
    // Contagem da temperatura dentro da categoria escolhida, para o número bater com a lista.
    const contagemTemp = useMemo(() => {
        const c = new Map<TemperaturaLead, number>();
        for (const l of leads) {
            if (!passaCategoria(l)) continue;
            const t = temperaturaDoLead(l);
            if (t === 'quente' || t === 'morno' || t === 'frio') c.set(t, (c.get(t) ?? 0) + 1);
        }
        return c;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leads, filtro, pend]);

    const visiveis = useMemo(() => {
        const alvo = chaveTexto(busca);
        const filtrados = leads.filter((l) => {
            if (!passaCategoria(l)) return false;
            if (temp && temperaturaDoLead(l) !== temp) return false;
            if (!alvo) return true;
            return chaveTexto(`${l.cliente} ${l.solicitacao} ${l.municipio ?? ''} ${l.status ?? ''}`).includes(alvo);
        });
        // "Por cidade" mantém esta ordem dentro de cada município (o agrupamento preserva a ordem de entrada).
        return ordenarLeads(filtrados, ordem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leads, filtro, temp, busca, pend, ordem]);

    const grupos = useMemo(() => (visao === 'cidade' ? agruparPorCidade(visiveis) : []), [visao, visiveis]);

    // Baixa exatamente o que a tabela mostra (filtros, busca e ordem). Lib carregada só no clique.
    const [baixando, setBaixando] = useState(false);
    const [erroDownload, setErroDownload] = useState<string | null>(null);
    const baixarExcel = async () => {
        setBaixando(true);
        setErroDownload(null);
        try {
            const { default: writeXlsxFile } = await import('write-excel-file/browser');
            const nome = nomeArquivoExportacao([
                filtro === 'todos' ? null : filtro,
                temp ? ROTULO_TEMPERATURA[temp] : null,
                busca.trim() ? 'busca' : null,
            ]);
            await writeXlsxFile(planilhaDosLeads(visiveis), { sheet: 'Leads', columns: LARGURAS_EXPORTACAO, stickyRowsCount: 1 }).toFile(nome);
        } catch {
            setErroDownload('Não foi possível gerar a planilha. Tente de novo.');
        } finally {
            setBaixando(false);
        }
    };

    const chip = (f: Filtro, rotulo: string) => {
        const n = contagem.get(f) ?? 0;
        if (f !== 'todos' && f !== 'pendencias' && n === 0) return null;
        const ativo = filtro === f;
        return (
            <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    ativo ? 'bg-indigo-600 text-white border-indigo-500' : `${claro ? 'bg-white' : 'bg-zinc-900'} ${claro ? 'text-zinc-600' : 'text-zinc-400'} ${claro ? 'border-zinc-200' : 'border-zinc-800'} ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-100'}`
                }`}
            >
                {f === 'pendencias' && <AlertTriangle className={`w-3.5 h-3.5 ${claro ? 'text-amber-600' : 'text-amber-400'}`} />}
                {rotulo} {n}
            </button>
        );
    };

    const botaoTemp = (t: TemperaturaLead | null) => {
        const ativo = temp === t;
        const n = t ? contagemTemp.get(t) ?? 0 : null;
        return (
            <button
                key={t ?? 'todas'}
                type="button"
                onClick={() => setTemp(t)}
                aria-pressed={ativo}
                title={t ? `Só leads ${t}s no pipeline` : 'Todas as temperaturas'}
                className={`flex items-center gap-1 px-2.5 h-8 rounded-md text-xs font-semibold ${
                    ativo ? (claro ? 'bg-white shadow-sm text-zinc-900' : 'bg-zinc-800 text-zinc-100') : `${claro ? 'text-zinc-600' : 'text-zinc-400'} ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-100'}`
                }`}
            >
                {t ? (
                    <>
                        <span aria-hidden>{ICONE_TEMPERATURA[t]}</span> {ROTULO_TEMPERATURA[t]} <span className="opacity-60">{n}</span>
                    </>
                ) : (
                    'Todas'
                )}
            </button>
        );
    };

    const botaoVisao = (v: Visao, rotulo: string, Icone: typeof List) => (
        <button
            type="button"
            onClick={() => setVisao(v)}
            aria-pressed={visao === v}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold ${
                visao === v ? (claro ? 'bg-white shadow-sm text-zinc-900' : 'bg-zinc-800 text-zinc-100') : `${claro ? 'text-zinc-600' : 'text-zinc-400'} ${claro ? 'hover:text-zinc-900' : 'hover:text-zinc-100'}`
            }`}
        >
            <Icone className="w-3.5 h-3.5" />
            {rotulo}
        </button>
    );

    const linha = (l: LeadGrcc) => {
        const p = pend.get(l.id) ?? [];
        return (
            <tr
                key={l.id}
                onClick={() => onAbrir(l.id)}
                className={`block md:table-row px-4 py-3 md:p-0 cursor-pointer ${claro ? 'hover:bg-zinc-50' : 'hover:bg-zinc-900/60'} transition-colors ${destacados.has(l.id) ? 'bg-indigo-500/10' : ''}`}
            >
                <td className="block md:table-cell md:px-3 md:py-3 align-top md:overflow-hidden">
                    <div className={`font-semibold ${claro ? 'text-zinc-900' : 'text-zinc-100'} truncate`} title={l.cliente}>
                        {l.cliente}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                        {l.municipio ?? 'Sem município'} · {l.uf ?? '—'}
                    </div>
                    {!l.visivelDashboard && (
                        <div className={`text-[11px] flex items-center gap-1 mt-0.5 ${claro ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            <EyeOff className="w-3 h-3 shrink-0" /> Oculto no dashboard
                        </div>
                    )}
                    {p.length > 0 && (
                        <div className={`text-[11px] ${claro ? 'text-amber-600' : 'text-amber-400'} flex items-center gap-1 mt-0.5`}>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {falta(p)}
                        </div>
                    )}
                </td>
                <td className="block md:table-cell md:px-3 py-1 md:py-3 align-top md:overflow-hidden">
                    <div className={`${claro ? 'text-zinc-700' : 'text-zinc-300'} truncate`} title={l.solicitacao}>
                        {l.solicitacao || '—'}
                    </div>
                    {l.status && (
                        <div className="text-xs text-zinc-500 truncate" title={l.status}>
                            {l.status}
                        </div>
                    )}
                </td>
                <td className="inline-block md:table-cell md:px-3 md:py-3 align-top mr-3 md:mr-0">
                    <span
                        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border whitespace-nowrap ${cores[l.categoria]}`}
                        title={`No pipeline: ${temperaturaDoLead(l)}${l.temperatura ? ' (escolhida no cadastro)' : ' (automática pela categoria)'}`}
                    >
                        {l.categoria}
                        {ICONE_TEMPERATURA[temperaturaDoLead(l)] && <span aria-label={temperaturaDoLead(l)}>{ICONE_TEMPERATURA[temperaturaDoLead(l)]}</span>}
                    </span>
                    {l.etapa && <div className="hidden md:block text-[11px] text-zinc-500 mt-1">{l.etapa}</div>}
                </td>
                <td className={`inline-block md:table-cell md:px-3 md:py-3 align-top md:text-right font-mono text-[13px] ${claro ? 'text-zinc-800' : 'text-zinc-200'} whitespace-nowrap mr-3 md:mr-0`}>
                    {l.valor ? brl(l.valor) : '—'}
                </td>
                <td className={`inline-block md:table-cell md:px-3 md:py-3 align-top ${claro ? 'text-zinc-600' : 'text-zinc-400'} whitespace-nowrap mr-3 md:mr-0`}>{dataBr(l.previsaoFechamento)}</td>
                <td className="hidden md:table-cell md:px-3 md:py-3 align-top text-zinc-500 text-xs whitespace-nowrap">{haQuanto(l.atualizadoEm)}</td>
            </tr>
        );
    };

    const cabecalho = (coluna: ColunaOrdem, rotulo: string, alinhar: 'left' | 'right' = 'left') => {
        const ativa = ordem.coluna === coluna;
        const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
        return (
            <th
                scope="col"
                aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`px-1.5 py-2 ${alinhar === 'right' ? 'text-right' : 'text-left'}`}
            >
                <button
                    type="button"
                    onClick={() => mudarOrdem(alternarOrdem(ordem, coluna))}
                    title={`Ordenar por ${rotulo.toLowerCase()}`}
                    className={`group inline-flex items-center gap-1 px-1.5 py-1 rounded-md uppercase tracking-wider transition-colors ${alinhar === 'right' ? 'flex-row-reverse' : ''} ${
                        ativa
                            ? claro ? 'text-indigo-700 bg-indigo-50' : 'text-indigo-300 bg-indigo-500/10'
                            : claro ? 'hover:text-zinc-900 hover:bg-zinc-100' : 'hover:text-zinc-100 hover:bg-zinc-900'
                    }`}
                >
                    {rotulo}
                    <Icone className={`w-3.5 h-3.5 shrink-0 ${ativa ? '' : 'opacity-40 group-hover:opacity-100'}`} />
                </button>
            </th>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {chip('todos', 'Todos')}
                {CATEGORIAS_GRCC.map((c) => chip(c, c))}
                {chip('pendencias', 'Pendências')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-1 ${claro ? 'bg-zinc-100' : 'bg-zinc-900'} border ${claro ? 'border-zinc-200' : 'border-zinc-800'} rounded-lg p-0.5`}>
                    {botaoVisao('lista', 'Lista', List)}
                    {botaoVisao('cidade', 'Por cidade', MapPin)}
                </div>
                <div
                    role="group"
                    aria-label="Filtrar por temperatura"
                    className={`flex items-center gap-1 ${claro ? 'bg-zinc-100' : 'bg-zinc-900'} border ${claro ? 'border-zinc-200' : 'border-zinc-800'} rounded-lg p-0.5`}
                >
                    <span className={`px-2 text-[11px] font-semibold uppercase tracking-wider ${claro ? 'text-zinc-500' : 'text-zinc-500'}`}>Temperatura</span>
                    {botaoTemp(null)}
                    {TEMPERATURAS_LEAD.map((t) => botaoTemp(t))}
                </div>
                <label className={`md:hidden flex items-center gap-2 text-xs ${claro ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Ordenar
                    <select
                        aria-label="Ordenar leads"
                        value={`${ordem.coluna}:${ordem.direcao}`}
                        onChange={(e) => {
                            const [coluna, direcao] = e.target.value.split(':');
                            const nova = { coluna, direcao };
                            if (ordemValida(nova)) mudarOrdem(nova);
                        }}
                        className={`h-9 rounded-lg border px-2 text-sm ${claro ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'}`}
                    >
                        {COLUNAS_ORDEM.flatMap((c) =>
                            (['asc', 'desc'] as const).map((d) => (
                                <option key={`${c}:${d}`} value={`${c}:${d}`}>
                                    {ROTULO_ORDEM[c]} {d === 'asc' ? '↑' : '↓'}
                                </option>
                            ))
                        )}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={baixarExcel}
                    disabled={baixando || visiveis.length === 0}
                    title={`Baixar os ${visiveis.length} leads deste filtro em Excel (.xlsx)`}
                    className={`ml-auto flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold border disabled:opacity-50 ${claro ? 'bg-white border-zinc-200 text-zinc-700 hover:text-zinc-900' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100'}`}
                >
                    {baixando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Baixar Excel ({visiveis.length})
                </button>
                <label className={`flex items-center gap-2 ${claro ? 'bg-white' : 'bg-zinc-900'} border ${claro ? 'border-zinc-200' : 'border-zinc-800'} rounded-lg px-3 h-9 w-full sm:w-80`}>
                    <Search className="w-4 h-4 text-zinc-500" />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar cliente, solicitação, município ou andamento"
                        className={`bg-transparent outline-none text-sm ${claro ? 'text-zinc-800' : 'text-zinc-200'} w-full`}
                    />
                </label>
            </div>

            <div className={`border ${claro ? 'border-zinc-200' : 'border-zinc-800'} rounded-xl overflow-x-auto`}>
                <table className="w-full text-sm block md:table md:table-fixed">
                    {/* Larguras fixas: as colunas curtas têm tamanho certo e o que sobra vai para Cliente/Solicitação (que truncam com "…"). */}
                    <colgroup className="hidden md:table-column-group">
                        <col />
                        <col />
                        <col className="w-[148px]" />
                        <col className="w-[128px]" />
                        <col className="w-[104px]" />
                        <col className="w-[120px]" />
                    </colgroup>
                    <thead className={`hidden md:table-header-group ${claro ? 'bg-white' : 'bg-zinc-950'} ${claro ? 'text-zinc-600' : 'text-zinc-400'} text-[11px] uppercase tracking-wider`}>
                        <tr>
                            {cabecalho('cliente', 'Cliente')}
                            {cabecalho('solicitacao', 'Solicitação · último andamento')}
                            {cabecalho('categoria', 'Categoria')}
                            {cabecalho('valor', 'Valor', 'right')}
                            {cabecalho('previsao', 'Previsão')}
                            {cabecalho('atualizado', 'Atualizado')}
                        </tr>
                    </thead>
                    {visao === 'lista' ? (
                        <tbody className={`block md:table-row-group divide-y ${claro ? 'divide-zinc-200' : 'divide-zinc-800/60'}`}>{visiveis.map(linha)}</tbody>
                    ) : (
                        grupos.map((g) => (
                            <tbody key={g.chave} className={`block md:table-row-group divide-y ${claro ? 'divide-zinc-200' : 'divide-zinc-800/60'} border-t ${claro ? 'border-zinc-200' : 'border-zinc-800'}`}>
                                <tr className={`block md:table-row ${g.chave === 'Sem cidade' ? 'bg-amber-500/5' : `${claro ? 'bg-zinc-100' : 'bg-zinc-900/70'}`}`}>
                                    <th scope="rowgroup" role="rowheader" colSpan={COLUNAS} className="block md:table-cell text-left px-4 py-2 font-normal">
                                        <span className={`font-semibold ${g.chave === 'Sem cidade' ? `${claro ? 'text-amber-700' : 'text-amber-300'}` : `${claro ? 'text-zinc-900' : 'text-zinc-100'}`}`}>{g.rotulo}</span>
                                        <span className="text-xs text-zinc-500 ml-2">
                                            {g.leads.length} {g.leads.length === 1 ? 'lead' : 'leads'}
                                            {g.valorAtivo > 0 && ` · ${brl(g.valorAtivo)} em aberto`}
                                        </span>
                                        <span className="inline-flex flex-wrap gap-1 ml-2 align-middle">
                                            {(Object.entries(g.porCategoria) as [CategoriaGrcc, number][]).map(([c, n]) => (
                                                <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cores[c]}`}>
                                                    {c} {n}
                                                </span>
                                            ))}
                                        </span>
                                    </th>
                                </tr>
                                {g.leads.map(linha)}
                            </tbody>
                        ))
                    )}
                </table>
                {erroDownload && <p role="alert" className={`text-center text-sm py-2 ${claro ? 'text-red-600' : 'text-red-400'}`}>{erroDownload}</p>}
                {visiveis.length === 0 && <p className="text-center text-sm text-zinc-500 py-10">Nenhum lead neste filtro.</p>}
            </div>
        </div>
    );
}
