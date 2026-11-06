import { describe, expect, it } from 'vitest';
import type { CXItem, PipelineData, Project } from '@/types/manager';
import { mesclarCX, mesclarPipeline } from './mesclar-editor';

const q = (projects: Project[] = [], total = 0) => ({ total, projects });
const pipe = (d: Partial<PipelineData> = {}): PipelineData => ({ q1: q(), q2: q(), q3: q(), q4: q(), nao_mapeado: q(), ...d });
const p = (name: string, d: Partial<Project> = {}): Project => ({ name, value: 10, orgao: 'SMT', ...d });
const c = (id: number | undefined, d: Partial<CXItem> = {}): CXItem => ({ id, cliente: 'SMT', titulo: `t${id}`, problema: 'p', solucaoProposta: 's', status: 'pendente', ...d });

describe('mesclarPipeline', () => {
    it('acrescenta no trimestre certo a linha que só existe no banco e soma no total se ativa', () => {
        const r = mesclarPipeline(pipe(), pipe({ q2: q([p('Veio', { temperature: 'quente' }), p('Perdido', { temperature: 'perdido' })]) }));
        expect(r.q2.projects.map((x) => x.name)).toEqual(['Veio', 'Perdido']);
        expect(r.q2.total).toBe(10);
    });
    it('mantém a edição não salva e copia só o clienteId, mesmo em outro trimestre', () => {
        const r = mesclarPipeline(pipe({ q3: q([p('A', { value: 99, clienteId: null })]) }), pipe({ q1: q([p('A', { clienteId: 'c1' })]) }));
        expect(r.q1.projects).toEqual([]);
        expect(r.q3.projects).toEqual([p('A', { value: 99, clienteId: 'c1' })]);
    });
    it('cópia com mesmo nome e órgão não engole a linha que chegou', () => {
        const r = mesclarPipeline(pipe({ q1: q([p('A')]) }), pipe({ q1: q([p('A'), p('A')]) }));
        expect(r.q1.projects).toHaveLength(2);
    });
    it('órgão diferente é outra linha; linha nova do editor fica', () => {
        const r = mesclarPipeline(pipe({ q1: q([p('Novo', { orgao: undefined }), p('A', { orgao: 'X' })]) }), pipe({ q1: q([p('A')]) }));
        expect(r.q1.projects.map((x) => [x.name, x.orgao])).toEqual([['Novo', undefined], ['A', 'X'], ['A', 'SMT']]);
    });
    it('não altera a entrada', () => {
        const atual = pipe({ q1: q([p('A')]) });
        mesclarPipeline(atual, pipe({ q1: q([p('A', { clienteId: 'c1' }), p('B')]) }));
        expect(atual).toEqual(pipe({ q1: q([p('A')]) }));
    });
});

describe('mesclarCX', () => {
    it('casa por id: mantém a edição, copia clienteId e acrescenta o que falta', () => {
        const r = mesclarCX([c(1, { titulo: 'editado', clienteId: null }), c(undefined, { titulo: 'novo' })], [c(1, { clienteId: 'c1' }), c(2)]);
        expect(r).toEqual([c(1, { titulo: 'editado', clienteId: 'c1' }), c(undefined, { titulo: 'novo' }), c(2)]);
    });
    it('sem CX fresco mantém o estado; sem estado usa o fresco', () => {
        expect(mesclarCX([c(1)], undefined)).toEqual([c(1)]);
        expect(mesclarCX(undefined, [c(1)])).toEqual([c(1)]);
        expect(mesclarCX(undefined, undefined)).toBeUndefined();
    });
});
