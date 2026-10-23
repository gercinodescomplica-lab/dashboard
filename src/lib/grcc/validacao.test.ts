import { describe, it, expect } from 'vitest';
import { validarLead, pendenciasDoLead } from './validacao';
import { LEAD_VAZIO } from './tipos';

const ok = { ...LEAD_VAZIO, cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', uf: 'SP', municipio: 'Indaiatuba', valor: 100 };

describe('validarLead', () => {
    it('aceita lead válido', () => expect(validarLead(ok)).toEqual({ ok: true, dados: ok }));

    it('exige motivo quando Perda', () => {
        const r = validarLead({ ...ok, categoria: 'Perda' });
        expect(r).toEqual({ ok: false, erros: { motivoPerda: 'Informe o motivo da perda.' } });
    });

    it('exige início do faturamento quando Contratado', () => {
        const r = validarLead({ ...ok, categoria: 'Contratado' });
        expect(r).toEqual({ ok: false, erros: { inicioFaturamento: 'Informe o início do faturamento.' } });
    });

    it('município precisa existir na UF', () => {
        const r = validarLead({ ...ok, uf: 'RJ' });
        expect(r).toEqual({ ok: false, erros: { municipio: 'Município não encontrado em RJ.' } });
    });

    it('na tela (exigirLocal) UF, município e solicitação são obrigatórios', () => {
        const r = validarLead({ ...ok, uf: null, municipio: null, solicitacao: '' }, { exigirLocal: true });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['municipio', 'solicitacao', 'uf']);
    });

    it('rejeita e-mail inválido, valor negativo e categoria desconhecida', () => {
        const r = validarLead({ ...ok, contatoEmail: 'x', valor: -1, categoria: 'Foo' });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['categoria', 'contatoEmail', 'valor']);
    });
});

describe('pendenciasDoLead', () => {
    it('lista o que falta', () => {
        expect(pendenciasDoLead({ ...LEAD_VAZIO, cliente: 'A' })).toEqual(['Sem UF', 'Sem município', 'Sem valor', 'Sem previsão']);
    });
    it('Perda não exige previsão; Contratado exige início', () => {
        expect(pendenciasDoLead({ ...ok, categoria: 'Perda', motivoPerda: 'Prazo' })).toEqual([]);
        expect(pendenciasDoLead({ ...ok, previsaoFechamento: '2026-11-01', categoria: 'Contratado' })).toEqual(['Sem início do faturamento']);
    });
});
