import { describe, expect, it } from 'vitest';
import { grupoDaGerencia, montarOrganograma, nomeDoCartao, rotuloDoDestino, type GerenciaDoOrganograma } from './organograma-clientes';

const cli = (id: string, sigla: string | null = id) => ({ id, nome: `Órgão ${id}`, sigla, ultimoMovimento: null });
const ger = (id: string, sigla: string | null, gerentes: string[], clientes: string[], ativa = true): GerenciaDoOrganograma => ({
    id, nome: `Gerência ${id}`, sigla, ativa, gerentes, clientes: clientes.map((c) => cli(c)),
});

describe('grupoDaGerencia', () => {
    it.each([
        [{ sigla: 'KAM2', nome: 'x' }, 'kam', 2],
        [{ sigla: 'GRC 4', nome: 'x' }, 'grc', 4],
        [{ sigla: 'GRC-C', nome: 'x' }, 'grcc', null],
        [{ sigla: 'GRCC', nome: 'x' }, 'grcc', null],
        [{ sigla: null, nome: 'KAM 3 Saúde' }, 'kam', 3],
        [{ sigla: 'DIR', nome: 'Diretoria' }, 'gerente', null],
        [{ sigla: null, nome: 'Tríade' }, 'gerente', null],
    ])('%o → %s %s', (g, grupo, numero) => expect(grupoDaGerencia(g)).toEqual({ grupo, numero }));
});

describe('montarOrganograma', () => {
    const gerencias = [
        ger('ac', null, ['Alberto Campos'], ['SMCC', 'SGM']),
        ger('grc3', 'GRC3', ['Barone'], ['SMT', 'COHAB']),
        ger('kam2', 'KAM2', ['Betone'], ['SMS']),
        ger('grcc', 'GRCC', ['Débora'], ['ICI', 'ALESP']),
        ger('grc1', 'GRC1', ['Bruno Ítalo'], ['PGM']),
        ger('kam1', 'KAM1', ['Malde'], ['SME']),
        ger('velha', 'GRC9', ['Ninguém'], [], false),
        ger('velha2', 'GRC8', [], ['SEHAB'], false),
    ];

    it('colunas: KAM empilhados, uma por GRC, GRCC + gerente no fim', () => {
        const o = montarOrganograma(gerencias, []);
        expect(o.colunas.map((col) => col.map((c) => c.id))).toEqual([['kam1', 'kam2'], ['grc1'], ['grc3'], ['velha2'], ['grcc', 'ac']]);
    });
    it('tira a oculta vazia, mantém a oculta com cliente e ordena clientes pela sigla', () => {
        const o = montarOrganograma(gerencias, []);
        expect(o.cartoes.map((c) => c.id)).not.toContain('velha');
        expect(o.cartoes.find((c) => c.id === 'grc3')!.clientes.map((c) => c.sigla)).toEqual(['COHAB', 'SMT']);
        expect(o.cartoes.find((c) => c.id === 'ac')!.rotuloCargo).toBe('Gerente');
    });
    it('totais contam só quem tem cliente', () => {
        const o = montarOrganograma([...gerencias, ger('vazia', 'KAM4', ['Tomiatto'], [])], [cli('SMC')]);
        expect(o.totais).toEqual({ gerencias: 7, orgaosAtendidos: 10, maiorCarteira: { nome: 'Barone', clientes: 2 } });
        expect(o.semCarteira.map((c) => c.sigla)).toEqual(['SMC']);
    });
    it('sem nada', () => {
        expect(montarOrganograma([], [])).toMatchObject({ colunas: [], totais: { gerencias: 0, orgaosAtendidos: 0, maiorCarteira: null } });
    });
});

describe('rótulos', () => {
    it('nomeDoCartao', () => {
        expect(nomeDoCartao({ gerentes: [], nome: 'GRC 5' })).toBe('GRC 5');
        expect(nomeDoCartao({ gerentes: ['Ana', 'Beto', 'Caio'], nome: 'x' })).toBe('Ana, Beto e Caio');
    });
    it('rotuloDoDestino', () => {
        expect(rotuloDoDestino({ sigla: 'GRC4', nome: 'x' })).toBe('GRC4');
        expect(rotuloDoDestino({ sigla: null, nome: 'Gerência' })).toBe('Gerência');
        expect(rotuloDoDestino(null)).toBe('Sem carteira');
    });
});
