import { describe, it, expect } from 'vitest';
import { chaveDaGerencia, citaSigla, clienteAtendido, mesmaSigla, siglaComparavel } from './chaves';

// Os casos de chaveDaGerencia/siglaComparavel são os mesmos do VerAI
// (src/lib/integracao/chaves.test.ts lá) — as duas pontas precisam produzir a mesma chave.
describe('chaveDaGerencia', () => {
    it.each([
        ['GRC-4', 'GRC4'],
        ['grc4', 'GRC4'],
        ['grc4-beatriz', 'GRC4'],
        ['KAM 2', 'KAM2'],
        ['KAM10', 'KAM10'],
        ['kam3-gercino-teste', 'KAM3'],
        ['GRC-C', 'GRCC'],
        ['grcc-debora', 'GRCC'],
    ])('%s → %s', (entrada, chave) => expect(chaveDaGerencia(entrada)).toBe(chave));

    it.each([null, '', 'Tríade Digital', 'Sem carteira'])('%s não é gerência', (entrada) =>
        expect(chaveDaGerencia(entrada)).toBeNull()
    );
});

describe('sigla do cliente', () => {
    it('ignora acento, caixa, espaço e hífen', () => {
        expect(siglaComparavel('SP REGULA')).toBe('SPREGULA');
        expect(mesmaSigla('SP-REGULA', 'sp regula')).toBe(true);
        expect(mesmaSigla('SPTuris', 'SPTURIS')).toBe(true);
    });
    it('vazio nunca casa', () => {
        expect(mesmaSigla('', '')).toBe(false);
        expect(mesmaSigla(null, null)).toBe(false);
    });
    it('sigla diferente não casa, nem por prefixo', () => {
        expect(mesmaSigla('SF', 'SFM')).toBe(false);
    });
});

describe('clienteAtendido', () => {
    it('lê "SIGLA (Nome)", "SIGLA - Nome" e nome solto', () => {
        expect(clienteAtendido('SMIT (Secretaria Municipal de Inovação e Tecnologia)')).toEqual({
            sigla: 'SMIT',
            nome: 'Secretaria Municipal de Inovação e Tecnologia',
        });
        expect(clienteAtendido('SGM - Secretaria do Governo Municipal')).toEqual({ sigla: 'SGM', nome: 'Secretaria do Governo Municipal' });
        expect(clienteAtendido('SES PE (Secretaria de Saúde de Pernambuco)').sigla).toBe('SES PE');
        expect(clienteAtendido('Ouvidoria Geral do Município')).toEqual({ sigla: 'Ouvidoria Geral do Município', nome: null });
    });
});

describe('citaSigla', () => {
    it('acha a sigla escrita em maiúsculas como palavra', () => {
        expect(citaSigla('Procuradoria Geral do Município - PGM', 'PGM')).toBe(true);
        expect(citaSigla('Reunião na SEGES/COTIC', 'SEGES')).toBe(true);
        expect(citaSigla('Visita (SP-REGULA)', 'SP REGULA')).toBe(false); // hífen separa: SP e REGULA
    });
    it('não casa palavra minúscula nem pedaço de palavra', () => {
        expect(citaSigla('reunião sme', 'SME')).toBe(false);
        expect(citaSigla('SMESP', 'SME')).toBe(false);
        expect(citaSigla(null, 'SME')).toBe(false);
    });
});
