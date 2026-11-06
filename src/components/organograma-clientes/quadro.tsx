'use client';

// Organograma de clientes: quem atende cada órgão. Todos veem; o admin move arrastando o cliente ou pelo menu
// "Mover para…", com confirmação e Desfazer.
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import {
    CABECALHO_DO_GRUPO,
    COR_DO_GRUPO,
    ORDEM_DOS_GRUPOS,
    ROTULO_DO_GRUPO,
    rotuloDoDestino,
    type CartaoDoOrganograma,
    type ClienteDoOrganograma,
    type OrganogramaClientes,
} from '@/lib/carteira/organograma-clientes';
import { AVISO_LEVA_TUDO, type Resultado } from '@/lib/carteira/tipos';
import { CartaoDaGerencia, ItemDoCliente, ListaDeClientes, propsDoAlvo, type Alvo, type Mover } from './cartao';

/** Id do destino "Sem carteira" nos alvos do arraste. */
const SEM = '__sem__';

const chaveDeBusca = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Movimento {
    cliente: ClienteDoOrganograma;
    de: string | null;
    para: string | null;
}

interface Props {
    dados: OrganogramaClientes;
    podeMover: boolean;
    moverAction?: (clienteId: string, de: string | null, para: string | null) => Promise<Resultado<{ movidos: number }>>;
    aoMudar?: () => void;
    /** Tema claro do dashboard (spec §8). Padrão escuro. */
    lightActive?: boolean;
}

