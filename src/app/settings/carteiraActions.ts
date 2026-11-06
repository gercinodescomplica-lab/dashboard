'use server';
// Actions do organograma de clientes (spec 2026-11-06 §5 e §8). Só o admin grava: a SETTINGS_KEY é conferida AQUI.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as carteira from '@/db/carteira';
import { chaveSettingsValida } from '@/lib/settings/chave';
import { ErroCarteira, SO_ADMIN, type Resultado } from '@/lib/carteira/tipos';
import type { OrganogramaClientes } from '@/lib/carteira/organograma-clientes';

const POR = 'Admin';
const id = z.string().trim().min(1).max(64);
const gerencia = z.string().trim().min(1).max(40);

async function rodar<T>(chave: string, fn: () => Promise<T>): Promise<Resultado<T>> {
    if (!chaveSettingsValida(chave)) return { ok: false, erro: SO_ADMIN };
    try {
        const valor = await fn();
        revalidatePath('/');
        revalidatePath('/settings');
        return { ok: true, valor };
    } catch (e) {
        if (e instanceof ErroCarteira) return { ok: false, erro: e.message };
        if (e instanceof z.ZodError) return { ok: false, erro: 'Dados inválidos.' };
        console.error('[carteira]', e);
        return { ok: false, erro: 'Não foi possível gravar. Tente de novo.' };
    }
}

export async function carregarOrganogramaClientesAction(): Promise<OrganogramaClientes> {
    return carteira.carregarOrganogramaClientes();
}

export interface PainelCarteira {
    organograma: OrganogramaClientes;
    gerencias: carteira.GerenciaParaEditar[];
    semCarteira: Array<{ id: string; nome: string; sigla: string | null }>;
    todosClientes: Array<{ id: string; nome: string; sigla: string | null; gerencia: string | null; ativo: boolean }>;
    fora: carteira.ForaDaCarteira[];
    semCliente: carteira.LinhaSemCliente[];
}

export async function carregarPainelCarteiraAction(chave: string): Promise<Resultado<PainelCarteira>> {
    if (!chaveSettingsValida(chave)) return { ok: false, erro: SO_ADMIN };
    const [organograma, gerencias, todos, fora, semCliente] = await Promise.all([
        carteira.carregarOrganogramaClientes(), carteira.gerenciasParaEditar(), carteira.listarClientesComCarteira(), carteira.foraDaCarteira(), carteira.linhasSemCliente(),
    ]);
    const todosClientes = todos.map(({ id, nome, sigla, gerencia, ativo }) => ({ id, nome, sigla, gerencia, ativo }));
    return {
        ok: true,
        valor: { organograma, gerencias, todosClientes, fora, semCliente, semCarteira: todosClientes.filter((c) => c.gerencia === null && c.ativo) },
    };
}

export async function moverClienteNoOrganogramaAction(chave: string, clienteId: string, de: string | null, para: string | null) {
    return rodar(chave, async () => {
        const d = z.object({ clienteId: id, de: gerencia.nullable(), para: gerencia.nullable() }).parse({ clienteId, de, para });
        if (d.de === d.para) return { movidos: 0 };
        return carteira.moverClientes([d.clienteId], d.para, POR, { [d.clienteId]: d.de });
    });
}

export async function alterarCarteiraAction(chave: string, g: string, mudanca: { adicionar: string[]; remover: string[] }) {
    return rodar(chave, async () => {
        const d = z.object({ g: gerencia, adicionar: z.array(id).max(5000), remover: z.array(id).max(5000) }).parse({ g, ...mudanca });
        return carteira.alterarCarteira(d.g, d, POR);
    });
}

export async function criarGerenciaAction(chave: string, dados: { sigla: string; nome: string }) {
    return rodar(chave, async () => carteira.criarGerencia(z.object({ sigla: z.string().max(20), nome: z.string().max(120) }).parse(dados)));
}

export async function editarGerenciaAction(chave: string, g: string, dados: { sigla: string; nome: string }) {
    return rodar(chave, async () => carteira.editarGerencia(gerencia.parse(g), z.object({ sigla: z.string().max(20), nome: z.string().max(120) }).parse(dados)));
}

export async function definirGerenciaVisivelAction(chave: string, g: string, visivel: boolean) {
    return rodar(chave, async () => carteira.definirGerenciaVisivel(gerencia.parse(g), z.boolean().parse(visivel)));
}

export async function definirClienteAtivoAction(chave: string, clienteId: string, ativo: boolean) {
    return rodar(chave, async () => carteira.definirClienteAtivo(id.parse(clienteId), z.boolean().parse(ativo)));
}

export async function alinharClienteAction(chave: string, clienteId: string) {
    return rodar(chave, async () => carteira.alinharCliente(id.parse(clienteId), POR));
}

export async function ligarClienteAction(chave: string, tabela: carteira.TabelaComCliente, linhaId: string, clienteId: string) {
    return rodar(chave, async () => {
        const d = z.object({ tabela: z.enum(['contrato', 'proposta', 'cx', 'projects']), linhaId: id, clienteId: id }).parse({ tabela, linhaId, clienteId });
        return carteira.ligarCliente(d.tabela, d.linhaId, d.clienteId);
    });
}

export async function criarClienteAction(chave: string, dados: { nome: string; sigla: string | null }) {
    return rodar(chave, async () => carteira.criarCliente(z.object({ nome: z.string().max(200), sigla: z.string().max(40).nullable() }).parse(dados)));
}

// Cria e liga numa chamada só: se ligar falhar, o cliente já existe e a mensagem diz isso (evita duplicar no retry).
export async function criarELigarClienteAction(chave: string, tabela: carteira.TabelaComCliente, linhaId: string, dados: { nome: string; sigla: string | null }) {
    return rodar(chave, async () => {
        const d = z.object({ tabela: z.enum(['contrato', 'proposta', 'cx', 'projects']), linhaId: id, nome: z.string().max(200), sigla: z.string().max(40).nullable() }).parse({ tabela, linhaId, ...dados });
        const novo = await carteira.criarCliente({ nome: d.nome, sigla: d.sigla });
        try {
            await carteira.ligarCliente(d.tabela, d.linhaId, novo.id);
        } catch (e) {
            throw new ErroCarteira(`Cliente criado, mas não foi possível ligar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
        }
        return novo;
    });
}

export async function juntarClientesAction(chave: string, origemId: string, destinoId: string) {
    return rodar(chave, async () => {
        const d = z.object({ origemId: id, destinoId: id }).parse({ origemId, destinoId });
        return carteira.juntarClientes(d.origemId, d.destinoId, POR);
    });
}
