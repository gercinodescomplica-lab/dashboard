import { describe, it, expect } from 'vitest';
import { diffLead } from './diff';
import { LEAD_VAZIO } from './tipos';

const base = { ...LEAD_VAZIO, cliente: 'A', valor: 10, categoria: 'Novo' as const };

describe('diffLead', () => {
    it('sem mudança → vazio', () => expect(diffLead(base, { ...base })).toEqual([]));

    it('lista campos alterados na ordem canônica', () => {
        expect(diffLead(base, { ...base, valor: 20, categoria: 'No cliente', etapa: 'Proposta' })).toEqual([
            { campo: 'categoria', de: 'Novo', para: 'No cliente' },
            { campo: 'etapa', de: null, para: 'Proposta' },
            { campo: 'valor', de: 10, para: 20 },
        ]);
    });

    it('cadastro (antes null) → só campos preenchidos, de = null', () => {
        const m = diffLead(null, base);
        expect(m).toContainEqual({ campo: 'cliente', de: null, para: 'A' });
        expect(m).toContainEqual({ campo: 'valor', de: null, para: 10 });
        expect(m.find((x) => x.campo === 'etapa')).toBeUndefined();
        expect(m.find((x) => x.campo === 'solicitacao')).toBeUndefined(); // '' não conta como preenchido
    });

    it('trata "" e null como iguais', () => {
        expect(diffLead({ ...base, regiao: null }, { ...base, regiao: '' as unknown as null })).toEqual([]);
    });
});
