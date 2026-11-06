import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { cenario } from '@/db/carteira.test-dados';
import { clienteDaLinha } from './linha';

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('clienteDaLinha', () => {
    it('casa pela sigla, pela sigla citada e pelo nome; nada casa → null', async () => {
        expect(await clienteDaLinha('SMT', 'grc3-barone')).toBe('c-smt');
        expect(await clienteDaLinha('Secretaria Municipal de Cultura', null)).toBe('c-smc');
        expect(await clienteDaLinha('Prefeitura de Valinhos', null)).toBeNull();
    });
});
