import { describe, it, expect } from 'vitest';
import { casarCliente, clienteDoServedClient } from './casar-cliente';

const clientes = [
    { id: 'pgm', nome: 'Procuradoria Geral do Município', sigla: 'PGM', gerencia: 'GRC1' },
    { id: 'seges', nome: 'Secretaria de Gestão', sigla: 'SEGES', gerencia: 'KAM3' },
    { id: 'ouv', nome: 'Ouvidoria Geral do Município', sigla: null, gerencia: 'GRC4' },
    { id: 'sme', nome: 'Secretaria Municipal da Educação', sigla: 'SME', gerencia: 'KAM1' },
];

describe('casarCliente', () => {
    it('casa sigla igual, sigla citada em maiúsculas e nome por extenso', () => {
        expect(casarCliente('pgm', clientes)).toBe('pgm');
        expect(casarCliente('Procuradoria Geral do Município - PGM', clientes)).toBe('pgm');
        expect(casarCliente('Ouvidoria Geral do Municipio', clientes)).toBe('ouv');
    });
    it('não casa o que não é único nem texto vazio', () => {
        expect(casarCliente('SEGES e SME', clientes)).toBeNull();
        expect(casarCliente('', clientes)).toBeNull();
        expect(casarCliente(null, clientes)).toBeNull();
        expect(casarCliente('Prefeitura de Valinhos', clientes)).toBeNull();
    });
    it('primeiro procura na carteira da gerência da linha', () => {
        expect(casarCliente('SEGES e SME', clientes, 'KAM1')).toBe('sme');
    });
});

describe('clienteDoServedClient', () => {
    it('lê o formato do served_clients', () => {
        expect(clienteDoServedClient('SMIT (Secretaria Municipal de Inovação e Tecnologia)')).toEqual({ sigla: 'SMIT', nome: 'Secretaria Municipal de Inovação e Tecnologia' });
        expect(clienteDoServedClient('SGM - Secretaria do Governo Municipal')).toEqual({ sigla: 'SGM', nome: 'Secretaria do Governo Municipal' });
        expect(clienteDoServedClient('Ouvidoria Geral do Município')).toEqual({ sigla: null, nome: 'Ouvidoria Geral do Município' });
        expect(clienteDoServedClient('ALESP')).toEqual({ sigla: 'ALESP', nome: 'ALESP' });
    });
});
