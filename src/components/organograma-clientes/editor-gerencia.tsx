'use client';
import { useState } from 'react';
import { Eye, EyeOff, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import * as acoes from '@/app/settings/carteiraActions';
import type { GerenciaParaEditar } from '@/db/carteira';
import { ROTULO_DO_GRUPO, grupoDaGerencia } from '@/lib/carteira/organograma-clientes';
import type { Rodar } from './admin';

type Cliente = { id: string; nome: string; sigla: string | null };
const rotulo = (c: Cliente) => (c.sigla ? `${c.sigla} · ${c.nome}` : c.nome);
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Pedido = { tipo: 'visivel' } | { tipo: 'tirar'; cliente: Cliente } | { tipo: 'ativo'; cliente: Cliente & { ativo: boolean } };

export function EditorGerencia({ g, semCarteira, rodar }: { g: GerenciaParaEditar; semCarteira: Cliente[]; rodar: Rodar }) {
    const [editando, setEditando] = useState(false);
    const [sigla, setSigla] = useState(g.chave);
    const [nome, setNome] = useState(g.nome);
    const [texto, setTexto] = useState('');
    const [pedido, setPedido] = useState<Pedido | null>(null);
    const { grupo } = grupoDaGerencia({ sigla, nome: g.chave });
    const opcoes = semCarteira.filter((c) => !texto || semAcento(rotulo(c)).includes(semAcento(texto))).slice(0, 30);

    const confirmar = async () => {
        const p = pedido;
        setPedido(null);
        if (!p) return;
        if (p.tipo === 'visivel') await rodar((k) => acoes.definirGerenciaVisivelAction(k, g.chave, !g.visivel), g.visivel ? 'Gerência oculta.' : 'Gerência visível.');
        if (p.tipo === 'tirar') await rodar((k) => acoes.alterarCarteiraAction(k, g.chave, { adicionar: [], remover: [p.cliente.id] }), `${rotulo(p.cliente)} foi para "Sem carteira".`);
        if (p.tipo === 'ativo') await rodar((k) => acoes.definirClienteAtivoAction(k, p.cliente.id, !p.cliente.ativo), p.cliente.ativo ? 'Cliente oculto no organograma.' : 'Cliente visível no organograma.');
    };

    const textoDoPedido = !pedido ? null
        : pedido.tipo === 'visivel'
            ? (g.visivel
                ? { titulo: `Ocultar ${g.chave}?`, descricao: 'A gerência some do dashboard e não recebe clientes. Só dá para ocultar sem clientes na carteira.', botao: 'Ocultar gerência' }
                : { titulo: `Mostrar ${g.chave}?`, descricao: 'A gerência volta ao dashboard e pode receber clientes.', botao: 'Mostrar gerência' })
            : pedido.tipo === 'tirar'
                ? { titulo: `Tirar ${rotulo(pedido.cliente)} da carteira?`, descricao: 'O cliente vai para "Sem carteira". Os dados dele ficam com o gerente atual até ele entrar em outra carteira.', botao: 'Tirar' }
                : pedido.cliente.ativo
                    ? { titulo: `Ocultar ${rotulo(pedido.cliente)}?`, descricao: 'Some do organograma e das contagens, mas continua nesta carteira.', botao: 'Ocultar cliente' }
                    : { titulo: `Mostrar ${rotulo(pedido.cliente)}?`, descricao: 'Volta a aparecer no organograma.', botao: 'Mostrar cliente' };

    return (
        <section aria-label={`Gerência ${g.chave}`} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                {editando ? (
                    <form className="flex flex-1 flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); if (await rodar((k) => acoes.editarGerenciaAction(k, g.chave, { sigla, nome }), 'Gerência atualizada.')) setEditando(false); }}>
                        <label className="w-32 text-sm">Sigla<Input value={sigla} onChange={(e) => setSigla(e.target.value)} autoFocus /></label>
                        <label className="min-w-48 flex-1 text-sm">Gerente<Input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
                        <Button type="submit">Gravar</Button>
                        <Button type="button" variant="outline" onClick={() => { setEditando(false); setSigla(g.chave); setNome(g.nome); }}>Cancelar</Button>
                        <p className="w-full text-xs text-zinc-400">Coluna no organograma: {ROTULO_DO_GRUPO[grupo]}. Mudar a sigla atualiza carteira, contratos e propostas da gerência.</p>
                    </form>
                ) : (
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
                            <span className="font-mono">{g.chave}</span> <span>{g.nome}</span>
                            {!g.visivel && <span className="rounded border border-zinc-600 px-1.5 text-xs text-zinc-400">oculta</span>}
                        </h2>
                        <p className="text-xs text-zinc-400">Coluna: {ROTULO_DO_GRUPO[grupo]} · {g.clientes.length} cliente(s)</p>
                    </div>
                )}
                {!editando && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setPedido({ tipo: 'visivel' })}>{g.visivel ? 'Ocultar' : 'Mostrar'}</Button>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <h3 className="text-sm text-zinc-400">Clientes da carteira</h3>
                {g.clientes.length === 0 ? <p className="text-sm text-zinc-500">Nenhum cliente ainda. Adicione abaixo.</p> : (
                    <ul className="max-h-60 divide-y divide-zinc-800 overflow-y-auto rounded-md border border-zinc-800">
                        {g.clientes.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1">
                                <span className={`truncate text-sm ${c.ativo ? 'text-zinc-200' : 'text-zinc-500 line-through'}`} title={c.nome}>{rotulo(c)}</span>
                                <span className="flex shrink-0">
                                    <Button variant="ghost" size="icon" aria-label={`${c.ativo ? 'Ocultar' : 'Mostrar'} ${rotulo(c)}`} onClick={() => setPedido({ tipo: 'ativo', cliente: c })}>
                                        {c.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={`Tirar ${rotulo(c)} da carteira`} onClick={() => setPedido({ tipo: 'tirar', cliente: c })}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <Combobox
                    rotulo="Adicionar cliente sem carteira"
                    placeholder="Buscar por sigla ou nome"
                    valor={texto}
                    aoMudarTexto={setTexto}
                    opcoes={opcoes}
                    chave={(c) => c.id}
                    rotuloDe={rotulo}
                    aoEscolher={(c) => { setTexto(''); void rodar((k) => acoes.alterarCarteiraAction(k, g.chave, { adicionar: [c.id], remover: [] }), `${rotulo(c)} entrou na carteira.`); }}
                    vazio="Nenhum cliente sem carteira com esse texto"
                />
                <p className="text-xs text-zinc-500">Cliente de outra carteira: mova pela aba Organograma.</p>
            </div>
            <ConfirmDialog aberto={!!pedido} titulo={textoDoPedido?.titulo ?? ''} descricao={textoDoPedido?.descricao ?? ''} rotuloConfirmar={textoDoPedido?.botao ?? 'Confirmar'} aoConfirmar={confirmar} aoCancelar={() => setPedido(null)} />
        </section>
    );
}
