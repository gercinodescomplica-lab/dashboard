'use client';

import type { Movimentacao } from '@/lib/grcc/tipos';
import { CAMPOS_DESTAQUE } from '@/lib/grcc/tipos';
import { deParaMudanca, haQuanto } from './formato';

const ORIGEM: Record<Movimentacao['origem'], string> = {
    cadastro: 'cadastrado',
    edicao: 'editado',
    importacao: 'importado',
    exclusao: 'excluído',
    correcao: 'andamento corrigido',
    remocao: 'andamento removido',
};

function resumo(m: Movimentacao): string {
    const destaque = m.mudancas.find((x) => CAMPOS_DESTAQUE.includes(x.campo));
    if (m.origem === 'edicao' || (m.origem === 'importacao' && destaque && destaque.de !== null)) {
        if (destaque) return `${deParaMudanca(destaque).rotulo} → ${deParaMudanca(destaque).para}`;
        return `${m.mudancas.length} alteração(ões)`;
    }
    return ORIGEM[m.origem];
}

export function MovimentacoesRecentes({
    itens,
    onAbrir,
    claro = false,
}: {
    itens: Movimentacao[];
    onAbrir?: (leadId: number) => void;
    claro?: boolean;
}) {
    if (itens.length === 0) return <p className="text-sm text-zinc-500">Nenhuma movimentação ainda.</p>;
    return (
        <ul className="flex flex-col gap-1">
            {itens.map((m) => (
                <li key={m.id}>
                    <button
                        type="button"
                        disabled={!onAbrir || m.origem === 'exclusao'}
                        onClick={() => onAbrir?.(m.leadId)}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-baseline gap-2 ${
                            claro ? 'hover:bg-zinc-100' : 'hover:bg-zinc-900'
                        } disabled:cursor-default`}
                    >
                        <span className={`font-semibold truncate ${claro ? 'text-zinc-900' : 'text-zinc-100'}`}>{m.cliente}</span>
                        <span className={claro ? 'text-zinc-600' : 'text-zinc-400'}>{resumo(m)}</span>
                        <span className="ml-auto text-xs text-zinc-500 shrink-0">{haQuanto(m.quando)}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