export function OrganogramaClientesView({ dados, podeMover, moverAction, aoMudar, lightActive = false }: Props) {
    const claro = lightActive;
    const [ocupado, setOcupado] = useState(false);
    const [pedido, setPedido] = useState<Movimento | null>(null);
    const [feito, setFeito] = useState<Movimento | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [arraste, setArraste] = useState<{ cliente: ClienteDoOrganograma; de: string | null } | null>(null);
    const [busca, setBusca] = useState('');
    const [sobre, setSobre] = useState<string | null>(null);

    const porId = useMemo(() => new Map(dados.cartoes.map((c) => [c.id, c])), [dados.cartoes]);
    const nomeDe = (id: string | null) => rotuloDoDestino(id ? (porId.get(id) ?? null) : null);
    const rotuloCliente = (c: ClienteDoOrganograma) => c.sigla ?? c.nome;

    async function gravar(m: Movimento, depois: (ok: boolean) => void) {
        if (!moverAction || ocupado) return;
        setErro(null);
        setOcupado(true);
        try {
            const r = await moverAction(m.cliente.id, m.de, m.para);
            if (!r.ok) setErro(r.erro);
            depois(r.ok);
        } catch {
            setErro('Não foi possível mover. Tente de novo.');
            depois(false);
        } finally {
            setOcupado(false);
            aoMudar?.();
        }
    }

    const mover: Mover | undefined =
        podeMover && moverAction
            ? {
                  pedir: (cliente, de, para) => setPedido({ cliente, de, para }),
                  comecarArraste: (cliente, de) => setArraste({ cliente, de }),
                  terminarArraste: () => {
                      setArraste(null);
                      setSobre(null);
                  },
                  destinos: dados.cartoes,
              }
            : undefined;

    function alvoPara(id: string | null, ativa = true): Alvo | undefined {
        if (!arraste || !ativa || arraste.de === id) return undefined;
        const chave = id ?? SEM;
        return {
            aceita: true,
            destacado: sobre === chave,
            aoEntrar: () => setSobre(chave),
            aoSair: () => setSobre((s) => (s === chave ? null : s)),
            aoSoltar: () => {
                setPedido({ cliente: arraste.cliente, de: arraste.de, para: id });
                setArraste(null);
                setSobre(null);
            },
        };
    }

    const { totais } = dados;
    // A busca vale para o quadro todo: some a gerência (e a coluna) sem nenhum cliente que case.
    const termo = chaveDeBusca(busca.trim());
    const casa = (c: ClienteDoOrganograma) => chaveDeBusca(`${c.sigla ?? ''} ${c.nome}`).includes(termo);
    const colunas = termo
        ? dados.colunas
              .map((coluna) => coluna.map((c) => ({ ...c, clientes: c.clientes.filter(casa) })).filter((c) => c.clientes.length > 0))
              .filter((coluna) => coluna.length > 0)
        : dados.colunas;
    const achados = termo ? dados.semCarteira.filter(casa) : dados.semCarteira;
    const encontrados = achados.length + colunas.flat().reduce((s, c) => s + c.clientes.length, 0);
    const alvoSem = alvoPara(null);
    const grupos = ORDEM_DOS_GRUPOS.filter((g) => dados.cartoes.some((c) => c.grupo === g));
    const linha = claro ? 'bg-zinc-300' : 'bg-zinc-700';

    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-72">
                    <Input
                        type="search"
                        aria-label="Buscar cliente"
                        placeholder="Buscar cliente por sigla ou nome"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>
                <p className={cn('text-sm', claro ? 'text-zinc-600' : 'text-zinc-400')} aria-live="polite">
                    {termo
                        ? `${encontrados} cliente(s) encontrado(s).`
                        : mover
                          ? 'Para mudar um cliente de carteira, arraste-o ou use o botão … ao lado dele.'
                          : 'Só leitura: quem muda clientes de carteira é o admin, em Configurações.'}
                </p>
            </div>
            {erro && <Notice tom="perigo">{erro}</Notice>}
            {feito && (
                <Notice tom="sucesso">
                    <span className="flex flex-wrap items-center gap-2">
                        {rotuloCliente(feito.cliente)} foi de {nomeDe(feito.de)} para {nomeDe(feito.para)}.
                        <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0"
                            disabled={ocupado}
                            onClick={() => {
                                const volta = { cliente: feito.cliente, de: feito.para, para: feito.de };
                                void gravar(volta, () => setFeito(null));
                            }}
                        >
                            Desfazer
                        </Button>
                    </span>
                </Notice>
            )}

            <div className={cn('min-h-0 w-full flex-1 overflow-auto rounded-xl border', claro ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900', ocupado && 'opacity-70')}>
                <div className="flex min-w-max flex-col px-6 pt-4 pb-6 lg:min-w-0">
                    <div className="flex flex-col items-center">
                        <h2 className={cn('mb-1 text-2xl font-bold tracking-[0.2em]', claro ? 'text-zinc-900' : 'text-zinc-100')}>C L I E N T E S</h2>
                        <p className={cn('mb-4 text-center text-sm', claro ? 'text-zinc-600' : 'text-zinc-400')}>Quem atende cada órgão.</p>
                        <dl className="flex min-w-[200px] flex-col-reverse rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-10 py-2 text-center shadow-xs">
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-indigo-400">órgãos atendidos</dt>
                            <dd className="text-xl font-semibold tracking-[0.08em] text-zinc-100">{totais.orgaosAtendidos}</dd>
                        </dl>
                        <div className={cn('h-6 w-[1.5px]', linha)} />
                    </div>

                    <div className={cn('mb-6 h-[1.5px] w-full', linha)} />

                    {colunas.length === 0 && <p className={cn('py-6 text-center text-sm', claro ? 'text-zinc-600' : 'text-zinc-400')}>Nenhuma carteira tem cliente com essa busca.</p>}
                    <div className="flex flex-1 flex-row flex-nowrap items-start gap-4">
                        {colunas.map((coluna) => (
                            <ColunaDoGrupo key={coluna[0].id} coluna={coluna} claro={claro}>
                                {(ocultarCargo) =>
                                    coluna.map((c) => (
                                        <CartaoDaGerencia key={c.id} cartao={c} mover={mover} alvo={alvoPara(c.id, c.ativa)} ocultarCargo={ocultarCargo} claro={claro} />
                                    ))
                                }
                            </ColunaDoGrupo>
                        ))}
                    </div>

                    <section
                        aria-label="Sem carteira"
                        {...propsDoAlvo(alvoSem)}
                        className={cn('mt-6 rounded-xl border p-3', claro ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-700 bg-zinc-800/40', alvoSem?.destacado && 'bg-indigo-500/10 ring-2 ring-indigo-500')}
                    >
                        <header className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className={cn('text-sm font-semibold', claro ? 'text-zinc-900' : 'text-zinc-100')}>Sem carteira</h3>
                            <span className={cn('text-xs font-semibold tabular-nums', claro ? 'text-zinc-600' : 'text-zinc-400')}>{achados.length}</span>
                        </header>
                        <ListaDeClientes vazia={termo ? 'Nenhum cliente sem carteira com essa busca.' : 'Todo cliente ativo tem carteira.'} claro={claro}>
                            {achados.map((c) => (
                                <ItemDoCliente key={c.id} cliente={c} de={null} mover={mover} claro={claro} />
                            ))}
                        </ListaDeClientes>
                    </section>

                    <div className={cn('mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md border p-3', claro ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-700 bg-zinc-800/40')}>
                        <ul className="flex flex-wrap items-center gap-4" aria-label="Legenda">
                            <li className={cn('text-xs font-medium', claro ? 'text-zinc-600' : 'text-zinc-400')}>Legenda:</li>
                            {grupos.map((g) => (
                                <li key={g} className={cn('flex items-center gap-1.5 text-xs', claro ? 'text-zinc-600' : 'text-zinc-400')}>
                                    <span className={cn('inline-block size-2 rounded-full', COR_DO_GRUPO[g].faixa)} aria-hidden="true" />
                                    {ROTULO_DO_GRUPO[g]}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                aberto={!!pedido}
                titulo="Mudar de carteira"
                descricao={pedido ? `Mover ${rotuloCliente(pedido.cliente)} de ${nomeDe(pedido.de)} para ${nomeDe(pedido.para)}?${pedido.para ? ` ${AVISO_LEVA_TUDO}` : ''}` : ''}
                rotuloConfirmar="Mover"
                tom="principal"
                aoCancelar={() => setPedido(null)}
                aoConfirmar={async () => {
                    if (!pedido) return;
                    const m = pedido;
                    await gravar(m, (ok) => setFeito(ok ? m : null));
                    setPedido(null);
                }}
            />
        </div>
    );
}

/** Cabeçalho colorido da coluna. */
function cabecalhoDaColuna(coluna: CartaoDoOrganograma[]): { titulo: string; subtitulo: string; ocultarCargo: boolean } {
    const gruposDaColuna = [...new Set(coluna.map((c) => c.grupo))];
    if (gruposDaColuna.length > 1) {
        return {
            titulo: gruposDaColuna.map((g) => CABECALHO_DO_GRUPO[g].titulo).join(' · '),
            subtitulo: gruposDaColuna.map((g) => CABECALHO_DO_GRUPO[g].subtitulo).join(' e '),
            ocultarCargo: false,
        };
    }
    const grupo = gruposDaColuna[0];
    // Uma GRC por coluna: o cabeçalho já leva a sigla (GRC1, GRC2…), então o bloco não repete.
    if (grupo === 'grc' && coluna.length === 1) {
        return { titulo: coluna[0].rotuloCargo, subtitulo: CABECALHO_DO_GRUPO.grc.subtitulo, ocultarCargo: true };
    }
    return { ...CABECALHO_DO_GRUPO[grupo], ocultarCargo: false };
}

function ColunaDoGrupo({ coluna, children, claro = false }: { coluna: CartaoDoOrganograma[]; children: (ocultarCargo: boolean) => ReactNode; claro?: boolean }) {
    const cor = COR_DO_GRUPO[coluna[0].grupo];
    const { titulo, subtitulo, ocultarCargo } = cabecalhoDaColuna(coluna);
    const total = coluna.reduce((s, c) => s + c.clientes.length, 0);
    return (
        <div className="flex min-w-[190px] flex-1 flex-col">
            <div className={cn('mx-auto -mt-6 h-3 w-[1.5px]', claro ? 'bg-zinc-300' : 'bg-zinc-700')} />
            <div className={cn('rounded-t-md border p-2 text-center shadow-xs', cor.cabecalho)}>
                <span className="block text-sm font-semibold leading-tight text-white">
                    {titulo} <span className="tabular-nums text-white/80">· {total}</span>
                </span>
                <span className="mt-0.5 block text-xs text-white/90">{subtitulo}</span>
            </div>
            <div className={cn('flex-1 space-y-3 rounded-b-md border border-t-0 p-2', claro ? 'border-zinc-200 bg-white' : 'border-zinc-700 bg-zinc-900', cor.corpo)}>{children(ocultarCargo)}</div>
        </div>
    );
}
