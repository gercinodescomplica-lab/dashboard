'use client';

import { useState } from 'react';
import readXlsxFile, { readSheetNames } from 'read-excel-file';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { lerLinhasPlanilha } from '@/lib/grcc/planilha';
import { montarPrevia } from '@/lib/grcc/previa';
import type { LeadGrcc, Previa, ProjetoManual, ResultadoPlanilha } from '@/lib/grcc/tipos';
import { confirmarImportacao } from '../actions';
import { useChaveGrcc } from '../KeyGateGrcc';
import { brl, rotuloMudanca } from './formato';

/** Aba da planilha com os leads (fechada no Step 1 da Task 4). Se não existir, usa a primeira. */
const ABA_PADRAO = 'Leads';

type AbaPrevia = 'novos' | 'alterados' | 'iguais' | 'problemas';

export function ImportarExcelDialog({
    aberto,
    leadsAtuais,
    projetosManuais,
    onFechar,
    onGravado,
}: {
    aberto: boolean;
    leadsAtuais: LeadGrcc[];
    projetosManuais: ProjetoManual[];
    onFechar: () => void;
    onGravado: (mensagem: string) => Promise<void>;
}) {
    const { chave } = useChaveGrcc();
    const [arquivo, setArquivo] = useState<string | null>(null);
    const [lido, setLido] = useState<ResultadoPlanilha | null>(null);
    const [previa, setPrevia] = useState<Previa | null>(null);
    const [aba, setAba] = useState<AbaPrevia>('novos');
    const [lendo, setLendo] = useState(false);
    const [gravando, setGravando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [cutoverOk, setCutoverOk] = useState(false);

    const primeiraImportacao = leadsAtuais.length === 0 && projetosManuais.length > 0;

    const limpar = () => {
        setArquivo(null);
        setLido(null);
        setPrevia(null);
        setErro(null);
        setCutoverOk(false);
        setAba('novos');
    };

    const fechar = () => {
        limpar();
        onFechar();
    };

    const ler = async (file: File) => {
        limpar();
        setLendo(true);
        try {
            const abas = await readSheetNames(file);
            const sheet = abas.includes(ABA_PADRAO) ? ABA_PADRAO : abas[0];
            const matriz = (await readXlsxFile(file, { sheet })) as unknown[][];
            const r = lerLinhasPlanilha(matriz);
            setArquivo(file.name);
            if (r.colunasFaltando.length > 0) {
                setErro(`A planilha não tem as colunas obrigatórias: ${r.colunasFaltando.join(', ')}.`);
                return;
            }
            setLido(r);
            setPrevia(montarPrevia(r.linhas, r.problemas, leadsAtuais));
        } catch {
            setErro('Não foi possível ler o arquivo. Confirme que é um .xlsx válido.');
        } finally {
            setLendo(false);
        }
    };

    const total = previa ? previa.novos.length + previa.alterados.length : 0;
    const podeGravar = !!previa && total > 0 && (!primeiraImportacao || cutoverOk) && !gravando;

    const gravar = async () => {
        if (!previa || !lido || !arquivo) return;
        setGravando(true);
        setErro(null);
        try {
            const r = await confirmarImportacao(chave, {
                arquivo,
                linhas: lido.linhas,
                problemas: lido.problemas,
                substituirPipelineManual: primeiraImportacao && cutoverOk,
            });
            if (!r.ok) {
                setErro(r.erro);
                return;
            }
            await onGravado(`${r.valor.novos} ${r.valor.novos === 1 ? 'novo' : 'novos'}, ${r.valor.alterados} atualizados.`);
            fechar();
        } catch {
            setErro('Não foi possível gravar a importação. Tente de novo.');
        } finally {
            setGravando(false);
        }
    };

    const linhasLidas = lido ? lido.linhas.length + lido.problemas.length : 0;
    const chipAba = (a: AbaPrevia, rotulo: string, n: number) => (
        <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${aba === a ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
        >
            {rotulo} {n}
        </button>
    );

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="sm:max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar Excel</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Nada é gravado até você confirmar. Leads que não estão na planilha são mantidos.
                    </DialogDescription>
                </DialogHeader>

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-800 rounded-xl p-6 cursor-pointer hover:border-indigo-500/60">
                    {lendo ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : <FileSpreadsheet className="w-6 h-6 text-indigo-400" />}
                    <span className="text-sm text-zinc-300">{arquivo ?? 'Escolha ou arraste o arquivo .xlsx'}</span>
                    <input
                        type="file"
                        aria-label="Arquivo .xlsx"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) ler(f);
                            e.target.value = '';
                        }}
                    />
                </label>

                {erro && <p className="text-sm text-red-400">{erro}</p>}

                {previa && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-zinc-300">
                            {arquivo} · {linhasLidas} linhas lidas
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {chipAba('novos', 'Novos', previa.novos.length)}
                            {chipAba('alterados', 'Alterados', previa.alterados.length)}
                            {chipAba('iguais', 'Iguais', previa.iguais)}
                            {chipAba('problemas', '⚠ Com problema', previa.problemas.length)}
                        </div>

                        <div className="border border-zinc-800 rounded-xl p-3 max-h-72 overflow-y-auto text-sm flex flex-col gap-2">
                            {aba === 'novos' &&
                                previa.novos.map((n) => (
                                    <p key={n.linha}>
                                        <span className="text-zinc-500">Linha {n.linha}:</span> {n.dados.cliente} · {n.dados.solicitacao || '—'} ·{' '}
                                        {brl(n.dados.valor)} · {n.dados.categoria}
                                    </p>
                                ))}
                            {aba === 'alterados' &&
                                previa.alterados.map((a) => (
                                    <div key={a.linha}>
                                        <p className="font-semibold">{a.dados.cliente}</p>
                                        {a.mudancas.map((m) => (
                                            <p key={m.campo} className="text-zinc-400 pl-3">
                                                {rotuloMudanca(m)}
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            {aba === 'iguais' && <p className="text-zinc-400">{previa.iguais} linhas sem nenhuma mudança.</p>}
                            {aba === 'problemas' &&
                                previa.problemas.map((p) => (
                                    <p key={`${p.linha}-${p.motivo}`} className="text-amber-300">
                                        Linha {p.linha}: {p.motivo} {p.cliente && <span className="text-zinc-500">({p.cliente})</span>} — será ignorada
                                    </p>
                                ))}
                        </div>

                        {primeiraImportacao && (
                            <div className="border border-amber-500/40 bg-amber-500/5 rounded-xl p-3 flex flex-col gap-2">
                                <p className="text-sm text-amber-200 font-semibold">Pipeline da Débora</p>
                                <p className="text-sm text-zinc-300">
                                    Esta é a primeira importação. Os {projetosManuais.length} projetos digitados à mão no pipeline da Débora serão
                                    substituídos pelos {previa.novos.length} projetos gerados a partir dos leads.
                                </p>
                                <ul className="text-xs text-zinc-400 max-h-32 overflow-y-auto">
                                    {projetosManuais.map((p) => (
                                        <li key={p.id}>
                                            {p.orgao ?? '—'} · {p.name} · {brl(p.value)} · {p.quarter.toUpperCase()}
                                        </li>
                                    ))}
                                </ul>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={cutoverOk} onChange={(e) => setCutoverOk(e.target.checked)} />
                                    Substituir os {projetosManuais.length} projetos digitados à mão
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={fechar}>
                                Cancelar
                            </Button>
                            <Button disabled={!podeGravar} onClick={gravar}>
                                {gravando ? 'Gravando…' : `Gravar ${total} ${total === 1 ? 'lead' : 'leads'}`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
