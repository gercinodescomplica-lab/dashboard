'use server';

/**
 * Escritas da página /grcc. Toda action recebe a chave GRCC e a confere AQUI, no servidor —
 * o KeyGateGrcc só esconde a tela, não protege nada sozinho.
 */

import { revalidatePath } from 'next/cache';
import { aplicarImportGrcc, ErroGrcc, excluirLeadGrcc, salvarLeadGrcc } from '@/db/queries';
import { validarLead } from '@/lib/grcc/validacao';
import type { LeadGrcc, LeadGrccDados, LinhaPlanilha, ProblemaLinha, ResultadoAcao } from '@/lib/grcc/tipos';

const CHAVE_INVALIDA = { ok: false as const, erro: 'Chave GRCC inválida.' };

function chaveValida(chave: string): boolean {
    const correta = process.env.GRCC_KEY;
    if (!correta || typeof chave !== 'string') return false;
    return chave.trim() === correta;
}

function falha(err: unknown): { ok: false; erro: string } {
    if (err instanceof ErroGrcc) return { ok: false, erro: err.message };
    console.error('[grcc] falha ao gravar:', err);
    return { ok: false, erro: 'Não foi possível gravar. Tente de novo.' };
}

function revalidar() {
    revalidatePath('/grcc');
    revalidatePath('/');
}

export async function verificarChaveGrcc(chave: string): Promise<boolean> {
    return chaveValida(chave);
}

export async function salvarLead(chave: string, id: number | null, dados: LeadGrccDados): Promise<ResultadoAcao<LeadGrcc>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;
    const v = validarLead(dados, { exigirLocal: true });
    if (!v.ok) return { ok: false, erro: 'Corrija os campos destacados.', erros: v.erros };
    try {
        const { lead } = await salvarLeadGrcc(id, v.dados);
        revalidar();
        return { ok: true, valor: lead };
    } catch (err) {
        return falha(err);
    }
}

export async function excluirLead(chave: string, id: number): Promise<ResultadoAcao<null>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;
    try {
        await excluirLeadGrcc(id);
        revalidar();
        return { ok: true, valor: null };
    } catch (err) {
        return falha(err);
    }
}

export async function confirmarImportacao(
    chave: string,
    input: { arquivo: string; linhas: LinhaPlanilha[]; problemas: ProblemaLinha[]; substituirPipelineManual: boolean }
): Promise<ResultadoAcao<{ novos: number; alterados: number }>> {
    if (!chaveValida(chave)) return CHAVE_INVALIDA;

    // Não confia no navegador: cada linha é revalidada aqui; as inválidas são descartadas.
    const linhas: LinhaPlanilha[] = [];
    for (const l of input.linhas) {
        const v = validarLead(l.dados);
        if (v.ok) linhas.push({ linha: l.linha, dados: v.dados });
    }

    try {
        const r = await aplicarImportGrcc({
            arquivo: String(input.arquivo).slice(0, 200),
            linhas,
            problemas: input.problemas,
            substituirPipelineManual: input.substituirPipelineManual === true,
        });
        revalidar();
        return { ok: true, valor: r };
    } catch (err) {
        return falha(err);
    }
}
