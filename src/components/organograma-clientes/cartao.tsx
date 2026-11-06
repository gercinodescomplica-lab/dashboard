'use client';

// Peças do organograma de clientes: o bloco da gerência e o item do cliente (arrastável + menu "Mover para…").
import type { DragEvent, ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    COR_DO_GRUPO,
    nomeDoCartao,
    rotuloDoDestino,
    type CartaoDoOrganograma,
    type ClienteDoOrganograma,
} from '@/lib/carteira/organograma-clientes';

/** Tipo do dado no arrastar (o id do cliente vai no estado da tela; aqui só marca que é nosso). */
export const TIPO_DO_ARRASTE = 'application/x-dashboard-cliente';

export interface Mover {
    /** Só o admin recebe; sem isto a tela é só leitura. */
    pedir: (cliente: ClienteDoOrganograma, de: string | null, para: string | null) => void;
    comecarArraste: (cliente: ClienteDoOrganograma, de: string | null) => void;
    terminarArraste: () => void;
    destinos: CartaoDoOrganograma[];
}

function dicaDoCliente(c: ClienteDoOrganograma): string {
    const base = c.sigla ? `${c.sigla}: ${c.nome}` : c.nome;
    if (!c.ultimoMovimento) return base;
    return `${base}\nÚltima mudança de carteira em${new Date(c.ultimoMovimento.em).toLocaleDateString('pt-BR')}`;
}

export function ItemDoCliente({ cliente, de, mover }: { cliente: ClienteDoOrganograma; de: string | null; mover?: Mover }) {
    const rotulo = cliente.sigla ?? cliente.nome;
    return (
        <li
            draggable={!!mover}
            onDragStart={(e) => {
                if (!mover) return;
                e.dataTransfer.setData(TIPO_DO_ARRASTE, cliente.id);
                e.dataTransfer.effectAllowed = 'move';
                mover.comecarArraste(cliente, de);
            }}
            onDragEnd={() => mover?.terminarArraste()}
            title={dicaDoCliente(cliente)}
            className={cn('group flex items-start gap-1.5 rounded-md px-2 py-0.5 hover:bg-zinc-800/60', mover && 'cursor-grab active:cursor-grabbing')}
        >
            <span className="w-16 shrink-0 truncate text-xs font-semibold leading-snug text-zinc-100">{rotulo}</span>
            <span className="min-w-0 flex-1 text-xs leading-snug text-zinc-400">{cliente.sigla ? cliente.nome : ''}</span>
            {mover && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="-my-0.5 size-5 shrink-0 focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-50 sm:group-hover:opacity-100"
                            aria-label={`Mover ${rotulo}`}
                        >
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                        <DropdownMenuLabel>Mover {rotulo} para</DropdownMenuLabel>
                        {mover.destinos
                            .filter((d) => d.id !== de)
                            .map((d) => (
                                <DropdownMenuItem key={d.id} disabled={!d.ativa} onSelect={() => mover.pedir(cliente, de, d.id)}>
                                    {rotuloDoDestino(d)} · {nomeDoCartao(d)}
                                </DropdownMenuItem>
                            ))}
                        {de !== null && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => mover.pedir(cliente, de, null)}>Tirar da carteira</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </li>
    );
}

/** Área que recebe o cliente arrastado. `aceita` = há um arraste em curso vindo de outro lugar. */
export interface Alvo {
    aceita: boolean;
    destacado: boolean;
    aoEntrar: () => void;
    aoSair: () => void;
    aoSoltar: () => void;
}

export function propsDoAlvo(alvo: Alvo | undefined) {
    if (!alvo?.aceita) return {};
    return {
        onDragOver: (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!alvo.destacado) alvo.aoEntrar();
        },
        onDragLeave: (e: DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) alvo.aoSair();
        },
        onDrop: (e: DragEvent) => {
            e.preventDefault();
            alvo.aoSoltar();
        },
    };
}

/** Bloco de uma gerência dentro da coluna. `ocultarCargo` quando o cabeçalho da coluna já diz o cargo (ex.: GRC1). */
export function CartaoDaGerencia({ cartao, mover, alvo, ocultarCargo }: { cartao: CartaoDoOrganograma; mover?: Mover; alvo?: Alvo; ocultarCargo?: boolean }) {
    const cor = COR_DO_GRUPO[cartao.grupo];
    const nome = nomeDoCartao(cartao);
    const detalhe = ocultarCargo ? null : cartao.rotuloCargo;
    return (
        <section
            aria-label={`${nome}, ${cartao.rotuloCargo}`}
            {...propsDoAlvo(alvo)}
            className={cn('rounded-md transition-shadow', alvo?.destacado && 'bg-indigo-500/10 ring-2 ring-indigo-500')}
        >
            <header className="mb-1 flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5">
                <span className={cn('inline-block size-1.5 shrink-0 rounded-full', cor.faixa)} aria-hidden="true" />
                <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase text-zinc-100">{nome}</h3>
                {!cartao.ativa && (
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[11px] text-amber-400">Desativada</span>
                )}
                <span className={cn('text-xs font-semibold tabular-nums', cor.texto)} aria-label={`${cartao.clientes.length} clientes`}>
                    {cartao.clientes.length}
                </span>
            </header>
            {detalhe && <p className="px-2 pb-0.5 text-xs text-zinc-400/80">{detalhe}</p>}
            <ListaDeClientes vazia="Nenhum cliente nesta carteira.">
                {cartao.clientes.map((c) => (
                    <ItemDoCliente key={c.id} cliente={c} de={cartao.id} mover={mover} />
                ))}
            </ListaDeClientes>
        </section>
    );
}

export function ListaDeClientes({ vazia, children }: { vazia: string; children: ReactNode[] }) {
    if (children.length === 0) return <p className="px-2 text-xs italic text-zinc-400">{vazia}</p>;
    return <ul className="space-y-px">{children}</ul>;
}
