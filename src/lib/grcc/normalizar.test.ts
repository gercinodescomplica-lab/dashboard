import { describe, it, expect } from 'vitest';
import {
    parseValorBRL,
    parseDataIso,
    extractLeadDate,
    normalizarCategoria,
    normalizarUf,
    municipioDoCliente,
    chaveLead,
    textoOuNull,
} from './normalizar';
import { acharMunicipio, municipiosDaUf } from './municipios';

describe('parseValorBRL', () => {
    it.each([
        ['R$ 4.239.525,60', 4239525.6],
        [' R$ 9.099.830,44', 9099830.44],
        ['1.259.218,14', 1259218.14],
        ['349,020,12', 349020.12],
        ['4239525,6', 4239525.6],
        ['1.047.060', 1047060],
        ['260.758,68', 260758.68],
        [1500, 1500],
        ['', 0],
        [null, 0],
        [undefined, 0],
        ['R$ -', 0],
        ['R$                                             -', 0],
        ['-', 0],
    ])('%s → %s', (entrada, esperado) => {
        expect(parseValorBRL(entrada)).toBe(esperado);
    });

    it('texto sem número é ilegível (null)', () => {
        expect(parseValorBRL('a definir')).toBeNull();
    });
});

describe('parseDataIso', () => {
    it('serial do Excel', () => expect(parseDataIso(46336)).toBe('2026-11-10'));
    it('serial em texto', () => expect(parseDataIso('46336')).toBe('2026-11-10'));
    it('dd/mm/aaaa', () => expect(parseDataIso('05/03/2026')).toBe('2026-03-05'));
    it('dd/mm/aa', () => expect(parseDataIso('5/3/26')).toBe('2026-03-05'));
    it('ISO', () => expect(parseDataIso('2026-12-01T00:00:00Z')).toBe('2026-12-01'));
    it('Date (read-excel-file devolve Date em célula de data)', () =>
        expect(parseDataIso(new Date(Date.UTC(2026, 0, 31)))).toBe('2026-01-31'));
    it('data que não existe no calendário → null', () => {
        expect(parseDataIso('10/22/2026')).toBeNull(); // mm/dd americano: mês 22
        expect(parseDataIso('31/02/2026')).toBeNull();
        expect(parseDataIso('2026-02-30')).toBeNull();
        expect(parseDataIso('2026-13-01')).toBeNull();
        expect(parseDataIso('29/02/2028')).toBe('2028-02-29');
    });
    it('vazio/lixo → null', () => {
        expect(parseDataIso('')).toBeNull();
        expect(parseDataIso('sem data')).toBeNull();
    });
});

describe('extractLeadDate (compatível com a aba Cidades)', () => {
    it('lê ISO como data local', () => {
        const d = extractLeadDate({ previsao_fechamento: '2026-11-10' });
        expect(d?.getFullYear()).toBe(2026);
        expect(d?.getMonth()).toBe(10);
        expect(d?.getDate()).toBe(10);
    });
    it('sem campo → null', () => expect(extractLeadDate({})).toBeNull());
});

describe('normalizarCategoria', () => {
    it.each([
        ['Em trataivas', 'Em tratativas'],
        ['Em tratatativas', 'Em tratativas'],
        ['em tratativas', 'Em tratativas'],
        ['validação', 'Validação'],
        ['Validacao', 'Validação'],
        ['No cliente', 'No cliente'],
        ['Parceiro', 'Parceiro'],
        ['Perda', 'Perda'],
        ['Contratado', 'Contratado'],
        ['Sem classificação', 'Novo'],
        ['', 'Novo'],
        [null, 'Novo'],
        ['Lead', 'Novo'],
    ])('%s → %s', (entrada, esperado) => {
        expect(normalizarCategoria(entrada)).toBe(esperado);
    });
});

describe('normalizarUf', () => {
    it('maiúscula e válida', () => expect(normalizarUf(' sp ')).toBe('SP'));
    it('inválida → null', () => expect(normalizarUf('XX')).toBeNull());
    it('vazia → null', () => expect(normalizarUf('')).toBeNull());
});

describe('municipioDoCliente', () => {
    it.each([
        ['Prefeitura de Indaiatuba', 'Indaiatuba'],
        ['Camara Municipal de Londrina', 'Londrina'],
        ['Assembleia Legislativa de Parauapebas(PA)', 'Parauapebas'],
        ['Prefeitura Campos do Jordão', 'Campos do Jordão'],
        ['ALESP', 'ALESP'],
        ['Prefeitura de Betim - MG', 'Betim'],
    ])('%s → %s', (cliente, esperado) => {
        expect(municipioDoCliente(cliente)).toBe(esperado);
    });
});

describe('textoOuNull', () => {
    it.each(['#ERROR_#VALUE!', '#VALUE!', '#N/A', '#ERROR_#N/A', '#REF!', '#DIV/0!', '#NAME?', '#VALOR!'])(
        'erro do Excel "%s" vira vazio',
        (erro) => expect(textoOuNull(erro)).toBeNull()
    );
    it('texto com # no meio continua texto', () => expect(textoOuNull('Lote #2')).toBe('Lote #2'));
});

describe('municípios', () => {
    it('acha grafia oficial ignorando acento e caixa', () => {
        expect(acharMunicipio('SP', 'campos do jordao')).toBe('Campos do Jordão');
    });
    it('não acha em outra UF', () => {
        expect(acharMunicipio('RJ', 'Indaiatuba')).toBeNull();
    });
    it('lista por UF em ordem alfabética', () => {
        const sp = municipiosDaUf('SP');
        expect(sp.length).toBeGreaterThan(600);
        expect(sp).toContain('Indaiatuba');
    });
});

describe('chaveLead / textoOuNull', () => {
    it('ignora caixa, acento e espaços', () => {
        expect(chaveLead(' Prefeitura  de Indaiatuba ', 'Consultoria')).toBe(chaveLead('prefeitura de indaiatuba', 'CONSULTORIA'));
        expect(chaveLead('São Paulo', 'x')).toBe(chaveLead('Sao Paulo', 'x'));
    });
    it('textoOuNull', () => {
        expect(textoOuNull('  a ')).toBe('a');
        expect(textoOuNull('   ')).toBeNull();
        expect(textoOuNull('#VALUE!')).toBeNull();
        expect(textoOuNull(12)).toBe('12');
    });
});
