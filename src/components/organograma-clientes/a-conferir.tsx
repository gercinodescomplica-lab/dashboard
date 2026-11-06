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

export function AConferir({ painel, rodar, ocupado }: { painel: PainelCarteira; rodar: Rodar; ocupado: boolean }) {
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
                                    <Button size="sm" disabled={ocupado} aria-label={`Trazer os dados de ${nome} para a carteira`} onClick={() => setTrazer(f)}>Trazer os dados para a carteira</Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-xs text-zinc-500">Para mudar a carteira em vez dos dados, use a aba Organograma.</p>
            </section>
            <JuntarClientes clientes={painel.todosClientes} rodar={rodar} ocupado={ocupado} />
            <section aria-label="Sem cliente" className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-50">Sem cliente</h2>
                <p className="text-sm text-zinc-400">Linhas cujo texto não casou com nenhum cliente. Ligue a um cliente para que acompanhem a carteira.</p>
                {painel.semCliente.length === 0 ? <p className="text-sm text-zinc-500">Todas as linhas têm cliente.</p> : (
                    <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
                        {painel.semCliente.map((l) => <LinhaParaLigar key={`${l.tabela}:${l.id}`} linha={l} clientes={painel.todosClientes} rodar={rodar} ocupado={ocupado} />)}
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

function LinhaParaLigar({ linha, clientes, rodar, ocupado }: { linha: LinhaSemCliente; clientes: PainelCarteira['todosClientes']; rodar: Rodar; ocupado: boolean }) {
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
                desabilitado={ocupado}
                vazio="Nenhum cliente com esse texto. Use o botão de criar abaixo."
            />
            <Button size="sm" variant="outline" className="md:col-start-2" disabled={ocupado} onClick={() => void rodar((k) => acoes.criarELigarClienteAction(k, linha.tabela, linha.id, { nome: linha.texto, sigla: null }), `Cliente ${linha.texto} criado e ligado.`)}>Criar cliente &quot;{linha.texto}&quot; e ligar</Button>
        </li>
    );
}

type ClienteDoPainel = PainelCarteira['todosClientes'][number];
const rotuloCliente = (c: ClienteDoPainel) => `${c.sigla ? `${c.sigla} · ${c.nome}` : c.nome}${c.gerencia ? ` (${c.gerencia})` : ''}`;
const nomeCurto = (c: ClienteDoPainel) => c.sigla ?? c.nome;

function JuntarClientes({ clientes, rodar, ocupado }: { clientes: ClienteDoPainel[]; rodar: Rodar; ocupado: boolean }) {
    const [origem, setOrigem] = useState<ClienteDoPainel | null>(null);
    const [destino, setDestino] = useState<ClienteDoPainel | null>(null);
    const [textoOrigem, setTextoOrigem] = useState('');
    const [textoDestino, setTextoDestino] = useState('');
    const [confirmando, setConfirmando] = useState(false);
    const filtrar = (texto: string) => clientes.filter((c) => !texto || semAcento(rotuloCliente(c)).includes(semAcento(texto))).slice(0, 30);
    const pronto = !!origem && !!destino && origem.id !== destino.id;
    return (
        <section aria-label="Juntar clientes" className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-50">Juntar clientes</h2>
            <p className="text-sm text-zinc-400">O mesmo órgão com outra grafia? Tudo do cliente que some (contratos, propostas, CX, projetos e histórico) passa para o que fica.</p>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Combobox rotulo="Cliente que some" placeholder="Buscar cliente" valor={textoOrigem} aoMudarTexto={(t) => { setTextoOrigem(t); setOrigem(null); }} opcoes={filtrar(textoOrigem)} chave={(c) => c.id} rotuloDe={rotuloCliente}
                    aoEscolher={(c) => { setOrigem(c); setTextoOrigem(rotuloCliente(c)); }} desabilitado={ocupado} vazio="Nenhum cliente com esse texto." />
                <Combobox rotulo="Cliente que fica" placeholder="Buscar cliente" valor={textoDestino} aoMudarTexto={(t) => { setTextoDestino(t); setDestino(null); }} opcoes={filtrar(textoDestino)} chave={(c) => c.id} rotuloDe={rotuloCliente}
                    aoEscolher={(c) => { setDestino(c); setTextoDestino(rotuloCliente(c)); }} desabilitado={ocupado} vazio="Nenhum cliente com esse texto." />
                <Button size="sm" disabled={!pronto || ocupado} onClick={() => setConfirmando(true)}>Juntar</Button>
            </div>
            <ConfirmDialog
                aberto={confirmando && pronto}
                titulo="Juntar clientes"
                descricao={pronto ? `Tudo de ${rotuloCliente(origem)} passa para ${rotuloCliente(destino)} e ${rotuloCliente(origem)} é apagado. Não dá para desfazer. Carteira de ${rotuloCliente(destino)} depois: ${destino.gerencia ?? origem.gerencia ?? 'sem carteira'}.` : ''}
                rotuloConfirmar="Juntar clientes"
                tom="perigo"
                aoCancelar={() => setConfirmando(false)}
                aoConfirmar={async () => {
                    const [o, d] = [origem!, destino!];
                    setConfirmando(false);
                    const ok = await rodar((k) => acoes.juntarClientesAction(k, o.id, d.id), `${nomeCurto(o)} foi juntado a ${nomeCurto(d)}.`);
                    if (ok) { setOrigem(null); setDestino(null); setTextoOrigem(''); setTextoDestino(''); }
                }}
            />
        </section>
    );
}
