'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { PainelCarteira } from '@/app/settings/carteiraActions';
import type { ForaDaCarteira, LinhaSemCliente } from '@/db/carteira';
import type { Rodar } from './admin';

const ROTULO_TABELA: Record<LinhaSemCliente['tabela'], string> = { contrato: 'Contrato', proposta: 'Proposta', cx: 'CX', projects: 'Projeto' };
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function AConferir({ painel, rodar }: { painel: PainelCarteira; rodar: Rodar }) {
    const [trazer, setTrazer] = useState<ForaDaCarteira | null>(null);
    return (
        <div className="space-y-8">
            <section aria-label="Fora da carteira" className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-50">Fora da carteira</h2>
                <p className="text-sm text-zinc-400">A carteira do cliente é uma gerência, mas contratos, propostas, CX ou projetos dele estão em outra.</p>
                {painel.fora.length === 0 ? <p className="text-sm text-zinc-500">Nenhum cliente fora da carteira.</p> : (
                    <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
                        {painel.fora.map((f) => {
                            const nome = f.sigla ?? f.nome;
                            return (
                                <li key={f.clienteId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                    <span className="text-zinc-200">{nome} — carteira {f.carteira}; dados em {f.gerenciasDosDados.join(', ')}</span>
                                    <Button size="sm" aria-label={`Trazer os dados de ${nome} para a carteira`} onClick={() => setTrazer(f)}>Trazer os dados para a carteira</Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-xs text-zinc-500">Para mudar a carteira em vez dos dados, use a aba Organograma.</p>
            </section>
            <section aria-label="Sem cliente" className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-50">Sem cliente</h2>
                <p className="text-sm text-zinc-400">Linhas cujo texto não casou com nenhum cliente. Ligue a um cliente para que acompanhem a carteira.</p>
                {painel.semCliente.length === 0 ? <p className="text-sm text-zinc-500">Todas as linhas têm cliente.</p> : (
                    <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
                        {painel.semCliente.map((l) => <LinhaParaLigar key={`${l.tabela}:${l.id}`} linha={l} clientes={painel.todosClientes} rodar={rodar} />)}
                    </ul>
                )}
            </section>
            <ConfirmDialog
                aberto={!!trazer}
                titulo="Trazer os dados para a carteira"
                descricao={trazer ? `Contratos, propostas, CX e projetos de ${trazer.sigla ?? trazer.nome} vão para ${trazer.carteira}. A troca fica registrada no histórico.` : ''}
                rotuloConfirmar="Trazer"
                tom="principal"
                aoCancelar={() => setTrazer(null)}
                aoConfirmar={async () => { const f = trazer!; setTrazer(null); await rodar((k) => acoes.alinharClienteAction(k, f.clienteId), `Dados de ${f.sigla ?? f.nome} trazidos para ${f.carteira}.`); }}
            />
        </div>
    );
}

function LinhaParaLigar({ linha, clientes, rodar }: { linha: LinhaSemCliente; clientes: PainelCarteira['todosClientes']; rodar: Rodar }) {
    const [texto, setTexto] = useState('');
    const opcoes = clientes.filter((c) => !texto || semAcento(`${c.sigla ?? ''} ${c.nome}`).includes(semAcento(texto))).slice(0, 30);
    return (
        <li className="grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_20rem] md:items-end">
            <span className="text-zinc-200">{ROTULO_TABELA[linha.tabela]} · {linha.gerencia} · <strong>{linha.texto}</strong></span>
            <Combobox
                rotulo={`Ligar "${linha.texto}" a um cliente`}
                placeholder="Buscar cliente"
                valor={texto}
                aoMudarTexto={setTexto}
                opcoes={opcoes}
                chave={(c) => c.id}
                rotuloDe={(c) => (c.sigla ? `${c.sigla} · ${c.nome}` : c.nome)}
                aoEscolher={(c) => void rodar((k) => acoes.ligarClienteAction(k, linha.tabela, linha.id, c.id), `${linha.texto} ligado a ${c.sigla ?? c.nome}.`)}
                vazio="Nenhum cliente. Crie em 'Novo cliente' abaixo."
            />
            <Button size="sm" variant="outline" className="md:col-start-2" onClick={() => void (async () => {
                let novoId: string | null = null;
                const ok = await rodar(async (k) => {
                    const r = await acoes.criarClienteAction(k, { nome: linha.texto, sigla: null });
                    if (r.ok) novoId = r.valor.id;
                    return r;
                }, `Cliente ${linha.texto} criado.`);
                if (ok && novoId) await rodar((k) => acoes.ligarClienteAction(k, linha.tabela, linha.id, novoId!), `${linha.texto} ligado ao cliente novo.`);
            })()}>Criar cliente "{linha.texto}" e ligar</Button>
        </li>
    );
}
